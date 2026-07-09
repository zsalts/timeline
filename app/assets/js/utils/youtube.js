// =========================================================
// utils/youtube.js
// Extracción del ID de YouTube desde distintas formas de URL o ID crudo.
// Expone global window.TL.youtube para usarse en scripts clásicos y módulos.
// =========================================================
window.TL = window.TL || {};
window.TL.youtube = (function () {

    // Acepta:
    //  - URL completa: https://www.youtube.com/watch?v=XXXXXXXXXXX
    //  - URL corta:    https://youtu.be/XXXXXXXXXXX
    //  - ID crudo:     XXXXXXXXXXX
    function extraerId(rawId) {
        if (!rawId) return '';
        if (rawId.includes('v=')) return rawId.split('v=')[1].substring(0, 11);
        if (rawId.includes('youtu.be/')) return rawId.split('youtu.be/')[1].substring(0, 11);
        return rawId;
    }

    return { extraerId };
})();
