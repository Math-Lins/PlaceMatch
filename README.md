# PlaceMatch

Plataforma que conecta pessoas compatíveis para dividir moradia, usando um algoritmo de compatibilidade baseado em hábitos, orçamento, localização e preferências de convivência — reduzindo o "achismo" na hora de encontrar um colega de apartamento.

Projeto desenvolvido para as disciplinas de **Fábrica de Software** e **Tópicos Avançados** — UNINASSAU, 2026.2.

## Sobre o projeto

Encontrar um colega de apartamento compatível hoje é um processo manual e pouco confiável, feito por grupos de WhatsApp, redes sociais ou indicação, sem nenhum critério estruturado de compatibilidade. O PlaceMatch propõe resolver isso calculando um **score de compatibilidade** entre usuários a partir de hábitos, rotina, orçamento e localização, aproximando pessoas antes mesmo do primeiro contato.

## Funcionalidades principais

- Cadastro e autenticação com diferentes perfis (buscando vaga, oferecendo vaga, administrador)
- Criação de perfil detalhado (hábitos, rotina, orçamento, preferências)
- **Algoritmo de compatibilidade** — núcleo de IA/processamento do projeto
- Descoberta de perfis no estilo "curtir/recusar", com match mútuo
- Chat entre usuários com match
- Filtros por região, orçamento e preferências
- Painel administrativo de moderação (denúncias e bloqueios)

## Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Linguagem principal | Python |
| Backend | *(definir: FastAPI / Django)* |
| Frontend | *(definir: React / Flutter)* |
| Banco de dados | *(definir: PostgreSQL / MongoDB)* |
| IA / Processamento | scikit-learn / NumPy *(sujeito a evolução)* |
| Versionamento | Git + GitHub |

## Estrutura do projeto

```
PlaceMatch/
├── backend/          # API, regras de negócio, autenticação
│   └── app/
├── frontend/         # Interface do usuário
│   └── src/
├── ia/               # Algoritmo de compatibilidade (núcleo de IA/processamento)
│   └── matching/
├── database/         # Scripts de banco, migrations, modelo de dados
├── docs/             # Documentação técnica, casos de uso, diagramas
│   └── documento-abertura-projeto.docx
├── tests/            # Testes automatizados
└── README.md
```

## Equipe

| Nome | Matrícula |
|---|---|
| Matheus de Oliveira Lins Mendes Simes | 01618966 |
| Laryssa Rayanne Souza Martins | 01612424 |
| Rafael Ferreira dos Anjos | 01579531 |
| Pedro Arthur Rodrigues | 01522993 |
| Elizeu Leôncio Ferreira Junior | 01576238 |

**Turma:** 8 NA — Ciência da Computação

## Status do projeto

🚧 Em desenvolvimento — Sprint 1 (formação da equipe, escolha do tema e levantamento de requisitos).

## Documentação

O documento completo de abertura do projeto (problema, objetivos, requisitos, backlog e cronograma) está disponível em [`/docs`](./docs).
