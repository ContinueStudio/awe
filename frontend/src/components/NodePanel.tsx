/**
 * 节点面板（shadcn 白底黑字 PRD v2.11+）
 * - 底部悬浮，白底 + 细边 + rounded-lg + 极轻阴影
 * - 搜索框 + 2 列节点网格
 * - 节点 icon 用首字母字符（类型色条 + 白字）
 * - hover 节点弹出 240px 简介浮卡（portal 到 body，避免被内部 scroll 裁剪）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import type { NodeDefinition } from '@/lib/types';

// 节点类型 → 颜色（与 NodeRender 保持一致）
const COLOR_BAR: Record<string, string> = {
  emerald: '#16a34a',
  blue:    '#2563eb',
  amber:   '#d97706',
  sky:     '#0284c7',
  rose:    '#dc2626',
  slate:   '#0f172a',
  violet:  '#7c3aed',
};

const CATEGORY_LABEL: Record<string, string> = {
  trigger:   '触发 / 边界',
  ai:        'AI 与语义路由',
  knowledge: '知识 / 数据',
  external:  '外部生态',
  human:     '人类管理',
};

const CATEGORY_ORDER: string[] = ['trigger', 'ai', 'knowledge', 'external', 'human'];

interface Props {
  onAdd: (type: string) => void;
}

export function NodePanel({ onAdd }: Props) {
  const [keyword, setKeyword] = useState('');
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);

  // hover 浮卡状态：当前 hover 的节点 type + button 屏幕坐标
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
  }, []);

  const grouped = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const result: Record<string, NodeDefinition[]> = {};
    for (const cat of CATEGORY_ORDER) {
      result[cat] = nodes.filter(
        (n) => n.category === cat && (kw === '' || n.name.toLowerCase().includes(kw) || n.type.toLowerCase().includes(kw)),
      );
    }
    return result;
  }, [keyword, nodes]);

  // 当前 hover 的节点定义
  const hoveredDef = useMemo(
    () => (hoveredType ? nodes.find((n) => n.type === hoveredType) || null : null),
    [hoveredType, nodes],
  );

  const onItemEnter = (e: React.MouseEvent<HTMLButtonElement>, type: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredType(type);
    setHoverRect(rect);
  };
  const onItemLeave = () => {
    setHoveredType(null);
    setHoverRect(null);
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        boxShadow: 'var(--shadow-panel)',
        padding: '12px 12px 10px',
        width: 460,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        fontSize: 13,
        color: '#020617',
      }}
    >
      {/* 搜索框 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '0 10px',
          height: 32,
          marginBottom: 10,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="搜索节点..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoFocus
          className="awe-input"
          style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: '0 0 0 8px', height: '100%', fontSize: 13 }}
        />
        {keyword && (
          <button
            onClick={() => setKeyword('')}
            style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none' }}
            title="清空"
          >
            ×
          </button>
        )}
      </div>

      {/* 节点列表 */}
      <div
        className="thin-scroll"
        style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}
      >
        {CATEGORY_ORDER.map((cat) => {
          const list = grouped[cat] || [];
          if (list.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  paddingLeft: 4,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontWeight: 600,
                }}
              >
                {CATEGORY_LABEL[cat] || cat}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 4,
                }}
              >
                {list.map((item) => {
                  const color = COLOR_BAR[item.color] || COLOR_BAR.slate;
                  return (
                    <button
                      key={item.type}
                      onClick={() => onAdd(item.type)}
                      onMouseEnter={(e) => {
                        onItemEnter(e, item.type);
                        (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        onItemLeave();
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div
                        style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
                          {(item.name || item.type).charAt(0)}
                        </span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#020617', fontWeight: 500, lineHeight: 1.3 }}>
                          {item.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {Object.values(grouped).every((arr) => arr.length === 0) && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
            没有匹配的节点
          </div>
        )}
      </div>

      {/* 底部三角形指示器（指向工具栏） */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid #ffffff',
          filter: 'drop-shadow(0 1px 0 #e2e8f0)',
        }}
      />

      {/* hover 浮卡：portal 到 body，按 button 屏幕坐标定位在按钮上方 */}
      {hoveredDef && hoverRect && createPortal(
        <div
          style={{
            position: 'fixed',
            top: hoverRect.top - 8,
            left: hoverRect.left + hoverRect.width / 2,
            transform: 'translate(-50%, -100%)',
            width: 240,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(15,23,42,0.12)',
            padding: 12,
            pointerEvents: 'none',
            zIndex: 1000,
            color: '#020617',
          }}
        >
          {/* 分类 + type */}
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
            {(CATEGORY_LABEL[hoveredDef.category] || hoveredDef.category)} · {hoveredDef.type}
          </div>
          {/* 名称 */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#020617', marginTop: 2, marginBottom: 6 }}>
            {hoveredDef.name}
          </div>
          {/* 简介 */}
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 8 }}>
            {hoveredDef.description || '点击添加到画布后，在右侧面板配置参数。'}
          </div>
          {/* 端口统计 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
            <span>{hoveredDef.inputs.length} 输入</span>
            <span>{hoveredDef.outputs.length} 输出</span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
