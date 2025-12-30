# Plan de Acción: Ocultar Elementos de UI

## Objetivo
Ocultar visualmente de la interfaz de usuario:
1. Selectores "Scenario" y "Agent"
2. Botones "Copiar" y "Descargar Audio"

## Análisis del Código

### 1. Selectores "Scenario" y "Agent"
**Ubicación:** `src/app/App.tsx`

**Líneas relevantes:**
- **Líneas 455-514**: Contenedor principal con los selectores
  - Línea 455: `<div className="flex items-center">` - Contenedor del selector "Scenario"
  - Líneas 456-480: Label "Scenario" y selector dropdown
  - Líneas 482-514: Label "Agent" y selector dropdown (condicional con `{agentSetKey && ...}`)

**Estructura:**
```tsx
<div className="flex items-center">
  <label>Scenario</label>
  <div className="relative inline-block">
    <select>...</select>
    <div>...</div> {/* Icono chevron */}
  </div>
  
  {agentSetKey && (
    <div className="flex items-center ml-6">
      <label>Agent</label>
      <div className="relative inline-block">
        <select>...</select>
        <div>...</div> {/* Icono chevron */}
      </div>
    </div>
  )}
</div>
```

### 2. Botones "Copiar" y "Descargar Audio"
**Ubicación:** `src/app/components/Transcript.tsx`

**Líneas relevantes:**
- **Líneas 76-94**: Header del componente Transcript con los botones
  - Línea 76: `<div className="flex items-center justify-between ...">` - Contenedor del header
  - Línea 77: Título "Conversación"
  - Líneas 78-93: Contenedor con los dos botones

**Estructura:**
```tsx
<div className="flex items-center justify-between px-6 py-3 ...">
  <span className="font-semibold">Conversación</span>
  <div className="flex gap-x-2">
    <button onClick={handleCopyTranscript}>...</button> {/* Botón Copiar */}
    <button onClick={downloadRecording}>...</button> {/* Botón Descargar Audio */}
  </div>
</div>
```

## Plan de Implementación

### Opción 1: Usar clases CSS `hidden` (Recomendada)
Ocultar los elementos usando la clase de Tailwind `hidden`, que aplica `display: none`.

**Ventajas:**
- Simple y directo
- No afecta el layout (los elementos no ocupan espacio)
- Fácil de revertir
- No requiere cambios en la lógica

**Desventajas:**
- Los elementos siguen en el DOM (pero no visibles)

### Opción 2: Renderizado condicional
Usar renderizado condicional con `{false && ...}` o eliminar completamente los elementos.

**Ventajas:**
- Los elementos no están en el DOM
- Más limpio desde el punto de vista del DOM

**Desventajas:**
- Requiere comentar o eliminar código
- Más difícil de revertir
- Puede afectar la lógica si hay dependencias

### Opción 3: Usar clases CSS `invisible` o `opacity-0`
Ocultar visualmente pero mantener el espacio.

**Ventajas:**
- Mantiene el layout

**Desventajas:**
- Los elementos ocupan espacio (no recomendado para este caso)

## Implementación Recomendada (Opción 1)

### Cambio 1: Ocultar selectores en `App.tsx`

**Archivo:** `src/app/App.tsx`

**Línea 455:** Agregar clase `hidden` al contenedor principal
```tsx
// ANTES:
<div className="flex items-center">

// DESPUÉS:
<div className="flex items-center hidden">
```

**O mejor aún, ocultar todo el bloque:**
```tsx
// ANTES:
<div className="flex items-center">
  <label className="flex items-center text-base gap-1 mr-2 font-medium">
    Scenario
  </label>
  ...
</div>

// DESPUÉS:
<div className="flex items-center hidden">
  <label className="flex items-center text-base gap-1 mr-2 font-medium">
    Scenario
  </label>
  ...
</div>
```

### Cambio 2: Ocultar botones en `Transcript.tsx`

**Archivo:** `src/app/components/Transcript.tsx`

**Línea 78:** Agregar clase `hidden` al contenedor de botones
```tsx
// ANTES:
<div className="flex gap-x-2">
  <button onClick={handleCopyTranscript}>...</button>
  <button onClick={downloadRecording}>...</button>
</div>

// DESPUÉS:
<div className="flex gap-x-2 hidden">
  <button onClick={handleCopyTranscript}>...</button>
  <button onClick={downloadRecording}>...</button>
</div>
```

## Resumen de Cambios

### Archivos a modificar:
1. **`src/app/App.tsx`**
   - Línea 455: Agregar clase `hidden` al `<div className="flex items-center">` que contiene los selectores

2. **`src/app/components/Transcript.tsx`**
   - Línea 78: Agregar clase `hidden` al `<div className="flex gap-x-2">` que contiene los botones

### Total de cambios:
- **2 archivos** a modificar
- **2 líneas** a cambiar (agregar clase `hidden`)

## Consideraciones Adicionales

1. **Funcionalidad preservada**: Los elementos seguirán funcionando en el código, solo estarán ocultos visualmente. Si se necesita revertir, solo hay que quitar la clase `hidden`.

2. **Layout**: Al usar `hidden`, los elementos no ocuparán espacio en el layout, por lo que la UI se ajustará automáticamente.

3. **Accesibilidad**: Los elementos ocultos con `hidden` no serán accesibles para lectores de pantalla ni navegación por teclado, lo cual es el comportamiento deseado para ocultar elementos.

4. **Testing**: Después de implementar, verificar que:
   - Los selectores no son visibles
   - Los botones no son visibles
   - El layout se ajusta correctamente
   - No hay espacios vacíos donde estaban los elementos

## Alternativa: Variable de Configuración

Si en el futuro se quiere poder mostrar/ocultar estos elementos dinámicamente, se podría:
1. Crear una variable de entorno o constante de configuración
2. Usar renderizado condicional basado en esa variable
3. Ejemplo: `{SHOW_UI_CONTROLS && <div>...</div>}`

Pero para el caso actual, la solución con `hidden` es la más simple y directa.

