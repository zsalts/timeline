// =========================================================
// Test de parsers.js — corre con Node puro, sin framework.
//   node app/assets/js/utils/parsers.test.js
//
// parsers.js está escrito para navegador (usa `window` y `DOMParser`).
// Para poder correrlo bajo Node, este archivo define shims mínimos de
// esas dos APIs antes de cargar el script real con require().
// =========================================================
const assert = require('node:assert/strict');
const path = require('node:path');

// --- Shim de DOMParser (solo lo que procesarXML necesita) ---
class MiniElement {
    constructor(tag) { this.tag = tag; this.children = []; this._text = ''; }
    getElementsByTagName(name) {
        const out = [];
        const walk = (node) => {
            for (const child of node.children) {
                if (child.tag === name) out.push(child);
                walk(child);
            }
        };
        walk(this);
        return out;
    }
    get textContent() {
        let s = this._text;
        for (const c of this.children) s += c.textContent;
        return s;
    }
}

function miniParseXML(str) {
    str = str.replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    let i = 0;
    function parseNode() {
        while (/\s/.test(str[i] || '')) i++;
        const openMatch = /^<([a-zA-Z_][\w:-]*)[^>]*?(\/)?>/.exec(str.slice(i));
        if (!openMatch) return null;
        const tag = openMatch[1];
        i += openMatch[0].length;
        const el = new MiniElement(tag);
        if (openMatch[2]) return el; // self-closing
        while (true) {
            const nextTagIdx = str.indexOf('<', i);
            if (nextTagIdx === -1) break;
            if (nextTagIdx > i) {
                const text = str.slice(i, nextTagIdx);
                if (text.trim() !== '') el._text += text;
                i = nextTagIdx;
            }
            if (str.startsWith('</' + tag, i)) {
                const endClose = str.indexOf('>', i);
                i = endClose + 1;
                break;
            }
            const child = parseNode();
            if (child) el.children.push(child);
            else break;
        }
        return el;
    }
    const root = new MiniElement('#root');
    while (i < str.length) {
        while (i < str.length && str[i] !== '<') i++;
        if (i >= str.length) break;
        const child = parseNode();
        if (child) root.children.push(child);
        else break;
    }
    return { getElementsByTagName: (name) => root.getElementsByTagName(name) };
}

global.window = global.window || {};
global.DOMParser = class { parseFromString(str) { return miniParseXML(str); } };

require(path.join(__dirname, 'parsers.js'));
const { procesarLGM, procesarXML, procesarArchivo } = global.window.TL.parsers;

let pasados = 0;
function test(nombre, fn) {
    fn();
    pasados++;
    console.log(`  ok - ${nombre}`);
}

console.log('parsers.js');

// ---------- procesarLGM ----------
test('procesarLGM agrupa por categoría y convierte ms a segundos', () => {
    const json = JSON.stringify({
        Timeline: [
            { $type: 'TimelineEvent', Name: 'Ataque 1', Start: 15500, Tags: [{ Value: 'Gol' }] },
            { $type: 'TimelineEvent', Name: 'Ataque 2', Start: 20000, Tags: [] }
        ]
    });
    const r = procesarLGM(json);
    assert.deepEqual(Object.keys(r), ['Ataque']);
    assert.equal(r['Ataque'].length, 2);
    assert.equal(r['Ataque'][0].t, 15.5);
    assert.deepEqual(r['Ataque'][0].d, ['Gol']);
    assert.deepEqual(r['Ataque'][1].d, []);
});

test('procesarLGM ignora eventos sin $type TimelineEvent', () => {
    const json = JSON.stringify({
        Timeline: [
            { $type: 'OtroTipo', Name: 'Ruido', Start: 1000 },
            { $type: 'TimelineEvent', Name: 'Recuperaciones', Start: 5000, Tags: [] }
        ]
    });
    const r = procesarLGM(json);
    assert.deepEqual(Object.keys(r), ['Recuperaciones']);
});

// ---------- procesarXML ----------
test('procesarXML lee categoria/tiempo/descriptor con texto anidado', () => {
    const xml = `<file>
        <evento>
            <categoria>Ataque 1</categoria>
            <tiempo>15.5</tiempo>
            <descriptor><text>Juan Perez</text></descriptor>
            <descriptor><text>Gol</text></descriptor>
        </evento>
    </file>`;
    const r = procesarXML(xml);
    assert.deepEqual(Object.keys(r), ['Ataque']);
    assert.equal(r['Ataque'][0].t, 15.5);
    assert.deepEqual(r['Ataque'][0].d, ['Juan Perez', 'Gol']);
});

test('procesarXML convierte tiempo en milisegundos a segundos (>12000)', () => {
    const xml = `<file><evento><categoria>Recuperaciones</categoria><tiempo>20000</tiempo></evento></file>`;
    const r = procesarXML(xml);
    assert.equal(r['Recuperaciones'][0].t, 20);
});

test('procesarXML no convierte tiempos ya en segundos (<=12000)', () => {
    const xml = `<file><evento><categoria>Recuperaciones</categoria><tiempo>9000</tiempo></evento></file>`;
    const r = procesarXML(xml);
    assert.equal(r['Recuperaciones'][0].t, 9000);
});

test('procesarXML salta eventos sin categoria o sin tiempo', () => {
    const xml = `<file>
        <evento><categoria>Solo categoria</categoria></evento>
        <evento><tiempo>10</tiempo></evento>
        <evento><categoria>Completo</categoria><tiempo>1</tiempo></evento>
    </file>`;
    const r = procesarXML(xml);
    assert.deepEqual(Object.keys(r), ['Completo']);
});

test('procesarXML reconoce tags alternativos (instance/code/start/label)', () => {
    const xml = `<file><instance><code>Pase</code><start>3</start><label>Corto</label></instance></file>`;
    const r = procesarXML(xml);
    assert.deepEqual(Object.keys(r), ['Pase']);
    assert.deepEqual(r['Pase'][0].d, ['Corto']);
});

// ---------- procesarArchivo (auto-detección) ----------
test('procesarArchivo detecta JSON por la llave inicial', () => {
    const json = JSON.stringify({ Timeline: [{ $type: 'TimelineEvent', Name: 'Test', Start: 1000, Tags: [] }] });
    const r = procesarArchivo(json);
    assert.deepEqual(Object.keys(r), ['Test']);
});

test('procesarArchivo usa XML cuando no arranca con {', () => {
    const xml = `<file><evento><categoria>Test</categoria><tiempo>1</tiempo></evento></file>`;
    const r = procesarArchivo(xml);
    assert.deepEqual(Object.keys(r), ['Test']);
});

console.log(`${pasados} tests OK\n`);
