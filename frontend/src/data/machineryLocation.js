export function localityName(value){return String(value||'').split(',')[0].trim().toLocaleLowerCase();}
export function matchesLocality(machine,place){return !!place?.name&&localityName(machine.village)===localityName(place.name);}
export function parseCurrentPlace(data,lat,lon){
 const a=data?.address||{};const name=a.village||a.town||a.city||a.hamlet;
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lon)||a.country_code!=='in')throw new Error('Could not identify your village or town. Please select it manually.');
 return {name,lat,lon,label:[...new Set([name,a.state_district||a.county,a.state].filter(Boolean))].join(', '),source:'current'};
}
export async function reverseLocality(lat,lon){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{const params=new URLSearchParams({format:'jsonv2',lat,lon,zoom:'18',addressdetails:'1','accept-language':'en'});
 const r=await fetch('https://nominatim.openstreetmap.org/reverse?'+params,{signal:controller.signal,credentials:'omit'});
 if(!r.ok)throw new Error('Village lookup is unavailable. Please select your village manually.');
 return parseCurrentPlace(await r.json(),Number(lat),Number(lon));}finally{clearTimeout(timeout)}
}
export function currentCoordinates(){return new Promise((resolve,reject)=>{
 if(!navigator.geolocation){reject(new Error('Location is unavailable. Please select your village or town.'));return;}
 navigator.geolocation.getCurrentPosition(p=>{if(p.coords.accuracy>3000){reject(new Error('Location is too approximate. Please select your village or town.'));return;}resolve(p.coords)},e=>reject(new Error(e.code===1?'Location permission was denied. Select your village or town.':'Could not get your current location. Select your village or town or retry.')),{enableHighAccuracy:true,maximumAge:0,timeout:12000});
});}
