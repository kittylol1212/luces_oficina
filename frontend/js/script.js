// ==========================================
// 1. FUNCIÓN GRUPAL: APAGAR/ENCENDER UN PISO
// ==========================================
function toggleTodoElPiso(numeroPiso) {
    const card = document.querySelector(`.piso-${numeroPiso}`);
    if (!card) return;

    const luces = card.querySelectorAll('.avatar');
    
    // Evalúa si hay alguna apagada para decidir si enciende todo o apaga todo
    const algunaApagada = Array.from(luces).some(luz => !luz.classList.contains('encendido'));
    const nuevoEstado = algunaApagada; 

    // Actualización Visual Inmediata
    luces.forEach(luz => {
        luz.classList.toggle('encendido', nuevoEstado);
    });

    console.log(`Enviando orden al piso ${numeroPiso}, Estado: ${nuevoEstado}`);

    // Petición al servidor
    fetch('fetch("http://10.24.104.154:1880/luz")', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            piso: numeroPiso, 
            estado: nuevoEstado
        })
    }).catch(err => console.error("Error en comando grupal:", err));
}

// ==========================================
// 2. FUNCIÓN INDIVIDUAL: APAGAR/ENCENDER UNA BOMBILLA
// ==========================================
function toggleLuz(el) {
    el.classList.toggle("encendido");
    const estaEncendido = el.classList.contains("encendido");
    const idLuz = el.getAttribute('data-luz'); 

    console.log(`Enviando Individual - ID: ${idLuz}, Estado: ${estaEncendido}`);

    fetch('http://127.0.0.1:5000/api/luz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            luz_id: parseInt(idLuz), // 🔥 ¡AQUÍ ESTÁ LA MAGIA! Cambiamos 'piso' por 'luz_id'
            estado: estaEncendido
        })
    })
    .catch(err => {
        console.error("Error al conectar con el servidor:", err);
        el.classList.toggle("encendido", !estaEncendido);
    });
}

// ==========================================
// 3. FUNCIÓN PARA EDITAR EL NOMBRE
// ==========================================
function editarNombre(elementoLapiz) {
    // 1. Encontrar dónde está el texto del nombre justo al lado de este lápiz
    const contenedor = elementoLapiz.parentElement;
    const divNombre = contenedor.querySelector('.persona-nombre');
    
    // 2. Saber cuál es el nombre actual
    const nombreActual = divNombre.innerText;
    
    // 3. Abrir una ventanita preguntando el nuevo nombre
    const nuevoNombre = prompt("Ingresa el nuevo nombre para este escritorio:", nombreActual);
    
    // 4. Si el usuario escribió algo y le dio Aceptar, cambiamos el texto
    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        divNombre.innerText = nuevoNombre.trim();
        console.log(`Nombre cambiado de ${nombreActual} a ${nuevoNombre}`);
    }
}

// ==========================================
// 4. FUNCIÓN PARA OCULTAR/MOSTRAR LOS NOMBRES DEL PISO
// ==========================================
function toggleDesplegable(event, numeroPiso) {
    // Esto es CLAVE: Evita que el clic abra la lista Y prenda las luces al mismo tiempo
    event.stopPropagation(); 

    const card = document.querySelector(`.piso-${numeroPiso}`);
    if (!card) return;

    const body = card.querySelector('.piso-body');
    const flecha = card.querySelector('.flechita');

    // Alternar la clase 'oculto' en el cuerpo
    body.classList.toggle('oculto');

    // Hacer que la flecha mire hacia la izquierda si está oculto, o hacia abajo si está abierto
    if (body.classList.contains('oculto')) {
        flecha.classList.add('cerrada');
    } else {
        flecha.classList.remove('cerrada');
    }
}