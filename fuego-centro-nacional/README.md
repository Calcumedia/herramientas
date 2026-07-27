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
- Las API `/api/situation`, `/api/geocode`, `/api/weather`, `/api/air-quality`, `/api/fire-danger`, `/api/fire-danger-map`, `/api/fire-perimeters`, `/api/road-incidents` y `/api/health` deben responder correctamente.
- El nivel de atención local debe presentarse siempre como orientación calculada por FuegoCerca, nunca como nivel oficial ni como estimación de riesgo.
- Las distancias deben distinguir incidente oficial, señal preliminar y señal térmica, y aclarar que se miden hasta puntos de referencia.
- El peligro meteorológico procede del producto oficial diario de AEMET a 1 km y nunca debe presentarse como incendio confirmado, alerta o predicción de trayectoria.
- La calidad del aire procede del Índice Nacional de Calidad del Aire de MITECO. Sus datos horarios son provisionales, se vinculan a la estación activa más próxima y nunca deben atribuirse automáticamente al humo de un incendio.
- Las incidencias DGT se muestran como información de tráfico independiente: no deben atribuirse a un incendio si la fuente no establece esa relación.
- Los perímetros EFFIS se presentan como áreas quemadas cartografiadas por satélite, nunca como frente de llama, estado oficial del incendio u orden de emergencia.
- La distancia EFFIS se mide desde la coordenada de la localidad hasta el borde cartografiado; no reemplaza las distancias existentes a los puntos de referencia de incidentes.
- La versión 4.9.2 conserva el conjunto nacional de EFFIS durante 24 horas en la caché regional persistente de Vercel, también entre despliegues, y lo reutiliza entre localidades.
- FuegoCerca inicia una precarga no bloqueante al abrirse. Cuando la copia supera una hora, la sirve inmediatamente con su fecha visible y solicita la actualización en segundo plano.
- Cada área quemada muestra su antigüedad y puede ocultarse desde el control «Perímetros EFFIS». No se vincula automáticamente a un incendio oficial sin una coincidencia espacial y temporal verificable.

## Desarrollo y pruebas

```bash
npm install
npm test
```

Pruebas disponibles:

- `npm run test:source`: integridad de archivos, sintaxis y contratos críticos.
- `npm run test:contract`: contratos del raster oficial de AEMET, el ICA nacional de MITECO, los perímetros EFFIS y el feed DATEX II 3.7 de la DGT.
- `npm run test:e2e`: navegador local con API simulada; comprueba escritura, búsqueda y centro del mapa.
- `npm run test:production`: comprobación de recursos y API de producción.

## Despliegue seguro

El workflow de GitHub Actions ejecuta las pruebas en cada cambio de este directorio. No se debe publicar una modificación que no supere CI.

El proyecto está preparado para desplegar desde el subdirectorio `fuego-centro-nacional` del repositorio `Calcumedia/herramientas`.
