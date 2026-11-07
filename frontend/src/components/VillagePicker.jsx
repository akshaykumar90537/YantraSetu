import React, { useEffect, useId, useState } from 'react';
import { VERIFIED_VILLAGES, getVillageDisplayLabel } from '../data/villages';
import './VillagePicker.css';

const villages = [...VERIFIED_VILLAGES].sort((a, b) => a.name.localeCompare(b.name));
const key = p => p.lat + ',' + p.lon;
export function recentVillage() {
  let saved;
  try { saved = sessionStorage.getItem('ys-village'); } catch {}
  return villages.find(p => key(p) === saved) || villages.find(p => p.name === 'Ludhiana');
}
export function VillagePicker({ latitude, longitude, onChange, label, customLabel }) {
  const village = villages.find(p => p.lat === Number(latitude) && p.lon === Number(longitude));
  const selectedLabel = village ? getVillageDisplayLabel(village) : customLabel || '';
  const id = useId();
  const [text, setText] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => { setText(selectedLabel); setOpen(false); setActive(-1); }, [selectedLabel]);
  const query = text === selectedLabel ? '' : text.trim().toLocaleLowerCase();
  const matches = villages.filter(p => getVillageDisplayLabel(p).toLocaleLowerCase().includes(query))
    .sort((a, b) => Number(b.name.toLocaleLowerCase().startsWith(query)) - Number(a.name.toLocaleLowerCase().startsWith(query)))
    .slice(0, 8);
  function choose(choice) {
    try { sessionStorage.setItem('ys-village', key(choice)); } catch {}
    setText(getVillageDisplayLabel(choice));
    setOpen(false);
    setActive(-1);
    onChange(choice);
  }
  return <div className="village-picker">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="text" role="combobox" autoComplete="off"
      placeholder="Type your village or town" value={text}
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-describedby={`${id}-hint`}
      aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-option-${active}` : undefined}
      onFocus={e => { setOpen(true); e.target.select(); }}
      onChange={e => { setText(e.target.value); setOpen(true); setActive(-1); }}
      onBlur={() => { setOpen(false); setActive(-1); setText(selectedLabel); }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setOpen(true);
          setActive(index => !matches.length ? -1 : index < 0 ? (e.key === 'ArrowDown' ? 0 : matches.length - 1) : (index + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
        } else if (e.key === 'Enter' && open) {
          e.preventDefault();
          if (matches[active]) choose(matches[active]);
          else if (matches.length === 1) choose(matches[0]);
        } else if (e.key === 'Escape') {
          e.preventDefault(); setOpen(false); setActive(-1); setText(selectedLabel);
        }
      }} />
    {open && <div className="village-picker-menu">
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`}>
        {matches.map((p, index) => <li id={`${id}-option-${index}`} key={key(p)} role="option"
          aria-selected={index === active} onMouseDown={e => e.preventDefault()}
          onClick={() => choose(p)}>
          <strong>{p.name}</strong><span>{p.district}, {p.state}</span>
        </li>)}
      </ul>
      {!matches.length && <p role="status">No matching village or town in our list. Try a nearby town or district.</p>}
    </div>}
    <small id={`${id}-hint`} className="village-picker-hint">Type a name, then select a suggestion to update nearby equipment.</small>
  </div>;
}
