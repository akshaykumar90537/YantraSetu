import React, { useState, useEffect } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Droplets,
  RotateCw,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  Clock,
  Sparkles,
  Tractor,
  Search as SearchIcon,
  X,
  Loader2,
} from 'lucide-react';
import { MapPicker } from './MapPicker';
import { translate } from '../locales';

function getWeatherInfo(code) {
  if (code === 0) {
    return { label: 'Clear Sky', icon: Sun, color: '#f59e0b', bg: '#fef3c7' };
  }
  if ([1, 2].includes(code)) {
    return { label: 'Partly Cloudy', icon: CloudSun, color: '#eab308', bg: '#fef9c3' };
  }
  if (code === 3) {
    return { label: 'Overcast', icon: Cloud, color: '#64748b', bg: '#f1f5f9' };
  }
  if ([45, 48].includes(code)) {
    return { label: 'Fog / Mist', icon: Cloud, color: '#94a3b8', bg: '#f8fafc' };
  }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return { label: 'Rain Showers', icon: CloudRain, color: '#0284c7', bg: '#e0f2fe' };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'Thunderstorm', icon: CloudLightning, color: '#7c3aed', bg: '#ede9fe' };
  }
  return { label: 'Fair Conditions', icon: CloudSun, color: '#eab308', bg: '#fef9c3' };
}

export function WeatherDashboard({ latitude = 30.901, longitude = 75.857, onSelectLocation, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Village search states
  const [villageSearch, setVillageSearch] = useState('');
  const [searchingVillage, setSearchingVillage] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeLocationName, setActiveLocationName] = useState('');

  const latNum = Number(latitude) || 30.901;
  const lonNum = Number(longitude) || 75.857;

  const quickHubs = [
    { name: 'Ludhiana', lat: 30.901, lon: 75.857 },
    { name: 'Khanna', lat: 30.701, lon: 76.222 },
    { name: 'Jalandhar', lat: 31.326, lon: 75.576 },
    { name: 'Bathinda', lat: 30.211, lon: 74.945 },
    { name: 'Amritsar', lat: 31.634, lon: 74.872 },
    { name: 'Patiala', lat: 30.339, lon: 76.387 },
  ];

  async function fetchForecast() {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=7`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.current) {
        setData(json);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchForecast();
  }, [latNum, lonNum]);

  async function handleSearchVillage(e) {
    if (e) e.preventDefault();
    const query = villageSearch.trim();
    if (!query) return;

    setSearchingVillage(true);
    setSearchError('');

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=1`, {
        headers: { Accept: 'application/json' },
      });
      const items = await res.json();
      if (items && items.length > 0) {
        const item = items[0];
        const displayName = item.display_name ? item.display_name.split(',').slice(0, 3).join(',') : (item.name || query);
        setActiveLocationName(displayName);
        if (onSelectLocation) {
          onSelectLocation(Number(item.lat).toFixed(5), Number(item.lon).toFixed(5));
        }
      } else {
        setSearchError(`Could not find "${query}". Try adding district or state (e.g. "${query}, Punjab").`);
      }
    } catch {
      setSearchError('Search service temporarily unavailable.');
    } finally {
      setSearchingVillage(false);
    }
  }

  function handleSelectHub(hub) {
    setActiveLocationName(hub.name + ', Punjab');
    setSearchError('');
    if (onSelectLocation) {
      onSelectLocation(hub.lat, hub.lon);
    }
  }

  if (!data || !data.current) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
        <RotateCw size={32} className="animate-spin" style={{ color: '#2e7d32', marginBottom: '12px' }} />
        <h3>Loading Agricultural Weather Report…</h3>
        <p>Fetching real-time satellite & surface meteorology from Open-Meteo</p>
      </div>
    );
  }

  const curr = data.current;
  const hourly = data.hourly || {};
  const daily = data.daily || {};
  const currCond = getWeatherInfo(curr.weather_code);
  const CurrentIcon = currCond.icon;

  const temp = Math.round(curr.temperature_2m);
  const humidity = curr.relative_humidity_2m;
  const windSpeed = Math.round(curr.wind_speed_10m || 0);
  const rainProb = (daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0;

  // Farm Machinery Advisory Computations
  const tillageRisk = rainProb > 35 || curr.precipitation > 0;
  const harvestRisk = rainProb > 25 || humidity > 85;
  const sprayRisk = windSpeed > 18 || rainProb > 20;
  const balingRisk = rainProb > 20 || humidity > 80;

  // Next 24 hours (filter starting from current hour)
  const hourlyTimes = hourly.time || [];
  const nowIso = new Date().toISOString().slice(0, 13);
  let startIdx = hourlyTimes.findIndex((tStr) => tStr.slice(0, 13) >= nowIso);
  if (startIdx < 0) startIdx = 0;
  const next24 = hourlyTimes.slice(startIdx, startIdx + 24);

  return (
    <div className="weather-dashboard-view" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Title & Section Header */}
      <div className="section-title">
        <div>
          <div className="eyebrow">{t('weatherAdvisory').toUpperCase()} · REAL-TIME SATELLITE METEOROLOGY</div>
          <h1 className="page-title">{t('weatherHeadline')}</h1>
          <p>{t('weatherSub')}</p>
        </div>
        <button
          type="button"
          className="outline"
          onClick={fetchForecast}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Updating…' : 'Refresh'}</span>
        </button>
      </div>

      {/* Village Search & Location Control Bar */}
      <div style={{
        background: '#fff',
        border: '1px solid #dce4d5',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}>
        
        {/* Top Row: Search Form + Coordinates Display */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          
          {/* Village / Location Search Input */}
          <form onSubmit={handleSearchVillage} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px', maxWidth: '520px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                placeholder={t('searchVillagePlaceholder')}
                value={villageSearch}
                onChange={(e) => setVillageSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              {villageSearch && (
                <button
                  type="button"
                  onClick={() => setVillageSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={searchingVillage || !villageSearch.trim()}
              className="primary"
              style={{
                padding: '9px 16px',
                minHeight: '38px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {searchingVillage ? <Loader2 size={15} className="animate-spin" /> : <SearchIcon size={15} />}
              <span>{searchingVillage ? 'Searching…' : t('findVillageBtn')}</span>
            </button>
          </form>

          {/* Active Location Coordinates Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <MapPin size={18} color="#166534" />
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>
                Forecast Location
              </span>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                {activeLocationName || `${latNum.toFixed(4)}° N, ${lonNum.toFixed(4)}° E`}
              </div>
            </div>
          </div>
        </div>

        {/* Search Error Notice if any */}
        {searchError && (
          <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '6px 12px', borderRadius: '6px' }}>
            ⚠️ {searchError}
          </div>
        )}

        {/* Bottom Row: Quick Agricultural Hubs + Map Pin Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5ee' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Quick Hubs:</span>
            {quickHubs.map((hub) => (
              <button
                key={hub.name}
                type="button"
                onClick={() => handleSelectHub(hub)}
                style={{
                  background: Math.abs(latNum - hub.lat) < 0.05 ? '#275235' : '#f1f5ee',
                  color: Math.abs(latNum - hub.lat) < 0.05 ? '#fff' : '#2b4432',
                  border: '1px solid #dce4d5',
                  borderRadius: '16px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {hub.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="outline"
            onClick={() => setShowMap(!showMap)}
            style={{ fontSize: '11px', padding: '5px 12px', height: 'auto', minHeight: 'unset', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <MapPin size={13} />
            <span>{showMap ? 'Hide Map' : t('changeFarmLocation')}</span>
          </button>
        </div>

      </div>

      {/* Collapsible Pin-Drop Map */}
      {showMap && (
        <div style={{ marginBottom: '20px' }}>
          <MapPicker
            center={[latNum, lonNum]}
            height="260px"
            radius={0}
            interactive={true}
            showLocate={true}
            onSelectLocation={(newLat, newLon) => {
              setActiveLocationName('');
              if (onSelectLocation) onSelectLocation(newLat, newLon);
            }}
            lang={lang}
          />
        </div>
      )}

      {/* Hero Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Main Current Conditions Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #f7f9f2 0%, #edf4e8 100%)',
          border: '1px solid #dce7d3',
          borderRadius: '14px',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#3d6144', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Current Conditions · Asia/Kolkata
                </span>
                <h2 style={{ fontSize: '42px', fontWeight: '800', margin: '8px 0 4px', color: '#163820', letterSpacing: '-1.5px' }}>
                  {temp}°C
                </h2>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#415e47', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CurrentIcon size={20} color={currCond.color} />
                  <span>{currCond.label}</span>
                </div>
              </div>

              <div style={{ background: '#fff', padding: '14px', borderRadius: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
                <CurrentIcon size={52} color={currCond.color} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #d4e3cb' }}>
            <div>
              <small style={{ color: '#688267', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Droplets size={13} color="#0284c7" /> {t('humidityLabel')}
              </small>
              <strong style={{ fontSize: '16px', color: '#193922' }}>{humidity}%</strong>
            </div>
            <div>
              <small style={{ color: '#688267', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Wind size={13} color="#0d9488" /> {t('windLabel')}
              </small>
              <strong style={{ fontSize: '16px', color: '#193922' }}>{windSpeed} km/h</strong>
            </div>
            <div>
              <small style={{ color: '#688267', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CloudRain size={13} color="#2563eb" /> {t('rainProbLabel')}
              </small>
              <strong style={{ fontSize: '16px', color: '#193922' }}>{rainProb}%</strong>
            </div>
          </div>
        </div>

        {/* Agricultural Weather Summary & Quick Advisory */}
        <div style={{
          background: '#fff',
          border: '1px solid #dce4d5',
          borderRadius: '14px',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#eaf4e6', color: '#1f532a', padding: '6px', borderRadius: '8px' }}>
                <Tractor size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                Fieldwork Feasibility Score
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: '0 0 16px' }}>
              Meteorological suitability calculated for tractor mobilization, rotary tillage, seed drilling, and crop protection.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Soil Compaction Risk:</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: tillageRisk ? '#b91c1c' : '#15803d' }}>
                  {tillageRisk ? 'High (Wet)' : 'Low (Optimal)'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Chemical Spray Drift:</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: sprayRisk ? '#b91c1c' : '#15803d' }}>
                  {sprayRisk ? 'Warning (>18 km/h)' : 'Safe (<15 km/h)'}
                </span>
              </div>
            </div>
          </div>

          <div style={{
            background: tillageRisk || sprayRisk ? '#fffbeb' : '#f0fdf4',
            border: tillageRisk || sprayRisk ? '1px solid #fef3c7' : '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 12px',
            marginTop: '16px',
            fontSize: '12px',
            fontWeight: '600',
            color: tillageRisk || sprayRisk ? '#92400e' : '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {tillageRisk || sprayRisk ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
            <span>
              {tillageRisk || sprayRisk
                ? 'Check field moisture and wind before confirming rental appointments.'
                : 'Excellent window for all tractor, tillage, and harvesting operations.'}
            </span>
          </div>
        </div>

      </div>

      {/* Machinery Suitability Matrix */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '17px', color: '#1e293b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#2e7d32" />
          <span>{t('machinerySuitabilityTitle')}</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          
          {/* Tillage */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                {t('tillagePloughing')}
              </span>
              <span style={{
                background: tillageRisk ? '#fee2e2' : '#dcfce7',
                color: tillageRisk ? '#991b1b' : '#166534',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
              }}>
                {tillageRisk ? t('cautionDelay') : t('safeIdeal')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
              {tillageRisk
                ? 'Rain forecast poses mud clumping risk on rotavator blades. Postpone 24h.'
                : 'Soil moisture is in prime condition. Rotavator and cultivator can operate smoothly.'}
            </p>
          </div>

          {/* Harvesting */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                {t('harvesting')}
              </span>
              <span style={{
                background: harvestRisk ? '#fee2e2' : '#dcfce7',
                color: harvestRisk ? '#991b1b' : '#166534',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
              }}>
                {harvestRisk ? t('cautionDelay') : t('safeIdeal')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
              {harvestRisk
                ? 'Rain or humidity will raise grain moisture content. Delay combine harvester.'
                : 'Dry ambient crop canopy. Grain moisture is within standard milling parameters.'}
            </p>
          </div>

          {/* Spraying */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                {t('spraying')}
              </span>
              <span style={{
                background: sprayRisk ? '#fee2e2' : '#dcfce7',
                color: sprayRisk ? '#991b1b' : '#166534',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
              }}>
                {sprayRisk ? t('avoidSpraying') : t('safeIdeal')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
              {sprayRisk
                ? 'Winds exceeding 18 km/h cause chemical drift onto neighboring plots or wash-off.'
                : 'Calm wind speeds. Full spray droplet retention on crop foliage.'}
            </p>
          </div>

          {/* Stubble Management */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                {t('stubbleBaling')}
              </span>
              <span style={{
                background: balingRisk ? '#fee2e2' : '#dcfce7',
                color: balingRisk ? '#991b1b' : '#166534',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
              }}>
                {balingRisk ? t('cautionDelay') : t('safeIdeal')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
              {balingRisk
                ? 'Damp straw jams baler knotters and causes internal mold in stored bundles.'
                : 'Crisp dry straw allows high-density baler knotting and clean Happy Seeder runs.'}
            </p>
          </div>

        </div>
      </div>

      {/* Hourly Working Timeline (Next 24h) */}
      <div style={{ background: '#fff', border: '1px solid #dce4d5', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} color="#2e7d32" />
          <span>{t('hourlyTimeline')}</span>
        </h3>

        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
          {next24.map((tStr, i) => {
            const hIdx = startIdx + i;
            const hourDate = new Date(tStr);
            const hourLabel = hourDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            const hTemp = Math.round(hourly.temperature_2m[hIdx]);
            const hProb = hourly.precipitation_probability[hIdx] || 0;
            const hCode = hourly.weather_code[hIdx];
            const hCond = getWeatherInfo(hCode);
            const HIcon = hCond.icon;

            return (
              <div
                key={tStr}
                style={{
                  minWidth: '80px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 8px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '6px' }}>
                  {hourLabel}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                  <HIcon size={20} color={hCond.color} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                  {hTemp}°
                </div>
                <div style={{ fontSize: '10px', color: hProb > 25 ? '#0284c7' : '#94a3b8', marginTop: '4px', fontWeight: '600' }}>
                  {hProb}% rain
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-Day Agricultural Outlook Grid */}
      <div>
        <h3 style={{ fontSize: '17px', color: '#1e293b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#2e7d32" />
          <span>{t('sevenDayForecastTitle')}</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
          {daily.time && daily.time.map((dayStr, idx) => {
            const code = daily.weather_code[idx];
            const cond = getWeatherInfo(code);
            const DayIcon = cond.icon;
            const maxT = Math.round(daily.temperature_2m_max[idx]);
            const minT = Math.round(daily.temperature_2m_min[idx]);
            const pProb = daily.precipitation_probability_max[idx] || 0;
            const dateObj = new Date(dayStr);
            const dayName = dateObj.toLocaleDateString(lang === 'hi' ? 'hi-IN' : lang === 'pa' ? 'pa-IN' : 'en-IN', { weekday: 'short' });
            const isSafe = pProb < 35;

            return (
              <div
                key={dayStr}
                style={{
                  background: idx === 0 ? '#edf5e8' : '#fff',
                  border: idx === 0 ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 10px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '170px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: idx === 0 ? '#15803d' : '#334155' }}>
                    {idx === 0 ? 'Today' : dayName}
                  </div>
                  <small style={{ color: '#64748b', fontSize: '10px' }}>
                    {dateObj.getDate()} {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                  </small>
                </div>

                <div style={{ margin: '10px 0' }}>
                  <DayIcon size={28} color={cond.color} style={{ margin: '0 auto' }} />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>
                    {cond.label}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                    {maxT}° / {minT}°
                  </div>
                  <div style={{ fontSize: '10px', color: pProb > 25 ? '#0284c7' : '#94a3b8', fontWeight: '600', marginTop: '2px' }}>
                    🌧️ {pProb}%
                  </div>
                  <span style={{
                    display: 'block',
                    marginTop: '6px',
                    fontSize: '9px',
                    fontWeight: '700',
                    color: isSafe ? '#166534' : '#991b1b',
                    background: isSafe ? '#dcfce7' : '#fee2e2',
                    padding: '2px 4px',
                    borderRadius: '4px',
                  }}>
                    {isSafe ? '✓ Safe' : '⚠️ Alert'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
