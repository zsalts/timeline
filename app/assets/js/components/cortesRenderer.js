// =========================================================
// components/cortesRenderer.js
// Renderiza los cortes de un partido agrupados por Categoría > Descriptor,
// con un botón por corte que salta al segundo exacto del video.
//
// Unifica la lógica antes duplicada en video.html y comparar.html.
// Expone global window.TL.cortes.
//
// Uso:
//   TL.cortes.render(contenedor, estadisticas, onSeek, opciones)
//     - contenedor : elemento DOM donde dibujar
//     - estadisticas: objeto { categoria: [ { t, d } ] }
//     - onSeek     : function(tiempoEnSegundos) -> salta el video
//     - opciones   : { label: (num)=>string, vacioHtml: string }
// =========================================================
window.TL = window.TL || {};
window.TL.cortes = (function () {

    function render(contenedor, estadisticas, onSeek, opciones) {
        opciones = opciones || {};
        const label = opciones.label || ((num) => `▶ Corte ${num}`);
        const vacioHtml = opciones.vacioHtml ||
            '<p style="text-align:center; color: var(--muted);">No hay cortes para este partido.</p>';

        contenedor.innerHTML = '';

        if (!estadisticas || Object.keys(estadisticas).length === 0) {
            contenedor.innerHTML = vacioHtml;
            return;
        }

        // 1. Agrupar: categoria -> descriptor -> [cortes]
        const agrupado = {};
        for (const [categoria, cortes] of Object.entries(estadisticas)) {
            agrupado[categoria] = {};
            cortes.forEach((corte, index) => {
                const num = index + 1;
                if (corte.d && corte.d.length > 0) {
                    corte.d.forEach(descriptor => {
                        if (!agrupado[categoria][descriptor]) agrupado[categoria][descriptor] = [];
                        agrupado[categoria][descriptor].push({ ...corte, num });
                    });
                } else {
                    if (!agrupado[categoria]['General']) agrupado[categoria]['General'] = [];
                    agrupado[categoria]['General'].push({ ...corte, num });
                }
            });
        }

        // 2. Dibujar
        Object.keys(agrupado).sort().forEach(cat => {
            const catDetails = document.createElement('details');
            catDetails.className = 'cat-details';
            const catSummary = document.createElement('summary');
            catSummary.innerHTML = `📁 ${cat}`;
            catDetails.appendChild(catSummary);

            const subGrupos = agrupado[cat];
            Object.keys(subGrupos).sort().forEach(desc => {
                const grupo = subGrupos[desc];
                const descDetails = document.createElement('details');
                descDetails.className = 'desc-details';
                const descSummary = document.createElement('summary');
                descSummary.innerHTML = `📂 ${desc} <span style="color:#888; font-size:0.8rem;">(${grupo.length})</span>`;
                descDetails.appendChild(descSummary);

                const divBotones = document.createElement('div');
                divBotones.className = 'botones-container';
                grupo.forEach(corte => {
                    const btn = document.createElement('button');
                    btn.className = 'timestamp-btn';
                    btn.textContent = label(corte.num);
                    btn.onclick = () => onSeek(corte.t);
                    divBotones.appendChild(btn);
                });
                descDetails.appendChild(divBotones);
                catDetails.appendChild(descDetails);
            });
            contenedor.appendChild(catDetails);
        });
    }

    return { render };
})();
