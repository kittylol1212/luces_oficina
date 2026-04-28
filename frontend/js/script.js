const BASE_URL = "https://vendors-occupational-differ-women.trycloudflare.com";

// Variable global para evitar conflictos
let bloqueoSincronizacion = false;

// ==========================================
// 1. BOTONES MAESTROS (ARRIBA)
// ==========================================
function forzarEncendidoPisosGlobal(listaPisos, encender) {
    bloqueoSincronizacion = true; 

    listaPisos.forEach((numeroPiso, index) => {
        setTimeout(() => {
            const card = document.querySelector(`.piso-${numeroPiso}`);
            if (card) {
                card.querySelectorAll('.avatar').forEach(luz => {
                    luz.classList.toggle('encendido', encender);
                });
            }

            fetch(`${BASE_URL}/api/luz/piso`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ piso: numeroPiso, estado: encender })
            })
            .then(() => {
                if (index === listaPisos.length - 1) {
                    setTimeout(() => { bloqueoSincronizacion = false; }, 2000);
                }
            })
            .catch(err => {
                console.error("Error en maestro:", err);
                bloqueoSincronizacion = false;
            });
        }, index * 150); 
    });
}

// ==========================================
// 2. FUNCIÓN INDIVIDUAL (ESTA ES LA QUE TE FALLABA)
// ==========================================
function toggleLuz(el) {
    // Cambio visual inmediato
    el.classList.toggle("encendido");
    const estaEncendido = el.classList.contains("encendido");
    const idLuz = el.getAttribute('data-luz'); 

    if (!idLuz) {
        console.error("Error: No se encontró el ID de la luz en el atributo data-luz");
        return;
    }

    fetch(`${BASE_URL}/api/luz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ luz_id: parseInt(idLuz), estado: estaEncendido })
    })
    .then(res => res.json())
    .then(data => console.log("Luz individual actualizada"))
    .catch(err => {
        console.error("Error al conectar:", err);
        // Si falla, revertimos el color
        el.classList.toggle("encendido", !estaEncendido);
    });
}

// ==========================================
// 3. FUNCIÓN POR PISO (BOTÓN EN TÍTULO AZUL)
// ==========================================
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
    }).catch(err => console.error("Error grupal:", err));
}

// ==========================================
// 4. INTERFAZ Y DESPLEGABLES
// ==========================================
function editarNombre(elementoLapiz) {
    const contenedor = elementoLapiz.parentElement;
    const divNombre = contenedor.querySelector('.persona-nombre');
    const nuevoNombre = prompt("Ingresa el nuevo nombre:", divNombre.innerText);
    if (nuevoNombre) divNombre.innerText = nuevoNombre.trim();
}

function toggleDesplegable(event, numeroPiso) {
    event.stopPropagation();
    const card = document.querySelector(`.piso-${numeroPiso}`);
    if (!card) return;
    const body = card.querySelector('.piso-body');
    const flecha = card.querySelector('.flechita');
    body.classList.toggle('oculto');
    if (flecha) flecha.classList.toggle('cerrada');
}

// ==========================================
// 5. ACTUALIZACIÓN AUTOMÁTICA
// ==========================================
function actualizarEstadoSilencioso() {
    if (bloqueoSincronizacion) return;
    
    fetch(`${BASE_URL}/api/estado_luces`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'ok') {
                const lucesOn = data.encendidas;
                document.querySelectorAll('.avatar').forEach(avatar => {
                    const idLuz = parseInt(avatar.getAttribute('data-luz'));
                    if (lucesOn.includes(idLuz)) {
                        avatar.classList.add('encendido');
                    } else {
                        avatar.classList.remove('encendido');
                    }
                });
            }
        })
        .catch(() => console.log("Reintentando conexión..."));
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoSilencioso();
    setInterval(actualizarEstadoSilencioso, 3000); 
});