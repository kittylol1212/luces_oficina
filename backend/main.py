from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import mysql.connector

app = Flask(__name__)
CORS(app)

# 🔌 CONEXIÓN A MYSQL LOCAL
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Luz2710*", 
    database="luces_oficina"
)
cursor = db.cursor(buffered=True)

# 🔁 ENVÍO A NODE-RED
def enviar_a_nodered(datos_json):
    url = "http://10.14.15.28:1880/actualizar-luz"
    try:
        requests.post(url, json=datos_json, timeout=2)
        print(f"✅ Enviado a Node-RED: {datos_json}")
    except:
        print("❌ Error conectando a Node-RED")

@app.route('/')
def inicio():
    return "¡Servidor funcionando perfectamente!"

# 🔵 CONTROL INDIVIDUAL
@app.route('/api/luz', methods=['POST'])
def recibir_luz():
    datos = request.json
    id_luz = datos.get('luz_id') 
    estado = datos.get('estado')

    print(f"📡 Luz {id_luz} -> {'ON' if estado else 'OFF'}")

    if estado:
        cursor.execute("INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())", (id_luz,))
    else:
        cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))

    db.commit()
    enviar_a_nodered({"luz_id": id_luz, "estado": estado})
    return jsonify({"status": "ok"})

# 🏢 CONTROL POR PISO / MAESTRO (PISO 0)
@app.route('/api/luz/piso', methods=['POST'])
def recibir_piso():
    datos = request.json
    numero_piso = datos.get('piso')
    estado = datos.get('estado')

    # Si el número de piso es 0, seleccionamos TODAS las luces, si no, solo las del piso
    if numero_piso == 0:
        print(f"🚨 COMANDO MAESTRO -> {'ENCENDER' if estado else 'APAGAR'} TODO EL EDIFICIO")
        cursor.execute("SELECT id FROM luces")
    else:
        print(f"📡 Piso {numero_piso} -> {'ON' if estado else 'OFF'}")
        cursor.execute("SELECT id FROM luces WHERE piso = %s", (numero_piso,))
    
    luces_a_procesar = cursor.fetchall() 

    for luz in luces_a_procesar:
        id_luz = luz[0]
        if estado:
            # Para evitar duplicados en 'encendidos', primero cerramos sesiones abiertas si existieran
            cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
            cursor.execute("INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())", (id_luz,))
        else:
            cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
        
        # Enviamos la señal a Node-RED para cada luz
        enviar_a_nodered({"luz_id": id_luz, "estado": estado})

    db.commit()
    
    msg = "Edificio completo actualizado" if numero_piso == 0 else f"Piso {numero_piso} actualizado"
    return jsonify({"status": "ok", "mensaje": msg})


# ==========================================
# 🔍 CONSULTAR ESTADO AL ABRIR LA PÁGINA
# ==========================================
@app.route('/api/estado_luces', methods=['GET'])
def obtener_estado():
    try:
        # Busca las luces que están encendidas (hora_apagado es NULL)
        cursor.execute("SELECT luz_id FROM sesiones_luz WHERE hora_apagado IS NULL")
        luces_encendidas = cursor.fetchall()
        
        # Convierte el resultado en una lista simple
        lista_encendidas = [luz[0] for luz in luces_encendidas]
        
        return jsonify({"status": "ok", "encendidas": lista_encendidas})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)})

if __name__ == '__main__':
    app.run(port=5000, debug=True)