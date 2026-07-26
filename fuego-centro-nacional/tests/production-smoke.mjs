import { strict as assert } from 'node:assert';

const origin = process.env.FUEGO_CENTRO_URL || 'https://fuego-centro-nacional.vercel.app';

async function get(path, expectedType) {
  const response = await fetch(`${origin}${path}`, {
    headers: { 'user-agent': 'FuegoCentro-CI/1.0' },
    redirect: 'follow',
  });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  const type = response.headers.get('content-type') || '';
  assert.match(type, expectedType, `${path} has unexpected content-type: ${type}`);
  return response;
}

const index = await (await get('/', /text\/html/)).text();
assert.match(index, /id="placeSearchForm"/);
assert.match(index, /id="placeQuery"/);
assert.match(index, /app\.js\?v=/);
assert.match(index, /styles\.css\?v=/);

const css = await (await get('/styles.css', /text\/css/)).text();
assert.match(css, /\.persistentSearch/);
assert.match(css, /pointer-events:auto/);

const app = await (await get('/app.js', /javascript/)).text();
assert.match(app, /setView\(\[40\.4167,-3\.7033\],6\)/);
assert.match(app, /placeSearchForm/);
assert.match(app, /initialAutoFit|renderMap\(false\)/);

const situation = await (await get('/api/situation', /application\/json/)).json();
assert.ok(Array.isArray(situation.incidents), 'incidents must be an array');
assert.ok(Array.isArray(situation.alerts), 'alerts must be an array');
assert.ok(Array.isArray(situation.coverage), 'coverage must be an array');
assert.ok(Array.isArray(situation.regionalCoverage), 'regionalCoverage must be an array');
assert.equal(situation.regionalCoverage.length, 19, 'national coverage directory must include 19 territories');

const geocode = await (await get('/api/geocode?q=Madrid', /application\/json/)).json();
assert.ok(Array.isArray(geocode.results) && geocode.results.length > 0, 'Madrid geocode must return results');
assert.ok(geocode.results.some(x => Math.abs(x.lat - 40.4167) < 0.2), 'Madrid coordinates look incorrect');

const health = await (await get('/api/health', /application\/json/)).json();
assert.equal(health.status, 'ok');
assert.deepEqual(health.mapCenter, [40.4167, -3.7033]);
assert.equal(health.mapZoom, 6);
assert.equal(health.staticLocalitySearch, true);
assert.equal(health.initialAutoFit, false);
assert.equal(health.nationalCoverageDirectory, 19);
assert.ok(Array.isArray(health.failedSources));

console.log(`Production smoke checks passed for ${origin}.`);
