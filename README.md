# gmt-server

一个基于 Headless Chromium 的“网页转图片”服务，提供单一 HTTP 接口 `/render`：

- `mode=auto`：优先尝试解析页面 `window._pageData` 并拼接长图；失败则自动回退到整页截图
- `mode=screenshot`：强制整页截图（Playwright）
- `mode=stitch`：强制拼接（若无法拼接会回退到截图）

## 架构概览

- HTTP 服务：Fastify（入口：[src/index.ts](file:///Users/admin/Documents/company/fond-electron/gmt-server/src/index.ts)）
- 渲染编排与参数校验：zod + renderToImage（[src/render.ts](file:///Users/admin/Documents/company/fond-electron/gmt-server/src/render.ts)）
- 整页截图：Playwright（[src/screenshot.ts](file:///Users/admin/Documents/company/fond-electron/gmt-server/src/screenshot.ts)）
- `_pageData` 解析 + 图片拼接：axios + sharp（[src/pageData.ts](file:///Users/admin/Documents/company/fond-electron/gmt-server/src/pageData.ts)、[src/stitch.ts](file:///Users/admin/Documents/company/fond-electron/gmt-server/src/stitch.ts)）
- 并发控制：进程内 Semaphore（超过并发会在服务端排队等待）（[src/semaphore.ts](file:///Users/admin/Documents/company/fond-electron/gmt-server/src/semaphore.ts)）

返回图片默认不落盘，响应里使用 `dataUrl`（`data:image/...;base64,...`）。

## 部署/启动

### 依赖

- Node.js 18+（建议 20+）
- 首次安装需要下载 Chromium（Playwright）

### 安装

```bash
cd /Users/admin/Documents/company/fond-electron/gmt-server
npm install
npx playwright install chromium
```

### 运行（生产）

```bash
npm run build
PORT=8081 npm run start
```

### 运行（开发）

```bash
PORT=8081 npm run dev
```

### 环境变量

- `PORT`：监听端口，默认 `5179`
- `HOST`：监听地址，默认 `0.0.0.0`
- `RENDER_CONCURRENCY`：同一时刻最多并发渲染任务数，默认 `2`（其余请求会在服务端排队）
- `MAX_STITCH_HEIGHT`：拼接输出最大高度（像素），默认 `30000`；超过会回退到截图

## 用例

### 1) 健康检查

```bash
curl -sS http://localhost:8081/health
```

期望输出：

```json
{"ok":true}
```

### 2) 生成图片（保存响应 JSON）

```bash
curl -sS -X POST 'http://localhost:8081/render' \
  -H 'content-type: application/json' \
  --data-raw '{"url":"","mode":"auto","format":"jpeg","quality":70,"fullPage":true,"timeoutMs":45000}' \
  > /tmp/render.json
```

说明：

- `/tmp` 在 macOS/Linux 上通常存在，是系统临时目录；Windows 没有该路径
- 线上通常不需要把响应写到 `/tmp`，这里只是本地验证用

### 3) 从响应 JSON 还原图片文件（macOS/Linux）

```bash
python3 - <<'PY'
import json, base64, re
j=json.load(open("/tmp/render.json","r",encoding="utf-8"))
data=j["result"]["dataUrl"]
m=re.match(r"^data:image/[^;]+;base64,(.*)$", data)
raw=base64.b64decode(m.group(1))
out="/tmp/render.jpg"
open(out,"wb").write(raw)
print(out)
PY

open /tmp/render.jpg
```

## API

### `POST /render`

请求体（JSON）：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---:|---:|---|
| `url` | string | 是 | - | 目标页面 URL（必须是合法 URL） |
| `mode` | `"auto" \| "screenshot" \| "stitch"` | 否 | `"auto"` | 渲染策略：自动/强制截图/强制拼接 |
| `format` | `"jpeg" \| "png"` | 否 | `"jpeg"` | 输出图片格式 |
| `quality` | number | 否 | `80` | JPEG 质量（1-100），PNG 时会被忽略 |
| `fullPage` | boolean | 否 | `true` | 截图是否为整页（拼接模式不使用该参数） |
| `timeoutMs` | number | 否 | `45000` | 导航与请求超时（1000-120000） |
| `waitUntil` | `"load" \| "domcontentloaded" \| "networkidle"` | 否 | `"networkidle"` | Playwright 导航等待策略 |
| `viewport.width` | number | 否 | `1280` | 视口宽（320-3840） |
| `viewport.height` | number | 否 | `720` | 视口高（240-2160） |

成功响应：

```json
{
  "ok": true,
  "result": {
    "from": "screenshot",
    "format": "jpeg",
    "width": 1280,
    "height": 8394,
    "dataUrl": "data:image/jpeg;base64,..."
  }
}
```

`result.from` 含义：

- `"stitch"`：基于页面 `_pageData` 抽取图片并拼接生成
- `"screenshot"`：Playwright 整页截图（包括 stitch 失败/不满足条件时的自动回退）

失败响应：

- 参数校验失败（HTTP 400）：

```json
{
  "ok": false,
  "error": "INVALID_REQUEST",
  "issues": []
}
```

- 渲染执行失败（HTTP 500）：

```json
{
  "ok": false,
  "error": "RENDER_FAILED",
  "message": "..."
}
```

