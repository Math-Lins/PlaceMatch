import { useState, useEffect, useCallback } from 'react';
import { listarAdminUsuarios, downloadCsv, suspenderUsuario, reativarUsuario, validarPeriodo, ApiError } from '../api';
import type { UsuarioAdmin, PaginatedResponse } from '../api';
import {
  C, FONTE_TEXTO, Botao, Campo, CamposPeriodo, BarraFiltros, CartaoTabela, Paginacao, Selo, Modal, MensagemErro,
  EstadoCarregando, EstadoErro, EstadoVazio, ESTILO_TABELA, ESTILO_TH, ESTILO_TD,
  estiloCampo, dataBR, ROTULO_TIPO_USUARIO,
} from '../ui';

const TIPOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  ...Object.entries(ROTULO_TIPO_USUARIO).map(([value, label]) => ({ value, label })),
];

// ─── Modal de suspensão ───────────────────────────────────────────────────────

function SuspenderModal({ usuario, onClose, onConcluido }: {
  usuario: UsuarioAdmin;
  onClose: () => void;
  onConcluido: (u: UsuarioAdmin) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleConfirmar = async () => {
    setErro('');
    setLoading(true);
    try {
      await suspenderUsuario(usuario.id, motivo);
      onConcluido({ ...usuario, ativo: false });
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível suspender a conta.');
      setLoading(false);
    }
  };

  return (
    <Modal titulo="Suspender conta" onFechar={onClose} podeFechar={!loading} larguraMax="440px">
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, margin: '0 0 4px', fontWeight: 700 }}>{usuario.nome}</p>
      <p style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted, margin: '0 0 20px' }}>{usuario.email}</p>
      <div style={{ marginBottom: '20px' }}>
        <Campo rotulo="Motivo (opcional)" contador={<span style={{ fontFamily: FONTE_TEXTO, fontSize: '12px', color: motivo.length >= 500 ? C.danger : C.muted }}>{motivo.length}/500</span>}>
          <input value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Comportamento abusivo" style={estiloCampo()} />
        </Campo>
      </div>
      {erro && <div style={{ marginBottom: '12px' }}><MensagemErro>{erro}</MensagemErro></div>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <Botao variante="secundario" larguraTotal onClick={onClose} disabled={loading}>Cancelar</Botao>
        <Botao variante="destrutivo" larguraTotal onClick={handleConfirmar} disabled={loading}>
          {loading ? 'Suspendendo…' : 'Suspender'}
        </Botao>
      </div>
    </Modal>
  );
}

// ─── UsuariosTab ──────────────────────────────────────────────────────────────

export default function UsuariosTab() {
  const [data, setData] = useState<PaginatedResponse<UsuarioAdmin> | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [exporting, setExporting] = useState(false);
  const [suspendendo, setSuspendendo] = useState<UsuarioAdmin | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionErro, setActionErro] = useState('');

  // Filtros
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [regiao, setRegiao] = useState('');
  const [ativo, setAtivo] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const erroPeriodo = validarPeriodo(dataInicio, dataFim);

  const carregar = useCallback((pg: number) => {
    if (validarPeriodo(dataInicio, dataFim)) { setLoading(false); return; }
    setLoading(true);
    setErro('');
    listarAdminUsuarios({
      q: q || undefined,
      tipo: tipo || undefined,
      regiao: regiao || undefined,
      ativo: ativo || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      page: pg,
    })
      .then(res => { setData(res); setLoading(false); })
      .catch((e: Error) => { setErro(e instanceof ApiError ? e.message : e.message); setLoading(false); });
  }, [q, tipo, regiao, ativo, dataInicio, dataFim]);

  useEffect(() => { carregar(page); }, [carregar, page]);

  const handleSearch = () => { setPage(1); carregar(1); };

  const handleExport = async () => {
    if (erroPeriodo) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (tipo) qs.set('tipo', tipo);
      if (regiao) qs.set('regiao', regiao);
      if (ativo) qs.set('ativo', ativo);
      if (dataInicio) qs.set('data_inicio', dataInicio);
      if (dataFim) qs.set('data_fim', dataFim);
      const str = qs.toString();
      await downloadCsv(`/api/admin/usuarios/exportar/${str ? '?' + str : ''}`, 'usuarios.csv');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível exportar o CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleReativar = async (u: UsuarioAdmin) => {
    setActionLoading(u.id);
    setActionErro('');
    try {
      await reativarUsuario(u.id);
      setData(d => d ? { ...d, results: d.results.map(r => r.id === u.id ? { ...r, ativo: true } : r) } : d);
    } catch (e: unknown) {
      setActionErro(e instanceof ApiError ? e.message : 'Não foi possível reativar a conta.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspenderConcluido = (updated: UsuarioAdmin) => {
    setSuspendendo(null);
    setData(d => d ? { ...d, results: d.results.map(r => r.id === updated.id ? updated : r) } : d);
  };

  const campo = estiloCampo({ compacto: true });
  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  return (
    <div style={{ padding: '20px 24px' }}>
      <BarraFiltros>
        <Campo rotulo="Nome ou e-mail" flex="1 1 200px">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Pesquisar..." style={campo} />
        </Campo>
        <Campo rotulo="Tipo" minWidth="170px">
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={campo}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Região" minWidth="150px">
          <input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder="Ex: Boa Viagem" style={campo} />
        </Campo>
        <Campo rotulo="Situação" minWidth="130px">
          <select value={ativo} onChange={e => setAtivo(e.target.value)} style={campo}>
            <option value="">Todas</option>
            <option value="true">Ativo</option>
            <option value="false">Suspenso</option>
          </select>
        </Campo>
        <CamposPeriodo inicio={dataInicio} fim={dataFim} onInicio={setDataInicio} onFim={setDataFim} erro={erroPeriodo} rotuloInicio="Cadastro de" />
        <Botao tamanho="compacto" onClick={handleSearch}>Buscar</Botao>
        <Botao tamanho="compacto" variante="neutro" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </Botao>
      </BarraFiltros>

      {actionErro && <div style={{ marginBottom: '12px' }}><MensagemErro>{actionErro}</MensagemErro></div>}

      {loading && <EstadoCarregando texto="Carregando usuários…" />}
      {!loading && erro && <EstadoErro mensagem={erro} onTentarNovamente={() => carregar(page)} />}
      {!loading && !erro && data && data.results.length === 0 && (
        <EstadoVazio titulo="Nenhum usuário encontrado." descricao="Ajuste os filtros e busque novamente." />
      )}

      {!loading && !erro && data && data.results.length > 0 && (
        <CartaoTabela>
          <table style={ESTILO_TABELA}>
            <thead>
              <tr>
                {['Nome', 'E-mail', 'Tipo', 'Situação', 'Região', 'Cadastro', 'Perfil', 'Ações'].map(h => <th key={h} style={ESTILO_TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.results.map(u => {
                const isAdmin = u.tipo === 'administrador';
                const isLoading = actionLoading === u.id;
                return (
                  <tr key={u.id} style={{ background: C.card, opacity: isLoading ? 0.7 : 1 }}>
                    <td style={{ ...ESTILO_TD, fontWeight: 700 }}>{u.nome}</td>
                    <td style={{ ...ESTILO_TD, color: C.muted }}>{u.email}</td>
                    <td style={ESTILO_TD}>
                      <Selo tom={u.tipo === 'oferecendo_vaga' ? 'mint' : u.tipo === 'buscando_vaga' ? 'coral' : 'neutro'}>{ROTULO_TIPO_USUARIO[u.tipo] ?? u.tipo}</Selo>
                    </td>
                    <td style={ESTILO_TD}>
                      <Selo tom={u.ativo ? 'mint' : 'perigo'}>{u.ativo ? 'Ativo' : 'Suspenso'}</Selo>
                    </td>
                    <td style={{ ...ESTILO_TD, color: C.muted }}>{u.regiao ?? '—'}</td>
                    <td style={{ ...ESTILO_TD, color: C.muted, whiteSpace: 'nowrap' }}>{dataBR(u.data_cadastro)}</td>
                    <td style={ESTILO_TD}>
                      <Selo tom={u.tem_perfil ? 'mint' : 'neutro'}>{u.tem_perfil ? 'Sim' : 'Não'}</Selo>
                    </td>
                    <td style={{ ...ESTILO_TD, whiteSpace: 'nowrap' }}>
                      {!isAdmin && (
                        u.ativo ? (
                          <Botao variante="destrutivoContorno" tamanho="mini" onClick={() => setSuspendendo(u)} disabled={isLoading}>Suspender</Botao>
                        ) : (
                          <Botao variante="secundario" tamanho="mini" onClick={() => handleReativar(u)} disabled={isLoading}>
                            {isLoading ? 'Reativando…' : 'Reativar'}
                          </Botao>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CartaoTabela>
      )}

      {!loading && !erro && data && data.count > 0 && (
        <Paginacao pagina={page} totalPaginas={totalPages} total={data.count}
          rotuloTotal={n => `${n.toLocaleString('pt-BR')} usuário${n !== 1 ? 's' : ''}`} onPagina={setPage} />
      )}

      {suspendendo && (
        <SuspenderModal usuario={suspendendo} onClose={() => setSuspendendo(null)} onConcluido={handleSuspenderConcluido} />
      )}
    </div>
  );
}
