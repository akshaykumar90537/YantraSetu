import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Search as SearchIcon, Loader2, X } from 'lucide-react';
import { INR, translate } from '../locales';

export function MapPicker({
  center = [30.901, 75.857],
  radius = 5,
  machines = [],
  onSelectLocation,
  onSelectMachine,
  height = '420px',
  showLocate = true,
  interactive = true,
  lang = 'en',
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const machineMarkersRef = useRef([]);

  const [locating, setLocating] = useState(false);
  const [locateNotice, setLocateNotice] = useState('');
  const [locateError, setLocateError] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [searchingVillage, setSearchingVillage] = useState(false);

  const t = (k, p) => translate(lang, k, p);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [Number(center[0]) || 30.901, Number(center[1]) || 75.857],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    // Click on map to relocate user pin
    if (interactive && onSelectLocation) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        onSelectLocation(lat.toFixed(5), lng.toFixed(5));
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update user pin and search radius circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const lat = Number(center[0]) || 30.901;
    const lon = Number(center[1]) || 75.857;

    // Custom SVG User Pin Icon
    const userIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `
        <div style="
          background: #1b5e20;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #fff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    if (!userMarkerRef.current) {
      const marker = L.marker([lat, lon], {
        icon: userIcon,
        draggable: Boolean(interactive && onSelectLocation),
      }).addTo(map);

      marker.bindPopup(`<b>${t('location')}</b><br/><small>${lat.toFixed(4)}, ${lon.toFixed(4)}</small>`);

      if (interactive && onSelectLocation) {
        marker.on('dragend', (e) => {
          const pt = e.target.getLatLng();
          onSelectLocation(pt.lat.toFixed(5), pt.lng.toFixed(5));
        });
      }
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLatLng([lat, lon]);
      userMarkerRef.current.setPopupContent(`<b>${t('location')}</b><br/><small>${lat.toFixed(4)}, ${lon.toFixed(4)}</small>`);
    }

    // Radius circle
    if (radius) {
      const radiusMeters = Number(radius) * 1000;
      if (!circleRef.current) {
        circleRef.current = L.circle([lat, lon], {
          radius: radiusMeters,
          color: '#2e7d32',
          fillColor: '#81c784',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '4, 6',
        }).addTo(map);
      } else {
        circleRef.current.setLatLng([lat, lon]);
        circleRef.current.setRadius(radiusMeters);
      }
    }
  }, [center[0], center[1], radius]);

  // Update machine markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old machine markers
    machineMarkersRef.current.forEach((m) => m.remove());
    machineMarkersRef.current = [];

    // Tractor pin icon
    const tractorIcon = L.divIcon({
      className: 'custom-machine-pin',
      html: `
        <div style="
          background: #d84315;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/>
            <path d="M16 18h-5"/>
            <path d="M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
            <path d="M9 17a5 5 0 1 0-10 0 5 5 0 0 0 10 0Z"/>
            <path d="M4 17h1"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });

    machines.forEach((m) => {
      if (!m.latitude || !m.longitude) return;
      const marker = L.marker([Number(m.latitude), Number(m.longitude)], { icon: tractorIcon }).addTo(map);

      const popupContent = document.createElement('div');
      popupContent.className = 'map-popup-card';
      popupContent.innerHTML = `
        <div style="min-width: 180px; font-family: inherit;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #d84315; letter-spacing: 0.5px;">${m.category}</span>
          <h4 style="margin: 3px 0 6px; font-size: 15px; color: #1e293b; font-weight: 700;">${m.name}</h4>
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">📍 ${m.village}</p>
          <div style="margin-bottom: 10px; font-size: 14px; font-weight: 700; color: #1b5e20;">
            ${INR(m.rate)} <small style="font-size: 11px; font-weight: 500; color: #64748b;">/ ${m.unit === 'hour' ? t('perHour') : t('perAcre')}</small>
          </div>
          <button id="book-btn-${m.id}" style="
            width: 100%;
            background: #2e7d32;
            color: white;
            border: none;
            padding: 7px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          ">${t('viewAndBook')} →</button>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`book-btn-${m.id}`);
        if (btn && onSelectMachine) {
          btn.onclick = () => {
            onSelectMachine(m);
            marker.closePopup();
          };
        }
      });

      machineMarkersRef.current.push(marker);
    });
  }, [machines, lang]);

  function applyLocation(latitude, longitude, sourceMsg) {
    setLocating(false);
    setSearchingVillage(false);
    setLocateError('');
    if (sourceMsg) {
      setLocateNotice(sourceMsg);
      setTimeout(() => setLocateNotice(''), 6000);
    }
    const latStr = Number(latitude).toFixed(5);
    const lonStr = Number(longitude).toFixed(5);
    if (onSelectLocation) {
      onSelectLocation(latStr, lonStr);
    }
    if (mapRef.current) {
      mapRef.current.flyTo([Number(latitude), Number(longitude)], 13);
    }
  }

  // Live GPS Handler with fresh lock and accurate hardware detection
  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocateError('');
    setLocateNotice('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        applyLocation(latitude, longitude, `📍 Live GPS locked (accurate to ±${Math.round(accuracy || 10)}m)`);
      },
      (geoErr) => {
        setLocating(false);
        if (geoErr.code === 1) {
          setLocateError('🔒 Location permission blocked. Click the lock/site icon in your browser address bar to allow location.');
        } else if (geoErr.code === 2) {
          setLocateError('📡 No hardware GPS chip on this PC. Please search your village/tehsil above or tap directly on the map.');
        } else if (geoErr.code === 3) {
          setLocateError('📡 GPS timed out on desktop (PC broadband routes via ISP gateway). Please search your village above or tap on the map.');
        } else {
          setLocateError(geoErr.message || 'Unable to retrieve location.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  }

  // OpenStreetMap Village / Town Geocoding Search (restricted to India)
  async function handleSearchVillage(e) {
    if (e) e.preventDefault();
    const query = villageSearch.trim();
    if (!query) return;

    setSearchingVillage(true);
    setLocateError('');
    setLocateNotice('');

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=1`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const displayName = item.display_name ? item.display_name.split(',').slice(0, 3).join(',') : (item.name || query);
        applyLocation(Number(item.lat), Number(item.lon), `📍 Found: ${displayName}`);
      } else {
        setLocateError(`Could not find "${query}". Try searching with district or state (e.g. "${query}, Punjab").`);
        setSearchingVillage(false);
      }
    } catch {
      setLocateError('Location search service temporarily unavailable. Please tap on map to drop pin.');
      setSearchingVillage(false);
    }
  }

  // Quick Agricultural Region Presets
  const quickHubs = [
    { name: 'Ludhiana', lat: 30.901, lon: 75.857 },
    { name: 'Khanna', lat: 30.701, lon: 76.222 },
    { name: 'Jalandhar', lat: 31.326, lon: 75.576 },
    { name: 'Bathinda', lat: 30.211, lon: 74.945 },
    { name: 'Amritsar', lat: 31.634, lon: 74.872 },
    { name: 'Patiala', lat: 30.339, lon: 76.387 },
  ];

  return (
    <div className="map-picker-wrapper" style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #d4decb', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Search & Preset Bar */}
      <div style={{
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: '10px 14px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        {/* Village Search Form */}
        <form onSubmit={handleSearchVillage} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 280px', maxWidth: '420px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search your village, town or tehsil…"
              value={villageSearch}
              onChange={(e) => setVillageSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 32px 7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            {villageSearch && (
              <button
                type="button"
                onClick={() => setVillageSearch('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searchingVillage || !villageSearch.trim()}
            style={{
              background: '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            {searchingVillage ? <Loader2 size={14} className="animate-spin" /> : <SearchIcon size={14} />}
            <span>Find Village</span>
          </button>
        </form>

        {/* Quick Hub Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Quick Hubs:</span>
          {quickHubs.map((hub) => (
            <button
              key={hub.name}
              type="button"
              onClick={() => applyLocation(hub.lat, hub.lon, `📍 Set to ${hub.name}`)}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '3px 8px',
                fontSize: '11px',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              {hub.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Floating GPS Button */}
        {showLocate && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="map-locate-btn"
              onClick={handleUseMyLocation}
              disabled={locating}
              title={t('location')}
              style={{
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 14px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#1b5e20',
                cursor: 'pointer',
              }}
            >
              <Navigation size={15} className={locating ? 'animate-spin' : ''} />
              <span>{locating ? 'Acquiring GPS Signal…' : 'Use My GPS Location'}</span>
            </button>

            {locateNotice && (
              <span style={{
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                fontSize: '11px',
                fontWeight: '500',
                padding: '6px 10px',
                borderRadius: '6px',
                maxWidth: '280px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
                {locateNotice}
              </span>
            )}

            {locateError && (
              <span style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                fontSize: '11px',
                fontWeight: '500',
                padding: '6px 10px',
                borderRadius: '6px',
                maxWidth: '280px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}>
                {locateError}
              </span>
            )}
          </div>
        )}

        {/* Bottom Helper Bar */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(4px)',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#475569',
          border: '1px solid #e2e8f0',
          pointerEvents: 'none',
        }}>
          📍 Tap anywhere on map or drag green pin to place your field
        </div>
      </div>
    </div>
  );
}
