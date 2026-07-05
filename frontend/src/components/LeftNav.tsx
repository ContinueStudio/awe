/**
 * 左侧导航（PRD §9.1）
 * - 固定 240px（PRD §9.1）
 * - 白底 + slate-200 右细线
 * - Logo + 4 个导航项：工作流列表 / 节点管理 / 执行历史 / 设置
 * - 当前项：slate-200 背景 + 黑色文字
 */
import {
  LayoutGrid,
  Boxes,
  History,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';

export type NavKey = 'workflows' | 'nodes' | 'history' | 'settings';

interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { key: 'workflows', label: '工作流列表', icon: LayoutGrid },
  { key: 'nodes',     label: '节点管理',   icon: Boxes },
  { key: 'history',   label: '执行历史',   icon: History },
  { key: 'settings',  label: '设置',       icon: SettingsIcon },
];

interface Props {
  active: NavKey;
  onChange: (k: NavKey) => void;
  health?: { ok: boolean; version: string } | null;
}

export function LeftNav({ active, onChange, health }: Props) {
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Logo 区（PRD §9.2：取消紫色，改用黑色/深灰文字） */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: '#0f172a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: '#ffffff', fontSize: 14,
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>
              AWE
            </div>
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2, marginTop: 1 }}>
              智能体工作流引擎
            </div>
          </div>
        </div>
        {health && (
          <div style={{
            marginTop: 12, fontSize: 10, color: health.ok ? '#16a34a' : '#dc2626',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span className={`status-dot ${health.ok ? 'status-dot-success' : 'status-dot-failed'}`} style={{ width: 6, height: 6 }} />
            {health.ok ? `后端 ${health.version}` : '后端离线'}
          </div>
        )}
      </div>

      {/* 导航项 */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 12px 6px' }}>
          导航
        </div>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                marginBottom: 2,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#020617' : '#475569',
                background: isActive ? '#ffffff' : 'transparent',
                border: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <Icon size={15} className="shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* 底部版本号 */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8' }}>
        v0.3.4
      </div>
    </aside>
  );
}
