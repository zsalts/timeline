// =========================================================
// utils/planes.js
// Fuente única de verdad de los planes de suscripción (Free / Pro / Ultra).
// Define qué incluye cada plan, sus límites y los feature-flags que gatean
// funciones a lo largo de la app.
//
// El plan vive en clubes/{clubId}.plan (legible por cualquier miembro del
// club) y queda cacheado en sessionStorage.configClub al hacer login.
//
// Se expone como global window.TL.planes para usarse tanto en páginas con
// <script> clásico como con <script type="module">.
// =========================================================
window.TL = window.TL || {};
window.TL.planes = (function () {

    // Orden jerárquico: cada plan incluye todo lo del anterior.
    const ORDEN = ['free', 'pro', 'ultra'];

    // Definición de cada plan. `limites` son topes duros; `incluye` es la
    // lista de features (flags) que ese plan habilita, ACUMULATIVA respecto
    // del plan anterior (pro incluye lo de free, ultra lo de pro).
    const PLANES = {
        free: {
            id: 'free',
            nombre: 'Free',
            descripcion: 'Para probar la app.',
            limites: { partidos: 10 },
            incluye: [
                'partidos',          // cargar partidos (hasta el límite)
                'tablero',           // tablero de estadísticas completo
                'video_youtube',     // video vía YouTube no listado
            ],
        },
        pro: {
            id: 'pro',
            nombre: 'Pro',
            descripcion: 'Para el club que ya usa la app en serio.',
            limites: { partidos: Infinity },
            incluye: [
                'auto_import',       // auto-import de plantilla .maccat de Nacsport
                'compartir',         // compartir cortes entre cuentas
                'export_reportes',   // exportar reportes del tablero (PDF/Excel)
                'stats_individuales',// estadísticas individuales por jugadora
                'filtros_tablero',   // filtros por rival/competencia/fecha
                'compartir_ilimitado',
                'roles_finos',       // roles extra (ej. ojeador/scout)
                'pizarra',           // pizarra táctica del partido (alineación/bloqueos/rival)
            ],
        },
        ultra: {
            id: 'ultra',
            nombre: 'Ultra',
            descripcion: 'Todo, para instituciones con varias categorías.',
            limites: { partidos: Infinity },
            incluye: [
                'entrenamientos',    // cargar sesiones de entrenamiento
                'editor_cancha',     // editor de cancha con conos/pelotas/jugadoras
                'multi_equipo',      // multi-equipo / multi-categoría bajo un club
                'resumen_auto',      // resumen automático del partido
                'export_jugadora',   // reportes de jugadora individual exportables
                'marca_club',        // logo/colores del club en compartidos y PDF
            ],
        },
    };

    // Normaliza el plan de un club: acepta el doc de club o un string.
    // Default 'free' si falta o es desconocido (clubes viejos sin campo).
    function normalizar(clubOrPlan) {
        let p = clubOrPlan;
        if (p && typeof p === 'object') p = p.plan;
        p = (p || 'free').toString().toLowerCase();
        return PLANES[p] ? p : 'free';
    }

    // Todas las features acumuladas hasta un plan dado (incluye las de los
    // planes inferiores por la jerarquía free < pro < ultra).
    function featuresDe(plan) {
        const idx = ORDEN.indexOf(normalizar(plan));
        const set = new Set();
        for (let i = 0; i <= idx; i++) {
            PLANES[ORDEN[i]].incluye.forEach(f => set.add(f));
        }
        return set;
    }

    // ¿El plan `plan` habilita la feature `feature`?
    function puede(plan, feature) {
        return featuresDe(plan).has(feature);
    }

    // Tope de una métrica (ej. 'partidos') para un plan. Infinity = ilimitado.
    function limite(plan, metrica) {
        const def = PLANES[normalizar(plan)];
        const val = def.limites[metrica];
        return val === undefined ? Infinity : val;
    }

    // ---- Helpers de sesión (leen el plan del club logueado) ----

    function clubActual() {
        try {
            return JSON.parse(sessionStorage.getItem('configClub') || '{}');
        } catch (e) {
            return {};
        }
    }

    // Plan del club de la sesión actual ('free' por defecto).
    function planActual() {
        return normalizar(clubActual());
    }

    // ¿El club logueado puede usar `feature`?
    function puedeActual(feature) {
        return puede(planActual(), feature);
    }

    // Tope de `metrica` para el club logueado.
    function limiteActual(metrica) {
        return limite(planActual(), metrica);
    }

    return {
        ORDEN,
        PLANES,
        normalizar,
        featuresDe,
        puede,
        limite,
        planActual,
        puedeActual,
        limiteActual,
        info: (plan) => PLANES[normalizar(plan)],
    };
})();
