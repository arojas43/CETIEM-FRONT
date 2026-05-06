# Identidad de Gobierno Mexicano — CETIEM

## Cambios realizados para cumplir con la Gráfica Base V3

Referencia: https://www.gob.mx/guias/grafica/v3/

---

## 1. Paleta de Colores Oficial

### Colores implementados (exactos según lineamientos):

| Color | Hex | Uso |
|-------|-----|-----|
| Guinda | `#9d2449` | Color primario de acción, botones, enlaces |
| Guinda oscuro | `#611232` | Hover, acentos secundarios |
| Dorado | `#BC955C` | Secondary, advertencias, progreso |
| Dorado claro | `#DDC9A3` | Acentos suaves |
| Gris institucional | `#98989A` | Texto muted, elementos secundarios |
| Blanco | `#FFFFFF` | Backgrounds, superficies claras |
| Verde oscuro | `#13322e` | Dark mode background, éxito/aprobado |

### Cambios en Tailwind:
- `cetiem-green` → `cetiem-guinda`
- `cetiem-lime` → `cetiem-success`
- `cetiem-teal` → `cetiem-info`
- `cetiem-amber` → `cetiem-warning`
- `cetiem-red` → `cetiem-error`
- `cetiem-vino` → `cetiem-hover`
- `cetiem-gray` → `cetiem-gris`
- `cetiem-white` → `cetiem-blanco`
- `cetiem-dark` → `cetiem-verdeDark`
- `cetiem-doradoc` → `cetiem-doradoLight`

### Archivos modificados:
- `tailwind.config.js` — paleta completa actualizada
- `globals.css` — variables CSS HSL actualizadas para light/dark mode
- **28 archivos** en total con referencias de colores corregidas

---

## 2. Tipografía

### Headings (h1-h6):
- **Fuente:** Patria (oficial Identidad Visual 2024-2030)
- **Carga:** Vía GobMX CDN `https://framework-gb.cdn.gob.mx/gm/v3/assets/styles/main.css`
- **Fallback:** Playfair Display → Georgia → serif

### Body/Contenido:
- **Fuente:** Noto Sans (Google Fonts)
- **Tamaño:** 18px base
- **Line-height:** 1.428
- **Mínimo:** 16px

### Regla de ancho:
- Títulos y subtítulos ocupan máximo **2/3 del ancho** (8 columnas de 12)
- Implementado en CSS: `h1, h2 { max-width: 66.666%; }`

---

## 3. Favicon

- **URL oficial:** `https://framework-gb.cdn.gob.mx/gm/v3/assets/images/favicon.ico`
- Agregado en `<head>` de `layout.tsx`
- Meta `themeColor` configurado a `#9d2449` (guinda)

---

## 4. Pleca Institucional

### Horizontal (barra guinda superior):
- Clase CSS: `.pleca-horizontal`
- Altura: 4px, ancho: 100%, color: `#9d2449`
- Ubicada en:
  - Top de landing page
  - Top de sidebar/dashboard
  - Top de footer

### Vertical (barra guinda lateral):
- Clase CSS: `.pleca-vertical`
- Ancho: 4px, color: `#9d2449`
- Ubicada junto a:
  - "SECRETARÍA DE ECONOMÍA" en header
  - "SECRETARÍA DE ECONOMÍA" en sidebar
  - Logo en footer

---

## 5. Botones Oficiales

### Clases CSS implementadas:

| Clase | Color | Hover | Uso |
|-------|-------|-------|-----|
| `.btn-gob-primary` | `#9d2449` | `#611232` | Acciones principales |
| `.btn-gob-secondary` | `#BC955C` | `#a57f2c` | Acciones secundarias |
| `.btn-gob-danger` | `#9d2449` | `#611232` | Errores, eliminar |

### Variantes en componentes:
- `variant: 'default'` → guinda (primary)
- `variant: 'destructive'` → guinda (error)
- `variant: 'outline'` → borde institucional

---

## 6. Separadores Visuales

### Estilo gob.mx:
- Clase: `hr.gob-red`
- Implementación: línea con rectángulo rojo de 30px a la izquierda
- Margin: 2rem vertical

---

## 7. Toast/Notificaciones

### Colores oficiales implementados:
- **Success:** `#13322e` (verde oscuro)
- **Error:** `#9d2449` (guinda)
- **Warning:** `#BC955C` (dorado)
- **Info:** `#611232` (guinda oscuro)

---

## 8. Footer Institucional

### Estructura implementada:
1. Pleca horizontal superior
2. Logo + nombre de institución con pleca vertical
3. "Gobierno de México 2024-2030"
4. Links oficiales:
   - Trámites
   - Transparencia
   - ¿Qué hay de tu gobierno?
   - DENUNCIA
5. Línea inferior con nombre del sistema y accesos

---

## 9. Responsive Design

- Meta viewport: `width=device-width, initial-scale=1`
- Grid fluido con Tailwind (mobile-first)
- Breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`
- Navbar colapsa en móvil

---

## 10. Meta tags

- `lang="es-MX"` (español México)
- `themeColor="#9d2449"` (guinda institucional)
- Favicon oficial enlazado

---

## Verificación

✅ Build pasa sin errores de TypeScript
✅ Colores oficiales exactos en toda la aplicación
✅ Tipografía Patria cargada vía CDN oficial
✅ Favicon oficial implementado
✅ Plecas institucionales en headers/sidebars/footer
✅ Botones con paleta oficial
✅ Toasts con colores oficiales
✅ Títulos con ancho limitado a 2/3
✅ Footer con estructura oficial
✅ Responsive design configurado

---

## Archivos modificados (resumen)

| Archivo | Cambios |
|---------|---------|
| `tailwind.config.js` | Paleta de colores completa |
| `globals.css` | Variables CSS, tipografía, componentes |
| `layout.tsx` | Favicon, viewport, meta tags, lang |
| `page.tsx` | Header, footer, plecas, colores |
| `sidebar.tsx` | Plecas, colores, nombre institución |
| `auth.tsx` | Colores de botones y elementos |
| `register/page.tsx` | Colores de toda la página |
| `toast.tsx` | Colores oficiales de notificaciones |
| `dashboard-view.tsx` | 200+ referencias de colores |
| **+ 18 archivos más** | Referencias de colores corregidas |

**Total: 28 archivos modificados**
