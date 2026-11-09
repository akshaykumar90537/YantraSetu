const cache = new Map();
export function validPlace(p) {
  return Boolean(p && typeof p.name === 'string' && p.name.trim() &&
    Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180);
}
export function parsePlaces(data) {
  if (!Array.isArray(data?.features)) throw new Error('Invalid place-search response');
  const found = new Map();
  for (const feature of data.features) {
    const p = feature.properties || {};
    if (String(p.countrycode).toUpperCase() !== 'IN' || feature.geometry?.type !== 'Point') continue;
    const [lon, lat] = feature.geometry.coordinates || [];
    const place = { name: p.name, district: p.county || p.city || p.district || '', state: p.state || 'India', lat, lon, source: 'photon' };
    if (!validPlace(place)) continue;
    place.label = [...new Set([place.name, place.district, place.state].filter(Boolean))].join(', ');
    found.set(`${lat},${lon}`, place);
  }
  return [...found.values()];
}
export async function searchPlaces(query, signal) {
  const q = query.trim().toLocaleLowerCase();
  if (q.length < 3) return [];
  const saved = cache.get(q);
  if (saved && Date.now() - saved.time < 300000) return saved.places;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 7000);
  try {
    const params = new URLSearchParams({ q, limit: '12', bbox: '68,6,98,38', lang: 'en' });
    const response = await fetch('https://photon.komoot.io/api/?' + params, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Place search unavailable');
    const places = parsePlaces(await response.json());
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(q, { time: Date.now(), places });
    return places;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
