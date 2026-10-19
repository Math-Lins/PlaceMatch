import { useState, useEffect, useRef } from 'react';
import {
  login as apiLogin,
  registrar as apiRegistrar,
  buscarMeuUsuario,
  listarPerfis,
  criarPerfil as apiCriarPerfil,
  atualizarPerfil as apiAtualizarPerfil,
  excluirPerfil as apiExcluirPerfil,
  logout,
  setOn401,
  ApiError,
  listarDescoberta,
  enviarCurtida,
  listarMatches,
  listarConversas,
  listarMensagens,
  enviarMensagem,
} from './api';
import type { Perfil as PerfilAPI, PerfilDescoberto, PerfilBasico, MatchData, Conversa, MensagemAPI } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'welcome'
  | 'login'
  | 'register'
  | 'profile-create'
  | 'discovery'
  | 'profile-detail'
  | 'match'
  | 'matches'
  | 'chat'
  | 'profile'
  | 'filters'
  | 'notifications';

type Tab = 'discovery' | 'notifications' | 'matches' | 'profile';

interface Profile {
  id: number;
  name: string;
  age: number;
  region: string;
  bio: string;
  compat: number;
  photo: string;
  tags: string[];
  budget: string;
  smoker: boolean;
  pets: boolean;
  organized: number;
  messy: number;
  horario: 'madrugador' | 'noturno' | 'flexivel';
  ruido: number;
  social: number;
  visitas: 'raramente' | 'as_vezes' | 'frequentemente';
  tipoImovel: 'apartamento' | 'casa' | 'republica' | 'indiferente';
  qtdMoradores: number;
  lastMsg?: string;
  lastTime?: string;
  // campos de anúncio (oferecendo_vaga)
  tipo?: 'buscando_vaga' | 'oferecendo_vaga';
  tituloAnuncio?: string;
  descricaoImovel?: string;
  fotosImovel?: string[];
  fotoPerfilUrl?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROFILES: Profile[] = [
  {
    id: 1,
    name: 'Ana Luísa',
    age: 23,
    region: 'Vila Madalena',
    bio: 'Estudante de arquitetura, adoro cozinhar aos fins de semana e tenho uma gata chamada Biscuit. Procuro alguém tranquilo e que respeite espaço pessoal.',
    compat: 89,
    photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1000&fit=crop&auto=format',
    tags: ['Não fumante', 'Aceita pets', 'Madrugadora'],
    budget: 'R$ 800 – R$ 1.400',
    smoker: false,
    pets: true,
    organized: 4,
    messy: 2,
    horario: 'madrugador',
    ruido: 2,
    social: 3,
    visitas: 'as_vezes',
    tipoImovel: 'apartamento',
    qtdMoradores: 2,
    lastMsg: 'Oi! Vi que você também é da Vila Madalena 😊',
    lastTime: '14:32',
  },
  {
    id: 2,
    name: 'Pedro Henrique',
    age: 26,
    region: 'Pinheiros',
    bio: 'Dev front-end trabalhando remoto. Sou tranquilo, gosto de música lo-fi e cuido bem dos espaços comuns. Não fumo e prefiro ambientes organizados.',
    compat: 74,
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop&auto=format',
    tags: ['Não fumante', 'Sem pets', 'Noturno'],
    budget: 'R$ 1.000 – R$ 1.800',
    smoker: false,
    pets: false,
    organized: 5,
    messy: 1,
    horario: 'noturno',
    ruido: 1,
    social: 2,
    visitas: 'raramente',
    tipoImovel: 'apartamento',
    qtdMoradores: 2,
    lastMsg: 'Que legal, você trabalha na área de tech também?',
    lastTime: '10:15',
  },
  {
    id: 3,
    name: 'Camila Souza',
    age: 24,
    region: 'Consolação',
    bio: 'Mestranda em comunicação, vivia em intercâmbio até ano passado. Gosto de ambientes aconchegantes, faço yoga e tenho um cachorrinho chamado Tofu.',
    compat: 92,
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&auto=format',
    tags: ['Não fumante', 'Aceita pets', 'Flexível'],
    budget: 'R$ 900 – R$ 1.600',
    smoker: false,
    pets: true,
    organized: 3,
    messy: 3,
    horario: 'flexivel',
    ruido: 3,
    social: 4,
    visitas: 'frequentemente',
    tipoImovel: 'casa',
    qtdMoradores: 3,
    lastMsg: 'Adorei seu perfil! A gente tem muito em comum',
    lastTime: 'Ontem',
  },
];

const MY_PROFILE: Profile = {
  id: 0,
  name: 'Você',
  age: 25,
  region: 'Jardins',
  bio: 'Procuro um lugar tranquilo perto do trabalho. Gosto de cozinhar, sou organizado e respeito muito o espaço dos outros.',
  compat: 100,
  photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=1000&fit=crop&auto=format',
  tags: ['Não fumante', 'Sem pets', 'Organizado'],
  budget: 'R$ 800 – R$ 1.500',
  smoker: false,
  pets: false,
  organized: 4,
  messy: 2,
  horario: 'madrugador',
  ruido: 2,
  social: 3,
  visitas: 'as_vezes',
  tipoImovel: 'apartamento',
  qtdMoradores: 2,
};

// Fotos usadas enquanto o backend não tem campo de foto no perfil
const PLACEHOLDER_PHOTOS = [
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&h=1000&fit=crop&auto=format',
];

const HORARIO_LABEL: Record<string, string> = {
  madrugador: 'Madrugador(a)',
  noturno: 'Noturno(a)',
  flexivel: 'Horário flexível',
};

const VISITAS_LABEL: Record<string, string> = {
  raramente: 'Poucas visitas',
  as_vezes: 'Visitas ocasionais',
  frequentemente: 'Recebe visitas',
};

const IMOVEL_LABEL: Record<string, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  republica: 'República',
  indiferente: 'Indiferente',
};

function buildTags(p: {
  fumante: boolean; aceita_pets: boolean; nivel_organizacao: number;
  tolerancia_bagunca: number; perfil_horario: string; nivel_social: number;
}): string[] {
  const tags: string[] = [];
  tags.push(p.fumante ? 'Fumante' : 'Não fumante');
  tags.push(p.aceita_pets ? 'Aceita pets' : 'Sem pets');
  if (p.nivel_organizacao >= 4) tags.push('Organizado(a)');
  else if (p.tolerancia_bagunca >= 4) tags.push('Descontraído(a)');
  tags.push(HORARIO_LABEL[p.perfil_horario] ?? p.perfil_horario);
  if (p.nivel_social >= 4) tags.push('Social');
  else if (p.nivel_social <= 2) tags.push('Reservado(a)');
  return tags;
}

function perfilDescobertoParaProfile(p: PerfilDescoberto): Profile {
  const min = Number(p.orcamento_min);
  const max = Number(p.orcamento_max);
  const budget = min === max
    ? `R$ ${min.toLocaleString('pt-BR')}`
    : `R$ ${min.toLocaleString('pt-BR')} – ${max.toLocaleString('pt-BR')}`;
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: p.bio,
    compat: Math.round(p.score * 100),
    photo: p.fotos_imovel?.[0] ?? PLACEHOLDER_PHOTOS[p.id % PLACEHOLDER_PHOTOS.length],
    tags: buildTags(p),
    budget,
    smoker: p.fumante,
    pets: p.aceita_pets,
    organized: p.nivel_organizacao,
    messy: p.tolerancia_bagunca,
    horario: p.perfil_horario,
    ruido: p.nivel_ruido,
    social: p.nivel_social,
    visitas: p.aceita_visitas,
    tipoImovel: p.tipo_imovel,
    qtdMoradores: p.qtd_moradores,
    tipo: p.tipo,
    tituloAnuncio: p.titulo_anuncio ?? undefined,
    descricaoImovel: p.descricao_imovel ?? undefined,
    fotosImovel: p.fotos_imovel,
    fotoPerfilUrl: p.foto_perfil_url ?? undefined,
  };
}

function perfilBasicoParaProfile(p: PerfilBasico | undefined, score: number): Profile {
  if (!p) return PROFILES[0];
  const min = Number(p.orcamento_min);
  const max = Number(p.orcamento_max);
  const budget = min === max
    ? `R$ ${min.toLocaleString('pt-BR')}`
    : `R$ ${min.toLocaleString('pt-BR')} – ${max.toLocaleString('pt-BR')}`;
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: p.bio,
    compat: Math.round(score * 100),
    photo: p.fotos_imovel?.[0] ?? PLACEHOLDER_PHOTOS[p.id % PLACEHOLDER_PHOTOS.length],
    tags: buildTags(p),
    budget,
    smoker: p.fumante,
    pets: p.aceita_pets,
    organized: p.nivel_organizacao,
    messy: p.tolerancia_bagunca,
    horario: p.perfil_horario,
    ruido: p.nivel_ruido,
    social: p.nivel_social,
    visitas: p.aceita_visitas,
    tipoImovel: p.tipo_imovel,
    qtdMoradores: p.qtd_moradores,
    tipo: p.tipo,
    tituloAnuncio: p.titulo_anuncio ?? undefined,
    descricaoImovel: p.descricao_imovel ?? undefined,
    fotosImovel: p.fotos_imovel,
    fotoPerfilUrl: p.foto_perfil_url ?? undefined,
  };
}


// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  primary: '#E06B45',
  primaryLight: '#F0896A',
  primaryDark: '#C4512E',
  mint: '#5DBF96',
  mintLight: '#80D4B0',
  bg: '#FBF8F5',
  card: '#FFFFFF',
  text: '#2A2420',
  muted: '#8A7E78',
  border: '#EDE8E3',
  danger: '#E05555',
};

// ─── Shared UI Components ─────────────────────────────────────────────────────


function Btn({ label, onClick, outline = false, danger = false, small = false, style: extraStyle }: {
  label: string; onClick?: () => void; outline?: boolean; danger?: boolean; small?: boolean; style?: React.CSSProperties;
}) {
  const bg = danger ? C.danger : outline ? 'transparent' : C.primary;
  const color = outline ? (danger ? C.danger : C.primary) : '#fff';
  const border = outline ? `2px solid ${danger ? C.danger : C.primary}` : 'none';
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: small ? '10px 16px' : '15px 16px',
      background: bg, color, border, borderRadius: '16px',
      fontSize: small ? '14px' : '16px', fontWeight: 700,
      fontFamily: 'Outfit,sans-serif', cursor: 'pointer', minHeight: '44px',
      transition: 'opacity 0.15s', ...extraStyle,
    }}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      onMouseDown={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseUp={e => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </button>
  );
}

function Input({ label, type = 'text', placeholder, value, onChange, error }: {
  label: string; type?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; error?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif' }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${error ? C.danger : C.border}`,
          background: C.card, fontSize: '15px', fontFamily: 'Nunito,sans-serif', color: C.text,
          outline: 'none',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = C.primary)}
        onBlur={e => (e.currentTarget.style.borderColor = error ? C.danger : C.border)}
      />
      {error && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif' }}>{error}</span>}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  const isMint = label.includes('Aceita') || label.includes('Organiz') || label.includes('Tranquil');
  return (
    <span style={{
      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
      background: isMint ? '#E6F7F0' : '#FFF0EB',
      color: isMint ? C.mint : C.primary,
      fontFamily: 'Nunito,sans-serif', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function CompatBadge({ value, large = false }: { value: number; large?: boolean }) {
  const color = value >= 85 ? C.mint : value >= 70 ? C.primary : '#E0A840';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: large ? '6px 14px' : '4px 10px',
      borderRadius: '20px', background: `${color}20`,
      fontSize: large ? '16px' : '13px', fontWeight: 700,
      color, fontFamily: 'Outfit,sans-serif',
    }}>
      ❤️ {value}% compatível
    </span>
  );
}

const COMPAT_LEVELS = [
  { min: 0,  max: 20,  label: 'Baixa compatibilidade',    color: '#E05555' },
  { min: 20, max: 40,  label: 'Compatibilidade regular',  color: '#E0A840' },
  { min: 40, max: 60,  label: 'Boa compatibilidade',      color: C.primary },
  { min: 60, max: 80,  label: 'Alta compatibilidade',     color: '#5DBF96' },
  { min: 80, max: 101, label: 'Combinação perfeita',      color: '#2EA874' },
];

function getCompatLevel(value: number) {
  return COMPAT_LEVELS.find(l => value >= l.min && value < l.max) ?? COMPAT_LEVELS[4];
}

function CompatMeter({ value }: { value: number }) {
  const level = getCompatLevel(value);
  const filledBars = COMPAT_LEVELS.indexOf(level) + 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: level.color }}>
          {level.label}
        </span>
        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 800, color: level.color }}>
          {value}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: '3px' }}>
        {COMPAT_LEVELS.map((l, i) => (
          <div key={i} style={{
            flex: 1, height: '6px', borderRadius: '3px',
            background: i < filledBars ? level.color : C.border,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}

function ImagemComFallback({ src, alt, style, tipo = 'imovel', iniciais = '' }: {
  src?: string | null;
  alt: string;
  style?: React.CSSProperties;
  tipo?: 'imovel' | 'avatar';
  iniciais?: string;
}) {
  const [erro, setErro] = useState(false);
  const base: React.CSSProperties = {
    ...style,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.mint} 100%)`,
  };
  if (!src || erro) {
    return tipo === 'avatar' ? (
      <div style={{ ...base, color: '#fff', fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: '11px' }}>
        {(iniciais || alt.charAt(0) || '?').toUpperCase()}
      </div>
    ) : (
      <div style={base}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22" fill="rgba(255,255,255,0)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5"/>
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setErro(true)} />;
}

function ScaleBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: '32px', height: '6px', borderRadius: '3px',
          background: i <= value ? C.primary : C.border,
        }}/>
      ))}
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────

function BottomNav({ tab, setTab, notifsCount }: { tab: Tab; setTab: (t: Tab) => void; notifsCount: number }) {
  const items: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'discovery', label: 'Descoberta',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
    },
    {
      id: 'notifications', label: 'Notificações',
      icon: (a) => (
        <div style={{ position: 'relative', width: '22px', height: '22px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {notifsCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-6px',
              background: C.primary, color: '#fff', borderRadius: '10px',
              padding: '0 4px', fontSize: '9px', fontWeight: 800,
              fontFamily: 'Outfit,sans-serif', lineHeight: '14px',
              minWidth: '14px', textAlign: 'center',
            }}>
              {notifsCount > 9 ? '9+' : notifsCount}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'matches', label: 'Matches',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
    },
    {
      id: 'profile', label: 'Perfil',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];
  return (
    <div style={{
      background: C.card, borderTop: `1px solid ${C.border}`,
      display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => setTab(item.id)} style={{
          flex: 1, padding: '12px 0 4px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          {item.icon(tab === item.id)}
          <span style={{ fontSize: '10px', fontWeight: 600, color: tab === item.id ? C.primary : C.muted, fontFamily: 'Nunito,sans-serif' }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell({ screen, tab, setTab, nav, onLogout, notifsCount, children }: {
  screen: Screen;
  tab: Tab;
  setTab: (t: Tab) => void;
  nav: (s: Screen) => void;
  onLogout: () => void;
  notifsCount: number;
  children: React.ReactNode;
}) {
  const isInternal = ['discovery', 'profile-detail', 'match', 'matches', 'chat', 'profile', 'notifications'].includes(screen);
  const isTabScreen = ['discovery', 'matches', 'profile', 'notifications'].includes(screen);

  if (!isInternal) return <>{children}</>;

  const handleTabChange = (t: Tab) => { setTab(t); nav(t as Screen); };

  const sideItems: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'discovery', label: 'Descoberta',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
    },
    {
      id: 'notifications', label: 'Notificações',
      icon: (a) => (
        <div style={{ position: 'relative', width: '22px', height: '22px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {notifsCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-6px',
              background: C.primary, color: '#fff', borderRadius: '10px',
              padding: '0 4px', fontSize: '9px', fontWeight: 800,
              fontFamily: 'Outfit,sans-serif', lineHeight: '14px',
              minWidth: '14px', textAlign: 'center',
            }}>
              {notifsCount > 9 ? '9+' : notifsCount}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'matches', label: 'Matches',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
    },
    {
      id: 'profile', label: 'Perfil',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? C.primary : 'none'} stroke={a ? C.primary : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Sidebar — visível apenas em lg */}
      <aside
        className="hidden lg:flex flex-col bg-card border-r border-border"
        style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '260px', zIndex: 40 }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
                <path d="M18 6 L6 14 L6 28 L14 28 L14 20 L22 20 L22 28 L30 28 L30 14 Z" fill="white" opacity="0.9"/>
                <circle cx="24" cy="12" r="5" fill="white"/>
                <path d="M20 11 C20 8.8 22 7 24 7 C26 7 28 8.8 28 11 C28 14 24 17 24 17 C24 17 20 14 20 11Z" fill={C.primary}/>
              </svg>
            </div>
            <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 800, color: C.text }}>PlaceMatch</span>
          </div>
        </div>

        {/* Itens de navegação */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {sideItems.map(item => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '14px', cursor: 'pointer',
                  border: 'none', width: '100%', textAlign: 'left',
                  background: active ? `${C.primary}18` : 'transparent',
                  color: active ? C.primary : C.muted,
                  fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700,
                }}
              >
                {item.icon(active)}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sair */}
        <div style={{ padding: '16px 12px 24px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', borderRadius: '14px', cursor: 'pointer',
              border: 'none', width: '100%', textAlign: 'left',
              background: 'transparent', color: C.muted,
              fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Área principal — offset da sidebar em lg */}
      <div className="flex-1 flex flex-col lg:ml-[260px]">
        {children}
      </div>

      {/* BottomNav — mobile/tablet, apenas nas 3 telas de aba */}
      {isTabScreen && (
        <div
          className="lg:hidden"
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}
        >
          <BottomNav tab={tab} setTab={handleTabChange} notifsCount={notifsCount} />
        </div>
      )}
    </div>
  );
}

// ─── Brand Panel (painel de marca compartilhado nas telas pré-login) ─────────

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-center items-center lg:w-[480px] flex-shrink-0 p-12"
      style={{ background: `linear-gradient(160deg, ${C.primaryDark} 0%, ${C.primary} 55%, ${C.mint} 100%)` }}
    >
      <div style={{ color: '#fff', textAlign: 'center', maxWidth: '380px', width: '100%' }}>
        <div style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.2)', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', backdropFilter: 'blur(10px)' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M18 6 L6 14 L6 28 L14 28 L14 20 L22 20 L22 28 L30 28 L30 14 Z" fill="white" opacity="0.9"/>
            <circle cx="24" cy="12" r="5" fill="white"/>
            <path d="M20 11 C20 8.8 22 7 24 7 C26 7 28 8.8 28 11 C28 14 24 17 24 17 C24 17 20 14 20 11Z" fill="rgba(255,255,255,0.6)"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '40px', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-1px' }}>PlaceMatch</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.85, margin: '0 0 28px' }}>Seu lar, sua turma</p>
        <div style={{ borderRadius: '24px', overflow: 'hidden', height: '260px', marginBottom: '24px' }}>
          <img
            src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=520&fit=crop&auto=format"
            alt="Pessoas convivendo em apartamento aconchegante"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 600, lineHeight: 1.4, opacity: 0.95 }}>
          Encontre quem combina com seu jeito de morar
        </p>
      </div>
    </div>
  );
}

// ─── Screen: Welcome ──────────────────────────────────────────────────────────

function WelcomeScreen({ nav }: { nav: (s: Screen) => void }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />

      {/* Painel de CTA */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile / tablet: logo + foto */}
        <div className="lg:hidden flex flex-col items-center w-full max-w-sm mb-8">
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '72px', height: '72px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(224,107,69,0.35)' }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 6 L6 14 L6 28 L14 28 L14 20 L22 20 L22 28 L30 28 L30 14 Z" fill="white" opacity="0.9"/>
                <circle cx="24" cy="12" r="5" fill="white"/>
                <path d="M20 11 C20 8.8 22 7 24 7 C26 7 28 8.8 28 11 C28 14 24 17 24 17 C24 17 20 14 20 11Z" fill="#E06B45"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '32px', fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.5px' }}>PlaceMatch</h1>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 600, color: C.primary, margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Seu lar, sua turma</p>
          </div>
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ borderRadius: '28px', overflow: 'hidden', height: '240px', position: 'relative' }}>
              <img
                src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&auto=format"
                alt="Pessoas convivendo em apartamento aconchegante"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.5) 0%, transparent 60%)' }}/>
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>
                Encontre quem combina com seu jeito de morar
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: título acima dos botões */}
        <div className="hidden lg:block mb-8 text-center">
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>Bem-vindo!</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: 0 }}>Entre ou crie sua conta para começar</p>
        </div>

        <div className="w-full max-w-sm" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Btn label="Entrar" onClick={() => nav('login')} />
          <Btn label="Criar conta" onClick={() => nav('register')} outline />
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Login ─────────────────────────────────────────────────────────────

function LoginScreen({ nav, onLoginSuccess, loginMsg }: { nav: (s: Screen) => void; onLoginSuccess: () => Promise<void>; loginMsg?: string }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleEntrar = async () => {
    setErro('');
    const erros: Record<string, string> = {};
    if (!email.trim()) erros.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
    if (!senha) erros.senha = 'Informe sua senha.';
    setFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setLoading(true);
    try {
      await apiLogin(email.trim(), senha);
      await onLoginSuccess();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        setErro(e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'E-mail ou senha incorretos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600 }}>Voltar</span>
          </button>

          {loginMsg && (
            <div style={{ background: `${C.danger}12`, border: `1px solid ${C.danger}40`, borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, margin: 0 }}>{loginMsg}</p>
            </div>
          )}
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Boas-vindas de volta!</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: '0 0 32px' }}>Entre com sua conta para continuar</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} />
            <Input label="Senha" type="password" placeholder="••••••••" value={senha} onChange={setSenha} error={fieldErrors.senha} />
          </div>

          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: '14px', fontWeight: 600, fontFamily: 'Nunito,sans-serif', padding: '16px 0 0', display: 'block' }}>
            Esqueci minha senha
          </button>

          {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '8px', textAlign: 'center' }}>{erro}</p>}

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Btn label={loading ? 'Aguarde...' : 'Entrar'} onClick={handleEntrar} />
          </div>

          <p style={{ textAlign: 'center', marginTop: '24px', fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>
            Ainda não tenho uma conta?{' '}
            <button onClick={() => nav('register')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontWeight: 700, fontSize: '14px', fontFamily: 'Nunito,sans-serif', padding: 0 }}>
              Criar conta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Register ─────────────────────────────────────────────────────────

function RegisterScreen({ nav, onLoginSuccess }: { nav: (s: Screen) => void; onLoginSuccess: () => Promise<void> }) {
  const [role, setRole] = useState<'looking' | 'has' | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleContinuar = async () => {
    setErro('');
    const erros: Record<string, string> = {};
    if (!nome.trim() || nome.trim().length < 2) erros.username = 'Nome deve ter pelo menos 2 caracteres.';
    if (!email.trim()) erros.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
    if (!senha) erros.password = 'Informe uma senha.';
    else if (senha.length < 8) erros.password = 'A senha deve ter no mínimo 8 caracteres.';
    if (senha && confirmSenha && senha !== confirmSenha) erros.confirmSenha = 'As senhas não coincidem.';
    if (!role) erros.role = 'Selecione se você está procurando ou oferecendo um lugar.';
    setFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setLoading(true);
    try {
      await apiRegistrar({
        username: nome.trim(),
        email: email.trim(),
        password: senha,
        tipo: role === 'looking' ? 'buscando_vaga' : 'oferecendo_vaga',
      });
      await apiLogin(email.trim(), senha);
      await onLoginSuccess();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        if (Object.keys(e.fieldErrors).length === 0) setErro(e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'Erro ao criar conta.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600 }}>Voltar</span>
          </button>

          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Criar conta</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: '0 0 28px' }}>Vamos te conectar ao lugar certo</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input label="Nome completo" placeholder="Seu nome" value={nome} onChange={setNome} error={fieldErrors.username} />
            <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={setSenha} error={fieldErrors.password} />
              <Input label="Confirmar senha" type="password" placeholder="Repita a senha" value={confirmSenha} onChange={setConfirmSenha} error={fieldErrors.confirmSenha} />
            </div>
          </div>

          <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, marginTop: '20px', marginBottom: '10px' }}>Você está:</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['looking', 'has'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)} style={{
                flex: 1, padding: '13px', borderRadius: '14px', cursor: 'pointer',
                border: `2px solid ${role === r ? C.primary : fieldErrors.role ? C.danger : C.border}`,
                background: role === r ? `${C.primary}12` : C.card,
                color: role === r ? C.primary : C.muted,
                fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700, lineHeight: 1.3,
              }}>
                {r === 'looking' ? '🔍 Procuro um lugar' : '🏠 Tenho um lugar disponível'}
              </button>
            ))}
          </div>
          {fieldErrors.role && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '6px' }}>{fieldErrors.role}</span>}

          {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '12px', textAlign: 'center' }}>{erro}</p>}

          <div style={{ marginTop: '28px' }}>
            <Btn label={loading ? 'Aguarde...' : 'Continuar'} onClick={handleContinuar} />
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>
            Já tenho conta?{' '}
            <button onClick={() => nav('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontWeight: 700, fontSize: '14px', fontFamily: 'Nunito,sans-serif', padding: 0 }}>
              Entrar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Profile Create ───────────────────────────────────────────────────

function ProfileCreateScreen({ nav, onPerfilCriado }: { nav: (s: Screen) => void; onPerfilCriado: (p: PerfilAPI) => void }) {
  const TOTAL_STEPS = 4;
  const [step, setStep] = useState(1);
  // Etapa 1
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');
  const [regiao, setRegiao] = useState('');
  const [bio, setBio] = useState('');
  // Etapa 2 — moradia
  const [orcamentoMin, setOrcamentoMin] = useState('');
  const [orcamentoMax, setOrcamentoMax] = useState('');
  const [tipoImovel, setTipoImovel] = useState<'apartamento'|'casa'|'republica'|'indiferente'|null>(null);
  const [qtdMoradores, setQtdMoradores] = useState<number|null>(null);
  // Etapa 3 — convivência
  const [smoker, setSmoker] = useState<boolean | null>(null);
  const [pets, setPets] = useState<boolean | null>(null);
  const [visitas, setVisitas] = useState<'raramente'|'as_vezes'|'frequentemente'|null>(null);
  const [horario, setHorario] = useState<'madrugador'|'noturno'|'flexivel'|null>(null);
  // Etapa 4 — escalas
  const [organized, setOrganized] = useState(0);
  const [messy, setMessy] = useState(0);
  const [ruido, setRuido] = useState(0);
  const [social, setSocial] = useState(0);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validarStep = (): boolean => {
    const erros: Record<string, string> = {};
    if (step === 1) {
      if (!nome.trim() || nome.trim().length < 2) erros.nome = 'Nome deve ter pelo menos 2 caracteres.';
      const idadeN = Number(idade);
      if (!idade || isNaN(idadeN) || idadeN < 18 || idadeN > 100) erros.idade = 'Idade deve estar entre 18 e 100 anos.';
      if (!regiao.trim() || regiao.trim().length < 2) erros.regiao = 'Região deve ter pelo menos 2 caracteres.';
      if (bio.length > 500) erros.bio = `Bio deve ter no máximo 500 caracteres (${bio.length}/500).`;
    } else if (step === 2) {
      const min = Number(orcamentoMin);
      const max = Number(orcamentoMax);
      if (!orcamentoMin || isNaN(min) || min <= 0) erros.orcamento_min = 'Informe um valor maior que zero.';
      if (!orcamentoMax || isNaN(max) || max <= 0) erros.orcamento_max = 'Informe um valor maior que zero.';
      if (!erros.orcamento_min && !erros.orcamento_max && min > max) erros.orcamento_max = 'O máximo deve ser maior ou igual ao mínimo.';
    } else if (step === 3) {
      if (smoker === null) erros.fumante = 'Responda se você fuma.';
      if (pets === null) erros.aceita_pets = 'Responda sobre pets.';
      if (!visitas) erros.aceita_visitas = 'Selecione sua preferência.';
      if (!horario) erros.perfil_horario = 'Selecione seu perfil de horário.';
    } else if (step === 4) {
      if (messy === 0) erros.tolerancia_bagunca = 'Selecione sua tolerância à bagunça.';
      if (organized === 0) erros.nivel_organizacao = 'Selecione seu nível de organização.';
      if (ruido === 0) erros.nivel_ruido = 'Selecione sua tolerância a barulho.';
      if (social === 0) erros.nivel_social = 'Selecione seu nível social.';
    }
    setFieldErrors(erros);
    return Object.keys(erros).length === 0;
  };

  const handleProximo = () => {
    if (validarStep()) setStep(s => s + 1);
  };

  const handleConcluir = async () => {
    if (!validarStep()) return;
    setErro('');
    setLoading(true);
    try {
      const perfil = await apiCriarPerfil({
        nome: nome.trim(),
        idade: Number(idade),
        regiao: regiao.trim(),
        bio: bio.trim(),
        orcamento_min: Number(orcamentoMin),
        orcamento_max: Number(orcamentoMax),
        fumante: smoker ?? false,
        aceita_pets: pets ?? false,
        tolerancia_bagunca: messy,
        nivel_organizacao: organized,
        perfil_horario: horario ?? 'flexivel',
        nivel_ruido: ruido,
        nivel_social: social,
        aceita_visitas: visitas ?? 'as_vezes',
        tipo_imovel: tipoImovel ?? 'indiferente',
        qtd_moradores: qtdMoradores ?? 2,
      });
      onPerfilCriado(perfil);
      nav('discovery');
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        setErro(Object.keys(e.fieldErrors).length > 0 ? 'Corrija os erros acima e tente novamente.' : e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'Erro ao criar perfil.');
      }
    } finally {
      setLoading(false);
    }
  };

  const STEP_LABELS = ['Informações pessoais', 'Preferências de moradia', 'Estilo de convivência', 'Hábitos'];

  const ProgressBar = () => (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
          <div key={i} style={{ flex: 1, height: '6px', borderRadius: '3px', background: i <= step ? C.primary : C.border }} />
        ))}
      </div>
      <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
        Etapa {step} de {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
      </p>
    </div>
  );

  const YesNo = ({ label, value, onChange, errorKey }: { label: string; value: boolean | null; onChange: (v: boolean) => void; errorKey?: string }) => (
    <div>
      <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => onChange(v)} style={{
            flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', minHeight: '44px',
            border: `2px solid ${value === v ? C.primary : fieldErrors[errorKey ?? ''] ? C.danger : C.border}`,
            background: value === v ? `${C.primary}12` : C.card,
            color: value === v ? C.primary : C.muted,
            fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 700,
          }}>
            {v ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
      {errorKey && fieldErrors[errorKey] && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '4px' }}>{fieldErrors[errorKey]}</span>}
    </div>
  );

  function ChoiceGroup<T extends string>({ label, value, onChange, options, errorKey }: {
    label: string; value: T | null; onChange: (v: T) => void;
    options: { value: T; label: string }[]; errorKey?: string;
  }) {
    return (
      <div>
        <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {options.map(opt => (
            <button key={opt.value} onClick={() => onChange(opt.value)} style={{
              flex: 1, minWidth: '80px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', minHeight: '44px',
              border: `2px solid ${value === opt.value ? C.primary : errorKey && fieldErrors[errorKey] ? C.danger : C.border}`,
              background: value === opt.value ? `${C.primary}12` : C.card,
              color: value === opt.value ? C.primary : C.muted,
              fontFamily: 'Nunito,sans-serif', fontSize: '13px', fontWeight: 700, textAlign: 'center',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
        {errorKey && fieldErrors[errorKey] && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '4px' }}>{fieldErrors[errorKey]}</span>}
      </div>
    );
  }

  const ScaleInput = ({ label, value, onChange, errorKey }: { label: string; value: number; onChange: (v: number) => void; errorKey: string }) => (
    <div>
      <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1,2,3,4,5].map(i => (
          <button key={i} onClick={() => onChange(i)} style={{
            flex: 1, height: '44px', borderRadius: '10px', cursor: 'pointer',
            border: `2px solid ${value >= i ? C.primary : fieldErrors[errorKey] ? C.danger : C.border}`,
            background: value >= i ? C.primary : C.card,
            color: value >= i ? '#fff' : C.muted,
            fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
          }}>{i}</button>
        ))}
      </div>
      {fieldErrors[errorKey] && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '4px' }}>{fieldErrors[errorKey]}</span>}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      <BrandPanel />

      {/* Painel do formulário */}
      <div className="flex-1 flex justify-center p-6 lg:p-10">
        <div className="w-full max-w-2xl flex flex-col">
          <ProgressBar />

          <div style={{ paddingTop: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* ── Etapa 1: Informações pessoais ── */}
            {step === 1 && (
              <>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 24px' }}>Sobre você</h2>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', border: `3px dashed ${C.primary}` }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', background: C.primary, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>+</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <Input label="Nome" placeholder="Seu nome completo" value={nome} onChange={setNome} error={fieldErrors.nome} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input label="Idade" type="number" placeholder="Sua idade" value={idade} onChange={setIdade} error={fieldErrors.idade} />
                    <Input label="Região ou bairro" placeholder="Ex: Vila Madalena, SP" value={regiao} onChange={setRegiao} error={fieldErrors.regiao} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif', display: 'block', marginBottom: '6px' }}>Sobre você</label>
                    <textarea
                      placeholder="Conte um pouco sobre você e o que procura em um colega de moradia..."
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${fieldErrors.bio ? C.danger : C.border}`, background: C.card, fontSize: '15px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none', resize: 'none', height: '100px', boxSizing: 'border-box' }}
                    />
                    {fieldErrors.bio && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '4px' }}>{fieldErrors.bio}</span>}
                  </div>
                </div>
              </>
            )}

            {/* ── Etapa 2: Preferências de moradia ── */}
            {step === 2 && (
              <>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 24px' }}>Preferências de moradia</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Faixa de orçamento mensal</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Input label="Mínimo (R$)" placeholder="700" value={orcamentoMin} onChange={setOrcamentoMin} error={fieldErrors.orcamento_min} />
                      <Input label="Máximo (R$)" placeholder="1500" value={orcamentoMax} onChange={setOrcamentoMax} error={fieldErrors.orcamento_max} />
                    </div>
                  </div>
                  <ChoiceGroup
                    label="Tipo de imóvel preferido"
                    value={tipoImovel}
                    onChange={setTipoImovel}
                    options={[
                      { value: 'apartamento', label: 'Apartamento' },
                      { value: 'casa', label: 'Casa' },
                      { value: 'republica', label: 'República' },
                      { value: 'indiferente', label: 'Indiferente' },
                    ]}
                  />
                  <div>
                    <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Quantas pessoas no imóvel?</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[1, 2, 3, 4].map(n => (
                        <button key={n} onClick={() => setQtdMoradores(n)} style={{
                          flex: 1, height: '44px', borderRadius: '12px', cursor: 'pointer',
                          border: `2px solid ${qtdMoradores === n ? C.primary : C.border}`,
                          background: qtdMoradores === n ? `${C.primary}12` : C.card,
                          color: qtdMoradores === n ? C.primary : C.muted,
                          fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700,
                        }}>{n}{n === 4 ? '+' : ''}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Etapa 3: Estilo de convivência ── */}
            {step === 3 && (
              <>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 24px' }}>Estilo de convivência</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="grid md:grid-cols-2 gap-6">
                    <YesNo label="Você fuma?" value={smoker} onChange={setSmoker} errorKey="fumante" />
                    <YesNo label="Aceita pets?" value={pets} onChange={setPets} errorKey="aceita_pets" />
                  </div>
                  <ChoiceGroup
                    label="Com que frequência recebe visitas?"
                    value={visitas}
                    onChange={setVisitas}
                    options={[
                      { value: 'raramente', label: 'Raramente' },
                      { value: 'as_vezes', label: 'Às vezes' },
                      { value: 'frequentemente', label: 'Frequentemente' },
                    ]}
                    errorKey="aceita_visitas"
                  />
                  <ChoiceGroup
                    label="Qual é o seu perfil de horário?"
                    value={horario}
                    onChange={setHorario}
                    options={[
                      { value: 'madrugador', label: '🌅 Madrugador(a)' },
                      { value: 'noturno', label: '🌙 Noturno(a)' },
                      { value: 'flexivel', label: '☀️ Flexível' },
                    ]}
                    errorKey="perfil_horario"
                  />
                </div>
              </>
            )}

            {/* ── Etapa 4: Hábitos (escalas) ── */}
            {step === 4 && (
              <>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Seus hábitos</h2>
                <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 24px' }}>1 = mínimo &nbsp;·&nbsp; 5 = máximo</p>
                <div className="grid md:grid-cols-2 gap-6">
                  <ScaleInput label="Organização" value={organized} onChange={setOrganized} errorKey="nivel_organizacao" />
                  <ScaleInput label="Tolerância à bagunça" value={messy} onChange={setMessy} errorKey="tolerancia_bagunca" />
                  <ScaleInput label="Tolerância a barulho" value={ruido} onChange={setRuido} errorKey="nivel_ruido" />
                  <ScaleInput label="Perfil social" value={social} onChange={setSocial} errorKey="nivel_social" />
                </div>
              </>
            )}

            {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '12px', textAlign: 'center' }}>{erro}</p>}

            {/* Rodapé */}
            <div className="flex flex-col md:flex-row gap-3 mt-auto pt-8">
              {step > 1 && <Btn label="Voltar" outline onClick={() => { setFieldErrors({}); setStep(s => s - 1); }} />}
              <Btn
                label={step === TOTAL_STEPS ? (loading ? 'Aguarde...' : 'Concluir perfil') : 'Próxima etapa'}
                onClick={step < TOTAL_STEPS ? handleProximo : handleConcluir}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Discovery ────────────────────────────────────────────────────────

function DiscoveryScreen({ nav, setMatchProfile, onSelectProfile, showFilters, setShowFilters, onMatch }: {
  nav: (s: Screen) => void;
  setMatchProfile: (p: Profile) => void;
  onSelectProfile: (p: Profile) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  onMatch?: (matchId: number) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [apiError, setApiError] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const tituloTela = profiles[0]?.tipo === 'oferecendo_vaga' ? 'Vagas para você'
    : profiles[0]?.tipo === 'buscando_vaga' ? 'Interessados na sua vaga'
    : 'Descoberta';

  useEffect(() => {
    setLoadingProfiles(true);
    listarDescoberta()
      .then(data => {
        setProfiles(data.map(perfilDescobertoParaProfile));
        setLoadingProfiles(false);
      })
      .catch(err => {
        setApiError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
        setLoadingProfiles(false);
      });
  }, []);

  const removeProfile = (id: number) => setProfiles(ps => ps.filter(p => p.id !== id));

  const handleLike = async (p: Profile) => {
    if (loadingId !== null) return;
    setLoadingId(p.id);
    try {
      const res = await enviarCurtida(p.id, 'curtir');
      if (res.match) {
        setMatchProfile(p);
        removeProfile(p.id);
        onMatch?.(res.match_data?.id ?? 0);
        nav('match');
        return;
      }
    } catch {
      // Remove o card mesmo em caso de erro de rede
    } finally {
      setLoadingId(null);
    }
    removeProfile(p.id);
  };

  const handleDislike = async (p: Profile) => {
    if (loadingId !== null) return;
    setLoadingId(p.id);
    try {
      await enviarCurtida(p.id, 'recusar');
    } catch {
      // Remove o card mesmo em caso de erro de rede
    } finally {
      setLoadingId(null);
    }
    removeProfile(p.id);
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>{tituloTela}</h1>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>São Paulo · SP</p>
        </div>
        <button onClick={() => setShowFilters(true)} style={{
          width: '44px', height: '44px', borderRadius: '14px', border: `1.5px solid ${C.border}`,
          background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div style={{ padding: '0 20px 20px', flex: 1 }}>
        {loadingProfiles && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '15px' }}>
            Carregando perfis...
          </div>
        )}
        {!loadingProfiles && apiError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', padding: '24px', textAlign: 'center', color: C.danger, fontFamily: 'Nunito,sans-serif', fontSize: '14px' }}>
            {apiError}
          </div>
        )}
        {!loadingProfiles && !apiError && profiles.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', padding: '24px', textAlign: 'center', color: C.muted, fontFamily: 'Nunito,sans-serif', fontSize: '15px' }}>
            Nenhum perfil compatível no momento. Volte mais tarde!
          </div>
        )}

        {/* Mobile: single card */}
        {!loadingProfiles && !apiError && profiles.length > 0 && (() => {
          const p = profiles[0];
          const isLoading = loadingId === p.id;
          return (
            <div className="md:hidden">
              {p.tipo === 'oferecendo_vaga' ? (
                /* ── card de anúncio (Airbnb-style) ── */
                <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                  style={{ borderRadius: '24px', overflow: 'hidden', background: C.card, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', cursor: 'pointer' }}>
                  <div style={{ position: 'relative', aspectRatio: '4/3' }}>
                    <ImagemComFallback src={p.fotosImovel?.[0]} alt={p.tituloAnuncio ?? p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="imovel" />
                    <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                      <CompatBadge value={p.compat} />
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px 20px' }}>
                    <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 4px', lineHeight: 1.3, overflow: 'hidden', maxHeight: '2.6em' }}>
                      {p.tituloAnuncio ?? `Vaga em ${p.region}`}
                    </h2>
                    <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '0 0 8px' }}>
                      📍 {p.region} · {IMOVEL_LABEL[p.tipoImovel] ?? p.tipoImovel} · {p.qtdMoradores} morador{p.qtdMoradores !== 1 ? 'es' : ''}
                    </p>
                    <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: C.text, margin: '0 0 10px' }}>
                      {p.budget} <span style={{ fontSize: '14px', fontWeight: 400, color: C.muted }}>/ mês</span>
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      {p.pets && <Tag label="Aceita pets" />}
                      {!p.smoker && <Tag label="Não fumante" />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                      <ImagemComFallback src={p.fotoPerfilUrl} alt={p.name}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                        tipo="avatar" iniciais={p.name.charAt(0)} />
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted }}>
                        Anunciado por <strong style={{ color: C.text }}>{p.name.split(' ')[0]}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── card de pessoa (estilo original) ── */
                <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                  style={{ borderRadius: '28px', overflow: 'hidden', position: 'relative', height: '480px', cursor: 'pointer', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}>
                  <ImagemComFallback src={p.photo} alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="avatar" iniciais={p.name.charAt(0)} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.88) 0%, rgba(42,36,32,0.2) 50%, transparent 80%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.name}, {p.age}</h2>
                        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {p.region}</p>
                      </div>
                      <CompatBadge value={p.compat} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {p.tags.map(t => (
                        <span key={t} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: 'Nunito,sans-serif' }}>{t}</span>
                      ))}
                    </div>
                    <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>{p.bio.slice(0, 80)}...</p>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '24px' }}>
                <button onClick={() => handleDislike(p)} disabled={isLoading} style={{ width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', opacity: isLoading ? 0.6 : 1 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button onClick={() => handleLike(p)} disabled={isLoading} style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px rgba(224,107,69,0.4)`, opacity: isLoading ? 0.6 : 1 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                </button>
                <button style={{ width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Tablet/Desktop: grid */}
        {!loadingProfiles && !apiError && profiles.length > 0 && (
          <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {profiles.map(p => {
              const isLoading = loadingId === p.id;
              return (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {p.tipo === 'oferecendo_vaga' ? (
                    /* ── card de anúncio desktop ── */
                    <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                      style={{ borderRadius: '24px', overflow: 'hidden', background: C.card, boxShadow: '0 8px 28px rgba(0,0,0,0.10)', cursor: 'pointer' }}>
                      <div style={{ position: 'relative', aspectRatio: '4/3' }}>
                        <ImagemComFallback src={p.fotosImovel?.[0]} alt={p.tituloAnuncio ?? p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="imovel" />
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                          <CompatBadge value={p.compat} />
                        </div>
                      </div>
                      <div style={{ padding: '14px 16px 16px' }}>
                        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 3px', lineHeight: 1.3, overflow: 'hidden', maxHeight: '2.6em' }}>
                          {p.tituloAnuncio ?? `Vaga em ${p.region}`}
                        </h2>
                        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 6px' }}>
                          📍 {p.region} · {IMOVEL_LABEL[p.tipoImovel] ?? p.tipoImovel} · {p.qtdMoradores} morador{p.qtdMoradores !== 1 ? 'es' : ''}
                        </p>
                        <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '17px', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>
                          {p.budget} <span style={{ fontSize: '12px', fontWeight: 400, color: C.muted }}>/ mês</span>
                        </p>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {p.pets && <Tag label="Aceita pets" />}
                          {!p.smoker && <Tag label="Não fumante" />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
                          <ImagemComFallback src={p.fotoPerfilUrl} alt={p.name}
                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                            tipo="avatar" iniciais={p.name.charAt(0)} />
                          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '11px', color: C.muted }}>
                            Anunciado por <strong style={{ color: C.text }}>{p.name.split(' ')[0]}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ── card de pessoa desktop (original) ── */
                    <div onClick={() => { onSelectProfile(p); nav('profile-detail'); }}
                      style={{ borderRadius: '24px', overflow: 'hidden', position: 'relative', height: '380px', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.12)' }}>
                      <ImagemComFallback src={p.photo} alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} tipo="avatar" iniciais={p.name.charAt(0)} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.85) 0%, rgba(42,36,32,0.15) 50%, transparent 80%)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div>
                            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.name}, {p.age}</h2>
                            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {p.region}</p>
                          </div>
                          <CompatBadge value={p.compat} />
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {p.tags.slice(0, 3).map(t => (
                            <span key={t} style={{ padding: '3px 8px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', fontSize: '11px', fontWeight: 600, color: '#fff', fontFamily: 'Nunito,sans-serif' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button onClick={() => handleDislike(p)} disabled={isLoading} style={{ width: '52px', height: '52px', borderRadius: '50%', border: `2px solid ${C.border}`, background: C.card, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', opacity: isLoading ? 0.6 : 1 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button onClick={() => handleLike(p)} disabled={isLoading} style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 20px rgba(224,107,69,0.4)`, opacity: isLoading ? 0.6 : 1 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters modal */}
      {showFilters && <FiltersModal onClose={() => setShowFilters(false)} />}
    </div>
  );
}

// ─── Screen: Profile Detail ───────────────────────────────────────────────────

function ProfileDetailScreen({ nav, profile, backScreen, onLike }: {
  nav: (s: Screen) => void;
  profile: Profile;
  backScreen: Screen;
  onLike?: (p: Profile) => Promise<void>;
}) {
  const [liking, setLiking] = useState(false);
  const [fotoAtiva, setFotoAtiva] = useState<string>(profile.fotosImovel?.[0] ?? '');

  useEffect(() => {
    setFotoAtiva(profile.fotosImovel?.[0] ?? '');
  }, [profile.id]);

  const handleLike = async () => {
    if (!onLike || liking) return;
    setLiking(true);
    try {
      await onLike(profile);
    } finally {
      setLiking(false);
    }
  };

  if (profile.tipo === 'oferecendo_vaga') {
    const fotosImovel = profile.fotosImovel ?? [];
    const fotoSrc = fotoAtiva || fotosImovel[0];
    return (
      <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
        {/* galeria de fotos */}
        <div style={{ position: 'relative', background: '#000' }}>
          <ImagemComFallback src={fotoSrc} alt={profile.tituloAnuncio ?? profile.name}
            style={{ width: '100%', height: '300px', objectFit: 'cover', display: 'block' }} tipo="imovel" />
          <button onClick={() => nav(backScreen)} style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          {fotosImovel.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', overflowX: 'auto', background: 'rgba(0,0,0,0.55)' }}>
              {fotosImovel.map((f, i) => (
                <button key={i} onClick={() => setFotoAtiva(f)} style={{ flexShrink: 0, padding: 0, border: `2px solid ${fotoAtiva === f ? '#fff' : 'transparent'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: 'none' }}>
                  <img src={f} alt={`Foto ${i + 1}`} style={{ width: '64px', height: '48px', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* informações */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
              {profile.tituloAnuncio ?? `Vaga em ${profile.region}`}
            </h2>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 12px' }}>📍 {profile.region}</p>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: C.text, margin: 0 }}>
              {profile.budget} <span style={{ fontSize: '16px', fontWeight: 400, color: C.muted }}>/ mês</span>
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <CompatBadge value={profile.compat} large />
          </div>

          {profile.descricaoImovel && (
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>
              {profile.descricaoImovel}
            </p>
          )}

          {/* Sobre a vaga */}
          <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
            <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Sobre a vaga</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Tipo de imóvel', value: IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel },
                { label: 'Moradores', value: `${profile.qtdMoradores}${profile.qtdMoradores === 4 ? '+' : ''} pessoa${profile.qtdMoradores > 1 ? 's' : ''}` },
                { label: 'Aceita pets', value: profile.pets ? 'Sim' : 'Não' },
                { label: 'Fumante', value: profile.smoker ? 'Permitido' : 'Não permitido' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Anunciado por */}
          <div style={{ background: C.card, borderRadius: '20px', padding: '16px 20px', marginBottom: '24px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ImagemComFallback src={profile.fotoPerfilUrl} alt={profile.name}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              tipo="avatar" iniciais={profile.name.charAt(0)} />
            <div>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, margin: '0 0 2px' }}>Anunciado por</p>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: 0 }}>
                {profile.name.split(' ')[0]}, {profile.age} anos
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Btn label="✕ Recusar" outline onClick={() => nav(backScreen)} />
            <Btn label={liking ? 'Enviando...' : '💛 Tenho interesse'} onClick={onLike ? handleLike : () => nav('match')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      {/* Photo column */}
      <div className="relative h-[340px] lg:h-screen lg:sticky lg:top-0 lg:w-[420px] lg:flex-shrink-0">
        <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.6) 0%, transparent 60%)' }} />
        <button onClick={() => nav(backScreen)} style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        {/* Desktop: name overlay on photo */}
        <div className="hidden lg:block" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px' }}>
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>{profile.name}, {profile.age}</h2>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.85)', margin: 0 }}>📍 {profile.region}</p>
        </div>
      </div>

      {/* Info column */}
      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* Mobile: name shown here */}
        <div className="lg:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{profile.name}, {profile.age}</h2>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0 }}>📍 {profile.region}</p>
          </div>
          <CompatBadge value={profile.compat} large />
        </div>
        {/* Desktop: compat badge */}
        <div className="hidden lg:flex" style={{ justifyContent: 'flex-end', marginBottom: '16px' }}>
          <CompatBadge value={profile.compat} large />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {profile.tags.map(t => <Tag key={t} label={t} />)}
        </div>

        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>{profile.bio}</p>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Preferências de moradia</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Orçamento', value: profile.budget },
              { label: 'Tipo de imóvel', value: IMOVEL_LABEL[profile.tipoImovel] ?? profile.tipoImovel },
              { label: 'Moradores', value: `${profile.qtdMoradores}${profile.qtdMoradores === 4 ? '+' : ''} pessoa${profile.qtdMoradores > 1 ? 's' : ''}` },
              { label: 'Fumante', value: profile.smoker ? 'Sim' : 'Não' },
              { label: 'Aceita pets', value: profile.pets ? 'Sim' : 'Não' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Convivência</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Horário', value: HORARIO_LABEL[profile.horario] ?? profile.horario },
              { label: 'Visitas', value: VISITAS_LABEL[profile.visitas] ?? profile.visitas },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Hábitos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {([
              { label: 'Organização', value: profile.organized },
              { label: 'Tolerância à bagunça', value: profile.messy },
              { label: 'Tolerância a barulho', value: profile.ruido },
              { label: 'Perfil social', value: profile.social },
            ] as { label: string; value: number }[]).map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{row.value}/5</span>
                </div>
                <ScaleBar value={row.value} />
              </div>
            ))}
          </div>
        </div>

        <Btn label={liking ? 'Curtindo...' : '💛 Curtir perfil'} onClick={onLike ? handleLike : () => nav('match')} />
      </div>
    </div>
  );
}

// ─── Filters Modal ────────────────────────────────────────────────────────────

function FiltersModal({ onClose }: { onClose: () => void }) {
  const [pets, setPets] = useState<boolean | null>(null);
  const [smoker, setSmoker] = useState<boolean | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filtros de busca"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
      className="md:items-center md:justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.card, padding: '24px', width: '100%' }}
        className="rounded-t-[28px] md:rounded-[24px] md:max-w-md md:shadow-2xl"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: C.text, margin: 0 }}>Filtros</h3>
          <button
            onClick={onClose}
            aria-label="Fechar filtros"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '22px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Faixa de orçamento</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Input label="Mínimo" placeholder="R$ 500" />
              <Input label="Máximo" placeholder="R$ 2.000" />
            </div>
          </div>
          <Input label="Região ou bairro" placeholder="Ex: Pinheiros" />

          {[
            { label: 'Aceita pets', value: pets, set: setPets },
            { label: 'Fumante', value: smoker, set: setSmoker },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => set(v)} style={{
                    flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', minHeight: '44px',
                    border: `2px solid ${value === v ? C.primary : C.border}`,
                    background: value === v ? `${C.primary}12` : C.bg,
                    color: value === v ? C.primary : C.muted,
                    fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 700,
                  }}
                  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {v ? 'Sim' : 'Não'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
          <Btn label="Limpar filtros" outline onClick={onClose} />
          <Btn label="Aplicar filtros" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Notifications ───────────────────────────────────────────────────

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `há ${horas} hora${horas !== 1 ? 's' : ''}`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} dia${dias !== 1 ? 's' : ''}`;
  const meses = Math.floor(dias / 30);
  return `há ${meses} mês${meses !== 1 ? 'es' : ''}`;
}

function NotificationsScreen({ nav, setCurrentChat, setActiveChatMatchId, meuPerfilId }: {
  nav: (s: Screen) => void;
  setCurrentChat: (p: Profile) => void;
  setActiveChatMatchId: (id: number) => void;
  meuPerfilId: number | null;
}) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const lastVisit = sessionStorage.getItem('pm_notif_last_visit');
    sessionStorage.setItem('pm_notif_last_visit', new Date().toISOString());
    listarMatches()
      .then(data => {
        const cutoff = lastVisit ? new Date(lastVisit) : null;
        const novos = cutoff ? data.filter(m => new Date(m.data_match) > cutoff) : data;
        setMatches(novos);
        setLoading(false);
      })
      .catch((e: Error) => { setErro(e.message); setLoading(false); });
  }, []);

  const abrirChat = (m: MatchData) => {
    const outro = m.perfil_a.id === meuPerfilId ? m.perfil_b : m.perfil_a;
    setCurrentChat(perfilBasicoParaProfile(outro, m.score));
    setActiveChatMatchId(m.id);
    nav('chat');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Notificações</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
          {loading ? 'Carregando...' : erro ? ' ' : matches.length === 0 ? 'Tudo em dia' : `${matches.length} novo${matches.length !== 1 ? 's' : ''} match${matches.length !== 1 ? 'es' : ''}`}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted }}>Carregando...</p>
          </div>
        )}

        {!loading && erro && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger }}>{erro}</p>
          </div>
        )}

        {!loading && !erro && matches.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
            <div style={{ width: '72px', height: '72px', background: `${C.primary}18`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 700, color: C.text, margin: 0 }}>Nenhuma novidade</p>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0, textAlign: 'center', maxWidth: '260px' }}>
              Quando alguém curtir você de volta, você verá o match aqui.
            </p>
          </div>
        )}

        {!loading && !erro && matches.map(m => {
          const outro = m.perfil_a.id === meuPerfilId ? m.perfil_b : m.perfil_a;
          const compat = Math.round(m.score * 100);
          const level = getCompatLevel(compat);
          const foto = outro.fotos_imovel?.[0] ?? PLACEHOLDER_PHOTOS[outro.id % PLACEHOLDER_PHOTOS.length];
          return (
            <button
              key={m.id}
              onClick={() => abrirChat(m)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ flexShrink: 0, width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${level.color}` }}>
                <img src={foto} alt={outro.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text }}>
                    {outro.nome}
                  </span>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, flexShrink: 0, marginLeft: '8px' }}>
                    {tempoRelativo(m.data_match)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: `${level.color}22`, color: level.color,
                    borderRadius: '8px', padding: '2px 8px',
                    fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 800,
                  }}>
                    {compat}% compatível
                  </span>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted }}>
                    Toque para conversar →
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Screen: Match ────────────────────────────────────────────────────────────

function MatchScreen({ nav, profile, setCurrentChat }: {
  nav: (s: Screen) => void;
  profile: Profile;
  setCurrentChat: (p: Profile) => void;
}) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center" style={{ background: `linear-gradient(160deg, ${C.primaryDark} 0%, ${C.primary} 50%, ${C.primaryLight} 100%)`, padding: '40px 28px', minHeight: '100dvh' }}>
      <div className="w-full max-w-lg flex flex-col items-center">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>🎉</div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '38px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Vocês combinam!</h1>
          <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '16px', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
            Você e {profile.name} têm muito em comum
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '32px' }}>
          <div style={{ width: '110px', height: '110px', borderRadius: '50%', overflow: 'hidden', border: '4px solid white', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
            <img src={MY_PROFILE.photo} alt="Você" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ background: '#fff', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, margin: '-10px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={C.primary}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </div>
          <div style={{ width: '110px', height: '110px', borderRadius: '50%', overflow: 'hidden', border: '4px solid white', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
            <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        <CompatBadge value={profile.compat} large />

        <div style={{ width: '100%', marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => { setCurrentChat(profile); nav('chat'); }} style={{
            width: '100%', padding: '16px', background: '#fff', color: C.primary,
            border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
            fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            💬 Iniciar conversa
          </button>
          <button onClick={() => nav('matches')} style={{
            width: '100%', padding: '16px', background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '2px solid rgba(255,255,255,0.6)', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
            fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
          }}>
            Ver meus matches
          </button>
          <button onClick={() => nav('discovery')} style={{
            width: '100%', padding: '12px', background: 'transparent', color: 'rgba(255,255,255,0.7)',
            border: 'none', borderRadius: '16px', fontSize: '14px', fontWeight: 600,
            fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
          }}>
            Continuar descobrindo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Matches List ─────────────────────────────────────────────────────

function conversaParaProfile(c: Conversa): Profile {
  const p = c.outro_perfil;
  return {
    id: p.id,
    name: p.nome,
    age: p.idade,
    region: p.regiao,
    bio: '',
    compat: Math.round(c.score * 100),
    photo: PLACEHOLDER_PHOTOS[p.id % PLACEHOLDER_PHOTOS.length],
    tags: [],
    budget: '',
    smoker: false, pets: false, organized: 3, messy: 3,
    horario: 'flexivel', ruido: 3, social: 3,
    visitas: 'as_vezes', tipoImovel: 'indiferente', qtdMoradores: 2,
  };
}

function MatchesScreen({ nav, setCurrentChat, setActiveChatMatchId, meuPerfilId }: {
  nav: (s: Screen) => void;
  setCurrentChat: (p: Profile) => void;
  setActiveChatMatchId: (id: number) => void;
  meuPerfilId: number | null;
}) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setLoading(true);
    setErro('');
    listarConversas()
      .then(data => { setConversas(data); setLoading(false); })
      .catch((e: Error) => { setErro(e.message); setLoading(false); });
  };

  useEffect(() => { carregar(); }, []);

  const abrirChat = (c: Conversa) => {
    setCurrentChat(conversaParaProfile(c));
    setActiveChatMatchId(c.match_id);
    nav('chat');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Seus Matches</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
          {loading ? 'Carregando...' : erro ? ' ' : `${conversas.length} conversa${conversas.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted }}>Carregando conversas...</p>
          </div>
        )}

        {!loading && erro && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', gap: '16px' }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, textAlign: 'center' }}>{erro}</p>
            <Btn label="Tentar novamente" small onClick={carregar} style={{ maxWidth: '200px' }} />
          </div>
        )}

        {!loading && !erro && conversas.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
            <div style={{ width: '72px', height: '72px', background: `${C.primary}18`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '18px', fontWeight: 700, color: C.text, margin: 0 }}>Você ainda não tem matches</p>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0, textAlign: 'center', maxWidth: '260px' }}>
              Curta perfis na tela de Descoberta. Quando alguém curtir você de volta, aparece aqui!
            </p>
          </div>
        )}

        {/* Mobile: lista */}
        {!loading && !erro && (
          <div className="md:hidden" style={{ paddingTop: '8px' }}>
            {conversas.map(c => {
              const profile = conversaParaProfile(c);
              const level = getCompatLevel(profile.compat);
              const preview = c.ultima_mensagem?.conteudo ?? 'Diga olá! 👋';
              return (
                <button key={c.match_id} onClick={() => abrirChat(c)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '58px', height: '58px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${level.color}` }}>
                      <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{
                      position: 'absolute', bottom: '-2px', right: '-2px',
                      background: level.color, borderRadius: '10px', border: '2px solid white',
                      padding: '1px 5px', fontSize: '10px', fontWeight: 800,
                      fontFamily: 'Outfit,sans-serif', color: '#fff', lineHeight: '14px',
                    }}>
                      {profile.compat}%
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text }}>{profile.name}</span>
                      {c.nao_lidas > 0 && (
                        <span style={{
                          background: C.primary, color: '#fff', borderRadius: '12px',
                          padding: '1px 7px', fontSize: '11px', fontWeight: 800,
                          fontFamily: 'Outfit,sans-serif', flexShrink: 0,
                        }}>
                          {c.nao_lidas}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontFamily: 'Nunito,sans-serif', fontSize: '13px',
                      color: c.nao_lidas > 0 ? C.text : C.muted,
                      fontWeight: c.nao_lidas > 0 ? 700 : 400,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Tablet/Desktop: grid */}
        {!loading && !erro && (
          <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {conversas.map(c => {
              const profile = conversaParaProfile(c);
              const level = getCompatLevel(profile.compat);
              const preview = c.ultima_mensagem?.conteudo ?? 'Diga olá! 👋';
              return (
                <button key={c.match_id} onClick={() => abrirChat(c)} style={{
                  display: 'flex', flexDirection: 'column', background: C.card,
                  border: `2px solid ${level.color}30`, borderRadius: '20px', overflow: 'hidden',
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  boxShadow: `0 4px 20px ${level.color}18`, position: 'relative',
                }}>
                  {c.nao_lidas > 0 && (
                    <span style={{
                      position: 'absolute', top: '10px', right: '10px', zIndex: 2,
                      background: C.primary, color: '#fff', borderRadius: '12px',
                      padding: '2px 8px', fontSize: '12px', fontWeight: 800,
                      fontFamily: 'Outfit,sans-serif',
                    }}>
                      {c.nao_lidas} nova{c.nao_lidas !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div style={{ position: 'relative', height: '160px', flexShrink: 0 }}>
                    <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', top: '10px', left: '10px',
                      background: `${level.color}EE`, borderRadius: '10px', padding: '3px 10px',
                      fontFamily: 'Outfit,sans-serif', fontSize: '12px', fontWeight: 800, color: '#fff',
                    }}>
                      {level.label}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text }}>{profile.name}</span>
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted, marginLeft: '6px' }}>{profile.age} anos · {profile.region}</span>
                    </div>
                    <p style={{
                      fontFamily: 'Nunito,sans-serif', fontSize: '13px',
                      color: c.nao_lidas > 0 ? C.text : C.muted,
                      fontWeight: c.nao_lidas > 0 ? 700 : 400,
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen: Chat ─────────────────────────────────────────────────────────────

function ChatScreen({ nav, profile, matchId, meuPerfilId, showReport, setShowReport }: {
  nav: (s: Screen) => void;
  profile: Profile;
  matchId: number;
  meuPerfilId: number;
  showReport: boolean;
  setShowReport: (v: boolean) => void;
}) {
  const [messages, setMessages] = useState<MensagemAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);
  const loadedRef = useRef(false);

  const carregarMensagens = () => {
    setLoading(true);
    setErro('');
    listarMensagens(matchId)
      .then(msgs => {
        setMessages(msgs);
        lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
        loadedRef.current = true;
        setLoading(false);
      })
      .catch((e: Error) => { setErro(e.message); setLoading(false); });
  };

  // Carga inicial
  useEffect(() => {
    loadedRef.current = false;
    carregarMensagens();
  }, [matchId]);

  // Polling a cada 4 s — só mensagens novas, pausa quando aba está oculta
  useEffect(() => {
    const poll = async () => {
      if (!loadedRef.current || document.hidden) return;
      try {
        const novas = await listarMensagens(matchId, lastIdRef.current);
        if (novas.length > 0) {
          setMessages(prev => [...prev, ...novas]);
          lastIdRef.current = novas[novas.length - 1].id;
        }
      } catch { /* falha silenciosa no poll */ }
    };
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, [matchId]);

  // Rola para a última mensagem ao receber novas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const texto = input.trim();
    if (!texto || sending) return;
    setSending(true);
    setSendError('');
    setInput('');
    try {
      const nova = await enviarMensagem(matchId, texto);
      setMessages(prev => [...prev, nova]);
      lastIdRef.current = nova.id;
    } catch (e: unknown) {
      setInput(texto);
      setSendError(e instanceof Error ? e.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = (dt: string) =>
    new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col flex-1" style={{ background: C.bg, overflow: 'hidden' }}>
      <div className="flex flex-col flex-1 w-full max-w-3xl mx-auto" style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: C.card, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <button onClick={() => nav('matches')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.primary}` }}>
            <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: 0 }}>{profile.name}</p>
            <CompatBadge value={profile.compat} />
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: C.muted }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '36px', background: C.card, borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', border: `1px solid ${C.border}`, zIndex: 50, minWidth: '160px', overflow: 'hidden' }}>
                {['Ver perfil', 'Bloquear', 'Denunciar'].map(opt => (
                  <button key={opt} onClick={() => { setShowMenu(false); if (opt === 'Denunciar') setShowReport(true); }} style={{
                    display: 'block', width: '100%', padding: '14px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600,
                    color: opt === 'Denunciar' ? C.danger : C.text,
                  }}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Carregando mensagens...</p>
            </div>
          )}
          {!loading && erro && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.danger, textAlign: 'center' }}>{erro}</p>
              <Btn label="Tentar novamente" small onClick={carregarMensagens} style={{ maxWidth: '200px' }} />
            </div>
          )}
          {!loading && !erro && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Nenhuma mensagem ainda. Envie a primeira! 👋</p>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.remetente_id === meuPerfilId;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%', padding: '11px 15px',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMe ? C.primary : C.card,
                  color: isMe ? '#fff' : C.text,
                  border: isMe ? 'none' : `1px solid ${C.border}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', lineHeight: 1.5, margin: '0 0 4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.conteudo}</p>
                  <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '11px', color: isMe ? 'rgba(255,255,255,0.7)' : C.muted, margin: 0, textAlign: 'right' }}>
                    {formatTime(msg.data_envio)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Erro de envio */}
        {sendError && (
          <div style={{ padding: '6px 16px 2px', background: `${C.danger}12`, borderTop: `1px solid ${C.danger}30` }}>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.danger, margin: 0 }}>{sendError}</p>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '10px 14px 24px', background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              maxLength={1000}
              rows={1}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '22px',
                border: `1.5px solid ${C.border}`, background: C.bg,
                fontSize: '14px', fontFamily: 'Nunito,sans-serif', color: C.text,
                outline: 'none', resize: 'none', boxSizing: 'border-box', display: 'block',
              }}
            />
            {input.length > 900 && (
              <span style={{ position: 'absolute', bottom: '-14px', right: '8px', fontSize: '10px', color: input.length >= 1000 ? C.danger : C.muted, fontFamily: 'Nunito,sans-serif' }}>
                {input.length}/1000
              </span>
            )}
          </div>
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            style={{
              width: '46px', height: '46px', borderRadius: '50%', border: 'none',
              background: sending || !input.trim() ? C.border : C.primary,
              cursor: sending || !input.trim() ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}

// ─── Screen: My Profile ───────────────────────────────────────────────────────

function MyProfileScreen({ nav, meuPerfil, onPerfilAtualizado, onPerfilExcluido }: {
  nav: (s: Screen) => void;
  meuPerfil: PerfilAPI | null;
  onPerfilAtualizado: (p: PerfilAPI) => void;
  onPerfilExcluido: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editIdade, setEditIdade] = useState('');
  const [editRegiao, setEditRegiao] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editHorario, setEditHorario] = useState<'madrugador' | 'noturno' | 'flexivel'>('flexivel');
  const [editVisitas, setEditVisitas] = useState<'raramente' | 'as_vezes' | 'frequentemente'>('as_vezes');
  const [editTipoImovel, setEditTipoImovel] = useState<'apartamento' | 'casa' | 'republica' | 'indiferente'>('indiferente');
  const [editQtdMoradores, setEditQtdMoradores] = useState(2);
  const [editRuido, setEditRuido] = useState(3);
  const [editSocial, setEditSocial] = useState(3);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (meuPerfil) {
      setEditNome(meuPerfil.nome);
      setEditIdade(String(meuPerfil.idade));
      setEditRegiao(meuPerfil.regiao);
      setEditBio(meuPerfil.bio);
      setEditHorario(meuPerfil.perfil_horario);
      setEditVisitas(meuPerfil.aceita_visitas);
      setEditTipoImovel(meuPerfil.tipo_imovel);
      setEditQtdMoradores(meuPerfil.qtd_moradores);
      setEditRuido(meuPerfil.nivel_ruido);
      setEditSocial(meuPerfil.nivel_social);
    }
  }, [meuPerfil]);

  const salvar = async () => {
    if (!meuPerfil) return;
    const idade = Number(editIdade);
    const erros: Record<string, string> = {};
    if (!editNome.trim() || editNome.trim().length < 2) erros.nome = 'Nome deve ter pelo menos 2 caracteres.';
    if (!editIdade || isNaN(idade) || idade < 18 || idade > 100) erros.idade = 'Idade deve estar entre 18 e 100 anos.';
    if (!editRegiao.trim() || editRegiao.trim().length < 2) erros.regiao = 'Região deve ter pelo menos 2 caracteres.';
    if (editBio.length > 500) erros.bio = `Bio deve ter no máximo 500 caracteres (${editBio.length}/500).`;
    setEditFieldErrors(erros);
    if (Object.keys(erros).length > 0) return;

    setErro('');
    setLoading(true);
    try {
      const atualizado = await apiAtualizarPerfil(meuPerfil.id, {
        nome: editNome.trim(),
        idade: Number(editIdade),
        regiao: editRegiao.trim(),
        bio: editBio.trim(),
        perfil_horario: editHorario,
        aceita_visitas: editVisitas,
        tipo_imovel: editTipoImovel,
        qtd_moradores: editQtdMoradores,
        nivel_ruido: editRuido,
        nivel_social: editSocial,
      });
      onPerfilAtualizado(atualizado);
      setEditing(false);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setEditFieldErrors(e.fieldErrors);
        setErro(Object.keys(e.fieldErrors).length > 0 ? 'Corrija os erros acima e tente novamente.' : e.message);
      } else {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const excluir = async () => {
    if (!meuPerfil || !confirm('Tem certeza que deseja excluir seu perfil?')) return;
    setErro('');
    setLoading(true);
    try {
      await apiExcluirPerfil(meuPerfil.id);
      onPerfilExcluido();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    nav('welcome');
  };

  return (
    <div className="flex flex-col flex-1 pb-20 lg:pb-0" style={{ background: C.bg }}>
      <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>Meu Perfil</h1>
        {editing
          ? <button onClick={salvar} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{loading ? '...' : 'Salvar'}</button>
          : <button onClick={() => setEditing(true)} style={{ background: 'none', border: `1.5px solid ${C.primary}`, color: C.primary, borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Editar</button>
        }
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <div className="lg:flex lg:gap-8 lg:items-start">

          {/* Left column: avatar + tags (desktop only shows tags here) */}
          <div className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '20px', background: C.card, borderRadius: '20px', border: `1px solid ${C.border}` }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.primary}`, flexShrink: 0 }}>
                <img src={MY_PROFILE.photo} alt="Você" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{meuPerfil?.nome || MY_PROFILE.name}</h2>
                <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 6px' }}>{meuPerfil?.idade || MY_PROFILE.age} anos · {meuPerfil?.regiao || MY_PROFILE.region}</p>
              </div>
            </div>

            {/* Tags on desktop (view mode only) */}
            {!editing && (
              <div className="hidden lg:flex" style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {MY_PROFILE.tags.map(t => <Tag key={t} label={t} />)}
              </div>
            )}
          </div>

          {/* Right column: content + actions */}
          <div className="flex-1">
            {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginBottom: '12px', textAlign: 'center' }}>{erro}</p>}

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <Input label="Nome" placeholder="Seu nome" value={editNome} onChange={setEditNome} error={editFieldErrors.nome} />
                <Input label="Idade" type="number" placeholder="Sua idade" value={editIdade} onChange={setEditIdade} error={editFieldErrors.idade} />
                <Input label="Região" placeholder="Bairro ou cidade" value={editRegiao} onChange={setEditRegiao} error={editFieldErrors.regiao} />
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif', display: 'block', marginBottom: '6px' }}>Biografia</label>
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${editFieldErrors.bio ? C.danger : C.border}`, background: C.card, fontSize: '15px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none', resize: 'none', height: '90px', boxSizing: 'border-box' }} />
                  {editFieldErrors.bio && <span style={{ fontSize: '12px', color: C.danger, fontFamily: 'Nunito,sans-serif', display: 'block', marginTop: '4px' }}>{editFieldErrors.bio}</span>}
                </div>
                <div>
                  <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Perfil de horário</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {([
                      { value: 'madrugador', label: '🌅 Madrugador(a)' },
                      { value: 'noturno', label: '🌙 Noturno(a)' },
                      { value: 'flexivel', label: '☀️ Flexível' },
                    ] as { value: 'madrugador' | 'noturno' | 'flexivel'; label: string }[]).map(opt => (
                      <button key={opt.value} onClick={() => setEditHorario(opt.value)} style={{
                        flex: 1, minWidth: '100px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${editHorario === opt.value ? C.primary : C.border}`,
                        background: editHorario === opt.value ? `${C.primary}12` : C.card,
                        color: editHorario === opt.value ? C.primary : C.muted,
                        fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Com que frequência recebe visitas?</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {([
                      { value: 'raramente', label: 'Raramente' },
                      { value: 'as_vezes', label: 'Às vezes' },
                      { value: 'frequentemente', label: 'Frequentemente' },
                    ] as { value: 'raramente' | 'as_vezes' | 'frequentemente'; label: string }[]).map(opt => (
                      <button key={opt.value} onClick={() => setEditVisitas(opt.value)} style={{
                        flex: 1, minWidth: '100px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${editVisitas === opt.value ? C.primary : C.border}`,
                        background: editVisitas === opt.value ? `${C.primary}12` : C.card,
                        color: editVisitas === opt.value ? C.primary : C.muted,
                        fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Tipo de imóvel preferido</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {([
                      { value: 'apartamento', label: 'Apartamento' },
                      { value: 'casa', label: 'Casa' },
                      { value: 'republica', label: 'República' },
                      { value: 'indiferente', label: 'Indiferente' },
                    ] as { value: 'apartamento' | 'casa' | 'republica' | 'indiferente'; label: string }[]).map(opt => (
                      <button key={opt.value} onClick={() => setEditTipoImovel(opt.value)} style={{
                        flex: 1, minWidth: '90px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${editTipoImovel === opt.value ? C.primary : C.border}`,
                        background: editTipoImovel === opt.value ? `${C.primary}12` : C.card,
                        color: editTipoImovel === opt.value ? C.primary : C.muted,
                        fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Quantas pessoas no imóvel?</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setEditQtdMoradores(n)} style={{
                        flex: 1, height: '44px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${editQtdMoradores === n ? C.primary : C.border}`,
                        background: editQtdMoradores === n ? `${C.primary}12` : C.card,
                        color: editQtdMoradores === n ? C.primary : C.muted,
                        fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700,
                      }}>{n}{n === 4 ? '+' : ''}</button>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {([
                    { label: 'Tolerância a barulho', value: editRuido, onChange: setEditRuido },
                    { label: 'Perfil social', value: editSocial, onChange: setEditSocial },
                  ] as { label: string; value: number; onChange: (v: number) => void }[]).map(({ label, value, onChange }) => (
                    <div key={label}>
                      <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <button key={i} onClick={() => onChange(i)} style={{
                            flex: 1, height: '44px', borderRadius: '10px', cursor: 'pointer',
                            border: `2px solid ${value >= i ? C.primary : C.border}`,
                            background: value >= i ? C.primary : C.card,
                            color: value >= i ? '#fff' : C.muted,
                            fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700,
                          }}>{i}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 10px' }}>Sobre mim</h3>
                  <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, lineHeight: 1.7, margin: 0 }}>{meuPerfil?.bio || MY_PROFILE.bio}</p>
                </div>

                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Preferências de moradia</h3>
                  {[
                    { label: 'Orçamento', value: meuPerfil ? `R$ ${meuPerfil.orcamento_min} – R$ ${meuPerfil.orcamento_max}` : MY_PROFILE.budget },
                    { label: 'Tipo de imóvel', value: meuPerfil ? (IMOVEL_LABEL[meuPerfil.tipo_imovel] ?? meuPerfil.tipo_imovel) : IMOVEL_LABEL[MY_PROFILE.tipoImovel] },
                    { label: 'Moradores', value: (() => { const n = meuPerfil?.qtd_moradores ?? MY_PROFILE.qtdMoradores; return `${n}${n === 4 ? '+' : ''} pessoa${n > 1 ? 's' : ''}`; })() },
                    { label: 'Fumante', value: meuPerfil ? (meuPerfil.fumante ? 'Sim' : 'Não') : (MY_PROFILE.smoker ? 'Sim' : 'Não') },
                    { label: 'Aceita pets', value: meuPerfil ? (meuPerfil.aceita_pets ? 'Sim' : 'Não') : (MY_PROFILE.pets ? 'Sim' : 'Não') },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Convivência</h3>
                  {[
                    { label: 'Horário', value: HORARIO_LABEL[meuPerfil?.perfil_horario ?? MY_PROFILE.horario] },
                    { label: 'Visitas', value: VISITAS_LABEL[meuPerfil?.aceita_visitas ?? MY_PROFILE.visitas] },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                      <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
                  <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Hábitos</h3>
                  {([
                    { label: 'Organização', value: meuPerfil?.nivel_organizacao ?? MY_PROFILE.organized },
                    { label: 'Tolerância à bagunça', value: meuPerfil?.tolerancia_bagunca ?? MY_PROFILE.messy },
                    { label: 'Tolerância a barulho', value: meuPerfil?.nivel_ruido ?? MY_PROFILE.ruido },
                    { label: 'Perfil social', value: meuPerfil?.nivel_social ?? MY_PROFILE.social },
                  ] as { label: string; value: number }[]).map(row => (
                    <div key={row.label} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>{row.label}</span>
                        <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{row.value}/5</span>
                      </div>
                      <ScaleBar value={row.value} />
                    </div>
                  ))}
                </div>

                {/* Tags on mobile */}
                <div className="lg:hidden" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  {MY_PROFILE.tags.map(t => <Tag key={t} label={t} />)}
                </div>
              </>
            )}

            <button onClick={handleLogout} style={{
              width: '100%', padding: '15px', background: 'none',
              border: `1.5px solid ${C.border}`, borderRadius: '16px',
              fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.muted, cursor: 'pointer',
            }}>
              Sair da conta
            </button>
            {meuPerfil && <button onClick={excluir} disabled={loading} style={{
              width: '100%', padding: '15px', marginTop: '10px', background: 'none',
              border: `1.5px solid ${C.danger}`, borderRadius: '16px',
              fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.danger, cursor: loading ? 'wait' : 'pointer',
            }}>
              {loading ? 'Excluindo...' : 'Excluir perfil'}
            </button>}
          </div>

        </div>
      </div>

    </div>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const reasons = ['Conteúdo inapropriado', 'Perfil falso', 'Assédio ou ameaças', 'Informações enganosas', 'Spam', 'Outro motivo'];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Denunciar usuário"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
      className="md:items-center md:justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.card, padding: '24px', width: '100%' }}
        className="rounded-t-[28px] md:rounded-[24px] md:max-w-md md:shadow-2xl"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: 0 }}>Denunciar usuário</h3>
          <button
            onClick={onClose}
            aria-label="Fechar denúncia"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '22px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {reasons.map(r => (
            <button key={r} onClick={() => setSelected(r)} style={{
              padding: '13px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', minHeight: '44px',
              border: `1.5px solid ${selected === r ? C.danger : C.border}`,
              background: selected === r ? `${C.danger}10` : C.bg,
              color: selected === r ? C.danger : C.text,
              fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600,
            }}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif', display: 'block', marginBottom: '6px' }}>Descrição (opcional)</label>
          <textarea placeholder="Descreva o ocorrido com mais detalhes..." style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${C.border}`, background: C.bg, fontSize: '14px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none', resize: 'none', height: '80px', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Btn label="Cancelar" outline onClick={onClose} />
          <Btn label="Enviar denúncia" danger onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function getParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function App() {
  const initialScreen = (getParam('screen') as Screen) || 'welcome';
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [tab, setTab] = useState<Tab>(
    (initialScreen === 'discovery' || initialScreen === 'notifications' || initialScreen === 'matches' || initialScreen === 'profile')
      ? (initialScreen as Tab)
      : 'discovery'
  );
  const [matchProfile, setMatchProfile] = useState<Profile>(PROFILES[0]);
  const [selectedProfile, setSelectedProfile] = useState<Profile>(PROFILES[0]);
  const [currentChat, setCurrentChat] = useState<Profile>(PROFILES[0]);
  const [activeChatMatchId, setActiveChatMatchId] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(getParam('filters') === '1');
  const [showReport, setShowReport] = useState(getParam('report') === '1');
  const [meuPerfil, setMeuPerfil] = useState<PerfilAPI | null>(null);
  const [matchesKey, setMatchesKey] = useState(0);
  const [notifsKey, setNotifsKey] = useState(0);
  const [notifsCount, setNotifsCount] = useState(0);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');
  const [prevScreen, setPrevScreen] = useState<Screen>('discovery');

  const nav = (s: Screen) => {
    setScreen(s);
    if (s === 'discovery' || s === 'notifications' || s === 'matches' || s === 'profile') setTab(s as Tab);
    if (s === 'matches') setMatchesKey(k => k + 1);
    if (s === 'notifications') { setNotifsKey(k => k + 1); setNotifsCount(0); }
  };

  const atualizarNotifsCount = async () => {
    try {
      const ms = await listarMatches();
      const lastVisit = sessionStorage.getItem('pm_notif_last_visit');
      const cutoff = lastVisit ? new Date(lastVisit) : null;
      const count = cutoff ? ms.filter(m => new Date(m.data_match) > cutoff).length : ms.length;
      setNotifsCount(count);
    } catch { /* silent */ }
  };

  const handleLogout = () => {
    logout();
    setMeuPerfil(null);
    setNotifsCount(0);
    setActiveChatMatchId(0);
    setCurrentChat(PROFILES[0]);
    setSelectedProfile(PROFILES[0]);
    setSessionExpiredMsg('');
    nav('welcome');
  };

  useEffect(() => {
    setOn401(() => {
      setMeuPerfil(null);
      setNotifsCount(0);
      setActiveChatMatchId(0);
      setCurrentChat(PROFILES[0]);
      setSelectedProfile(PROFILES[0]);
      setSessionExpiredMsg('Sua sessão expirou. Entre novamente.');
      setScreen('login');
      setTab('discovery');
    });
  }, []);

  const handleLoginSuccess = async () => {
    try {
      const usuario = await buscarMeuUsuario();
      const perfis = await listarPerfis();
      const perfil = perfis.find(p => p.usuario === usuario.id) ?? null;
      setMeuPerfil(perfil);
      await atualizarNotifsCount();
      nav(perfil ? 'discovery' : 'profile-create');
    } catch {
      nav('profile-create');
    }
  };

  return (
    <AppShell screen={screen} tab={tab} setTab={setTab} nav={nav} onLogout={handleLogout} notifsCount={notifsCount}>
      {screen === 'welcome' && <WelcomeScreen nav={nav} />}
      {screen === 'login' && <LoginScreen nav={nav} onLoginSuccess={handleLoginSuccess} loginMsg={sessionExpiredMsg} />}
      {screen === 'register' && <RegisterScreen nav={nav} onLoginSuccess={handleLoginSuccess} />}
      {screen === 'profile-create' && (
        <ProfileCreateScreen nav={nav} onPerfilCriado={(p) => setMeuPerfil(p)} />
      )}
      {screen === 'discovery' && (
        <DiscoveryScreen
          nav={nav}
          setMatchProfile={setMatchProfile}
          onSelectProfile={(p) => { setSelectedProfile(p); setPrevScreen(screen); }}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onMatch={(matchId) => { setActiveChatMatchId(matchId); setMatchesKey(k => k + 1); setNotifsCount(n => n + 1); }}
        />
      )}
      {screen === 'profile-detail' && (
        <ProfileDetailScreen
          nav={nav}
          profile={selectedProfile}
          backScreen={prevScreen}
          onLike={async (p) => {
            try {
              const res = await enviarCurtida(p.id, 'curtir');
              if (res.match) {
                setMatchProfile(p);
                if (res.match_data) setActiveChatMatchId(res.match_data.id);
                setMatchesKey(k => k + 1);
                setNotifsCount(n => n + 1);
                nav('match');
              } else {
                nav('discovery');
              }
            } catch {
              nav('discovery');
            }
          }}
        />
      )}
      {screen === 'match' && <MatchScreen nav={nav} profile={matchProfile} setCurrentChat={setCurrentChat} />}
      {screen === 'matches' && (
        <MatchesScreen key={matchesKey} nav={nav} setCurrentChat={setCurrentChat} setActiveChatMatchId={setActiveChatMatchId} meuPerfilId={meuPerfil?.id ?? null} />
      )}
      {screen === 'notifications' && (
        <NotificationsScreen key={notifsKey} nav={nav} setCurrentChat={setCurrentChat} setActiveChatMatchId={setActiveChatMatchId} meuPerfilId={meuPerfil?.id ?? null} />
      )}
      {screen === 'chat' && (
        <ChatScreen nav={nav} profile={currentChat} matchId={activeChatMatchId} meuPerfilId={meuPerfil?.id ?? 0} showReport={showReport} setShowReport={setShowReport} />
      )}
      {screen === 'profile' && (
        <MyProfileScreen
          nav={nav}
          meuPerfil={meuPerfil}
          onPerfilAtualizado={(p) => setMeuPerfil(p)}
          onPerfilExcluido={() => { setMeuPerfil(null); nav('profile-create'); }}
        />
      )}
    </AppShell>
  );
}
