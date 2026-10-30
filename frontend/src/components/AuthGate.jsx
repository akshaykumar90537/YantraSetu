import React, { useEffect, useState } from 'react';
import { Sprout, ArrowUpRight, Tractor, CalendarDays, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { LoginForm } from './LoginForm';
import { TractorArt } from './TractorArt';

export function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [login, setLogin] = useState(window.location.pathname !== '/');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(fn) { setBusy(true); setError(''); try { await fn(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  function signedIn(u) { setUser(u); setError(''); setLogin(false); window.history.replaceState({}, '', '/dashboard'); }
  function signedOut() { setUser(null); setLogin(false); setError(''); window.history.replaceState({}, '', '/'); }
  useEffect(() => {
    let active = true;
    api('/me').then(u => { if(active) signedIn(u); }).catch(e => { if(active && e.status !== 401) setError(e.message); }).finally(() => { if(active) setChecking(false); });
    const expired = () => { signedOut(); setLogin(true); setError('Your session expired. Please sign in again.'); };
    const navigate = () => setLogin(window.location.pathname !== '/');
    window.addEventListener('ys:unauthorized', expired); window.addEventListener('popstate', navigate);
    return () => { active = false; window.removeEventListener('ys:unauthorized', expired); window.removeEventListener('popstate', navigate); };
  }, []);
  if(checking) return <main className="auth-loading" role="status"><Sprout size={36} /><p>Checking your session…</p></main>;
  if(user) return children(user, signedOut);
  const openLogin = () => { setLogin(true); setError(''); window.history.pushState({}, '', '/login'); };
  return <div className="landing">
    <header className="landing-nav"><a href="/" className="landing-brand"><Sprout /> YantraSetu<span>AGRICULTURE, CONNECTED</span></a><button className="primary" onClick={openLogin}>Sign in <ArrowUpRight size={17} /></button></header>
    {login ? <main className="auth-page"><section className="auth-story"><span className="landing-eyebrow">YOUR NEXT SEASON STARTS HERE</span><h1>One account.<br />More possibilities.</h1><p>Find the right machine, put your equipment to work, and keep every booking in one place.</p><button className="outline" onClick={() => { setLogin(false); setError(''); window.history.pushState({}, '', '/'); }}>← Back to home</button></section><section className="auth-card" aria-label="Sign in">{error && <div className="alert" role="alert">{error}</div>}<LoginForm busy={busy} run={run} onUser={signedIn} /></section></main> : <main>
      <section className="landing-hero"><div><span className="landing-eyebrow">LOCAL EQUIPMENT. SHARED OPPORTUNITY.</span><h1>The right machine.<br /><em>A better harvest.</em></h1><p>Connect with equipment owners nearby. Plan your work, book a time slot, and track your rental from the first hour to the final bill.</p><div className="landing-actions"><button className="primary" onClick={openLogin}>Find equipment <ArrowUpRight size={18} /></button><button className="outline" onClick={openLogin}>List your equipment</button></div><small>For farmers, equipment owners, operators and FPOs.</small></div><div className="landing-art"><div className="field-lines" /><TractorArt /><div className="harvest-note"><Sprout /><div><strong>Built around your field.</strong><span>Nearby discovery · Clear rental rates</span></div></div></div></section>
      <section className="landing-steps" aria-label="How YantraSetu works">{[[Tractor,'01','Find your fit','Search equipment by type and distance from your farm.'],[CalendarDays,'02','Plan your work','Request a slot and track the owner’s approval.'],[ShieldCheck,'03','Know your bill','Confirm meter readings with a code and keep your rental records.']].map(([Icon,n,title,body]) => <article key={n}><div><Icon /><span>{n}</span></div><h2>{title}</h2><p>{body}</p></article>)}</section>
      <section className="landing-owner"><div><span className="landing-eyebrow">MAKE YOUR EQUIPMENT GO FURTHER</span><h2>Idle today. In the field tomorrow.</h2><p>List your machines and manage requests, availability and rental earnings from your dashboard.</p></div><button className="primary" onClick={openLogin}>Get started <ArrowUpRight size={18} /></button></section>
      {error && <p className="alert" role="alert">{error}</p>}
    </main>}
    <footer className="landing-footer"><span><Sprout size={18} /> YantraSetu</span><span>Rental payments are arranged directly between farmer and owner.</span></footer>
  </div>;
}
