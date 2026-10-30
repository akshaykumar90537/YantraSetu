import React from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import { dt, translate } from '../locales';

export function TimelineCalendar({
  availability,
  selectedStart,
  selectedEnd,
  onSelectSlot,
  lang = 'en',
}) {
  const t = (k, p) => translate(lang, k, p);

  if (!availability) {
    return <div className="timeline-loading">Loading schedule…</div>;
  }

  const { reserved = [], maintenance = [], next_available, buffer_minutes = 15 } = availability;

  // Check if current selection has an overlap
  let isConflict = false;
  let conflictReason = '';
  if (selectedStart && selectedEnd) {
    const reqStart = new Date(selectedStart).getTime();
    const reqEnd = new Date(selectedEnd).getTime();

    for (const r of reserved) {
      const bStart = new Date(r.start_at).getTime();
      const bEnd = new Date(r.reserved_until || r.end_at).getTime();
      if (reqStart < bEnd && reqEnd > bStart) {
        isConflict = true;
        conflictReason = `Overlaps with ${r.status || 'RESERVED'} booking (${dt(r.start_at)} – ${dt(bEnd)})`;
        break;
      }
    }

    if (!isConflict) {
      for (const m of maintenance) {
        const mStart = new Date(m.start_at).getTime();
        const mEnd = new Date(m.end_at).getTime();
        if (reqStart < mEnd && reqEnd > mStart) {
          isConflict = true;
          conflictReason = `Machine blocked for maintenance: ${m.reason || 'Service'} (${dt(m.start_at)} – ${dt(mEnd)})`;
          break;
        }
      }
    }
  }

  // Generate daytime hour blocks (6 AM to 8 PM) for Today and Tomorrow
  const days = [0, 1]; // 0 = Today, 1 = Tomorrow
  const now = new Date();

  function getSlotStatus(dayOffset, hour) {
    const slotTime = new Date();
    slotTime.setDate(now.getDate() + dayOffset);
    slotTime.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotTime.getTime() + 60 * 60 * 1000);
    const slotMs = slotTime.getTime();
    const endMs = slotEnd.getTime();

    if (slotMs < now.getTime()) {
      return { type: 'past', label: 'Past' };
    }

    for (const r of reserved) {
      const bStart = new Date(r.start_at).getTime();
      const bEnd = new Date(r.reserved_until || r.end_at).getTime();
      if (slotMs < bEnd && endMs > bStart) {
        return {
          type: r.status === 'PENDING' ? 'pending' : 'reserved',
          label: r.status || 'BOOKED',
          start: r.start_at,
          end: r.reserved_until || r.end_at,
        };
      }
    }

    for (const m of maintenance) {
      const mStart = new Date(m.start_at).getTime();
      const mEnd = new Date(m.end_at).getTime();
      if (slotMs < mEnd && endMs > mStart) {
        return { type: 'maintenance', label: 'MAINTENANCE', reason: m.reason };
      }
    }

    return { type: 'free', label: 'Available', slotStart: slotTime, slotEnd };
  }

  function handleSlotClick(dayOffset, hour) {
    const status = getSlotStatus(dayOffset, hour);
    if (status.type !== 'free') return;

    // Pick 2-hour window starting at this hour
    const start = new Date();
    start.setDate(now.getDate() + dayOffset);
    start.setHours(hour, 0, 0, 0);

    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');
    const formatLocal = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    if (onSelectSlot) {
      onSelectSlot(formatLocal(start), formatLocal(end));
    }
  }

  function applyNextAvailable() {
    if (!next_available || !onSelectSlot) return;
    const start = new Date(next_available.start_at);
    const end = new Date(next_available.end_at);
    const pad = (n) => String(n).padStart(2, '0');
    const formatLocal = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    onSelectSlot(formatLocal(start), formatLocal(end));
  }

  return (
    <div className="timeline-calendar-widget" style={{ marginTop: '12px', marginBottom: '16px' }}>
      {/* Conflict Alert with 1-Click Recommendation */}
      {isConflict && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #f87171',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
            <AlertTriangle size={18} />
            <span>Time Slot Conflict: {conflictReason}</span>
          </div>
          {next_available && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fff',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
            }}>
              <span>
                💡 <b>Recommended Slot:</b> {dt(next_available.start_at)} → {dt(next_available.end_at)}
              </span>
              <button
                type="button"
                onClick={applyNextAvailable}
                style={{
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Apply Slot
              </button>
            </div>
          )}
        </div>
      )}

      {/* Next Available Quick Pick Banner */}
      {!isConflict && next_available && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          padding: '8px 12px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#166534',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="#16a34a" />
            <span>
              <b>Earliest Opening:</b> {dt(next_available.start_at)} ({buffer_minutes}m buffer included)
            </span>
          </div>
          <button
            type="button"
            onClick={applyNextAvailable}
            style={{
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Quick Select
          </button>
        </div>
      )}

      {/* Visual Timeline Bar */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
            📅 Working Schedule & Availability (Click a green block to select)
          </span>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '2px' }}></span> Free
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: '#eab308', borderRadius: '2px' }}></span> Pending
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px' }}></span> Booked
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: '#9333ea', borderRadius: '2px' }}></span> Maint.
            </span>
          </div>
        </div>

        {days.map((dOffset) => {
          const targetDate = new Date();
          targetDate.setDate(now.getDate() + dOffset);
          const dayName = dOffset === 0 ? 'Today' : 'Tomorrow';
          const dateStr = targetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

          return (
            <div key={dOffset} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                {dayName} ({dateStr})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: '3px' }}>
                {hours.map((hr) => {
                  const status = getSlotStatus(dOffset, hr);
                  let bg = '#22c55e'; // free
                  let cursor = 'pointer';
                  let title = `${hr}:00 – Free (Click to pick 2h slot)`;

                  if (status.type === 'past') {
                    bg = '#cbd5e1';
                    cursor = 'not-allowed';
                    title = `${hr}:00 – Past`;
                  } else if (status.type === 'reserved') {
                    bg = '#ef4444';
                    cursor = 'not-allowed';
                    title = `${hr}:00 – Booked / In-Progress`;
                  } else if (status.type === 'pending') {
                    bg = '#eab308';
                    cursor = 'not-allowed';
                    title = `${hr}:00 – Pending Owner Approval`;
                  } else if (status.type === 'maintenance') {
                    bg = '#9333ea';
                    cursor = 'not-allowed';
                    title = `${hr}:00 – Maintenance`;
                  }

                  return (
                    <div
                      key={hr}
                      onClick={() => handleSlotClick(dOffset, hr)}
                      title={title}
                      style={{
                        background: bg,
                        height: '24px',
                        borderRadius: '3px',
                        cursor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: '700',
                        color: 'white',
                        transition: 'transform 0.1s',
                      }}
                    >
                      {hr}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

