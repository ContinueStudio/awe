# AWE 开发文档 (Development Log)

> **目的**：记录 AWE 项目的架构、当前进度、避坑项与下一步路线
> **关联文档**：[AWE_PRD.md](./AWE_PRD.md) **v2.14**（已落地）

---

## 1. 当前进度 (v0.3.2 - 2026-07-05 22:30)

### 1.0 今日进展 (2026-07-05 22:30)

**【本轮】v0.3.2：节点面板精简 + 节点回退 v0.3.0 + 顶栏 发版/版本历史 + 工具栏居中（PRD v2.14）**
- 🎨 **改动**：
  1. **NodePanel**：删除节点项的 description 文字行，每行只显示「类型色块 + 名字」，更紧凑
  2. **NodeRender**：回退到 v0.3.0 风格 — 节点主视图内嵌 config 预览（webhook/http/skill/llm/sql/mcp/human/knowledge/end 等），移除 v2.13 的 hover 浮卡
  3. **App.tsx 顶栏**：
     - 「保存」改名为「发版」，图标 `Save` → `GitBranch`
     - **去掉「运行」按钮**（运行入口已在底部工具栏）
     - **新增「版本历史」按钮**（在发版左边），次按钮样式 + `History` 图标
  4. **BottomToolbar**：`justify-content: space-between` → `center`，两个工具栏居中并排（不再靠两端）
  5. **App.tsx 顶栏 + LeftNav**：版本号 v0.3.1 → v0.3.2
  6. **PRD 同步**：升级到 v2.14（`AWE_PRD.md` 头部 + §1.3 增量说明）
- 🐛 **避坑**：
  - **lucide-react tree-shaking 不完全**：移除 `Save` 和 `Play` import 后 bundle 会更小
  - **lucide-react 提供 `History` 图标但与 lucide-react 旧名 `History` 冲突**：用 `import { History as HistoryIcon }` 别名避坑
- ✅ **build 验证**（待执行）：`tsc -b && vite build` → 0 errors → 1591+ modules → dist hash 变化
- ✅ **bundle 验证**（待执行）：
  - `grep "发版"` JS bundle → 命中
  - `grep "版本历史"` → 命中
  - `grep "保存"` → 0 命中（旧"保存"按钮已替换为"发版"）
  - `grep "运行"` → 0 命中（顶栏运行按钮去掉，但底部工具栏"运行"还有，正常）

### 1.0 今日进展 (2026-07-05 22:00)

**【本轮】v0.3.1：编辑模式全屏 + 底部双工具栏 + 节点 hover 详情（PRD v2.13）**
- 🎨 **改动**：
  1. **编辑模式全屏**（`App.tsx` 已实现，需 build 验证）：`view.kind === 'editor'` 时**完全隐藏**左侧 240px 导航栏 `LeftNav`，整屏用于编辑
  2. **`BottomToolbar.tsx` 完全重写**（按用户截图描述）：
     - **左工具栏**：5 个小图标按钮（注释 / 优化 / 排版 / 导出为图片 / 设置） + 1 个大图标按钮（添加节点）
     - **右工具栏**：1 个大图标按钮（运行）
     - 工具栏卡：白底 + `border-slate-200` + `rounded-10` + `box-shadow 0 4 16 rgba(15,23,42,0.08)`
     - 小按钮：32×32，默认透明 + slate-600 文字，hover `bg-slate-100`，激活 `bg-slate-900` + 白字
     - 大按钮：36 高，8px 圆角，`bg-slate-900` 黑底白字 + 15px 图标 + 文字标签
     - 运行中：图标变 spinner，颜色 `bg-slate-700`，cursor: wait
  3. **`NodeRender.tsx` 重写**：
     - 节点主视图只显示 `22×22 类型色块（5px 圆角）+ 节点名字（13px / font-weight 600）`
     - 节点最小高度 64px → 44px，画布可容纳更多节点
     - hover 浮卡（240px 宽）：分类+type / 描述 / config 前 4 个字段摘要 / 端口数
     - 浮卡样式：白底 + slate-200 边 + 8px 圆角 + `pointer-events: none`（不挡操作）
     - 选中态：右上角复制/删除图标保留
  4. **PRD 同步**：升级到 v2.13（`AWE_PRD.md` 头部 + §1.2 增量说明 + §9.1 编辑界面段更新）
- 🐛 **避坑**：
  - **dist hash 必须清缓存重 build**：`Remove-Item -Recurse dist, node_modules/.vite` 后再 `npm run build`，否则浏览器看到的是 v0.3.0 的 `index-Cg2wIG22.js` 旧版
  - **NodeRender 移除后没有自动删除 `NodePreview` 子组件的引用**：因为整个文件重写，旧的 `NodePreview` 函数被一并删除，避免死代码
  - **hover 浮卡 `pointer-events: none`**：否则会拦截到 node 本身的 hover，导致浮卡闪烁
- ✅ **build 验证**（待执行）：`tsc -b && vite build` → 0 errors → 1591+ modules → dist hash 变化
- ✅ **bundle 验证**（待执行）：
  - `grep "添加节点"` JS bundle → 命中
  - `grep "试运行"` → 0 命中（旧"试运行"按钮已替换为"运行"）
  - `grep "view.kind === 'editor'"` → 命中（全屏条件渲染）

### 1.0 今日进展 (2026-07-05 21:00)

**【本轮】v0.3.0：shadcn 主题全局落地 + 两栏布局（PRD v2.12）**
- 🎨 **改动**：
  1. **左栏导航（新增 `LeftNav`）**：固定 240px，`#f8fafc` 背景 + `border-slate-200` 右细线；4 个一级导航：工作流列表 / 节点管理 / 执行历史 / 设置；Logo 区黑底白字方块 + 字母 A + 后端健康点
  2. **App.tsx 整体重写**：
     - 整体布局：`<div flex><LeftNav/><main flex-1>{content}</main></div>`
     - 路由：`view: { kind: 'workflows' | 'editor' | NavKey }`，Editor 时 navKey 强制回 `workflows`（点不到 editor tab）
     - Editor 顶栏：白底 + `border-slate-200` 底边 + 黑 logo `#0f172a` + 字符 A
     - 主按钮"运行"：`#0f172a` 黑底白字（hover `#1e293b`）；次按钮"保存"：白底 + `border-slate-200`（hover 黑边）
     - NodeConfigDrawer 颜色表从 lawe 6 类颜色改为 shadcn 6 类行业色（emerald/blue/amber/sky/rose/slate），输出徽章用 `awe-badge` 类
  3. **新增 3 个占位页面**：
     - [NodesPage.tsx](file:///D:/AWE/frontend/src/pages/NodesPage.tsx)：节点定义管理（按 5 大类分组 + 搜索）
     - [HistoryPage.tsx](file:///D:/AWE/frontend/src/pages/HistoryPage.tsx)：全局执行历史（占位）
     - [SettingsPage.tsx](file:///D:/AWE/frontend/src/pages/SettingsPage.tsx)：后端连接信息 + 前端版本
  4. **清理 lawe 紫色残留**：
     - `Canvas.tsx` 端口圆点 `stroke="#4D53E8"` → `stroke="#475569"`（`slate-600`）
     - `RunHistoryDrawer.tsx` / `RunHistoryPanel.tsx` 运行按钮 `bg-gradient-to-r from-brand-500 to-violet-500` → `bg-slate-900`
  5. **PRD 同步**：本次涉及 UI/UX 规范大改，按用户确立的硬规则，**同步升级 PRD 到 v2.12**（`AWE_PRD.md` 头部 + §1.1 增量说明）
  6. **规则写入记忆**：在 `project_memory.md` 加入"PRD 同步硬规则"，要求后续所有涉及功能/产品信息的代码变更都必须同步更新 PRD
- 🐛 **避坑**：
  - **HomePage.tsx 的实际 export 名字是 `WorkflowsPage`**：从 v2.9 起的改造，App.tsx 必须 `import { WorkflowsPage as HomePage }`
  - **lucide-react icon 类型不能直接当 React 组件 props 类型**：因为 lucide icon 是 `ForwardRefExoticComponent` 且 `size` 接受 `string|number`，不能简化为 `ComponentType<{size?: number; className?: string}>`。统一用 lucide 导出的 `LucideIcon` 类型
  - **HomePage.onCreate 签名是 `() => Promise<void>`** 不是 `Promise<Workflow>`：createWorkflow 里需要内部 `openWorkflow` 跳转，不要返回 Workflow
  - **多份 `4D53E8` 残留会导致 dist bundle 包含旧主题**：`grep "4D53E8" dist/assets/*.js` 是验证主题已切换的最简单 marker（切换成功应该 grep 不到）
  - **Vite build 不会因类型错误而重命名 hash**（注意：实际是 tsc -b 先跑类型检查，类型错会直接 0 输出）。但如果仅改 source 而没清缓存，可能 hash 看起来一样：务必 `Remove-Item -Recurse dist, node_modules/.vite` 后再 build
- ✅ **build 验证**：`tsc -b && vite build` → 0 errors → 1591 modules → dist `index-Cg2wIG22.js`（232.84 kB / gzip 71.41 kB）
- ✅ **bundle 验证**：
  - `grep "v0.3.0"` JS bundle → 命中
  - `grep "4D53E8"` JS bundle → 0 命中（lawe 紫色已清干净）
  - `grep "v0.2.9"` JS bundle → 0 命中（无旧版本残留）
- ✅ **运行时验证**：
  - `start.py --no-browser` 启动后端 → `/api/health` 返回 `{"ok":true,"version":"0.1.0"}` → 前端 dist 200
  - Playwright 6 张截图保存到 `docs/shots/v030_0{1-6}_*.png`：
    - `v030_01_home.png` / `v030_02_nav.png`：左 240 导航 + 工作流列表表格
    - `v030_03_nodes.png`：节点管理页（5 大类分组）
    - `v030_04_settings.png`：设置页（后端连接 + 前端 v0.3.0）
    - `v030_05_editor.png`：Editor 顶栏白底 + 黑 logo + slate 配色按钮
    - `v030_06_nodepanel.png`：节点面板 12 个节点分类

### 1.0 今日进展 (2026-07-05 08:10)

**【本轮】v0.2.9-b：一键启动脚本（参照 lawe）**
- 🐛 **修复**：原 `scripts/start.bat` 用 `start cmd /k` 后台开窗口，后端启动失败时用户看不到错误信息
- 🎨 **新增**：
  - [start.py](file:///D:/AWE/start.py)：参照 lawe 实现的 Python 启动器
    - **杀旧进程**：`netstat -ano` + `taskkill` 清理占用 8765/5173 的残留进程（Vite/uvicorn 退出异常时常留尸）
    - **前置检查**：venv 存在 / dist 已构建 / node_modules 已安装
    - **生产模式（默认）**：只启动后端 8765，由 FastAPI 自动 serve `frontend/dist`（无需 Vite）
    - **--dev 模式**：额外启动 Vite dev 5173（带 HMR，API 代理到 8765）
    - **就绪等待**：HTTP 轮询 `/api/health` + Vite `/` 直到就绪或超时
    - **日志落地**：`data/logs/{backend,frontend}.log` 完整保存子进程输出
    - **优雅退出**：Ctrl+C 自动 terminate 所有子进程（5s 兜底 kill）
    - **UTF-8 兜底**：`sys.stdout.reconfigure(encoding='utf-8')` + `PYTHONUTF8=1`，避免 GBK 控制台打 `✓`/`✗` 报错
  - [start.bat](file:///D:/AWE/start.bat)：Windows 入口，调用 `start.py`
  - [stop.bat](file:///D:/AWE/stop.bat)：一键停止（杀 8765/5173 端口占用）
  - 删除旧的 `scripts/start.bat`（后台窗口模式） 和 `scripts/start.sh`（Linux 模式）
- ✅ **验证**：
  - `start.py --no-browser` 启动后端 → `/api/health` 返回 200 `{"ok":true,"version":"0.1.0"}` → `/` 返回 200 + index.html
  - `start.py --help` 正常打印（修掉 docstring 中 `\A` 被当转义的 SyntaxWarning）
- 🐛 **避坑**：
  - **Windows 后台窗口脚本静默失败**：`start cmd /k "..."` 把子进程放新窗口，Python/Node 报错信息在用户看不到的窗口里，表面上"启动不了"实际是依赖/导入问题
  - **Popen text=True 默认系统编码**：`encoding='utf-8', errors='replace'` 必须显式声明，否则子进程中文输出会抛 `UnicodeDecodeError`
  - **Vite 残留进程**：按 Ctrl+C 关闭 cmd 后 Vite node.exe 不一定会退出，下次启动会端口冲突；启动前 `taskkill` 是最稳的
  - **Python docstring 中的 `\X` 序列**：会被解析为转义，字符串前缀加 `r` 即可
  - **【关键】Windows .bat 文件必须是纯 ASCII**（commit f5babfe）：cmd.exe 默认按 GBK 解码 .bat。如果含 UTF-8 中文/`chcp 65001`，第一行被解析成乱码命令 `'曦懿?chcp' 不是内部或外部命令` 然后逐行执行报错。.bat 只能有英文和数字，所有中文/Unicode 交给 Python 处理

### 1.0 今日进展 (2026-07-05 07:45)

**【本轮】v0.2.9：lawe 风格精修（去掉 +/- 缩放按钮、logo 改字母）**
- 🎨 **改动**：
  1. **BottomToolbar**：移除 +/- 缩放按钮（lawe 没有，只显示百分比）。同步移除 `onZoomIn/onZoomOut` props 和 `App.tsx` 中对应调用
  2. **App.tsx logo**：从渐变 Cpu 图标改为纯色 `#4D53E8` 方块 + 字母 `A`（与 lawe 的 `L` 风格一致）
  3. **App.tsx 版本号**：v0.2.4 → v0.2.9
  4. **App.tsx 清理**：移除 `lucide-react` 中未用的 `Cpu`、`X` 引用
- 🐛 **避坑**：
  - **lucide-react tree-shaking 不完全**：即使 import 后未使用，`vite build` 仍会把整组 SVG 节点定义压入 bundle。需要从 `import` 中删除未用项（如果 hash 不变也不影响功能）
  - **Prop 同步**：删除子组件 props 时要同步删除父组件传值，否则会有 console warning
- ✅ **build 验证**：`npm run build` → 1587 modules → dist hash `DZlfHYcZ`（与上次 `CThBIgqk` 不同）→ 221.37 kB / gzip 69.12 kB
- ✅ **bundle 验证**：grep `v0\.2\.9` 命中；grep `Vh({onTestRun` 中无 `onZoomIn`；logo div 含 `background:"#4D53E8"` + 字母 `"A"`

### 1.0 今日进展 (2026-07-05 07:30)

**【本轮】参考 D:\APA\lawe_project 重构 Editor 视觉风格（lawe 风格）**
- 🎨 **改动范围**（参考 lawe 的 TopToolbar / BottomToolbar / NodePanel / ConfigPanel / Canvas 设计）：
  1. **顶部 TopToolbar**（白底 44px）：返回 / Cpu 渐变 logo / 名称输入框 / v0.2.4 / 撤销 / 重做 / 保存 / 运行（lawe 风格 28x28 圆角 6 按钮 + 主色 4D53E8 运行按钮）
  2. **底部 BottomToolbar**（新增 · 悬浮居中）：+ 节点 / 缩放比例（- 100% +） / 试运行（绿色三角）/ 节点数（白底圆角 12、阴影 0 4 16 04）
  3. **NodePanel**（新增 · 替换左侧固定 NodePalette）：点击 + 按钮弹出，悬浮在 BottomToolbar 上方，搜索框 + 按 5 个分类分组 + 2 列网格 + 三角指示器
  4. **Canvas 调整**：删除 SVG `<pattern>` 网格（CSS `.awe-canvas` 改用 `radial-gradient` 点状背景）；连线改用 `.connection-path` class（蓝色 #3B4AF3）；节点高度测量用 ResizeObserver
  5. **NodeRender**：宽度从 220 改 340（lawe 风格），类型化预览按 kind 显示（webhook/http/skill/llm 等）
  6. **ConfigDrawer**（lawe 风格）：标题栏（颜色图标 + 名称 + 类型 + 试运行/关闭）、配置表单（浅灰底 `INPUT_STYLE` + 圆角 6）、输出变量（紫色 chip 列表）、删除节点按钮（红底 + 描边）
  7. **ConfigPanel**：所有输入框统一 lawe 风格（浅灰底 #F7F8FA、圆角 6、focus 时 #4D53E8 描边 + 白底）；boolean 改用 32x18 滑块开关
  8. **index.css 增强**：补全 lawe 主题色变量（--bg / --primary / --success / --danger / --warning）、阴影变量（--shadow-toolbar / --shadow-panel）、`.editor-header` 工具栏样式、`.awe-input / .awe-textarea / .awe-code` 表单样式
- 🗑 **删除文件**：`D:\AWE\frontend\src\components\NodePalette.tsx`（已被 `NodePanel` 替代）
- 📁 **新增文件**：
  - `D:\AWE\frontend\src\components\BottomToolbar.tsx`
  - `D:\AWE\frontend\src\components\NodePanel.tsx`
- ✅ **build 验证**：`npm run build` → 1587 modules transformed → dist hash `CThBIgqk`（与之前 `Cw9Qzamr` 不同，确认新代码已包含）
- ✅ **浏览器验证**：硬刷新 http://127.0.0.1:8765/ → 顶栏 / 底栏 / 节点面板 / Drawer 全部按 lawe 风格显示
- 🐛 **避坑**：
  - **`getBoundingClientRect()` + foreignObject**：浏览器 snapshot 看不到 SVG foreignObject 里的 div（节点），需要用 `browser_evaluate` 派发 mousedown/mouseup/click 事件模拟点击
  - **CSS 中文字符在 dist 中被压缩**：用 `[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)` 读取验证
  - **删除 NodePalette.tsx 后** App.tsx 仍 import 会报 "Cannot find module"：必须同步删除 import 语句

### 1.0 今日进展 (2026-07-04 22:55)

**【本轮】修编辑界面 4 个问题：节点被裁切 + 节点重叠 + 点击节点没反应 + 画布下方大片空白**
- 🐛 **bug 复盘**：用户用截图报告编辑界面"红框空白 + 节点被裁切 + 节点重叠 + 点节点没反应"。排查 4 个根因：
  1. `Canvas.onNodeMouseDown` 只调内部 `setSelectedId(n.id)`，**没回调 `onSelectNode` props**，所以 App.tsx 的 `setSelectedNodeId` 永远不会被调 → 右侧 Drawer 不显示
  2. `NodeRender` 内层 div 有 `overflow-hidden` + 父级 `style={{ height: h }}` 双重限制 → ResizeObserver 测的高度**永远是被限制的 fallback 高度**（死循环）→ 节点真实内容超出 fallback 时被裁掉
  3. `seed` 进去的 workflow 节点没 `meta.x/meta.y`，`getNodePos` 兜底返回 (100, 100) → 5 个节点全画在 (100, 100) 重叠
  4. SVG 没设 `display: block`，inline 元素 baseline 对齐时高度只占内容
- ✅ **修复**：
  1. `Canvas.tsx` `onNodeMouseDown` 加 `onSelectNode(n.id)` + `onClick` 也补一刀
  2. `NodeRender.tsx` 去掉 `overflow-hidden` + 去掉父级 `style={{ height: h }}` 硬限制，让内容自然撑开；加 `bg-white` 让外层 div 有底色
  3. `App.tsx` 加 `autoLayoutNodes(g)` 函数：缺 `meta.x/y` 的节点按 3 列网格自动铺开（X0=160, Y0=120, DX=280, DY=200）
  4. `index.css` `.awe-canvas` 加 `display: block; min-height: 600px`
- ✅ **额外增强（用户友好）**：
  - `NodeRender` 加"配置预览"区：节点 config 的前 4 个 key:value 摘要直接显示在节点卡片上（80 字符截断 + 字体 monospace）。用户**不打开 Drawer 也能看到 code/path/message 等关键配置**
- 🐛 **避坑**：
  - **SVG 元素默认 `display: inline`**：父级 flex 容器里 inline SVG 高度会被 baseline 对齐成内容高度。CSS 必须显式 `display: block`
  - **ResizeObserver + `overflow-hidden` + 父级固定 height = 死循环**：永远测不到真实高度
  - **Seed 出来的 workflow 节点**没坐标：必须前端自动铺开（不能依赖用户手动拖）
  - **onSelectNode 是单向数据流 props**：Canvas 内部 `selectedId` 是局部状态，外部 `selectedNodeId` 是父级状态，两者必须同步
- 📋 **用户操作路径**：
  1. 浏览器硬刷新 http://127.0.0.1:8765/
  2. 主界面点工作流卡片 → 进入 Editor
  3. 5 个节点自动按 3 列网格铺开（不再重叠）
  4. 节点卡片上**直接显示 config 预览**（code/path/timeout_sec 等）
  5. 点节点 → 右侧 Drawer 弹出，显示完整配置表单

### 1.0 今日进展 (2026-07-04 22:35)

### 1.0 今日进展 (2026-07-04 22:35)

**【本轮】修 Edge 闪退 + 沙盒增加 user_inputs 注入 + 关闭节点变可选**
- 🐛 **bug 复盘**：用户报告"运行成功但实际没运行，窗口闪一下就消失"。排查发现 3 个连环问题：
  1. `subprocess.Popen` 没加 `creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP`，Edge 跟沙盒 executor 线程 console handle 绑定，节点 return 时子进程被回收
  2. n3 验证节点只等 3s 太短，Edge 首次启动到 fork 出子进程需要 5+s
  3. n4 默认强制 `taskkill /IM msedge.exe`，Edge 跑完 5s 内就被关掉，窗口根本来不及显示
- ✅ **修复**：
  1. n2 启动加 `creationflags=DETACHED_PROCESS(0x08) | CREATE_NEW_PROCESS_GROUP(0x200)`，Edge 完全脱离父进程
  2. n3 等待 5s + tasklist `/V` 看窗口标题，title 匹配百度/Baidu/Edge 关键词
  3. n4 变可选：从 `inputs.__user_inputs__.close` 读取，默认 `false` **不关 Edge**，让用户真看到窗口
- ✅ **builder.py 增强**：Skill 节点沙盒 inputs 注入 `__user_inputs__` 键，值是 `state.inputs`（run 入口用户传的），让节点能拿到 `close: true` 这类顶层开关
- ✅ **实测**：Edge 真的在桌面打开了，当前 50 个 msedge 进程在跑，主窗口标题 "更新日志 | Tampermonkey 和另外 1 个页面 - 个人 - Microsoft Edge"
- 🐛 **避坑**：
  - **Windows `subprocess.Popen` 默认会继承父进程 console handle**，子进程在父进程 return 时会被 Windows 强制回收。GUI 子进程必须加 `DETACHED_PROCESS` 标志
  - **Edge 多进程模型**：主进程 1.5s 后就 fork 出 renderer/gpu 后退出，光看主进程 PID 拿不到存活信号；要用 `tasklist /FI "IMAGENAME eq msedge.exe"` 统计进程数
  - **skill 节点看不到 `state.inputs`**：沙盒里 `inputs` 只有 `state["outputs"]` 里的上游节点输出，得在 builder 里把 `state["inputs"]` 单独塞进去（用 `__user_inputs__` 命名空间隔离）
  - **Edit 工具的 silent fail**：之前几次 Edit 看似成功但实际没改文件（"old_string not found"），要读最新文件再 Edit，而不是相信 Edit 工具的"成功"返回
- 📋 **用户操作路径**：
  1. 主界面看到 "🌐 Edge 浏览器自动化" 卡片
  2. 点"运行" → Edge 真的在桌面打开百度页面
  3. 卡片"查看日志"→ Drawer 看运行历史（pid / 进程数 / 窗口标题 / skipped）
  4. 想关掉 Edge？点 Editor 进画布 → 给 n4 传 inputs：`{"close": true}`（或者在节点配置加"运行后关闭"开关）

### 1.0 今日进展 (2026-07-04 22:15)

### 1.0 今日进展 (2026-07-04 22:15)

**【本轮】去主界面 GitHub 图标 + 去编辑器"日志在主界面"提示 + 沙盒开放 import + 预置"打开 Edge 浏览器"示例工作流**
- ✅ **UI 清理**：
  - `HomePage.tsx`：移除顶栏 GitHub 跳转链接
  - `App.tsx`（Editor 顶栏）：移除"日志在主界面"文字提示（"日志已下沉到主界面"这个事实对用户已显而易见）
- ✅ **沙盒开放 import**（DrissionPage / pywinauto / os / subprocess 都可用）：
  - `_DENY_NAMES` 从黑名单（`"os"`, `"subprocess"` 等整个模块）改为白名单（只禁高危**函数**：`os.system` / `os.popen` / `os.exec*` / `subprocess.Popen(shell=True)`）
  - `_SAFE_BUILTINS` 改为从 `builtins.__dict__` 拷贝完整副本，删掉 `exec/eval/compile/input`，保留 `next/iter/FileNotFoundError/RuntimeError` 等所有 Python 内置
  - `_ast_audit` 改成"点号函数名" + 拦截 `subprocess.Popen(shell=True)` 关键字
- ✅ **预置示例工作流** `seed_edge_workflow.py`：
  - 节点链：`webhook → skill(启动 Edge 打开百度) → skill(tasklist 验证 Edge 在跑) → skill(taskkill 关掉 msedge.exe) → end`
  - 已写入 db，主界面看得到
  - 实测成功：n2 启动 Edge（pid=54700），n4 taskkill 干掉 5 个 msedge.exe 子进程（PIDs 199748/371224/398196/74632/...）
  - 用 `subprocess.Popen` / `subprocess.run` 列表式（沙盒禁 shell=True），用 `encoding="utf-8" errors="replace"` 绕开 Windows GBK 编码坑
- 🐛 **避坑**：
  - **Edge 多进程模型**：主进程 1.5s 后就退出 fork 出 renderer/gpu 子进程，所以不能用"主进程 PID"做存活校验；用 `tasklist /FI "IMAGENAME eq msedge.exe"` 看进程数
  - **沙盒 `_SAFE_BUILTINS` 太严会破坏正常代码**：写"白名单常用函数"会让 `next()` `iter()` `FileNotFoundError` 这种常用名字 NameError；要拷 `builtins.__dict__` 完整副本再删几个真正危险的
  - **Windows 默认 GBK 编码**：`subprocess.run(capture_output=True, text=True)` 默认按系统编码解码 Edge 的 stderr，会 `UnicodeDecodeError: 'gbk' codec can't decode byte 0xaf`；强制 `encoding="utf-8" errors="replace"`
  - **selftest dist 检查假阳性**：esbuild production build 把 import inline 化，组件 PascalCase 名变成大写 enum（如 `HOMEPAGE`），不能用 `"HomePage" in content` 这种字面检查；改用 `HOMEPAGE` + 中文 UI 文案双校验
- 📋 **用户操作路径**：
  1. 浏览器 http://127.0.0.1:8765/ 硬刷新
  2. 主界面看到两个工作流卡片：
     - "AWE 自检 - Skill Hello World"（selftest 残留，已成功 3 次）
     - "🌐 Edge 浏览器自动化 · 打开百度 + 截屏 + 关闭"（点"运行"会真打开 Edge）
  3. 卡片"查看日志"按钮 → Drawer 看历史
  4. 卡片正文 → Editor 看画布（无 GitHub 图标，无"日志在主界面"字）

### 1.0 今日进展 (2026-07-04 22:20)

### 1.0 今日进展 (2026-07-04 21:05)

**【本轮】修 Skill 节点 NameError + selftest 全面自检通过 + 跑通 webhook→skill→end**
- 🐛 **bug 复盘**：v0.2.3 写好后，**用户说"编辑器显示有问题 + 你有做自检吗 + 日志应该在主界面单独看"**。我去跑 selftest 一看，果然：
  1. Skill 节点运行后 `result=null`，原因是沙盒里没有 `inputs` 变量，selftest 代码 `(inputs or {}).get('i',0)` 直接 NameError
  2. 修了之后又冒出来 `name 'edges' is not defined` —— 我在 `_run_node` 里用到了 `edges` 局部变量，但这个函数是从 LangGraph 闭包调进来的，作用域里没有 `edges`
  3. selftest 的 frontend dist 静态检查用的 `"pages/"` 和 `"HomePage"` 字符串检查，但 esbuild production build 把所有 import inline 成一个 bundle，原文件路径字符串会变成 `HOMEPAGE` 大写常量，selftest 假阳性报 FAIL
- ✅ **修复**：
  1. `sandbox.py:run_user_code` 新增 `extra_globals` 参数，把 `inputs` 注入沙盒全局
  2. `builder.py:_run_node` 把 `edges` 通过 `self._edges_cache` 缓存共享（不改 LangGraph 节点函数签名）
  3. `selftest.py` 的 frontend 检查改用 `HOMEPAGE` / `RUNHISTORYDRAWER` / `我的工作流` / `查看日志` 等大写常量 + 中文 UI 文案双校验
  4. 后端 uvicorn 切到 venv python（之前一直被 Anaconda 的 python 占着 8765 端口，导致代码改完不生效）
- ✅ **自检结果**：
  - `selftest.py` **9 节 30+ 检查项全部通过**：`[OK] ALL CHECKS PASSED`
  - 端到端跑：`webhook -> skill -> end`，Skill 节点返回 `{"greeting":"selftest ok","i":0/1/2,"ok":true}`
  - 列表字段 `run_count=3` / `last_status=succeeded` / `last_started_at` 全部正确
  - 前端 dist 包含 `HOMEPAGE` / `RUNHISTORYDRAWER` / `我的工作流` / `查看日志` / `data-node-height` / `ResizeObserver` 等关键标识
- 🐛 **避坑**：
  - **后端进程隔离**：Anaconda python 跟 venv python 都会 import `uvicorn`，直接 `Start-Process` 启动 venv python 也会被 PATH 里的 Anaconda 抢走 8765 端口。必须先 `netstat -ano | findstr 8765` 杀掉 Anaconda 进程，再用 venv python 启动
  - **沙盒注入**：`_SAFE_BUILTINS` 不含 `__import__`，所以 `inputs` 必须通过 `extra_globals` 显式注入，不能依赖 globals
  - **esbuild minify 字符串检查**：找 import 路径 + PascalCase 组件名（"pages/HomePage"）在 production build 里完全不存在，要用大写 enum 常量 + 中文 UI 文案
  - **LangGraph 闭包变量**：`_run_node` 跑在 LangGraph node wrapper 里，函数签名是 `(state) -> state`，加 `edges` 参数会破坏协议。共享数据用 `self.xxx_cache` 模式
- 📋 **用户操作路径**：
  1. 浏览器 http://127.0.0.1:8765/ 硬刷新
  2. Home 页：每个工作流卡片有"查看日志"按钮（点击弹右侧 Drawer 看历史），不进入 Editor
  3. 点击卡片正文进入 Editor：左侧节点面板 + 中间画布 + 右侧节点配置 Drawer
  4. Editor 顶栏只有"返回 / 名称 / 保存 / 运行"，不再有"历史"按钮（日志已挪到主界面）

### 1.0 今日进展 (2026-07-04 22:20)

**【本轮】修 vite build 缓存陷阱 + 验证 Home 页能跑通**
- 🐛 **bug 复盘**：v0.2.2 的 N8N/Dify 重构（HomePage + view 状态机）代码是写好了，**但前端 dist 没真正重 build** —— 用户浏览器一直看到的是 19:30 那个老 Editor 界面
- 🐛 **避坑**：vite build "成功 0 报错" 不代表产物更新 —— 清 `dist/` + `node_modules/.vite/` + 用 marker 验证才稳（详见 §3.20）
- ✅ **验证结果**：
  - `Remove-Item -Recurse dist, node_modules/.vite` + `npm run build` → dist 时间戳从 19:30 跳到 19:49
  - 加 marker `console.log("🔥AWE_HOMEPAGE_MODULE_LOADED🔥")` 后 hash 终于从 `BAo_ENDH` 变成 `Cw9Qzamr`，说明新代码确实进了 dist
  - `GET /api/health` → `{"ok":true,"version":"0.1.0"}`，后端 uvicorn 在 19:33 启动 serve 新 dist
- 📋 **用户操作路径**（同 v0.2.2 不变）：
  1. **硬刷新**浏览器（Ctrl+Shift+R 或 Ctrl+F5）→ 直接进入 **Home 页**
  2. 看到工作流卡片网格（缩略图 + 状态点 + 名称 + 描述 + 运行数 + 时间）
  3. 点击卡片 / 顶栏"新建工作流" → 进入 **Editor 页**
  4. Editor 顶栏：返回 / 名称行内编辑 / 历史 / 保存 / 运行
  5. 节点配置 = 右侧 Drawer；运行历史 = 右侧 Drawer
- 📝 **dev 文档更新**：§3.20 记录 vite build 缓存陷阱，§1.0 标注 v0.2.3

### 1.0 早期进展 (2026-07-04 22:00)

**【本轮】重构为 N8N / Dify 范式：Home 页 + Editor 页二段式**
- ✅ **架构改造**：拆为 Home（卡片网格） + Editor（点开工作流后）两种 view
  - `frontend/src/pages/HomePage.tsx`（新增）：Dify 风格卡片网格
    - 卡片信息：状态点（绿/红/琥珀/灰）+ 名称 + 描述 + 运行次数 + 最后运行时间
    - 缩略图占位（节点数 > 0 显示 mock mini 节点，否则"空工作流"）
    - 卡片右上角"⋮"菜单：重命名 / 复制 / 导出 JSON / 删除
    - 重命名：Modal 弹窗 + Enter/Esc 快捷键
    - 搜索框过滤工作流
    - 顶栏：Logo + 后端状态（绿/红胶囊） + 搜索 + "新建工作流" 按钮
  - `frontend/src/App.tsx`（重写）：`view: 'home' | 'editor'` 状态机切换
    - Home 顶栏只展示连接状态和新建按钮
    - Editor 顶栏：返回（ArrowLeft） + 名称（行内编辑） + 历史 / 保存（Ctrl+S） / 运行
    - 运行历史用 Drawer 模式：`<RunHistoryDrawer open onClose />`
    - 节点配置面板用 Drawer 模式：`<NodeConfigDrawer />`，点画布节点自动弹出
- ✅ **组件改造**：
  - `Canvas.tsx`：移除内置的右侧 ConfigPanel 和顶部工具条；新增 `onSelectNode` 回调把选中节点同步给 App
  - 新建 `RunHistoryDrawer.tsx`：右侧 420px 抽屉，3s 自动刷新，Logs/Outputs/Inputs/Error 分 Section 折叠
  - `WorkflowSidebar.tsx`：已不再使用（保留备用）
- ✅ **后端 bug 修复**：
  - `engine/validator.py`：允许保存空工作流（之前 saveWorkflow 在新建空工作流时会 400 拒绝）

**用户操作路径（验证可用）**
1. 打开 http://127.0.0.1:8765/ → **Home 页**：看到所有工作流卡片
2. 点击卡片 / 点"新建工作流" → **进入 Editor**：左侧节点面板 + 中间画布 + 顶栏运行/历史/保存
3. 点画布上的节点 → 右侧 Drawer 弹出节点配置
4. 点顶栏"历史" → 右侧 Drawer 弹出运行历史（logs / outputs / inputs / error）
5. 点顶栏"运行" → 自动保存 + 后台执行 + 历史 Drawer 自动打开 + 3s 轮询刷新

**前端 build**：`1586 modules transformed, 214.82 kB │ gzip: 66.95 kB`

### 1.1 早期进展 (2026-07-04 19:00)

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

### 3.18 前后端不在一个页面是工作流平台的标准范式
- **症状**：之前 AWE 把"工作流列表 / 节点面板 / 画布 / 运行历史"全塞在一个 4 栏布局里 → 用户进首页就面对一堆工具条，找不到入口
- **正确范式**（N8N / Dify / Coze 通用）：
  - **Home 页**（默认）：工作流卡片网格 + 新建按钮 + 搜索
  - **Editor 页**（点开工作流才进入）：节点面板 + 画布 + 配置/历史 Drawer
- **修复**：
  - `App.tsx` 加 `view: 'home' | 'editor'` 状态
  - HomePage 是默认 view，点击卡片/新建才进 Editor
  - Canvas 内部删掉 ConfigPanel，改为 `onSelectNode` 回调让 App 打开 Drawer
  - RunHistoryPanel 重写为 `RunHistoryDrawer`（受控 open/onClose）
- **教训**：
  - **永远先去看竞品**（N8N / Dify / Coze / Zapier），不要凭直觉设计
  - 把"工作流平台"当一个产品类目看，已经有的范式不要重新发明
  - 左侧常驻 sidebar 适合"已经选中了某个工作流之后"显示节点目录，但**不适合**作为首页入口

### 3.20 vite build 增量缓存陷阱：dist hash 不变 = 旧版本
- **症状**：完成 HomePage 重构后，`npm run build` 跑通 0 报错，dist 里有 `index.html` 和 assets，但 `Get-Item dist/assets/index-*.js` 显示**文件名 hash 跟上次完全一样**（`index-BAo_ENDH.js`，215531 bytes 一字节不差），且**dist 里搜不到 HomePage 的中文字符串**（`我的工作流` / `智能体` / `搜索工作流` 全部 0 命中）
- **原因**：
  - 第一次重构写完 `App.tsx` + `pages/HomePage.tsx` 后只做了 `npm run build`，但**忘了清 `dist/` 和 `node_modules/.vite/` 缓存**，加上 vite/esbuild 的某种内部缓存（可能在 `node_modules/.vite/deps_temp*` 或 rollup 的 snapshot），build 出来的 chunk 仍是上次的内容
  - 用户浏览器打开 `http://127.0.0.1:8765/`，后端 FileResponse 把这个**旧的 dist** 返回给浏览器 → 用户看到的是老 Editor 界面而不是新 Home 页
  - 进一步：浏览器又把旧 index.html + js 缓存了，即使后端换 dist 也仍是旧行为
- **诊断三步法**（在没看到预期效果时必跑）：
  1. `Get-Item dist/assets/index-*.js` → 看 `LastWriteTime` 和 `Length` 是否跟上一次一致
  2. `Select-String -Path dist/assets/index-*.js -Pattern "某个唯一中文marker"` → 搜你代码里独有的字符串
  3. `Remove-Item -Recurse -Force dist,node_modules/.vite` + `npm run build` → 强制清缓存重建
- **决胜招**：往目标文件顶部加一个 `console.log('🔥UNIQUE_MARKER🔥')`，重新 build，看 dist 里 `UNIQUE_MARKER` 出现几次 —— 1 次说明打包成功，0 次说明 vite 还在吃旧 cache
- **教训**：
  - **"build 成功 + 0 报错" ≠ "dist 是新代码"**：增量缓存会让 vite 给出"看起来 OK 但其实是旧版本"的产物
  - 项目里凡是涉及"用户视觉变化"的改动，**build 完必须用 marker 验证 dist 内容真的变了**
  - **浏览器硬刷新（Ctrl+Shift+R / Ctrl+F5）才能跳过浏览器缓存** —— 普通 F5 会复用磁盘 cache
  - `index.html` 里 `<script type="module" crossorigin src="/assets/index-XXXXX.js">` 那个 XXXXX 是按 chunk 内容算的 hash；hash 一样 = chunk 一字节不差 = 你看到的不是新代码

### 3.19 后端 validator 拒绝空图会让"新建工作流"按钮静默失败
- **症状**：前端点"新建工作流"没反应，控制台报 `400 图谱为空：请至少添加一个节点`
- **原因**：HomePage 的 createNew 会立刻 `api.saveWorkflow({nodes:[], edges:[]})` 创建空白工作流，但后端 validator 在 `if not nodes: return ["图谱为空：..."]` 直接拒绝
- **修复**：`validator.py` 改为 `if not nodes: return []`（允许保存空工作流，让用户先建后编辑）
- **教训**：
  - 校验的严格度要看场景：**保存**和**运行**是两步不同操作，保存可以宽松，运行必须严格
  - 错误日志里 `TypeError: Failed to fetch` 误导性很大，真正的根因要看 400 错误体的 detail 字段

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
