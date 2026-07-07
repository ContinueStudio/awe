"""12 大原子节点定义 + 注册表。

每个节点定义包括：id、name、category、description、inputs、outputs
供前端画布渲染、AI 编排注入、LangGraph 编译期校验。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

NodeCategory = Literal["trigger", "ai", "knowledge", "external", "human", "logic"]


@dataclass
class PortSpec:
    """节点端口定义。"""

    name: str
    type: Literal["string", "number", "boolean", "object", "array", "any"]
    description: str = ""
    required: bool = False


@dataclass
class NodeDefinition:
    """节点 JSON Schema 描述。

    直接喂给前端画布与 LLM System Prompt。
    """

    type: str
    name: str
    category: NodeCategory
    description: str
    icon: str = "Box"
    color: str = "slate"
    inputs: List[PortSpec] = field(default_factory=list)
    outputs: List[PortSpec] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "inputs": [
                {"name": p.name, "type": p.type, "description": p.description, "required": p.required}
                for p in self.inputs
            ],
            "outputs": [
                {"name": p.name, "type": p.type, "description": p.description, "required": p.required}
                for p in self.outputs
            ],
            "config_schema": self.config_schema,
        }


# ---------------- 12 节点定义 ----------------

NODES: List[NodeDefinition] = [
    # 6.1 触发与边界
    NodeDefinition(
        type="start",
        name="开始",
        category="trigger",
        description="工作流的起点，所有可执行节点必须位于开始节点的下游。",
        icon="Play",
        color="emerald",
        outputs=[PortSpec("input", "any", "传递给下游的输入数据")],
        config_schema={
            "type": "object",
            "properties": {
                "description": {"type": "string", "title": "介绍", "format": "textarea", "default": ""},
            },
        },
    ),
    NodeDefinition(
        type="webhook",
        name="Webhook 触发器",
        category="trigger",
        description="暴露动态 HTTP 接口接收外部唤醒信号，作为工作流的起点。",
        icon="Webhook",
        color="emerald",
        outputs=[PortSpec("body", "object", "POST 请求体")],
        config_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "title": "路径", "default": "/webhook"},
                "method": {"type": "string", "enum": ["POST", "GET"], "default": "POST"},
            },
        },
    ),
    NodeDefinition(
        type="end",
        name="终点与响应",
        category="trigger",
        description="将工作流最终结果打包，作为执行终点的响应输出。",
        icon="Flag",
        color="emerald",
        inputs=[PortSpec("payload", "any", "要返回的内容")],
    ),
    # 定时触发器
    NodeDefinition(
        type="cron_trigger",
        name="定时触发器",
        category="trigger",
        description="按照 Cron 表达式定时执行下游工作流。支持秒级精度，可设置时区。",
        icon="Clock",
        color="amber",
        outputs=[PortSpec("trigger_time", "string", "本次触发的 ISO 时间戳")],
        config_schema={
            "type": "object",
            "properties": {
                "cron": {"type": "string", "title": "Cron 表达式", "default": "0 0 * * *", "description": "秒 分 时 日 月 周（6位），例如: 0 0 9 * * 1-5 每天早上9点"},
                "timezone": {"type": "string", "title": "时区", "default": "Asia/Shanghai"},
                "enabled": {"type": "boolean", "title": "是否启用", "default": True},
            },
        },
    ),
    # 6.2 AI 节点
    NodeDefinition(
        type="llm",
        name="LLM 推断",
        category="ai",
        description="通过 LiteLLM 调用任意大模型执行对话/逻辑推断，支持流式与函数调用。",
        icon="Brain",
        color="violet",
        inputs=[PortSpec("prompt", "string", "提示词")],
        outputs=[PortSpec("text", "string", "模型回复文本")],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "title": "模型", "default": "gpt-4o-mini"},
                "system": {"type": "string", "title": "系统提示", "format": "textarea"},
                "temperature": {"type": "number", "title": "温度", "default": 0.7, "minimum": 0, "maximum": 2},
            },
        },
    ),
    NodeDefinition(
        type="intent",
        name="意图分类",
        category="ai",
        description="基于 LLM 把输入文本路由到多个分支（多路条件出口）。",
        icon="GitBranch",
        color="violet",
        inputs=[PortSpec("text", "string", "待分类文本")],
        outputs=[PortSpec("label", "string", "分类标签")],
        config_schema={
            "type": "object",
            "properties": {
                "labels": {"type": "array", "title": "候选标签", "items": {"type": "string"}},
                "model": {"type": "string", "default": "gpt-4o-mini"},
            },
        },
    ),
    NodeDefinition(
        type="extract",
        name="参数提取",
        category="ai",
        description="强制 LLM 输出严格 JSON Schema，为下游提供结构化入参。",
        icon="Braces",
        color="violet",
        inputs=[PortSpec("text", "string", "原始文本")],
        outputs=[PortSpec("data", "object", "提取后的结构化数据")],
        config_schema={
            "type": "object",
            "properties": {
                "schema": {"type": "object", "title": "JSON Schema"},
                "model": {"type": "string", "default": "gpt-4o-mini"},
            },
        },
    ),
    NodeDefinition(
        type="rewrite",
        name="查询重写",
        category="ai",
        description="把用户问题改写为更适合向量检索的查询，提升知识库召回率。",
        icon="Wand2",
        color="violet",
        inputs=[PortSpec("query", "string", "原始查询")],
        outputs=[PortSpec("query", "string", "改写后的查询")],
        config_schema={
            "type": "object",
            "properties": {
                "model": {"type": "string", "default": "gpt-4o-mini"},
                "n": {"type": "integer", "title": "生成条数", "default": 3, "minimum": 1, "maximum": 5},
            },
        },
    ),
    # 6.3 知识与持久化
    NodeDefinition(
        type="knowledge",
        name="本地知识库读写",
        category="knowledge",
        description="基于 ChromaDB 写入或检索切块化的本地向量知识库。",
        icon="Database",
        color="amber",
        inputs=[PortSpec("text", "string", "查询/写入文本")],
        outputs=[PortSpec("docs", "array", "命中的文档列表")],
        config_schema={
            "type": "object",
            "properties": {
                "storage_path": {"type": "string", "title": "存储路径（ChromaDB 目录）", "default": "./data/chroma"},
                "operation": {"type": "string", "enum": ["upsert", "query"], "default": "query"},
                "collection": {"type": "string", "default": "default"},
                "top_k": {"type": "integer", "default": 4, "minimum": 1, "maximum": 50},
            },
        },
    ),
    NodeDefinition(
        type="sqlite",
        name="结构化表格读写",
        category="knowledge",
        description="对 SQLite 表进行可视化的增删改查（CRUD）。",
        icon="Table2",
        color="amber",
        outputs=[PortSpec("rows", "array", "查询结果行")],
        config_schema={
            "type": "object",
            "properties": {
                "db_path": {"type": "string", "title": "数据库路径", "default": "./data/awe.db"},
                "operation": {"type": "string", "enum": ["select", "insert", "update", "delete"]},
                "table": {"type": "string"},
                "where": {"type": "string", "title": "WHERE 子句 (raw SQL)"},
                "data": {"type": "object", "title": "写入数据 (insert/update)"},
            },
        },
    ),
    # Excel 节点
    NodeDefinition(
        type="excel_save_records",
        name="Excel-保存记录",
        category="knowledge",
        description="将上游记录数组写入新的 Excel 文件，自动提取字段名作为表头，每条记录为一行数据。",
        icon="FileSpreadsheet",
        color="amber",
        inputs=[PortSpec("data", "array", "记录数组")],
        outputs=[PortSpec("file", "string", "保存的文件路径"), PortSpec("rows", "number", "写入行数")],
        config_schema={
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "title": "文件路径（含文件名）", "default": "./data/output.xlsx"},
                "sheet_name": {"type": "string", "title": "工作表名", "default": "Sheet1"},
            },
            "required": ["file_path"],
        },
    ),
    # SQLite
    NodeDefinition(
        type="sqlite",
        name="结构化表格读写",
        category="knowledge",
        description="对 SQLite 表进行可视化的增删改查（CRUD）。",
        icon="Table2",
        color="amber",
        outputs=[PortSpec("rows", "array", "查询结果行")],
        config_schema={
            "type": "object",
            "properties": {
                "db_path": {"type": "string", "title": "数据库路径", "default": "./data/awe.db"},
                "operation": {"type": "string", "enum": ["select", "insert", "update", "delete"]},
                "table": {"type": "string"},
                "where": {"type": "string", "title": "WHERE 子句 (raw SQL)"},
                "data": {"type": "object", "title": "写入数据 (insert/update)"},
            },
        },
    ),
    # 6.4 外部生态与控制
    NodeDefinition(
        type="http",
        name="通用 HTTP 请求",
        category="external",
        description="万能 HTTP/HTTPS 请求器，支持 RESTful 与 SSE。",
        icon="Globe",
        color="sky",
        outputs=[PortSpec("response", "object", "响应数据")],
        config_schema={
            "type": "object",
            "properties": {
                "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"], "default": "GET"},
                "url": {"type": "string", "title": "URL"},
                "headers": {"type": "object", "title": "Headers"},
                "body": {"type": "object", "title": "Body"},
            },
            "required": ["url"],
        },
    ),
    NodeDefinition(
        type="mcp",
        name="MCP Client 桥接",
        category="external",
        description="挂载外部第三方 MCP Server，把 MCP 工具动态注册为节点。",
        icon="PlugZap",
        color="sky",
        outputs=[PortSpec("result", "any", "MCP 工具返回值")],
        config_schema={
            "type": "object",
            "properties": {
                "server": {"type": "string", "title": "MCP Server 名"},
                "tool": {"type": "string", "title": "工具名"},
                "args": {"type": "object", "title": "参数"},
            },
            "required": ["server", "tool"],
        },
    ),
    NodeDefinition(
        type="skill",
        name="Skill 脚本沙盒",
        category="external",
        description="受限 Python 沙盒执行用户脚本，可写 DrissionPage / pywinauto。具备超时阻断与自愈提示。",
        icon="Code2",
        color="sky",
        outputs=[PortSpec("result", "any", "脚本 return 内容")],
        inputs=[PortSpec("data", "any", "上游节点传入的数据（自动合并）")],
        config_schema={
            "type": "object",
            "properties": {
                "code": {"type": "string", "title": "Python 代码", "format": "textarea"},
                "working_dir": {"type": "string", "title": "工作目录（文件读写路径）", "default": "./data/skills"},
                "timeout_sec": {"type": "integer", "default": 30, "minimum": 1, "maximum": 120},
            },
            "required": ["code"],
        },
    ),
    # 6.5 人类管理
    NodeDefinition(
        type="human",
        name="人工审批 / 断点挂起",
        category="human",
        description="拦截执行流并挂起，等待人类在 UI 中确认或编辑后再继续。",
        icon="UserCheck",
        color="rose",
        inputs=[PortSpec("context", "object", "提交给人类审查的内容")],
        outputs=[PortSpec("decision", "any", "人类最终决策")],
        config_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "title": "审批标题"},
                "require_text": {"type": "boolean", "title": "需要文本输入", "default": False},
            },
        },
    ),
    # 6.5.5 逻辑与控制流
    NodeDefinition(
        type="branch",
        name="判断器",
        category="logic",
        description="根据条件表达式进行 True/False 分支判断，将数据路由到不同的下游节点。",
        icon="GitBranch",
        color="orange",
        inputs=[PortSpec("data", "any", "待判断的数据")],
        outputs=[PortSpec("result", "any", "判断通过的数据"), PortSpec("rejected", "any", "未通过的数据")],
        config_schema={
            "type": "object",
            "properties": {
                "condition": {"type": "string", "title": "条件表达式（Python eval）", "default": "True",
                              "description": "示例: data.get('score', 0) > 60"},
                "true_label": {"type": "string", "title": "True 分支名", "default": "通过"},
                "false_label": {"type": "string", "title": "False 分支名", "default": "未通过"},
            },
            "required": ["condition"],
        },
    ),
    NodeDefinition(
        type="loop_count",
        name="次数循环",
        category="logic",
        description="将上游数据重复执行指定次数，每次迭代将当前索引和累计结果传递给下游。",
        icon="Repeat",
        color="orange",
        inputs=[PortSpec("data", "any", "循环处理的初始数据")],
        outputs=[PortSpec("items", "array", "每次迭代的输出结果列表"), PortSpec("count", "number", "实际迭代次数")],
        config_schema={
            "type": "object",
            "properties": {
                "count": {"type": "integer", "title": "循环次数", "default": 3, "minimum": 1, "maximum": 10000},
                "index_var": {"type": "string", "title": "索引变量名", "default": "index"},
            },
            "required": ["count"],
        },
    ),
    NodeDefinition(
        type="loop_list",
        name="列表循环",
        category="logic",
        description="遍历列表中的每个元素，将当前元素和索引传递给下游节点逐条处理。",
        icon="List",
        color="orange",
        inputs=[PortSpec("data", "any", "包含列表数据的上游输出")],
        outputs=[PortSpec("item", "object", "当前迭代的元素"), PortSpec("index", "number", "当前索引"),
                 PortSpec("total", "number", "列表总长度")],
        config_schema={
            "type": "object",
            "properties": {
                "list_path": {"type": "string", "title": "列表字段路径", "default": "data",
                              "description": "从上游输出中提取列表的字段路径，如 data.records"},
                "item_var": {"type": "string", "title": "元素变量名", "default": "item"},
            },
        },
    ),
    NodeDefinition(
        type="loop_dict",
        name="字典循环",
        category="logic",
        description="遍历字典的所有键值对，每次迭代输出当前 key、value 和索引。",
        icon="FileJson",
        color="orange",
        inputs=[PortSpec("data", "any", "包含字典数据的上游输出")],
        outputs=[PortSpec("key", "string", "当前键"), PortSpec("value", "any", "当前值"),
                 PortSpec("index", "number", "当前索引"), PortSpec("total", "number", "字典总条目数")],
        config_schema={
            "type": "object",
            "properties": {
                "dict_path": {"type": "string", "title": "字典字段路径", "default": "data",
                              "description": "从上游输出中提取字典的字段路径"},
                "key_var": {"type": "string", "title": "键变量名", "default": "key"},
                "value_var": {"type": "string", "title": "值变量名", "default": "value"},
            },
        },
    ),
    NodeDefinition(
        type="loop_condition",
        name="条件循环",
        category="logic",
        description="当条件表达式为 True 时持续执行循环体，每次迭代将当前状态传递给下游，直到条件为 False 或达到最大迭代次数。",
        icon="Infinity",
        color="orange",
        inputs=[PortSpec("data", "any", "循环处理的初始数据")],
        outputs=[PortSpec("items", "array", "每次迭代的输出结果列表"), PortSpec("count", "number", "实际迭代次数")],
        config_schema={
            "type": "object",
            "properties": {
                "condition": {"type": "string", "title": "条件表达式（Python eval）", "default": "True",
                              "description": "示例: state.get('counter', 0) < 10"},
                "max_iterations": {"type": "integer", "title": "最大迭代次数", "default": 100, "minimum": 1, "maximum": 10000},
            },
            "required": ["condition"],
        },
    ),
    NodeDefinition(
        type="parallel",
        name="并行执行",
        category="logic",
        description="同时执行多个下游分支，所有分支完成后合并结果。适用于多个独立任务的并发处理。",
        icon="SplitSquareVertical",
        color="orange",
        inputs=[PortSpec("data", "any", "传递给各分支的数据")],
        outputs=[PortSpec("results", "array", "各分支执行结果列表"), PortSpec("count", "number", "分支数量")],
        config_schema={
            "type": "object",
            "properties": {
                "branch_count": {"type": "integer", "title": "并行分支数", "default": 2, "minimum": 2, "maximum": 20},
                "merge_strategy": {"type": "string", "title": "合并策略", "enum": ["concat", "first", "dict"],
                                   "default": "concat", "description": "concat=列表合并, first=取第一个, dict=按分支名合并"},
            },
        },
    ),
    NodeDefinition(
        type="async_exec",
        name="异步执行",
        category="logic",
        description="异步执行下游节点，不阻塞主流程继续执行。适用于非关键路径的后台任务。",
        icon="Timer",
        color="orange",
        inputs=[PortSpec("data", "any", "传递给异步任务的数据")],
        outputs=[PortSpec("task_id", "string", "异步任务 ID"), PortSpec("result", "any", "异步任务返回结果")],
        config_schema={
            "type": "object",
            "properties": {
                "timeout_sec": {"type": "integer", "title": "超时时间（秒）", "default": 60, "minimum": 1, "maximum": 3600},
                "fire_and_forget": {"type": "boolean", "title": "不等待结果（即发即忘）", "default": False},
            },
        },
    ),
    # 6.6 飞书多维表格
    NodeDefinition(
        type="feishu_bitable_create",
        name="飞书-创建多维表格",
        category="external",
        description="调用飞书 Open API 创建一个新的多维表格（包含一个空白数据表），并返回 app_token / table_id / url。",
        icon="FileSpreadsheet",
        color="blue",
        outputs=[PortSpec("app_token", "string", "多维表格 app_token"), PortSpec("table_id", "string", "默认数据表 id"), PortSpec("url", "string", "多维表格链接")],
        config_schema={
            "type": "object",
            "properties": {
                "app_id": {"type": "string", "title": "飞书 App ID"},
                "app_secret": {"type": "string", "title": "飞书 App Secret", "format": "password"},
                "name": {"type": "string", "title": "多维表格名称", "default": "AWE 工作流"},
                "folder_token": {"type": "string", "title": "文件夹 token（可选）"},
            },
            "required": ["app_id", "app_secret", "name"],
        },
    ),
    NodeDefinition(
        type="feishu_bitable_field",
        name="飞书-新增字段",
        category="external",
        description="在指定飞书多维表格的数据表中新增一个或多个字段。支持文本(1)、数字(2)、单选(3)、多选(4)、日期(5)等字段类型。",
        icon="Columns",
        color="blue",
        inputs=[PortSpec("app_token", "string", "多维表格 app_token"), PortSpec("table_id", "string", "数据表 id")],
        outputs=[PortSpec("fields", "array", "创建成功的字段列表")],
        config_schema={
            "type": "object",
            "properties": {
                "app_id": {"type": "string", "title": "飞书 App ID"},
                "app_secret": {"type": "string", "title": "飞书 App Secret", "format": "password"},
                "app_token": {"type": "string", "title": "app_token（可用模板引用上游输出）"},
                "table_id": {"type": "string", "title": "table_id（可用模板引用上游输出）"},
                "fields": {
                    "type": "array",
                    "title": "字段列表",
                    "items": {
                        "type": "object",
                        "properties": {
                            "field_name": {"type": "string", "title": "字段名"},
                            "type": {"type": "integer", "title": "字段类型", "default": 1, "enum": [1, 2, 3, 4, 5], "enumNames": ["文本(1)", "数字(2)", "单选(3)", "多选(4)", "日期(5)"]},
                        },
                        "required": ["field_name"],
                    },
                },
            },
            "required": ["app_id", "app_secret", "fields"],
        },
    ),
    NodeDefinition(
        type="feishu_bitable_record",
        name="飞书-新增记录",
        category="external",
        description="在指定飞书多维表格的数据表中新增一条记录，写入指定字段的值。",
        icon="FilePlus",
        color="blue",
        inputs=[PortSpec("app_token", "string", "多维表格 app_token"), PortSpec("table_id", "string", "数据表 id")],
        outputs=[PortSpec("record", "object", "创建成功的记录信息")],
        config_schema={
            "type": "object",
            "properties": {
                "app_id": {"type": "string", "title": "飞书 App ID"},
                "app_secret": {"type": "string", "title": "飞书 App Secret", "format": "password"},
                "app_token": {"type": "string", "title": "app_token（可用模板引用上游输出）"},
                "table_id": {"type": "string", "title": "table_id（可用模板引用上游输出）"},
                "fields": {
                    "type": "object",
                    "title": "字段值（key=字段名, value=值）",
                    "description": "示例: {\"任务名称\": \"test\", \"状态\": \"进行中\"}",
                },
            },
            "required": ["app_id", "app_secret", "fields"],
        },
    ),
    NodeDefinition(
        type="feishu_bitable_list_records",
        name="飞书-读取所有记录",
        category="external",
        description="读取指定飞书多维表格数据表中的所有记录（自动分页），返回 records 数组。可用 skill 节点配合循环处理每条数据。",
        icon="List",
        color="blue",
        inputs=[PortSpec("app_token", "string", "多维表格 app_token"), PortSpec("table_id", "string", "数据表 id")],
        outputs=[PortSpec("records", "array", "所有记录（每条含 record_id + fields）"), PortSpec("total", "number", "记录总数")],
        config_schema={
            "type": "object",
            "properties": {
                "app_id": {"type": "string", "title": "飞书 App ID"},
                "app_secret": {"type": "string", "title": "飞书 App Secret", "format": "password"},
                "app_token": {"type": "string", "title": "app_token（可用模板引用上游输出）"},
                "table_id": {"type": "string", "title": "table_id（可用模板引用上游输出）"},
            },
            "required": ["app_id", "app_secret"],
        },
    ),
]


class NodeRegistry:
    """节点注册表（单例）。"""

    def __init__(self) -> None:
        self._by_type: Dict[str, NodeDefinition] = {n.type: n for n in NODES}

    def all(self) -> List[NodeDefinition]:
        return list(NODES)

    def by_category(self, category: NodeCategory) -> List[NodeDefinition]:
        return [n for n in NODES if n.category == category]

    def get(self, type_name: str) -> Optional[NodeDefinition]:
        return self._by_type.get(type_name)

    def to_prompt(self) -> str:
        """生成供 LLM 使用的紧凑节点字典。"""
        lines: List[str] = []
        for n in NODES:
            ins = ", ".join(f"{p.name}:{p.type}" for p in n.inputs) or "-"
            outs = ", ".join(f"{p.name}:{p.type}" for p in n.outputs) or "-"
            lines.append(f"- `{n.type}` ({n.name}) | in:[{ins}] -> out:[{outs}] | {n.description}")
        return "\n".join(lines)

    def validate_config(self, type_name: str, config: Dict[str, Any]) -> List[str]:
        """轻量配置校验：仅检查 required 字段。

        返回错误列表，空表示 OK。
        """
        node = self.get(type_name)
        if not node:
            return [f"未知节点类型: {type_name}"]
        schema = node.config_schema or {}
        required = schema.get("required", [])
        return [f"缺少必填字段: {k}" for k in required if k not in config]


registry = NodeRegistry()
