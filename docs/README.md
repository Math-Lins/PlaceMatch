# Documentação do PlaceMatch — índice

Índice de toda a documentação do projeto (versão **v1.0.0-rc2**). Instalação e execução estão no [README da raiz](../README.md).

## Manuais

| Arquivo | Descrição |
|---|---|
| [`manual-usuario.md`](./manual-usuario.md) | Manual do usuário: como usar o sistema como quem procura vaga, quem oferece vaga e administrador. *(adicionado pela equipe)* |
| [`manual-tecnico.md`](./manual-tecnico.md) | Manual técnico: arquitetura, instalação, configuração e manutenção. *(adicionado pela equipe)* |

## API

| Arquivo | Descrição |
|---|---|
| [`api.md`](./api.md) | Referência de todos os endpoints (31 operações em 26 rotas), com exemplos **reais** de requisição e resposta. Gerado por `backend/scripts/gerar_docs_api.py markdown`; não edite à mão. |
| [`openapi.yaml`](./openapi.yaml) | Schema OpenAPI 3 da API, gerado pelo `drf-spectacular` (`manage.py spectacular --validate --fail-on-warn`). Interativo em `/api/docs/` (Swagger UI). |

## Banco de dados

| Arquivo | Descrição |
|---|---|
| [`banco-de-dados.md`](./banco-de-dados.md) | Dicionário de dados final: tabelas, colunas, chaves, índices e restrições de integridade (PostgreSQL 16). |
| [`esquema.sql`](./esquema.sql) | Esquema do banco extraído com `pg_dump --schema-only` (só estrutura, sem dados). |

## Módulos e algoritmo

| Arquivo | Descrição |
|---|---|
| [`algoritmo-compatibilidade.md`](./algoritmo-compatibilidade.md) | Algoritmo de compatibilidade: os 6 critérios, pesos, fórmulas, versão vetorial (NumPy) e resultados do benchmark. |
| [`benchmark/`](./benchmark/) | Dados brutos do benchmark do algoritmo: `benchmark_compatibilidade.csv` (tempos laço × NumPy), `sensibilidade_pesos.csv` (efeito de mudar cada peso), `ambiente.txt` (máquina e versões) e `saida_terminal.txt` (saída do comando `benchmark_compatibilidade`). |
| [`modulo-chat.md`](./modulo-chat.md) | Módulo de chat: modelo de dados, regras de acesso, endpoints e atualização automática. |

## Operação

| Arquivo | Descrição |
|---|---|
| [`runbook-docker.md`](./runbook-docker.md) | Runbook do Docker: subir, parar e diagnosticar backend, banco e frontend (inclui o erro `password authentication failed`). |

## Testes, auditorias e revisão

| Arquivo | Descrição |
|---|---|
| [`testes-sprint9.md`](./testes-sprint9.md) | Campanha de testes (funcionais, validação e navegação e2e), bugs encontrados e corrigidos e evolução do total de testes até a rc2. |
| [`auditoria-rc.md`](./auditoria-rc.md) | Auditorias da Release Candidate (duas rodadas): defeitos encontrados (AUD-01…), correções, itens mantidos com justificativa e totais. |
| [`revisao-codigo.md`](./revisao-codigo.md) | Revisão final do código (Sprint 11): ferramentas, checklist por módulo, correções, itens mantidos, métricas e organização do repositório. |
| [`execucoes-rc/`](./execucoes-rc/) | Saídas das verificações finais da rc2: `testes-backend.txt` (suíte completa), `verificar-banco.txt` (consistência do banco), `matriz-permissoes.txt` (rota × perfil de acesso), `openapi-validate.txt` (validação do schema), `build-frontend.txt` (`tsc` + build) e `e2e-navegacao.txt` (roteiros Playwright). |

## Fora de `docs/`

| Local | Descrição |
|---|---|
| [`../frontend/e2e/README.md`](../frontend/e2e/README.md) | Como rodar os testes de navegação (Playwright) com banco descartável. |
| [`../frontend/e2e/evidencias/`](../frontend/e2e/evidencias/) | Prints dos roteiros de navegação (N01 a N14), com `INDICE.md`. |
| [`../frontend/e2e/evidencias-rc/`](../frontend/e2e/evidencias-rc/) | Prints da interface final da Release Candidate (RC-01 a RC-42), com `INDICE.md`. |
