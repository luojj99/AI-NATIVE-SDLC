const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Marked } = require('./vendor/marked.cjs');

const defaultProject = path.resolve(__dirname, '../..');
const ruleSource = '已R未退业务规则.md';
const recipe = 'all-pages-crop-border10-v1';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const readText = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

function writeChanged(file, text) {
  if (fs.existsSync(file) && readText(file) === text) return;
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, text, 'utf8');
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function drawioCommand() {
  if (process.env.DRAWIO_BIN) return process.env.DRAWIO_BIN;
  if (process.platform === 'darwin') return '/Applications/draw.io.app/Contents/MacOS/draw.io';
  if (process.platform !== 'win32') return 'drawio';
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:/Program Files', 'draw.io/draw.io.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs/draw.io/draw.io.exe')
  ];
  return candidates.find(file => fs.existsSync(file)) || 'draw.io.exe';
}

function exportPdf(source, target, expectedHash) {
  const temporary = path.join(path.dirname(target), '.export-' + crypto.randomUUID() + '.pdf');
  try {
    const args = ['--disable-gpu', '--disable-update', '--export', '--format', 'pdf',
      '--all-pages', '--crop', '--embed-diagram', '--border', '10', '--output', temporary, source];
    const result = spawnSync(drawioCommand(), args, { encoding: 'utf8', windowsHide: true, timeout: 120000 });
    if (result.error || result.status !== 0 || !fs.existsSync(temporary)) {
      const reason = result.error?.message || result.stderr?.trim() || '退出码 ' + result.status;
      throw new Error('不能导出 ' + path.basename(source) + '。' + reason);
    }
    const pdf = fs.readFileSync(temporary);
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || !pdf.subarray(-1024).includes('%%EOF')) {
      throw new Error('draw.io 的输出不是完整 PDF。');
    }
    if (digest(readText(source)) !== expectedHash) throw new Error('导出期间原图已修改，请重新生成。');
    fs.renameSync(temporary, target);
    return digest(pdf);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function rulePage(markdown) {
  const headings = [];
  const parser = new Marked({ gfm: true, renderer: {
    heading({ tokens, depth, text }) {
      const id = 'section-' + (headings.length + 1);
      headings.push({ id, depth, text });
      return '<h' + depth + ' id="' + id + '">' + this.parser.parseInline(tokens) + '</h' + depth + '>\n';
    },
    html({ text }) {
      return /^<br\s*\/?\s*>$/i.test(text) ? '<br>' : escape(text);
    }
  } });
  const content = parser.parse(markdown).replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>');
  const contents = headings.slice(1).map(h => '<a href="#' + h.id + '">' + escape(h.text) + '</a>').join('');
  return '<header><a data-doc-link href="index.html">← 产品文档</a></header><main class="reader">' +
    '<nav aria-label="规则目录"><strong>规则目录</strong>' + contents + '</nav><article>' + content + '</article></main>';
}

function buildDocs(project = defaultProject, { check = false } = {}) {
  const output = path.join(project, '原型', 'dist', 'docs');
  const cachePath = path.join(output, '.drawio.json');
  const previous = fs.existsSync(cachePath) ? JSON.parse(readText(cachePath)) : {};
  const diagrams = fs.readdirSync(project, { withFileTypes: true })
    .filter(entry => entry.isFile() && !entry.name.startsWith('.') && !entry.name.startsWith('~') && /\.drawio$/i.test(entry.name))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const cache = Object.create(null);
  const cards = [];
  if (!check) fs.mkdirSync(output, { recursive: true });

  for (const name of diagrams) {
    const source = path.join(project, name);
    const title = path.parse(name).name;
    const target = path.join(output, title + '.pdf');
    const xml = readText(source);
    const sourceHash = digest(xml);
    const old = previous[name];
    const current = old?.recipe === recipe && old.source === sourceHash &&
      fs.existsSync(target) && digest(fs.readFileSync(target)) === old.pdf;
    if (!current && check) return false;
    const pdfHash = current ? old.pdf : exportPdf(source, target, sourceHash);
    cache[name] = { recipe, source: sourceHash, pdf: pdfHash };
    const href = encodeURIComponent(title + '.pdf');
    const pageNames = Array.from(xml.matchAll(/<diagram\s[^>]*?\bname\s*=\s*(["'])(.*?)\1/gs), m => m[2]);
    // Page names come from XML attributes. Decode common entities before escaping for HTML.
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    const pages = pageNames.length > 1 ? '<ol class="pages">' + pageNames.map((label, i) => {
      const text = label.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => entities[entity]);
      return '<li><a data-doc-link href="' + href + '#page=' + (i + 1) + '">' + escape(text) + '</a></li>';
    }).join('') + '</ol>' : '';
    cards.push('<section class="card"><div class="card-row"><div><small>流程图 · PDF</small><h2>' + escape(title) + '</h2></div>' +
      '<a class="open" data-doc-link href="' + href + '">查看 PDF</a></div>' + pages + '</section>');
  }

  const removed = Object.keys(previous).filter(name => !Object.hasOwn(cache, name));
  if (check) return removed.length === 0;
  const template = readText(path.join(__dirname, 'page.html'));
  const page = (title, body) => template.replace('<!--TITLE-->', () => escape(title)).replace('<!--BODY-->', () => body);
  const markdown = readText(path.join(project, ruleSource));
  const rules = page('已R未退业务规则', rulePage(markdown));
  cards.push('<section class="card"><div class="card-row"><div><small>业务规则</small><h2>已R未退业务规则</h2></div>' +
    '<a class="open" data-doc-link href="rules.html">阅读正文</a></div>' +
    '<p>首次触发、来账完结、状态流转和 Excel 批量处理。</p></section>');
  const catalog = '<main class="catalog"><header><span>退票管理</span><span class="slash">/</span>已R未退</header>' +
    '<h1>产品文档</h1><div class="cards">' + cards.join('') + '</div></main>';
  writeChanged(path.join(output, 'rules.html'), rules);
  writeChanged(path.join(output, 'index.html'), page('产品文档 · 已R未退', catalog));
  for (const name of removed) {
    if (name === path.basename(name) && /\.drawio$/i.test(name)) {
      fs.rmSync(path.join(output, path.parse(name).name + '.pdf'), { force: true });
    }
  }
  writeChanged(cachePath, JSON.stringify(cache, null, 2) + '\n');
  return true;
}

module.exports = { buildDocs, defaultProject, ruleSource };
if (require.main === module) {
  const current = buildDocs(defaultProject, { check: process.argv.includes('--check') });
  if (!current) { console.error('流程图 PDF 需要更新。'); process.exitCode = 1; }
}
