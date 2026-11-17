"""
python manage.py seed_perfis

Cria usuários + perfis de demonstração (Recife, perto da UNINASSAU), com fotos de perfil
e anúncios com fotos dos imóveis. Perfis variados para cobrir os extremos do algoritmo.

Senha padrão de todos: Test@1234

As fotos são links públicos (Unsplash e randomuser.me). Sem internet, a interface mostra a
imagem substituta; o roteiro de prints (frontend/e2e/tour-rc.spec.ts) serve cópias locais.

Flags:
  --limpar   remove APENAS os usuários criados por este comando antes de recriar
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from perfis.models import Perfil

User = get_user_model()

SEED_TAG = '__seed__'   # marcado no username para identificar seeds


def foto_imovel(id_unsplash):
    return f'https://images.unsplash.com/photo-{id_unsplash}?w=800&h=600&fit=crop'


def avatar(genero, n):
    return f'https://randomuser.me/api/portraits/{genero}/{n}.jpg'


# Fotos de interiores (Unsplash) usadas nos anúncios
SALA_AZUL = foto_imovel('1493809842364-78817add7ffb')
SALA_PLANTAS = foto_imovel('1502672260266-1c1ef2d93688')
SALA_CLARA = foto_imovel('1513694203232-719a280e022f')
SALA_LARANJA = foto_imovel('1554995207-c18c203602cb')
SALA_AMPLA = foto_imovel('1560448204-e02f11c3d0e2')
SALA_AMARELA = foto_imovel('1586023492125-27b2c045efd7')
SALA_JANTAR = foto_imovel('1560185007-cde436f6a4d0')
SALA_ESTUDIO = foto_imovel('1522708323590-d24dbb6b0267')
SALA_TIJOLO = foto_imovel('1536376072261-38c75010e6c9')
COZINHA = foto_imovel('1484154218962-a197022b5858')
QUARTO_CASAL = foto_imovel('1505693416388-ac5ce068fe85')
QUARTO_LARANJA = foto_imovel('1540518614846-7eded433c457')
QUARTO_CLARO = foto_imovel('1595526114035-0d45ed16cfbf')
QUARTO_AZUL = foto_imovel('1505691938895-1758d7feb511')

SEED_USERS = [
    # (email, username, tipo, perfil_dict)
    ('ana@seed.pm', f'ana{SEED_TAG}', 'buscando_vaga', dict(
        nome='Ana Luísa', idade=23, regiao='Graças',
        bio='Estudante de arquitetura na UNINASSAU. Organizada, madrugadora e não fumo. Tenho uma gata muito tranquila.',
        orcamento_min=800, orcamento_max=1400,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
        foto_perfil_url=avatar('women', 26),
    )),
    ('pedro@seed.pm', f'pedro{SEED_TAG}', 'buscando_vaga', dict(
        nome='Pedro Henrique', idade=26, regiao='Boa Viagem',
        bio='Desenvolvedor remoto. Noturno, gosto de música e de receber os amigos no fim de semana.',
        orcamento_min=600, orcamento_max=1200,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=5, nivel_organizacao=1,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='republica', qtd_moradores=4,
        foto_perfil_url=avatar('men', 12),
    )),
    ('camila@seed.pm', f'camila{SEED_TAG}', 'buscando_vaga', dict(
        nome='Camila Souza', idade=24, regiao='Espinheiro',
        bio='Mestranda em comunicação. Flexível, sociável e adoro bichos.',
        orcamento_min=900, orcamento_max=1600,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=3, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=3,
        foto_perfil_url=avatar('women', 47),
    )),
    ('rafael@seed.pm', f'rafael{SEED_TAG}', 'buscando_vaga', dict(
        nome='Rafael Costa', idade=25, regiao='Graças',
        bio='Engenheiro civil. Muito organizado, madrugador e prefiro silêncio em casa.',
        orcamento_min=850, orcamento_max=1500,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=2, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=2,
        foto_perfil_url=avatar('men', 79),
    )),
    ('liz@seed.pm', f'liz{SEED_TAG}', 'buscando_vaga', dict(
        nome='Elizabete Ramos', idade=21, regiao='Boa Vista',
        bio='Artista plástica. Noturna, adoro receber amigos e fumo socialmente.',
        orcamento_min=400, orcamento_max=800,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=5, nivel_organizacao=1,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='republica', qtd_moradores=4,
        foto_perfil_url=avatar('women', 57),
    )),
    ('joao@seed.pm', f'joao{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='João Vitor', idade=28, regiao='Graças',
        bio='Professor universitário. Gosto de rotina, silêncio e ambientes organizados.',
        orcamento_min=1000, orcamento_max=1800,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=2,
        titulo_anuncio='Quarto mobiliado em apartamento silencioso nas Graças',
        descricao_imovel=(
            'Apartamento de 2 quartos a 10 minutos a pé da UNINASSAU, em prédio com portaria 24h. '
            'Quarto com armário embutido, ar-condicionado e boa iluminação. '
            'Ideal para quem busca tranquilidade e rotina de estudos.'
        ),
        fotos_imovel=[QUARTO_CLARO, SALA_CLARA, COZINHA],
        foto_perfil_url=avatar('men', 32),
    )),
    ('mariana@seed.pm', f'mariana{SEED_TAG}', 'buscando_vaga', dict(
        nome='Mariana Oliveira', idade=22, regiao='Derby',
        bio='Estudante de medicina. Madrugadora por necessidade, organizada e focada.',
        orcamento_min=750, orcamento_max=1300,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
        foto_perfil_url=avatar('women', 79),
    )),
    ('lucas@seed.pm', f'lucas{SEED_TAG}', 'buscando_vaga', dict(
        nome='Lucas Mendes', idade=24, regiao='Casa Forte',
        bio='Designer freelancer. Flexível e criativo, curto receber amigos e tenho um cachorro.',
        orcamento_min=900, orcamento_max=1700,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=4, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=3, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=3,
        foto_perfil_url=avatar('men', 57),
    )),
    ('fernanda@seed.pm', f'fernanda{SEED_TAG}', 'buscando_vaga', dict(
        nome='Fernanda Lima', idade=27, regiao='Boa Viagem',
        bio='Advogada. Reservada, prefiro ambientes tranquilos e sem pets.',
        orcamento_min=1200, orcamento_max=2200,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=1,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
        foto_perfil_url=avatar('women', 65),
    )),
    ('thiago@seed.pm', f'thiago{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Thiago Santos', idade=29, regiao='Boa Vista',
        bio='Músico. Noturno e criativo, casa sempre cheia de amigos. Fumo.',
        orcamento_min=500, orcamento_max=1000,
        fumante=True, aceita_pets=True,
        tolerancia_bagunca=5, nivel_organizacao=2,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=4,
        titulo_anuncio='Vaga em casa compartilhada na Boa Vista',
        descricao_imovel=(
            'Casa antiga reformada com 4 quartos, quintal e sala de convivência ampla, perto da Rua da Aurora. '
            'Ambiente descontraído, ideal para quem gosta de música, arte e encontros com amigos. '
            'Aceita pets e fumantes.'
        ),
        fotos_imovel=[SALA_TIJOLO, SALA_JANTAR, QUARTO_LARANJA],
        foto_perfil_url=avatar('men', 68),
    )),
    ('isabela@seed.pm', f'isabela{SEED_TAG}', 'buscando_vaga', dict(
        nome='Isabela Nunes', idade=23, regiao='Graças',
        bio='Estudante de nutrição. Cozinho muito, gosto de rotina e de ambientes limpos.',
        orcamento_min=850, orcamento_max=1500,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
        foto_perfil_url=avatar('women', 44),
    )),
    ('guilherme@seed.pm', f'guilherme{SEED_TAG}', 'buscando_vaga', dict(
        nome='Guilherme Alves', idade=25, regiao='Madalena',
        bio='Estudante de direito. Noturno, sociável, gosto de república e de festas.',
        orcamento_min=600, orcamento_max=1100,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=4, nivel_organizacao=2,
        perfil_horario='noturno', nivel_ruido=4, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='republica', qtd_moradores=4,
        foto_perfil_url=avatar('men', 47),
    )),
    ('patricia@seed.pm', f'patricia{SEED_TAG}', 'buscando_vaga', dict(
        nome='Patrícia Gomes', idade=31, regiao='Espinheiro',
        bio='Analista financeira. Muito organizada, prefiro silêncio e rotina.',
        orcamento_min=1100, orcamento_max=2000,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
        foto_perfil_url=avatar('women', 32),
    )),
    ('diego@seed.pm', f'diego{SEED_TAG}', 'buscando_vaga', dict(
        nome='Diego Ferreira', idade=22, regiao='Torre',
        bio='Estudante de publicidade. Flexível e tranquilo, gosto de séries em casa.',
        orcamento_min=700, orcamento_max=1300,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
        foto_perfil_url=avatar('men', 65),
    )),
    ('vitoria@seed.pm', f'vitoria{SEED_TAG}', 'buscando_vaga', dict(
        nome='Vitória Cardoso', idade=20, regiao='Boa Vista',
        bio='Caloura de psicologia. Sociável e flexível, aceito qualquer tipo de imóvel.',
        orcamento_min=500, orcamento_max=900,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=4, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=4, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='indiferente', qtd_moradores=3,
        foto_perfil_url=avatar('women', 21),
    )),
    # ── Mais quem oferece vaga, para diversificar a Descoberta ───────────────
    ('beatriz@seed.pm', f'beatriz{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Beatriz Almeida', idade=24, regiao='Derby',
        bio='Estudante de design. Organizada, madrugadora e adoro ter pets em casa.',
        orcamento_min=800, orcamento_max=1400,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
        titulo_anuncio='Quarto em apartamento charmoso no Derby',
        descricao_imovel=(
            'Apartamento de 2 quartos ao lado da Praça do Derby, com ônibus para a UNINASSAU na porta. '
            'Quarto aconchegante com janela e boa ventilação, cozinha equipada e área de serviço. '
            'Pets são bem-vindos.'
        ),
        fotos_imovel=[SALA_PLANTAS, QUARTO_CASAL, COZINHA],
        foto_perfil_url=avatar('women', 68),
    )),
    ('renato@seed.pm', f'renato{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Renato Barbosa', idade=27, regiao='Boa Viagem',
        bio='Engenheiro de software. Noturno e sociável, trabalho remoto e fumo de vez em quando.',
        orcamento_min=900, orcamento_max=1600,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=4, nivel_organizacao=3,
        perfil_horario='noturno', nivel_ruido=4, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='apartamento', qtd_moradores=3,
        titulo_anuncio='Vaga em apartamento moderno a duas quadras da praia',
        descricao_imovel=(
            'Apartamento de 3 quartos reformado em Boa Viagem, a duas quadras da praia. '
            'Internet de 1 Gb, home office montado e cozinha gourmet. '
            'Ambiente descontraído para quem curte trabalhar de casa.'
        ),
        fotos_imovel=[SALA_AZUL, SALA_ESTUDIO, QUARTO_AZUL],
        foto_perfil_url=avatar('men', 26),
    )),
    ('clara@seed.pm', f'clara{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Clara Freitas', idade=25, regiao='Espinheiro',
        bio='Terapeuta. Reservada, prefiro silêncio, rotina e ambientes limpos.',
        orcamento_min=1000, orcamento_max=1800,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=1,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
        titulo_anuncio='Studio mobiliado no Espinheiro, ideal para quem mora só',
        descricao_imovel=(
            'Studio de 35 m² totalmente mobiliado, com cozinha compacta, banheiro privativo e '
            'lavanderia compartilhada. Prédio tranquilo, sem festas, perto do Shopping Plaza.'
        ),
        fotos_imovel=[SALA_AMARELA, QUARTO_CLARO],
        foto_perfil_url=avatar('women', 90),
    )),
    ('henrique@seed.pm', f'henrique{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Henrique Moura', idade=23, regiao='Casa Forte',
        bio='Estudante de gastronomia. Flexível, curto cozinhar e receber amigos no fim de semana.',
        orcamento_min=700, orcamento_max=1200,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=3, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=3,
        titulo_anuncio='Quarto em casa com cozinha gourmet em Casa Forte',
        descricao_imovel=(
            'Casa de 3 quartos com cozinha equipada, área gourmet e jardim, perto da Praça de Casa Forte. '
            'Bairro residencial e arborizado. Pets aceitos; cozinhar junto é o diferencial da casa.'
        ),
        fotos_imovel=[SALA_JANTAR, COZINHA, SALA_LARANJA],
        foto_perfil_url=avatar('men', 90),
    )),
    ('julia@seed.pm', f'julia{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Júlia Prado', idade=22, regiao='Madalena',
        bio='Professora de ioga. Tranquila, vegetariana e apaixonada por animais.',
        orcamento_min=600, orcamento_max=1100,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='casa', qtd_moradores=2,
        titulo_anuncio='Quarto aconchegante em casa com jardim na Madalena',
        descricao_imovel=(
            'Casa de 2 quartos com jardim e espaço para ioga, a 15 minutos da UNINASSAU. '
            'Ambiente calmo, cozinha vegetariana compartilhada e animais bem-vindos.'
        ),
        fotos_imovel=[SALA_AMPLA, QUARTO_CASAL],
        foto_perfil_url=avatar('women', 12),
    )),
    ('marcos@seed.pm', f'marcos{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Marcos Vinícius', idade=29, regiao='Boa Viagem',
        bio='Empresário. Noturno e animado, casa grande com espaço para todos. Fumo.',
        orcamento_min=800, orcamento_max=1500,
        fumante=True, aceita_pets=True,
        tolerancia_bagunca=5, nivel_organizacao=2,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=4,
        titulo_anuncio='Vaga em casa compartilhada em Boa Viagem com área de lazer',
        descricao_imovel=(
            'Casa de 4 quartos com piscina, churrasqueira e área de lazer, perto do Parque Dona Lindu. '
            'Ambiente animado, com encontros frequentes. Fumantes e pets são aceitos.'
        ),
        fotos_imovel=[SALA_LARANJA, SALA_AMPLA, QUARTO_LARANJA],
        foto_perfil_url=avatar('men', 44),
    )),
]


class Command(BaseCommand):
    help = 'Cria usuários e perfis de demonstração (Recife) com fotos e anúncios.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limpar',
            action='store_true',
            help='Remove os usuários seed antes de recriar.',
        )

    def handle(self, *args, **options):
        if options['limpar']:
            removed = User.objects.filter(username__endswith=SEED_TAG).delete()
            self.stdout.write(self.style.WARNING(f'Removidos: {removed[0]} objetos.'))

        criados = 0
        atualizados = 0

        for email, username, tipo, perfil_data in SEED_USERS:
            if User.objects.filter(email=email).exists():
                # Idempotente: reaplica os dados de demonstração no perfil existente.
                User.objects.filter(email=email, first_name='').update(first_name=perfil_data['nome'])
                try:
                    perfil = Perfil.objects.get(usuario__email=email)
                    for field, value in perfil_data.items():
                        setattr(perfil, field, value)
                    perfil.save()
                    atualizados += 1
                except Perfil.DoesNotExist:
                    Perfil.objects.create(usuario=User.objects.get(email=email), **perfil_data)
                    criados += 1
                continue

            user = User.objects.create_user(
                username=username,
                email=email,
                password='Test@1234',
                tipo=tipo,
                first_name=perfil_data['nome'],
            )
            Perfil.objects.create(usuario=user, **perfil_data)
            criados += 1
            self.stdout.write(f'  OK {perfil_data["nome"]} ({email})')

        self.stdout.write(self.style.SUCCESS(
            f'\nConcluído: {criados} criados, {atualizados} atualizados.'
        ))
        if criados > 0:
            self.stdout.write('Senha de todos os seeds: Test@1234')
