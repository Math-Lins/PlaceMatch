import { useState, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import LogsTab from './LogsTab';
import UsuariosTab from './UsuariosTab';
import PainelTab from './PainelTab';
import RelatoriosTab from './RelatoriosTab';

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface EBState { error: Error | null }

class AdminErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AdminPanel] Uncaught error:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: 'Nunito,sans-serif' }}>
          <p style={{ color: '#E05555', fontSize: '14px', marginBottom: '8px', fontWeight: 700 }}>
            Algo deu errado nesta seção.
          </p>
          <pre style={{ color: '#8A7E78', fontSize: '12px', whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: '16px', padding: '8px 18px', borderRadius: '10px', border: 'none', background: '#E06B45', color: '#fff', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const C = {
  primary: '#E06B45',
  bg: '#FBF8F5',
  card: '#FFFFFF',
  text: '#2A2420',
  muted: '#8A7E78',
  border: '#EDE8E3',
};

type AdminTab = 'painel' | 'relatorios' | 'logs' | 'usuarios';

const TAB_LABELS: Record<AdminTab, string> = {
  painel: 'Painel',
  relatorios: 'Relatórios',
  logs: 'Logs',
  usuarios: 'Usuários',
};

export default function AdminPanel({ nav }: { nav: (s: 'welcome') => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('painel');

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
        <div style={{ display: 'flex', marginTop: '12px', overflowX: 'auto' }}>
          {(['painel', 'relatorios', 'logs', 'usuarios'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Outfit,sans-serif', fontSize: '15px', whiteSpace: 'nowrap',
                fontWeight: activeTab === t ? 800 : 500,
                color: activeTab === t ? C.primary : C.muted,
                borderBottom: activeTab === t ? `3px solid ${C.primary}` : '3px solid transparent',
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AdminErrorBoundary key={activeTab}>
          {activeTab === 'painel' && <PainelTab />}
          {activeTab === 'relatorios' && <RelatoriosTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'usuarios' && <UsuariosTab />}
        </AdminErrorBoundary>
      </div>
    </div>
  );
}
