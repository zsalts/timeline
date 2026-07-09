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
    // "Contexto de partido": al abrir un partido aparecen Video y Estadísticas
    const hayPartido = !!sessionStorage.getItem('partidoSeleccionadoId');

    const links = [
        { id: 'historial', href: `${toPage}historial.html`, label: 'Historial' }
    ];
    if (!esJugadora) {
        links.push({ id: 'carga', href: `${toPage}carga.html`, label: 'Cargar partido' });
    }
    links.push({ id: 'comparar', href: `${toPage}comparar.html`, label: 'Comparar' });

    if (hayPartido) {
        links.push({ id: 'video', href: `${toPage}video.html`, label: 'Video' });
        links.push({ id: 'estadisticas', href: `${toPage}estadisticas.html`, label: 'Estadísticas' });
    }

    if (esClubAdmin) {
        links.push({ id: 'usuarios', href: `${toPage}gestion-usuarios.html`, label: 'Usuarios' });
    }

    root.outerHTML = `
        <aside class="sidebar">
            <div class="sidebar-brand">
                <img src="${toRoot}assets/image/logo-web.png" alt="Logo" class="logo" onerror="this.style.visibility='hidden'">
                <span class="brand-name">${nombreClub}</span>
            </div>
            <nav class="sidebar-nav">
                ${links.map(l => `<a href="${l.href}" class="${l.id === active ? 'active' : ''}">${l.label}</a>`).join('')}
            </nav>
            <div class="sidebar-foot">
                <div class="user-email">${email}</div>
                <button class="btn-logout-side" id="btn-cerrar-sesion">Cerrar sesión</button>
            </div>
        </aside>
    `;

    document.body.classList.add('app-shell');

    document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = enPages ? 'login.html' : 'pages/login.html';
    });
})();
