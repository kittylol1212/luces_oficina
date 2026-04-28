const BASE_URL = "https://vendors-occupational-differ-women.trycloudflare.com";

// 🛑 Variable global para evitar que el bucle de 3 segundos interfiera con los botones
let bloqueoSincronizacion = false;

// ========================================================================
// 1. FUNCIÓN MAESTRA GLOBAL (BOTONES DE ARRIBA PARA VARIOS PISOS)
// ========================================================================
function forzarEncendidoPisosGlobal(listaPisos, encender) {
    bloqueoSincronizacion = true; // Pausamos el bucle de actualización

    listaPisos.forEach((numeroPiso, index) => {
        // Retrasamos cada petición un poco (100ms) para no saturar el servidor Python
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
            .then(res => res.json())
            .then(() => {
                console.log(`Piso ${numeroPiso} sincronizado`);
                // Si es el último piso de la lista, esperamos 1.5s y reactivamos el bucle
                if (index === listaPisos.length - 1) {
                    setTimeout(() => { 
                        bloqueoSincronizacion = false; 
                        console.log("Sincronización reactivada");
                    }, 1500);
                }
            })
            .catch(err => console.error(`Error en piso ${numeroPiso}:`, err));
        }, index * 100); 
    });
}

// ==========================================
// 2. FUNCIÓN GRUPAL: POR PISO (Alternar/Toggle)
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
    }).catch(err => console.error("Error en comando grupal:", err));
}

// ==========================================
// 3. FUNCIÓN INDIVIDUAL: BOMBILLA
// ==========================================
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

// ==========================================
// 4. FUNCIONES DE INTERFAZ (EDITAR Y DESPLEGAR)
// ==========================================
function editarNombre(elementoLapiz) {
    const contenedor = elementoLapiz.parentElement;
    const divNombre = contenedor.querySelector('.persona-nombre');
    const nombreActual = divNombre.innerText;
    const nuevoNombre = prompt("Ingresa el nuevo nombre:", nombreActual);
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        divNombre.innerText = nuevoNombre.trim();
    }
}

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
    // Si estamos mandando una orden maestra, ignoramos la actualización
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
        .catch(err => {
            console.log("Sondeando estado de luces..."); 
        });
}

// Inicio del sistema
document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando conexión con el servidor...");
    actualizarEstadoSilencioso();
    setInterval(actualizarEstadoSilencioso, 3000); 
});