# Análisis: Definiciones de Agudeza Alcanzada

## 📋 Resumen Ejecutivo

Este documento analiza las definiciones existentes sobre `agudeza_alcanzada` en la documentación y código, identifica qué está implementado, qué falta, y qué definiciones adicionales son necesarias para completar la implementación.

**Estado Actual:** La implementación de `agudeza_alcanzada` está **parcialmente implementada** en el código, pero hay algunas definiciones faltantes y posibles problemas de lógica que deben resolverse.

---

## ✅ Definiciones Existentes

### 1. **DOCUMENTACION.md**

**Ubicación:** Líneas 528-530, 625, 708-709

**Definiciones encontradas:**
- ❌ Test de agudeza después de todos los tests de lentes (por ojo)
- ❌ Lógica específica para `agudeza_alcanzada` que usa los valores finales de lentes
- ❌ Campo resultado: `agudezaAlcanzada`

**Estado:** Definiciones básicas presentes, pero **muy generales**. No especifican:
- Algoritmo de navegación logMAR
- Lógica de confirmación
- Casos edge (agudeza_inicial = 0.0, sin mejora, etc.)

---

### 2. **PLAN_MIGRACION_BACKEND.md (FASE 6)**

**Ubicación:** Líneas 1020-1126

**Definiciones encontradas:**

#### Comparación con `agudeza_inicial`:
| Aspecto | `agudeza_inicial` | `agudeza_alcanzada` |
|---------|-------------------|---------------------|
| Estado inicial logMAR | 0.4 (fijo) | `agudeza_inicial` (dinámico) |
| Valores foróptero | `valoresRecalculados` | Valores finales (esfera fino + cilindro + ángulo) |
| Objetivo | Encontrar mejor logMAR posible | Bajar progresivamente desde `agudeza_inicial` hasta 0.0 |
| Navegación | Completa (subir/bajar según respuestas) | **Solo bajar progresivamente** (0.4→0.3→0.2→0.1→0.0) |
| Campo resultado | `agudezaInicial` | `agudezaAlcanzada` |
| Dependencias | Ninguna | Requiere `agudeza_inicial` y tests de lentes completos |

#### Lógica de navegación progresiva:
1. Obtener `agudeza_inicial` del ojo actual (ej: 0.4)
2. **Empezar desde `agudeza_inicial`** (no desde `agudeza_inicial - 0.1`)
3. Mostrar letra en logMAR actual
4. Si paciente ve correctamente:
   - Confirmar 2 veces en ese logMAR
   - Si está en 0.0: guardar y terminar
   - Si no está en 0.0: bajar al siguiente logMAR más pequeño (0.4 → 0.3 → 0.2 → 0.1 → 0.0)
   - Repetir hasta llegar a 0.0 o hasta que no vea
5. Si paciente NO ve:
   - Volver al logMAR anterior (el último donde sí veía)
   - Confirmar 2 veces en ese logMAR
   - Guardar como agudezaAlcanzada

#### Ejemplos de flujo:
- **Caso 1:** Mejora progresiva exitosa hasta 0.0
- **Caso 2:** Mejora parcial (se detiene antes de 0.0)
- **Caso 3:** No mejora (ya estaba en su mejor agudeza)
- **Caso 4:** Agudeza inicial ya es 0.0

#### Construcción de valores finales del foróptero:
```javascript
const valoresFinales = {
  esfera: resultados[ojo].esfericoFino || resultados[ojo].esfericoGrueso || valoresRecalculados[ojo].esfera,
  cilindro: resultados[ojo].cilindrico || valoresRecalculados[ojo].cilindro,
  angulo: resultados[ojo].cilindricoAngulo || valoresRecalculados[ojo].angulo
};
```

**Estado:** ✅ **Definiciones completas y detalladas**. Cubre:
- Diferencias con `agudeza_inicial`
- Algoritmo de navegación progresiva
- Ejemplos de flujo
- Construcción de valores finales

---

### 3. **PLAN_IMPLEMENTACION_AGUDEZA_ALCANZADA.md**

**Ubicación:** Documento completo (729 líneas)

**Definiciones encontradas:**

#### Implementación técnica detallada:
1. **Extender `generarPasosEtapa4()`:**
   - Aceptar `agudeza_alcanzada` además de `agudeza_inicial`
   - Lógica de inicialización específica para `agudeza_alcanzada`
   - Empezar desde `agudeza_inicial` (no desde `agudeza_inicial - 0.1`)
   - Validar que existe `agudeza_inicial` antes de continuar
   - Configurar foróptero con valores finales ANTES de mostrar TV

2. **Crear función `calcularValoresFinalesForoptero()`:**
   - Priorizar `esfericoFino` sobre `esfericoGrueso`
   - Usar `cilindrico` si está disponible
   - Usar `cilindricoAngulo` si está disponible
   - Fallback a `valoresRecalculados` si no hay resultados

3. **Extender `procesarRespuestaAgudeza()`:**
   - Aceptar `agudeza_alcanzada` además de `agudeza_inicial`
   - Llamar a `procesarRespuestaAgudezaAlcanzada()` cuando corresponda
   - Actualizar guardado para usar `mapearTipoTestAResultado()`

4. **Crear función `procesarRespuestaAgudezaAlcanzada()`:**
   - Manejar respuesta correcta: confirmar 2 veces y bajar progresivamente
   - Si está en 0.0 y confirma 2 veces, guardar y terminar
   - Si no está en 0.0 y confirma 2 veces, bajar al siguiente logMAR
   - Manejar respuesta incorrecta: volver al logMAR anterior donde sí veía
   - Confirmar 2 veces en el logMAR final antes de guardar
   - Guardar en campo `agudezaAlcanzada` usando mapeo

5. **Crear función `resetearEstadoAgudeza()`:**
   - Resetear todos los campos del estado
   - Incluir campos específicos de `agudeza_alcanzada`

#### Checklist de implementación completo:
- 13 tareas principales con sub-tareas
- Casos de prueba detallados
- Criterios de éxito

**Estado:** ✅ **Plan de implementación muy detallado**. Incluye:
- Código de ejemplo completo
- Checklist de implementación
- Casos de prueba
- Consideraciones importantes

---

## 🔍 Análisis del Código Actual

### ✅ Lo que ESTÁ implementado:

1. **Función `calcularValoresFinalesForoptero()`** (líneas 736-766)
   - ✅ Implementada completamente
   - ✅ Prioriza correctamente: esfericoFino > esfericoGrueso > valoresRecalculados
   - ✅ Maneja cilindro y ángulo correctamente

2. **Función `procesarRespuestaAgudezaAlcanzada()`** (líneas 914-1079)
   - ✅ Implementada completamente
   - ✅ Lógica de confirmación (2 confirmaciones)
   - ✅ Navegación progresiva (bajar desde agudeza_inicial)
   - ✅ Manejo de respuesta incorrecta (volver al logMAR anterior)
   - ✅ Guardado en campo `agudezaAlcanzada`

3. **Función `resetearEstadoAgudeza()`** (líneas 1085-1096)
   - ✅ Implementada completamente
   - ✅ Resetea todos los campos incluyendo `esAgudezaAlcanzada` y `agudezaInicialReferencia`

4. **`generarPasosEtapa4()`** (líneas 1140-1295)
   - ✅ Detecta `agudeza_alcanzada`
   - ✅ Lógica de inicialización específica
   - ✅ Valida que existe `agudeza_inicial`
   - ✅ Configura foróptero con valores finales
   - ✅ Genera pasos: foróptero → esperar_foroptero → TV → hablar

5. **`procesarRespuestaAgudeza()`** (líneas 774-904)
   - ✅ Detecta `agudeza_alcanzada`
   - ✅ Llama a `procesarRespuestaAgudezaAlcanzada()` cuando corresponde

6. **Funciones auxiliares:**
   - ✅ `bajarLogMAR()` (líneas 698-705) - Funciona correctamente
   - ✅ `subirLogMAR()` (líneas 710-717) - Funciona correctamente
   - ✅ `mapearTipoTestAResultado()` (líneas 1765-1775) - Mapea correctamente `agudeza_alcanzada` → `agudezaAlcanzada`

---

## ⚠️ Problemas y Definiciones Faltantes

### 1. **Estado `agudezaEstado` - Campos faltantes**

**Problema:** El estado inicial de `agudezaEstado` (líneas 100-109) **NO incluye** los campos necesarios para `agudeza_alcanzada`:
- `esAgudezaAlcanzada` (flag para diferenciar)
- `agudezaInicialReferencia` (referencia a agudeza_inicial)

**Evidencia:**
- En `generarPasosEtapa4()` (línea 1179) se asigna `estado.esAgudezaAlcanzada = true`
- En `procesarRespuestaAgudezaAlcanzada()` (línea 916) se usa `estado.agudezaInicialReferencia`
- Pero estos campos **no están definidos en el estado inicial** (líneas 100-109)

**Impacto:** 
- ⚠️ **Funciona** porque JavaScript permite agregar propiedades dinámicamente
- ⚠️ **Problema de mantenibilidad:** No está claro qué campos tiene el estado
- ⚠️ **Posible bug:** Si se resetea el estado incorrectamente, estos campos pueden no existir

**Solución requerida:**
```javascript
agudezaEstado: {
  ojo: null,
  logmarActual: null,
  letraActual: null,
  mejorLogmar: null,
  ultimoLogmarCorrecto: null,
  letrasUsadas: [],
  intentos: 0,
  confirmaciones: 0,
  // ✅ AGREGAR:
  esAgudezaAlcanzada: false,        // Flag para diferenciar agudeza_inicial vs agudeza_alcanzada
  agudezaInicialReferencia: null    // Referencia a agudeza_inicial para agudeza_alcanzada
}
```

---

### 2. **Lógica de confirmación cuando se vuelve al logMAR anterior**

**Problema potencial:** En `procesarRespuestaAgudezaAlcanzada()` (líneas 1047-1060), cuando el paciente NO ve y se vuelve al logMAR anterior:

```javascript
if (estado.ultimoLogmarCorrecto !== null) {
  const logmarAnterior = estado.ultimoLogmarCorrecto;
  estado.logmarActual = logmarAnterior;
  estado.ultimoLogmarCorrecto = null; // ⚠️ PROBLEMA: Se resetea a null
  estado.confirmaciones = 0; // Resetear confirmaciones
  // ...
}
```

**Análisis:**
- ✅ **Correcto:** Se resetea `ultimoLogmarCorrecto` a `null` porque estamos empezando a confirmar desde 0 en el logMAR anterior
- ✅ **Correcto:** Se resetea `confirmaciones` a 0 porque necesitamos 2 confirmaciones nuevas
- ⚠️ **Posible problema:** Si el paciente vuelve a fallar en el logMAR anterior, no hay forma de volver a un logMAR aún más anterior (pero esto es correcto según la lógica: solo bajamos, nunca subimos más allá de agudeza_inicial)

**Conclusión:** La lógica parece correcta, pero **falta documentación** sobre este comportamiento.

---

### 3. **Caso edge: Primera respuesta incorrecta en agudeza_alcanzada**

**Problema potencial:** En `procesarRespuestaAgudezaAlcanzada()` (líneas 1062-1077), si el paciente falla en la primera respuesta (no hay `ultimoLogmarCorrecto`):

```javascript
else {
  // No hay logMAR anterior (primera respuesta incorrecta)
  // Esto no debería pasar si empezamos desde agudeza_inicial (donde ya veía)
  // Pero por seguridad, volver a agudeza_inicial y confirmar ahí
  estado.logmarActual = agudezaInicial;
  estado.ultimoLogmarCorrecto = null;
  estado.confirmaciones = 0;
  // ...
}
```

**Análisis:**
- ✅ **Correcto:** Se vuelve a `agudezaInicial` (donde ya se confirmó que veía)
- ⚠️ **Problema de lógica:** Si el paciente falla en la primera respuesta de `agudeza_alcanzada`, significa que **no puede ver mejor** con los lentes optimizados. En este caso, debería:
  1. Confirmar 2 veces en `agudeza_inicial`
  2. Guardar `agudezaAlcanzada = agudeza_inicial` (sin mejora)

**Conclusión:** La lógica actual es correcta (vuelve a agudeza_inicial y confirma ahí), pero **falta documentación** sobre este caso edge.

---

### 4. **Definición faltante: Mensaje al paciente**

**Problema:** No hay definición clara sobre qué mensaje debe decir el agente al paciente cuando:
- Inicia `agudeza_alcanzada` (después de tests de lentes)
- Muestra letras durante `agudeza_alcanzada`
- Confirma resultado de `agudeza_alcanzada`

**Evidencia:**
- En `generarPasosEtapa4()` (línea 1217) se usa el mismo mensaje que `agudeza_inicial`: `'Mirá la pantalla. Decime qué letra ves.'`
- No hay diferenciación en los mensajes

**Solución requerida:**
- Definir si el mensaje debe ser diferente para `agudeza_alcanzada`
- Si debe mencionar que se están usando los lentes optimizados
- Si debe mencionar que se está midiendo la mejora

**Recomendación:** Mantener mensajes simples y naturales (como actualmente), pero documentar que el agente puede mencionar que se están usando los lentes optimizados si es apropiado.

---

### 5. **Definición faltante: Validación de dependencias**

**Problema:** No hay validación explícita de que:
- Todos los tests de lentes estén completos antes de iniciar `agudeza_alcanzada`
- Los valores finales del foróptero sean válidos (no null/undefined)

**Evidencia:**
- En `generarPasosEtapa4()` (línea 1162) se valida que existe `agudeza_inicial`
- En `calcularValoresFinalesForoptero()` (líneas 742-765) hay fallbacks, pero no validación explícita

**Solución requerida:**
- Agregar validación en `generarPasosEtapa4()` para verificar que los tests de lentes estén completos (o al menos que haya valores válidos)
- Agregar validación en `calcularValoresFinalesForoptero()` para verificar que los valores calculados sean válidos (no NaN, dentro de rangos, etc.)

---

### 6. **Definición faltante: Transición después de agudeza_alcanzada**

**Problema:** No está claro qué debe pasar después de completar `agudeza_alcanzada` para un ojo:
- ¿Debe avanzar automáticamente al ojo contrario?
- ¿Debe finalizar el examen si es el último ojo?

**Evidencia:**
- En `procesarRespuestaAgudezaAlcanzada()` (líneas 963, 1011) se llama `avanzarTest()`
- `avanzarTest()` debería manejar la transición automáticamente según la secuencia

**Conclusión:** La lógica parece correcta (usa `avanzarTest()`), pero **falta documentación** sobre el flujo de transición.

---

## 📊 Resumen de Definiciones

### ✅ Definiciones Completas:

1. **Comparación con `agudeza_inicial`** - ✅ Completa en PLAN_MIGRACION_BACKEND.md
2. **Algoritmo de navegación progresiva** - ✅ Completo en PLAN_MIGRACION_BACKEND.md y PLAN_IMPLEMENTACION_AGUDEZA_ALCANZADA.md
3. **Construcción de valores finales del foróptero** - ✅ Completa en ambos planes
4. **Ejemplos de flujo** - ✅ Completos en PLAN_IMPLEMENTACION_AGUDEZA_ALCANZADA.md
5. **Implementación técnica** - ✅ Completa en PLAN_IMPLEMENTACION_AGUDEZA_ALCANZADA.md

### ⚠️ Definiciones Faltantes o Incompletas:

1. **Estructura del estado `agudezaEstado`** - ⚠️ Faltan campos `esAgudezaAlcanzada` y `agudezaInicialReferencia` en la definición inicial
2. **Mensajes al paciente** - ⚠️ No hay definición sobre si deben ser diferentes para `agudeza_alcanzada`
3. **Validación de dependencias** - ⚠️ No hay validación explícita de que los tests de lentes estén completos
4. **Documentación de casos edge** - ⚠️ Falta documentación sobre:
   - Primera respuesta incorrecta en `agudeza_alcanzada`
   - Comportamiento cuando se vuelve al logMAR anterior
   - Caso cuando `agudeza_inicial = 0.0`
5. **Transición después de completar** - ⚠️ Falta documentación sobre el flujo de transición

---

## 🎯 Plan de Acción Recomendado

### Prioridad Alta (Crítico para funcionamiento):

1. **Agregar campos faltantes al estado `agudezaEstado`:**
   - `esAgudezaAlcanzada: false`
   - `agudezaInicialReferencia: null`
   - **Ubicación:** `motorExamen.js` línea 100-109

2. **Agregar validación de dependencias:**
   - Validar que los tests de lentes estén completos (o al menos que haya valores válidos)
   - Validar que los valores finales del foróptero sean válidos
   - **Ubicación:** `generarPasosEtapa4()` y `calcularValoresFinalesForoptero()`

### Prioridad Media (Mejora de robustez):

3. **Documentar casos edge:**
   - Primera respuesta incorrecta en `agudeza_alcanzada`
   - Comportamiento cuando se vuelve al logMAR anterior
   - Caso cuando `agudeza_inicial = 0.0`
   - **Ubicación:** Comentarios en `procesarRespuestaAgudezaAlcanzada()`

4. **Definir mensajes al paciente:**
   - Decidir si los mensajes deben ser diferentes para `agudeza_alcanzada`
   - Documentar en instrucciones del agente si es necesario
   - **Ubicación:** `generarPasosEtapa4()` y documentación del agente

### Prioridad Baja (Mejora de documentación):

5. **Documentar flujo de transición:**
   - Documentar qué pasa después de completar `agudeza_alcanzada`
   - Explicar cómo `avanzarTest()` maneja la transición
   - **Ubicación:** DOCUMENTACION.md y comentarios en código

---

## ✅ Conclusión

**Estado de implementación:** La implementación de `agudeza_alcanzada` está **casi completa** en el código. Las funciones principales están implementadas y la lógica parece correcta.

**Definiciones:** Las definiciones en la documentación son **completas y detalladas**, especialmente en `PLAN_MIGRACION_BACKEND.md` y `PLAN_IMPLEMENTACION_AGUDEZA_ALCANZADA.md`.

**Problemas identificados:**
1. ⚠️ Campos faltantes en el estado inicial (funciona pero no está bien definido)
2. ⚠️ Falta validación explícita de dependencias
3. ⚠️ Falta documentación de casos edge
4. ⚠️ Falta definición de mensajes al paciente

**Recomendación:** La implementación está lista para testing, pero se recomienda:
1. Agregar los campos faltantes al estado inicial
2. Agregar validaciones de dependencias
3. Documentar casos edge
4. Probar exhaustivamente todos los casos de uso

---

**Fecha de análisis:** 2025-01-27  
**Última actualización:** 2025-01-27

