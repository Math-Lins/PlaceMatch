"""
Script de seed — popula o banco com dados realistas para testes e demonstração.

Uso:
    python seed.py

Cria:
- 1 admin já existente (mantém se já criado)
- 10 usuários buscando_vaga + perfis
- 10 usuários oferecendo_vaga + perfis
- Scores de compatibilidade entre todos os pares
- Curtidas e matches espalhados pelos últimos 30 dias
- Mensagens nas conversas abertas
- 5 denúncias em estados variados
"""

import os
import sys
import django
import random
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'placematch.settings')
django.setup()

from django.utils import timezone
from django.db import transaction

from usuarios.models import Usuario
from perfis.models import Perfil
from matches.models import Compatibilidade, Curtida, Match
from matches.servicos import recalcular_lote
from chat.models import Mensagem
from moderacao.models import Denuncia

random.seed(42)

# ── Dados base ────────────────────────────────────────────────────────────────

REGIOES = ['Boa Viagem', 'Casa Amarela', 'Derby', 'Espinheiro',
           'Graças', 'Ilha do Leite', 'Madalena', 'Pina', 'Recife Antigo', 'Torre']

NOMES_MASC = ['Lucas', 'Matheus', 'Gabriel', 'Rafael', 'Henrique',
              'Felipe', 'Bruno', 'Thiago', 'Leonardo', 'Gustavo']
NOMES_FEM  = ['Ana', 'Julia', 'Beatriz', 'Larissa', 'Camila',
              'Fernanda', 'Isabela', 'Mariana', 'Patricia', 'Tais']

HORARIOS = ['madrugador', 'noturno', 'flexivel']
VISITAS  = ['raramente', 'as_vezes', 'frequentemente']
IMOVEIS  = ['apartamento', 'casa', 'republica', 'indiferente']

MENSAGENS = [
    'Oi! Vi seu perfil e achei que combinamos bem.',
    'Olá! Ainda está disponível?',
    'Boa tarde! Posso saber mais detalhes sobre o imóvel?',
    'Oi, qual é a melhor forma de visitar o lugar?',
    'Combinamos bastante nos critérios, que acha de conversar?',
    'Gostei do seu perfil! Podemos marcar uma visita?',
    'Oi! Aceita pets pequenos?',
    'Olá, qual a data de disponibilidade?',
    'Ainda tem vaga disponível?',
    'Oi! Me conta mais sobre os moradores atuais.',
]

MOTIVOS_DENUNCIA = ['spam', 'ofensivo', 'falso', 'outro']


# ── Helpers ───────────────────────────────────────────────────────────────────

def data_aleatoria(dias_atras_max=30):
    delta = random.randint(0, dias_atras_max)
    return timezone.now() - timedelta(days=delta, hours=random.randint(0, 23))


def get_ou_criar_usuario(email, username, tipo, nome):
    u, criado = Usuario.objects.get_or_create(
        email=email,
        defaults={
            'username': username,
            'tipo': tipo,
            'is_active': True,
        }
    )
    if criado:
        u.set_password('Teste@123')
        u.save()
    return u, criado


def criar_perfil(usuario, nome, tipo):
    if hasattr(usuario, 'perfil'):
        return usuario.perfil, False

    orc_min = random.choice([500, 600, 700, 800, 900, 1000])
    orc_max = orc_min + random.choice([300, 400, 500, 600, 800])

    p = Perfil.objects.create(
        usuario=usuario,
        nome=nome,
        idade=random.randint(18, 35),
        regiao=random.choice(REGIOES),
        bio=f'Olá! Sou {nome} e estou buscando um bom ambiente para morar.',
        orcamento_min=orc_min,
        orcamento_max=orc_max,
        fumante=random.choice([True, False]),
        aceita_pets=random.choice([True, False]),
        tolerancia_bagunca=random.randint(1, 5),
        nivel_organizacao=random.randint(1, 5),
        perfil_horario=random.choice(HORARIOS),
        nivel_ruido=random.randint(1, 5),
        nivel_social=random.randint(1, 5),
        aceita_visitas=random.choice(VISITAS),
        tipo_imovel=random.choice(IMOVEIS),
        qtd_moradores=random.randint(1, 4),
        titulo_anuncio=f'Vaga em {random.choice(REGIOES)}' if tipo == 'oferecendo_vaga' else '',
        descricao_imovel='Apartamento amplo, bem localizado.' if tipo == 'oferecendo_vaga' else '',
    )
    return p, True


# ── Main ──────────────────────────────────────────────────────────────────────

print('\n=== PlaceMatch Seed ===\n')

with transaction.atomic():

    # ── 1. Usuários ───────────────────────────────────────────────────────────
    print('[1/6] Criando usuários...')

    buscando = []
    for i, nome in enumerate(NOMES_MASC):
        email = f'{nome.lower()}.busca@teste.com'
        u, criado = get_ou_criar_usuario(email, f'{nome.lower()}_busca', 'buscando_vaga', nome)
        p, _ = criar_perfil(u, nome, 'buscando_vaga')
        buscando.append(p)
        status = 'criado' if criado else 'já existe'
        print(f'  {nome} (buscando_vaga) — {status}')

    oferecendo = []
    for i, nome in enumerate(NOMES_FEM):
        email = f'{nome.lower()}.oferece@teste.com'
        u, criado = get_ou_criar_usuario(email, f'{nome.lower()}_oferece', 'oferecendo_vaga', nome)
        p, _ = criar_perfil(u, nome, 'oferecendo_vaga')
        oferecendo.append(p)
        status = 'criado' if criado else 'já existe'
        print(f'  {nome} (oferecendo_vaga) — {status}')

    # Garante que os usuários de teste do .env têm perfil
    try:
        u_inq = Usuario.objects.get(email='inquilino@teste.com')
        criar_perfil(u_inq, 'Inquilino Teste', 'buscando_vaga')
    except Usuario.DoesNotExist:
        pass
    try:
        u_anu = Usuario.objects.get(email='anunciante@teste.com')
        criar_perfil(u_anu, 'Anunciante Teste', 'oferecendo_vaga')
    except Usuario.DoesNotExist:
        pass

    # ── 2. Compatibilidades ───────────────────────────────────────────────────
    print('\n[2/6] Calculando scores de compatibilidade...')
    todos_perfis = Perfil.objects.select_related('usuario').all()
    for p in todos_perfis:
        recalcular_lote(p)
    total_compat = Compatibilidade.objects.count()
    print(f'  {total_compat} compatibilidades calculadas.')

    # ── 3. Curtidas e matches ─────────────────────────────────────────────────
    print('\n[3/6] Criando curtidas e matches...')

    pares_com_match = 0
    pares_sem_match = 0

    # Cada buscando curte ~7 dos 10 oferecendo; ~5 são mútuos (match)
    for pb in buscando:
        alvos = random.sample(oferecendo, k=7)
        curtiu_ids = set()
        for po in alvos:
            if Curtida.objects.filter(perfil_origem=pb, perfil_destino=po).exists():
                curtiu_ids.add(po.id)
                continue
            Curtida.objects.create(perfil_origem=pb, perfil_destino=po, tipo='curtir')
            curtiu_ids.add(po.id)

        # ~5 retribuem
        retribuem = random.sample(alvos, k=min(5, len(alvos)))
        for po in retribuem:
            if Curtida.objects.filter(perfil_origem=po, perfil_destino=pb).exists():
                continue
            Curtida.objects.create(perfil_origem=po, perfil_destino=pb, tipo='curtir')

            # Cria match
            pa_id = min(pb.id, po.id)
            pb_id = max(pb.id, po.id)
            try:
                compat = Compatibilidade.objects.get(perfil_a_id=pa_id, perfil_b_id=pb_id)
                score = compat.score
            except Compatibilidade.DoesNotExist:
                score = round(random.uniform(0.4, 0.95), 4)

            match, criado = Match.objects.get_or_create(
                perfil_a_id=pa_id,
                perfil_b_id=pb_id,
                defaults={'score': score},
            )
            if criado:
                pares_com_match += 1

        # Alguns recusam os restantes
        restantes = [po for po in oferecendo if po not in alvos]
        for po in restantes[:2]:
            if not Curtida.objects.filter(perfil_origem=pb, perfil_destino=po).exists():
                Curtida.objects.create(perfil_origem=pb, perfil_destino=po, tipo='recusar')
                pares_sem_match += 1

    print(f'  {pares_com_match} matches criados, {pares_sem_match} recusas.')

    # ── 4. Mensagens ──────────────────────────────────────────────────────────
    print('\n[4/6] Criando mensagens...')

    matches = Match.objects.select_related('perfil_a', 'perfil_b').all()
    total_msgs = 0
    for match in matches:
        # ~70% das conversas têm mensagens
        if random.random() < 0.3:
            continue
        qtd = random.randint(2, 6)
        participantes = [match.perfil_a, match.perfil_b]
        for _ in range(qtd):
            remetente = random.choice(participantes)
            Mensagem.objects.get_or_create(
                match=match,
                remetente=remetente,
                conteudo=random.choice(MENSAGENS),
            )
            total_msgs += 1

    print(f'  {total_msgs} mensagens criadas.')

    # ── 5. Denúncias ──────────────────────────────────────────────────────────
    print('\n[5/6] Criando denúncias...')

    admin = Usuario.objects.filter(tipo='administrador').first()
    todos_usuarios = list(Usuario.objects.filter(tipo__in=['buscando_vaga', 'oferecendo_vaga']))

    denuncias_criadas = 0
    pares_usados = set()
    tentativas = 0
    while denuncias_criadas < 5 and tentativas < 50:
        tentativas += 1
        denunciante = random.choice(todos_usuarios)
        denunciado = random.choice(todos_usuarios)
        if denunciante.id == denunciado.id:
            continue
        par = (min(denunciante.id, denunciado.id), max(denunciante.id, denunciado.id))
        if par in pares_usados:
            continue
        pares_usados.add(par)

        d = Denuncia.objects.create(
            denunciante=denunciante,
            denunciado=denunciado,
            motivo=random.choice(MOTIVOS_DENUNCIA),
            descricao='Comportamento inadequado reportado pelo usuário.',
            status='pendente',
        )

        # Alguns já resolvidos
        if denuncias_criadas < 2 and admin:
            d.status = random.choice(['resolvida', 'descartada'])
            d.resolvida_por = admin
            d.resolucao = 'Analisado pela equipe de moderação.'
            d.save()

        denuncias_criadas += 1

    print(f'  {denuncias_criadas} denúncias criadas.')

    # ── 6. Resumo ─────────────────────────────────────────────────────────────
    print('\n[6/6] Resumo final:')
    print(f'  Usuários:         {Usuario.objects.count()}')
    print(f'  Perfis:           {Perfil.objects.count()}')
    print(f'  Compatibilidades: {Compatibilidade.objects.count()}')
    print(f'  Curtidas:         {Curtida.objects.count()}')
    print(f'  Matches:          {Match.objects.count()}')
    print(f'  Mensagens:        {Mensagem.objects.count()}')
    print(f'  Denúncias:        {Denuncia.objects.count()}')
    print('\n=== Seed concluído com sucesso! ===\n')
    print('Credenciais de acesso:')
    print('  Admin:       admin@admin.com.br  /  123456')
    print('  Inquilino:   inquilino@teste.com  /  Teste@123')
    print('  Anunciante:  anunciante@teste.com  /  Teste@123')
    print('  Extras:      <nome>.busca@teste.com / <nome>.oferece@teste.com  /  Teste@123')
