import React from 'react';
import { VERIFIED_VILLAGES, getVillageDisplayLabel } from '../data/villages';

const villages = [...VERIFIED_VILLAGES].sort((a, b) => a.name.localeCompare(b.name));
const key = p => p.lat + ',' + p.lon;
export function recentVillage() {
  return villages.find(p => key(p) === sessionStorage.getItem('ys-village')) || villages.find(p => p.name === 'Ludhiana');
}
export function VillagePicker({ latitude, longitude, onChange, label, customLabel }) {
  const village = villages.find(p => p.lat === Number(latitude) && p.lon === Number(longitude));
  return <label>{label}<select value={village ? key(village) : ''} onChange={e => {
    const choice = villages.find(p => key(p) === e.target.value);
    sessionStorage.setItem('ys-village', key(choice));
    onChange(choice);
  }}>
    {!village && <option value="">{customLabel}</option>}
    {villages.map(p => <option key={key(p)} value={key(p)}>{getVillageDisplayLabel(p)}</option>)}
  </select></label>;
}