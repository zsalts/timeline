// =========================================================
// utils/parsers.js
// Parseo centralizado de archivos de análisis (LongoMatch .lgm / XML).
// Devuelve siempre la estructura: { categoria: [ { t: segundos, d: [tags] } ] }
//
// Se expone como global window.TL.parsers para poder usarse tanto en
// páginas con <script> clásico (carga.html, video.html) como en páginas
// con <script type="module"> (editar.html, comparar.html).
// =========================================================
window.TL = window.TL || {};
window.TL.parsers = (function () {

    // Formato LongoMatch (JSON): { Timeline: [ { $type, Name, Start, Tags } ] }
    function procesarLGM(jsonString) {
        const data = JSON.parse(jsonString);
        const eventos = data.Timeline;
        const resultado = {};

        for (let i = 0; i < eventos.length; i++) {
            let ev = eventos[i];
            if (!ev.$type || !ev.$type.includes("TimelineEvent")) continue;

            let categoria = ev.Name.replace(/\s\d+$/, "");
            let tiempo = ev.Start / 1000;

            let tags = [];
            if (ev.Tags && ev.Tags.length > 0) {
                for (let j = 0; j < ev.Tags.length; j++) {
                    tags.push(ev.Tags[j].Value);
                }
            }

            if (!resultado[categoria]) resultado[categoria] = [];
            resultado[categoria].push({ t: tiempo, d: tags });
        }
        return resultado;
    }

    // Formato XML (LongoMatch / Timeline / genérico). Soporta múltiples
    // nombres de nodo para categoría, tiempo y descriptores.
    function procesarXML(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        // 1. Nodo principal de cada acción (Cortes / Instancias)
        let eventos = xmlDoc.getElementsByTagName("evento");
        if (eventos.length === 0) eventos = xmlDoc.getElementsByTagName("instance");
        if (eventos.length === 0) eventos = xmlDoc.getElementsByTagName("Event");

        const resultado = {};

        for (let i = 0; i < eventos.length; i++) {
            let ev = eventos[i];

            // 2. Nombre del botón o categoría
            let nodoCategoria = ev.getElementsByTagName("categoria")[0] ||
                ev.getElementsByTagName("code")[0] ||
                ev.getElementsByTagName("Category")[0] ||
                ev.getElementsByTagName("Name")[0];

            // 3. Tiempo de inicio del corte
            let nodoTiempo = ev.getElementsByTagName("tiempo")[0] ||
                ev.getElementsByTagName("start")[0] ||
                ev.getElementsByTagName("Start")[0];

            // Si el corte no tiene categoría o tiempo válido, se saltea
            if (!nodoCategoria || !nodoTiempo) continue;

            // Limpiamos espacios y quitamos números del final (ej: "Ataque 1" -> "Ataque")
            let categoria = nodoCategoria.textContent.trim().replace(/\s\d+$/, "");
            let tiempo = parseFloat(nodoTiempo.textContent);

            // Si el software exportó el tiempo en milisegundos, lo pasa a segundos
            if (tiempo > 12000) {
                tiempo = tiempo / 1000;
            }

            // 4. Etiquetas / descriptores de la acción
            let nodosTags = ev.getElementsByTagName("descriptor");
            if (nodosTags.length === 0) nodosTags = ev.getElementsByTagName("label");
            if (nodosTags.length === 0) nodosTags = ev.getElementsByTagName("tag");

            let tags = [];
            for (let j = 0; j < nodosTags.length; j++) {
                // Algunos XML meten el texto dentro de una subetiqueta <text>
                let nodoTexto = nodosTags[j].getElementsByTagName("text")[0];
                let tagTexto = nodoTexto ? nodoTexto.textContent : nodosTags[j].textContent;

                if (tagTexto && tagTexto.trim() !== "") {
                    tags.push(tagTexto.trim());
                }
            }

            if (!resultado[categoria]) resultado[categoria] = [];
            resultado[categoria].push({ t: tiempo, d: tags });
        }

        return resultado;
    }

    // Detecta el formato por el contenido y devuelve las estadísticas.
    function procesarArchivo(contenido) {
        return contenido.trim().startsWith("{")
            ? procesarLGM(contenido)
            : procesarXML(contenido);
    }

    return { procesarLGM, procesarXML, procesarArchivo };
})();
