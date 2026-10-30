import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Search,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  CalendarDays,
  Tractor,
  Route,
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
} from 'lucide-react';
import { api } from './api';
import { dict, INR, dt, translate } from './locales';
import { TractorArt } from './components/TractorArt';
import { FormField, Stat, TimeFields } from './components/Common';
import { LoginForm } from './components/LoginForm';
import { MachineCard } from './components/MachineCard';
import { MachineForm } from './components/MachineForm';
import { BookingCard } from './components/BookingCard';
import { BookingForm } from './components/BookingForm';
import { MeterForm } from './components/MeterForm';
import { ConfirmMeter } from './components/ConfirmMeter';
import { Invoice } from './components/Invoice';
import './style.css';

export function App() {
  const [lang, setLang] = useState(localStorage.getItem('ys-lang') || 'en');
  const t = (k, p) => translate(lang, k, p);

  const [u, setUser] = useState(null);
  const [tab, setTab] = useState('explore');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);

  const [machines, setMachines] = useState([]);
  const [rows, setRows] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState('5');
  const [lat, setLat] = useState('30.901');
  const [lon, setLon] = useState('75.857');
  const [cached, setCached] = useState(false);
  const [searched, setSearched] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    api('/me').then(setUser).catch(() => {});
    search();

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
      load();
      setDrafts(JSON.parse(localStorage.getItem('ys-drafts-' + u.id) || '[]'));
    } else {
      setRows([]);
      setFleet([]);
      setOrgs([]);
      setNotifications([]);
      setDrafts([]);
    }
  }, [u]);

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

  async function search() {
    const key = `ys-search-${lat}-${lon}-${radius}-${category}`;
    try {
      const data = await api(
        `/machines?latitude=${lat}&longitude=${lon}&radius=${radius}&category=${encodeURIComponent(
          category
        )}`
      );
      setMachines(data);
      localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), data }));
      setCached(false);
    } catch (e) {
      const cache = localStorage.getItem(key);
      if (cache) {
        setMachines(JSON.parse(cache).data);
        setCached(true);
      } else {
        setMachines([]);
        setError(e.message);
      }
    }
    setSearched(true);
  }

  async function load() {
    const [b, f, o, n] = await Promise.all([
      api('/bookings'),
      api('/fleet'),
      api('/organizations'),
      api('/notifications'),
    ]);
    setRows(b);
    setFleet(f);
    setOrgs(o);
    setNotifications(n);
  }

  function saveDrafts(next) {
    setDrafts(next);
    localStorage.setItem('ys-drafts-' + u.id, JSON.stringify(next));
  }

  const nav = [
    ['explore', Search, t('explore')],
    ['bookings', CalendarDays, t('bookings')],
    ...(u?.roles.includes('owner')
      ? [
          ['fleet', Tractor, t('fleet')],
          ['routes', Route, t('routes')],
        ]
      : []),
    ...(u?.roles.includes('fpo') ? [['org', Users, t('org')]] : []),
    ['activity', Bell, t('activity')],
  ];

  function openBooking(m) {
    if (!u) {
      setModal({ type: 'login' });
      return;
    }
    setModal({ type: 'book', machine: m });
  }

  const completed = rows.filter((b) => b.status === 'COMPLETED');

  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('explore');
          }}
        >
          <span className="brand-mark">
            <Sprout size={25} />
          </span>
          <span>
            YantraSetu<small>{t('growingTogether')}</small>
          </span>
        </a>
        <div className="workspace-label">{t('companion')}</div>
        <nav>
          {nav.map(([key, Icon, label]) => (
            <button
              key={key}
              className={tab === key ? 'nav-item selected' : 'nav-item'}
              onClick={() => {
                setTab(key);
                setError('');
                if (u) run(load);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {key === 'routes' && <i>LINK</i>}
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
              <div className="avatar">{u.name.charAt(0)}</div>
              <div>
                <strong>{u.name}</strong>
                <small>{u.roles.map((r) => t('role' + r.charAt(0).toUpperCase() + r.slice(1)) || r).join(' · ')}</small>
              </div>
              <button
                aria-label={t('signOut')}
                className="icon"
                onClick={() =>
                  run(async () => {
                    await api('/auth/logout', {});
                    setUser(null);
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
          <div className="breadcrumb">
            YantraSetu <ChevronRight size={14} />
            <strong>{t(tab)}</strong>
          </div>
          <div className="header-right">
            {u ? (
              <button
                className="icon mobile-auth"
                aria-label={t('signOut')}
                onClick={() =>
                  run(async () => {
                    await api('/auth/logout', {});
                    setUser(null);
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

          {tab === 'explore' ? (
            <>
              <section className="hero">
                <div className="hero-content">
                  <div className="eyebrow">
                    <span /> {t('eyebrow')}
                  </div>
                  <h1>{t('headline')}</h1>
                  <p>{t('sub')}</p>
                  <div className="hero-benefits">
                    <span>
                      <ShieldCheck size={16} /> {t('clearRentalRates')}
                    </span>
                    <span>
                      <MapPin size={16} /> {t('nearbyOwners')}
                    </span>
                  </div>
                </div>
                <div className="hero-art">
                  <TractorArt large />
                  <span className="art-note">{t('artNote')}</span>
                  <div className="floating-note">
                    <span className="leaf-circle">
                      <Sprout size={20} />
                    </span>
                    <div>
                      <strong>{t('betterTogether')}</strong>
                      <small>{t('oneVillage')}</small>
                    </div>
                  </div>
                </div>
              </section>

              <form
                className="search-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(search);
                }}
              >
                <div className="search-location">
                  <MapPin size={21} />
                  <div>
                    <label>{t('location')}</label>
                    <div className="coordinates">
                      <input
                        aria-label="Latitude"
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        required
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                      />
                      <span>,</span>
                      <input
                        aria-label="Longitude"
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        required
                        value={lon}
                        onChange={(e) => setLon(e.target.value)}
                      />
                    </div>
                    <small>{t('enterCoordinates')}</small>
                  </div>
                </div>
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
              </form>

              <section className="how-strip">
                <span>
                  <b>01</b> {t('howStep1')}
                </span>
                <ChevronRight />
                <span>
                  <b>02</b> {t('howStep2')}
                </span>
                <ChevronRight />
                <span>
                  <b>03</b> {t('howStep3')}
                </span>
                <small>{t('howNote')}</small>
              </section>

              <div className="section-title">
                <div>
                  <div className="eyebrow muted">{t('nearSubtitle')}</div>
                  <h2>{t('near')}</h2>
                  <p>
                    {cached
                      ? t('cachedListings')
                      : t('listingsCount', { count: machines.length, radius })}
                  </p>
                </div>
                <button
                  className="outline"
                  onClick={() => (u ? setModal({ type: 'machine' }) : setModal({ type: 'login' }))}
                >
                  <Plus size={16} /> {t('listMachine')}
                </button>
              </div>

              <div className="cards">
                {machines.map((m, i) => (
                  <MachineCard
                    key={m.id}
                    machine={m}
                    index={i}
                    onBook={openBooking}
                    lang={lang}
                  />
                ))}
              </div>

              {searched && !machines.length && (
                <div className="empty">
                  <Tractor size={38} />
                  <h3>{t('noMachineryFound')}</h3>
                  <p>{t('noMachinerySub')}</p>
                </div>
              )}

              <section className="link-promo">
                <div className="link-icon">
                  <Route size={30} />
                </div>
                <div>
                  <span className="eyebrow">{t('meetYantraLink')}</span>
                  <h2>{t('yantraLinkTitle')}</h2>
                  <p>{t('yantraLinkSub')}</p>
                </div>
                <button
                  className="outline"
                  onClick={() => {
                    if (!u) setModal({ type: 'login' });
                    else setTab('routes');
                  }}
                >
                  {t('exploreRoutes')} <ArrowUpRight size={17} />
                </button>
              </section>
            </>
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
                  {tab === 'bookings' && (
                    <>
                      <div className="stats">
                        <Stat
                          label={t('activeBookings')}
                          value={
                            rows.filter((b) =>
                              ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(b.status)
                            ).length
                          }
                        />
                        <Stat
                          label={t('ownerEarnings')}
                          value={INR(
                            completed
                              .filter((b) => b.owner_id === u.id)
                              .reduce((s, b) => s + Number(b.final_total), 0)
                          )}
                        />
                        <Stat
                          label={t('farmerExpenditures')}
                          value={INR(
                            completed
                              .filter((b) => b.farmer_id === u.id)
                              .reduce((s, b) => s + Number(b.final_total), 0)
                          )}
                        />
                      </div>
                      <p className="caption">{t('billedCaption')}</p>

                      {drafts.length > 0 && (
                        <section className="panel">
                          <h3>{t('savedOffline')}</h3>
                          {drafts.map((d) => (
                            <div className="draft" key={d.idempotency_key}>
                              <span>{dt(d.start_at)}</span>
                              <button
                                className="outline"
                                disabled={!online}
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

                      {rows.map((b) => (
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
                      ))}

                      {!rows.length && (
                        <div className="empty">
                          <CalendarDays size={36} />
                          <h3>{t('noBookingsYet')}</h3>
                          <p>{t('noBookingsSub')}</p>
                        </div>
                      )}
                    </>
                  )}

                  {tab === 'fleet' && (
                    <>
                      <button className="primary" onClick={() => setModal({ type: 'machine' })}>
                        <Plus size={17} />
                        {t('addMachinery')}
                      </button>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>{t('equipmentCol')}</th>
                              <th>{t('locationCol')}</th>
                              <th>{t('rateCol')}</th>
                              <th>{t('availabilityCol')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fleet.map((m) => (
                              <tr key={m.id}>
                                <td>
                                  <strong>{m.name}</strong>
                                  <small>{m.category}</small>
                                </td>
                                <td>{m.village}</td>
                                <td>
                                  {INR(m.rate)} / {m.unit === 'hour' ? t('perHour') : t('perAcre')}
                                </td>
                                <td>
                                  <button
                                    className="outline"
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
                                    onClick={() => setModal({ type: 'maintenance', machine: m })}
                                  >
                                    {t('blockTimeBtn')}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {tab === 'routes' && (
                    <>
                      <div className="route-intro">
                        <Route size={42} />
                        <h2>{t('routeIntroTitle')}</h2>
                        <p>{t('routeIntroSub')}</p>
                      </div>
                      <form
                        className="panel inline-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.target);
                          run(async () =>
                            setRouteResult(
                              await api(`/routes/${f.get('machine')}?day=${f.get('day')}`)
                            )
                          );
                        }}
                      >
                        <FormField label={t('yourMachine')}>
                          <select name="machine" required>
                            <option value="">{t('selectEquipment')}</option>
                            {fleet.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label={t('workingDay')}>
                          <input name="day" type="date" required />
                        </FormField>
                        <button className="primary" disabled={busy || !fleet.length}>
                          {t('calculateRouteBtn')} <ArrowRight size={16} />
                        </button>
                      </form>

                      {routeResult && (
                        <section className="panel">
                          {routeResult.feasible ? (
                            <>
                              <div className="stats">
                                <Stat
                                  label={t('separateTripsEst')}
                                  value={routeResult.baseline_km + ' km'}
                                />
                                <Stat
                                  label={t('combinedRouteEst')}
                                  value={routeResult.estimated_km + ' km'}
                                />
                                <Stat
                                  label={t('potentialSaved')}
                                  value={routeResult.saved_km + ' km'}
                                />
                              </div>
                              <ol className="timeline">
                                {routeResult.stops.map((s) => (
                                  <li key={s.id}>
                                    <strong>Booking {s.id.slice(0, 8)}</strong>
                                    <span>
                                      {Math.floor(s.start_minute / 60)}:
                                      {String(Math.floor(s.start_minute % 60)).padStart(2, '0')}{' '}
                                      · {s.leg_km} km estimated travel
                                    </span>
                                  </li>
                                ))}
                              </ol>
                              <p>{routeResult.assumptions}</p>
                              <small>
                                {routeResult.solver} · {t('solverTime')}: {routeResult.elapsed_ms}{' '}
                                ms
                              </small>
                            </>
                          ) : (
                            <div className="alert">{routeResult.reason}</div>
                          )}
                        </section>
                      )}
                    </>
                  )}

                  {tab === 'org' && (
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

                  {tab === 'activity' && (
                    <>
                      <div className="banner">{t('notificationsBanner')}</div>
                      {notifications.map((n) => (
                        <div className="notification" key={n.id}>
                          <Bell size={19} />
                          <div>
                            <p>{n.message}</p>
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
            <span>{t('footerNotice')}</span>
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

            {modal.type === 'login' && (
              <LoginForm
                busy={busy}
                run={run}
                onUser={(v) => {
                  setUser(v);
                  setModal(null);
                }}
                lang={lang}
              />
            )}

            {modal.type === 'book' && (
              <BookingForm
                machine={modal.machine}
                online={online}
                busy={busy}
                run={run}
                onDone={async (d, offline) => {
                  if (offline) {
                    saveDrafts([...drafts, d]);
                    setNotice(
                      'Saved offline. No reservation exists until server acceptance.'
                    );
                  } else {
                    await api('/bookings', d);
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
                    await api('/machines', data);
                    await load();
                    await search();
                    setModal(null);
                    setNotice('Machine listed.');
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
              <>
                <h2>{t('rateCompletedTitle')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.target);
                    run(async () => {
                      await api('/bookings/' + modal.b.id + '/rating', {
                        score: Number(f.get('score')),
                        comment: f.get('comment'),
                      });
                      setModal(null);
                      setNotice('Your rating was saved.');
                    });
                  }}
                >
                  <FormField label={t('ratingLabel')}>
                    <select name="score">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label={t('yourExperienceLabel')}>
                    <textarea name="comment" maxLength="500" />
                  </FormField>
                  <button className="primary">{t('saveRatingBtn')}</button>
                </form>
              </>
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

