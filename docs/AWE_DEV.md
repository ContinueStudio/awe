# AWE 开发文档 (Development Log)

> **目的**：记录 AWE 项目的架构、当前进度、避坑项与下一步路线
> **关联文档**：[AWE_PRD.md](./AWE_PRD.md) v2.11

---

## 1. 当前进度 (v0.2.1 - 2026-07-04 19:00)

### 1.0 今日进展 (2026-07-04 19:00)

**【本轮】运行历史面板 + 工作流状态点 全链路打通**
- ✅ **修复前端 build 错误**：`App.tsx` 中 `updateCurrentId` 未定义导致 tsc 失败，dist 实际是旧版
  - 补一个 `useCallback` 同步 Canvas 内部保存后的 workflowId 到 current
  - 清理 `Canvas.tsx` 中残留的 `useState<RunResult>` 引用
  - `npm run build` 通过：1586 modules，gzip 64.12 kB
- ✅ **后端 `list_workflows` 增强**（`backend/app/core/database.py`）：返回 `run_count` / `last_status` / `last_started_at`，让前端能区分成功/失败/未跑过的工作流
- ✅ **后端 `delete_workflow` 级联清理**：删工作流时一并清掉 runs / checkpoints / schedules，避免悬空记录
- ✅ **新增 `db_clean_failed.py`**：按"至少成功一次"规则批量清理测试工作流（保留成功 / 删除从未成功 / 失败 / 仅 running）
- ✅ **新增 `demo_self_check.py`**：跑通"webhook → skill → end"最小工作流（无 LLM 依赖，3 秒出结果）
- ✅ **MCP 链路已通**（8766 端口，streamable-http 传输）
  - `mcp_awe` MCP 工具已挂载到 Trae：8 个工具可用（list_nodes / list_workflows / get_workflow / save_workflow / validate_workflow / run_workflow / get_run / list_runs）
- 🐛 **bug fix：`builder.py` 模板渲染时 `json` 未 import** 导致字典类端口输出渲染失败，已补 `import json`

**当前数据状态**
- 工作流 1 个：`AWE 自检 - Skill Hello World`（1 次 succeeded run）
- 后端 API 已重启加载新代码；前端 dist 是 18:56 构建的新版
- 用户打开 http://127.0.0.1:8765/ 能看到：左侧工作流带**绿点（succeeded）+ "1 次运行 · succeeded · 时间"** 副文本，右侧"运行历史"面板就位

**前端日志 / 状态可视化能力**
- `WorkflowSidebar` 状态点：succeeded=绿 / failed=红 / running=琥珀+旋转 / never=灰
- 副文本：N 次运行 · last_status · last_started_at 本地化时间 / 或"未运行 · updated_at"
- `RunHistoryPanel` 3 秒自动刷新：列表项显示 run id 前 8 位 + 状态徽章 + 耗时；点击展开 Logs（节点 / 类型 / 状态点 / ms）+ Outputs JSON + Inputs + Error 红条
- 选中工作流后画布加载其 graph，工具条显示工作流名称，"运行"按钮启用

### 1.1 早期进展 (2026-07-04 17:14)

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

### 3.9 SVG foreignObject 节点高度用 `max(ins,outs)` 计算 → 内容被裁
- **症状**：在画布上添加 `LLM 推断`、`意图分类` 等节点，发现超过两行的内容显示不完全；浏览器 DOM 测量 `foreignObject.scrollHeight=111` 但 `height=94`，**溢出 17px**。
- **原因**：
  - 旧公式 `Math.max(80, 56 + max(inputs,outs) * 22 + 16)` 把 inputs 和 outputs 看成同一区域，但实际两者**在 NodeRender 中是各自一行**（`def.inputs.map` + `def.outputs.map`），总行数是 `inputs + outputs`。
  - 例：LLM 节点 inputs=1, outputs=1 → max=1 → 高度 56+22+16=94；实际 2 行 ports 各 20px，scrollHeight=111。
  - 端口行高 20px（h-5），但旧公式用 22px，且没有给 inputs+outputs 总数算。
- **解决**：
  1. `Canvas.tsx` 引入显式常量：`HEADER_H=56`、`PORT_GAP=20`、`PORT_AREA_PAD=8`
  2. `nodeHeight(totalPorts) = Math.max(120, HEADER_H + PORT_AREA_PAD + totalPorts * PORT_GAP + 8)`，**用 inputs+outputs 总数**
  3. `portDotY()` 用相同常量算 SVG 端口圆点 y，对齐 NodeRender 实际行位置
  4. 节点外壳加 `h-full overflow-hidden` 兜底
- **教训**：
  - SVG `<foreignObject>` 必须用真实内容高度，硬编码公式容易漏算
  - inputs / outputs 是**两组独立列表**，不是互斥选项，公式要用 sum 不要用 max
  - 自定义节点组件时，**把尺寸相关的 magic number 抽成常量**（HEADER_H / PORT_GAP 等），便于与 JSX class 对照

### 3.10 MCP stdio 模式启动的 4 个坑
1. **logger 写 stdout 污染 stdio 帧**
   - **症状**：`UnicodeDecodeError: 'utf-8' codec can't decode byte 0xc6 ...`，client 端无法解析 JSON-RPC 帧
   - **原因**：`backend/app/core/logger.py` 默认 `StreamHandler(sys.stdout)`，但 MCP stdio 协议要求 stdout 只能有 JSON-RPC 帧
   - **解决**：在 `mcp_server.py` 顶部调用 `_redirect_root_logger_to_stderr()`，把所有 `awe.*` logger 重新指向 stderr
2. **同步 tool 函数里 `asyncio.run()` 触发 "running event loop"**
   - **症状**：`RuntimeError: asyncio.run() cannot be called from a running event loop`，`coroutine 'Pregel.ainvoke' was never awaited`
   - **原因**：FastMCP server 自身在 anyio 事件循环里跑；同步 tool 函数又用 `asyncio.run()` 启动新循环会冲突
   - **解决**：把 `run_workflow` 改成 `async def`，直接 `await compiled.ainvoke(state)`
3. **LangGraph state 有环引用，`json.dumps` 失败**
   - **症状**：`Error executing tool run_workflow: Circular reference detected`
   - **原因**：state 中 nodes/edges 互相引用，`_make_node_fn._fn` 返回的 state 会被 Pydantic 再次序列化
   - **解决**：`_ok()` 用 `database._safe_json` 代替 `json.dumps`，**剥离环引用**（同样的修复已用于 API 路由 `workflows.py`）
4. **`_safe_json(obj, ensure_ascii=False)` TypeError**
   - **症状**：`name '_safe_json' is not defined` 之后所有 tool 报同样错
   - **原因**：`_safe_json` 函数签名只有 `obj`，不接受 `ensure_ascii` 参数；额外，import 语句 `from .core.database import db` 没把 `_safe_json` 一起导入
   - **解决**：(a) 改成 `from .core.database import db, _safe_json`；(b) 移除多余 `ensure_ascii` 参数（`_safe_json` 内部已用 `ensure_ascii=False`）

### 3.11 模板渲染 `{{a.outputs.b.c}}` 点号嵌套不支持
- **症状**：`prompt = "用户说：{{n1.outputs.body.text}}"` 渲染成 `"用户说：。"`，`n1.outputs.body.text` 变成空字符串
- **原因**：原 `_render_templates` 直接用 `(outputs[uid] or {}).get(port)`，把 `body.text` 当字面 key 查，dict 没这个 key 返回 None
- **解决**：改写为 `_resolve(root, path)` 函数，按 `re.findall(r"[a-zA-Z0-9_]+|\[[^\]]+\]", path)` 切段，**逐层取 dict / list**（同时支持 `b[0]` / `b['k']` 下标）
- **验证**：AI Agent demo 中 n3.prompt 渲染为 `"用户说：你好呀！。请用一句热情的中文回应。"` ✓
- **教训**：
  - 模板路径解析要按"点号 = 嵌套层级"理解，不能当字面 key
  - 任何 DSL / 模板引擎遇到点号路径都应支持嵌套查找

### 3.12 后台 MCP server 不热加载 Python 代码
- **症状**：修改 `builder.py._render_templates` 后，跑新 demo 还是旧行为（模板空）
- **原因**：`python -m app.mcp_server --http` 启动的是一个**长寿命 uvicorn 进程**，不会因为 Python 源文件改动而 reload
- **解决**：每次改完 Python 源文件，**重启 MCP server 子进程**才能生效
- **教训**：
  - 长寿命后台服务没有 uvicorn `--reload` 自动加载
  - debug 时碰到"明明改对了但行为没变"，**先检查进程是否用的旧代码**（重启验证最快）

### 3.13 前端 build 通过 ≠ dist 用了最新代码
- **症状**：修了 `App.tsx` / `Canvas.tsx` 后浏览器还是旧行为，**但 `npm run build` 也没有报错**
- **原因**：`tsc -b` 类型检查对未使用的 prop 不会失败；旧 dist 的 `index-*.js` 时间戳停留在前一次构建
- **教训**：
  - 改完前端代码后**必须重新 `npm run build`** 才能让 dist 反映改动
  - 用 `Get-Item dist/assets/*.js | LastWriteTime` 验证 dist 实际构建时间
  - 如果 dist 时间戳比源码旧 → 后端 `/` 路由回的是旧版前端

### 3.14 builder.py `_render_templates` 使用 `json.dumps` 但未 import
- **症状**：end 节点 `message: "payload={{n2.outputs.result}}"` 渲染后变成字面量 `{{n2.outputs.result}}`，不替换
- **原因**：`builder.py._render_templates` 内部用 `json.dumps(val, ensure_ascii=False)`，但模块顶部漏了 `import json`，触发 `NameError` 被 catch 吞掉
- **修复**：顶部补 `import json`
- **教训**：
  - LangGraph 节点 try/except 兜底太宽会让真实 bug 静默掉
  - 模板渲染这种基础工具的 NameError 应该让它炸出来
  - 修 builder 这类核心代码后，**重启后端进程**才能生效（见 3.12）

### 3.15 Windows PowerShell 默认 GBK 编码 + Python 打印中文
- **症状**：脚本 print 含中文的字符串（`"AWE 自检"`）直接抛 `UnicodeEncodeError: 'gbk' codec`
- **原因**：Windows PowerShell 默认 stdout 是 GBK，Anaconda 的 Python 检测到 tty 后用 GBK
- **修复**：脚本顶部加 `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")`
- **教训**：
  - AWE 工具脚本凡是会 print 中文 / emoji 的，**先做 UTF-8 stdout reconfigure**
  - `print("✓")` 之类的 emoji 同样会炸，**改用 ASCII 标识符**（`[KEEP]` / `[DEL]`）最稳

### 3.16 venv 才是项目的 site-packages 源
- **症状**：用 `D:\Anaconda\python.exe` 跑 demo 报 `ModuleNotFoundError: No module named 'langgraph'`，但 uvicorn 后端进程明明也是用 Anaconda 那个 python 启动的却能跑
- **原因**：项目依赖（`langgraph` / `langchain` / `litellm` 等）只装在 `D:\AWE\backend\venv\Lib\site-packages` 里，Anaconda 自己的 site-packages 是空的；后端进程能跑是因为 venv 创建时用了 `--system-site-packages` 或 PYTHONPATH 间接让 Anaconda 看到了 venv 路径
- **教训**：
  - **写测试 / demo 脚本时，固定用 `D:\AWE\backend\venv\Scripts\python.exe`**，不要用 Anaconda 那个
  - 启动 uvicorn 之前先确认是 venv 那个 python（看 `Get-WmiObject Win32_Process | CommandLine`）
  - 别假设两个 python 解释器能 import 同一份依赖

### 3.17 MCP server HTTP 端口和 API 端口要分清
- **症状**：后端 API 跑 8765，MCP 跑 8766；之前一直用 8765 调 MCP，调不通
- **原因**：`mcp_server.py --http` 监听 8766 端口（`config.py` 里默认 port=8766），跟 FastAPI 服务的 8765 是两个独立进程
- **教训**：
  - **API**（REST）= 8765，前端 fetch `/api/*` 用这个
  - **MCP**（streamable-http）= 8766，AI Agent / `mcp_awe` 工具用这个
  - 重启时两个一起 stop + start

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

### 2026-07-04 (v0.2.1)
- ✅ AWE MCP Server 启动为 streamable-http 后台服务 (127.0.0.1:8766/mcp)
- ✅ AI Agent 通过 MCP 编排 AWE 演示全流程
- 🐛 修 end 节点 config.message 模板未渲染
- 🐛 修 _render_templates 点号嵌套路径
- 📝 已知：分支路由（intent label）未实现

### 2026-07-04 (v0.2.0)
- ✅ AWE MCP Server (Mode B) 实现
- ✅ MCP 端到端测试 7/7 通过
- ✅ 8 个 MCP tools 暴露（list_nodes / list_workflows / get_workflow / save_workflow / validate_workflow / run_workflow / get_run / list_runs）
- 🐛 修复 4 个 MCP 启动问题（3.10）

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
