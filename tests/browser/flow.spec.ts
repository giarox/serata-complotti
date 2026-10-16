import { expect, test } from '@playwright/test';
test('GM, presenter, voter and projector complete two rounds', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accesso riservato alla regia' }).click();
  await page.getByLabel('Password della regia').fill('regia-demo');
  await page.getByRole('button', { name: 'Continua', exact: true }).click();
  await page.getByRole('button', { name: 'Entra in regia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tieni insieme il complotto.' })).toBeVisible();
  const voter = await context.newPage();
  await voter.goto('/');
  await voter.getByLabel('Password della serata').fill('complotti');
  await voter.getByRole('button', { name: 'Apri il fascicolo' }).click();
  await voter.getByLabel('Il tuo nome').selectOption('giulia');
  await voter.getByRole('button', { name: 'Entra nel congresso' }).click();
  const speaker = await context.newPage();
  await speaker.goto('/');
  await speaker.getByLabel('Password della serata').fill('complotti');
  await speaker.getByRole('button', { name: 'Apri il fascicolo' }).click();
  await speaker.getByLabel('Il tuo nome').selectOption('paolo');
  await speaker.getByRole('button', { name: 'Entra nel congresso' }).click();
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
  await page.getByLabel('Nome', { exact: true }).fill('Paolo Demo');
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
