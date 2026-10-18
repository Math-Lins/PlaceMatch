"""
python manage.py seed_mensagens

Insere mensagens de exemplo entre matches já existentes no banco.
Idempotente: se o match já tiver mensagens, pula.

Flags:
  --limpar   remove APENAS as mensagens de seed antes de recriar
"""

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.contrib.auth import get_user_model

from perfis.models import Perfil
from matches.models import Match
from chat.models import Mensagem

User = get_user_model()
SEED_TAG = '__seed__'

# (email_a, email_b, [(remetente, conteudo), ...])
SEED_CONVERSAS = [
    ('ana@seed.pm', 'joao@seed.pm', [
        ('ana@seed.pm',  'Oi João! Vi que você tem um quarto em Pinheiros. Ainda está disponível?'),
        ('joao@seed.pm', 'Olá Ana! Sim, ainda está. Você é madrugadora também, né? Ótimo perfil!'),
        ('ana@seed.pm',  'Que bom! Podemos marcar uma visita essa semana?'),
        ('joao@seed.pm', 'Com certeza! Que tal quinta de manhã?'),
    ]),
    ('mariana@seed.pm', 'beatriz@seed.pm', [
        ('beatriz@seed.pm', 'Oi Mariana! Vi o seu perfil e acho que combinamos muito bem.'),
        ('mariana@seed.pm', 'Oi Beatriz! Também achei. Você aceita pets e eu tenho um gato.'),
        ('beatriz@seed.pm', 'Adoro! O quarto tem bastante sol. Te mando as fotos.'),
    ]),
    ('pedro@seed.pm', 'renato@seed.pm', [
        ('pedro@seed.pm',  'E aí Renato, tu trabalha remoto também?'),
        ('renato@seed.pm', 'Sim! Internet 1Gb aqui, pode chegar. Rs'),
        ('pedro@seed.pm',  'Ótimo! Sou dev também, vou precisar de boa conexão.'),
    ]),
    ('rafael@seed.pm', 'clara@seed.pm', [
        ('clara@seed.pm', 'Olá Rafael! Vi que você preza muito pela organização. Eu também!'),
        ('rafael@seed.pm', 'Oi Clara! É fundamental pra mim. O studio parece perfeito.'),
    ]),
    ('liz@seed.pm', 'thiago@seed.pm', [
        ('liz@seed.pm',   'Thiago! Aquela casa com quintal me chamou muito atenção.'),
        ('thiago@seed.pm', 'Oi Liz! É um ambiente super criativo. Rola bastante música aqui.'),
        ('liz@seed.pm',   'Perfeito para mim. Posso aparecer no fim de semana?'),
        ('thiago@seed.pm', 'Claro! Vou ter uma rodinha de música sábado à noite, pode vir antes!'),
    ]),
]


def _get_perfil(email):
    try:
        return User.objects.get(email=email).perfil
    except (User.DoesNotExist, Perfil.DoesNotExist):
        return None


class Command(BaseCommand):
    help = 'Insere mensagens de exemplo nos matches seed (idempotente).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limpar',
            action='store_true',
            help='Remove mensagens seed antes de recriar.',
        )

    def handle(self, *args, **options):
        seed_perfis = Perfil.objects.filter(usuario__username__endswith=SEED_TAG)

        if options['limpar']:
            from django.db.models import Q as DjQ
            matches_seed = Match.objects.filter(
                DjQ(perfil_a__in=seed_perfis) | DjQ(perfil_b__in=seed_perfis)
            )
            removed = Mensagem.objects.filter(match__in=matches_seed).delete()
            self.stdout.write(self.style.WARNING(f'Removidas: {removed[0]} mensagens.'))

        criados = 0
        pulados = 0

        for email_a, email_b, msgs in SEED_CONVERSAS:
            pa = _get_perfil(email_a)
            pb = _get_perfil(email_b)

            if pa is None or pb is None:
                self.stdout.write(self.style.WARNING(
                    f'  ! Perfil não encontrado: {email_a} ou {email_b}'
                ))
                pulados += 1
                continue

            pa_id = min(pa.id, pb.id)
            pb_id = max(pa.id, pb.id)

            try:
                match = Match.objects.get(perfil_a_id=pa_id, perfil_b_id=pb_id)
            except Match.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'  ! Match não encontrado entre {email_a} e {email_b} — execute seed_matches primeiro'
                ))
                pulados += 1
                continue

            # Idempotente: pula se já tem mensagens
            if match.mensagens.exists():
                pulados += 1
                continue

            remetente_map = {email_a: pa, email_b: pb}
            for remetente_email, conteudo in msgs:
                remetente = remetente_map.get(remetente_email)
                if remetente:
                    Mensagem.objects.create(match=match, remetente=remetente, conteudo=conteudo)

            criados += len(msgs)
            self.stdout.write(f'  ✓ {len(msgs)} msgs: {pa.nome} ↔ {pb.nome}')

        self.stdout.write(self.style.SUCCESS(
            f'\nConcluído: {criados} mensagens criadas, {pulados} pares pulados.'
        ))
