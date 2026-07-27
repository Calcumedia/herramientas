# FuegoCerca

Herramienta nacional para consultar la situación de incendios forestales cerca de una localidad, con fuentes oficiales, señales preliminares, actividad térmica y contexto meteorológico.

## Producción

- Web: https://fuego-centro-nacional.vercel.app
- Estado: https://fuego-centro-nacional.vercel.app/api/health
- Proyecto Vercel: `fuego-centro-nacional`
- Motor de datos: `fuego-centro-panel` (4.3.1)

## Garantías que no deben romperse

- El buscador de localidades es un formulario estático y nunca se recrea durante las actualizaciones.
- El mapa abre en `40.4167, -3.7033`, zoom `6`.
- La carga inicial no ejecuta `fitBounds`; el encuadre completo solo se activa con **Ver todo**.
- Las actualizaciones conservan pestaña, filtros, búsqueda y posición del mapa.
- Se mantienen separados los incidentes oficiales, las señales preliminares y los grupos térmicos.
- Las API `/api/situation`, `/api/geocode`, `/api/weather`, `/api/fire-danger`, `/api/fire-danger-map`, `/api/road-incidents` y `/api/health` deben responder correctamente.
- El nivel de atención local debe presentarse siempre como orientación calculada por FuegoCerca, nunca como nivel oficial ni como estimación de riesgo.
- Las distancias deben distinguir incidente oficial, señal preliminar y señal térmica, y aclarar que se miden hasta puntos de referencia.
- El peligro meteorológico procede del producto oficial diario de AEMET a 1 km y nunca debe presentarse como incendio confirmado, alerta o predicción de trayectoria.
- Las incidencias DGT se muestran como información de tráfico independiente: no deben atribuirse a un incendio si la fuente no establece esa relación.

## Desarrollo y pruebas

```bash
npm install
npm test
```

Pruebas disponibles:

- `npm run test:source`: integridad de archivos, sintaxis y contratos críticos.
- `npm run test:contract`: contratos del raster oficial de AEMET y del feed DATEX II 3.7 de la DGT.
- `npm run test:e2e`: navegador local con API simulada; comprueba escritura, búsqueda y centro del mapa.
- `npm run test:production`: comprobación de recursos y API de producción.

## Despliegue seguro

El workflow de GitHub Actions ejecuta las pruebas en cada cambio de este directorio. No se debe publicar una modificación que no supere CI.

El proyecto está preparado para desplegar desde el subdirectorio `fuego-centro-nacional` del repositorio `Calcumedia/herramientas`.
