import React,{useEffect,useState} from 'react';
import {api} from '../api';
import {INR,dt} from '../locales';
export function RescheduleBooking({booking:b,user,load}) {
  const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{let current=true;api(`/bookings/${b.id}/reschedules`).then(r=>{if(current){setRows(r);setError('');}}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[b.id,b.start_at,b.status,revision]);
  async function perform(fn){setBusy(true);setError('');try{await fn();setRevision(n=>n+1);await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  const pending=rows?.find(r=>r.status==='PENDING');
  return <details><summary>Change rental dates</summary>
    <p>The current dates stay reserved until the other party accepts. Proposed dates are not held. Prices use this booking’s agreed rates; hourly totals change with duration and acreage stays unchanged.</p>
    {error&&<p role="alert">{error} <button type="button" onClick={()=>setRevision(n=>n+1)}>Refresh proposals</button></p>}
    {!rows&&!error&&<p role="status">Loading proposals…</p>}
    {pending?<article><p>Proposed: {dt(pending.start_at)} → {dt(pending.end_at)}</p><p>New estimate: {INR(pending.estimate)} (current: {INR(b.estimate)})</p><p>{pending.reason}</p>
      {(pending.proposer_id===user.id?['withdraw']:['accept','reject']).map(action=><button key={action} disabled={busy} onClick={()=>perform(()=>api(`/bookings/${b.id}/reschedules/${pending.id}`,{action}))}>{action==='accept'?'Accept dates and new estimate':action==='reject'?'Reject proposed dates':'Withdraw proposal'}</button>)}
    </article>:rows&&b.status==='APPROVED'&&<form className="operation-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);perform(()=>api(`/bookings/${b.id}/reschedules`,{start_at:new Date(f.get('start')).toISOString(),end_at:new Date(f.get('end')).toISOString(),reason:f.get('reason')}));}}>
      <label>New start<input type="datetime-local" name="start" required/></label><label>New end<input type="datetime-local" name="end" required/></label>
      <label>Reason<textarea name="reason" minLength={3} maxLength={500} required/></label><button disabled={busy}>Propose new dates</button>
    </form>}
    {rows?.filter(r=>r.status!=='PENDING').slice(0,3).map(r=><p key={r.id}>{r.status}: {dt(r.start_at)} → {dt(r.end_at)} · {INR(r.estimate)}</p>)}
  </details>;
}
