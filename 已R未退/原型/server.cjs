const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PROTOTYPE_PORT || 4178);
const dist = path.join(__dirname, 'dist');

http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  let file = path.join(dist, 'index.html');
  if (pathname.startsWith('/docs/')) {
    const name = pathname.slice('/docs/'.length) || 'index.html';
    if (!/^[^./\\\x00][^/\\\x00]*\.(?:pdf|html)$/iu.test(name)) { response.writeHead(404).end(); return; }
    file = path.join(dist, 'docs', name);
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
    const type = file.endsWith('.pdf') ? 'application/pdf' : 'text/html; charset=utf-8';
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
  });
}).listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
