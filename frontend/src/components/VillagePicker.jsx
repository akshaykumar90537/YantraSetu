import React, { useEffect, useId, useState } from 'react';
import { VERIFIED_VILLAGES, getVillageDisplayLabel } from '../data/villages';
import { searchPlaces, validPlace } from '../data/placeSearch';
import './VillagePicker.css';

const villages = [...VERIFIED_VILLAGES].sort((a, b) => a.name.localeCompare(b.name));
const key = p => p.lat + ',' + p.lon;
const display = p => p.label || getVillageDisplayLabel(p);
export function recentVillage() {
  let saved;
  try {
    saved = sessionStorage.getItem('ys-village');
    const place = JSON.parse(saved);
    if (validPlace(place)) return place;
  } catch {}
  return villages.find(p => key(p) === saved) || villages.find(p => p.name === 'Ludhiana');
}
export function VillagePicker({ latitude, longitude, onChange, label, customLabel, selectedPlace, onClear }) {
  const [chosen, setChosen] = useState(recentVillage);
  const sameCoordinates = p => p && p.lat === Number(latitude) && p.lon === Number(longitude);
  const village = villages.find(sameCoordinates) || (sameCoordinates(chosen) ? chosen : null);
  const selectedLabel = selectedPlace ? display(selectedPlace) : village ? display(village) : customLabel || '';
  const id = useId();
  const [text, setText] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState({ query: '', status: 'idle', places: [] });
  const [retry, setRetry] = useState(0);
  useEffect(() => { setText(selectedLabel); setOpen(false); setActive(-1); }, [selectedLabel, latitude, longitude]);
  const query = text === selectedLabel ? '' : text.trim().toLocaleLowerCase();
  const local = villages.filter(p => display(p).toLocaleLowerCase().includes(query))
    .sort((a, b) => Number(b.name.toLocaleLowerCase().startsWith(query)) - Number(a.name.toLocaleLowerCase().startsWith(query)))
    .slice(0, 8);
  const online = query.length >= 3;
  useEffect(() => {
    if (!open || !online) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRemote({ query, status: 'loading', places: [] });
      searchPlaces(query, controller.signal).then(places => {
        if (!controller.signal.aborted) { setRemote({ query, status: 'ready', places }); setActive(-1); }
      }).catch(() => {
        if (!controller.signal.aborted) setRemote({ query, status: 'error', places: [] });
      });
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, online, retry]);
  const places = remote.query === query && remote.status === 'ready' ? remote.places : [];
  const matches = [...local, ...places.filter(p => !local.some(v => Math.abs(v.lat-p.lat)<0.002 && Math.abs(v.lon-p.lon)<0.002))].slice(0, 12);
  const loading = online && (remote.query !== query || remote.status === 'loading' || remote.status === 'idle');
  const error = online && remote.query === query && remote.status === 'error';
  function choose(choice) {
    try { sessionStorage.setItem('ys-village', JSON.stringify(choice)); } catch {}
    setChosen(choice); setText(display(choice)); setOpen(false); setActive(-1);
    onChange(choice);
  }
  return <div className="village-picker" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setActive(-1); setText(selectedLabel); }
  }}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="text" role="combobox" autoComplete="off" maxLength={120}
      placeholder="Type your village or town" value={text}
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-describedby={`${id}-hint`} aria-busy={open && loading}
      aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-option-${active}` : undefined}
      onFocus={e => { setOpen(true); e.target.select(); }}
      onChange={e => { setText(e.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setOpen(true);
          setActive(index => !matches.length ? -1 : index < 0 ? (e.key === 'ArrowDown' ? 0 : matches.length - 1) : (index + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
        } else if (e.key === 'Enter' && open) {
          e.preventDefault();
          if (matches[active]) choose(matches[active]);
          else if (matches.length === 1 && !loading) choose(matches[0]);
        } else if (e.key === 'Escape') {
          e.preventDefault(); setOpen(false); setActive(-1); setText(selectedLabel);
        }
      }} />
    {open && <div className="village-picker-menu">
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`}>
        {matches.map((p, index) => <li id={`${id}-option-${index}`} key={key(p)} role="option"
          aria-selected={index === active} onMouseDown={e => e.preventDefault()}
          onClick={() => choose(p)}>
          <strong>{p.name}</strong><span>{[p.district, p.state].filter(Boolean).join(', ')}</span>
        </li>)}
      </ul>
      {loading && <p role="status">Searching more villages and towns…</p>}
      {error && <p role="status">Online place search is unavailable. Try again or use a saved suggestion. <button type="button" onClick={() => setRetry(n => n + 1)}>Retry place search</button></p>}
      {!matches.length && !loading && !error && <p role="status">{online ? 'No places found. Add your district or state, or try another spelling.' : 'Type at least 3 letters to search more villages and towns.'}</p>}
      {places.length > 0 && <p className="village-picker-credit">Place data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Photon</p>}
    </div>}
    {onClear&&<button type="button" className="text-button" onClick={onClear}>Use my current village instead</button>}
    <small id={`${id}-hint`} className="village-picker-hint">Type a name, then select the correct village and state. Online suggestions use OpenStreetMap.</small>
  </div>;
}
