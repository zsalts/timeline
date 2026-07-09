// =========================================================
// components/timeline.js  ·  Firma visual del producto
// Genera la "tira de timeline" de un partido: una barra que
// representa la duración del partido con una marca por cada corte,
// coloreada por categoría. Codifica info real (cuándo pasa cada jugada).
// Expone global window.TL.timeline.
//   TL.timeline.crear(estadisticas)   -> HTMLElement (.tl-strip)
//   TL.timeline.resumen(estadisticas) -> { total, categorias }
//   TL.timeline.colorCategoria(nombre)-> color hex estable por categoría
// =========================================================
window.TL = window.TL || {};
window.TL.timeline = (function () {

    // Paleta cualitativa para categorías (evita el ámbar, reservado al acento)
    const PALETA = ['#56C2E6', '#7C9CFF', '#A78BFA', '#F58BB4', '#5FD3A6', '#FFB454', '#E0777D', '#8FD14F'];

    function hash(str) {
        let h = 0;
        str = String(str || '');
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h;
    }

    function colorCategoria(nombre) {
        return PALETA[hash(nombre) % PALETA.length];
    }

    // Aplana las estadísticas a una lista de { t, cat }
    function puntos(estadisticas) {
        const pts = [];
        if (estadisticas) {
            for (const [cat, cortes] of Object.entries(estadisticas)) {
                (cortes || []).forEach(c => {
                    if (typeof c.t === 'number' && isFinite(c.t)) pts.push({ t: c.t, cat });
                });
            }
        }
        return pts;
    }

    function resumen(estadisticas) {
        return {
            total: puntos(estadisticas).length,
            categorias: estadisticas ? Object.keys(estadisticas).length : 0
        };
    }

    function crear(estadisticas) {
        const pts = puntos(estadisticas);
        const strip = document.createElement('div');
        strip.className = 'tl-strip';

        if (pts.length === 0) {
            strip.classList.add('vacio');
            return strip;
        }

        let min = Infinity, max = -Infinity;
        pts.forEach(p => { if (p.t < min) min = p.t; if (p.t > max) max = p.t; });
        const span = (max - min) || 1;

        pts.forEach(p => {
            const tick = document.createElement('span');
            tick.className = 'tl-tick';
            const left = pts.length === 1 ? 50 : ((p.t - min) / span) * 100;
            tick.style.left = left + '%';
            tick.style.background = colorCategoria(p.cat);
            tick.title = p.cat;
            strip.appendChild(tick);
        });

        return strip;
    }

    return { crear, resumen, colorCategoria };
})();
