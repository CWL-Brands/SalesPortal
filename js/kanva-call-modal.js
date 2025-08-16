'use strict';

/**
 * Kanva Botanicals Custom Call Modal
 * Branded RingCentral integration for Copper CRM
 */

class KanvaCallModal {
  constructor() {
    this.isVisible = false;
    this.currentCall = null;
    this.callNotes = '';
    this.callStartTime = null;
    this.callEndTime = null;
    this.customerData = null;
    this.aiSummary = null;
    
    this.init();
  }

  init() {
    this.createModalHTML();
    this.bindEvents();
    this.setupRingCentralListeners();
  }

  createModalHTML() {
    const modalHTML = `
      <div id="kanva-call-modal" class="kanva-modal-overlay" style="display: none;">
        <div class="kanva-modal-container">
          <!-- Header -->
          <div class="kanva-modal-header">
            <div class="kanva-brand">
              <img src="/assets/logo/kanva-logo-white.png" alt="Kanva" class="kanva-logo">
              <span class="kanva-title">Call Center</span>
            </div>
            <button class="kanva-close-btn" onclick="window.kanvaCallModal.hide()">×</button>
          </div>

          <!-- Call Status Display -->
          <div class="kanva-call-status">
            <div class="kanva-caller-info">
              <div class="kanva-caller-avatar">👤</div>
              <div class="kanva-caller-details">
                <div class="kanva-caller-name" id="kanva-caller-name">Unknown Caller</div>
                <div class="kanva-caller-phone" id="kanva-caller-phone">—</div>
                <div class="kanva-caller-company" id="kanva-caller-company"></div>
              </div>
            </div>
            <div class="kanva-call-timer">
              <span id="kanva-call-duration">00:00</span>
              <div class="kanva-call-state" id="kanva-call-state">Incoming</div>
            </div>
          </div>

          <!-- Call Controls -->
          <div class="kanva-call-controls">
            <button class="kanva-control-btn kanva-answer" id="kanva-answer-btn" onclick="window.kanvaCallModal.answerCall()">
              📞 Answer
            </button>
            <button class="kanva-control-btn kanva-hangup" id="kanva-hangup-btn" onclick="window.kanvaCallModal.hangupCall()">
              📵 Hang Up
            </button>
            <button class="kanva-control-btn kanva-voicemail" id="kanva-voicemail-btn" onclick="window.kanvaCallModal.sendToVoicemail()">
              📧 Voicemail
            </button>
          </div>

          <!-- Dialer (for outbound calls) -->
          <div class="kanva-dialer" id="kanva-dialer" style="display: none;">
            <input type="tel" class="kanva-dial-input" id="kanva-dial-number" placeholder="Enter phone number">
            <div class="kanva-dial-pad">
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('1')">1</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('2')">2 ABC</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('3')">3 DEF</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('4')">4 GHI</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('5')">5 JKL</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('6')">6 MNO</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('7')">7 PQRS</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('8')">8 TUV</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('9')">9 WXYZ</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('*')">*</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('0')">0</button>
              <button class="kanva-dial-btn" onclick="window.kanvaCallModal.addDigit('#')">#</button>
            </div>
            <button class="kanva-call-btn" onclick="window.kanvaCallModal.makeCall()">📞 Call</button>
          </div>

          <!-- Notes Section -->
          <div class="kanva-notes-section">
            <div class="kanva-notes-header">
              <h4>Call Notes</h4>
              <button class="kanva-toggle-dialer" onclick="window.kanvaCallModal.toggleDialer()">+ Dialer</button>
            </div>
            <textarea 
              id="kanva-call-notes" 
              class="kanva-notes-textarea" 
              placeholder="Take notes during the call..."
              rows="4"
            ></textarea>
            <div class="kanva-notes-actions">
              <button class="kanva-save-notes" onclick="window.kanvaCallModal.saveNotes()">Save Notes</button>
              <div class="kanva-ai-status" id="kanva-ai-status"></div>
            </div>
          </div>

          <!-- AI Summary (appears after call) -->
          <div class="kanva-ai-summary" id="kanva-ai-summary" style="display: none;">
            <h4>AI Call Summary</h4>
            <div class="kanva-summary-content" id="kanva-summary-content"></div>
            <button class="kanva-add-to-copper" onclick="window.kanvaCallModal.addToCopperProfile()">
              Add to Copper Profile
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.addModalStyles();
  }

  addModalStyles() {
    const styles = `
      <style id="kanva-modal-styles">
        .kanva-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.7); z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
        }
        .kanva-modal-container {
          background: white; border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          width: min(420px, 90vw); max-height: 90vh; overflow-y: auto;
          animation: kanvaModalSlideIn 0.3s ease-out;
        }
        @keyframes kanvaModalSlideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .kanva-modal-header {
          background: linear-gradient(135deg, #2d5a2d, #4a7c59);
          color: white; padding: 16px 20px; border-radius: 16px 16px 0 0;
          display: flex; align-items: center; justify-content: space-between;
        }
        .kanva-brand { display: flex; align-items: center; gap: 12px; }
        .kanva-logo { height: 32px; width: auto; }
        .kanva-title { font-size: 18px; font-weight: 600; }
        .kanva-close-btn {
          background: rgba(255, 255, 255, 0.2); border: none; color: white;
          padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 18px;
        }
        .kanva-call-status {
          padding: 20px; display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
        }
        .kanva-caller-info { display: flex; align-items: center; gap: 16px; }
        .kanva-caller-avatar { font-size: 40px; }
        .kanva-caller-details { display: flex; flex-direction: column; gap: 4px; }
        .kanva-caller-name { font-size: 18px; font-weight: 600; color: #1f2937; }
        .kanva-caller-phone { font-size: 14px; color: #6b7280; font-family: monospace; }
        .kanva-caller-company { font-size: 12px; color: #2d5a2d; font-weight: 500; }
        .kanva-call-timer { text-align: right; }
        #kanva-call-duration { font-size: 24px; font-weight: 600; color: #1f2937; font-family: monospace; }
        .kanva-call-state { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .kanva-call-controls {
          padding: 20px; display: flex; gap: 12px; justify-content: center;
          border-bottom: 1px solid #e5e7eb;
        }
        .kanva-control-btn {
          padding: 16px; border: none; border-radius: 12px; cursor: pointer;
          font-size: 12px; font-weight: 500; transition: all 0.2s; min-width: 80px;
        }
        .kanva-answer { background: #10b981; color: white; }
        .kanva-hangup { background: #ef4444; color: white; }
        .kanva-voicemail { background: #f3f4f6; color: #374151; }
        .kanva-dialer { padding: 20px; border-bottom: 1px solid #e5e7eb; }
        .kanva-dial-input {
          width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;
          font-size: 18px; text-align: center; margin-bottom: 16px; font-family: monospace;
        }
        .kanva-dial-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
        .kanva-dial-btn {
          padding: 12px; border: 1px solid #e5e7eb; background: white; border-radius: 8px;
          cursor: pointer; font-size: 14px; transition: all 0.2s;
        }
        .kanva-call-btn {
          width: 100%; padding: 12px; background: #2d5a2d; color: white; border: none;
          border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;
        }
        .kanva-notes-section { padding: 20px; }
        .kanva-notes-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .kanva-notes-header h4 { margin: 0; color: #1f2937; font-size: 16px; }
        .kanva-toggle-dialer {
          background: #f3f4f6; border: 1px solid #e5e7eb; color: #374151;
          padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;
        }
        .kanva-notes-textarea {
          width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;
          resize: vertical; font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px; line-height: 1.5;
        }
        .kanva-notes-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
        .kanva-save-notes {
          background: #2d5a2d; color: white; border: none; padding: 8px 16px;
          border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;
        }
        .kanva-ai-status { font-size: 12px; color: #6b7280; }
        .kanva-ai-summary { padding: 20px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
        .kanva-ai-summary h4 { margin: 0 0 12px 0; color: #1f2937; font-size: 16px; }
        .kanva-summary-content {
          background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;
          margin-bottom: 16px; font-size: 14px; line-height: 1.6;
        }
        .kanva-add-to-copper {
          background: #f97316; color: white; border: none; padding: 10px 20px;
          border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; width: 100%;
        }
      </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  bindEvents() {
    const notesTextarea = document.getElementById('kanva-call-notes');
    if (notesTextarea) {
      notesTextarea.addEventListener('input', (e) => {
        this.callNotes = e.target.value;
      });
    }
  }

  setupRingCentralListeners() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || !data.type) return;

      switch (data.type) {
        case 'rc-call-ring-notify':
          this.handleIncomingCall(data);
          break;
        case 'rc-call-start-notify':
          this.handleCallStart(data);
          break;
        case 'rc-call-hangup-notify':
          this.handleCallEnd(data);
          break;
      }
    });
  }

  handleIncomingCall(data) {
    const call = data.call || data.session || data.body || data;
    this.currentCall = {
      sessionId: call.telephonySessionId || call.sessionId || call.id,
      from: this.normalizePhone(call.from?.phoneNumber || call.fromNumber),
      to: this.normalizePhone(call.to?.phoneNumber || call.toNumber),
      direction: call.direction || 'Inbound'
    };

    this.updateCallerDisplay();
    this.lookupCustomerData();
    this.show('incoming');
  }

  handleCallStart(data) {
    this.callStartTime = new Date();
    this.updateCallState('Connected');
    this.startCallTimer();
  }

  handleCallEnd(data) {
    this.callEndTime = new Date();
    this.updateCallState('Disconnected');
    this.stopCallTimer();
    this.processAISummary();
    this.logCallToCopper();
  }

  show(mode = 'dialer') {
    const modal = document.getElementById('kanva-call-modal');
    const dialer = document.getElementById('kanva-dialer');
    const controls = document.querySelector('.kanva-call-controls');

    if (modal) {
      modal.style.display = 'flex';
      this.isVisible = true;

      if (mode === 'incoming') {
        dialer.style.display = 'none';
        controls.style.display = 'flex';
      } else if (mode === 'dialer') {
        dialer.style.display = 'block';
        controls.style.display = 'none';
      }
    }
  }

  hide() {
    const modal = document.getElementById('kanva-call-modal');
    if (modal) {
      modal.style.display = 'none';
      this.isVisible = false;
    }
  }

  updateCallerDisplay() {
    if (!this.currentCall) return;

    const nameEl = document.getElementById('kanva-caller-name');
    const phoneEl = document.getElementById('kanva-caller-phone');
    const companyEl = document.getElementById('kanva-caller-company');

    if (phoneEl) phoneEl.textContent = this.currentCall.from || 'Unknown';
    if (nameEl) nameEl.textContent = this.customerData?.name || 'Unknown Caller';
    if (companyEl) companyEl.textContent = this.customerData?.company || '';
  }

  updateCallState(state) {
    const stateEl = document.getElementById('kanva-call-state');
    if (stateEl) stateEl.textContent = state;
  }

  startCallTimer() {
    this.callTimerInterval = setInterval(() => {
      if (this.callStartTime) {
        const elapsed = Math.floor((new Date() - this.callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        
        const durationEl = document.getElementById('kanva-call-duration');
        if (durationEl) durationEl.textContent = `${minutes}:${seconds}`;
      }
    }, 1000);
  }

  stopCallTimer() {
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
  }

  // Call control methods
  answerCall() {
    this.sendRingCentralMessage({
      type: 'rc-adapter-control-call',
      callAction: 'answer',
      sessionId: this.currentCall?.sessionId
    });
  }

  hangupCall() {
    this.sendRingCentralMessage({
      type: 'rc-adapter-control-call',
      callAction: 'hangup',
      sessionId: this.currentCall?.sessionId
    });
  }

  sendToVoicemail() {
    this.sendRingCentralMessage({
      type: 'rc-adapter-control-call',
      callAction: 'toVoicemail',
      sessionId: this.currentCall?.sessionId
    });
  }

  makeCall() {
    const dialInput = document.getElementById('kanva-dial-number');
    const phoneNumber = dialInput?.value;
    
    if (phoneNumber) {
      this.sendRingCentralMessage({
        type: 'rc-adapter-new-call',
        phoneNumber: this.normalizePhone(phoneNumber),
        toCall: true
      });
    }
  }

  toggleDialer() {
    const dialer = document.getElementById('kanva-dialer');
    if (dialer) {
      dialer.style.display = dialer.style.display === 'none' ? 'block' : 'none';
    }
  }

  addDigit(digit) {
    const dialInput = document.getElementById('kanva-dial-number');
    if (dialInput) {
      dialInput.value += digit;
    }
  }

  normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 11 && cleaned[0] === '1') return '+' + cleaned;
    if (cleaned.length === 10) return '+1' + cleaned;
    return cleaned;
  }

  sendRingCentralMessage(message) {
    const iframe = document.getElementById('rc-iframe') || document.getElementById('rc-iframe-overlay');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, '*');
    }
  }

  async lookupCustomerData() {
    if (!this.currentCall?.from) return;

    try {
      const response = await fetch('/rc/copper/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: this.currentCall.from })
      });

      if (response.ok) {
        this.customerData = await response.json();
        this.updateCallerDisplay();
      }
    } catch (error) {
      console.error('Customer lookup failed:', error);
    }
  }

  saveNotes() {
    const statusEl = document.getElementById('kanva-ai-status');
    if (statusEl) statusEl.textContent = 'Saving notes...';

    this.saveNotesToServer().then(() => {
      if (statusEl) statusEl.textContent = 'Notes saved';
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 2000);
    });
  }

  async saveNotesToServer() {
    const base = window.RC_CONFIG?.functionsBase || '';
    const url = `${base}/notes`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.currentCall?.sessionId,
          notes: this.callNotes,
          endedAt: this.callEndTime?.toISOString()
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error('Save notes failed:', error);
    }
  }

  async processAISummary() {
    const statusEl = document.getElementById('kanva-ai-status');
    if (statusEl) statusEl.textContent = 'Processing AI summary...';

    try {
      const base = window.RC_CONFIG?.functionsBase || '';
      const response = await fetch(`${base}/ai/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.currentCall?.sessionId,
          notes: this.callNotes
        })
      });

      if (response.ok) {
        this.aiSummary = await response.json();
        this.showAISummary();
      }
    } catch (error) {
      console.error('AI summary failed:', error);
    }

    if (statusEl) statusEl.textContent = '';
  }

  showAISummary() {
    const summaryEl = document.getElementById('kanva-ai-summary');
    const contentEl = document.getElementById('kanva-summary-content');
    
    if (summaryEl && contentEl && this.aiSummary) {
      contentEl.textContent = this.aiSummary.summary || 'No summary available';
      summaryEl.style.display = 'block';
    }
  }

  async logCallToCopper() {
    try {
      const base = window.RC_CONFIG?.functionsBase || '';
      await fetch(`${base}/copper/log-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.currentCall?.sessionId,
          from: this.currentCall?.from,
          to: this.currentCall?.to,
          direction: this.currentCall?.direction,
          notes: this.callNotes,
          aiSummary: this.aiSummary?.summary,
          startTime: this.callStartTime?.toISOString(),
          endTime: this.callEndTime?.toISOString()
        })
      });
    } catch (error) {
      console.error('Copper logging failed:', error);
    }
  }

  async addToCopperProfile() {
    const statusEl = document.getElementById('kanva-ai-status');
    if (statusEl) statusEl.textContent = 'Adding to Copper...';

    try {
      const base = window.RC_CONFIG?.functionsBase || '';
      await fetch(`${base}/copper/add-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: this.currentCall?.from,
          summary: this.aiSummary?.summary,
          notes: this.callNotes
        })
      });

      if (statusEl) statusEl.textContent = 'Added to Copper profile';
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 2000);
    } catch (error) {
      console.error('Add to Copper failed:', error);
      if (statusEl) statusEl.textContent = 'Failed to add to Copper';
    }
  }
}

// Initialize the modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.kanvaCallModal = new KanvaCallModal();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KanvaCallModal;
}
