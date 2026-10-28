import { expect, test, type Page } from '@playwright/test';
/** A guest already on the list opens the invite link on a new phone. */
async function returning(page: Page, id: string) {
  await page.goto('/#invito=vecchio-link');
  await page.getByRole('button', { name: 'Ho già fatto richiesta' }).click();
  await page.getByLabel('Chi sei').selectOption(id);
  await page.getByRole('button', { name: 'Sono io' }).click();
}
test('GM, presenter, voter and projector complete two rounds', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await page.getByLabel('PIN della regia').fill('0000');
  await page.getByRole('button', { name: 'Continua', exact: true }).click();
  await page.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tieni insieme il complotto.' })).toBeVisible();
  const voter = await context.newPage();
  await returning(voter, 'giulia');
  const speaker = await context.newPage();
  await returning(speaker, 'paolo');
  for (const name of ['Paolo', 'Marco']) {
    const row = page.locator('.person-row').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await row.getByRole('button', { name: 'Scegli' }).click();
    await page.getByRole('button', { name: 'Inizia con ' + name }).click();
    if (name === 'Paolo') {
      await expect(speaker.getByRole('heading', { name: 'La parola è tua. Svegliali.' })).toBeVisible();
      // The presenter's phone is the remote: taps go through without errors.
      await speaker.getByRole('button', { name: 'Avanti →' }).click();
      await speaker.getByRole('button', { name: '← Indietro' }).click();
      await expect(speaker.locator('.slide-remote [role=alert]')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Passa al question time' }).click();
    await expect(voter.getByRole('heading', { name: 'Fatti delle domande.' })).toBeVisible();
    await page.getByRole('button', { name: 'Apri il voto per ' + name }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
    if (name === 'Paolo') await expect(speaker.getByRole('heading', { name: 'Ora parlano gli altri.' })).toBeVisible();
    for (const label of ['Credibilità', 'Esposizione', 'Le prove'])
      await voter
        .getByRole('group', { name: label, exact: true })
        .getByRole('button', { name: '8', exact: true })
        .click();
    await voter.getByRole('button', { name: 'Sì, come se fosse antani.' }).click();
    await voter.getByRole('button', { name: 'Consegna il verdetto' }).click();
    await expect(voter.getByRole('status')).toContainText('Voto salvato');
    await voter.reload();
    await expect(voter.getByRole('status')).toContainText('Voto salvato');
    await voter
      .getByRole('group', { name: 'Credibilità', exact: true })
      .getByRole('button', { name: '9', exact: true })
      .click();
    await voter.getByRole('button', { name: 'Aggiorna il voto' }).click();
    await expect(page.getByText('1 voti ricevuti')).toBeVisible();
    await page.getByRole('button', { name: 'Chiudi la votazione' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
    await expect(voter.getByRole('heading', { name: 'Apri la mente. Non troppo, che entra il 5G.' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Il verdetto', exact: true }).click();
  await expect(page.getByText('Il verdetto è ancora sotto chiave.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Inizia il reveal' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
  await expect(voter.getByRole('heading', { name: 'Il verdetto.', exact: true })).toBeVisible();
  await expect(page.locator('.award-open')).toHaveCount(1);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Svela la prossima categoria' }).click();
  await expect(page.locator('.award-open')).toHaveCount(4);
  // Paolo and Marco received identical ballots: nobody had a prize yet, so it is a shared prize.
  await expect(page.getByText('PARI MERITO').first()).toBeVisible();
});
test('mobile entry and GM dossier editor fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await page.getByLabel('PIN della regia').fill('0000');
  await page.getByRole('button', { name: 'Continua', exact: true }).click();
  await page.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  await page.getByRole('button', { name: 'Fascicoli', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Paolo' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Paolo Demo');
  await page.getByRole('button', { name: 'Salva fascicolo' }).click();
  await expect(page.locator('.req-name', { hasText: 'Paolo Demo' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('GM with a name votes from the regia and sees the provisional award rules', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await page.getByLabel('PIN della regia').fill('0000');
  await page.getByRole('button', { name: 'Continua', exact: true }).click();
  await page.getByLabel('Il tuo nome').selectOption('gianluca');
  await page.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  const row = page.locator('.person-row').filter({ has: page.getByRole('heading', { name: 'Sara', exact: true }) });
  await row.getByRole('button', { name: 'Scegli' }).click();
  await page.getByRole('button', { name: 'Inizia con Sara' }).click();
  await page.getByRole('button', { name: 'Passa al question time' }).click();
  await page.getByRole('button', { name: 'Apri il voto per Sara' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
  for (const label of ['Credibilità', 'Esposizione', 'Le prove'])
    await page.getByRole('group', { name: label, exact: true }).getByRole('button', { name: '7', exact: true }).click();
  await page.getByRole('button', { name: 'No, troppo sensata.' }).click();
  await page.getByRole('button', { name: 'Consegna il verdetto' }).click();
  await expect(page.getByText('1 voti ricevuti')).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi la votazione' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
  await page.getByRole('button', { name: 'Il verdetto', exact: true }).click();
  await page.getByLabel('Premi massimi per persona').selectOption('1');
  await page.getByRole('button', { name: 'Anticipa Supercazzola' }).click();
  await expect(page.locator('.order-list li').nth(2)).toContainText('SUPERCAZZOLA');
  await page.getByRole('button', { name: 'Inizia il reveal' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
  await expect(page.getByText('IL PREMIO VA A').first()).toBeVisible();
  await expect(page.locator('.award-settings')).toHaveCount(0);
});
test('a friend registers on one screen, then adds the Slides link before the deadline', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#invito=vecchio-link');
  await expect(page.getByRole('heading', { name: 'Richiesta di ammissione' })).toBeVisible();
  expect(page.url()).not.toContain('vecchio-link');
  // One screen: name, silly title and how they take part.
  await expect(page.getByLabel('Titolo della rivelazione')).toHaveCount(0);
  await page.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  await expect(page.getByRole('alert')).toContainText('nome');
  await page.getByLabel('Nome', { exact: true }).fill('Giulia');
  await page.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  await expect(page.getByRole('alert')).toContainText('modalità di presentazione');
  await page.getByRole('radio', { name: /Con tecnologia/ }).click();
  await page.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  await expect(page.getByRole('alert')).toContainText('qualifica');
  await page.getByLabel(/Qualifica accademica/).fill('Esperta di scie sospette');
  await page.getByRole('radio', { name: /Porto un testimone/ }).click();
  await page.getByLabel('Nome del testimone').fill('Ugo');
  await page.getByLabel('Link Google Slides').fill('https://example.com/nope');
  await page.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  await expect(page.getByRole('alert')).toContainText('Google Slides');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The link is required to send the request.
  await page.getByLabel('Link Google Slides').fill('');
  await page.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  await expect(page.getByRole('alert')).toContainText('link delle slide');
  await page.getByLabel('Link Google Slides').fill('https://docs.google.com/presentation/d/old/edit');
  await page.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  // After booking: the pass, then (on demand) the dossier, then the register.
  await expect(page.locator('.pass-name', { hasText: 'Giulia' })).toBeVisible();
  await expect(page.locator('.guest-pass')).toContainText('Allegato al fascicolo');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Modifica il fascicolo allegato' }).click();
  await expect(page.getByLabel(/Qualifica accademica/)).toHaveValue('Esperta di scie sospette');
  const order = await page.evaluate(() =>
    ['.guest-pass', '#fascicolo', '.roster'].map((sel) => document.querySelector(sel)!.getBoundingClientRect().top),
  );
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  const registry = page.locator('.roster');
  await expect(registry.locator('.registry-row.me')).toContainText('+ testimone');
  await expect(registry).toContainText('Paolo');
  await expect(registry).toContainText('Studioso dei finti uccelli'); // everyone reads the others' qualifications
  await page.getByLabel('Link Google Slides').fill('https://docs.google.com/presentation/d/abc/edit');
  await page.getByRole('button', { name: 'Salva modifiche al fascicolo' }).last().click();
  await expect(page.getByRole('button', { name: 'Nascondi il fascicolo' })).toBeVisible();
  // No talk title at all: no spoilers, not even for the GM.
  await expect(page.getByLabel('Titolo della rivelazione')).toHaveCount(0);
  // The GM sees the congress title and mode; two Giulia are fine.
  const gm = await context.newPage();
  await gm.goto('/');
  await gm.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await gm.getByLabel('PIN della regia').fill('0000');
  await gm.getByRole('button', { name: 'Continua', exact: true }).click();
  await gm.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  const row = gm.locator('.person-row').filter({ hasText: 'Esperta di scie sospette' });
  await expect(row).toContainText('Giulia');
  await expect(row).toContainText('Con tecnologia');
  // The GM can remove anyone, from the dossier list.
  await gm.getByRole('button', { name: 'I fascicoli' }).first().click();
  await expect(gm.locator('.overview')).toContainText('Richieste');
  const card = gm.locator('.req-card').filter({ hasText: 'Esperta di scie sospette' });
  await expect(card).toContainText('+ testimone');
  await card.getByRole('radio', { name: 'Ammesso' }).click();
  await gm.getByRole('tab', { name: /Ammessi/ }).click();
  await expect(gm.locator('.req-card').filter({ hasText: 'Esperta di scie sospette' })).toBeVisible();
  await gm
    .locator('.req-card')
    .filter({ hasText: 'Esperta di scie sospette' })
    .getByRole('button', { name: 'Elimina Giulia' })
    .click();
  await gm.getByRole('button', { name: 'Conferma' }).click();
  await expect(gm.locator('.req-card').filter({ hasText: 'Esperta di scie sospette' })).toHaveCount(0);
  // Another researcher from the plain link: no password, no audience option.
  const other = await context.newPage();
  await other.goto('/');
  await other.getByLabel('Nome', { exact: true }).fill('Ugo');
  await expect(other.getByRole('radio', { name: /Solo pubblico/ })).toHaveCount(0);
  await other.getByRole('radio', { name: /Senza tecnologia/ }).click();
  await other.getByLabel(/Qualifica accademica/).fill('Investigatore da gruppo Telegram');
  await other.getByRole('button', { name: 'Richiedi l’ammissione' }).click();
  await expect(other.locator('.welcome-lede')).toContainText('Figure non meglio identificate');
  await expect(other.locator('.roster')).toContainText('Ugo');
});
