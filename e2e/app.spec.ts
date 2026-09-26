import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Os testes compartilham um app e dependem da ordem (o agente criado é persistido
// e verificado no fim): uma falha pula os seguintes em vez de re-rodar com estado vazio.
test.describe.configure({ mode: 'serial', retries: 0 });

let app: ElectronApplication;
let page: Page;
let userData: string;
const pageErrors: string[] = [];
const consoleErrors: string[] = [];

async function launch(): Promise<void> {
  // FRIGG_E2E_EXECUTABLE aponta para um app empacotado (ex.: release/win-unpacked/FRIGG.exe).
  const packaged = process.env['FRIGG_E2E_EXECUTABLE'];
  const sandboxArgs = process.platform === 'linux' ? ['--no-sandbox'] : [];
  app = await electron.launch({
    ...(packaged
      ? { executablePath: packaged, args: sandboxArgs }
      : { args: [join(process.cwd(), 'dist', 'main', 'main.cjs'), ...sandboxArgs] }),
    env: {
      ...process.env,
      FRIGG_DISABLE_UPDATES: '1',
      FRIGG_USER_DATA: userData,
      // Endpoint local sem serviço: o app deve mostrar OmniRoute indisponível, nunca saudável.
      FRIGG_OMNIROUTE_URL: 'http://127.0.0.1:9',
    },
  });
  page = await app.firstWindow();
  // Janela no tamanho mínimo do app (igual a telas pequenas / runner do CI) para
  // pegar dependências do layout responsivo.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1024, 720));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.waitForLoadState('domcontentloaded');
}

test.beforeAll(async () => {
  userData = mkdtempSync(join(tmpdir(), 'frigg-e2e-'));
  await launch();
});

test.afterAll(async () => {
  await app?.close();
  rmSync(userData, { recursive: true, force: true });
});

test('abre no Command Center com estado honesto do OmniRoute', async () => {
  await expect(page.getByRole('heading', { name: 'O que vamos construir hoje?' })).toBeVisible();
  await expect(page.locator('.topbar-status')).toContainText('OmniRoute: indisponível');
  await expect(page.locator('.topbar-cost')).toHaveText('US$ 0,00');
});

test('a ponte do preload está exposta e o main valida IPC', async () => {
  const result = await page.evaluate(async () => {
    const frigg = (window as unknown as { frigg: { agent: { start: (id: string, p: unknown) => Promise<{ ok: boolean; detail: string }> } } }).frigg;
    return frigg.agent.start('x', { prompt: 'oi', model: 'sonnet & calc' });
  });
  expect(result).toEqual({ ok: false, detail: 'prompt inválido' });
});

test('cria um agente e mostra os controles de rota, gasto e conversa', async () => {
  await page.locator('button.quick-card', { hasText: 'Novo agente' }).click();
  await expect(page.locator('.node.agent')).toBeVisible();
  const side = page.locator('.side');
  await expect(side.getByLabel('Rota da inferência')).toHaveValue('auto');
  await side.getByLabel('Limite de gasto por execução (US$)').fill('1,5');
  await expect(page.locator('.node.agent').getByRole('button', { name: '▶ Iniciar' })).toBeVisible();
});

test('limite do fluxo aceita vírgula e recusa valor inválido', async () => {
  await page.getByRole('button', { name: 'Início', exact: true }).click();
  const budget = page.getByLabel('Limite de gasto por execução do fluxo (US$)');
  await budget.fill('abc');
  await expect(page.getByRole('alert').filter({ hasText: 'Use um valor entre 0,01 e 1000.' })).toBeVisible();
  await budget.fill('2,50');
  await expect(page.locator('.metric-card', { hasText: 'Gasto nesta sessão' })).toContainText('Limite por fluxo: US$ 2,50');
});

test('navega entre Canvas e Operação sem erros de página', async () => {
  await page.getByRole('button', { name: 'Operação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operação' })).toBeVisible();
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.locator('.node.agent')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('terminal real (PTY + xterm) executa um comando e mostra a saída', async () => {
  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.locator('button.quick-card', { hasText: 'Novo terminal' }).click();
  const term = page.locator('.node .xterm').last();
  await expect(term).toBeVisible();
  // Espera o shell subir (o prompt aparece nas linhas do xterm).
  await expect.poll(async () => (await term.locator('.xterm-rows').innerText()).trim().length, { timeout: 20_000 }).toBeGreaterThan(0);
  await term.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type('echo frigg-e2e-$((20+22))ok');
  await page.keyboard.press('Enter');
  // bash/zsh expandem $((20+22)); no PowerShell a linha ecoa literal. Ambos provam I/O real.
  await expect(term.locator('.xterm-rows')).toContainText(/frigg-e2e-(42ok|\$\(\(20\+22\)\)ok)/, { timeout: 20_000 });
  expect(pageErrors).toEqual([]);
  // O terminal recém-criado fica selecionado: remove pelo painel lateral (o PTY é encerrado).
  await page.locator('.side').getByRole('button', { name: 'Remover nó' }).click();
  await expect(page.locator('.node .xterm')).toHaveCount(0);
});

test('abre o escritório 3D (three/R3F carregados sob demanda) sem erros', async () => {
  // Atalho em vez do botão: o botão some em janelas < 1080 px (CSS responsivo).
  await page.keyboard.press('Control+K');
  await page.getByRole('dialog').getByText('Abrir escritório 3D').click();
  await expect(page.locator('.stage canvas')).toBeVisible({ timeout: 20_000 });
  expect(pageErrors).toEqual([]);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
});

test('Delete apaga só o nó selecionado e o arraste move o nó', async () => {
  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.locator('button.quick-card', { hasText: 'Nota rápida' }).click();
  const note = page.locator('.react-flow__node-note');
  await expect(note).toHaveCount(1);
  await note.click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Delete');
  await expect(note).toHaveCount(0);
  await expect(page.locator('.node.agent')).toHaveCount(1);

  const agent = page.locator('.react-flow__node-agent');
  const before = await agent.boundingBox();
  const head = page.locator('.node.agent .head');
  const box = await head.boundingBox();
  if (!before || !box) throw new Error('nó sem caixa');
  await page.mouse.move(box.x + 20, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 48, { steps: 8 });
  // Durante o arraste o nó acompanha o cursor (antes só saltava ao soltar).
  const during = await agent.boundingBox();
  expect(during!.x).toBeGreaterThan(before.x + 30);
  await page.mouse.up();
  await expect.poll(async () => (await agent.boundingBox())!.x).toBeGreaterThan(before.x + 30);
});

test('nome de projeto vazio não trava o salvamento automático', async () => {
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.getByTitle('Renomear').click();
  const name = page.getByLabel('Nome do projeto');
  await name.fill('');
  await name.press('Enter');
  await expect.poll(() => {
    try {
      return JSON.parse(readFileSync(join(userData, 'workspace.json'), 'utf8')).workspaces[0].name as string;
    } catch {
      return '';
    }
  }).toBe('Projeto sem nome');
  await expect(page.locator('.save-state')).toHaveText('Salvo');
});

test('nenhum erro de console durante a sessão', () => {
  expect(consoleErrors).toEqual([]);
});

test('persiste o workspace e restaura após reiniciar', async () => {
  // Aguarda o autosave (debounce de 600 ms) gravar o agente criado.
  await expect(page.locator('.save-state')).toHaveText('Salvo', { timeout: 10_000 });
  await expect.poll(() => {
    try {
      return JSON.parse(readFileSync(join(userData, 'workspace.json'), 'utf8')).workspaces[0].nodes.length as number;
    } catch {
      return 0;
    }
  }).toBe(1);
  await app.close();
  await launch();
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await expect(page.locator('.node.agent')).toHaveCount(1);
  await page.locator('.node.agent').click();
  await expect(page.locator('.side').getByLabel('Limite de gasto por execução (US$)')).toHaveValue('1,5');
});
