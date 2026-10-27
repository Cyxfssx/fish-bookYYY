const { globalShortcut } = require('electron');
const { shortcutSettings } = require('../config/sysConfig');
const { sysConfigStore } = require('../config/index');

function getShortcuts() {
    return Object.fromEntries(Object.keys(shortcutSettings).map(key => [key, sysConfigStore.get(key)]));
}

function registerShortcuts(readWindow, keys = getShortcuts()) {
    const channels = { key1: 'pre-page', key2: 'next-page', key3: 'show-hide-readWin' };
    for (const key of Object.keys(channels)) {
        const shortcut = keys[key];
        try {
            const registered = globalShortcut.register(shortcut, () => {
                if (readWindow && !readWindow.isDestroyed()) {
                    readWindow.webContents.send(channels[key]);
                }
            });
            if (!registered) throw new Error('快捷键已被系统或其他应用占用');
        } catch (error) {
            unregisterShortcuts();
            throw new Error(`${shortcut} 无法注册：${error.message}`);
        }
    }
}

function applyShortcuts(readWindow, keys) {
    const previous = getShortcuts();
    const names = Object.keys(shortcutSettings);
    if (!keys || names.some(key => typeof keys[key] !== 'string' || !keys[key].trim())) {
        return { success: false, message: '请为每个操作设置完整的快捷键' };
    }
    const next = Object.fromEntries(names.map(key => [key, keys[key].trim()]));
    const canonical = value => value.toLowerCase().replace(/\s/g, '').split('+').sort().join('+');
    if (new Set(Object.values(next).map(canonical)).size !== names.length) {
        return { success: false, message: '快捷键重复，请为每个操作设置不同的按键' };
    }
    unregisterShortcuts();
    try {
        registerShortcuts(readWindow, next);
        sysConfigStore.set(next);
        return { success: true, message: '快捷键已应用并保存，下次启动仍然生效' };
    } catch (error) {
        unregisterShortcuts();
        try {
            registerShortcuts(readWindow, previous);
        } catch (restoreError) {
            return { success: false, message: `${error.message}；原快捷键恢复失败：${restoreError.message}` };
        }
        return { success: false, message: `${error.message}；已保留原设置` };
    }
}

function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}

module.exports = { registerShortcuts, unregisterShortcuts, applyShortcuts };
