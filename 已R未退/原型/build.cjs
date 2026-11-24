const fs = require('node:fs');
const path = require('node:path');
const { buildDocs } = require('./product-docs/build.cjs');

function readSource(file) {
  return fs.readFileSync(path.join(__dirname, 'src', file), 'utf8');
}

const xlsx = '/* SheetJS CE 0.20.3 license:\n' +
  readSource('vendor/LICENSE-SheetJS.txt') + '\n*/\n' +
  readSource('vendor/xlsx.full.min.js');

const parts = [
  ['/*STYLE*/', readSource('style.css')],
  ['/*XLSX*/', xlsx.replace(/<\/script/gi, '<\\/script')],
  ['/*MODEL*/', readSource('model.js')],
  ['/*TRIGGER*/', readSource('trigger.js')],
  ['/*EXCEL*/', readSource('excel.js')],
  ['/*APP*/', readSource('app.js')]
];

let html = readSource('shell.html');
for (const [marker, content] of parts) {
  if (!html.includes(marker)) throw new Error('页面模板缺少标记 ' + marker);
  html = html.replace(marker, () => content);
}

const outputDir = path.join(__dirname, 'dist');
buildDocs();
fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
console.log('已生成原型、产品文档和流程图 PDF。');
