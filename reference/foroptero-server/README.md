# Referencia: Servidor Foróptero MQTT

Este directorio contiene archivos de referencia del servidor MQTT que orquesta la comunicación con el foróptero digital.

## Archivos

- `server.js` - Servidor Express que orquesta MQTT y expone endpoints HTTP
- `motorExamen.js` - Motor de examen visual (state machine)
- `package.json` - Dependencias del servidor MQTT

## Endpoints del Servidor

### POST /api/movimiento
Envía comandos de movimiento al foróptero vía MQTT.

**Request:**
```json
{
  "accion": "movimiento" | "home",
  "R": { "sphere": 0.75, "cylinder": -1.75, "axis": 60 },
  "L": { "sphere": 2.75, "cylinder": 0.00, "axis": 0 }
}
```

**Response:**
```json
{
  "status": "busy",
  "timestamp": 1234567890
}
```

### GET /api/estado
Obtiene el estado actual del foróptero.

**Response:**
```json
{
  "status": "ready" | "busy" | "offline",
  "timestamp": 1234567890
}
```

### POST /api/pantalla
Envía comandos a la pantalla vía MQTT.

**Request:**
```json
{
  "dispositivo": "pantalla",
  "accion": "mostrar",
  "letra": "A",
  "logmar": 0.0
}
```

**Response:**
```json
{
  "status": "ok",
  "letra": "A",
  "logmar": 0.0,
  "timestamp": 1234567890
}
```

### GET /api/pantalla
Obtiene el estado actual de la pantalla.

**Response:**
```json
{
  "letra": "A",
  "logmar": 0.0,
  "timestamp": 1234567890
}
```

### POST /api/examen/nuevo
Inicializa un nuevo examen visual.

**Response:**
```json
{
  "ok": true,
  "mensaje": "Examen inicializado",
  "estado": { ... }
}
```

### POST /api/examen/instrucciones
Obtiene los pasos que el agente debe ejecutar.

**Request:**
```json
{
  "respuestaPaciente": "<R> +0.75 , -1.75 , 60 / <L> +2.75 , 0.00 , 0"
}
```

**Response:**
```json
{
  "ok": true,
  "pasos": [
    {
      "tipo": "hablar",
      "orden": 1,
      "mensaje": "..."
    }
  ],
  "contexto": { ... }
}
```

### GET /api/examen/estado
Obtiene el estado actual del examen.

**Response:**
```json
{
  "ok": true,
  "estado": {
    "etapa": "ETAPA_1",
    "ojoActual": "R",
    "progreso": 20
  }
}
```

### POST /api/examen/reiniciar
Reinicia el examen desde el principio.

**Response:**
```json
{
  "ok": true,
  "mensaje": "Examen reiniciado",
  "estado": { ... },
  "pasos": [
    {
      "tipo": "hablar",
      "orden": 1,
      "mensaje": "..."
    }
  ]
}
```

### GET /api/examen/detalle
Obtiene el detalle completo del examen, incluyendo valores iniciales, recalculados, secuencia de tests y resultados.

**Response:**
```json
{
  "ok": true,
  "detalle": {
    "valoresIniciales": {
      "R": { "esfera": 0.75, "cilindro": -1.75, "angulo": 60 },
      "L": { "esfera": 2.75, "cilindro": 0.00, "angulo": 0 }
    },
    "valoresRecalculados": {
      "R": { "esfera": 0.75, "cilindro": -1.25, "angulo": 60 },
      "L": { "esfera": 2.75, "cilindro": 0.00, "angulo": 0 }
    },
    "tests": [
      {
        "indice": 0,
        "tipo": "agudeza_inicial",
        "ojo": "R",
        "estado": "en_curso",
        "resultado": null
      }
    ],
    "resultados": {
      "R": {
        "agudezaInicial": null,
        "esfericoGrueso": null,
        "esfericoFino": null,
        "cilindrico": null,
        "cilindricoAngulo": null,
        "agudezaAlcanzada": null
      },
      "L": { ... }
    },
    "estadoActual": {
      "etapa": "ETAPA_4",
      "ojoActual": "R",
      "testActual": { "tipo": "agudeza_inicial", "ojo": "R" },
      "indiceActual": 0,
      "progreso": 50
    },
    "timestamps": {
      "iniciado": 1234567890,
      "finalizado": null
    }
  }
}
```

## Configuración MQTT

- **Broker:** `mqtt://broker.hivemq.com`
- **Tópicos:**
  - `foroptero01/cmd` - Comandos al ESP32
  - `foroptero01/state` - Estado publicado por el ESP32
  - `foroptero01/pantalla` - Comandos a la pantalla


## Ejecución Automática de Comandos

El backend ejecuta automáticamente todos los comandos de dispositivos (foróptero y TV) cuando el agente llama a `/api/examen/instrucciones`. El agente solo recibe pasos de tipo "hablar" para ejecutar.

**Flujo:**
1. Agente llama `obtenerEtapa()` → Backend genera pasos
2. Backend ejecuta automáticamente: foróptero → TV → esperar
3. Backend retorna solo pasos de tipo "hablar" al agente
4. Agente habla al paciente usando el mensaje exacto

**Tipos de pasos:**
- `foroptero` - Ejecutado automáticamente por el backend
- `tv` - Ejecutado automáticamente por el backend
- `esperar` - Ejecutado automáticamente por el backend
- `hablar` - Único tipo retornado al agente para ejecutar

## Motor de Examen

El archivo `motorExamen.js` contiene la lógica completa del examen visual implementada como state machine:

**Etapas:**
- `INICIO` - Estado inicial
- `ETAPA_1` - Recolección de valores iniciales del autorefractómetro
- `ETAPA_2` - Recálculo cilíndrico (silencioso)
- `ETAPA_3` - Generación de secuencia y preparación
- `ETAPA_4` - Test de agudeza visual inicial
- `ETAPA_5` - Tests de lentes (no implementado aún)
- `FINALIZADO` - Examen completado

**Estado actual:** ETAPA_4 parcialmente implementada. Falta implementar ETAPA_5 (tests de lentes).

## Notas

- El servidor detecta automáticamente cuando el foróptero está offline (sin heartbeat por más de 90 segundos)
- El token interno `foropteroiñaki2022#` se agrega automáticamente a los comandos MQTT
- El servidor está desplegado en Railway en: `https://foroptero-production.up.railway.app`
- Los endpoints HTTP de control web (`/api/movimiento`, `/api/pantalla`) se mantienen intactos para compatibilidad
- Las funciones internas (`ejecutarComandoForopteroInterno`, `ejecutarComandoTVInterno`) se usan para ejecución automática desde motorExamen.js

