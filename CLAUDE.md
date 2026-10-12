# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 项目概览

「AI 图片工坊」：Next.js 16（App Router + Turbopack）+ React 19 + antd 6 + Tailwind 4 的单页应用。
浏览器只跟本项目的 API 路由通信，路由再把请求转发到一个 OpenAI 兼容的上游服务
（生图/改图默认 `gpt-image-2`，提示词优化默认 `gpt-6.1-sol`）。另有 `/imagebed` 图床页（密码保护，永久存图）。

## 常用命令

```bash
npm run build    # next build + postbuild（把 public/ 和 .next/static 拷进 .next/standalone/）
npm run lint     # eslint（eslint-config-next core-web-vitals + typescript），当前 0 问题
npm run format   # prettier --write .（配置 .prettierrc.json，忽略规则 .prettierignore，Markdown 不格式化）
npm run format:check
npm run dev      # next dev -p 3005 —— 本机不要直接跑，3005 被生产服务占用（见下文）
npm start        # 手动起 standalone —— 本机不要用，生产由 systemd 管
```

- 没有测试框架，也没有测试。
- `node_modules` 是 pnpm 布局（`node_modules/.pnpm`），加依赖用 `pnpm add`（如 `pnpm add -D xxx`），**不要 `npm install`**，会把依赖目录搞乱。
  执行脚本照旧用 `npm run ...`。
- 本机想跑 dev 调试要换端口：`npx next dev -p 3006`。

## 架构

**前端（`src/app/page.tsx` + `src/components/workshop/*`）**
- `page.tsx` 只管状态和请求（生成 / 编辑 / 优化提示词 / 切模式）；界面拆在 `src/components/workshop/`：
  `PageHeader`、`ApiKeyNotice`、`ReferenceImagesInput`、`PromptInput`、`GenerationOptions`、`SubmitBar`、`ResultSection`、`TimingPanel`。
- 参考图上传的状态和逻辑在 `workshop/use-reference-images.ts`；常量、类型、纯函数（尺寸、上限、校验）在 `workshop/constants.ts`。
- 两种模式：`generate`（文生图）和 `edit`（参考图重绘）。edit 模式下参考图先 `POST /api/upload` 落盘为临时文件并拿到公网 URL，再把 URL 数组交给 `/api/edit`；上游是通过 URL 拉图的，所以域名必须公网可达。
- 也可以直接填外部图片 URL，此时本站不暂存。
- 页面加载时会 `POST /api/cleanup` 顺手清理过期临时图（没有 cron，全靠访问触发）。
- 参考图上限 10 张，在 `workshop/constants.ts` 的 `MAX_UPLOAD_COUNT` 和 `api/edit/route.ts` 两处硬编码，改要一起改。

**API 路由（全部 `runtime = "nodejs"`）**
- `/api/generate` → `{baseUrl}/v1/images/generations`，`response_format: b64_json`
- `/api/edit` → `{baseUrl}/v1/images/edits`，body 里 `images: [{ image_url }]`
- `/api/optimize-prompt` → `{baseUrl}/v1/chat/completions`
- `/api/upload` POST（表单带 `password` 且等于 `IMAGEBED_PASSWORD` 时写永久目录，否则写临时目录）/ DELETE（只删临时目录）
- `/api/cleanup` 删除临时目录中 30 分钟以前的文件（按文件名里的时间戳判断）
- 没填凭证时 `/api/generate`、`/api/edit`、`/api/optimize-prompt` 都返回 401。
- 上游报错统一原样透传 `{ error, detail }`，前端靠 `isGenerateError()` 判别。

**模型选择（`src/lib/models.ts`）**
- 生图模型三档写死在 `IMAGE_MODEL_OPTIONS`：`gpt-image-2`（默认）/ `gpt-image-2.5-flare`（更快）/ `gpt-image-2.5-sunburst`（更精细），
  下拉里带一句说明，加档只改这个数组即可（下拉两行说明靠 `globals.css` 里的 `.model-select-popup` 取消 antd 的单行截断）。
- 前端把选中的 model 放在 `/api/generate`、`/api/edit` 的请求体里；优化提示词的模型由用户在设置弹窗自由填写，
  存在 localStorage（`CustomApiSettings.optimizeModel`），随 `/api/optimize-prompt` 的 body 发过去。
- 后端一律走 `resolveImageModel()` / `resolveOptimizeModel()`：空值、非字符串或超长都回落到默认模型，不做白名单校验
  （用自己 Key 的用户可能有别的模型名）。

**凭证解析（`src/lib/api-credentials.ts`）**
- **只认请求头** `x-image-api-base-url` / `x-image-api-key`，不再回落到环境变量（2026-10-12 起）：用户没填自己的 BaseURL + Key 就不能用，
  后端返回 401 + `MISSING_CREDENTIALS_ERROR`。`.env.local` 里的 `IMAGE_API_BASE_URL` / `IMAGE_API_KEY` 目前代码已不读取。
- 前端 `useCustomApi()` 把用户在「API 与模型设置」弹窗里填的凭证存在 localStorage，每次请求通过 `buildHeaders()` 附到请求头；后端不持久化。
  两项都填了就算可用（`enabled` 字段只为兼容旧数据，已无开关）；没填时页面显示提示条，生成/编辑/优化按钮禁用，点击会打开设置弹窗。

**上传存储（`src/lib/upload-store.ts`）**
- 文件名格式固定为 `<13位毫秒时间戳>-<uuid>.<png|jpg|webp>`，`UPLOAD_NAME_RE` 同时用于防路径穿越和清理判定。
- 目录由 `UPLOAD_TMP_DIR` / `UPLOAD_PERMANENT_DIR` 决定，缺省为 `process.cwd()/public/images/{tmp,permanent}`。
- 图片通过 `/images/tmp/[name]` 和 `/images/permanent/[name]` 两个 route handler 读盘返回，而不是当 Next 静态资源——运行时新增的文件不在构建产物里，走静态资源会 404。
- 所有 `fs`/`path` 调用都带 `/*turbopackIgnore: true*/` 注释，避免 Turbopack 把整个项目追踪进产物；新增文件系统操作要沿用。
- 图床密码硬编码在 `upload-store.ts`（`IMAGEBED_PASSWORD`）和 `src/app/imagebed/page.tsx` 两处。

**UI 层**
- `AntdProvider` 用 MutationObserver 监听 `<html class="dark">` 切换 antd 主题；`layout.tsx` 内联脚本按系统偏好加 `dark` 类。antd 通过 `@ant-design/nextjs-registry` 注入样式。
- `src/components/ui/*` 是 shadcn（base-nova 风格）生成的组件，`components.json` 是其配置。

## 生产部署（本机，重要）

**当前状态：3005 端口正在跑生产服务，任何操作都不能把它搞挂。**

- 域名：`https://image.131438.xyz` 和 `https://image.fe.sb`，都在 `/etc/caddy/Caddyfile` 里 `reverse_proxy 127.0.0.1:3005`，Caddy 自动签发/续期证书。改 Caddyfile 后 `systemctl reload caddy`；加新域名只需再加一个同样的 block（DNS 先指到本机）。
- 进程由 systemd 管理：`image-generate.service`
  - 单元文件 `/etc/systemd/system/image-generate.service`：`WorkingDirectory=/root/projects/image-generate`，`ExecStart=/root/.nvm/versions/node/v22.22.1/bin/node .next/standalone/server.js`，`EnvironmentFile=.env.local`，`PORT=3005`，`HOSTNAME=0.0.0.0`，`Restart=always`。
  - drop-in `/etc/systemd/system/image-generate.service.d/override.conf`：`UPLOAD_TMP_DIR=/root/projects/image-generate/public/images/tmp`。
  - 环境变量 `IMAGE_API_BASE_URL` / `IMAGE_API_KEY` 在 `.env.local`（不入库，模板见 `.env.example`）。
- Node 版本以 ExecStart 里的 nvm 路径为准（v22.22.1）；升级 node 要同步改单元文件。

**修改代码后的部署流程**

```bash
cd /root/projects/image-generate
npm run build                                  # 约 30s，期间旧进程继续服务
systemctl restart image-generate               # 唯一会中断服务的一步，秒级
systemctl status image-generate --no-pager     # 确认 active (running)
journalctl -u image-generate -n 30 --no-pager  # 看启动日志
curl -sI http://127.0.0.1:3005 | head -1       # 200 即可
```

- 改了 `.env.local` 或单元文件也要 `systemctl restart`（单元文件改动前先 `systemctl daemon-reload`）。
- **绝对不要** `pkill`/`kill`/`fuser -k` 3005 上的进程，也不要手动 `npm start` 或 `npm run dev` 抢 3005：systemd 会立刻拉起新实例，和手动起的进程互相 `EADDRINUSE`，进入崩溃循环（2026-08-03 就这样翻过车，最后靠 `fuser -k 3005/tcp && systemctl restart image-generate` 救回）。一切启停都走 `systemctl`。
- `public/` 里新放的静态文件不会马上可访问：线上读的是 `.next/standalone/public/` 这份拷贝，要 `npm run build` 让 postbuild 重新拷，或手动 `cp` 进去（2026-09-02 把 tar.gz 丢进 `public/` 后 404 就是这个原因）。
- 本机没有 `lsof` / `zip` / `rsync`。查端口用 `ss -ltnp | grep 3005` 或 `fuser 3005/tcp`。

**已知隐患：图床永久目录**
- `.next/standalone/server.js` 会 `process.chdir(__dirname)`，而 service 只设置了 `UPLOAD_TMP_DIR`，没设 `UPLOAD_PERMANENT_DIR`，所以图床永久图实际落在 `.next/standalone/public/images/permanent/`，不在项目根的 `public/images/permanent/`。
- `next build` 默认 `cleanDistDir: true`，会清空 `.next/`，**重新 build 会把已上传的永久图一起删掉**。要保住这些图，部署前先把 `.next/standalone/public/images/permanent/` 备份出来；根治办法是在 `override.conf` 里加 `Environment=UPLOAD_PERMANENT_DIR=/root/projects/image-generate/public/images/permanent`，然后 `daemon-reload` + `restart`，并把旧文件挪过去。

## 历史会话摘要（本机 `~/.claude/projects/-root-projects-image-generate/`）

- 2026-08-03：给 Caddy 加了 `image.fe.sb` 并自动签证书；把参考图上限 3 → 10 并重新部署（踩了上面的 pkill 坑）。
- 2026-09-02：把项目打成 `image-generate.tar.gz`（排除 node_modules/.next/.git）供下载，顺手起了个 `python3 -m http.server 8765` 临时服务，可能仍在跑，不需要时 `ss -ltnp | grep 8765` 找到后关掉即可。`image-generate.tar.gz` 和 `public/image-generate.tar.gz` 都是这次留下的产物，不要提交。
