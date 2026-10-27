const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { captureAccelerator } = require('../src/common/shortcutCapture');
function setup(blocked = '') {
    const stored = { key1: 'Alt+Z', key2: 'Alt+C', key3: 'Alt+V' };
    const active = new Map();
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../src/common/shortcut.js'), 'utf8'), {
        module, require(name) {
            if (name === 'electron') return { globalShortcut: {
                register(key, cb) { if (key === blocked) return false; active.set(key, cb); return true; },
                unregisterAll() { active.clear(); },
            } };
            if (name.endsWith('sysConfig')) return { shortcutSettings: stored };
            return { sysConfigStore: { get: key => stored[key], set: obj => Object.assign(stored, obj) } };
        },
    });
    return { ...module.exports, stored, active };
}
test('physical numpad keys remain distinct with NumLock on and off', () => {
    assert.equal(captureAccelerator({ code: 'Numpad1', key: '1' }), 'num1');
    assert.equal(captureAccelerator({ code: 'Numpad1', key: 'End' }), 'num1');
    assert.equal(captureAccelerator({ code: 'Numpad2', key: 'ArrowDown' }), 'num2');
    assert.equal(captureAccelerator({ code: 'Digit1', key: '1' }), '1');
    assert.equal(captureAccelerator({ code: 'KeyC', key: 'c', ctrlKey: true }), 'Ctrl+C');
    assert.equal(captureAccelerator({ key: 'Control' }), null);
});
test('applying registers callbacks and persists all keys together', () => {
    const s = setup(); const sent = [];
    const result = s.applyShortcuts({ isDestroyed: () => false, webContents: { send: c => sent.push(c) } },
        { key1: 'num1', key2: 'num2', key3: 'Alt+V' });
    assert.equal(result.success, true);
    s.active.get('num1')(); s.active.get('num2')();
    assert.deepEqual(sent, ['pre-page', 'next-page']);
    assert.equal(s.stored.key1, 'num1');
});
test('occupied shortcut rolls back registrations and leaves persisted values intact', () => {
    const s = setup('num2');
    assert.equal(s.applyShortcuts(null, { key1: 'num1', key2: 'num2', key3: 'Alt+V' }).success, false);
    assert.equal(s.stored.key1, 'Alt+Z');
    assert.deepEqual([...s.active.keys()], ['Alt+Z', 'Alt+C', 'Alt+V']);
});
test('empty and duplicate shortcuts cannot overwrite settings', () => {
    const s = setup();
    assert.equal(s.applyShortcuts(null, { key1: '', key2: 'num2', key3: 'Alt+V' }).success, false);
    assert.equal(s.applyShortcuts(null, { key1: 'Ctrl+A', key2: 'a + ctrl', key3: 'Alt+V' }).success, false);
    assert.equal(s.stored.key1, 'Alt+Z');
});
