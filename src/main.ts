import './styles.css';
import { renderDiagram } from './render';
import { renderMarkdown } from './markdown';
import { downloadSvg } from './export';
import { examples, lanesExample, asMarkdown } from './examples';

const logo = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="3" y="3" width="10" height="9" rx="2" fill="currentColor"/><rect x="19" y="20" width="10" height="9" rx="2" fill="currentColor"/><path d="M8 15v9h8M16 24l-3-3m3 3l-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const downloadIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

document.querySelector('#app')!.innerHTML = `
  <header class="app-header">
    <a class="brand" href="/" aria-label="Lineform 홈"><span class="brand-mark">${logo}</span><span>Lineform</span><span class="version">BETA</span></a>
    <span class="local-badge"><span class="dot"></span>브라우저에서 실행</span>
  </header>
  <main>
    <section class="intro">
      <div><div class="eyebrow">TEXT IN. CLARITY OUT.</div><h1>텍스트를 구조로.</h1><p>내용만 작성하세요. 정렬과 연결은 자동으로.</p></div>
      <div class="intro-note"><span class="mini-diagram" aria-hidden="true">▢ ─→ ▢</span><span>공백 대신 구조로 그리는 다이어그램</span></div>
    </section>
    <section class="workspace" aria-label="다이어그램 편집기">
      <section class="source-panel">
        <div class="panel-header"><h2><span class="panel-icon" aria-hidden="true">⌘</span> 소스</h2><div class="mode-switch" aria-label="입력 형식"><button data-mode="yaml" aria-pressed="true">YAML</button><button data-mode="markdown" aria-pressed="false">Markdown</button></div></div>
        <div class="source-toolbar"><label for="example">예제</label><select id="example" aria-label="예제 선택"><option value="lanes">열별 진행도</option><option value="flow">분기와 합류</option><option value="long">긴 문장과 줄바꿈</option></select><span class="auto-badge">자동 반영</span></div>
        <div class="editor-wrap"><div id="line-numbers" aria-hidden="true"></div><textarea id="source" aria-label="다이어그램 소스" spellcheck="false" wrap="off" autocapitalize="off" autocomplete="off"></textarea></div>
        <div class="source-footer"><span id="line-count"></span><span>UTF-8 <span class="footer-divider">/</span> 한글 지원</span></div>
      </section>
      <section class="preview-panel">
        <div class="panel-header"><h2><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg> 미리보기 <span class="format-label">SVG</span></h2><button id="download" class="download-button" disabled>${downloadIcon} SVG 다운로드</button></div>
        <div id="preview" aria-label="다이어그램 미리보기" aria-busy="true"></div>
        <div class="preview-footer"><span id="status" role="status" aria-live="polite">준비 중…</span><span id="dimensions"></span></div>
      </section>
    </section>
    <details class="guide"><summary><span><span class="guide-icon" aria-hidden="true">?</span> 작성 가이드 <span class="guide-caption">두 가지 다이어그램, 하나의 문법</span></span><span aria-hidden="true">⌄</span></summary><div class="guide-content"><div><h3>열별 진행도 <code>lanes</code></h3><p><code>columns</code>에 열 이름, <code>rows</code>에 단계별 내용을 적으세요. 빈 칸은 <code>null</code>, 하단 결론은 <code>conclusion</code>입니다.</p></div><div><h3>흐름도 <code>flow</code></h3><p><code>nodes</code>에 <code>id</code>와 <code>label</code>을 적고, <code>edges</code>의 <code>from</code>과 <code>to</code>로 연결하세요. 방향은 <code>down</code> 또는 <code>right</code>입니다.</p></div><div><h3>Markdown 안에서</h3><p><code>diagram</code> 코드 블록 안에 같은 YAML을 넣으세요. 일반 문단과 다이어그램을 함께 작성하고, 각 결과를 SVG로 저장할 수 있습니다.</p></div></div></details>
    <footer class="page-footer"><span>Lineform</span><span>텍스트는 가볍게, 구조는 또렷하게.</span></footer>
  </main>`;

const source = document.querySelector<HTMLTextAreaElement>('#source')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const status = document.querySelector<HTMLElement>('#status')!;
const dimensions = document.querySelector<HTMLElement>('#dimensions')!;
const lineNumbers = document.querySelector<HTMLElement>('#line-numbers')!;
const drafts = { yaml: lanesExample, markdown: asMarkdown(lanesExample) };
let mode: keyof typeof drafts = 'yaml';
let revision = 0;
let timer: ReturnType<typeof setTimeout>;

function updateLines() {
  const count = source.value.split('\n').length;
  lineNumbers.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  document.querySelector('#line-count')!.textContent = `${count}줄`;
  lineNumbers.scrollTop = source.scrollTop;
}

async function render(version: number) {
  const input = source.value;
  const selectedMode = mode;
  try {
    const result = selectedMode === 'yaml' ? await renderDiagram(input) : await renderMarkdown(input);
    if (version !== revision) return;
    preview.replaceChildren(result);
    preview.classList.toggle('is-markdown', selectedMode === 'markdown');
    const svgs = preview.querySelectorAll('svg[data-diagram]');
    const errors = preview.querySelectorAll('[role="alert"]').length;
    status.textContent = errors ? `${errors}개 블록 확인 필요` : '렌더링 완료';
    status.dataset.state = errors ? 'error' : 'ready';
    dimensions.textContent = svgs.length === 1 ? `${svgs[0].getAttribute('width')} × ${svgs[0].getAttribute('height')}` : `${svgs.length}개 다이어그램`;
    download.disabled = selectedMode !== 'yaml' || svgs.length !== 1;
  } catch (error) {
    if (version !== revision) return;
    const notice = document.createElement('div');
    notice.className = 'input-error';
    const title = document.createElement('h3');
    title.textContent = '입력을 확인해 주세요';
    const message = document.createElement('pre');
    message.className = 'error-message';
    message.setAttribute('role', 'alert');
    message.textContent = error instanceof Error ? error.message : String(error);
    notice.append(title, message);
    preview.replaceChildren(notice);
    status.textContent = '문법 확인 필요';
    status.dataset.state = 'error';
    dimensions.textContent = '';
    download.disabled = true;
  } finally {
    if (version === revision) preview.setAttribute('aria-busy', 'false');
  }
}

function schedule(immediate = false) {
  clearTimeout(timer);
  const version = ++revision;
  drafts[mode] = source.value;
  updateLines();
  download.disabled = true;
  preview.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
  preview.setAttribute('aria-busy', 'true');
  status.textContent = '렌더링 중…';
  status.dataset.state = 'busy';
  timer = setTimeout(() => void render(version), immediate ? 0 : 180);
}
source.addEventListener('input', () => schedule());
source.addEventListener('scroll', () => { lineNumbers.scrollTop = source.scrollTop; });
source.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  source.setRangeText('  ', source.selectionStart, source.selectionEnd, 'end');
  schedule();
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.addEventListener('click', () => {
  mode = button.dataset.mode as keyof typeof drafts;
  source.value = drafts[mode];
  document.querySelectorAll('[data-mode]').forEach(tab => tab.setAttribute('aria-pressed', String((tab as HTMLElement).dataset.mode === mode)));
  download.hidden = mode === 'markdown';
  schedule(true);
});
document.querySelector<HTMLSelectElement>('#example')!.addEventListener('change', event => {
  const example = examples[(event.target as HTMLSelectElement).value];
  source.value = mode === 'yaml' ? example : asMarkdown(example);
  schedule(true);
});
download.addEventListener('click', () => {
  const svg = preview.querySelector<SVGSVGElement>('svg[data-diagram]');
  if (svg) downloadSvg(svg);
});
source.value = drafts.yaml;
schedule(true);
