import React from 'react';

export const FormField = ({ label, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function TimeFields({ startLabel = 'Start · your device time', endLabel = 'End · your device time' }) {
  return (
    <div className="form-grid">
      <FormField label={startLabel}>
        <input name="start" type="datetime-local" required />
      </FormField>
      <FormField label={endLabel}>
        <input name="end" type="datetime-local" required />
      </FormField>
    </div>
  );
}

