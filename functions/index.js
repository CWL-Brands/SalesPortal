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
