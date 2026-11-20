"""Temas de convivência usados na explicação da Afinidade por IA ("temas em comum").

Classificação zero-shot: cada tema é descrito por 2 ou 3 frases em português. O serviço (ia/servico.py)
calcula o embedding de cada frase uma única vez por processo; um texto "tem" o tema quando o cosseno com
ALGUMA frase do tema passa de LIMIAR_TEMA (matches/algoritmo/config.py). Nada é treinado: incluir ou mudar
um tema é só editar esta lista (o comando gerar_embeddings --forcar reclassifica os perfis).
"""

TEMAS: list[dict] = [
    {'id': 'culinaria', 'nome': 'Culinária', 'frases': [
        'Adoro cozinhar e testar receitas novas em casa.',
        'Gosto de preparar jantares e comidas caseiras para os amigos.',
        'Passo horas na cozinha fazendo pães, bolos e marmitas.',
    ]},
    {'id': 'estudos', 'nome': 'Estudos', 'frases': [
        'Passo muitas horas estudando para provas e concursos.',
        'Minha rotina é de faculdade, livros e revisão da matéria.',
        'Preciso de um ambiente para me concentrar nos estudos.',
    ]},
    {'id': 'trabalho_remoto', 'nome': 'Trabalho remoto', 'frases': [
        'Trabalho de casa, em home office, o dia inteiro no computador.',
        'Meu escritório é em casa e faço reuniões por videochamada.',
        'Sou freelancer e trabalho remotamente pela internet.',
    ]},
    {'id': 'musica', 'nome': 'Música', 'frases': [
        'Toco violão e guitarra e ensaio com a minha banda.',
        'Escuto música o tempo todo e adoro ir a shows.',
        'Sou músico e dou aulas de instrumento.',
    ]},
    {'id': 'festas', 'nome': 'Festas e vida social', 'frases': [
        'Adoro festas e baladas.',
        'Faço festa em casa com música alta e muita gente.',
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
        'Sou gamer e passo as noites jogando no computador ou no console.',
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
        'Adoro maratonar séries e assistir filmes no sofá.',
        'Sou fã de cinema e sempre vejo os lançamentos.',
    ]},
    {'id': 'sustentabilidade', 'nome': 'Sustentabilidade', 'frases': [
        'Separo o lixo para reciclagem e evito desperdício.',
        'Cultivo uma horta, faço compostagem e tenho hábitos sustentáveis.',
        'Sou vegetariano e me preocupo com o meio ambiente.',
    ]},
    {'id': 'organizacao', 'nome': 'Organização e limpeza', 'frases': [
        'Sou muito organizado e mantenho a casa sempre limpa.',
        'Gosto de tudo arrumado, cada coisa no seu lugar.',
        'Faço faxina com frequência e divido as tarefas da casa.',
    ]},
]

TEMAS_POR_ID: dict[str, dict] = {t['id']: t for t in TEMAS}


def nomes(ids) -> list[dict]:
    """[{'id', 'nome'}] na ordem da lista TEMAS (ids desconhecidos são ignorados)."""
    conjunto = set(ids or [])
    return [{'id': t['id'], 'nome': t['nome']} for t in TEMAS if t['id'] in conjunto]
