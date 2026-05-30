import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);

function resolveRequestPath(url) {
  const { pathname } = new URL(url, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^[/\\]+/, '');
  const candidate = resolve(join(root, normalizedPath || 'index.html'));

  if (!candidate.startsWith(root)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return join(candidate, 'index.html');
  }

  return candidate;
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('未找到页面');
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`日语视频学习器已启动：http://localhost:${port}`);
  console.log('按 Ctrl+C 停止服务器。');
});
