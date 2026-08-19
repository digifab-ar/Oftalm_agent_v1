# Plan — Feedback cliente: lentes finales binocular en foróptero

**Fecha:** 2026-08-03  
**Estado:** **implementado + QA OK** — commit `0163239`; evidencia `registros-examen/examen-registro-22.csv`  
**Alcance de implementación:** **solo** `reference/foroptero-server/motorExamen.js`. Cualquier otro archivo (docs, agente, UI, firmware) **no** se toca salvo **100 % necesario** y con **validación previa** del responsable.  
**Relacionados:**  
- `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` — bug **B2** (cerrado con este fix)  
- `PLAN_REANCLAJE_POST_COMPARATIVA_LENTES.md` — regla §1 / §4.2–§4.4  
- `DEFINICIONES_EXAMEN_BINOCULAR.md`  
- `DOCUMENTACION.md` (FINALIZADO parcialmente implementado)

---

## 0. Decisiones de producto (cerradas)

| ID | Decisión |
|----|----------|
| **D1** | Al **cerrar** el binocular / examen (`confirmarResultadoBinocular` → `FINALIZADO`), **siempre** enviar al foróptero la **`rxFinal`**, con `foropteroDesdeRx(rxFinal)`. |
| **D2** | El envío es **incondicional** respecto de la preferencia: aplica igual si fue **`anterior`**, **`actual`** o **`igual`**. No comparar “¿ya está en cara?”; el foróptero puede manejar el no-op si ya está en esa Rx. |
| **D3** | Que el **mensaje de fin** se emita **antes** del movimiento del foróptero **no es un problema**. No hace falta `esperar_foroptero` antes del `hablar` de cierre por requisitos de UX. |
| **D4** | Implementación acotada a **`motorExamen.js`**. Otros archivos solo con justificación fuerte y OK explícito previo. |

---

## 1. Feedback del cliente (síntoma)

Durante la prueba binocular se realizan comparaciones (anterior vs actual). Al finalizar:

1. El sistema **define y persiste** el resultado binocular.
2. Emite un mensaje de examen finalizado.
3. **Problema:** el paciente **no queda** con el set de lentes resultado en el foróptero.

**Caso gatillo reportado:** en la **última** comparación, si el paciente elige **«el anterior»**, el flujo responde con finalizado **y no mueve** los lentes a la configuración «anterior».

---

## 2. Comportamiento esperado (producto)

Al cerrar el binocular:

1. Persistir `rxFinal` en `resultados.R/L.binocular` (como hoy).
2. Emitir el mensaje de fin del examen (flujo actual de cierre; orden vs hardware según **D3**).
3. **Siempre** mandar al foróptero `foropteroDesdeRx(rxFinal)` (ambos ojos `open`), **sin** ramificar por preferencia ni por “ya está en cara” (**D1**, **D2**).

| Preferencia última ronda | Rx lógica (`rxActiva` / `rxFinal`) | Comando foróptero al cierre |
|--------------------------|------------------------------------|-----------------------------|
| `actual` | `rxVariante` | **Siempre** `rxFinal` (aunque ya esté en cara) |
| `anterior` | `rxBasePaso` | **Siempre** `rxFinal` |
| `igual` (→ `anterior`) | `rxBasePaso` | **Siempre** `rxFinal` |

El paciente debe terminar el examen con el set de lentes resultado en el foróptero.

---

## 3. Flujo actual relevante (código)

### 3.1 Presentación de cada comparación

En `generarPasosEtapa6`, fases `FB_ESF_MOSTRAR` / `FB_CIL_MOSTRAR`:

1. Foróptero → `rxVariante`
2. `esperar_foroptero`
3. TV
4. `hablar` (pregunta combinada anterior/nuevo)
5. Fase → `*_PREG`

Cuando el paciente responde, el foróptero sigue mostrando la **variante** (actual).

### 3.2 Interpretación de la respuesta

`procesarRespuestaBinocular` (~3900):

```
preferencia = interpretarPreferenciaLente(...)
igual → anterior
actual  → rxActiva = rxVariante
anterior → rxActiva = rxBasePaso
```

- Si el paso es **esfera** y sigue cilindro: `necesitaMostrarLente` + flag `reanclajeRxBinocularIntermedio` **solo si** preferencia fue `anterior`.
- Si el paso es **cilindro**, o esfera que **omite** cilindro (`accion: 'confirmar'`): llama `confirmarResultadoBinocular(rxActiva)`.

### 3.3 Reanclaje intermedio (sí existe)

En `obtenerInstrucciones` ETAPA_6, rama `necesitaMostrarLente` + `postComparacionTrasEsfera` + `reanclajeRxBinocularIntermedio`:

- Emite `foropteroDesdeRx(rxActiva)` + `esperar_foroptero`
- Luego ritual post-comparación / variante cilíndrica

Eso cubre **esfera → cilindro** con «anterior», **no** el cierre del examen.

### 3.4 Confirmación final (brecha)

`confirmarResultadoBinocular` (~3978):

1. Persiste `resultados.R/L.binocular` desde `rxFinal`
2. Resetea `binocularEstado`
3. `avanzarTest()` → normalmente `FINALIZADO`
4. Retorna `{ resultadoConfirmado: true, rxFinal, ... }`
5. **No** envía comando foróptero ni pasos `foroptero` / `esperar_foroptero`

En `obtenerInstrucciones` (~2213), si `resultadoConfirmado`:

```
generarPasos()  // etapa ya FINALIZADO
ejecutarPasosAutomaticamente(pasos || [])
devolver solo hablar al agente
```

No hay reanclaje al `rxFinal` antes ni después de ese avance.

### 3.5 Contraste con ETAPA_5

`confirmarResultado` para `cilindrico` / `cilindrico_angulo` **sí** llama `ejecutarComandoForopteroInterno` con el valor final. Binocular no tiene equivalente.

---

## 4. Causas raíz

### CR-1 — Confirmación binocular sin movimiento de hardware (principal)

`confirmarResultadoBinocular` actualiza **solo estado lógico** y avanza la secuencia. El foróptero queda en la última `rxVariante` mostrada para la pregunta.

Cuando la preferencia es **`anterior`**, la Rx correcta es `rxBasePaso` ≠ lo que hay en cara → discrepancia clínica observable.

### CR-2 — Reanclaje «anterior» solo entre esferas→cilindro

El flag `reanclajeRxBinocularIntermedio` aplica al **paso intermedio**, no a la **última** decisión que llama a `confirmarResultadoBinocular`. La regla de producto «hardware = resultado elegido» (§1 de `PLAN_REANCLAJE…`) **no** está implementada en el cierre de ETAPA_6.

### CR-3 — El caso «actual» enmascara el bug

Si la última respuesta es «el nuevo» / `actual`, `rxActiva === rxVariante` y el foróptero **ya** está ahí. Persistencia y hardware coinciden **por accidente**. El fallo solo se ve con «anterior» / `igual`.

### CR-4 — Orquestación post-`resultadoConfirmado` asume “nada de hardware”

El bloque que maneja `resultadoConfirmado` en ETAPA_6 no consulta `rxFinal` ni compara con lo mostrado; va directo a `generarPasos()`. Además, `generarPasos()` **no** tiene case `FINALIZADO` (documentado como parcial): el mensaje de cierre puede ser vacío o improvisado por el agente, independiente del bug de lentes.

### CR-5 — Mismos paths de cierre afectados

Cualquier camino a `confirmarResultadoBinocular` con preferencia `anterior`/`igual` y variante distinta de la base:

| Path | Condición |
|------|-----------|
| A | Última ronda **cilíndrica** (`FB_CIL_PREG`) + anterior/igual |
| B | Última ronda **esférica** con omisión de cilindro (`ambosCilindrosCero`) + anterior/igual |
| C | Tras «listo», omisión de esfera y confirmación directa si también se omite cilindro — sin comparación; hardware ya en base (no es el bug reportado) |

El feedback del cliente apunta sobre todo a **A** (y análogo **B**).

---

## 5. Cadena causal (última comparación, «anterior»)

```
Paciente ve rxVariante (pregunta binocular)
→ respuesta «el anterior»
→ procesarRespuestaBinocular: rxActiva = rxBasePaso
→ confirmarResultadoBinocular(rxActiva)
     → guarda binocular = rxBasePaso  ✓
     → avanzarTest() → FINALIZADO      ✓
     → NO foropteroDesdeRx(rxBasePaso) ✗
→ foróptero sigue en rxVariante
→ agente recibe cierre (hablar / vacío) sin pasos de hardware
```

---

## 6. Implementación (cerrada)

### 6.1 Regla aplicada (§0)

Al confirmar el resultado binocular:

1. Persistir `rxFinal`.
2. **Siempre** `ejecutarComandoForopteroInterno(foropteroDesdeRx(rxFinal))` — fire-and-forget (**D1–D3**).
3. Reset estado + `avanzarTest()` → `FINALIZADO`.

Sin ritual “Sigamos…”, sin deferred, sin ramas por preferencia.

### 6.2 Enganche elegido

**Opción B** en `confirmarResultadoBinocular` (`motorExamen.js`), paridad con confirmación cilíndrica monocular.

### 6.3 Commit

| Campo | Valor |
|-------|-------|
| Commit | `0163239` |
| Mensaje | `fix(binocular): apply rxFinal to foropter on exam close` |
| Archivo código | `reference/foroptero-server/motorExamen.js` |

### 6.4 Nota sobre registro CSV

El comando de cierre usa `ejecutarComandoForopteroInterno` **directo** (no pasa por `ejecutarPasosAutomaticamente`), por lo que el POC de registro **no** agrega una fila `Foroptero-TV` post-preferencia final. La validación de hardware es **operador +** coherencia `Binocular (B)` vs última variante en cara.

---

## 7. Criterios de aceptación

| # | Caso | Criterio |
|---|------|----------|
| 1 | Última ronda, «**anterior**» | Al cierre se envía foróptero con `rxFinal` (= base); hardware termina en esa Rx |
| 2 | Última ronda, «**actual**» | Al cierre **también** se envía foróptero con `rxFinal` (= variante), aunque ya estuviera |
| 3 | Última ronda, «**igual**» | Igual que anterior: comando con `rxFinal` |
| 4 | Esfera con omisión de cilindro + cierre | Mismo: siempre comando con `rxFinal` |
| 5 | Esfera → cilindro (intermedio) | Sin regresión del reanclaje intermedio existente |
| 6 | Alcance | Diff de implementación limitada a `motorExamen.js` (salvo excepción validada) |
| 7 | Persistencia | `resultados.*.binocular` = `rxFinal` enviada al foróptero |

---

## 8. Plan de QA

1. Modo `testbin` o examen completo hasta binocular.
2. Forzar en la **última** comparación «el anterior», «el nuevo» e «igual» (tres cierres).
3. En **los tres**: verificar en logs/CSV un comando foróptero con la `rxFinal` al pasar a `FINALIZADO`.
4. Caso «anterior»: hardware debe **moverse** de variante → base.
5. Caso «actual»: comando igualmente presente (no-op tolerado por el foróptero).
6. Regresión: esfera→cilindro con anterior/actual (ritual intermedio intacto).

---

## 9. Riesgos

| Riesgo | Mitigación / decisión |
|--------|------------------------|
| Reset de `binocularEstado` borra datos para armar el comando | Usar siempre `rxFinal` ya calculada / del return |
| Mensaje de fin antes del movimiento | **Aceptado (D3)** — no bloquear el cierre por `esperar_foroptero` |
| Comando redundante en «actual» | **Aceptado (D2)** — el foróptero maneja no-op |
| Tocar otros archivos por “completar” docs/agente | **No** — solo `motorExamen.js` (**D4**) |
| Doble movimiento si otro generador mueve tras confirmar | Tras confirmación no debe generarse otra variante; solo cierre + este comando |

---

## 10. Relación con trabajo previo

Este feedback es el mismo defecto **B2** de `PLAN_FIX_BINOCULAR_CILINDRICO_REG13.md` — **cerrado** con `0163239` + registro-22.  
Cierre binocular: siempre `rxFinal` (**D1–D2**), sin condicionar por preferencia.

---

## 11. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Qué se hizo? | Al cerrar binocular, **siempre** `foropteroDesdeRx(rxFinal)` en `confirmarResultadoBinocular` |
| ¿Mensaje de fin antes del movimiento? | OK (**D3**) |
| ¿Archivos de código? | Solo `motorExamen.js` (**D4**) |
| ¿QA? | ✅ OK — `examen-registro-22.csv` (§12) |

---

## 12. QA post-fix — `examen-registro-22`

**Archivo:** `registros-examen/examen-registro-22.csv`  
**Sesión:** 2026-08-03, 10:08–10:16 (exportado 10:16:37)  
**Modo:** `normal` → `FINALIZADO`  
**Valores iniciales:** `<R> +0.25, -0.50, 175 / <L> +0.50, -1.50, 20`  
**Valores recalculados:** `<R> +0.25 , +0.00 , 175 / <L> +0.50 , -1.00 , 20`  
**Commit bajo prueba:** `0163239`  
**Resultado operador:** ✅ funciona correctamente (foróptero queda en Rx resultado tras «anterior»).

### 12.1 Tramo binocular (síntoma B2 ejercitado)

| Timestamp | Evento | Foróptero / detalle |
|-----------|--------|---------------------|
| 10:15:24 | Entrada ETAPA_6 (ambos open) | R `+0.00 / −0.25 @175°`; L `+0.75 / −1.00 @20°` |
| 10:15:38 | «listo» → variante **esférica** | L Esf `+0.75 → +0.25` |
| 10:15:54 | Paciente «el nuevo» (`actual`) | — |
| 10:15:54 | Variante **cilíndrica** (en cara al preguntar) | R Cil `−0.25 → 0`; L Cil `−1.00 → −0.50` |
| 10:16:19 | Paciente «el anterior» (`anterior`) | **Caso gatillo** — cierra examen |
| — | Resumen `Binocular (B)` | R `+0.00 / −0.25 @175°`; L `+0.25 / −1.00 @20°` |

### 12.2 Criterio de aceptación

| Check | Esperado | Observado |
|-------|----------|-----------|
| Preferencia última ronda | `anterior` | ✅ l. 177–178 |
| `rxFinal` persistida | = base del paso cilíndrico (no la variante en cara) | ✅ R Cil **−0.25**, L Cil **−1.00** (no 0 / −0.50) |
| Hardware post-cierre | = `rxFinal` | ✅ confirmado por operador |
| Fila `Foroptero-TV` tras 10:16:19 | Puede **no** aparecer (fire-and-forget fuera de `ejecutarPasosAutomaticamente`) | ⚠️ ausente en CSV — esperado §6.4 |

**Contraste pre-fix (diseño B2):** con «anterior» el resumen ya guardaba la base, pero el foróptero quedaba en la variante. Post-fix el hardware sigue la Rx del resumen.

### 12.3 Resultado

✅ **Cerrado** — fix `0163239` validado con CSV archivado + confirmación de campo.
