const BASE_URL = "https://lectures-understand-brisbane-sufficient.trycloudflare.com"; 

document.addEventListener("DOMContentLoaded", function () {
    const JORNADA_MAXIMA = 10.0;
    const cuerpoTabla = document.getElementById("cuerpo-tabla");

    fetch(`${BASE_URL}/api/datos_reporte`)
        .then(response => response.json())
        .then(data => {
            if (data.status === "ok") {
                cuerpoTabla.innerHTML = ""; 
                data.tabla.forEach(item => {
                    let porcentaje = (item.horas / JORNADA_MAXIMA) * 100;
                    if (porcentaje > 100) porcentaje = 100; 
                    porcentaje = porcentaje.toFixed(1);

                    const fila = document.createElement("tr");
                    fila.innerHTML = `
                        <td><strong>Luz ${item.id_luz}</strong> <br><small style="color:#777">${item.empleado}</small></td>
                        <td>${item.horas.toFixed(2)} hrs</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="barra-consumo">
                                    <div class="progreso" style="width: ${porcentaje}%;"></div>
                                </div>
                                <span style="font-size: 13px; font-weight: bold; color: #555;">${porcentaje}%</span>
                            </div>
                        </td>
                    `;
                    cuerpoTabla.appendChild(fila);
                });
                inicializarGrafica(data.grafica.eje_x, data.grafica.eje_y);
            }
        })
        .catch(error => console.error("❌ Falló la conexión:", error));
});

function inicializarGrafica(etiquetasFechas, valoresConsumo) {
    const ctx = document.getElementById('canvasGrafico').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetasFechas, 
            datasets: [{
                label: 'Consumo diario total (Horas)',
                data: valoresConsumo, 
                borderColor: '#008CBA', 
                backgroundColor: 'rgba(0, 140, 186, 0.1)',
                borderWidth: 3, tension: 0.3, fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}