import React, { useState, useEffect, useCallback } from 'react';
import {
  listarDenuncias, resolverDenuncia, suspenderUsuario,
  downloadRelatorioCSV, ApiError, validarPeriodo,
} from '../api';
import type { DenunciaItem, AdminFiltros } from '../api';
import {
  C, FONTE_TEXTO, RAIO, Botao, Campo, CamposPeriodo, BarraFiltros, CartaoTabela, Selo, Modal, MensagemErro,
  EstadoCarregando, EstadoErro, EstadoVazio, ESTILO_TABELA, ESTILO_TH, ESTILO_TD, ESTILO_ROTULO,
  estiloCampo, dataBR, dataHoraBR, ROTULO_STATUS_DENUNCIA,
} from '../ui';

const MOTIVO_LABELS: Record<string, string> = {
  spam: 'Spam', ofensivo: 'Conteúdo ofensivo', falso: 'Perfil falso', outro: 'Outro',
};

const TOM_STATUS: Record<string, 'coral' | 'mint' | 'neutro'> = {
  pendente: 'coral',
  resolvida: 'mint',
  descartada: 'neutro',
};

// Rótulos da tela → status do backend
const FILTRO_STATUS: { value: string; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'resolvida', label: 'Procedentes' },
  { value: 'descartada', label: 'Improcedentes' },
];

const MOTIVO_OPTS = [
  { value: '', label: 'Todos os motivos' },
  ...Object.entries(MOTIVO_LABELS).map(([value, label]) => ({ value, label })),
];

// ─── Modal de análise ─────────────────────────────────────────────────────────

interface AnalisarModalProps {
  denuncia: DenunciaItem;
  onClose: () => void;
  onConcluido: () => void;
}

function AnalisarModal({ denuncia, onClose, onConcluido }: AnalisarModalProps) {
  const [decisao, setDecisao] = useState<'resolvida' | 'descartada' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [suspender, setSuspender] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleConfirmar = async () => {
    if (!decisao) { setErro('Selecione uma decisão.'); return; }
    setErro('');
    setLoading(true);
    try {
      await resolverDenuncia(denuncia.id, decisao, observacao);
      if (suspender && decisao === 'resolvida' && denuncia.denunciado.id) {
        await suspenderUsuario(denuncia.denunciado.id, `Denúncia nº ${denuncia.id} procedente.`);
      }
      onConcluido();
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível registrar a decisão.');
      setLoading(false);
    }
  };

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <p style={{ margin: '0 0 6px' }}><strong>{rotulo}:</strong> {valor}</p>
  );

  return (
    <Modal titulo={`Analisar denúncia nº ${denuncia.id}`} ariaLabel="Analisar denúncia" onFechar={onClose} podeFechar={!loading} larguraMax="500px">
      <div style={{ background: C.bg, borderRadius: RAIO.campo, padding: '14px 16px', marginBottom: '20px', fontSize: '14px', fontFamily: FONTE_TEXTO, color: C.text, lineHeight: 1.5 }}>
        {linha('Data', dataHoraBR(denuncia.criada_em))}
        {linha('Denunciante', denuncia.denunciante.email ?? '—')}
        {linha('Denunciado', denuncia.denunciado.email)}
        {linha('Motivo', MOTIVO_LABELS[denuncia.motivo] ?? denuncia.motivo_display)}
        {denuncia.descricao && linha('Descrição', denuncia.descricao)}
      </div>

      <p style={{ ...ESTILO_ROTULO, margin: '0 0 8px' }}>Decisão</p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {[
          { value: 'resolvida' as const, label: 'Procedente' },
          { value: 'descartada' as const, label: 'Improcedente' },
        ].map(opt => {
          const ativo = decisao === opt.value;
          return (
            <button key={opt.value} type="button" aria-pressed={ativo} onClick={() => { setDecisao(opt.value); setErro(''); if (opt.value !== 'resolvida') setSuspender(false); }} style={{
              flex: 1, padding: '10px', minHeight: '48px', borderRadius: RAIO.campo, cursor: 'pointer',
              border: `2px solid ${ativo ? C.primary : C.borderStrong}`,
              background: ativo ? C.primarySoft : C.card,
              color: ativo ? C.primaryText : C.muted,
              fontFamily: FONTE_TEXTO, fontSize: '15px', fontWeight: 700,
            }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Campo rotulo="Observação (opcional)" contador={<span style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: observacao.length >= 500 ? C.danger : C.muted }}>{observacao.length}/500</span>}>
          <textarea
            value={observacao}
            maxLength={500}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Observação interna sobre a decisão..."
            style={{ ...estiloCampo(), width: '100%', resize: 'none', height: '80px' }}
          />
        </Campo>
      </div>

      {decisao === 'resolvida' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', minHeight: '44px', cursor: 'pointer', fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={suspender}
            onChange={e => setSuspender(e.target.checked)}
            style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: C.danger }}
          />
          Suspender a conta do denunciado
        </label>
      )}

      {erro && <div style={{ marginBottom: '12px' }}><MensagemErro>{erro}</MensagemErro></div>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <Botao variante="secundario" larguraTotal onClick={onClose} disabled={loading}>Cancelar</Botao>
        <Botao larguraTotal onClick={handleConfirmar} disabled={loading}>{loading ? 'Confirmando…' : 'Confirmar'}</Botao>
      </div>
    </Modal>
  );
}

// ─── ModeracaoTab ─────────────────────────────────────────────────────────────

export default function ModeracaoTab() {
  const [denuncias, setDenuncias] = useState<DenunciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [analisando, setAnalisando] = useState<DenunciaItem | null>(null);

  // Filtros
  const [status, setStatus] = useState('pendente');
  const [motivo, setMotivo] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const carregar = useCallback((params: { status?: string; motivo?: string; data_inicio?: string; data_fim?: string }) => {
    if (validarPeriodo(params.data_inicio, params.data_fim)) { setLoading(false); return; }
    setLoading(true);
    setErro('');
    listarDenuncias({
      status: params.status || undefined,
      motivo: params.motivo || undefined,
      data_inicio: params.data_inicio || undefined,
      data_fim: params.data_fim || undefined,
    })
      .then(res => { setDenuncias(res); setLoading(false); })
      .catch((e: Error) => { setErro(e instanceof ApiError ? e.message : e.message); setLoading(false); });
  }, []);

  useEffect(() => { carregar({ status: 'pendente' }); }, [carregar]);

  const erroPeriodo = validarPeriodo(dataInicio, dataFim);

  const handleBuscar = () => carregar({ status, motivo, data_inicio: dataInicio, data_fim: dataFim });

  const handleExport = async () => {
    if (erroPeriodo) return;
    setExporting(true);
    try {
      const filtros: AdminFiltros = {};
      if (dataInicio) filtros.data_inicio = dataInicio;
      if (dataFim) filtros.data_fim = dataFim;
      await downloadRelatorioCSV('denuncias', filtros);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível exportar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  const buscaLower = busca.toLowerCase();
  // O período (De/Até) é aplicado pelo backend ao clicar em "Buscar"; aqui só a busca por e-mail.
  const filtradas = denuncias.filter(d =>
    !busca || (d.denunciante.email ?? '').toLowerCase().includes(buscaLower) || d.denunciado.email.toLowerCase().includes(buscaLower),
  );

  const campo = estiloCampo({ compacto: true });

  return (
    <div style={{ padding: '20px 24px' }}>
      <BarraFiltros>
        <Campo rotulo="Status" minWidth="160px">
          <select value={status} onChange={e => setStatus(e.target.value)} style={campo}>
            {FILTRO_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Motivo" minWidth="170px">
          <select value={motivo} onChange={e => setMotivo(e.target.value)} style={campo}>
            {MOTIVO_OPTS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="E-mail" flex="1 1 200px">
          <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBuscar()} placeholder="Denunciante ou denunciado" style={campo} />
        </Campo>
        <CamposPeriodo inicio={dataInicio} fim={dataFim} onInicio={setDataInicio} onFim={setDataFim} erro={erroPeriodo} />
        <Botao tamanho="compacto" onClick={handleBuscar}>Buscar</Botao>
        <Botao tamanho="compacto" variante="neutro" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </Botao>
      </BarraFiltros>

      {loading && <EstadoCarregando texto="Carregando denúncias…" />}
      {!loading && erro && <EstadoErro mensagem={erro} onTentarNovamente={handleBuscar} />}
      {!loading && !erro && filtradas.length === 0 && (
        <EstadoVazio titulo="Nenhuma denúncia encontrada." descricao={status === 'pendente' ? 'Não há denúncias aguardando análise.' : 'Ajuste os filtros e busque novamente.'} />
      )}

      {!loading && !erro && filtradas.length > 0 && (
        <CartaoTabela>
          <table style={ESTILO_TABELA}>
            <thead>
              <tr>
                {['Data', 'Denunciante', 'Denunciado', 'Motivo', 'Status', 'Ação'].map(h => <th key={h} style={ESTILO_TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(d => {
                const isExpanded = expanded === d.id;
                return (
                  <React.Fragment key={d.id}>
                    <tr
                      style={{ background: isExpanded ? C.primarySoft : C.card, cursor: 'pointer' }}
                      onClick={() => setExpanded(isExpanded ? null : d.id)}
                      aria-expanded={isExpanded}
                    >
                      <td style={{ ...ESTILO_TD, color: C.muted, whiteSpace: 'nowrap' }}>{dataBR(d.criada_em)}</td>
                      <td style={ESTILO_TD}>{d.denunciante.email ?? '—'}</td>
                      <td style={ESTILO_TD}>{d.denunciado.email}</td>
                      <td style={{ ...ESTILO_TD, color: C.muted }}>{MOTIVO_LABELS[d.motivo] ?? d.motivo_display}</td>
                      <td style={ESTILO_TD}>
                        <Selo tom={TOM_STATUS[d.status] ?? 'neutro'}>{ROTULO_STATUS_DENUNCIA[d.status] ?? d.status}</Selo>
                      </td>
                      <td style={ESTILO_TD} onClick={e => e.stopPropagation()}>
                        {d.status === 'pendente' && (
                          <Botao tamanho="mini" onClick={() => setAnalisando(d)}>Analisar</Botao>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: C.primarySoft }}>
                        <td colSpan={6} style={{ ...ESTILO_TD, padding: '12px 20px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontFamily: FONTE_TEXTO, color: C.text }}>
                            {d.descricao && <p style={{ margin: 0 }}><strong>Descrição:</strong> {d.descricao}</p>}
                            {d.resolucao && <p style={{ margin: 0 }}><strong>Observação:</strong> {d.resolucao}</p>}
                            {d.resolvida_por && (
                              <p style={{ margin: 0, color: C.muted }}><strong>Analisada por:</strong> {d.resolvida_por} · {dataHoraBR(d.atualizada_em)}</p>
                            )}
                            {!d.descricao && !d.resolucao && !d.resolvida_por && (
                              <p style={{ margin: 0, color: C.muted }}>Sem detalhes adicionais.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </CartaoTabela>
      )}

      {!loading && !erro && filtradas.length > 0 && (
        <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, marginTop: '12px' }}>
          {filtradas.length} denúncia{filtradas.length !== 1 ? 's' : ''}
        </p>
      )}

      {analisando && (
        <AnalisarModal
          denuncia={analisando}
          onClose={() => setAnalisando(null)}
          onConcluido={() => { setAnalisando(null); carregar({ status, motivo, data_inicio: dataInicio, data_fim: dataFim }); }}
        />
      )}
    </div>
  );
}

