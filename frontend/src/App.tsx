import { useState, useEffect } from 'react';
import {
  login as apiLogin,
  registrar as apiRegistrar,
  buscarMeuUsuario,
  listarPerfis,
  criarPerfil as apiCriarPerfil,
  atualizarPerfil as apiAtualizarPerfil,
  logout,
  ApiError,
} from './api';
import type { Perfil as PerfilAPI } from './api';

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
  | 'filters';

type Tab = 'discovery' | 'matches' | 'profile';

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
  lastMsg?: string;
  lastTime?: string;
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
    photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop&auto=format',
    tags: ['Não fumante', 'Aceita pets', 'Organizada'],
    budget: 'R$ 800 – R$ 1.400',
    smoker: false,
    pets: true,
    organized: 4,
    messy: 2,
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
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&auto=format',
    tags: ['Não fumante', 'Sem pets', 'Tranquilo'],
    budget: 'R$ 1.000 – R$ 1.800',
    smoker: false,
    pets: false,
    organized: 5,
    messy: 1,
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
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&auto=format',
    tags: ['Não fumante', 'Aceita pets', 'Flexível'],
    budget: 'R$ 900 – R$ 1.600',
    smoker: false,
    pets: true,
    organized: 3,
    messy: 3,
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
  photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&auto=format',
  tags: ['Não fumante', 'Sem pets', 'Organizado'],
  budget: 'R$ 800 – R$ 1.500',
  smoker: false,
  pets: false,
  organized: 4,
  messy: 2,
};

const CHAT_MESSAGES = [
  { from: 'them', text: 'Oi! Vi que você também está procurando na Vila Madalena 😊', time: '14:30' },
  { from: 'me', text: 'Oi Ana! Isso mesmo, estou procurando por lá já faz um tempo. O que você achou do nosso match?', time: '14:33' },
  { from: 'them', text: 'Achei ótimo! A gente tem muita coisa em comum hehe. Você costuma cozinhar muito?', time: '14:35' },
  { from: 'me', text: 'Adoro! Fim de semana especialmente. Seria incrível dividir uma cozinha com quem também curte.', time: '14:37' },
  { from: 'them', text: 'Perfeito! Eu faço o mesmo 🍳 E em relação ao orçamento, você está procurando um quarto a partir de quanto?', time: '14:40' },
  { from: 'me', text: 'Em torno de R$ 900 a R$ 1.300. Você tem algum lugar em mente?', time: '14:42' },
  { from: 'them', text: 'Tenho uma indicação boa na Rua Harmonia, próximo ao metrô. Posso te mandar o contato da imobiliária!', time: '14:45' },
];

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

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8E2DC', padding: '16px' }}>
      <div style={{
        width: '100%',
        maxWidth: '390px',
        minHeight: '844px',
        background: C.bg,
        borderRadius: '44px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 0 0 8px #D0C8C0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Status bar */}
        <div style={{ height: '44px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Outfit,sans-serif', color: C.text }}>9:41</span>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill={C.text}><rect x="0" y="3" width="3" height="9" rx="1"/><rect x="4.5" y="2" width="3" height="10" rx="1"/><rect x="9" y="0" width="3" height="12" rx="1"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" opacity="0.3"/></svg>
            <svg width="15" height="12" viewBox="0 0 15 12" fill={C.text}><path d="M7.5 2.5 C10 2.5 12.2 3.6 13.7 5.3 L15 4 C13.1 1.8 10.4 0.5 7.5 0.5 C4.6 0.5 1.9 1.8 0 4 L1.3 5.3 C2.8 3.6 5 2.5 7.5 2.5Z"/><path d="M7.5 5.5 C9 5.5 10.4 6.2 11.4 7.3 L12.7 6 C11.3 4.5 9.5 3.5 7.5 3.5 C5.5 3.5 3.7 4.5 2.3 6 L3.6 7.3 C4.6 6.2 6 5.5 7.5 5.5Z"/><circle cx="7.5" cy="10" r="1.5"/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke={C.text} strokeOpacity="0.35"/><rect x="2" y="2" width="17" height="8" rx="2" fill={C.text}/><path d="M23 4.5V7.5a1.5 1.5 0 000-3z" fill={C.text} fillOpacity="0.4"/></svg>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

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
      fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
      transition: 'opacity 0.15s', ...extraStyle,
    }}
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

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
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
      position: 'sticky', bottom: 0, left: 0, right: 0,
      background: C.card, borderTop: `1px solid ${C.border}`,
      display: 'flex', zIndex: 50,
      paddingBottom: '20px',
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

// ─── Screen: Welcome ──────────────────────────────────────────────────────────

function WelcomeScreen({ nav }: { nav: (s: Screen) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '844px', background: C.bg }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px 32px' }}>
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
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

        {/* Illustration */}
        <div style={{ margin: '32px 0', position: 'relative', width: '100%' }}>
          <div style={{ borderRadius: '28px', overflow: 'hidden', height: '280px', position: 'relative' }}>
            <img
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&auto=format"
              alt="Pessoas convivendo em apartamento aconchegante"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.5) 0%, transparent 60%)' }}/>
          </div>
          <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
            <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.3 }}>
              Encontre quem combina com seu jeito de morar
            </p>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Btn label="Entrar" onClick={() => nav('login')} />
          <Btn label="Criar conta" onClick={() => nav('register')} outline />
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Login ─────────────────────────────────────────────────────────────

function LoginScreen({ nav, onLoginSuccess }: { nav: (s: Screen) => void; onLoginSuccess: () => Promise<void> }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, padding: '44px 0 0' }}>
      <div style={{ padding: '32px 28px', flex: 1 }}>
        <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600 }}>Voltar</span>
        </button>

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, padding: '44px 0 0' }}>
      <div style={{ padding: '32px 28px', flex: 1 }}>
        <button onClick={() => nav('welcome')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: C.muted }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600 }}>Voltar</span>
        </button>

        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Criar conta</h2>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.muted, margin: '0 0 28px' }}>Vamos te conectar ao lugar certo</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Nome completo" placeholder="Seu nome" value={nome} onChange={setNome} error={fieldErrors.username} />
          <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={setEmail} error={fieldErrors.email} />
          <Input label="Senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={setSenha} error={fieldErrors.password} />
          <Input label="Confirmar senha" type="password" placeholder="Repita a senha" value={confirmSenha} onChange={setConfirmSenha} error={fieldErrors.confirmSenha} />
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
  );
}

// ─── Screen: Profile Create ───────────────────────────────────────────────────

function ProfileCreateScreen({ nav, onPerfilCriado }: { nav: (s: Screen) => void; onPerfilCriado: (p: PerfilAPI) => void }) {
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');
  const [regiao, setRegiao] = useState('');
  const [bio, setBio] = useState('');
  const [orcamentoMin, setOrcamentoMin] = useState('');
  const [orcamentoMax, setOrcamentoMax] = useState('');
  const [smoker, setSmoker] = useState<boolean | null>(null);
  const [pets, setPets] = useState<boolean | null>(null);
  const [organized, setOrganized] = useState(0);
  const [messy, setMessy] = useState(0);
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
      if (messy === 0) erros.tolerancia_bagunca = 'Selecione sua tolerância à bagunça.';
      if (organized === 0) erros.nivel_organizacao = 'Selecione seu nível de organização.';
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

  const ProgressBar = () => (
    <div style={{ padding: '20px 28px 0' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= step ? C.primary : C.border }} />
        ))}
      </div>
      <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>
        Etapa {step} de 3 — {['Informações pessoais', 'Preferências de moradia', 'Hábitos'][step-1]}
      </p>
    </div>
  );

  const YesNo = ({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) => (
    <div>
      <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => onChange(v)} style={{
            flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer',
            border: `2px solid ${value === v ? C.primary : C.border}`,
            background: value === v ? `${C.primary}12` : C.card,
            color: value === v ? C.primary : C.muted,
            fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 700,
          }}>
            {v ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
    </div>
  );

  const ScaleInput = ({ label, value, onChange, errorKey }: { label: string; value: number; onChange: (v: number) => void; errorKey: string }) => (
    <div>
      <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1,2,3,4,5].map(i => (
          <button key={i} onClick={() => onChange(i)} style={{
            flex: 1, height: '40px', borderRadius: '10px', cursor: 'pointer',
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, paddingTop: '44px' }}>
      <ProgressBar />
      <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
              <Input label="Idade" type="number" placeholder="Sua idade" value={idade} onChange={setIdade} error={fieldErrors.idade} />
              <Input label="Região ou bairro" placeholder="Ex: Vila Madalena, SP" value={regiao} onChange={setRegiao} error={fieldErrors.regiao} />
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

        {step === 2 && (
          <>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 24px' }}>Preferências</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Faixa de orçamento mensal</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Input label="Mínimo (R$)" placeholder="700" value={orcamentoMin} onChange={setOrcamentoMin} error={fieldErrors.orcamento_min} />
                  <Input label="Máximo (R$)" placeholder="1500" value={orcamentoMax} onChange={setOrcamentoMax} error={fieldErrors.orcamento_max} />
                </div>
              </div>
              <YesNo label="Você fuma?" value={smoker} onChange={setSmoker} />
              <YesNo label="Aceita pets?" value={pets} onChange={setPets} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 24px' }}>Seus hábitos</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ScaleInput label="Tolerância à bagunça (1 = mínima, 5 = máxima)" value={messy} onChange={setMessy} errorKey="tolerancia_bagunca" />
              <ScaleInput label="Nível de organização (1 = mínimo, 5 = máximo)" value={organized} onChange={setOrganized} errorKey="nivel_organizacao" />
            </div>
          </>
        )}

        {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginTop: '12px', textAlign: 'center' }}>{erro}</p>}

        <div style={{ marginTop: 'auto', paddingTop: '32px', display: 'flex', gap: '12px' }}>
          {step > 1 && <Btn label="Voltar" outline onClick={() => { setFieldErrors({}); setStep(s => s - 1); }} />}
          <Btn
            label={step === 3 ? (loading ? 'Aguarde...' : 'Concluir perfil') : 'Próxima etapa'}
            onClick={step < 3 ? handleProximo : handleConcluir}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Discovery ────────────────────────────────────────────────────────

function DiscoveryScreen({ nav, setMatchProfile, showFilters, setShowFilters, tab, setTab }: {
  nav: (s: Screen) => void;
  setMatchProfile: (p: Profile) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const [index, setIndex] = useState(0);
  const profile = PROFILES[index % PROFILES.length];

  const handleLike = () => {
    setMatchProfile(profile);
    nav('match');
  };
  const handleDislike = () => setIndex(i => i + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, paddingTop: '44px' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>Descoberta</h1>
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

      {/* Card */}
      <div style={{ padding: '0 20px', flex: 1 }}>
        <div
          onClick={() => nav('profile-detail')}
          style={{
            borderRadius: '28px', overflow: 'hidden', position: 'relative',
            height: '480px', cursor: 'pointer',
            boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
          }}
        >
          <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.88) 0%, rgba(42,36,32,0.2) 50%, transparent 80%)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{profile.name}, {profile.age}</h2>
                <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: 0 }}>📍 {profile.region}</p>
              </div>
              <CompatBadge value={profile.compat} />
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {profile.tags.map(t => (
                <span key={t} style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: 'Nunito,sans-serif' }}>{t}</span>
              ))}
            </div>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>
              {profile.bio.slice(0, 80)}...
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '24px' }}>
          <button onClick={handleDislike} style={{
            width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`,
            background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button onClick={handleLike} style={{
            width: '72px', height: '72px', borderRadius: '50%', border: 'none',
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 24px rgba(224,107,69,0.4)`,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
          <button style={{
            width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${C.border}`,
            background: C.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>

      <BottomNav tab={tab} setTab={(t) => { setTab(t); nav(t as Screen); }} />

      {/* Filters modal */}
      {showFilters && <FiltersModal onClose={() => setShowFilters(false)} />}
    </div>
  );
}

// ─── Screen: Profile Detail ───────────────────────────────────────────────────

function ProfileDetailScreen({ nav, profile }: { nav: (s: Screen) => void; profile: Profile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, paddingTop: '44px' }}>
      <div style={{ position: 'relative', height: '340px', flexShrink: 0 }}>
        <img src={profile.photo} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(42,36,32,0.6) 0%, transparent 60%)' }} />
        <button onClick={() => nav('discovery')} style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
      </div>

      <div style={{ padding: '24px 24px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '28px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{profile.name}, {profile.age}</h2>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: 0 }}>📍 {profile.region}</p>
          </div>
          <CompatBadge value={profile.compat} large />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {profile.tags.map(t => <Tag key={t} label={t} />)}
        </div>

        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '15px', color: C.text, lineHeight: 1.7, marginBottom: '24px' }}>{profile.bio}</p>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '20px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Preferências de moradia</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Orçamento</span>
              <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{profile.budget}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Fumante</span>
              <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{profile.smoker ? 'Sim' : 'Não'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Aceita pets</span>
              <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '14px', fontWeight: 700, color: C.text }}>{profile.pets ? 'Sim' : 'Não'}</span>
            </div>
          </div>
        </div>

        <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '24px', border: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>Hábitos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Organização</span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{profile.organized}/5</span>
              </div>
              <ScaleBar value={profile.organized} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Tolerância à bagunça</span>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{profile.messy}/5</span>
              </div>
              <ScaleBar value={profile.messy} />
            </div>
          </div>
        </div>

        <Btn label="💛 Curtir perfil" onClick={() => nav('match')} />
      </div>
    </div>
  );
}

// ─── Filters Modal ────────────────────────────────────────────────────────────

function FiltersModal({ onClose }: { onClose: () => void }) {
  const [pets, setPets] = useState<boolean | null>(null);
  const [smoker, setSmoker] = useState<boolean | null>(null);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: C.card, borderRadius: '28px 28px 0 0', padding: '24px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '22px', fontWeight: 800, color: C.text, margin: 0 }}>Filtros</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '22px' }}>✕</button>
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
                    flex: 1, padding: '10px', borderRadius: '12px', cursor: 'pointer',
                    border: `2px solid ${value === v ? C.primary : C.border}`,
                    background: value === v ? `${C.primary}12` : C.bg,
                    color: value === v ? C.primary : C.muted,
                    fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 700,
                  }}>
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

// ─── Screen: Match ────────────────────────────────────────────────────────────

function MatchScreen({ nav, profile }: { nav: (s: Screen) => void; profile: Profile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '844px', background: `linear-gradient(160deg, ${C.primaryDark} 0%, ${C.primary} 50%, ${C.primaryLight} 100%)`, padding: '40px 28px', paddingTop: '84px' }}>
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
        <button onClick={() => nav('chat')} style={{
          width: '100%', padding: '16px', background: '#fff', color: C.primary,
          border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
          fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          💬 Iniciar conversa
        </button>
        <button onClick={() => nav('discovery')} style={{
          width: '100%', padding: '16px', background: 'transparent', color: '#fff',
          border: '2px solid rgba(255,255,255,0.5)', borderRadius: '16px', fontSize: '16px', fontWeight: 700,
          fontFamily: 'Outfit,sans-serif', cursor: 'pointer',
        }}>
          Continuar procurando
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Matches List ─────────────────────────────────────────────────────

function MatchesScreen({ nav, setCurrentChat, tab, setTab }: {
  nav: (s: Screen) => void;
  setCurrentChat: (p: Profile) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const matched = PROFILES;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, paddingTop: '44px' }}>
      <div style={{ padding: '20px 24px 12px' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Seus Matches</h1>
        <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: 0 }}>{matched.length} conexões ativas</p>
      </div>

      <div style={{ padding: '8px 0', flex: 1, overflowY: 'auto' }}>
        {matched.map(p => (
          <button key={p.id} onClick={() => { setCurrentChat(p); nav('chat'); }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 24px', background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.primary}` }}>
                <img src={p.photo} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', background: C.mint, borderRadius: '50%', border: '2px solid white' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '16px', fontWeight: 700, color: C.text }}>{p.name}</span>
                <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '12px', color: C.muted }}>{p.lastTime}</span>
              </div>
              <CompatBadge value={p.compat} />
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.muted, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.lastMsg}</p>
            </div>
          </button>
        ))}
      </div>

      <BottomNav tab={tab} setTab={(t) => { setTab(t); nav(t as Screen); }} />
    </div>
  );
}

// ─── Screen: Chat ─────────────────────────────────────────────────────────────

function ChatScreen({ nav, profile, showReport, setShowReport }: {
  nav: (s: Screen) => void;
  profile: Profile;
  showReport: boolean;
  setShowReport: (v: boolean) => void;
}) {
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [messages, setMessages] = useState(CHAT_MESSAGES);

  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { from: 'me', text: input.trim(), time: 'agora' }]);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, paddingTop: '44px' }}>
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
                }}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%', padding: '11px 15px', borderRadius: msg.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.from === 'me' ? C.primary : C.card,
              color: msg.from === 'me' ? '#fff' : C.text,
              border: msg.from === 'me' ? 'none' : `1px solid ${C.border}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', lineHeight: 1.5, margin: '0 0 4px' }}>{msg.text}</p>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '11px', color: msg.from === 'me' ? 'rgba(255,255,255,0.7)' : C.muted, margin: 0, textAlign: 'right' }}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px 28px', background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Digite uma mensagem..."
          style={{ flex: 1, padding: '12px 16px', borderRadius: '22px', border: `1.5px solid ${C.border}`, background: C.bg, fontSize: '14px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none' }}
        />
        <button onClick={send} style={{
          width: '46px', height: '46px', borderRadius: '50%', border: 'none',
          background: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}

// ─── Screen: My Profile ───────────────────────────────────────────────────────

function MyProfileScreen({ nav, tab, setTab, meuPerfil, onPerfilAtualizado }: {
  nav: (s: Screen) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  meuPerfil: PerfilAPI | null;
  onPerfilAtualizado: (p: PerfilAPI) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editIdade, setEditIdade] = useState('');
  const [editRegiao, setEditRegiao] = useState('');
  const [editBio, setEditBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (meuPerfil) {
      setEditNome(meuPerfil.nome);
      setEditIdade(String(meuPerfil.idade));
      setEditRegiao(meuPerfil.regiao);
      setEditBio(meuPerfil.bio);
    }
  }, [meuPerfil]);

  const salvar = async () => {
    if (!meuPerfil) return;
    setErro('');
    setLoading(true);
    try {
      const atualizado = await apiAtualizarPerfil(meuPerfil.id, {
        nome: editNome.trim(),
        idade: Number(editIdade),
        regiao: editRegiao.trim(),
        bio: editBio.trim(),
      });
      onPerfilAtualizado(atualizado);
      setEditing(false);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    nav('welcome');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '844px', background: C.bg, paddingTop: '44px' }}>
      <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '24px', fontWeight: 800, color: C.text, margin: 0 }}>Meu Perfil</h1>
        {editing
          ? <button onClick={salvar} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{loading ? '...' : 'Salvar'}</button>
          : <button onClick={() => setEditing(true)} style={{ background: 'none', border: `1.5px solid ${C.primary}`, color: C.primary, borderRadius: '12px', padding: '8px 16px', fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Editar</button>
        }
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '20px', background: C.card, borderRadius: '20px', border: `1px solid ${C.border}` }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.primary}`, flexShrink: 0 }}>
            <img src={MY_PROFILE.photo} alt="Você" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: '0 0 2px' }}>{meuPerfil?.nome || MY_PROFILE.name}</h2>
            <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted, margin: '0 0 6px' }}>{meuPerfil?.idade || MY_PROFILE.age} anos · {meuPerfil?.regiao || MY_PROFILE.region}</p>
          </div>
        </div>

        {erro && <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '13px', color: C.danger, marginBottom: '12px', textAlign: 'center' }}>{erro}</p>}

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <Input label="Nome" placeholder="Seu nome" value={editNome} onChange={setEditNome} />
            <Input label="Idade" type="number" placeholder="Sua idade" value={editIdade} onChange={setEditIdade} />
            <Input label="Região" placeholder="Bairro ou cidade" value={editRegiao} onChange={setEditRegiao} />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: C.muted, fontFamily: 'Nunito,sans-serif', display: 'block', marginBottom: '6px' }}>Biografia</label>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1.5px solid ${C.border}`, background: C.card, fontSize: '15px', fontFamily: 'Nunito,sans-serif', color: C.text, outline: 'none', resize: 'none', height: '90px', boxSizing: 'border-box' }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
              <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 10px' }}>Sobre mim</h3>
              <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.text, lineHeight: 1.7, margin: 0 }}>{meuPerfil?.bio || MY_PROFILE.bio}</p>
            </div>

            <div style={{ background: C.card, borderRadius: '20px', padding: '20px', marginBottom: '16px', border: `1px solid ${C.border}` }}>
              <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Preferências</h3>
              {[
                { label: 'Orçamento', value: meuPerfil ? `R$ ${meuPerfil.orcamento_min} – R$ ${meuPerfil.orcamento_max}` : MY_PROFILE.budget },
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
              <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '15px', fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Hábitos</h3>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Organização</span>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{meuPerfil?.nivel_organizacao ?? MY_PROFILE.organized}/5</span>
                </div>
                <ScaleBar value={meuPerfil?.nivel_organizacao ?? MY_PROFILE.organized} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: '14px', color: C.muted }}>Tolerância à bagunça</span>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: '13px', fontWeight: 700, color: C.primary }}>{meuPerfil?.tolerancia_bagunca ?? MY_PROFILE.messy}/5</span>
                </div>
                <ScaleBar value={meuPerfil?.tolerancia_bagunca ?? MY_PROFILE.messy} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
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
      </div>

      <BottomNav tab={tab} setTab={(t) => { setTab(t); nav(t as Screen); }} />
    </div>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const reasons = ['Conteúdo inapropriado', 'Perfil falso', 'Assédio ou ameaças', 'Informações enganosas', 'Spam', 'Outro motivo'];

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(42,36,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: C.card, borderRadius: '28px 28px 0 0', padding: '24px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '20px', fontWeight: 800, color: C.text, margin: 0 }}>Denunciar usuário</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '22px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {reasons.map(r => (
            <button key={r} onClick={() => setSelected(r)} style={{
              padding: '13px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${selected === r ? C.danger : C.border}`,
              background: selected === r ? `${C.danger}10` : C.bg,
              color: selected === r ? C.danger : C.text,
              fontFamily: 'Nunito,sans-serif', fontSize: '14px', fontWeight: 600,
            }}>
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
    (initialScreen === 'discovery' || initialScreen === 'matches' || initialScreen === 'profile')
      ? (initialScreen as Tab)
      : 'discovery'
  );
  const [matchProfile, setMatchProfile] = useState<Profile>(PROFILES[0]);
  const [currentChat, setCurrentChat] = useState<Profile>(PROFILES[0]);
  const [showFilters, setShowFilters] = useState(getParam('filters') === '1');
  const [showReport, setShowReport] = useState(getParam('report') === '1');
  const [meuPerfil, setMeuPerfil] = useState<PerfilAPI | null>(null);

  const nav = (s: Screen) => {
    setScreen(s);
    if (s === 'discovery' || s === 'matches' || s === 'profile') setTab(s as Tab);
  };

  const handleLoginSuccess = async () => {
    try {
      const usuario = await buscarMeuUsuario();
      const perfis = await listarPerfis();
      const perfil = perfis.find(p => p.usuario === usuario.id) ?? null;
      setMeuPerfil(perfil);
      nav(perfil ? 'discovery' : 'profile-create');
    } catch {
      nav('profile-create');
    }
  };

  return (
    <PhoneShell>
      {screen === 'welcome' && <WelcomeScreen nav={nav} />}
      {screen === 'login' && <LoginScreen nav={nav} onLoginSuccess={handleLoginSuccess} />}
      {screen === 'register' && <RegisterScreen nav={nav} onLoginSuccess={handleLoginSuccess} />}
      {screen === 'profile-create' && (
        <ProfileCreateScreen nav={nav} onPerfilCriado={(p) => setMeuPerfil(p)} />
      )}
      {screen === 'discovery' && (
        <DiscoveryScreen
          nav={nav}
          setMatchProfile={setMatchProfile}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          tab={tab}
          setTab={setTab}
        />
      )}
      {screen === 'profile-detail' && <ProfileDetailScreen nav={nav} profile={matchProfile || PROFILES[0]} />}
      {screen === 'match' && <MatchScreen nav={nav} profile={matchProfile} />}
      {screen === 'matches' && (
        <MatchesScreen nav={nav} setCurrentChat={setCurrentChat} tab={tab} setTab={setTab} />
      )}
      {screen === 'chat' && (
        <ChatScreen nav={nav} profile={currentChat} showReport={showReport} setShowReport={setShowReport} />
      )}
      {screen === 'profile' && (
        <MyProfileScreen
          nav={nav}
          tab={tab}
          setTab={setTab}
          meuPerfil={meuPerfil}
          onPerfilAtualizado={(p) => setMeuPerfil(p)}
        />
      )}
    </PhoneShell>
  );
}
