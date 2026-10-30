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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { translate } from '../locales';

function getWeatherInfo(code) {
  if (code === 0) {
    return { label: 'Clear Sky', icon: Sun, color: '#f59e0b' };
  }
  if ([1, 2].includes(code)) {
    return { label: 'Partly Cloudy', icon: CloudSun, color: '#eab308' };
  }
  if (code === 3) {
    return { label: 'Overcast', icon: Cloud, color: '#64748b' };
  }
  if ([45, 48].includes(code)) {
    return { label: 'Fog / Mist', icon: Cloud, color: '#94a3b8' };
  }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return { label: 'Rain Showers', icon: CloudRain, color: '#0284c7' };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'Thunderstorm', icon: CloudLightning, color: '#7c3aed' };
  }
  return { label: 'Fair', icon: CloudSun, color: '#eab308' };
}

export function WeatherWidget({ latitude = 30.901, longitude = 75.857, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOutlook, setShowOutlook] = useState(false);

  const latNum = Number(latitude) || 30.901;
  const lonNum = Number(longitude) || 75.857;

  async function fetchWeather() {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.current) {
        setWeather(data);
      }
    } catch {
      // Graceful silence on network failure
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeather();
  }, [latNum, lonNum]);

  if (!weather || !weather.current) {
    return (
      <div style={{
        background: '#f7f8f0',
        border: '1px solid #eaeddf',
        borderRadius: '10px',
        padding: '12px 14px',
        margin: '12px 10px',
        fontSize: '11px',
        color: '#7c905b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Loading field weather…</span>
        <RotateCw size={13} className="animate-spin" />
      </div>
    );
  }

  const curr = weather.current;
  const daily = weather.daily || {};
  const currentCondition = getWeatherInfo(curr.weather_code);
  const WeatherIcon = currentCondition.icon;

  const temp = Math.round(curr.temperature_2m);
  const humidity = curr.relative_humidity_2m;
  const windSpeed = Math.round(curr.wind_speed_10m || 0);
  const rainProb = (daily.precipitation_probability_max && daily.precipitation_probability_max[0]) || 0;

  // Agricultural Operation Suitability
  let advisoryType = 'ideal';
  let advisoryText = t('weatherIdeal');
  if (rainProb > 40 || curr.precipitation > 0) {
    advisoryType = 'rain';
    advisoryText = t('weatherRainWarning');
  } else if (windSpeed > 25) {
    advisoryType = 'wind';
    advisoryText = t('weatherWindWarning');
  }

  return (
    <div
      className="sidebar-weather-card"
      style={{
        background: '#f7f9f2',
        border: '1px solid #e2e8dc',
        borderRadius: '10px',
        padding: '14px 14px 12px',
        margin: '10px 10px 14px',
        color: '#2d4533',
        fontSize: '11px',
      }}
    >
      {/* Title & Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#688260', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CloudSun size={13} color="#2e7d32" />
          {t('fieldWeather')}
        </span>
        <button
          type="button"
          onClick={fetchWeather}
          aria-label="Refresh weather"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: '#82947a',
          }}
          title="Refresh forecast"
        >
          <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Temperature & Condition Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WeatherIcon size={26} color={currentCondition.color} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', lineHeight: '1', color: '#1b3823' }}>
              {temp}°C
            </div>
            <div style={{ fontSize: '10px', color: '#667761', fontWeight: '500', marginTop: '2px' }}>
              {currentCondition.label}
            </div>
          </div>
        </div>

        {/* Rain % indicator */}
        <div style={{ textAlign: 'right' }}>
          <span style={{
            background: rainProb > 30 ? '#fee2e2' : '#eaf0df',
            color: rainProb > 30 ? '#b91c1c' : '#45603e',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
          }}>
            🌧️ {rainProb}% {t('rainProbLabel')}
          </span>
        </div>
      </div>

      {/* Metric Chips Row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <div style={{ flex: 1, background: '#fff', border: '1px solid #e1e7db', borderRadius: '6px', padding: '4px 6px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#7f917b' }}>{t('humidityLabel')}</div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#2d4533' }}>{humidity}%</div>
        </div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid #e1e7db', borderRadius: '6px', padding: '4px 6px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#7f917b' }}>{t('windLabel')}</div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#2d4533' }}>{windSpeed} km/h</div>
        </div>
      </div>

      {/* Farm Machinery Advisory Banner */}
      <div style={{
        background: advisoryType === 'ideal' ? '#edf5e8' : '#fef3c7',
        border: advisoryType === 'ideal' ? '1px solid #cce2c3' : '1px solid #fde68a',
        color: advisoryType === 'ideal' ? '#245a2b' : '#92400e',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '10px',
        fontWeight: '600',
        lineHeight: '1.3',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '5px',
        marginBottom: '6px',
      }}>
        {advisoryType === 'ideal' ? (
          <CheckCircle size={12} color="#16a34a" style={{ flexShrink: 0, marginTop: '1px' }} />
        ) : (
          <AlertTriangle size={12} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
        )}
        <span>{advisoryText}</span>
      </div>

      {/* 3-Day Outlook Toggle */}
      <button
        type="button"
        onClick={() => setShowOutlook(!showOutlook)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0 0',
          fontSize: '10px',
          color: '#556d4e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          fontWeight: '600',
        }}
      >
        <span>{showOutlook ? t('hideForecast') : t('threeDayForecast')}</span>
        {showOutlook ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Collapsible 3-Day Forecast Cards */}
      {showOutlook && daily.time && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #d5ded0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {daily.time.slice(1, 4).map((dayStr, idx) => {
            const code = daily.weather_code[idx + 1];
            const cond = getWeatherInfo(code);
            const DayIcon = cond.icon;
            const maxT = Math.round(daily.temperature_2m_max[idx + 1]);
            const minT = Math.round(daily.temperature_2m_min[idx + 1]);
            const pProb = daily.precipitation_probability_max[idx + 1] || 0;
            const dateObj = new Date(dayStr);
            const dayName = dateObj.toLocaleDateString(lang === 'hi' ? 'hi-IN' : lang === 'pa' ? 'pa-IN' : 'en-IN', { weekday: 'short' });

            return (
              <div
                key={dayStr}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#fff',
                  border: '1px solid #e1e7db',
                  borderRadius: '5px',
                  padding: '4px 8px',
                  fontSize: '10px',
                }}
              >
                <span style={{ fontWeight: '600', color: '#334155', minWidth: '35px' }}>{dayName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DayIcon size={13} color={cond.color} />
                  <span style={{ color: '#64748b', fontSize: '9px' }}>{cond.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>{maxT}° / {minT}°</span>
                  {pProb > 0 && <small style={{ color: '#0284c7', fontSize: '9px' }}>{pProb}%</small>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
