/**
 * Kanva RingCentral Widget Integration
 * Connects new RingCentral JS Widgets with existing Copper integration
 */

class KanvaWidgetIntegration {
  constructor() {
    this.currentCall = null;
    this.copperCustomer = null;
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      // Set up event listeners for widget communication
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('Kanva Widget Integration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Kanva Widget Integration:', error);
    }
  }

  setupEventListeners() {
    // Listen for messages from RingCentral widgets in iframes
    window.addEventListener('message', (event) => {
      // Handle messages from both main iframe and overlay iframe
      if (event.data && event.data.type) {
        this.handleWidgetMessage(event.data);
      }
    });

    // Listen for incoming calls from existing integration
    window.addEventListener('ringcentral-incoming-call', (event) => {
      this.handleIncomingCall(event.detail);
    });
  }

  async handleWidgetMessage(data) {
    switch (data.type) {
      case 'rc-call-ring-notify':
        await this.handleIncomingCall(data.call);
        break;
      case 'rc-call-start-notify':
        this.handleCallStart(data.call);
        break;
      case 'rc-call-end-notify':
        await this.handleCallEnd(data.call);
        break;
      case 'rc-dialer-call':
        this.handleOutgoingCall(data);
        break;
    }
  }

  async handleIncomingCall(callData) {
    this.currentCall = callData;
    
    // Look up customer in Copper using existing Firebase Function
    if (callData.from) {
      try {
        this.copperCustomer = await this.lookupCustomerInCopper(callData.from);
      } catch (error) {
        console.error('Failed to lookup customer:', error);
      }
    }
    
    // Update UI elements if they exist
    this.updateCallUI(callData);
    
    // Send customer data to widgets if found
    if (this.copperCustomer) {
      this.sendCustomerDataToWidgets();
    }
  }

  handleCallStart(callData) {
    this.currentCall = callData;
    this.updateCallUI(callData);
    console.log('Call started:', callData);
  }

  async handleCallEnd(callData) {
    if (!this.currentCall) return;
    
    try {
      // Log call in Copper using existing Firebase Function
      await this.logCallInCopper(this.currentCall);
      
      // Process AI summary if available
      if (callData.recording || callData.summary) {
        await this.processAISummary(callData);
      }
    } catch (error) {
      console.error('Failed to process call end:', error);
    }
    
    this.currentCall = null;
    this.copperCustomer = null;
    this.updateCallUI(null);
  }

  handleOutgoingCall(data) {
    console.log('Outgoing call:', data);
    this.updateCallUI(data);
  }

  updateCallUI(callData) {
    // Update existing UI elements
    const sessionEl = document.getElementById('sessionId');
    const fromEl = document.getElementById('fromNum');
    const toEl = document.getElementById('toNum');
    const statusEl = document.getElementById('callStatus');
    
    if (callData) {
      if (sessionEl) sessionEl.textContent = callData.sessionId || '—';
      if (fromEl) fromEl.textContent = callData.from || '—';
      if (toEl) toEl.textContent = callData.to || '—';
      if (statusEl) statusEl.textContent = callData.status || 'active';
    } else {
      if (sessionEl) sessionEl.textContent = '—';
      if (fromEl) fromEl.textContent = '—';
      if (toEl) toEl.textContent = '—';
      if (statusEl) statusEl.textContent = 'idle';
    }
  }

  sendCustomerDataToWidgets() {
    // Send to both main iframe and overlay iframe
    const mainIframe = document.getElementById('rc-iframe');
    const overlayIframe = document.getElementById('rc-iframe-overlay');
    
    const message = {
      type: 'copper-customer-data',
      customer: this.copperCustomer
    };
    
    if (mainIframe && mainIframe.contentWindow) {
      mainIframe.contentWindow.postMessage(message, '*');
    }
    
    if (overlayIframe && overlayIframe.contentWindow) {
      overlayIframe.contentWindow.postMessage(message, '*');
    }
  }

  async lookupCustomerInCopper(phoneNumber) {
    try {
      const response = await fetch('/copperLookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.customer || null;
    } catch (error) {
      console.error('Error looking up customer:', error);
      return null;
    }
  }

  async logCallInCopper(callData) {
    if (!this.copperCustomer) return;
    
    try {
      const response = await fetch('/copperLogCall', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: this.copperCustomer.id,
          callData: callData,
          notes: callData.notes || '',
          duration: callData.duration || 0
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('Call logged in Copper successfully');
    } catch (error) {
      console.error('Error logging call in Copper:', error);
    }
  }

  async processAISummary(callData) {
    if (!callData.summary && !callData.recording) return;
    
    try {
      const response = await fetch('/aiSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: callData.sessionId,
          recording: callData.recording,
          summary: callData.summary,
          customerId: this.copperCustomer?.id
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Add summary to Copper if customer exists
      if (this.copperCustomer && result.summary) {
        await this.addSummaryToCopper(result.summary);
      }
    } catch (error) {
      console.error('Error processing AI summary:', error);
    }
  }

  async addSummaryToCopper(summary) {
    if (!this.copperCustomer) return;
    
    try {
      const response = await fetch('/copperAddSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: this.copperCustomer.id,
          summary: summary,
          callId: this.currentCall?.sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('AI summary added to Copper successfully');
    } catch (error) {
      console.error('Error adding summary to Copper:', error);
    }
  }

  // Public API methods
  makeCall(phoneNumber) {
    const message = {
      type: 'make-call',
      phoneNumber: phoneNumber
    };
    
    // Send to both iframes
    const mainIframe = document.getElementById('rc-iframe');
    const overlayIframe = document.getElementById('rc-iframe-overlay');
    
    if (mainIframe && mainIframe.contentWindow) {
      mainIframe.contentWindow.postMessage(message, '*');
    }
    
    if (overlayIframe && overlayIframe.contentWindow) {
      overlayIframe.contentWindow.postMessage(message, '*');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.kanvaWidget = new KanvaWidgetIntegration();
  });
} else {
  window.kanvaWidget = new KanvaWidgetIntegration();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KanvaWidgetIntegration;
}
