import React, { useState, useEffect, useCallback } from 'react';
import { listarLogs, downloadCsv, validarPeriodo, ApiError } from '../api';
import type { LogEntry, PaginatedResponse } from '../api';
import {
  C, FONTE_TEXTO, Botao, Campo, CamposPeriodo, BarraFiltros, CartaoTabela, Paginacao, Selo,
  EstadoCarregando, EstadoErro, EstadoVazio, ESTILO_TABELA, ESTILO_TH, ESTILO_TD,
  estiloCampo, dataHoraBR, rotuloChave, rotuloValor, ROTULO_ENTIDADE,
} from '../ui';

// Mesmos códigos de LogOperacao.ACAO_CHOICES (backend/logs/models.py).
const ACOES: { value: string; label: string }[] = [
  { value: '', label: 'Todas as ações' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGIN_FALHA', label: 'Login com falha' },
  { value: 'CADASTRO', label: 'Cadastro' },
  { value: 'PERFIL_CRIADO', label: 'Perfil criado' },
  { value: 'PERFIL_EDITADO', label: 'Perfil editado' },
  { value: 'PERFIL_EXCLUIDO', label: 'Perfil excluído' },
  { value: 'CURTIDA', label: 'Curtida' },
  { value: 'RECUSA', label: 'Recusa' },
  { value: 'MATCH_CRIADO', label: 'Match criado' },
  { value: 'MENSAGEM_ENVIADA', label: 'Mensagem enviada' },
  { value: 'RELATORIO_EXPORTADO', label: 'Relatório exportado' },
  { value: 'DENUNCIA_CRIADA', label: 'Denúncia criada' },
  { value: 'DENUNCIA_RESOLVIDA', label: 'Denúncia resolvida' },
  { value: 'USUARIO_SUSPENSO', label: 'Usuário suspenso' },
  { value: 'USUARIO_REATIVADO', label: 'Usuário reativado' },
];

// A API filtra a entidade pelo nome exato gravado no log.
const ENTIDADES = [{ value: '', label: 'Todas' }, ...Object.entries(ROTULO_ENTIDADE).map(([value, label]) => ({ value, label }))];

/** Tom do selo por tipo de ação (alertas em vermelho, eventos positivos em mint). */
function tomDaAcao(acao: string): 'coral' | 'mint' | 'neutro' | 'perigo' {
  if (/FALHA|SUSPENSO|EXCLUIDO|DENUNCIA_CRIADA/.test(acao)) return 'perigo';
  if (/MATCH|CADASTRO|CRIADO|REATIVADO|RESOLVIDA/.test(acao)) return 'mint';
  if (/CURTIDA|MENSAGEM/.test(acao)) return 'coral';
  return 'neutro';
}

function ExpandedDetails({ detalhes }: { detalhes: Record<string, unknown> }) {
  const entries = Object.entries(detalhes ?? {});
  if (entries.length === 0) return <span style={{ color: C.muted }}>Sem detalhes adicionais.</span>;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', margin: 0, fontFamily: FONTE_TEXTO, fontSize: '14px' }}>
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt style={{ fontWeight: 700, color: C.text }}>{rotuloChave(k)}</dt>
          <dd style={{ margin: 0, color: C.muted, wordBreak: 'break-word' }}>{rotuloValor(k, v)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export default function LogsTab() {
  const [data, setData] = useState<PaginatedResponse<LogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filtros
  const [acao, setAcao] = useState('');
  const [usuario, setUsuario] = useState('');
  const [entidade, setEntidade] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const erroPeriodo = validarPeriodo(dataInicio, dataFim);

  const carregar = useCallback((pg: number) => {
    if (validarPeriodo(dataInicio, dataFim)) { setLoading(false); return; }
    setLoading(true);
    setErro('');
    listarLogs({ acao: acao || undefined, usuario: usuario || undefined, entidade: entidade || undefined, data_inicio: dataInicio || undefined, data_fim: dataFim || undefined, page: pg })
      .then(res => { setData(res); setLoading(false); })
      .catch((e: Error) => { setErro(e instanceof ApiError ? e.message : e.message); setLoading(false); });
  }, [acao, usuario, entidade, dataInicio, dataFim]);

  useEffect(() => { carregar(page); }, [carregar, page]);

  const handleSearch = () => { setPage(1); carregar(1); };

  const handleExport = async () => {
    if (erroPeriodo) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (acao) qs.set('acao', acao);
      if (usuario) qs.set('usuario', usuario);
      if (entidade) qs.set('entidade', entidade);
      if (dataInicio) qs.set('data_inicio', dataInicio);
      if (dataFim) qs.set('data_fim', dataFim);
      const str = qs.toString();
      await downloadCsv(`/api/admin/logs/exportar/${str ? '?' + str : ''}`, 'logs.csv');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível exportar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  const campo = estiloCampo({ compacto: true });
  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  return (
    <div style={{ padding: '20px 24px' }}>
      <BarraFiltros>
        <Campo rotulo="Ação" minWidth="190px">
          <select value={acao} onChange={e => setAcao(e.target.value)} style={campo}>
            {ACOES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Usuário" minWidth="180px">
          <input value={usuario} onChange={e => setUsuario(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Nome ou e-mail" style={campo} />
        </Campo>
        <Campo rotulo="Entidade" minWidth="150px">
          <select value={entidade} onChange={e => setEntidade(e.target.value)} style={campo}>
            {ENTIDADES.map(en => <option key={en.value} value={en.value}>{en.label}</option>)}
          </select>
        </Campo>
        <CamposPeriodo inicio={dataInicio} fim={dataFim} onInicio={setDataInicio} onFim={setDataFim} erro={erroPeriodo} />
        <Botao tamanho="compacto" onClick={handleSearch}>Buscar</Botao>
        <Botao tamanho="compacto" variante="neutro" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </Botao>
      </BarraFiltros>

      {loading && <EstadoCarregando texto="Carregando logs…" />}
      {!loading && erro && <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(page)} />}
      {!loading && !erro && data && data.results.length === 0 && (
        <EstadoVazio titulo="Nenhum log encontrado." descricao="Ajuste os filtros e busque novamente." />
      )}

      {!loading && !erro && data && data.results.length > 0 && (
        <CartaoTabela>
          <table style={ESTILO_TABELA}>
            <thead>
              <tr>
                {['Data e hora', 'Usuário', 'Ação', 'Entidade', 'IP', ''].map(h => <th key={h} style={ESTILO_TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.results.map(log => {
                const aberto = expanded === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      style={{ cursor: 'pointer', background: aberto ? C.primarySoft : C.card }}
                      onClick={() => setExpanded(aberto ? null : log.id)}
                      aria-expanded={aberto}
                    >
                      <td style={{ ...ESTILO_TD, whiteSpace: 'nowrap' }}>{dataHoraBR(log.data_hora, true)}</td>
                      <td style={{ ...ESTILO_TD, color: log.usuario ? C.text : C.muted }}>
                        {log.usuario
                          ? <>
                              <span style={{ fontWeight: 700 }}>{log.usuario.nome}</span>
                              {log.usuario.nome !== log.usuario.email && <span style={{ display: 'block', fontSize: '13px', color: C.muted }}>{log.usuario.email}</span>}
                            </>
                          : 'Usuário removido'}
                      </td>
                      <td style={ESTILO_TD}><Selo tom={tomDaAcao(log.acao)}>{log.acao_label}</Selo></td>
                      <td style={{ ...ESTILO_TD, color: C.muted }}>
                        {log.entidade ? (ROTULO_ENTIDADE[log.entidade] ?? log.entidade) : '—'}{log.entidade_id !== null ? ` nº ${log.entidade_id}` : ''}
                      </td>
                      <td style={{ ...ESTILO_TD, color: C.muted, whiteSpace: 'nowrap' }}>{log.ip ?? '—'}</td>
                      <td style={{ ...ESTILO_TD, textAlign: 'center', color: C.muted, fontSize: '12px', width: '44px' }} aria-label={aberto ? 'Recolher detalhes' : 'Ver detalhes'}>
                        {aberto ? '▲' : '▼'}
                      </td>
                    </tr>
                    {aberto && (
                      <tr style={{ background: C.primarySoft }}>
                        <td colSpan={6} style={{ ...ESTILO_TD, padding: '12px 24px 16px' }}>
                          <ExpandedDetails detalhes={log.detalhes} />
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

      {!loading && !erro && data && data.count > 0 && (
        <Paginacao pagina={page} totalPaginas={totalPages} total={data.count}
          rotuloTotal={n => `${n.toLocaleString('pt-BR')} registro${n !== 1 ? 's' : ''}`} onPagina={setPage} />
      )}
    </div>
  );
}
