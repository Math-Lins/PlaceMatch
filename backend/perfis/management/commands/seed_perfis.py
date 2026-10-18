"""
python manage.py seed_perfis

Cria usuários + perfis de seed para testar o algoritmo de compatibilidade.
Perfis intencionalmente variados para cobrir todos os extremos do algoritmo.

Senha padrão de todos: Test@1234

Flags:
  --limpar   remove APENAS os usuários criados por este comando antes de recriar
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from perfis.models import Perfil

User = get_user_model()

SEED_TAG = '__seed__'   # marcado no username para identificar seeds

SEED_USERS = [
    # (email, username, tipo, perfil_dict)
    ('ana@seed.pm', f'ana{SEED_TAG}', 'buscando_vaga', dict(
        nome='Ana Luísa', idade=23, regiao='Vila Madalena',
        bio='Estudante de arquitetura. Organizada, madrugadora e não fumante. Tenho uma gata.',
        orcamento_min=800, orcamento_max=1400,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
    )),
    ('pedro@seed.pm', f'pedro{SEED_TAG}', 'buscando_vaga', dict(
        nome='Pedro Henrique', idade=26, regiao='Pinheiros',
        bio='Dev remoto. Noturno, gosto de música alta e festas no fim de semana.',
        orcamento_min=600, orcamento_max=1200,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=5, nivel_organizacao=1,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='republica', qtd_moradores=4,
    )),
    ('camila@seed.pm', f'camila{SEED_TAG}', 'buscando_vaga', dict(
        nome='Camila Souza', idade=24, regiao='Consolação',
        bio='Mestranda em comunicação. Flexível, sociável e aceita pets.',
        orcamento_min=900, orcamento_max=1600,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=3, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=3,
    )),
    ('rafael@seed.pm', f'rafael{SEED_TAG}', 'buscando_vaga', dict(
        nome='Rafael Costa', idade=25, regiao='Vila Madalena',
        bio='Engenheiro civil. Muito organizado, madrugador e prefiro silêncio.',
        orcamento_min=850, orcamento_max=1500,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=2, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=2,
    )),
    ('liz@seed.pm', f'liz{SEED_TAG}', 'buscando_vaga', dict(
        nome='Elizabete Ramos', idade=21, regiao='Consolação',
        bio='Artista plástica. Noturna, festeira, adoro receber amigos e fumo socialmente.',
        orcamento_min=400, orcamento_max=800,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=5, nivel_organizacao=1,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='republica', qtd_moradores=4,
    )),
    ('joao@seed.pm', f'joao{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='João Vitor', idade=28, regiao='Pinheiros',
        bio='Professor universitário. Gosto de rotina, silêncio e ambientes organizados.',
        orcamento_min=1000, orcamento_max=1800,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=2,
        titulo_anuncio='Quarto mobiliado em apartamento silencioso em Pinheiros',
        descricao_imovel=(
            'Apartamento de 2 quartos próximo ao metrô Fradique Coutinho, condomínio fechado '
            'com portaria 24h. Quarto com armário embutido, ar-condicionado e boa iluminação. '
            'Ideal para quem busca tranquilidade e rotina.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=12',
    )),
    ('mariana@seed.pm', f'mariana{SEED_TAG}', 'buscando_vaga', dict(
        nome='Mariana Oliveira', idade=22, regiao='Vila Madalena',
        bio='Estudante de medicina. Madrugadora por necessidade, organizada e focada.',
        orcamento_min=750, orcamento_max=1300,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
    )),
    ('lucas@seed.pm', f'lucas{SEED_TAG}', 'buscando_vaga', dict(
        nome='Lucas Mendes', idade=24, regiao='Moema',
        bio='Designer freelancer. Flexível, criativo, curto receber amigos e tenho um cachorro.',
        orcamento_min=900, orcamento_max=1700,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=4, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=3, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=3,
    )),
    ('fernanda@seed.pm', f'fernanda{SEED_TAG}', 'buscando_vaga', dict(
        nome='Fernanda Lima', idade=27, regiao='Pinheiros',
        bio='Advogada. Reservada, prefiro ambientes tranquilos e sem pets.',
        orcamento_min=1200, orcamento_max=2200,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=1,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
    )),
    ('thiago@seed.pm', f'thiago{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Thiago Santos', idade=29, regiao='Consolação',
        bio='Músico. Noturno, criativo, casa sempre cheia de amigos. Fumo.',
        orcamento_min=500, orcamento_max=1000,
        fumante=True, aceita_pets=True,
        tolerancia_bagunca=5, nivel_organizacao=2,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=4,
        titulo_anuncio='Vaga em casa compartilhada no coração da Consolação',
        descricao_imovel=(
            'Casa espaçosa com 4 quartos, quintal e espaço de convivência amplo. '
            'Ambiente descontraído, ideal para quem gosta de música, arte e festas ocasionais. '
            'Aceita pets e fumantes.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=33',
    )),
    ('isabela@seed.pm', f'isabela{SEED_TAG}', 'buscando_vaga', dict(
        nome='Isabela Nunes', idade=23, regiao='Moema',
        bio='Nutricionista. Cozinha muito, gosta de rotina e ambientes limpos.',
        orcamento_min=850, orcamento_max=1500,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
    )),
    ('guilherme@seed.pm', f'guilherme{SEED_TAG}', 'buscando_vaga', dict(
        nome='Guilherme Alves', idade=25, regiao='Vila Madalena',
        bio='Estudante de direito. Noturno, social, adora festas e república.',
        orcamento_min=600, orcamento_max=1100,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=4, nivel_organizacao=2,
        perfil_horario='noturno', nivel_ruido=4, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='republica', qtd_moradores=4,
    )),
    ('patricia@seed.pm', f'patricia{SEED_TAG}', 'buscando_vaga', dict(
        nome='Patrícia Gomes', idade=31, regiao='Moema',
        bio='Analista financeira. Muito organizada, prefere silêncio e rotina.',
        orcamento_min=1100, orcamento_max=2000,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=2,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
    )),
    ('diego@seed.pm', f'diego{SEED_TAG}', 'buscando_vaga', dict(
        nome='Diego Ferreira', idade=22, regiao='Pinheiros',
        bio='Estudante de publicidade. Flexível, tranquilo, gosto de séries em casa.',
        orcamento_min=700, orcamento_max=1300,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
    )),
    ('vitoria@seed.pm', f'vitoria{SEED_TAG}', 'buscando_vaga', dict(
        nome='Vitória Cardoso', idade=20, regiao='Consolação',
        bio='Caloura de psicologia. Sociável, flexível, aceita qualquer tipo de imóvel.',
        orcamento_min=500, orcamento_max=900,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=4, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=4, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='indiferente', qtd_moradores=3,
    )),
    # ── Mais oferecendo_vaga para diversificar a descoberta ──────────────────
    ('beatriz@seed.pm', f'beatriz{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Beatriz Almeida', idade=24, regiao='Vila Madalena',
        bio='Estudante de design. Organizada, madrugadora e adoro ter pets em casa.',
        orcamento_min=800, orcamento_max=1400,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=2, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='apartamento', qtd_moradores=2,
        titulo_anuncio='Quarto em apartamento charmoso na Vila Madalena',
        descricao_imovel=(
            'Apartamento de 2 quartos bem localizado, a 5 minutos da Rua Aspicuelta. '
            'Quarto aconchegante com janela e boa ventilação, cozinha equipada e área de serviço. '
            'Pets bem-vindos.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=47',
    )),
    ('renato@seed.pm', f'renato{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Renato Barbosa', idade=27, regiao='Consolação',
        bio='Engenheiro de software. Noturno, social, trabalho remoto e fumo eventualmente.',
        orcamento_min=900, orcamento_max=1600,
        fumante=True, aceita_pets=False,
        tolerancia_bagunca=4, nivel_organizacao=3,
        perfil_horario='noturno', nivel_ruido=4, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='apartamento', qtd_moradores=3,
        titulo_anuncio='Vaga em apartamento moderno perto da Paulista',
        descricao_imovel=(
            'Apartamento de 3 quartos reformado, a 10 minutos da Av. Paulista. '
            'Internet 1 Gb, home office estruturado e cozinha gourmet. '
            'Ambiente descontraído para quem curte trabalhar de casa.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=59',
    )),
    ('clara@seed.pm', f'clara{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Clara Freitas', idade=25, regiao='Pinheiros',
        bio='Terapeuta. Reservada, prefiro silêncio, rotina e ambientes limpos.',
        orcamento_min=1000, orcamento_max=1800,
        fumante=False, aceita_pets=False,
        tolerancia_bagunca=1, nivel_organizacao=5,
        perfil_horario='madrugador', nivel_ruido=1, nivel_social=1,
        aceita_visitas='raramente', tipo_imovel='apartamento', qtd_moradores=1,
        titulo_anuncio='Studio privativo em Pinheiros, ideal para profissional solo',
        descricao_imovel=(
            'Studio de 35 m² totalmente mobiliado, com cozinha compacta, banheiro privativo e '
            'lavanderia compartilhada. Condomínio tranquilo, sem festas. '
            'Localização privilegiada próxima ao metrô.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=25',
    )),
    ('henrique@seed.pm', f'henrique{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Henrique Moura', idade=23, regiao='Moema',
        bio='Estudante de gastronomia. Flexível, curto cozinhar e receber amigos no fim de semana.',
        orcamento_min=700, orcamento_max=1200,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=3,
        perfil_horario='flexivel', nivel_ruido=3, nivel_social=4,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=3,
        titulo_anuncio='Quarto em casa com cozinha gourmet em Moema',
        descricao_imovel=(
            'Casa de 3 quartos com cozinha equipada, área gourmet e jardim. '
            'Bairro residencial e seguro, perto do Parque Ibirapuera. '
            'Pets aceitos e convivia gastronômica é o diferencial.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=8',
    )),
    ('julia@seed.pm', f'julia{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Júlia Prado', idade=22, regiao='Vila Madalena',
        bio='Artista e professora de yoga. Tranquila, vegetariana e adoro animais.',
        orcamento_min=600, orcamento_max=1100,
        fumante=False, aceita_pets=True,
        tolerancia_bagunca=3, nivel_organizacao=4,
        perfil_horario='madrugador', nivel_ruido=2, nivel_social=3,
        aceita_visitas='as_vezes', tipo_imovel='casa', qtd_moradores=2,
        titulo_anuncio='Quarto aconchegante em casa com espaço de yoga e jardim',
        descricao_imovel=(
            'Casa compartilhada de 2 quartos com jardim, espaço dedicado à meditação e yoga. '
            'Ambiente calmo e espiritual, alimentação vegetariana incentivada. '
            'Animais adorados e bem-vindos.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=44',
    )),
    ('marcos@seed.pm', f'marcos{SEED_TAG}', 'oferecendo_vaga', dict(
        nome='Marcos Vinícius', idade=29, regiao='Pinheiros',
        bio='Empresário. Noturno, festeiro, casa grande com espaço para todos. Fumo.',
        orcamento_min=800, orcamento_max=1500,
        fumante=True, aceita_pets=True,
        tolerancia_bagunca=5, nivel_organizacao=2,
        perfil_horario='noturno', nivel_ruido=5, nivel_social=5,
        aceita_visitas='frequentemente', tipo_imovel='casa', qtd_moradores=4,
        titulo_anuncio='Vaga em mansão compartilhada em Pinheiros — vida social intensa',
        descricao_imovel=(
            'Casa de 4 quartos com piscina, churrasqueira e espaço de festa. '
            'Ambiente animado com eventos regulares. '
            'Fumo e pets totalmente aceitos — venha fazer parte.'
        ),
        fotos_imovel=[
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
        ],
        foto_perfil_url='https://i.pravatar.cc/150?img=68',
    )),
]


class Command(BaseCommand):
    help = 'Cria usuários e perfis de seed para testes do algoritmo de compatibilidade.'

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
        pulados = 0

        ANUNCIO_FIELDS = ('titulo_anuncio', 'descricao_imovel', 'fotos_imovel', 'foto_perfil_url')

        for email, username, tipo, perfil_data in SEED_USERS:
            if User.objects.filter(email=email).exists():
                # Atualiza campos de anúncio para seeds existentes (idempotente)
                try:
                    perfil = Perfil.objects.get(usuario__email=email)
                    update_fields = {k: perfil_data[k] for k in ANUNCIO_FIELDS if k in perfil_data}
                    if update_fields:
                        for field, value in update_fields.items():
                            setattr(perfil, field, value)
                        perfil.save(update_fields=list(update_fields.keys()))
                except Perfil.DoesNotExist:
                    pass
                pulados += 1
                continue

            user = User.objects.create_user(
                username=username,
                email=email,
                password='Test@1234',
                tipo=tipo,
            )
            Perfil.objects.create(usuario=user, **perfil_data)
            criados += 1
            self.stdout.write(f'  ✓ {perfil_data["nome"]} ({email})')

        self.stdout.write(self.style.SUCCESS(
            f'\nConcluído: {criados} criados, {pulados} já existiam.'
        ))
        if criados > 0:
            self.stdout.write('Senha de todos os seeds: Test@1234')
