<template>
    <div>
        <div class="read-board" :style="{ backgroundColor: `${textBgColor}` }">
            <div class="read-toolbar" :style="{ color: textColor }">
                <span class="progress" v-if="theBook">{{ theBook.bookProgress }}%</span>
                <span class="drag-hint">拖动此处移动窗口</span>
                <button class="chapter-menu" @click="selectChapter" title="目录 / 选章节">
                    <i class="el-icon-tickets"></i> 目录
                </button>
                <button class="close" @click="close" title="隐藏阅读窗口"><i class="el-icon-close"></i></button>
            </div>
            <div ref="content" class="content" :style="{ fontSize: fontSize + 'px', letterSpacing: letterSpacing + 'px', color: textColor }"><span>{{ errorMessage || fileContent }}</span></div>
        </div>
    </div>
</template>

<script>
const { ipcRenderer } = window.require('electron');
import { mapState } from 'vuex';
import { getSysConfig, setSysConfig } from '@/estore/estore.js';

export default {
    data() {
        return {
            fileContent: '',
            errorMessage: '',
            bookInfo: {},
            currentBookInfo: {},
            currentBookIndex: null,
            loadingBook: false,
        };
    },
    computed: {
        ...mapState({
            currentBookName: state => state.sys.currentBookName,
            booksInfo: state => state.sys.booksInfo,
            time: state => state.sys.time,
            textColor: state => state.sys.textColor,
            textBgColor: state => state.sys.textBgColor,
            wordsPerPage: state => state.sys.wordsPerPage,
            fontSize: state => state.sys.fontSize,
            letterSpacing: state => state.sys.letterSpacing,
        }),
        theBook() {
            return this.booksInfo[this.currentBookIndex];
        },
    },
    watch: {
        time: async function () { await this.openCurrentBook(); },
        wordsPerPage: async function () { await this.loadFileContent(); },

    },
    methods: {
        close() {
            ipcRenderer.send('window-min');
        },
        async findBookByName(bookName) {
            let booksInfo = await getSysConfig('booksInfo');
            return booksInfo.find(book => book.bookName === bookName);
        },
        async loadFileContent() {
            if (!this.theBook) return;
            const start = this.theBook.start;

            console.log('读取页面信息', start, this.wordsPerPage);

            try {
                const fileContent = await ipcRenderer.invoke(
                    'read-file',
                    this.currentBookName,
                    start,
                    this.wordsPerPage
                );
                if (!fileContent.length) {
                    this.errorMessage = '这本书你已经读完了，针不戳 ~';
                    this.fileContent = '';
                    this.theBook.start = Math.max(0, this.theBook.start - this.wordsPerPage);
                    await setSysConfig('booksInfo', this.booksInfo);
                } else {
                    this.errorMessage = '';
                    this.fileContent = fileContent;
                    await this.$nextTick();
                    if (this.$refs.content) this.$refs.content.scrollTop = 0;
                    console.log(this.theBook);
                    const position =
                        ((this.theBook.start + this.wordsPerPage) * 100) / this.theBook.total;
                    console.log(position);
                    this.theBook.bookProgress =
                        Number(position.toFixed(2)) > 100 ? 100 : Number(position.toFixed(2));
                    await setSysConfig('booksInfo', this.booksInfo);
                }
            } catch (error) {
                console.error(error);
                this.errorMessage = '读取失败：' + error.message;
            }
        },
        findBookIndex(booksInfo, bookName) {
            for (let i = 0; i < booksInfo.length; i++) {
                if (booksInfo[i].bookName === bookName) {
                    console.log(booksInfo[i]);
                    return {
                        index: i,
                        ...booksInfo[i],
                    };
                }
            }
            return -1;
        },
        async selectChapter() {
            try {
                const chapter = await ipcRenderer.invoke('show-chapter-menu', this.currentBookName);
                if (!chapter || !this.theBook) return;
                this.theBook.start = chapter.start;
                await setSysConfig('booksInfo', this.booksInfo);
                await this.loadFileContent();
            } catch (error) { this.errorMessage = '无法打开目录：' + error.message; }
        },
        async openCurrentBook() {
            this.loadingBook = true;
            try {
                const info = this.findBookIndex(this.booksInfo, this.currentBookName);
                if (info === -1) return;
                this.currentBookIndex = info.index;
                this.theBook.total = await ipcRenderer.invoke('read-file-total-words', this.currentBookName);
                await this.loadFileContent();
            } catch (error) {
                this.fileContent = '';
                this.errorMessage = '读取失败：' + error.message;
            } finally { this.loadingBook = false; }
        },
        async turnPage(isNext) {
            if (!this.theBook || this.loadingBook) return;
            const theBook = this.theBook;
            theBook.start = Math.max(
                theBook.start + (isNext ? this.wordsPerPage : -this.wordsPerPage),
                0
            );
            await setSysConfig('booksInfo', this.booksInfo);
            this.loadFileContent();
        },
        init() {
            ipcRenderer.on('next-page', () => {
                // console.log('下一页');
                this.turnPage(true);
            });
            ipcRenderer.on('pre-page', () => {
                // console.log('上一页');
                this.turnPage(false);
            });
            ipcRenderer.on('show-hide-readWin', async () => {
                // console.log('显示/隐藏窗口切换');
                ipcRenderer.send('readWin-toggle');
            });
        },
        async handleBookTotalWords() {
            try {
                const bookTotalWords = await ipcRenderer.invoke(
                    'read-file-total-words',
                    this.currentBookName
                );
                console.log(bookTotalWords);
                this.theBook.total = bookTotalWords;
            } catch (error) {
                console.error(error);
                this.errorMessage = '读取文件时发生错误';
            }
        },
    },
    mounted() {
        this.init();
    },
};
</script>

<style lang="scss">
.read-board {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    .content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 12px 20px 20px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.9;
        -webkit-app-region: no-drag;
        user-select: text;
    }
}
.read-toolbar {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 32px;
    padding: 0 10px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    -webkit-app-region: drag;
    .progress { margin-right: 12px; font-size: 12px; }
    .drag-hint { flex: 1; opacity: 0.5; font-size: 11px; }
    button {
        -webkit-app-region: no-drag;
        color: inherit;
        background: transparent;
        border: 0;
        padding: 5px 8px;
        cursor: pointer;
    }
}
.el-main { margin: 0 !important; padding: 0 !important; }
</style>
