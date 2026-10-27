const { ipcMain, shell } = require('electron');
const path = require('path');
const { readBook } = require('./bookReader');
const booksDirectory = path.join(__dirname, '../books');
function bookPath(fileName) {
    if (typeof fileName !== 'string' || path.basename(fileName) !== fileName || /[\\/]/.test(fileName)) {
        throw new Error('书籍文件名无效');
    }
    return path.join(booksDirectory, fileName);
}
ipcMain.handle('read-file', async (event, fileName, start = 0, length) => {
    const book = await readBook(bookPath(fileName));
    const offset = Math.max(0, Number(start) || 0);
    return book.content.slice(offset, length === undefined ? undefined : offset + Math.max(0, Number(length) || 0));
});
ipcMain.handle('read-file-total-words', async (event, fileName) => (await readBook(bookPath(fileName))).content.length);
ipcMain.handle('get-book-info', async (event, fileName) => {
    const book = await readBook(bookPath(fileName));
    return { title: book.title || fileName, total: book.content.length, chapters: book.chapters };
});
ipcMain.handle('open-books-folder', () => shell.openPath(booksDirectory));
