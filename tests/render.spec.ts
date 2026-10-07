import { test, expect, type Page } from '@playwright/test';

async function draw(page: Page, data: unknown) {
  await page.goto('/');
  await page.evaluate(async source => {
    // @ts-expect-error Vite resolves this browser module.
    const { renderDiagram } = await import('/src/render.ts');
    document.body.replaceChildren(await renderDiagram(source));
  }, JSON.stringify(data));
}

async function assertTextFits(page: Page) {
  const errors = await page.evaluate(() => {
    const errors: string[] = [];
    document.querySelectorAll<SVGGElement>('[data-box]').forEach(group => {
      const rect = group.querySelector('rect')!.getBBox();
      for (const text of group.querySelectorAll('text')) {
        const b = text.getBBox();
        if (b.x < rect.x || b.y < rect.y || b.x + b.width > rect.x + rect.width + 0.5 || b.y + b.height > rect.y + rect.height + 0.5) errors.push(text.textContent!);
      }
    });
    return errors;
  });
  expect(errors).toEqual([]);
}

test('lanes keeps shared row boundaries and wraps mixed long labels', async ({ page }) => {
  await draw(page, { type: 'lanes', title: '실행 순서', columns: ['백그라운드 병합', '메인 스레드'], rows: [
    ['한글 문장 ScopeInfo와 숫자 1234의 상태가 변경된 상황을 아주 길게 설명합니다. '.repeat(3), null],
    [null, '같은 함수의 지연 컴파일 진행'], ['x'.repeat(160), '👩‍💻'.repeat(30)],
  ], conclusion: '서로 다른 상태를 참조합니다. '.repeat(8) });
  await expect(page.locator('svg')).toBeVisible();
  const rows = await page.locator('[data-cell]').evaluateAll(cells => cells.map(el => ({ row: el.getAttribute('data-row'), y: el.querySelector('rect')!.getAttribute('y'), h: el.querySelector('rect')!.getAttribute('height') })));
  expect(rows).toHaveLength(6);
  for (let i = 0; i < rows.length; i += 2) expect(rows[i]).toEqual(rows[i + 1]);
  await assertTextFits(page);
});

for (const direction of ['down', 'right']) test(`flow ${direction} routes a diamond without crossing unrelated boxes`, async ({ page }) => {
  await draw(page, { type: 'flow', direction, nodes: [
    { id: 'a', label: '요청 수신' }, { id: 'b', label: '캐시 조회' }, { id: 'c', label: '원본 조회' }, { id: 'd', label: '응답 반환' },
  ], edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'd' }] });
  const problems = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<SVGGElement>('[data-node]')].map(n => ({ id: n.dataset.node, b: n.querySelector('rect')!.getBBox() }));
    const errors: string[] = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].b, b = nodes[j].b;
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) errors.push('overlap');
    }
    for (const edge of document.querySelectorAll<SVGPathElement>('[data-edge]')) {
      for (let length = 1; length < edge.getTotalLength(); length += 2) {
        const p = edge.getPointAtLength(length);
        for (const node of nodes) {
          const b = node.b;
          if (p.x > b.x + 1 && p.x < b.x + b.width - 1 && p.y > b.y + 1 && p.y < b.y + b.height - 1) errors.push('edge through node');
        }
      }
    }
    return { errors, count: nodes.length, edges: document.querySelectorAll('[data-edge]').length };
  });
  expect(problems).toEqual({ errors: [], count: 4, edges: 4 });
  await assertTextFits(page);
});

test('SVG labels never become executable HTML', async ({ page }) => {
  await draw(page, { type: 'lanes', columns: ['<script>alert(1)</script>'], rows: [['<img src=x onerror=alert(1)>']] });
  await expect(page.locator('svg script, svg img')).toHaveCount(0);
  await expect(page.locator('svg')).toContainText('<img src=x onerror=alert(1)>');
});

for (const direction of ['down', 'right']) test(`sized flow ${direction} applies defaults, overrides and content growth`, async ({ page }) => {
  await draw(page, { type: 'flow', direction, defaults: { width: 320, minHeight: 90 }, nodes: [
    { id: 'a', label: '기본값' }, { id: 'b', label: '개별 높이', width: 180, minHeight: 130 },
    { id: 'c', label: '아주 긴 설명 EnglishIdentifier '.repeat(20), width: 100, minHeight: 40 },
  ], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] });
  const rects = await page.locator('[data-node] rect').evaluateAll(nodes => nodes.map(n => ({ w: Number(n.getAttribute('width')), h: Number(n.getAttribute('height')) })));
  expect(rects[0]).toEqual({ w: 320, h: 90 });
  expect(rects[1]).toEqual({ w: 180, h: 130 });
  expect(rects[2].w).toBe(100);
  expect(rects[2].h).toBeGreaterThan(130);
  await assertTextFits(page);
  const connections = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll<SVGRectElement>('[data-node] rect')].map(n => n.getBBox());
    return [...document.querySelectorAll<SVGPathElement>('[data-edge]')].every(edge => {
      const points = [edge.getPointAtLength(0), edge.getPointAtLength(edge.getTotalLength())];
      return points.every(p => boxes.some(b => p.x >= b.x - 1 && p.x <= b.x + b.width + 1 && p.y >= b.y - 1 && p.y <= b.y + b.height + 1 && Math.min(Math.abs(p.x - b.x), Math.abs(p.x - b.x - b.width), Math.abs(p.y - b.y), Math.abs(p.y - b.y - b.height)) < 1));
    });
  });
  expect(connections).toBe(true);
});

test('sized lanes preserve shared rows and total-width conclusion', async ({ page }) => {
  await draw(page, { type: 'lanes', defaults: { width: 300, minHeight: 100 }, columns: ['기본', { label: '좁은 열 제목도 줄바꿈', width: 100 }], rows: [['짧은 글', null], [null, '긴 한글 문장과 LongIdentifier '.repeat(12)]], conclusion: '공유 결론' });
  const cells = await page.locator('[data-cell] rect').evaluateAll(nodes => nodes.map(n => ({ x: Number(n.getAttribute('x')), y: Number(n.getAttribute('y')), w: Number(n.getAttribute('width')), h: Number(n.getAttribute('height')) })));
  expect(cells[0].w).toBe(300);
  expect(cells[1].w).toBe(100);
  expect(cells[1].x).toBe(cells[0].x + 300);
  expect(cells[0].h).toBe(100);
  expect(cells[1].h).toBe(100);
  expect(cells[2].h).toBeGreaterThan(100);
  expect(cells[2].h).toBe(cells[3].h);
  expect(cells[2].y).toBe(cells[3].y);
  await expect(page.locator('[data-box]').last().locator('rect')).toHaveAttribute('width', '400');
  await assertTextFits(page);
});
