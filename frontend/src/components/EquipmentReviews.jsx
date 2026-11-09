import React,{useState} from 'react';
import {api} from '../api';
import {dt} from '../locales';
export function EquipmentReviews({machine}) {
  const [reviews,setReviews]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function fetchReviews(){setBusy(true);setError('');try{setReviews(await api(`/machines/${machine.id}/reviews`));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <details onToggle={e=>{if(e.currentTarget.open&&reviews===null&&!busy)fetchReviews();}}><summary>Completed-rental reviews ({Number(machine.rating_count)||0})</summary>
    {busy&&<p role="status">Loading reviews…</p>}{error&&<p role="alert">{error} <button onClick={fetchReviews}>Retry reviews</button></p>}
    {reviews?.length===0&&<p>No completed-rental reviews yet.</p>}
    {reviews?.map((r,i)=><article key={i}><strong>{r.score}/5 · {r.author_name}</strong><p>Punctuality: {r.punctuality}/5 · {dt(r.created_at)}</p>{r.comment&&<p>{r.comment}</p>}<small>{r.badges?.join(' · ')}</small></article>)}
    <small>Reviews are linked to completed bookings. Scores are customer opinions.</small>
  </details>;
}
