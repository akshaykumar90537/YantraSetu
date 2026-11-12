import {validateCommunityResponse} from '../data/communityResponse';
import React,{useEffect,useState} from 'react';
import {api} from '../api';
import {dt} from '../locales';
export function RentalFAQs(){
 const questions=[
  ['How do I find equipment near me?', 'Open Find machinery and select your village or town, allow current location, or choose a location on the map. Select an equipment type and search radius to narrow the results.'],
  ['When is my booking confirmed?', 'A request is confirmed only after the owner accepts it. Check My bookings for the latest status before arranging pickup.'],
  ['How do pickup and return work?', 'Review the equipment condition, meter reading and agreed charges with the other party. Use the handover and return confirmation steps in My bookings. Never share a sign-in OTP.'],
  ['How do I report an issue or follow up?', 'For rental problems, select your booking in Support requests or use Report a problem in My bookings. For misleading or unsafe listings, use Report issue below. Your requests show their status and staff replies here.'],
  ['How do I pay for a rental?', 'Arrange payment directly with the owner. YantraSetu records manually reported payment status; it does not collect online payments or independently verify them.']
 ];
 return <section><h3>FAQs</h3>{questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>;
}
export function RentalGuides(){
 const guides=[
 ['Before requesting equipment','Check the equipment description, dates, rental unit, transport cost, fuel and operator arrangements. Submit a request only after reviewing the estimate. A request is not confirmed until the owner accepts.'],
 ['Pickup and OTP confirmation','Inspect the equipment with the owner or assigned operator. Record the start meter and existing damage; add condition photos when useful. Review the submitted record in My bookings before entering your OTP. Do not confirm an incorrect reading or share sign-in codes.'],
 ['During the rental','Use equipment only if you are trained and authorized. Follow the manufacturer’s manual and guards; keep bystanders away. If equipment fails, stop using it, contact the owner and report the problem from your booking. Do not attempt unfamiliar repairs.'],
 ['Return and final charges','Review the end meter, completed acreage where applicable, condition photos and each extra charge. Confirm the return OTP only when the record is correct. The invoice includes agreed charges; payment is arranged outside YantraSetu and its status is manually reported.'],
 ['Changed plans and disputes','For an accepted rental that has not started, propose new dates in My bookings. The current slot stays reserved until the other party accepts. For a dispute, open a booking-linked support case and describe the issue. Keep private evidence in the booking, not public posts.'],
 ['Report suspicious listings','Use Report this listing on an equipment card or enter its equipment ID below. Reports are private to you and authorized staff. Reporting does not automatically remove a listing. Support is not an emergency service; use local emergency services for immediate danger.']
 ];
 return <section><h3>Safety and rental guides</h3>{guides.map(([title,text])=><details key={title}><summary>{title}</summary><p>{text}</p></details>)}</section>;
}
export function ReportListing({machineId,onSaved}){
 const [error,setError]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false);
 return <details><summary>Report {machineId?'this listing':'harmful or misleading content'}</summary><p>Report a listing for scams, misleading claims, unsafe content or abuse. Do not include passwords, OTPs or identity documents.</p>
 <form className="operation-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');setSaved('');try{const r=await api('/content-reports',{machine_id:machineId||f.get('machine_id'),reason:f.get('reason'),description:f.get('description')});setSaved(`Report submitted: ${r.id}. Track it in Help & Support.`);onSaved?.()}catch(e){setError(e.message)}finally{setBusy(false)}}}>
 {!machineId&&<label>Equipment ID (shown on the equipment card)<input name="machine_id" required/></label>}
 <label>Reason<select name="reason">{['SCAM','MISLEADING','UNSAFE','ABUSIVE','OTHER'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>What happened?<textarea name="description" required minLength={10} maxLength={2000}/></label><button disabled={busy||!!saved}>Submit private report</button>
 {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}</form></details>;
}
export function SupportThread({item,onChange}){
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{setRows(await api(`/support/${item.id}/messages`));setError('')}catch(e){setError(e.message)}}
 return <details onToggle={e=>{if(e.currentTarget.open)refresh()}}><summary>Replies and status history</summary>
 {error&&<p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
 {rows?.length===0&&<p>No replies yet.</p>}{rows?.map(r=><article key={r.id}><strong>{r.is_staff?'Support staff':'Reporter'} · {dt(r.created_at)}</strong><p>{r.body}</p>{r.status&&<small>Status: {r.status}</small>}</article>)}
 {item.status!=='RESOLVED'?<form className="operation-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;setBusy(true);try{await api(`/support/${item.id}/messages`,{body:new FormData(form).get('body')});form.reset();await refresh();onChange?.()}catch(e){setError(e.message)}finally{setBusy(false)}}}><label>Add information<textarea name="body" required minLength={3} maxLength={2000}/></label><button disabled={busy}>Send reply</button></form>:<p>This case is resolved. Replies are closed unless staff reopen it.</p>}</details>;
}
export function SupportHub(){
 const [cases,setCases]=useState([]),[bookings,setBookings]=useState([]),[reports,setReports]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('');
 async function refresh(){try{const [c,b,r]=await Promise.all([api('/support'),api('/bookings'),api('/content-reports')]);setCases(validateCommunityResponse('/support',c));setBookings(validateCommunityResponse('/bookings',b));setReports(validateCommunityResponse('/content-reports',r));setError('');setLoaded(true)}catch(e){setError(e.message)}}
 useEffect(()=>{refresh()},[]);
 return <section><h3>Support requests</h3><button onClick={refresh}>Refresh support requests</button>
 {error&&<p role="alert">{error}</p>}{!loaded&&!error&&<p role="status">Loading support…</p>}
 <p>Private help linked to your rental. Staff response times are not guaranteed; this is not an emergency service.</p>
 {loaded&&(bookings.length?<form className="operation-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;setBusy(true);setMessage('');try{const r=await api('/support',Object.fromEntries(new FormData(form)));setMessage(`Case submitted: ${r.id}`);form.reset();await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}}>
 <label>Booking<select name="booking_id" required>{bookings.map(b=><option key={b.id} value={b.id}>{b.machine_name} · {dt(b.start_at)} · {b.status}</option>)}</select></label>
 <label>Problem<select name="kind">{['BREAKDOWN','DELAY','BILLING','SAFETY','OTHER'].map(k=><option key={k}>{k}</option>)}</select></label>
 <label>Describe the issue<textarea name="description" minLength={10} maxLength={2000} required/></label><button disabled={busy}>Request booking help</button></form>:<p>You have no bookings yet. Use the listing report below for a problem with equipment advertising.</p>)}
 {message&&<p role="status">{message}</p>}{loaded&&!cases.length&&<p>No support cases yet.</p>}
 {cases.map(x=><article key={x.id}><h4>{x.machine_name} · {x.kind} · {x.status}</h4><p>Case: {x.id}</p><p>{x.description}</p><small>Created {dt(x.created_at)} · updated {dt(x.updated_at)}</small>{x.resolution&&<p>Latest staff response: {x.resolution}</p>}<SupportThread item={x} onChange={refresh}/></article>)}
 <h3>Report issue</h3><ReportListing onSaved={refresh}/>{loaded&&!reports.length&&<p>No listing reports yet.</p>}
 {reports.map(r=><article key={r.id}><h4>{r.machine_name} · {r.status}</h4><p>{r.reason}: {r.description}</p>{r.resolution&&<p>Staff response: {r.resolution}</p>}<small>Report {r.id} · updated {dt(r.updated_at)}</small></article>)}
 </section>;
}
