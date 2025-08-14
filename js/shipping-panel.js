/*
 * Shipping Panel UI
 * Adds a Shipping section with Summary, Rates, and Orders, powered by ShipStationIntegration (Firestore queue).
 * Dev-safe: no label purchase; focuses on viewing orders and getting rates.
 */
(function(){
  function el(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function todayISO(date){
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  function buildCard(){
    return el(`
      <div class="card" id="shippingPanelCard">
        <div class="card-header">
          <h3>🚚 Shipping</h3>
          <div class="tabs" style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" data-tab="summary">Summary</button>
            <button class="btn btn-secondary btn-sm" data-tab="rates">Rates</button>
            <button class="btn btn-secondary btn-sm" data-tab="orders">Orders</button>
          </div>
        </div>
        <div class="card-body">
          <div id="shipTab-summary" class="shipTab"></div>
          <div id="shipTab-rates" class="shipTab" style="display:none;"></div>
          <div id="shipTab-orders" class="shipTab" style="display:none;"></div>
        </div>
      </div>
    `);
  }

  function renderSummary(root){
    root.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label>Customer Key</label>
          <input id="sp_customerKey" type="text" placeholder="e.g. companyName or email">
          <small class="text-muted">Used to load/save shipping profile in Firestore</small>
        </div>
        <div class="form-group">
          <label>Ship To Name</label>
          <input id="sp_to_name" type="text">
        </div>
        <div class="form-group">
          <label>Company</label>
          <input id="sp_to_company" type="text">
        </div>
        <div class="form-group">
          <label>Address 1</label>
          <input id="sp_to_address1" type="text">
        </div>
        <div class="form-group">
          <label>Address 2</label>
          <input id="sp_to_address2" type="text">
        </div>
        <div class="form-group">
          <label>City</label>
          <input id="sp_to_city" type="text">
        </div>
        <div class="form-group">
          <label>State</label>
          <input id="sp_to_state" type="text">
        </div>
        <div class="form-group">
          <label>Postal Code</label>
          <input id="sp_to_postal" type="text">
        </div>
        <div class="form-group">
          <label>Country Code</label>
          <input id="sp_to_country" type="text" value="US">
        </div>
        <div class="form-group">
          <label>Residential</label>
          <select id="sp_to_residential">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
      </div>
      <div class="mt-2" style="display:flex;gap:8px;">
        <button id="sp_saveProfile" class="btn btn-primary btn-sm">Save Profile</button>
        <button id="sp_loadProfile" class="btn btn-secondary btn-sm">Load Profile</button>
      </div>
    `;
  }

  function renderRates(root){
    root.innerHTML = `
      <div class="form-grid">
        <div class="form-group"><label>From Postal Code</label><input id="sp_from_postal" type="text" placeholder="e.g. 80301"></div>
        <div class="form-group"><label>Weight (oz)</label><input id="sp_weight_oz" type="number" min="1" value="16"></div>
        <div class="form-group"><label>Dims (L x W x H, in)</label>
          <div style="display:flex;gap:6px;">
            <input id="sp_dim_l" type="number" min="1" value="8" style="width:80px;">
            <input id="sp_dim_w" type="number" min="1" value="6" style="width:80px;">
            <input id="sp_dim_h" type="number" min="1" value="4" style="width:80px;">
          </div>
        </div>
      </div>
      <button id="sp_getRates" class="btn btn-success btn-sm">Get Rates</button>
      <div id="sp_ratesTable" class="mt-3"></div>
    `;
  }

  function renderOrders(root){
    root.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;">
        <label>Start:</label><input id="sp_orders_start" type="date" value="${todayISO(new Date(Date.now()-14*24*3600*1000))}">
        <label>End:</label><input id="sp_orders_end" type="date" value="${todayISO()}">
        <button id="sp_fetchOrders" class="btn btn-primary btn-sm">Fetch</button>
      </div>
      <div id="sp_ordersStatus" class="text-muted mt-2"></div>
      <div id="sp_ordersTable" class="mt-2" style="max-height:320px;overflow:auto;"></div>
    `;
  }

  function bindTabs(card){
    const tabs = card.querySelectorAll('[data-tab]');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-tab');
        card.querySelectorAll('.shipTab').forEach(p => p.style.display = 'none');
        const active = card.querySelector(`#shipTab-${id}`);
        if (active) active.style.display = 'block';
      });
    });
  }

  function getProfileKey(){
    const keyInput = document.getElementById('sp_customerKey');
    if (keyInput && keyInput.value) return keyInput.value.trim();
    const company = document.getElementById('companyName');
    return (company && company.value) ? company.value.trim() : 'default';
  }

  function readShipToFromUI(){
    return {
      name: document.getElementById('sp_to_name')?.value || '',
      company: document.getElementById('sp_to_company')?.value || '',
      address1: document.getElementById('sp_to_address1')?.value || '',
      address2: document.getElementById('sp_to_address2')?.value || '',
      city: document.getElementById('sp_to_city')?.value || '',
      state: document.getElementById('sp_to_state')?.value || '',
      postalCode: document.getElementById('sp_to_postal')?.value || '',
      country: document.getElementById('sp_to_country')?.value || 'US',
      residential: String(document.getElementById('sp_to_residential')?.value) === 'true'
    };
  }

  async function saveProfile(){
    if (!window.firebase || !window.firebase.db) throw new Error('Firebase not initialized');
    const db = window.firebase.db;
    const key = getProfileKey();
    const docRef = db.collection('shippingProfiles').doc(key);
    const profile = { shipTo: readShipToFromUI(), updatedAt: new Date() };
    await docRef.set(profile, { merge: true });
    console.log('✅ Saved shipping profile', key);
  }

  async function loadProfile(){
    if (!window.firebase || !window.firebase.db) throw new Error('Firebase not initialized');
    const db = window.firebase.db;
    const key = getProfileKey();
    const snap = await db.collection('shippingProfiles').doc(key).get();
    if (snap.exists){
      const p = snap.data();
      const s = (p && p.shipTo) || {};
      const set = (id,val)=>{ const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('sp_to_name', s.name);
      set('sp_to_company', s.company);
      set('sp_to_address1', s.address1);
      set('sp_to_address2', s.address2);
      set('sp_to_city', s.city);
      set('sp_to_state', s.state);
      set('sp_to_postal', s.postalCode);
      set('sp_to_country', s.country || 'US');
      const res = document.getElementById('sp_to_residential'); if (res) res.value = String(!!s.residential);
      console.log('📦 Loaded shipping profile', key);
    } else {
      console.log('ℹ️ No profile found for', key);
    }
  }

  function buildShipmentFromUI(){
    const shipTo = readShipToFromUI();
    const fromPostal = document.getElementById('sp_from_postal')?.value || '';
    const weightOz = Math.max(1, Number(document.getElementById('sp_weight_oz')?.value) || 16);
    const dimL = Math.max(1, Number(document.getElementById('sp_dim_l')?.value) || 8);
    const dimW = Math.max(1, Number(document.getElementById('sp_dim_w')?.value) || 6);
    const dimH = Math.max(1, Number(document.getElementById('sp_dim_h')?.value) || 4);
    return {
      shipFrom: { postalCode: fromPostal || undefined, countryCode: 'US' },
      shipTo: {
        name: shipTo.name, company: shipTo.company, address1: shipTo.address1, address2: shipTo.address2,
        city: shipTo.city, state: shipTo.state, postalCode: shipTo.postalCode, countryCode: shipTo.country || 'US',
        residential: !!shipTo.residential
      },
      packages: [{ weight: { value: weightOz, units: 'ounces' }, dimensions: { length: dimL, width: dimW, height: dimH, units: 'inches' } }]
    };
  }

  function renderRatesTable(container, rates){
    if (!Array.isArray(rates) || !rates.length){ container.innerHTML = '<p class="text-muted">No rates returned.</p>'; return; }
    const rows = rates.map(r => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee;">${r?.carrierCode || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${r?.serviceCode || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${typeof r?.shipmentCost === 'number' ? '$'+r.shipmentCost.toFixed(2) : ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${r?.deliveryDays || ''}</td>
      </tr>
    `).join('');
    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Carrier</th><th>Service</th><th>Cost</th><th>Days</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  async function getRates(){
    try{
      if (!window.shipStation || !window.shipStation.isConfigured){
        alert('ShipStation not configured'); return;
      }
      const shipment = buildShipmentFromUI();
      const rates = await window.shipStation.getRates(shipment);
      const tbl = document.getElementById('sp_ratesTable');
      renderRatesTable(tbl, rates);
    }catch(err){
      console.error('Failed to get rates', err);
      alert('Failed to get rates: ' + (err?.message || err));
    }
  }

  function renderOrdersTable(container, orders){
    if (!Array.isArray(orders) || !orders.length){ container.innerHTML = '<p class="text-muted">No orders found for the range.</p>'; return; }
    const rows = orders.map(o => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee;">${o?.orderNumber || o?.orderId || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${o?.orderDate || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${o?.customerEmail || o?.customerUsername || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${o?.orderStatus || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">${(o?.advancedOptions && o.advancedOptions?.customField1) || ''}</td>
      </tr>
    `).join('');
    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Order #</th><th>Date</th><th>Customer</th><th>Status</th><th>Custom1</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  async function fetchOrders(){
    try{
      if (!window.shipStation || !window.shipStation.isConfigured){
        alert('ShipStation not configured'); return;
      }
      const startEl = document.getElementById('sp_orders_start');
      const endEl = document.getElementById('sp_orders_end');
      const start = new Date(`${startEl.value}T00:00:00`);
      const end = new Date(`${endEl.value}T23:59:59`);
      const status = document.getElementById('sp_ordersStatus');
      status.textContent = 'Loading...';
      const { orders, total } = await window.shipStation.listOrders({ start, end, page: 1, pageSize: 100 });
      status.textContent = `Loaded ${orders.length}${typeof total==='number' ? ' of '+total : ''}`;
      renderOrdersTable(document.getElementById('sp_ordersTable'), orders);
    }catch(err){
      console.error('Failed to fetch orders', err);
      alert('Failed to fetch orders: ' + (err?.message || err));
    }
  }

  function attachHandlers(card){
    const summaryRoot = card.querySelector('#shipTab-summary');
    const ratesRoot = card.querySelector('#shipTab-rates');
    const ordersRoot = card.querySelector('#shipTab-orders');
    renderSummary(summaryRoot);
    renderRates(ratesRoot);
    renderOrders(ordersRoot);

    // Defaults
    const company = document.getElementById('companyName');
    if (company && company.value){
      const keyInput = document.getElementById('sp_customerKey');
      if (keyInput) keyInput.value = company.value;
    }

    // Bind actions
    const saveBtn = card.querySelector('#sp_saveProfile');
    const loadBtn = card.querySelector('#sp_loadProfile');
    const getRatesBtn = card.querySelector('#sp_getRates');
    const fetchOrdersBtn = card.querySelector('#sp_fetchOrders');
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);
    if (loadBtn) loadBtn.addEventListener('click', loadProfile);
    if (getRatesBtn) getRatesBtn.addEventListener('click', getRates);
    if (fetchOrdersBtn) fetchOrdersBtn.addEventListener('click', fetchOrders);
  }

  function insertPanel(){
    const app = document.getElementById('app');
    if (!app) return;
    const card = buildCard();
    // Insert before the bottom row to keep layout consistent
    const bottomRow = document.querySelector('.bottom-row');
    if (bottomRow && bottomRow.parentNode){
      bottomRow.parentNode.insertBefore(card, bottomRow);
    } else {
      app.appendChild(card);
    }
    bindTabs(card);
    attachHandlers(card);
  }

  // Initialize after DOM is ready
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', insertPanel);
  } else {
    insertPanel();
  }
})();
