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
    try:
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
    except Exception as e:
        print(f"❌ ERROR CRÍTICO EN POST /api/luz: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# 🏢 CONTROL POR PISO / MAESTRO
@app.route('/api/luz/piso', methods=['POST'])
def recibir_piso():
    try:
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
    except Exception as e:
        print(f"❌ ERROR CRÍTICO EN POST /api/luz/piso: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# 🔍 CONSULTAR ESTADO REAL (Para el mapa de pisos)
@app.route('/api/estado_luces', methods=['GET'])
def obtener_estado():
    try:
        db = obtener_conexion()
        cursor = db.cursor()
        
        sql_horas = """
            SELECT l.id AS luz_id,
                   COALESCE(SUM(
                       CASE 
                           WHEN s.hora_apagado IS NOT NULL 
                           THEN TIMESTAMPDIFF(MINUTE, GREATEST(s.hora_encendido, CURDATE()), s.hora_apagado)
                           ELSE TIMESTAMPDIFF(MINUTE, GREATEST(s.hora_encendido, CURDATE()), NOW())
                       END
                   ), 0) / 60.0 AS horas_totales
            FROM luces l
            LEFT JOIN sesiones_luz s ON l.id = s.luz_id 
                AND (DATE(s.hora_encendido) = CURDATE() OR s.hora_encendido < CURDATE())
                AND (s.hora_apagado IS NULL OR DATE(s.hora_apagado) = CURDATE())
            GROUP BY l.id;
        """
        cursor.execute(sql_horas)
        resultados_horas = cursor.fetchall()
        
        dict_encendidas = {}
        for fila in resultados_horas:
            id_str = str(fila[0]).strip()
            tiempo_hoy = float(fila[1]) if fila[1] is not None else 0.0
            dict_encendidas[id_str] = round(tiempo_hoy, 2)

        sql_estado = "SELECT DISTINCT luz_id FROM sesiones_luz WHERE hora_apagado IS NULL"
        cursor.execute(sql_estado)
        resultados_estado = cursor.fetchall()
        
        # Aquí se mantiene la variable original
        luces_prendidas_ahora = [str(fila[0]).strip() for fila in resultados_estado]
        
        cursor.close()
        db.close()
        
        return jsonify({
            "status": "ok", 
            "encendidas": dict_encendidas,       
            "estado_real": luces_prendidas_ahora  # <--- MODIFICADO: Ahora coincide con la variable de arriba
        })
    except Exception as e:
        print(f"❌ Error en GET estado acumulado: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)})


# =========================================================================
# 📊 NUEVA RUTA: EXTRAER DATOS PARA LA TABLA Y LA GRÁFICA HISTÓRICA
# =========================================================================
@app.route('/api/datos_reporte', methods=['GET'])
def obtener_datos_reporte():
    try:
        db = obtener_conexion()
        cursor = db.cursor()

        # 1. CONSULTA PARA LA TABLA: Trae el consumo del día de hoy por empleado
        sql_tabla = """
            SELECT e.id_luz, e.nombre, COALESCE(hc.horas_totales, 0.0) as horas
            FROM empleados e
            LEFT JOIN historial_consumo hc ON e.id_luz = hc.id_luz AND hc.fecha = CURDATE()
            ORDER BY horas DESC, e.id_luz ASC;
        """
        cursor.execute(sql_tabla)
        filas_tabla = cursor.fetchall()
        
        lista_tabla = []
        for fila in filas_tabla:
            lista_tabla.append({
                "id_luz": fila[0],
                "empleado": fila[1],
                "horas": round(float(fila[2]), 2)
            })

        # 2. CONSULTA PARA LA GRÁFICA: Consumo general diario del edificio (Últimos 7 días)
        sql_grafica = """
            SELECT fecha, ROUND(SUM(horas_totales), 2) as total_dia
            FROM historial_consumo
            GROUP BY fecha
            ORDER BY fecha DESC
            LIMIT 7;
        """
        cursor.execute(sql_grafica)
        filas_grafica = cursor.fetchall()
        filas_grafica.reverse() # Invertir para que vaya de pasado a presente cronológicamente

        fechas = [str(f[0]) for f in filas_grafica]
        consumos = [float(f[1]) for f in filas_grafica]

        cursor.close()
        db.close()

        return jsonify({
            "status": "ok",
            "tabla": lista_tabla,
            "grafica": {
                "eje_x": fechas,
                "eje_y": consumos
            }
        })
    except Exception as e:
        print(f"❌ Error en api/datos_reporte: {str(e)}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# 🚨 INICIO
if __name__ == '__main__':
    print("🚀 Servidor de Monitoreo Corriendo en Puerto 5000...")
    app.run(port=5000, debug=True)