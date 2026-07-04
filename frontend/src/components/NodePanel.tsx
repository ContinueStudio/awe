/**
 * 节点面板（lawe 风格 - 底部悬浮）
 * - 白底圆角 16 + 阴影 + 搜索框
 * - 按分类分组（2 列网格）
 * - 顶部三角形指示器指向 BottomToolbar
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { NodeDefinition } from '@/lib/types';
import { Brain, Database, Globe, UserCheck, Webhook, Flag, GitBranch, Braces, Wand2, Table2, PlugZap, Code2 } from 'lucide-react';

const ICONS: Record<string, any> = {
  Brain, Database, Globe, UserCheck, Webhook, Flag, GitBranch, Braces, Wand2, Table2, PlugZap, Code2,
};

// 节点类型 → 颜色块（与 lawe 风格保持一致：emerald=绿、violet=紫、amber=橙、sky=蓝、rose=红、slate=主色）
const COLOR_BAR: Record<string, string> = {
  emerald: '#00B42A',
  violet: '#7C3AED',
  amber: '#FF7D00',
  sky: '#0EA5E9',
  rose: '#F53F3F',
  slate: '#4D53E8',
};

const CATEGORY_LABEL: Record<string, string> = {
  trigger: '触发 / 边界',
  ai: 'AI 与语义路由',
  knowledge: '知识 / 数据',
  external: '外部生态',
  human: '人类管理',
};

const CATEGORY_ORDER: string[] = ['trigger', 'ai', 'knowledge', 'external', 'human'];

interface Props {
  onAdd: (type: string) => void;
}

export function NodePanel({ onAdd }: Props) {
  const [keyword, setKeyword] = useState('');
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);

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

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #E5E6EB',
        borderRadius: 16,
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        padding: '14px 14px 10px',
        width: 460,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        fontSize: 13,
        color: '#1D2129',
      }}
    >
      {/* 搜索框 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: '6px 10px',
          marginBottom: 10,
        }}
        onFocus={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#4D53E8')}
        onBlur={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="搜索节点..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoFocus
          style={{
            marginLeft: 8,
            outline: 'none',
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: '#374151',
            width: '100%',
          }}
        />
        {keyword && (
          <button
            onClick={() => setKeyword('')}
            style={{ color: '#9ca3af', fontSize: 18, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none' }}
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
          const Icon = ICONS[list[0]?.icon as any] || Code2;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
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
                  const ItemIcon = ICONS[item.icon] || Code2;
                  return (
                    <button
                      key={item.type}
                      onClick={() => onAdd(item.type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ItemIcon size={13} color="#fff" strokeWidth={2.4} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, lineHeight: 1.3 }}>
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#9ca3af',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 1,
                          }}
                        >
                          {item.description || item.type}
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
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 13 }}>
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
          filter: 'drop-shadow(0 1px 0 #e5e7eb)',
        }}
      />
    </div>
  );
}
