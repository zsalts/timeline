// =========================================================
// utils/tacticas.js
// Tipos de jugada de los planteos tácticos. Vive acá y no copiado en
// cada página porque lo usan tanto el editor (tacticas.html) como el
// partido (video.html), y si los dos mapas se desincronizan aparecen
// planteos "sin tipo" o etiquetas distintas para lo mismo.
//
// Uso:
//   TL.tacticas.TIPOS            -> [{ id, label }] en orden de menú
//   TL.tacticas.label('corner')  -> 'Corner corto'
//   TL.tacticas.agrupar(lista)   -> [{ tipo, label, items }] sin grupos vacíos
// =========================================================
(function () {
    window.TL = window.TL || {};

    const TIPOS = [
        { id: 'ataque', label: 'Ataque' },
        { id: 'defensa', label: 'Defensa' },
        { id: 'corner', label: 'Corner corto' },
        { id: 'penal', label: 'Penal' },
        { id: 'transicion', label: 'Transición' },
        { id: 'otro', label: 'Otro' },
    ];

    const POR_ID = TIPOS.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

    TL.tacticas = {
        TIPOS,

        // Los planteos viejos (guardados antes de que existiera el tipo) caen
        // en 'otro' en vez de quedar afuera de los grupos.
        normalizar(tipo) {
            return POR_ID[tipo] ? tipo : 'otro';
        },

        label(tipo) {
            return (POR_ID[tipo] || POR_ID.otro).label;
        },

        // Agrupa respetando el orden de TIPOS y saltea los grupos vacíos.
        agrupar(lista) {
            return TIPOS
                .map(t => ({
                    tipo: t.id,
                    label: t.label,
                    items: lista.filter(x => TL.tacticas.normalizar(x.tipo) === t.id)
                }))
                .filter(g => g.items.length);
        }
    };
})();
