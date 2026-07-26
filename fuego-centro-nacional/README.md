# Fuego Centro Nacional

Panel nacional de seguimiento de incendios forestales con búsqueda por localidades, fuentes oficiales, señales preliminares y actividad térmica.

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
- Las API `/api/situation`, `/api/geocode` y `/api/health` deben responder correctamente.

## Desarrollo y pruebas

```bash
npm install
npm test
```

Pruebas disponibles:

- `npm run test:source`: integridad de archivos, sintaxis y contratos críticos.
- `npm run test:e2e`: navegador local con API simulada; comprueba escritura, búsqueda y centro del mapa.
- `npm run test:production`: comprobación de recursos y API de producción.

## Despliegue seguro

El workflow de GitHub Actions ejecuta las pruebas en cada cambio de este directorio. No se debe publicar una modificación que no supere CI.

El proyecto está preparado para desplegar desde el subdirectorio `fuego-centro-nacional` del repositorio `Calcumedia/herramientas`.