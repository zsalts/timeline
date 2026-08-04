// =========================================================
// components/chatWidget.js
// Chat como burbuja flotante (esquina inferior derecha). Lo monta ui.js en
// todas las páginas del shell: el chat viaja con el usuario en vez de vivir
// en una página aparte.
//
// El panel tiene dos vistas: la lista (tu usuario + buscador + conversaciones
// + gente del club) y el hilo abierto. La burbuja muestra cuántas
// conversaciones tienen mensajes sin leer.
//
// El chat cruza clubes: a la gente del propio club la ves listada, y a la de
// otros clubes la encontrás buscando su usuario público (el 'alias': un doc
// por usuario en la colección 'alias', donde el id ES el usuario). No hay
// directorio global a propósito.
// =========================================================
import {
    db, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
    query, orderBy, limit, onSnapshot, serverTimestamp, where, miembrosDelClub
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

    // El usuario va en minúsculas, arranca con letra y mide de 3 a 20.
    // Tiene que coincidir con la regla de firestore.rules (match /alias/{alias}).
    const RE_USUARIO = /^[a-z][a-z0-9._-]{2,19}$/;

    let personas = [];          // gente de MI club (sin mí)
    let conversaciones = [];    // mis conversaciones (de cualquier club)
    let convActual = null;      // { id, otro: {uid, nombre, club_id, ...} }
    let cortarMensajes = null;  // corta el onSnapshot del hilo abierto
    let cortarConvs = null;
    let hiloVivo = false;       // ¿la suscripción al hilo sigue en pie?
    let perfilCargado = false;
    let abierto = false;
    // Mi ficha, para firmar las conversaciones y mostrar mi usuario.
    let yo = { nombre: sessionStorage.getItem('userEmail') || '', usuario: '' };

    let miClub = '';
    try { miClub = (JSON.parse(sessionStorage.getItem('configClub') || '{}').nombre) || ''; }
    catch (e) { /* sin config: se muestra sin nombre de club */ }

    const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    const segundos = ts => (ts && ts.seconds) || 0;

    // El id de la conversación se deriva de los dos uid ordenados, así los dos
    // lados calculan el MISMO id y no se crean dos hilos paralelos. Dentro de
    // un club se conserva el prefijo histórico (club__uidA_uidB) para no
    // perder las conversaciones que ya existían; entre clubes distintos no hay
    // un club que sirva de prefijo y van con 'xc'.
    function idConversacion(otroUid, otroClub) {
        const par = [uid, otroUid].sort().join('_');
        return otroClub === clubId ? `${clubId}__${par}` : `xc__${par}`;
    }

    // Si ya tengo una conversación con esa persona, es ESA. Calcular el id de
    // cero abriría un hilo vacío cuando el prefijo no coincide: pasa con las
    // conversaciones viejas y con quien trabaja para varios clubes (el hilo
    // nació en un club y ahora tiene abierto otro).
    function idParaChatCon(otroUid, otroClub) {
        const existente = conversaciones.find(c => (c.participantes || []).includes(otroUid));
        return existente ? existente.id : idConversacion(otroUid, otroClub);
    }

    // Club de un participante dentro de una conversación. Las conversaciones
    // viejas no tienen 'clubes': eran siempre entre gente del mismo club.
    function clubEnConv(c, quien) {
        const i = (c.participantes || []).indexOf(quien);
        if (Array.isArray(c.clubes) && c.clubes[i]) return c.clubes[i];
        return c.club_id || clubId;
    }

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
    const ICO_CRUZ = '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>';
    const svg = (paths, clase) => `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

    const host = document.createElement('div');
    host.className = 'chat-widget';
    host.innerHTML = `
        <section class="chat-panel" id="chat-panel" aria-label="Chat" hidden>
            <header class="chat-panel-head">
                <button type="button" class="chat-icon-btn" id="chat-volver" aria-label="Volver a la lista" hidden>
                    ${svg('<path d="M15 18l-6-6 6-6"/>', 'chat-ico')}
                </button>
                <span class="chat-avatar" id="chat-head-avatar" hidden></span>
                <div class="chat-head-datos">
                    <div class="chat-head-nombre" id="chat-head-nombre">Mensajes</div>
                    <div class="chat-head-sub" id="chat-head-sub">Tu club y quien encuentres por su usuario</div>
                </div>
                <button type="button" class="chat-icon-btn" id="chat-cerrar" aria-label="Cerrar el chat">
                    ${svg(ICO_CRUZ, 'chat-ico')}
                </button>
            </header>

            <div class="chat-vista" id="chat-lista">
                <div class="chat-yo" id="chat-yo">
                    <span class="chat-yo-label">Tu usuario</span>
                    <span class="chat-yo-usuario" id="chat-mi-usuario">—</span>
                    <button type="button" class="chat-link" id="chat-editar-usuario">Elegir</button>
                </div>
                <form class="chat-mini-form" id="chat-form-usuario" hidden>
                    <input id="chat-input-usuario" maxlength="20" autocomplete="off" spellcheck="false" placeholder="tu.usuario" aria-label="Tu usuario">
                    <button type="submit" class="chat-mini-btn">Guardar</button>
                    <button type="button" class="chat-link" id="chat-cancelar-usuario">Cancelar</button>
                </form>

                <form class="chat-mini-form" id="chat-form-buscar">
                    <input id="chat-input-buscar" maxlength="21" autocomplete="off" spellcheck="false" placeholder="Buscar a alguien por su usuario" aria-label="Buscar por usuario">
                    <button type="submit" class="chat-mini-btn">Buscar</button>
                </form>
                <p class="chat-aviso" id="chat-aviso" hidden></p>

                <h3>Conversaciones</h3>
                <div id="chat-convs"><p class="chat-nota">Cargando…</p></div>
                <h3>Gente de tu club</h3>
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
            ${svg(ICO_CRUZ, 'chat-ico chat-ico-cerrar')}
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
        // Mi ficha y la gente del club se piden recién al abrir: en la mayoría
        // de las visitas el chat ni se toca y no hace falta leerlas.
        if (!perfilCargado) { perfilCargado = true; cargarPerfil(); cargarPersonas(); }
        if (convActual) $('chat-texto').focus();
    }

    $('chat-fab').addEventListener('click', () => alternar(!abierto));
    $('chat-cerrar').addEventListener('click', () => alternar(false));
    $('chat-volver').addEventListener('click', volverALista);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && abierto) { alternar(false); $('chat-fab').focus(); }
    });

    // --- Mi ficha y mi usuario ---------------------------------------------
    async function cargarPerfil() {
        try {
            const snap = await getDoc(doc(db, 'usuarios', uid));
            if (snap.exists()) {
                const d = snap.data();
                yo = { nombre: d.nombre || d.email || yo.nombre, usuario: d.usuario || '' };
            }
        } catch (e) {
            console.error('Error al cargar mi ficha:', e);
        }
        pintarMiUsuario();
    }

    function pintarMiUsuario() {
        $('chat-mi-usuario').textContent = yo.usuario ? '@' + yo.usuario : 'sin usuario';
        $('chat-mi-usuario').classList.toggle('vacio', !yo.usuario);
        $('chat-editar-usuario').textContent = yo.usuario ? 'Cambiar' : 'Elegir';
    }

    // Sugerencia a partir del nombre: "Ana Pérez" → "ana.perez"
    function sugerirUsuario() {
        const base = (yo.nombre || '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')   // saca los acentos
            .toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '.')
            .replace(/^[^a-z]+|\.+$/g, '');
        return RE_USUARIO.test(base) ? base : '';
    }

    $('chat-editar-usuario').addEventListener('click', () => {
        $('chat-form-usuario').hidden = false;
        $('chat-input-usuario').value = yo.usuario || sugerirUsuario();
        $('chat-input-usuario').focus();
        $('chat-input-usuario').select();
    });
    $('chat-cancelar-usuario').addEventListener('click', () => { $('chat-form-usuario').hidden = true; });

    $('chat-form-usuario').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const nuevo = $('chat-input-usuario').value.trim().toLowerCase().replace(/^@/, '');
        if (nuevo === yo.usuario) { $('chat-form-usuario').hidden = true; return; }
        if (!RE_USUARIO.test(nuevo)) {
            avisar('El usuario va en minúsculas, empieza con letra y tiene entre 3 y 20 caracteres (letras, números, . _ -).', true);
            return;
        }
        const anterior = yo.usuario;
        try {
            // Si el usuario ya es de otra persona esto entra por 'update' y las
            // reglas lo rechazan: por eso "ocupado" se detecta como
            // permission-denied y no hace falta leerlo antes.
            await setDoc(doc(db, 'alias', nuevo), {
                uid, nombre: yo.nombre, club_id: clubId, club: miClub, en: serverTimestamp()
            });
            await updateDoc(doc(db, 'usuarios', uid), { usuario: nuevo });
            yo.usuario = nuevo;
            // Soltar el anterior recién cuando el nuevo quedó tomado.
            if (anterior) { try { await deleteDoc(doc(db, 'alias', anterior)); } catch (e) { /* ya no estaba */ } }
            $('chat-form-usuario').hidden = true;
            pintarMiUsuario();
            avisar(`Listo: ahora te encuentran como @${nuevo}.`);
        } catch (e) {
            if (e.code === 'permission-denied') avisar('Ese usuario ya está tomado, probá con otro.', true);
            else { console.error('Error al guardar el usuario:', e); avisar('No se pudo guardar el usuario.', true); }
        }
    });

    // --- Buscar a alguien por su usuario -----------------------------------
    $('chat-form-buscar').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const buscado = $('chat-input-buscar').value.trim().toLowerCase().replace(/^@/, '');
        if (!buscado) return;
        if (!RE_USUARIO.test(buscado)) { avisar('Ese usuario no existe.', true); return; }
        try {
            const snap = await getDoc(doc(db, 'alias', buscado));
            if (!snap.exists()) { avisar(`No hay nadie con el usuario @${buscado}.`, true); return; }
            const d = snap.data();
            if (d.uid === uid) { avisar('Ese sos vos.', true); return; }
            $('chat-input-buscar').value = '';
            avisar('');
            abrirConversacion({ uid: d.uid, nombre: d.nombre, club_id: d.club_id, club: d.club });
        } catch (e) {
            console.error('Error al buscar el usuario:', e);
            avisar('No se pudo buscar.', true);
        }
    });

    function avisar(texto, esError) {
        const p = $('chat-aviso');
        p.textContent = texto || '';
        p.hidden = !texto;
        p.classList.toggle('error', !!esError);
    }

    // --- Gente de mi club --------------------------------------------------
    async function cargarPersonas() {
        const cont = $('chat-personas');
        try {
            // Incluye a quien está de invitada desde otro club (analistas), no
            // solo a los que tienen este club como principal.
            personas = (await miembrosDelClub(clubId))
                .filter(m => m.id !== uid)
                .map(m => ({ ...m, uid: m.id, club_id: clubId }));
            personas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

            cont.innerHTML = '';
            if (!personas.length) {
                cont.appendChild(nota('Todavía no hay nadie más en tu club. Buscá a alguien por su usuario.'));
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
        b.className = 'chat-persona' + (convActual && convActual.otro.uid === p.uid ? ' activa' : '');

        const av = document.createElement('span');
        av.className = 'chat-avatar';
        av.textContent = iniciales(p.nombre || p.email);

        const datos = document.createElement('span');
        datos.className = 'chat-persona-datos';
        const nom = document.createElement('span');
        nom.className = 'chat-persona-nombre';
        nom.textContent = p.nombre || p.email || 'Sin nombre';
        if (p.club_id && p.club_id !== clubId) {
            const chip = document.createElement('span');
            chip.className = 'chat-chip';
            chip.textContent = 'otro club';
            nom.appendChild(chip);
        }
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
        b.addEventListener('click', () => abrirConversacion(p));
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

    // Con quién es una conversación, con lo que se sepa de esa persona: la
    // ficha del club si es del club, y si no lo que quedó cacheado en la
    // conversación (quien la usa puede ser de otro club y no está en 'personas').
    function otroDe(c) {
        const otroUid = (c.participantes || []).find(x => x !== uid);
        const club = clubEnConv(c, otroUid);
        const dePersonas = personas.find(x => x.uid === otroUid);
        if (dePersonas) return dePersonas;
        return {
            uid: otroUid,
            club_id: club,
            nombre: (c.nombres || {})[otroUid] || 'Alguien',
            club: (c.clubes_nombres || {})[club] || ''
        };
    }

    function pintarConversaciones() {
        const cont = $('chat-convs');
        cont.innerHTML = '';
        if (!conversaciones.length) {
            cont.appendChild(nota('Todavía no tenés conversaciones.'));
            return;
        }
        conversaciones.forEach(c => {
            const ultimo = c.ultimo ? `${c.ultimo.de === uid ? 'Vos: ' : ''}${c.ultimo.texto}` : '';
            cont.appendChild(filaPersona(otroDe(c), ultimo, sinLeer(c)));
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
    function abrirConversacion(p) {
        const otroClub = p.club_id || clubId;
        const convId = idParaChatCon(p.uid, otroClub);
        convActual = { id: convId, otro: { ...p, club_id: otroClub } };

        const c = conversaciones.find(x => x.id === convId);
        marcarVisto(convId, c ? segundos(c.actualizado_en) : undefined);

        // El subtítulo dice el rol si es del club, y de qué club es si no.
        const sub = otroClub === clubId
            ? (ROLES[p.rol] || p.rol || '')
            : (p.club || (c && (c.clubes_nombres || {})[otroClub]) || 'De otro club');

        $('chat-head-avatar').textContent = iniciales(p.nombre || p.email);
        $('chat-head-avatar').hidden = false;
        $('chat-head-nombre').textContent = p.nombre || p.email || 'Sin nombre';
        $('chat-head-sub').textContent = sub;
        $('chat-volver').hidden = false;
        $('chat-lista').hidden = true;
        $('chat-hilo').hidden = false;
        $('chat-mensajes').innerHTML = '';

        pintarBadge();
        escucharMensajes(convId);
        if (abierto) $('chat-texto').focus();
    }

    function volverALista() {
        if (cortarMensajes) { cortarMensajes(); cortarMensajes = null; }
        convActual = null;
        hiloVivo = false;
        $('chat-volver').hidden = true;
        $('chat-head-avatar').hidden = true;
        $('chat-head-nombre').textContent = 'Mensajes';
        $('chat-head-sub').textContent = 'Tu club y quien encuentres por su usuario';
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
            const otro = convActual.otro;
            const convRef = doc(db, 'conversaciones', convActual.id);
            const participantes = [uid, otro.uid].sort();
            // 'clubes' va en el mismo orden que 'participantes': es lo que
            // validan las reglas para saber que la conversación no miente
            // sobre de qué club es cada uno. Si el hilo ya existe manda el club
            // con el que nació, no el que tengo abierto ahora.
            const c = conversaciones.find(x => x.id === convActual.id);
            const clubMio = c ? clubEnConv(c, uid) : clubId;
            const clubOtro = c ? clubEnConv(c, otro.uid) : otro.club_id;
            const clubes = participantes.map(p => (p === uid ? clubMio : clubOtro));

            const resumen = {
                participantes,
                clubes,
                // El nombre de mi club lo escribo yo; el del otro lo escribe
                // el otro al contestar. Así cada lado sabe con qué club habla
                // sin poder leer la ficha del club ajeno.
                clubes_nombres: { [clubId]: miClub },
                nombres: {
                    [uid]: yo.nombre,
                    [otro.uid]: otro.nombre || otro.email || ''
                },
                ultimo: { texto: texto.slice(0, 120), de: uid },
                actualizado_en: serverTimestamp()
            };
            // club_id marca las conversaciones internas de un club (es lo que
            // mira el borrado de club en admin). En las que cruzan clubes no
            // va: no hay un club dueño.
            if (otro.club_id === clubId) resumen.club_id = clubId;

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
