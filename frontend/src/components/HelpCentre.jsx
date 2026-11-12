import React,{useEffect,useRef,useState} from 'react';
import {Search,CalendarDays,Tractor,Wallet,ShieldCheck,Flag,Headphones,ChevronDown} from 'lucide-react';
import {api} from '../api';
import {helpCopy,helpFaqs,helpGuides,issueKinds,reportKinds} from '../data/helpContent';
import {SupportStaff} from './OperationsPanel';
import './HelpCentre.css';
const refFor=(row,report)=>`${report?'YS-R':'YS-S'}-${row.id.toUpperCase()}`;
const closed=s=>['RESOLVED','CLOSED'].includes(s);
const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
function Highlight({text,query}){const at=text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());return !query||at<0?text:<>{text.slice(0,at)}<mark>{text.slice(at,at+query.length)}</mark>{text.slice(at+query.length)}</>;}
export function HelpCentre({lang='en'}){
 const t=key=>helpCopy[key]?.[lang]||helpCopy[key]?.en||key;
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[form,setForm]=useState(null),[revision,setRevision]=useState(0),[notice,setNotice]=useState('');
 const helpRef=useRef(null),formRef=useRef(null);
 const matches=helpFaqs.filter(f=>(category==='all'||f.category===category)&&`${f.question[lang]} ${f.answer[lang]}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const cards=[['booking',CalendarDays],['rental',Tractor],['payment',Wallet],['safety',ShieldCheck],['report',Flag],['contact',Headphones]];
 function open(report){setForm(report?'report':'support');setNotice('');}
 useEffect(()=>{if(form){formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});formRef.current?.focus();}},[form]);
 return <section className="help-centre"><div className="help-hero"><span className="help-kicker">YantraSetu</span><h1>{t('title')}</h1><p>{t('subtitle')}</p><label className="help-search"><Search aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('search')} aria-label={t('search')}/></label></div>
 <nav className="help-quick" aria-label={t('title')}>{cards.map(([key,Icon])=><button key={key} onClick={()=>{if(key==='report'||key==='contact')open(key==='report');else{setCategory(key);setQuery('');helpRef.current?.scrollIntoView({behavior:'smooth'});helpRef.current?.focus();}}}><Icon/><strong>{t(key)}</strong><small>{key==='report'?t('privacy'):key==='contact'?t('create'):helpFaqs.find(f=>f.category===key).question[lang]}</small></button>)}</nav>
 <section className="help-section" ref={helpRef} tabIndex={-1}><h2>{t('faq')}</h2><div className="help-filters">{['all','booking','rental','payment','safety'].map(key=><button key={key} aria-pressed={category===key} onClick={()=>setCategory(key)}>{t(key)}</button>)}</div>
 <div className="help-accordions">{matches.map(f=><details key={f.id}><summary><Highlight text={f.question[lang]} query={query.trim()}/><ChevronDown aria-hidden="true"/></summary><div className="help-answer"><Highlight text={f.answer[lang]} query={query.trim()}/></div></details>)}{!matches.length&&<p role="status">{t('empty')}</p>}</div><div className="help-assistance"><strong>{t('still')}</strong><button className="primary" onClick={()=>open(false)}>{t('create')}</button><button className="outline" onClick={()=>open(true)}>{t('report')}</button></div></section>
 <section className="help-section"><h2>{t('guides')}</h2><div className="help-guides">{helpGuides.filter(g=>(category==='all'||g.category===category)&&`${g.title[lang]} ${g.ids.map(id=>helpFaqs[id].answer[lang]).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((g,i)=><details key={g.ids.join('-')}><summary><ShieldCheck aria-hidden="true"/>{g.title[lang]}<ChevronDown aria-hidden="true"/></summary><ol>{g.ids.map(id=><li key={id}>{helpFaqs[id].answer[lang]}</li>)}</ol></details>)}</div></section>
 <p className="help-warning">{t('emergency')}</p>
 {notice&&<p role="status" className="help-success">{notice}</p>}
 {form&&<section className="help-section" ref={formRef} tabIndex={-1}><RequestForm report={form==='report'} key={form} t={t} onClose={()=>setForm(null)} onSaved={row=>{setNotice(t('success')+' '+refFor(row,form==='report'));setForm(null);setRevision(r=>r+1);}}/></section>}
 <div className="help-histories"><History report={false} revision={revision} t={t} lang={lang} onCreate={()=>open(false)}/><History report revision={revision} t={t} lang={lang} onCreate={()=>open(true)}/></div>
 <SupportStaff lang={lang}/>
 </section>;
}
function RequestForm({report,t,onClose,onSaved}){
 const [bookings,setBookings]=useState([]),[loadError,setLoadError]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[invalid,setInvalid]=useState({});const key=useRef(crypto.randomUUID());const lock=useRef(false);
 useEffect(()=>{let alive=true;api('/bookings').then(rows=>{if(alive)setBookings(rows)}).catch(()=>{if(alive)setLoadError(true)});return()=>{alive=false}},[]);
 async function submit(e){e.preventDefault();if(lock.current)return;const form=e.currentTarget,data=new FormData(form);setError('');lock.current=true;setBusy(true);
 try{const photos=data.getAll('photos').filter(f=>f.size);if(photos.length>3||photos.some(f=>f.size>1000000||!['image/jpeg','image/png','image/webp'].includes(f.type)))throw new Error('validation');
 const machine=data.get('machine_id').trim();if(machine&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(machine))throw new Error('validation');
 const encoded=await Promise.all(photos.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)})));
 const payload={description:data.get('description'),machine_id:machine||null,booking_id:data.get('booking_id')||null,request_key:key.current,photos:encoded};if(report)payload.reason=data.get('kind');else{payload.kind=data.get('kind');payload.subject=data.get('subject')}
 const row=await api(report?'/content-reports':'/support',payload);onSaved(row);
 }catch(e){setError(e.message==='validation'||e.status===422?t('invalid'):t('error'))}finally{lock.current=false;setBusy(false)}}
 return <form className="help-form" onSubmit={submit} onInvalid={e=>{e.preventDefault();setInvalid(fields=>({...fields,[e.target.name]:true}));e.target.focus();}} onInput={e=>setInvalid(fields=>({...fields,[e.target.name]:false}))}><h2>{t(report?'report':'create')}</h2><p>{t('privacy')}</p><label>{t('category')} *<select name="kind" required>{(report?reportKinds:issueKinds).map(k=><option value={k} key={k}>{t(k)}</option>)}</select></label>
 <label>{t('bookingRef')}<select name="booking_id"><option value="">{t('noBooking')}</option>{bookings.map(b=><option key={b.id} value={b.id}>{b.machine_name} · {new Date(b.start_at).toLocaleDateString()}</option>)}</select>{loadError&&<small role="alert">{t('error')}</small>}</label>
 <label>{t('listingRef')}<input name="machine_id" maxLength={36}/></label>
 {!report&&<label>{t('subject')} *<input name="subject" minLength={3} maxLength={120} required aria-invalid={!!invalid.subject}/>{invalid.subject&&<small className="help-error" role="alert">{t("invalid")}</small>}</label>}
 <label>{t('description')} *<textarea name="description" required minLength={10} maxLength={2000} rows={5} aria-invalid={!!invalid.description}/>{invalid.description&&<small className="help-error" role="alert">{t("invalid")}</small>}</label>
 <label>{t('photos')}<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"/></label>
 {error&&<p role="alert" className="help-error">{error}</p>}<div className="help-form-actions"><button className="primary" disabled={busy}>{t(busy?'sending':'submit')}</button><button type="button" className="outline" disabled={busy} onClick={onClose}>{t('cancel')}</button></div></form>;
}
function History({report,revision,t,lang,onCreate}){
 const [page,setPage]=useState(0),[rows,setRows]=useState(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{setPage(0)},[revision]);
 useEffect(()=>{let alive=true;setRows(null);setError(false);api(`${report?'/content-reports':'/support'}?offset=${page*10}&limit=10`).then(data=>{if(alive)setRows(data)}).catch(()=>{if(alive)setError(true)});return()=>{alive=false}},[report,page,revision,retry]);
 return <section className="help-section"><div className="help-history-heading"><h2>{t(report?'reports':'tickets')}</h2><button className="outline" onClick={()=>setRetry(r=>r+1)}>{t('refresh')}</button></div>{error?<p role="alert">{t('error')}</p>:rows===null?<p role="status">{t('loading')}</p>:!rows.length?<p>{t('none')}</p>:rows.map(row=><article key={row.id} className="help-ticket"><div className="help-ticket-title"><strong>{row.subject||t(row.kind||row.reason)}</strong><span className="help-status">{t(row.status)}</span></div><small className="help-reference">{refFor(row,report)}</small><p>{t(row.kind||row.reason)}</p><small>{t('created')}: {new Date(row.created_at).toLocaleString(lang)}<br/>{t('updated')}: {new Date(row.updated_at).toLocaleString(lang)}</small><TicketDetail row={row} report={report} t={t}/></article>)}<div className="help-form-actions"><button className="outline" onClick={onCreate}>{t(report?'report':'create')}</button><button disabled={!page} onClick={()=>setPage(p=>p-1)}>{t('previous')}</button><button disabled={!rows||rows.length<10} onClick={()=>setPage(p=>p+1)}>{t('next')}</button></div></section>;
}
function TicketDetail({row,report,t}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState([]),[photos,setPhotos]=useState([]),[error,setError]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!open)return;let alive=true;setError(false);Promise.all([report?Promise.resolve([]):api(`/support/${row.id}/messages`),api(`/help-evidence/${report?'reports':'support'}/${row.id}`)]).then(([m,p])=>{if(alive){setMessages(m);setPhotos(p)}}).catch(()=>{if(alive)setError(true)});return()=>{alive=false}},[open,row.id,report,revision]);
 return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>{t('details')}<ChevronDown aria-hidden="true"/></summary>{open&&<div className="help-answer"><p>{row.description}</p>{row.resolution&&<p>{t('staff')}: {row.resolution}</p>}{photos.map(p=><a key={p.id} href={`${base}/api/help-evidence/${report?'reports':'support'}/${row.id}/${p.id}`} target="_blank" rel="noreferrer"><img className="help-evidence" src={`${base}/api/help-evidence/${report?'reports':'support'}/${row.id}/${p.id}`} alt={t('photos')}/></a>)}{messages.map(m=><article key={m.id}><strong>{t(m.is_staff?'staff':'you')}</strong><p>{m.body}</p>{m.status&&<small>{t(m.status)}</small>}</article>)}{error&&<p role="alert">{t('error')} <button onClick={()=>setRevision(r=>r+1)}>{t('refresh')}</button></p>}{!report&&!closed(row.status)&&<form className="help-form" onSubmit={async e=>{e.preventDefault();const f=e.currentTarget;setBusy(true);try{await api(`/support/${row.id}/messages`,{body:new FormData(f).get('body')});f.reset();setRevision(r=>r+1)}catch{setError(true)}finally{setBusy(false)}}}><label>{t('reply')}<textarea name="body" required minLength={3} maxLength={2000}/></label><button className="primary" disabled={busy}>{t(busy?'sending':'submit')}</button></form>}</div>}</details>;
}
