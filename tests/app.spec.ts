import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const lanes = 'type: lanes\ncolumns: [작업, 메인]\nrows:\n  - [검사, null]\n  - [null, 변경]\nconclusion: 불일치';
const block = (content: string) => '```diagram\n' + content + '\n```';

test('starts with the supplied example and invalid input clears stale export', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview svg')).toContainText('백그라운드 병합');
  await expect(page.locator('#status')).toContainText('완료');
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: '다이어그램 소스' }).fill('type: lanes\ncolumns: [잘못된');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#preview svg')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'SVG 다운로드', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '다이어그램 소스' }).fill(lanes);
  await expect(page.locator('#preview svg')).toContainText('불일치');
});

test('Markdown isolates errors and uses unique SVG markers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await page.getByRole('textbox', { name: '다이어그램 소스' }).fill('# 실행 분석\n\n' + block(lanes) + '\n\n' + block('type: missing') + '\n\n' + block(lanes) + '\n\n<script>window.hacked=true</script>');
  await expect(page.locator('#preview svg')).toHaveCount(2);
  await expect(page.locator('#preview [role=alert]')).toHaveCount(1);
  await expect(page.locator('#preview h1')).toHaveText('실행 분석');
  const markers = await page.locator('#preview marker').evaluateAll(nodes => nodes.map(n => n.id));
  expect(new Set(markers).size).toBe(markers.length);
  expect(await page.evaluate(() => 'hacked' in window)).toBe(false);
  await expect(page.locator('#preview script')).toHaveCount(0);
});

test('rapid changes show only the latest input and mode drafts are retained', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: '다이어그램 소스' });
  await page.getByLabel('예제 선택').selectOption('flow');
  await editor.fill(lanes.replace('불일치', '최종 결과'));
  await expect(page.locator('#preview svg')).toContainText('최종 결과');
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await page.getByRole('button', { name: 'YAML', exact: true }).click();
  await expect(editor).toHaveValue(lanes.replace('불일치', '최종 결과'));
});

test('exported SVG opens alone with labels and arrowheads', async ({ page, context }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'SVG 다운로드', exact: true });
  await expect(button).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  const content = await readFile((await download.path())!, 'utf8');
  const standalone = await context.newPage();
  await standalone.goto('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(content));
  await expect(standalone.locator('svg')).toBeVisible();
  await expect(standalone.locator('svg')).toContainText('백그라운드 병합');
  await expect(standalone.locator('parsererror')).toHaveCount(0);
  expect(await standalone.locator('[marker-end]').count()).toBeGreaterThan(0);
  const geometry = await standalone.locator('svg').evaluate(svg => {
    const bounds = (svg as SVGSVGElement).getBBox();
    return { width: bounds.width, height: bounds.height, textWidths: [...svg.querySelectorAll('text')].map(text => text.getBBox().width) };
  });
  expect(geometry.width).toBeGreaterThan(500);
  expect(geometry.height).toBeGreaterThan(400);
  expect(geometry.textWidths.every(width => width > 0)).toBe(true);
  await download.saveAs('artifacts/example.svg');
});

test('mobile keeps the diagram geometry inside a horizontally scrollable canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview svg')).toBeVisible();
  const before = await page.locator('#preview svg').getAttribute('viewBox');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#preview svg').getAttribute('viewBox')).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const scroll = await page.locator('#preview').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  expect(scroll.content).toBeGreaterThan(scroll.width);
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
});
