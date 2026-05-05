# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import mysql.connector

app = Flask(__name__)
CORS(app)

# 🔌 CONEXIÓN A MYSQL LOCAL
def obtener_conexion():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Luz2710*", 
        database="luces_oficina"
    )

# 🔁 ENVÍO A NODE-RED
def enviar_a_nodered(datos_json):
    url = "http://10.14.15.28:1880/actualizar-luz"
    try:
        requests.post(url, json=datos_json, timeout=2)
        print(f"✅ Enviado a Node-RED: {datos_json}")
    except Exception as e:
        print(f"❌ Error conectando a Node-RED: {e}")

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

    db = obtener_conexion()
    cursor = db.cursor()

    if estado:
        cursor.execute("SELECT id FROM sesiones_luz WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())", (id_luz,))
    else:
        cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))

    db.commit()
    cursor.close()
    db.close()

    enviar_a_nodered({"luz_id": id_luz, "estado": estado})
    return jsonify({"status": "ok"})

# 🏢 CONTROL POR PISO / MAESTRO (PISO 0)
@app.route('/api/luz/piso', methods=['POST'])
def recibir_piso():
    datos = request.json
    numero_piso = datos.get('piso')
    estado = datos.get('estado')

    db = obtener_conexion()
    cursor = db.cursor()

    if numero_piso == 0:
        print(f"🚨 COMANDO MAESTRO -> {'ENCENDER' if estado else 'APAGAR'}")
        cursor.execute("SELECT id FROM luces")
    else:
        print(f"📡 Piso {numero_piso} -> {'ON' if estado else 'OFF'}")
        cursor.execute("SELECT id FROM luces WHERE piso = %s", (numero_piso,))
    
    luces_a_procesar = cursor.fetchall() 

    for luz in luces_a_procesar:
        id_luz = luz[0]
        if estado:
            cursor.execute("SELECT id FROM sesiones_luz WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO sesiones_luz (luz_id, hora_encendido) VALUES (%s, NOW())", (id_luz,))
        else:
            cursor.execute("UPDATE sesiones_luz SET hora_apagado = NOW() WHERE luz_id = %s AND hora_apagado IS NULL", (id_luz,))
        
        enviar_a_nodered({"luz_id": id_luz, "estado": estado})

    db.commit()
    cursor.close()
    db.close()
    
    msg = "Edificio completo actualizado" if numero_piso == 0 else f"Piso {numero_piso} actualizado"
    return jsonify({"status": "ok", "mensaje": msg})

# ==========================================
# 🔍 CONSULTAR ESTADO Y HORAS (EL ÚNICO Y CORRECTO)
# ==========================================
@app.route('/api/estado_luces', methods=['GET'])
def obtener_estado():
    try:
        db = obtener_conexion()
        cursor = db.cursor()
        
        # TIMESTAMPDIFF calcula los minutos desde que se encendió, y lo dividimos por 60 para sacar las horas exactas
        cursor.execute("SELECT luz_id, TIMESTAMPDIFF(MINUTE, hora_encendido, NOW()) / 60.0 FROM sesiones_luz WHERE hora_apagado IS NULL")
        resultados = cursor.fetchall()
        
        # Esto crea un diccionario. Ej: {"1": 2.5, "2": 0.1}
        dict_encendidas = {str(fila[0]): float(fila[1]) if fila[1] is not None else 0.0 for fila in resultados}
        
        cursor.close()
        db.close()
        
        print(f"🔍 Estado consultado: {len(dict_encendidas)} luces ON (con tiempos).")
        return jsonify({"status": "ok", "encendidas": dict_encendidas})
        
    except Exception as e:
        print(f"❌ Error en GET estado_luces: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)})

# 🚨 ESTO SIEMPRE DEBE IR AL FINAL DEL ARCHIVO 🚨
if __name__ == '__main__':
    print("🚀 Iniciando servidor Flask en el puerto 5000...")
    app.run(port=5000, debug=True)