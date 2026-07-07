# AWE PRD v3.0 差异分析 & 开发计划

> 对比基准：PRD v3.0（最终定稿版）  
> 当前代码：frontend v0.3.6 / backend v0.1.0  
> 分析日期：2026-07-07

---

## 一、总体评估

| 维度 | 完成度 | 说明 |
|------|--------|------|
| 后端核心引擎 | 🟢 85% | LangGraph 图编排、节点注册、拓扑校验、MCP Server 均已就绪 |
| 前端基础框架 | 🟢 70% | LeftNav、工作流列表、编辑器画布、节点面板、配置面板已完成 |
| 数据库与数据模型 | 🟡 60% | 基础 CRUD 就绪，缺 PRD 要求的扩展字段 |
| 安全与合规 | 🔴 20% | 沙盒用 AST 黑名单、API Key 明文、无 CDP 端口限制 |
| RPA 录制工具 | 🔴 0% | 完全未实现 |
| 工程化与发布 | 🟡 50% | 有 start.py/pywebview，缺 PyInstaller/备份/调度 |

**总计：已完成约 55%，剩余 17 个关键缺口。**

---

## 二、逐项差异清单

### P0 · 数据模型与基础交互（阻塞后续功能）

| # | PRD 要求 | 现状 | 影响 |
|---|----------|------|------|
| 1 | workflows 表需 `workspace_id`、`version`、`status` 字段（§1.2） | 当前只有 id/name/description/graph_json/时间 | 软删除、版本管理、多租户架构均无法实现 |
| 2 | 回收站机制：删除标记 `status=deleted`，回收站页面可还原/彻底删除（§4.1） | 当前 `DELETE` 是物理删除，无回收站页面 | 用户误删无法恢复 |
| 3 | 撤销/重做：图拓扑变化历史，上限 20 步，离开编辑器/发版后清空（§4.2） | 顶栏按钮存在，`onUndo/onRedo` 实现为 `setToast('待接入')` | 用户编辑无安全感 |
| 4 | 工作流列表双击名称进入编辑器（§4.1） | 当前单击即进入，无双击/单击区分 | 与 PRD 交互不符 |
| 5 | Ctrl/Shift 多选（§4.1） | 未实现 | 批量操作不可用 |

### P1 · 安全加固（PRD §8 明确强制要求）

| # | PRD 要求 | 现状 | 风险 |
|---|----------|------|------|
| 6 | Skill_Python 沙盒用 `sys.addaudithook` 从底层拦截（§8.1） | 当前用 AST 静态审计（`_DENY_NAMES` 黑名单） | 容易被嵌套调用绕过 |
| 7 | API Key 用 Fernet/AES 加密存 SQLite，主密钥独立存 `.env`（§8.4） | 当前 `openai_api_key` 直接从环境变量读取，存入 config 明文 | 密钥泄露风险 |
| 8 | CDP 端口强制 `--remote-debugging-address=127.0.0.1`（§8.3） | DrissionPage 尚未集成，无 CDP 启动逻辑 | 浏览器自动化完全缺失 |

### P2 · RPA 录制工具（PRD §4.6 核心差异功能）

| # | PRD 要求 | 现状 | 说明 |
|---|----------|------|------|
| 9 | 编辑器底部左工具栏新增"录制"入口 | 无 | 完整功能模块缺失 |
| 10 | 复用 Mode A 已建立的 CDP 会话录制浏览器操作 | DrissionPage 未集成 | 前置依赖未满足 |
| 11 | 多标签页处理：录制 `target="_blank"` 点击 | 无 | — |
| 12 | 敏感数据不脱敏，直接捕获真实值 | 无 | — |
| 13 | 生成的自动化代码作为 `Skill_Python` 节点插入画布 | 无 | — |

### P3 · 技术栈对齐（PRD §3 强制约束）

| # | PRD 要求 | 现状 | 差距 |
|---|----------|------|------|
| 14 | 前端画布引擎：字节跳动 `@flowgram.ai`（§3.1） | 自建 SVG + foreignObject 轻量画布 | 自建画布需完整替换，工作量最大 |
| 15 | 样式库：`shadcn/ui` **复制粘贴源码方式**（§3.1） | CSS 模拟 shadcn 风格，无源码依赖 | 需重新集成，但可渐进式 |
| 16 | CSS 框架：`TailwindCSS v4`（§3.1） | 当前 TailwindCSS v3 | 需升级 |
| 17 | 后端打包：`PyInstaller`（§3.2） | 未集成 | 需添加打包配置 |
| 18 | RPA 驱动：`pywinauto` + `PyAutoGUI`（§3.2） | 未引入 | 需添加依赖和节点实现 |
| 19 | 图编排引擎：`LangGraph` 确认使用正确（§3.2） | ✅ 已使用 `StateGraph` | 已验证通过 |

### P4 · 辅助功能与工程化

| # | PRD 要求 | 现状 | 说明 |
|---|----------|------|------|
| 20 | 设置页：LiteLLM API Key 录入表单（§4.5） | SettingsPage 仅显示版本/健康状态，无表单 | 需添加 |
| 21 | 设置页：CDP 端口显示（§4.5） | 无 | 需添加 |
| 22 | 执行历史页：点击单条侧边栏输出原生文本日志含 Traceback（§4.4） | HistoryPage 仅列表展示 id/status/时间 | 无详情展开 |
| 23 | 节点 Schema 自动升级：运行时 AI 动态升级 + 编辑期静默升级（§4.3） | 无 | 需新增引擎 |
| 24 | 启动自动备份：拷贝 data.db → `data_backup_YYYYMMDD.db`，保留最近 7 天（§9） | 无 | start.py 需增加备份逻辑 |
| 25 | Mode C：APScheduler 定时调度（§2） | schedules 表存在但无调度器 | 需集成 APScheduler |
| 26 | AI 编排自愈上限 3 次重试（§7） | 拓扑校验存在但无 AI 修复重试 | 需在编排引擎中增加重试循环 |
| 27 | 并发浏览器会话控制最大 5（§7） | 无 | 需在 DrissionPage 集成后添加信号量 |

---

## 三、开发计划（按阶段排期）

### 🔴 阶段一：数据与安全基础（预计：后端为主）

| 编号 | 任务 | 涉及文件 | 优先级 |
|------|------|----------|--------|
| D-1 | workflows 表增加 `workspace_id`、`version`、`status` 字段 | `backend/app/core/database.py` | 高 |
| D-2 | 回收站机制：删除变软删除，新增 `PUT /api/workflows/{wid}/restore`、`DELETE /api/workflows/{wid}/permanent` | `database.py` + `api/workflows.py` | 高 |
| D-3 | 前端回收站页面 + LeftNav 入口 | `pages/TrashPage.tsx` + `LeftNav.tsx` | 高 |
| D-4 | API Key 加密存储：Fernet 加密 + `.env` 主密钥 | `core/config.py` + 新增 `core/crypto.py` | 高 |
| D-5 | 设置页 API Key 录入表单 | `pages/SettingsPage.tsx` | 中 |
| D-6 | Skill_Python 沙盒升级为 `sys.addaudithook` | `engine/sandbox.py` | 高 |

### 🔴 阶段二：编辑器核心体验

| 编号 | 任务 | 涉及文件 | 优先级 |
|------|------|----------|--------|
| E-1 | 撤销/重做系统：Command 模式 + 20 步上限 + 生命周期管理 | `App.tsx` + 新增 `hooks/useUndoRedo.ts` | 高 |
| E-2 | 工作流列表：单击选中 / 双击进入编辑器 | `pages/HomePage.tsx` | 中 |
| E-3 | 工作流列表：Ctrl/Shift 多选 + 批量操作 | `pages/HomePage.tsx` | 中 |
| E-4 | 执行历史详情：点击展开侧边栏 → 原生日志/Traceback | `pages/HistoryPage.tsx` + `api.ts` | 中 |

### 🟡 阶段三：RPA 录制工具

| 编号 | 任务 | 涉及文件 | 优先级 |
|------|------|----------|--------|
| R-1 | 集成 DrissionPage + CDP 端口安全配置 | `engine/` 新增 `browser.py` | 高 |
| R-2 | 编辑器底部工具栏新增"录制"入口 | `components/BottomToolbar.tsx` | 中 |
| R-3 | 浏览器操作录制器：事件监听 → 操作序列 | 前端新增 `recorder/` 模块 | 中 |
| R-4 | 录制结果转 `Skill_Python` 代码 → 插入画布 | 后端新增 `engine/recorder_codegen.py` | 中 |

### 🟡 阶段四：技术栈升级（渐进式）

| 编号 | 任务 | 涉及文件 | 优先级 |
|------|------|----------|--------|
| T-1 | TailwindCSS v3 → v4 升级 | `package.json` + `tailwind.config.js` → CSS 配置 | 低 |
| T-2 | shadcn/ui 源码集成（替换 CSS 模拟） | 全局 `components/ui/` 目录 | 中 |
| T-3 | 画布引擎迁移到 `@flowgram.ai` | `Canvas.tsx` → 完全重写 | 低（破坏性大） |
| T-4 | PyInstaller 打包配置 | 新增 `build.spec` | 中 |

### 🟢 阶段五：工程化与收尾

| 编号 | 任务 | 涉及文件 | 优先级 |
|------|------|----------|--------|
| F-1 | start.py 增加自动备份（每日 + 保留 7 天） | `start.py` | 中 |
| F-2 | APScheduler 定时调度集成（Mode C） | `engine/` 新增 `scheduler.py` | 中 |
| F-3 | AI 编排自愈重试上限 3 次 | `engine/validator.py` + `builder.py` | 中 |
| F-4 | 并发浏览器会话控制（信号量 max 5） | `engine/browser.py` | 低 |
| F-5 | 节点 Schema 自动升级机制 | `nodes/registry.py` + 新增 `engine/schema_migrator.py` | 低 |
| F-6 | pywinauto + PyAutoGUI 集成 + 桌面节点 | 新增节点类型 + `requirements.txt` | 低 |

---

## 四、重点风险项

| 风险 | 说明 |
|------|------|
| **画布引擎替换** | `@flowgram.ai` 替换自建画布是破坏性变更，影响节点渲染、连线、拖拽、缩放全部逻辑，建议最后处理或评估是否真有必要（当前自建画布功能已基本完备） |
| **RPA 录制** | 涉及 CDP 协议深度交互，技术复杂度高，需先完成 DrissionPage 集成验证 |
| **沙盒升级** | `sys.addaudithook` 是 Python 3.8+ 特性，需全面审计当前 `exec()` 作用域处理，避免与 RestrictedPython 冲突 |

---

## 五、建议推进顺序

```
阶段一（1-2周）         阶段二（1周）          阶段三（1-2周）
 D-1 D-2 D-4 D-6     E-1 E-2 E-3 E-4 D-5    R-1 R-2 R-3 R-4
    [数据+安全]          [编辑器体验]            [RPA录制]
       ↓                    ↓                      ↓
阶段四（渐进式）        阶段五（收尾）
 T-1 T-2 T-3 T-4      F-1 F-2 F-3 F-4 F-5 F-6
  [技术栈升级]           [工程化]
```

**底线交付（v3.0 最小可发版）**：阶段一 + 阶段二全部完成。
**完整版（v3.0 full）**：全部五阶段完成。
