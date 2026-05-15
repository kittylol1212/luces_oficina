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
// 6. BUCLE: MANTENER EL ESTADO SINCRONIZADO, PORCENTAJES Y RAYOS DINÁMICOS
// ==========================================
function actualizarEstadoSilencioso() {
    fetch(`${BASE_URL}/api/estado_luces?t=${new Date().getTime()}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'ok') {
                const lucesOn = data.encendidas; 
                
                console.log("💡 Estado desde Python:", lucesOn);
                
                const esListaVieja = Array.isArray(lucesOn);

                document.querySelectorAll('.persona').forEach(persona => {
                    const avatar = persona.querySelector('.avatar');
                    if (!avatar) return;

                    const idLuz = String(avatar.getAttribute('data-luz')); 
                    const idLuzNumero = parseInt(idLuz);
                    
                    // Seleccionamos tus elementos reales del HTML
                    const cuadradoNuevo = persona.querySelector('.cuadrado-nuevo');
                    // MODIFICACIÓN: Buscamos el icono del rayo SVG dentro de la persona
                    const rayoIcon = persona.querySelector('.rayo-icon');

                    // Reset inicial por defecto (Apagado / Sin consumo)
                    avatar.classList.remove('encendido');
                    if (cuadradoNuevo) cuadradoNuevo.innerText = "0%";
                    
                    // Si hay rayo, lo ponemos en gris por defecto cuando está apagado
                    if (rayoIcon) {
                        rayoIcon.style.fill = "#ccc";   
                        rayoIcon.style.stroke = "#ccc"; 
                    }

                    let estaPrendida = false;
                    let horas = 0;

                    // Verificamos si la luz está prendida según el formato de Python
                    if (esListaVieja) {
                        if (lucesOn.includes(idLuzNumero) || lucesOn.includes(idLuz)) {
                            estaPrendida = true;
                            horas = 0; 
                        }
                    } else {
                        if (lucesOn && lucesOn[idLuz] !== undefined) {
                            estaPrendida = true;
                            horas = parseFloat(lucesOn[idLuz]); 
                        }
                    }

                    // Si está encendida, hacemos los cálculos visuales
                    if (estaPrendida) {
                        avatar.classList.add('encendido'); 

                        // Supongamos que la jornada máxima son 8 horas para sacar el porcentaje
                        const jornadaMaxima = 8;
                        let porcentaje = (horas / jornadaMaxima) * 100;
                        if (porcentaje > 100) porcentaje = 100; // Tope máximo 100%

                        // 1. Mostrar el porcentaje en el cuadrado (sin decimales)
                        if (cuadradoNuevo) {
                            cuadradoNuevo.innerText = `${Math.round(porcentaje)}%`;
                        }

                        // 2. MODIFICACIÓN: Cambiar el color del RAYO SVG según las horas acumuladas
                        if (rayoIcon) {
                            if (horas < 4) {
                                // Verde (Bajo consumo)
                                rayoIcon.style.fill = "#2ecc71"; 
                                rayoIcon.style.stroke = "#2ecc71";
                            } else if (horas >= 4 && horas < 8) {
                                // Amarillo (Consumo medio)
                                rayoIcon.style.fill = "#f1c40f"; 
                                rayoIcon.style.stroke = "#f1c40f";
                            } else { 
                                // Rojo (Alto consumo / Límite)
                                rayoIcon.style.fill = "#e74c3c"; 
                                rayoIcon.style.stroke = "#e74c3c";
                            }
                        }
                    }
                });
            }
        })
        .catch(err => {
            console.error("❌ Error de red en actualización silenciosa", err);
        });
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