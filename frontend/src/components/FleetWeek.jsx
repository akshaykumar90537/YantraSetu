import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { getDistanceKm } from '../data/villages';

export function bookingGroup(b, userId) {
  if (!['PENDING','APPROVED','IN_PROGRESS'].includes(b.status)) return 'historyGroup';
  if (b.status === 'PENDING' && b.owner_id === userId) return 'actionGroup';
  if (b.needs_meter_confirmation) return b.farmer_id === userId ? 'actionGroup' : 'upcomingGroup';
  if ((b.owner_id === userId || b.operator_id === userId) &&
      (b.status === 'IN_PROGRESS' || (b.status === 'APPROVED' && Date.parse(b.start_at) <= Date.now() && Date.now() < Date.parse(b.end_at)))) return 'actionGroup';
  return 'upcomingGroup';
}

function shift(day, amount) {
  const result = new Date(day);
  result.setDate(result.getDate() + amount);
  return result;
}
function monday(value) {
  const today = value ? new Date(value) : new Date();
  today.setHours(0,0,0,0);
  return shift(today,-((today.getDay()+6)%7));
}

export function FleetWeek({initialDate,fleet, rows, lang, t, revision, onBooking}) {
  const [week,setWeek] = useState(()=>monday(initialDate));
  const [retry,setRetry] = useState(0);
  const [result,setResult] = useState(null);
  const end = shift(week,7);
  const query = new URLSearchParams({start:week.toISOString(),end:end.toISOString()}).toString();
  const version = query + ':' + revision + ':' + retry;
  useEffect(() => {
    let active = true;
    api('/fleet/maintenance?' + query).then(blocks => {
      if (active) setResult({version,blocks});
    }).catch(() => { if(active) setResult({version,error:true}); });
    return () => { active=false; };
  },[query,version]);
  const days = Array.from({length:7},(_,i)=>shift(week,i));
  const dayLabel=d=>d.toLocaleDateString(lang+'-IN',{weekday:'short',day:'numeric',month:'short'});
  const clock=d=>new Date(d).toLocaleTimeString(lang+'-IN',{hour:'2-digit',minute:'2-digit'});
  const events=[];
  for (const b of rows.filter(b=>['PENDING','APPROVED','IN_PROGRESS','COMPLETED'].includes(b.status))) {
    events.push({id:b.id, machine:b.machine_id, start:Date.parse(b.start_at), end:Date.parse(b.end_at), kind:'job', label:b.farmer_name, booking:b});
    if(Date.parse(b.reserved_until)>Date.parse(b.end_at))
      events.push({id:b.id+'-buffer',machine:b.machine_id,start:Date.parse(b.end_at),end:Date.parse(b.reserved_until),kind:'buffer',label:t('turnaround')});
  }
  for (const [i,m] of (result?.blocks || []).entries())
    events.push({id:'m'+i,machine:m.machine_id,start:Date.parse(m.start_at),end:Date.parse(m.end_at),kind:'maintenance',label:m.reason});
  events.sort((a,b)=>a.start-b.start);
  const jobEvents = events.filter(event => event.kind === 'job');
  const travelGaps = new Map();
  const previousJobs = new Map();
  for (const event of jobEvents) {
    const previous = previousJobs.get(event.machine);
    if (previous) {
      const minutes = Math.round((event.start - Date.parse(previous.booking.reserved_until)) / 60000);
      const distance = getDistanceKm(previous.booking.latitude, previous.booking.longitude,
        event.booking.latitude, event.booking.longitude);
      if (minutes >= 0 && Number.isFinite(distance))
        travelGaps.set(event.id, { minutes, distance });
    }
    previousJobs.set(event.machine, event);
  }
  return <section className="panel week-panel"><h2>{t('fleetWeek')}</h2>
    <div className="week-controls"><button className="outline" onClick={()=>setWeek(shift(week,-7))}>{t('previousWeek')}</button>
    <button className="outline" onClick={()=>setWeek(monday())}>{t('thisWeek')}</button>
    <button className="outline" onClick={()=>setWeek(end)}>{t('nextWeek')}</button></div>
    <p>{dayLabel(week)} – {dayLabel(days[6])} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    {result?.version !== version ? <p role="status">{t('loadingWork')}</p> : result.error ? <p role="alert">{t('workError')} <button onClick={()=>setRetry(retry+1)}>{t('retrySearch')}</button></p> :
    <div className="table-wrap"><table className="fleet-week"><thead><tr><th>{t('equipmentCol')}</th>{days.map(d=><th key={+d}>{dayLabel(d)}</th>)}</tr></thead>
    <tbody>{fleet.map(m=><tr key={m.id}><th scope="row">{m.name}</th>{days.map(d=>{
      const until=shift(d,1);
      const items=events.filter(e=>e.machine===m.id && e.start<until && e.end>d);
      return <td key={+d}>{items.length ? items.map(e=>{
        const times=clock(Math.max(+d,e.start))+'–'+(e.end>=+until?'24:00':clock(e.end));
        return e.booking ? <button key={e.id} className="week-event job" onClick={()=>onBooking(e.booking)}>
          <strong>{times}</strong>{t(e.booking.status)} · {e.label}
          <small>{Number(e.booking.latitude).toFixed(3)}, {Number(e.booking.longitude).toFixed(3)}</small>
          {travelGaps.has(e.id) && <small>{t('fieldGap')} · {travelGaps.get(e.id).minutes} min
            <br />{t('straightDistance')} · {travelGaps.get(e.id).distance.toFixed(1)} km</small>}</button>
          : <div key={e.id} className={'week-event '+e.kind}><strong>{times}</strong>{e.kind==='maintenance' ? t('maintenanceLabel')+' · ' : ''}{e.label}</div>;
      }) : '—'}</td>;
    })}</tr>)}</tbody></table></div>}
  </section>;
}