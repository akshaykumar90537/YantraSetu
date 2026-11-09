import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaces, searchPlaces, validPlace } from './placeSearch.js';

const feature = (name, countrycode, coordinates) => ({ properties: { name, countrycode, state: 'Haryana' }, geometry: { type: 'Point', coordinates } });
test('keeps real Indian places with valid coordinates and removes duplicate/outside-country results', () => {
  const data = { features: [feature('Parta', 'IN', [75.846,29.568]), feature('Parta', 'IN', [75.846,29.568]), feature('Other', 'PK', [73,33]), feature('Invalid', 'IN', [999,999])] };
  const result = parsePlaces(data);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Parta, Haryana');
  assert.equal(result[0].lat, 29.568);
  assert.equal(validPlace({ name:'Bad',lat:null,lon:0 }), false);
});
test('malformed responses are errors rather than false no-match results', () => {
  assert.throws(() => parsePlaces({ error:'Unavailable' }));
  assert.deepEqual(parsePlaces({ features:[] }), []);
});
test('repeated queries use a bounded cache and short queries do not make requests', async t => {
  let count=0;
  t.mock.method(globalThis,'fetch',async () => {count++;return new Response(JSON.stringify({ features:[feature('Cache village','IN',[76,30])] }));});
  assert.deepEqual(await searchPlaces('ab'), []);
  const first=await searchPlaces('cache village test');
  assert.deepEqual(await searchPlaces(' CACHE VILLAGE TEST '),first);
  assert.equal(count,1);
});
test('provider failure is retryable and is never cached as an empty result', async t => {
  let count=0;
  t.mock.method(globalThis,'fetch',async () => ++count===1 ? new Response('',{status:503}) : new Response(JSON.stringify({features:[feature('Retry village','IN',[77,31])]})));
  await assert.rejects(searchPlaces('retry village test'));
  assert.equal((await searchPlaces('retry village test')).length,1);
});
