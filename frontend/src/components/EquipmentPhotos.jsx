import { operationText } from '../locales/operations';
import React, { useEffect, useState } from 'react';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export function EquipmentPhotos({ machine, lang='en' }) {
  const [lowData,setLowData]=useState(localStorage.getItem('ys-low-data')==='1'||navigator.connection?.saveData);
  const [requested,setRequested]=useState(false);
  useEffect(()=>{const update=()=>setLowData(localStorage.getItem('ys-low-data')==='1');window.addEventListener('ys:photo-preference',update);return()=>window.removeEventListener('ys:photo-preference',update);},[]);
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(false);
  const ids = machine.photo_ids || [];
  useEffect(()=>{setSelected(0);setFailed(false);},[ids.join(',')]);
  if (!ids.length) return null;
  if(lowData&&!requested)return <button onClick={()=>setRequested(true)}>{operationText('Load equipment photos',lang)}</button>;
  return <div>
    {failed ? <p>Photo unavailable</p> : <img src={`${base}/api/photos/${ids[selected] || ids[0]}`} alt={`${machine.name} — owner photo ${selected + 1}`}
      loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
      style={{ width:'100%',height:200,objectFit:'contain',background:'#eef2e8',borderRadius:8 }} />}
    {ids.length > 1 && <div aria-label="Equipment photos" style={{ display:'flex',gap:8 }}>{ids.map((id,i) => <button type="button" key={id} aria-pressed={i===selected}
      onClick={() => {setSelected(i);setFailed(false);}}>Photo {i+1}</button>)}</div>}
    <small>Owner-provided photo · condition not independently verified</small>
  </div>;
}
