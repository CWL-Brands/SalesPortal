import functions from 'firebase-functions';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

admin.initializeApp();
const db = admin.firestore();

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
    const baseUrl = (copper.baseUrl || 'https://api.copper.com/developer_api/v1').replace(/\/$/, '');

    // Validate config (soft-fail to allow queue retention)
    if (!apiKey || !userEmail) {
      throw new Error('Copper credentials missing (apiKey or email).');
    }

    // TODO: Implement lookup and upsert when API shapes confirmed.
    // Placeholder: write an activity stub document we will reconcile after Copper write.
    const placeholder = {
      sessionId,
      from: job.from || null,
      to: job.to || null,
      direction: job.direction || null,
      notes: job.notes || '',
      endedAt: job.endedAt || null,
      // status markers
      copperActivityId: null,
      copperTaskId: null,
      planned: {
        // What we plan to create in Copper
        activity: {
          externalId: `ringcentral:${sessionId}`,
          type: 'Phone Call',
          subject: `Phone Call – ${job.direction || 'Unknown'} – ${job.from || ''} ⇄ ${job.to || ''}`.trim(),
        },
        task: {
          type: 'Phone Call',
          status: 'Completed'
        }
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('ringcentral_copper_activity').doc(String(sessionId)).set(placeholder, { merge: true });

    // Mark done for now; will be updated once Copper integration is finalized
    await jobRef.set({ status: 'done', finishedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    await jobRef.set({ status: 'error', error: String(e.message || e), lastErrorAt: admin.firestore.FieldValue.serverTimestamp(), attempts: (job.attempts || 0) + 1 }, { merge: true });
  }
});

// Queue a Copper sync job for a call session
export const ringcentralSyncCopper = functions.https.onRequest(async (req, res) => {
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
});

// =============================
// RingCentral (stubs, phase 1)
// =============================

// Config doc locations
const RC_CONNECTIONS_DOC = db.collection('integrations').doc('connections');
const RC_TOKENS_DOC = db.collection('integrations').doc('ringcentral_tokens');

// Start OAuth (org-level) – placeholder redirects to RingCentral authorize URL when clientId present
export const ringcentralAuthStart = functions.https.onRequest(async (req, res) => {
  try {
    const snap = await RC_CONNECTIONS_DOC.get();
    const cfg = snap.exists ? (snap.data()?.ringcentral || {}) : {};
    const clientId = cfg.clientId || process.env.RC_CLIENT_ID || '';
    const redirectUri = cfg.redirectUri || process.env.RC_REDIRECT_URI || '';
    const base = cfg.environment === 'sandbox' ? 'https://platform.devtest.ringcentral.com' : 'https://platform.ringcentral.com';
    if (!clientId || !redirectUri) {
      res.status(400).json({ success: false, message: 'RingCentral clientId/redirectUri not configured' });
      return;
    }
    const authUrl = `${base}/restapi/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=kanva&prompt=login`;
    res.redirect(authUrl);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// OAuth callback (store tokens) – stub stores code and timestamp; real token exchange in next phase
export const ringcentralAuthCallback = functions.https.onRequest(async (req, res) => {
  try {
    const { code, state, error } = req.query || {};
    if (error) {
      res.status(400).send(`RingCentral auth error: ${error}`);
      return;
    }
    await RC_TOKENS_DOC.set({ lastAuthCode: String(code || ''), state: String(state || ''), receivedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.status(200).send('RingCentral authorization received. Token exchange to be completed by backend. You can close this window.');
  } catch (e) {
    res.status(500).send(`Callback error: ${e.message}`);
  }
});

// Status endpoint – minimal
export const ringcentralStatus = functions.https.onRequest(async (_req, res) => {
  try {
    const conn = (await RC_CONNECTIONS_DOC.get()).data() || {};
    const tokens = (await RC_TOKENS_DOC.get()).data() || {};
    res.status(200).json({ success: true, data: { configured: !!conn.ringcentral, tokens: !!tokens.accessToken || !!tokens.lastAuthCode } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Webhook receiver – ack fast, write minimal event for screen-pop
export const ringcentralWebhook = functions.https.onRequest(async (req, res) => {
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
});

// Notes endpoint – saves notes tied to session; Copper sync in next phase
export const ringcentralNotes = functions.https.onRequest(async (req, res) => {
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
});

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
