"""Temas de convivência usados na explicação da Afinidade por IA ("temas em comum").

Classificação zero-shot: cada tema é descrito por 2 ou 3 frases em português. O serviço (ia/servico.py)
calcula o embedding de cada frase uma única vez por processo; um texto "tem" o tema quando o cosseno com
ALGUMA frase do tema passa de LIMIAR_TEMA (matches/algoritmo/config.py). Nada é treinado: incluir ou mudar
um tema é só editar esta lista (o comando gerar_embeddings --forcar reclassifica os perfis).

Como escrever as frases: centradas no ASSUNTO do tema. Evite expressões genéricas que aparecem em bios de
qualquer tema ("em casa", "passo as noites", "Faço…", "amigos"): o modelo também compara a forma da frase, e
"Faço jantares em casa" chegava a "Trabalho de casa…" (Trabalho remoto) e a "mantenho a casa limpa"
(Organização). O teste ia/tests/test_temas_modelo_real.py fixa os temas esperados com o modelo real.
"""

TEMAS: list[dict] = [
    {'id': 'culinaria', 'nome': 'Culinária', 'frases': [
        'Adoro cozinhar e testar receitas novas em casa.',
        'Cozinha, receitas, comida caseira, pães, bolos e marmitas.',
        'Gastronomia: preparar jantares e pratos para os amigos.',
    ]},
    {'id': 'estudos', 'nome': 'Estudos', 'frases': [
        'Passo muitas horas estudando para provas e concursos.',
        'Minha rotina é de faculdade, livros e revisão da matéria.',
        'Preciso de um ambiente para me concentrar nos estudos.',
    ]},
    {'id': 'trabalho_remoto', 'nome': 'Trabalho remoto', 'frases': [
        'Trabalho remoto em home office, com reuniões online por videochamada.',
        'Meu escritório é o home office: trabalho remoto pela internet.',
        'Sou freelancer e trabalho remotamente pela internet.',
    ]},
    {'id': 'musica', 'nome': 'Música', 'frases': [
        'Toco violão e guitarra e ensaio com a minha banda.',
        'Escuto música o tempo todo e adoro ir a shows.',
        'Sou músico e dou aulas de instrumento.',
    ]},
    {'id': 'festas', 'nome': 'Festas e vida social', 'frases': [
        'Adoro festas e baladas.',
        'Festa com música alta e muita gente.',
        'Saio para dançar e curtir a noite com a turma.',
    ]},
    {'id': 'silencio', 'nome': 'Silêncio e tranquilidade', 'frases': [
        'Preciso de silêncio e de uma casa tranquila e calma.',
        'Valorizo paz em casa, sem barulho, e durmo cedo.',
        'Prefiro um ambiente sossegado e poucas visitas.',
    ]},
    {'id': 'esportes', 'nome': 'Esportes e academia', 'frases': [
        'Treino na academia e faço musculação quase todo dia.',
        'Corro de manhã e pratico esportes.',
        'Jogo futebol, ando de bicicleta e gosto de me exercitar.',
    ]},
    {'id': 'games', 'nome': 'Games', 'frases': [
        'Jogo videogame e jogos online com os amigos.',
        'Sou gamer e adoro jogar no console.',
        'Jogar videogame é meu passatempo favorito.',
    ]},
    {'id': 'leitura', 'nome': 'Leitura', 'frases': [
        'Adoro ler livros e romances nas horas vagas.',
        'Sempre tenho um livro na mão e gosto de literatura.',
    ]},
    {'id': 'pets', 'nome': 'Pets', 'frases': [
        'Tenho um cachorro e amo animais de estimação.',
        'Moro com meu gato e adoro bichos.',
        'Sou apaixonado por animais e cuido de pets resgatados.',
    ]},
    {'id': 'natureza', 'nome': 'Natureza e trilhas', 'frases': [
        'Nos fins de semana faço trilhas, acampo e visito cachoeiras.',
        'Adoro natureza, praia, mar e caminhadas ao ar livre.',
    ]},
    {'id': 'arte', 'nome': 'Arte', 'frases': [
        'Sou artista, pinto quadros e faço desenhos.',
        'Gosto de arte, exposições, fotografia e trabalhos manuais.',
        'Trabalho com ilustração, design e criatividade.',
    ]},
    {'id': 'religiao', 'nome': 'Religião e espiritualidade', 'frases': [
        'Vou à igreja e a minha fé é importante para mim.',
        'Medito e cuido da minha espiritualidade todos os dias.',
    ]},
    {'id': 'cinema_series', 'nome': 'Cinema e séries', 'frases': [
        'Maratonar séries e assistir filmes no sofá é meu programa favorito.',
        'Sou fã de cinema, filmes e séries.',
    ]},
    {'id': 'sustentabilidade', 'nome': 'Sustentabilidade', 'frases': [
        'Reciclagem, compostagem e nada de desperdício.',
        'Cultivo uma horta e reaproveito tudo o que posso.',
        'Sou vegetariano e me preocupo com o meio ambiente e a sustentabilidade.',
    ]},
    {'id': 'organizacao', 'nome': 'Organização e limpeza', 'frases': [
        'Organização e limpeza: tudo arrumado, limpo e cada coisa no seu lugar.',
        'Sou muito organizado e mantenho tudo arrumado.',
        'Faxina frequente e tarefas domésticas divididas.',
    ]},
]

TEMAS_POR_ID: dict[str, dict] = {t['id']: t for t in TEMAS}


def nomes(ids) -> list[dict]:
    """[{'id', 'nome'}] na ordem da lista TEMAS (ids desconhecidos são ignorados)."""
    conjunto = set(ids or [])
    return [{'id': t['id'], 'nome': t['nome']} for t in TEMAS if t['id'] in conjunto]
