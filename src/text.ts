export const FONT = '"Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
export const FONT_SIZE = 15;
export const LINE_HEIGHT = 22;
export const PAD_X = 20;
export const PAD_Y = 16;
export const BOX_WIDTH = 280;

let context: CanvasRenderingContext2D;
export function wrapText(text: string, width: number, weight = 400, size = FONT_SIZE): string[] {
  context ??= document.createElement('canvas').getContext('2d')!;
  context.font = `${weight} ${size}px ${FONT}`;
  const graphemes = new Intl.Segmenter('ko', { granularity: 'grapheme' });
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    // Word boundaries keep English words together; long tokens split by grapheme.
    const tokens = paragraph.match(/\s+|[^\s]+/gu) ?? [];
    for (const token of tokens) {
      if (context.measureText(line + token).width <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      const trimmed = token.trimStart();
      for (const { segment } of graphemes.segment(trimmed)) {
        if (line && context.measureText(line + segment).width > width) { lines.push(line); line = ''; }
        line += segment;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
