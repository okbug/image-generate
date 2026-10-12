"use client";

import { useState } from "react";
import { Upload, type UploadFile, type UploadProps } from "antd";
import { UploadCloud, X, Lock, Unlock, Image as ImageIcon } from "lucide-react";

const MAX_UPLOAD_COUNT = 10;
const UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

type UploadedImage = {
  uid: string;
  url: string;
  fileName: string;
  previewSrc: string;
  name: string;
  size: number;
  mime: string;
};

export default function ImageBedPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const uploading = uploadFileList.some((file) => file.status === "uploading");

  function validateUploadFile(file: File): string | null {
    if (!UPLOAD_ACCEPT.split(",").includes(file.type)) {
      return "仅支持 PNG / JPG / WebP";
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return "图片不能超过 10MB";
    }
    return null;
  }

  function handleUploadChange(nextFileList: UploadFile[]) {
    setUploadFileList(nextFileList.slice(0, MAX_UPLOAD_COUNT));
  }

  function handleUnlock() {
    if (password === process.env.NEXT_PUBLIC_IMAGEBED_PASSWORD) {
      setIsUnlocked(true);
    } else {
      alert("密码错误");
    }
  }

  function handleLock() {
    setIsUnlocked(false);
    setPassword("");
  }

  async function uploadImage(file: File, uid: string): Promise<boolean> {
    const validationError = validateUploadFile(file);
    if (validationError) {
      alert(validationError);
      setUploadFileList((current) =>
        current.filter((item) => item.uid !== uid),
      );
      return false;
    }

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("password", password);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as {
        url?: string;
        fileName?: string;
        error?: string;
        permanent?: boolean;
      };

      if (!res.ok || !json.url || !json.fileName) {
        alert(json.error ?? `上传失败 (${res.status})`);
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
        size: file.size,
        mime: file.type,
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
      alert(err instanceof Error ? err.message : "未知错误");
      setUploadFileList((current) =>
        current.filter((item) => item.uid !== uid),
      );
      return false;
    }
  }

  async function handleUploadRemove(file: UploadFile) {
    setUploadedImages((current) => {
      const removed = current.find((image) => image.uid === file.uid);
      if (removed) {
        URL.revokeObjectURL(removed.previewSrc);
      }
      return current.filter((image) => image.uid !== file.uid);
    });
    return true;
  }

  const uploadProps: UploadProps = {
    accept: UPLOAD_ACCEPT,
    multiple: true,
    maxCount: MAX_UPLOAD_COUNT,
    fileList: uploadFileList,
    showUploadList: false,
    disabled: !isUnlocked || uploadedImages.length >= MAX_UPLOAD_COUNT,
    pastable: true,
    beforeUpload: (file, fileList) => {
      const availableSlots = MAX_UPLOAD_COUNT - uploadFileList.length;
      const nextIndex = fileList.findIndex((item) => item.uid === file.uid);
      if (availableSlots <= 0 || nextIndex >= availableSlots) {
        alert(`最多只能上传 ${MAX_UPLOAD_COUNT} 张图片`);
        return Upload.LIST_IGNORE;
      }
      const validationError = validateUploadFile(file);
      if (validationError) {
        alert(validationError);
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    onChange: ({ fileList }) => handleUploadChange(fileList),
    onRemove: handleUploadRemove,
    customRequest: ({ file, onSuccess }) => {
      const imageFile = file as File & { uid?: string };
      const uid = imageFile.uid ?? `${Date.now()}-${imageFile.name}`;
      void uploadImage(imageFile, uid).then((ok) => {
        if (ok) onSuccess?.({ ok: true }, imageFile);
      });
    },
  };

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("已复制到剪贴板");
      })
      .catch(() => {
        alert("复制失败");
      });
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 md:gap-10">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                <span className="gradient-text">图床服务</span>
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                上传图片获取公网访问地址
              </p>
            </div>
          </div>
        </header>

        {!isUnlocked ? (
          <div className="glass rounded-2xl p-6 sm:rounded-3xl sm:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <Lock className="h-5 w-5" />
                <span className="font-medium">需要密码验证</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="flex-1 h-12 rounded-xl border border-zinc-200 bg-white/80 px-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUnlock();
                  }}
                />
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={!password.trim()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition active:scale-[0.98] hover:shadow-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Unlock className="h-4 w-4" />
                  解锁
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-4 py-2 dark:border-emerald-700/60 dark:bg-emerald-500/10">
                <Unlock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  已解锁 - 永久存储模式
                </span>
              </div>
              <button
                type="button"
                onClick={handleLock}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/70 px-3 text-xs text-zinc-700 transition active:scale-95 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Lock className="h-3.5 w-3.5" />
                重新锁定
              </button>
            </div>

            <div className="glass rounded-2xl p-6 sm:rounded-3xl sm:p-8">
              <div className="flex flex-col gap-4">
                <Upload.Dragger {...uploadProps}>
                  <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
                    {uploading ? (
                      <span className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
                    ) : (
                      <UploadCloud className="h-10 w-10 text-indigo-500" />
                    )}
                    <span className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                      点击、拖拽或粘贴图片
                    </span>
                    <span className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                      支持 PNG / JPG / WebP，单张最大 10MB，最多{" "}
                      {MAX_UPLOAD_COUNT} 张
                    </span>
                  </div>
                </Upload.Dragger>

                {uploadedImages.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                      <span>
                        已上传 {uploadedImages.length}/{MAX_UPLOAD_COUNT}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          uploadedImages.forEach((img) => {
                            URL.revokeObjectURL(img.previewSrc);
                          });
                          setUploadedImages([]);
                          setUploadFileList([]);
                        }}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        清空全部
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {uploadedImages.map((image, idx) => (
                        <div
                          key={image.uid}
                          className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.previewSrc}
                            alt={`已上传图片 ${idx + 1}`}
                            className="h-40 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setUploadFileList((current) =>
                                current.filter(
                                  (file) => file.uid !== image.uid,
                                ),
                              );
                              setUploadedImages((current) => {
                                URL.revokeObjectURL(image.previewSrc);
                                return current.filter(
                                  (item) => item.uid !== image.uid,
                                );
                              });
                            }}
                            className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-zinc-950/70 text-white shadow-sm transition hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <div className="flex flex-col gap-2 px-4 py-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                图片 #{idx + 1}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {formatFileSize(image.size)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(image.url)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 text-xs font-medium text-white transition active:scale-95 hover:bg-indigo-600"
                            >
                              复制链接
                            </button>
                            <input
                              type="text"
                              value={image.url}
                              readOnly
                              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                              onClick={(e) => e.currentTarget.select()}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-400">
              <p className="font-medium mb-1">使用说明：</p>
              <ul className="list-disc list-inside space-y-1 text-zinc-500 dark:text-zinc-500">
                <li>上传的图片将永久存储在服务器</li>
                <li>支持拖拽上传和粘贴上传（Ctrl/Cmd + V）</li>
                <li>点击「复制链接」可直接复制图片地址</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
