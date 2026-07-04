/**
 * 节点配置面板 - 根据 config_schema 动态生成表单
 */
import { useMemo } from 'react';
import type { CanvasNode, NodeDefinition } from '@/lib/types';

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
    <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
      {orderedKeys.length === 0 && <div className="text-slate-400 text-xs">该节点无需配置</div>}
      {orderedKeys.map((key) => {
        const p = props[key] || {};
        const value = cfg[key] ?? p.default ?? '';
        const isRequired = required.includes(key);
        return (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {p.title || key}
              {isRequired && <span className="text-rose-500 ml-1">*</span>}
            </label>
            {renderField(key, p, value, (v) => onChange({ ...cfg, [key]: v }))}
            {p.description && <div className="text-[10.5px] text-slate-400 mt-1">{p.description}</div>}
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-brand-500"
      >
        {p.enum.map((v: string) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
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
        className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-brand-500"
      />
    );
  }
  if (p.type === 'boolean') {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-slate-600 text-xs">{value ? '开启' : '关闭'}</span>
      </label>
    );
  }
  if (p.format === 'textarea' || p.type === 'object' || p.type === 'array' || String(value).length > 60) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return (
      <textarea
        value={text}
        rows={p.format === 'textarea' ? 6 : 4}
        onChange={(e) => {
          if (p.type === 'object' || p.type === 'array') {
            try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
          } else onChange(e.target.value);
        }}
        className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-mono focus:outline-none focus:border-brand-500"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:border-brand-500"
    />
  );
}
