import { EquipmentReviews } from './EquipmentReviews';
import React, { useEffect, useState } from 'react';
import { getDistanceKm } from '../data/villages';
import { INR, translate } from '../locales';

import { VillagePicker, recentVillage } from './VillagePicker';
import { EquipmentPhotos } from './EquipmentPhotos';
const types = ['Tractor', 'Rotavator', 'Harvester', 'Seed drill', 'Sprayer', 'Cultivator'];
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function readPublic(path, signal) {
  const response = await fetch(apiBase + '/api' + path, { signal });
  if (!response.ok) throw new Error('Unavailable');
  return response.json();
}

function Listing({ machine, lang, onEstimate, onRequest }) {
  const [status, setStatus] = useState('idle');
  const [slot, setSlot] = useState(null);
  const t = key => translate(lang, key);
  async function check() {
    setStatus('loading');
    try {
      const result = await readPublic('/machines/' + machine.id + '/availability');
      setSlot(result.next_available);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }
  const format = value => new Date(value).toLocaleString(lang + '-IN', { dateStyle: 'short', timeStyle: 'short' });
  return <article className="ys-listing">
    <EquipmentPhotos machine={machine} />
    <header><small>{machine.category}</small><h3>{machine.name}</h3></header>
    <p>{machine.village} · {machine.distance.toFixed(1)} km</p>
    <strong>{INR(machine.rate)} · {t(machine.unit === 'acre' ? 'perAcre' : 'perHour')}</strong>
    <div className="ys-listing-actions">
      <button className="ys-btn ys-btn-dark" disabled={status === 'loading'} onClick={check}>{t('checkSlot')}</button>
      <button className="ys-text-link" onClick={() => onEstimate(machine)}>{t('estimateCost')}</button>
    </div>
    <div aria-live="polite">
      {status === 'loading' && t('finding')}
      {status === 'error' && t('unknownSlot')}
      {status === 'ready' && (slot ? <>
        <p><strong>{t('nextSlot')}</strong><br/>{format(slot.start_at)} – {format(slot.end_at)}</p>
        <p>{t('approvalPayment')}</p>
        <button className="ys-btn ys-btn-lime" onClick={() => onRequest(machine)}>{t('requestSlot')}</button>
      </> : t('noSlot'))}
    </div>
    <EquipmentReviews machine={machine}/>
  </article>;
}

export function NearbyEquipment({ lang, onEstimate, onRequest }) {
  const [place, setPlace] = useState(recentVillage);
  const [category, setCategory] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const t = key => translate(lang, key);
  const query = new URLSearchParams({ latitude: place.lat, longitude: place.lon, radius: 5, category }).toString();
  useEffect(() => {
    const controller = new AbortController();
    readPublic('/machines?' + query, controller.signal).then(rows => {
      const listings = rows.map(m => ({ ...m, distance: getDistanceKm(place.lat, place.lon, m.latitude, m.longitude) }))
        .filter(m => m.distance <= 5 && (!category || m.category === category))
        .sort((a, b) => a.distance - b.distance);
      if (!controller.signal.aborted) setResult({ query, listings });
    }).catch(() => { if (!controller.signal.aborted) setResult({ query, error: true }); });
    return () => controller.abort();
  }, [query, place, category, retry]);
  return <>
    <div className="ys-search-fields">
      <label>{t('typePicker')}<select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="">{t('allTypes')}</option>
        {types.map(type => <option key={type}>{type}</option>)}
      </select></label>
      <VillagePicker latitude={place.lat} longitude={place.lon} onChange={setPlace} label={t('villagePicker')} />
    </div>
    <div role="status">{result?.query !== query ? t('finding') : result.error ?
      <>{t('listingError')} <button className="ys-text-link" onClick={() => { setResult(null); setRetry(n => n + 1); }}>{t('retrySearch')}</button></>
      : !result.listings.length && t('noResults')}</div>
    <div className="ys-listings">{result?.query === query && result.listings?.map(machine =>
      <Listing key={machine.id} {...{ machine, lang, onEstimate, onRequest }} />)}</div>
  </>;
}
