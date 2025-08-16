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
  const openCopperBtn = document.getElementById('openCopper');
  const autoOpenChk = document.getElementById('autoOpenCopper');

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

  // Copper helpers
  function copperBase() {
    return (window.COPPER_BASE || 'https://app.copper.com').replace(/\/$/, '');
  }
  function copperSearchUrl(q) {
    // Global search deep link
    return `${copperBase()}/records?query=${encodeURIComponent(q || '')}`;
  }
  function openCopperForPhone(phone) {
    const url = copperSearchUrl(phone || state.from || state.to || '');
    window.open(url, '_blank', 'noopener');
  }

  async function saveNotes({ draft = false } = {}) {
    const notes = notesEl?.value || '';
    const sessionId = state.sessionId || 'draft';
    const endedAt = state.lastEndedAt || (state.status === 'Disconnected' ? nowIso() : null);

    // Use Hosting rewrite base (e.g., https://<site>/rc)
    const base = (window.RC_CONFIG && window.RC_CONFIG.functionsBase) || '';
    const url = base ? `${base}/notes` : null;

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
    const url = base ? `${base}/sync` : null;
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
  openCopperBtn?.addEventListener('click', () => openCopperForPhone(state.from || state.to));

  // Persist auto-open preference
  const AUTOPEN_KEY = 'rc_auto_open_copper';
  try { autoOpenChk && (autoOpenChk.checked = localStorage.getItem(AUTOPEN_KEY) === '1'); } catch {}
  autoOpenChk?.addEventListener('change', (e) => {
    try { localStorage.setItem(AUTOPEN_KEY, e.target.checked ? '1' : '0'); } catch {}
  });

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

      // Enable Open in Copper button when we have a phone number
      if (openCopperBtn) openCopperBtn.disabled = !(state.from || state.to);

      // Use custom Kanva modal for incoming calls instead of auto-opening Copper
      if ((state.direction || '').toLowerCase() === 'inbound' && window.kanvaCallModal) {
        // Let the custom modal handle the incoming call display
        // The modal will handle auto-opening Copper if the preference is set
        console.log('🔔 Incoming call detected - custom modal will handle display');
      } else if ((state.direction || '').toLowerCase() === 'inbound' && autoOpenChk && autoOpenChk.checked && (state.from || state.to)) {
        // Fallback to old behavior if custom modal not available
        openCopperForPhone(state.from || state.to);
      }
    }

    if (data.type === 'rc-call-hangup-notify') {
      state.status = 'Disconnected';
      state.lastEndedAt = nowIso();
      setStatus('Disconnected');
      // Auto-save notes on call end
      saveNotes({ draft: false }).then(() => queueCopperSync());
    }
  });

  // Add phone icon click handler for Copper activity bar
  function addPhoneIconHandler() {
    // Look for phone icons in Copper's activity bar
    const phoneIcons = document.querySelectorAll('[data-testid*="phone"], .phone-icon, [title*="phone" i], [aria-label*="phone" i]');
    
    phoneIcons.forEach(icon => {
      if (!icon.hasAttribute('data-kanva-handler')) {
        icon.setAttribute('data-kanva-handler', 'true');
        icon.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Show custom Kanva modal in dialer mode
          if (window.kanvaCallModal) {
            window.kanvaCallModal.show('dialer');
          } else {
            console.warn('Kanva call modal not available');
          }
        });
      }
    });
  }

  // Observe DOM changes to catch dynamically added phone icons
  function observeForPhoneIcons() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldCheck = true;
        }
      });
      
      if (shouldCheck) {
        setTimeout(addPhoneIconHandler, 100); // Small delay to ensure DOM is ready
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial check
    setTimeout(addPhoneIconHandler, 1000);
  }

  // Initialize phone icon handlers when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeForPhoneIcons);
  } else {
    observeForPhoneIcons();
  }

  // Expose utility functions for the custom modal to use
  window.rcWidgetUtils = {
    normalizePhone,
    copperSearchUrl,
    openCopperForPhone,
    saveNotes,
    queueCopperSync,
    getState: () => ({ ...state })
  };

})();
