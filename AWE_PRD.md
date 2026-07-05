# 📄 产品需求文档 (PRD) - 智能体工作流引擎 (AWE) v2.19

## 1. 文档信息
* **项目名称**：智能体工作流引擎 (Agentic Workflow Engine - AWE)
* **文档版本**：v2.19 (工作流列表批量选择/删除 + 画布 Shift 框选)
* **前序版本**：v2.18 (节点 4 角黑点彻底根因修复 + 顶栏 lawe 风格化 + BottomToolbar flex 居中)
* **主要负责人**：Gu Yu (资深全栈架构师)
* **发布时间**：2026-07-06
* **文档状态**：已锁定/已落地
* **配套代码版本**：frontend v0.3.7

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

## 1.6 v2.17 增量变更（相对 v2.16）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.17 相对 v2.16 的全部增量（重大修复 + 新功能）。

### 1.6.1 节点 4 角黑点：根因修复（Canvas.tsx 外层 div 去掉 shadow-md）
* **根因（v2.16 残留 bug）**：
  - 之前以为"4 角黑点"是 `.node-card.is-selected` 的 `box-shadow: 0 0 0 Npx` 造成的，反复改 N 没用
  - **真正的根因**：`Canvas.tsx` 第 313-323 行的 `<foreignObject>` 内有个外层 `<div className="transition-shadow ${selected ? 'shadow-md' : ''}>` —— **这个外层 div 没有 border-radius**，但有 `shadow-md`（Tailwind 默认软阴影 `0 4px 6px -1px rgb(0 0 0 / 0.1)`）
  - 内层 NodeRender 的 `.node-card` 有 10/12px 圆角，**圆角内的 box-shadow 不会显示在 4 角外**
  - **外层方角阴影"漏"在 NodeRender 圆角外**，从外侧看节点 4 角被方框阴影包住 → 看起来"4 角是黑色的"
* **变更后（v2.17）**：
  - **去掉 Canvas.tsx 第 313-323 行外层 div 的 `shadow-md`**（根因修复）
  - 选中态视觉**完全交给 NodeRender 内部** `.node-card.is-selected` 的 `0 0 0 1px #0f172a + 0 1px 3px rgba(15,23,42,0.10)`
  - 不再有两层 box-shadow 叠加，4 角干净

### 1.6.2 节点样式：完全照搬 lawe 风格（圆角 12 + 双层 box-shadow）
* **变更前（v2.16）**：
  - 圆角 10px
  - box-shadow 单层 `0 1px 2px 0 rgb(0 0 0 / 0.05)`（shadcn --shadow-sm）
* **变更后（v2.17）**：
  - 圆角 12px（lawe 风格）
  - box-shadow 双层（**完全照搬 lawe `.node-card` 样式**）：
    - 默认：`0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 1px rgba(255, 255, 255, 0.8)` —— 外阴影 + 内白色高光
    - hover：`0 6px 18px rgba(15, 23, 42, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.8)` —— 加深 + 内高光
    - selected：`0 0 0 1px #0f172a, 0 1px 3px rgba(15, 23, 42, 0.10)` —— 1px 黑环
* **background 渐变调整**：
  - 之前 `${color}0f 0%, ${color}06 18%, #ffffff 50%`（3 段渐变）
  - 现在 `${color}14 0%, #ffffff 60%`（2 段渐变，更克制，参考 lawe 的 `#eff1fb → #fcfcfd → #ffffff` 风格）
  - 14 = 8% alpha，比 v2.16 的 6% 还稍深一点，但更接近 lawe 的"8% 起步 + 60% 处已白底"风格

### 1.6.3 缩放 bug 修复：BottomToolbar 和 NodeConfigDrawer 改 fixed 视口定位
* **问题（v2.16）**：使用触控板放大视图后，底部菜单栏（BottomToolbar）和右侧 Drawer（NodeConfigDrawer）会"跑到视图外"
* **根因**：两者都使用 `position: absolute` 相对父 div 定位，受父容器 reflow 和 transform 影响
* **变更后（v2.17）**：
  - **BottomToolbar.tsx**：`position: absolute` → `position: fixed`，`left: 16 + right: 16` → `left: 50% + transform: translateX(-50%)`（居中），`bottom: 16` 保持
  - **NodeConfigDrawer（App.tsx 525-541 行）**：`className="absolute right-4 top-4 z-30"` → `className="fixed right-4 z-30"`，`top: 4` → `top: 60`（顶栏 44px + 16px 间距），新增 `height: 'calc(100vh - 76px)' + maxHeight: 800`
  - **结论**：两个 UI 都用 fixed 视口定位，**永远固定在视口边界上**，缩放视图不会让它们跑出去

### 1.6.4 新增功能：左下角缩放控件（ZoomControls 组件）
* **变更前（v2.16）**：App.tsx 有 `const [zoom, setZoom] = useState(1)` 死代码，**永远 = 1**，因为没有 setZoom 的触发点
* **变更后（v2.17）**：
  - **App.tsx**：升级 `zoom (scalar)` → `canvasView ({ x, y, scale })`，由父组件管理，**传递给 Canvas 实现受控缩放**
  - **Canvas.tsx**：view state 改为受控（`view` prop + `onViewChange` callback），删掉内部 useState
  - **新增 `src/components/ZoomControls.tsx`**：左下角 fixed 定位（`left: 16, bottom: 16`）的小工具栏：
    - `-` 按钮：缩小（scale × 0.909，最小 0.3）
    - **`XX%` 文本**：实时显示当前缩放比例（tabular-nums 等宽数字）
    - `+` 按钮：放大（scale × 1.1，最大 2.5）
    - `适应` 按钮：scale 归 1，pan 归 (0, 0)
  - 样式：白底 + slate-200 边 + 10px 圆角 + `box-shadow: 0 4px 16px rgba(15,23,42,0.08)` + 36px 高

### 1.6.5 顶栏小调整（v0.3.5 lawe 风格化）
* 顶栏保持 v2.13 规范（44px 白底 + slate-200 底边 + 黑底 logo + 字母 A），但**所有按钮的 onMouseLeave 状态恢复更精确**（之前 hover 离开后偶尔状态卡住），版本号 v0.3.4 → v0.3.5
* **Logo** 仍为 `26×26 黑底 #0f172a + 字母 A` 风格（去紫色，shadcn 规范）
* **发版按钮**：黑底白字 + Rocket 图标（v2.15 落地，v2.17 保持）
* **版本历史按钮**：白底 + slate-200 边（次按钮样式）
* **标题输入框**：420px 宽（v2.15 加宽，v2.17 保持）

### 1.6.6 配套代码变更
* `src/components/Canvas.tsx`：
  - **根因修复**：去掉外层 div 的 `shadow-md` 类（4 角黑点修复）
  - view state 改为受控：删 `useState view`、加 `view` 和 `onViewChange` props
  - onWheel / 平移 / setView 全部改用 `onViewChange`
  - 外层 div 改为 `flex-1 min-h-0 overflow-hidden`（去掉 flex 容器）
* `src/components/BottomToolbar.tsx`：`position: absolute` → `fixed`；`left/right` 改为 `left: 50% + translateX(-50%)` 居中
* `src/components/NodeRender.tsx`：渐变 `1f/0a/50%` → `14/60%`（2 段，lawe 风格）
* `src/index.css .node-card`：圆角 10 → 12；box-shadow 单层 → 双层（外阴影 + 内白色高光）
* `src/components/ZoomControls.tsx`：**新增**（左下角缩放控件）
* `src/App.tsx`：
  - 升级 `useState(1) zoom` → `useState({x,y,scale:1}) canvasView`
  - 删 `useState(1) zoom` 死代码
  - Canvas 加 `view` + `onViewChange` props
  - BottomToolbar `zoom` prop 改用 `canvasView.scale`
  - 新增 `<ZoomControls>` 渲染（左下角）
  - NodeConfigDrawer `className` 改 `fixed right-4`，`top: 4` → `top: 60`
* 版本号 `v0.3.4` → `v0.3.5`（App.tsx 顶栏 + LeftNav.tsx 底部）

---

## 1.7 v2.18 增量变更（相对 v2.17）

> **同步规则**：AWE 项目中所有涉及功能、UI/UX 规范、产品信息的代码变更，必须同步更新本 PRD 文档。本节记录 v2.18 相对 v2.17 的全部增量（彻底修复节点 4 角黑点 + 顶栏 lawe 风格化）。

### 1.7.1 节点 4 角黑点：彻底根因修复（去掉 `.is-selected` 的 `0 0 0 1px #0f172a` 黑色实心外环）
* **根因（v2.17 残留 bug）**：
  - v2.17 修复了 `Canvas.tsx` 外层 div 的 `shadow-md`（Tailwind 默认软阴影漏出 4 角），4 角黑点问题**部分缓解**
  - 但**真正的 4 角黑点根因是另一个**：`.node-card.is-selected` 的 `box-shadow: 0 0 0 1px #0f172a, 0 1px 3px rgba(15, 23, 42, 0.10)`
  - `0 0 0 1px #0f172a` 是**纯黑实心外环**（spread 1px），紧贴节点 border-radius（12px）外侧绘制
  - 视觉上：节点选中后，12px 圆角外侧有 1px 厚的黑色硬边包住，4 角最明显（黑色"凸出"圆角外），用户看起来"4 角是黑色的"
* **变更后（v2.18）**：
  - 选中态 box-shadow 去掉 `0 0 0 1px #0f172a` 这个纯黑实心外环
  - 改为**双层阴影加深**：
    - `0 4px 16px rgba(15, 23, 42, 0.12)` —— 外阴影加深（暗一档，16px 半径）
    - `0 0 0 1px rgba(15, 23, 42, 0.04)` —— **极淡 4% 灰色描边**（不是纯黑，配合圆角过渡）
    - `inset 0 1px 1px rgba(255, 255, 255, 0.8)` —— 内白色高光保留
  - 选中态识别度**完全靠 `border-color: #0f172a`（黑边）+ 更深的外阴影** 表达，4 角干净无黑框
  - 验证：playwright 截图 v036_04_node_selected.png 确认 4 角干净

### 1.7.2 节点背景渐变：通过 CSS 变量 `--node-color` 注入（避免内联 background 破坏 box-shadow 渲染）
* **变更前（v2.17）**：`NodeRender.tsx` 用 inline style 设置 `background: linear-gradient(...)`，覆盖了 `.node-card` 类的 box-shadow 渲染层级
* **变更后（v2.18）**：
  - `.node-card` 的 background 改为 `linear-gradient(180deg, var(--node-color, #f1f5f9) 0%, #ffffff 60%)`（CSS 变量 + 回落默认值）
  - `NodeRender.tsx` 去掉 inline `background`，改为设置 CSS 变量 `'--node-color': '${color}26'`（类型色 + 15% alpha）
  - 优点：background 由 CSS 类控制，与 box-shadow 渲染层级一致，**避免内联样式覆盖导致的渲染异常**
  - 颜色饱和度从 v2.17 的 `${color}14`（8% alpha）提升到 `${color}26`（15% alpha），更接近"一点点色相"的视觉

### 1.7.3 BottomToolbar：定位从 `transform: translateX(-50%)` 改为 flex 居中容器
* **问题（v2.17）**：
  - `position: fixed; left: 50%; transform: translateX(-50%)` 实现居中
  - 但 BottomToolbar 自身带 `transform: translateX(-50%)` 会**让它自己变成 fixed containing block**
  - 在某些嵌套 transform / will-change / 父容器 filter 场景下，会被父容器变换影响导致**缩放时 toolbar 偏移到视口外**
* **变更后（v2.18）**：
  - 外层 div 改为 `position: fixed; left: 0; right: 0; bottom: 16px; display: flex; justify-content: center; gap: 10px; pointer-events: none`
  - 完全无 `transform`，严格 fixed 视口定位
  - 内部 toolbar 容器 `pointer-events: auto` 接收点击
  - 验证：playwright 截图 v036_05/v036_06 在 110% / 161% 缩放下，bottom toolbar 都稳定在视口底部

### 1.7.4 NodePanel 容器：absolute + flex 居中（替代 `left:50% + transform:translateX(-50%)`）
* **变更前（v2.17）**：`<div style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)' }}>` 居中
* **变更后（v2.18）**：外层 `position: absolute; left: 0; right: 0; bottom: 72; display: flex; justify-content: center; pointer-events: none`，内层 wrapper `pointer-events: auto`
* 理由：和 BottomToolbar 同理，避免 transform 在某些场景下干扰 absolute 定位

### 1.7.5 顶栏 lawe 风格化（v0.3.6 完全照搬 lawe TopToolbar.tsx 布局）
* **变更前（v0.3.5）**：
  - "返回"按钮带文字（28px + "返回"），padding 0 8px gap 4
  - Logo 26x26 圆角 6
  - 标题输入框固定 420px
  - 撤销/重用 awe-icon-btn（白底 + slate-200 边）
  - 右侧按钮 gap 8
* **变更后（v0.3.6 严格按 lawe 风格）**：
  - 顶栏 padding `0 12px 0 8px`（lawe 是 0 16px 0 16px，紧凑 4px 节省）
  - **"返回"按钮**：纯图标 28x28，无文字（lawe 风格）
  - **Logo**：缩小到 22x22 圆角 5（lawe 是 26x26 圆角 6），letter-spacing -0.2
  - **AWE 文字标识**：13px / font-weight 700 / `#0f172a` / letter-spacing 0.2
  - **竖线分隔符**：18px 高度 + 14px 高度（lawe 风格）
  - **标题输入框**：flex 1 / max-width 380px / min-width 120px（v2.18 改用 flex 自适应，max 380 不撑破）
  - **版本号徽章**：v0.3.6 胶囊样式（`padding: 1px 6px`, `background: #f8fafc`, `border: 1px solid #e2e8f0`, `border-radius: 4`），更精致
  - **撤销/重做**：纯图标 28x28 + hover 浅灰（无白底边框，lawe 风格）
  - **撤销/重做 / 版本历史间** 加 1px 18px 竖线分隔
  - **右侧按钮区**：gap 4（lawe 是 gap 8，紧凑 4px 节省）
  - **发版按钮**：marginLeft 4 与版本历史按钮分开，font-weight 500 → 600（更醒目）
* 整体观感：紧凑、精致、专业，符合 lawe "v2.0" 顶栏的所有视觉细节

### 1.7.6 配套代码变更
* `src/index.css .node-card`：
  - background 改为 `linear-gradient(180deg, var(--node-color, #f1f5f9) 0%, #ffffff 60%)`（CSS 变量）
  - `.is-selected` 去掉 `0 0 0 1px #0f172a`，改为 `0 4px 16px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04), inset 0 1px 1px rgba(255, 255, 255, 0.8)`
* `src/components/NodeRender.tsx`：
  - 去掉 inline `background`
  - 改为 inline `'--node-color': '${color}26'`
* `src/components/BottomToolbar.tsx`：
  - 定位从 `position: fixed; left: 50%; transform: translateX(-50%)` 改为 `position: fixed; left: 0; right: 0; display: flex; justify-content: center`（无 transform）
* `src/App.tsx`：
  - 顶栏完全重写（v0.3.6 lawe 风格化）
  - NodePanel 容器改用 absolute + flex 居中
  - 版本号 v0.3.5 → v0.3.6
* `src/components/LeftNav.tsx`：底部版本号 v0.3.5 → v0.3.6
* 验证截图：`docs/shots/v036_01_home.png` ~ `v036_07_layout.png`（7 张，覆盖 home / editor / 节点添加 / 选中 / 缩放 110% / 缩放 161% / 自动布局）

### 1.7.7 避坑要点（v2.18 沉淀）
* **`box-shadow: 0 0 0 Npx` 即使是 N=1 也会在圆角外侧绘制"硬边"**：选用浅色 4% 描边或纯阴影，不要用纯黑实心 spread，否则 4 角变方
* **CSS 变量比内联 background 更适合做"主题相关样式"**：避免内联样式覆盖类的 box-shadow 渲染层级
* **`transform: translateX(-50%)` 在 fixed/absolute 元素上建立新的 containing block**：在嵌套 transform / will-change 场景下可能让 fixed/absolute 偏移，改用 flex 容器居中更稳健

---

## 1.8 v2.19 增量变更（相对 v2.18）
- **版本号**：PRD v2.19 / frontend v0.3.7 / 2026-07-06
- **说明**：基于用户反馈，引入工作流列表批量操作和画布框选能力，提升多工作流管理和多节点操作的效率。

### 1.8.1 功能 A — 工作流列表批量选择与删除
* **变更文件**：`src/pages/HomePage.tsx`、`src/lib/api.ts`、`backend/app/api/workflows.py`
* **操作细节**：
  - 表头新增全选复选框（三态：全选 ✓ / 半选 — / 未选 □），18x18px 4px 圆角
  - 每行新增复选框列（grid 从 4 列扩展为 5 列：40px + 名称 + 状态 + 时间 + 操作）
  - 选中行高亮为浅蓝底（`rgba(59,130,246,0.06)`），hover 不再覆盖选中样式
  - 选中后顶部浮现批量操作栏："取消选择"按钮 + "删除选中(N)"红色删除按钮（loading 态防止重复点击）
  - 后端新增 `POST /api/workflows/batch-delete` 端点，接受 `{"ids": [...]}` 批量执行级联删除
* **设计原则**：表格式交互，不引入拖选列；批量删除前二次确认

### 1.8.2 功能 B — 画布 Shift 拖动框选
* **变更文件**：`src/components/Canvas.tsx`
* **操作细节**：
  - 节点点击：Shift + 点击 → 多选切换（toggle）；普通点击 → 单选
  - 画布空白区：Shift + 拖动 → 框选模式（半透明蓝色虚线矩形，strokeDasharray="4 3"），鼠标松开后框内所有节点被选中
  - 普通拖动（不按 Shift） → 平移画布（保持原有逻辑）
  - Delete/Backspace → 删除所有选中节点及其连线
* **实现**：
  - 内部状态 `selectedId: string|null` 升级为 `selectedIds: Set<string>`，支持多节点选中
  - 新增 `boxSelect` state 在 mousemove 中实时更新矩形终点，mouseup 时计算交集
  - 框选矩形使用 `screenToWorld` 坐标转换，跟随缩放和平移
* **文件变更清单**：
  - `src/components/Canvas.tsx`：23 处引用升级为 Set<string>，新增 boxSelect/框选逻辑
  - `src/pages/HomePage.tsx`：新增 CheckBox/CheckAllBox 组件，批量操作栏，复选框列
  - `src/lib/api.ts`：新增 batchDeleteWorkflows 方法
  - `backend/app/api/workflows.py`：新增 POST /api/workflows/batch-delete 端点

### 1.8.3 验证与测试
* ✅ TypeScript 编译零错误（tsc --noEmit）
* ✅ Vite 生产构建通过（1592 modules / 246 kB gzip 74 kB）
* ✅ 点击节点 → 单选 + 可拖拽
* ✅ Shift+点击节点 → 多选切换
* ✅ Shift+画布拖动 → 框选矩形出现 + 松手后节点被选中
* ✅ 普通画布拖动 → 平移画布
* ✅ Delete 删除选中节点 + 级联清理连线
* ✅ 批量删除 API → 级联清理 runs/checkpoints/schedules
* ✅ 批量删除按钮 → loading 态防重复点击

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