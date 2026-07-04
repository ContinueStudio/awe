/**
 * 单节点渲染（lawe 风格）
 * - 340px 宽、minHeight 72、渐变背景、圆角 12
 * - icon 28x28 圆角 8、首字母字符（与 lawe 一致）
 * - title 15px bold
 * - 按节点类型显示 config 预览（python/http/llm/skill/...）
 * - 选中态：蓝色边框 + 蓝色阴影 + 顶部出现「复制/删除」按钮
 */
import { useEffect, useRef } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasNode, NodeDefinition } from '@/lib/types';

// 节点类型 → 颜色块（与 lawe 风格保持一致：emerald=绿、violet=紫、amber=橙、sky=蓝、rose=红、slate=主色）
const COLOR_BAR: Record<string, string> = {
  emerald: '#00B42A',
  violet: '#7C3AED',
  amber: '#FF7D00',
  sky: '#0EA5E9',
  rose: '#F53F3F',
  slate: '#4D53E8',
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

  // ResizeObserver：测真实高度并通知父组件（用于端口定位）
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
    // 立即测一次（首次渲染可能还没触发 observer）
    const h0 = el.getBoundingClientRect().height;
    if (h0 > 0) onMeasured(h0);
    return () => ro.disconnect();
  }, [onMeasured, node.id]);

  return (
    <div
      ref={ref}
      className={cn('node-card', selected && 'is-selected')}
      style={{ width: '100%', padding: '14px 16px', cursor: 'pointer', minHeight: 72, boxSizing: 'border-box' }}
      data-node-id={node.id}
      data-testid="node-render"
      onPointerDown={onPointerDown}
    >
      {/* header */}
      <div className="flex items-center" style={{ marginBottom: 8 }}>
        {/* 首字母字符图标（与 lawe 一致） */}
        <div
          style={{
            width: 28, height: 28, background: color, borderRadius: 8,
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
            fontSize: 15, fontWeight: 700, color: '#1a1c24',
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
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #e5e7eb' }}
            >
              <Copy size={12} color="#6b7280" />
            </button>
            <button
              title="删除"
              onPointerDown={(e) => { e.stopPropagation(); onDelete?.(); }}
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #e5e7eb' }}
            >
              <Trash2 size={12} color="#ef4444" />
            </button>
          </div>
        )}
      </div>

      {/* config preview by kind */}
      <NodePreview kind={node.type} config={cfg} defName={def.name} />

      {/* 端口提示（底部） */}
      {(def.inputs.length > 0 || def.outputs.length > 0) && (
        <div className="flex items-center justify-between text-[10.5px] mt-2 pt-2" style={{ borderTop: '1px solid #F0F0F0', color: '#86909C' }}>
          <span>{def.inputs.length > 0 ? `${def.inputs.length} 输入` : ''}</span>
          <span>{def.outputs.length > 0 ? `${def.outputs.length} 输出` : ''}</span>
        </div>
      )}
    </div>
  );
}

/** 按节点类型显示配置预览（参考 lawe 的 NodePreview） */
function NodePreview({ kind, config, defName }: { kind: string; config: Record<string, any>; defName: string }) {
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#6b7280', marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: 12, color: '#1D2129', fontFamily: 'var(--font-mono, monospace)' };

  switch (kind) {
    case 'webhook':
      return (
        <div>
          <div style={labelStyle}>路径</div>
          <code style={{ fontSize: 11, color: '#00B42A', background: '#F0FDF4', padding: '2px 6px', borderRadius: 4 }}>
            {(config.method as string) || 'POST'} {(config.path as string) || '/webhook'}
          </code>
        </div>
      );
    case 'http_request':
      return (
        <div>
          <div style={labelStyle}>请求方式</div>
          <span style={{ display: 'inline-block', background: '#EEF2FF', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#4D53E8', fontWeight: 600, marginBottom: 4 }}>
            {(config.method as string) || 'GET'}
          </span>
          <div style={labelStyle}>URL</div>
          <div style={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {(config.url as string) || '(未设置)'}
          </div>
        </div>
      );
    case 'skill':
      return (
        <div>
          <div style={labelStyle}>Python 脚本</div>
          <div style={{
            ...valueStyle, background: '#0d1117', color: '#e6edf3', padding: '6px 8px',
            borderRadius: 6, maxHeight: 48, overflow: 'hidden', fontSize: 11, lineHeight: 1.4,
          }}>
            {config.code ? (config.code as string).split('\n').slice(0, 3).join('\n') : '(空)'}
          </div>
        </div>
      );
    case 'llm':
      return (
        <div>
          <span style={{ ...labelStyle, display: 'inline-block', marginRight: 4 }}>模型:</span>
          <span style={{ ...valueStyle, display: 'inline' }}>{(config.model as string) || 'gpt-4o-mini'}</span>
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
          <code style={{ fontSize: 11, color: '#0d9488', background: '#F0FDFA', padding: '2px 6px', borderRadius: 4 }}>
            {(config.expression as string) || 'True'}
          </code>
        </div>
      );
    case 'loop':
      return (
        <div>
          <div style={labelStyle}>数据源</div>
          <code style={{ fontSize: 11, color: '#ec4899', background: '#FDF2F8', padding: '2px 6px', borderRadius: 4 }}>
            {(config.items_expr as string) || '[]'}
          </code>
        </div>
      );
    case 'sql_query':
      return (
        <div>
          <div style={labelStyle}>SQL</div>
          <div style={{
            ...valueStyle, background: '#0d1117', color: '#e6edf3', padding: '6px 8px',
            borderRadius: 6, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
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
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {(config.description as string) || '点击右侧面板配置'}
        </div>
      );
  }
}
