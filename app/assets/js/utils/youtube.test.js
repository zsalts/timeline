// =========================================================
// Test de youtube.js — corre con Node puro, sin framework.
//   node app/assets/js/utils/youtube.test.js
// =========================================================
const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global.window || {};
require(path.join(__dirname, 'youtube.js'));
const { extraerId } = global.window.TL.youtube;

let pasados = 0;
function test(nombre, fn) {
    fn();
    pasados++;
    console.log(`  ok - ${nombre}`);
}

console.log('youtube.js');

test('extrae el ID de una URL completa (?v=)', () => {
    assert.equal(extraerId('https://www.youtube.com/watch?v=M7lc1UVf-VE'), 'M7lc1UVf-VE');
});

test('extrae el ID de una URL completa con parámetros extra después', () => {
    assert.equal(extraerId('https://www.youtube.com/watch?v=M7lc1UVf-VE&t=30s'), 'M7lc1UVf-VE');
});

test('extrae el ID de una URL corta youtu.be', () => {
    assert.equal(extraerId('https://youtu.be/M7lc1UVf-VE'), 'M7lc1UVf-VE');
});

test('devuelve el valor tal cual si ya es un ID crudo', () => {
    assert.equal(extraerId('M7lc1UVf-VE'), 'M7lc1UVf-VE');
});

test('devuelve string vacío para entradas vacías o nulas', () => {
    assert.equal(extraerId(''), '');
    assert.equal(extraerId(null), '');
    assert.equal(extraerId(undefined), '');
});

console.log(`${pasados} tests OK\n`);
