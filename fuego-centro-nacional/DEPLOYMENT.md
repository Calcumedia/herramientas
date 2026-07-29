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
7. `/api/situation`, `/api/infoca`, `/api/bombers`, `/api/infoar`, `/api/previfoc`, `/api/geocode`, `/api/fire-danger`, `/api/fire-danger-map`, `/api/air-quality`, `/api/fire-perimeters`, `/api/road-incidents` y `/api/health` responden correctamente; `/api/health` incluye el monitor de fuentes.
8. La cobertura regional contiene 19 territorios.
9. No desaparecen incidentes, alertas, noticias, fuentes, localidades guardadas ni notificaciones.
10. AEMET conserva la etiqueta preventiva, EFFIS se identifica como área quemada satelital y DGT conserva la advertencia de que sus incidencias no siempre están relacionadas con incendios.
11. El control «Perímetros EFFIS» permite ocultar y volver a mostrar la capa; la antigüedad del producto es visible y una copia antigua se identifica como tal.
12. Dos consultas de localidades distintas reutilizan el conjunto nacional de EFFIS y un fallo de actualización no convierte un área quemada en un incendio activo.
13. La caché regional persistente de EFFIS se reutiliza después de reiniciar la función y conserva un TTL máximo de 24 horas.
14. Si la copia supera una hora, la respuesta es inmediata, se marca como guardada y la renovación se ejecuta en segundo plano.
15. La precarga automática de EFFIS no bloquea ni reconstruye el buscador, el informe local o el mapa.
16. La tarjeta de calidad del aire identifica la estación MITECO utilizada, su distancia y la hora de medición; aclara siempre que los datos son provisionales y que el ICA no confirma humo procedente de un incendio.
17. INFOCA solo incorpora registros de las ocho provincias andaluzas, excluye extinguidos y no transforma registros antiguos en incendios vigentes.
18. Si INFOCA falla, Andalucía pierde temporalmente la cobertura directa y la ausencia de datos no se interpreta como ausencia de incendios.
19. INFOCAM continúa identificado como avance provisional no oficial y Extremadura como fuente de actualizaciones sin feed georreferenciado; ninguna se promociona artificialmente a integración directa.
20. PREVIFOC solo asigna un nivel cuando el PDF oficial corresponde al día actual y la localidad cae dentro de su mapa. Nunca se presenta como incendio activo.
21. La Comunitat Valenciana mantiene su cobertura de incidentes en modo visor: el subconjunto publicado por 112CV no se trata como inventario completo ni como feed operativo integrado.
22. Bombers solo incorpora a la situación los registros tipificados como incendios de vegetación forestal; las actuaciones agrícolas y urbanas se conservan separadas en el contrato de la fuente.
23. Una fase explícita de Bombers se traduce de forma literal. Un registro sin fase solo puede mostrarse durante 24 horas como «fase no publicada» y no equivale a incendio activo.
24. Las coordenadas ajenas a Catalunya, los registros antiguos y los elementos sin municipio se descartan antes de calcular distancias locales.
25. INFOAR solo incorpora entradas de la sección oficial de incendios del parte diario vigente. Los estados activo, estabilizado, controlado y extinguido no se reinterpretan.
26. Un parte INFOAR vigente con la sección oficial vacía produce cero registros válidos; la ausencia de esa sección o un parte con más de 36 horas degrada la fuente.
27. La posición de INFOAR procede del centro aproximado del término municipal obtenido mediante IGEAR. Debe conservar la etiqueta de ubicación aproximada y nunca presentarse como origen exacto o perímetro.
28. Si INFOAR deja de responder, la última copia válida puede reutilizarse durante 24 horas con su antigüedad y estado degradado visibles.
29. Galicia solo incorpora bloques interpretables de un parte vigente de la Xunta de Galicia · Medio Rural. El parte es selectivo, habitualmente para incendios que alcanzan 20 hectáreas, y su ausencia no debe producir una conclusión verde o de ausencia de incendios.
30. La posición de los registros gallegos procede del centro municipal de IGN · CartoCiudad. Debe conservar la etiqueta de ubicación aproximada y nunca presentarse como origen, frente o perímetro.
31. Los partes gallegos dejan de alimentar incidentes actuales al superar 36 horas. Una copia válida puede reutilizarse durante 24 horas, siempre identificada como degradada y con su antigüedad visible.
32. Asturias solo incorpora entradas del último parte vigente de incendios forestales del SEPA. Un estado no publicado se conserva como «en seguimiento» y nunca se transforma automáticamente en «activo».
33. La posición de los registros asturianos procede del centro aproximado del concejo obtenido mediante IGN · CartoCiudad. Los incendios fronterizos descritos solo como colaboración con otra comunidad no se incorporan al cálculo local.
34. Los partes asturianos dejan de alimentar incidentes actuales al superar 36 horas. Su ausencia no confirma que no haya incendios y la última copia válida solo puede reutilizarse durante 24 horas con estado degradado visible.
35. Murcia debe figurar como `updates`, no como `integrated`, mientras el alojamiento de producción no pueda consultar de forma estable la fuente oficial de INFOMUR.
36. Ninguna publicación de INFOMUR puede alimentar incidentes, distancias o niveles locales durante este bloqueo; se mantiene únicamente el enlace al organismo.
37. La ausencia de datos murcianos nunca confirma que no existan incendios y debe producir cobertura oficial regional limitada.
38. El parser experimental de INFOMUR puede conservarse y probarse con fixtures, pero reactivarlo exige una validación real desde producción y una fuente `ok: true`.
39. `api/situation.js` se ejecuta en `fra1` para aproximarse a las fuentes institucionales españolas; esta región no debe presentarse como solución al bloqueo de INFOMUR.
40. Cada integración directa conserva su modo declarado, pero solo mantiene el modo efectivo `integrated` si el monitor incluido en `/api/situation` y `/api/health` confirma disponibilidad, contrato válido, antigüedad aceptable y ausencia de fallback.
41. Una fuente no admitida debe cambiar temporalmente a `limited`, establecer `confidenceForAbsence: false` y no puede producir una conclusión verde por silencio.
42. La última situación válida puede recuperarse desde Vercel Runtime Cache durante 24 horas, siempre con `fallback: true`, antigüedad visible y respuesta sin caché pública. No se considera una base de datos permanente.
43. Los fallos de disponibilidad, contrato y antigüedad deben aparecer en el monitor y en los logs estructurados. No se debe afirmar que existen alertas por correo, SMS o mensajería mientras no haya un canal externo configurado.

## Recuperación

Si un despliegue falla:

1. No modificar el dominio con proxies a despliegues protegidos.
2. Restaurar el último despliegue completo y comprobado.
3. Verificar individualmente todos los archivos y API.
4. Corregir el código en GitHub y desplegar de nuevo únicamente cuando CI esté aprobado.
