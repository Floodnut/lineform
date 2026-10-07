import MarkdownIt from 'markdown-it';
import { renderDiagram } from './render';
import { downloadSvg } from './export';

export async function renderMarkdown(source: string): Promise<HTMLElement> {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const sources: string[] = [];
  const defaultFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token.info.trim() !== 'diagram') return defaultFence(tokens, index, options, env, self);
    const id = sources.push(token.content) - 1;
    return `<section class="diagram-block" data-block="${id}"></section>`;
  };
  const article = document.createElement('article');
  article.className = 'markdown-document';
  article.innerHTML = md.render(source);
  await Promise.all(sources.map(async (yaml, i) => {
    const block = article.querySelector<HTMLElement>(`[data-block="${i}"]`)!;
    try {
      const svg = await renderDiagram(yaml);
      const scroll = document.createElement('div');
      scroll.className = 'diagram-scroll';
      scroll.append(svg);
      const button = document.createElement('button');
      button.className = 'block-download';
      button.textContent = 'SVG 다운로드';
      button.addEventListener('click', () => downloadSvg(svg, `diagram-${i + 1}.svg`));
      block.append(scroll, button);
    } catch (error) {
      const message = document.createElement('pre');
      message.className = 'error-message';
      message.setAttribute('role', 'alert');
      message.textContent = error instanceof Error ? error.message : String(error);
      block.append(message);
    }
  }));
  return article;
}
