const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { readBook, isSupportedBook } = require('../src/common/bookReader');
const fixture = name => path.join(__dirname, 'fixtures', name);
test('EPUB2 follows spine order, decodes text and exposes chapter offsets', async () => {
    const book = await readBook(fixture('sample.epub'));
    assert.equal(book.title, '离线章节测试');
    assert.ok(book.content.indexOf('第一章') < book.content.indexOf('第二章'));
    assert.ok(book.content.includes('第一章 & 离线阅读'));
    assert.ok(!book.content.includes('不应执行或显示'));
    assert.ok(!book.content.includes('不应作为正文'));
    assert.deepEqual(book.chapters.map(c => c.title), ['第一章 初见', '第二章 重逢', '第二节']);
    assert.ok(book.content.slice(book.chapters[1].start).startsWith('第二章 重逢'));
    assert.ok(book.content.slice(book.chapters[2].start).startsWith('第二节'));
    assert.equal(await readBook(fixture('sample.epub')), book);
});
test('EPUB3 uses navigation labels and preserves chapter order', async () => {
    const book = await readBook(fixture('epub3.epub'));
    assert.deepEqual(book.chapters.slice(0, 2).map(c => c.title), ['EPUB3 第一章', 'EPUB3 第二章']);
});
test('DRM-encrypted chapters report a readable error', async () => {
    await assert.rejects(readBook(fixture('encrypted.epub')), /DRM/);
});
test('TXT remains readable, detects chapters and invalidates cached changes', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fish-book-'));
    const file = path.join(directory, 'book.TXT');
    try {
        await fs.writeFile(file, '前言\n第一章 开始\n本地正文\n第二章 继续\n后续正文');
        const book = await readBook(file);
        assert.deepEqual(book.chapters.map(c => c.title), ['开头', '第一章 开始', '第二章 继续']);
        assert.ok(book.content.slice(book.chapters[2].start).startsWith('第二章'));
        await fs.writeFile(file, '替换后的书籍内容');
        assert.equal((await readBook(file)).content, '替换后的书籍内容');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('format discovery is case insensitive and excludes unsupported files', () => {
    assert.ok(isSupportedBook('book.EPUB')); assert.ok(isSupportedBook('book.TXT'));
    assert.ok(!isSupportedBook('book.pdf')); assert.ok(!isSupportedBook('book.epub.exe'));
});
