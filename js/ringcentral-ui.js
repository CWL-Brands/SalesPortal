(function(){
  const RC = {
    state: { configured: false, tokens: false },
    els: {},
  };

  function h(tag, attrs = {}, children = []){
    const el = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)){
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.substring(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of [].concat(children)){
      if (c == null) continue;
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  }

  async function getStatus(){
    try{
      const res = await fetch('/rc/status', { cache: 'no-store' });
      const data = await res.json().catch(()=>({}));
      const configured = !!data?.data?.configured;
      const tokens = !!data?.data?.tokens;
      RC.state.configured = configured;
      RC.state.tokens = tokens;
      updateBadge();
      return { configured, tokens };
    }catch(e){
      RC.state.configured = false;
      RC.state.tokens = false;
      updateBadge('error');
      return { configured:false, tokens:false };
    }
  }

  function updateBadge(state){
    const badge = RC.els.badge;
    if (!badge) return;
    const ok = RC.state.configured && RC.state.tokens;
    let text = ok ? 'RC: Green' : (RC.state.configured ? 'RC: Auth needed' : 'RC: Not configured');
    if (state === 'error') text = 'RC: Error';
    badge.textContent = text;
    badge.style.background = ok ? '#10b981' : '#f59e0b';
    badge.style.color = '#fff';
  }

  function ensureUI(){
    const host = document.querySelector('.header-actions');
    if (!host) return;

    const badge = h('span', { id:'rcStatusBadge', class:'btn btn-sm', style:'margin-left:8px; background:#6b7280; color:#fff; cursor:default;' }, 'RC: ...');
    RC.els.badge = badge;

    const toggleBtn = h('button', { id:'rcPanelToggle', class:'btn btn-secondary btn-sm', style:'margin-left:8px;' }, ['RC Tools']);

    const panel = h('div', { id:'rcPanel', style:'display:none; position:absolute; right:12px; top:56px; z-index:1000; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; width:340px; box-shadow:0 10px 15px rgba(0,0,0,0.1);' });
    panel.append(
      h('div', { style:'font-weight:600; margin-bottom:8px;' }, 'RingCentral Tester'),
      h('div', { style:'display:flex; gap:6px; margin-bottom:10px;' }, [
        h('button', { class:'btn btn-sm btn-primary', onclick: onCheckStatus }, 'Check Status'),
        h('button', { class:'btn btn-sm', style:'background:#111827; color:#fff;', onclick: onSendWebhook }, 'Send Test Webhook'),
      ]),
      h('div', { style:'margin-bottom:8px;' }, [ h('label', { for:'rcSessionId', style:'display:block; font-size:12px; color:#374151; margin-bottom:4px;' }, 'Session Id'),
        h('input', { id:'rcSessionId', type:'text', placeholder:'e.g. test-123', style:'width:100%; padding:6px; border:1px solid #d1d5db; border-radius:6px;' }) ]),
      h('div', { style:'margin-bottom:8px;' }, [ h('label', { for:'rcNotes', style:'display:block; font-size:12px; color:#374151; margin-bottom:4px;' }, 'Notes'),
        h('textarea', { id:'rcNotes', rows:'3', placeholder:'Type notes...', style:'width:100%; padding:6px; border:1px solid #d1d5db; border-radius:6px;' }) ]),
      h('div', { style:'display:flex; gap:6px; margin-bottom:10px;' }, [
        h('button', { class:'btn btn-sm btn-success', onclick: onSaveNotes }, 'Save Notes'),
      ]),
      h('pre', { id:'rcOutput', style:'max-height:180px; overflow:auto; font-size:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:8px; margin:0;' })
    );

    toggleBtn.addEventListener('click', ()=>{
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e)=>{
      if (!panel.contains(e.target) && e.target !== toggleBtn) {
        panel.style.display = 'none';
      }
    });

    host.appendChild(badge);
    host.appendChild(toggleBtn);
    // attach at end of body to avoid positioning issues
    document.body.appendChild(panel);
  }

  function setOutput(obj){
    const el = RC.els.output || document.getElementById('rcOutput');
    if (!el) return;
    RC.els.output = el;
    try { el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2); }
    catch { el.textContent = String(obj); }
  }

  async function onCheckStatus(){
    const s = await getStatus();
    setOutput({ action:'status', ...s });
  }

  async function onSendWebhook(){
    const input = document.getElementById('rcSessionId');
    const sessionId = (input && input.value) ? input.value.trim() : `test-${Date.now()}`;
    if (input && !input.value) input.value = sessionId;
    const payload = {
      telephonySessionId: sessionId,
      direction: 'Inbound',
      from: '+18005551212',
      to: '+18005559876',
      status: 'Ringing'
    };
    try{
      const res = await fetch('/rc/webhook', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const text = await res.text();
      setOutput({ action:'webhook', status: res.status, body: tryJson(text) });
    }catch(e){ setOutput({ action:'webhook', error: String(e) }); }
  }

  async function onSaveNotes(){
    const sessionId = (document.getElementById('rcSessionId')?.value || '').trim();
    const notes = (document.getElementById('rcNotes')?.value || '').trim();
    if (!sessionId){ setOutput('Enter a sessionId first'); return; }
    try{
      const res = await fetch('/rc/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId, notes, agent: null }) });
      const text = await res.text();
      setOutput({ action:'notes', status: res.status, body: tryJson(text) });
    }catch(e){ setOutput({ action:'notes', error: String(e) }); }
  }

  function tryJson(s){ try { return JSON.parse(s); } catch { return s; } }

  async function handleDeepLink(){
    const params = new URLSearchParams(window.location.search);
    if (!params.has('rcModal')) return;
    const st = await getStatus();
    if (!st.tokens){
      // prompt org auth
      window.location.href = '/rc/auth/start';
      return;
    }
    // Open modal if available
    try{
      if (typeof window.launchQuoteModal === 'function') window.launchQuoteModal();
    }catch{}
  }

  window.addEventListener('DOMContentLoaded', async () => {
    ensureUI();
    await getStatus();
    handleDeepLink();
  });
})();
