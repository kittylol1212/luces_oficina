const BASE_URL = "https://popular-neural-designed-disclosure.trycloudflare.com"; // <-- ⚠️ Recuerda actualizar este link si reinicias Cloudflare

// ==========================================
// 1. FUNCIÓN MAESTRA: TODO EL EDIFICIO (PISO 0)
// ==========================================
function toggleTodoElEdificio(encender) {
    const accion = encender ? "encender" : "apagar";
    if (!confirm(`¿Estás seguro de que quieres ${accion} todas las luces del edificio?`)) return;

    const todasLasLuces = document.querySelectorAll('.avatar');
    todasLasLuces.forEach(luz => {
        if (encender) {
            luz.classList.add('encendido');
        } else {
            luz.classList.remove('encendido');
        }
    });

    fetch(`${BASE_URL}/api/luz/piso`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            piso: 0, 
            estado: encender 
        })
    })
    .then(res => res.json())
    .then(data => console.log("✅ Comando maestro procesado:", data.mensaje))
    .catch(err => {
        console.error("❌ Error en comando maestro:", err);
        alert("Error al conectar con el servidor.");
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

// ========================================================================
// 3. FORZAR VARIOS PISOS A LA VEZ (Ej: Botones para Pisos 1, 2 y 3)
// ========================================================================
function forzarEncendidoPisosGlobal(listaPisos, encender) {
    listaPisos.forEach(numeroPiso => {
        const card = document.querySelector(`.piso-${numeroPiso}`);
        if (card) {
            const luces = card.querySelectorAll('.avatar');
            luces.forEach(luz => {
                luz.classList.toggle('encendido', encender);
            });
        }

        fetch(`${BASE_URL}/api/luz/piso`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                piso: numeroPiso, 
                estado: encender 
            })
        })
        .then(res => res.json())
        .then(data => console.log(`Piso ${numeroPiso} sincronizado`))
        .catch(err => console.error(`Error en piso ${numeroPiso}:`, err));
    });
}

// ==========================================
// 4. FUNCIÓN INDIVIDUAL: BOMBILLA
// ==========================================
function toggleLuz(el) {
    // 1. Cambio visual instantáneo
    el.classList.toggle("encendido");
    const estaEncendido = el.classList.contains("encendido");
    const idLuz = el.getAttribute('data-luz'); 

    // 2. Notificar al backend (Python)
    fetch(`${BASE_URL}/api/luz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            luz_id: parseInt(idLuz), 
            estado: estaEncendido 
        })
    })
    .then(res => {
        if (!res.ok) throw new Error("El servidor no respondió correctamente");
        console.log(`📡 Luz ${idLuz} sincronizada con estado: ${estaEncendido}`);
        
        // Hacemos una llamada rápida silenciosa para actualizar el semáforo de inmediato
        actualizarEstadoSilencioso();
    })
    .catch(err => {
        console.error("❌ Error de comunicación con el servidor:", err);
        // Si hay error en la red, revertimos el color del botón
        el.classList.toggle("encendido", !estaEncendido);
    });
}

// ==========================================
// 5. FUNCIONES DE INTERFAZ (NOMBRES Y DESPLEGABLES)
// ==========================================
function editarNombre(elemento) {
    const todasLasPersonas = Array.from(document.querySelectorAll('.persona'));
    const contenedorPersona = elemento.closest('.persona');
    const indice = todasLasPersonas.indexOf(contenedorPersona);

    const divNombre = contenedorPersona.querySelector('.persona-nombre');
    const nombreActual = divNombre.innerText;

    const nuevoNombre = prompt("Ingresa el nuevo nombre:", nombreActual);

    if (nuevoNombre !== null && nuevoNombre.trim() !== "") {
        divNombre.innerText = nuevoNombre.trim();
        localStorage.setItem('persona_nombre_' + indice, nuevoNombre.trim());
    }
}

function cargarNombres() {
    const todasLasPersonas = document.querySelectorAll('.persona');
    todasLasPersonas.forEach((persona, indice) => {
        const nombreGuardado = localStorage.getItem('persona_nombre_' + indice);
        if (nombreGuardado) {
            const divNombre = persona.querySelector('.persona-nombre');
            divNombre.innerText = nombreGuardado;
        }
    });
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
// 6. BUCLE: MANTENER EL ESTADO SINCRONIZADO Y SEMÁFORO
// ==========================================
function actualizarEstadoSilencioso() {
    fetch(`${BASE_URL}/api/estado_luces?t=${new Date().getTime()}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'ok') {
                const lucesOn = data.encendidas; 
                const esListaVieja = Array.isArray(lucesOn);

                document.querySelectorAll('.persona').forEach(persona => {
                    const avatar = persona.querySelector('.avatar');
                    const circuloEstado = persona.querySelector('.circulo-estado');
                    const cuadradoNuevo = persona.querySelector('.cuadrado-nuevo'); // Tu cuadrado con el %
                    
                    if (!avatar) return;

                    const idLuz = String(avatar.getAttribute('data-luz')); 
                    const idLuzNumero = parseInt(idLuz);
                    
                    // 1. Apagamos el bombillo visualmente por defecto
                    avatar.classList.remove('encendido');

                    let estaPrendida = false;
                    let porcentajeUso = 0; 

                    // 2. Revisamos si la luz está prendida físicamente
                    if (esListaVieja) {
                        if (lucesOn.includes(idLuzNumero) || lucesOn.includes(idLuz)) {
                            estaPrendida = true;
                        }
                    } else {
                        if (lucesOn && lucesOn[idLuz] !== undefined) {
                            estaPrendida = true;
                            porcentajeUso = parseFloat(lucesOn[idLuz]); 
                        }
                    }

                    // 💡 TRUCO CLAVE: Si la luz está apagada, leemos el porcentaje directamente 
                    // de lo que tienes escrito dentro de tu cuadrado gris para no perder el color.
                    if (cuadradoNuevo && cuadradoNuevo.innerText.trim() !== "") {
                        const numeroExtraido = parseFloat(cuadradoNuevo.innerText);
                        if (!isNaN(numeroExtraido)) {
                            porcentajeUso = numeroExtraido;
                        }
                    }

                    // 3. Encendemos el bombillo solo si está prendida la luz física
                    if (estaPrendida) {
                        avatar.classList.add('encendido'); 
                    }

                    // 4. PINTAMOS EL CÍRCULO SIEMPRE (basado en el porcentaje de 0% a 100%)
                    if (circuloEstado) {
                        if (porcentajeUso <= 33) {
                            // De 0% a 33% es Bueno / Bajo -> VERDE
                            circuloEstado.style.backgroundColor = '#32cd32'; 
                        } else if (porcentajeUso > 33 && porcentajeUso <= 66) {
                            // De 34% a 66% es Medio -> AMARILLO
                            circuloEstado.style.backgroundColor = '#ffd700'; 
                        } else {
                            // De 67% a 100% es Malo / Muy Alto -> ROJO
                            circuloEstado.style.backgroundColor = '#ff4500'; 
                        }
                    }
                });
            }
        })
        .catch(err => console.error("❌ Error de red en actualización silenciosa", err));
}

// ==========================================
// 7. INICIO DEL SISTEMA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Iniciando interfaz...");
    
    cargarNombres();
    actualizarEstadoSilencioso();
    setInterval(actualizarEstadoSilencioso, 3000); 

    // --- LÓGICA DEL MENÚ HAMBURGUESA ---
    const btnHamburguesa = document.getElementById('btn-hamburguesa');
    const menuLateral = document.getElementById('menu-lateral');

    if (btnHamburguesa && menuLateral) {
        // Abrir/Cerrar menú al hacer clic en las barritas
        btnHamburguesa.addEventListener('click', (evento) => {
            evento.stopPropagation(); 
            menuLateral.classList.toggle('mostrar');
        });

        // Cerrar el menú si hacemos clic afuera
        document.addEventListener('click', (evento) => {
            if (!menuLateral.contains(evento.target) && evento.target !== btnHamburguesa) {
                menuLateral.classList.remove('mostrar');
            }
        });
    }
});