import {validateCommunityResponse} from '../data/communityResponse';
import {RentalGuides,SupportHub,SupportThread} from './CommunityHelp';
import React, { useEffect, useState, useContext } from 'react';
import { OperationsLanguage, localizeOperations } from '../locales/operations';
import { api, canRent } from '../api';
import { INR, dt } from '../locales';
import { BookingForm } from './BookingForm';

export function OperationForm({ title, fields, submit, action = 'Save' }) {
  const lang=useContext(OperationsLanguage);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  return localizeOperations(<form className="operation-form" onSubmit={async e=>{
    e.preventDefault(); const form=e.currentTarget; const data=Object.fromEntries(new FormData(form));
    setBusy(true);setError('');setMessage('');
    try {await submit(data);setMessage('Saved successfully.');form.reset();} catch(e){setError(e.message);} finally{setBusy(false);}
  }}><h3>{title}</h3>{fields.map(f=><label key={f.name}>{f.label}{f.options
    ? <select name={f.name} defaultValue={f.defaultValue} required={f.required!==false}>{f.options.map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select>
    : f.type==='textarea' ? <textarea name={f.name} required={f.required!==false} minLength={f.minLength} maxLength={f.maxLength||2000}/>
    : <input name={f.name} type={f.type||'text'} required={f.required!==false} minLength={f.minLength} maxLength={f.maxLength||100} />}</label>)}
    <button className="outline" disabled={busy}>{busy?'Saving…':action}</button>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </form>,lang);
}

function Resource({ path, children }) {
  const lang=useContext(OperationsLanguage);
  const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const reload=()=>setRevision(x=>x+1);
  useEffect(()=>{let active=true;setError('');api(path).then(x=>{if(active)setData(validateCommunityResponse(path,x));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[path,revision]);
  if(error)return <p role="alert">{error} <button onClick={reload}>Retry</button></p>;
  if(data===null)return <p role="status">Loading…</p>;
  try {return localizeOperations(children(data,reload),lang);} catch {return <p role="alert">This section could not be displayed. <button onClick={reload}>Retry</button></p>;}
}

export function OperationsPanel({user,openBooking,lang='en'}) {
  const [lowData,setLowData]=useState(localStorage.getItem('ys-low-data')==='1');
  const farmer=canRent(user),owner=user.roles.includes('owner'),fpo=user.roles.includes('fpo');
  const [assisted,setAssisted]=useState(null),[assistError,setAssistError]=useState(''),[assistBusy,setAssistBusy]=useState(false);
  const run=async fn=>{setAssistBusy(true);setAssistError('');try{await fn();}catch(e){setAssistError(e.message);}finally{setAssistBusy(false);}};
  return <OperationsLanguage.Provider value={lang}>{localizeOperations(<section className="operations-panel"><h2>{({hi:'समुदाय और सहायता',pa:'ਭਾਈਚਾਰਾ ਅਤੇ ਸਹਾਇਤਾ'})[lang]||'Community & support'}</h2>
    <label className="photo-preference"><input type="checkbox" checked={lowData} onChange={e=>{setLowData(e.target.checked);localStorage.setItem('ys-low-data',e.target.checked?'1':'0');window.dispatchEvent(new Event('ys:photo-preference'));}}/><span>Load photos only when requested (saves data)</span></label>
    <p>Your account ID: <code style={{overflowWrap:'anywhere'}}>{user.id}</code></p>
    <Resource path="/notification-preferences">{(p,reload)=><OperationForm title="In-app rental reminders" fields={[{name:'reminders',label:'Reminders',defaultValue:p.reminders?'Enabled':'Disabled',options:['Enabled','Disabled']}]} action={`Currently ${p.reminders?'enabled':'disabled'} · Update`} submit={async d=>{await api('/notification-preferences',{reminders:d.reminders==='Enabled'});reload();}}/>}</Resource>
    <p>Reminders appear in Activity when you open it. Email and SMS delivery are not enabled.</p>
    {farmer&&<Resource path="/saved-machines">{(items,reload)=><section><h3>Saved equipment</h3>{!items.length&&<p>Save equipment from Explore to find it here.</p>}{items.map(m=><article key={m.id}><h4>{m.name} · {m.village}</h4><p>{INR(m.rate)} / {m.unit}</p><button className="primary" onClick={()=>openBooking(m)}>Check dates & rent</button><OperationForm title="Remove saved equipment" fields={[]} action="Remove" submit={async()=>{await api('/saved-machines/'+m.id,null,'DELETE');reload();}}/></article>)}</section>}</Resource>}
    <RentalGuides/>
    <SupportHub/>
    <Resource path="/demand">{(data,reload)=><section><h3>Request unavailable equipment</h3>{farmer&&<OperationForm title="Tell owners what your village needs" fields={[{name:'village',label:'Village or town',minLength:2},{name:'category',label:'Equipment',options:['Tractor','Rotavator','Harvester','Seed drill','Sprayer','Cultivator']},{name:'needed_at',label:'Needed by',type:'datetime-local'},{name:'notes',label:'Notes (private to your account)',type:'textarea',required:false,maxLength:500}]} submit={async d=>{await api('/demand',{...d,needed_at:new Date(d.needed_at).toISOString()});reload();}}/>}
      <p>These are requests, not confirmed rentals. Owners can see village demand totals, not your contact details. Direct owner offers are not available here yet.</p>
      {data.summary.length?<ul>{data.summary.map((x,i)=><li key={i}>{x.village}: {x.category} · {x.requests} requests · earliest {dt(x.earliest)}</li>)}</ul>:<p>No open demand yet.</p>}
      {data.mine.filter(x=>x.status==='OPEN').map(x=><OperationForm key={x.id} title={`${x.category} in ${x.village} · ${dt(x.needed_at)}${Date.parse(x.needed_at)<=Date.now()?' · date passed':''}`} fields={[]} action="Close my request" submit={async()=>{await api('/demand/'+x.id+'/close',{});reload();}}/>)}</section>}</Resource>
    {(farmer||fpo)&&<Resource path="/delegations">{(grants,reload)=><section><h3>FPO booking assistance</h3><p>A farmer can allow an FPO coordinator to request rentals on their behalf for 7 days. Revoke permission at any time. Existing rental requests remain the farmer’s responsibility.</p>
      {farmer&&<OperationForm title="Allow a coordinator" fields={[{name:'coordinator_id',label:'Coordinator account ID'}]} action="Grant 7-day permission" submit={async d=>{await api('/delegations',d);reload();}}/>}
      {grants.map(g=><article key={g.farmer_id+g.coordinator_id}><p>{g.farmer_name} → {g.coordinator_name} · expires {dt(g.expires_at)}</p>{g.farmer_id===user.id?<OperationForm title="Your permission" fields={[]} action="Revoke" submit={async()=>{await api('/delegations/'+g.coordinator_id,null,'DELETE');reload();}}/>:fpo&&<OperationForm title={`Request equipment for ${g.farmer_name}`} fields={[{name:'machine_id',label:'Equipment ID (from equipment card)'}]} action="Check equipment & dates" submit={async d=>setAssisted({machine:await api('/machines/'+d.machine_id),farmer:g.farmer_id})}/>}</article>)}
      {assisted&&<div className="operation-form"><button onClick={()=>setAssisted(null)}>Close assisted request</button><BookingForm machine={assisted.machine} online busy={assistBusy} run={run} lang={lang} assistedFarmerId={assisted.farmer} onDone={async d=>{await api('/assisted-bookings',{...d,farmer_id:assisted.farmer});setAssisted(null);reload();}}/>{assistError&&<p role="alert">{assistError}</p>}</div>}
    </section>}</Resource>}
    {farmer&&<Resource path="/rental-groups">{(groups,reload)=><section><h3>Village rental groups</h3><p>Share the group ID only with intended members. Joining shares equipment, dates and individual costs with the group. Every member books and pays the owner separately; availability conflicts still apply.</p>
      <OperationForm title="Create a group" fields={[{name:'name',label:'Group name',minLength:3}]} submit={async d=>{await api('/rental-groups',d);reload();}}/>
      <OperationForm title="Join a group" fields={[{name:'id',label:'Group ID'}]} action="Join and share rental details" submit={async d=>{await api('/rental-groups/'+d.id+'/join',{});reload();}}/>
      {groups.map(g=><article key={g.id}><h4>{g.name}</h4><p>Invite ID: <code style={{overflowWrap:'anywhere'}}>{g.id}</code></p><p>Choose this group in the booking form.</p><OperationForm title="Stop sharing with this group" fields={[]} action="Leave group" submit={async()=>{await api('/rental-groups/'+g.id+'/leave',{});reload();}}/>{g.bookings.map(b=><p key={b.id}>{b.machine_name} · {dt(b.start_at)} → {dt(b.end_at)} · {b.status} · {INR(b.final_total??b.estimate)}</p>)}</article>)}</section>}</Resource>}
    {owner&&<Resource path="/fleet-utilization">{items=><section><h3>Fleet utilization</h3><p>Hours are scheduled hours of completed rentals. Payment figures are manually reported, not independently verified.</p>{items.map(m=><article key={m.id}><h4>{m.name}</h4><p>{m.completed_rentals} completed · {Number(m.scheduled_hours_completed).toFixed(1)} scheduled hours</p><p>Billed {INR(m.billed_total)} · reported paid {INR(m.manually_reported_paid)}</p></article>)}</section>}</Resource>}
    <Resource path="/capabilities">{c=>c.admin&&<section><h3>Staff workspace</h3><Resource path="/admin/support">{(cases,reload)=>cases.map(c=><article key={c.id}><p>{c.kind} · {c.description} · {c.status}</p><SupportThread item={c} onChange={reload}/><OperationForm title={`Case ${c.id}`} fields={[{name:'status',label:'Status',options:['IN_REVIEW','RESOLVED','OPEN']},{name:'resolution',label:'Response to reporter',type:'textarea',minLength:3}]} submit={async d=>{await api('/admin/support/'+c.id,d);reload();}}/></article>)}</Resource>
      <Resource path="/admin/content-reports">{(reports,reload)=><section><h3>Listing reports for review</h3>{!reports.length&&<p>No listing reports.</p>}{reports.map(r=><article key={r.id}><h4>{r.machine_name} · {r.reason} · {r.status}</h4><p>{r.description}</p><p>Equipment ID: {r.machine_id}</p>{r.resolution&&<p>{r.resolution}</p>}<OperationForm title="Update report" fields={[{name:'status',label:'Status',options:['IN_REVIEW','RESOLVED','OPEN']},{name:'resolution',label:'Response to reporter',type:'textarea',minLength:3}]} submit={async d=>{await api('/admin/content-reports/'+r.id,d);reload()}}/></article>)}<p>Resolving a report does not automatically hide a listing. Use the moderation controls when warranted.</p></section>}</Resource>
      <OperationForm title="Restrict or restore equipment / account" fields={[{name:'type',label:'Record type',options:['machines','users']},{name:'id',label:'Record ID'},{name:'state',label:'Action',options:['Restrict','Restore']},{name:'reason',label:'Reason',type:'textarea',minLength:5,maxLength:500}]} submit={d=>api('/admin/'+d.type+'/'+d.id,{restricted:d.state==='Restrict',reason:d.reason})}/>
      <Resource path="/pilot-metrics">{m=><div><h3>Pilot metrics</h3><ul>{Object.entries(m.bookings).map(([k,v])=><li key={k}>{k}: {v}</li>)}</ul><p>Average owner response: {m.average_response_minutes.value===null?'No responses yet':Number(m.average_response_minutes.value).toFixed(1)+' minutes'}</p><p>Farmers with multiple requests: {m.repeat_farmers.count}</p>{m.support.map((s,i)=><p key={i}>{s.kind} · {s.status}: {s.count}</p>)}</div>}</Resource>
    </section>}</Resource>
  </section>,lang)}</OperationsLanguage.Provider>;
}
