const demoUrl = 'https://www.youtube.com/watch?v=FtutLA63Cp8';

const demoSubtitles = `WEBVTT

00:00:00.000 --> 00:00:04.000
日本語の勉強を始めましょう。

00:00:04.000 --> 00:00:08.000
今日は新しい単語と文法を確認します。

00:00:08.000 --> 00:00:12.000
動画を見ながら、正しい字幕を読んでください。

00:00:12.000 --> 00:00:16.000
必要なら字幕を編集して、自分だけの教材を作れます。`;

const readingDictionary = new Map([
  ['日本語', 'にほんご'],
  ['勉強', 'べんきょう'],
  ['始', 'はじ'],
  ['今日', 'きょう'],
  ['新', 'あたら'],
  ['単語', 'たんご'],
  ['文法', 'ぶんぽう'],
  ['確認', 'かくにん'],
  ['動画', 'どうが'],
  ['見', 'み'],
  ['正', 'ただ'],
  ['字幕', 'じまく'],
  ['読', 'よ'],
  ['必要', 'ひつよう'],
  ['編集', 'へんしゅう'],
  ['自分', 'じぶん'],
  ['教材', 'きょうざい'],
  ['作', 'つく'],
  ['学習', 'がくしゅう'],
  ['漢字', 'かんじ'],
  ['読解', 'どっかい'],
  ['練習', 'れんしゅう'],
  ['聞', 'き'],
]);

const kanjiPattern = /[一-龯々〆ヵヶ]+/gu;
const youtubeIdPattern = /^[A-Za-z0-9_-]{6,}$/;

export function extractYouTubeId(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return normalizeYouTubeId(parsed.pathname.split('/').filter(Boolean)[0] || '');
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (parsed.pathname === '/watch') {
        return normalizeYouTubeId(parsed.searchParams.get('v') || '');
      }

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) {
        return normalizeYouTubeId(parts[1] || '');
      }
    }
  } catch {
    return '';
  }

  return '';
}

function normalizeYouTubeId(value) {
  return youtubeIdPattern.test(value) ? value : '';
}

export function secondsFromTimestamp(timestamp) {
  const clean = timestamp.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return Number(clean) || 0;
}

export function parseSubtitles(rawText) {
  const text = rawText.trim();
  if (!text) return [];

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const timedLines = [];

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));

    if (timingIndex >= 0) {
      const [startRaw, endRaw] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0]);
      const content = lines.slice(timingIndex + 1).join(' ');
      if (content) {
        timedLines.push({
          id: `line-${index}`,
          start: secondsFromTimestamp(startRaw),
          end: secondsFromTimestamp(endRaw),
          text: content,
        });
      }
    }
  });

  if (timedLines.length > 0) return timedLines;

  return normalized.split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => ({
    id: `plain-${index}`,
    start: index * 4,
    end: index * 4 + 4,
    text: line,
  }));
}

function splitKnownReading(segment) {
  if (readingDictionary.has(segment)) {
    return [{ text: segment, reading: readingDictionary.get(segment) }];
  }

  const result = [];
  let cursor = 0;

  while (cursor < segment.length) {
    let match = null;
    for (let end = segment.length; end > cursor; end -= 1) {
      const candidate = segment.slice(cursor, end);
      if (readingDictionary.has(candidate)) {
        match = candidate;
        break;
      }
    }

    if (match) {
      result.push({ text: match, reading: readingDictionary.get(match) });
      cursor += match.length;
    } else {
      result.push({ text: segment[cursor], reading: '' });
      cursor += 1;
    }
  }

  return result;
}

export function addFurigana(text) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(kanjiPattern)) {
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    splitKnownReading(match[0]).forEach((part) => {
      if (!part.reading) {
        fragment.append(document.createTextNode(part.text));
        return;
      }

      const ruby = document.createElement('ruby');
      ruby.textContent = part.text;
      const rt = document.createElement('rt');
      rt.textContent = part.reading;
      ruby.append(rt);
      fragment.append(ruby);
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragment.append(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

function renderSubtitleLine(line, active = false) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = `subtitle-item${active ? ' active' : ''}`;
  item.dataset.lineId = line.id;

  const time = document.createElement('span');
  time.className = 'subtitle-time';
  time.textContent = formatTime(line.start);

  const text = document.createElement('span');
  text.className = 'subtitle-text';
  text.append(addFurigana(line.text));

  item.append(time, text);
  return item;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function boot() {
  const youtubeUrl = document.querySelector('#youtubeUrl');
  const videoForm = document.querySelector('#videoForm');
  const videoFrame = document.querySelector('#videoFrame');
  const urlMessage = document.querySelector('#urlMessage');
  const videoStatus = document.querySelector('#videoStatus');
  const subtitleInput = document.querySelector('#subtitleInput');
  const parseButton = document.querySelector('#parseSubtitles');
  const subtitleList = document.querySelector('#subtitleList');
  const currentSubtitle = document.querySelector('#currentSubtitle');
  const nextLine = document.querySelector('#nextLine');
  const loadDemo = document.querySelector('#loadDemo');
  let subtitles = [];
  let activeIndex = 0;

  const loadVideo = (url) => {
    const id = extractYouTubeId(url);
    if (!id) {
      urlMessage.textContent = '无法识别链接，请粘贴有效的 YouTube 地址。';
      urlMessage.classList.add('error');
      videoStatus.textContent = '链接无效';
      return;
    }

    urlMessage.textContent = '视频已加载。若浏览器阻止嵌入播放，可点击播放器中的 YouTube 链接打开。';
    urlMessage.classList.remove('error');
    videoStatus.textContent = '已加载';
    videoFrame.innerHTML = `<iframe title="YouTube 视频播放器" src="https://www.youtube.com/embed/${id}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  };

  const renderActive = () => {
    currentSubtitle.innerHTML = '';
    if (!subtitles.length) {
      currentSubtitle.innerHTML = '<p class="placeholder">导入字幕后，这里会显示带注音的日语文本。</p>';
      subtitleList.innerHTML = '';
      return;
    }

    const active = subtitles[activeIndex];
    const time = document.createElement('span');
    time.className = 'large-time';
    time.textContent = `${formatTime(active.start)} - ${formatTime(active.end)}`;
    const line = document.createElement('p');
    line.append(addFurigana(active.text));
    currentSubtitle.append(time, line);

    subtitleList.innerHTML = '';
    subtitles.forEach((subtitle, index) => {
      const item = renderSubtitleLine(subtitle, index === activeIndex);
      item.addEventListener('click', () => {
        activeIndex = index;
        renderActive();
      });
      subtitleList.append(item);
    });
  };

  videoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    loadVideo(youtubeUrl.value);
  });

  parseButton.addEventListener('click', () => {
    subtitles = parseSubtitles(subtitleInput.value);
    activeIndex = 0;
    renderActive();
  });

  nextLine.addEventListener('click', () => {
    if (!subtitles.length) return;
    activeIndex = (activeIndex + 1) % subtitles.length;
    renderActive();
  });

  loadDemo.addEventListener('click', () => {
    youtubeUrl.value = demoUrl;
    subtitleInput.value = demoSubtitles;
    loadVideo(demoUrl);
    subtitles = parseSubtitles(demoSubtitles);
    activeIndex = 0;
    renderActive();
  });

  subtitleInput.value = demoSubtitles;
  subtitles = parseSubtitles(demoSubtitles);
  renderActive();
}

if (typeof document !== 'undefined' && document.querySelector('#videoForm')) {
  boot();
}
