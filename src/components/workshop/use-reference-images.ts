"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { App, Upload, type UploadFile, type UploadProps } from "antd";

import {
  MAX_UPLOAD_COUNT,
  UPLOAD_ACCEPT,
  type UploadedImage,
  validateUploadFile,
} from "./constants";

type UploadResponse = { url?: string; fileName?: string; error?: string };

/** fetch 拿不到上传进度，这里用 XHR 发 /api/upload，onProgress 收到 0~100。 */
function postWithProgress(
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<{ status: number; json: UploadResponse }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let json: UploadResponse = {};
      try {
        json = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        // 非 JSON 响应（如网关报错）按状态码处理
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.send(body);
  });
}

/**
 * 编辑模式的参考图上传：落盘到本站临时目录拿到公网 URL，
 * 移除 / 清空 / 页面卸载时顺手删掉服务端的临时文件。
 */
export function useReferenceImages({
  loading,
  setError,
}: {
  loading: boolean;
  setError: (message: string | null) => void;
}) {
  const { message } = App.useApp();
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const uploading = uploadFileList.some((file) => file.status === "uploading");
  const uploadedImagesRef = useRef<UploadedImage[]>([]);

  const deleteRemoteFile = useCallback(async (fileName: string) => {
    try {
      await fetch(`/api/upload?name=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });
    } catch {
      // 删除失败不阻塞主流程
    }
  }, []);

  // 错误条在表单下方，拖图时看不到，所以同时弹一条 toast
  function reportUploadError(text: string) {
    setError(text);
    void message.error(text);
  }

  function releaseUploadedImage(image: UploadedImage) {
    URL.revokeObjectURL(image.previewSrc);
    void deleteRemoteFile(image.fileName);
  }

  const clearUploadedImages = useCallback(() => {
    setUploadedImages((current) => {
      current.forEach((image) => {
        URL.revokeObjectURL(image.previewSrc);
        void deleteRemoteFile(image.fileName);
      });
      return [];
    });
    setUploadFileList([]);
  }, [deleteRemoteFile]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(
    () => () => {
      uploadedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewSrc);
        void deleteRemoteFile(image.fileName);
      });
    },
    [deleteRemoteFile],
  );

  async function uploadReferenceImage(
    file: File,
    uid: string,
  ): Promise<boolean> {
    if (loading) return false;
    const validationError = validateUploadFile(file);
    if (validationError) {
      reportUploadError(`${file.name}：${validationError}`);
      setUploadFileList((current) =>
        current.filter((item) => item.uid !== uid),
      );
      return false;
    }
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { status, json } = await postWithProgress(fd, (percent) => {
        setUploadFileList((current) =>
          current.map((item) =>
            item.uid === uid && item.status === "uploading"
              ? { ...item, percent }
              : item,
          ),
        );
      });
      if (status < 200 || status >= 300 || !json.url || !json.fileName) {
        reportUploadError(json.error ?? `上传失败 (${status})`);
        setUploadFileList((current) =>
          current.filter((item) => item.uid !== uid),
        );
        return false;
      }
      const uploadedImage: UploadedImage = {
        uid,
        url: json.url,
        fileName: json.fileName,
        previewSrc: URL.createObjectURL(file),
        name: file.name,
      };
      setUploadedImages((current) => [...current, uploadedImage]);
      setUploadFileList((current) =>
        current.map((item) =>
          item.uid === uid
            ? {
                ...item,
                status: "done",
                percent: 100,
                url: json.url,
                thumbUrl: uploadedImage.previewSrc,
                response: json,
              }
            : item,
        ),
      );
      return true;
    } catch (err) {
      reportUploadError(err instanceof Error ? err.message : "未知错误");
      setUploadFileList((current) =>
        current.filter((item) => item.uid !== uid),
      );
      return false;
    }
  }

  function handleUploadChange(nextFileList: UploadFile[]) {
    setUploadFileList(nextFileList.slice(0, MAX_UPLOAD_COUNT));
  }

  async function handleUploadRemove(file: UploadFile) {
    setUploadedImages((current) => {
      const removed = current.find((image) => image.uid === file.uid);
      if (removed) releaseUploadedImage(removed);
      return current.filter((image) => image.uid !== file.uid);
    });
    return true;
  }

  function removeUploadedImage(uid: string) {
    setUploadFileList((current) => current.filter((file) => file.uid !== uid));
    setUploadedImages((current) => {
      const removed = current.find((item) => item.uid === uid);
      if (removed) releaseUploadedImage(removed);
      return current.filter((item) => item.uid !== uid);
    });
  }

  const uploadProps: UploadProps = {
    accept: UPLOAD_ACCEPT,
    multiple: true,
    maxCount: MAX_UPLOAD_COUNT,
    fileList: uploadFileList,
    showUploadList: false,
    disabled: loading || uploadedImages.length >= MAX_UPLOAD_COUNT,
    pastable: true,
    beforeUpload: (file, fileList) => {
      const availableSlots = MAX_UPLOAD_COUNT - uploadFileList.length;
      const nextIndex = fileList.findIndex((item) => item.uid === file.uid);
      if (availableSlots <= 0 || nextIndex >= availableSlots) {
        reportUploadError(`最多只能上传 ${MAX_UPLOAD_COUNT} 张参考图片`);
        return Upload.LIST_IGNORE;
      }
      const validationError = validateUploadFile(file);
      if (validationError) {
        reportUploadError(`${file.name}：${validationError}`);
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    onChange: ({ fileList }) => handleUploadChange(fileList),
    onRemove: handleUploadRemove,
    customRequest: ({ file, onSuccess }) => {
      const imageFile = file as File & { uid?: string };
      const uid = imageFile.uid ?? `${Date.now()}-${imageFile.name}`;
      void uploadReferenceImage(imageFile, uid).then((ok) => {
        if (ok) onSuccess?.({ ok: true }, imageFile);
      });
    },
  };

  return {
    uploadedImages,
    uploadFileList,
    setUploadFileList,
    uploading,
    clearUploadedImages,
    uploadReferenceImage,
    removeUploadedImage,
    uploadProps,
  };
}
