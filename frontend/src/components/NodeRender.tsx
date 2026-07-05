/**
 * 单节点渲染（shadcn 白底黑字 + 节点类型色条 PRD v2.11+）
 * - 白底 + 细边 + rounded-lg
 * - 28x28 类型色块（slate-900 兜底）+ 首字母字符
 * - 选中态：黑边 + 黑阴影
 * - 按节点类型显示 config 预览
 */
import { useEffect, useRef } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasNode, NodeDefinition } from '@/lib/types';

// 节点类型 → 颜色（保持 6 类行业色，但 slimmer 一些，整体去紫去渐变）
const COLOR_BAR: Record<string, string> = {
  emerald: '#16a34a', // green-600
  blue:    '#2563eb', // blue-600
  amber:   '#d97706', // amber-600
  sky:     '#0284c7', // sky-600
  rose:    '#dc2626', // red-600
  slate:   '#0f172a', // slate-900
  violet:  '#7c3aed', // 保留（但不使用 gradient）
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
}

export function NodeRender({ node, def, selected, onPointerDown, onDuplicate, onDelete, onStartEdge, onCompleteEdge, onMeasured }: Props) {
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
      style={{ width: '100%', padding: '12px 14px', cursor: 'pointer', minHeight: 64, boxSizing: 'border-box' }}
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
    case 'intent_router':
    case 'branch':
      return (
        <div>
          <div style={labelStyle}>条件</div>
          <code className="awe-badge" style={{ fontSize: 11 }}>
            {(config.expression as string) || 'True'}
          </code>
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
    default:
      return (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {(config.description as string) || '点击右侧面板配置'}
        </div>
      );
  }
}
