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

    // Marca del club (nombre) desde la sesión
    let nombreClub = 'Timeline';
    try {
        const cfg = JSON.parse(sessionStorage.getItem('configClub') || '{}');
        if (cfg.nombre) nombreClub = cfg.nombre;
    } catch (e) { /* sin config: nombre por defecto */ }

    const email = sessionStorage.getItem('userEmail') || '';
    const esClubAdmin = sessionStorage.getItem('isClubAdmin') === 'true';
    // Las jugadoras son espectadoras: ven los partidos pero no cargan
    const esJugadora = sessionStorage.getItem('userRole') === 'player';
    // Los ejercicios/entrenamientos son solo del cuerpo técnico (entrenador o admin)
    const rolActual = sessionStorage.getItem('userRole');
    const esEntrenador = rolActual === 'trainer' || rolActual === 'club-admin';
    // Editor de cancha (armar ejercicios) es una función del plan Ultra.
    // Se resuelve con TL.planes si está cargado; si no, se mira el plan directo.
    let puedeEjercicios = false;
    try {
        if (window.TL && window.TL.planes) {
            puedeEjercicios = window.TL.planes.puedeActual('editor_cancha');
        } else {
            const cfg = JSON.parse(sessionStorage.getItem('configClub') || '{}');
            puedeEjercicios = (cfg.plan || 'free').toLowerCase() === 'ultra';
        }
    } catch (e) { /* sin config: sin acceso */ }
    // "Contexto de partido": al abrir un partido aparecen Video y Estadísticas
    const hayPartido = !!sessionStorage.getItem('partidoSeleccionadoId');

    // Íconos (SVG stroke, heredan color con currentColor)
    const ICON = {
        historial: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 3"/>',
        carga: '<path d="M12 5v14"/><path d="M5 12h14"/>',
        comparar: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
        entrenamientos: '<path d="M6.5 6.5 17.5 17.5"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 9l3-3-3-3"/><path d="M6 15l-3 3 3 3"/><path d="M9 18l6-6"/>',
        ejercicios: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><circle cx="12" cy="12" r="2.5"/>',
        video: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>',
        estadisticas: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
        usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    };
    const icono = id => `<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id] || ''}</svg>`;

    // Navegación agrupada por secciones. Cada grupo se muestra solo si tiene
    // links visibles según rol/plan/contexto.
    const grupos = [];

    // Partidos: lo básico que ve todo el mundo (las jugadoras solo el historial)
    const partidos = [{ id: 'historial', href: `${toPage}historial.html`, label: 'Historial' }];
    if (!esJugadora) {
        partidos.push({ id: 'carga', href: `${toPage}carga.html`, label: 'Cargar partido' });
        partidos.push({ id: 'comparar', href: `${toPage}comparar.html`, label: 'Comparar' });
    }
    grupos.push({ titulo: 'Partidos', items: partidos });

    // Entrenamiento (plan Ultra + solo cuerpo técnico)
    if (!esJugadora && puedeEjercicios && esEntrenador) {
        grupos.push({
            titulo: 'Entrenamiento', items: [
                { id: 'entrenamientos', href: `${toPage}entrenamientos.html`, label: 'Entrenamientos' },
                { id: 'ejercicios', href: `${toPage}ejercicios.html`, label: 'Ejercicios' }
            ]
        });
    }

    // Contexto del partido abierto: Video (+ Estadísticas para el cuerpo técnico)
    if (hayPartido) {
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

    root.outerHTML = `
        <aside class="sidebar">
            <div class="sidebar-brand">
                <img src="${toRoot}assets/image/logo-web.png" alt="Logo" class="logo" onerror="this.style.visibility='hidden'">
                <span class="brand-name">${nombreClub}</span>
            </div>
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
})();
