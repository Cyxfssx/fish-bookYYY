// Use physical numpad codes so NumLock does not turn Numpad1 into End.
function captureAccelerator(event) {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
    const numpad = { NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult',
        NumpadDivide: 'numdiv', NumpadDecimal: 'numdec' };
    const aliases = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left',
        ArrowRight: 'Right', Escape: 'Esc', '+': 'Plus' };
    let key = /^Numpad[0-9]$/.test(event.code) ? `num${event.code.slice(-1)}` : numpad[event.code];
    key = key || aliases[event.key] || event.key;
    if (!key || key === 'Unidentified' || key === 'Dead') return null;
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Super');
    return [...modifiers, key.length === 1 ? key.toUpperCase() : key].join('+');
}
module.exports = { captureAccelerator };
