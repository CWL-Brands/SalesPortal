'use strict';

(function () {
  const iframe = document.getElementById('rc-iframe');
  const sessionEl = document.getElementById('sessionId');
  const fromEl = document.getElementById('fromNum');
  const toEl = document.getElementById('toNum');
  const statusEl = document.getElementById('callStatus');
  const notesEl = document.getElementById('notes');
  const saveBtn = document.getElementById('saveNow');
  const clearBtn = document.getElementById('clearNotes');
  const saveMsg = document.getElementById('saveMsg');

  const state = {
    sessionId: null,
    from: null,
    to: null,
    status: 'idle',
    lastEndedAt: null,
  };

  function setText(el, text) { if (el) el.textContent = text ?? '—'; }
  function setStatus(text) { setText(statusEl, text); }
  function nowIso() { return new Date().toISOString(); }

  // Normalize phone to E.164-ish basic (best-effort client-side; server will enforce)
  function normalizePhone(p) {
    if (!p) return null;
    const s = String(p).replace(/[^0-9+]/g, '');
    if (s.startsWith('+')) return s;
    // If 11 digits starting with 1, add +
    if (s.length === 11 && s[0] === '1') return '+' + s;
    if (s.length === 10) return '+1' + s;
    return s;
  }

  async function saveNotes({ draft = false } = {}) {
    const notes = notesEl?.value || '';
    const sessionId = state.sessionId || 'draft';
    const endedAt = state.lastEndedAt || (state.status === 'Disconnected' ? nowIso() : null);

    // Prefer Cloud Functions endpoint if configured
    const base = (window.RC_CONFIG && window.RC_CONFIG.functionsBase) || '';
    const url = base ? `${base}/ringcentralNotes` : null;

    try {
      if (url) {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, notes, agent: null, endedAt })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setText(saveMsg, draft ? 'Draft saved to server' : 'Notes saved to server');
      } else {
        // Local fallback cache
        const key = `rc_notes_${sessionId}`;
        localStorage.setItem(key, JSON.stringify({ notes, endedAt, savedAt: nowIso() }));
        setText(saveMsg, draft ? 'Draft saved locally' : 'Notes saved locally');
      }
    } catch (e) {
      console.error('Save notes failed:', e);
      setText(saveMsg, `Save failed: ${e.message}`);
    }
  }

  async function queueCopperSync() {
    const base = (window.RC_CONFIG && window.RC_CONFIG.functionsBase) || '';
    const url = base ? `${base}/ringcentralSyncCopper` : null;
    if (!url) return; // no server configured yet
    try {
      const payload = {
        sessionId: state.sessionId,
        from: state.from,
        to: state.to,
        direction: state.direction || null,
        notes: notesEl?.value || '',
        endedAt: state.lastEndedAt || nowIso()
      };
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setText(saveMsg, 'Notes saved and Copper sync queued');
    } catch (e) {
      console.error('Queue Copper sync failed:', e);
      setText(saveMsg, `Copper sync queue failed: ${e.message}`);
    }
  }

  saveBtn?.addEventListener('click', () => saveNotes({ draft: true }));
  clearBtn?.addEventListener('click', () => { if (notesEl) { notesEl.value = ''; setText(saveMsg, ''); } });

  // Listen to RC Embeddable events
  window.addEventListener('message', (e) => {
    const data = e && e.data;
    if (!data) return;

    // Common event shapes:
    // - data.type === 'rc-call-ring-notify' (incoming)
    // - data.type === 'rc-call-start-notify' (answered/outbound connected)
    // - data.type === 'rc-call-hangup-notify' (ended)
    // - data.type === 'rc-active-call-notify'

    if (data.type === 'rc-call-ring-notify' || data.type === 'rc-active-call-notify' || data.type === 'rc-call-start-notify') {
      const call = data.call || data.session || data.body || data;
      const sid = call && (call.telephonySessionId || call.sessionId || call.id);
      const from = normalizePhone(call && (call.from && (call.from.phoneNumber || call.from) || call.fromNumber));
      const to = normalizePhone(call && (call.to && (call.to.phoneNumber || call.to) || call.toNumber));
      const direction = call && (call.direction || (call.basicCallInfo && call.basicCallInfo.direction));

      state.sessionId = sid || state.sessionId;
      state.from = from || state.from;
      state.to = to || state.to;
      state.direction = direction || state.direction || null;
      state.status = 'Connected';

      setText(sessionEl, state.sessionId || '—');
      setText(fromEl, state.from || '—');
      setText(toEl, state.to || '—');
      setStatus('Connected');
    }

    if (data.type === 'rc-call-hangup-notify') {
      state.status = 'Disconnected';
      state.lastEndedAt = nowIso();
      setStatus('Disconnected');
      // Auto-save notes on call end
      saveNotes({ draft: false }).then(() => queueCopperSync());
    }
  });
})();
