// Afinidade por IA vista pelo usuário: painel "Por que vocês combinam", selo dos cards da Descoberta,
// temas da própria bio (Meu Perfil) e a explicação "Como a IA funciona". Usa só rotas já existentes.
import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getCompatibilidade } from './api';
import type { AnaliseIA, CompatibilidadeDetalhe, CriterioCompatibilidade, CriterioId, Tema } from './api';
import { C, FONTE_TEXTO, FONTE_TITULO, RAIO, EstadoErro, Modal, Selo, numeroBR } from './ui';

/** Afinidade mínima (0 a 1) para o selo de interesses em comum aparecer no card da Descoberta. */
export const AFINIDADE_SELO = 0.7;

// Ordem de exibição das barras (os pesos mais altos primeiro; a IA por último, em destaque).
const ORDEM: CriterioId[] = ['orcamento', 'habitos', 'regiao', 'rotina', 'moradia', 'idade', 'afinidade_ia'];
const NOME_CURTO: Record<CriterioId, string> = {
  orcamento: 'Orçamento', habitos: 'Hábitos', regiao: 'Região', rotina: 'Rotina',
  moradia: 'Moradia', idade: 'Idade', afinidade_ia: 'Afinidade de interesses (IA)',
};

const pct = (v: number) => `${numeroBR(Math.round(v * 100))}%`;

/** Selo "✨ IA" (marca o que vem do modelo de linguagem). */
export function SeloIA({ style }: { style?: React.CSSProperties }) {
  return <Selo tom="mint" style={style}><span aria-hidden="true">✨</span> IA</Selo>;
}

/** Chips de temas (ex.: "Culinária", "Música"). */
export function ChipsTemas({ temas, rotulo }: { temas: Tema[]; rotulo: string }) {
  return (
    <ul aria-label={rotulo} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', listStyle: 'none', padding: 0, margin: 0 }}>
      {temas.map(t => (
        <li key={t.id}><Selo tom="mint" grande><span aria-hidden="true">✨</span> {t.nome}</Selo></li>
      ))}
    </ul>
  );
}

// ─── "Como a IA funciona" ───────────────────────────────────────────────────────

export function BotaoComoIAFunciona() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button" onClick={() => setAberto(true)} aria-haspopup="dialog"
        style={{ background: 'none', border: 'none', padding: '10px 4px', minHeight: '44px', cursor: 'pointer', color: C.mintText, fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '3px' }}
      >
        <span aria-hidden="true">ⓘ </span>Como a IA funciona
      </button>
      {aberto && (
        <Modal titulo="Como a IA funciona" onFechar={() => setAberto(false)} larguraMax="480px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: FONTE_TEXTO, fontSize: '15px', color: C.text, lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              Um <strong>modelo de linguagem</strong> lê as biografias e compara o <strong>significado</strong> dos textos, não só as
              palavras: "adoro cozinhar para os amigos" e "faço jantares em casa" falam do mesmo interesse.
            </p>
            <p style={{ margin: 0 }}>
              O modelo roda <strong>no próprio servidor do PlaceMatch</strong>: nenhum texto sai do sistema nem vai para serviços externos.
            </p>
            <p style={{ margin: 0 }}>
              A IA mede <strong>interesses em comum</strong> (o assunto das bios) e vale 10% do score. As preferências do dia a dia,
              como festas ou silêncio, horários e organização, ficam com os critérios de <strong>hábitos e rotina</strong>.
            </p>
            <p style={{ margin: 0, color: C.muted, fontSize: '14px' }}>
              Bios com menos de 20 letras não são analisadas: nesse caso o score usa os outros 6 critérios, sem perder pontos.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Painel "Por que vocês combinam" ───────────────────────────────────────────

function LinhaCriterio({ c }: { c: CriterioCompatibilidade }) {
  const ia = c.criterio === 'afinidade_ia';
  const valor = c.valor ?? 0;
  const cor = ia ? `linear-gradient(90deg, ${C.mint}, ${C.mintDark})` : C.primary;
  return (
    <li style={{ listStyle: 'none', padding: ia ? '12px' : 0, borderRadius: RAIO.campo, background: ia ? C.mintSoft : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: FONTE_TEXTO, fontSize: '14px', fontWeight: 700, color: C.text }}>
          <span>{NOME_CURTO[c.criterio] ?? c.nome}</span>
          {ia && <SeloIA style={{ background: C.card }} />}
        </span>
        <span style={{ fontFamily: FONTE_TEXTO, fontSize: '13px', color: C.muted }}>
          <strong style={{ fontFamily: FONTE_TITULO, fontSize: '14px', color: ia ? C.mintText : C.primaryText }}>{pct(valor)}</strong>
          {' · '}peso {pct(c.peso_efetivo)}
        </span>
      </div>
      <div aria-hidden="true" style={{ height: '8px', borderRadius: '4px', background: ia ? C.card : C.border, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%`, height: '100%', borderRadius: '4px', background: cor }} />
      </div>
    </li>
  );
}

function Esqueleto() {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando a compatibilidade" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="animate-pulse" style={{ height: '36px', width: '40%', borderRadius: '8px', background: C.border }} />
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ height: '12px', width: `${50 + (i * 7) % 30}%`, borderRadius: '6px', background: C.border }} />
          <div style={{ height: '8px', width: '100%', borderRadius: '4px', background: '#F2EEEA' }} />
        </div>
      ))}
    </div>
  );
}

export function PainelPorQueCombinam({ perfilId }: { perfilId: number }) {
  const [dados, setDados] = useState<CompatibilidadeDetalhe | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    getCompatibilidade(perfilId)
      .then(d => { if (ativo) setDados(d); })
      .catch(e => { if (ativo) setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar a compatibilidade.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [perfilId]);

  useEffect(() => carregar(), [carregar]);

  const comIA = !!dados && dados.afinidade_ia !== null;
  const criterios = (dados?.criterios ?? [])
    .filter(c => c.considerado)
    .sort((a, b) => ORDEM.indexOf(a.criterio) - ORDEM.indexOf(b.criterio));

  return (
    <section aria-labelledby="titulo-por-que-combinam" data-testid="painel-por-que-combinam"
      style={{ background: C.card, borderRadius: RAIO.card, padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <h3 id="titulo-por-que-combinam" style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: 0 }}>
          Por que vocês combinam
        </h3>
        <BotaoComoIAFunciona />
      </div>

      {carregando && !dados ? <Esqueleto /> : erro ? (
        <EstadoErro mensagem={erro} onTentarNovamente={carregar} />
      ) : dados && (
        <>
          <p style={{ margin: '0 0 16px', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONTE_TITULO, fontSize: '40px', fontWeight: 800, color: C.text, lineHeight: 1 }}>{pct(dados.score)}</span>
            <span style={{ fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>de compatibilidade, somando os {criterios.length} critérios abaixo</span>
          </p>

          <ul aria-label="Compatibilidade por critério" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: 0, margin: 0 }}>
            {criterios.map(c => <LinhaCriterio key={c.criterio} c={c} />)}
          </ul>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
            {!comIA ? (
              <p role="note" style={{ margin: 0, padding: '12px 14px', borderRadius: RAIO.campo, background: '#F2EEEA', fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.text, lineHeight: 1.5 }}>
                {mensagemSemIA(dados)}
              </p>
            ) : dados.temas_em_comum.length > 0 ? (
              <>
                <p style={{ margin: '0 0 10px', fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.text }}>
                  <span aria-hidden="true">✨ </span>A IA identificou interesses em comum: <strong>{dados.temas_em_comum.map(t => t.nome).join(', ')}</strong>.
                </p>
                <ChipsTemas temas={dados.temas_em_comum} rotulo="Interesses em comum" />
              </>
            ) : (
              <p style={{ margin: 0, fontFamily: FONTE_TEXTO, fontSize: '14px', color: C.muted }}>
                A IA não encontrou interesses em comum nas biografias.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function mensagemSemIA(d: CompatibilidadeDetalhe): string {
  const motivo = (d.motivo_sem_ia ?? '').toLowerCase();
  if (motivo.includes('desligada') || (!d.ia_disponivel && !motivo.includes('curta'))) {
    return 'A análise por IA está indisponível no momento: o score usa os outros 6 critérios.';
  }
  if (motivo.startsWith('seu perfil')) {
    return 'Sua biografia ainda não foi analisada pela IA (curta demais ou salva com a IA fora do ar): o score usa os outros 6 critérios. Escreva sobre seus interesses em Meu Perfil.';
  }
  return 'Biografia curta demais para a IA analisar: o score usa os outros 6 critérios.';
}

// ─── Selo dos cards da Descoberta ───────────────────────────────────────────────

/** "✨ Interesses em comum: Culinária" quando a afinidade é alta e há tema em comum (só o 1º tema). */
export function SeloInteresses({ afinidade, temas, sobreFoto = false }: { afinidade?: number | null; temas?: Tema[]; sobreFoto?: boolean }) {
  if (afinidade == null || afinidade < AFINIDADE_SELO || !temas?.length) return null;
  return (
    <Selo tom="mint" style={{
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
      ...(sobreFoto ? { background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } : {}),
    }}>
      <span aria-hidden="true">✨</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Interesses em comum: {temas[0].nome}</span>
    </Selo>
  );
}

// ─── Meu Perfil: temas da própria bio ───────────────────────────────────────────

export function TemasDaMinhaBio({ analise }: { analise?: AnaliseIA | null }) {
  const dica = 'Escreva sobre seus interesses para a IA encontrar pessoas com afinidade.';
  let conteudo: React.ReactNode;
  if (!analise) {
    conteudo = <p style={estiloTexto(C.muted)}>{dica}</p>;
  } else if (analise.situacao === 'bio_curta') {
    conteudo = (
      <p role="note" style={estiloTexto(C.text)}>
        Sua bio está curta demais para a IA analisar ({analise.caracteres_uteis} de no mínimo {analise.minimo_caracteres} letras).
        Enquanto isso, o score usa os outros 6 critérios. {dica}
      </p>
    );
  } else if (analise.situacao === 'pendente') {
    conteudo = <p role="note" style={estiloTexto(C.text)}>A análise da sua bio ainda está pendente: a IA estava indisponível quando ela foi salva. Ela será analisada em breve.</p>;
  } else if (analise.situacao === 'ia_desligada') {
    conteudo = <p role="note" style={estiloTexto(C.muted)}>A análise por IA está desligada no momento.</p>;
  } else if (analise.temas.length === 0) {
    conteudo = <p style={estiloTexto(C.muted)}>A IA analisou sua bio, mas não reconheceu nenhum dos temas de convivência. {dica}</p>;
  } else {
    conteudo = (
      <>
        <ChipsTemas temas={analise.temas} rotulo="Temas identificados na sua bio" />
        <p style={{ ...estiloTexto(C.muted), marginTop: '12px' }}>{dica}</p>
      </>
    );
  }
  return (
    <section aria-labelledby="titulo-temas-bio" data-testid="temas-minha-bio"
      style={{ background: C.card, borderRadius: RAIO.card, padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <h3 id="titulo-temas-bio" style={{ fontFamily: FONTE_TITULO, fontSize: '16px', fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          Temas que a IA identificou na sua bio <SeloIA />
        </h3>
        <BotaoComoIAFunciona />
      </div>
      {conteudo}
    </section>
  );
}

function estiloTexto(cor: string): React.CSSProperties {
  return { margin: 0, fontFamily: FONTE_TEXTO, fontSize: '14px', color: cor, lineHeight: 1.6 };
}
