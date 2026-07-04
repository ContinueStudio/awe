# AWE 开发文档 (Development Log)

> **目的**：记录 AWE 项目的架构、当前进度、避坑项与下一步路线
> **关联文档**：[AWE_PRD.md](./AWE_PRD.md) v2.11

---

## 1. 当前进度 (v0.1.0 - 2026-07-04)

### 1.0 今日进展 (2026-07-04 17:14)

- ✅ **后端冒烟测试 5/5 通过** (`backend/smoke_test.py`)：
  ```
  [1] health OK: {"ok":true,"version":"0.1.0"}
  [2] nodes OK: 12 types -> ['webhook', 'end', 'llm', 'intent']...
  [3] save workflow OK
  [4] run OK: status=succeeded outputs=['n1', 'n2']
  [5] validate negative OK
  ```
- ✅ **后端服务启动成功**（18765 端口），端到端验证：
  - `GET /api/health` → `{"ok":true,"version":"0.1.0"}`
  - `GET /api/nodes` → 12 个节点定义
  - `GET /` → 返回前端 `dist/index.html`（449 字节，含 AWE 标题）
- ✅ **前端 dist 已构建**（`npm run build` 通过，1585 modules，gzip 62kB）
- 🐛 **重构 main.py 变量定义顺序**（见 3.8）：把 `_FRONTEND_DIST` 的定义从 SPA fallback 之后移到根路由之前，消除 "先引用后定义" 的代码异味

### 1.1 已实现 ✅

**后端 (`backend/`)**
- FastAPI 服务（默认 8765 端口，含 CORS）
- LangGraph 执行引擎（StateGraph 编译 + 节点函数 + 拓扑校验）
- SQLite 持久化（工作流 / 运行 / 断点）
- 12 原子节点定义（NodeDefinition + 注册表）
- Skill 沙盒（ast 审计 + 受限 builtins + 超时）
- LLM 调用（LiteLLM 包装，缺 Key 时降级 stub）
- ChromaDB / SQLite / HTTP 节点的最小实现
- 静态前端托管（`/api` 之外自动 fallback 到 dist/index.html）

**前端 (`frontend/`)**
- Vite + React 18 + TypeScript + TailwindCSS
- 三栏布局：工作流侧栏 / 节点面板 / 主画布
- 自研轻量画布：节点拖拽、端口连线、平移、缩放、删除
- 节点配置面板（根据 `config_schema` 动态生成表单）
- 工作流保存 / 列表 / 切换 / 删除
- 运行结果展示（右侧抽屉）
- 添加节点阶梯式排布（`step % 6 * 260`、`Math.floor(step/6) * 180`，避免重叠）

**桌面端 (`desktop/`)**
- PyWebview 启动入口：子进程拉起后端 + 前端 dev server，窗口化
- 退出时清理子进程 + 浏览器僵尸

**脚本 (`scripts/`)**
- `start.bat` / `start.sh`：一键启动后端 + 前端
- `start-backend.bat` / `start-frontend.bat`：单独启动

### 1.2 冒烟测试结果

`backend/smoke_test.py` 输出：
```
[1] health OK
[2] nodes OK: 12 types
[3] save workflow OK
[4] run OK: status=succeeded outputs=['n1', 'n2']
[5] validate negative OK
```

### 1.3 待实现 ⏳

- 画布接入 `@flowgram.ai`（当前用自研 SVG 画布替代，先跑通）
- LiteLLM 真实联调（需 OPENAI_API_KEY 等）
- RPA 节点接入（DrissionPage / pywinauto / PyAutoGUI，按需 pip install）
- 浏览器静默下载（pyppeteer 拉 Chromium for Testing）
- 调度器（APScheduler）
- 打包（PyInstaller）
- AI 编排（节点字典 → System Prompt + 校验回路）

---

## 2. 启动方式

### 2.1 开发者模式（推荐）

```powershell
# 1. 一次性准备
cd d:\AWE\backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -q -r requirements.txt

cd ..\frontend
npm install
npm run build   # 关键：让后端能 serve dist

# 2. 启动后端（自动 serve 前端 dist）
cd ..\backend
.\venv\Scripts\python.exe run.py
# 浏览器打开 http://127.0.0.1:8765
```

### 2.2 桌面端模式

```powershell
cd d:\AWE
.\scripts\start.bat
# 或：python desktop\main.py
```

### 2.3 验证

```powershell
cd d:\AWE\backend
.\venv\Scripts\python.exe smoke_test.py
```

---

## 3. 避坑项 (Lessons Learned)

> 🐛 **这些坑在开发过程中真实踩过，写在这里给未来自己/团队提个醒。**

### 3.1 Pydantic 序列化 LangGraph state 会爆 Circular reference
- **症状**：`/api/workflows/{wid}/run` 返回 500，错误信息 `ValueError: Circular reference detected (id repeated)`
- **原因**：LangGraph 的 `StateGraph.ainvoke` 返回的对象里 `state` 字段包含 `TypedDict` 的内部引用，json.dumps 和 Pydantic v2 的 `dump_json` 都会因为环引用炸掉。
- **解决**：在 `backend/app/core/database.py` 增加 `_safe_json()`，递归剥离环引用 + 不可序列化对象转 str。API 层（`backend/app/api/workflows.py`）用 `JSONResponse(content=json.loads(_safe_json(body)))` 手动序列化。
- **教训**：直接返回 LangGraph result 给 FastAPI 永远要警惕环引用，**别相信 TypedDict 一定可序列化**。

### 3.2 Windows 端口权限 WinError 10013
- **症状**：`uvicorn.run(...)` 抛 `ERROR: [WinError 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试`
- **原因**：8765 端口被其他进程占用（hyper-v / VMware NAT / IIS 等系统服务在 Windows 上经常占这个段）。
- **解决**：
  1. `netstat -ano | findstr :8765` 查占用进程
  2. 换端口：`$env:AWE_PORT=18765 ; python run.py`
  3. PRD 默认 9200-9300 是给浏览器调试用的，**后端别用这个段**
- **教训**：在 Windows 上挑端口要避 9200-9300、5037、5038（Android）、5000（macOS AirPlay）。

### 3.3 npm 包名错误：@flowgram.ai registry 404
- **症状**：`npm error 404 '@flowgram.ai/fixed-shrink-canvas-plugin@^1.0.0' is not in this registry`
- **原因**：flowgram.ai 实际包名格式不同（疑似私有/beta registry）。
- **解决**：先用自研轻量画布跑通；后续接入 flowgram.ai 时需要查官方文档的 `npm install` 命令原文。
- **教训**：PRD 里写到的开源项目，**先验证包名真能 install 再粘到 package.json**。

### 3.4 Vite CSS @import 顺序
- **症状**：`npm run build` 报 `[vite:css] @import must precede all other statements (besides @charset or empty @layer)`
- **原因**：CSS 规范要求 `@import` 必须在最前面。
- **解决**：`@import './components/ui.css';` 放在 `@tailwind` 之前。
- **教训**：Tailwind v3 + 自定义 CSS 文件用 @layer 包裹更稳。

### 3.5 long_running_process 工具不稳定
- **症状**：用 `RunCommand(wait_ms_before_async=...)` 启动的进程在"用户跳过"后被杀。
- **解决**：测试统一用 `multiprocessing.Process` 拉起后端 + 内嵌测试代码 (smoke_test.py 模式)，不依赖外部 long-running 进程。
- **教训**：CI/自动化测试**别依赖 IDE 的"后台运行"**。

### 3.6 静态资源 SPA fallback 路由冲突
- **症状**：访问 `/` 返回 JSON 而不是 index.html。
- **原因**：`@app.get("/")` 路由在 `@app.get("/{full_path:path}")` 之前声明，FastAPI 优先匹配前者。
- **解决**：把 `/` 路由重写为直接返回 `FileResponse("dist/index.html")`，其他路径才走 catch-all。
- **教训**：FastAPI 静态资源托管**别用 catch-all 覆盖空路径**。

### 3.7 PowerShell 不支持 `&&` 链式命令
- **症状**：`cd dir && cmd` 报 `标记"&&"不是此版本中的有效语句分隔符`。
- **解决**：用分号 `;` 代替，或者用 `; if ($?) { ... }`。
- **教训**：Trae 终端是 PowerShell 5，**写命令别用 bash 语法**。

### 3.8 main.py 模块级变量先引用后定义
- **症状**：重构后 `app.include_router(...)` 那行被 Edit 工具误改成了 `tags=["workflows")`（中括号变圆括号），导致 SyntaxError，后端启动失败，smoke_test 卡在 `[WinError 10061]`。
- **原因**：原 main.py 把 `_FRONTEND_DIST` 定义放在 `spa_fallback` 之后，被 `root()` 函数引用，函数体虽然运行时才解析，但代码可读性差，容易被工具误改。
- **解决**：
  1. 把 `_FRONTEND_DIST` 的定义上移到根路由之前
  2. 改完后用 `python -m py_compile app/main.py` 或直接 `smoke_test.py` 验证
- **教训**：Python 函数体运行时解析的"懒求值"别滥用，**模块级变量先定义再被引用**，避免代码异味和工具误改。

---

## 4. 架构笔记

### 4.1 执行流程

```
[前端] 用户在画布上拖节点 + 连线
   ↓ POST /api/workflows (保存图谱 JSON)
[后端] db.save_workflow() 写入 SQLite
   ↓ POST /api/workflows/{wid}/run
[引擎] WorkflowBuilder 校验图谱 → compile StateGraph → ainvoke
[节点] 各节点执行（LLM/HTTP/SQLite/沙盒/...）
   ↓ 收集 outputs / logs
[后端] db.update_run() 写回结果
   ↓ JSONResponse 返回给前端
[前端] 右侧抽屉展示 outputs + logs
```

### 4.2 模板变量解析

节点配置中支持 `{{a.outputs.b}}` 引用上游节点的输出：

```
节点 n1 (webhook) → outputs.body.hello
节点 n2 (end, config: {message: "{{n1.outputs.body.hello}}"}) → 渲染为 "world"
```

`_render_templates()` 在节点执行前递归替换。

### 4.3 校验三步走

`engine/validator.py` 在编译期假跑校验：
1. 节点类型在 `NodeRegistry` 中已注册
2. 必填 config 字段齐全
3. 模板引用 `{{a.outputs.b}}` 中：
   - `a` 节点存在
   - `a` 拓扑上早于当前节点
   - `b` 是 `a` 声明的 output port

校验失败抛 `ValueError` → 前端 AI 编排器收到后让 LLM 自愈重写。

---

## 5. 下一步路线 (Roadmap)

### 5.1 P0 - 本周内
- [ ] 把自研画布换成 `@flowgram.ai`（或 react-flow 作为过渡）
- [ ] LLM 真实联调（设 OPENAI_API_KEY）
- [ ] 让 12 节点全部能在画布上运行（现在 sqlite / knowledge / http 是最小实现）
- [ ] 人类审批节点的 UI 弹窗

### 5.2 P1 - 两周内
- [ ] 节点执行流 SSE 推送（前端实时显示每个节点的进度）
- [ ] 浏览器静默下载（pyppeteer + Chrome for Testing）
- [ ] RPA 节点接入：DrissionPage / pywinauto
- [ ] AI 编排面板：左侧对话 → 生成图谱 → 校验 → 自愈

### 5.3 P2 - 一个月内
- [ ] APScheduler 调度
- [ ] PyInstaller 打包桌面端
- [ ] MCP Server 模式（Mode B）
- [ ] 多用户 / 权限

---

## 6. 修改记录

### 2026-07-04 (v0.1.0)
- ✅ 初始化项目骨架（backend / frontend / desktop / scripts）
- ✅ FastAPI + LangGraph + 12 节点定义
- ✅ 自研轻量画布（拖拽 + 连线 + 缩放 + 删除）
- ✅ SQLite 持久化 + Skill 沙盒
- ✅ 端到端 smoke test 5/5 通过
- 🐛 修复 Pydantic 序列化环引用 (3.1)
- 🐛 修复 Windows 端口占用 (3.2)
- 🐛 修复 Vite CSS @import 顺序 (3.4)
- 🐛 修复 SPA fallback 路由冲突 (3.6)
- 🐛 重构 main.py 变量定义顺序 (3.8)

### 2026-07-04 (v0.1.0 - 17:14 二次确认)
- ✅ 后端 18765 端口启动成功（避开 8765 系统服务占用）
- ✅ `npm run build` 1585 modules / gzip 62kB 通过
- ✅ 端到端验证：`/api/health`、`/api/nodes`、根路径 `/` 都正常返回
- ✅ 节点添加阶梯式排布已在最新 dist 中

### 2026-07-04 (v0.1.0 - 17:30 节点高度修复)
- 🐛 修复节点高度被裁（3.9）：把 `nodeHeight` 从 `max(inputs,outs)*22` 改为 `(inputs+outputs)*20` + 抽常量
- ✅ DOM 验证：3 个节点 `foH=120 ≥ sH=111`，不再溢出
- ✅ 新 build hash：`index-QiaLHvim.js`（194 kB）
