const BASE_URL = "https://asking-rna-holders-addressing.trycloudflare.com";

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