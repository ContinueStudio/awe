/**
 * 单节点渲染（PRD v2.13 - 2026-07-05）
 *
 * 节点只显示名字（标题 + 类型色块），详细信息（def 描述 / config 摘要）
 * 通过 hover tooltip 显示，避免画布拥挤。
 *
 * 视觉规范（PRD §9.2 严格遵循）：
 * - 白底 + 细边 + rounded-lg + 节点类型色条
 * - 选中态：黑边 + 黑阴影
 * - hover：显示悬浮卡片（def 描述 + config 摘要 + 端口数）
 */
import { useEffect, useRef, useState } from 'react';
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
  const [hover, setHover] = useState(false);

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
      style={{ width: '100%', padding: '10px 12px', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', position: 'relative' }}
      data-node-id={node.id}
      data-testid="node-render"
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* header：类型色块 + 名字 + 选中态操作 */}
      <div className="flex items-center">
        <div
          style={{
            width: 22, height: 22, background: color, borderRadius: 5,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            marginRight: 8, flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
            {(def.name || node.type).charAt(0)}
          </span>
        </div>
        <span
          style={{
            fontSize: 13, fontWeight: 600, color: '#020617',
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
              style={{ width: 22, height: 22 }}
            >
              <Copy size={11} />
            </button>
            <button
              title="删除"
              onPointerDown={(e) => { e.stopPropagation(); onDelete?.(); }}
              className="awe-icon-btn"
              style={{ width: 22, height: 22, color: '#dc2626', borderColor: '#fecaca' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* hover 弹出 tooltip：详细描述 + config 摘要 */}
      {hover && !selected && <NodeHoverTip def={def} cfg={cfg} />}
    </div>
  );
}

/* ---- hover 详细 tooltip ---- */
function NodeHoverTip({ def, cfg }: { def: NodeDefinition; cfg: Record<string, any> }) {
  const desc = (cfg.description as string) || def.description || '点击右侧面板配置';
  const cfgEntries = Object.entries(cfg)
    .filter(([k]) => k !== 'description')
    .slice(0, 4);
  return (
    <div
      style={{
        position: 'absolute',
        left: '100%',
        top: 0,
        marginLeft: 8,
        zIndex: 50,
        width: 240,
        maxWidth: 240,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 6px 24px rgba(15, 23, 42, 0.12)',
        padding: '10px 12px',
        fontSize: 12,
        color: '#020617',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 2 }}>
        {def.category} · {def.type}
      </div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: cfgEntries.length > 0 ? 8 : 0 }}>
        {desc}
      </div>
      {cfgEntries.length > 0 && (
        <>
          <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {cfgEntries.map(([k, v]) => {
              const display = typeof v === 'string' ? v : JSON.stringify(v);
              const truncated = display.length > 60 ? display.slice(0, 60) + '…' : display;
              return (
                <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                  <span style={{ color: '#94a3b8', flexShrink: 0 }}>{k}</span>
                  <span style={{ color: '#020617', fontFamily: "'JetBrains Mono', 'SF Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncated}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {(def.inputs.length > 0 || def.outputs.length > 0) && (
        <>
          <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            {def.inputs.length > 0 && <span>输入：{def.inputs.length}</span>}
            {def.outputs.length > 0 && <span>输出：{def.outputs.length}</span>}
          </div>
        </>
      )}
    </div>
  );
}
