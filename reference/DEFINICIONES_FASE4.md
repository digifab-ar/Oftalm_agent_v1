# Definiciones para FASE 4: Esférico Grueso

## 📋 Decisiones Tomadas

### 1. Acceso al Estado del Foróptero
**Decisión:** Usar la estrategia más conveniente para MVP, alineada al resto del código.

**Implementación:** Similar a `inicializarEjecutores()`, exportar función `obtenerEstadoForoptero()` desde `server.js` y pasarla como parámetro en la inicialización.

### 2. Mensajes al Paciente
- **Mensaje introductorio:** "Ahora te voy a mostrar otro lente y me vas a decir si ves mejor o peor"
- **Mensaje de pregunta:** "Ves mejor con este o con el anterior?"
- **Mensajes de confirmación:** "Perfecto, confirmamos este valor" (opcional, puede omitirse)

### 3. Manejo de Errores del Foróptero
- **Si está offline:** Continuar de todas formas (el comando se envió)
- **Si hay timeout (>10s):** Continuar de todas formas
- **Nota:** En el futuro ajustaremos manejo de errores más robusto

### 4. Límites de Valores
- **Rango válido para esfera:** Validar según límites del foróptero (típicamente -6.00 a +6.00)
- **Si cálculo da fuera de rango:** Retornar error
- **Nota:** En el futuro debemos manejar este error antes (validar antes de calcular)

### 5. Respuestas Ambiguas del Paciente
- **Estrategia:** Asumir que se interpreta el 100% (el agente siempre interpreta correctamente)
- **Nota:** En el futuro lo corregiremos con manejo de respuestas ambiguas

### 6. Respuesta "Igual"
- **Estrategia:** Si dice "igual", probar de nuevo esos lentes a ver si elige
- **Si sigue diciendo "igual":** Usar el valor más pequeño de los que resultan "iguales"
- **Ejemplo:** Si base +0.75, probamos +1.25 y +0.25, y ambos son "iguales" → usar +0.25 (el más pequeño)

### 7. Transición entre Fases
- **Después de esférico grueso:** Siempre seguir con esférico fino (según secuencia calculada por backend)
- **El backend decide automáticamente** según la secuencia generada

### 8. Configuración del Foróptero
- **Al iniciar esférico grueso:** El valor base ya está en el foróptero (viene del test anterior "agudeza visual inicial")
- **Ojo opuesto:** Debe estar cerrado (ya viene configurado del test anterior)
- **No necesitamos configurar el foróptero al inicio** del test de esférico grueso

### 9. Interpretación Estructurada del Agente
- **Estrategia:** Igual que agudeza visual
- **El agente interpreta** y da respuesta certera al backend
- **Estructura:** `{ preferencia: 'anterior' | 'actual' | 'igual', confianza?: number }`
- **Implementar desde el inicio** (no solo texto)

### 10. Logging y Debugging
- **Nivel:** El que venimos usando (console.log detallado para debugging)

## ✅ Resumen para Implementación

1. **Acceso foróptero:** Exportar función y pasarla en inicialización (similar a ejecutores)
2. **Mensajes:** Usar los propuestos, simples y claros
3. **Errores:** Continuar siempre (manejo robusto en el futuro)
4. **Límites:** Validar y dar error si fuera de rango (mejorar validación en el futuro)
5. **Ambiguas:** Asumir 100% interpretación (mejorar en el futuro)
6. **"Igual":** Reintentar, si persiste usar valor más pequeño
7. **Transición:** Automática según secuencia (siempre esférico fino después)
8. **Foróptero:** Ya está configurado, no configurar al inicio
9. **Interpretación:** Estructurada del agente (igual que agudeza)
10. **Logging:** Detallado como venimos usando

