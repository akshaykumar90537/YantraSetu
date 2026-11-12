import React, {useState} from 'react';
import {Search, MapPin, CalendarDays, Bookmark, ArrowRight} from 'lucide-react';
import {VillagePicker} from './VillagePicker';

export function DashboardWelcome({user, place, locationBusy, locationError, onPlace, onLocate, query, setQuery, onSearch, onBookings, onSaved}) {
 const [editingLocation, setEditingLocation] = useState(false);
 return <div className="farmer-dashboard-intro">
  <div className="dashboard-welcome">
   <div><span className="eyebrow">YOUR FIELD COMPANION</span><h1>Welcome back, {user.name}</h1><p>Find the right equipment and plan your next rental.</p></div>
   <div className="dashboard-location"><MapPin size={20}/><div><span>Selected village or town</span><strong>{place?.label || place?.name || 'Choose your village'}</strong></div><button type="button" className="outline" aria-expanded={editingLocation} aria-controls="dashboard-location-picker" onClick={()=>setEditingLocation(value=>!value)}>{place ? 'Change location' : 'Select location'}</button></div>
  </div>
  {editingLocation && <div id="dashboard-location-picker" className="dashboard-location-picker">
   <VillagePicker latitude={place?.lat??''} longitude={place?.lon??''} selectedPlace={place} customLabel="" label="Village or town" onChange={p=>{onPlace({...p,source:'selected'});setEditingLocation(false);}}/>
   <button type="button" className="outline" disabled={locationBusy} onClick={onLocate}><MapPin size={18}/>{locationBusy?'Finding your village…':'Use my current location'}</button>
  </div>}
  {locationBusy&&<p role="status">Identifying your village or town…</p>}
  {locationError&&<p role="alert">{locationError}</p>}
  <form className="dashboard-equipment-search" role="search" aria-label="Find equipment" onSubmit={e=>{e.preventDefault();onSearch();}}>
   <label htmlFor="dashboard-equipment-query">What equipment do you need?</label>
   <div><Search size={22} aria-hidden="true"/><input id="dashboard-equipment-query" type="search" value={query} onChange={e=>setQuery(e.target.value)} maxLength={120} placeholder="Search tractors, harvesters, sprayers…"/><button className="primary" type="submit">Find machinery <ArrowRight size={18}/></button></div>
   <p>{place ? `Search equipment in ${place.label || place.name}.` : 'Select your village above, or choose a location when you search.'}</p>
  </form>
  <nav className="dashboard-quick-actions" aria-label="Quick actions">
   <button type="button" onClick={onSearch}><Search size={24}/><span><strong>Find Machinery</strong><small>Explore equipment near your village</small></span><ArrowRight size={18}/></button>
   <button type="button" onClick={onBookings}><CalendarDays size={24}/><span><strong>My Bookings</strong><small>Track requests, pickup and returns</small></span><ArrowRight size={18}/></button>
   <button type="button" onClick={onSaved}><Bookmark size={24}/><span><strong>Saved Equipment</strong><small>Revisit equipment you saved</small></span><ArrowRight size={18}/></button>
  </nav>
 </div>;
}
