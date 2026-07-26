import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const required = [
  'index.html',
  'styles.css',
  'app.js',
  'analytics-config.js',
  'sw.js',
  'api/situation.js',
  'api/geocode.js',
  'api/health.js',
  'vercel.json',
];

for (const file of required) {
  await access(join(root, file), constants.R_OK);
}

const [html, css, js, health] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'styles.css'), 'utf8'),
  readFile(join(root, 'app.js'), 'utf8'),
  readFile(join(root, 'api/health.js'), 'utf8'),
]);

assert.match(html, /id="placeSearchForm"/);
assert.match(html, /id="placeQuery"/);
assert.match(html, /id="placeResults"/);
assert.match(html, /id="localReport"/);
assert.match(html, /id="placesSaved"/);
assert.match(html, /app\.js\?v=/);
assert.match(html, /styles\.css\?v=/);

assert.match(css, /\.persistentSearch/);
assert.match(css, /pointer-events:auto/);
assert.match(css, /\.panel\{[^}]*isolation:isolate/s);

assert.match(js, /setView\(\[40\.4167,-3\.7033\],6\)/);
assert.match(js, /function renderMap\(fit=false\)/);
assert.match(js, /if\(fit&&bounds\.length\)map\.fitBounds/);
assert.match(js, /fitBtn[^;]*renderMap\(true\)/);
assert.match(js, /function renderData\(\)[\s\S]*?renderMap\(false\)/);
assert.doesNotMatch(js, /window\.addEventListener\('load',[\s\S]*?renderMap\(true\)/);
assert.match(js, /placeSearchForm/);
assert.match(js, /addEventListener\('submit'/);
assert.match(js, /fetch\('\/api\/geocode\?q='/);
assert.match(js, /setInterval\(\(\)=>load\(true\),120000\)/);

assert.match(health, /mapCenter:\[40\.4167,-3\.7033\]/);
assert.match(health, /mapZoom:6/);
assert.match(health, /staticLocalitySearch:true/);
assert.match(health, /initialAutoFit:false/);

console.log('Source integrity checks passed.');
