const BASE_URL = "https://missing-prayer-seed-screensavers.trycloudflare.com"; // <-- ⚠️ Recuerda actualizar este link si reinicias Cloudflare

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
// 6. BUCLE: SEMÁFORO EN EL RAYO (CORREGIDO PARA INYECTAR COLOR DIRECTO)
// =======================================================================================
function actualizarEstadoSilencioso() {
    // La jornada máxima son 10 horas diarias (8:00 AM a 6:00 PM) para calcular el porcentaje
    const JORNADA_MAXIMA = 10.0;

    fetch(`${BASE_URL}/api/estado_luces?t=${new Date().getTime()}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'ok') {
                const lucesOn = data.encendidas;           // Las horas crudas enviadas por la consulta de Python
                const estadoReal = data.estado_real || []; // Quién está prendido físicamente en este segundo
                const esListaVieja = Array.isArray(lucesOn);

                document.querySelectorAll('.persona').forEach(persona => {
                    const avatar = persona.querySelector('.avatar');
                    const rayo = persona.querySelector('.icono-rayo'); 
                    const barraLlenado = persona.querySelector('.barra-llenado'); 
                    
                    if (!avatar || !rayo) return;

                    const idLuz = String(avatar.getAttribute('data-luz')); 
                    const idLuzNumero = parseInt(idLuz);
                    
                    // Reiniciamos la clase del bombillo antes de actualizar
                    avatar.classList.remove('encendido');

                    let estaPrendida = false;
                    let horasUso = 0;
                    let porcentajeDisplay = 0;

                    // --- 1. LEER LAS HORAS ACUMULADAS Y CALCULAR EL % DE JORNADA ---
                    if (!esListaVieja && lucesOn && lucesOn[idLuz] !== undefined) {
                        horasUso = parseFloat(lucesOn[idLuz]); 
                        
                        // Convertimos las horas acumuladas en un porcentaje real sobre el día (máx 10 hrs)
                        porcentajeDisplay = (horasUso / JORNADA_MAXIMA) * 100;
                        if (porcentajeDisplay > 100) porcentajeDisplay = 100; // Tope máximo por si hacen horas extra
                        
                        // Modificamos el texto interno de la barra para que se lea amigable con el símbolo de %
                        if (barraLlenado) {
                            barraLlenado.innerText = porcentajeDisplay.toFixed(0) + "%";
                            
                            // Ajustamos dinámicamente el ancho físico de la barra gris
                            barraLlenado.style.width = porcentajeDisplay.toFixed(0) + "%";
                        }
                    } else {
                        if (barraLlenado && barraLlenado.innerText.trim() !== "") {
                            const numExtraido = parseFloat(barraLlenado.innerText);
                            if (!isNaN(numExtraido)) porcentajeDisplay = numExtraido;
                        }
                    }

                    // --- 2. LEER EL ESTADO REAL FÍSICO (Para encender/apagar el círculo del bombillo) ---
                    if (esListaVieja) {
                        if (lucesOn.includes(idLuzNumero) || lucesOn.includes(idLuz)) {
                            estaPrendida = true;
                        }
                    } else {
                        if (estadoReal.includes(idLuz)) {
                            estaPrendida = true;
                        }
                    }

                    // Encendemos el círculo si la luz está activa en este momento
                    if (estaPrendida) {
                        avatar.classList.add('encendido'); 
                    }

                    // --- 3. LÓGICA ASIGNACIÓN DE COLOR AL SEMÁFORO (RAYO) ---
                    // Se inyecta el color directamente al SVG dependiendo del % consumido
                    if (porcentajeDisplay <= 33) {
                        rayo.style.color = "#39ff14"; // Verde Neón
                    } else if (porcentajeDisplay > 33 && porcentajeDisplay <= 66) {
                        rayo.style.color = "#ffd700"; // Amarillo
                    } else {
                        rayo.style.color = "#ff4c4c"; // Rojo
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

    const btnHamburguesa = document.getElementById('btn-hamburguesa');
    const menuLateral = document.getElementById('menu-lateral');

    if (btnHamburguesa && menuLateral) {
        btnHamburguesa.addEventListener('click', (evento) => {
            evento.stopPropagation(); 
            menuLateral.classList.toggle('mostrar');
        });

        document.addEventListener('click', (evento) => {
            if (!menuLateral.contains(evento.target) && evento.target !== btnHamburguesa) {
                menuLateral.removeProperty ? menuLateral.removeProperty('mostrar') : menuLateral.classList.remove('mostrar');
            }
        });
    }
});