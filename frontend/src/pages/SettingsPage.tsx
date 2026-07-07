/**
 * 设置页（PRD §4.5）
 * - 后端连接信息（健康状态、版本号）
 * - LiteLLM API Key 录入表单（加密存储）
 * - CDP 端口信息
 */
import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Key, Save } from 'lucide-react';
import { api } from '@/lib/api';

interface SettingsState {
  openai_api_key_encrypted: boolean;
  anthropic_api_key_encrypted: boolean;
  google_api_key_encrypted: boolean;
  llm_default_model: string | null;
}

export function SettingsPage({ health }: { health: { ok: boolean; version: string } | null }) {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // 表单状态
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('gpt-4o-mini');

  // 显示/隐藏密码
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  const fetchSettings = useCallback(() => {
    api.health().then(() => {
      fetch('/api/settings')
        .then((r) => r.json())
        .then((d) => {
          setSettings(d);
          setDefaultModel(d.llm_default_model || 'gpt-4o-mini');
        })
        .catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveKey = async (key: string, value: string, label: string) => {
    if (!value.trim()) return;
    setSaving(label);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      await fetchSettings();
      // 清空输入框
      if (key === 'openai_api_key') setOpenaiKey('');
      if (key === 'anthropic_api_key') setAnthropicKey('');
      if (key === 'google_api_key') setGoogleKey('');
    } catch (e) {
      alert(`保存失败: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  const clearKey = async (key: string, setter: (v: string) => void) => {
    try {
      await fetch(`/api/settings/${key}`, { method: 'DELETE' });
      setter('');
      await fetchSettings();
    } catch (e) {
      alert(`清除失败: ${(e as Error).message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      <header
        style={{
          height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
          borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#ffffff',
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>设置</h1>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>系统配置与连接信息</p>
        </div>
      </header>

      <main className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 后端连接 */}
          <Card title="后端连接">
            <Grid rows={[
              ['服务地址', 'http://127.0.0.1:8765'],
              ['健康状态', health ? (health.ok ? '🟢 在线' : '🔴 离线') : '检测中…'],
              ['后端版本', health?.version || '—'],
              ['CDP 端口范围', '9200–9300（浏览器自动化）'],
            ]} />
          </Card>

          {/* LiteLLM API Keys */}
          <Card title="LiteLLM · 模型 API Key">
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
              Key 采用 AES-128 加密后存入本地数据库，主密钥独立保存在 .env 文件（PRD §8.4）
            </div>

            {/* OpenAI */}
            <KeyRow
              label="OpenAI"
              hint="GPT-4o / GPT-4o-mini"
              configured={settings?.openai_api_key_encrypted ?? false}
              saving={saving === 'openai'}
              value={openaiKey}
              onChange={setOpenaiKey}
              onSave={() => saveKey('openai_api_key', openaiKey, 'openai')}
              onClear={() => clearKey('openai_api_key', setOpenaiKey)}
              show={showOpenAI}
              onToggleShow={() => setShowOpenAI((v) => !v)}
            />

            {/* Anthropic */}
            <KeyRow
              label="Anthropic"
              hint="Claude 3.5 / Claude 4"
              configured={settings?.anthropic_api_key_encrypted ?? false}
              saving={saving === 'anthropic'}
              value={anthropicKey}
              onChange={setAnthropicKey}
              onSave={() => saveKey('anthropic_api_key', anthropicKey, 'anthropic')}
              onClear={() => clearKey('anthropic_api_key', setAnthropicKey)}
              show={showAnthropic}
              onToggleShow={() => setShowAnthropic((v) => !v)}
            />

            {/* Google */}
            <KeyRow
              label="Google"
              hint="Gemini 2.0 / 2.5"
              configured={settings?.google_api_key_encrypted ?? false}
              saving={saving === 'google'}
              value={googleKey}
              onChange={setGoogleKey}
              onSave={() => saveKey('google_api_key', googleKey, 'google')}
              onClear={() => clearKey('google_api_key', setGoogleKey)}
              show={showGoogle}
              onToggleShow={() => setShowGoogle((v) => !v)}
              last
            />

            {/* 默认模型 */}
            <div style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 6 }}>默认模型</div>
              <input
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#e2e8f0';
                  if (defaultModel) saveKey('llm_default_model', defaultModel, 'model');
                }}
                placeholder="例如 gpt-4o-mini"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6,
                  border: '1px solid #e2e8f0', fontSize: 13, color: '#020617',
                  background: '#ffffff', outline: 'none',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              />
            </div>
          </Card>

          {/* 前端信息 */}
          <Card title="前端">
            <Grid rows={[
              ['前端版本', 'v0.3.7'],
              ['UI 规范', 'shadcn/ui 白底黑字（PRD v3.0）'],
            ]} />
          </Card>

        </div>
      </main>
    </div>
  );
}

/* ---------- 内部组件 ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
        fontSize: 13, fontWeight: 600, color: '#020617', background: '#f8fafc',
      }}>
        {title}
      </div>
      <div style={{ padding: '12px 16px' }}>
        {children}
      </div>
    </div>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, fontSize: 13 }}>
      {rows.map(([label, value], i) => (
        <div key={i}>
          <div style={{ color: '#64748b' }}>{label}</div>
          <div style={{ color: '#020617', fontFamily: label.includes('版本') ? "'JetBrains Mono', monospace" : undefined }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyRow({
  label, hint, configured, saving, value, onChange, onSave, onClear, show, onToggleShow, last,
}: {
  label: string;
  hint: string;
  configured: boolean;
  saving: boolean;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  show: boolean;
  onToggleShow: () => void;
  last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid #f1f5f9',
    }}>
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#020617' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{hint}</div>
      </div>

      {configured ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Key size={12} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: 12, color: '#16a34a' }}>已配置</span>
          <button
            onClick={onClear}
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: '#dc2626',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            清除
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
            placeholder={`输入 ${label} API Key`}
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#020617',
              background: '#ffffff',
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
          />
          <button
            onClick={onToggleShow}
            title={show ? '隐藏' : '显示'}
            style={{
              width: 28, height: 28, borderRadius: 4,
              border: 'none', background: 'transparent', color: '#94a3b8',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={onSave}
            disabled={saving || !value.trim()}
            title="保存"
            style={{
              width: 28, height: 28, borderRadius: 4,
              border: '1px solid #e2e8f0', background: value.trim() ? '#3b82f6' : '#f8fafc',
              color: value.trim() ? '#ffffff' : '#cbd5e1',
              cursor: value.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}
