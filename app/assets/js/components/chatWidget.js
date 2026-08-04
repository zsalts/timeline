// =========================================================
// components/chatWidget.js
// Chat interno del club como burbuja flotante (esquina inferior derecha).
// Lo monta ui.js en todas las páginas del shell: el chat viaja con el
// usuario en vez de vivir en una página aparte.
//
// El panel tiene dos vistas: la lista (conversaciones + gente del club) y
// el hilo abierto. La burbuja muestra cuántas conversaciones tienen
// mensajes sin leer.
// =========================================================
import {
    db, collection, doc, getDocs, setDoc, addDoc,
    query, where, orderBy, limit, onSnapshot, serverTimestamp
} from '../firebase.js';

const uid = sessionStorage.getItem('usuarioUID');
const clubId = sessionStorage.getItem('clubID');
// Sin sesión de club (o siendo super-admin) no hay chat que mostrar.
if (uid && clubId) montar();

function montar() {

    const ROLES = {
        'club-admin': 'Administradora del club',
        trainer: 'Entrenadora',
        coordinator: 'Coordinadora',
        analyst: 'Analista',
        player: 'Jugadora'
    };

    let personas = [];          // gente del club (sin mí)
    let conversaciones = [];    // mis conversaciones
    let convActual = null;      // { id, otroUid }
    let cortarMensajes = null;  // corta el onSnapshot del hilo abierto
    let cortarConvs = null;
    let hiloVivo = false;       // ¿la suscripción al hilo sigue en pie?
    let personasCargadas = false;
    let abierto = false;

    const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

    // El id de la conversación se deriva de los dos uid ordenados, así los
    // dos lados calculan el MISMO id y no se crean dos hilos paralelos.
    const idConversacion = (a, b) => `${clubId}__${[a, b].sort().join('_')}`;

    const segundos = ts => (ts && ts.seconds) || 0;

    function hora(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    }

    // --- Sin leer -------------------------------------------------------
    // No hay acuse de recibo en Firestore: alcanza con recordar en este
    // navegador hasta qué momento vi cada conversación.
    const CLAVE_VISTO = 'chatVisto';
    function vistos() {
        try { return JSON.parse(localStorage.getItem(CLAVE_VISTO) || '{}'); }
        catch (e) { return {}; }
    }
    function marcarVisto(convId, hasta) {
        const v = vistos();
        v[convId] = hasta || Math.floor(Date.now() / 1000);
        try { localStorage.setItem(CLAVE_VISTO, JSON.stringify(v)); } catch (e) { /* sin espacio */ }
    }
    // Sin leer = el último mensaje lo mandó el otro y llegó después de mi
    // última visita al hilo.
    function sinLeer(c) {
        if (!c.ultimo || c.ultimo.de === uid) return false;
        return segundos(c.actualizado_en) > (vistos()[c.id] || 0);
    }

    // --- Markup ---------------------------------------------------------
    const ICO_CHAT = '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.5-4.4A8.4 8.4 0 0 1 3.6 11.5a8.4 8.4 0 0 1 8.4-8.4h.5a8.4 8.4 0 0 1 8.5 8.4z"/>';
    const svg = (paths, clase) => `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

    const host = document.createElement('div');
    host.className = 'chat-widget';
    host.innerHTML = `
        <section class="chat-panel" id="chat-panel" aria-label="Chat interno del club" hidden>
            <header class="chat-panel-head">
                <button type="button" class="chat-icon-btn" id="chat-volver" aria-label="Volver a la lista" hidden>
                    ${svg('<path d="M15 18l-6-6 6-6"/>', 'chat-ico')}
                </button>
                <span class="chat-avatar" id="chat-head-avatar" hidden></span>
                <div class="chat-head-datos">
                    <div class="chat-head-nombre" id="chat-head-nombre">Mensajes</div>
                    <div class="chat-head-sub" id="chat-head-sub">Chat interno del club</div>
                </div>
                <button type="button" class="chat-icon-btn" id="chat-cerrar" aria-label="Cerrar el chat">
                    ${svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 'chat-ico')}
                </button>
            </header>

            <div class="chat-vista" id="chat-lista">
                <h3>Conversaciones</h3>
                <div id="chat-convs"><p class="chat-nota">Cargando…</p></div>
                <h3>Gente del club</h3>
                <div id="chat-personas"><p class="chat-nota">Cargando…</p></div>
            </div>

            <div class="chat-vista chat-hilo" id="chat-hilo" hidden>
                <div class="chat-mensajes" id="chat-mensajes"></div>
                <form class="chat-form" id="chat-form">
                    <textarea id="chat-texto" placeholder="Escribí tu mensaje…" maxlength="2000" rows="1"></textarea>
                    <button type="submit" class="chat-enviar" id="chat-enviar" aria-label="Enviar">
                        ${svg('<path d="M4 12l16-8-6 16-2.5-6z"/>', 'chat-ico')}
                    </button>
                </form>
            </div>
        </section>

        <button type="button" class="chat-fab" id="chat-fab" aria-label="Abrir el chat" aria-expanded="false" aria-controls="chat-panel">
            ${svg(ICO_CHAT, 'chat-ico chat-ico-abrir')}
            ${svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 'chat-ico chat-ico-cerrar')}
            <span class="chat-badge" id="chat-badge" hidden></span>
        </button>
    `;
    document.body.appendChild(host);

    const $ = id => document.getElementById(id);

    // --- Abrir / cerrar el panel ---------------------------------------
    function alternar(abrir) {
        abierto = abrir;
        $('chat-panel').hidden = !abrir;
        $('chat-fab').setAttribute('aria-expanded', String(abrir));
        $('chat-fab').setAttribute('aria-label', abrir ? 'Cerrar el chat' : 'Abrir el chat');
        host.classList.toggle('abierto', abrir);
        if (!abrir) return;
        // La gente del club se pide recién al abrir: en la mayoría de las
        // visitas el chat ni se toca y no hace falta leer los usuarios.
        if (!personasCargadas) cargarPersonas();
        if (convActual) $('chat-texto').focus();
    }

    $('chat-fab').addEventListener('click', () => alternar(!abierto));
    $('chat-cerrar').addEventListener('click', () => alternar(false));
    $('chat-volver').addEventListener('click', volverALista);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && abierto) { alternar(false); $('chat-fab').focus(); }
    });

    // --- Gente del club --------------------------------------------------
    async function cargarPersonas() {
        const cont = $('chat-personas');
        try {
            const snap = await getDocs(query(collection(db, 'usuarios'), where('club_id', '==', clubId)));
            personas = [];
            snap.forEach(d => { if (d.id !== uid) personas.push({ uid: d.id, ...d.data() }); });
            personas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
            personasCargadas = true;

            cont.innerHTML = '';
            if (!personas.length) {
                cont.appendChild(nota('Todavía no hay nadie más en el club.'));
            } else {
                personas.forEach(p => cont.appendChild(filaPersona(p, ROLES[p.rol] || p.rol)));
            }
            pintarConversaciones();   // ahora sí hay nombres y roles frescos
        } catch (e) {
            console.error('Error al cargar la gente del club:', e);
            cont.innerHTML = '';
            cont.appendChild(nota('No se pudo cargar la lista.'));
        }
    }

    function nota(texto) {
        const p = document.createElement('p');
        p.className = 'chat-nota';
        p.textContent = texto;
        return p;
    }

    // Fila clickeable de persona/conversación. Se arma con textContent: los
    // nombres y los últimos mensajes los escribe el usuario.
    function filaPersona(p, sub, marca) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chat-persona' + (convActual && convActual.otroUid === p.uid ? ' activa' : '');

        const av = document.createElement('span');
        av.className = 'chat-avatar';
        av.textContent = iniciales(p.nombre || p.email);

        const datos = document.createElement('span');
        datos.className = 'chat-persona-datos';
        const nom = document.createElement('span');
        nom.className = 'chat-persona-nombre';
        nom.textContent = p.nombre || p.email || 'Sin nombre';
        const sb = document.createElement('span');
        sb.className = 'chat-persona-sub';
        sb.textContent = sub || '';
        datos.append(nom, sb);

        b.append(av, datos);
        if (marca) {
            const punto = document.createElement('span');
            punto.className = 'chat-punto';
            b.appendChild(punto);
        }
        b.addEventListener('click', () => abrirConversacion(p.uid));
        return b;
    }

    // --- Mis conversaciones, en vivo -------------------------------------
    function escucharConversaciones() {
        // Sin orderBy a propósito: array-contains + orderBy pide un índice
        // compuesto. Son pocas conversaciones, se ordenan acá.
        const q = query(collection(db, 'conversaciones'), where('participantes', 'array-contains', uid));
        cortarConvs = onSnapshot(q, (snap) => {
            conversaciones = [];
            snap.forEach(d => conversaciones.push({ id: d.id, ...d.data() }));
            conversaciones.sort((a, b) => segundos(b.actualizado_en) - segundos(a.actualizado_en));
            // Con el hilo abierto lo que llega ya lo estoy viendo.
            if (convActual && abierto) {
                const c = conversaciones.find(x => x.id === convActual.id);
                if (c) marcarVisto(c.id, segundos(c.actualizado_en));
            }
            pintarConversaciones();
            pintarBadge();
        }, (e) => {
            console.error('Error al escuchar conversaciones:', e);
            $('chat-convs').innerHTML = '';
            $('chat-convs').appendChild(nota('No se pudieron cargar.'));
        });
    }

    function pintarConversaciones() {
        const cont = $('chat-convs');
        cont.innerHTML = '';
        if (!conversaciones.length) {
            cont.appendChild(nota('Todavía no tenés conversaciones.'));
            return;
        }
        conversaciones.forEach(c => {
            const otroUid = (c.participantes || []).find(x => x !== uid);
            const p = personas.find(x => x.uid === otroUid)
                || { uid: otroUid, nombre: (c.nombres || {})[otroUid] || 'Alguien' };
            const ultimo = c.ultimo ? `${c.ultimo.de === uid ? 'Vos: ' : ''}${c.ultimo.texto}` : '';
            cont.appendChild(filaPersona(p, ultimo, sinLeer(c)));
        });
    }

    function pintarBadge() {
        const n = conversaciones.filter(sinLeer).length;
        const badge = $('chat-badge');
        badge.hidden = n === 0;
        badge.textContent = n > 9 ? '9+' : String(n);
        host.classList.toggle('con-pendientes', n > 0);
    }

    // --- Abrir / crear la conversación con alguien -----------------------
    function abrirConversacion(otroUid) {
        const convId = idConversacion(uid, otroUid);
        convActual = { id: convId, otroUid };

        const c = conversaciones.find(x => x.id === convId);
        marcarVisto(convId, c ? segundos(c.actualizado_en) : undefined);

        const p = personas.find(x => x.uid === otroUid)
            || { nombre: (c && (c.nombres || {})[otroUid]) || 'Alguien' };
        $('chat-head-avatar').textContent = iniciales(p.nombre || p.email);
        $('chat-head-avatar').hidden = false;
        $('chat-head-nombre').textContent = p.nombre || p.email || 'Sin nombre';
        $('chat-head-sub').textContent = ROLES[p.rol] || p.rol || '';
        $('chat-volver').hidden = false;
        $('chat-lista').hidden = true;
        $('chat-hilo').hidden = false;
        $('chat-mensajes').innerHTML = '';

        pintarBadge();
        escucharMensajes(convId);
        $('chat-texto').focus();
    }

    function volverALista() {
        if (cortarMensajes) { cortarMensajes(); cortarMensajes = null; }
        convActual = null;
        hiloVivo = false;
        $('chat-volver').hidden = true;
        $('chat-head-avatar').hidden = true;
        $('chat-head-nombre').textContent = 'Mensajes';
        $('chat-head-sub').textContent = 'Chat interno del club';
        $('chat-hilo').hidden = true;
        $('chat-lista').hidden = false;
        pintarConversaciones();
    }

    // Escucha el hilo en vivo. Ojo: si la conversación todavía NO existe, la
    // regla de 'mensajes' hace un get() sobre un documento inexistente, eso
    // da permission-denied y Firestore CANCELA la suscripción para siempre.
    // Por eso se marca hiloVivo=false y se vuelve a enganchar después del
    // primer mensaje (cuando la conversación ya quedó creada).
    function escucharMensajes(convId) {
        if (cortarMensajes) cortarMensajes();
        hiloVivo = true;
        const q = query(collection(db, 'conversaciones', convId, 'mensajes'), orderBy('en', 'asc'), limit(200));
        cortarMensajes = onSnapshot(q, (snap) => {
            const cont = $('chat-mensajes');
            cont.innerHTML = '';
            snap.forEach(d => {
                const m = d.data();
                const div = document.createElement('div');
                div.className = 'chat-burbuja ' + (m.de === uid ? 'mia' : 'suya');
                div.textContent = m.texto;
                const h = document.createElement('span');
                h.className = 'chat-burbuja-hora';
                h.textContent = hora(m.en);
                div.appendChild(h);
                cont.appendChild(div);
            });
            cont.scrollTop = cont.scrollHeight;
        }, (e) => {
            hiloVivo = false;
            if (e.code !== 'permission-denied') console.error('Error en el hilo:', e);
        });
    }

    // --- Enviar ----------------------------------------------------------
    $('chat-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const texto = $('chat-texto').value.trim();
        if (!texto || !convActual) return;

        const btn = $('chat-enviar');
        btn.disabled = true;
        try {
            const convRef = doc(db, 'conversaciones', convActual.id);
            const otro = personas.find(x => x.uid === convActual.otroUid) || {};
            const resumen = {
                club_id: clubId,
                participantes: [uid, convActual.otroUid].sort(),
                nombres: {
                    [uid]: sessionStorage.getItem('userNombre') || sessionStorage.getItem('userEmail') || '',
                    [convActual.otroUid]: otro.nombre || otro.email || ''
                },
                ultimo: { texto: texto.slice(0, 120), de: uid },
                actualizado_en: serverTimestamp()
            };

            // La primera vez crea la conversación; después solo actualiza el
            // resumen. setDoc con merge sirve para los dos casos.
            await setDoc(convRef, resumen, { merge: true });
            await addDoc(collection(db, 'conversaciones', convActual.id, 'mensajes'), {
                de: uid, texto, en: serverTimestamp()
            });

            $('chat-texto').value = '';
            $('chat-texto').style.height = 'auto';

            // Si la suscripción se había caído porque la conversación no
            // existía, ahora sí existe: volvemos a engancharla.
            if (!hiloVivo) escucharMensajes(convActual.id);
        } catch (e) {
            console.error('Error al enviar el mensaje:', e);
            alert('No se pudo enviar el mensaje.');
        } finally {
            btn.disabled = false;
            $('chat-texto').focus();
        }
    });

    // Enter envía, Shift+Enter hace salto de línea
    $('chat-texto').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            $('chat-form').requestSubmit();
        }
    });
    // El textarea crece con el texto
    $('chat-texto').addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
    });

    window.addEventListener('beforeunload', () => {
        if (cortarMensajes) cortarMensajes();
        if (cortarConvs) cortarConvs();
    });

    escucharConversaciones();
}
