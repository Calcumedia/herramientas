import { test, expect } from '@playwright/test';

const situation={
  version:'4.18.0',dataEngineVersion:'4.3.1',generatedAt:'2026-07-26T13:05:00.000Z',degraded:false,
  coverage:[
    {id:'test',label:'Fuente de prueba',ok:true,fallback:false,summary:'Activa',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()},
    {id:'infoca',label:'INFOCA Andalucía',scope:'Andalucía',ok:true,fallback:false,summary:'1 vigente',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()},
    {id:'bombers-catalunya',label:'Bombers Catalunya',scope:'Cataluña',ok:true,fallback:false,summary:'1 incendio forestal vigente',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()},
    {id:'infoar-aragon',label:'INFOAR Aragón',scope:'Aragón',ok:true,fallback:false,summary:'1 incendio vigente',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()},
    {id:'xunta-galicia',label:'Medio Rural Galicia',scope:'Galicia',ok:true,fallback:false,summary:'Parte selectivo integrado; no constituye un inventario completo.',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),confidenceForAbsence:false},
    {id:'sepa-asturias',label:'SEPA Asturias',scope:'Principado de Asturias',ok:true,fallback:false,summary:'Parte episódico integrado; no constituye un inventario completo.',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString(),confidenceForAbsence:false}
  ],
  regionalCoverage:[
    {region:'Andalucía',aliases:['Andalucía','Andalucia'],mode:'integrated',sourceLabel:'Agencia de Emergencias de Andalucía · INFOCA',sourceUrl:'https://example.com',description:'Registros oficiales integrados directamente.',ok:true},
    {region:'Cataluña',aliases:['Cataluña','Catalunya'],mode:'integrated',sourceLabel:'Bombers de la Generalitat de Catalunya',sourceUrl:'https://interior.gencat.cat/',description:'Actuaciones oficiales georreferenciadas de incendios forestales integradas directamente.',ok:true},
    {region:'Aragón',aliases:['Aragón','Aragon'],mode:'integrated',sourceLabel:'Gobierno de Aragón · INFOAR',sourceUrl:'https://www.aragon.es/-/nivel-de-alerta-de-peligro-de-incendios-forestales',description:'Parte diario oficial integrado. La posición es el centro aproximado del término municipal, no el origen exacto.',ok:true},
    {region:'Galicia',aliases:['Galicia'],mode:'integrated',sourceLabel:'Xunta de Galicia · Medio Rural',sourceUrl:'https://mediorural.xunta.gal/es/recursos/noticias',description:'Partes oficiales selectivos integrados directamente, habitualmente para incendios que alcanzan 20 hectáreas. La ausencia de un parte no confirma que no existan incendios.',ok:true,confidenceForAbsence:false},
    {region:'Principado de Asturias',aliases:['Asturias','Principado de Asturias'],mode:'integrated',sourceLabel:'112 Asturias · SEPA',sourceUrl:'https://www.112asturias.es/datos-incendios-forestales-asturias',description:'Partes oficiales episódicos integrados directamente. La posición representa el concejo y la ausencia de un parte vigente no confirma que no existan incendios.',ok:true,confidenceForAbsence:false},
    {region:'Región de Murcia',aliases:['Región de Murcia','Region de Murcia','Murcia'],mode:'updates',sourceLabel:'112 Región de Murcia · INFOMUR',sourceUrl:'https://noticias.112rmurcia.es/',description:'Actualizaciones oficiales enlazadas. El feed automatizado está bloqueado y no se usa para confirmar incendios ni calcular la situación local.',ok:false,confidenceForAbsence:false},
    {region:'Comunitat Valenciana',aliases:['Comunitat Valenciana','Comunidad Valenciana','Valenciana'],mode:'viewer',sourceLabel:'112 Comunitat Valenciana · PREVIFOC',sourceUrl:'https://www.112cv.gva.es/WebPublica-MapasOnLineV2/',description:'Nivel preventivo diario PREVIFOC integrado; visor de incidentes sin feed estructurado completo.',ok:false}
  ],
  sourceMonitor:{
    version:'4.18.0',checkedAt:new Date().toISOString(),status:'ok',
    configuredDirectSources:5,admittedDirectSources:5,limitedDirectSources:0,issues:[],
    entries:[],alerting:{runtimeLogs:true,externalNotifications:false},
    persistence:{lastValidSituation:true,storage:'Vercel Runtime Cache',regional:true,durableDatabase:false}
  },
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
    },
    {
      id:'bombers-aiguamurcia',name:'Aiguamúrcia',area:'Catalunya',region:'Cataluña',status:'ACTIVO',statusClass:'active',
      risk:'high',riskLabel:'ALTO',riskScore:620,confidence:'alta',lat:41.38,lon:2.17,directSources:1,
      summary:'Incendi vegetació forestal. Fase oficial: ACTIVO.',publishedAt:'2026-07-28T10:00:00.000Z',receivedAt:'2026-07-28T10:05:00.000Z',
      primaryUrl:'https://interior.gencat.cat/',vegetationType:'Incendi vegetació forestal',
      evidence:[{source:'Bombers de la Generalitat de Catalunya',sourceType:'direct',status:'ACTIVO',publishedAt:'2026-07-28T10:05:00.000Z',url:'https://interior.gencat.cat/'}],
      alerts:[],timeline:[{status:'ACTIVO',at:'2026-07-28T10:05:00.000Z',source:'Bombers · fase consultada'}]
    },
    {
      id:'infoar-h-plan-2026-07-17',name:'Plan',area:'Huesca, Aragón',region:'Aragón',status:'ACTIVO',statusClass:'active',
      risk:'high',riskLabel:'ALTO',riskScore:630,confidence:'media',sourceConfidence:'alta',lat:42.55,lon:.31,directSources:1,
      locationApproximate:true,locationConfidence:'municipality',
      summary:'ACTIVO. Parte diario oficial INFOAR. La posición representa aproximadamente el centro del término municipal, no el origen exacto del incendio.',
      publishedAt:'2026-07-28T07:48:53.000Z',receivedAt:'2026-07-28T10:05:00.000Z',
      primaryUrl:'https://infoar.aragon.es/flamabk/indicesMeteo/napif-pdf/download',
      evidence:[{source:'Gobierno de Aragón · INFOAR',sourceType:'direct',status:'ACTIVO',publishedAt:'2026-07-28T07:48:53.000Z',url:'https://infoar.aragon.es/flamabk/indicesMeteo/napif-pdf/download'}],
      alerts:[],timeline:[{status:'ACTIVO',at:'2026-07-28T07:48:53.000Z',source:'INFOAR · parte diario'}]
    },
    {
      id:'xunta-galicia-a-capela',name:'A Capela',area:'A Coruña, Galicia',region:'Galicia',status:'ACTIVO',statusClass:'active',
      risk:'high',riskLabel:'ALTO',riskScore:620,confidence:'media',sourceConfidence:'alta',lat:43.444947,lon:-8.041097,directSources:1,
      locationApproximate:true,locationConfidence:'municipality',
      summary:'ACTIVO. Parte oficial selectivo de Medio Rural. La posición representa el municipio, no el origen, frente ni perímetro.',
      publishedAt:'2026-07-28T11:30:00.000Z',receivedAt:'2026-07-28T11:35:00.000Z',
      primaryUrl:'https://mediorural.xunta.gal/es/recursos/noticias/parte',
      evidence:[{source:'Xunta de Galicia · Medio Rural',sourceType:'direct',status:'ACTIVO',publishedAt:'2026-07-28T11:30:00.000Z',url:'https://mediorural.xunta.gal/es/recursos/noticias/parte'}],
      alerts:[],timeline:[{status:'ACTIVO',at:'2026-07-28T11:30:00.000Z',source:'Medio Rural · parte de situación'}]
    },
    {
      id:'sepa-asturias-allande',name:'Allande · Pico Hospital',area:'Asturias, Principado de Asturias',region:'Principado de Asturias',status:'ESTABILIZADO',statusClass:'stabilized',
      risk:'medium',riskLabel:'MEDIO',riskScore:340,confidence:'alta',sourceConfidence:'alta',lat:43.2704,lon:-6.6117,directSources:1,
      locationApproximate:true,locationConfidence:'municipality',
      summary:'ESTABILIZADO en Pico Hospital. Parte oficial del SEPA. La posición representa el concejo, no el origen, frente ni perímetro.',
      publishedAt:'2026-07-28T11:40:00.000Z',receivedAt:'2026-07-28T11:45:00.000Z',
      primaryUrl:'https://www.112asturias.es/datos-incendios-forestales-asturias',
      evidence:[{source:'112 Asturias · SEPA',sourceType:'direct',status:'ESTABILIZADO',publishedAt:'2026-07-28T11:40:00.000Z',url:'https://www.112asturias.es/datos-incendios-forestales-asturias'}],
      alerts:[],timeline:[{status:'ESTABILIZADO',at:'2026-07-28T11:40:00.000Z',source:'SEPA · parte de incendios forestales'}]
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
const valencia={id:'2',name:'València',displayName:'València, València, Comunitat Valenciana, España',lat:39.4699,lon:-0.3763,region:'Comunitat Valenciana',placeType:'city',category:'place'};
const vigo={id:'3',name:'Vigo',displayName:'Vigo, Pontevedra, Galicia, España',lat:42.2406,lon:-8.7207,region:'Galicia',placeType:'city',category:'place'};
const oviedo={id:'4',name:'Oviedo',displayName:'Oviedo, Asturias, Principado de Asturias, España',lat:43.3619,lon:-5.8494,region:'Principado de Asturias',placeType:'city',category:'place'};
const moratalla={id:'5',name:'Moratalla',displayName:'Moratalla, Murcia, Región de Murcia, España',lat:38.1898,lon:-1.8916,region:'Región de Murcia',placeType:'town',category:'place'};
const danger={
  version:'4.18.0',source:'AEMET',attribution:'© AEMET',area:'PB',areaLabel:'Península y Baleares',configured:true,
  viewerUrl:'https://www.aemet.es/es/eltiempo/prediccion/incendios',
  helpUrl:'https://www.aemet.es/es/eltiempo/prediccion/incendios/ayuda',
  levels:['Muy bajo','Bajo','Moderado','Alto','Muy alto','Extremo'],resolutionKm:1,
  updatedDaily:true,exactLocalLevel:true,retrievedAt:'2026-07-27T09:00:00Z',
  validityNote:'El producto representa el máximo peligro diario, alrededor de las 12 UTC. No confirma que exista un incendio.',
  today:{validFor:'2026-07-27',officialImageUrl:'https://www.aemet.es/mapa-hoy.png',localLevel:{value:6,label:'Extremo',rgba:[245,35,0,255]}},
  tomorrow:{validFor:'2026-07-28',officialImageUrl:'https://www.aemet.es/mapa-manana.png',localLevel:{value:5,label:'Muy alto',rgba:[239,133,4,255]}}
};
const weather={
  version:'4.18.0',source:'Open-Meteo',sourceUrl:'https://open-meteo.com/en/docs',degraded:false,
  current:{temperatureC:31,relativeHumidity:24,windSpeedKmh:18,windDirectionDeg:225,windGustKmh:33},
  next24Hours:{maxWindSpeedKmh:27,maxWindGustKmh:49}
};
const airQuality={
  version:'4.18.0',source:'MITECO · Índice Nacional de Calidad del Aire',officialDataset:true,
  provisional:true,validated:false,radiusKm:100,retrievedAt:'2026-07-27T10:10:00Z',nearbyCount:3,
  nearest:{
    code:'11001001',name:'JEREZ-CHAPÍN',stationType:'FONDO',lat:36.69,lon:-6.12,
    distanceKm:2.1,measuredAt:'2026-07-27T10:00:00Z',index:4,indexRaw:40,
    categoryKey:'unfavourable',categoryLabel:'Desfavorable',limitedPollutants:true,dueTo:['PM10','PM2.5']
  },
  stations:[],
  viewerUrl:'https://ica.miteco.es/',
  coverageNote:'Datos horarios provisionales y no validados comunicados por las redes de vigilancia.',
  fireRelationshipNote:'El ICA mide contaminación atmosférica. FuegoCerca no atribuye su resultado al humo de un incendio sin una confirmación específica de la autoridad.'
};
const roads={
  version:'4.18.0',source:'DGT',format:'DATEX II 3.7',official:true,radiusKm:50,
  publicationTime:'2026-07-27T10:05:00Z',retrievedAt:'2026-07-27T10:06:00Z',
  nearbyCount:8,closuresCount:1,
  incidents:[{
    id:'dgt-close-a4',type:'roadClosed',typeLabel:'Carretera cortada',severity:'closed',
    road:'A-4',municipality:'Jerez de la Frontera',province:'Cádiz',kilometerFrom:636,kilometerTo:636,
    distanceKm:2.4,updatedAt:'2026-07-27T10:02:00Z'
  },...Array.from({length:7},(_,index)=>({
    id:`dgt-test-${index}`,type:'accident',typeLabel:'Accidente',severity:'info',
    road:`CA-${index+1}`,municipality:'Jerez de la Frontera',province:'Cádiz',
    kilometerFrom:index+1,kilometerTo:index+1,distanceKm:5+index,updatedAt:'2026-07-27T10:01:00Z'
  }))],
  coverageNote:'Red estatal de carreteras, excepto Cataluña y País Vasco. Una ausencia de registros no garantiza que todas las vías estén abiertas.',
  relationshipNote:'La DGT no siempre indica si una incidencia está relacionada con un incendio.'
};
const perimeters={
  version:'4.18.0',source:'EFFIS · Copernicus EMS',official:false,radiusKm:100,
  retrievedAt:'2026-07-27T10:08:00Z',nearbyCount:2,cacheStatus:'runtime',usingStaleCache:false,
  refreshing:false,persistentCache:true,processingMs:14,
  perimeters:[
    {
      id:'effis-near',source:'EFFIS · Copernicus EMS',sourceType:'perímetro satelital de área quemada',
      areaHa:482.4,fireDate:'2026-07-24T12:00:00Z',updatedAt:'2026-07-27T09:00:00Z',
      ageHours:2,ageCategory:'recent',ageLabel:'Producto actualizado en las últimas 72 h',associationStatus:'not-linked',
      province:'Cádiz',municipality:'Jerez de la Frontera',distanceToEdgeKm:3.2,containsLocality:false,
      geometry:{type:'Polygon',coordinates:[[[-6.18,36.70],[-6.15,36.70],[-6.15,36.73],[-6.18,36.73],[-6.18,36.70]]]}
    },
    {
      id:'effis-second',source:'EFFIS · Copernicus EMS',sourceType:'perímetro satelital de área quemada',
      areaHa:95,fireDate:'2026-07-25T12:00:00Z',updatedAt:'2026-07-27T08:00:00Z',
      ageHours:240,ageCategory:'old',ageLabel:'Perímetro histórico reciente',associationStatus:'not-linked',
      province:'Cádiz',municipality:'Arcos de la Frontera',distanceToEdgeKm:22.8,containsLocality:false,
      geometry:{type:'Polygon',coordinates:[[[-5.9,36.70],[-5.88,36.70],[-5.88,36.72],[-5.9,36.72],[-5.9,36.70]]]}
    }
  ],
  coverageNote:'EFFIS cartografía áreas quemadas mediante satélite. No representa el frente de llama en tiempo real.',
  associationNote:'FuegoCerca no asocia automáticamente estos perímetros a incendios oficiales sin una coincidencia espacial y temporal verificable.'
};
const previfoc={
  version:'4.18.0',ok:true,official:true,source:'112 Comunitat Valenciana · PREVIFOC',
  sourceMode:'PDF oficial diario',validFor:'2026-07-28',current:true,applicable:true,degraded:false,
  level:{value:3,label:'Riesgo extremo',tone:'extreme'},
  pdfUrl:'https://wpr.112cv.gva.es/external/api/storage/descargar/pdf/previfoc/previfoc.pdf',
  viewerUrl:'https://www.112cv.gva.es/WebPublica-MapasOnLineV2/municipiosPrevifoc.jsf',
  incidentViewerUrl:'https://www.112cv.gva.es/WebPublica-MapasOnLineV2/incidentes.jsf',
  method:'Muestreo aproximado del mapa oficial PREVIFOC',approximateResolutionKm:.72,
  validityNote:'Nivel preventivo oficial válido para hoy. No confirma que exista un incendio.',
  incidentCoverageNote:'El visor de incidentes 112CV publica un subconjunto de incidentes relevantes en curso con localización aproximada. FuegoCerca lo enlaza, pero no lo usa como un feed completo para confirmar incendios activos.'
};

async function mockApis(page){
  await page.route('**/api/situation**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(situation)}));
  await page.route('**/api/geocode**',route=>{
    const query=new URL(route.request().url()).searchParams.get('q')||'';
    const normalized=query.toLocaleLowerCase('es');
    const result=normalized.includes('val')?valencia:normalized.includes('vig')?vigo:normalized.includes('ovi')?oviedo:normalized.includes('mor')?moratalla:jerez;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[result]})});
  });
  await page.route('**/api/reverse-geocode**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:jerez})}));
  await page.route('**/api/fire-danger**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(danger)}));
  await page.route('**/api/previfoc**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(previfoc)}));
  await page.route('**/api/fire-perimeters**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(perimeters)}));
  await page.route('**/api/road-incidents**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(roads)}));
  await page.route('**/api/air-quality**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(airQuality)}));
  await page.route('**/api/weather**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(weather)}));
  await page.route('**/api/health**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',version:'4.18.0',brand:'FuegoCerca'})}));
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
  const [toolsBox,preventionBox]=await Promise.all([
    page.locator('.v46Tools').boundingBox(),
    page.locator('#preventionPanel').boundingBox()
  ]);
  expect(toolsBox).not.toBeNull();
  expect(preventionBox).not.toBeNull();
  expect(Math.abs(preventionBox.width-toolsBox.width)).toBeLessThanOrEqual(1);
  await expect(page.locator('#preventionStatus')).toContainText('AEMET');
  await expect(page.locator('#preventionStatus')).toContainText('Jerez de la Frontera');
  await expect(page.locator('#preventionStatus')).toContainText('Producto oficial disponible');
  await expect(page.locator('#preventionStatus')).toContainText('Hoy');
  await expect(page.locator('#preventionStatus')).toContainText('Mañana');
  await expect(page.locator('#preventionStatus')).toContainText('Muy alto');
  await expect(page.locator('#preventionStatus')).toContainText('No confirma un incendio');
  await expect(page.locator('#preventionStatus')).toContainText('Extremo');
  await expect(page.locator('#preventionStatus')).toContainText('píxel de 1 km');
  await expect(page.locator('#aemetDangerLink')).toHaveAttribute('href',/aemet\.es/);
});

test('PREVIFOC aparece solo en una localidad valenciana y no se presenta como incendio',async({page})=>{
  const input=page.locator('#placeQuery');
  await input.fill('València');
  await page.locator('#placeSearch').click();
  await expect(page.locator('[data-pick]')).toContainText('València');
  await page.locator('[data-pick]').click();
  const panel=page.locator('#previfocStatus');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('112 COMUNITAT VALENCIANA · PREVIFOC');
  await expect(panel).toContainText('Nivel 3 · Riesgo extremo');
  await expect(panel).toContainText('No confirma un incendio activo');
  await expect(panel).toContainText('separado del cálculo AEMET');
  await expect(panel).toContainText('subconjunto de incidentes relevantes');
  await expect(panel).toContainText('no lo usa como un feed completo');
  await expect(panel.locator('a')).toHaveCount(2);
  await expect(page.locator('#preventionStatus')).toContainText('AEMET');
});

test('MITECO muestra la calidad del aire sin atribuirla a un incendio',async({page})=>{
  await consultJerez(page);
  const airPanel=page.locator('#localAirStatus');
  const airSection=page.locator('.airPanel');
  const contextPanel=page.locator('#localContextPanel');
  await expect(airPanel).toContainText('Desfavorable');
  await expect(airPanel).toContainText('JEREZ-CHAPÍN');
  await expect(airPanel).toContainText('2.1 km hasta la estación');
  await expect(airPanel).toContainText('PM10, PM2.5');
  await expect(airPanel).toContainText('Calculado con menos contaminantes');
  await expect(airPanel).toContainText('No confirma humo de un incendio');
  await expect(airPanel).toContainText('no es una medición exacta');
  await expect(page.locator('.airLevel')).toHaveClass(/unfavourable/);
  const [airBox,contextBox]=await Promise.all([airSection.boundingBox(),contextPanel.boundingBox()]);
  expect(airBox).not.toBeNull();
  expect(contextBox).not.toBeNull();
  expect(airBox.width).toBeGreaterThan(contextBox.width-30);
});

test('DGT prioriza tres incidencias y permite desplegar el resto',async({page})=>{
  await consultJerez(page);
  const roadsPanel=page.locator('#localRoadStatus');
  await expect(roadsPanel).toContainText('8 incidencias DGT en 50 km');
  await expect(roadsPanel).toContainText('1 cortes');
  await expect(roadsPanel).toContainText('Carretera cortada');
  await expect(roadsPanel).toContainText('A-4');
  await expect(roadsPanel).toContainText('2.4 km');
  await expect(roadsPanel).toContainText('km 636');
  await expect(roadsPanel).toContainText('excepto Cataluña y País Vasco');
  await expect(roadsPanel).toContainText('no siempre indica si una incidencia está relacionada con un incendio');
  await expect(roadsPanel.locator('.roadIncident:visible')).toHaveCount(3);
  await expect(roadsPanel.locator('[data-road-toggle]')).toContainText('Ver las 8 incidencias priorizadas');
  await roadsPanel.locator('[data-road-toggle]').click();
  await expect(roadsPanel.locator('.roadIncident:visible')).toHaveCount(8);
  await expect(roadsPanel.locator('[data-road-toggle]')).toContainText('Mostrar solo las 3');
});

test('EFFIS muestra antigüedad y permite ocultar perímetros sin tratarlos como fuego activo',async({page},testInfo)=>{
  await consultJerez(page);
  const panel=page.locator('#localPerimeterStatus');
  await expect(panel).toContainText('Área quemada más próxima');
  await expect(panel).toContainText('3.2 km al borde');
  await expect(panel).toContainText('482 ha');
  await expect(panel).toContainText('Producto actualizado en las últimas 72 h');
  await expect(panel).toContainText('distancia desde Jerez de la Frontera hasta el borde');
  await expect(panel).toContainText('No es un incendio activo ni el frente de llama');
  await expect(panel).toContainText('no asocia automáticamente');
  await expect(panel).toContainText('1 área cartografiada adicional');
  await expect(panel).toHaveAttribute('data-cache-status','runtime');
  await expect(panel).toHaveAttribute('data-processing-ms','14');
  await expect.poll(()=>page.evaluate(()=>window.FC46.getPerimeterLayerCount())).toBe(2);
  await showMapOnMobile(page,testInfo);
  const toggle=page.locator('#perimeterToggle');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
  await expect.poll(()=>page.evaluate(()=>window.FC46.isPerimeterLayerVisible())).toBe(true);
  await toggle.uncheck();
  await expect.poll(()=>page.evaluate(()=>window.FC46.isPerimeterLayerVisible())).toBe(false);
  await toggle.check();
  await expect.poll(()=>page.evaluate(()=>window.FC46.isPerimeterLayerVisible())).toBe(true);
});

test('EFFIS identifica una copia guardada mientras se actualiza en segundo plano',async({page})=>{
  await page.route('**/api/fire-perimeters**',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({...perimeters,cacheStatus:'runtime-stale',usingStaleCache:true,refreshing:true})
  }));
  await consultJerez(page);
  const panel=page.locator('#localPerimeterStatus');
  await expect(panel).toContainText('Mostrando la última copia válida');
  await expect(panel).toContainText('EFFIS se está actualizando en segundo plano');
  await expect(panel).toHaveAttribute('data-cache-status','runtime-stale');
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

test('Andalucía aparece con INFOCA integrado en la cobertura regional',async({page})=>{
  await consultJerez(page);
  await expect(page.locator('#localReport')).toContainText('Cobertura oficial regional');
  await expect(page.locator('#localReport')).toContainText('Agencia de Emergencias de Andalucía · INFOCA integrada');
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('INFOCA Andalucía');
  await expect(sources).toContainText('DATOS INTEGRADOS');
});

test('el panel de fuentes explica admisión, incidencias y persistencia sin prometer alertas externas',async({page})=>{
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('Control de fuentes directas');
  await expect(sources).toContainText('5');
  await expect(sources).toContainText('admitidas en producción');
  await expect(sources).toContainText('integraciones configuradas');
  await expect(sources).toContainText('No hay avisos externos por correo o SMS');
  await expect(sources).toContainText('caché regional, no una base de datos permanente');
  await expect(sources.locator('a[href="/api/health"]')).toContainText('Abrir monitor y estado técnico');
});

test('Cataluña muestra las actuaciones forestales de Bombers como fuente oficial directa',async({page})=>{
  await page.locator('#tab-incidents').click();
  const incidents=page.locator('#incidents');
  await expect(incidents).toContainText('Aiguamúrcia');
  await expect(incidents).toContainText('ACTIVO');
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('Bombers Catalunya');
  await expect(sources).toContainText('Bombers de la Generalitat de Catalunya');
  await expect(sources).toContainText('Actuaciones oficiales georreferenciadas');
});

test('Aragón muestra el parte INFOAR y distingue la ubicación municipal aproximada',async({page})=>{
  await page.locator('#tab-incidents').click();
  const incidents=page.locator('#incidents');
  await expect(incidents).toContainText('Plan');
  await expect(incidents).toContainText('ACTIVO');
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('INFOAR Aragón');
  await expect(sources).toContainText('Gobierno de Aragón · INFOAR');
  await expect(sources).toContainText('centro aproximado del término municipal');
  await expect(sources).toContainText('DATOS INTEGRADOS');
});

test('Galicia integra partes selectivos sin convertir su ausencia en un resultado verde',async({page})=>{
  await page.locator('#placeQuery').fill('Vigo');
  await page.locator('#placeSearch').click();
  await expect(page.locator('[data-pick]')).toContainText('Vigo');
  await page.locator('[data-pick]').click();
  const report=page.locator('#localReport');
  await expect(report).toContainText('Vigo');
  await expect(report).toContainText('Cobertura limitada');
  await expect(report).not.toContainText('SIN RIESGO DETECTADO');
  await expect(report).toContainText('publica solo una parte de los incendios');
  await expect(report).toContainText('20 hectáreas');
  await page.locator('#tab-incidents').click();
  await expect(page.locator('#incidents')).toContainText('A Capela');
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('Medio Rural Galicia');
  await expect(sources).toContainText('Xunta de Galicia · Medio Rural');
  await expect(sources).toContainText('DATOS INTEGRADOS');
});

test('Asturias integra los partes del SEPA sin interpretar su ausencia como seguridad',async({page})=>{
  await page.locator('#placeQuery').fill('Oviedo');
  await page.locator('#placeSearch').click();
  await expect(page.locator('[data-pick]')).toContainText('Oviedo');
  await page.locator('[data-pick]').click();
  const report=page.locator('#localReport');
  await expect(report).toContainText('Oviedo');
  await expect(report).toContainText('Cobertura oficial regional limitada');
  await expect(report).not.toContainText('SIN RIESGO DETECTADO');
  await expect(report).toContainText('la ausencia de un parte vigente no confirma que no existan incendios');
  await page.locator('#tab-incidents').click();
  await expect(page.locator('#incidents')).toContainText('Allande · Pico Hospital');
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('SEPA Asturias');
  await expect(sources).toContainText('112 Asturias · SEPA');
  await expect(sources).toContainText('DATOS INTEGRADOS');
});

test('Murcia enlaza INFOMUR sin presentar el feed bloqueado como integración directa',async({page})=>{
  await page.locator('#placeQuery').fill('Moratalla');
  await page.locator('#placeSearch').click();
  await expect(page.locator('[data-pick]')).toContainText('Moratalla');
  await page.locator('[data-pick]').click();
  const report=page.locator('#localReport');
  await expect(report).toContainText('Moratalla');
  await expect(report).toContainText('Cobertura limitada');
  await expect(report).not.toContainText('SIN RIESGO DETECTADO');
  await expect(report).toContainText('no se usa para confirmar incendios');
  await page.locator('#tab-incidents').click();
  await expect(page.locator('#incidents')).not.toContainText('Moratalla · Alto de Vinateros');
  await page.locator('#tab-sources').click();
  const sources=page.locator('#sources');
  await expect(sources).toContainText('112 Región de Murcia · INFOMUR');
  await expect(sources).toContainText('ACTUALIZACIONES');
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
