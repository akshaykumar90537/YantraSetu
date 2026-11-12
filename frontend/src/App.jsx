import {bookingFilters,matchesBookingFilter} from './data/bookingWorkspace';
import {currentCoordinates,reverseLocality,matchesLocality} from './data/machineryLocation';
import {ProfileAvatar} from './components/ProfileAvatar';
import { ProfileForm } from './components/ProfileForm';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sprout,
  Bookmark,
  Search,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  CalendarDays,
  Tractor,
  Users,
  LogOut,
  Bell,
  Globe,
  Check,
  Plus,
  X,
  ShieldCheck,
  ChevronRight,
  WifiOff,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  CloudSun,
} from 'lucide-react';
import { canRent, api } from './api';
import { dict, INR, dt, translate } from './locales';
import { VillagePicker, recentVillage } from './components/VillagePicker';
import { FleetWeek, bookingGroup } from './components/FleetWeek';
import { FormField, Stat, TimeFields } from './components/Common';
import { LoginForm } from './components/LoginForm';
import { MachineCard } from './components/MachineCard';
import { MachineForm } from './components/MachineForm';
import { BookingCard } from './components/BookingCard';
import { BookingForm } from './components/BookingForm';
import { MeterForm } from './components/MeterForm';
import { ConfirmMeter } from './components/ConfirmMeter';
import { Invoice } from './components/Invoice';
import { MapPicker } from './components/MapPicker';
import { RatingModal } from './components/RatingModal';
import { WeatherDashboard } from './components/WeatherDashboard';
import { LandingPage } from './components/LandingPage';
import './style.css';
import {DashboardWelcome} from './components/DashboardWelcome';
import { OperationsPanel, SavedEquipment } from './components/OperationsPanel';
import { AuthGate } from './components/AuthGate';

export function App() {
  const [entry, setEntry] = useState(null);
  const [lang, setLang] = useState(localStorage.getItem('ys-lang') || 'en');

  return (
    <AuthGate>
      {(user, onLogout, signIn) =>
        user ? (
          <Workspace key={user.id} initialUser={user} entry={entry} onLogout={onLogout} sharedLang={lang} setSharedLang={setLang} />
        ) : (
          <LandingPage
            onUser={(user, intent) => { setEntry(intent); signIn(user); }}
            lang={lang}
            setLang={setLang}
          />
        )
      }
    </AuthGate>
  );
}

function Workspace({ entry, initialUser, onLogout, sharedLang, setSharedLang }) {
  const [lang, setLangLocal] = useState(sharedLang || localStorage.getItem('ys-lang') || 'en');
  const setLang = (v) => { setLangLocal(v); if (setSharedLang) setSharedLang(v); };
  const t = (k, p) => translate(lang, k, p);

  const [u, setUser] = useState(initialUser);
  const isOwner = u.roles.includes('owner');
  const rentalAllowed = canRent(u);
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 1024;
    }
    return true;
  });
  const [error, setError] = useState(() => entry?.type === 'machine' && !initialUser.roles.includes('owner') ? t('ownerRequired') : entry?.type === 'book' && !rentalAllowed ? t('rentalRoleRule') : entry?.machine?.owner_id === initialUser.id ? t('ownMachineError') : '');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(() => {
    if (entry?.type === 'machine' && initialUser.roles.includes('owner')) return entry;
    if (entry?.type === 'book' && rentalAllowed && entry.machine.owner_id !== initialUser.id) return entry;
    return null;
  });
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);

  const [machines, setMachines] = useState([]);
  const [rows, setRows] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [category, setCategory] = useState('');
  const [equipmentQuery,setEquipmentQuery]=useState('');
  const [bookingFilter,setBookingFilter]=useState('ALL');
  const [radius, setRadius] = useState('5');
  const [lat, setLat] = useState(() => String(recentVillage().lat));
  const [lon, setLon] = useState(() => String(recentVillage().lon));
  const [searchPlace,setSearchPlace]=useState(null);
  const placeRef=useRef(null), locationVersion=useRef(0);
  const searchFilters=useRef({radius,category});searchFilters.current={radius,category};
  const [locationBusy,setLocationBusy]=useState(false),[locationError,setLocationError]=useState('');
  const [calendarDate,setCalendarDate] = useState(null);
  const searchVersion = useRef(0);
  const [cached, setCached] = useState(false);
  const [searched, setSearched] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [showMap, setShowMap] = useState(true);
  const [mapPin, setMapPin] = useState(null);

  useEffect(() => {

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('ys-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Modal accessibility & focus trap
  useEffect(() => {
    if (!modal) return;
    const prev = document.activeElement;
    const dialog = document.querySelector('[role=dialog]');
    const focusable = () =>
      dialog
        ? [...dialog.querySelectorAll('button,input,select,textarea,summary,[href]')].filter(
            (e) => !e.disabled
          )
        : [];
    focusable()[0]?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const nodes = focusable();
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      prev?.focus();
    };
  }, [modal?.type]);

  useEffect(() => {
    if (u) {
      load().catch(e => setError(e.message));
      setDrafts(JSON.parse(localStorage.getItem('ys-drafts-' + u.id) || '[]'));
    } else {
      setRows([]);
      setFleet([]);
      setOrgs([]);
      setNotifications([]);
      setDrafts([]);
    }
  }, [u]);

  useEffect(()=>{if(u && ['activity','bookings'].includes(tab))load().catch(e=>setError(e.message));},[tab,u.id]);

  async function run(fn) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function clearSearch(){++searchVersion.current;setMachines([]);setSearched(false);setCached(false);}
  function selectSearchPlace(place){
    setMapPin(null);++locationVersion.current;placeRef.current=place;setSearchPlace(place);setLocationBusy(false);setLocationError('');clearSearch();search(place);
  }
  async function selectMapLocation(latitude, longitude) {
    const version = ++locationVersion.current;
    setMapPin([Number(latitude), Number(longitude)]);
    placeRef.current = null; setSearchPlace(null); clearSearch();
    setLocationBusy(true); setLocationError('');
    try {
      const place = await reverseLocality(latitude, longitude);
      if (version !== locationVersion.current) return;
      const selected = {...place, source: 'selected'};
      placeRef.current = selected; setSearchPlace(selected); search(selected);
    } catch (e) {
      if (version === locationVersion.current) setLocationError(e.message || 'Could not identify this village. Select a village above or try another pin.');
    } finally {
      if (version === locationVersion.current) setLocationBusy(false);
    }
  }
  async function locateVillage(){
    setMapPin(null);const version=++locationVersion.current;placeRef.current=null;setSearchPlace(null);clearSearch();setLocationBusy(true);setLocationError('');
    try{const coords=await currentCoordinates();if(version!==locationVersion.current)return;
      const place=await reverseLocality(coords.latitude,coords.longitude);if(version!==locationVersion.current)return;
      placeRef.current=place;setSearchPlace(place);search(place);
    }catch(e){if(version===locationVersion.current)setLocationError(e.message||'Select your village manually.');}
    finally{if(version===locationVersion.current)setLocationBusy(false);}
  }
  useEffect(()=>{if(tab==='explore'&&(!placeRef.current||placeRef.current.source==='current'))locateVillage();
    return()=>{++locationVersion.current;};},[tab]);
  useEffect(()=>{if(placeRef.current)search(placeRef.current);},[category,radius]);
  async function search(place=placeRef.current) {
    const version=++searchVersion.current;setMachines([]);setSearched(false);setCached(false);
    if(!place?.name)return;
    try{
      const params=new URLSearchParams({latitude:place.lat,longitude:place.lon,...searchFilters.current,locality:place.name});
      const data=await api('/machines?'+params);
      if(version!==searchVersion.current)return;
      if(!Array.isArray(data))throw new Error('Unexpected equipment response. Please retry.');
      setMachines(data.filter(m=>matchesLocality(m,place)));setSearched(true);
    }catch(e){if(version===searchVersion.current){setMachines([]);setError(e.message);}}
  }

  const latestLoad = useRef(0);
  const [dataState,setDataState] = useState({});
  const [revision,setRevision] = useState(0);
  async function load() {
    const id = ++latestLoad.current;
    const sources = [['bookings',setRows],['notifications',setNotifications]];
    if (isOwner) sources.push(['fleet',setFleet]);
    if (u.roles.includes('fpo')) sources.push(['organizations',setOrgs]);
    await Promise.all(sources.map(async ([key,save]) => {
      try {
        const data = await api('/'+key);
        if (!Array.isArray(data)) throw new Error();
        if (id !== latestLoad.current) return;
        save(data);
        setDataState(prev=>({...prev,[key]:'ready'}));
      } catch {
        if (id === latestLoad.current) setDataState(prev=>({...prev,[key]:'error'}));
      }
    }));
    if(id === latestLoad.current) setRevision(n=>n+1);
  }

  function loadingOrError(keys) {
    const failed=keys.some(key=>dataState[key]==='error');
    if(failed) return <div className="alert" role="alert">{keys.includes('bookings') && dataState.bookings==='error' ? t('bookingError') : t('workError')} <button className="outline" onClick={()=>run(load)}>{t('retrySearch')}</button></div>;
    if(keys.some(key=>dataState[key]!=='ready')) return <p role="status">{t('loadingWork')}</p>;
    return null;
  }

  function saveDrafts(next) {
    setDrafts(next);
    localStorage.setItem('ys-drafts-' + u.id, JSON.stringify(next));
  }

  const nav = [
    ['dashboard', CalendarDays, t('dashboard')],
    ['explore', Search, t('explore')],
    ['bookings', CalendarDays, t('bookings')],
    ...(rentalAllowed ? [['saved', Bookmark, t('saved')]] : []),
    ['weather', CloudSun, t('weatherTab')],
    ...(u?.roles.includes('owner')
      ? [
          ['fleet', Tractor, t('fleet')],
        ]
      : []),
    ...(u?.roles.includes('fpo') ? [['org', Users, t('org')]] : []),
    ['activity', Bell, t('activity')],
    ['community', Users, ({hi:'मदद और सहायता',pa:'ਮਦਦ ਅਤੇ ਸਹਾਇਤਾ'})[lang] || 'Help & Support'],
  ];

  function openBooking(m) {
    if (!u) {
      setModal({ type: 'login' });
      return;
    }
    if (!rentalAllowed) {
      setError(t('rentalRoleRule'));
      return;
    }
    if (m.owner_id === u.id) {
      setError('You cannot book your own equipment.');
      return;
    }
    if (m.active === false || m.is_active === false) {
      setError('This equipment is currently unavailable.');
      return;
    }
    setModal({ type: 'book', machine: m });
  }

  const [scrollTarget,setScrollTarget] = useState('');
  function showBookings(id) { setBookingFilter('ALL'); setTab('bookings'); setScrollTarget(id); }
  useEffect(() => {
    if (tab !== 'bookings' || !scrollTarget || dataState.bookings !== 'ready') return;
    document.getElementById(scrollTarget)?.scrollIntoView({block:'start'});
    setScrollTarget('');
  },[tab,scrollTarget,dataState.bookings]);
  const active = rows.filter(b=>['PENDING','APPROVED','IN_PROGRESS'].includes(b.status)).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
  const pending = active.filter(b=>b.owner_id===u.id && b.status==='PENDING');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const todayJobs = active.filter(b=>b.owner_id===u.id && b.status!=='PENDING' && Date.parse(b.start_at)<tomorrow && Date.parse(b.end_at)>today);
  const upcomingReturns=active.filter(b=>b.owner_id===u.id&&['APPROVED','IN_PROGRESS'].includes(b.status)).sort((a,b)=>Date.parse(a.end_at)-Date.parse(b.end_at)).slice(0,5);
  const nextRental = active.find(b=>b.status==='IN_PROGRESS') || active.find(b=>Date.parse(b.end_at)>Date.now());
  const completed = (Array.isArray(rows) ? rows : []).filter((b) => b && b.status === 'COMPLETED');

  return (
    <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <a
            className="brand"
            href="#dashboard"
            aria-label="Go to dashboard"
            onClick={(e) => {
              e.preventDefault();
              setTab('dashboard');
              setError('');
              setModal(null);
              if (window.innerWidth <= 1024) setSidebarOpen(false);
            }}
          >
            <img src="/icon.svg" width="40" height="40" alt="" style={{ flexShrink: 0 }} />
            <span className="brand-text">
              YantraSetu<small>{t('growingTogether')}</small>
            </span>
          </a>
          <button
            type="button"
            className="sidebar-toggle-btn"
            aria-label="Collapse sidebar"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="workspace-label">{t('companion')}</div>
        <nav>
          {nav.map(([key, Icon, label]) => (
            <button
              key={key}
              className={tab === key ? 'nav-item selected' : 'nav-item'}
              onClick={() => {
                setTab(key);
                setError('');
                if (window.innerWidth <= 760) setSidebarOpen(false);
                if (u) run(load);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <Sprout size={26} />
          <h3>{t('ownLessTitle')}</h3>
          <p>{t('ownLessDesc')}</p>
          <span>
            {t('builtForRuralIndia')} <ArrowUpRight size={14} />
          </span>
        </div>
        <div className="account">
          {u ? (
            <>
              <button type="button" className="account-profile" aria-label="Manage profile" onClick={()=>{setModal({type:'profile'});if(window.innerWidth<=1024)setSidebarOpen(false);}}>
              <span className="avatar"><ProfileAvatar user={u}/></span>
              <div>
                <strong>{u.name}</strong>
                <small>{u.roles.map((r) => t('role' + r.charAt(0).toUpperCase() + r.slice(1)) || r).join(' · ')}</small>
              </div>
              </button>
              <button
                aria-label={t('signOut')}
                className="icon"
                onClick={() =>
                  run(async () => {
                    await api('/auth/logout', {});
                    onLogout();
                    setTab('explore');
                  })
                }
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button className="primary full" onClick={() => setModal({ type: 'login' })}>
              {t('sign')}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </aside>

      <div className="main">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!sidebarOpen && (
              <button
                type="button"
                className="sidebar-open-btn"
                aria-label="Expand sidebar"
                onClick={() => setSidebarOpen(true)}
                title="Expand sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <div className="breadcrumb">
              YantraSetu <ChevronRight size={14} />
              <strong>{t(tab)}</strong>
            </div>
          </div>
          <div className="header-right">
            {u ? (
              <button
                className="icon mobile-auth"
                aria-label={t('signOut')}
                onClick={() =>
                  run(async () => {
                    await api('/auth/logout', {});
                    onLogout();
                    setTab('explore');
                  })
                }
              >
                <LogOut size={17} />
              </button>
            ) : (
              <button className="text-button mobile-auth" onClick={() => setModal({ type: 'login' })}>
                {t('sign')}
              </button>
            )}
            <span className="pilot">
              <span /> {t('punjabPilot')}
            </span>
            <Globe size={17} />
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="pa">ਪੰਜਾਬੀ</option>
            </select>
          </div>
        </header>

        <main>
          {!online && (
            <div className="banner">
              <WifiOff size={17} />
              {t('offlineBanner')}
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              <button className="icon" aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={17} />
              </button>
            </div>
          )}
          {notice && (
            <div className="banner" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}

          {tab === 'saved' && rentalAllowed ? <section><h1>Saved Equipment</h1><p>Your saved equipment across villages. Check its location and availability before requesting a rental.</p><SavedEquipment openBooking={openBooking} lang={lang}/></section> : tab === 'community' ? <OperationsPanel user={u} openBooking={openBooking} lang={lang}/> : tab === 'dashboard' ? <section className="work-dashboard">
            {rentalAllowed ? <DashboardWelcome user={u} place={searchPlace} locationBusy={locationBusy} locationError={locationError} onPlace={selectSearchPlace} onLocate={locateVillage} query={equipmentQuery} setQuery={setEquipmentQuery} onSearch={()=>setTab('explore')} onBookings={()=>setTab('bookings')} onSaved={()=>setTab('saved')}/> : <div className="section-title"><div><span className="eyebrow">{t('dashboard')}</span><h1>{u.name}</h1></div></div>}
            {loadingOrError(isOwner?['bookings','fleet']:['bookings']) || (isOwner ? <div className="work-tiles">
              <article><h2>{t('requestsReview')}</h2><strong>{pending.length}</strong>{pending.slice(0,5).map(b=><p key={b.id}>{b.machine_name} · {b.farmer_name}<br/>{dt(b.start_at)} · {INR(b.estimate)}<br/>Respond by {dt(b.response_due_at)}</p>)}<button className="primary" disabled={!pending.length} onClick={()=>showBookings('actionGroup')}>{t('reviewRequests')}</button></article>
              <article><h2>{t('todayJobs')}</h2><strong>{todayJobs.length}</strong>{todayJobs.map(b=><button className="text-button" key={b.id} onClick={()=>showBookings('booking-'+b.id)}>{b.machine_name} · {dt(b.start_at)}</button>)}</article>
              <article><h2>Upcoming returns</h2>{upcomingReturns.length?upcomingReturns.map(b=><button className="text-button" key={b.id} onClick={()=>showBookings('booking-'+b.id)}>{b.machine_name} · {dt(b.end_at)} · {t(b.status)}</button>):<p>No upcoming returns.</p>}</article>
              <article><h2>{t('fleet')}</h2><strong>{fleet.length}</strong><button className="outline" onClick={()=>setTab('fleet')}>{t('fleetWeek')}</button><button className="text-button" onClick={()=>setModal({type:'machine'})}>{t('addMachinery')}</button></article>
            </div> : <article className="panel next-rental"><h2>{t('nextRental')}</h2>{nextRental ? <>
              <strong>{nextRental.machine_name}</strong><p>Estimated cost: {INR(nextRental.estimate)}</p>{['APPROVED','IN_PROGRESS'].includes(nextRental.status)&&(nextRental.owner_phone?<a className="outline" href={'tel:'+nextRental.owner_phone}>Call {nextRental.owner_name || 'owner'}</a>:<p>Owner phone not provided. Open the booking for support.</p>)}<p>{dt(nextRental.start_at)} – {dt(nextRental.end_at)}</p>
              <p>{t(nextRental.status)} · {t(nextRental.needs_meter_confirmation && nextRental.farmer_id===u.id ? 'confirmReadingBtn' : nextRental.status==='PENDING' ? 'waitingOwner' : 'viewDetails')}</p>
              <button className="primary" onClick={()=>showBookings('booking-'+nextRental.id)}>{t('viewDetails')}</button></> : <p>{t('noUpcoming')}</p>}
              {rentalAllowed && <button className={nextRental?'outline':'primary'} onClick={()=>setTab('explore')}>{t('findVillage')}</button>}</article>)}
          </section> : tab === 'explore' ? (
            <>
              <h1>{t('explore')}</h1>
              <FormField label="Search equipment by name or type"><input className="equipment-query-input" type="search" value={equipmentQuery} onChange={e=>setEquipmentQuery(e.target.value)} maxLength={120} placeholder="Tractor, harvester, sprayer…"/></FormField>

              <form
                className="search-panel machinery-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(search);
                }}
              >
                <VillagePicker latitude={searchPlace?.lat??''} longitude={searchPlace?.lon??''} selectedPlace={searchPlace} label={t('villagePicker')} customLabel="" onClear={locateVillage} hideHint hintId="machinery-village-hint"
                  onChange={p=>selectSearchPlace({...p,source:'selected'})} />
                <FormField label={t('equipmentType')}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">{t('allMachinery')}</option>
                    {[
                      'Tractor',
                      'Rotavator',
                      'Harvester',
                      'Seed drill',
                      'Sprayer',
                      'Cultivator',
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={t('searchRadius')}>
                  <select value={radius} onChange={(e) => setRadius(e.target.value)}>
                    {[5, 10, 20, 50].map((r) => (
                      <option value={r} key={r}>
                        {r} km
                      </option>
                    ))}
                  </select>
                </FormField>
                <button className="primary" disabled={busy}>
                  <Search size={18} />
                  {t('search')}
                </button>
                <small id="machinery-village-hint" className="machinery-search-hint">Type a name, then select the correct village and state. Online suggestions use OpenStreetMap.</small>
              </form>

              <p role="status">{locationBusy?'Identifying your village or town…':searchPlace?`Showing only equipment listed in ${searchPlace.label||searchPlace.name}, within ${radius} km.`:'Select your village or allow location access to see equipment.'}</p>
              {locationError&&<p role="alert">{locationError} <button type="button" onClick={locateVillage}>Retry current location</button></p>}
              <p className="muted">Current location uses browser permission and OpenStreetMap. Check the detected town before booking. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map attribution</a></p>
              {(() => {
                const visibleMachines = machines.filter(
                  (m) => (!equipmentQuery.trim() || `${m.name || ''} ${m.category || ''}`.toLocaleLowerCase().includes(equipmentQuery.trim().toLocaleLowerCase())) && matchesLocality(m,searchPlace) && m.active !== false && m.is_active !== false && (!u || m.owner_id !== u.id)
                );
                return (
                  <>
                    {u?.roles?.includes('owner') && fleet.length > 0 && (
                      <div style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '12px',
                        padding: '12px 18px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        fontSize: '13px',
                        color: '#166534',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Tractor size={20} color="#15803d" />
                          <span>
                            You have <strong>{fleet.length}</strong> equipment listed in your fleet. <em>(Your own machinery is managed under the Fleet tab to prevent self-booking).</em>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="outline"
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '6px 14px',
                            borderColor: '#86efac',
                            background: '#ffffff',
                            color: '#166534',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => setTab('fleet')}
                        >
                          Manage Fleet →
                        </button>
                      </div>
                    )}
                    <div className="section-title">
                      <div>
                        <div className="eyebrow muted">{t('nearSubtitle')}</div>
                        <h2>{t('near')}</h2>
                        <p>
                          {cached
                            ? t('cachedListings')
                            : t('listingsCount', { count: visibleMachines.length, radius })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className={showMap ? 'primary' : 'outline'}
                          onClick={() => setShowMap(value => !value)}
                          aria-expanded={showMap}
                          aria-controls="machinery-map-panel"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <MapPin size={16} />
                          {showMap ? 'Hide Map' : 'Show Map'}
                        </button>
                        {isOwner && <button className="outline" onClick={() => setModal({type:'machine'})}><Plus size={16} /> {t('listMachine')}</button>}
                      </div>
                    </div>

                    {showMap && (
                      <div id="machinery-map-panel" role="region" aria-label="Equipment map" style={{ marginBottom: '24px' }}>
                        <MapPicker
                          center={mapPin || (searchPlace ? [searchPlace.lat, searchPlace.lon] : [22.5, 79])}
                          zoom={mapPin || searchPlace ? 12 : 5}
                          showCenterMarker={Boolean(mapPin || searchPlace)}
                          showLocationTools={false}
                          onSelectLocation={selectMapLocation}
                          radius={Number(radius) || 5}
                          machines={visibleMachines}
                          interactive={true}
                          onSelectMachine={rentalAllowed ? openBooking : undefined}
                          height="380px"
                          showLocate={false}
                          lang={lang}
                        />
                        <p role="status">{locationBusy ? "Identifying the village or town…" : "Click the map or drag the pin to select a village. Equipment appears only after its village is identified."}</p>
                      </div>
                    )}

                    <div className="cards">
                      {visibleMachines.map((m, i) => (
                        <MachineCard
                          canSave={rentalAllowed}
                          key={m.id}
                          machine={m}
                          index={i}
                          onBook={rentalAllowed ? openBooking : undefined}
                          lang={lang}
                        />
                      ))}
                    </div>

                    {searched && !visibleMachines.length && (
                      <div className="empty">
                        <Tractor size={38} />
                        <h3>{t('noMachineryFound')}</h3>
                        <p>No equipment matches this village and distance. Select another village or distance to search again.</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : tab === 'weather' ? (
            <WeatherDashboard
              latitude={lat}
              longitude={lon}
              onSelectLocation={(newLat, newLon) => {
                setLat(newLat);
                setLon(newLon);
              }}
              lang={lang}
            />
          ) : (
            <>
              <div className="section-title">
                <div>
                  <div className="eyebrow muted">{t('workspaceEyebrow')}</div>
                  <h1 className="page-title">{t(tab)}</h1>
                  <p>{t('workspaceSub')}</p>
                </div>
                {u && (
                  <button className="outline" onClick={() => run(load)} disabled={busy}>
                    {t('refresh')}
                  </button>
                )}
              </div>

              {!u ? (
                <div className="empty">
                  <Users size={36} />
                  <h3>{t('workspaceEyebrow')}</h3>
                  <p>{t('signInToContinue')}</p>
                  <button className="primary" onClick={() => setModal({ type: 'login' })}>
                    {t('sign')}
                  </button>
                </div>
              ) : (
                <>
                  {tab === 'bookings' && (<>
                      <p>Manage requests, pickup, return and billing in one place.</p>
                      <nav className="booking-status-tabs" aria-label="Filter bookings by status">{bookingFilters.map(filter=><button type="button" key={filter.id} aria-pressed={bookingFilter===filter.id} onClick={()=>setBookingFilter(filter.id)}>{filter.label}<span>{dataState.bookings==='ready'?rows.filter(b=>matchesBookingFilter(b,filter.id)).length:'—'}</span></button>)}</nav>
                      {loadingOrError(['bookings']) || <><div className="stats">
                        <Stat
                          label={t('activeBookings')}
                          value={
                            (Array.isArray(rows) ? rows : []).filter((b) =>
                              b && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(b.status)
                            ).length
                          }
                        />
                        {isOwner && <Stat
                          label={t('billedEarnings')}
                          value={INR(
                            completed
                              .filter((b) => b && b.owner_id === u?.id)
                              .reduce((s, b) => s + Number(b.final_total || 0), 0)
                          )}
                        />}
                        {rentalAllowed && <Stat
                          label={t('billedCosts')}
                          value={INR(
                            completed
                              .filter((b) => b && b.farmer_id === u?.id)
                              .reduce((s, b) => s + Number(b.final_total || 0), 0)
                          )}
                        />}
                      </div>
                      <p className="caption">{t('billedCaption')}</p></>}

                      {drafts.length > 0 && (
                        <section className="panel">
                          <h3>{t('savedOffline')}</h3>
                          {drafts.map((d) => (
                            <div className="draft" key={d.idempotency_key}>
                              <span>{dt(d.start_at)}</span>
                              <button
                                className="outline"
                                disabled={busy || !online || !rentalAllowed}
                                onClick={() =>
                                  run(async () => {
                                    await api('/bookings', d);
                                    saveDrafts(
                                      drafts.filter(
                                        (x) => x.idempotency_key !== d.idempotency_key
                                      )
                                    );
                                    await load();
                                    setNotice('Request submitted. Owner approval is pending.');
                                  })
                                }
                              >
                                {t('submitToServer')}
                              </button>
                              <button
                                className="text-button"
                                onClick={() =>
                                  saveDrafts(
                                    drafts.filter((x) => x.idempotency_key !== d.idempotency_key)
                                  )
                                }
                              >
                                {t('discard')}
                              </button>
                            </div>
                          ))}
                        </section>
                      )}

                      {dataState.bookings === 'ready' && ['actionGroup','upcomingGroup','historyGroup'].map(group => {
                        const items = rows.filter(b => matchesBookingFilter(b,bookingFilter) && bookingGroup(b,u.id) === group).sort((a,b)=>(group==='historyGroup'?-1:1)*(Date.parse(a.start_at)-Date.parse(b.start_at)));
                        return items.length ? <section key={group} id={group}><h2>{t(group)} ({items.length})</h2>{items.map(b=><div id={'booking-'+b.id} key={b.id}>
                        <BookingCard
                          key={b.id}
                          booking={b}
                          user={u}
                          busy={busy}
                          run={run}
                          load={load}
                          setModal={setModal}
                          notify={setNotice}
                          lang={lang}
                        />
                        {isOwner && b.owner_id===u.id && b.status==='PENDING' && <button className="outline compare-week" onClick={()=>{setCalendarDate(b.start_at);setTab('fleet');}}>{t('compareWeek')}</button>}
                      </div>)}</section> : null; })}

                      {dataState.bookings === 'ready' && !rows.some(b=>matchesBookingFilter(b,bookingFilter)) && (
                        <div className="empty booking-empty">
                          <CalendarDays size={30} />
                          <h3>{rows.length ? `No ${bookingFilters.find(f=>f.id===bookingFilter)?.label.toLowerCase()} bookings` : t('noBookingsYet')}</h3>
                          <p>{rows.length ? 'Choose another status to view your rentals.' : t('noBookingsSub')}</p>
                          {rows.length ? <button className="outline" onClick={()=>setBookingFilter('ALL')}>Show all bookings</button> : rentalAllowed && <button className="primary" onClick={()=>setTab('explore')}>Find machinery</button>}
                        </div>
                      )}
                    </>
                  )}

                  {tab === 'fleet' && (
                    <>
                      {loadingOrError(['fleet','bookings']) || <FleetWeek initialDate={calendarDate} {...{fleet,rows,lang,t,revision}} onBooking={b=>showBookings('booking-'+b.id)} />}
                      <button className="primary" onClick={() => setModal({ type: 'machine' })}>
                        <Plus size={17} />
                        {t('addMachinery')}
                      </button>
                      {dataState.fleet === 'ready' && <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>{t('equipmentCol')}</th>
                              <th>{t('locationCol')}</th>
                              <th>{t('rateCol')}</th>
                              <th>Status</th>
                              <th>{t('availabilityCol')}</th>
                              <th>Listing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fleet.map((m) => {
                              const isActive = m.active !== false && m.is_active !== false;
                              return (
                                <tr key={m.id}>
                                  <td>
                                    <strong>{m.name}</strong>
                                    <small>{m.category} {m.model ? `· ${m.model}` : ''}</small>
                                  </td>
                                  <td>{m.village}</td>
                                  <td>
                                    {INR(m.rate)} / {m.unit === 'hour' ? t('perHour') : t('perAcre')}
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        background: isActive ? '#dcfce7' : '#f1f5f9',
                                        color: isActive ? '#15803d' : '#64748b',
                                        border: `1px solid ${isActive ? '#bbf7d0' : '#cbd5e1'}`,
                                        padding: '3px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        display: 'inline-block',
                                      }}
                                    >
                                      {isActive ? 'Active' : 'Delisted'}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      className="outline"
                                      disabled={!isActive}
                                      onClick={() =>
                                        run(async () =>
                                          setModal({
                                            type: 'availability',
                                            data: await api('/machines/' + m.id + '/availability'),
                                            machine: m,
                                          })
                                        )
                                      }
                                    >
                                      {t('calendarBtn')}
                                    </button>
                                    <button
                                      className="text-button"
                                      disabled={!isActive}
                                      onClick={() => setModal({ type: 'maintenance', machine: m })}
                                    >
                                      {t('blockTimeBtn')}
                                    </button>
                                  </td>
                                  <td>
                                    <button
                                      className="outline"
                                      style={{
                                        fontSize: '11px',
                                        padding: '5px 10px',
                                        marginRight: '6px',
                                      }}
                                      onClick={() => setModal({ type: 'machine', initialData: m })}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="outline"
                                      style={{
                                        color: isActive ? '#b91c1c' : '#15803d',
                                        borderColor: isActive ? '#fca5a5' : '#86efac',
                                        fontSize: '11px',
                                        padding: '5px 10px',
                                      }}
                                      onClick={() =>
                                        run(async () => {
                                          await api(`/machines/${m.id}/status`, { is_active: !isActive }, 'PATCH');
                                          await load();
                                        })
                                      }
                                    >
                                      {isActive ? 'Delist' : 'Relist'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>}
                    </>
                  )}

                  {tab === 'org' && (loadingOrError(['organizations']) ||
                    <>
                      <form
                        className="panel inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = new FormData(e.target).get('name');
                          run(async () => {
                            await api('/organizations', { name });
                            await load();
                          });
                        }}
                      >
                        <FormField label={t('fpoTitle')}>
                          <input name="name" required minLength="3" maxLength="100" />
                        </FormField>
                        <button className="primary">{t('createOrgBtn')}</button>
                      </form>
                      <p className="caption">{t('fpoNotice')}</p>
                      {orgs.map((o) => (
                        <div className="panel" key={o.id}>
                          <h3>{o.name}</h3>
                          <p>
                            {o.machines} {t('registeredMachines')}
                          </p>
                          <button
                            className="outline"
                            onClick={() =>
                              run(async () =>
                                setModal({
                                  type: 'json',
                                  title: o.name + ' bookings',
                                  data: await api('/organizations/' + o.id + '/bookings'),
                                })
                              )
                            }
                          >
                            {t('viewBookings')}
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {tab === 'activity' && (loadingOrError(['notifications']) ||
                    <>
                      <div className="banner">{t('notificationsBanner')}</div>
                      {notifications.map((n) => (
                        <div className="notification" key={n.id}>
                          <Bell size={19} />
                          <div>
                            <p>{n.message}</p>{!n.read_at && <button className="text-button" onClick={()=>run(async()=>{await api('/notifications/'+n.id+'/read',{});await load();})}>Mark read</button>}
                            <small>
                              {dt(n.created_at)} · {n.delivery}
                            </small>
                          </div>
                        </div>
                      ))}
                      {!notifications.length && <div className="empty">{t('noNotifications')}</div>}
                    </>
                  )}
                </>
              )}
            </>
          )}

          <footer>
            <span>
              <Sprout size={16} /> {t('footerTagline')}
            </span>
          </footer>
        </main>
      </div>

      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.type}
          >
            <button
              className="modal-close icon"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}

            {modal.type === 'profile' && <ProfileForm user={u} onSaved={updated=>{setUser({...u,...updated});setLang(updated.language);}}/>}
            {modal.type === 'login' && (
              <LoginForm
                busy={busy}
                run={run}
                onUser={(v) => {
                  setUser(v);
                  setModal(null);
                }}
                lang={lang}
                setLang={setLang}
              />
            )}

            {modal.type === 'book' && rentalAllowed && (
              <BookingForm
                machine={modal.machine}
                online={online}
                busy={busy}
                run={run}
                onDone={async (d, offline) => {
                  if (offline) {
                    saveDrafts([...drafts, d]);
                    setNotice(
                      t('unconfirmedDraft')
                    );
                  } else {
                    try { await api('/bookings', d); }
                    catch (err) {
                      if (err.status && err.status < 500 && err.status !== 200) throw err;
                      saveDrafts([...drafts.filter(x=>x.idempotency_key!==d.idempotency_key), d]);
                      setNotice(t('unconfirmedDraft'));
                      setModal(null); setTab('bookings'); return;
                    }
                    await load();
                    setNotice('Booking requested. Awaiting owner approval.');
                  }
                  setModal(null);
                  setTab('bookings');
                }}
                lang={lang}
              />
            )}

            {modal.type === 'machine' && (
              <MachineForm
                orgs={orgs}
                busy={busy}
                initialData={modal.initialData}
                onSubmit={(data) =>
                  run(async () => {
                    if (modal.initialData?.id) {
                      await api(`/machines/${modal.initialData.id}`, data, 'PATCH');
                      setNotice('Machine details updated successfully!');
                    } else {
                      await api('/machines', data);
                      setNotice('Machine listed successfully! Viewing in your Fleet.');
                    }
                    await load();
                    setModal(null);
                    setTab('fleet');
                  })
                }
                lang={lang}
              />
            )}

            {modal.type === 'availability' && (
              <>
                <h2>{modal.machine.name}</h2>
                <p>
                  Reserved intervals include the turnaround buffer. Pending requests also block the slot.
                </p>
                {[...modal.data.reserved, ...modal.data.maintenance].map((v, i) => (
                  <div className="notification" key={i}>
                    {dt(v.start_at)} → {dt(v.end_at)}
                    <b>{v.status || 'MAINTENANCE'}</b>
                  </div>
                ))}
                {!modal.data.reserved.length && !modal.data.maintenance.length && (
                  <p>{t('noIntervals')}</p>
                )}
              </>
            )}

            {modal.type === 'maintenance' && (
              <>
                <h2>{t('blockTimeTitle')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.target);
                    run(async () => {
                      await api(`/machines/${modal.machine.id}/maintenance`, {
                        start_at: new Date(f.get('start')).toISOString(),
                        end_at: new Date(f.get('end')).toISOString(),
                        reason: f.get('reason'),
                      });
                      setModal(null);
                      setNotice('Maintenance block saved.');
                      await load();
                    });
                  }}
                >
                  <TimeFields />
                  <FormField label={t('reasonLabel')}>
                    <input name="reason" required minLength="2" />
                  </FormField>
                  <button className="primary">{t('saveBlockBtn')}</button>
                </form>
              </>
            )}

            {modal.type === 'meter' && (
              <MeterForm booking={modal.b} busy={busy} run={run} lang={lang} />
            )}

            {modal.type === 'confirm-meter' && (
              <ConfirmMeter
                booking={modal.b}
                run={run}
                busy={busy}
                done={async () => {
                  await load();
                  setModal(null);
                  setNotice('Reading confirmed and booking updated.');
                }}
                lang={lang}
              />
            )}

            {modal.type === 'operator' && (
              <>
                <h2>{t('assignOperatorTitle')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const phone = new FormData(e.target).get('phone');
                    run(async () => {
                      await api('/bookings/' + modal.b.id + '/operator', { phone });
                      await load();
                      setModal(null);
                    });
                  }}
                >
                  <FormField label={t('operatorPhoneLabel')}>
                    <input
                      name="phone"
                      pattern="\+91[6-9][0-9]{9}"
                      required
                      placeholder="+919000000003"
                    />
                  </FormField>
                  <button className="primary">{t('assignOperatorBtn')}</button>
                </form>
              </>
            )}

            {modal.type === 'rating' && (
              <RatingModal
                booking={modal.b}
                user={u}
                lang={lang}
                onSubmitDone={async (msg) => {
                  await load();
                  await search();
                  setModal(null);
                  setNotice(msg);
                }}
              />
            )}

            {modal.type === 'invoice' && <Invoice data={modal.data} lang={lang} />}

            {modal.type === 'json' && (
              <>
                <h2>{modal.title}</h2>
                <pre>{JSON.stringify(modal.data, null, 2)}</pre>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

