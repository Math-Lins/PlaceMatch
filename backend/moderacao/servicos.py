"""
Serviços de moderação: criação de denúncias, resolução e suspensão de usuários.
"""
from django.contrib.auth import get_user_model

from logs.servicos import registrar
from .models import Denuncia


def criar_denuncia(denunciante, denunciado_id, motivo, descricao='', request=None):
    """
    Cria uma denúncia. Levanta ValueError em caso de violação de regra.
    Retorna a instância criada.
    """
    User = get_user_model()
    try:
        denunciado = User.objects.get(id=denunciado_id)
    except User.DoesNotExist:
        raise ValueError('Usuário denunciado não encontrado.')

    if denunciante.id == denunciado.id:
        raise ValueError('Você não pode denunciar a si mesmo.')

    if denunciante.tipo == 'administrador':
        raise ValueError('Administradores não podem criar denúncias.')

    validos = [m for m, _ in Denuncia.MOTIVO_CHOICES]
    if motivo not in validos:
        raise ValueError(f'Motivo inválido. Use: {", ".join(validos)}.')

    denuncia = Denuncia.objects.create(
        denunciante=denunciante,
        denunciado=denunciado,
        motivo=motivo,
        descricao=descricao,
    )

    registrar(
        'DENUNCIA_CRIADA',
        usuario=denunciante,
        entidade='denuncia',
        entidade_id=denuncia.id,
        detalhes={'denunciado_id': denunciado.id, 'motivo': motivo},
        request=request,
    )
    return denuncia


def resolver_denuncia(denuncia, admin, novo_status, resolucao='', request=None):
    """
    Resolve ou descarta uma denúncia. Levanta ValueError em caso de violação.
    """
    if novo_status not in ('resolvida', 'descartada'):
        raise ValueError('Status inválido. Use "resolvida" ou "descartada".')

    if denuncia.status != 'pendente':
        raise ValueError('Apenas denúncias pendentes podem ser resolvidas.')

    denuncia.status = novo_status
    denuncia.resolvida_por = admin
    denuncia.resolucao = resolucao
    denuncia.save()

    registrar(
        'DENUNCIA_RESOLVIDA',
        usuario=admin,
        entidade='denuncia',
        entidade_id=denuncia.id,
        detalhes={'novo_status': novo_status, 'denunciado_id': denuncia.denunciado_id},
        request=request,
    )
    return denuncia


def suspender_usuario(usuario, admin, motivo='', request=None):
    """
    Desativa a conta do usuário (is_active=False). Levanta ValueError se já suspenso.
    """
    if not usuario.is_active:
        raise ValueError('Este usuário já está suspenso.')

    if usuario.tipo == 'administrador':
        raise ValueError('Não é possível suspender um administrador.')

    usuario.is_active = False
    usuario.save(update_fields=['is_active'])

    registrar(
        'USUARIO_SUSPENSO',
        usuario=admin,
        entidade='usuario',
        entidade_id=usuario.id,
        detalhes={'motivo': motivo, 'email': usuario.email},
        request=request,
    )
    return usuario


def reativar_usuario(usuario, admin, request=None):
    """
    Reativa a conta do usuário (is_active=True). Levanta ValueError se já ativo.
    """
    if usuario.is_active:
        raise ValueError('Este usuário já está ativo.')

    usuario.is_active = True
    usuario.save(update_fields=['is_active'])

    registrar(
        'USUARIO_REATIVADO',
        usuario=admin,
        entidade='usuario',
        entidade_id=usuario.id,
        detalhes={'email': usuario.email},
        request=request,
    )
    return usuario
