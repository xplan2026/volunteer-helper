const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json; charset=utf-8',
};

http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const ROOT = path.join(__dirname, '..');
  let filePath = path.join(ROOT, decodeURIComponent(parsed.pathname));
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch(e) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not found');
  }
}).listen(3456, () => console.log('http://localhost:3456/pages/preview.html'));
