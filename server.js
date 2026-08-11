const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 7100;
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const cleanUrl = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  let f = path.join(process.cwd(), cleanUrl === '/' ? 'index.html' : cleanUrl);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  const ext = path.extname(f);
  fs.readFile(f, (e, d) => {
    if (e) {
      res.writeHead(404);
      res.end('404');
    } else {
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(d);
    }
  });
}).listen(PORT, () => console.log(`Server running at http://localhost:${PORT}/`));
