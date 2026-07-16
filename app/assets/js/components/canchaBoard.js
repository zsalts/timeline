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

    // Estilos de línea táctica. Cada uno se dibuja distinto en renderFlechas:
    //  - movimiento: flecha recta         - presion: flecha ondulada
    //  - bloqueo: línea con barra en T (pantalla)   - pase: flecha punteada
    const LINEAS = {
        mov: { color: '#EAEEF4', nombre: '➜ Movimiento' },
        pase: { color: '#5FD3A6', nombre: '⇢ Pase' },
        presion: { color: '#FFB454', nombre: '∿ Presión' },
        bloqueo: { color: '#FF5C63', nombre: '⊤ Bloqueo' },
    };
    const LINE_TOOLS = Object.keys(LINEAS);

    // Camino ondulado (presión) entre dos puntos; recto en el tramo final
    // para que la punta de flecha quede limpia.
    function wavyPath(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len < 4) return `M ${x1} ${y1} L ${x2} ${y2}`;
        const ux = dx / len, uy = dy / len;
        const amp = 7, wl = 26, recto = 12;
        const n = Math.max(2, Math.round(len / 4));
        let d = '';
        for (let i = 0; i <= n; i++) {
            const t = i / n * len;
            const off = t > len - recto ? 0 : Math.sin(t / wl * Math.PI * 2) * amp;
            const bx = x1 + ux * t - uy * off;
            const by = y1 + uy * t + ux * off;
            d += (i === 0 ? 'M ' : ' L ') + bx.toFixed(1) + ' ' + by.toFixed(1);
        }
        return d;
    }

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

    // --- Animación (pasos → reproducir → GIF) ---
    const DUR_TRANS = 900;   // ms de cada transición entre pasos
    const PAUSA = 450;       // ms de pausa al llegar a cada paso
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // gif.js se carga a demanda; su worker se baja y se pasa como blob para
    // esquivar el CORS del CDN. Se cachea entre instancias del board.
    let gifLibP = null;
    function cargarGifLib() {
        if (!gifLibP) gifLibP = (async () => {
            await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
                s.onload = res;
                s.onerror = () => rej(new Error('No se pudo cargar gif.js'));
                document.head.appendChild(s);
            });
            const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
            if (!r.ok) throw new Error('No se pudo bajar el worker de gif.js');
            return URL.createObjectURL(await r.blob());
        })().catch(e => { gifLibP = null; throw e; });
        return gifLibP;
    }

    // Rasteriza un markup SVG a imagen (blob URL, sin CORS)
    function svgAImagen(markup) {
        return new Promise((res, rej) => {
            const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); res(img); };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo rasterizar el SVG')); };
            img.src = url;
        });
    }

    TL.canchaBoard = {
        crear(contenedor, opts = {}) {
            ensureCSS();
            const editable = opts.editable !== false;

            let vista = '1';
            let objetos = [];        // incluye flechas
            let herramienta = 'jugadora';
            let seq = 0;
            let vbW = 1000, vbH = 600;
            let pasos = [];          // animación: [{ pos: { [idObjeto]: {x,y} } }]
            let reproduciendo = false;
            const nombreArchivo = (opts.nombre || 'pizarra').replace(/\s+/g, '_');

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
                    </div>
                    <div class="cb-tg">
                        <span class="cb-lbl">Líneas</span>
                        ${LINE_TOOLS.map(t => `<button class="cb-chip" data-tool="${t}"><span class="dot" style="background:${LINEAS[t].color}"></span>${LINEAS[t].nombre.replace(/^\S+\s/, '')}</button>`).join('')}
                    </div>
                    <div class="cb-tg">
                        <span class="cb-lbl">Jugada</span>
                        <button class="cb-chip" data-corner title="Arma un planteo de córner corto">⚑ Córner corto</button>
                    </div>
                    <div class="cb-tg">
                        <span class="cb-lbl">Modo</span>
                        <button class="cb-chip" data-tool="mover">✋ Mover</button>
                        <button class="cb-chip" data-tool="borrar">✕ Borrar</button>
                        <button class="cb-chip" data-vaciar>🗑 Vaciar</button>
                    </div>
                    <div class="cb-tg">
                        <span class="cb-lbl">Animación</span>
                        <button class="cb-chip" data-paso title="Guarda la posición actual como un paso">📷 Paso</button>
                        <span class="cb-lbl cb-paso-info" style="color:var(--text);">0 pasos</span>
                        <button class="cb-chip" data-paso-menos title="Quitar último paso" disabled>–</button>
                        <button class="cb-chip" data-paso-reset title="Reiniciar pasos" disabled>↺</button>
                        <button class="cb-chip" data-play disabled>▶</button>
                        <button class="cb-chip" data-gif disabled>🎞 GIF</button>
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
                const colorDe = o => (LINEAS[o.sub || 'mov'] || LINEAS.mov).color;
                const markerId = c => 'cbah' + c.replace('#', '');
                // Una punta de flecha por color usado (hereda el color de la línea)
                const colores = [...new Set(fl.map(colorDe))];
                const defs = '<defs>' + colores.map(c =>
                    `<marker id="${markerId(c)}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="${c}"/></marker>`
                ).join('') + '</defs>';
                const lineas = fl.map(o => {
                    const sub = o.sub || 'mov';
                    const col = colorDe(o);
                    const x1 = o.x1 / 100 * vbW, y1 = o.y1 / 100 * vbH, x2 = o.x2 / 100 * vbW, y2 = o.y2 / 100 * vbH;
                    if (sub === 'bloqueo') {
                        // Línea + barra perpendicular en la punta (pantalla/bloqueo)
                        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
                        const ux = dx / len, uy = dy / len, bar = 14;
                        const bx1 = (x2 - uy * bar).toFixed(1), by1 = (y2 + ux * bar).toFixed(1);
                        const bx2 = (x2 + uy * bar).toFixed(1), by2 = (y2 - ux * bar).toFixed(1);
                        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="4"/>`
                            + `<line x1="${bx1}" y1="${by1}" x2="${bx2}" y2="${by2}" stroke="${col}" stroke-width="4"/>`;
                    }
                    if (sub === 'presion') {
                        return `<path d="${wavyPath(x1, y1, x2, y2)}" fill="none" stroke="${col}" stroke-width="4" marker-end="url(#${markerId(col)})"/>`;
                    }
                    const dash = sub === 'pase' ? ' stroke-dasharray="12 9"' : '';
                    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="4"${dash} marker-end="url(#${markerId(col)})"/>`;
                }).join('');
                arrows.innerHTML = defs + lineas;
            }

            // Arma un planteo de córner corto: pelota en el punto de inyección
            // (sobre la línea de fondo), dos atacantes en el tope de la D y la
            // línea de salida (push). Se adapta a la orientación actual.
            function agregarCornerCorto() {
                // Posiciones en % según la vista (horizontal → ataca a la derecha;
                // vertical → ataca abajo).
                const V = vista === 'vertical'
                    ? { ball: [34, 96], stop: [50, 83], rem: [42, 83] }
                    : { ball: [96, 34], stop: [83, 50], rem: [83, 42] };
                const add = (tipo, xy) => {
                    const o = { id: ++seq, tipo, x: xy[0], y: xy[1] };
                    if (tipo === 'jugadora' || tipo === 'rival') o.num = proximoNumero(tipo);
                    objetos.push(o);
                };
                add('pelota', V.ball);   // pelota en la inyección
                add('jugadora', V.stop); // parada / stopper
                add('jugadora', V.rem);  // rematadora
                // Línea de salida (push) de la inyección al tope de la D
                objetos.push({ id: ++seq, tipo: 'flecha', sub: 'mov', x1: V.ball[0], y1: V.ball[1], x2: V.stop[0], y2: V.stop[1] });
                renderObjetos();
                notificar();
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
                    } else if (LINE_TOOLS.includes(herramienta)) {
                        if (e.target.closest('.cb-obj')) return;
                        const p = pos(e);
                        dibujoFlecha = { id: ++seq, tipo: 'flecha', sub: herramienta, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
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
                    pasos.forEach(p => { delete p.pos[o.id]; });   // sacarla de la animación
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
                    if (!objetos.length && !pasos.length) return;
                    if (confirm('¿Vaciar la pizarra? Se quitan todas las fichas, flechas y pasos.')) {
                        objetos = []; pasos = []; renderObjetos(); actualizarPasosUI(); notificar();
                    }
                });
                // Córner corto (planteo rápido)
                root.querySelector('[data-corner]').addEventListener('click', agregarCornerCorto);
                // Botones de animación
                root.querySelector('[data-paso]').addEventListener('click', capturarPaso);
                root.querySelector('[data-paso-menos]').addEventListener('click', () => {
                    if (reproduciendo || !pasos.length) return;
                    pasos.pop(); actualizarPasosUI(); notificar();
                });
                root.querySelector('[data-paso-reset]').addEventListener('click', () => {
                    if (reproduciendo || !pasos.length) return;
                    if (!confirm('¿Reiniciar la animación? Se borran los pasos (las fichas quedan).')) return;
                    pasos = []; actualizarPasosUI(); notificar();
                });
                root.querySelector('[data-play]').addEventListener('click', reproducir);
                root.querySelector('[data-gif]').addEventListener('click', async () => {
                    if (reproduciendo || pasos.length < 2) return;
                    const btn = root.querySelector('[data-gif]');
                    const orig = btn.textContent;
                    btn.disabled = true; btn.textContent = 'Generando…';
                    try { await exportarGif(); }
                    catch (e) { console.error('Error al generar el GIF:', e); alert('No se pudo generar el GIF. Revisá tu conexión e intentá de nuevo.'); }
                    finally { btn.disabled = false; btn.textContent = orig; actualizarPasosUI(); }
                });
                // Estado inicial de los botones
                root.querySelector('.cb-chip[data-tool="jugadora"]').classList.add('on');
                root.querySelector('.cb-chip[data-vista="1"]').classList.add('on');
            }

            // --- Animación: capturar pasos, reproducir, exportar GIF ---
            function actualizarPasosUI() {
                const info = root.querySelector('.cb-paso-info');
                if (info) info.textContent = pasos.length + (pasos.length === 1 ? ' paso' : ' pasos');
                const listo = pasos.length >= 2 && !reproduciendo;
                const set = (sel, dis) => { const b = root.querySelector(sel); if (b) b.disabled = dis; };
                set('[data-play]', !listo);
                set('[data-gif]', !listo);
                set('[data-paso-menos]', !pasos.length || reproduciendo);
                set('[data-paso-reset]', !pasos.length || reproduciendo);
                set('[data-paso]', reproduciendo);
            }

            function capturarPaso() {
                if (reproduciendo) return;
                const punt = objetos.filter(o => o.tipo !== 'flecha');
                if (!punt.length) return;
                const pos = {};
                punt.forEach(o => { pos[o.id] = { x: o.x, y: o.y }; });
                pasos.push({ pos });
                actualizarPasosUI();
                notificar();
            }

            // Posición interpolada de cada ficha entre el paso k y el k+1
            function posicionesEn(k, t) {
                const a = pasos[k].pos, b = pasos[Math.min(k + 1, pasos.length - 1)].pos;
                const out = {};
                objetos.filter(o => o.tipo !== 'flecha').forEach(o => {
                    const pa = a[o.id], pb = b[o.id];
                    if (pa && pb) out[o.id] = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
                    else if (pa) out[o.id] = pa;
                    else if (pb) out[o.id] = pb;
                });
                return out;
            }

            function aplicarPosiciones(posMap) {
                layer.querySelectorAll('.cb-obj').forEach(el => {
                    const p = posMap[el.dataset.id];
                    if (p) { el.style.left = p.x + '%'; el.style.top = p.y + '%'; }
                });
            }

            // rAF con fallback a setTimeout (no se congela en pestaña oculta)
            function tickAnim(cb) {
                let hecho = false;
                const f = () => { if (!hecho) { hecho = true; cb(performance.now()); } };
                requestAnimationFrame(f);
                setTimeout(f, 50);
            }
            function animarTransicion(k) {
                return new Promise(res => {
                    const t0 = performance.now();
                    (function frame(now) {
                        const t = Math.min(1, (now - t0) / DUR_TRANS);
                        aplicarPosiciones(posicionesEn(k, easeInOut(t)));
                        if (t < 1) tickAnim(frame); else res();
                    })(performance.now());
                });
            }
            async function reproducir() {
                if (reproduciendo || pasos.length < 2) return;
                reproduciendo = true;
                actualizarPasosUI();
                const btn = root.querySelector('[data-play]');
                if (btn) btn.textContent = '⏸';
                const backup = {};
                objetos.filter(o => o.tipo !== 'flecha').forEach(o => { backup[o.id] = { x: o.x, y: o.y }; });
                try {
                    aplicarPosiciones(posicionesEn(0, 0));
                    await espera(PAUSA);
                    for (let k = 0; k < pasos.length - 1; k++) {
                        await animarTransicion(k);
                        await espera(PAUSA);
                    }
                    await espera(300);
                } finally {
                    aplicarPosiciones(backup);
                    reproduciendo = false;
                    if (btn) btn.textContent = '▶';
                    actualizarPasosUI();
                }
            }

            // Dibuja las fichas sobre el canvas del GIF (mismo look que el DOM)
            function dibujarObjetosCanvas(ctx, posMap, esc) {
                objetos.filter(o => o.tipo !== 'flecha').forEach(o => {
                    const p = posMap[o.id] || { x: o.x, y: o.y };
                    const X = p.x / 100 * ctx.canvas.width, Y = p.y / 100 * ctx.canvas.height;
                    if (o.tipo === 'jugadora' || o.tipo === 'rival') {
                        ctx.beginPath(); ctx.arc(X, Y, 14 * esc, 0, Math.PI * 2);
                        ctx.fillStyle = COLOR[o.tipo]; ctx.fill();
                        ctx.lineWidth = 2 * esc; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
                        ctx.fillStyle = o.tipo === 'rival' ? '#06181f' : '#10130a';
                        ctx.font = `800 ${Math.round(12 * esc)}px Arial, sans-serif`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(String(o.num ?? ''), X, Y + esc);
                    } else if (o.tipo === 'pelota') {
                        ctx.beginPath(); ctx.arc(X, Y, 7 * esc, 0, Math.PI * 2);
                        ctx.fillStyle = '#fff'; ctx.fill();
                    }
                });
            }

            async function exportarGif() {
                const workerUrl = await cargarGifLib();
                const LARGO = 800;
                const W = vbW >= vbH ? LARGO : Math.round(LARGO * vbW / vbH);
                const H = Math.round(W * vbH / vbW);
                const domW = pitch.getBoundingClientRect().width || 800;
                const esc = W / domW;
                // Cancha y flechas se rasterizan una vez (son fijas)
                const canchaMarkup = (vista === 'vertical' ? svgVertical() : svgHorizontal())
                    .replace('<svg ', `<svg width="${vbW}" height="${vbH}" `);
                const canchaImg = await svgAImagen(canchaMarkup);
                const flechasImg = arrows.innerHTML.trim()
                    ? await svgAImagen(`<svg xmlns="${NS}" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">${arrows.innerHTML}</svg>`)
                    : null;
                const canvas = document.createElement('canvas');
                canvas.width = W; canvas.height = H;
                const ctx = canvas.getContext('2d');
                const gif = new GIF({ workers: 2, quality: 8, width: W, height: H, workerScript: workerUrl });
                const FPS = 15, FRAMES = Math.round(DUR_TRANS / 1000 * FPS);
                const dibujar = (posMap) => {
                    ctx.drawImage(canchaImg, 0, 0, W, H);
                    if (flechasImg) ctx.drawImage(flechasImg, 0, 0, W, H);
                    dibujarObjetosCanvas(ctx, posMap, esc);
                };
                dibujar(posicionesEn(0, 0));
                gif.addFrame(ctx, { copy: true, delay: 800 });
                for (let k = 0; k < pasos.length - 1; k++) {
                    for (let f = 1; f <= FRAMES; f++) {
                        dibujar(posicionesEn(k, easeInOut(f / FRAMES)));
                        gif.addFrame(ctx, { copy: true, delay: Math.round(1000 / FPS) });
                    }
                    gif.addFrame(ctx, { copy: true, delay: k === pasos.length - 2 ? 1200 : PAUSA });
                }
                const blob = await new Promise((res, rej) => {
                    gif.on('finished', res);
                    gif.on('abort', () => rej(new Error('Generación abortada')));
                    gif.render();
                });
                const a = document.createElement('a');
                a.download = `${nombreArchivo}.gif`;
                a.href = URL.createObjectURL(blob);
                a.click();
                URL.revokeObjectURL(a.href);
            }

            const api = {
                onChange: null,
                getDatos() {
                    // Los pasos guardan las posiciones alineadas al orden de las
                    // fichas (Firestore no permite arrays anidados → cada paso es
                    // { p: [...] } con null donde la ficha no está en ese paso).
                    const punt = objetos.filter(o => o.tipo !== 'flecha');
                    return {
                        vista,
                        objetos: objetos.map(o => o.tipo === 'flecha'
                            ? { tipo: 'flecha', sub: o.sub || 'mov', x1: +o.x1.toFixed(1), y1: +o.y1.toFixed(1), x2: +o.x2.toFixed(1), y2: +o.y2.toFixed(1) }
                            : { tipo: o.tipo, x: +o.x.toFixed(1), y: +o.y.toFixed(1), ...(o.num ? { num: o.num } : {}) }),
                        pasos: pasos.map(paso => ({
                            p: punt.map(o => paso.pos[o.id]
                                ? { x: +(+paso.pos[o.id].x).toFixed(1), y: +(+paso.pos[o.id].y).toFixed(1) }
                                : null)
                        }))
                    };
                },
                setDatos(d) {
                    d = d || {};
                    vista = d.vista === 'vertical' ? 'vertical' : '1';
                    seq = 0;
                    objetos = (d.objetos || []).map(o => ({ id: ++seq, ...o }));
                    // Reconstruir los pasos: se guardaron por índice de ficha
                    const punt = objetos.filter(o => o.tipo !== 'flecha');
                    pasos = (d.pasos || []).map(paso => {
                        const pos = {};
                        (paso.p || []).forEach((pt, i) => { if (pt && punt[i]) pos[punt[i].id] = { x: pt.x, y: pt.y }; });
                        return { pos };
                    });
                    if (editable) {
                        root.querySelectorAll('.cb-chip[data-vista]').forEach(x => x.classList.toggle('on', x.dataset.vista === vista));
                    }
                    pintarCancha();
                    renderObjetos();
                    actualizarPasosUI();
                },
                estaVacia() { return objetos.length === 0; }
            };

            pintarCancha();
            renderObjetos();
            actualizarPasosUI();
            return api;
        }
    };
})();
