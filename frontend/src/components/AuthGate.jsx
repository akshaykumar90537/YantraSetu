import React, { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import { api } from '../api';

/**
 * AuthGate: checks for an existing session on mount.
 * - If session is found  → passes user to children(user, signOut)
 * - If no session / error → passes null to children(null, signOut)
 * Never blocks indefinitely: resolves after the fetch settles
 * (or after a 4-second safety timeout so the app always loads).
 */
export function AuthGate({ children }) {
  const [user, setUser]       = useState(undefined); // undefined = still checking
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    // Safety timeout — never hang longer than 4 s
    const timer = setTimeout(() => {
      if (active && checking) {
        setUser(null);
        setChecking(false);
      }
    }, 4000);

    api('/me')
      .then(u  => { if (active) { setUser(u); } })
      .catch(() => { if (active) { setUser(null); } })
      .finally(() => {
        clearTimeout(timer);
        if (active) setChecking(false);
      });

    // Handle session expiry events fired by api.js
    const onExpired = () => { if (active) setUser(null); };
    window.addEventListener('ys:unauthorized', onExpired);

    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('ys:unauthorized', onExpired);
    };
  }, []);

  if (checking) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <Sprout size={32} />
        <p>Checking your session…</p>
      </main>
    );
  }

  function signOut() { setUser(null); }

  return children(user, signOut);
}
