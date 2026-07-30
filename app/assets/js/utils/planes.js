// =========================================================
// utils/planes.js
// Fuente única de verdad de los planes de suscripción
// (Free / Pizarrón / Pro / Ultra).
// Define qué incluye cada plan, sus límites y los feature-flags que gatean
// funciones a lo largo de la app.
//
// Los planes NO son una escalera lineal: Pizarrón es un camino lateral
// (solo entrenamiento y táctica, sin partidos) y no hereda de Free. Por eso
// cada plan declara de quién hereda con `hereda` en vez de apoyarse en el
// orden del array.
//
// El plan vive en clubes/{clubId}.plan (legible por cualquier miembro del
// club) y queda cacheado en sessionStorage.configClub al hacer login.
//
// Se expone como global window.TL.planes para usarse tanto en páginas con
// <script> clásico como con <script type="module">.
// =========================================================
window.TL = window.TL || {};
window.TL.planes = (function () {

    // Orden en que se muestran los planes (admin, landing). NO implica
    // herencia: para eso está el campo `hereda` de cada plan.
    const ORDEN = ['free', 'pizarron', 'pro', 'ultra'];

    // Bloque de features de entrenamiento y táctica. Lo comparten el plan
    // Pizarrón (que es solo esto) y el Ultra (que lo suma a todo lo de Pro).
    const TACTICO = [
        'entrenamientos',    // cargar sesiones de entrenamiento
        'editor_cancha',     // editor de cancha con conos/pelotas/jugadoras
        'tacticas',          // biblioteca de planteos tácticos
        'pizarra',           // pizarra táctica (alineación/bloqueos/rival)
    ];

    // Definición de cada plan. `limites` son topes duros; `incluye` es la
    // lista de features (flags) que ese plan habilita; `hereda` es el plan
    // del que además toma features y límites (null = arranca de cero).
    const PLANES = {
        free: {
            id: 'free',
            nombre: 'Free',
            hereda: null,
            descripcion: 'Para probar la app.',
            limites: { partidos: 10 },
            incluye: [
                'partidos',          // cargar partidos (hasta el límite)
                'tablero',           // tablero de estadísticas completo
                'video_youtube',     // video vía YouTube no listado
                'chat',              // chat interno (mensajes directos del club)
            ],
        },
        pizarron: {
            id: 'pizarron',
            nombre: 'Pizarrón',
            hereda: null,            // camino lateral: NO incluye lo de Free
            descripcion: 'Solo entrenamiento y táctica, sin partidos.',
            limites: { partidos: 0 },
            incluye: [
                'chat',              // el club sigue teniendo su chat interno
                ...TACTICO,
            ],
        },
        pro: {
            id: 'pro',
            nombre: 'Pro',
            hereda: 'free',
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
            hereda: 'pro',
            descripcion: 'Todo, para instituciones con varias categorías.',
            limites: { partidos: Infinity },
            incluye: [
                ...TACTICO,          // todo lo del Pizarrón
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

    // Cadena de herencia de un plan, de la raíz hacia abajo.
    // Ej: 'ultra' → ['free', 'pro', 'ultra']; 'pizarron' → ['pizarron'].
    function cadena(plan) {
        const lista = [];
        let id = normalizar(plan);
        while (id) {
            lista.unshift(id);
            id = PLANES[id].hereda;
        }
        return lista;
    }

    // Todas las features de un plan, sumando las que hereda.
    function featuresDe(plan) {
        const set = new Set();
        cadena(plan).forEach(id => PLANES[id].incluye.forEach(f => set.add(f)));
        return set;
    }

    // ¿El plan `plan` habilita la feature `feature`?
    function puede(plan, feature) {
        return featuresDe(plan).has(feature);
    }

    // Tope de una métrica (ej. 'partidos') para un plan: gana el valor del
    // plan más específico de la cadena. Infinity = ilimitado, 0 = no incluido.
    function limite(plan, metrica) {
        let val;
        cadena(plan).forEach(id => {
            const v = PLANES[id].limites[metrica];
            if (v !== undefined) val = v;
        });
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
        cadena,
        featuresDe,
        puede,
        limite,
        planActual,
        puedeActual,
        limiteActual,
        info: (plan) => PLANES[normalizar(plan)],
    };
})();
