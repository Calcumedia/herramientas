import { test, expect } from '@playwright/test';

const situation={
  version:'4.7.0',dataEngineVersion:'4.3.1',generatedAt:'2026-07-26T13:05:00.000Z',degraded:false,
  coverage:[{id:'test',label:'Fuente de prueba',ok:true,fallback:false,summary:'Activa',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()}],
  regionalCoverage:[{region:'Andalucía',aliases:['Andalucía','Andalucia'],mode:'viewer',sourceLabel:'INFOCA',sourceUrl:'https://example.com',description:'Visor oficial identificado.',ok:false}],
  incidents:[
    {
      id:'test-fire',name:'Incendio oficial de prueba',area:'Cádiz',status:'ACTIVO',statusClass:'active',
      risk:'high',riskLabel:'ALTA',confidence:'media',lat:36.7,lon:-6.1,directSources:1,
      summary:'Incidente oficial de prueba.',publishedAt:'2026-07-26T13:00:00.000Z',receivedAt:'2026-07-26T13:01:00.000Z',
      primarySource:'112 Andalucía',primaryUrl:'https://example.com/fire',
      evidence:[{source:'INFOCA',sourceType:'oficial',status:'NIVEL 1',publishedAt:'2026-07-26T11:00:00.000Z',url:'https://example.com/evidence'}],
      alerts:[{type:'EVACUACIÓN PREVENTIVA',text:'Aviso de prueba',source:'112 Andalucía',publishedAt:'2026-07-26T12:30:00.000Z'}],
      timeline:[
        {status:'ACTIVO',at:'2026-07-26T12:00:00.000Z',source:'INFOCA'},
        {status:'DECLARADO',at:'2026-07-26T10:00:00.000Z',source:'112 Andalucía'}
      ]
    },
    {
      id:'test-preliminary',name:'Señal preliminar de prueba',area:'Cádiz',status:'SIN CONFIRMAR',statusClass:'unconfirmed',
      risk:'watch',riskLabel:'VIGILANCIA',confidence:'baja',lat:36.82,lon:-6.18,directSources:0,
      summary:'Señal preliminar de prueba.',publishedAt:'2026-07-26T12:15:00.000Z',receivedAt:'2026-07-26T12:16:00.000Z',
      evidence:[],alerts:[],timeline:[]
    }
  ],
  archive:[],alerts:[],thermalSignals:[{
    id:'test-thermal',name:'Grupo térmico de prueba',area:'Cádiz',lat:36.6,lon:-6.02,count:4,
    publishedAt:'2026-07-26T12:20:00.000Z',url:'https://example.com/thermal'
  }],news:[
    {title:'Comunicado oficial sobre el incendio',source:'112 Andalucía',publishedAt:new Date().toISOString(),url:'https://example.com/official'},
    {title:'Comunicado oficial sobre el incendio hoy',source:'facebook.com',publishedAt:new Date().toISOString(),url:'https://example.com/social'}
  ]
};
const jerez={id:'1',name:'Jerez de la Frontera',displayName:'Jerez de la Frontera, Cádiz, Andalucía, España',lat:36.6817,lon:-6.1372,region:'Andalucía',placeType:'city',category:'place'};
const danger={
  version:'4.7.0',source:'AEMET',attribution:'© AEMET',area:'p',configured:false,
  viewerUrl:'https://www.aemet.es/es/eltiempo/prediccion/incendios',
  helpUrl:'https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda',
  levels:['Muy bajo','Bajo','Moderado','Alto','Muy alto','Extremo'],resolutionKm:1,
  updatedDaily:true,exactLocalLevel:false,estimated:null,tomorrow:null,
  message:'La integración automática necesita una API Key de AEMET. El visor oficial sigue disponible.'
};
const weather={
  version:'4.7.0',source:'Open-Meteo',sourceUrl:'https://open-meteo.com/en/docs',degraded:false,
  current:{temperatureC:31,relativeHumidity:24,windSpeedKmh:18,windDirectionDeg:225,windGustKmh:33},
  next24Hours:{maxWindSpeedKmh:27,maxWindGustKmh:49}
};

async function mockApis(page){
  await page.route('**/api/situation**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(situation)}));
  await page.route('**/api/geocode**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[jerez]})}));
  await page.route('**/api/reverse-geocode**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:jerez})}));
  await page.route('**/api/fire-danger**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(danger)}));
  await page.route('**/api/weather**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weather)}));
  await page.route('**/api/health**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',version:'4.7.0',brand:'FuegoCerca'})}));
}

async function showMapOnMobile(page,testInfo){
  if(testInfo.project.name.includes('mobile')){
    await page.locator('[data-mobile-view="map"]').click();
    await page.waitForTimeout(100);
  }
}
async function showReportOnMobile(page,testInfo){
  if(testInfo.project.name.includes('mobile'))await page.locator('[data-mobile-view="report"]').click();
}
async function initialViewIsRestored(page){
  return page.evaluate(()=>{
    const map=window.__FC_MAP__;
    return map.getZoom()===6&&map.getBounds().contains([40.4167,-3.7033]);
  });
}
async function consultJerez(page){
  const input=page.locator('#placeQuery');
  await input.fill('Jerez');
  await page.locator('#placeSearch').click();
  await expect(page.locator('[data-pick]')).toContainText('Jerez de la Frontera');
  await page.locator('[data-pick]').click();
  await expect(page.locator('#localReport')).toContainText('Jerez de la Frontera');
  await expect(page.locator('#smartLocalPanel')).toBeVisible();
}

test.beforeEach(async ({page})=>{
  await mockApis(page);
  await page.goto('/');
  await expect(page.locator('#placeQuery')).toBeEditable();
  await page.waitForFunction(()=>Boolean(window.__FC_MAP__&&window.FC46));
});

test('busca una localidad y vuelve al centro al borrar',async({page},testInfo)=>{
  await consultJerez(page);
  await showMapOnMobile(page,testInfo);
  const searched=await page.evaluate(()=>{const c=window.__FC_MAP__.getCenter();return {lat:c.lat,zoom:window.__FC_MAP__.getZoom()}});
  expect(Math.abs(searched.lat-36.6817)).toBeLessThan(.1);
  expect(searched.zoom).toBe(10);
  await showReportOnMobile(page,testInfo);
  await page.locator('#placeQuery').fill('');
  await expect(page.locator('#placeResults')).toBeEmpty();
  await showMapOnMobile(page,testInfo);
  await expect.poll(()=>initialViewIsRestored(page)).toBe(true);
});

test('el botón de vista inicial restaura el mapa',async({page},testInfo)=>{
  await showMapOnMobile(page,testInfo);
  await page.evaluate(()=>window.__FC_MAP__.setView([36.7,-6.1],12));
  await page.locator('#homeBtn').click();
  await expect.poll(()=>initialViewIsRestored(page)).toBe(true);
});

test('mi ubicación genera una consulta local',async({context,page},testInfo)=>{
  await showMapOnMobile(page,testInfo);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:36.6817,longitude:-6.1372});
  await page.locator('#locateBtn').click();
  await expect(page.locator('#localReport')).toContainText('Jerez de la Frontera',{timeout:12000});
  await expect(page.locator('#locationNotice')).toContainText(/Mostrando el informe|Ubicación obtenida/);
});

test('AEMET se muestra como prevención y no como incendio confirmado',async({page})=>{
  await consultJerez(page);
  await expect(page.locator('#preventionStatus')).toContainText('AEMET');
  await expect(page.locator('#preventionStatus')).toContainText('Jerez de la Frontera');
  await expect(page.locator('#preventionStatus')).toContainText('Integración automática pendiente de credencial');
  await expect(page.locator('#preventionStatus')).toContainText('No confirma un incendio');
  await expect(page.locator('#preventionStatus')).toContainText('Extremo');
  await expect(page.locator('#aemetDangerLink')).toHaveAttribute('href',/aemet\.es/);
});

test('la ficha local inteligente separa distancias, atención no oficial y cronología',async({page})=>{
  await consultJerez(page);
  const panel=page.locator('#smartLocalPanel');
  await expect(panel).toContainText('ORIENTACIÓN CALCULADA POR FUEGOCERCA');
  await expect(panel).toContainText('Atención alta');
  await expect(panel).toContainText('No es un nivel oficial');
  await expect(panel).toContainText('no equivale al riesgo de incendio');

  const official=panel.locator('.smartDistance.official');
  const preliminary=panel.locator('.smartDistance.preliminary');
  const thermal=panel.locator('.smartDistance.thermal');
  await expect(official).toContainText('Incidente oficial más próximo');
  await expect(official).toContainText('Incendio oficial de prueba');
  await expect(official).toContainText(/\d+\.\d km/);
  await expect(preliminary).toContainText('Señal preliminar más próxima');
  await expect(preliminary).toContainText('Señal preliminar de prueba');
  await expect(preliminary).toContainText(/\d+\.\d km/);
  await expect(thermal).toContainText('Señal térmica más próxima');
  await expect(thermal).toContainText('Grupo térmico de prueba');
  await expect(thermal).toContainText(/\d+\.\d km/);
  await expect(panel).toContainText('no son distancias al perímetro');

  const timeline=panel.locator('.smartTimeline');
  await expect(timeline).toContainText('Estado publicado: ACTIVO');
  await expect(timeline).toContainText('EVACUACIÓN PREVENTIVA');
  await expect(timeline).toContainText('NIVEL 1');
  await expect(timeline).toContainText('DECLARADO');
  const timestamps=await timeline.locator('[data-timeline-at]').evaluateAll(nodes=>nodes.map(node=>Date.parse(node.dataset.timelineAt)));
  expect(timestamps.length).toBeGreaterThanOrEqual(4);
  expect(timestamps.every((value,index)=>index===0||timestamps[index-1]>=value)).toBe(true);

  const nearestLabelCount=await page.locator('#localReport').evaluate(node=>(node.textContent.match(/Incidente oficial más próximo/g)||[]).length);
  expect(nearestLabelCount).toBe(1);
});

test('guarda y recupera una localidad desde consultas recientes',async({page})=>{
  await consultJerez(page);
  await expect(page.locator('#recentPlaces')).toContainText('Jerez de la Frontera');
  await page.reload();
  await page.waitForFunction(()=>Boolean(window.__FC_MAP__&&window.FC46));
  await expect(page.locator('#recentPlaces')).toContainText('Jerez de la Frontera');
  await page.locator('#recentPlaces [data-history]').click();
  await expect(page.locator('#localReport')).toContainText('Jerez de la Frontera',{timeout:10000});
});

test('compartir usa un fallback seguro de portapapeles',async({page})=>{
  await consultJerez(page);
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__sharedText=text}},configurable:true});
  });
  await page.locator('#shareReportBtn').click();
  await expect(page.locator('#shareFeedback')).toContainText('Informe y enlace copiados');
  const text=await page.evaluate(()=>window.__sharedText);
  expect(text).toContain('Jerez de la Frontera');
  expect(text).toContain('ES-Alert, 112');
});

test('offline identifica claramente la antigüedad y recupera la última copia',async({context,page})=>{
  await consultJerez(page);
  await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('fc_last_snapshot_v47')))).toBe(true);
  await context.setOffline(true);
  await page.evaluate(()=>{document.querySelector('#localReport').innerHTML='';window.FC46.setOfflineState()});
  await expect(page.locator('#offlineSnapshotNotice')).toHaveClass(/on/);
  await expect(page.locator('#offlineSnapshotNotice')).toContainText('Puede estar desactualizada');
  await expect(page.locator('#localReport')).toContainText('Jerez de la Frontera');
});

test('las pestañas funcionan con teclado',async({page})=>{
  await page.locator('#tab-places').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-incidents')).toBeFocused();
  await expect(page.locator('#tab-incidents')).toHaveAttribute('aria-selected','true');
});

test('la vista móvil alterna mapa e informe',async({page},testInfo)=>{
  test.skip(!testInfo.project.name.includes('mobile'),'Solo se valida en el proyecto móvil');
  await page.locator('[data-mobile-view="map"]').click();
  await expect(page.locator('.shell')).toHaveClass(/mobile-map/);
  await expect(page.locator('.mapWrap')).toBeVisible();
  await page.locator('[data-mobile-view="report"]').click();
  await expect(page.locator('.shell')).toHaveClass(/mobile-report/);
  await expect(page.locator('.panel')).toBeVisible();
});
