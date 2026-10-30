import React, { useState } from 'react';
import { Plus, Check, Wrench, Fuel, X } from 'lucide-react';
import { FormField } from './Common';
import { INR, translate } from '../locales';

const PRESET_ATTACHMENTS = [
  { name: 'Rotavator', defaultRate: 250 },
  { name: 'Disc Harrow', defaultRate: 200 },
  { name: 'Cultivator', defaultRate: 150 },
  { name: 'Trolley', defaultRate: 150 },
  { name: 'Laser Leveller', defaultRate: 350 },
  { name: 'Seed Drill', defaultRate: 200 },
  { name: 'Straw Reaper', defaultRate: 400 },
  { name: 'Baler', defaultRate: 500 },
];

export function MachineForm({ orgs = [], busy, onSubmit, initialData = null, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const isEdit = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [category, setCategory] = useState(initialData?.category || 'Tractor');
  const [village, setVillage] = useState(initialData?.village || '');
  const [rate, setRate] = useState(initialData?.rate ?? '');
  const [unit, setUnit] = useState(initialData?.unit || 'hour');
  const [mobilization, setMobilization] = useState(initialData?.mobilization ?? 0);
  const [buffer, setBuffer] = useState(initialData?.buffer_minutes ?? 15);
  const [latitude, setLatitude] = useState(initialData?.latitude ?? 30.901);
  const [longitude, setLongitude] = useState(initialData?.longitude ?? 75.857);
  const [description, setDescription] = useState(initialData?.description || '');
  const [orgId, setOrgId] = useState(initialData?.organization_id || '');

  const [attachments, setAttachments] = useState(
    Array.isArray(initialData?.attachments) ? initialData.attachments : []
  );
  const [fuelIncluded, setFuelIncluded] = useState(Boolean(initialData?.fuel_included));
  const [fuelRateExtra, setFuelRateExtra] = useState(initialData?.fuel_rate_extra ?? 180);
  const [customAttName, setCustomAttName] = useState('');
  const [customAttRate, setCustomAttRate] = useState('');

  // Validation
  const nameError = !name.trim()
    ? 'Machine name is required.'
    : name.trim().length < 3
    ? 'Machine name must be 3-100 characters.'
    : '';
  const modelError = !model.trim()
    ? 'Machine model is required.'
    : model.trim().length < 2
    ? 'Model must be 2-100 characters.'
    : '';
  const villageError = !village.trim() ? 'Location (village/town) is required.' : '';
  const rateError = !rate || Number(rate) <= 0 ? 'Rate must be greater than zero.' : '';
  const bufferError = Number(buffer) < 0 ? 'Buffer cannot be negative.' : '';
  const mobError = Number(mobilization) < 0 ? 'Mobilization fee cannot be negative.' : '';

  const isValid = !nameError && !modelError && !villageError && !rateError && !bufferError && !mobError;

  function addPresetAttachment(preset) {
    if (attachments.some((a) => a.name.toLowerCase() === preset.name.toLowerCase())) return;
    setAttachments([...attachments, { name: preset.name, rate: preset.defaultRate }]);
  }

  function addCustomAttachment() {
    if (!customAttName.trim()) return;
    setAttachments([
      ...attachments,
      { name: customAttName.trim(), rate: Number(customAttRate) || 200 },
    ]);
    setCustomAttName('');
    setCustomAttRate('');
  }

  function removeAttachment(index) {
    setAttachments(attachments.filter((_, i) => i !== index));
  }

  function updateAttachmentRate(index, newRate) {
    const updated = [...attachments];
    updated[index].rate = Number(newRate) || 0;
    setAttachments(updated);
  }

  return (
    <>
      <h2>{isEdit ? 'Update machine listing' : t('putMachineToWork')}</h2>
      <p>{t('newListingNote')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValid) return;
          onSubmit({
            name: name.trim(),
            category,
            model: model.trim(),
            village: village.trim(),
            description: description.trim(),
            rate: Number(rate),
            unit,
            mobilization: Number(mobilization),
            latitude: Number(latitude),
            longitude: Number(longitude),
            buffer_minutes: Number(buffer),
            organization_id: orgId || null,
            attachments,
            fuel_included: fuelIncluded,
            fuel_rate_extra: fuelIncluded ? Number(fuelRateExtra) : 0,
          });
        }}
      >
        <div className="form-grid">
          <FormField label={t('machineName')}>
            <input
              name="name"
              minLength="3"
              maxLength="100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Mahindra Tractor"
            />
            {nameError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{nameError}</span>}
          </FormField>
          <FormField label="Machine Model">
            <input
              name="model"
              minLength="2"
              maxLength="100"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              placeholder="e.g. 575 DI (45 HP)"
            />
            {modelError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{modelError}</span>}
          </FormField>
        </div>

        <div className="form-grid">
          <FormField label={t('categoryLabel')}>
            <select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {['Tractor', 'Rotavator', 'Harvester', 'Seed drill', 'Sprayer', 'Cultivator'].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                )
              )}
            </select>
          </FormField>
          <FormField label={t('villageLabel')}>
            <input
              name="village"
              minLength="2"
              maxLength="100"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              required
              placeholder="e.g. Khanna, Ludhiana"
            />
            {villageError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{villageError}</span>}
          </FormField>
        </div>

        <FormField label={t('specsLabel')}>
          <textarea
            name="description"
            maxLength="1000"
            placeholder={t('specsPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <div className="form-grid">
          <FormField label={t('rateLabel')}>
            <input
              name="rate"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
            {rateError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{rateError}</span>}
          </FormField>
          <FormField label={t('pricingUnit')}>
            <select name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="hour">{t('perHour')}</option>
              <option value="acre">{t('perAcre')}</option>
            </select>
          </FormField>
          <FormField label={t('mobilizationLabel') + ' (₹)'}>
            <input
              name="mobilization"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={mobilization}
              onChange={(e) => setMobilization(e.target.value)}
              required
            />
            {mobError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{mobError}</span>}
          </FormField>
          <FormField label={t('bufferLabel')}>
            <input
              name="buffer"
              type="number"
              min="0"
              max="180"
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
              required
            />
            {bufferError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{bufferError}</span>}
          </FormField>
          <FormField label={t('latitudeLabel')}>
            <input
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t('longitudeLabel')}>
            <input
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
          </FormField>
        </div>

        {/* Implement Attachments Configuration */}
        <div style={{
          background: '#f8fafc',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
        }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Wrench size={16} color="#1b5e20" />
            <span>{t('attachmentsLabel')} (Optional Implement Add-ons)</span>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
            Add attachments that farmers can rent alongside this machine with extra hourly/acre rates.
          </p>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center', fontWeight: '600' }}>Add Presets:</span>
            {PRESET_ATTACHMENTS.map((preset) => {
              const alreadyAdded = attachments.some(
                (a) => a.name.toLowerCase() === preset.name.toLowerCase()
              );
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addPresetAttachment(preset)}
                  style={{
                    background: alreadyAdded ? '#f1f5f9' : '#fff',
                    color: alreadyAdded ? '#94a3b8' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  +{preset.name} (+₹{preset.defaultRate})
                </button>
              );
            })}
          </div>

          {/* Configured Attachments List */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{att.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Rate (+₹/unit):</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={att.rate}
                      onChange={(e) => updateAttachmentRate(idx, e.target.value)}
                      style={{ width: '80px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Attachment Input */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Custom attachment name"
              value={customAttName}
              onChange={(e) => setCustomAttName(e.target.value)}
              style={{ flex: 2, padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="number"
              placeholder="Extra Rate (₹)"
              value={customAttRate}
              onChange={(e) => setCustomAttRate(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <button
              type="button"
              onClick={addCustomAttachment}
              style={{
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Fuel (Diesel) Policy */}
        <div style={{
          background: '#fefce8',
          padding: '14px 16px',
          borderRadius: '10px',
          border: '1px solid #fef08a',
          marginBottom: '16px',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#854d0e' }}>
            <input
              type="checkbox"
              checked={fuelIncluded}
              onChange={(e) => setFuelIncluded(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#ca8a04' }}
            />
            <Fuel size={16} />
            <span>{t('dieselAvailableExtra')} (Owner provides diesel upon farmer request)</span>
          </label>
          {fuelIncluded && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#713f12', fontWeight: '600' }}>Extra diesel rate:</span>
              <input
                type="number"
                min="0"
                step="10"
                value={fuelRateExtra}
                onChange={(e) => setFuelRateExtra(e.target.value)}
                style={{ width: '100px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #fde047' }}
              />
              <span style={{ fontSize: '12px', color: '#713f12' }}>₹ / hour</span>
            </div>
          )}
        </div>

        <FormField label={t('orgOptional')}>
          <select name="organization" defaultValue={initialData?.organization_id || ''}>
            <option value="">{t('independentOwner')}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </FormField>

        <button className="primary full" disabled={busy || !isValid}>
          {isEdit ? 'Save Changes' : t('publishListingBtn')}{' '}
          {isEdit ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </form>
    </>
  );
}
