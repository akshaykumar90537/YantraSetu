import { OperationsLanguage, localizeOperations } from '../locales/operations';
import React from 'react';
import { api, canRent } from '../api';
import { dt } from '../locales';
import { OperationForm } from './OperationsPanel';

export function BookingTools({booking:b,user:u,load,setModal,run,lang='en'}) {
  const owner=b.owner_id===u.id,farmer=b.farmer_id===u.id;
  const steps=['PENDING','APPROVED','IN_PROGRESS','COMPLETED'];
  const next={PENDING:owner?'Review the dates, then accept or reject.':'Waiting for the owner to accept.',APPROVED:owner?'Check equipment readiness and coordinate arrival.':'Contact the owner to coordinate arrival; confirm the start meter reading at handover.',IN_PROGRESS:'Complete the work, then confirm the final meter reading.',COMPLETED:'Review the invoice and record your feedback.',CANCELLED:'This slot has been released.',REJECTED:'Choose another date or another machine.'};
  return <OperationsLanguage.Provider value={lang}>{localizeOperations(<div className="booking-tools">
    {steps.includes(b.status)&&<ol className="booking-progress" aria-label="Rental progress">{steps.map((s,i)=><li key={s} aria-current={s===b.status?'step':undefined} className={i<=steps.indexOf(b.status)?'reached':''}>{s.replaceAll('_',' ')}</li>)}</ol>}
    <p>{next[b.status]}</p>{b.status==='PENDING'&&b.response_due_at&&<p>Owner response due: {dt(new Date(Math.min(new Date(b.response_due_at),new Date(b.start_at))).toISOString())}. Unaccepted requests expire automatically.</p>}
    {b.closure_reason&&<p>Reason: {b.closure_reason}</p>}
    {['APPROVED','IN_PROGRESS'].includes(b.status)&&<p>Travel: {(b.travel_status||'NOT_STARTED').replaceAll('_',' ')} · reported by owner/operator</p>}
    {b.status==='APPROVED'&&(owner||b.operator_id===u.id)&&<OperationForm title="Update actual travel progress" fields={[{name:'status',label:'Travel status',options:b.travel_status==='ARRIVED'?['ARRIVED']:['ON_THE_WAY','ARRIVED']}]} submit={async d=>{await api('/bookings/'+b.id+'/travel',d);await load();}}/>}
    {owner&&b.status==='APPROVED'&&<form className="operation-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(async()=>{await api('/bookings/'+b.id+'/readiness',Object.fromEntries(['machine_checked','fuel_checked','operator_confirmed','transport_confirmed'].map(k=>[k,f.has(k)])));await load();});}}><h4>Before handover</h4>{['machine_checked','fuel_checked','operator_confirmed','transport_confirmed'].map(k=><label key={k}><input type="checkbox" name={k} defaultChecked={!!b.readiness?.[k]}/>{k.replaceAll('_',' ')}</label>)}<button className="outline">Save checklist</button></form>}
    <details><summary>Report a problem</summary><OperationForm title="Request staff review" fields={[{name:'kind',label:'Problem',options:['BREAKDOWN','DELAY','BILLING','SAFETY','OTHER']},{name:'description',label:'Describe what happened (do not include passwords or payment credentials)',type:'textarea',minLength:10}]} action="Submit case" submit={d=>api('/support',{...d,booking_id:b.id})}/><p>Track replies in Community & support. This does not cancel the booking or issue a refund.</p></details>
    {farmer&&canRent(u)&&['COMPLETED','CANCELLED','REJECTED'].includes(b.status)&&<button className="outline" onClick={()=>run(async()=>setModal({type:'book',machine:await api('/machines/'+b.machine_id)}))}>Rent this equipment again</button>}
  </div>,lang)}</OperationsLanguage.Provider>;
}
