import functions from 'firebase-functions';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();
const db = admin.firestore();

// =============================
// CORS helper
// =============================
const ALLOWED_ORIGINS = new Set([
  'https://kanvaportal.web.app',
  'https://kanvaportal.firebaseapp.com',
  // Firebase Hosting preview channel domain for this project
  'https://salesportal--kanvaportal.us-central1.hosted.app',
  // Copper app host (if embedding makes cross-origin calls)
  'https://app.copper.com',
  'https://copper.com',
  // Local dev convenience
  'http://localhost:5000',
  'http://localhost:3000'
]);

function applyCors(req, res) {
  const origin = req.get('origin');
  console.log('🌐 CORS request from origin:', origin);
  
  // Temporarily allow all origins for debugging
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Original restrictive CORS (commented out for debugging)
  // if (origin && (ALLOWED_ORIGINS.has(origin))) {
  //   res.set('Access-Control-Allow-Origin', origin);
  //   res.set('Vary', 'Origin');
  //   res.set('Access-Control-Allow-Credentials', 'true');
  // }
}

const withCors = (handler) => async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  return handler(req, res);
};

// =============================
// Copper helpers
// =============================

function getCopperHeaders({ apiKey, userEmail }) {
  return {
    'X-PW-AccessToken': apiKey,
    'X-PW-Application': 'developer_api',
    'X-PW-UserEmail': userEmail,
    'Content-Type': 'application/json'
  };
}

function getCopperBaseUrl(cfgCopper = {}) {
  const base = (cfgCopper.baseUrl || 'https://api.copper.com/developer_api/v1').replace(/\/$/, '');
  return base;
}

function normalizePhone(raw, defaultCountry = 'US') {
  if (!raw) return null;
  // Very light normalization: keep digits, preserve leading + if present
  let s = String(raw).trim();
  const hasPlus = s.startsWith('+');
  s = s.replace(/[^0-9]/g, '');
  if (!s) return null;
  if (hasPlus) return '+' + s;
  // Basic US handling; extend later if needed
  if ((defaultCountry || 'US').toUpperCase() === 'US') {
    if (s.length === 10) return '+1' + s;
    if (s.length === 11 && s.startsWith('1')) return '+' + s;
  }
  // Fallback: return as-is with plus
  return '+' + s;
}

async function copperFetch(baseUrl, path, init) {
  const url = new URL(baseUrl + path);
  const resp = await fetch(url.toString(), init);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!resp.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(msg || `Copper error ${resp.status}`);
  }
  return data;
}

async function copperFindPersonByPhone({ baseUrl, headers }, phone, strategy = 'e164') {
  if (!phone) return null;
  const body = { where: { phone_numbers: [{ number: phone }] }, page_size: 1 };
  try {
    const data = await copperFetch(baseUrl, '/people/search', { method: 'POST', headers, body: JSON.stringify(body) });
    if (Array.isArray(data) && data.length) return data[0];
  } catch (e) {
    // ignore and fallback
  }
  if (strategy === 'any') {
    try {
      const body2 = { where: { phone_numbers: [{ number: phone.replace(/\D/g, '') }] }, page_size: 1 };
      const data2 = await copperFetch(baseUrl, '/people/search', { method: 'POST', headers, body: JSON.stringify(body2) });
      if (Array.isArray(data2) && data2.length) return data2[0];
    } catch {}
  }
  return null;
}

async function copperFindCompanyByPhone({ baseUrl, headers }, phone, strategy = 'e164') {
  if (!phone) return null;
  const body = { where: { phone_numbers: [{ number: phone }] }, page_size: 1 };
  try {
    const data = await copperFetch(baseUrl, '/companies/search', { method: 'POST', headers, body: JSON.stringify(body) });
    if (Array.isArray(data) && data.length) return data[0];
  } catch (e) {
    // ignore and fallback
  }
  if (strategy === 'any') {
    try {
      const body2 = { where: { phone_numbers: [{ number: phone.replace(/\D/g, '') }] }, page_size: 1 };
      const data2 = await copperFetch(baseUrl, '/companies/search', { method: 'POST', headers, body: JSON.stringify(body2) });
      if (Array.isArray(data2) && data2.length) return data2[0];
    } catch {}
  }
  return null;
}

async function copperCreateActivity({ baseUrl, headers }, payload) {
  return await copperFetch(baseUrl, '/activities', { method: 'POST', headers, body: JSON.stringify(payload) });
}

async function copperCreateTask({ baseUrl, headers }, payload) {
  return await copperFetch(baseUrl, '/tasks', { method: 'POST', headers, body: JSON.stringify(payload) });
}

// Update an existing Copper activity by ID
async function copperUpdateActivity({ baseUrl, headers }, id, payload) {
  return await copperFetch(baseUrl, `/activities/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
}

async function copperFindUserIdByEmail({ baseUrl, headers }, email) {
  if (!email) return null;
  try {
    const body = { emails: [String(email).trim()] };
    const data = await copperFetch(baseUrl, '/users/search', { method: 'POST', headers, body: JSON.stringify(body) });
    if (Array.isArray(data) && data.length) return data[0]?.id || null;
  } catch (e) {
    // ignore; fallback to default owner
  }
  return null;
}

// Utility: read ShipStation credentials from Firestore
async function loadShipStationCreds() {
  // Legacy path mapped by frontend to Firestore: data/connections.json
  // We store under collection 'integrations', doc 'connections'
  try {
    // Preferred location
    let doc = await db.collection('integrations').doc('connections').get();
    let data = doc.exists ? doc.data() : null;
    let ship = data?.shipstation || data?.ShipStation || null;
    let apiKey = ship?.apiKey || ship?.key || null;
    let apiSecret = ship?.apiSecret || ship?.secret || null;

    // Fallback to legacy location used by firebaseDataService: data/connections.json
    if (!apiKey || !apiSecret) {
      const legacyDoc = await db.collection('data').doc('connections.json').get();
      const legacy = legacyDoc.exists ? legacyDoc.data() : null;
      const lship = legacy?.shipstation || legacy?.ShipStation || null;
      apiKey = apiKey || lship?.apiKey || lship?.key || null;
      apiSecret = apiSecret || lship?.apiSecret || lship?.secret || null;
    }

    if (!apiKey || !apiSecret) throw new Error('Missing ShipStation API credentials in Firestore');
    return { apiKey, apiSecret };
  } catch (e) {
    throw new Error(`Failed to load ShipStation credentials: ${e.message}`);
  }
}

// Build Basic Auth header
function buildAuthHeader({ apiKey, apiSecret }) {
  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return `Basic ${token}`;
}

// Whitelist allowed ShipStation endpoints we proxy
const ALLOWED = new Set([
  'GET /stores',
  'GET /orders',
  'GET /orders/:id',
  'POST /orders/createorder',
  'POST /shipments/getrates'
]);

function normalizeTarget(path, method) {
  // Map our function path to ShipStation API path
  // Supported:
  //   /stores -> /stores
  //   /orders -> /orders (query passthrough)
  //   /orders/:id -> /orders/:id
  //   /orders/createorder -> /orders/createorder
  const parts = path.replace(/^\/api\/shipstation\/?/, '/').split('?')[0];
  if (parts === '/stores' && method === 'GET') return { key: 'GET /stores', target: '/stores' };
  if (parts === '/orders' && method === 'GET') return { key: 'GET /orders', target: '/orders' };
  if (parts.startsWith('/orders/') && method === 'GET') return { key: 'GET /orders/:id', target: parts };
  if (parts === '/orders/createorder' && method === 'POST') return { key: 'POST /orders/createorder', target: '/orders/createorder' };
  if (parts === '/shipments/getrates' && method === 'POST') return { key: 'POST /shipments/getrates', target: '/shipments/getrates' };
  return null;
}

export const shipstationApi = functions.https.onRequest(async (req, res) => {
  // Basic method/route validation
  const norm = normalizeTarget(req.path, req.method.toUpperCase());
  if (!norm || !ALLOWED.has(norm.key)) {
    res.status(404).json({ error: 'Endpoint not allowed' });
    return;
  }

  // Optional: enforce admin auth (Firebase Auth) for sensitive operations
  // For now, allow if referer/origin is your hosting domain; you can tighten this later.
  // TODO: require Firebase ID token and check custom claims.

  // Load credentials
  let creds;
  try {
    creds = await loadShipStationCreds();
  } catch (e) {
    res.status(500).json({ error: e.message });
    return;
  }

  const base = 'https://ssapi.shipstation.com';
  const url = new URL(base + norm.target);
  // Forward query params for GET /orders
  for (const [k, v] of Object.entries(req.query || {})) {
    if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
  }

  const headers = {
    'Authorization': buildAuthHeader(creds),
    'Content-Type': 'application/json'
  };

  const init = { method: req.method.toUpperCase(), headers };
  if (req.method.toUpperCase() !== 'GET' && req.body) {
    init.body = JSON.stringify(req.body);
  }

  try {
    const resp = await fetch(url.toString(), init);
    const text = await resp.text();
    const contentType = resp.headers.get('content-type') || '';

    res.status(resp.status);
    if (contentType.includes('application/json')) {
      try { res.json(JSON.parse(text)); } catch { res.send(text); }
    } else {
      res.send(text);
    }
  } catch (e) {
    res.status(502).json({ error: `Upstream error: ${e.message}` });
  }
});

// Firestore worker: process Copper sync queue jobs
export const onRingcentralSyncJob = onDocumentCreated('ringcentral_sync_queue/{sessionId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const job = snap.data() || {};
  const sessionId = event.params.sessionId;
  const jobRef = snap.ref;
  try {
    // Mark processing
    await jobRef.set({ status: 'processing', startedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    // Load Copper config
    const cfgSnap = await db.collection('integrations').doc('connections').get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};
    const copper = cfg?.copper || {};
    const apiKey = copper.apiKey || process.env.COPPER_API_KEY;
    const userEmail = copper.email || process.env.COPPER_USER_EMAIL;
    const baseUrl = getCopperBaseUrl(copper);
    const activityTypeId = copper.activityTypeId || null;
    const assignToUserId = copper.assignToUserId || null;
    const phoneStrategy = (copper.phoneMatch?.strategy || 'e164');
    const defaultCountry = copper.phoneMatch?.defaultCountry || 'US';
    const activityCustomFields = copper.activityCustomFields || {};
    const taskCustomFields = copper.taskCustomFields || {};

    if (!apiKey || !userEmail) {
      throw new Error('Copper credentials missing (apiKey or email).');
    }
    if (!activityTypeId) {
      throw new Error('Copper activityTypeId missing.');
    }

    const headers = getCopperHeaders({ apiKey, userEmail });
    
    // Normalize phone numbers
    const normFrom = normalizePhone(job.from, defaultCountry);
    const normTo = normalizePhone(job.to, defaultCountry);
    const primaryNumber = job.direction === 'Inbound' ? normFrom : normTo;

    // Lookup person/company
    let person = await copperFindPersonByPhone({ baseUrl, headers }, primaryNumber, phoneStrategy);
    let company = null;
    if (!person) {
      company = await copperFindCompanyByPhone({ baseUrl, headers }, primaryNumber, phoneStrategy);
    }

    // Build activity payload
    const subject = `Phone Call – ${job.direction || 'Unknown'} – ${(job.from || '')} ⇄ ${(job.to || '')}`.trim();
    const detailsLines = [
      `Session: ${sessionId}`,
      `Direction: ${job.direction || ''}`,
      `From: ${job.from || ''}`,
      `To: ${job.to || ''}`,
      job.notes ? `Notes: ${job.notes}` : null
    ].filter(Boolean);
    const details = detailsLines.join('\n');

    // Resolve owner: prefer agentEmail from job if provided
    let resolvedOwnerId = assignToUserId || undefined;
    if (job.agentEmail) {
      const foundId = await copperFindUserIdByEmail({ baseUrl, headers }, job.agentEmail);
      if (foundId) resolvedOwnerId = foundId;
    }

    const activityPayload = {
      type: activityTypeId,
      name: subject,
      details,
      owner_id: resolvedOwnerId,
      person_id: person?.id || undefined,
      company_id: company?.id || undefined,
      // custom fields on activity
      custom_fields: Object.entries(activityCustomFields).map(([label, id]) => {
        // best-effort mapping from known labels
        let value = null;
        if (label.toLowerCase().includes('session')) value = sessionId;
        else if (label.toLowerCase().includes('direction')) value = job.direction || '';
        else if (label.toLowerCase().includes('duration')) value = job.durationSec || job.duration || null;
        else if (label.toLowerCase().includes('recording')) value = job.recordingUrl || null;
        else if (label.toLowerCase().includes('phone')) value = primaryNumber || job.from || job.to || null;
        return { custom_field_definition_id: Number(id), value };
      }).filter(cf => cf.value !== null && cf.value !== undefined)
    };

    const activityResp = await copperCreateActivity({ baseUrl, headers }, activityPayload);

    // Create completed task linked to the activity
    const status = copper.taskDefaults?.status || 'Completed';
    const dueOffset = Number(copper.taskDefaults?.dueDateOffsetMinutes || 0);
    const dueDate = new Date();
    if (dueOffset) dueDate.setMinutes(dueDate.getMinutes() + dueOffset);

    const taskDetails = `${subject}\n\n${details}`;
    const taskPayload = {
      name: subject,
      details: taskDetails,
      status,
      owner_id: resolvedOwnerId,
      related_resource_type: person ? 'person' : (company ? 'company' : undefined),
      related_resource_id: person ? person.id : (company ? company.id : undefined),
      due_date: dueDate.toISOString().slice(0, 10), // YYYY-MM-DD
      // custom fields on task (if provided)
      custom_fields: Object.entries(taskCustomFields).map(([label, id]) => {
        let value = null;
        if (label.toLowerCase().includes('session')) value = sessionId;
        else if (label.toLowerCase().includes('direction')) value = job.direction || '';
        else if (label.toLowerCase().includes('duration')) value = job.durationSec || job.duration || null;
        else if (label.toLowerCase().includes('recording')) value = job.recordingUrl || null;
        else if (label.toLowerCase().includes('phone')) value = (person?.phone_numbers?.[0]?.number) || (company?.phone_numbers?.[0]?.number) || primaryNumber || job.from || job.to || null;
        else if (label.toLowerCase().includes('outcome')) value = job.outcome || null;
        return { custom_field_definition_id: Number(id), value };
      }).filter(cf => cf.value !== null && cf.value !== undefined)
    };
    const taskResp = await copperCreateTask({ baseUrl, headers }, taskPayload);

    // Reconcile any pending RingSense summary for this session
    try {
      const pending = await db.collection('ringsense_pending').doc(String(sessionId)).get();
      if (pending.exists) {
        const detailsBlock = pending.data()?.detailsBlock || '';
        if (detailsBlock) {
          // Append to activity details
          let currentDetails = '';
          try {
            const existing = await copperFetch(baseUrl, `/activities/${encodeURIComponent(activityResp?.id)}`, { method: 'GET', headers });
            currentDetails = existing?.details || '';
          } catch {}
          const updatePayload = { details: `${currentDetails || ''}${detailsBlock}` };
          try { await copperUpdateActivity({ baseUrl, headers }, activityResp?.id, updatePayload); } catch {}
        }
        // Cleanup pending doc
        try { await db.collection('ringsense_pending').doc(String(sessionId)).delete(); } catch {}
      }
    } catch {}

    // Persist results
    const resultDoc = {
      sessionId,
      from: job.from || null,
      to: job.to || null,
      direction: job.direction || null,
      notes: job.notes || '',
      endedAt: job.endedAt || null,
      copperActivityId: activityResp?.id || null,
      copperTaskId: taskResp?.id || null,
      personId: person?.id || null,
      companyId: company?.id || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('ringcentral_copper_activity').doc(String(sessionId)).set(resultDoc, { merge: true });

    await jobRef.set({ status: 'done', finishedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    await jobRef.set({ status: 'error', error: String(e.message || e), lastErrorAt: admin.firestore.FieldValue.serverTimestamp(), attempts: (job.attempts || 0) + 1 }, { merge: true });
  }
});

// Queue a Copper sync job for a call session
export const ringcentralSyncCopper = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { sessionId, from, to, direction, notes, endedAt } = req.body || {};
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'sessionId required' });
      return;
    }
    const job = {
      sessionId: String(sessionId),
      from: from || null,
      to: to || null,
      direction: direction || null,
      notes: String(notes || ''),
      endedAt: endedAt ? admin.firestore.Timestamp.fromDate(new Date(endedAt)) : null,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0
    };
    await db.collection('ringcentral_sync_queue').doc(String(sessionId)).set(job, { merge: true });
    res.status(202).json({ success: true, queued: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}));

// =============================
// RingCentral (stubs, phase 1)
// =============================

const RC_CONNECTIONS_DOC = db.collection('integrations').doc('connections');
const RC_TOKENS_DOC = db.collection('integrations').doc('ringcentral_tokens');

// Helper function to generate PKCE parameters
function generatePKCE() {
  const codeVerifier = Buffer.from(Array.from({length: 32}, () => Math.random().toString(36)[2] || '0').join('')).toString('base64url');
  const codeChallenge = Buffer.from(crypto.createHash('sha256').update(codeVerifier).digest()).toString('base64url');
  return { codeVerifier, codeChallenge };
}

// Start OAuth with PKCE flow
export const ringcentralAuthStart = onRequest(withCors(async (req, res) => {
  try {
    const snap = await RC_CONNECTIONS_DOC.get();
    const cfg = snap.exists ? (snap.data()?.ringcentral || {}) : {};
    const clientId = cfg.clientId;
    const base = cfg.environment === 'production' ? 'https://platform.ringcentral.com' : 'https://platform.devtest.ringcentral.com';
    
    if (!clientId) {
      res.status(400).send('RingCentral clientId not configured');
      return;
    }
    
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    
    // Store code_verifier for token exchange (in a real app, use session storage)
    await db.collection('oauth_state').doc('pkce_temp').set({
      codeVerifier,
      timestamp: new Date()
    });
    // Use configured redirectUri; allow optional ownerId to be carried in state for per-user tokens
    const redirectUri = cfg.redirectUri || process.env.RC_REDIRECT_URI || 'https://kanvaportal.web.app/rc/auth/callback';
    const ownerId = req.query?.ownerId ? String(req.query.ownerId) : '';
    const stateObj = ownerId ? { ownerId } : 'kanva';
    const stateParam = typeof stateObj === 'string' ? stateObj : encodeURIComponent(JSON.stringify(stateObj));
    const authUrl = `${base}/restapi/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateParam}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    
    res.redirect(authUrl);
  } catch (e) {
    res.status(500).send(`Auth start error: ${e.message}`);
  }
}));

// OAuth callback - exchange code for access token
export const ringcentralAuthCallback = onRequest(withCors(async (req, res) => {
  try {
    const { code, state, error } = req.query || {};

    if (error) {
      res.status(400).send(`RingCentral auth error: ${error}`);
      return;
    }

    // Determine ownerId from state (if provided)
    let ownerId = '';
    if (state && typeof state === 'string' && state !== 'kanva') {
      try {
        const parsed = JSON.parse(decodeURIComponent(String(state)));
        if (parsed && typeof parsed === 'object' && parsed.ownerId) ownerId = String(parsed.ownerId);
      } catch {}
    }

    // Exchange code for access token
    const snap = await RC_CONNECTIONS_DOC.get();
    const cfg = snap.exists ? (snap.data()?.ringcentral || {}) : {};
    const clientId = cfg.clientId || process.env.RC_CLIENT_ID || '';
    const clientSecret = cfg.clientSecret || process.env.RC_CLIENT_SECRET || '';
    const redirectUri = cfg.redirectUri || process.env.RC_REDIRECT_URI || '';
    const base = cfg.environment === 'sandbox' ? 'https://platform.devtest.ringcentral.com' : 'https://platform.ringcentral.com';

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ RingCentral config missing:', { 
        hasClientId: !!clientId, 
        hasClientSecret: !!clientSecret, 
        hasRedirectUri: !!redirectUri,
        configData: cfg 
      });
      res.status(500).send(`RingCentral configuration incomplete. Missing: ${[
        !clientId ? 'clientId' : null,
        !clientSecret ? 'clientSecret' : null, 
        !redirectUri ? 'redirectUri' : null
      ].filter(Boolean).join(', ')}`);
      return;
    }

    // Get stored code_verifier for PKCE
    const pkceDoc = await db.collection('oauth_state').doc('pkce_temp').get();
    const pkceData = pkceDoc.exists ? pkceDoc.data() : null;
    
    if (!pkceData || !pkceData.codeVerifier) {
      res.status(400).send('PKCE code_verifier not found. Please restart OAuth flow.');
      return;
    }

    // Exchange code for access token using PKCE with Basic Auth
    const tokenUrl = `${base}/restapi/oauth/token`;
    const tokenData = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: pkceData.codeVerifier
    };

    // Some RingCentral apps require Basic Auth even with PKCE
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams(tokenData).toString()
    });

    // Clean up PKCE state
    await db.collection('oauth_state').doc('pkce_temp').delete();

    const tokenResult = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResult);
      res.status(400).send(`Token exchange failed: ${tokenResult.error_description || tokenResult.error}`);
      return;
    }

    // Store tokens securely (org-level + per-user map if ownerId)
    const tokenDoc = {
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token,
      tokenType: tokenResult.token_type || 'Bearer',
      expiresIn: tokenResult.expires_in,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + (tokenResult.expires_in * 1000))),
      scope: tokenResult.scope,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAuthCode: String(code),
      state: String(state || ''),
      ownerId: ownerId || null
    };

    // Save to org-level fields for backward compatibility
    await RC_TOKENS_DOC.set(tokenDoc, { merge: true });
    // Also save to per-user map if ownerId provided
    if (ownerId) {
      await RC_TOKENS_DOC.set({ users: { [ownerId]: tokenDoc } }, { merge: true });
    }
    
    res.status(200).send('RingCentral authentication successful! You can close this window.');
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.status(500).send(`Callback error: ${e.message}`);
  }
}));

// Token endpoint - provide access token to frontend
export const ringcentralToken = onRequest(withCors(async (req, res) => {
  try {
    // Support optional ownerId scoping, similar to status endpoint
    const ownerId = req.query?.ownerId ? String(req.query.ownerId) : '';
    const tokensAllSnap = await RC_TOKENS_DOC.get();
    if (!tokensAllSnap.exists) {
      res.status(401).json({ error: 'No tokens found' });
      return;
    }

    const tokensAll = tokensAllSnap.data() || {};
    const userTokens = ownerId && tokensAll.users && tokensAll.users[ownerId] ? tokensAll.users[ownerId] : null;
    const tokens = userTokens || tokensAll;

    // Normalize fields from our storage format
    const accessToken = tokens.accessToken || tokens.access_token || '';
    // expiresAt may be a Firestore Timestamp, Date, or ISO string
    let expiresAtIso = null;
    if (tokens.expiresAt && typeof tokens.expiresAt?.toDate === 'function') {
      expiresAtIso = tokens.expiresAt.toDate().toISOString();
    } else if (tokens.expiresAt instanceof Date) {
      expiresAtIso = tokens.expiresAt.toISOString();
    } else if (typeof tokens.expiresAt === 'string') {
      expiresAtIso = tokens.expiresAt;
    } else if (tokens.expires_at) {
      expiresAtIso = String(tokens.expires_at);
    }

    if (!accessToken) {
      res.status(401).json({ error: 'No access token available' });
      return;
    }

    // Check expiry if we have it
    if (expiresAtIso && new Date() >= new Date(expiresAtIso)) {
      const refreshed = await refreshRingCentralToken();
      if (refreshed) {
        const newSnap = await RC_TOKENS_DOC.get();
        const newAll = newSnap.data() || {};
        const newUserTokens = ownerId && newAll.users && newAll.users[ownerId] ? newAll.users[ownerId] : null;
        const latest = newUserTokens || newAll;
        const latestAccess = latest.accessToken || latest.access_token || '';
        let latestExpires = null;
        if (latest.expiresAt && typeof latest.expiresAt?.toDate === 'function') latestExpires = latest.expiresAt.toDate().toISOString();
        else if (latest.expiresAt instanceof Date) latestExpires = latest.expiresAt.toISOString();
        else if (typeof latest.expiresAt === 'string') latestExpires = latest.expiresAt;
        else if (latest.expires_at) latestExpires = String(latest.expires_at);

        res.json({ access_token: latestAccess, expires_at: latestExpires });
      } else {
        res.status(401).json({ error: 'Token expired and refresh failed' });
      }
      return;
    }

    res.json({ access_token: accessToken, expires_at: expiresAtIso });
  } catch (error) {
    console.error('Error getting RingCentral token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// Status endpoint - check if authenticated with valid token
export const ringcentralStatus = onRequest(withCors(async (req, res) => {
  try {
    const conn = (await RC_CONNECTIONS_DOC.get()).data() || {};
    const ownerId = req.query?.ownerId ? String(req.query.ownerId) : '';
    const tokensAll = (await RC_TOKENS_DOC.get()).data() || {};
    const userTokens = ownerId && tokensAll.users && tokensAll.users[ownerId] ? tokensAll.users[ownerId] : null;
    const tokens = userTokens || tokensAll;
    
    const isConfigured = !!(conn.ringcentral?.clientId && conn.ringcentral?.clientSecret);
    const hasValidToken = !!(tokens.accessToken && tokens.expiresAt && tokens.expiresAt.toDate() > new Date());
    
    res.status(200).json({ 
      success: true, 
      data: { 
        configured: isConfigured,
        tokens: hasValidToken,
        authenticated: isConfigured && hasValidToken,
        expiresAt: tokens.expiresAt ? tokens.expiresAt.toDate().toISOString() : null,
        ownerScoped: !!ownerId
      } 
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}));

// Webhook receiver – ack fast, write minimal event for screen-pop
export const ringcentralWebhook = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    // Basic validation/echo support can be added here; keep minimal for phase 1
    const body = req.body || {};
    const sessionId = body?.telephonySessionId || body?.uuid || body?.eventId || null;
    const doc = {
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      headers: req.headers,
      body,
      ip: req.ip,
      sessionId,
    };
    const ref = await db.collection('ringcentral_events').add(doc);
    if (sessionId) {
      await db.collection('ringcentral_events_index').doc(String(sessionId)).set({
        lastEventAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRef: ref.id
      }, { merge: true });
    }
    // For screen-pop: also write a lightweight doc
    const lite = {
      sessionId: sessionId || ref.id,
      direction: body?.direction || body?.body?.direction || null,
      from: body?.from || body?.body?.from || null,
      to: body?.to || body?.body?.to || null,
      status: body?.status || body?.body?.status || null,
      at: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('ringcentral_screenpop').doc(String(lite.sessionId)).set(lite, { merge: true });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: `Failed to process webhook: ${e.message}` });
  }
}));

// Notes endpoint – saves notes tied to session; Copper sync in next phase
export const ringcentralNotes = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { sessionId, notes, agent, endedAt } = req.body || {};
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'sessionId required' });
      return;
    }
    await db.collection('ringcentral_notes').doc(String(sessionId)).set({
      notes: String(notes || ''),
      agent: agent || null,
      endedAt: endedAt ? admin.firestore.Timestamp.fromDate(new Date(endedAt)) : admin.firestore.FieldValue.serverTimestamp(),
      savedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}));

// =============================
// RingSense AI webhook (post-call summary)
// =============================

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function verifyHmacSignature(rawBodyBuffer, secret, provided, algo = 'sha256') {
  if (!secret || !provided) return false;
  try {
    const h = crypto.createHmac(algo, Buffer.from(String(secret)));
    h.update(rawBodyBuffer);
    const digest = h.digest('hex');
    // Accept formats like "sha256=..." or plain hex
    const normProvided = String(provided).toLowerCase().replace(/^sha256=/, '');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(normProvided));
  } catch {
    return false;
  }
}

export const ringcentralRingSense = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const receivedAt = admin.firestore.FieldValue.serverTimestamp();
  try {
    // Load RingSense secret and Copper config
    const connSnap = await db.collection('integrations').doc('connections').get();
    const conn = connSnap.exists ? (connSnap.data() || {}) : {};
    const rcCfg = conn.ringcentral || {};
    const ringsenseSecret = rcCfg.ringsenseSecret || process.env.RINGSENSE_SIGNING_SECRET || '';

    // Signature validation (HMAC-SHA256 over raw body)
    const signature = req.get('x-ringsense-signature') || req.get('x-ringcentral-signature') || req.get('x-signature') || '';
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const sigValid = verifyHmacSignature(raw, ringsenseSecret, signature, 'sha256');

    // Persist full event for telemetry
    const eventDoc = {
      receivedAt,
      headers: req.headers,
      signature: signature || null,
      signatureValid: !!sigValid,
      ip: req.ip,
      url: req.originalUrl || req.url,
      body: req.body || safeJsonParse(raw.toString('utf8')) || null
    };
    const ref = await db.collection('ringsense_events').add(eventDoc);

    if (!sigValid) {
      await db.collection('ringsense_events').doc(ref.id).set({ error: 'invalid_signature' }, { merge: true });
      res.status(401).json({ ok: false, error: 'invalid_signature' });
      return;
    }

    const body = eventDoc.body || {};
    const sessionId = body.sessionId || body.telephonySessionId || body.callSessionId || null;
    const summary = body.summary || body.aiSummary || body.notes || null;
    const sentiment = body.sentiment || null;
    const actionItems = body.actionItems || body.actions || null;

    // Attach summary to Copper activity if we have one
    if (sessionId && (summary || actionItems)) {
      // Find previously created activity by sessionId
      const prior = await db.collection('ringcentral_copper_activity').doc(String(sessionId)).get();
      const priorData = prior.exists ? prior.data() : null;
      const activityId = priorData?.copperActivityId || null;

      // Load Copper config
      const copper = (conn.copper || {});
      const apiKey = copper.apiKey || process.env.COPPER_API_KEY;
      const userEmail = copper.email || process.env.COPPER_USER_EMAIL;
      const baseUrl = getCopperBaseUrl(copper);
      if (!apiKey || !userEmail) {
        throw new Error('Copper credentials missing for RingSense update');
      }
      const headers = getCopperHeaders({ apiKey, userEmail });

      const detailsBlock = [
        '\n--- RingSense Summary ---',
        summary ? `Summary: ${summary}` : null,
        sentiment ? `Sentiment: ${sentiment}` : null,
        Array.isArray(actionItems) ? `Action Items: ${actionItems.map(a => (a.title || a.text || a)).join('; ')}` : null
      ].filter(Boolean).join('\n');

      if (activityId) {
        try {
          // Fetch current activity to append details (best-effort)
          let currentDetails = '';
          try {
            const existing = await copperFetch(baseUrl, `/activities/${encodeURIComponent(activityId)}`, { method: 'GET', headers });
            currentDetails = existing?.details || '';
          } catch {}
          const updatePayload = { details: `${currentDetails || ''}${detailsBlock}` };
          await copperUpdateActivity({ baseUrl, headers }, activityId, updatePayload);
        } catch (e) {
          await db.collection('ringsense_failed_updates').add({ sessionId, activityId, error: String(e?.message || e), when: receivedAt, detailsBlock });
        }
      } else {
        // If activity not found yet, persist for later reconciliation
        await db.collection('ringsense_pending').doc(String(sessionId)).set({
          sessionId,
          detailsBlock,
          createdAt: receivedAt
        }, { merge: true });
      }
    }

    res.status(200).json({ ok: true, id: ref.id });
  } catch (e) {
    // Telemetry on error
    try {
      await db.collection('rc_webhook_errors').add({
        source: 'ringsense',
        error: String(e?.message || e),
        at: admin.firestore.FieldValue.serverTimestamp(),
        headers: req.headers
      });
    } catch {}
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}));

// ShipStation webhook receiver
export const shipstationWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const event = {
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      url: req.originalUrl || req.url,
    };
    const ref = await db.collection('shipstation_events').add(event);
    const type = req.body?.resource_type || req.body?.resource || req.body?.event || 'unknown';
    await db.collection('shipstation_events_index').doc(ref.id).set({
      type,
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    res.status(200).json({ ok: true, id: ref.id });
  } catch (e) {
    res.status(500).json({ error: `Failed to process webhook: ${e.message}` });
  }
});

// Firestore queue worker: process ShipStation requests without HTTPS invocation
// Collection: shipstationRequests/{id}
// Writes result to: shipstationResponses/{id}
export const shipstationWorker = onDocumentCreated('shipstationRequests/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const requestId = event.params.id;
  const data = event.data?.data();
  console.log(`[shipstationWorker] 🔔 Received request ${requestId}`, { op: data?.op });

  const writeResponse = async (payload) => {
    try {
      await db.collection('shipstationResponses').doc(requestId).set(payload, { merge: true });
    } catch (e) {
      // Log but don't throw
      console.error('Failed to write response for', requestId, e);
    }
    try {
      await db.collection('shipstationRequests').doc(requestId).set({ status: 'done', finishedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error('Failed to update request status for', requestId, e);
    }
  };

  let creds;
  try {
    creds = await loadShipStationCreds();
  } catch (e) {
    await writeResponse({ status: 'error', error: `Missing credentials: ${e.message}`, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.error(`[shipstationWorker] ❌ Missing credentials for ${requestId}: ${e.message}`);
    return;
  }

  const base = 'https://ssapi.shipstation.com';
  const headers = {
    'Authorization': buildAuthHeader(creds),
    'Content-Type': 'application/json'
  };

  const op = data?.op;
  const params = data?.params || {};
  try {
    if (op === 'testConnection') {
      const url = new URL(base + '/stores');
      const resp = await fetch(url.toString(), { method: 'GET', headers });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!resp.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
      await writeResponse({ status: 'ok', data, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`[shipstationWorker] ✅ testConnection ok for ${requestId}`);
      return;
    }

    if (op === 'listOrders') {
      const { start, end, page = 1, pageSize = 50, orderNumber } = params;
      const url = new URL(base + '/orders');
      if (start) url.searchParams.set('createDateStart', start);
      if (end) url.searchParams.set('createDateEnd', end);
      if (orderNumber) url.searchParams.set('orderNumber', String(orderNumber));
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      const resp = await fetch(url.toString(), { method: 'GET', headers });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!resp.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
      await writeResponse({ status: 'ok', data, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`[shipstationWorker] ✅ listOrders ok for ${requestId}`);
      return;
    }

    if (op === 'getOrder') {
      const { orderId } = params;
      const url = new URL(base + `/orders/${orderId}`);
      const resp = await fetch(url.toString(), { method: 'GET', headers });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!resp.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
      await writeResponse({ status: 'ok', data, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`[shipstationWorker] ✅ getOrder ok for ${requestId}`);
      return;
    }

    if (op === 'getRates') {
      const body = params?.shipment || params;
      const url = new URL(base + '/shipments/getrates');
      const resp = await fetch(url.toString(), { method: 'POST', headers, body: JSON.stringify(body || {}) });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!resp.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
      await writeResponse({ status: 'ok', data, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`[shipstationWorker] ✅ getRates ok for ${requestId}`);
      return;
    }

    // Unknown op
    await writeResponse({ status: 'error', error: `Unknown op: ${op}`, finishedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.error(`[shipstationWorker] ❌ Unknown op for ${requestId}: ${op}`);
  } catch (e) {
    console.error(`[shipstationWorker] 💥 Error for ${requestId}:`, e?.stack || e);
    await writeResponse({ status: 'error', error: String(e?.message || e), finishedAt: admin.firestore.FieldValue.serverTimestamp() });
  } finally {
    console.log(`[shipstationWorker] 🏁 Finished ${requestId}`);
  }
});

// =============================
// RingCentral AI Summary Processing
// =============================

export const aiSummary = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { sessionId, notes } = req.body;
    
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }

    // For now, create a simple summary from notes
    // TODO: Integrate with RingSense AI API for actual call transcription and summary
    const summary = notes ? 
      `Call summary: ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}` :
      'Call completed - no notes provided';

    // Store summary in Firestore
    await db.collection('call_summaries').doc(sessionId).set({
      sessionId,
      summary,
      notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processed: true
    });

    res.json({ 
      sessionId,
      summary,
      success: true 
    });

  } catch (error) {
    console.error('AI summary error:', error);
    res.status(500).json({ error: 'Failed to process AI summary' });
  }
}));

// =============================
// Copper CRM Integration Endpoints
// =============================

async function loadCopperConfig() {
  try {
    const doc = await db.collection('integrations').doc('connections').get();
    const data = doc.exists ? doc.data() : null;
    const copper = data?.copper || {};
    
    if (!copper.apiKey || !copper.userEmail) {
      throw new Error('Missing Copper CRM credentials');
    }
    
    return {
      apiKey: copper.apiKey,
      userEmail: copper.userEmail,
      baseUrl: copper.baseUrl || 'https://api.copper.com/developer_api/v1'
    };
  } catch (error) {
    throw new Error(`Failed to load Copper config: ${error.message}`);
  }
}

export const copperLookup = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { phone } = req.body;
    
    if (!phone) {
      res.status(400).json({ error: 'Phone number required' });
      return;
    }

    const copperConfig = await loadCopperConfig();
    const headers = getCopperHeaders(copperConfig);
    const baseUrl = getCopperBaseUrl(copperConfig);

    // Try to find person by phone
    const person = await copperFindPersonByPhone({ baseUrl, headers }, phone, 'any');
    
    if (person) {
      res.json({
        name: person.name,
        company: person.company_name,
        email: person.emails?.[0]?.email,
        phone: phone,
        copperId: person.id,
        type: 'person'
      });
      return;
    }

    // Try to find company by phone
    const company = await copperFindCompanyByPhone({ baseUrl, headers }, phone, 'any');
    
    if (company) {
      res.json({
        name: company.name,
        company: company.name,
        phone: phone,
        copperId: company.id,
        type: 'company'
      });
      return;
    }

    // No match found
    res.json({
      name: null,
      company: null,
      phone: phone,
      copperId: null,
      type: null
    });

  } catch (error) {
    console.error('Copper lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup customer in Copper' });
  }
}));

export const copperLogCall = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { sessionId, from, to, direction, notes, aiSummary, startTime, endTime } = req.body;
    
    if (!sessionId || !from) {
      res.status(400).json({ error: 'Session ID and phone number required' });
      return;
    }

    const copperConfig = await loadCopperConfig();
    const headers = getCopperHeaders(copperConfig);
    const baseUrl = getCopperBaseUrl(copperConfig);

    // Find the customer in Copper
    const phoneToSearch = direction === 'Inbound' ? from : to;
    const person = await copperFindPersonByPhone({ baseUrl, headers }, phoneToSearch, 'any');
    const company = person ? null : await copperFindCompanyByPhone({ baseUrl, headers }, phoneToSearch, 'any');
    
    const relatedEntity = person || company;
    
    // Calculate call duration
    let duration = null;
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      duration = Math.floor((end - start) / 1000); // Duration in seconds
    }

    // Create activity payload
    const activityPayload = {
      type: 'phone_call',
      details: `${direction} call ${duration ? `(${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})` : ''}`,
      activity_date: startTime ? new Date(startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      old_activity_type_id: null, // Let Copper assign default phone call type
      notes: [notes, aiSummary].filter(Boolean).join('\n\n'),
      parent: relatedEntity ? {
        id: relatedEntity.id,
        type: person ? 'person' : 'company'
      } : null
    };

    // Create the activity in Copper
    const activity = await copperCreateActivity({ baseUrl, headers }, activityPayload);

    // Store call log in Firestore for our records
    await db.collection('call_logs').doc(sessionId).set({
      sessionId,
      from,
      to,
      direction,
      notes,
      aiSummary,
      startTime,
      endTime,
      duration,
      copperActivityId: activity.id,
      copperEntityId: relatedEntity?.id,
      copperEntityType: relatedEntity ? (person ? 'person' : 'company') : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ 
      success: true,
      copperActivityId: activity.id,
      relatedEntity: relatedEntity ? {
        id: relatedEntity.id,
        name: relatedEntity.name,
        type: person ? 'person' : 'company'
      } : null
    });

  } catch (error) {
    console.error('Copper call logging error:', error);
    res.status(500).json({ error: 'Failed to log call to Copper' });
  }
}));

export const copperAddSummary = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { phone, summary, notes } = req.body;
    
    if (!phone || !summary) {
      res.status(400).json({ error: 'Phone number and summary required' });
      return;
    }

    const copperConfig = await loadCopperConfig();
    const headers = getCopperHeaders(copperConfig);
    const baseUrl = getCopperBaseUrl(copperConfig);

    // Find the customer in Copper
    const person = await copperFindPersonByPhone({ baseUrl, headers }, phone, 'any');
    const company = person ? null : await copperFindCompanyByPhone({ baseUrl, headers }, phone, 'any');
    
    const relatedEntity = person || company;
    
    if (!relatedEntity) {
      res.status(404).json({ error: 'Customer not found in Copper' });
      return;
    }

    // Create a note/activity with the AI summary
    const activityPayload = {
      type: 'note',
      details: 'AI Call Summary',
      activity_date: new Date().toISOString().split('T')[0],
      notes: `AI Generated Call Summary:\n\n${summary}${notes ? `\n\nOriginal Notes:\n${notes}` : ''}`,
      parent: {
        id: relatedEntity.id,
        type: person ? 'person' : 'company'
      }
    };

    const activity = await copperCreateActivity({ baseUrl, headers }, activityPayload);

    res.json({ 
      success: true,
      copperActivityId: activity.id,
      addedTo: {
        id: relatedEntity.id,
        name: relatedEntity.name,
        type: person ? 'person' : 'company'
      }
    });

  } catch (error) {
    console.error('Copper add summary error:', error);
    res.status(500).json({ error: 'Failed to add summary to Copper profile' });
  }
}));

// =============================
// RingCentral Token Endpoint
// =============================

// Removed duplicate - using the one below

// Helper function to refresh RingCentral token
async function refreshRingCentralToken(refreshToken, ownerId = '') {
  try {
    const snap = await RC_CONNECTIONS_DOC.get();
    const cfg = snap.exists ? (snap.data()?.ringcentral || {}) : {};
    const clientId = cfg.clientId || process.env.RC_CLIENT_ID || '';
    const clientSecret = cfg.clientSecret || process.env.RC_CLIENT_SECRET || '';
    const base = cfg.environment === 'sandbox' ? 'https://platform.devtest.ringcentral.com' : 'https://platform.ringcentral.com';

    if (!clientId || !clientSecret) {
      throw new Error('RingCentral configuration incomplete');
    }

    const tokenUrl = `${base}/restapi/oauth/token`;
    const tokenData = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    };

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(tokenData).toString()
    });

    const tokenResult = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenResult.error_description || tokenResult.error}`);
    }

    // Update stored tokens
    const tokenDoc = {
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token || refreshToken, // Keep old refresh token if new one not provided
      tokenType: tokenResult.token_type || 'Bearer',
      expiresIn: tokenResult.expires_in,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + (tokenResult.expires_in * 1000))),
      scope: tokenResult.scope,
      refreshedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Write back to org-level and optionally user-scoped map
    await RC_TOKENS_DOC.set(tokenDoc, { merge: true });
    if (ownerId) {
      await RC_TOKENS_DOC.set({ users: { [ownerId]: tokenDoc } }, { merge: true });
    }
    
    return {
      accessToken: tokenResult.access_token,
      expiresAt: tokenDoc.expiresAt.toDate().toISOString()
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// =============================
// Configuration Loading Endpoint
// =============================

// Load all integration configurations for the app
export const loadConfigurations = onRequest(withCors(async (req, res) => {
  try {
    const connectionsDoc = await db.collection('integrations').doc('connections').get();
    const connections = connectionsDoc.exists ? connectionsDoc.data() : {};
    
    // Return sanitized configuration (no secrets)
    console.log('Raw connections from Firestore:', JSON.stringify(connections, null, 2));
    
    const config = {
      ringcentral: {
        configured: !!(connections.ringcentral?.clientId || process.env.RINGCENTRAL_CLIENT_ID),
        clientId: connections.ringcentral?.clientId || process.env.RINGCENTRAL_CLIENT_ID || null,
        environment: connections.ringcentral?.environment || 'production',
        redirectUri: connections.ringcentral?.redirectUri || 'https://kanvaportal.web.app/rc/auth/callback'
      },
      copper: {
        configured: !!(connections.copper?.apiKey && connections.copper?.userEmail),
        userEmail: connections.copper?.userEmail
      },
      shipstation: {
        configured: !!(connections.shipstation?.apiKey && connections.shipstation?.apiSecret)
      }
    };
    
    res.status(200).json({ success: true, config });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}));

// ... rest of the code remains the same ...
// RingCentral Sync Endpoint
// =============================

export const rcSync = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { sessionId, from, to, direction, notes, endedAt, agentEmail } = req.body || {};
    
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'sessionId required' });
      return;
    }

    // Queue the sync job (reuse existing sync infrastructure)
    const job = {
      sessionId: String(sessionId),
      from: from || null,
      to: to || null,
      direction: direction || null,
      notes: String(notes || ''),
      endedAt: endedAt ? admin.firestore.Timestamp.fromDate(new Date(endedAt)) : null,
      agentEmail: agentEmail || null,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0
    };
    
    await db.collection('ringcentral_sync_queue').doc(String(sessionId)).set(job, { merge: true });
    
    res.status(202).json({ success: true, queued: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}));
// Note: aiSummary function already declared above at line 939

// Helper function for AI summary generation
function generateCallSummary(transcript, duration, participants) {
  // Basic summary generation - enhance with actual AI service integration
  const words = transcript.split(' ').length;
  const estimatedDuration = duration ? `${Math.round(duration/60)} minutes` : 'unknown duration';
  
  return {
    overview: `Call summary generated from ${words} words of transcript over ${estimatedDuration}.`,
    keyPoints: extractKeyPoints(transcript),
    actionItems: extractActionItems(transcript),
    sentiment: analyzeSentiment(transcript),
    participants: participants || ['Unknown']
  };
}

function extractKeyPoints(transcript) {
  // Simple keyword extraction - enhance with NLP
  const keywords = ['quote', 'price', 'order', 'product', 'shipping', 'payment', 'follow up'];
  const found = keywords.filter(keyword => 
    transcript.toLowerCase().includes(keyword)
  );
  return found.length ? found : ['General discussion'];
}

function extractActionItems(transcript) {
  // Simple action item detection - enhance with NLP
  const actionWords = ['will send', 'follow up', 'call back', 'email', 'quote'];
  const sentences = transcript.split(/[.!?]+/);
  const actions = sentences.filter(sentence =>
    actionWords.some(action => sentence.toLowerCase().includes(action))
  ).slice(0, 3);
  
  return actions.length ? actions.map(s => s.trim()) : ['No specific action items identified'];
}

function analyzeSentiment(transcript) {
  // Basic sentiment analysis - enhance with actual sentiment service
  const positiveWords = ['great', 'excellent', 'good', 'happy', 'satisfied', 'perfect'];
  const negativeWords = ['bad', 'terrible', 'unhappy', 'problem', 'issue', 'concern'];
  
  const text = transcript.toLowerCase();
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Removed alias exports to avoid Cloud Run service name collisions.
