import { test, expect } from '@playwright/test';

test('Home oferece apenas Home e Visualizador na navegação', async ({ page }) => {
  await page.route('**/api/inde/catalogos-servicos/ibge', route => route.fulfill({ json: [] }));
  await page.route('https://*.tile.openstreetmap.org/**', route => route.abort());
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  await expect(menu.getByRole('link')).toHaveText(['Home', 'Visualizador']);
  await expect(page.getByText('Geo_Explorer_INDE', { exact: true })).toBeVisible();
  await menu.getByRole('link', { name: 'Visualizador' }).click();
  await expect(page).toHaveURL(/\/visualizador\/ol$/);
  await expect(menu).toHaveCount(0);
  await page.getByRole('link', { name: 'Voltar para Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Explore os dados geográficos do Brasil' })).toBeVisible();
});
