# Despliegue seguro

## Proyecto existente

- Repositorio: `Calcumedia/herramientas`
- Directorio raíz de la aplicación: `fuego-centro-nacional`
- Proyecto Vercel: `fuego-centro-nacional`
- Dominio: `https://fuego-centro-nacional.vercel.app`

## Conexión del proyecto de Vercel

En Vercel, el proyecto debe configurarse con:

- **Git Repository:** `Calcumedia/herramientas`
- **Production Branch:** `main`
- **Root Directory:** `fuego-centro-nacional`
- **Framework Preset:** Other
- **Build Command:** vacío
- **Output Directory:** vacío
- **Install Command:** `npm install --ignore-scripts`

La conexión al repositorio requiere que la instalación de GitHub de Vercel tenga acceso a `Calcumedia/herramientas`.

## Comprobaciones obligatorias

Antes de promover un despliegue a producción:

```bash
npm install --ignore-scripts
npm run test:source
npm run test:production
```

El workflow `FuegoCerca CI` ejecuta estas comprobaciones automáticamente.

## Contratos críticos

No publicar si falla alguno de estos puntos:

1. `/`, `/styles.css` y `/app.js` responden con HTTP 200 y el tipo de contenido correcto.
2. El formulario `placeSearchForm` y el campo `placeQuery` existen en el HTML estático.
3. El campo permite escribir, enviar con Enter y consultar `/api/geocode`.
4. El mapa inicia en `[40.4167, -3.7033]`, zoom `6`.
5. La carga inicial nunca llama a `fitBounds`.
6. El botón **Ver todo** sí puede llamar manualmente a `fitBounds`.
7. `/api/situation`, `/api/geocode`, `/api/fire-danger`, `/api/fire-danger-map`, `/api/fire-perimeters`, `/api/road-incidents` y `/api/health` responden correctamente.
8. La cobertura regional contiene 19 territorios.
9. No desaparecen incidentes, alertas, noticias, fuentes, localidades guardadas ni notificaciones.
10. AEMET conserva la etiqueta preventiva, EFFIS se identifica como área quemada satelital y DGT conserva la advertencia de que sus incidencias no siempre están relacionadas con incendios.

## Recuperación

Si un despliegue falla:

1. No modificar el dominio con proxies a despliegues protegidos.
2. Restaurar el último despliegue completo y comprobado.
3. Verificar individualmente todos los archivos y API.
4. Corregir el código en GitHub y desplegar de nuevo únicamente cuando CI esté aprobado.
