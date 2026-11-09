import React,{useState,useEffect} from 'react';
export function ProfileAvatar({user}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[user.id,user.profile_photo_version]);
 const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
 return user.profile_photo_version&&!failed?<img className="profile-avatar-image" src={`${base}/api/me/photo?v=${encodeURIComponent(user.profile_photo_version)}`} alt="Your profile picture" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{user.name?.charAt(0)||'?'}</span>;
}
