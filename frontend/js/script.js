// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================
const BASE_URL = "https://resort-intended-kept-syntax.trycloudflare.com"; 

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
// 4. FUNCIONES DE ESTADÍSTICAS (NUEVO)
// ==========================================
function cargarGrafico() {
    const canvas = document.getElementById('canvasGrafico');
    if (!canvas) return; // Si no estamos en la página de estadísticas, no hace nada

    console.log("📊 Cargando datos del gráfico...");
    fetch(`${BASE_URL}/api/stats/barras`)
        .then(res => res.json())
        .then(datos => {
            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: datos.map(d => d.label),
                    datasets: [{
                        label: 'Horas de Consumo Total',
                        data: datos.map(d => d.data),
                        backgroundColor: 'rgba(0, 129, 180, 0.7)',
                        borderColor: '#0081B4',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true } }
                }
            });
        })
        .catch(err => console.error("❌ Error al traer datos para el gráfico:", err));
}

// ==========================================
// 5. BUCLE DE ESTADO Y SEMÁFOROS
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
                    if (!avatar) return;

                    const idLuz = String(avatar.getAttribute('data-luz')); 
                    const verde = persona.querySelector('.circulo.verde');
                    const amarillo = persona.querySelector('.circulo.amarillo');
                    const rojo = persona.querySelector('.circulo.rojo');

                    // Reset visual
                    if(verde) verde.classList.remove('activo');
                    if(amarillo) amarillo.classList.remove('activo');
                    if(rojo) rojo.classList.remove('activo');
                    avatar.classList.remove('encendido');

                    let estaPrendida = false;
                    let horas = 0;

                    if (esListaVieja) {
                        if (lucesOn.includes(parseInt(idLuz))) estaPrendida = true;
                    } else {
                        if (lucesOn && lucesOn[idLuz] !== undefined) {
                            estaPrendida = true;
                            horas = parseFloat(lucesOn[idLuz]); 
                        }
                    }

                    if (estaPrendida) {
                        avatar.classList.add('encendido'); 
                        if (horas < 4) { if(verde) verde.classList.add('activo'); }
                        else if (horas < 8) { if(amarillo) amarillo.classList.add('activo'); }
                        else { if(rojo) rojo.classList.add('activo'); }
                    }
                });
            }
        })
        .catch(err => console.error("❌ Error de red", err));
}

// ==========================================
// 6. FUNCIONES DE INTERFAZ (NOMBRES)
// ==========================================
function cargarNombres() {
    const todasLasPersonas = document.querySelectorAll('.persona');
    todasLasPersonas.forEach((persona, indice) => {
        const nombreGuardado = localStorage.getItem('persona_nombre_' + indice);
        if (nombreGuardado) {
            const divNombre = persona.querySelector('.persona-nombre');
            if (divNombre) divNombre.innerText = nombreGuardado;
        }
    });
}

// ==========================================
// 7. INICIO DEL SISTEMA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Iniciando sistema unificado...");
    
    // Funciones básicas
    cargarNombres();
    actualizarEstadoSilencioso();
    setInterval(actualizarEstadoSilencioso, 3000); 

    // Cargar gráfico si el canvas existe en el HTML
    cargarGrafico();

    // Lógica de Menú Hamburguesa
    const btnHamburguesa = document.getElementById('btn-hamburguesa');
    const menuLateral = document.getElementById('menu-lateral');

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
});