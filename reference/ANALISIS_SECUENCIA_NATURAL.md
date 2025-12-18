# Análisis: Secuencia Natural de Comparación de Lentes

## 📋 Secuencia Descrita por el Usuario

### Flujo Completo

```
1. Valor inicial: +0.75 (lente base en foróptero)
   → Mensaje: "Ahora te voy a mostrar otro lente y me vas a decir si ves mejor o peor"

2. Cambiar a lente 2: +1.25 (valor base + salto)
   → Mensaje: "Ves mejor con este o con el anterior?"
   → Respuesta: "con el anterior" 
   → Decisión: +0.75 vs +1.25 = eligió +0.75

3. Cambiar a lente 1: +0.75 (volver al anterior que eligió)
   → Mensaje: "Ves mejor con este o con el anterior?"
   → Respuesta: "con este lente"
   → Validación: +0.75 confirmado (primera confirmación)

4. Cambiar a lente 4: +0.25 (nuevo valor, más bajo que +0.75)
   → Mensaje: "Ves mejor con este o con el anterior?"
   → Respuesta: "con este"
   → Decisión: +0.25 vs +0.75 = eligió +0.25

5. Cambiar a lente 1: +0.75 (volver al anterior)
   → Mensaje: "Ves mejor con este o con el anterior?"
   → Respuesta: "con el anterior"
   → Validación: +0.25 confirmado (segunda confirmación)
   → Resultado final: +0.25
```

## 🔍 Análisis de la Secuencia

### Características Clave

1. **Navegación Adaptativa (No Binaria Simple)**
   - No es solo comparar lente1 vs lente2
   - Según la respuesta, se prueba un nuevo valor
   - Si elige "anterior" → se valida y se prueba un valor más bajo
   - Si elige "actual" → se valida y se prueba un valor más alto

2. **Confirmación con 2 Elecciones Iguales**
   - Requiere 2 confirmaciones consecutivas del mismo valor
   - Primera confirmación: +0.75 (paso 3)
   - Segunda confirmación: +0.25 (paso 5)

3. **Navegación Bidireccional**
   - Puede subir o bajar valores según preferencias
   - Ejemplo: +0.75 → +1.25 (subir) → +0.75 (bajar) → +0.25 (bajar más)

4. **Comparación con "Anterior"**
   - Siempre compara con el lente que se mostró antes
   - No compara con un lente fijo, sino con el último mostrado

### Diferencias con Propuesta Actual

| Aspecto | Propuesta Actual | Secuencia Natural |
|---------|------------------|-------------------|
| **Tipo** | Comparación binaria fija (lente1 vs lente2) | Navegación adaptativa |
| **Valores** | Pre-calculados (lente1, lente2) | Calculados dinámicamente según respuestas |
| **Confirmación** | 2 elecciones iguales entre lente1 y lente2 | 2 confirmaciones del mismo valor |
| **Navegación** | Fija (solo entre 2 valores) | Bidireccional (puede subir/bajar) |

## 💡 Recomendaciones

### 1. Cambiar de Comparación Binaria a Navegación Adaptativa

**Propuesta Actual:**
```
Lente1 (+0.75) → Lente2 (+1.25) → Preguntar → Confirmar
```

**Secuencia Natural:**
```
Valor Base (+0.75) 
  → Lente Alternativo (+1.25) 
  → Si elige "anterior" → Validar +0.75 → Probar +0.25
  → Si elige "actual" → Validar +1.25 → Probar +1.50
```

### 2. Estado de Navegación

Necesitamos rastrear:
- `valorActual`: Valor que está mostrándose actualmente
- `valorAnterior`: Último valor mostrado (para comparar)
- `valorConfirmado`: Valor que se está confirmando
- `confirmaciones`: Número de confirmaciones (0, 1, 2)
- `direccion`: 'subiendo' | 'bajando' | null (para saber hacia dónde navegar)

### 3. Lógica de Navegación

**Algoritmo:**
1. Iniciar con valor base (ej: +0.75)
2. Mostrar valor alternativo (base ± salto, ej: +1.25)
3. Preguntar preferencia
4. **Si elige "anterior":**
   - Validar valor anterior (primera confirmación si es la primera vez)
   - Si ya hay 1 confirmación → segunda confirmación → resultado final
   - Si no hay confirmación → probar valor más bajo (base - salto)
5. **Si elige "actual":**
   - Validar valor actual (primera confirmación si es la primera vez)
   - Si ya hay 1 confirmación → segunda confirmación → resultado final
   - Si no hay confirmación → probar valor más alto (base + salto)

### 4. Casos Especiales

**Caso 1: Primera respuesta "con el anterior"**
- Validar valor anterior
- Probar valor más bajo (base - salto)

**Caso 2: Primera respuesta "con el actual"**
- Validar valor actual
- Probar valor más alto (base + salto)

**Caso 3: Segunda confirmación**
- Si hay 2 confirmaciones del mismo valor → resultado final
- Guardar y avanzar al siguiente test

**Caso 4: Respuesta "igual"**
- Aumentar separación de saltos
- Repetir comparación

## 🔄 Propuesta de Estado Actualizado

```javascript
comparacionActual: {
  tipo: null,              // 'esferico_grueso', 'esferico_fino', etc.
  ojo: null,              // 'R' | 'L'
  valorBase: null,        // Valor base del test (ej: +0.75)
  
  // Navegación adaptativa
  valorActual: null,      // Valor que está mostrándose actualmente (ej: +1.25)
  valorAnterior: null,    // Último valor mostrado antes del actual (ej: +0.75)
  valorConfirmado: null,  // Valor que se está confirmando (ej: +0.75)
  confirmaciones: 0,      // Número de confirmaciones (0, 1, 2)
  direccion: null,        // 'subiendo' | 'bajando' | null
  
  // Estado de la secuencia
  faseComparacion: null,  // 'iniciando' | 'mostrando_alternativo' | 'preguntando' | 'confirmando' | 'navegando'
  letraActual: null,      // Letra que se está mostrando en la TV
  logmarActual: null,     // LogMAR de la letra actual
  
  // Saltos
  saltoActual: null,      // Salto actual (ej: 0.50 para esférico grueso)
  saltosUsados: []       // Historial de saltos usados (para no repetir)
}
```

## 📐 Algoritmo de Navegación

### Paso 1: Iniciar Comparación

```javascript
function iniciarComparacionLentes(tipo, ojo, valorBase) {
  const salto = obtenerSaltosPorTipo(tipo);
  
  comparacionActual.tipo = tipo;
  comparacionActual.ojo = ojo;
  comparacionActual.valorBase = valorBase;
  comparacionActual.valorActual = valorBase;  // Empezar con valor base
  comparacionActual.valorAnterior = null;
  comparacionActual.valorConfirmado = null;
  comparacionActual.confirmaciones = 0;
  comparacionActual.direccion = null;
  comparacionActual.saltoActual = salto;
  comparacionActual.faseComparacion = 'iniciando';
}
```

### Paso 2: Mostrar Valor Alternativo

```javascript
function generarPasosMostrarAlternativo() {
  const comparacion = comparacionActual;
  
  // Calcular valor alternativo
  // Primera vez: probar valor base + salto
  // Después: según dirección (subiendo/bajando)
  let valorAlternativo;
  
  if (comparacion.valorAnterior === null) {
    // Primera comparación: probar valor base + salto
    valorAlternativo = comparacion.valorBase + comparacion.saltoActual;
    comparacion.direccion = 'subiendo';
  } else {
    // Navegación: según última elección
    if (comparacion.direccion === 'subiendo') {
      valorAlternativo = comparacion.valorActual + comparacion.saltoActual;
    } else {
      valorAlternativo = comparacion.valorActual - comparacion.saltoActual;
    }
  }
  
  // Actualizar estado
  comparacion.valorAnterior = comparacion.valorActual;
  comparacion.valorActual = valorAlternativo;
  comparacion.faseComparacion = 'mostrando_alternativo';
  
  // Generar pasos: foróptero → esperar_foroptero → TV → esperar
  return generarPasosMostrarLente(valorAlternativo, comparacion.ojo);
}
```

### Paso 3: Procesar Respuesta

```javascript
function procesarRespuestaComparacionLentes(respuestaPaciente, interpretacionComparacion) {
  const comparacion = comparacionActual;
  const preferencia = interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion);
  
  if (preferencia === 'anterior') {
    // Eligió el valor anterior
    const valorElegido = comparacion.valorAnterior;
    
    if (comparacion.valorConfirmado === valorElegido) {
      // Segunda confirmación del mismo valor
      comparacion.confirmaciones = 2;
      
      // Guardar resultado y finalizar
      return confirmarResultado(valorElegido);
    } else {
      // Primera confirmación o cambio de valor
      comparacion.valorConfirmado = valorElegido;
      comparacion.confirmaciones = 1;
      
      // Navegar hacia abajo (probar valor más bajo)
      comparacion.direccion = 'bajando';
      comparacion.valorActual = valorElegido;  // Volver al valor elegido
      
      // Generar pasos para mostrar nuevo valor alternativo (más bajo)
      return {
        ok: true,
        necesitaNavegar: true,
        nuevoValor: valorElegido - comparacion.saltoActual
      };
    }
  } else if (preferencia === 'actual') {
    // Eligió el valor actual
    const valorElegido = comparacion.valorActual;
    
    if (comparacion.valorConfirmado === valorElegido) {
      // Segunda confirmación del mismo valor
      comparacion.confirmaciones = 2;
      
      // Guardar resultado y finalizar
      return confirmarResultado(valorElegido);
    } else {
      // Primera confirmación o cambio de valor
      comparacion.valorConfirmado = valorElegido;
      comparacion.confirmaciones = 1;
      
      // Navegar hacia arriba (probar valor más alto)
      comparacion.direccion = 'subiendo';
      
      // Generar pasos para mostrar nuevo valor alternativo (más alto)
      return {
        ok: true,
        necesitaNavegar: true,
        nuevoValor: valorElegido + comparacion.saltoActual
      };
    }
  } else if (preferencia === 'igual') {
    // Aumentar separación y repetir
    return aumentarSeparacionYRepetir();
  }
}
```

## 🎯 Secuencia Actualizada

### Flujo Completo con Navegación Adaptativa

```
1. INICIAR
   → valorBase: +0.75
   → valorActual: +0.75
   → Mensaje: "Ahora te voy a mostrar otro lente y me vas a decir si ves mejor o peor"

2. MOSTRAR ALTERNATIVO
   → valorAnterior: +0.75
   → valorActual: +1.25 (base + salto)
   → Foróptero(+1.25) → esperar_foroptero → TV(letra) → esperar(3s)
   → Mensaje: "Ves mejor con este o con el anterior?"

3. RESPUESTA: "con el anterior"
   → valorElegido: +0.75
   → valorConfirmado: +0.75 (primera confirmación)
   → confirmaciones: 1
   → direccion: 'bajando'
   → Navegar: probar +0.25 (0.75 - 0.50)

4. MOSTRAR ALTERNATIVO (navegación)
   → valorAnterior: +0.75
   → valorActual: +0.25
   → Foróptero(+0.25) → esperar_foroptero → TV(letra) → esperar(3s)
   → Mensaje: "Ves mejor con este o con el anterior?"

5. RESPUESTA: "con este"
   → valorElegido: +0.25
   → valorConfirmado: +0.25 (cambió de +0.75)
   → confirmaciones: 1 (reset porque cambió)
   → direccion: 'subiendo'
   → Navegar: probar +0.75 (0.25 + 0.50) para confirmar

6. MOSTRAR ALTERNATIVO (confirmación)
   → valorAnterior: +0.25
   → valorActual: +0.75
   → Foróptero(+0.75) → esperar_foroptero → TV(letra) → esperar(3s)
   → Mensaje: "Ves mejor con este o con el anterior?"

7. RESPUESTA: "con el anterior"
   → valorElegido: +0.25
   → valorConfirmado: +0.25 (segunda confirmación)
   → confirmaciones: 2
   → CONFIRMAR RESULTADO: +0.25
   → Avanzar al siguiente test
```

## ✅ Ventajas de la Secuencia Natural

1. **Más Intuitiva**: Sigue el flujo natural de un examen real
2. **Adaptativa**: Se ajusta a las preferencias del paciente
3. **Precisa**: Navega hacia el valor óptimo
4. **Eficiente**: No prueba valores innecesarios

## ⚠️ Consideraciones

1. **Complejidad**: Más compleja que comparación binaria simple
2. **Límites**: Necesita límites mínimos/máximos para evitar valores inválidos
3. **Saltos**: Puede necesitar ajustar saltos si el paciente cambia mucho de dirección

## 🚀 Plan de Acción Actualizado

1. **Actualizar estado**: Cambiar de comparación binaria a navegación adaptativa
2. **Implementar algoritmo de navegación**: Según preferencias, subir/bajar valores
3. **Manejar confirmaciones**: 2 confirmaciones del mismo valor = resultado final
4. **Límites de valores**: Validar que valores estén en rangos válidos
5. **Mensajes**: Adaptar mensajes según fase (iniciando, navegando, confirmando)

