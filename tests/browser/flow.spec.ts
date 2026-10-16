import { expect, test, type Page } from '@playwright/test';
/** A guest already on the list opens the invite link on a new phone. */
async function returning(page: Page, id: string) {
  await page.goto('/#invito=complotti');
  await page.getByRole('button', { name: 'Ho già prenotato' }).click();
  await page.getByLabel('Il tuo alias').selectOption(id);
  await page.getByRole('button', { name: 'Sono io' }).click();
}
test('GM, presenter, voter and projector complete two rounds', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await page.getByLabel('Password della regia').fill('regia-demo');
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
      await expect(speaker.getByRole('heading', { name: 'La parola è tua.' })).toBeVisible();
      await expect(speaker.getByRole('button', { name: 'Successiva' })).toBeDisabled();
    }
    await page.getByRole('button', { name: 'Passa al question time' }).click();
    await expect(voter.getByRole('heading', { name: 'Qualcuno ha delle domande.' })).toBeVisible();
    await page.getByRole('button', { name: 'Apri il voto per ' + name }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Conferma' }).click();
    if (name === 'Paolo') await expect(speaker.getByRole('heading', { name: 'Ora parlano gli altri.' })).toBeVisible();
    for (const label of ['Credibilità', 'Esposizione', 'Le prove'])
      await voter
        .getByRole('group', { name: label, exact: true })
        .getByRole('button', { name: '8', exact: true })
        .click();
    await voter.getByRole('button', { name: 'Sì, senza dubbio.' }).click();
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
    await expect(voter.getByRole('heading', { name: 'Tieni aperta la mente.' })).toBeVisible();
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
  await page.getByLabel('Password della regia').fill('regia-demo');
  await page.getByRole('button', { name: 'Continua', exact: true }).click();
  await page.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  await page.getByRole('button', { name: 'Fascicoli', exact: true }).click();
  await page.getByRole('button', { name: 'Modifica Paolo' }).click();
  await page.getByLabel('Nome e cognome').fill('Paolo Demo');
  await page.getByRole('button', { name: 'Salva fascicolo' }).click();
  await expect(page.getByRole('heading', { name: 'Paolo Demo', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('GM with a name votes from the regia and sees the provisional award rules', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await page.getByLabel('Password della regia').fill('regia-demo');
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
  await page.getByRole('button', { name: 'No, non mi ha convinto.' }).click();
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
test('a friend books a speaker slot with an alias and completes the details later', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#invito=complotti');
  await expect(page.getByRole('heading', { name: 'Blocca il tuo posto da relatore' })).toBeVisible();
  expect(page.url()).not.toContain('complotti');
  // All details are visible from the start, but only the alias is needed.
  await expect(page.getByLabel('Titolo della rivelazione')).toBeVisible();
  await page.getByRole('button', { name: 'Blocca il mio posto' }).click();
  await expect(page.getByRole('alert')).toContainText('alias');
  await page.getByRole('button', { name: 'Suggerisci un alias' }).click();
  await expect(page.getByLabel(/^Alias/)).not.toHaveValue('');
  await page.getByLabel(/^Alias/).fill('La Talpa');
  await page.getByRole('button', { name: 'Blocca il mio posto' }).click();
  await expect(page.getByRole('heading', { name: 'Benvenuto, La Talpa.' })).toBeVisible();
  await expect(page.locator('.booking .stamp')).toContainText('Prenotato');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Later: the rest of the dossier, on the same sheet.
  await page.getByLabel('Titolo da congresso').fill('Esperta di scie sospette');
  await page.getByLabel('Titolo della rivelazione').fill('LE SCIE PARLANO');
  await page.getByRole('radio', { name: /Con le slide/ }).click();
  await page.getByLabel('Link Google Slides').fill('https://example.com/nope');
  await page.getByRole('button', { name: 'Salva il fascicolo' }).click();
  await expect(page.getByRole('alert')).toContainText('Google Slides');
  await page.getByLabel('Link Google Slides').fill('https://docs.google.com/presentation/d/abc/edit');
  await page.getByRole('button', { name: 'Salva il fascicolo' }).click();
  await expect(page.locator('.booking .stamp')).toContainText('Ammesso');
  // The GM sees the alias, title and mode.
  const gm = await context.newPage();
  await gm.goto('/');
  await gm.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await gm.getByLabel('Password della regia').fill('regia-demo');
  await gm.getByRole('button', { name: 'Continua', exact: true }).click();
  await gm.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  const row = gm.locator('.person-row').filter({ has: gm.getByRole('heading', { name: 'La Talpa', exact: true }) });
  await expect(row).toContainText('LE SCIE PARLANO');
  await expect(row).toContainText('Slide');
  // A spectator, from a link without the key: password field, then alias only.
  const other = await context.newPage();
  await other.goto('/');
  await other.getByLabel(/^Alias/).fill('Gola Profonda');
  await other.getByLabel(/Parola d’ordine/).fill('sbagliata');
  await other.getByRole('button', { name: 'Blocca il mio posto' }).click();
  await expect(other.getByRole('alert')).toContainText('Parola d’ordine sbagliata');
  await other.getByLabel(/Parola d’ordine/).fill('complotti');
  await other.getByRole('button', { name: /vengo solo a giudicare/ }).click();
  await expect(other.locator('.booking .stamp')).toContainText('Ammesso');
  await expect(other.getByRole('heading', { name: 'Sei tra il pubblico.' })).toBeVisible();
});
