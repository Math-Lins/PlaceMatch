"""
python manage.py seed_matches

Cria curtidas mútuas e matches entre os perfis seed de alta compatibilidade,
para que a tela de Matches já apareça populada ao testar o fluxo completo.

Flags:
  --limpar   remove APENAS os matches/curtidas entre seeds antes de recriar
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q
from perfis.models import Perfil
from matches.models import Compatibilidade, Curtida, Match

User = get_user_model()
SEED_TAG = '__seed__'

# Pares que receberão curtidas mútuas (email_buscando, email_oferecendo)
# Escolhidos por alta compatibilidade algorítmica
PARES_CURTIDA = [
    ('ana@seed.pm',      'beatriz@seed.pm'),    # madrugadoras, Vila Madalena, organiz., pets
    ('mariana@seed.pm',  'beatriz@seed.pm'),    # madrugadoras, organiz., pets
    ('mariana@seed.pm',  'julia@seed.pm'),      # madrugadora x madrugadora, pets, calm
    ('rafael@seed.pm',   'clara@seed.pm'),      # organiz. extremos, silêncio
    ('fernanda@seed.pm', 'clara@seed.pm'),      # organiz., silêncio, Pinheiros
    ('camila@seed.pm',   'henrique@seed.pm'),   # flexível, sociável, Consolação≈Moema
    ('lucas@seed.pm',    'henrique@seed.pm'),   # flexível, pets, sociável
    ('diego@seed.pm',    'henrique@seed.pm'),   # flexível, tranquilo
    ('vitoria@seed.pm',  'marcos@seed.pm'),     # social, noturno, festeiro
    ('pedro@seed.pm',    'renato@seed.pm'),     # noturno, social
    ('guilherme@seed.pm','renato@seed.pm'),     # noturno, social, fumante
    ('liz@seed.pm',      'thiago@seed.pm'),     # noturno, festeira, fumante
    ('guilherme@seed.pm','thiago@seed.pm'),     # noturno, social
    ('ana@seed.pm',      'joao@seed.pm'),       # organiz., madrugador, apê
    ('isabela@seed.pm',  'joao@seed.pm'),       # organiz., rotina, apê
]


def _get_perfil(email):
    try:
        return User.objects.get(email=email).perfil
    except (User.DoesNotExist, Perfil.DoesNotExist):
        return None


class Command(BaseCommand):
    help = 'Cria curtidas mútuas e matches entre seeds de alta compatibilidade.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limpar',
            action='store_true',
            help='Remove curtidas e matches entre seeds antes de recriar.',
        )

    def handle(self, *args, **options):
        seed_perfis = Perfil.objects.filter(usuario__username__endswith=SEED_TAG)

        if options['limpar']:
            c_del = Curtida.objects.filter(
                perfil_origem__in=seed_perfis,
                perfil_destino__in=seed_perfis,
            ).delete()
            m_del = Match.objects.filter(
                Q(perfil_a__in=seed_perfis) | Q(perfil_b__in=seed_perfis)
            ).delete()
            self.stdout.write(self.style.WARNING(
                f'Removidos: {c_del[0]} curtidas, {m_del[0]} matches.'
            ))

        criados = 0
        pulados = 0

        for email_a, email_b in PARES_CURTIDA:
            pa = _get_perfil(email_a)
            pb = _get_perfil(email_b)

            if pa is None or pb is None:
                self.stdout.write(self.style.WARNING(
                    f'  ! Perfil não encontrado: {email_a} ou {email_b} — execute seed_perfis primeiro'
                ))
                pulados += 1
                continue

            # Curtida A → B
            _, criada_ab = Curtida.objects.get_or_create(
                perfil_origem=pa, perfil_destino=pb,
                defaults={'tipo': 'curtir'},
            )
            # Curtida B → A
            _, criada_ba = Curtida.objects.get_or_create(
                perfil_origem=pb, perfil_destino=pa,
                defaults={'tipo': 'curtir'},
            )

            # Match
            pa_id = min(pa.id, pb.id)
            pb_id = max(pa.id, pb.id)

            try:
                compat = Compatibilidade.objects.get(perfil_a_id=pa_id, perfil_b_id=pb_id)
                score = compat.score
            except Compatibilidade.DoesNotExist:
                from matches.compatibilidade import calcular_score
                score = calcular_score(pa, pb)

            match, criado_match = Match.objects.get_or_create(
                perfil_a_id=pa_id,
                perfil_b_id=pb_id,
                defaults={'score': score},
            )

            if criado_match:
                criados += 1
                nome_a = pa.nome
                nome_b = pb.nome
                self.stdout.write(f'  ✓ Match: {nome_a} ↔ {nome_b}  ({score:.0%})')
            else:
                pulados += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nConcluído: {criados} matches criados, {pulados} já existiam ou pulados.'
        ))
