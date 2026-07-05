/**
 * 节点配置面板 - 根据 config_schema 动态生成表单
 * 视觉风格参考 shadcn/ui（PRD §9.2 v2.11+）：白底 + 细边 + 圆角 6
 */
import { useMemo } from 'react';
import type { CanvasNode, NodeDefinition } from '@/lib/types';

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  marginBottom: 6,
  color: '#334155', // slate-700
  fontWeight: 500,
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 12px',
  fontSize: 13,
  borderRadius: 6,
  outline: 'none',
  background: '#ffffff',
  color: '#020617',
  border: '1px solid #e2e8f0',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: 'none',
  paddingRight: 28,
  cursor: 'pointer',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  height: 'auto',
  resize: 'vertical',
  minHeight: 60,
  padding: '8px 12px',
  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: 12,
  lineHeight: 1.5,
};

const CODE_STYLE: React.CSSProperties = {
  ...TEXTAREA_STYLE,
  background: '#0d1117',
  color: '#e6edf3',
  border: '1px solid #30363d',
};

export function ConfigPanel({
  node,
  def,
  onChange,
}: {
  node: CanvasNode;
  def: NodeDefinition;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const cfg = node.config || {};
  const schema = (def.config_schema || {}) as { properties?: Record<string, any>; required?: string[] };
  const props = schema.properties || {};
  const required = schema.required || [];

  const orderedKeys = useMemo(() => Object.keys(props), [props]);

  return (
    <div className="space-y-3" style={{ fontSize: 13 }}>
      {orderedKeys.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12 }}>该节点无需配置</div>}
      {orderedKeys.map((key) => {
        const p = props[key] || {};
        const value = cfg[key] ?? p.default ?? '';
        const isRequired = required.includes(key);
        return (
          <div key={key}>
            <label style={LABEL_STYLE}>
              {p.title || key}
              {isRequired && <span style={{ color: '#dc2626' }}> *</span>}
            </label>
            {renderField(key, p, value, (v) => onChange({ ...cfg, [key]: v }))}
            {p.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>{p.description}</div>}
          </div>
        );
      })}
    </div>
  );
}

function renderField(
  key: string,
  p: any,
  value: any,
  onChange: (v: any) => void,
) {
  if (p.enum && Array.isArray(p.enum)) {
    return (
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={SELECT_STYLE}
        >
          {p.enum.map((v: string) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <span style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)', pointerEvents: 'none',
          color: '#64748b', fontSize: 10,
        }}>▼</span>
      </div>
    );
  }
  if (p.type === 'number' || p.type === 'integer') {
    return (
      <input
        type="number"
        value={value}
        min={p.minimum}
        max={p.maximum}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        style={INPUT_STYLE}
      />
    );
  }
  if (p.type === 'boolean') {
    return (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <button
          type="button"
          onClick={() => onChange(!value)}
          style={{
            width: 32, height: 18,
            background: value ? '#0f172a' : '#cbd5e1',
            borderRadius: 9, position: 'relative',
            transition: 'background 0.15s',
            cursor: 'pointer', border: 'none', padding: 0,
          }}
        >
          <span style={{
            width: 14, height: 14, background: 'white',
            borderRadius: '50%', position: 'absolute',
            top: 2, left: value ? 16 : 2,
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            transition: 'left 0.15s',
          }} />
        </button>
        <span style={{ color: '#475569', fontSize: 12 }}>{value ? '开启' : '关闭'}</span>
      </label>
    );
  }
  if (p.format === 'textarea' || String(value).length > 60) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const isCode = p.format === 'textarea' && (p.title?.toLowerCase().includes('code') || p.title?.includes('代码') || key === 'code' || key === 'script');
    return (
      <textarea
        value={text}
        rows={isCode ? 6 : 4}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        style={isCode ? CODE_STYLE : TEXTAREA_STYLE}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={INPUT_STYLE}
    />
  );
}
