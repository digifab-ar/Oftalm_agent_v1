# Análisis Bug: Agudeza Alcanzada - Muestra 2 Letras por LogMAR

## Problema Reportado

**Comportamiento esperado:**
- Iniciar con el valor de agudeza inicial
- Ir probando distintas letras en escala logMAR descendente
- Se necesita doble confirmación para llegar al resultado final
- Misma lógica de prueba que agudeza inicial

**Problema actual:**
- Va mostrando 2 letras por cada escala logMAR consecutivamente
- Hace muy largo el examen
- Dinámica distinta a agudeza inicial

---

## Causa Raíz Identificada

### Comparación de Lógica: `agudeza_inicial` vs `agudeza_alcanzada`

#### **agudeza_inicial** (líneas 863-934)
Cuando hay una **primera respuesta correcta en un nuevo logMAR** (líneas 921-934):
```javascript
} else {
  // Nuevo logMAR o primera respuesta correcta, resetear confirmaciones a 1
  estado.confirmaciones = 1;
  
  // Bajar logMAR (si no está en 0.0)  ← BAJA INMEDIATAMENTE
  if (estado.logmarActual > 0.0) {
    estado.logmarActual = bajarLogMAR(estado.logmarActual);
  }
  
  // Generar nueva letra
  const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
  estado.letraActual = nuevaLetra;
  estado.letrasUsadas.push(nuevaLetra);
}
```

**Comportamiento:**
1. Primera letra en logMAR 0.4 → correcta → `confirmaciones = 1` → **BAJA a 0.3** → muestra nueva letra
2. Primera letra en logMAR 0.3 → correcta → `confirmaciones = 1` → **BAJA a 0.2** → muestra nueva letra
3. Si falla en 0.2 → vuelve a 0.3 → muestra letra → si correcta → `confirmaciones = 2` → confirma

#### **agudeza_alcanzada** (líneas 1109-1119)
Cuando hay una **primera respuesta correcta en un nuevo logMAR** (líneas 1109-1119):
```javascript
} else {
  // Primera confirmación en este logMAR
  estado.confirmaciones = 1;
  
  // NO BAJA LOGMAR ← PROBLEMA AQUÍ
  
  // Generar nueva letra para segunda confirmación
  const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
  estado.letraActual = nuevaLetra;
  estado.letrasUsadas.push(nuevaLetra);
  
  return { ok: true, necesitaNuevaLetra: true };
}
```

**Comportamiento actual (BUG):**
1. Primera letra en logMAR 0.4 → correcta → `confirmaciones = 1` → **NO BAJA** → muestra segunda letra en 0.4
2. Segunda letra en logMAR 0.4 → correcta → `esMismoLogMAR = true` → `confirmaciones = 2` → **AHORA SÍ BAJA** a 0.3
3. Primera letra en logMAR 0.3 → correcta → `confirmaciones = 1` → **NO BAJA** → muestra segunda letra en 0.3
4. Y así sucesivamente...

**Resultado:** Siempre muestra 2 letras por logMAR antes de bajar, haciendo el examen más largo.

---

## Análisis Detallado del Flujo

### Flujo Actual (BUG) - agudeza_alcanzada

```
Estado inicial: logMAR = 0.4, confirmaciones = 0, ultimoLogmarCorrecto = null

1. Mostrar letra en 0.4 → "correcta"
   - esMismoLogMAR = (0.4 === null) = false
   - Entra en else (línea 1109)
   - confirmaciones = 1
   - NO baja logMAR
   - Muestra segunda letra en 0.4

2. Mostrar segunda letra en 0.4 → "correcta"
   - esMismoLogMAR = (0.4 === 0.4) = true
   - Entra en if (línea 998)
   - confirmaciones = 2
   - confirmaciones >= 2 → BAJA a 0.3
   - Muestra primera letra en 0.3

3. Mostrar letra en 0.3 → "correcta"
   - esMismoLogMAR = (0.3 === 0.3) = false (porque ultimoLogmarCorrecto se reseteó)
   - Entra en else (línea 1109)
   - confirmaciones = 1
   - NO baja logMAR
   - Muestra segunda letra en 0.3

4. Y así sucesivamente...
```

### Flujo Esperado (agudeza_inicial)

```
Estado inicial: logMAR = 0.4, confirmaciones = 0, ultimoLogmarCorrecto = null

1. Mostrar letra en 0.4 → "correcta"
   - esMismoLogMAR = (0.4 === null) = false
   - Entra en else (línea 921)
   - confirmaciones = 1
   - BAJA a 0.3 ← DIFERENCIA CLAVE
   - Muestra primera letra en 0.3

2. Mostrar letra en 0.3 → "correcta"
   - esMismoLogMAR = (0.3 === 0.3) = true
   - Entra en if (línea 876)
   - confirmaciones = 2
   - confirmaciones >= 2 → CONFIRMA

3. Si falla en 0.3 → vuelve a 0.4 → confirma ahí
```

---

## Problema Adicional Identificado

### Reset de `ultimoLogmarCorrecto` al bajar

En `agudeza_alcanzada`, cuando se baja después de 2 confirmaciones (líneas 1058-1064):
```javascript
estado.logmarActual = siguienteLogMAR;
estado.ultimoLogmarCorrecto = null; // ← RESETEA AQUÍ
estado.confirmaciones = 0;
```

Esto causa que cuando se muestra la primera letra en el nuevo logMAR:
- `esMismoLogMAR = (nuevoLogMAR === null) = false`
- Entra en el `else` (primera confirmación)
- NO baja inmediatamente

**En agudeza_inicial**, cuando baja después de primera respuesta correcta:
- `ultimoLogmarCorrecto` se actualiza ANTES de bajar (línea 870)
- Cuando muestra la siguiente letra, `esMismoLogMAR` puede ser `true` si es el mismo logMAR

---

## Plan de Acción

### Objetivo
Hacer que `agudeza_alcanzada` tenga la misma lógica que `agudeza_inicial`:
- Primera respuesta correcta en nuevo logMAR → bajar inmediatamente
- Segunda respuesta correcta en mismo logMAR → confirmar

### Cambios Requeridos

#### 1. Modificar lógica de primera respuesta correcta (líneas 1109-1119)

**ANTES:**
```javascript
} else {
  // Primera confirmación en este logMAR
  estado.confirmaciones = 1;
  
  // Generar nueva letra para segunda confirmación
  const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
  estado.letraActual = nuevaLetra;
  estado.letrasUsadas.push(nuevaLetra);
  
  return { ok: true, necesitaNuevaLetra: true };
}
```

**DESPUÉS:**
```javascript
} else {
  // Primera confirmación en este logMAR
  estado.confirmaciones = 1;
  
  // Bajar logMAR inmediatamente (igual que agudeza_inicial)
  if (estado.logmarActual > 0.0) {
    estado.logmarActual = bajarLogMAR(estado.logmarActual);
  }
  
  // Generar nueva letra
  const nuevaLetra = generarLetraSloan(estado.letrasUsadas);
  estado.letraActual = nuevaLetra;
  estado.letrasUsadas.push(nuevaLetra);
  
  return { ok: true, necesitaNuevaLetra: true };
}
```

#### 2. Ajustar lógica de confirmación después de bajar (líneas 1058-1064)

**ANTES:**
```javascript
estado.logmarActual = siguienteLogMAR;
estado.ultimoLogmarCorrecto = null; // Resetear para el nuevo logMAR
estado.confirmaciones = 0; // Empezar confirmaciones desde 0
```

**DESPUÉS:**
```javascript
estado.logmarActual = siguienteLogMAR;
// NO resetear ultimoLogmarCorrecto aquí, se actualizará en la siguiente respuesta
estado.ultimoLogmarCorrecto = null; // Mantener reset para nueva confirmación
estado.confirmaciones = 0; // Empezar confirmaciones desde 0
```

**Nota:** El reset de `ultimoLogmarCorrecto` está bien, pero necesitamos asegurar que cuando se actualice en la siguiente respuesta correcta, se comporte igual que agudeza_inicial.

#### 3. Verificar lógica de confirmación con 2 respuestas correctas

La lógica actual en líneas 998-1100 está correcta:
- Si `esMismoLogMAR = true` y `confirmaciones >= 2` → confirma o baja
- Si `esMismoLogMAR = false` → primera confirmación → ahora bajará inmediatamente

---

## Resumen de Cambios

1. **Línea 1113**: Agregar lógica para bajar logMAR inmediatamente después de primera respuesta correcta
2. **Mantener**: La lógica de doble confirmación cuando `esMismoLogMAR = true`
3. **Resultado esperado**: 
   - Primera letra correcta → baja inmediatamente
   - Segunda letra correcta en nuevo logMAR → confirma (si es el mismo logMAR que el anterior donde ya había confirmado)

---

## Casos de Prueba Sugeridos

1. **Caso 1: Descenso exitoso**
   - Agudeza inicial: 0.4
   - 0.4 → correcta → baja a 0.3
   - 0.3 → correcta → confirma (si ya había confirmado en 0.4) o baja a 0.2

2. **Caso 2: Falla y recuperación**
   - 0.4 → correcta → baja a 0.3
   - 0.3 → incorrecta → vuelve a 0.4
   - 0.4 → correcta → confirma (2 confirmaciones)

3. **Caso 3: Llegada a 0.0**
   - Descenso hasta 0.0
   - 0.0 → correcta → confirma con 2 confirmaciones

---

## Notas Adicionales

- La lógica de `agudeza_inicial` funciona correctamente y debe ser el modelo
- El problema está específicamente en la rama `else` de la línea 1109 en `agudeza_alcanzada`
- No se requiere cambiar la lógica de confirmación con 2 respuestas, solo la de primera respuesta

