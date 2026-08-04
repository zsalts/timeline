// =========================================================
// components/ui.js
// Monta la barra lateral de navegación (shell de la app).
// Uso en cada página:
//   <div id="sidebar-root" data-active="historial"></div>
//   <script src="../assets/js/components/ui.js"></script>
// data-active marca el link resaltado:
//   historial | carga | comparar | video | estadisticas | usuarios
// =========================================================
(function () {
    const root = document.getElementById('sidebar-root');
    if (!root) return;

    const active = root.getAttribute('data-active') || '';

    // Rutas: la raíz (app/) es la landing pública; todas las páginas de la
    // app viven en app/pages/. toRoot solo se usa para /assets.
    const enPages = window.location.pathname.includes('/pages/');
    const toRoot = enPages ? '../' : '';        // para /assets
    const toPage = enPages ? '' : 'pages/';      // para páginas dentro de /pages/

    // Marca del club (nombre) desde la sesión.
    // Nombre y email se escapan acá porque más abajo entran en el HTML de la
    // barra, que se arma con template literals: los pone el usuario y esta
    // barra se dibuja en todas las páginas.
    let nombreClub = 'Timeline';
    try {
        const cfg = JSON.parse(sessionStorage.getItem('configClub') || '{}');
        if (cfg.nombre) nombreClub = TL.esc(cfg.nombre);
    } catch (e) { /* sin config: nombre por defecto */ }

    const clubActivo = sessionStorage.getItem('clubID') || '';

    const email = TL.esc(sessionStorage.getItem('userEmail') || '');
    const esClubAdmin = sessionStorage.getItem('isClubAdmin') === 'true';
    // Las jugadoras son espectadoras: ven los partidos pero no cargan
    const esJugadora = sessionStorage.getItem('userRole') === 'player';
    // Los ejercicios/entrenamientos son solo del cuerpo técnico (entrenador,
    // coordinador) más quien manda en el club abierto: si creaste el club,
    // cargás entrenamiento ahí aunque tu rol de cuenta diga "analista".
    // Tiene que dar lo mismo que esStaffDe() en firestore.rules; si no, la
    // barra esconde algo que las reglas sí dejan hacer.
    const rolActual = sessionStorage.getItem('userRole');
    const esEntrenador = rolActual === 'trainer' || rolActual === 'coordinator'
        || rolActual === 'club-admin' || esClubAdmin;
    // Qué habilita el plan del club: el editor de cancha es de los planes con
    // táctica (Pizarrón/Ultra) y los partidos NO están en el plan Pizarrón.
    // Se resuelve con TL.planes si está cargado; si no, se mira el plan directo.
    let puedeEjercicios = false;
    let puedePartidos = true;
    try {
        if (window.TL && window.TL.planes) {
            puedeEjercicios = window.TL.planes.puedeActual('editor_cancha');
            puedePartidos = window.TL.planes.puedeActual('partidos');
        } else {
            const cfg = JSON.parse(sessionStorage.getItem('configClub') || '{}');
            const plan = (cfg.plan || 'free').toLowerCase();
            puedeEjercicios = plan === 'ultra' || plan === 'pizarron';
            puedePartidos = plan !== 'pizarron';
        }
    } catch (e) { /* sin config: sin acceso */ }
    // "Contexto de partido": al abrir un partido aparecen Video y Estadísticas
    const hayPartido = !!sessionStorage.getItem('partidoSeleccionadoId');

    // A dónde lleva tocar la marca: la misma "casa" a la que entra el usuario
    // al loguearse (ver paginaInicio() en login.html). Con partidos es el
    // historial; en el plan Pizarrón no hay partidos y la casa es
    // Entrenamientos. El chat no es una casa posible: vive en la burbuja
    // flotante, no en una página.
    const inicio = puedePartidos ? `${toPage}historial.html` : `${toPage}entrenamientos.html`;

    // Íconos (SVG stroke, heredan color con currentColor)
    const ICON = {
        historial: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 3"/>',
        carga: '<path d="M12 5v14"/><path d="M5 12h14"/>',
        comparar: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
        entrenamientos: '<path d="M6.5 6.5 17.5 17.5"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 9l3-3-3-3"/><path d="M6 15l-3 3 3 3"/><path d="M9 18l6-6"/>',
        ejercicios: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><circle cx="12" cy="12" r="2.5"/>',
        tacticas: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M7.6 8.5 10.8 15.4"/><path d="M16.4 8.5 13.2 15.4"/>',
        video: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>',
        estadisticas: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
        usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    };
    const icono = id => `<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id] || ''}</svg>`;

    // Navegación agrupada por secciones. Cada grupo se muestra solo si tiene
    // links visibles según rol/plan/contexto.
    const grupos = [];

    // Partidos: lo básico que ve todo el mundo (las jugadoras solo el
    // historial). El plan Pizarrón no incluye partidos: no se muestra nada.
    if (puedePartidos) {
        const partidos = [{ id: 'historial', href: `${toPage}historial.html`, label: 'Historial' }];
        if (!esJugadora) {
            partidos.push({ id: 'carga', href: `${toPage}carga.html`, label: 'Cargar partido' });
            partidos.push({ id: 'comparar', href: `${toPage}comparar.html`, label: 'Comparar' });
        }
        grupos.push({ titulo: 'Partidos', items: partidos });
    }

    // El chat interno no está en la navegación: es la burbuja flotante de
    // abajo a la derecha (components/chatWidget.js), igual en todas las páginas.

    // Entrenamiento (planes con táctica: Pizarrón/Ultra + solo cuerpo técnico)
    if (!esJugadora && puedeEjercicios && esEntrenador) {
        grupos.push({
            titulo: 'Entrenamiento', items: [
                { id: 'entrenamientos', href: `${toPage}entrenamientos.html`, label: 'Entrenamientos' },
                { id: 'ejercicios', href: `${toPage}ejercicios.html`, label: 'Ejercicios' },
                { id: 'tacticas', href: `${toPage}tacticas.html`, label: 'Táctica' }
            ]
        });
    }

    // Contexto del partido abierto: Video (+ Estadísticas para el cuerpo técnico)
    if (hayPartido && puedePartidos) {
        const abierto = [{ id: 'video', href: `${toPage}video.html`, label: 'Video' }];
        if (!esJugadora) abierto.push({ id: 'estadisticas', href: `${toPage}estadisticas.html`, label: 'Estadísticas' });
        grupos.push({ titulo: 'Partido abierto', items: abierto });
    }

    // Administración del club
    if (esClubAdmin) {
        grupos.push({ titulo: 'Administración', items: [{ id: 'usuarios', href: `${toPage}gestion-usuarios.html`, label: 'Usuarios' }] });
    }

    const linkHTML = l => `<a href="${l.href}" class="nav-link ${l.id === active ? 'active' : ''}">${icono(l.id)}<span>${l.label}</span></a>`;
    const grupoHTML = g => `
        <div class="nav-group">
            <div class="nav-group-label">${g.titulo}</div>
            ${g.items.map(linkHTML).join('')}
        </div>`;

    // Selector de club: solo aparece si la persona trabaja para más de uno
    // (una analista que sigue a varios clubes). Los nombres salen de un cache
    // en sessionStorage; los que falten se piden y se completan después, así
    // dibujar la barra nunca espera a la red.
    const misClubes = (() => {
        try { return JSON.parse(sessionStorage.getItem('clubesUsuario') || '[]'); }
        catch (e) { return []; }
    })();
    const nombresClubes = (() => {
        try { return JSON.parse(sessionStorage.getItem('clubesNombres') || '{}'); }
        catch (e) { return {}; }
    })();
    nombresClubes[clubActivo] = nombresClubes[clubActivo] || nombreClub;

    // El selector solo tiene sentido con más de un club, pero "crear otro"
    // aparece siempre (salvo para las jugadoras): es la puerta para que
    // alguien arme el club de otro equipo y después invite al cuerpo técnico.
    const selectorClubHTML = (misClubes.length < 2 && esJugadora) ? '' : `
        <div class="club-switch">
            ${misClubes.length < 2 ? '' : `
            <label class="club-switch-label" for="sel-club">Club activo</label>
            <select id="sel-club" class="club-switch-select">
                ${misClubes.map(id => `<option value="${TL.esc(id)}" ${id === clubActivo ? 'selected' : ''}>${TL.esc(nombresClubes[id] || id)}</option>`).join('')}
            </select>`}
            ${esJugadora ? '' : `<a href="${toPage}registro.html" class="club-nuevo">+ Crear otro club</a>`}
        </div>`;

    // En celular la barra lateral se esconde y se abre como cajón desde el
    // botón hamburguesa de la topbar. En escritorio topbar y scrim se ocultan
    // por CSS y la barra queda fija como siempre.
    root.outerHTML = `
        <header class="topbar">
            <button class="nav-toggle" id="btn-nav-toggle" aria-label="Abrir menú"
                    aria-expanded="false" aria-controls="sidebar-nav">
                <svg class="ico-abrir" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>
                <svg class="ico-cerrar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>
            </button>
            <a href="${inicio}" class="brand-link" aria-label="Ir al inicio">
                <img src="${toRoot}assets/image/logo.svg" alt="" class="logo" onerror="this.style.visibility='hidden'">
                <span class="brand-name">${nombreClub}</span>
            </a>
        </header>
        <div class="nav-scrim" id="nav-scrim"></div>
        <aside class="sidebar" id="sidebar-nav">
            <div class="sidebar-brand">
                <a href="${inicio}" class="brand-link" aria-label="Ir al inicio">
                    <img src="${toRoot}assets/image/logo.svg" alt="Logo" class="logo" onerror="this.style.visibility='hidden'">
                    <span class="brand-name">${nombreClub}</span>
                </a>
            </div>
            ${selectorClubHTML}
            <nav class="sidebar-nav">
                ${grupos.map(grupoHTML).join('')}
            </nav>
            <div class="sidebar-foot">
                <div class="user-email">${email}</div>
                <button class="btn-logout-side" id="btn-cerrar-sesion">Cerrar sesión</button>
            </div>
        </aside>
    `;

    document.body.classList.add('app-shell');

    // --- Cajón de navegación (celular) ---
    const btnMenu = document.getElementById('btn-nav-toggle');
    const scrim = document.getElementById('nav-scrim');
    const aside = document.getElementById('sidebar-nav');

    const abrirMenu = (abrir) => {
        document.body.classList.toggle('nav-open', abrir);
        btnMenu.setAttribute('aria-expanded', String(abrir));
        btnMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
    };

    btnMenu.addEventListener('click', () => abrirMenu(!document.body.classList.contains('nav-open')));
    scrim.addEventListener('click', () => abrirMenu(false));
    // Navegar cierra el cajón (si el link va a la página actual no hay recarga)
    aside.addEventListener('click', (e) => { if (e.target.closest('a.nav-link, a.brand-link')) abrirMenu(false); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
            abrirMenu(false);
            btnMenu.focus();
        }
    });

    document.getElementById('btn-cerrar-sesion').addEventListener('click', async () => {
        // 1) Limpiar la sesión local (no necesita Firebase, siempre corre).
        try { sessionStorage.clear(); } catch (_) { }
        try {
            localStorage.removeItem('recordarSesion');
            ['usuarioUID', 'userEmail', 'clubID', 'userRole', 'isClubAdmin', 'isSuperAdmin', 'configClub']
                .forEach(k => localStorage.removeItem(k));
        } catch (_) { }
        // 2) Cerrar sesión de Firebase para revocar el token (best-effort).
        //    ui.js es script clásico → import dinámico de firebase.js.
        try {
            const fb = await import(`${toRoot}assets/js/firebase.js`);
            await fb.signOut(fb.auth);
        } catch (_) { }
        window.location.href = enPages ? 'login.html' : 'pages/login.html';
    });

    // --- Cambiar de club ---
    // Cambiar de club rehace la sesión: el plan, el nombre y todo lo que la app
    // filtra por clubID son de ese club. El partido abierto era del club
    // anterior, así que se suelta, y se vuelve a entrar por la casa del club
    // nuevo (que según el plan puede no ser el historial).
    const selClub = document.getElementById('sel-club');
    if (selClub) {
        selClub.addEventListener('change', async () => {
            const nuevo = selClub.value;
            if (!nuevo || nuevo === clubActivo) return;
            selClub.disabled = true;
            try {
                const fb = await import(`${toRoot}assets/js/firebase.js`);
                const snap = await fb.getDoc(fb.doc(fb.db, 'clubes', nuevo));
                if (!snap.exists()) throw new Error('El club no existe');
                sessionStorage.setItem('clubID', nuevo);
                sessionStorage.setItem('configClub', JSON.stringify(snap.data()));
                // Mandar es por club: en uno podés ser la dueña y en otro no.
                // Si esto no se recalcula acá, el menú de Usuarios queda
                // mostrándose (o escondido) según el club anterior.
                sessionStorage.setItem('isClubAdmin',
                    String(snap.data().admin_uid === sessionStorage.getItem('usuarioUID')));
                sessionStorage.removeItem('partidoSeleccionadoId');
                try { localStorage.setItem('ultimoClub', nuevo); } catch (_) { }
                // Si la sesión está recordada, el club nuevo también.
                if (localStorage.getItem('recordarSesion') === '1') fb.guardarSesionRecordada(true);
                // La casa depende del plan del club NUEVO (Pizarrón no tiene
                // partidos), igual que paginaInicio() en el login.
                const conPartidos = !window.TL || !window.TL.planes || window.TL.planes.puedeActual('partidos');
                const destino = conPartidos ? 'historial.html' : 'entrenamientos.html';
                window.location.href = enPages ? destino : `pages/${destino}`;
            } catch (e) {
                console.error('No se pudo cambiar de club:', e);
                selClub.value = clubActivo;
                selClub.disabled = false;
            }
        });

        // Completar los nombres que no estaban cacheados (una vez por sesión).
        if (misClubes.some(id => !nombresClubes[id])) {
            import(`${toRoot}assets/js/firebase.js`).then(async (fb) => {
                await Promise.all(misClubes.filter(id => !nombresClubes[id]).map(async (id) => {
                    try {
                        const s = await fb.getDoc(fb.doc(fb.db, 'clubes', id));
                        if (s.exists()) nombresClubes[id] = s.data().nombre || id;
                    } catch (_) { /* sin permiso o sin red: queda el id */ }
                }));
                sessionStorage.setItem('clubesNombres', JSON.stringify(nombresClubes));
                Array.from(selClub.options).forEach(o => { o.textContent = nombresClubes[o.value] || o.value; });
            });
        }
    }

    // --- Aviso de correo sin confirmar ---
    // Al darse de alta sale un correo de confirmación. No bloquea nada: la app
    // anda igual y esta barra insiste hasta que confirme. Una vez confirmado se
    // marca en sessionStorage para no volver a preguntarle a Firebase en cada
    // página.
    if (sessionStorage.getItem('emailConfirmado') !== '1') {
        import(`${toRoot}assets/js/firebase.js`).then((fb) => {
            fb.onAuthStateChanged(fb.auth, async (user) => {
                if (!user) return;
                // reload() trae el estado fresco: si confirmó en otra pestaña,
                // el `user` que tenemos en memoria sigue diciendo que no.
                try { await user.reload(); } catch (_) { }
                const actual = fb.auth.currentUser || user;
                if (actual.emailVerified) {
                    sessionStorage.setItem('emailConfirmado', '1');
                    return;
                }
                pintarAvisoCorreo(fb, actual);
            });
        });
    }

    function pintarAvisoCorreo(fb, user) {
        if (document.getElementById('aviso-correo')) return;
        const aviso = document.createElement('div');
        aviso.className = 'aviso-correo';
        aviso.id = 'aviso-correo';
        aviso.innerHTML = `
            <span class="aviso-correo-texto">
                Confirmá tu correo: te mandamos un mail a <b>${email}</b>. Revisá también el correo no deseado.
            </span>
            <button type="button" class="aviso-correo-btn" id="aviso-correo-reenviar">Reenviar</button>
            <button type="button" class="aviso-correo-btn" id="aviso-correo-listo">Ya lo confirmé</button>`;

        const meter = () => {
            const cont = document.querySelector('.container-dashboard') || document.querySelector('.container') || document.body;
            cont.insertBefore(aviso, cont.firstChild);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', meter);
        else meter();

        const decir = (txt) => { aviso.querySelector('.aviso-correo-texto').textContent = txt; };

        document.getElementById('aviso-correo-reenviar').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            const ok = await fb.mandarCorreoDeConfirmacion(fb.auth.currentUser || user);
            decir(ok
                ? 'Listo, te lo mandamos de nuevo. Puede tardar un par de minutos.'
                : 'No pudimos mandarlo ahora. Probá de nuevo en un rato.');
            // Firebase limita los reenvíos seguidos: damos un minuto de aire.
            setTimeout(() => { btn.disabled = false; }, 60000);
        });

        document.getElementById('aviso-correo-listo').addEventListener('click', async () => {
            try { await (fb.auth.currentUser || user).reload(); } catch (_) { }
            if (fb.auth.currentUser && fb.auth.currentUser.emailVerified) {
                sessionStorage.setItem('emailConfirmado', '1');
                aviso.remove();
            } else {
                decir('Todavía no nos figura confirmado. Abrí el link del correo y volvé a probar.');
            }
        });
    }

    // --- Chat interno (burbuja flotante) ---
    // Se monta acá para que viaje con el shell: aparece en todas las páginas
    // de la app. El widget es un módulo (usa firebase.js) y se planta solo si
    // hay sesión de club.
    const chat = document.createElement('script');
    chat.type = 'module';
    chat.src = `${toRoot}assets/js/components/chatWidget.js`;
    document.body.appendChild(chat);
})();
