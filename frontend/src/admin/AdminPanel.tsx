import { useState } from 'react';
import LogsTab from './LogsTab';
import UsuariosTab from './UsuariosTab';

const C = {
  primary: '#E06B45',
  bg: '#FBF8F5',
  card: '#FFFFFF',
  text: '#2A2420',
  muted: '#8A7E78',
  border: '#EDE8E3',
};

export default function AdminPanel({ nav }: { nav: (s: 'welcome') => void }) {
  const [activeTab, setActiveTab] = useState<'logs' | 'usuarios'>('logs');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px' }}>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: C.text, margin: 0 }}>
            Painel Admin
          </h1>
          <button
            onClick={() => nav('welcome')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '14px', padding: '8px 0',
            }}
          >
            Sair
          </button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', marginTop: '12px' }}>
          {(['logs', 'usuarios'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Outfit,sans-serif', fontSize: '15px',
                fontWeight: activeTab === t ? 800 : 500,
                color: activeTab === t ? C.primary : C.muted,
                borderBottom: activeTab === t ? `3px solid ${C.primary}` : '3px solid transparent',
              }}
            >
              {t === 'logs' ? 'Logs' : 'Usuários'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'logs' ? <LogsTab /> : <UsuariosTab />}
      </div>
    </div>
  );
}
