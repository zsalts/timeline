// =========================================================
// utils/html.js
// Escapado de texto para armar HTML con template literals.
//
// Vive acá porque casi todo lo que la app dibuja es texto de afuera:
// nombres de categoría y descriptores salen del archivo que sube el
// analista, y equipos, notas y planteos los escribe el usuario. Metido
// crudo en un innerHTML, un nombre como <img src=x onerror=...> corre
// código en la sesión de cualquiera que abra ese partido — incluido el
// de otro club, porque los cortes se comparten entre cuentas.
//
// Cuando el nodo es solo texto conviene textContent y listo. Este helper
// es para los casos donde de verdad se arma markup (los .map().join('')).
//
// Uso:
//   `<b>${TL.esc(nombre)}</b>`            -> contenido de un elemento
//   `<div title="${TL.esc(nombre)}">`     -> también sirve en atributos
// =========================================================
window.TL = window.TL || {};

// Escapa los cinco caracteres que cambian el significado del markup.
// Las comillas van incluidas para que sirva igual dentro de un atributo.
window.TL.esc = function (valor) {
    return String(valor == null ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
