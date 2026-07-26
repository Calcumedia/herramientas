import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const required = [
  'index.html','styles.css','v45.css','app.js','v45.js','analytics-config.js','sw.js',
  'api/situation.js','api/geocode.js','api/reverse-geocode.js','api/health.js',
  'playwright.config.mjs','tests/e2e.spec.mjs','vercel.json'
];
for (const file of required) await access(join(root, file), constants.R_OK);

const [html, css, v45css, js, v45, health, vercel] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'styles.css'), 'utf8'),
  readFile(join(root, 'v45.css'), 'utf8'),
  readFile(join(root, 'app.js'), 'utf8'),
  readFile(join(root, 'v45.js'), 'utf8'),
  readFile(join(root, 'api/health.js'), 'utf8'),
  readFile(join(root, 'vercel.json'), 'utf8'),
]);

for (const id of ['placeSearchForm','placeQuery','placeResults','localReport','placesSaved','homeBtn','locateBtn','locationNotice']) assert.match(html,new RegExp(`id="${id}"`));
assert.match(html,/v45\.js\?v=/);
assert.match(html,/v45\.css\?v=/);
assert.doesNotMatch(html,/map-reset\.js/);
assert.match(html,/aria-controls="places"/);
assert.match(html,/aria-labelledby="tab-places"/);
assert.match(css,/\.persistentSearch/);
assert.match(v45css,/\.mobileModeSwitch/);
assert.match(v45css,/\.trustGrid/);
assert.match(v45css,/\.actionCard/);

assert.match(js,/setView\(\[40\.4167,-3\.7033\],6\)/);
assert.match(js,/function renderMap\(fit=false\)/);
assert.match(js,/if\(fit&&bounds\.length\)map\.fitBounds/);
assert.match(js,/fitBtn[^;]*renderMap\(true\)/);
assert.match(js,/function renderData\(\)[\s\S]*?renderMap\(false\)/);
assert.doesNotMatch(js,/window\.addEventListener\('load',[\s\S]*?renderMap\(true\)/);

assert.match(v45,/INITIAL_CENTER=\[40\.4167,-3\.7033\]/);
assert.match(v45,/function useLocation/);
assert.match(v45,/api\/reverse-geocode/);
assert.match(v45,/function enhanceReport/);
assert.match(v45,/function enhanceNews/);
assert.match(v45,/ArrowRight/);
assert.match(v45,/mobile-map/);
assert.match(vercel,/geolocation=\(self\)/);

assert.match(health,/mapCenter:\[40\.4167,-3\.7033\]/);
assert.match(health,/mapZoom:6/);
assert.match(health,/staticLocalitySearch:true/);
assert.match(health,/initialAutoFit:false/);

console.log('Source integrity checks passed for Fuego Centro 4.5.');
