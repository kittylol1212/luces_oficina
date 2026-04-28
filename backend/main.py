from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import mysql.connector

app = Flask(__name__)
CORS(app)

# 🔌 CONFIGURACIÓN - REVISA ESTOS DATOS
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "Luz2710*",
    "database": "luces_oficina"
}

# IP DE NODE-RED (Asegúrate que sea la correcta)
NODE_RED_URL = "http://10.14.15.28:1880/actualizar-luz"

def conectar_db():
    return mysql.connector.connect(**DB_CONFIG)

# 🔁 FUNCIÓN CRÍTICA: ENVÍO A NODE-RED
def enviar_a_nodered(id_luz, estado):
    datos = {"luz_id": id_luz, "estado": estado}
    try:
        # Enviamos la orden física
        response = requests.post(NODE_RED_URL, json=datos, timeout=2)
        if response.status_code == 200:
            print(f"✅ FÍSICO: Luz {id_luz} enviada a Node-RED con éxito.")
        else:
            print(f"⚠️ Node-RED respondió con error {response.status_code} para luz {id_luz}")
    except Exception as e:
        print(f"❌ ERROR DE CONEXIÓN: No se pudo contactar a Node-RED en {NODE_RED_URL}. Verifica la IP.")

@app.route('/api/luz', methods=['POST'])
def recibir_luz():
    datos = request.json
    id_luz = datos.get('luz_id')
    estado = datos.get('estado')
    
    db = conectar_db()
    cursor = db.cursor()

    if estado:
        cursor.execute("SELECT id FROM sesiones_luz WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())", (id_luz,))
    else:
        cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))

    db.commit()
    db.close()

    # ESTA LÍNEA ES LA QUE PRENDE LA LUZ REAL
    enviar_a_nodered(id_luz, estado)
    
    return jsonify({"status": "ok"})

@app.route('/api/luz/piso', methods=['POST'])
def recibir_piso():
    datos = request.json
    numero_piso = datos.get('piso')
    estado = datos.get('estado')
    
    db = conectar_db()
    cursor = db.cursor()

    cursor.execute("SELECT id FROM luces WHERE piso = %s", (numero_piso,))
    luces = cursor.fetchall()

    for luz in luces:
        id_luz = luz[0]
        if estado:
            cursor.execute("SELECT id FROM sesiones_luz WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())", (id_luz,))
        else:
            cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
        
        # ENVIAR ORDEN FÍSICA PARA CADA LUZ DEL PISO
        enviar_a_nodered(id_luz, estado)

    db.commit()
    db.close()
    return jsonify({"status": "ok"})

@app.route('/api/estado_luces', methods=['GET'])
def obtener_estado():
    db = conectar_db()
    cursor = db.cursor()
    cursor.execute("SELECT luz_id FROM sesiones_luz WHERE hora_apagado IS NULL")
    lista_encendidas = [luz[0] for luz in cursor.fetchall()]
    db.close()
    return jsonify({"status": "ok", "encendidas": lista_encendidas})

if __name__ == '__main__':
    app.run(port=5000, debug=True)