<template>
    <div>
        <div class="read-board" :style="{ backgroundColor: `${textBgColor}` }">
            <div
                class="content"
                :style="{ fontSize: fontSize + 'px', letterSpacing: letterSpacing + 'px' }"
            >
                <span :style="{ color: `${textColor}` }">
                    {{ errorMessage }}
                    <!-- {{ booksInfo[currentBookIndex].start }}
                    {{ booksInfo[currentBookIndex].total }} -->
                    {{ fileContent }}
                </span>
            </div>
            <div class="progress" v-if="theBook" :style="{ color: `${textColor}`, opacity: 0.7 }">
                {{ theBook.bookProgress }}%
            </div>
            <div class="chapter-menu" @click="selectChapter" :style="{ color: textColor }" title="目录 / 选章节">
                <i class="el-icon-tickets"></i>
            </div>
            <div class="close" @click="close" :style="{ color: `${textColor}`, opacity: 0.7 }">
                <i class="el-icon-close"></i>
            </div>
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
    width: calc(100vw - 20px);
    height: 100vh;
    color: #fff;
    margin: 0;
    line-height: 40px;
    padding: 0 10px;
    overflow: hidden;
    display: flex;
    justify-content: space-between;

    -webkit-user-select: auto;
    .content {
        width: calc(100vw - 70px);
        -webkit-app-region: drag;
    }
}
.el-main {
    margin: 0 !important;
    padding: 0 !important;
}
.chapter-menu {
    position: absolute; right: 30px; top: 0; width: 30px; text-align: center;
    cursor: pointer; -webkit-app-region: no-drag;
}
.close {
    position: absolute;
    right: 0;
    color: #666;
    width: 30px;
    text-align: center;
    // background-color: #fff;
}
.close:hover {
    transform: scale(1.2);
    transition: all 0.2s;
    -webkit-app-region: no-drag;
}
.progress {
    margin-right: 54px;
}
</style>
