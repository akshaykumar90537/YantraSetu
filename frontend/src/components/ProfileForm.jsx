import {ProfileAvatar} from './ProfileAvatar';
import React,{useState} from 'react';
import {api} from '../api';
import {FormField} from './Common';
export function ProfileForm({user,onSaved}) {
 const [name,setName]=useState(user.name),[language,setLanguage]=useState(user.language||'en'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [photo,setPhoto]=useState(undefined),[preview,setPreview]=useState(''),[photoError,setPhotoError]=useState(''),[photoBusy,setPhotoBusy]=useState(false);
 const restricted=()=>window.alert('You are restricted to change this information.');
 const restrictedKey=e=>{if(e.key==='Enter'||e.key===' '||e.key==='Backspace'||e.key==='Delete'||(e.key.length===1&&!e.ctrlKey&&!e.metaKey)){e.preventDefault();restricted();}};
 return <><h2>Manage profile</h2><p>Update your picture, name and preferred language.</p>
 <form onSubmit={async e=>{e.preventDefault();if(photoBusy||photoError)return;setBusy(true);setError('');setSaved(false);try{const updated=await api('/me',{name:name.trim(),language,...(photo!==undefined?{photo}: {})},'PATCH');onSaved(updated);setName(updated.name);setPhoto(undefined);setPreview('');setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}}}>
 <div className="profile-picture-preview">{preview?<img src={preview} alt="Selected profile picture preview"/>:photo===null?<span>{name.charAt(0)}</span>:<ProfileAvatar user={user}/>}</div>
 <FormField label="Profile picture"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||photoBusy} onChange={async e=>{
  const file=e.target.files?.[0];if(!file)return;setPhotoError('');setSaved(false);
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1000000){setPhotoError('Choose a JPEG, PNG or WebP photo under 1 MB.');e.target.value='';return;}
  setPhotoBusy(true);try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)});setPreview(data);setPhoto(data.split(',')[1]);}catch{setPhotoError('Could not read this photo. Please choose it again.')}finally{setPhotoBusy(false)}
 }}/></FormField><p>Choose a photo under 1 MB. It is saved when you select Save profile. Location metadata is removed.</p>
 <button type="button" disabled={busy||photoBusy} onClick={()=>{setPhoto(null);setPreview('');setPhotoError('');setSaved(false)}}>Remove profile picture</button>
 {photoError&&<p role="alert">{photoError}</p>}
 <FormField label="Your name"><input required minLength={2} maxLength={80} value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} autoComplete="name"/></FormField>
 <FormField label="Preferred language"><select value={language} onChange={e=>{setLanguage(e.target.value);setSaved(false)}}><option value="en">English</option><option value="hi">हिन्दी</option><option value="pa">ਪੰਜਾਬੀ</option></select></FormField>
 <FormField label="Sign-in email"><input value={user.email||'Not provided'} readOnly onClick={restricted} onKeyDown={restrictedKey} onPaste={e=>{e.preventDefault();restricted()}}/></FormField>
 <FormField label="Account role"><input value={user.roles.join(' · ')} readOnly onClick={restricted} onKeyDown={restrictedKey} onPaste={e=>{e.preventDefault();restricted()}}/></FormField>
 {user.phone&&<FormField label="Registered phone"><input value={user.phone} readOnly/></FormField>}
 <p>Sign-in details and account roles cannot be changed here. Rental contact numbers are supplied when booking.</p>
 {error&&<p role="alert">{error}</p>}{saved&&<p role="status">Profile saved successfully.</p>}
 <button className="primary" disabled={busy||photoBusy||!!photoError||name.trim().length<2}>{busy?'Saving…':'Save profile'}</button>
 </form></>;
}
