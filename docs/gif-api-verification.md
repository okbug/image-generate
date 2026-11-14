# GIF 接口验证

2026-11-14 对 `gpt-image-2.6-sunburst` 做了以下请求验证。凭证不进入仓库。

| 线路 | 参数 | 结果 |
| --- | --- | --- |
| 演示中转 `code.fe.sb` | 提示词要求 GIF，`response_format: b64_json` | HTTP 200；`output_format: png`，实际 PNG 文件头，1254×1254，无 APNG 动画块 |
| 演示中转 `code.fe.sb` | 加 `output_format: gif` | HTTP 400：`GIF output is not enabled for this request.` |
| 项目配置的官方线路 | `output_format: gif`，1024×1024 | HTTP 400；9 帧所需的 3072×3072 拼图超出当前像素预算 |
| 项目配置的官方线路 | 只在提示词要求 GIF，不传格式 | HTTP 200，实际 PNG |
| 项目配置的官方线路 | `output_format: gif`，512×512，`quality: auto`，`n: 1` | HTTP 200；`output_format: gif`，GIF89a 文件头，9 帧，每帧 200ms，总计 1.8 秒，91,921 字节 |

成功响应仍为常规图像 JSON：`data[].b64_json` 是完整 GIF 文件的 base64，`data[].generation_id` 为生成 ID，响应级 `output_format` 为 `gif`，并带 `size`、`quality`、`usage`。没有额外的轮询、帧列表或视频下载接口。

`POST /api/animate` 要求官方激活码，复用现有额度预留、使用记录与归还流程，固定模型、512×512、GIF 和单张输出。上游实际文件格式优先于声明；存储和下载保留原始字节，不重新编码动画。

验证回归：`node tests/image-formats.test.mjs`。
