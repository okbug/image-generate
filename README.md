# AI 图片工坊

一个轻量的 AI 生图 / 改图网页，对接任意 **OpenAI 兼容** 的图像接口。用户在浏览器里填自己的 BaseURL 和 API Key，写一句话就能出图，也可以上传参考图让模型重绘。

基于 Next.js 16（App Router）+ React 19 + antd 6 + Tailwind CSS 4。

## 功能

- **文生图**：输入提示词，选择模型、尺寸（含 4K 与自定义宽高）、质量，一键生成。
- **参考图重绘**：上传最多 10 张参考图（单张 ≤ 20MB，支持拖拽、粘贴），或直接填写图片 URL，描述想要的修改。地址栏带 `?mode=edit` 可直接进入编辑模式。
- **提示词优化**：调用对话模型润色提示词，可在「撤销优化 / 恢复优化」之间切换。
- **结果处理**：显示耗时、tokens 和图片大小；可下载，也可以把结果直接作为参考图继续修改。
- **最近生成**：生成的图片保存到图床，首页底部列出最近 50 张，可预览、下载、继续编辑、删除或一键清空；记录只存在本浏览器，可用开关关闭。
- **出图耗时统计**：按模型记录最近的出图耗时，方便比较。
- **图床**：`/imagebed` 输入密码后可上传图片并获得永久链接；`/imagebed/tmp` 可查看临时目录里的图片。
- **一键演示配置**：`/demo` 输入访问密码（北京时间当天日期 `YYYYMMDD`）后，可一键把演示用的 BaseURL + Key 填入浏览器。
- **深浅色主题**：跟随系统，暖色调界面。

## 凭证与隐私

- 生图、改图、优化提示词都**必须**使用用户自己填写的 BaseURL + API Key。凭证只保存在浏览器的 localStorage 中，每次请求通过请求头 `x-image-api-base-url` / `x-image-api-key` 转发给上游，服务端不持久化。
- 编辑模式上传的参考图会暂存在服务器的临时目录中，并生成一个公网 URL 交给上游拉取。
- 生成的图片会上传到 PicBed 图床（配置了 `PICBED_*` 时），接口只返回图片 URL，不再返回 base64；没配置或上传失败时，回落为本站临时文件（文件名带 `gen-` 标识，约 30 分钟后清理）。
- 首页底部「最近生成」的记录只保存在浏览器的 localStorage 中，可以通过开关关闭；删除或一键清空会同时删除图床中的图片。

## 快速开始

需要 Node.js 20+ 和 [pnpm](https://pnpm.io/)。

```bash
pnpm install
cp .env.example .env.local   # 按需填写，见下文
pnpm dev                     # http://localhost:3005
```

打开页面后，点右上角的设置按钮，填写 BaseURL（例如 `https://api.openai.com`）和 API Key 即可使用。

其他脚本：

```bash
pnpm build          # 生产构建（standalone 产物，postbuild 会拷贝 public 与静态资源）
pnpm lint           # ESLint
pnpm format         # Prettier 格式化
```

## 环境变量

全部为可选项，放在 `.env.local` 中（该文件不入库）。

| 变量 | 作用 |
| --- | --- |
| `IMAGEBED_PASSWORD` | 图床密码，用于 `/imagebed` 解锁、永久存图以及 `/imagebed/tmp` 列表。只在服务端比对，不填则图床无法解锁。 |
| `DEMO_API_BASE_URL` / `DEMO_API_KEY` | `/demo` 一键填入的演示凭证，访问密码校验通过后才会下发。不填则 `/demo` 提示「未就绪」。 |
| `PICBED_BASE_URL` / `PICBED_TOKEN` | 出图结果上传的 PicBed 图床地址与 Token（只在服务端使用）。不填则出图结果存为本站 30 分钟临时图，「最近生成」不记录。 |
| `UPLOAD_TMP_DIR` | 临时图片目录，默认 `<cwd>/public/images/tmp`。 |
| `UPLOAD_PERMANENT_DIR` | 图床永久图片目录，默认 `<cwd>/public/images/permanent`。 |

> `.env.example` 中的 `IMAGE_API_BASE_URL` / `IMAGE_API_KEY` 是旧版本留下的，当前代码已不再读取。

## 模型

生图模型在 `src/lib/models.ts` 的 `IMAGE_MODEL_OPTIONS` 中配置，默认为 `gpt-image-2.5-sunburst`，另有 `gpt-image-2` 和 `gpt-image-2.5-flare` 两档。要增加档位，只需修改这个数组，默认模型需放在第一项。

后端不做模型白名单校验：传入的模型名为空或不合法时，回落到默认模型。优化提示词所用的模型可以在设置弹窗中自由填写。

## 页面与接口

| 路径 | 说明 |
| --- | --- |
| `/` | 工坊主页（生成 / 编辑） |
| `/demo` | 一键填入演示配置 |
| `/imagebed`、`/imagebed/tmp` | 图床、临时图片列表 |
| `POST /api/generate` | 转发到 `{baseUrl}/v1/images/generations` |
| `POST /api/edit` | 转发到 `{baseUrl}/v1/images/edits`，参考图以 URL 形式传给上游 |
| `POST /api/optimize-prompt` | 转发到 `{baseUrl}/v1/chat/completions` |
| `POST/DELETE /api/upload` | 上传 / 删除图片（带正确的图床密码时存为永久图） |
| `DELETE /api/generated` | 删除图床中的出图结果（需要出图时签发的删除凭证） |
| `POST /api/cleanup` | 清理 30 分钟前的临时图片 |
| `GET /images/tmp/[name]`、`/images/permanent/[name]` | 读取已上传的图片 |

上游返回的报错会以 `{ error, detail }` 的形式原样透传给前端。

## 部署

项目使用 `output: "standalone"`。构建后运行：

```bash
pnpm build
PORT=3005 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

部署时需要注意：

- **域名必须公网可达**：编辑模式下，上游是通过图片 URL 拉取参考图的。
- **建议显式设置图片目录**：`server.js` 启动时会把工作目录切换到 `.next/standalone/`，而重新构建会清空 `.next/`。为了不丢失已上传的图片，请把 `UPLOAD_TMP_DIR` / `UPLOAD_PERMANENT_DIR` 设置为 `.next/` 以外的绝对路径。
- **新增静态文件需要重新构建**：线上读取的是 `.next/standalone/public/` 中的拷贝，`public/` 里新增的文件要重新构建后才能访问。
- **需要进程守护**：推荐用 systemd 或 pm2 等守护进程，并在前面加 Caddy / Nginx 反向代理来提供 HTTPS。

## 目录结构

```
src/
├── app/                 # 页面与 API 路由（App Router）
│   ├── api/             # generate / edit / optimize-prompt / upload / cleanup / demo / imagebed ...
│   ├── demo/            # 一键配置页
│   └── imagebed/        # 图床
├── components/
│   ├── workshop/        # 工坊主页的各个区块与上传逻辑
│   └── ui/              # shadcn 组件
└── lib/                 # 模型配置、凭证、上传存储、耗时统计等
```
