// =========================================================
// 1. CONFIGURACIÓN DE YOUTUBE API
// =========================================================
let player;

// Solo cargamos el reproductor si estamos en la página del video (Página 1)
if (document.getElementById('player')) {
    function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
            height: '360',
            width: '100%',
            videoId: videoIdLimpio,
            host: 'https://www.youtube.com', // Obliga a usar conexión segura
            playerVars: {
                'playsinline': 1,
                'enablejsapi': 1,
                'origin': 'http://localhost', // Disfraza tu app local como servidor web
                'widget_referrer': 'http://localhost'
            }
        });
    }

    // Inyectamos el script oficial de YouTube
    let tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    let firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}


// =========================================================
// 2. LECTURA DEL XML Y GUARDADO EN MEMORIA
// =========================================================
const inputXml = document.getElementById('xml-file');

// Solo escuchamos el evento si el botón de subir archivo existe en la página
if (inputXml) {
    inputXml.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evento) {
            const contenidoXML = evento.target.result;
            procesarXML(contenidoXML);
        };
        reader.readAsText(file);
    });
}

function procesarXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const eventos = xmlDoc.getElementsByTagName("evento");
    const estadisticas = {};

    // Extraemos los datos del XML (Categoría, Tiempo y Descriptores)
    for (let i = 0; i < eventos.length; i++) {
        let categoria = eventos[i].getElementsByTagName("categoria")[0].textContent;
        let tiempo = parseFloat(eventos[i].getElementsByTagName("tiempo")[0].textContent);

        // Buscamos los descriptores (ej: Zona 3, Arrastrada, etc.)
        let nodosDescriptores = eventos[i].getElementsByTagName("descriptor");
        let arrayDescriptores = [];

        for (let j = 0; j < nodosDescriptores.length; j++) {
            arrayDescriptores.push(nodosDescriptores[j].textContent);
        }

        if (!estadisticas[categoria]) {
            estadisticas[categoria] = [];
        }

        // Guardamos el paquete completo de ese corte
        estadisticas[categoria].push({
            tiempo: tiempo,
            descriptores: arrayDescriptores
        });
    }

    // Guardamos en la memoria del navegador y mandamos a dibujar
    localStorage.setItem('datosPartido', JSON.stringify(estadisticas));
    distribuirDatos(estadisticas);
}


// =========================================================
// 3. DISTRIBUIR DATOS SEGÚN LA PÁGINA
// =========================================================
function distribuirDatos(estadisticas) {
    const cortesContainer = document.getElementById('cortes-container');
    const panelOscuro = document.querySelector('.dashboard-grid');
    const panelModerno = document.querySelector('.grid-resumen');

    // --- PÁGINA 1: Video y Cortes con Descriptores ---
    if (cortesContainer) {
        cortesContainer.innerHTML = '';

        for (const [categoria, cortes] of Object.entries(estadisticas)) {
            const cortesGroup = document.createElement('div');
            cortesGroup.className = 'cortes-group';

            const tituloCortes = document.createElement('h4');
            tituloCortes.textContent = `Cortes de ${categoria}`;
            cortesGroup.appendChild(tituloCortes);

            // Creamos un botón por cada corte, sumando sus tags al texto
            cortes.forEach((corte, index) => {
                const btn = document.createElement('button');
                btn.className = 'timestamp-btn';

                let textoBoton = `Corte ${index + 1}`;
                if (corte.descriptores.length > 0) {
                    // Si tiene tags, se los agregamos entre paréntesis
                    textoBoton += ` (${corte.descriptores.join(', ')})`;
                }

                btn.textContent = textoBoton;

                // Acción de saltar al segundo exacto
                btn.onclick = () => {
                    if (player && typeof player.seekTo === 'function') {
                        player.seekTo(corte.tiempo, true);
                    }
                };

                cortesGroup.appendChild(btn);
            });
            cortesContainer.appendChild(cortesGroup);
        }
    }

    // --- PÁGINA 2: Dashboard de Estadísticas Totales ---
    if (panelOscuro || panelModerno) {
        for (const [categoria, cortes] of Object.entries(estadisticas)) {
            const numeroElemento = document.getElementById(`stat-${categoria}`);

            // Si encuentra la tarjeta correspondiente en el HTML, le suma el total
            if (numeroElemento) {
                numeroElemento.textContent = cortes.length;
            }
        }
    }
}


// =========================================================
// 4. CARGAR DATOS AUTOMÁTICAMENTE AL INICIAR
// =========================================================
window.onload = function () {
    const datosGuardados = localStorage.getItem('datosPartido');
    if (datosGuardados) {
        const estadisticas = JSON.parse(datosGuardados);
        distribuirDatos(estadisticas);
    }
};


// =========================================================
// 5. BOTÓN PARA LIMPIAR DATOS
// =========================================================
const btnLimpiar = document.getElementById('btn-limpiar');

if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
        localStorage.removeItem('datosPartido');
        location.reload();
    });
}