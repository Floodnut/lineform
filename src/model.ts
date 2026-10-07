import { parseDocument, visit } from 'yaml';

export type LanesDiagram = { type: 'lanes'; title?: string; columns: string[]; rows: (string | null)[][]; conclusion?: string };
export type FlowDiagram = { type: 'flow'; title?: string; direction: 'down' | 'right'; nodes: { id: string; label: string }[]; edges: { from: string; to: string }[] };
export type Diagram = LanesDiagram | FlowDiagram;

function fail(path: string, message: string): never { throw new Error(`${path}: ${message}`); }
function object(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '객체가 필요합니다.');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, '지원하지 않는 속성입니다.');
  return value as Record<string, unknown>;
}
function label(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(path, '비어 있지 않은 문자열이 필요합니다.');
  return value;
}
function array(value: unknown, path: string, nonempty = true): unknown[] {
  if (!Array.isArray(value) || (nonempty && !value.length)) fail(path, nonempty ? '한 항목 이상의 배열이 필요합니다.' : '배열이 필요합니다.');
  return value;
}

export function parseDiagram(source: string): Diagram {
  const doc = parseDocument(source, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors[0].message);
  visit(doc, { Alias() { fail('YAML', '별칭은 지원하지 않습니다. 내용을 직접 작성하세요.'); } });
  const raw: unknown = doc.toJS();
  const root = object(raw, 'diagram', ['type', 'title', 'columns', 'rows', 'conclusion', 'direction', 'nodes', 'edges']);
  const title = root.title === undefined ? {} : { title: label(root.title, 'title') };
  if (root.type === 'lanes') {
    object(raw, 'lanes', ['type', 'title', 'columns', 'rows', 'conclusion']);
    const columns = array(root.columns, 'columns').map((x, i) => label(x, `columns[${i}]`));
    const rows = array(root.rows, 'rows').map((row, r) => {
      const cells = array(row, `rows[${r}]`);
      if (cells.length !== columns.length) fail(`rows[${r}]`, `열 ${columns.length}개에 맞춰 셀을 작성하세요. 빈 칸은 null입니다.`);
      return cells.map((x, c) => x === null ? null : label(x, `rows[${r}][${c}]`));
    });
    const conclusion = root.conclusion === undefined ? {} : { conclusion: label(root.conclusion, 'conclusion') };
    return { type: 'lanes', ...title, columns, rows, ...conclusion };
  }
  if (root.type !== 'flow') fail('type', 'lanes 또는 flow를 사용하세요.');
  object(raw, 'flow', ['type', 'title', 'direction', 'nodes', 'edges']);
  const direction = root.direction ?? 'down';
  if (direction !== 'down' && direction !== 'right') fail('direction', 'down 또는 right를 사용하세요.');
  const ids = new Set<string>();
  const nodes = array(root.nodes, 'nodes').map((value, i) => {
    const node = object(value, `nodes[${i}]`, ['id', 'label']);
    const id = label(node.id, `nodes[${i}].id`);
    if (ids.has(id)) fail(`nodes[${i}].id`, `중복 ID: ${id}`);
    ids.add(id);
    return { id, label: label(node.label, `nodes[${i}].label`) };
  });
  const pairs = new Set<string>();
  const edges = array(root.edges, 'edges', false).map((value, i) => {
    const edge = object(value, `edges[${i}]`, ['from', 'to']);
    const from = label(edge.from, `edges[${i}].from`);
    const to = label(edge.to, `edges[${i}].to`);
    if (!ids.has(from) || !ids.has(to)) fail(`edges[${i}]`, '존재하지 않는 노드를 참조합니다.');
    if (from === to) fail(`edges[${i}]`, '자기 연결은 지원하지 않습니다.');
    const key = JSON.stringify([from, to]);
    if (pairs.has(key)) fail(`edges[${i}]`, '중복 연결입니다.');
    pairs.add(key);
    return { from, to };
  });
  const degrees = new Map(nodes.map(n => [n.id, 0]));
  const next = new Map(nodes.map(n => [n.id, [] as string[]]));
  for (const edge of edges) {
    degrees.set(edge.to, degrees.get(edge.to)! + 1);
    next.get(edge.from)!.push(edge.to);
  }
  const queue = nodes.filter(n => degrees.get(n.id) === 0).map(n => n.id);
  for (let i = 0; i < queue.length; i++) for (const id of next.get(queue[i])!) {
    degrees.set(id, degrees.get(id)! - 1);
    if (degrees.get(id) === 0) queue.push(id);
  }
  if (queue.length !== nodes.length) fail('edges', '순환 연결은 첫 버전에서 지원하지 않습니다.');
  return { type: 'flow', ...title, direction, nodes, edges };
}
