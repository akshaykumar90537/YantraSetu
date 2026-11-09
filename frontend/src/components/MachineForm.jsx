import { localizeOperations } from '../locales/operations';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, Wrench, Fuel, X, MapPin, Navigation, Loader2, ChevronDown } from 'lucide-react';
import { FormField } from './Common';
import { MapPicker } from './MapPicker';
import { EquipmentPhotos } from './EquipmentPhotos';
import { INR, translate } from '../locales';
import { searchLocalVillages, searchOnlineVillages, findNearestVillage } from '../data/villages';

const PRESET_ATTACHMENTS = [
  { name: 'Rotavator', defaultRate: '' },
  { name: 'Disc Harrow', defaultRate: '' },
  { name: 'Cultivator', defaultRate: '' },
  { name: 'Trolley', defaultRate: '' },
  { name: 'Laser Leveller', defaultRate: '' },
  { name: 'Seed Drill', defaultRate: '' },
  { name: 'Straw Reaper', defaultRate: '' },
  { name: 'Baler', defaultRate: '' },
];

export function MachineForm({ orgs = [], busy, onSubmit, initialData = null, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const isEdit = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || '');
  const [photos, setPhotos] = useState(null);
  const [photoPreviews,setPhotoPreviews]=useState([]);
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [condition, setCondition] = useState(initialData?.condition || 'Not specified');
  const [horsepower, setHorsepower] = useState(initialData?.horsepower ?? '');
  const [transportAvailable, setTransportAvailable] = useState(initialData?.transport_available || false);
  const [model, setModel] = useState(initialData?.model || '');
  const [category, setCategory] = useState(initialData?.category || 'Tractor');
  const [village, setVillage] = useState(initialData?.village || '');
  const [operatorRate,setOperatorRate]=useState(initialData?.operator_rate_extra ?? '');
  const [rate, setRate] = useState(initialData?.rate ?? '');
  const [unit, setUnit] = useState(initialData?.unit || 'hour');
  const [mobilization, setMobilization] = useState(initialData?.mobilization ?? 0);
  const [buffer, setBuffer] = useState(initialData?.buffer_minutes ?? 15);
  const [latitude, setLatitude] = useState(initialData?.latitude ?? '');
  const [longitude, setLongitude] = useState(initialData?.longitude ?? '');
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const locationRevision = useRef(0);
  const [description, setDescription] = useState(initialData?.description || '');
  const [orgId, setOrgId] = useState(initialData?.organization_id || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoNotice, setGeoNotice] = useState(
    initialData?.latitude ? `📍 Coordinates: ${Number(initialData.latitude).toFixed(4)}, ${Number(initialData.longitude).toFixed(4)}` : ''
  );

  const [attachments, setAttachments] = useState(
    Array.isArray(initialData?.attachments) ? initialData.attachments : []
  );
  const [fuelIncluded, setFuelIncluded] = useState(Boolean(initialData?.fuel_included));
  const [fuelRateExtra, setFuelRateExtra] = useState(initialData?.fuel_rate_extra ?? '');
  const [customAttName, setCustomAttName] = useState('');
  const [customAttRate, setCustomAttRate] = useState('');

  // Dropdown states for interactive village/GPS selection
  const [villageSuggestions, setVillageSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const villageRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (villageRef.current && !villageRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update suggestions whenever village query changes
  useEffect(() => {
    const local = searchLocalVillages(village, 8);
    setVillageSuggestions(local);

    // Online lookup is explicit; typing only searches the bundled location list.
  }, [village]);

  function selectVillage(item) {
    locationRevision.current += 1;
    setLocationConfirmed(false);
    const formatted = item.label || `${item.name}, ${item.district}, ${item.state}`;
    setVillage(formatted);
    const lat = Number(Number(item.lat).toFixed(5));
    const lon = Number(Number(item.lon).toFixed(5));
    setLatitude(lat);
    setLongitude(lon);
    setGeoNotice(`Village centre selected: ${lat}, ${lon}. Adjust to the equipment location if needed, then confirm below.`);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  }

  async function lookupCoordinates(nameToLookup) {
    const query = (nameToLookup || village).trim();
    if (!query) return;
    const revision = ++locationRevision.current;
    setIsGeocoding(true);
    setGeoNotice('');

    // 1. Check verified local agricultural villages first
    const local = searchLocalVillages(query, 5);
    if (local && local.length > 0) {
      setVillageSuggestions(local);
      setIsDropdownOpen(true);
      setGeoNotice('Select the correct village from the suggestions.');
      setIsGeocoding(false);
      return;
    }

    // 2. Query OpenStreetMap Nominatim for Indian locations
    try {
      const online = await searchOnlineVillages(query, 3);
      if (revision !== locationRevision.current) return;
      if (online && online.length > 0) {
        setVillageSuggestions(online);
        setIsDropdownOpen(true);
        setGeoNotice('Select the correct location from the results.');
      } else {
        setGeoNotice(`Could not auto-locate "${query}". Please pick from the dropdown list or use "Use My Current GPS".`);
        setIsDropdownOpen(true);
      }
    } catch {
      setGeoNotice('Location lookup unavailable. You can adjust latitude/longitude below or choose from list.');
    } finally {
      setIsGeocoding(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser.');
      return;
    }
    setIsGeocoding(true);
    const revision = ++locationRevision.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (revision !== locationRevision.current) { setIsGeocoding(false); return; }
        setLocationConfirmed(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lon = Number(pos.coords.longitude.toFixed(5));
        setLatitude(lat);
        setLongitude(lon);

        // Find nearest known agricultural village
        const nearest = findNearestVillage(lat, lon, 40);
        if (nearest) {
          if (!village.trim()) {
            setVillage(nearest.label);
          }
          setGeoNotice(`Device location: ${lat}, ${lon} (accuracy about ${Math.round(pos.coords.accuracy)} m). Confirm this is where the equipment is kept.`);
        } else {
          setGeoNotice(`📍 Device GPS set: ${lat}, ${lon}`);
        }
        setIsGeocoding(false);
      },
      (err) => {
        setGeoNotice('Could not retrieve current location: ' + err.message);
        setIsGeocoding(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

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

  const coordinatesValid = latitude !== '' && longitude !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  const isValid = !nameError && !modelError && !villageError && !rateError && !bufferError && !mobError && coordinatesValid && locationConfirmed && !isGeocoding;

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
    updated[index].rate = newRate === '' ? '' : Number(newRate);
    setAttachments(updated);
  }

  return localizeOperations(
    <>
      <h2>{isEdit ? 'Update machine listing' : t('putMachineToWork')}</h2>
      <p>{t('newListingNote')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValid || photoBusy || photoError) return;
          onSubmit({
            condition, horsepower: horsepower === '' ? null : Number(horsepower), transport_available: transportAvailable,
            ...(photos !== null ? { photos } : {}),
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
            operator_rate_extra: operatorRate === '' ? null : Number(operatorRate),
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
            <div ref={villageRef} style={{ position: 'relative', width: '100%' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  name="village"
                  minLength="2"
                  maxLength="100"
                  value={village}
                  autoComplete="off"
                  onChange={(e) => {
                    locationRevision.current += 1;
                    setLocationConfirmed(false);
                    setLatitude(''); setLongitude(''); setGeoNotice('');
                    setVillage(e.target.value);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => {
                    setIsDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (!isDropdownOpen || villageSuggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex((prev) => (prev + 1) % villageSuggestions.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex((prev) => (prev - 1 + villageSuggestions.length) % villageSuggestions.length);
                    } else if (e.key === 'Enter') {
                      if (highlightedIndex >= 0 && highlightedIndex < villageSuggestions.length) {
                        e.preventDefault();
                        selectVillage(villageSuggestions[highlightedIndex]);
                      }
                    } else if (e.key === 'Escape') {
                      setIsDropdownOpen(false);
                    }
                  }}
                  required
                  placeholder="e.g. Gharuan, Khanna, Ludhiana, Samrala..."
                  style={{ width: '100%', paddingRight: village ? '58px' : '32px' }}
                />
                <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {village && (
                    <button
                      type="button"
                      onClick={() => {
                        locationRevision.current += 1;
                        setLocationConfirmed(false);
                        setLatitude(''); setLongitude('');
                        setVillage('');
                        setIsDropdownOpen(true);
                        setGeoNotice('');
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px', color: '#94a3b8', display: 'flex' }}
                      title="Clear village"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px', color: '#64748b', display: 'flex' }}
                    title="Toggle village suggestions"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Autocomplete Dropdown List */}
              {isDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    maxHeight: '260px',
                    overflowY: 'auto',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    zIndex: 200,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 12px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#475569',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      {village.trim()
                        ? `Matching Locations (${villageSuggestions.length})`
                        : 'Select or Search Village / Mandi'}
                    </span>
                    {isGeocoding && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '10px' }}>
                        <Loader2 size={10} className="spin" /> Searching...
                      </span>
                    )}
                  </div>

                  {villageSuggestions.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                      {isGeocoding ? 'Searching location databases...' : 'No matching villages found. Try typing district or nearby town.'}
                    </div>
                  ) : (
                    villageSuggestions.map((item, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      return (
                        <div
                          key={`${item.name}-${item.lat}-${item.lon}-${idx}`}
                          onClick={() => selectVillage(item)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          style={{
                            padding: '9px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isHighlighted ? '#f0fdf4' : '#ffffff',
                            transition: 'background 0.12s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <MapPin size={14} style={{ color: item.source === 'verified' ? '#16a34a' : '#0284c7', flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                                {item.name}
                                {item.source === 'verified' && (
                                  <span
                                    style={{
                                      marginLeft: '6px',
                                      fontSize: '9px',
                                      background: '#dcfce7',
                                      color: '#166534',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    Verified
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {[item.district, item.state].filter(Boolean).join(', ')}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                              marginLeft: '8px',
                            }}
                          >
                            {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                disabled={isGeocoding || !village.trim()}
                onClick={() => lookupCoordinates(village)}
              >
                {isGeocoding ? <Loader2 size={12} className="spin" /> : <MapPin size={12} />}
                {isGeocoding ? 'Searching...' : 'Find location suggestions'}
              </button>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                disabled={isGeocoding}
                onClick={useCurrentLocation}
              >
                <Navigation size={12} /> Use My Current GPS
              </button>
            </div>
            {geoNotice && (
              <span style={{ fontSize: '11px', color: geoNotice.startsWith('📍') ? '#15803d' : '#b45309', display: 'block', marginTop: '5px', fontWeight: '500' }}>
                {geoNotice}
              </span>
            )}
            {villageError && <span style={{ color: '#dc2626', fontSize: '11px', display: 'block', marginTop: '4px' }}>{villageError}</span>}
          </FormField>
        </div>

        <FormField label={`Operator charge per ${unit} (blank = not supplied, 0 = included)`}><input type="number" min="0" max="50000" step="0.01" value={operatorRate} onChange={e=>setOperatorRate(e.target.value)}/></FormField>
        <p>Enter your actual prices. Operator charges, when specified, are included in every rental estimate for this listing.</p>
        <fieldset><legend>Equipment photos and condition</legend>
          <p>Upload up to 3 actual equipment photos, each under 1 MB. JPEG, PNG or WebP. Photos are public; avoid people, documents and phone numbers.</p>
          {initialData && photos === null && <EquipmentPhotos lang={lang} machine={initialData} />}
          <FormField label="Equipment photos"><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photoBusy || busy} onChange={async e => {
            const files=Array.from(e.target.files || []); setPhotoError('');
            if(files.length>3 || files.some(f=>f.size>1000000 || !['image/jpeg','image/png','image/webp'].includes(f.type))) {setPhotoError('Select up to 3 JPEG, PNG or WebP files under 1 MB each.'); e.target.value=''; return;}
            if(!files.length) return;
            setPhotoBusy(true);
            try {const previews=await Promise.all(files.map(f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(f);})));setPhotoPreviews(previews);setPhotos(previews.map(p=>p.split(',')[1]));} catch {setPhotoError('Could not read the selected photos.');} finally {setPhotoBusy(false);}
          }} /></FormField>
          {photoPreviews.map((p,i)=><img key={i} src={p} alt={`Selected equipment photo ${i+1}`} style={{width:100,height:80,objectFit:'cover',margin:4}} />)}
          <button type="button" className="text-button" disabled={photoBusy} onClick={()=>{setPhotos([]);setPhotoPreviews([]);setPhotoError('');}}>Remove photos on save</button>
          {photoError && <p role="alert">{photoError}</p>}
          <FormField label="Equipment condition"><select value={condition} onChange={e=>setCondition(e.target.value)}>{['Not specified','Excellent','Good','Needs service'].map(v=><option key={v}>{v}</option>)}</select></FormField>
          <FormField label="Horsepower (optional)"><input type="number" min={1} max={1000} value={horsepower} onChange={e=>setHorsepower(e.target.value)} /></FormField>
          <label className="checkbox"><input type="checkbox" checked={transportAvailable} onChange={e=>setTransportAvailable(e.target.checked)} />Transport can be arranged by the owner</label>
          <small>Condition and transport information are owner-provided. Use the mobilization field for transport charges.</small>
        </fieldset>
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
              onChange={(e) => { locationRevision.current += 1; setLatitude(e.target.value); setLocationConfirmed(false); }}
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
              onChange={(e) => { locationRevision.current += 1; setLongitude(e.target.value); setLocationConfirmed(false); }}
              required
            />
          </FormField>
        </div>

        {coordinatesValid && <section aria-label="Equipment location map" style={{ marginBottom: 16 }}>
          <h3>Where is the equipment kept?</h3>
          <p>Click the map or drag the pin to the equipment location. The village suggestion starts at the village centre. You can also edit the coordinates above if the map cannot load.</p>
          <MapPicker center={[Number(latitude), Number(longitude)]} radius={0} height="280px" showLocate={false} lang={lang}
            onSelectLocation={(lat, lon) => {
              locationRevision.current += 1;
              setLatitude(lat); setLongitude(lon); setLocationConfirmed(false);
              setGeoNotice('Map location updated. Confirm this is where the equipment is kept.');
            }} />
        </section>}
        <label className="checkbox" style={{ marginBottom: 16 }}>
          <input type="checkbox" checked={locationConfirmed} disabled={!coordinatesValid || !village.trim() || isGeocoding}
            onChange={e => setLocationConfirmed(e.target.checked)} />
          I confirm the village and coordinates mark where this equipment is kept.
        </label>
        {!locationConfirmed && <p role="status">Select a village or use GPS, check the coordinates, and confirm the equipment location before saving.</p>}

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
                  +{preset.name} (set your rate)
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
                      step="0.01"
                      required
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
                step="0.01"
                required
                value={fuelRateExtra}
                onChange={(e) => setFuelRateExtra(e.target.value)}
                style={{ width: '100px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #fde047' }}
              />
              <span style={{ fontSize: '12px', color: '#713f12' }}>₹ / {unit}</span>
            </div>
          )}
        </div>

        <FormField label={t('orgOptional')}>
          <select name="organization" value={orgId} onChange={e => setOrgId(e.target.value)}>
            <option value="">{t('independentOwner')}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </FormField>

        <button className="primary full" disabled={busy || photoBusy || !isValid || !!photoError}>
          {isEdit ? 'Save Changes' : t('publishListingBtn')}{' '}
          {isEdit ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </form>
    </>
  ,lang);
}
