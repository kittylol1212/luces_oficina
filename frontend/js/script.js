const BASE_URL = " https://labor-estimate-outputs-scholarships.trycloudflare.com ";
// 1. FUNCIÓN GRUPAL: PISO
function toggleTodoElPiso(numeroPiso) {
    const card = document.querySelector(`.piso-${numeroPiso}`);
    if (!card) return;

    const luces = card.querySelectorAll('.avatar');
    const algunaApagada = Array.from(luces).some(luz => !luz.classList.contains('encendido'));
    const nuevoEstado = algunaApagada; 

    luces.forEach(luz => luz.classList.toggle('encendido', nuevoEstado));

    fetch(`${BASE_URL}/api/luz/piso`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piso: numeroPiso, estado: nuevoEstado })
    }).catch(err => console.error("Error en comando grupal:", err));
}

// 2. FUNCIÓN INDIVIDUAL: BOMBILLA
function toggleLuz(el) {
    el.classList.toggle("encendido");
    const estaEncendido = el.classList.contains("encendido");
    const idLuz = el.getAttribute('data-luz'); 

    fetch(`${BASE_URL}/api/luz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ luz_id: parseInt(idLuz), estado: estaEncendido })
    }).catch(err => {
        console.error("Error al conectar con el servidor:", err);
        el.classList.toggle("encendido", !estaEncendido);
    });
}

// 3. EDITAR NOMBRE
function editarNombre(elementoLapiz) {
    const contenedor = elementoLapiz.parentElement;
    const divNombre = contenedor.querySelector('.persona-nombre');
    const nombreActual = divNombre.innerText;
    const nuevoNombre = prompt("Ingresa el nuevo nombre:", nombreActual);
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        divNombre.innerText = nuevoNombre.trim();
    }
}

// 4. DESPLEGABLE
function toggleDesplegable(event, numeroPiso) {
    event.stopPropagation();
    const card = document.querySelector(`.piso-${numeroPiso}`);
    if (!card) return;
    const body = card.querySelector('.piso-body');
    const flecha = card.querySelector('.flechita');
    body.classList.toggle('oculto');
    flecha.classList.toggle('cerrada', body.classList.contains('oculto'));
}



// ==========================================
// 5. BUCLE: MANTENER EL ESTADO SINCRONIZADO
// ==========================================

function actualizarEstadoSilencioso() {
    // Hace una petición GET a nuestra ruta de Python
    fetch(`${BASE_URL}/api/estado_luces`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'ok') {
                const lucesOn = data.encendidas; // Lista de IDs prendidos

                // Recorre todos los foquitos en la pantalla
                document.querySelectorAll('.avatar').forEach(avatar => {
                    const idLuz = parseInt(avatar.getAttribute('data-luz'));
                    
                    // Si la luz está en la base de datos, la enciende visualmente
                    if (lucesOn.includes(idLuz)) {
                        avatar.classList.add('encendido');
                    } else {
                        avatar.classList.remove('encendido');
                    }
                });
            }
        })
        .catch(err => {
            // Ponemos un mensaje silencioso para que no llene la consola de rojo si parpadea el internet
            console.log("Sondeando estado de luces..."); 
        });
}

// Cuando la página carga, hacemos arrancar el motor:
document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando conexión con el servidor...");
    
    // 1. Preguntamos inmediatamente al abrir la página
    actualizarEstadoSilencioso();
    
    // 2. Activamos el bucle: Repetir cada 3 segundos (3000 ms)
    setInterval(actualizarEstadoSilencioso, 3000); 
});