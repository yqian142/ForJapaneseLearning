import assert from 'node:assert/strict';

const createdNodes = [];
global.document = {
  createDocumentFragment() {
    return {
      children: [],
      append(...nodes) {
        this.children.push(...nodes);
      },
    };
  },
  createTextNode(text) {
    return { nodeType: 'text', textContent: text };
  },
  createElement(tagName) {
    const node = {
      tagName,
      children: [],
      textContent: '',
      append(...nodes) {
        this.children.push(...nodes);
      },
    };
    createdNodes.push(node);
    return node;
  },
  querySelector() {
    return null;
  },
};

const { extractYouTubeId, parseSubtitles, secondsFromTimestamp, addFurigana } = await import('../src/app.js');

assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=abc123XYZ_0'), 'abc123XYZ_0');
assert.equal(extractYouTubeId('https://youtu.be/abc123XYZ_0?t=10'), 'abc123XYZ_0');
assert.equal(extractYouTubeId('https://www.youtube.com/shorts/abc123XYZ_0'), 'abc123XYZ_0');
assert.equal(extractYouTubeId('https://example.com/watch?v=abc'), '');

assert.equal(secondsFromTimestamp('01:02:03.500'), 3723.5);
assert.equal(secondsFromTimestamp('02:03,250'), 123.25);

const parsed = parseSubtitles(`1
00:00:01,000 --> 00:00:03,000
日本語を勉強します。

2
00:00:03.000 --> 00:00:05.000
動画を見ます。`);
assert.equal(parsed.length, 2);
assert.deepEqual(parsed.map((line) => line.text), ['日本語を勉強します。', '動画を見ます。']);
assert.equal(parsed[0].start, 1);
assert.equal(parsed[1].end, 5);

const plain = parseSubtitles('日本語です。\n新しい単語です。');
assert.equal(plain.length, 2);
assert.equal(plain[1].start, 4);

createdNodes.length = 0;
const fragment = addFurigana('日本語の勉強');
assert.ok(fragment.children.length >= 2);
assert.ok(createdNodes.some((node) => node.tagName === 'ruby' && node.textContent === '日本語'));
assert.ok(createdNodes.some((node) => node.tagName === 'rt' && node.textContent === 'にほんご'));
assert.ok(createdNodes.some((node) => node.tagName === 'ruby' && node.textContent === '勉強'));

console.log('All tests passed');
