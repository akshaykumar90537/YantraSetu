import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { HomePage } from './HomePage';

export function LandingPage({ onUser, lang, setLang }) {
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home-entry">
      <HomePage onSignIn={() => setShowLogin(true)} lang={lang} setLang={setLang} />

      {/* ─── Login / Sign Up Modal ─── */}
      {showLogin && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogin(false);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true">
            <button
              className="icon modal-close"
              aria-label="Close"
              onClick={() => setShowLogin(false)}
            >
              ✕
            </button>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <LoginForm
              busy={busy}
              run={run}
              onUser={onUser}
              lang={lang}
              setLang={setLang}
            />
          </section>
        </div>
      )}
    </div>
  );
}
