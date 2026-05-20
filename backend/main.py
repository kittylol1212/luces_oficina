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
    
    msg = "Edificio completo actualizado" if numero_piso == 0 else f"Piso {numero_piso} updated"
    return jsonify({"status": "ok", "mensaje": msg})

# =========================================================================
# 🔍 CONSULTAR ESTADO Y HORAS TOTALES ACUMULADAS (SOPORTA PRENDER/APAGAR)
# =========================================================================
@app.route('/api/estado_luces', methods=['GET'])
def obtener_estado():
    try:
        db = obtener_conexion()
        cursor = db.cursor()
        
        # NUEVA CONSULTA MAESTRA:
        # Suma los minutos de las sesiones ya terminadas hoy + los minutos de la sesión activa (si está prendida)
        sql = """
            SELECT l.id AS luz_id,
                   COALESCE(SUM(
                       CASE 
                           # 1. Sesión terminada: Calculamos diferencia entre encendido y apagado
                           WHEN s.hora_apagado IS NOT NULL 
                           THEN TIMESTAMPDIFF(MINUTE, GREATEST(s.hora_encendido, CURDATE()), s.hora_apagado)
                           
                           # 2. Sesión activa: Calculamos diferencia entre encendido y el momento actual (NOW())
                           ELSE TIMESTAMPDIFF(MINUTE, GREATEST(s.hora_encendido, CURDATE()), NOW())
                       END
                   ), 0) / 60.0 AS horas_totales
            FROM luces l
            LEFT JOIN sesiones_luz s ON l.id = s.luz_id 
                AND (DATE(s.hora_encendido) = CURDATE() OR s.hora_encendido < CURDATE())
                AND (s.hora_apagado IS NULL OR DATE(s.hora_apagado) = CURDATE())
            GROUP BY l.id;
        """
        
        cursor.execute(sql)
        resultados = cursor.fetchall()
        
        dict_encendidas = {}
        for fila in resultados:
            id_str = str(fila[0]).strip()
            tiempo_hoy = float(fila[1]) if fila[1] is not None else 0.0
            
            # NOTA DE DISEÑO: Aquí multiplicamos las horas por un factor para volverlo % si lo requieres,
            # o dejamos el valor directo que lee tu JavaScript. Actualmente tu script lee este valor de horas 
            # y lo procesa. Conservamos el formato original redondeado a 2 decimales.
            dict_encendidas[id_str] = round(tiempo_hoy, 2)
        
        cursor.close()
        db.close()
        
        print(f"📅 Sincronización Acumulada: Calculados consumos históricos para {len(dict_encendidas)} luces.")
        return jsonify({"status": "ok", "encendidas": dict_encendidas})
        
    except Exception as e:
        print(f"❌ Error en GET estado acumulado: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)})

# 🚨 ESTO SIEMPRE AL FINAL 🚨
if __name__ == '__main__':
    print("🚀 Servidor Reiniciable Iniciado con Memoria Corregida...")
    app.run(port=5000, debug=True)