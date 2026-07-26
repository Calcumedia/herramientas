import { test, expect } from '@playwright/test';

const situation={
  version:'4.5.0',generatedAt:new Date().toISOString(),degraded:false,
  coverage:[{id:'test',label:'Fuente de prueba',ok:true,fallback:false,summary:'Activa',receivedAt:new Date().toISOString(),lastSuccessAt:new Date().toISOString()}],
  regionalCoverage:[{region:'Andalucía',aliases:['Andalucía','Andalucia'],mode:'viewer',sourceLabel:'INFOCA',sourceUrl:'https://example.com',description:'Visor oficial identificado.',ok:false}],
  incidents:[{id:'test-fire',name:'Incendio de prueba',area:'Cádiz',status:'ACTIVO',statusClass:'active',risk:'high',riskLabel:'ALTA',confidence:'media',lat:36.7,lon:-6.1,directSources:1,summary:'Incidente de prueba.',publishedAt:new Date().toISOString(),receivedAt:new Date().toISOString(),evidence:[],alerts:[],timeline:[]}],
  archive:[],alerts:[],thermalSignals:[],news:[
    {title:'Comunicado oficial sobre el incendio',source:'112 Andalucía',publishedAt:new Date().toISOString(),url:'https://example.com/official'},
    {title:'Comunicado oficial sobre el incendio hoy',source:'facebook.com',publishedAt:new Date().toISOString(),url:'https://example.com/social'}
  ]
};
const jerez={id:'1',name:'Jerez de la Frontera',displayName:'Jerez de la Frontera, Cádiz, Andalucía, España',lat:36.6817,lon:-6.1372,region:'Andalucía',placeType:'city',category:'place'};

async function mockApis(page){
  await page.route('**/api/situation**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(situation)}));
  await page.route('**/api/geocode**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[jerez]})}));
  await page.route('**/api/reverse-geocode**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:jerez})}));
  await page.route('**/api/health**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok'})}));
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

test.beforeEach(async ({page})=>{
  await mockApis(page);
  await page.goto('/');
  await expect(page.locator('#placeQuery')).toBeEditable();
  await page.waitForFunction(()=>Boolean(window.__FC_MAP__));
});

test('busca una localidad y vuelve al centro al borrar',async({page},testInfo)=>{
  const input=page.locator('#placeQuery');
  await input.fill('Jerez');
  await page.locator('#placeSearch').click();
  await expect(page.locator('[data-pick]')).toContainText('Jerez de la Frontera');
  await page.locator('[data-pick]').click();
  await expect(page.locator('#localReport')).toContainText('Jerez de la Frontera');

  await showMapOnMobile(page,testInfo);
  const searched=await page.evaluate(()=>{const c=window.__FC_MAP__.getCenter();return {lat:c.lat,zoom:window.__FC_MAP__.getZoom()}});
  expect(Math.abs(searched.lat-36.6817)).toBeLessThan(.1);
  expect(searched.zoom).toBe(10);

  await showReportOnMobile(page,testInfo);
  await input.fill('');
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

test('mi ubicación genera una consulta local sin enviar coordenadas a analítica',async({context,page},testInfo)=>{
  await showMapOnMobile(page,testInfo);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:36.6817,longitude:-6.1372});
  await page.locator('#locateBtn').click();
  await expect(page.locator('#localReport')).toContainText('Jerez de la Frontera',{timeout:12000});
  await expect(page.locator('#locationNotice')).toContainText(/Mostrando el informe|Ubicación obtenida/);
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
