'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, session } = require('electron');
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib';
import path from 'path';
import fs from 'fs';
import { sysConfigStore } from '../src/config/index';
import './common/fs';
import { FOLDER_PATH } from './common/path';
import { sysConfig } from './config/sysConfig';
const { registerShortcuts, unregisterShortcuts, applyShortcuts } = require('./common/shortcut');

const { isSupportedBook, readBook } = require('./common/bookReader');

const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
    console.log('当前为开发环境');
} else {
    console.log('当前为生产环境');
}

if (process.platform === 'win32') app.setAppUserModelId('com.maizesoft.fish-book');

let appTray = null;
let mainWindow = null;
let readWindow = null;

async function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        title: '莱 · 本地阅读',
        icon: path.join(__static, 'images/lai.png'),
        width: 1024,
        height: 768,
        // backgroundColor: '#1e222d',
        minWidth: 1024,
        minHeight: 768,
        show: false,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    // mainWindow.webContents.openDevTools();
    mainWindow.on('blur', restoreShortcuts);
    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await mainWindow.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
        //if (!process.env.IS_TEST) mainWindow.webContents.openDevTools()
    } else {
        createProtocol('app');
        // Load the index.html when not in development
        mainWindow.loadURL('app://./index.html');
    }
    console.log('__static:', __static);
    appTray = new Tray(path.join(__static, process.platform === 'win32' ? 'app-icon.ico' : 'images/lai.png'));
    appTray.setToolTip('莱 · 本地阅读');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '打开主界面',
            icon: path.join(__static, '/images/app.png'),
            click: () => {
                mainWindow.show();
            },
        },
        // { label: '设置', icon: path.join(__dirname, '../public/images/setting.png') },
        // { label: '关于', icon: path.join(__dirname, '../public/images/about.png') },
        {
            label: '退出',
            icon: path.join(__static, '/images/quit.png'),
            click: function () {
                app.quit();
            },
        },
    ]);
    appTray.setContextMenu(contextMenu);
    // 监听托盘双击事件
    appTray.on('double-click', () => {
        mainWindow.show();
    });
}

function createReadWindow() {
    // 获取屏幕尺寸
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 创建一个新的无边框窗口
    readWindow = new BrowserWindow({
        title: '莱 · 阅读',
        icon: path.join(__static, 'images/lai.png'),
        width: Math.min(800, width),
        height: Math.min(420, height),
        x: Math.floor((width - 800) / 2), // 窗口在 X 轴上的位置居中
        y: 0, // 窗口在 Y 轴上的位置放置在屏幕底部
        frame: false,
        fullscreenable: false,
        transparent: true,
        resizable: true,
        movable: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        modal: false,
    });
    // readWindow.webContents.openDevTools();
    readWindow.setMaximumSize(1920, 1080);
    readWindow.setMinimumSize(240, 100);
    readWindow.setSkipTaskbar(true);
    readWindow.setOpacity(0.7);
    // 将窗口设置为全局置顶
    readWindow.setAlwaysOnTop(true);
    // 将子窗口设置为主窗口的子窗口
    readWindow.setParentWindow(mainWindow);
    if (isDev) {
        // 在开发环境中加载子窗口的页面
        readWindow.loadURL('http://localhost:8080/#/read');
    } else {
        // 在生产环境中加载子窗口的页面
        const indexPath = path.join(__dirname, 'index.html');
        readWindow.loadURL(`file://${indexPath}#/read`);
    }
    //
    readWindow.on('closed', () => {
        // 将子窗口对象置为 null
        readWindow = null;
        // console.log('子窗口被关闭了');
    });

    if (process.platform === 'win32') readWindow.hookWindowMessage(278, function () {
        readWindow.setEnabled(false); //窗口禁用
        setTimeout(() => {
            readWindow.setEnabled(true); //窗口启用
        }, 100);
        return true;
    });
    global.readWindow = readWindow;
    // 注册所有快捷键
    try {
        registerShortcuts(readWindow);
    } catch (error) {
        console.error(error.message);
    }
}
// 监听从渲染进程发送的消息
ipcMain.on('readFiles', async (event, data) => {
    try {
        // 读取文件夹中所有文件
        const files = await fs.promises.readdir(FOLDER_PATH, { withFileTypes: true });

        // 列出本地 TXT 和 EPUB 书籍
        const txtFiles = files.filter(file => file.isFile() && isSupportedBook(file.name)).map(file => file.name);
        // console.log(txtFiles);
        event.reply('fileContent', txtFiles);
    } catch (err) {
        event.reply('readFilesError', err);
    }
});
ipcMain.on('window-min', event => {
    const webContent = event.sender;
    const win = BrowserWindow.fromWebContents(webContent);
    win.hide();
});
ipcMain.on('window-max', event => {
    const webContent = event.sender;
    const win = BrowserWindow.fromWebContents(webContent);
    win.maximize();
});
ipcMain.on('window-close', event => {
    const webContent = event.sender;
    const win = BrowserWindow.fromWebContents(webContent);
    win.hide();
});
ipcMain.on('readWin-toggle', () => {
    if (readWindow.isVisible()) {
        readWindow.hide();
    } else {
        readWindow.show();
    }
});
// 监听来自渲染进程的 "open-window" 消息
ipcMain.on('show-read-win', () => {
    if (readWindow === null) {
        createReadWindow();
    } else {
        readWindow.show();
    }
});
ipcMain.on('reload-read-win', () => {
    readWindow.close();
});
// 监听渲染进程发送的消息，修改窗口透明度
ipcMain.on('set-bg-opacity', (event, opacity) => {
    readWindow.setOpacity(opacity);
});
// 监听渲染进程发送的消息，修改resizeable
ipcMain.on('set-resizable', (event, resizable) => {
    console.log(resizable);
    readWindow.setResizable(resizable);
});
// 重置快捷键
ipcMain.handle('show-chapter-menu', async (event, fileName) => {
    if (typeof fileName !== 'string' || /[\\/]/.test(fileName) || path.basename(fileName) !== fileName) throw new Error('书籍文件名无效');
    const book = await readBook(path.join(FOLDER_PATH, fileName));
    return new Promise(resolve => {
        const items = book.chapters.map(chapter => ({
            label: chapter.title.replace(/&/g, '&&'),
            click: () => resolve(chapter),
        }));
        const menu = [];
        for (let i = 0; i < items.length; i += 30) {
            const group = items.slice(i, i + 30);
            if (items.length <= 30) menu.push(...group);
            else menu.push({ label: `第 ${i + 1}–${i + group.length} 节`, submenu: group });
        }
        Menu.buildFromTemplate(menu).popup({ window: readWindow || mainWindow, callback: () => resolve(null) });
    });
});
ipcMain.handle('apply-shortcuts', (event, keys) => applyShortcuts(readWindow, keys));
ipcMain.on('shortcut-edit-start', () => unregisterShortcuts());
function restoreShortcuts() {
    unregisterShortcuts();
    try {
        registerShortcuts(readWindow);
    } catch (error) {
        console.error(error.message);
    }
}
ipcMain.on('shortcut-edit-end', restoreShortcuts);
// 处理获取存储值的请求
ipcMain.handle('getSysConfig', (event, key) => {
    return sysConfigStore.get(key);
});
ipcMain.handle('setSysConfig', (event, key, val) => {
    sysConfigStore.set(key, val);
});
ipcMain.handle('deleteSysConfig', (event, key, val) => {
    sysConfigStore.delete(key);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
        }
    });

    app.on('ready', async () => {
        // Reading stays offline; only the local development server is allowed.
        session.defaultSession.webRequest.onBeforeRequest(
            { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
            (details, callback) => {
                const url = new URL(details.url);
                const localDev = isDev && ['localhost', '127.0.0.1'].includes(url.hostname)
                    && url.port === '8080' && ['http:', 'ws:'].includes(url.protocol);
                callback({ cancel: !localDev });
            }
        );
        createWindow();
        createReadWindow();
    });
}

app.on('will-quit', () => {
    // 注销所有快捷键
    unregisterShortcuts();
});

// 监听存储数据的更改
sysConfigStore.onDidAnyChange(newData => {
    const config = configFixer(newData);
    // 向渲染进程发送消息，通知更新数据
    for (const win of [mainWindow, readWindow]) {
        if (win && !win.isDestroyed()) win.webContents.send('update-data', config);
    }
});
// 检测并修复配置文件
function configFixer(currentConfig) {
    // console.log(typeof currentConfig);
    for (let key in sysConfig) {
        // console.log(currentConfig[key]);
        if (!(key in currentConfig)) {
            console.log(key + '不在curentConfig中');
            currentConfig[key] = sysConfig[key];
            sysConfigStore.set(key, currentConfig[key]);
        }
    }
    return currentConfig;
}
