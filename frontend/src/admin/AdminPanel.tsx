import { useState, useEffect, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import LogsTab from './LogsTab';
import UsuariosTab from './UsuariosTab';
import PainelTab from './PainelTab';
import RelatoriosTab from './RelatoriosTab';
import ModeracaoTab from './ModeracaoTab';
import IATab from './IATab';
import { listarDenuncias } from '../api';
import { C, FONTE_TITULO, FONTE_TEXTO, RAIO, Botao, EstadoErro } from '../ui';

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
    // O detalhe técnico fica só no console; a tela mostra uma mensagem simples.
    console.error('[AdminPanel] Uncaught error:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <EstadoErro
          mensagem="Algo deu errado nesta seção. Tente novamente; se o problema continuar, recarregue a página."
          onTentarNovamente={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

type AdminTab = 'painel' | 'relatorios' | 'logs' | 'usuarios' | 'moderacao' | 'ia';

const TAB_LABELS: Record<AdminTab, string> = {
  painel: 'Painel',
  relatorios: 'Relatórios',
  logs: 'Logs',
  usuarios: 'Usuários',
  moderacao: 'Moderação',
  ia: 'IA',
};

export default function AdminPanel({ nav, onLogout }: { nav: (s: 'welcome') => void; onLogout?: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('painel');
  const [pendingDenuncias, setPendingDenuncias] = useState(0);

  useEffect(() => {
    listarDenuncias({ status: 'pendente' })
      .then(res => setPendingDenuncias(res.length))
      .catch(() => { /* o contador é só informativo */ });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Cabeçalho */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/favicon.svg" alt="" width={36} height={36} style={{ borderRadius: '10px' }} />
            <h1 style={{ fontFamily: FONTE_TITULO, fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>
              Painel Admin
            </h1>
          </div>
          <Botao variante="texto" tamanho="compacto" onClick={() => (onLogout ? onLogout() : nav('welcome'))}>
            Sair da conta
          </Botao>
        </div>
        {/* Abas */}
        <nav aria-label="Seções do painel" style={{ display: 'flex', marginTop: '8px', overflowX: 'auto' }}>
          {(['painel', 'relatorios', 'logs', 'usuarios', 'moderacao', 'ia'] as const).map((t) => {
            const ativa = activeTab === t;
            return (
              <button
                key={t}
                aria-current={ativa ? 'page' : undefined}
                onClick={() => setActiveTab(t)}
                style={{
                  position: 'relative',
                  padding: '12px 22px', minHeight: '48px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: FONTE_TITULO, fontSize: '15px', whiteSpace: 'nowrap',
                  fontWeight: ativa ? 800 : 600,
                  color: ativa ? C.primaryText : C.muted,
                  borderBottom: `3px solid ${ativa ? C.primary : 'transparent'}`,
                  borderRadius: `${RAIO.campo} ${RAIO.campo} 0 0`,
                }}
              >
                {TAB_LABELS[t]}
                {t === 'moderacao' && pendingDenuncias > 0 && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '0',
                    background: C.primaryDark, color: '#fff', borderRadius: '10px',
                    padding: '0 6px', fontSize: '11px', fontWeight: 800,
                    fontFamily: FONTE_TEXTO, lineHeight: '18px', minWidth: '18px', textAlign: 'center',
                  }}>
                    {pendingDenuncias}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AdminErrorBoundary key={activeTab}>
          {activeTab === 'painel' && <PainelTab />}
          {activeTab === 'relatorios' && <RelatoriosTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'usuarios' && <UsuariosTab />}
          {activeTab === 'moderacao' && <ModeracaoTab />}
          {activeTab === 'ia' && <IATab />}
        </AdminErrorBoundary>
      </div>
    </div>
  );
}
