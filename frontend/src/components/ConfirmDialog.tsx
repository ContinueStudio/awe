/**
 * 全局自定义确认对话框
 * - 浅色主题（白底 + slate 边框）
 * - 在窗口正中心显示
 * - 无系统提示音
 */
import React from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.4)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        autoFocus
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
          width: 400,
          maxWidth: '90vw',
          padding: '24px',
          outline: 'none',
        }}
      >
        {/* 标题 */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#111827',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {danger && (
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              !
            </span>
          )}
          {title}
        </div>

        {/* 内容 */}
        <div
          style={{
            fontSize: 13,
            color: '#6b7280',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {message}
        </div>

        {/* 按钮区 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '0 16px',
              height: 34,
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              color: '#6b7280',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0 16px',
              height: 34,
              borderRadius: 6,
              background: danger ? '#dc2626' : 'var(--primary, #6366f1)',
              border: 'none',
              color: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = danger
                ? '#b91c1c'
                : 'var(--primary-hover, #4f46e5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = danger
                ? '#dc2626'
                : 'var(--primary, #6366f1)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
