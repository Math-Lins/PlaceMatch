import {
  API, abrirSessao, cadastrar, emailsPara, esperarLinkDeSenha, expect, irParaInicio, novoPerfil, print, test, tokens,
} from './apoio';

const MENSAGEM_NEUTRA = 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.';
const NOVA_SENHA = 'NovaSenha@2026x';

test('N14 Recuperar senha: pedir link → e-mail → senha fraca → redefinir → entrar → link usado fica inválido', async ({ browser }) => {
  const u = novoPerfil('n14', 'busca');
  const inexistente = `ninguem-${Date.now()}@teste.com`;

  // Sessão A: a conta já aberta em outro lugar (deve ser encerrada pela redefinição).
  const a = await abrirSessao(browser);
  // Sessão B: quem esqueceu a senha (outro navegador, sem login).
  const b = await abrirSessao(browser);
  try {
    await cadastrar(a.page, u);
    const refreshAntigo = (await tokens(a.page)).refresh!;
    expect(refreshAntigo).toBeTruthy();

    await test.step('1. o login tem o link "Esqueci minha senha", que abre a tela de pedido', async () => {
      await irParaInicio(b.page);
      await b.page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(b.page.getByRole('button', { name: 'Esqueci minha senha' })).toBeVisible();
      await b.page.getByRole('button', { name: 'Esqueci minha senha' }).click();
      await expect(b.page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
      await expect(b.page).toHaveURL(/screen=esqueci-senha/);
      await expect(b.page).toHaveTitle(/Esqueci minha senha/);
      await print(b.page, 'N14', 1, 'esqueci-minha-senha');
    });

    await test.step('2. e-mail vazio ou mal formado mostra erro ligado ao campo', async () => {
      await b.page.getByRole('button', { name: 'Enviar link' }).click();
      await expect(b.page.getByText('Informe seu e-mail.')).toBeVisible();
      const campo = b.page.getByPlaceholder('seu@email.com');
      await expect(campo).toHaveAttribute('aria-invalid', 'true');
      const idErro = await campo.getAttribute('aria-describedby');
      expect(idErro, 'o campo com erro precisa de aria-describedby').toBeTruthy();
      await campo.fill('isso-nao-e-email');
      await b.page.getByRole('button', { name: 'Enviar link' }).click();
      await expect(b.page.locator(`[id="${idErro}"]`)).toHaveText('Informe um e-mail válido.');
    });

    await test.step('3. e-mail que não existe recebe a MESMA confirmação e nenhum e-mail é gerado', async () => {
      await b.page.getByPlaceholder('seu@email.com').fill(inexistente);
      await b.page.getByRole('button', { name: 'Enviar link' }).click();
      await expect(b.page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible({ timeout: 30_000 });
      await expect(b.page.getByText(MENSAGEM_NEUTRA)).toBeVisible();
      await expect(b.page.getByRole('heading', { name: 'Confira seu e-mail' }), 'o foco vai para o título da confirmação').toBeFocused();
      await print(b.page, 'N14', 2, 'confirmacao-neutra');
      await b.page.waitForTimeout(800);
      expect(emailsPara(inexistente), 'e-mail sem conta não pode gerar mensagem').toHaveLength(0);
      await b.page.getByRole('button', { name: 'Voltar para o login' }).click();
      await expect(b.page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible();
    });

    let link = '';
    await test.step('4. e-mail de uma conta existente: mesma confirmação, e o e-mail chega (lido do arquivo)', async () => {
      await b.page.getByRole('button', { name: 'Esqueci minha senha' }).click();
      await b.page.getByPlaceholder('seu@email.com').fill(u.email);
      await b.page.getByRole('button', { name: 'Enviar link' }).click();
      await expect(b.page.getByText(MENSAGEM_NEUTRA)).toBeVisible({ timeout: 30_000 });
      link = await esperarLinkDeSenha(u.email);
      expect(link).toMatch(/screen=redefinir-senha&uid=[\w-]+&token=[\w-]+/);
      const email = emailsPara(u.email)[0];
      expect(email.texto).toContain('vale por 1 hora');
      expect(email.html).toContain('Redefinir minha senha');
    });

    await test.step('5. o link abre "Nova senha" e tira uid e token da barra de endereço', async () => {
      await b.page.goto(link);
      await expect(b.page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
      await expect(b.page).toHaveTitle(/Nova senha/);
      await expect(b.page, 'uid e token não devem ficar na URL nem no histórico').not.toHaveURL(/token=|uid=/);
      await expect(b.page).toHaveURL(/screen=redefinir-senha/);
    });

    await test.step('6. regras de senha: curta, diferente na confirmação e senha fraca recusada pela API', async () => {
      const nova = b.page.getByPlaceholder('Mínimo 8 caracteres');
      const conf = b.page.getByPlaceholder('Repita a nova senha');
      await b.page.getByRole('button', { name: 'Redefinir senha' }).click();
      await expect(b.page.getByText('Informe uma senha.')).toBeVisible();
      await nova.fill('abc');
      await conf.fill('abc');
      await b.page.getByRole('button', { name: 'Redefinir senha' }).click();
      await expect(b.page.getByText('A senha deve ter no mínimo 8 caracteres.')).toBeVisible();
      await nova.fill('Outra@12345');
      await conf.fill('Diferente@12345');
      await b.page.getByRole('button', { name: 'Redefinir senha' }).click();
      await expect(b.page.getByText('As senhas não coincidem.')).toBeVisible();
      // senha fraca: passa na tela, mas a API recusa (muito comum) e o link continua valendo
      await nova.fill('12345678');
      await conf.fill('12345678');
      await b.page.getByRole('button', { name: 'Redefinir senha' }).click();
      await expect(b.page.getByText(/muito comum|numérica|parecida/)).toBeVisible({ timeout: 30_000 });
      await expect(b.page.getByRole('heading', { name: 'Link inválido ou expirado' }), 'senha fraca não pode gastar o link').toHaveCount(0);
      const idErro = await nova.getAttribute('aria-describedby');
      expect(idErro).toBeTruthy();
      await print(b.page, 'N14', 3, 'nova-senha-com-erro');
    });

    await test.step('7. mostrar/ocultar senhas', async () => {
      const nova = b.page.getByPlaceholder('Mínimo 8 caracteres');
      await expect(nova).toHaveAttribute('type', 'password');
      await b.page.getByRole('button', { name: 'Mostrar senhas' }).click();
      await expect(nova).toHaveAttribute('type', 'text');
      await expect(b.page.getByRole('button', { name: 'Ocultar senhas' })).toHaveAttribute('aria-pressed', 'true');
      await b.page.getByRole('button', { name: 'Ocultar senhas' }).click();
      await expect(nova).toHaveAttribute('type', 'password');
    });

    await test.step('8. senha forte: redefine (sem duplo envio) e mostra "Senha redefinida!"', async () => {
      await b.page.getByPlaceholder('Mínimo 8 caracteres').fill(NOVA_SENHA);
      await b.page.getByPlaceholder('Repita a nova senha').fill(NOVA_SENHA);
      const chamadas: string[] = [];
      b.page.on('request', r => { if (r.url().includes('/api/auth/senha/redefinir/')) chamadas.push(r.method()); });
      await b.page.getByPlaceholder('Repita a nova senha').press('Enter');
      await b.page.getByPlaceholder('Repita a nova senha').press('Enter').catch(() => {});
      await expect(b.page.getByRole('heading', { name: 'Senha redefinida!' })).toBeVisible({ timeout: 30_000 });
      expect(chamadas.length, 'um único envio, mesmo com Enter repetido').toBe(1);
      await print(b.page, 'N14', 4, 'senha-redefinida');
    });

    await test.step('9. entrar: a senha antiga é recusada e a nova funciona', async () => {
      await b.page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(b.page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible();
      await b.page.getByPlaceholder('seu@email.com').fill(u.email);
      await b.page.getByPlaceholder('••••••••').fill(u.senha);
      await b.page.getByPlaceholder('••••••••').press('Enter');
      await expect(b.page.getByText('E-mail ou senha incorretos.')).toBeVisible({ timeout: 60_000 });
      await b.page.getByPlaceholder('••••••••').fill(NOVA_SENHA);
      await b.page.getByPlaceholder('••••••••').press('Enter');
      await expect(b.page.getByText(/^Etapa 1 de/)).toBeVisible({ timeout: 60_000 });
    });

    await test.step('10. a sessão que estava aberta em outro lugar foi encerrada', async () => {
      const renovar = await a.page.request.post(`${API}/api/auth/login/refresh/`, { data: { refresh: refreshAntigo } });
      expect(renovar.status(), 'o refresh anterior à redefinição não pode mais renovar').toBe(401);
      await a.page.evaluate(() => sessionStorage.setItem('pm_access', 'token.invalido.simulado'));
      await a.page.reload();
      await expect(a.page.getByRole('heading', { name: 'Boas-vindas de volta!' })).toBeVisible({ timeout: 30_000 });
      await expect(a.page.getByText('Sua sessão expirou. Entre novamente.')).toBeVisible();
    });

    await test.step('11. reabrir o mesmo link (já usado): ao enviar a nova senha, mostra "Link inválido ou expirado" com atalho para pedir outro', async () => {
      await b.page.evaluate(() => sessionStorage.clear());
      await b.page.goto(link);
      await expect(b.page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
      await expect(b.page, 'uid e token saem da URL também na segunda abertura').not.toHaveURL(/token=|uid=/);
      await b.page.getByPlaceholder('Mínimo 8 caracteres').fill('OutraSenha@2027');
      await b.page.getByPlaceholder('Repita a nova senha').fill('OutraSenha@2027');
      await b.page.getByRole('button', { name: 'Redefinir senha' }).click();
      await expect(b.page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible({ timeout: 30_000 });
      await expect(b.page.getByRole('button', { name: 'Redefinir senha' })).toHaveCount(0);
      await print(b.page, 'N14', 5, 'link-invalido');
      await b.page.getByRole('button', { name: 'Pedir um novo link' }).click();
      await expect(b.page.getByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
    });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('N14b Recuperar senha: link sem código ou adulterado mostra link inválido', async ({ browser }) => {
  const s = await abrirSessao(browser);
  try {
    await s.page.goto('/?screen=redefinir-senha');
    await expect(s.page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();
    await s.page.goto('/?screen=redefinir-senha&uid=MQ&token=abc-123');
    await expect(s.page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
    await s.page.getByPlaceholder('Mínimo 8 caracteres').fill('SenhaValida@2026');
    await s.page.getByPlaceholder('Repita a nova senha').fill('SenhaValida@2026');
    await s.page.getByRole('button', { name: 'Redefinir senha' }).click();
    await expect(s.page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible({ timeout: 30_000 });
  } finally {
    await s.context.close();
  }
});
