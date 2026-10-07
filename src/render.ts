import { parseDiagram, type Diagram, type FlowDiagram, type LanesDiagram } from './model';
import { FONT, FONT_SIZE, LINE_HEIGHT, PAD_X, PAD_Y, BOX_WIDTH, wrapText, measureTextWidth } from './text';
import type { ElkNode, ELK } from 'elkjs/lib/elk-api';

const NS = 'http://www.w3.org/2000/svg';
const MARGIN = 32;
const INK = '#253442';
const BORDER = '#d7dfe4';
let elkPromise: Promise<ELK> | undefined;

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}
function textElement(lines: string[], x: number, y: number, weight = 400, size = FONT_SIZE, color = INK) {
  const text = svgElement('text', { x, y, fill: color, 'font-family': FONT, 'font-size': size, 'font-weight': weight, 'xml:space': 'preserve' });
  lines.forEach((line, i) => {
    const span = svgElement('tspan', { x, y: y + i * LINE_HEIGHT });
    span.textContent = line;
    text.append(span);
  });
  return text;
}
function box(x: number, y: number, width: number, height: number, lines: string[], fill = '#ffffff', weight = 400, radius = 0) {
  const group = svgElement('g', { 'data-box': '' });
  group.append(svgElement('rect', { x, y, width, height, rx: radius, fill, stroke: BORDER, 'stroke-width': 1 }));
  if (lines.length) group.append(textElement(lines, x + PAD_X, y + (height - lines.length * LINE_HEIGHT) / 2 + 16, weight));
  return group;
}
function arrow(points: { x: number; y: number }[], marker: string, attrs: Record<string, string> = {}) {
  return svgElement('path', { d: points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '), fill: 'none', stroke: '#647b82', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'marker-end': `url(#${marker})`, ...attrs });
}
function startSvg(diagram: Diagram) {
  const svg = svgElement('svg', { role: 'img', 'aria-label': diagram.title ?? (diagram.type === 'lanes' ? '열별 진행도' : '흐름도'), 'data-diagram': diagram.type });
  const markerId = `arrow-${crypto.randomUUID()}`;
  const title = svgElement('title');
  title.textContent = diagram.title ?? (diagram.type === 'lanes' ? '열별 진행도' : '흐름도');
  const defs = svgElement('defs');
  const marker = svgElement('marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
  marker.append(svgElement('path', { d: 'M 1 1 L 9 5 L 1 9 Z', fill: '#647b82' }));
  defs.append(marker);
  svg.append(title, defs);
  return { svg, markerId };
}
function addTitle(svg: SVGSVGElement, title: string | undefined, width: number): number {
  if (!title) return MARGIN;
  const lines = wrapText(title, width, 600, 17);
  svg.append(textElement(lines, MARGIN, MARGIN + 17, 600, 17));
  return MARGIN + lines.length * LINE_HEIGHT + 24;
}
function finish(svg: SVGSVGElement, width: number, height: number) {
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  // A self-contained white background also makes standalone exports readable.
  svg.insertBefore(svgElement('rect', { width, height, fill: '#ffffff', rx: 12 }), svg.firstChild);
  return svg;
}
function renderLanes(diagram: LanesDiagram): SVGSVGElement {
  const { svg, markerId } = startSvg(diagram);
  const widths = diagram.columns.map(column => (typeof column === 'string' ? undefined : column.width) ?? diagram.defaults?.width ?? BOX_WIDTH);
  const offsets: number[] = [];
  let width = 0;
  for (const columnWidth of widths) { offsets.push(width); width += columnWidth; }
  let y = addTitle(svg, diagram.title, width);
  const headers = diagram.columns.map((column, i) => wrapText(typeof column === 'string' ? column : column.label, widths[i] - PAD_X * 2, 600));
  const headerHeight = Math.max(...headers.map(lines => lines.length)) * LINE_HEIGHT + PAD_Y * 2;
  headers.forEach((lines, col) => {
    const header = box(MARGIN + offsets[col], y, widths[col], headerHeight, lines, col % 2 ? '#edf1f8' : '#eaf3f0', 600);
    svg.append(header);
  });
  y += headerHeight;
  diagram.rows.forEach((row, index) => {
    const wrapped = row.map((label, col) => label === null ? [] : wrapText(label, widths[col] - PAD_X * 2));
    const rowHeight = Math.max(diagram.defaults?.minHeight ?? 0, Math.max(1, ...wrapped.map(lines => lines.length)) * LINE_HEIGHT + PAD_Y * 2);
    wrapped.forEach((lines, col) => {
      const cell = box(MARGIN + offsets[col], y, widths[col], rowHeight, lines, row[col] === null ? '#f8fafb' : '#ffffff');
      cell.setAttribute('data-cell', '');
      cell.setAttribute('data-row', String(index));
      svg.append(cell);
    });
    y += rowHeight;
  });
  if (diagram.conclusion) {
    svg.append(arrow([{ x: MARGIN + width / 2, y: y + 1 }, { x: MARGIN + width / 2, y: y + 39 }], markerId));
    y += 44;
    const lines = wrapText(diagram.conclusion, width - PAD_X * 2, 500);
    const height = lines.length * LINE_HEIGHT + PAD_Y * 2;
    svg.append(box(MARGIN, y, width, height, lines, '#fff5ea', 500, 8));
    y += height;
  }
  return finish(svg, width + MARGIN * 2, y + MARGIN);
}
async function renderFlow(diagram: FlowDiagram): Promise<SVGSVGElement> {
  const { svg, markerId } = startSvg(diagram);
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK());
  const elk = await elkPromise;
  const widths = diagram.nodes.map(n => n.width ?? diagram.defaults?.width ?? BOX_WIDTH);
  const labels = diagram.nodes.map((n, i) => wrapText(n.label, widths[i] - PAD_X * 2));
  const edgeLabels = diagram.edges.map(edge => {
    if (edge.label === undefined) return undefined;
    const lines = wrapText(edge.label, 240);
    return { lines, width: Math.ceil(Math.max(...lines.map(line => measureTextWidth(line)))) + 8, height: lines.length * LINE_HEIGHT + 8 };
  });
  // Internal IDs avoid collisions with graph IDs or special user-provided strings.
  const ids = new Map(diagram.nodes.map((node, i) => [node.id, `n${i}`]));
  const graph: ElkNode = await elk.layout({
    id: 'root',
    layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': diagram.direction === 'down' ? 'DOWN' : 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL', 'elk.spacing.edgeLabel': '8', 'elk.spacing.nodeNode': '32', 'elk.layered.spacing.nodeNodeBetweenLayers': '54', 'elk.padding': '[top=0,left=0,bottom=0,right=0]' },
    children: diagram.nodes.map((node, i) => ({ id: `n${i}`, width: widths[i], height: Math.max(node.minHeight ?? diagram.defaults?.minHeight ?? 0, labels[i].length * LINE_HEIGHT + PAD_Y * 2) })),
    edges: diagram.edges.map((edge, i) => ({
      id: `e${i}`, sources: [ids.get(edge.from)!], targets: [ids.get(edge.to)!],
      ...(edgeLabels[i] ? { labels: [{ id: `l${i}`, text: edge.label, width: edgeLabels[i].width, height: edgeLabels[i].height, layoutOptions: { 'elk.edgeLabels.placement': 'CENTER', 'elk.edgeLabels.inline': 'false' } }] } : {}),
    })),
  });
  const width = graph.width!;
  const top = addTitle(svg, diagram.title, width);
  for (const edge of graph.edges ?? []) for (const section of edge.sections ?? []) {
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(p => ({ x: p.x + MARGIN, y: p.y + top }));
    svg.append(arrow(points, markerId, { 'data-edge': edge.id }));
  }
  graph.children!.forEach((node, i) => {
    const group = box(node.x! + MARGIN, node.y! + top, node.width!, node.height!, labels[i], '#ffffff', 400, 8);
    group.setAttribute('data-node', diagram.nodes[i].id);
    svg.append(group);
  });
  for (const edge of graph.edges ?? []) for (const label of edge.labels ?? []) {
    const measured = edgeLabels[Number(edge.id.slice(1))]!;
    const x = label.x! + MARGIN, y = label.y! + top;
    const group = svgElement('g', { 'data-edge-label': edge.id, 'data-box': '' });
    group.append(svgElement('rect', { x, y, width: measured.width, height: measured.height, fill: '#ffffff', rx: 3 }));
    group.append(textElement(measured.lines, x + 4, y + 20, 400, FONT_SIZE, '#526d73'));
    svg.append(group);
  }
  return finish(svg, width + MARGIN * 2, graph.height! + top + MARGIN);
}

export async function renderDiagram(source: string): Promise<SVGSVGElement> {
  const diagram = parseDiagram(source);
  await document.fonts.load(`${FONT_SIZE}px ${FONT}`);
  await document.fonts.ready;
  return diagram.type === 'lanes' ? renderLanes(diagram) : renderFlow(diagram);
}
