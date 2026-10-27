const fs = require('fs').promises;
const path = require('path');
const yauzl = require('yauzl');
const { parseDocument } = require('htmlparser2');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');
const LIMIT = 128 * 1024 * 1024;
const cache = new Map();
const localName = node => (node.name || '').split(':').pop().toLowerCase();
function elements(node, name) {
    const result = [];
    function walk(n) {
        if (localName(n) === name) result.push(n);
        for (const child of n.children || []) walk(child);
    }
    walk(node);
    return result;
}
function text(node) {
    return node.type === 'text' ? node.data : (node.children || []).map(text).join('');
}
function xml(buffer) {
    let encoding = 'utf-8';
    if (buffer[0] === 0xff && buffer[1] === 0xfe) encoding = 'utf-16le';
    else if (buffer[0] === 0xfe && buffer[1] === 0xff) encoding = 'utf-16be';
    else {
        const match = buffer.toString('ascii', 0, 200).match(/encoding\s*=\s*["']([^"']+)/i);
        if (match) encoding = match[1];
    }
    return parseDocument(iconv.decode(buffer, encoding), { xmlMode: true, decodeEntities: true });
}
function archivePath(base, href) {
    if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) {
        throw new Error('EPUB 包含无效或外部的正文路径');
    }
    const result = path.posix.normalize(path.posix.join(base, decodeURIComponent(href.split('#')[0])));
    if (result.startsWith('../') || result.startsWith('/') || result.includes('\\')) {
        throw new Error('EPUB 正文路径超出书籍范围');
    }
    return result;
}
function extractChapter(document) {
    const root = elements(document, 'body')[0] || document;
    const blocks = new Set(['p', 'div', 'section', 'article', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'tr']);
    let content = '';
    const headings = [];
    const anchors = new Map();
    function newline() { if (content && !content.endsWith('\n')) content += '\n'; }
    function walk(node) {
        const name = localName(node);
        if (['script', 'style', 'noscript', 'svg', 'head'].includes(name) || (node.attribs && 'hidden' in node.attribs)) return;
        if (node.type === 'text') { content += node.data.replace(/\s+/g, ' '); return; }
        if (name === 'br' || blocks.has(name)) newline();
        const start = content.length;
        if (node.attribs && node.attribs.id) anchors.set(node.attribs.id, start);
        if (/^h[1-3]$/.test(name) && text(node).trim()) headings.push({ title: text(node).trim(), start });
        for (const child of node.children || []) walk(child);
        if (blocks.has(name)) newline();
    }
    walk(root);
    const leading = (content.match(/^\s*/) || [''])[0].length;
    for (const heading of headings) heading.start = Math.max(0, heading.start - leading);
    for (const [id, start] of anchors) anchors.set(id, Math.max(0, start - leading));
    return { content: content.slice(leading), headings, anchors };
}
async function parseEpub(buffer) {
    const zip = await new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: false }, (error, value) => error ? reject(error) : resolve(value)));
    let zipError;
    zip.on('error', error => { zipError = error; });
    try {
        const entries = await new Promise((resolve, reject) => {
            const map = new Map();
            zip.once('error', reject);
            zip.on('entry', entry => {
                if (map.size >= 20000) { reject(new Error('EPUB 文件条目过多')); return; }
                map.set(entry.fileName, entry);
                zip.readEntry();
            });
            zip.once('end', () => { zip.removeListener('error', reject); resolve(map); });
            zip.readEntry();
        });
        let totalBytes = 0;
        const read = async name => {
            if (zipError) throw zipError;
            const entry = entries.get(name);
            if (!entry) throw new Error(`EPUB 缺少文件：${name}`);
            if (entry.uncompressedSize > 32 * 1024 * 1024 || (entry.generalPurposeBitFlag & 1)) throw new Error('EPUB 正文过大或已加密');
            totalBytes += entry.uncompressedSize;
            if (totalBytes > LIMIT) throw new Error('EPUB 解压后的正文过大');
            return new Promise((resolve, reject) => {
                zip.openReadStream(entry, (error, stream) => {
                    if (error) return reject(error);
                    const parts = []; let size = 0;
                    stream.on('data', part => {
                        size += part.length;
                        if (size > 32 * 1024 * 1024) stream.destroy(new Error('EPUB 正文过大'));
                        else parts.push(part);
                    });
                    stream.on('error', reject);
                    stream.on('end', () => resolve(Buffer.concat(parts)));
                });
            });
        };
        const container = xml(await read('META-INF/container.xml'));
        const rootfile = elements(container, 'rootfile')[0];
        if (!rootfile) throw new Error('EPUB 缺少书籍目录信息');
        const opfPath = archivePath('', rootfile.attribs['full-path']);
        const opf = xml(await read(opfPath));
        const base = path.posix.dirname(opfPath);
        const items = new Map(elements(opf, 'item').map(item => [item.attribs.id, item.attribs]));
        const spine = elements(opf, 'spine')[0];
        if (!spine) throw new Error('EPUB 缺少阅读顺序');
        const labels = new Map();
        const navigation = new Map();
        const addNavigation = (basePath, href, title) => {
            const file = archivePath(basePath, href);
            const fragment = href.includes('#') ? decodeURIComponent(href.slice(href.indexOf('#') + 1)) : '';
            if (!navigation.has(file)) navigation.set(file, new Map());
            navigation.get(file).set(fragment, title);
            if (!fragment) labels.set(file, title);
        };
        const toc = items.get(spine.attribs.toc);
        if (toc) {
            const ncxPath = archivePath(base, toc.href);
            const ncx = xml(await read(ncxPath));
            for (const point of elements(ncx, 'navpoint')) {
                const link = elements(point, 'content')[0];
                const label = elements(point, 'navlabel')[0];
                if (link && label) addNavigation(path.posix.dirname(ncxPath), link.attribs.src, text(label).trim());
            }
        }
        const nav = [...items.values()].find(item => (item.properties || '').split(/\s+/).includes('nav'));
        if (nav) {
            const navPath = archivePath(base, nav.href);
            const navDoc = xml(await read(navPath));
            const tocNav = elements(navDoc, 'nav').find(n => (n.attribs['epub:type'] || '').split(/\s+/).includes('toc'));
            for (const link of elements(tocNav || navDoc, 'a')) {
                if (link.attribs.href) addNavigation(path.posix.dirname(navPath), link.attribs.href, text(link).trim());
            }
        }
        const encrypted = new Set();
        if (entries.has('META-INF/encryption.xml')) {
            for (const ref of elements(xml(await read('META-INF/encryption.xml')), 'cipherreference')) encrypted.add(archivePath('', ref.attribs.URI));
        }
        let content = '';
        const chapters = [];
        for (const ref of elements(spine, 'itemref')) {
            if (ref.attribs.linear === 'no') continue;
            const item = items.get(ref.attribs.idref);
            if (!item) throw new Error('EPUB 章节引用不存在');
            const chapterPath = archivePath(base, item.href);
            if (encrypted.has(chapterPath)) throw new Error('此 EPUB 正文受 DRM 加密保护，无法读取');
            const chapter = extractChapter(xml(await read(chapterPath)));
            if (!chapter.content.trim()) continue;
            const offset = content.length;
            const positions = new Map();
            for (const heading of chapter.headings) positions.set(heading.start, heading.title);
            for (const [fragment, title] of navigation.get(chapterPath) || []) {
                const start = fragment ? chapter.anchors.get(fragment) : 0;
                if (start !== undefined) positions.set(start, title);
            }
            if (!positions.has(0)) positions.set(0, labels.get(chapterPath) || (chapter.headings[0] && chapter.headings[0].title) || `第 ${chapters.length + 1} 节`);
            for (const [start, title] of [...positions].sort((a, b) => a[0] - b[0])) chapters.push({ title, start: offset + start });
            content += chapter.content + '\n';
        }
        if (!content.trim()) throw new Error('EPUB 中没有可读取的文字正文');
        return { title: text(elements(opf, 'title')[0] || {}).trim(), content, chapters };
    } finally { zip.close(); }
}
function parseTxt(buffer) {
    const encoding = jschardet.detect(buffer).encoding || 'utf-8';
    const content = iconv.decode(buffer, encoding);
    const chapters = [];
    const pattern = /^(?:[ \t]*)(第[零〇一二三四五六七八九十百千万两\d]+[章回卷节部篇][^\r\n]{0,80}|chapter\s+\d+[^\r\n]{0,80})[ \t]*$/gim;
    let match;
    while ((match = pattern.exec(content))) chapters.push({ title: match[1].trim(), start: match.index });
    if (!chapters.length || chapters[0].start > 0) chapters.unshift({ title: '开头', start: 0 });
    return { content, chapters };
}
function isSupportedBook(fileName) { return /\.(txt|epub)$/i.test(fileName); }
async function readBook(filePath) {
    if (!isSupportedBook(filePath)) throw new Error('目前支持 TXT 和 EPUB 格式');
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > LIMIT) throw new Error('书籍文件无效或超过 128 MB');
    const key = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
    const previous = cache.get(filePath);
    if (previous && previous.key === key) return previous.book;
    const buffer = await fs.readFile(filePath);
    const book = path.extname(filePath).toLowerCase() === '.epub' ? await parseEpub(buffer) : parseTxt(buffer);
    // Retain only the active book; pagination never reparses the ZIP archive.
    cache.clear(); cache.set(filePath, { key, book });
    return book;
}
module.exports = { readBook, isSupportedBook };
