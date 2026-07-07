/**
 * 单节点渲染（PRD v2.14 - 2026-07-05）
 *
 * 节点主视图（v0.3.0 风格回退）：
 * - 类型色块 + 名字 + config 预览（内嵌）
 * - 用户不需要开 Drawer 也能看到 code/path/message 等关键配置
 *
 * 视觉规范（PRD §9.2 严格遵循）：
 * - 白底 + 细边 + rounded-lg + 节点类型色条
 * - 选中态：黑边 + 黑阴影
 */
import { useEffect, useRef } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasNode, NodeDefinition } from '@/lib/types';

// 节点类型 → 颜色（现代轻盈配色，-500 色阶）
const COLOR_BAR: Record<string, string> = {
  emerald: '#10b981', // emerald-500
  blue:    '#3b82f6', // blue-500
  amber:   '#f59e0b', // amber-500
  sky:     '#0ea5e9', // sky-500
  rose:    '#f43f5e', // rose-500
  slate:   '#475569', // slate-600
  violet:  '#8b5cf6', // violet-500
  orange:  '#f97316', // orange-500
};

interface Props {
  node: CanvasNode;
  def: NodeDefinition;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onStartEdge?: (e: React.MouseEvent) => void;
  onCompleteEdge?: (e: React.MouseEvent) => void;
  onMeasured?: (h: number) => void;
  error?: boolean;
}

export function NodeRender({ node, def, selected, onPointerDown, onDuplicate, onDelete, onStartEdge, onCompleteEdge, onMeasured, error }: Props) {
  const color = COLOR_BAR[def.color] || COLOR_BAR.slate;
  const cfg = (node.config || {}) as Record<string, any>;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || !onMeasured) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const h = e.contentRect.height;
        if (h > 0) onMeasured(h);
      }
    });
    ro.observe(el);
    const h0 = el.getBoundingClientRect().height;
    if (h0 > 0) onMeasured(h0);
    return () => ro.disconnect();
  }, [onMeasured, node.id]);

  return (
    <div
      ref={ref}
      className={cn('node-card', selected && 'is-selected')}
      style={
        {
          width: '100%',
          padding: '12px 14px',
          cursor: 'pointer',
          minHeight: 64,
          boxSizing: 'border-box',
          // v0.3.10 修复：把顶部类型色通过 CSS 变量 --node-color 注入，
          // .node-card 用 border-top 渲染类型色，背景实底白避免重叠穿透。
          '--node-color': color,
          // v0.3.x: 运行出错的节点高亮红色
          ...(error ? {
            boxShadow: '0 0 0 2px #ef4444, 0 4px 12px rgba(239, 68, 68, 0.2)',
            borderColor: '#ef4444',
          } : {}),
        } as React.CSSProperties
      }
      data-node-id={node.id}
      data-testid="node-render"
      onPointerDown={onPointerDown}
    >
      {/* header */}
      <div className="flex items-center" style={{ marginBottom: 8 }}>
        <div
          style={{
            width: 26, height: 26, background: color, borderRadius: 6,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            marginRight: 10, flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
            {(def.name || node.type).charAt(0)}
          </span>
        </div>
        <span
          style={{
            fontSize: 14, fontWeight: 600, color: '#020617',
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {def.name}
        </span>
        {selected && (
          <div className="flex items-center gap-1 ml-2">
            <button
              title="复制"
              onPointerDown={(e) => { e.stopPropagation(); onDuplicate?.(); }}
              className="awe-icon-btn"
              style={{ width: 24, height: 24 }}
            >
              <Copy size={12} />
            </button>
            <button
              title="删除"
              onPointerDown={(e) => { e.stopPropagation(); onDelete?.(); }}
              className="awe-icon-btn"
              style={{ width: 24, height: 24, color: '#dc2626', borderColor: '#fecaca' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <NodePreview kind={node.type} config={cfg} defName={def.name} />

      {(def.inputs.length > 0 || def.outputs.length > 0) && (
        <div className="flex items-center justify-between text-[10.5px] mt-2 pt-2" style={{ borderTop: '1px solid #f1f5f9', color: '#64748b' }}>
          <span>{def.inputs.length > 0 ? `${def.inputs.length} 输入` : ''}</span>
          <span>{def.outputs.length > 0 ? `${def.outputs.length} 输出` : ''}</span>
        </div>
      )}
    </div>
  );
}

function NodePreview({ kind, config, defName }: { kind: string; config: Record<string, any>; defName: string }) {
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#64748b', marginBottom: 2, fontWeight: 500 };
  const valueStyle: React.CSSProperties = { fontSize: 12, color: '#020617', fontFamily: "'JetBrains Mono', 'SF Mono', monospace" };

  switch (kind) {
    case 'webhook':
      return (
        <div>
          <div style={labelStyle}>路径</div>
          <code className="awe-badge awe-badge-success" style={{ fontSize: 11 }}>
            {(config.method as string) || 'POST'} {(config.path as string) || '/webhook'}
          </code>
        </div>
      );
    case 'cron_trigger':
      return (
        <div>
          <div style={labelStyle}>Cron 表达式</div>
          <code className="awe-badge awe-badge-success" style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            {(config.cron as string) || '0 0 * * *'}
          </code>
          <div style={{ ...labelStyle, marginTop: 6 }}>时区</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {(config.timezone as string) || 'Asia/Shanghai'}
            {(config.enabled !== false) ? <span className="awe-badge awe-badge-success" style={{ marginLeft: 6, fontSize: 10 }}>已启用</span> : <span className="awe-badge awe-badge-muted" style={{ marginLeft: 6, fontSize: 10 }}>已禁用</span>}
          </div>
        </div>
      );
    case 'http_request':
      return (
        <div>
          <span className="awe-badge" style={{ fontSize: 11, marginBottom: 4 }}>{(config.method as string) || 'GET'}</span>
          <div style={{ ...labelStyle, marginTop: 6 }}>URL</div>
          <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(config.url as string) || '(未设置)'}
          </div>
        </div>
      );
    case 'skill':
      return (
        <div>
          <div style={labelStyle}>Python 脚本</div>
          <div className="awe-code" style={{ padding: '6px 8px', borderRadius: 6, maxHeight: 48, overflow: 'hidden', fontSize: 11, lineHeight: 1.4 }}>
            {config.code ? (config.code as string).split('\n').slice(0, 3).join('\n') : '(空)'}
          </div>
        </div>
      );
    case 'llm':
      return (
        <div>
          <span className="awe-badge" style={{ fontSize: 11, marginRight: 6 }}>{(config.model as string) || 'gpt-4o-mini'}</span>
          <div style={labelStyle}>提示词</div>
          <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(config.prompt as string) || '(空)'}
          </div>
        </div>
      );
    case 'intent':
    case 'intent_router':
      return (
        <div>
          <div style={labelStyle}>意图分类</div>
          <span className="awe-badge" style={{ fontSize: 11 }}>
            {(config.labels as string[])?.length || 0} 个标签
          </span>
        </div>
      );
    case 'loop':
      return (
        <div>
          <div style={labelStyle}>数据源</div>
          <code className="awe-badge" style={{ fontSize: 11 }}>
            {(config.items_expr as string) || '[]'}
          </code>
        </div>
      );
    case 'sql_query':
      return (
        <div>
          <div style={labelStyle}>SQL</div>
          <div className="awe-code" style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(config.sql as string) || '(空)'}
          </div>
        </div>
      );
    case 'mcp_client':
      return (
        <div>
          <div style={labelStyle}>MCP 服务</div>
          <span style={valueStyle}>{(config.server as string) || '(未设置)'}</span>
        </div>
      );
    case 'human_review':
      return (
        <div>
          <div style={labelStyle}>审批人</div>
          <span style={valueStyle}>{(config.assignee as string) || '(未指定)'}</span>
        </div>
      );
    case 'knowledge_search':
      return (
        <div>
          <div style={labelStyle}>知识库</div>
          <span style={valueStyle}>{(config.kb_id as string) || '(未指定)'}</span>
        </div>
      );
    case 'end':
      return (
        <div>
          <div style={labelStyle}>结束消息</div>
          <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(config.message as string) || '(空)'}
          </div>
        </div>
      );
    case 'rewrite':
      return (
        <div>
          <div style={labelStyle}>改写风格</div>
          <span style={valueStyle}>{(config.style as string) || 'concise'}</span>
        </div>
      );
    // 6.5.5 逻辑与控制流
    case 'branch':
      return (
        <div>
          <div style={labelStyle}>条件表达式</div>
          <code className="awe-badge" style={{ fontSize: 11 }}>
            {(config.condition as string) || 'True'}
          </code>
          <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
            <span className="awe-badge awe-badge-success" style={{ fontSize: 10 }}>✓ {(config.true_label as string) || '通过'}</span>
            <span className="awe-badge awe-badge-failed" style={{ fontSize: 10 }}>✗ {(config.false_label as string) || '未通过'}</span>
          </div>
        </div>
      );
    case 'loop_count':
      return (
        <div>
          <div style={labelStyle}>次数循环</div>
          <code className="awe-badge" style={{ fontSize: 11 }}>
            执行 {(config.count as number) || 3} 次
          </code>
        </div>
      );
    case 'loop_list':
      return (
        <div>
          <div style={labelStyle}>列表循环</div>
          <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(config.list_path as string) || 'data'}
          </div>
        </div>
      );
    case 'loop_dict':
      return (
        <div>
          <div style={labelStyle}>字典循环</div>
          <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(config.dict_path as string) || 'data'}
          </div>
        </div>
      );
    case 'loop_condition':
      return (
        <div>
          <div style={labelStyle}>条件循环</div>
          <code className="awe-badge" style={{ fontSize: 11 }}>
            {(config.condition as string) || 'True'}
          </code>
          <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>
            最大 {(config.max_iterations as number) || 100} 次
          </span>
        </div>
      );
    case 'parallel':
      return (
        <div>
          <div style={labelStyle}>并行执行</div>
          <span className="awe-badge" style={{ fontSize: 11 }}>
            {(config.branch_count as number) || 2} 分支 · {(config.merge_strategy as string) || 'concat'}
          </span>
        </div>
      );
    case 'async_exec':
      return (
        <div>
          <div style={labelStyle}>异步执行</div>
          <span className="awe-badge" style={{ fontSize: 11 }}>
            {(config.fire_and_forget as boolean) ? '即发即忘' : `超时 ${(config.timeout_sec as number) || 60}s`}
          </span>
        </div>
      );
    default:
      return (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {(config.description as string) || '点击右侧面板配置'}
        </div>
      );
  }
}
