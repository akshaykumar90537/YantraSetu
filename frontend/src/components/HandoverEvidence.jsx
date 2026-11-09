import React,{useEffect,useState} from 'react';
import {api} from '../api';
import {INR,dt} from '../locales';
export function EvidenceDetail({detail:d,bookingId}) {
 const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
 return <><p>{d.condition || 'No condition notes supplied.'}</p>
 {d.photo_ids?.map(id=><a key={id} href={`${base}/api/bookings/${bookingId}/evidence-photos/${id}`} target="_blank" rel="noreferrer"><img src={`${base}/api/bookings/${bookingId}/evidence-photos/${id}`} alt="Rental condition evidence" style={{width:120,height:90,objectFit:'cover'}}/></a>)}
 {d.additional_charges?.length>0?<><h4>Additional one-time charges</h4><ul>{d.additional_charges.map((x,i)=><li key={i}>{x.description}: {INR(x.amount)}</li>)}</ul><p>Total additional charges: {INR(d.additional_charges.reduce((sum,x)=>sum+Number(x.amount),0))}</p></>:<p>No additional charges.</p>}</>;
}
export function HandoverEvidence({booking}) {
 const [rows,setRows]=useState(null),[error,setError]=useState('');
 async function refresh(){try{setRows(await api(`/bookings/${booking.id}/handover-records`));setError('')}catch(e){setError(e.message)}}
 useEffect(()=>{setRows(null)},[booking.id,booking.status]);
 return <details onToggle={e=>{if(e.currentTarget.open)refresh()}}><summary>Pickup and return evidence</summary>
 {error&&<p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
 {rows?.length===0&&<p>No evidence records yet. Older rentals may only have meter readings in their invoice.</p>}
 {rows?.map(r=><article key={r.id}><h4>{r.stage==='start'?'Pickup':'Return'} · {r.confirmation_status}</h4><p>Meter: {r.detail.reading} hours{r.detail.acres?` · ${r.detail.acres} acres`:''}</p><p>Submitted by {r.submitted_name} · {dt(r.created_at)}</p>{r.confirmed_at&&<p>Confirmed by {r.confirmed_name} · {dt(r.confirmed_at)}</p>}<EvidenceDetail detail={r.detail} bookingId={booking.id}/></article>)}
 <p>These are participant-submitted records, not an independent inspection.</p></details>;
}
