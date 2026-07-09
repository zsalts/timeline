// =========================================================
// utils/tema.js
// Aplica el logo del club en cada página, leyendo la config guardada
// en sessionStorage.configClub al hacer login.
// Los colores son fijos e iguales para todos (definidos en style.css);
// solo el logo es propio de cada club.
// Se expone global window.TL.tema.
// =========================================================
window.TL = window.TL || {};
window.TL.tema = (function () {

    function aplicar() {
        const raw = sessionStorage.getItem('configClub');
        if (!raw) return;

        let cfg;
        try { cfg = JSON.parse(raw); } catch (e) { return; }

        // Logo del club en la barra de navegación / login
        if (cfg.logo) {
            document.querySelectorAll('img.logo, img.login-logo, .login-logo').forEach(img => {
                img.src = cfg.logo;
                img.style.display = '';
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', aplicar);
    } else {
        aplicar();
    }

    return { aplicar };
})();
