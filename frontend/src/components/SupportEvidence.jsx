import React,{useState} from 'react';
import {api} from '../api';
import {helpCopy} from '../data/helpContent';
export function SupportEvidence({id,report=false,lang='en'}){
 const [rows,setRows]=useState([]),[error,setError]=useState(false);
 const kind=report?'reports':'support',base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
 return <details onToggle={async e=>{if(e.currentTarget.open)try{setRows(await api(`/help-evidence/${kind}/${id}`));setError(false)}catch{setError(true)}}}><summary>{helpCopy.photos[lang]}</summary>{error&&<p role="alert">{helpCopy.error[lang]}</p>}{rows.map(p=><a key={p.id} href={`${base}/api/help-evidence/${kind}/${id}/${p.id}`} target="_blank" rel="noreferrer"><img src={`${base}/api/help-evidence/${kind}/${id}/${p.id}`} alt={helpCopy.photos[lang]} style={{width:120,height:90,objectFit:'cover'}}/></a>)}</details>;
}
