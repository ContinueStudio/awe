/**
 * 左下角视图缩放控件（v0.3.5 新增）
 * - 显示当前缩放比例（如 100%）
 * - - / + 按钮缩放
 * - 「适应」按钮重置为 100%
 *
 * 定位：position: fixed 视口定位（v0.3.5 修复：避免受 Canvas 缩放变换影响）
 */
import { Minus, Plus, Maximize2 } from 'lucide-react';

interface Props {
  scale: number;
  onChange: (s: number) => void;
  onReset?: () => void;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

export function ZoomControls({ scale, onChange, onReset }: Props) {
  const percent = Math.round(scale * 100);

  const zoomIn = () => onChange(Math.min(MAX_SCALE, +(scale * 1.1).toFixed(3)));
  const zoomOut = () => onChange(Math.max(MIN_SCALE, +(scale / 1.1).toFixed(3)));
  const reset = () => {
    onChange(1);
    onReset?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
        padding: '0 4px',
        height: 36,
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={zoomOut}
        title="缩小"
        style={{
          width: 32, height: 32, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none',
          color: '#475569', cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
          (e.currentTarget as HTMLButtonElement).style.color = '#020617';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = '#475569';
        }}
      >
        <Minus size={14} />
      </button>

      <div
        style={{
          minWidth: 56,
          padding: '0 8px',
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: '#020617',
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none',
        }}
      >
        {percent}%
      </div>

      <button
        onClick={zoomIn}
        title="放大"
        style={{
          width: 32, height: 32, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none',
          color: '#475569', cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
          (e.currentTarget as HTMLButtonElement).style.color = '#020617';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = '#475569';
        }}
      >
        <Plus size={14} />
      </button>

      <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />

      <button
        onClick={reset}
        title="重置为 100%"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 10px', height: 28, borderRadius: 6,
          background: 'transparent', border: 'none',
          color: '#475569', fontSize: 12, fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
          (e.currentTarget as HTMLButtonElement).style.color = '#020617';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = '#475569';
        }}
      >
        <Maximize2 size={13} />
        适应
      </button>
    </div>
  );
}
