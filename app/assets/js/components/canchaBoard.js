// =========================================================
// components/canchaBoard.js
// Pizarra táctica sobre una cancha de hockey: ubicás jugadoras
// (propias y rivales), pelota y flechas (bloqueos / movimientos).
// Se usa en la pantalla del partido para dejar registrada la
// alineación, los bloqueos usados y cómo salió el rival.
//
// API:
//   const board = TL.canchaBoard.crear(contenedor, { editable, datos });
//   board.getDatos()  -> { vista, objetos }
//   board.setDatos(d) -> pinta esos datos
//   board.onChange = fn -> se llama en cada cambio (para marcar "sin guardar")
//
// Formato de datos (mismo espíritu que el editor de ejercicios):
//   { vista: '1' | 'vertical',
//     objetos: [ {tipo:'jugadora'|'rival'|'pelota', x, y, num?},
//                {tipo:'flecha', x1, y1, x2, y2} ] }  // x,y en % (0..100)
// =========================================================
(function () {
    const NS = 'http://www.w3.org/2000/svg';
    window.TL = window.TL || {};

    const COLOR = { jugadora: '#F7C948', rival: '#56C2E6' };
    const COLOR_FLECHA = '#EAEEF4';

    // --- CSS (se inyecta una sola vez) ---
    const CSS = `
    .cb-root { display: flex; flex-direction: column; gap: 10px; }
    .cb-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .cb-tg { display: flex; align-items: center; gap: 6px; }
    .cb-tg + .cb-tg { border-left: 1px solid var(--line); padding-left: 8px; }
    .cb-lbl { font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
    .cb-chip {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--panel-2); border: 1px solid var(--line-2); color: var(--text);
        border-radius: 999px; padding: 6px 11px; cursor: pointer; font-size: 0.8rem;
        font-family: inherit; font-weight: 600; transition: border-color 0.12s, background 0.12s;
    }
    .cb-chip:hover { border-color: var(--accent-line); }
    .cb-chip.on { border-color: var(--accent); background: var(--accent-dim); color: var(--accent-hi); }
    .cb-chip .dot { width: 13px; height: 13px; border-radius: 50%; display: inline-block; }
    .cb-pitch {
        position: relative; width: 100%; max-width: 820px; margin: 0 auto;
        aspect-ratio: 1000 / 600; border-radius: var(--radius); overflow: hidden;
        border: 1px solid var(--line-2); touch-action: none; user-select: none;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .cb-pitch svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .cb-objs { position: absolute; inset: 0; }
    .cb-obj { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; }
    .cb-editable .cb-obj { cursor: grab; touch-action: none; }
    .cb-editable .cb-obj:active { cursor: grabbing; }
    .cb-obj.jug { width: 28px; height: 28px; border-radius: 50%; font-weight: 800; font-size: 0.78rem; color: #10130a; border: 2px solid rgba(0,0,0,0.35); box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
    .cb-obj.jug.rival { color: #06181f; }
    .cb-obj.pelota { width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
    .cb-pitch.borrar .cb-obj:hover { outline: 2px solid var(--danger); outline-offset: 2px; }
    .cb-hint { text-align: center; color: var(--faint); font-size: 0.78rem; margin: 0; }
    `;
    function ensureCSS() {
        if (document.getElementById('cb-css')) return;
        const s = document.createElement('style');
        s.id = 'cb-css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    // --- Canchas (horizontal y vertical, mismo trazo que el editor) ---
    function svgHorizontal() {
        const lc = 'rgba(255,255,255,0.42)', lw = 2.5;
        return `<svg viewBox="0 0 1000 600" preserveAspectRatio="none" xmlns="${NS}">
            <defs><linearGradient id="cbturf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173d2c"/><stop offset="1" stop-color="#123023"/></linearGradient></defs>
            <rect width="1000" height="600" fill="url(#cbturf)"/>
            <rect x="14" y="14" width="972" height="572" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <line x1="500" y1="14" x2="500" y2="586" stroke="${lc}" stroke-width="${lw}"/>
            <line x1="258" y1="14" x2="258" y2="586" stroke="${lc}" stroke-width="${lw}"/>
            <line x1="742" y1="14" x2="742" y2="586" stroke="${lc}" stroke-width="${lw}"/>
            <path d="M 14 125 A 156 156 0 0 1 170 281 L 170 319 A 156 156 0 0 1 14 475" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <path d="M 986 125 A 156 156 0 0 0 830 281 L 830 319 A 156 156 0 0 0 986 475" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <circle cx="82" cy="300" r="3" fill="${lc}"/><circle cx="904" cy="300" r="3" fill="${lc}"/>
            <rect x="6" y="281" width="8" height="38" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <rect x="986" y="281" width="8" height="38" fill="none" stroke="${lc}" stroke-width="${lw}"/>
        </svg>`;
    }
    function svgVertical() {
        const lc = 'rgba(255,255,255,0.42)', lw = 2.5;
        return `<svg viewBox="0 0 600 1000" preserveAspectRatio="none" xmlns="${NS}">
            <defs><linearGradient id="cbturfv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173d2c"/><stop offset="1" stop-color="#123023"/></linearGradient></defs>
            <rect width="600" height="1000" fill="url(#cbturfv)"/>
            <rect x="14" y="14" width="572" height="972" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <line x1="14" y1="500" x2="586" y2="500" stroke="${lc}" stroke-width="${lw}"/>
            <line x1="14" y1="258" x2="586" y2="258" stroke="${lc}" stroke-width="${lw}"/>
            <line x1="14" y1="742" x2="586" y2="742" stroke="${lc}" stroke-width="${lw}"/>
            <path d="M 125 14 A 156 156 0 0 0 281 170 L 319 170 A 156 156 0 0 0 475 14" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <path d="M 125 986 A 156 156 0 0 1 281 830 L 319 830 A 156 156 0 0 1 475 986" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <circle cx="300" cy="82" r="3" fill="${lc}"/><circle cx="300" cy="904" r="3" fill="${lc}"/>
            <rect x="281" y="6" width="38" height="8" fill="none" stroke="${lc}" stroke-width="${lw}"/>
            <rect x="281" y="986" width="38" height="8" fill="none" stroke="${lc}" stroke-width="${lw}"/>
        </svg>`;
    }
    const VB = { '1': [1000, 600], 'vertical': [600, 1000] };

    TL.canchaBoard = {
        crear(contenedor, opts = {}) {
            ensureCSS();
            const editable = opts.editable !== false;

            let vista = '1';
            let objetos = [];        // incluye flechas
            let herramienta = 'jugadora';
            let seq = 0;
            let vbW = 1000, vbH = 600;

            const root = document.createElement('div');
            root.className = 'cb-root' + (editable ? ' cb-editable' : '');

            const toolbarHTML = editable ? `
                <div class="cb-toolbar">
                    <div class="cb-tg">
                        <span class="cb-lbl">Vista</span>
                        <button class="cb-chip" data-vista="1">Horizontal</button>
                        <button class="cb-chip" data-vista="vertical">Vertical</button>
                    </div>
                    <div class="cb-tg">
                        <span class="cb-lbl">Poner</span>
                        <button class="cb-chip" data-tool="jugadora"><span class="dot" style="background:${COLOR.jugadora}"></span>Nosotras</button>
                        <button class="cb-chip" data-tool="rival"><span class="dot" style="background:${COLOR.rival}"></span>Rival</button>
                        <button class="cb-chip" data-tool="pelota"><span class="dot" style="background:#fff"></span>Pelota</button>
                        <button class="cb-chip" data-tool="flecha">➜ Flecha</button>
                    </div>
                    <div class="cb-tg">
                        <span class="cb-lbl">Modo</span>
                        <button class="cb-chip" data-tool="mover">✋ Mover</button>
                        <button class="cb-chip" data-tool="borrar">✕ Borrar</button>
                        <button class="cb-chip" data-vaciar>🗑 Vaciar</button>
                    </div>
                </div>` : '';

            root.innerHTML = `
                ${toolbarHTML}
                <div class="cb-pitch">
                    <svg class="cb-arrows" viewBox="0 0 1000 600" preserveAspectRatio="none" style="pointer-events:none;"></svg>
                    <div class="cb-objs"></div>
                </div>
                ${editable ? '<p class="cb-hint">Elegí una herramienta y tocá la cancha. Arrastrá para mover. Doble clic en una jugadora cambia el número.</p>' : ''}`;
            contenedor.innerHTML = '';
            contenedor.appendChild(root);

            const pitch = root.querySelector('.cb-pitch');
            const arrows = root.querySelector('.cb-arrows');
            const layer = root.querySelector('.cb-objs');

            const notificar = () => { if (typeof api.onChange === 'function') api.onChange(); };

            function pintarCancha() {
                const viejo = pitch.querySelector('svg:not(.cb-arrows)');
                if (viejo) viejo.remove();
                [vbW, vbH] = VB[vista] || VB['1'];
                pitch.style.aspectRatio = `${vbW} / ${vbH}`;
                arrows.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
                pitch.insertAdjacentHTML('afterbegin', vista === 'vertical' ? svgVertical() : svgHorizontal());
                renderFlechas();
            }

            function proximoNumero(tipo) {
                const nums = objetos.filter(o => o.tipo === tipo).map(o => parseInt(o.num, 10)).filter(n => !isNaN(n));
                return (nums.length ? Math.max(...nums) : 0) + 1;
            }

            function crearEl(o) {
                const el = document.createElement('div');
                el.dataset.id = o.id;
                el.style.left = o.x + '%';
                el.style.top = o.y + '%';
                if (o.tipo === 'jugadora' || o.tipo === 'rival') {
                    el.className = 'cb-obj jug' + (o.tipo === 'rival' ? ' rival' : '');
                    el.style.background = COLOR[o.tipo];
                    el.textContent = o.num;
                    if (editable) el.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        const n = prompt('Número:', o.num);
                        if (n !== null && n.trim() !== '') { o.num = n.trim(); el.textContent = o.num; notificar(); }
                    });
                } else if (o.tipo === 'pelota') {
                    el.className = 'cb-obj pelota';
                }
                if (editable) el.addEventListener('pointerdown', (e) => onObjDown(e, o, el));
                return el;
            }

            function renderObjetos() {
                layer.innerHTML = '';
                objetos.filter(o => o.tipo !== 'flecha').forEach(o => layer.appendChild(crearEl(o)));
                renderFlechas();
            }

            function renderFlechas() {
                const fl = objetos.filter(o => o.tipo === 'flecha');
                const defs = `<defs><marker id="cbah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="${COLOR_FLECHA}"/></marker></defs>`;
                const lineas = fl.map(o => {
                    const x1 = o.x1 / 100 * vbW, y1 = o.y1 / 100 * vbH, x2 = o.x2 / 100 * vbW, y2 = o.y2 / 100 * vbH;
                    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${COLOR_FLECHA}" stroke-width="4" marker-end="url(#cbah)"/>`;
                }).join('');
                arrows.innerHTML = defs + lineas;
            }

            function pos(e) {
                const r = pitch.getBoundingClientRect();
                return {
                    x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)),
                    y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100))
                };
            }

            // Distancia de un punto a un segmento (para borrar flechas)
            function distSeg(px, py, x1, y1, x2, y2) {
                const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
                let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
                t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
            }

            // --- Interacción (solo si editable) ---
            let dibujoFlecha = null;
            if (editable) {
                pitch.addEventListener('pointerdown', (e) => {
                    if (['jugadora', 'rival', 'pelota'].includes(herramienta)) {
                        if (e.target.closest('.cb-obj')) return;
                        const p = pos(e);
                        const o = { id: ++seq, tipo: herramienta, x: p.x, y: p.y };
                        if (herramienta !== 'pelota') o.num = proximoNumero(herramienta);
                        objetos.push(o);
                        layer.appendChild(crearEl(o));
                        notificar();
                    } else if (herramienta === 'flecha') {
                        if (e.target.closest('.cb-obj')) return;
                        const p = pos(e);
                        dibujoFlecha = { id: ++seq, tipo: 'flecha', x1: p.x, y1: p.y, x2: p.x, y2: p.y };
                        objetos.push(dibujoFlecha);
                        window.addEventListener('pointermove', flechaMove);
                        window.addEventListener('pointerup', flechaUp);
                    } else if (herramienta === 'borrar') {
                        if (e.target.closest('.cb-obj')) return;
                        const p = pos(e);
                        let best = null, bd = Infinity;
                        objetos.filter(o => o.tipo === 'flecha').forEach(o => {
                            const d = distSeg(p.x, p.y, o.x1, o.y1, o.x2, o.y2);
                            if (d < bd) { bd = d; best = o; }
                        });
                        if (best && bd < 3) { objetos = objetos.filter(o => o.id !== best.id); renderFlechas(); notificar(); }
                    }
                });
            }
            function flechaMove(e) {
                if (!dibujoFlecha) return;
                const p = pos(e);
                dibujoFlecha.x2 = p.x; dibujoFlecha.y2 = p.y;
                renderFlechas();
            }
            function flechaUp() {
                window.removeEventListener('pointermove', flechaMove);
                window.removeEventListener('pointerup', flechaUp);
                if (dibujoFlecha) {
                    const largo = Math.hypot(dibujoFlecha.x2 - dibujoFlecha.x1, dibujoFlecha.y2 - dibujoFlecha.y1);
                    if (largo < 2) objetos = objetos.filter(o => o.id !== dibujoFlecha.id);
                    dibujoFlecha = null;
                    renderFlechas();
                    notificar();
                }
            }

            let drag = null;
            function onObjDown(e, o, el) {
                e.stopPropagation();
                if (herramienta === 'borrar') {
                    objetos = objetos.filter(x => x.id !== o.id);
                    el.remove();
                    notificar();
                    return;
                }
                drag = { o, el };
                try { el.setPointerCapture(e.pointerId); } catch (_) { }
                el.addEventListener('pointermove', onObjMove);
                el.addEventListener('pointerup', onObjUp);
            }
            function onObjMove(e) {
                if (!drag) return;
                const p = pos(e);
                drag.o.x = p.x; drag.o.y = p.y;
                drag.el.style.left = p.x + '%';
                drag.el.style.top = p.y + '%';
            }
            function onObjUp() {
                if (!drag) return;
                drag.el.removeEventListener('pointermove', onObjMove);
                drag.el.removeEventListener('pointerup', onObjUp);
                drag = null;
                notificar();
            }

            // --- Toolbar ---
            if (editable) {
                root.querySelectorAll('.cb-chip[data-tool]').forEach(b => {
                    b.addEventListener('click', () => {
                        herramienta = b.dataset.tool;
                        root.querySelectorAll('.cb-chip[data-tool]').forEach(x => x.classList.toggle('on', x === b));
                        pitch.classList.toggle('borrar', herramienta === 'borrar');
                    });
                });
                root.querySelectorAll('.cb-chip[data-vista]').forEach(b => {
                    b.addEventListener('click', () => {
                        vista = b.dataset.vista;
                        root.querySelectorAll('.cb-chip[data-vista]').forEach(x => x.classList.toggle('on', x === b));
                        pintarCancha();
                        notificar();
                    });
                });
                root.querySelector('[data-vaciar]').addEventListener('click', () => {
                    if (!objetos.length) return;
                    if (confirm('¿Vaciar la pizarra? Se quitan todas las fichas y flechas.')) {
                        objetos = []; renderObjetos(); notificar();
                    }
                });
                // Estado inicial de los botones
                root.querySelector('.cb-chip[data-tool="jugadora"]').classList.add('on');
                root.querySelector('.cb-chip[data-vista="1"]').classList.add('on');
            }

            const api = {
                onChange: null,
                getDatos() {
                    return {
                        vista,
                        objetos: objetos.map(o => o.tipo === 'flecha'
                            ? { tipo: 'flecha', x1: +o.x1.toFixed(1), y1: +o.y1.toFixed(1), x2: +o.x2.toFixed(1), y2: +o.y2.toFixed(1) }
                            : { tipo: o.tipo, x: +o.x.toFixed(1), y: +o.y.toFixed(1), ...(o.num ? { num: o.num } : {}) })
                    };
                },
                setDatos(d) {
                    d = d || {};
                    vista = d.vista === 'vertical' ? 'vertical' : '1';
                    seq = 0;
                    objetos = (d.objetos || []).map(o => ({ id: ++seq, ...o }));
                    if (editable) {
                        root.querySelectorAll('.cb-chip[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === vista));
                    }
                    pintarCancha();
                    renderObjetos();
                },
                estaVacia() { return objetos.length === 0; }
            };

            pintarCancha();
            renderObjetos();
            return api;
        }
    };
})();
