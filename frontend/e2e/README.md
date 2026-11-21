# Testes de navegação (e2e) — Playwright

Abrem o sistema no Chromium e percorrem 15 roteiros (um arquivo `nXX-*.spec.ts` por roteiro): visitante, cadastro, descoberta, match e chat com duas sessões, perfil, sair da conta, permissões, painel admin, moderação, sessão (renovação do token), mobile (375×812), recuperação de senha (o roteiro lê o e-mail gravado em arquivo) e Afinidade por IA (`n15`: painel "Por que vocês combinam", selo, temas do Meu Perfil e a aba IA do painel). O projeto `desktop` roda em 1366×768; o projeto `mobile`, só o `n13`.

## Isolamento

- **Banco próprio e descartável:** container `placematch_e2e_db` (PostgreSQL 16 em memória, porta 5433). Nunca usa o banco de desenvolvimento.
- **Dados:** cada execução cria os próprios usuários pela interface (`e2e-<tipo>-<timestamp>@teste.com`). O administrador de teste é criado por `criar_admin` com o e-mail e a senha do `.env.e2e`.
- **Rede:** só `localhost` é acessível; imagens externas são bloqueadas e as fotos de teste (`https://fotos.e2e.test/...`) vêm de um PNG local.
- **Servidores:** o Playwright sobe sozinho a API Django (porta 8001, com `migrate` e `criar_admin`) e o Vite (porta 5173, apontando para a API 8001). **Pare o frontend de desenvolvimento antes**, senão o teste reaproveita um servidor apontando para outra API.

## Configuração (uma vez)

```powershell
cd frontend
npm install
npx playwright install chromium
Copy-Item e2e\.env.e2e.example e2e\.env.e2e    # edite as senhas; o arquivo NÃO é versionado
```

Pré-requisito: o backend instalado (veja o README da raiz: venv e `pip install -r requirements.txt`) e o `python` do PATH apontando para esse ambiente (ou defina `E2E_PYTHON` no `.env.e2e`).

## Executar

```powershell
npm run e2e:db                  # sobe o banco do e2e
npm run e2e                     # todos os roteiros (~16 min)
npm run e2e -- n06              # só um roteiro (também: n01 ... n15)
npm run e2e:db:parar            # apaga o banco do e2e (próxima execução parte do zero)
```

Prints da Release Candidate (fora do `npm run e2e`): `npm run e2e:tour` roda `manage.py seed_demo --remover-outros` no banco descartável do e2e, grava `evidencias-rc/` (`RC-01` a `RC-42` + `INDICE.md`) e gera `frontend/evidencias-rc.zip` com essa pasta e com `docs/execucoes-rc/`.

Para prints limpos da Descoberta, recrie o banco (`e2e:db:parar` e `e2e:db`) antes de rodar N02, N03, N04 e N05.

## E-mails (recuperação de senha)

O e2e usa o backend de e-mail **de arquivo** do Django: nada é enviado, e cada mensagem é gravada em `placematch-e2e-emails/` dentro da pasta temporária do sistema. O `n14` lê o link de lá (`esperarLinkDeSenha` em `apoio.ts`). O limite de pedidos de link e o de login ficam desligados no e2e (`playwright.config.ts`), porque todos os roteiros saem do mesmo IP.

A API do e2e usa o **modelo de IA real** (`backend/.modelos/`, baixado com `python manage.py baixar_modelo_ia`): o `n15` e o tour dependem dele. O servidor aquece o modelo ao subir (`IA_AQUECIMENTO`).

## Resultados

| Pasta | Conteúdo | Versionada |
|---|---|---|
| `evidencias/` | Prints numerados (`N02-03-etapa2.png`) e `INDICE.md` | sim |
| `resultados/` | Saída do Playwright (capturas de falha, `resultado.json`) | não |
| `.env.e2e` | Senhas e portas do e2e | não |

Cada execução reescreve os prints de `evidencias/`; descarte as mudanças (`git checkout -- e2e/evidencias`) se não quiser atualizá-las.

## Observações

- O cadastro e o login levam alguns segundos (hash de senha), por isso as esperas desses passos são longas (60 s).
- Cada teste tem limite de 3 minutos. O N10 escreve no log o passo em andamento (`N10 PASSO > ...`).
- O mesmo banco é compartilhado entre os roteiros de uma execução; os usuários criados por um não atrapalham os outros, mas a Descoberta acumula cards.
