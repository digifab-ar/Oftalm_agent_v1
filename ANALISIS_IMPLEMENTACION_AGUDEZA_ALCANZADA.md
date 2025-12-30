# Análisis: Implementación de Agudeza Alcanzada en motorExamen.js

## 📋 Resumen Ejecutivo

Este documento analiza la implementación completa de `agudeza_alcanzada` en `motorExamen.js`, explicando sus reglas, funcionamiento y flujo de ejecución.

**Estado:** ✅ **Implementación completa y funcional**

---

## 🎯 Objetivo del Test

El test `agudeza_alcanzada` se ejecuta **después de completar todos los tests de lentes** (esférico grueso, fino, cilíndrico, cilíndrico ángulo) para medir la agudeza visual final del paciente **con los lentes optimizados**.

**Diferencia clave con `agudeza_inicial`:**
- `agudeza_inicial`: Busca el mejor logMAR desde 0.4, navegando hacia arriba o abajo según respuestas
- `agudeza_alcanzada`: Empieza desde `agudeza_inicial` y **solo baja progresivamente** hasta 0.0, usando los lentes optimizados

---

## 🔧 Componentes de la Implementación

### 1. **Función `calcularValoresFinalesForoptero(ojo)`** (líneas 736-766)

**Propósito:** Calcula los valores finales del foróptero combinando valores recalculados con resultados de tests de lentes.

**Lógica de prioridad:**

```javascript
// Esfera: Prioridad: esfericoFino > esfericoGrueso > valoresRecalculados
const esfera = resultados.esfericoFino !== null && resultados.esfericoFino !== undefined
  ? resultados.esfericoFino
  : (resultados.esfericoGrueso !== null && resultados.esfericoGrueso !== undefined
    ? resultados.esfericoGrueso
    : valoresRecalculados.esfera);

// Cilindro: Prioridad: cilindrico > valoresRecalculados
const cilindro = resultados.cilindrico !== null && resultados.cilindrico !== undefined
  ? resultados.cilindrico
  : valoresRecalculados.cilindro;

// Ángulo: Prioridad: cilindricoAngulo > valoresRecalculados
const angulo = resultados.cilindricoAngulo !== null && resultados.cilindricoAngulo !== undefined
  ? resultados.cilindricoAngulo
  : valoresRecalculados.angulo;
```

**Reglas:**
- ✅ **Esfera:** Usa el resultado más preciso disponible (fino > grueso > recalculado)
- ✅ **Cilindro:** Usa el resultado del test de cilindro si existe, sino el valor recalculado
- ✅ **Ángulo:** Usa el resultado del test de cilíndrico ángulo si existe, sino el valor recalculado
- ✅ **Fallback:** Si algún test no se completó, usa valores recalculados como respaldo

---

### 2. **Función `generarPasosEtapa4()` - Inicialización** (líneas 1158-1233)

**Propósito:** Inicializa el test de `agudeza_alcanzada` y genera los pasos iniciales.

**Validaciones:**
1. ✅ Verifica que existe `agudeza_inicial` para el ojo actual
2. ✅ Si no existe, retorna error: `"No se encontró agudeza_inicial para ${ojo}. No se puede ejecutar agudeza_alcanzada."`

**Inicialización del estado:**
```javascript
// Empezar desde agudeza_inicial (no desde agudeza_inicial - 0.1)
estado.logmarActual = agudezaInicial;
estado.agudezaInicialReferencia = agudezaInicial; // Guardar referencia
estado.letraActual = 'H';
estado.mejorLogmar = null;
estado.ultimoLogmarCorrecto = null;
estado.letrasUsadas = ['H'];
estado.intentos = 0;
estado.confirmaciones = 0;
estado.esAgudezaAlcanzada = true; // Flag para diferenciar
```

**Pasos generados:**
1. **Foróptero:** Configura con valores finales (esfera, cilindro, ángulo optimizados)
2. **Esperar foróptero:** Espera a que el foróptero esté "ready"
3. **TV:** Muestra letra 'H' en logMAR = `agudeza_inicial`
4. **Hablar:** Mensaje al paciente: "Mirá la pantalla. Decime qué letra ves."

**Reglas clave:**
- ✅ **Empieza desde `agudeza_inicial`** (no desde `agudeza_inicial - 0.1`)
- ✅ **Configura foróptero ANTES de mostrar TV** con valores finales optimizados
- ✅ **Guarda referencia** a `agudeza_inicial` en `estado.agudezaInicialReferencia`

---

### 3. **Función `procesarRespuestaAgudezaAlcanzada()`** (líneas 914-1079)

**Propósito:** Procesa las respuestas del paciente durante el test de `agudeza_alcanzada`.

**Lógica principal:** Navegación progresiva **solo hacia abajo** desde `agudeza_inicial` hasta 0.0.

#### **Caso 1: Respuesta Correcta** (líneas 926-1041)

**Subcaso 1.1: Segunda confirmación en el mismo logMAR** (líneas 936-1021)

Si el paciente ve correctamente y es el mismo logMAR que el último correcto:

1. **Incrementa confirmaciones:**
   ```javascript
   estado.confirmaciones += 1;
   ```

2. **Si hay 2 confirmaciones:**
   
   **a) Si está en 0.0:**
   - ✅ Guarda resultado: `agudezaAlcanzada = 0.0`
   - ✅ Resetea estado
   - ✅ Avanza al siguiente test
   - ✅ Retorna: `{ resultadoConfirmado: true, logmarFinal: 0.0 }`
   
   **b) Si NO está en 0.0:**
   - ✅ Intenta bajar al siguiente logMAR más pequeño
   - ✅ Si hay logMAR más pequeño disponible:
     - Actualiza `logmarActual` al siguiente logMAR
     - Resetea `ultimoLogmarCorrecto = null`
     - Resetea `confirmaciones = 0`
     - Resetea `letrasUsadas = []`
     - Genera nueva letra
     - Retorna: `{ necesitaNuevaLetra: true }`
   - ✅ Si NO hay logMAR más pequeño (ya está en 0.0):
     - Guarda resultado actual
     - Resetea estado
     - Avanza al siguiente test

3. **Si aún no hay 2 confirmaciones:**
   - ✅ Genera nueva letra en el mismo logMAR
   - ✅ Retorna: `{ necesitaNuevaLetra: true }`

**Subcaso 1.2: Primera confirmación en este logMAR** (líneas 1031-1041)

- ✅ Establece `confirmaciones = 1`
- ✅ Genera nueva letra para segunda confirmación
- ✅ Retorna: `{ necesitaNuevaLetra: true }`

#### **Caso 2: Respuesta Incorrecta** (líneas 1043-1078)

**Subcaso 2.1: Hay logMAR anterior donde sí veía** (líneas 1047-1061)

- ✅ Vuelve al logMAR anterior (`ultimoLogmarCorrecto`)
- ✅ Resetea `ultimoLogmarCorrecto = null`
- ✅ Resetea `confirmaciones = 0`
- ✅ Resetea `letrasUsadas = []`
- ✅ Genera nueva letra
- ✅ Retorna: `{ necesitaNuevaLetra: true }`

**Subcaso 2.2: No hay logMAR anterior (primera respuesta incorrecta)** (líneas 1062-1077)

- ⚠️ **Caso edge:** No debería pasar si empezamos desde `agudeza_inicial` (donde ya veía)
- ✅ Por seguridad, vuelve a `agudeza_inicial`
- ✅ Resetea `ultimoLogmarCorrecto = null`
- ✅ Resetea `confirmaciones = 0`
- ✅ Genera nueva letra
- ✅ Retorna: `{ necesitaNuevaLetra: true }`

---

## 📐 Reglas del Algoritmo

### **Regla 1: Punto de Inicio**
- ✅ **Siempre empieza desde `agudeza_inicial`** (no desde `agudeza_inicial - 0.1`)
- ✅ El paciente ya confirmó que puede ver en este logMAR, así que empezamos desde ahí

### **Regla 2: Navegación Solo Hacia Abajo**
- ✅ **Solo baja progresivamente:** 0.4 → 0.3 → 0.2 → 0.1 → 0.0
- ✅ **Nunca sube** más allá de `agudeza_inicial`
- ✅ Si el paciente no ve en un logMAR, vuelve al anterior donde sí veía

### **Regla 3: Confirmación Doble**
- ✅ **Requiere 2 confirmaciones** en el mismo logMAR antes de:
  - Bajar al siguiente logMAR más pequeño
  - O guardar el resultado final

### **Regla 4: Letras Diferentes**
- ✅ **Nunca repite la misma letra consecutivamente**
- ✅ Usa función `generarLetraSloan(letrasUsadas)` para generar letras diferentes
- ✅ Resetea `letrasUsadas = []` cuando cambia de logMAR

### **Regla 5: Valores Finales del Foróptero**
- ✅ **Configura foróptero ANTES de iniciar el test** con valores optimizados:
  - Esfera: `esfericoFino` > `esfericoGrueso` > `valoresRecalculados`
  - Cilindro: `cilindrico` > `valoresRecalculados`
  - Ángulo: `cilindricoAngulo` > `valoresRecalculados`

### **Regla 6: Objetivo Final**
- ✅ **Objetivo:** Llegar a 0.0 si es posible
- ✅ Si el paciente confirma 2 veces en 0.0, guarda y termina
- ✅ Si no puede ver en 0.0, vuelve al logMAR anterior donde sí veía y confirma ahí

### **Regla 7: Manejo de Errores**
- ✅ Si no existe `agudeza_inicial`, retorna error claro
- ✅ Si primera respuesta es incorrecta, vuelve a `agudeza_inicial` por seguridad

---

## 🔄 Flujo de Ejecución Completo

### **Ejemplo 1: Mejora Progresiva Exitosa hasta 0.0**

```
Estado inicial:
- agudeza_inicial R = 0.4
- esfericoFino R = 0.5
- cilindro R = -1.75

1. Inicialización (generarPasosEtapa4):
   - Configurar foróptero: esfera=0.5, cilindro=-1.75
   - Mostrar letra 'H' en logMAR 0.4
   - Estado: logmarActual=0.4, confirmaciones=0

2. Paciente ve "H" ✅ (primera confirmación)
   - confirmaciones = 1
   - Generar nueva letra 'D' en logMAR 0.4

3. Paciente ve "D" ✅ (segunda confirmación)
   - confirmaciones = 2
   - Bajar a logMAR 0.3
   - Estado: logmarActual=0.3, confirmaciones=0, ultimoLogmarCorrecto=null

4. Paciente ve "K" ✅ (primera confirmación en 0.3)
   - confirmaciones = 1
   - Generar nueva letra 'S' en logMAR 0.3

5. Paciente ve "S" ✅ (segunda confirmación en 0.3)
   - confirmaciones = 2
   - Bajar a logMAR 0.2
   - Estado: logmarActual=0.2, confirmaciones=0

6. Paciente ve "C" ✅ (primera confirmación en 0.2)
   - confirmaciones = 1
   - Generar nueva letra 'N' en logMAR 0.2

7. Paciente ve "N" ✅ (segunda confirmación en 0.2)
   - confirmaciones = 2
   - Bajar a logMAR 0.1
   - Estado: logmarActual=0.1, confirmaciones=0

8. Paciente ve "O" ✅ (primera confirmación en 0.1)
   - confirmaciones = 1
   - Generar nueva letra 'R' en logMAR 0.1

9. Paciente ve "R" ✅ (segunda confirmación en 0.1)
   - confirmaciones = 2
   - Bajar a logMAR 0.0
   - Estado: logmarActual=0.0, confirmaciones=0

10. Paciente ve "V" ✅ (primera confirmación en 0.0)
    - confirmaciones = 1
    - Generar nueva letra 'Z' en logMAR 0.0

11. Paciente ve "Z" ✅ (segunda confirmación en 0.0)
    - confirmaciones = 2
    - Guardar: agudezaAlcanzada = 0.0
    - Resetear estado
    - Avanzar al siguiente test
    - ✅ Resultado: Mejoró desde 0.4 a 0.0
```

### **Ejemplo 2: Mejora Parcial (Se Detiene Antes de 0.0)**

```
Estado inicial:
- agudeza_inicial R = 0.4
- esfericoFino R = 0.5

1-7. (Igual que ejemplo anterior hasta logMAR 0.1)

8. Paciente ve "O" ✅ (primera confirmación en 0.1)
   - confirmaciones = 1
   - Generar nueva letra 'R' en logMAR 0.1

9. Paciente ve "R" ✅ (segunda confirmación en 0.1)
   - confirmaciones = 2
   - Bajar a logMAR 0.0
   - Estado: logmarActual=0.0, confirmaciones=0, ultimoLogmarCorrecto=0.1

10. Paciente NO ve ❌ (primera respuesta incorrecta en 0.0)
    - ultimoLogmarCorrecto = 0.1 (donde sí veía)
    - Volver a logMAR 0.1
    - Estado: logmarActual=0.1, ultimoLogmarCorrecto=null, confirmaciones=0
    - Generar nueva letra 'V' en logMAR 0.1

11. Paciente ve "V" ✅ (primera confirmación en 0.1)
    - confirmaciones = 1
    - Generar nueva letra 'Z' en logMAR 0.1

12. Paciente ve "Z" ✅ (segunda confirmación en 0.1)
    - confirmaciones = 2
    - Guardar: agudezaAlcanzada = 0.1
    - Resetear estado
    - Avanzar al siguiente test
    - ✅ Resultado: Mejoró desde 0.4 a 0.1
```

### **Ejemplo 3: No Mejora (Ya Estaba en Su Mejor Agudeza)**

```
Estado inicial:
- agudeza_inicial R = 0.1
- esfericoFino R = 0.5

1. Inicialización:
   - Configurar foróptero: esfera=0.5
   - Mostrar letra 'H' en logMAR 0.1
   - Estado: logmarActual=0.1, confirmaciones=0

2. Paciente ve "H" ✅ (primera confirmación)
   - confirmaciones = 1
   - Generar nueva letra 'D' en logMAR 0.1

3. Paciente ve "D" ✅ (segunda confirmación)
   - confirmaciones = 2
   - Bajar a logMAR 0.0
   - Estado: logmarActual=0.0, confirmaciones=0, ultimoLogmarCorrecto=0.1

4. Paciente NO ve ❌ (primera respuesta incorrecta en 0.0)
   - ultimoLogmarCorrecto = 0.1 (donde sí veía)
   - Volver a logMAR 0.1
   - Estado: logmarActual=0.1, ultimoLogmarCorrecto=null, confirmaciones=0
   - Generar nueva letra 'K' en logMAR 0.1

5. Paciente ve "K" ✅ (primera confirmación en 0.1)
   - confirmaciones = 1
   - Generar nueva letra 'S' en logMAR 0.1

6. Paciente ve "S" ✅ (segunda confirmación en 0.1)
   - confirmaciones = 2
   - Guardar: agudezaAlcanzada = 0.1
   - Resetear estado
   - Avanzar al siguiente test
   - ✅ Resultado: Igual que inicial (0.1 = 0.1)
```

### **Ejemplo 4: Agudeza Inicial Ya Es 0.0**

```
Estado inicial:
- agudeza_inicial R = 0.0
- esfericoFino R = 0.5

1. Inicialización:
   - Configurar foróptero: esfera=0.5
   - Mostrar letra 'H' en logMAR 0.0
   - Estado: logmarActual=0.0, confirmaciones=0

2. Paciente ve "H" ✅ (primera confirmación)
   - confirmaciones = 1
   - Generar nueva letra 'D' en logMAR 0.0

3. Paciente ve "D" ✅ (segunda confirmación)
   - confirmaciones = 2
   - Ya está en 0.0 (mínimo)
   - Guardar: agudezaAlcanzada = 0.0
   - Resetear estado
   - Avanzar al siguiente test
   - ✅ Resultado: Ya estaba en el máximo (0.0 = 0.0)
```

---

## 🔍 Detalles de Implementación

### **Integración con el Flujo Principal**

1. **Detección en `procesarRespuestaAgudeza()`** (líneas 783-787):
   ```javascript
   const esAgudezaAlcanzada = testActual.tipo === 'agudeza_alcanzada';
   
   if (esAgudezaAlcanzada) {
     return procesarRespuestaAgudezaAlcanzada(respuestaPaciente, interpretacionAgudeza, estado, testActual.ojo);
   }
   ```

2. **Detección en `generarPasosEtapa4()`** (líneas 1152-1233):
   ```javascript
   const esAgudezaAlcanzada = testActual.tipo === 'agudeza_alcanzada';
   
   if (esAgudezaAlcanzada) {
     // Lógica específica para agudeza_alcanzada
   }
   ```

3. **Mapeo de tipo a resultado** (línea 1772):
   ```javascript
   'agudeza_alcanzada': 'agudezaAlcanzada'
   ```

### **Estado de Agudeza**

**Campos utilizados:**
- `ojo`: Ojo actual ('R' o 'L')
- `logmarActual`: LogMAR actual que se está mostrando
- `letraActual`: Letra actual que se está mostrando
- `mejorLogmar`: Mejor logMAR alcanzado (tracking)
- `ultimoLogmarCorrecto`: Último logMAR donde el paciente vio correctamente
- `letrasUsadas`: Array de letras ya usadas (para no repetir)
- `intentos`: Contador de intentos (no se usa activamente)
- `confirmaciones`: Número de confirmaciones en el logMAR actual (0, 1, 2)
- `esAgudezaAlcanzada`: Flag para diferenciar de `agudeza_inicial`
- `agudezaInicialReferencia`: Referencia a `agudeza_inicial` para comparaciones

### **Función `resetearEstadoAgudeza()`** (líneas 1085-1096)

Resetea todos los campos del estado de agudeza cuando se completa un test:

```javascript
function resetearEstadoAgudeza(estado) {
  estado.ojo = null;
  estado.logmarActual = null;
  estado.letraActual = null;
  estado.mejorLogmar = null;
  estado.ultimoLogmarCorrecto = null;
  estado.letrasUsadas = [];
  estado.intentos = 0;
  estado.confirmaciones = 0;
  estado.esAgudezaAlcanzada = false;
  estado.agudezaInicialReferencia = null;
}
```

---

## ⚠️ Casos Edge y Manejo de Errores

### **Caso Edge 1: Primera Respuesta Incorrecta**

**Situación:** El paciente falla en la primera respuesta de `agudeza_alcanzada`.

**Comportamiento actual:**
- ✅ Vuelve a `agudeza_inicial` (donde ya se confirmó que veía)
- ✅ Resetea confirmaciones a 0
- ✅ Genera nueva letra
- ✅ Continúa el test normalmente

**Análisis:**
- ✅ **Correcto:** Si el paciente no puede ver mejor con los lentes optimizados, vuelve al logMAR donde sí veía
- ✅ **Lógico:** El paciente ya confirmó que puede ver en `agudeza_inicial`, así que es seguro volver ahí

### **Caso Edge 2: Agudeza Inicial = 0.0**

**Situación:** El paciente ya tiene agudeza perfecta (0.0) antes de los lentes.

**Comportamiento actual:**
- ✅ Empieza desde 0.0
- ✅ Confirma 2 veces en 0.0
- ✅ Guarda `agudezaAlcanzada = 0.0`
- ✅ No intenta bajar más (ya está en el mínimo)

**Análisis:**
- ✅ **Correcto:** No puede mejorar más allá de 0.0
- ✅ **Lógico:** El test termina inmediatamente después de confirmar 2 veces en 0.0

### **Caso Edge 3: No Existe Agudeza Inicial**

**Situación:** Se intenta ejecutar `agudeza_alcanzada` sin haber completado `agudeza_inicial`.

**Comportamiento actual:**
- ✅ Retorna error: `"No se encontró agudeza_inicial para ${ojo}. No se puede ejecutar agudeza_alcanzada."`
- ✅ No genera pasos
- ✅ El test no se ejecuta

**Análisis:**
- ✅ **Correcto:** No puede ejecutarse sin `agudeza_inicial`
- ✅ **Protección:** Evita errores de estado inconsistente

---

## 📊 Comparación: `agudeza_inicial` vs `agudeza_alcanzada`

| Aspecto | `agudeza_inicial` | `agudeza_alcanzada` |
|---------|-------------------|---------------------|
| **Punto de inicio** | 0.4 (fijo) | `agudeza_inicial` (dinámico) |
| **Valores foróptero** | `valoresRecalculados` | Valores finales optimizados |
| **Navegación** | Completa (subir/bajar) | Solo bajar (progresiva) |
| **Objetivo** | Encontrar mejor logMAR | Bajar desde inicial hasta 0.0 |
| **Confirmación** | 2 confirmaciones | 2 confirmaciones |
| **Letras** | Diferentes consecutivamente | Diferentes consecutivamente |
| **Campo resultado** | `agudezaInicial` | `agudezaAlcanzada` |
| **Dependencias** | Ninguna | Requiere `agudeza_inicial` y tests de lentes |

---

## ✅ Conclusión

**Estado de implementación:** ✅ **Completa y funcional**

**Funcionalidades implementadas:**
1. ✅ Inicialización correcta desde `agudeza_inicial`
2. ✅ Configuración de foróptero con valores finales optimizados
3. ✅ Navegación progresiva solo hacia abajo
4. ✅ Sistema de confirmación doble (2 confirmaciones)
5. ✅ Manejo de respuestas incorrectas (volver al logMAR anterior)
6. ✅ Guardado correcto en campo `agudezaAlcanzada`
7. ✅ Transición automática al siguiente test
8. ✅ Manejo de casos edge (agudeza_inicial = 0.0, primera respuesta incorrecta)

**Reglas principales:**
- ✅ Empieza desde `agudeza_inicial` (no desde `agudeza_inicial - 0.1`)
- ✅ Solo baja progresivamente (nunca sube más allá de `agudeza_inicial`)
- ✅ Requiere 2 confirmaciones en cada logMAR antes de bajar
- ✅ Si no ve en un logMAR, vuelve al anterior donde sí veía
- ✅ Objetivo: llegar a 0.0 si es posible

**La implementación está lista para testing y uso en producción.**

---

**Fecha de análisis:** 2025-01-27  
**Última actualización:** 2025-01-27

