import React, { useState } from 'react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function MeterForm({ booking: b, run, busy, lang = 'en' }) {
  const [result, setResult] = useState(null);
  const [photos,setPhotos]=useState([]),[photoError,setPhotoError]=useState(''),[readingPhotos,setReadingPhotos]=useState(false),[charges,setCharges]=useState([]);
  const stage = b.status === 'APPROVED' ? 'start' : 'end';
  const t = (k, p) => translate(lang, k, p);

  return (
    <>
      <h2>{stage === 'start' ? 'Equipment pickup confirmation' : 'Equipment return confirmation'}</h2>
      <p>{t('meterFarmerInstruction')}</p>
      {b.meter_start !== null && (
        <p>{t('confirmedStartLabel', { val: b.meter_start })}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          if(photoError || readingPhotos)return;
          run(async () =>
            setResult(
              await api('/bookings/' + b.id + '/meter/request', {
                stage, condition:f.get('condition'), photos:photos.map(x=>x.split(',')[1]), additional_charges:charges,
                reading: f.get('reading'),
                acres: f.get('acres') || null,
              })
            )
          );
        }}
      >
        <FormField label={t('meterReadingHours')}>
          <input
            name="reading"
            type="number"
            min="0"
            max="100000000"
            step="0.001"
            required
          />
        </FormField>
        {stage === 'end' && b.unit === 'acre' && (
          <FormField label={t('completedAcreage')}>
            <input
              name="acres"
              type="number"
              min="0.001"
              max="10000"
              step="0.001"
              required
            />
          </FormField>
        )}
        <FormField label="Equipment condition / handover notes (optional)"><textarea name="condition" maxLength={2000} placeholder="Record existing damage, accessories, fuel level or return condition"/></FormField>
        <FormField label="Evidence photos (optional)"><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || readingPhotos} onChange={async e=>{
          const files=Array.from(e.target.files||[]);setPhotos([]);setPhotoError('');
          if(files.length>3 || files.some(f=>f.size>1000000)){setPhotoError('Choose up to 3 photos, each under 1 MB.');return;}
          setReadingPhotos(true);try{setPhotos(await Promise.all(files.map(f=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(f);}))))}catch{setPhotoError('Could not read photos. Please choose them again.')}finally{setReadingPhotos(false);}
        }}/></FormField>
        <p>Photos are private to booking participants. Avoid identity documents and people. Location metadata is removed.</p>
        {photos.map((src,i)=><img src={src} key={i} alt={`Evidence preview ${i+1}`} style={{width:100,height:80,objectFit:'cover'}}/>)}
        {photoError&&<p role="alert">{photoError}</p>}
        {stage==='end'&&<fieldset><legend>Additional one-time charges</legend><p>Enter only charges you have discussed with the renter. They must review and confirm these with the return OTP.</p>
          {charges.map((x,i)=><div key={i}><FormField label={`Charge ${i+1} description`}><input required minLength={3} maxLength={160} value={x.description} onChange={e=>setCharges(charges.map((v,n)=>n===i?{...v,description:e.target.value}:v))}/></FormField>
          <FormField label={`Charge ${i+1} amount (₹)`}><input type="number" required min="0.01" max="100000" step="0.01" value={x.amount} onChange={e=>setCharges(charges.map((v,n)=>n===i?{...v,amount:e.target.value}:v))}/></FormField>
          <button type="button" onClick={()=>setCharges(charges.filter((_,n)=>n!==i))}>Remove charge</button></div>)}
          <button type="button" disabled={charges.length>=10} onClick={()=>setCharges([...charges,{description:'',amount:''}])}>Add charge</button></fieldset>}
        <label><input type="checkbox" required/>I confirm these readings, condition notes and any additional charges for this handover.</label>
        <button className="primary" disabled={busy || readingPhotos || !!photoError}>
          {t('requestFarmerConfirmationBtn')}
        </button>
      </form>

      {result && !result.development_code && (
        <div className="banner" role="status">Verification code submitted for delivery to the renter’s registered contact. Ask them to review the evidence and charges before confirming within 5 minutes.</div>
      )}
      {result?.development_code && (
        <div className="dev-code">
          {t('devOnlyCode')}: <strong>{result.development_code}</strong>
          <small>{t('devCodeInstruction')}</small>
        </div>
      )}
    </>
  );
}

