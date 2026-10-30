import React from 'react';
import { MapPin, ArrowUpRight, Star, Fuel, Wrench, ShieldCheck } from 'lucide-react';
import { TractorArt } from './TractorArt';
import { INR, translate } from '../locales';

export function MachineCard({ machine: m, index, onBook, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const ratingCount = Number(m.rating_count) || 0;
  const ratingAvg = Number(m.rating_avg) || 0;
  const badges = Array.isArray(m.badges) ? m.badges.filter(Boolean) : [];
  const attachments = Array.isArray(m.attachments) ? m.attachments : [];

  return (
    <article className="machine-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={'machine-image color-' + (index % 3)} style={{ position: 'relative' }}>
        <span className="tag">{m.category}</span>
        
        {/* Rating Badge */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          borderRadius: '20px',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          fontWeight: '700',
          color: ratingCount > 0 ? '#b45309' : '#64748b',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}>
          <Star size={13} fill={ratingCount > 0 ? '#f59e0b' : 'none'} color={ratingCount > 0 ? '#f59e0b' : '#94a3b8'} />
          <span>{ratingCount > 0 ? `${ratingAvg.toFixed(1)} (${ratingCount})` : 'New'}</span>
        </div>

        <TractorArt />
        <span className="illustration-label">{t('illustrationNotPhoto')}</span>
      </div>

      <div className="machine-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="card-topline">
          <span>
            <MapPin size={13} />
            {m.village}
          </span>
          <span style={{ color: '#166534', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ShieldCheck size={13} /> Direct Sharing
          </span>
        </div>

        <h3 style={{ margin: '6px 0 4px', fontSize: '18px' }}>{m.name}</h3>
        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
          {m.description || 'Contact owner to confirm machine specifications.'}
        </p>

        {/* Condition Badges */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
            {badges.slice(0, 3).map((b, bi) => (
              <span
                key={bi}
                style={{
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 7px',
                  borderRadius: '12px',
                }}
              >
                ✓ {b}
              </span>
            ))}
          </div>
        )}

        {/* Offered Attachments */}
        {attachments.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Wrench size={12} /> {t('attachmentsLabel')}:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {attachments.map((att, ai) => (
                <span
                  key={ai}
                  style={{
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: '500',
                  }}
                >
                  +{att.name} <small style={{ color: '#059669', fontWeight: '700' }}>(+{INR(att.rate)})</small>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fuel Option */}
        <div style={{ marginBottom: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
          <Fuel size={14} color={m.fuel_included ? '#d97706' : '#64748b'} />
          <span>
            {m.fuel_included
              ? `Diesel option available (+${INR(m.fuel_rate_extra)}/hr)`
              : 'Diesel to be arranged by farmer'}
          </span>
        </div>

        <div className="owner-line" style={{ marginTop: 'auto', marginBottom: '12px' }}>
          <div className="mini-avatar">{m.owner_name ? m.owner_name.charAt(0) : 'O'}</div>
          <span>{m.owner_name}</span>
        </div>

        <div className="card-bottom">
          <span>
            <strong>{INR(m.rate)}</strong>
            <small> / {m.unit === 'hour' ? t('perHour') : t('perAcre')}</small>
          </span>
          <button className="small-button" onClick={() => onBook(m)}>
            {t('viewAndBook')} <ArrowUpRight size={15} />
          </button>
        </div>

        <small className="charge-note">
          {t('mobilizationLabel')}: {INR(m.mobilization)} · {m.buffer_minutes} {t('bufferMinutes')}
        </small>
      </div>
    </article>
  );
}
