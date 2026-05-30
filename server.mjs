import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);
const assemblyAiBaseUrl = process.env.ASSEMBLYAI_BASE_URL || 'https://api.assemblyai.com/v2';
const pollIntervalMs = Number(process.env.ASSEMBLYAI_POLL_INTERVAL_MS || 3000);
const maxPolls = Number(process.env.ASSEMBLYAI_MAX_POLLS || 40);

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
  ['.vtt', 'text/vtt; charset=utf-8'],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isValidRemoteMediaUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function readJsonBody(request) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 32_000) {
      throw new Error('请求体过大');
    }
  }

  return body ? JSON.parse(body) : {};
}

function formatVttTimestamp(milliseconds) {
  const totalMilliseconds = Math.max(0, Math.round(milliseconds || 0));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const millis = totalMilliseconds % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function transcriptToVtt(transcript) {
  const words = Array.isArray(transcript.words) ? transcript.words : [];
  if (!words.length) {
    return `WEBVTT\n\n00:00:00.000 --> 00:00:04.000\n${transcript.text || ''}`.trimEnd();
  }

  const cues = [];
  let current = [];

  words.forEach((word) => {
    current.push(word);
    const text = word.text || '';
    const duration = (word.end || 0) - (current[0]?.start || 0);
    const shouldBreak = /[。！？.!?]$/.test(text) || current.length >= 14 || duration >= 6500;

    if (shouldBreak) {
      cues.push(current);
      current = [];
    }
  });

  if (current.length) {
    cues.push(current);
  }

  const body = cues.map((cue) => {
    const start = cue[0]?.start || 0;
    const end = cue.at(-1)?.end || start + 4000;
    const text = cue.map((word) => word.text).join(' ').replace(/([\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])/g, '$1').replace(/\s+/g, ' ').trim();
    return `${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}\n${text}`;
  }).join('\n\n');

  return `WEBVTT\n\n${body}`;
}

async function callAssemblyAi(path, options) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      data: { error: '服务器未设置 ASSEMBLYAI_API_KEY，无法调用 AssemblyAI。' },
    };
  }

  const response = await fetch(`${assemblyAiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function handleTranscription(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: '仅支持 POST /api/transcribe' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const audioUrl = String(body.audioUrl || '').trim();
    const languageCode = String(body.languageCode || 'ja').trim() || 'ja';

    if (!isValidRemoteMediaUrl(audioUrl)) {
      sendJson(response, 400, { error: '请提供可公网访问的 http(s) 音频或视频文件 URL。YouTube 页面链接不是可转写的媒体直链。' });
      return;
    }

    const submitted = await callAssemblyAi('/transcript', {
      method: 'POST',
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: languageCode,
        punctuate: true,
        format_text: true,
      }),
    });

    if (!submitted.ok) {
      sendJson(response, submitted.status, { error: submitted.data.error || 'AssemblyAI 创建转写任务失败。' });
      return;
    }

    let transcript = submitted.data;
    for (let attempt = 0; attempt < maxPolls; attempt += 1) {
      if (['completed', 'error'].includes(transcript.status)) break;
      await sleep(pollIntervalMs);
      const polled = await callAssemblyAi(`/transcript/${transcript.id}`, { method: 'GET' });
      if (!polled.ok) {
        sendJson(response, polled.status, { error: polled.data.error || 'AssemblyAI 查询转写任务失败。' });
        return;
      }
      transcript = polled.data;
    }

    if (transcript.status !== 'completed') {
      sendJson(response, 202, {
        id: transcript.id,
        status: transcript.status,
        error: transcript.error || '转写仍在处理中，请稍后重试。',
      });
      return;
    }

    sendJson(response, 200, {
      id: transcript.id,
      status: transcript.status,
      text: transcript.text || '',
      vtt: transcriptToVtt(transcript),
      confidence: transcript.confidence ?? null,
      languageCode: transcript.language_code || languageCode,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || '转写请求处理失败。' });
  }
}

function resolveRequestPath(url) {
  const { pathname } = new URL(url, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^[/\\]+/, '');
  const candidate = resolve(join(root, normalizedPath || 'index.html'));

  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return join(candidate, 'index.html');
  }

  return candidate;
}

export function createAppServer() {
  return createServer(async (request, response) => {
    const { pathname } = new URL(request.url || '/', `http://localhost:${port}`);
    if (pathname === '/api/transcribe') {
      await handleTranscription(request, response);
      return;
    }

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
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`日语视频学习器已启动：http://localhost:${port}`);
    console.log('按 Ctrl+C 停止服务器。');
  });
}
