from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import mysql.connector

app = Flask(__name__)
CORS(app)

# 🔌 CONEXIÓN A MYSQL
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Luz2710*",  
    database="luces_oficina"
)
cursor = db.cursor()

# 🔁 ENVÍO A NODE-RED (NO SE TOCA)
def enviar_a_nodered(datos_json):
    url = "http://10.14.15.28:1880/actualizar-luz"
    try:
        requests.post(url, json=datos_json, timeout=2)
        print(f"✅ Enviado a Node-RED: {datos_json}")
    except:
        print("❌ Error conectando a Node-RED")

# ==========================================
# 🔵 CONTROL INDIVIDUAL
# ==========================================
@app.route('/api/luz', methods=['POST'])
def recibir_luz():
    datos = request.json
    
    # 🔥 CORRECCIÓN: Asegúrate de recibir el ID de la luz, no el del piso.
    # Si tu frontend manda la variable como 'id', usa datos.get('id')
    id_luz = datos.get('luz_id') 
    estado = datos.get('estado')

    print(f"📡 Luz {id_luz} -> {'ON' if estado else 'OFF'}")

    if estado:
        cursor.execute(
            "INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())",
            (id_luz,)
        )
    else:
        cursor.execute(
            """UPDATE sesiones_luz 
               SET hora_apagado = NOW()
               WHERE luz_id = %s AND hora_apagado IS NULL""",
            (id_luz,)
        )

    db.commit()

    # 🔁 NODE-RED
    enviar_a_nodered({
        "luz_id": id_luz, # 🔥 CORRECCIÓN: Enviar el ID correcto a Node-RED
        "estado": estado
    })

    return jsonify({"status": "ok"})


# ==========================================
# 🏢 CONTROL POR PISO
# ==========================================
@app.route('/api/luz/piso', methods=['POST'])
def recibir_piso():
    datos = request.json
    
    numero_piso = datos.get('piso')
    estado = datos.get('estado')

    print(f"📡 Piso {numero_piso} -> {'ON' if estado else 'OFF'}")

    # 🔥 CORRECCIÓN: Generar el ID de luz correcto dependiendo del piso.
    # Ejemplo: Si es piso 1, genera 1,2,3,4,5,6,7,8.
    # Si es piso 2, genera 11.12.13.14.15,16,17,18.
    for i in range(1, 6):                
        luz_id_real = int(f"{numero_piso}0{i}") 

        if estado:
            cursor.execute(
                "INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())",
                (luz_id_real,)
            )
        else:
            cursor.execute(
                """UPDATE sesiones_luz 
                   SET hora_apagado = NOW()
                   WHERE luz_id = %s AND hora_apagado IS NULL""",
                (luz_id_real,)
            )

    db.commit()

    # 🔁 NODE-RED
    enviar_a_nodered({
        "piso": numero_piso,
        "accion": "toggle_piso",
        "estado": estado
    })

    return jsonify({"status": "ok"})




# 🚀 INICIAR SERVIDOR
if __name__ == '__main__':
    print("🚀 Servidor en http://127.0.0.1:5000")
    app.run(port=5000, debug=True)
    # ==========================================
# 🏢 CONTROL POR PISO
# ==========================================
@app.route('/api/luz/piso', methods=['POST'])
def recibir_piso():
    datos = request.json
    
    numero_piso = datos.get('piso')
    estado = datos.get('estado')

    print(f"📡 Piso {numero_piso} -> {'ON' if estado else 'OFF'}")

    # 1. Le preguntamos a la Base de Datos qué luces pertenecen a este piso
    cursor.execute("SELECT id FROM luces WHERE piso = %s", (numero_piso,))
    luces_del_piso = cursor.fetchall() 

    # 2. Recorremos cada luz encontrada y la prendemos/apagamos
    for luz in luces_del_piso:
        id_luz = luz[0] # Sacamos el número exacto del foco

        # Guardar en la base de datos
        if estado:
            cursor.execute(
                "INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())",
                (id_luz,)
            )
        else:
            cursor.execute(
                """UPDATE sesiones_luz 
                   SET hora_apagado = NOW()
                   WHERE luz_id = %s AND hora_apagado IS NULL""",
                (id_luz,)
            )
        
        # Le enviamos la señal a Node-RED por cada foco individualmente
        enviar_a_nodered({
            "luz_id": id_luz,
            "estado": estado
        })

    db.commit()

    return jsonify({"status": "ok", "mensaje": f"Piso {numero_piso} actualizado"})