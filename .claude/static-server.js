// Petit serveur statique : sert index.html, styles.css, app.js et le dossier backgrounds/
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((q, s) => {
  const urlPath = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root)) { s.statusCode = 403; return s.end('forbidden'); }
  fs.readFile(file, (e, d) => {
    if (e) { s.statusCode = 404; return s.end('not found'); }
    s.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    s.end(d);
  });
}).listen(8080, () => console.log('serving on 8080'));
