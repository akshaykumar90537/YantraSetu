import React, { useState } from 'react';
import {
  Sprout,
  Tractor,
  MapPin,
  ShieldCheck,
  Users,
  CalendarDays,
  ArrowRight,
  Globe,
  CloudSun,
  Star,
} from 'lucide-react';
import { LoginForm } from './LoginForm';
import { TractorArt } from './TractorArt';
import { translate } from '../locales';

export function LandingPage({ onUser, lang, setLang }) {
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = (k, p) => translate(lang, k, p);

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

  const features = [
    {
      icon: Tractor,
      title: t('landingFeature1Title'),
      desc: t('landingFeature1Desc'),
    },
    {
      icon: CalendarDays,
      title: t('landingFeature2Title'),
      desc: t('landingFeature2Desc'),
    },
    {
      icon: MapPin,
      title: t('landingFeature3Title'),
      desc: t('landingFeature3Desc'),
    },
    {
      icon: ShieldCheck,
      title: t('landingFeature4Title'),
      desc: t('landingFeature4Desc'),
    },
    {
      icon: CloudSun,
      title: t('landingFeature5Title'),
      desc: t('landingFeature5Desc'),
    },
    {
      icon: Users,
      title: t('landingFeature6Title'),
      desc: t('landingFeature6Desc'),
    },
  ];

  const steps = [
    { num: '01', text: t('landingStep1') },
    { num: '02', text: t('landingStep2') },
    { num: '03', text: t('landingStep3') },
    { num: '04', text: t('landingStep4') },
  ];

  return (
    <div className="landing">
      {/* ─── Top Navigation Bar ─── */}
      <header className="landing-nav">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <Sprout size={22} />
          </span>
          <span>
            YantraSetu<small>{t('growingTogether')}</small>
          </span>
        </a>
        <div className="landing-nav-right">
          <Globe size={16} />
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="pa">ਪੰਜਾਬੀ</option>
          </select>
          <button
            className="primary"
            onClick={() => setShowLogin(true)}
          >
            {t('sign')} <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="eyebrow">
            <span /> {t('eyebrow')}
          </div>
          <h1>{t('landingHeroTitle')}</h1>
          <p>{t('landingHeroSub')}</p>
          <div className="landing-hero-actions">
            <button
              className="primary large"
              onClick={() => setShowLogin(true)}
            >
              {t('landingGetStarted')} <ArrowRight size={18} />
            </button>
          </div>
          <div className="landing-hero-stats">
            <div>
              <strong>500+</strong>
              <small>{t('landingStat1')}</small>
            </div>
            <div>
              <strong>50+</strong>
              <small>{t('landingStat2')}</small>
            </div>
            <div>
              <strong>3</strong>
              <small>{t('landingStat3')}</small>
            </div>
          </div>
        </div>
        <div className="landing-hero-art">
          <TractorArt large />
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

      {/* ─── Features Grid ─── */}
      <section className="landing-section">
        <div className="eyebrow center">{t('landingFeaturesEyebrow')}</div>
        <h2 className="landing-section-title">{t('landingFeaturesTitle')}</h2>
        <p className="landing-section-sub">{t('landingFeaturesSub')}</p>
        <div className="landing-features">
          {features.map((f, i) => (
            <div className="landing-feature-card" key={i}>
              <div className="landing-feature-icon">
                <f.icon size={24} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="landing-section alt">
        <div className="eyebrow center">{t('landingHowEyebrow')}</div>
        <h2 className="landing-section-title">{t('landingHowTitle')}</h2>
        <div className="landing-steps">
          {steps.map((s, i) => (
            <div className="landing-step" key={i}>
              <div className="landing-step-num">{s.num}</div>
              <p>{s.text}</p>
              {i < steps.length - 1 && (
                <ArrowRight size={18} className="landing-step-arrow" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="landing-cta">
        <Sprout size={36} />
        <h2>{t('landingCtaTitle')}</h2>
        <p>{t('landingCtaSub')}</p>
        <button className="primary large" onClick={() => setShowLogin(true)}>
          {t('landingGetStarted')} <ArrowRight size={18} />
        </button>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <span>
          <Sprout size={16} /> {t('footerTagline')}
        </span>
      </footer>

      {/* ─── Login Modal ─── */}
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
            />
          </section>
        </div>
      )}
    </div>
  );
}

