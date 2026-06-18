const BASE_URL = "https://flu-cabin-evening-superior.trycloudflare.com"; // <-- ⚠️ Recuerda actualizar este link si reinicias Cloudflare

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

    fetch(`${BASE_URL}/api/luz/piso`,{ 
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
// 3. FORZAR VARIOS PISOS A LA VEZ
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
    el.classList.toggle("encendido");
    const estaEncendido = el.classList.contains("encendido");
    const idLuz = el.getAttribute('data-luz'); 

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
        actualizarEstadoSilencioso();
    })
    .catch(err => {
        console.error("❌ Error de comunicación con el servidor:", err);
        el.classList.toggle("encendido", !estaEncendido);
    });
}

// ==========================================
// 5. FUNCIONES DE INTERFAZ
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

// =======================================================================================
// 6. BUCLE: ACTUALIZACIÓN DE BOMBILLOS Y RAYOS (CÓDIGO CORREGIDO PARA TIEMPO REAL)
// =======================================================================================
let actualizandoSemaforo = false; 

function actualizarEstadoSilencioso() {
    if (actualizandoSemaforo) return; 
    actualizandoSemaforo = true;

    const JORNADA_MAXIMA = 10.0;

    fetch(`${BASE_URL}/api/estado_luces?t=${new Date().getTime()}`)
        .then(res => {
            if (!res.ok) throw new Error("Error en respuesta del servidor");
            return res.json();
        })
        .then(data => {
            if (data.status === 'ok') {
                const lucesOn = data.encendidas;           
                const estadoReal = (data.estado_real || []).map(id => String(id).trim()); 

                document.querySelectorAll('.persona').forEach(persona => {
                    const avatar = persona.querySelector('.avatar');
                    const rayo = persona.querySelector('.icono-rayo'); 
                    const barraLlenado = persona.querySelector('.barra-llenado'); 
                    
                    if (!avatar || !rayo) return;

                    const idLuz = String(avatar.getAttribute('data-luz')).trim(); 

                    let estaPrendida = false;
                    let horasUso = 0;
                    let porcentajeDisplay = 0;

                    if (lucesOn && lucesOn[idLuz] !== undefined) {
                        horasUso = parseFloat(lucesOn[idLuz]); 
                        porcentajeDisplay = (horasUso / JORNADA_MAXIMA) * 100;
                        if (porcentajeDisplay > 100) porcentajeDisplay = 100; 
                        
                        if (barraLlenado) {
                            barraLlenado.innerText = porcentajeDisplay.toFixed(0) + "%";
                            barraLlenado.style.width = porcentajeDisplay.toFixed(0) + "%";
                        }
                    } else if (barraLlenado && barraLlenado.innerText.trim() !== "") {
                        const numExtraido = parseFloat(barraLlenado.innerText);
                        if (!isNaN(numExtraido)) porcentajeDisplay = numExtraido;
                    }

                    if (estadoReal.includes(idLuz)) {
                        estaPrendida = true;
                    }

                    if (estaPrendida) {
                        avatar.classList.add('encendido'); 
                        avatar.style.backgroundColor = "#39ff14"; 
                        avatar.style.borderColor = "#2eb80d"; 
                    } else {
                        avatar.classList.remove('encendido');
                        avatar.style.backgroundColor = "#ff4c4c"; 
                        avatar.style.borderColor = "#c90000";
                    }

                    const trazoRayo = rayo.querySelector('path'); 
                    let colorSemaforo = "";
                    if (porcentajeDisplay <= 33) {
                        colorSemaforo = "#39ff14"; 
                    } else if (porcentajeDisplay > 33 && porcentajeDisplay <= 66) {
                        colorSemaforo = "#ffd700"; 
                    } else {
                        colorSemaforo = "#ff4c4c"; 
                    }

                    rayo.style.color = colorSemaforo;
                    if (trazoRayo) {
                        trazoRayo.setAttribute('fill', colorSemaforo);
                    }
                });
            }
        })
        .catch(err => console.error("❌ Error de red en actualización silenciosa:", err))
        .finally(() => {
            actualizandoSemaforo = false; 
        });
}

// ==========================================
// 7. INICIO DEL SISTEMA (Modificado para Modo Oscuro y Menú)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Iniciando interfaz...");
    
    cargarNombres();
    actualizarEstadoSilencioso();
    setInterval(actualizarEstadoSilencioso, 3000); 

    const btnHamburguesa = document.getElementById('btn-hamburguesa');
    const menuLateral = document.getElementById('menu-lateral');
    const themeToggleBtn = document.getElementById('theme-toggle');

    // --- 7A. GESTIÓN DEL MENÚ LATERAL ---
    if (btnHamburguesa && menuLateral) {
        btnHamburguesa.addEventListener('click', (evento) => {
            evento.stopPropagation(); 
            menuLateral.classList.toggle('mostrar');
        });

        document.addEventListener('click', (evento) => {
            if (!menuLateral.contains(evento.target) && evento.target !== btnHamburguesa) {
                menuLateral.classList.remove('mostrar');
            }
        });
    }

    // --- 7B. GESTIÓN INTEGRADA DEL MODO OSCURO ---
    if (themeToggleBtn) {
        // Comprobar preferencia guardada al cargar la página
        if (localStorage.getItem("theme") === "dark") {
            document.body.classList.add("dark-mode");
            themeToggleBtn.innerHTML = "☀️ Modo Claro";
        } else {
            themeToggleBtn.innerHTML = "🌙 Modo Oscuro";
        }

        // Evento clic para cambiar entre modos
        themeToggleBtn.addEventListener("click", (evento) => {
            evento.stopPropagation(); // Evita que se cierre el menú lateral al hacer clic
            
            document.body.classList.toggle("dark-mode");
            
            if (document.body.classList.contsins("dark-mode")) {
                themeToggleBtn.innerHTML = "☀️ Modo Claro";
                localStorage.setItem("theme", "dark");
            } else {
                themeToggleBtn.innerHTML = "🌙 Modo Oscuro";
                localStorage.setItem("theme", "light");
            }
        });
    }
});