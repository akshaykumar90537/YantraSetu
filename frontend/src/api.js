const DEFAULT_DEMO_MACHINES = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    owner_id: "00000000-0000-4000-8000-000000000002",
    organization_id: null,
    name: "DEMO · Mahindra 575 DI (45 HP)",
    category: "Tractor",
    model: "575 DI",
    description: "Synthetic hackathon listing. Verified with attachments & fuel options.",
    village: "Ludhiana Ag Hub",
    rate: 650,
    unit: "hour",
    mobilization: 250,
    buffer_minutes: 15,
    active: true,
    is_active: true,
    attachments: [
      { name: "Rotavator", rate: 250 },
      { name: "Disc Harrow", rate: 200 },
      { name: "Trolley", rate: 150 }
    ],
    fuel_included: true,
    fuel_rate_extra: 180,
    owner_name: "Harpreet Singh (Owner)",
    owner_phone: "+919000000002",
    latitude: 30.901,
    longitude: 75.857,
    rating_avg: 5.0,
    rating_count: 1,
    badges: ["Clean Machine", "Experienced Driver", "Full Tank", "On-Time Arrival"]
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    owner_id: "00000000-0000-4000-8000-000000000002",
    organization_id: null,
    name: "DEMO · Shaktiman 6-foot Rotavator",
    category: "Rotavator",
    model: "6-foot",
    description: "Heavy duty rotavator for soil preparation.",
    village: "Ludhiana Ag Hub",
    rate: 1200,
    unit: "acre",
    mobilization: 0,
    buffer_minutes: 15,
    active: true,
    is_active: true,
    attachments: [
      { name: "Laser Leveller", rate: 350 }
    ],
    fuel_included: false,
    fuel_rate_extra: 0,
    owner_name: "Harpreet Singh (Owner)",
    owner_phone: "+919000000002",
    latitude: 30.912,
    longitude: 75.865,
    rating_avg: 4.8,
    rating_count: 3,
    badges: ["Sharp Blades", "On-Time Arrival"]
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    owner_id: "00000000-0000-4000-8000-000000000002",
    organization_id: null,
    name: "DEMO · Preet 987 Self-Propelled Harvester",
    category: "Harvester",
    model: "987 Deluxe",
    description: "High output crop harvesting with low grain loss.",
    village: "Ludhiana Ag Hub",
    rate: 2200,
    unit: "acre",
    mobilization: 500,
    buffer_minutes: 30,
    active: true,
    is_active: true,
    attachments: [
      { name: "Straw Reaper", rate: 400 },
      { name: "Baler Attachment", rate: 500 }
    ],
    fuel_included: true,
    fuel_rate_extra: 250,
    owner_name: "Harpreet Singh (Owner)",
    owner_phone: "+919000000002",
    latitude: 30.889,
    longitude: 75.841,
    rating_avg: 4.9,
    rating_count: 5,
    badges: ["High Capacity", "Full Tank"]
  }
];

function getDemoMachines() {
  try {
    const raw = localStorage.getItem('ys_demo_machines');
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    localStorage.setItem('ys_demo_machines', JSON.stringify(DEFAULT_DEMO_MACHINES));
  } catch {}
  return DEFAULT_DEMO_MACHINES;
}

function saveDemoMachines(machines) {
  try {
    localStorage.setItem('ys_demo_machines', JSON.stringify(machines));
  } catch {}
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('ys_demo_user');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// Generate deterministic UUIDv5-like unique identifier for each phone/email
function generateDeterministicUuid(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x3039c716, h4 = 0x19a0f2b3;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 974533199);
    h4 = Math.imul(h4 ^ ch, 374761393);
  }
  const toHex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function getRegisteredDemoUsers() {
  try {
    const raw = localStorage.getItem('ys_demo_users_db');
    if (raw) return JSON.parse(raw);
  } catch {}
  const initial = {
    '+919000000002': {
      id: '00000000-0000-4000-8000-000000000002',
      phone: '+919000000002',
      email: 'harpreet@example.com',
      name: 'Harpreet Singh (Owner)',
      roles: ['farmer', 'owner'],
      language: 'en',
    },
  };
  try {
    localStorage.setItem('ys_demo_users_db', JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveRegisteredDemoUsers(users) {
  try {
    localStorage.setItem('ys_demo_users_db', JSON.stringify(users));
  } catch {}
}

const demoPendingChallenges = {};

function handleDemoFallback(path, data, method) {
  const user = getStoredUser();

  if (path === '/me') {
    if (user) return user;
    const err = new Error('Sign in first');
    err.status = 401;
    throw err;
  }

  if (path === '/auth/config') {
    return {
      email: 'development',
      phone: true,
      google_client_id: '',
      email_auth_enabled: true,
      phone_auth_enabled: true,
      google_enabled: false,
    };
  }

  if (path === '/auth/request') {
    const phone = data?.phone ? String(data.phone).trim() : '';
    const users = getRegisteredDemoUsers();
    const existing = phone && users[phone];
    const isNewUser = !existing;
    const challengeId = 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    demoPendingChallenges[challengeId] = {
      phone,
      is_new_user: isNewUser,
      created_at: Date.now(),
    };

    return {
      challenge_id: challengeId,
      expires_in: 300,
      delivery: 'SIMULATED_NOT_SENT',
      development_code: '123456',
      message: 'Demo mode active. Use code: 123456',
      is_new_user: isNewUser,
      user_name: existing ? existing.name : undefined,
    };
  }

  if (path === '/auth/email/request') {
    const email = data?.email ? String(data.email).trim().toLowerCase() : '';
    const users = getRegisteredDemoUsers();
    const existing = email && users[email];
    const isNewUser = !existing;
    const challengeId = 'demo-email-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    demoPendingChallenges[challengeId] = {
      email,
      is_new_user: isNewUser,
      created_at: Date.now(),
    };

    return {
      challenge_id: challengeId,
      expires_in: 300,
      delivery: 'SIMULATED_NOT_SENT',
      development_code: '123456',
      message: 'Demo mode active. Use code: 123456',
      is_new_user: isNewUser,
      user_name: existing ? existing.name : undefined,
    };
  }

  if (path === '/auth/verify' || path === '/auth/email/verify') {
    const ch = demoPendingChallenges[data?.challenge_id] || {};
    const phone = data?.phone || ch.phone || '';
    const email = data?.email || ch.email || '';
    const identifier = phone || email || '+919000000002';
    const users = getRegisteredDemoUsers();

    let u = users[identifier];
    if (!u) {
      // New user registration: require a valid name
      if (!data?.name || data.name.trim().length < 2) {
        const err = new Error('Your name is required to complete new account registration');
        err.status = 422;
        throw err;
      }
      const uniqueId = generateDeterministicUuid(identifier);
      u = {
        id: uniqueId,
        phone: phone || null,
        email: email || null,
        name: data.name.trim(),
        roles: data?.roles && data.roles.length ? data.roles : ['farmer'],
        language: data?.language || 'en',
      };
      users[identifier] = u;
      saveRegisteredDemoUsers(users);
    }

    try {
      localStorage.setItem('ys_demo_user', JSON.stringify(u));
    } catch {}
    return u;
  }

  if (path === '/auth/logout') {
    try {
      localStorage.removeItem('ys_demo_user');
    } catch {}
    return { ok: true };
  }

  if (path.startsWith('/machines')) {
    const machines = getDemoMachines();

    // Availability endpoint
    if (path.includes('/availability')) {
      return {
        reserved: [],
        maintenance: [],
        next_available: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        buffer_minutes: 15,
      };
    }

    // Status toggle (delist/relist)
    if (path.includes('/status') && (method === 'PATCH' || method === 'POST')) {
      const match = path.match(/\/machines\/([^/]+)\/status/);
      const ident = match ? match[1] : null;
      const updated = machines.map((m) => {
        if (m.id === ident) {
          return { ...m, active: data.is_active, is_active: data.is_active };
        }
        return m;
      });
      saveDemoMachines(updated);
      const target = updated.find((m) => m.id === ident);
      return target || { ...machines[0], active: data.is_active, is_active: data.is_active };
    }

    // Create machine
    if (method === 'POST') {
      const newMachine = {
        id: '10000000-0000-4000-8000-' + String(Date.now()).slice(-12),
        owner_id: user ? user.id : '00000000-0000-4000-8000-000000000002',
        name: data.name,
        category: data.category,
        model: data.model || 'Standard',
        description: data.description || '',
        village: data.village || 'Ludhiana',
        latitude: parseFloat(data.latitude) || 30.901,
        longitude: parseFloat(data.longitude) || 75.857,
        rate: parseFloat(data.rate) || 500,
        unit: data.unit || 'hour',
        mobilization: parseFloat(data.mobilization) || 0,
        buffer_minutes: parseInt(data.buffer_minutes, 10) || 15,
        active: true,
        is_active: true,
        attachments: data.attachments || [],
        fuel_included: !!data.fuel_included,
        fuel_rate_extra: parseFloat(data.fuel_rate_extra) || 0,
        owner_name: user ? user.name : 'Equipment Owner',
        owner_phone: user ? user.phone : '+919988776655',
        rating_avg: 5.0,
        rating_count: 0,
        badges: ['New Listing'],
      };
      machines.push(newMachine);
      saveDemoMachines(machines);
      return newMachine;
    }

    // Search query
    const url = new URL('http://localhost' + path);
    const category = (url.searchParams.get('category') || '').toLowerCase();
    return machines.filter((m) => {
      if (m.active === false || m.is_active === false) return false;
      if (user && m.owner_id === user.id) return false; // Marketplace separation rule
      if (category && m.category.toLowerCase() !== category) return false;
      return true;
    });
  }

  if (path === '/fleet') {
    const machines = getDemoMachines();
    if (!user) return [];
    return machines.filter((m) => m.owner_id === user.id || m.owner_id === '00000000-0000-4000-8000-000000000002');
  }

  if (path === '/bookings') {
    if (method === 'POST') {
      const bookings = JSON.parse(localStorage.getItem('ys_demo_bookings') || '[]');
      const newBooking = {
        id: '20000000-0000-4000-8000-' + String(Date.now()).slice(-12),
        machine_id: data.machine_id,
        farmer_id: user ? user.id : '00000000-0000-4000-8000-000000000001',
        status: 'PENDING',
        start_at: data.start_at,
        end_at: data.end_at,
        estimate: 1500,
        ...data,
      };
      bookings.push(newBooking);
      localStorage.setItem('ys_demo_bookings', JSON.stringify(bookings));
      return newBooking;
    }
    return JSON.parse(localStorage.getItem('ys_demo_bookings') || '[]');
  }

  if (path === '/notifications' || path === '/organizations') {
    return [];
  }

  if (path === '/health') {
    return { status: 'ok', database: 'demo_fallback', version: '0.1.0' };
  }

  return {};
}

export async function api(path, data, customMethod) {
  const method = customMethod || (data ? 'POST' : 'GET');

  try {
    const response = await fetch('/api' + path, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'YantraSetu',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      // If Vercel or proxy returns HTML 404/502 (NOT_FOUND), switch seamlessly to demo fallback
      if (response.status === 404 || text.includes('NOT_FOUND') || text.includes('bom1')) {
        return handleDemoFallback(path, data, method);
      }
      if (!response.ok) {
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      return handleDemoFallback(path, data, method);
    }

    if (!response.ok) {
      // If 404 on API endpoint, fall back to demo mode
      if (response.status === 404) {
        return handleDemoFallback(path, data, method);
      }
      const errorMsg =
        typeof body.detail === 'string'
          ? body.detail
          : body.detail
          ? JSON.stringify(body.detail)
          : JSON.stringify(body);
      const error = new Error(errorMsg);
      error.status = response.status;
      if (response.status === 401 && path !== '/me' && !path.startsWith('/auth/')) {
        window.dispatchEvent(new Event('ys:unauthorized'));
      }
      throw error;
    }

    return body;
  } catch (err) {
    // If it's an intended 400/401/403/409/422 error from real API or demo fallback, rethrow
    if (err.status && err.status !== 404) {
      throw err;
    }
    // Network failure (offline, disconnected backend on cloud deploy): seamlessly serve demo fallback
    return handleDemoFallback(path, data, method);
  }
}
