# Algoritmo de Comparación de Lentes con Reglas Específicas

## 📋 Reglas por Tipo de Test

### 1. Esférico Grueso
- **Valor base**: `valoresRecalculados[ojo].esfera`
- **Saltos permitidos**: ±0.50 (máximo)
- **Estrategia**: Testear valor base vs +0.50 y -0.50
- **Consideración especial**: Volver al valor base a mitad de test para no marear

### 2. Esférico Fino
- **Valor base**: `resultados[ojo].esfericoGrueso` (resultado del test grueso)
- **Saltos permitidos**: ±0.25 (más precisos)
- **Estrategia**: Testear valor base vs +0.25 y -0.25

### 3. Cilíndrico
- **Valor base**: `valoresRecalculados[ojo].cilindro`
- **Saltos permitidos**: ±0.50 (máximo)
- **Estrategia**: Similar a esférico grueso

### 4. Cilíndrico Ángulo
- **Valor base**: `valoresRecalculados[ojo].angulo`
- **Saltos permitidos**: ±15° (grados)
- **Estrategia**: Navegación por grados

## ⚠️ Regla Crítica: Límite de Saltos

**Los saltos nunca deben ser más de 0.50 para no marear al paciente.**

**Implicaciones:**
- Si el paciente elige "anterior" y ya probamos -0.50, no podemos bajar más
- Si el paciente elige "actual" y ya probamos +0.50, no podemos subir más
- **Solución**: Volver al valor base a mitad de test para confirmar

## 🔄 Algoritmo Actualizado

### Esférico Grueso: Estrategia de 3 Valores

```
1. Valor base: +0.75 (ya en foróptero)
   → Mensaje: "Ahora te voy a mostrar otro lente..."

2. Mostrar alternativo: +1.25 (base + 0.50)
   → "Ves mejor con este o con el anterior?"
   → Respuesta: "anterior" → Eligió +0.75

3. Volver a base: +0.75 (confirmar)
   → "Ves mejor con este o con el anterior?"
   → Respuesta: "con este" → Primera confirmación de +0.75

4. Mostrar alternativo opuesto: +0.25 (base - 0.50)
   → "Ves mejor con este o con el anterior?"
   → Respuesta: "con el anterior" → Segunda confirmación de +0.75
   → RESULTADO: +0.75
```

**O si elige el alternativo:**

```
1. Valor base: +0.75
2. Mostrar alternativo: +1.25 (base + 0.50)
   → Respuesta: "con este" → Eligió +1.25

3. Volver a base: +0.75 (para comparar)
   → Respuesta: "con el anterior" → Eligió +1.25 (primera confirmación)

4. Mostrar alternativo: +1.25 (volver al elegido)
   → Respuesta: "con este" → Segunda confirmación de +1.25
   → RESULTADO: +1.25
```

### Estrategia: Siempre Probar Ambos Lados

Para esférico grueso, la estrategia debe ser:
1. Probar base + 0.50
2. Si elige base → probar base - 0.50
3. Si elige +0.50 → confirmar +0.50
4. Si elige -0.50 → confirmar -0.50

**Pero con límite**: No podemos probar más allá de ±0.50

## 📐 Algoritmo Detallado por Tipo

### Esférico Grueso

```javascript
function iniciarComparacionLentes(tipo, ojo, valorBase) {
  const comparacion = estadoExamen.comparacionActual;
  const salto = 0.50; // Fijo para esférico grueso
  
  comparacion.tipo = tipo;
  comparacion.ojo = ojo;
  comparacion.valorBase = valorBase;
  comparacion.valorActual = valorBase;
  comparacion.valorAnterior = null;
  comparacion.valorConfirmado = null;
  comparacion.confirmaciones = 0;
  comparacion.direccion = null;
  comparacion.saltoActual = salto;
  comparacion.faseComparacion = 'iniciando';
  
  // Valores a probar (pre-calculados para esférico grueso)
  comparacion.valorMas = valorBase + salto;  // +0.50
  comparacion.valorMenos = valorBase - salto; // -0.50
  comparacion.valoresProbados = {
    mas: false,    // ¿Ya probamos +0.50?
    menos: false,  // ¿Ya probamos -0.50?
    base: false    // ¿Ya confirmamos base?
  };
}
```

**Flujo para Esférico Grueso:**

```
Estado inicial:
- valorBase: +0.75
- valorActual: +0.75 (en foróptero)
- valoresProbados: { mas: false, menos: false, base: false }

Paso 1: Mostrar +1.25 (base + 0.50)
- valorAnterior: +0.75
- valorActual: +1.25
- valoresProbados.mas = true

Paso 2: Preguntar preferencia
- Si elige "anterior" (+0.75):
  → valoresProbados.base = true (primera confirmación)
  → Mostrar -0.50 (base - 0.50) para comparar
  → valoresProbados.menos = true
  
- Si elige "actual" (+1.25):
  → Volver a +0.75 para confirmar
  → Si elige "anterior" otra vez → confirmar +1.25
  → Si elige "actual" → confirmar +0.75

Paso 3: Después de probar ambos lados
- Si eligió base en ambos casos → RESULTADO: base
- Si eligió +0.50 → RESULTADO: +1.25
- Si eligió -0.50 → RESULTADO: +0.25
```

### Esférico Fino

```javascript
function iniciarComparacionLentes(tipo, ojo, valorBase) {
  const comparacion = estadoExamen.comparacionActual;
  const salto = 0.25; // Más preciso para esférico fino
  
  // Similar a grueso pero con saltos de 0.25
  comparacion.saltoActual = salto;
  comparacion.valorMas = valorBase + salto;  // +0.25
  comparacion.valorMenos = valorBase - salto; // -0.25
  // ...
}
```

**Flujo para Esférico Fino:**
- Mismo algoritmo que grueso pero con saltos de ±0.25
- Valor base es el resultado de esférico grueso

### Cilíndrico

**Bases `≤ −0,50`:** bracket ±0,50 D sobre la base (sin cambios).

**Bases `0` / `−0,25` (`cilindricoSecuencialBajo`):** 2 comparativas, 1 confirmación cada una; reanclaje al lente elegido entre pasos (mismo contrato ETAPA_5).

| Base | Paso 1 | Paso 2 |
|------|--------|--------|
| `0` | `0` vs `−0,25` | ganador vs `−0,50` |
| `−0,25` | `−0,25` vs `0` | ganador vs `−0,50` |

Si `igual`: valor más cercano a 0 (`0` > `−0,25` > `−0,50`).

```javascript
// Bases ≤ −0,50 — sin cambios
function iniciarComparacionLentes(tipo, ojo, valorBase) {
  const comparacion = estadoExamen.comparacionActual;
  const salto = 0.50;
  comparacion.saltoActual = salto;
  comparacion.valorMas = valorBase + salto;
  comparacion.valorMenos = valorBase - salto;
  // ...
}
```

## 🎯 Algoritmo Unificado con Límites

### Función `procesarRespuestaComparacionLentes()` Actualizada

```javascript
function procesarRespuestaComparacionLentes(respuestaPaciente, interpretacionComparacion) {
  const comparacion = estadoExamen.comparacionActual;
  const preferencia = interpretarPreferenciaLente(respuestaPaciente, interpretacionComparacion);
  
  // Para esférico grueso y fino: estrategia de 3 valores (base, +salto, -salto)
  if (comparacion.tipo === 'esferico_grueso' || comparacion.tipo === 'esferico_fino') {
    return procesarRespuestaEsferico(comparacion, preferencia);
  }
  
  // Para cilíndrico: similar pero con valores negativos
  if (comparacion.tipo === 'cilindrico') {
    return procesarRespuestaCilindrico(comparacion, preferencia);
  }
  
  // Para cilíndrico ángulo: navegación por grados
  if (comparacion.tipo === 'cilindrico_angulo') {
    return procesarRespuestaCilindricoAngulo(comparacion, preferencia);
  }
}

function procesarRespuestaEsferico(comparacion, preferencia) {
  const { valorBase, valorMas, valorMenos, valoresProbados } = comparacion;
  
  // Caso 1: Estamos mostrando valorMas (+0.50)
  if (comparacion.valorActual === valorMas) {
    if (preferencia === 'anterior') {
      // Eligió base
      valoresProbados.base = true;
      comparacion.valorConfirmado = valorBase;
      comparacion.confirmaciones = 1;
      
      // Probar el otro lado (-0.50) para comparar
      if (!valoresProbados.menos) {
        comparacion.valorAnterior = valorBase;
        comparacion.valorActual = valorMenos;
        valoresProbados.menos = true;
        return { ok: true, necesitaMostrarAlternativo: true, valor: valorMenos };
      } else {
        // Ya probamos ambos lados, confirmar base
        return confirmarResultado(valorBase);
      }
    } else if (preferencia === 'actual') {
      // Eligió +0.50
      // Volver a base para confirmar
      if (!valoresProbados.base) {
        comparacion.valorAnterior = valorMas;
        comparacion.valorActual = valorBase;
        valoresProbados.base = true;
        return { ok: true, necesitaMostrarAlternativo: true, valor: valorBase };
      } else {
        // Ya probamos base, confirmar +0.50
        if (comparacion.valorConfirmado === valorMas) {
          comparacion.confirmaciones = 2;
          return confirmarResultado(valorMas);
        } else {
          comparacion.valorConfirmado = valorMas;
          comparacion.confirmaciones = 1;
          // Mostrar base otra vez para segunda confirmación
          comparacion.valorAnterior = valorMas;
          comparacion.valorActual = valorBase;
          return { ok: true, necesitaMostrarAlternativo: true, valor: valorBase };
        }
      }
    }
  }
  
  // Caso 2: Estamos mostrando valorMenos (-0.50)
  if (comparacion.valorActual === valorMenos) {
    if (preferencia === 'anterior') {
      // Eligió base (segunda confirmación si ya había elegido base antes)
      if (valoresProbados.base && comparacion.valorConfirmado === valorBase) {
        comparacion.confirmaciones = 2;
        return confirmarResultado(valorBase);
      } else {
        // Primera confirmación de base
        valoresProbados.base = true;
        comparacion.valorConfirmado = valorBase;
        comparacion.confirmaciones = 1;
        // Ya probamos ambos lados, confirmar base
        return confirmarResultado(valorBase);
      }
    } else if (preferencia === 'actual') {
      // Eligió -0.50
      if (comparacion.valorConfirmado === valorMenos) {
        comparacion.confirmaciones = 2;
        return confirmarResultado(valorMenos);
      } else {
        comparacion.valorConfirmado = valorMenos;
        comparacion.confirmaciones = 1;
        // Volver a base para confirmar
        comparacion.valorAnterior = valorMenos;
        comparacion.valorActual = valorBase;
        return { ok: true, necesitaMostrarAlternativo: true, valor: valorBase };
      }
    }
  }
  
  // Caso 3: Estamos mostrando base (confirmación)
  if (comparacion.valorActual === valorBase) {
    if (preferencia === 'anterior') {
      // Eligió el valor que mostramos antes
      const valorElegido = comparacion.valorAnterior;
      if (comparacion.valorConfirmado === valorElegido) {
        comparacion.confirmaciones = 2;
        return confirmarResultado(valorElegido);
      } else {
        comparacion.valorConfirmado = valorElegido;
        comparacion.confirmaciones = 1;
        // Mostrar valor elegido otra vez
        comparacion.valorAnterior = valorBase;
        comparacion.valorActual = valorElegido;
        return { ok: true, necesitaMostrarAlternativo: true, valor: valorElegido };
      }
    } else if (preferencia === 'actual') {
      // Eligió base
      if (comparacion.valorConfirmado === valorBase) {
        comparacion.confirmaciones = 2;
        return confirmarResultado(valorBase);
      } else {
        comparacion.valorConfirmado = valorBase;
        comparacion.confirmaciones = 1;
        // Mostrar el otro valor para segunda confirmación
        const otroValor = comparacion.valorAnterior === valorMas ? valorMenos : valorMas;
        comparacion.valorAnterior = valorBase;
        comparacion.valorActual = otroValor;
        return { ok: true, necesitaMostrarAlternativo: true, valor: otroValor };
      }
    }
  }
  
  return { ok: true };
}
```

## 🔄 Secuencia Completa para Esférico Grueso

### Ejemplo 1: Paciente elige base

```
1. Base: +0.75 (en foróptero)
   → Mensaje introductorio

2. Mostrar +1.25 (base + 0.50)
   → "Ves mejor con este o con el anterior?"
   → Respuesta: "anterior" → Eligió +0.75
   → valoresProbados.base = true (primera confirmación)

3. Mostrar +0.25 (base - 0.50)
   → "Ves mejor con este o con el anterior?"
   → Respuesta: "con el anterior" → Eligió +0.75 (segunda confirmación)
   → RESULTADO: +0.75
```

### Ejemplo 2: Paciente elige +0.50

```
1. Base: +0.75
2. Mostrar +1.25
   → Respuesta: "con este" → Eligió +1.25

3. Volver a base: +0.75 (para comparar)
   → Respuesta: "con el anterior" → Eligió +1.25 (primera confirmación)

4. Volver a +1.25
   → Respuesta: "con este" → Segunda confirmación
   → RESULTADO: +1.25
```

### Ejemplo 3: Paciente elige -0.50

```
1. Base: +0.75
2. Mostrar +1.25
   → Respuesta: "anterior" → Eligió +0.75

3. Mostrar +0.25
   → Respuesta: "con este" → Eligió +0.25

4. Volver a base: +0.75
   → Respuesta: "con el anterior" → Eligió +0.25 (primera confirmación)

5. Volver a +0.25
   → Respuesta: "con este" → Segunda confirmación
   → RESULTADO: +0.25
```

## ✅ Ventajas de esta Estrategia

1. **Límite de saltos**: Nunca más de ±0.50 (o ±0.25 para fino)
2. **No marear**: Siempre volvemos al valor base para confirmar
3. **Completo**: Probamos ambos lados (+ y -) antes de confirmar
4. **Preciso**: 2 confirmaciones del mismo valor

## ⚠️ Consideraciones

1. **Para esférico fino**: Saltos de ±0.25 (más precisos)
2. **Para cilíndrico**: Valores negativos, pero misma lógica
3. **Para cilíndrico ángulo**: Saltos de ±15° (grados)

## 🚀 Implementación

1. Actualizar `iniciarComparacionLentes()` para pre-calcular `valorMas` y `valorMenos`
2. Agregar `valoresProbados` al estado para rastrear qué valores ya probamos
3. Implementar `procesarRespuestaEsferico()` con lógica de 3 valores
4. Implementar funciones similares para cilíndrico y ángulo

