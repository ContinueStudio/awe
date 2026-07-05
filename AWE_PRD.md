# 📄 产品需求文档 (PRD) - 智能体工作流引擎 (AWE) v2.16

## 1. 文档信息
* **项目名称**：智能体工作流引擎 (Agentic Workflow Engine - AWE)
* **文档版本**：v2.16 (节点选中态去黑框 + 圆角 10 + 渐变调淡)
* **前序版本**：v2.15 (节点顶部渐变 + 去使用提示 + NodePanel hover 简介 + 发版主按钮 + 标题加宽)
* **主要负责人**：Gu Yu (资深全栈架构师)
* **发布时间**：2026-07-05
* **文档状态**：已锁定/已落地
* **配套代码版本**：frontend v0.3.4

---

## 1.1 v2.12 增量变更（相对 v2.11）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.12 相对 v2.11 的全部增量。

### 1.1.1 主题色系统：彻底废弃 lawe 紫色，落地 shadcn/ui 白底黑字
* **变更前（v2.11 残留 / lawe 风格）**：节点卡片 / 顶栏 logo / 端口圆点 / 运行按钮等位置仍使用 lawe 紫色（`#4D53E8`、`violet` 渐变、`bg-gradient-to-r from-brand-500 to-violet-500`）。
* **变更后（v2.12）**：严格遵循 shadcn/ui 默认调色板，全局零渐变零紫色：
  - 页面背景 `#ffffff`（`bg-white`）
  - 侧边栏背景 `#f8fafc`（`bg-slate-50`）
  - 主文字 `#020617`（`text-slate-950`）
  - 次文字 `#64748b`（`text-slate-500`）
  - 边框 `#e2e8f0`（`border-slate-200`）
  - 主操作按钮 `#0f172a`（`bg-slate-900`，黑底白字）
  - 次按钮 `#ffffff` + `border-slate-200`（白底细边）
  - 悬停 `#f1f5f9`（`bg-slate-100`）
  - 选中 `#e2e8f0`（`bg-slate-200`）
  - 成功 `#22c55e` / 警告 `#eab308` / 错误 `#ef4444` / 危险 `#dc2626`（保留 shadcn 默认）
  - 节点端口圆点描边 `#475569`（`stroke-slate-600`）
  - 节点连线 `stroke-slate-400` `#94a3b8`（不再用蓝色）

### 1.1.2 主界面：落地两栏布局（240px 固定左导航 + 右自适应内容）
* **变更前**：原 Home 页是单栏卡片网格 + 顶部"工作流"标题，没有左侧导航。
* **变更后（v2.12）**：
  - **左栏（240px 固定）**：`LeftNav` 组件，包含：
    - Logo 区（黑底白字方块 + 字母 `A` + "AWE" + "智能体工作流引擎" 副标题 + 后端健康状态点）
    - 4 个导航项：**工作流列表 / 节点管理 / 执行历史 / 设置**
    - 当前项：白底 + `border-slate-200` 细边 + 黑字
    - 底部版本号 v0.3.0
  - **右栏（自适应）**：根据 `NavKey` 路由切换：
    - `workflows` → 详情行表格（v2.11 中已存在，本次仅迁移到两栏布局）
    - `nodes` → 节点定义管理页（按 5 大类分组：触发/AI/知识/外部/人类）
    - `history` → 全局执行历史页（占位）
    - `settings` → 设置页（后端连接信息 + 前端版本，占位）
* **编辑界面（Editor）**：保持在两栏布局的右栏内，**不**显示左栏外的其他元素（保持 v2.11 §9.1 "保持现有布局不变"）。

### 1.1.3 工作流列表：从卡片网格改为详情行表格
* **变更前**：卡片网格，每张卡片显示工作流名 + 节点数。
* **变更后（v2.12）**：表格形式（PRD §9.1 v2.11 已规定，本次落地）：
  - 表头：`名称 / 状态 / 更新时间 / 操作`
  - 每行：状态点 + 名称 + 节点数 | 状态徽章 | 时间 | 行内操作按钮（运行次数 / 运行 / 分享 / 更多）
  - 行右键菜单：重命名 / 复制 / 导出 JSON / 复制分享链接 / 删除
  - 顶部：搜索框 + 新建按钮 + 总数统计
  - 底部：分页器（每页 15 条）

### 1.1.4 节点面板 + 节点卡片：白底 + 细边 + 类型色块
* 节点面板：底部悬浮弹出（lawe 交互手感保留），白底 + `border-slate-200` + `rounded-lg` + 极轻阴影
* 节点卡片：白底 + `border-slate-200` + `rounded-lg`，无渐变
* 节点类型色块：6 类行业色（emerald/blue/amber/sky/rose/slate），纯色无渐变
* 选中态：`border-#0f172a` + `0 0 0 2px #0f172a`（黑边+黑阴影）

### 1.1.5 新增占位页面
* `NodesPage`：节点定义管理（列表 / 搜索 / 按 category 分组）
* `HistoryPage`：全局执行历史（占位，等待后端 `list_runs` API 落地）
* `SettingsPage`：后端连接信息 + 前端版本

### 1.1.6 配套代码变更
* `src/App.tsx`：完全重写，集成 `LeftNav` 路由 + Editor 顶栏改为白底黑字
* `src/components/LeftNav.tsx`：**新增**
* `src/pages/NodesPage.tsx`：**新增**
* `src/pages/HistoryPage.tsx`：**新增**
* `src/pages/SettingsPage.tsx`：**新增**
* `src/components/Canvas.tsx`：端口圆点 `stroke="#4D53E8"` → `stroke="#475569"`
* `src/components/RunHistoryDrawer.tsx` / `RunHistoryPanel.tsx`：运行按钮 `bg-gradient-to-r from-brand-500 to-violet-500` → `bg-slate-900`
* `src/index.css`：增加 `:root` shadcn 主题变量（`--bg / --text / --border / --primary / --shadow-*` 等）

---

## 1.2 v2.13 增量变更（相对 v2.12）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.13 相对 v2.12 的全部增量。

### 1.2.1 编辑模式：落地全屏模式（隐藏左侧导航栏）
* **变更前（v2.12）**：进入编辑界面后，左侧 240px 导航栏 `LeftNav` 仍然显示，与编辑器画布争夺横向空间，画布宽度被压缩。
* **变更后（v2.13）**：进入编辑模式（`view.kind === 'editor'`）时，**完全隐藏** `LeftNav`，整屏（100% × 100%）用于编辑界面，提供最大画布空间。
* **实现方式**：`App.tsx` 顶层根据 `view.kind` 三元渲染：
  - `editor` → 单 div（`h: 100%, w: 100%`）包 `renderContent()`，不渲染 `LeftNav`
  - 其它（workflows / nodes / history / settings）→ flex 布局，`LeftNav` + `main`
* **返回路径**：编辑顶栏的「← 返回」按钮调用 `backToHome()`，恢复 `view.kind = 'workflows'`，`LeftNav` 重新显示。

### 1.2.2 底部工具栏：拆分为左右两个并行工具栏
* **变更前（v2.12）**：单一三段式工具栏（鼠标卡 / 紫色「+ 添加节点」/ 绿色试运行），内容臃肿。
* **变更后（v2.13）**：底部悬浮，**左右两个并行的工具栏卡片**：
  - **左工具栏**：`5 个小图标按钮`（注释 / 优化 / 排版 / 导出为图片 / 设置） + `1 个大图标按钮`（添加节点）
  - **右工具栏**：`1 个大图标按钮`（运行）
  - 两栏之间用 `justify-content: space-between` 分隔，间距 10px
  - 工具栏卡片：白底 + `border-slate-200` + `rounded-10` + `box-shadow 0 4 16 rgba(15,23,42,0.08)`
  - **小图标按钮**（32×32，6px 圆角）：默认透明背景 + slate-600 文字；hover `bg-slate-100`；激活 `bg-slate-900 + text-white`
  - **大图标按钮**（36 高，8px 圆角）：`bg-slate-900` 黑底白字 + 15px 圆角方形图标 + 文字标签；hover `bg-slate-950`
  - **运行中状态**：图标变 spinner，颜色 `bg-slate-700`，cursor: wait
* **零紫色 / 零渐变**：完全遵循 v2.12 §1.1.1 主题规范。

### 1.2.3 节点渲染：节点卡片只显示名字，详细信息 hover tooltip
* **变更前（v2.12）**：节点卡片直接显示 config 摘要（路径 / 提示词 / SQL / MCP 服务名等），卡片高度膨胀，密集排布时画布拥挤。
* **变更后（v2.13）**：
  - **节点主视图**：只显示 `节点类型色块（22×22，5px 圆角）+ 节点名字（13px，font-weight 600，slate-950）`
  - **节点高度**：从 64px 最小高度降低到 44px 最小高度，画布可容纳更多节点
  - **hover 详细卡片**：鼠标悬停（且未选中）时，节点右侧弹出 240px 宽的浮卡，依次展示：
    1. 节点分类 + type（slate-400，11px）
    2. def.description / config.description（slate-600，12px，lineHeight 1.5）
    3. config 摘要：前 4 个非 description 字段（key: value，60 字符截断）
    4. 端口数：输入 N / 输出 N（slate-500，11px）
  - 浮卡样式：白底 + `border-slate-200` + 8px 圆角 + `box-shadow 0 6 24 rgba(15,23,42,0.12)` + `pointer-events: none`（不挡操作）
  - 选中态：右上角复制 / 删除图标（22×22）保留

### 1.2.4 配套代码变更
* `src/App.tsx`：编辑模式条件渲染逻辑已就位（v2.12 落地）
* `src/components/BottomToolbar.tsx`：**完全重写**，按 §1.2.2 双工具栏实现
* `src/components/NodeRender.tsx`：**重写**，按 §1.2.3 节点只显名字 + hover 浮卡实现
* 移除旧版 `NodePreview` 子组件（v0.2.9 引入的 config 摘要内嵌渲染），改用 hover tooltip

---

## 1.3 v2.14 增量变更（相对 v2.13）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.14 相对 v2.13 的全部增量。

### 1.3.1 节点面板：每个节点只显示名称，去掉 description 行
* **变更前（v2.13）**：`NodePanel` 节点项展示 `类型色块 + 节点名 + 11px 描述文字`，每行高度约 40px，2 列网格，5 大类共 12 个节点占用整页较长，描述文字也常被截断。
* **变更后（v2.14）**：节点项只显示 `类型色块 + 节点名`，每行高度 32px，更紧凑，12 个节点在 460px 宽面板里一目了然。
* **视觉效果**：网格密度从 2×6 升级为接近 2×6 但每行更矮，分类标题更突出，搜索结果更直观。

### 1.3.2 画布节点：回退到 v0.3.0 风格，主视图内嵌 config 预览
* **变更前（v2.13）**：节点只显示 `类型色块 + 名字`，详细信息通过 hover 浮卡弹出。
* **变更后（v2.14）**：**回退到 v0.3.0 风格** —— 节点主视图直接内嵌 `config 预览`：
  - webhook：`POST /webhook` badge
  - http_request：`GET` badge + URL
  - skill：Python 脚本前 3 行
  - llm：`gpt-4o-mini` badge + 提示词
  - sql_query：SQL 单行
  - mcp_client：MCP 服务名
  - human_review：审批人
  - knowledge_search：知识库 ID
  - end：结束消息
  - 等等
* **用户理由**：节点 hover 才看到详情对不熟悉工作流的用户不友好，主视图内嵌预览让用户一眼看清节点作用。

### 1.3.3 顶栏按钮：保存 → 发版，去掉运行，新增版本历史
* **变更前（v2.13）**：顶栏右侧 `撤销 / 重做 / 保存 / 运行` 四个按钮
* **变更后（v2.14）**：
  - **去掉「运行」按钮**：运行入口放在底部工具栏（PRD v2.13），顶栏不再重复
  - **「保存」改名为「发版」**：语义升级，强调"发版"动作而非"保存草稿"
    - 图标 `Save` → `GitBranch`（更贴合发版语义）
  - **新增「版本历史」按钮**（在「发版」左边）：
    - 次按钮样式（白底 + slate-200 边）
    - 图标 `History` (lucide)
    - 占位 toast "版本历史（待接入）"，等待版本管理 API 落地

### 1.3.4 底部工具栏：左右两个工具栏居中排列
* **变更前（v2.13）**：底部工具栏 `justify-content: space-between`，左工具栏贴左、右工具栏贴右
* **变更后（v2.14）**：改为 `justify-content: center`，两个工具栏**居中**并排，间距 10px
* **视觉效果**：用户视线集中在画布正中央，操作更聚焦；避免两个工具栏被分散到画布两端造成视觉割裂

### 1.3.5 配套代码变更
* `src/components/NodePanel.tsx`：删除节点项的 description 行 div
* `src/components/NodeRender.tsx`：回退到 v0.3.0 内嵌 config 预览，移除 hover 浮卡
* `src/App.tsx`：顶栏 import 调整 `Save/Play` → `History/GitBranch`；新增 `onOpenVersionHistory`；去掉运行按钮；保存改发版 + GitBranch 图标
* `src/components/BottomToolbar.tsx`：`justify-content: space-between` → `center`
* 版本号 `v0.3.1` → `v0.3.2`（App.tsx 顶栏 + LeftNav.tsx 底部）

---

## 1.4 v2.15 增量变更（相对 v2.14）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.15 相对 v2.14 的全部增量。

### 1.4.1 画布节点：恢复顶部一点点类型色相渐变
* **变更前（v2.14）**：`NodeRender` 节点最外层 div 用纯白背景（`background: #ffffff`），节点看上去"扁平冷冰"，色相信息完全靠左侧 26×26 圆角色块承载。
* **变更后（v2.15）**：恢复顶部一点点类型色相渐变，**向下迅速过渡到纯白**（不影响阅读）：
  - 渐变定义：`linear-gradient(180deg, ${color}1f 0%, ${color}0a 18%, #ffffff 42%)`
  - `1f` ≈ 12% alpha、`0a` ≈ 4% alpha — 颜色非常淡，顶部轻染色相
  - 42% 高度处已完全过渡到纯白，下方 body 区仍是干净白底
  - 视觉：用户一眼能感知"这是哪个类型的节点"（绿/蓝/橙/天空/红/黑），同时 body 的内嵌 config 预览仍保持高对比度
* **零紫色**：颜色仍用 v2.12 规范的 6 类行业色（emerald/blue/amber/sky/rose/slate），没有引入新色

### 1.4.2 编辑模式：去掉右上角"使用提示"卡片
* **变更前（v2.14）**：空画布（或无选中节点）时，右上角显示一个 280×auto 的"使用提示"白卡，列出 4 条提示（点击底部 + 添加节点 / 拖线连接 / 点击节点编辑配置 / 拖动画布平移视角）。
* **变更后（v2.15）**：完全删除该卡片。理由：
  - 提示信息对老用户是噪声，对新用户也很快成视觉负担
  - 编辑模式顶栏"返回"按钮和底部工具栏"+"添加节点已足够显性
  - 让画布右上角空间释放给节点本身/将来可能的批量操作
* **影响范围**：仅 `App.tsx` 中 `!configOpen && !selectedNodeId && graph.nodes.length > 0` 条件块

### 1.4.3 NodePanel：hover 节点弹出 240px 简介浮卡
* **变更前（v2.14）**：`NodePanel` 仅显示「类型色块 + 名称」，用户必须点击添加到画布后才能在右侧 Drawer 看完整描述。
* **变更后（v2.15）**：hover 节点时弹出 240px 简介浮卡，**portal 到 body**（避免被内部 scroll 裁剪）：
  - 浮卡定位：`position: fixed`，基于 button `getBoundingClientRect` 计算 top/left，`transform: translate(-50%, -100%)` 让浮卡在按钮正上方
  - 浮卡内容（自上而下）：
    1. **分类标签**：`触发 / 边界` / `AI 与语义路由` / ... · type（11px slate-400）
    2. **节点名称**：13px slate-950 / font-weight 600
    3. **简介描述**：12px slate-600 / lineHeight 1.5（缺省 "点击添加到画布后，在右侧面板配置参数。"）
    4. **端口统计**：底部 1px 分割线 + `N 输入` / `M 输出`（11px slate-500）
  - 浮卡样式：白底 + `border-slate-200` + `rounded-lg` + `box-shadow 0 6 24 rgba(15,23,42,0.12)` + `pointer-events: none`（不挡点击）
  - zIndex 1000，确保覆盖画布和节点 Drawer

### 1.4.4 顶栏"发版"按钮：升级为主按钮 + Rocket 图标
* **变更前（v2.14）**：发版按钮是次按钮样式（白底 + slate-200 边 + slate-500 文字），图标 `GitBranch`。
* **变更后（v2.15）**：
  - **样式升级为主按钮**：黑底白字（`bg-slate-900 #0f172a` + `color: #ffffff`），hover 加深到 `#020617`（slate-950）
  - **图标更换为 `Rocket`**：比 `GitBranch` 更贴"发版/发布"语义（GitBranch 暗示分支管理，Rocket 暗示一键发射/部署）
  - 其它属性保持不变：height 28 / padding 0 12 / 6px 圆角 / 12px 字号
  - **保留 loading 态**：保存中显示 `Loader2` spinner + `cursor: wait` + 0.6 opacity
* **理由**：发版是用户最关键的操作（保存到数据库 + 后续可触发版本管理），主按钮样式更符合用户对"重要操作"的视觉预期

### 1.4.5 顶栏标题输入框：加宽到 420px（支持长标题）
* **变更前（v2.14）**：标题输入框 `width: 260px`，14px 字号，6 像素汉字只能显示约 12 个字就截断
* **变更后（v2.15）**：
  - `width: 420px`（默认）/ `max-width: 520px`（防撑破顶栏）/ `min-width: 180px`（短标题不显空）
  - 14px 字号 + font-weight 600 + slate-950 颜色保持不变
  - 其它属性（无边框 / focus 时 `bg-slate-100` / placeholder "工作流名称"）保持不变
* **理由**：实际工作流名常包含"客户名称 + 业务场景 + 时间"等长串描述（如「2026 Q3 客户回访自动化工单流」），260px 完全不够用

### 1.4.6 配套代码变更
* `src/components/NodeRender.tsx`：最外层 div 加 `background: linear-gradient(180deg, ${color}1f 0%, ${color}0a 18%, #ffffff 42%)`
* `src/App.tsx`：
  - 删除「使用提示」条件块（v2.14 第 422-439 行）
  - 标题 input 宽度 260 → 420 + maxWidth 520 + minWidth 180
  - 发版按钮样式：白底 → 黑底白字；图标 `GitBranch` → `Rocket`；import 调整
* `src/components/NodePanel.tsx`：
  - 新增 `hoveredType` / `hoverRect` / `hoveredDef` state
  - 节点 button `onMouseEnter` / `onMouseLeave` 合并 handler（同时更新 hover state 和背景色）
  - 末尾添加 portal 浮卡（条件 `hoveredDef && hoverRect`）
* 版本号 `v0.3.2` → `v0.3.3`（App.tsx 顶栏 + LeftNav.tsx 底部）

---

## 1.5 v2.16 增量变更（相对 v2.15）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.16 相对 v2.15 的全部增量。

### 1.5.1 节点选中态：去掉 2px 黑色外发光，4 角不再像被黑框包住
* **变更前（v2.15）**：`.node-card.is-selected` 选中态 box-shadow 为 `0 0 0 2px #0f172a, var(--shadow-md)` —— 在节点外侧画了 2px 纯黑外环，4 个圆角被 2px 厚的黑色包住，视觉上"4 个角是黑色的"，非常硬。
* **变更后（v2.16）**：
  - 去掉 2px 黑色外发光
  - 改用 `0 0 0 1px #0f172a, 0 1px 3px rgba(15, 23, 42, 0.10)` —— 1px 极细黑环 + 极轻阴影
  - 视觉：节点选中后边框变黑，但外侧 4 角只露 1px 细边，不像被黑框"框住"
* **用户反馈**："选中节点之后，节点的4个角是黑色的"——直接对应本次修复
* **保持选中态识别度**：border-color 仍然 `#0f172a`（slate-950 纯黑），用户一眼能看出选中

### 1.5.2 节点圆角：8px → 10px（参考 lawe 风格但更克制）
* **变更前（v2.15）**：`.node-card` border-radius 8px（shadcn 默认 rounded-lg）
* **变更后（v2.16）**：border-radius 10px
* **参考 lawe**：lawe_project 用 12px（`rounded-xl` 风格）
* **AWE 选择 10px 的理由**：
  - 比 shadcn 8px 更柔和不显冷硬
  - 比 lawe 12px 更克制，符合 AWE「白底黑字专业工具」定位（lawe 是 12px 偏向消费级）
  - 配合 1px 细选中边，4 角过渡自然

### 1.5.3 节点顶部渐变：颜色调淡（12%/4% → 6%/2%）
* **变更前（v2.15）**：`linear-gradient(180deg, ${color}1f 0%, ${color}0a 18%, #ffffff 42%)`
  - 1f = 12% alpha / 0a = 4% alpha
  - 顶部染色偏重，整个顶部都带类型色
* **变更后（v2.16）**：`linear-gradient(180deg, ${color}0f 0%, ${color}06 18%, #ffffff 50%)`
  - 0f = 6% alpha / 06 = 2% alpha
  - 顶部 6% 染色（只有非常淡的色相透出），50% 处已完全白底
  - 视觉：节点看上去"白底为主 + 一点点色相"，更克制专业
* **参考 lawe**：lawe_project 用 `linear-gradient(180deg, #eff1fb 0%, #fcfcfd 40%, #ffffff 100%)` —— 浅蓝紫色（接近白），也走"非常淡的渐变"路线
* **AWE 差异化**：保留 6 类类型色相（emerald/blue/amber/sky/rose/slate）让用户能区分节点类型，但只露"一点点"色相

### 1.5.4 配套代码变更
* `src/index.css`：
  - `.node-card` border-radius 8px → 10px
  - `.node-card.is-selected` box-shadow `0 0 0 2px #0f172a` → `0 0 0 1px #0f172a, 0 1px 3px rgba(15,23,42,0.10)`
* `src/components/NodeRender.tsx`：内联 style 的 background gradient 颜色 alpha 调淡（`1f/0a/42%` → `0f/06/50%`）
* 版本号 `v0.3.3` → `v0.3.4`（App.tsx 顶栏 + LeftNav.tsx 底部）

---

## 2. 项目愿景与产品定位
本项目定位为面向桌面端与本地自动化场景的 Agentic RPA 基础设施。
核心主张“AI 编排，人类管理”。系统通过底层 Schema 数据驱动，赋能大模型动态编排工作流。秉承“坚决不重复造轮子”的开发哲学，系统高度组装行业内现成的顶级开源项目，结合“静默按需下载 + CDP 动态接管”的隔离式部署架构，打造极具容错性与商业分发能力的智能基座。

---

## 3. 产品核心架构与运行模式
* **Mode A (独立桌面端)**：FastAPI + PyWebview 桌面应用，彻底分离运行环境依赖。
* **Mode B (无头 MCP 服务)**：作为标准 MCP Server，暴露内部图谱与节点字典供外部控制。
* **Mode C (后台静默调度)**：基于 APScheduler 结合 SQLite 的跨日长程任务计划调度。

---

## 4. 🛠️ 开源技术栈选型与“不造轮子”策略 (核心约束)
为极大降低开发成本，系统严禁从零手写基础轮子，必须深度集成以下现成的顶级开源项目：

### 4.1 前端现成项目选型
* **可视化画布引擎**：强制接入字节跳动开源的 `@flowgram.ai`。利用其现成的节点渲染、拖拽连线与小地图机制，直接承载后端吐出的 DAG JSON，复刻大厂级的操作手感。
* **UI 组件与样式库**：采用 `React 18` + `Vite`。样式库强制使用 `shadcn/ui` 结合 `TailwindCSS v4`，以复制粘贴源码的形式极速组装配置表单面板，免除手动编写冗余 CSS。

### 4.2 后端现成项目选型
* **Web 与打包框架**：`FastAPI` (提供极速的异步 API) + `PyWebview` (提供本地桌面窗口封装) + `PyInstaller` (打包)。
* **图编排与状态机**：强制使用 `LangGraph`。完全托管多线并行、条件路由循环以及全局状态字典 (State)，免除手写执行引擎。
* **RPA 自动化驱动**：
  * 网页控制：`DrissionPage` (接管 CDP 协议，原生绕过反爬机制)。
  * 桌面控制：`pywinauto` (基于 UIA 解析桌面控件) + `PyAutoGUI` (图像匹配视觉辅助)。
* **模型调用与知识库**：`LiteLLM` (统一适配全球各大模型 API) + `ChromaDB` (极轻量的单机向量文件数据库)。

---

## 5. 🧠 核心驱动引擎：AI 编排协议与拓扑校验
### 5.1 节点说明书注入 
将所有基础节点的 JSON Schema 浓缩为“节点字典”注入 System Prompt，定义 AI 可用的“原子积木”。
### 5.2 AI 动态创建法则 
* 第三方接口：调用 `HTTP_Request`，动态生成精确 URL 与 Headers。
* RPA 脚本：调用 `Skill_Python`，动态编写返回 dict 结构的 DrissionPage/pywinauto 脚本。
* 变量映射：下游引用上游输出必须使用 `{{node_id.outputs.field_name}}`。
### 5.3 编译期静态拓扑校验 
在内存中假跑校验数据映射链条。如下游引用了未声明的变量，拦截器直接抛错并打回给 AI 要求重写（无缝重试自愈），确保输出到画布的图谱 100% 物理可通。

---

## 6. 核心节点目录 (12大原子节点体系)

### 6.1 触发与边界节点 
* **1. [Webhook 触发器]**：暴露动态接口接收外部唤醒。
* **2. [终点与响应]**：将图执行结果打包响应。

### 6.2 高级 AI 与语义路由节点 
* **3. [LLM 推断]**：执行对话与逻辑推断。
* **4. [意图分类]**：支持自然语言多分支路由，基于 LLM 评估走向。
* **5. [参数提取]**：强制 LLM 提取纯净 JSON，为下游提供结构化入参。
* **6. [查询重写]**：扩写高质量搜索词，提升知识库召回率。

### 6.3 本地知识与数据持久化节点 
* **7. [本地知识库读写]**：基于 ChromaDB 实现切块存储与检索。
* **8. [结构化表格读写]**：基于 SQLite 提供可视化的增删改查。

### 6.4 外部生态与控制节点 
* **9. [通用 HTTP 请求]**：万能网络请求器。
* **10. [MCP Client 桥接]**：挂载外部第三方 MCP 生态能力。
* **11. [Skill 脚本沙盒]**：受限 Python 容器，具备超时阻断与执行报错回传的大模型自愈 (Self-Correction) 能力。

### 6.5 人类管理节点 
* **12. [人工审批 / 断点挂起]**：拦截执行流，人类审查确认后方可继续。

---

## 7. 工程分发与环境护城河
* **静默按需下载浏览器**：主程序包 < 50MB。首次启动静默拉取 Chromium (Chrome for Testing) 解压至本地，实现环境隔离。
* **强制接管 CDP**：DrissionPage 通过 CDP 获取 DOM 树转储、网络层拦截与调试权限。
* **端口动态分配与僵尸绞杀**：动态分配 9200-9300 调试端口；Watchdog 守护线程主进程退出时强制清理浏览器僵尸进程。
* **根除 DPI 缩放灾难**：注入 Windows DPI 感知 Hook。强制 RPA 采用 UIA 树状句柄定位。

---

## 8. 系统健壮性机制
* **高危语法拦截**：基于 `ast` 审计，屏蔽 `os.system` 等高危脚本注入。
* **快照回滚与断点恢复**：基于 SQLite 提供工作流历史还原及 LangGraph 断点续跑。

---

## 9. UI/UX 设计规范（已确认）

### 9.1 布局方案

**主界面（工作流列表页）**：两栏布局。

| 区域 | 宽度 | 内容 |
|------|------|------|
| **左栏** | 固定 240px | Logo + 全局导航（工作流列表 / 节点管理 / 执行历史 / 设置） |
| **右栏** | 自适应 | 当前页面内容。列表页为**详情列表形式**（非卡片网格），含搜索 + 新建按钮 + 分页器 |

工作流列表采用详情行形式（非卡片网格），每行显示三列字段：

| 列 | 说明 |
|----|------|
| **名称** | 工作流名称，可点击进入编辑界面 |
| **状态** | 运行中 / 已停止 / 草稿 / 错误等状态标识 |
| **更新时间** | 最近一次修改时间 |

每行右侧操作区包含：
1. **右键菜单**：右键呼出编辑、复制、删除等操作
2. **运行按钮**：快捷启动/停止工作流执行
3. **分享按钮**：生成分享链接或导出工作流

**编辑界面（PRD v2.13 更新）**：**全屏编辑模式**。进入编辑模式后，**不显示左侧 240px 导航栏**，整屏（100% × 100%）用于编辑器：顶栏（44px，白底 + slate-200 底边）+ 主体画布 + 底部双工具栏（PRD §1.2.2）。顶栏「← 返回」按钮回到工作流列表，左侧导航重新出现。

**节点渲染（PRD v2.13 更新）**：节点卡片只显示 `类型色块 + 节点名字`，详细信息（def 描述 / config 摘要 / 端口数）通过 hover 浮卡（240px 宽）展示，避免画布拥挤（PRD §1.2.3）。

### 9.2 主题风格：shadcn/ui 白色 + 黑色（彻底废弃渐变紫色）

**设计原则：** 严格遵循 shadcn/ui 默认设计体系，以白色背景和深黑文字为基础，零渐变、零紫色、纯扁平。

**色彩规范：**

| 用途 | 色值 | Tailwind 类 | 说明 |
|------|------|-------------|------|
| 页面背景 | `#ffffff` | `bg-white` | 主内容区纯白 |
| 侧边栏背景 | `#f8fafc` | `bg-slate-50` | 左栏浅灰区分层级 |
| 主文字 | `#020617` | `text-slate-950` | 标题与正文 |
| 次要文字 | `#64748b` | `text-slate-500` | 描述、辅助信息 |
| 边框 | `#e2e8f0` | `border-slate-200` | 卡片、分割线、输入框 |
| 主按钮 | `#0f172a` | `bg-slate-900 text-white` | primary 操作（黑底白字） |
| 次按钮 | `#ffffff` | `bg-white border-slate-200` | secondary 操作（白底黑框） |
| 悬停背景 | `#f1f5f9` | `bg-slate-100` | 列表项、菜单项 hover |
| 选中态 | `#e2e8f0` | `bg-slate-200` | 当前选中项 |
| 成功 | `#22c55e` | `text-green-500` | 状态指示灯、成功提示 |
| 警告 | `#eab308` | `text-yellow-500` | 警告提示 |
| 错误 | `#ef4444` | `text-red-500` | 错误提示 |
| 危险操作 | `#dc2626` | `bg-red-600` | 删除、终止等不可逆操作 |

**组件风格规范：**
- **按钮**：全部使用 shadcn Button 组件，主操作为 `default`（黑底白字），次操作为 `outline`（白底黑框），禁用 `gradient` 和 `purple` 任何变体
- **卡片**：白底 + `border-slate-200` 细边框 + `rounded-lg` 圆角，无阴影或仅 `shadow-sm`
- **输入框**：shadcn Input 默认样式，白底 + 浅灰边框，focus 时 `ring-slate-400`
- **导航栏**：顶部白底 + 底部 `border-b` 细线，无渐变、无紫色
- **Logo/品牌色**：取消紫色，改用黑色/深灰文字标识

**字体规范：**
- 字体栈：Inter, system-ui, sans-serif（shadcn 默认）
- 标题：`font-semibold` 或 `font-bold`
- 正文：`font-normal`, `text-slate-950`
- 代码/日志：`font-mono`（JetBrains Mono 或系统默认）

**间距规范：**
- 基础单位：4px（Tailwind `space-1`）
- 页面内边距：`p-6`（24px）
- 间距：`gap-4`（16px）