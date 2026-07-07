/**
 * 节点管理页（PRD §9.1 占位）
 * - 列出后端注册的所有节点定义
 * - 按 category 分组：触发 / AI / 知识 / 外部 / 人类
 * - 后续：节点版本管理、参数 schema 编辑、删除禁用
 */
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { NodeDefinition } from '@/lib/types';

const CATEGORY_LABEL: Record<string, string> = {
  trigger:   '触发 / 边界',
  ai:        'AI 与语义路由',
  knowledge: '知识 / 数据',
  external:  '外部生态',
  human:     '人类管理',
  logic:     '业务逻辑',
};

const CATEGORY_ORDER: string[] = ['trigger', 'ai', 'knowledge', 'logic', 'external', 'human'];

const COLOR_BAR: Record<string, string> = {
  emerald: '#10b981',
  blue:    '#3b82f6',
  amber:   '#f59e0b',
  sky:     '#0ea5e9',
  rose:    '#f43f5e',
  slate:   '#475569',
  violet:  '#8b5cf6',
};

export function NodesPage({ nodes: external }: { nodes: NodeDefinition[] }) {
  const [nodes, setNodes] = useState<NodeDefinition[]>(external);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (external.length > 0) { setNodes(external); return; }
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
  }, [external]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      <header
        style={{
          height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
          borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>节点管理</h1>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            共 <span style={{ color: '#020617', fontWeight: 500 }}>{nodes.length}</span> 个节点
          </p>
        </div>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索节点…"
            className="awe-input"
            style={{ width: 280, paddingLeft: 32 }}
          />
        </div>
      </header>

      <main className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped[cat] || [];
            if (list.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#020617', marginBottom: 10 }}>
                  {CATEGORY_LABEL[cat] || cat}
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{list.length}</span>
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {list.map((n) => {
                    const color = COLOR_BAR[n.color] || COLOR_BAR.slate;
                    return (
                      <div
                        key={n.type}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 240px 1fr 160px',
                          alignItems: 'center',
                          height: 48, padding: '0 16px',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: 13,
                        }}
                      >
                        <div
                          style={{
                            width: 26, height: 26, borderRadius: 6, background: color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 700 }}>{(n.name || n.type).charAt(0)}</span>
                        </div>
                        <div style={{ color: '#020617', fontWeight: 500 }}>{n.name}</div>
                        <div style={{ color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.description || n.type}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                          {n.type}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {nodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 13 }}>
              后端未注册任何节点
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
