import React, { useState, useEffect } from 'react';
import { Star, Clock, CheckCircle2, ThumbsUp, Sparkles, MessageSquare } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

const BADGE_OPTIONS = [
  'Clean Machine',
  'Experienced Driver',
  'Full Tank',
  'On-Time Arrival',
  'Fair Billing',
  'Well Maintained',
];

export function RatingModal({ booking: b, onSubmitDone, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const [score, setScore] = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [selectedBadges, setSelectedBadges] = useState([
    'Clean Machine',
    'Experienced Driver',
  ]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch existing rating if already rated
    api(`/bookings/${b.id}/rating`)
      .then((existing) => {
        if (existing) {
          if (existing.score) setScore(existing.score);
          if (existing.punctuality) setPunctuality(existing.punctuality);
          if (Array.isArray(existing.badges)) setSelectedBadges(existing.badges);
          if (existing.comment) setComment(existing.comment);
        }
      })
      .catch(() => {});
  }, [b.id]);

  function toggleBadge(badge) {
    if (selectedBadges.includes(badge)) {
      setSelectedBadges(selectedBadges.filter((x) => x !== badge));
    } else {
      setSelectedBadges([...selectedBadges, badge]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/bookings/${b.id}/rating`, {
        score,
        punctuality,
        badges: selectedBadges,
        comment,
      });
      onSubmitDone('Rating & review saved successfully!');
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ background: '#fef3c7', padding: '6px', borderRadius: '8px', color: '#b45309' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{t('rateCompletedTitle')}</h2>
          <small style={{ color: '#64748b' }}>{b.machine_name} · {b.village}</small>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Overall Star Rating */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
            {t('ratingLabel')} (1 to 5 Stars)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setScore(star)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Star
                  size={28}
                  fill={star <= score ? '#f59e0b' : '#e2e8f0'}
                  color={star <= score ? '#d97706' : '#cbd5e1'}
                />
              </button>
            ))}
            <span style={{ alignSelf: 'center', fontWeight: '700', fontSize: '14px', color: '#b45309', marginLeft: '6px' }}>
              {score} / 5 Stars
            </span>
          </div>
        </div>

        {/* Operator Punctuality Rating */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Clock size={15} color="#15803d" />
            <span>{t('punctualityScore')} (Arrival & Timeliness)</span>
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { val: 5, label: '5 - On Time' },
              { val: 4, label: '4 - Minor Delay (<15m)' },
              { val: 3, label: '3 - 30m Delay' },
              { val: 2, label: '2 - 1hr Delay' },
              { val: 1, label: '1 - Severe Delay' },
            ].map((p) => {
              const active = punctuality === p.val;
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setPunctuality(p.val)}
                  style={{
                    flex: 1,
                    background: active ? '#dcfce7' : '#fff',
                    color: active ? '#166534' : '#475569',
                    border: active ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 4px',
                    fontSize: '11px',
                    fontWeight: active ? '700' : '500',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {p.val} ★
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipment Condition Badges Selection */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <ThumbsUp size={15} color="#2563eb" />
            <span>{t('conditionBadges')} (Tap badges that apply)</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {BADGE_OPTIONS.map((badge) => {
              const isSelected = selectedBadges.includes(badge);
              return (
                <button
                  key={badge}
                  type="button"
                  onClick={() => toggleBadge(badge)}
                  style={{
                    background: isSelected ? '#dbeafe' : '#fff',
                    color: isSelected ? '#1d4ed8' : '#475569',
                    border: isSelected ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: isSelected ? '700' : '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isSelected && <CheckCircle2 size={12} />}
                  <span>{badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Notes */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <MessageSquare size={15} />
            <span>{t('yourExperienceLabel')}</span>
          </label>
          <textarea
            rows="3"
            maxLength="500"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share feedback on machine performance, operator conduct, field output..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <button className="primary full" disabled={submitting} style={{ padding: '10px' }}>
          {submitting ? 'Submitting...' : t('saveRatingBtn')}
        </button>
      </form>
    </div>
  );
}

