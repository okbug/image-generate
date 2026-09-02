# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 项目概览

「AI 图片工坊」：Next.js 16（App Router + Turbopack）+ React 19 + antd 6 + Tailwind 4。
浏览器只跟本项目的 API 路由通信，路由再把请求转发到一个 OpenAI 兼容的上游服务
（图片生成/编辑用 `gpt-image-2`，提示词优化用 `gpt-5.5`）。另有 `/imagebed` 图床页（密码保护，永久存图）。

`dev` 分支起（本文件描述的即该版本）加入了账号体系：用户名+密码注册登录、余额计费、`/admin` 管理后台
（充值、定价、配置默认生图 API）。数据存 SQLite（Node 内置 `node:sqlite`，无原生依赖）。

## 常用命令

```bash
npm run dev         # next dev -p 3006（Next 16 的 dev 产物在 .next/dev，不会碰生产用的 .next/standalone）
npm run typecheck   # tsc --noEmit；RouteContext 等类型需先 `npx next typegen`（或跑过一次 dev/build）
npm run lint        # eslint（eslint-config-next core-web-vitals + typescript）
NEXT_DIST_DIR=.next-dev npm run build   # 构建到 .next-dev/，见「构建隔离」
NEXT_DIST_DIR=.next-dev npm start       # 端口默认 3006，可用 PORT= 覆盖
```

- 没有测试框架，也没有测试。验证方式是 typecheck + lint + 起 dev 用 curl 打接口。
- 仓库里有 `pnpm-lock.yaml`，但本机历来用 `npm run ...` 执行脚本，`node_modules` 已就位，不要重新换包管理器安装。
- 运行时需要 Node ≥ 22.13（`node:sqlite`）。本机 nvm 默认 v22.22.1。
- 环境变量见 `.env.example`：`IMAGE_API_BASE_URL/KEY`（兜底凭证）、`ADMIN_INITIAL_USERNAME/PASSWORD`（仅首次建库生效，默认 admin/admin123）、`DATA_DIR`（SQLite 目录）。

## 架构

**前端（`src/app/page.tsx`，单个客户端组件）**
- 两种模式：`generate`（文生图）和 `edit`（参考图重绘）。edit 模式下参考图先 `POST /api/upload` 落盘为临时文件并拿到公网 URL，再把 URL 数组交给 `/api/edit`；上游是通过 URL 拉图的，所以域名必须公网可达。
- 也可以直接填外部图片 URL，此时本站不暂存。
- 页面加载时会 `POST /api/cleanup` 顺手清理过期临时图（没有 cron，全靠访问触发）。
- 参考图上限 10 张，在 `page.tsx` 的 `MAX_UPLOAD_COUNT` 和 `api/edit/route.ts` 两处硬编码，改要一起改。

**API 路由（全部 `runtime = "nodejs"`）**
- `/api/generate` → `{baseUrl}/v1/images/generations`，`response_format: b64_json`
- `/api/edit` → `{baseUrl}/v1/images/edits`，body 里 `images: [{ image_url }]`
- `/api/optimize-prompt` → `{baseUrl}/v1/chat/completions`
- `/api/upload` POST（表单带 `password` 且等于 `IMAGEBED_PASSWORD` 时写永久目录，否则写临时目录）/ DELETE（只删临时目录）
- `/api/cleanup` 删除临时目录中 30 分钟以前的文件（按文件名里的时间戳判断）
- 上游报错统一原样透传 `{ error, detail }`，前端靠 `isGenerateError()` 判别。

**凭证解析（`src/lib/api-credentials.ts`）**
- 优先级：请求头 `x-image-api-base-url` / `x-image-api-key`（source=custom）→ 后台设置里保存的 BaseURL/Key（settings）→ 环境变量 `IMAGE_API_BASE_URL` / `IMAGE_API_KEY`（env）。
- 前端 `useCustomApi()` 把用户在「自定义 API」弹窗里填的凭证存在 localStorage，每次请求通过 `buildHeaders()` 附到请求头；后端不持久化。
- `source === "custom"` 时不扣余额（用户用的是自己的 Key）。

**账号、余额与后台**
- 存储：`src/lib/db.ts` 用 `process.getBuiltinModule("node:sqlite")` 打开 `${DATA_DIR:-./data}/app.db`，首次访问自动建表（users / sessions / settings / transactions）并植入默认定价和初始管理员。单例挂在 `globalThis` 上防 HMR 重复打开。
- 金额全部是整数「分」（`src/lib/money.ts` 负责换算/格式化）。默认生成 100 分/张、编辑 100 分/次、优化提示词 0。
- 密码 scrypt 加盐哈希（`src/lib/password.ts`）；会话是随机 token 存 sessions 表，cookie `ig_session`（httpOnly、lax、30 天），是否 `secure` 按 `X-Forwarded-Proto` 判断，所以经 Caddy 的 https 和直连 http 都能登录（`src/lib/auth.ts`）。
- 路由守卫不用 proxy/middleware：API 里 `requireUser()` / `requireAdmin()` 返回用户或 401/403 的 `NextResponse`（调用处 `if (x instanceof NextResponse) return x`）；`/admin/page.tsx` 是服务端组件，未登录 `redirect("/login?next=/admin")`。
- 计费在 `src/lib/upstream.ts` 的 `billedUpstreamCall()`：先在事务里扣费（余额不足 → 402 `INSUFFICIENT_BALANCE`），再调上游，上游失败自动写一条 `refund` 流水退款；成功响应统一多一个 `billing: { charged, balance }` 字段，前端据此刷新余额。`/api/generate`、`/api/edit`、`/api/optimize-prompt` 都走它，并且都要求登录；`/api/upload` 临时上传也要求登录（图床密码模式除外）。
- 后台 API 在 `src/app/api/admin/*`（用户列表 / 改角色重置密码 / 加减余额 / 设置 / 流水），页面 `src/app/admin/AdminPanel.tsx`（antd Table/Form，`App.useApp()` 取 message，所以 `AntdProvider` 里包了 `<App component={false}>`）。
- 前端状态：`useAuth()`（`src/lib/use-auth.ts`）拉 `/api/auth/me` 得到用户和公开定价；`UserBar` 显示用户名、余额、后台入口、退出。登录/注册页复用 `AuthForm`，用 `useSearchParams` 所以页面外层包了 `<Suspense>`。

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

**构建隔离：dev 分支实例（3006）不能碰生产的 `.next/`**
- 生产进程一直在从 `.next/standalone/` 读文件，而 `next build` 默认先清空 `.next/`。所以在这个目录里**不要裸跑 `npm run build`**，除非你就是要发布生产。
- `next.config.ts` 支持 `NEXT_DIST_DIR` 覆盖 `distDir`；`postbuild` / `start` 脚本也跟着这个变量。dev 分支的构建与启动：

```bash
NEXT_DIST_DIR=.next-dev npm run build
NEXT_DIST_DIR=.next-dev PORT=3006 DATA_DIR=/root/projects/image-generate/data npm start
```

- 想让 3006 实例常驻，照 `image-generate.service` 复制一个 `image-generate-dev.service`：`ExecStart=... node .next-dev/standalone/server.js`，`Environment=PORT=3006`、`DATA_DIR=/root/projects/image-generate/data`、`UPLOAD_TMP_DIR=...public/images/tmp`、`UPLOAD_PERMANENT_DIR=...public/images/permanent`。Caddy 里再加一个域名 block 反代到 `127.0.0.1:3006` 即可。
- `DATA_DIR` 一定要给绝对路径：standalone 的 `server.js` 会 `chdir` 到产物目录，默认的 `./data` 会落在 `.next*/standalone/` 里，下次 build 就没了。

**已知隐患：图床永久目录**
- `.next/standalone/server.js` 会 `process.chdir(__dirname)`，而 service 只设置了 `UPLOAD_TMP_DIR`，没设 `UPLOAD_PERMANENT_DIR`，所以图床永久图实际落在 `.next/standalone/public/images/permanent/`，不在项目根的 `public/images/permanent/`。
- `next build` 默认 `cleanDistDir: true`，会清空 `.next/`，**重新 build 会把已上传的永久图一起删掉**。要保住这些图，部署前先把 `.next/standalone/public/images/permanent/` 备份出来；根治办法是在 `override.conf` 里加 `Environment=UPLOAD_PERMANENT_DIR=/root/projects/image-generate/public/images/permanent`，然后 `daemon-reload` + `restart`，并把旧文件挪过去。

## 历史会话摘要（本机 `~/.claude/projects/-root-projects-image-generate/`）

- 2026-08-03：给 Caddy 加了 `image.fe.sb` 并自动签证书；把参考图上限 3 → 10 并重新部署（踩了上面的 pkill 坑）。
- 2026-09-02：把项目打成 `image-generate.tar.gz`（排除 node_modules/.next/.git）供下载，顺手起了个 `python3 -m http.server 8765` 临时服务，可能仍在跑，不需要时 `ss -ltnp | grep 8765` 找到后关掉即可。`image-generate.tar.gz` 和 `public/image-generate.tar.gz` 都是这次留下的产物，不要提交。
