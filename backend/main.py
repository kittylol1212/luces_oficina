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
# 🔍 CONSULTAR ESTADO Y HORAS (SOLO HOY)
# ==========================================
@app.route('/api/estado_luces', methods=['GET'])
def obtener_estado():
    try:
        db = obtener_conexion()
        cursor = db.cursor()
        
        # Esta consulta es la clave: 
        # 1. Filtra solo las luces que NO tienen hora de apagado.
        # 2. Solo toma sesiones que ocurrieron HOY (CURDATE()).
        # 3. Calcula la diferencia entre (el inicio o la medianoche) y el momento actual.
        
        sql = """
            SELECT luz_id, 
            TIMESTAMPDIFF(MINUTE, GREATEST(hora_encendido, CURDATE()), NOW()) / 60.0 
            FROM sesiones_luz 
            WHERE hora_apagado IS NULL 
            AND luz_id IS NOT NULL 
            AND (DATE(hora_encendido) = CURDATE() OR hora_encendido < CURDATE())
        """
        
        cursor.execute(sql)
        resultados = cursor.fetchall()
        
        dict_encendidas = {}
        for fila in resultados:
            id_str = str(fila[0]).strip()
            # Si la luz se prendió ayer, GREATEST hará que empiece a contar desde las 0:00 de hoy
            tiempo_hoy = float(fila[1]) if fila[1] is not None else 0.0
            dict_encendidas[id_str] = tiempo_hoy
        
        cursor.close()
        db.close()
        
        print(f"📅 Sincronizado para el día: {len(dict_encendidas)} luces activas hoy.")
        return jsonify({"status": "ok", "encendidas": dict_encendidas})
        
    except Exception as e:
        print(f"❌ Error en GET estado: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)})

# 🚨 ESTO SIEMPRE AL FINAL 🚨
if __name__ == '__main__':
    print("🚀 Servidor Reiniciable Iniciado...")
    app.run(port=5000, debug=True)