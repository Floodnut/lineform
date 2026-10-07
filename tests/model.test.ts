import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiagram } from '../src/model';

test('lanes preserves Korean text, empty cells, and chronological rows', () => {
  assert.deepEqual(parseDiagram('type: lanes\ncolumns: [작업, 메인]\nrows:\n  - [검사, null]\n  - [null, 변경]\nconclusion: 불일치'), {
    type: 'lanes', columns: ['작업', '메인'], rows: [['검사', null], [null, '변경']], conclusion: '불일치',
  });
});

test('flow supports branching and joining with a default direction', () => {
  const diagram = parseDiagram(JSON.stringify({ type: 'flow', nodes: [
    { id: 'a', label: '검사' }, { id: 'b', label: '작업' }, { id: 'c', label: '결과' },
  ], edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'c' }] })) as { direction: string };
  assert.equal(diagram.direction, 'down');
});

const invalid: [string, unknown, RegExp][] = [
  ['unknown type', { type: 'other' }, /type/],
  ['empty columns', { type: 'lanes', columns: [], rows: [[]] }, /columns/],
  ['unequal row length', { type: 'lanes', columns: ['a', 'b'], rows: [['x']] }, /rows\[0\]/],
  ['numeric label', { type: 'lanes', columns: ['a'], rows: [[5]] }, /rows\[0\]\[0\]/],
  ['blank label', { type: 'lanes', columns: ['a'], rows: [['  ']] }, /rows\[0\]\[0\]/],
  ['unknown property', { type: 'lanes', columns: ['a'], rows: [['x']], color: 'red' }, /color/],
  ['empty title', { type: 'lanes', columns: ['a'], rows: [['x']], title: '' }, /title/],
  ['invalid direction', { type: 'flow', direction: 'up', nodes: [{ id: 'a', label: 'a' }], edges: [] }, /direction/],
  ['duplicate ID', { type: 'flow', nodes: [{ id: 'a', label: 'a' }, { id: 'a', label: 'b' }], edges: [] }, /중복/],
  ['missing node', { type: 'flow', nodes: [{ id: 'a', label: 'a' }], edges: [{ from: 'a', to: 'b' }] }, /존재하지/],
  ['self edge', { type: 'flow', nodes: [{ id: 'a', label: 'a' }], edges: [{ from: 'a', to: 'a' }] }, /자기/],
  ['cycle', { type: 'flow', nodes: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] }, /순환/],
  ['duplicate edge', { type: 'flow', nodes: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }] }, /중복/],
];
for (const [name, input, pattern] of invalid) {
  test(`rejects ${name} with a useful field error`, () => assert.throws(() => parseDiagram(JSON.stringify(input)), pattern));
}

test('malformed YAML reports location', () => assert.throws(() => parseDiagram('type: lanes\ncolumns: [broken'), /line|줄|행/i));
test('YAML aliases are rejected instead of expanding recursive structures', () => assert.throws(() => parseDiagram('type: lanes\ncolumns: &x [*x]\nrows: []'), /별칭/));
test('literal HTML remains label text', () => {
  const diagram = parseDiagram(JSON.stringify({ type: 'lanes', columns: ['<script>'], rows: [['<img src=x onerror=alert(1)>']] })) as { rows: string[][] };
  assert.equal(diagram.rows[0][0], '<img src=x onerror=alert(1)>');
});

test('preserves flow default sizes and partial node overrides', () => {
  const input = { type: 'flow', defaults: { width: 320, minHeight: 90 }, nodes: [{ id: 'a', label: '작업', width: 180 }, { id: 'b', label: '결과', minHeight: 120 }], edges: [] };
  assert.deepEqual(parseDiagram(JSON.stringify(input)), { ...input, direction: 'down' });
});
test('accepts mixed string and sized lane columns', () => {
  const input = { type: 'lanes', defaults: { width: 300, minHeight: 80 }, columns: ['기본', { label: '상세', width: 420 }], rows: [['검사', '결과']] };
  assert.deepEqual(parseDiagram(JSON.stringify(input)), input);
});
for (const [name, input, pattern] of [
  ['narrow default', { type: 'flow', defaults: { width: 40 }, nodes: [{ id: 'a', label: 'a' }], edges: [] }, /defaults.width/],
  ['string width', { type: 'flow', nodes: [{ id: 'a', label: 'a', width: '200' }], edges: [] }, /nodes\[0\].width/],
  ['negative height', { type: 'flow', nodes: [{ id: 'a', label: 'a', minHeight: -1 }], edges: [] }, /nodes\[0\].minHeight/],
  ['null size', { type: 'flow', defaults: { width: null }, nodes: [{ id: 'a', label: 'a' }], edges: [] }, /defaults.width/],
  ['unknown default', { type: 'flow', defaults: { height: 60 }, nodes: [{ id: 'a', label: 'a' }], edges: [] }, /height/],
  ['missing column label', { type: 'lanes', columns: [{ width: 200 }], rows: [['a']] }, /columns\[0\].label/],
  ['narrow column', { type: 'lanes', columns: [{ label: 'a', width: 79 }], rows: [['a']] }, /columns\[0\].width/],
] as [string, unknown, RegExp][]) test(`rejects ${name}`, () => assert.throws(() => parseDiagram(JSON.stringify(input)), pattern));
test('rejects infinite sizes', () => assert.throws(() => parseDiagram('type: lanes\ndefaults: {width: .inf}\ncolumns: [a]\nrows: [[a]]'), /defaults.width/));

test('preserves optional edge labels including literal markup and newlines', () => {
  const input = { type: 'flow', nodes: [{ id: 'a', label: '입력' }, { id: 'b', label: '결과' }], edges: [{ from: 'a', to: 'b', label: '<값> & 상태\n두 번 호출' }] };
  assert.deepEqual(parseDiagram(JSON.stringify(input)), { ...input, direction: 'down' });
});
for (const invalidLabel of ['', '  ', null, 42, { text: 'label' }]) test(`rejects invalid edge label ${JSON.stringify(invalidLabel)}`, () => {
  const input = { type: 'flow', nodes: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], edges: [{ from: 'a', to: 'b', label: invalidLabel }] };
  assert.throws(() => parseDiagram(JSON.stringify(input)), /edges\[0\].label:.*문자열/);
});
