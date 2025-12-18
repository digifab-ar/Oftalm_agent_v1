# Análisis del Bug en Esférico Fino

## Descripción del Problema

Cuando el test de esférico fino tiene como resultado grueso 0.75:
1. ✅ Prueba con 1.00 y el paciente prefiere 1.00 (correcto)
2. ❌ Luego hace otra prueba con 0.75 vs 0.75 (incorrecto)
3. ✅ Debería hacer 1.00 vs 0.50

## Flujo Actual (Con Bug)

### Estado Inicial
- `valorBase` = 0.75 (resultado del esférico grueso)
- `saltoActual` = 0.25 (para esférico fino)
- `valorMas` = 1.00 (0.75 + 0.25)
- `valorMenos` = 0.50 (0.75 - 0.25)

### Paso 1: Iniciando
- Se muestra `valorMas` (1.00)
- `valorActual` = 1.00
- `valorAnterior` = 0.75 (valorBase)

### Paso 2: Paciente prefiere 1.00 (actual)
**Código ejecutado (línea 1933-1941):**
```javascript
if (estado.valorActual === estado.valorMas) {
  estado.valorConfirmado = estado.valorMas;  // 1.00
  estado.confirmaciones = 1;
  estado.valorAnterior = estado.valorMas;    // 1.00
  estado.faseComparacion = 'mostrando_alternativo';
  return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase }; // 0.75
}
```

**Estado después:**
- `valorConfirmado` = 1.00
- `confirmaciones` = 1
- `valorAnterior` = 1.00
- Se muestra: 0.75

### Paso 3: Se muestra valorBase (0.75)
**Código ejecutado (línea 1183-1184):**
```javascript
estado.valorAnterior = estado.valorActual;  // 1.00 → se guarda antes de cambiar
estado.valorActual = resultado.valorAMostrar;  // 0.75
```

**Estado después:**
- `valorActual` = 0.75
- `valorAnterior` = 1.00 ✅ (correcto)

### Paso 4: Paciente prefiere anterior (1.00)
**Código ejecutado (línea 1909-1919):**
```javascript
else if (estado.valorActual === estado.valorBase) {
  if (estado.valorAnterior === estado.valorMas) {
    estado.valorConfirmado = estado.valorMas;  // 1.00 (ya estaba)
    estado.confirmaciones = 1;  // ❌ Se resetea a 1, no incrementa
    estado.faseComparacion = 'mostrando_alternativo';
    return { ok: true, necesitaMostrarLente: true, valorAMostrar: estado.valorBase }; // 0.75
  }
}
```

**Problema identificado:**
- `confirmaciones` se resetea a 1 en lugar de incrementarse
- Retorna mostrar `valorBase` (0.75) de nuevo, cuando debería probar el siguiente valor

### Paso 5: Se muestra valorBase (0.75) otra vez
**Código ejecutado (línea 1183-1184):**
```javascript
estado.valorAnterior = estado.valorActual;  // 0.75 (valorActual actual)
estado.valorActual = resultado.valorAMostrar;  // 0.75
```

**Estado después:**
- `valorActual` = 0.75
- `valorAnterior` = 0.75 ❌ (BUG: ambos son iguales)

## Causa Raíz

El problema tiene **dos causas principales**:

### Causa 1: Lógica incorrecta cuando se confirma que un valor alternativo es mejor

Cuando el paciente prefiere `valorMas` (1.00) sobre `valorBase` (0.75), el sistema:
1. ✅ Correctamente marca `valorConfirmado = 1.00`
2. ❌ Incorrectamente muestra `valorBase` (0.75) para "confirmar"
3. ❌ Cuando el paciente confirma que prefiere 1.00, vuelve a mostrar 0.75

**El problema:** El sistema no recalcula `valorMas` y `valorMenos` cuando el `valorConfirmado` cambia. Debería:
- Si `valorConfirmado = 1.00`, entonces el nuevo `valorBase` debería ser 1.00
- Recalcular: `valorMas = 1.25`, `valorMenos = 0.75`
- Probar 1.00 vs 0.75 (que es el valorMenos del nuevo base)

### Causa 2: Reset incorrecto de confirmaciones

En la línea 1915, cuando el paciente prefiere el anterior (que es `valorMas`):
```javascript
estado.confirmaciones = 1;  // ❌ Se resetea en lugar de incrementar
```

Debería ser:
```javascript
estado.confirmaciones += 1;  // ✅ Incrementar
```

Pero esto solo solucionaría parcialmente el problema, porque aún así estaría mostrando 0.75 vs 0.75.

## Flujo Correcto Esperado

### Estado Inicial
- `valorBase` = 0.75
- `valorMas` = 1.00
- `valorMenos` = 0.50

### Paso 1: Mostrar 1.00 vs 0.75
- `valorActual` = 1.00
- `valorAnterior` = 0.75

### Paso 2: Paciente prefiere 1.00
- `valorConfirmado` = 1.00
- **NUEVO:** Recalcular valores desde 1.00:
  - `valorBase` = 1.00 (nuevo base)
  - `valorMas` = 1.25 (1.00 + 0.25)
  - `valorMenos` = 0.75 (1.00 - 0.25)
- Mostrar 1.00 vs 0.75 (valorMenos del nuevo base)

### Paso 3: Paciente prefiere 1.00 sobre 0.75
- Confirmar que 1.00 es mejor
- `confirmaciones` = 2
- Resultado final: 1.00

**O si el paciente prefiere 0.75:**
- `valorConfirmado` = 0.75
- Recalcular desde 0.75:
  - `valorBase` = 0.75
  - `valorMas` = 1.00
  - `valorMenos` = 0.50
- Continuar con la lógica normal

## Plan de Acción

### 1. Recalcular valores cuando se confirma un valor alternativo

**Ubicación:** Función `procesarRespuestaComparacionLentes`

**Cambio necesario:**
Cuando `valorConfirmado` cambia a un valor diferente de `valorBase`, recalcular:
- `valorBase` = `valorConfirmado`
- `valorMas` = `valorBase + saltoActual`
- `valorMenos` = `valorBase - saltoActual`
- Resetear `valoresProbados`

**Casos a manejar:**
- Cuando se confirma `valorMas` como mejor
- Cuando se confirma `valorMenos` como mejor
- Validar límites (-6.00 a +6.00 para esfera)

### 2. Corregir incremento de confirmaciones

**Ubicación:** Línea 1915 y 1923

**Cambio necesario:**
```javascript
// ANTES:
estado.confirmaciones = 1;

// DESPUÉS:
estado.confirmaciones += 1;
```

### 3. Lógica para mostrar siguiente comparación

**Ubicación:** Líneas 1918-1919 y 1926-1927

**Cambio necesario:**
Después de recalcular valores, mostrar el valor que corresponde según la nueva base:
- Si se confirmó `valorMas`, mostrar `valorMenos` del nuevo base
- Si se confirmó `valorMenos`, mostrar `valorMas` del nuevo base

### 4. Validar que no se muestren valores iguales

**Ubicación:** Antes de retornar `valorAMostrar`

**Cambio necesario:**
Agregar validación para asegurar que `valorAMostrar !== valorActual` antes de mostrar.

## Archivos a Modificar

1. **`reference/foroptero-server/motorExamen.js`**
   - Función `procesarRespuestaComparacionLentes` (líneas 1852-1995)
   - Agregar función auxiliar `recalcularValoresComparacion` (nueva)

## Consideraciones Adicionales

1. **Límites de valores:** Asegurar que los valores recalculados no excedan -6.00 a +6.00
2. **Consistencia con esférico grueso:** Verificar que la misma lógica funcione para esférico grueso
3. **Tests:** Crear casos de prueba para:
   - Preferencia por valorMas
   - Preferencia por valorMenos
   - Múltiples confirmaciones
   - Valores en límites

## Notas de Implementación

- El salto para esférico fino es 0.25
- El salto para esférico grueso es 0.50
- La lógica debe funcionar para ambos tipos de test

