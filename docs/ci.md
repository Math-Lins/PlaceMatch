# Integração contínua

O workflow `.github/workflows/ci.yml` roda em pull requests, pushes em `main`
e manualmente pela aba Actions. Não exige segredos do ambiente de desenvolvimento.

- **Backend:** Python 3.13, Ruff, check Django, detecção de migrações pendentes e
  suíte completa em SQLite em memória (`placematch.test_settings`).
- **Frontend:** Node 22, `npm ci`, `npm test`, TypeScript e build.
- **E2E (N01–N14):** Chromium, PostgreSQL 16 descartável e servidores iniciados pelo
  Playwright. Em CI, servidores existentes nunca são reutilizados. As credenciais
  do workflow são exclusivas do banco descartável, não são contas reais.

O embedder falso torna os testes independentes do download do modelo de IA.
Isso não substitui a validação separada com o modelo real: o roteiro N15,
que exige similaridade semântica, não é executado neste job. Ele permanece
disponível localmente com o modelo baixado, sem alterações nas suas assertions.
Relatórios/screenshots de falhas E2E ficam disponíveis como artefato por 7 dias.
As evidências de sucesso geradas nos roteiros não são commitadas pela CI.
Localmente, `E2E_EVIDENCIAS_DIR` permite gravar screenshots fora das evidências
versionadas.

Para reproduzir as verificações estáticas, veja os comandos dos jobs no workflow.
Para executar E2E localmente, siga `frontend/e2e/README.md` e use um banco
descartável e portas livres, nunca o banco de desenvolvimento.

## Escopo

Esta alteração contempla apenas CI. CD/deploy está fora do escopo.
O workflow não publica a aplicação, não executa migrações em produção e não
altera proteção de branches. Os Dockerfiles atuais usam servidores de desenvolvimento.
