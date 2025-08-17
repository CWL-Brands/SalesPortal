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

// Global functions for Copper SDK integration
function initializeCopper() {
    if (window.kanvaDialer) {
        window.kanvaDialer.initializeCopper();
    }
}

function initializeCustomDialer() {
    window.kanvaDialer = new KanvaDialer();
    window.kanvaDialer.initializeCustomDialer();
}

// Export for use in other scripts
window.KanvaDialer = KanvaDialer;

class KanvaDialer {
    constructor() {
        this.copperSDK = null;
        this.ringCentralPhone = null;
        this.isAuthenticated = false;
        this.currentCustomer = null;
        this.callNotes = '';
        
        // RingCentral config
        this.rcConfig = {
            clientId: 'your-client-id', // Replace with actual client ID
            clientSecret: 'your-client-secret', // Replace with actual secret
            server: 'https://platform.ringcentral.com', // or sandbox
            redirectUri: window.location.origin + '/kanva-call-widget/src/redirect.html'
        };
    }

    /**
     * Initialize Copper SDK integration
     */
    async initializeCopper() {
        try {
            // Initialize Copper SDK
            if (typeof CopperSDK !== 'undefined') {
                this.copperSDK = new CopperSDK();
                
                // Get context from Copper (customer/company data)
                const context = await this.copperSDK.getContext();
                if (context && context.record) {
                    this.loadCustomerFromCopper(context.record);
                }
                
                // Listen for context changes
                this.copperSDK.onContextChange((newContext) => {
                    if (newContext && newContext.record) {
                        this.loadCustomerFromCopper(newContext.record);
                    }
                });
                
                console.log('✅ Copper SDK initialized');
            } else {
                // Fallback: try to get customer data from URL params
                this.loadCustomerFromURL();
                console.log('⚠️ Copper SDK not available, using URL params');
            }
        } catch (error) {
            console.error('❌ Copper SDK initialization failed:', error);
            this.loadCustomerFromURL();
        }
    }

    /**
     * Load customer data from Copper record
     */
    loadCustomerFromCopper(record) {
        this.currentCustomer = {
            name: record.name || '',
            company: record.company_name || record.company?.name || '',
            email: record.email || record.emails?.[0]?.email || '',
            phone: record.phone || record.phone_numbers?.[0]?.number || '',
            recordId: record.id,
            recordType: record.type
        };
        
        this.updateCustomerDisplay();
        
        // Pre-fill phone number if available
        if (this.currentCustomer.phone) {
            document.getElementById('phoneInput').value = this.currentCustomer.phone;
        }
        
        console.log('📋 Customer loaded from Copper:', this.currentCustomer);
    }

    /**
     * Fallback: Load customer data from URL parameters
     */
    loadCustomerFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        this.currentCustomer = {
            name: urlParams.get('name') || urlParams.get('customer_name') || '',
            company: urlParams.get('company') || urlParams.get('company_name') || '',
            email: urlParams.get('email') || '',
            phone: urlParams.get('phone') || urlParams.get('phone_number') || '',
            recordId: urlParams.get('record_id') || null,
            recordType: urlParams.get('record_type') || 'person'
        };
        
        this.updateCustomerDisplay();
        
        if (this.currentCustomer.phone) {
            document.getElementById('phoneInput').value = this.currentCustomer.phone;
        }
        
        console.log('📋 Customer loaded from URL:', this.currentCustomer);
    }

    /**
     * Update customer display in UI
     */
    updateCustomerDisplay() {
        document.getElementById('customerName').textContent = this.currentCustomer?.name || '-';
        document.getElementById('customerCompany').textContent = this.currentCustomer?.company || '-';
        document.getElementById('customerEmail').textContent = this.currentCustomer?.email || '-';
    }

    /**
     * Initialize custom dialer
     */
    async initializeCustomDialer() {
        try {
            // Check if RingCentral is already authenticated
            const authData = localStorage.getItem('rc-auth-data');
            if (authData) {
                await this.initializeRingCentral(JSON.parse(authData));
            } else {
                this.showAuthRequired();
            }
            
            this.bindDialerEvents();
            console.log('✅ Custom dialer initialized');
        } catch (error) {
            console.error('❌ Dialer initialization failed:', error);
            this.showAuthRequired();
        }
    }

    /**
     * Show authentication required screen
     */
    showAuthRequired() {
        document.getElementById('authRequired').style.display = 'block';
        document.getElementById('dialerApp').style.display = 'none';
        
        // Set up auth button
        document.getElementById('authButton').onclick = () => {
            this.redirectToRingCentralAuth();
        };
        
        this.updateStatus('offline', 'Authentication Required');
    }

    /**
     * Redirect to RingCentral authentication
     */
    redirectToRingCentralAuth() {
        const authUrl = `${this.rcConfig.server}/restapi/oauth/authorize?` +
            `response_type=code&` +
            `client_id=${this.rcConfig.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.rcConfig.redirectUri)}&` +
            `state=${Math.random().toString(36).substring(7)}`;
        
        // Store current customer context for after auth
        if (this.currentCustomer) {
            localStorage.setItem('kanva-customer-context', JSON.stringify(this.currentCustomer));
        }
        
        window.location.href = authUrl;
    }

    /**
     * Initialize RingCentral with auth data
     */
    async initializeRingCentral(authData) {
        try {
            // Initialize RingCentral WebPhone SDK
            // This is a simplified version - you'll need the actual RingCentral WebPhone SDK
            console.log('🔗 Initializing RingCentral with auth data');
            
            this.isAuthenticated = true;
            this.showDialerApp();
            this.updateStatus('online', 'Connected');
            
            // Restore customer context if available
            const savedContext = localStorage.getItem('kanva-customer-context');
            if (savedContext && !this.currentCustomer?.name) {
                this.currentCustomer = JSON.parse(savedContext);
                this.updateCustomerDisplay();
                localStorage.removeItem('kanva-customer-context');
            }
            
        } catch (error) {
            console.error('❌ RingCentral initialization failed:', error);
            this.showAuthRequired();
        }
    }

    /**
     * Show main dialer app
     */
    showDialerApp() {
        document.getElementById('authRequired').style.display = 'none';
        document.getElementById('dialerApp').style.display = 'block';
        document.getElementById('callButton').disabled = false;
    }

    /**
     * Update status indicator
     */
    updateStatus(status, text) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        statusDot.className = `status-dot ${status === 'offline' ? 'offline' : ''}`;
        statusText.textContent = text;
    }

    /**
     * Bind dialer event listeners
     */
    bindDialerEvents() {
        // Call button
        document.getElementById('callButton').addEventListener('click', () => {
            this.makeCall();
        });

        // Phone input enter key
        document.getElementById('phoneInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.makeCall();
            }
        });

        // Auto-save notes
        document.getElementById('callNotes').addEventListener('input', (e) => {
            this.callNotes = e.target.value;
            this.autoSaveNotes();
        });

        // Format phone number as user types
        document.getElementById('phoneInput').addEventListener('input', (e) => {
            e.target.value = this.formatPhoneNumber(e.target.value);
        });
    }

    /**
     * Make a phone call
     */
    async makeCall() {
        const phoneNumber = document.getElementById('phoneInput').value.replace(/\D/g, '');
        
        if (!phoneNumber) {
            alert('Please enter a phone number');
            return;
        }

        if (!this.isAuthenticated) {
            this.showAuthRequired();
            return;
        }

        try {
            this.updateStatus('calling', `Calling ${this.formatPhoneNumber(phoneNumber)}...`);
            
            // Here you would integrate with actual RingCentral WebPhone SDK
            console.log('📞 Making call to:', phoneNumber);
            
            // Simulate call for demo
            setTimeout(() => {
                this.updateStatus('online', 'Call in progress');
                this.logCallActivity(phoneNumber, 'outbound');
            }, 2000);
            
            // Update Copper with call activity if SDK is available
            if (this.copperSDK && this.currentCustomer?.recordId) {
                await this.logCallInCopper(phoneNumber, 'outbound');
            }
            
        } catch (error) {
            console.error('❌ Call failed:', error);
            this.updateStatus('online', 'Call failed');
            alert('Call failed. Please try again.');
        }
    }

    /**
     * Log call activity in Copper
     */
    async logCallInCopper(phoneNumber, direction) {
        try {
            const activity = {
                type: 'phone_call',
                details: `${direction === 'outbound' ? 'Outbound' : 'Inbound'} call to ${this.formatPhoneNumber(phoneNumber)}`,
                phone_number: phoneNumber,
                notes: this.callNotes,
                person_id: this.currentCustomer.recordType === 'person' ? this.currentCustomer.recordId : null,
                company_id: this.currentCustomer.recordType === 'company' ? this.currentCustomer.recordId : null
            };
            
            await this.copperSDK.createActivity(activity);
            console.log('✅ Call logged in Copper');
        } catch (error) {
            console.error('❌ Failed to log call in Copper:', error);
        }
    }

    /**
     * Log call activity locally
     */
    logCallActivity(phoneNumber, direction) {
        const activity = {
            timestamp: new Date().toISOString(),
            phoneNumber: phoneNumber,
            direction: direction,
            customer: this.currentCustomer,
            notes: this.callNotes
        };
        
        // Store in localStorage for now
        const activities = JSON.parse(localStorage.getItem('kanva-call-activities') || '[]');
        activities.unshift(activity);
        localStorage.setItem('kanva-call-activities', JSON.stringify(activities.slice(0, 100))); // Keep last 100
        
        console.log('📝 Call activity logged:', activity);
    }

    /**
     * Auto-save notes
     */
    autoSaveNotes() {
        if (this.currentCustomer?.recordId) {
            const key = `kanva-notes-${this.currentCustomer.recordId}`;
            localStorage.setItem(key, this.callNotes);
        }
    }

    /**
     * Format phone number for display
     */
    formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        return phone;
    }

    /**
     * Handle incoming calls (if RingCentral WebPhone supports it)
     */
    handleIncomingCall(callInfo) {
        console.log('📞 Incoming call:', callInfo);
        
        // Show call notification
        this.showIncomingCallModal(callInfo);
        
        // Try to lookup customer by phone number
        this.lookupCustomerByPhone(callInfo.from);
    }

    /**
     * Show incoming call modal
     */
    showIncomingCallModal(callInfo) {
        // Create modal for incoming call
        const modal = document.createElement('div');
        modal.className = 'incoming-call-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>📞 Incoming Call</h3>
                <p><strong>From:</strong> ${this.formatPhoneNumber(callInfo.from)}</p>
                <div class="modal-buttons">
                    <button onclick="kanvaDialer.answerCall('${callInfo.sessionId}')" class="btn-answer">Answer</button>
                    <button onclick="kanvaDialer.declineCall('${callInfo.sessionId}')" class="btn-decline">Decline</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Lookup customer by phone number
     */
    async lookupCustomerByPhone(phoneNumber) {
        try {
            if (this.copperSDK) {
                const results = await this.copperSDK.searchByPhone(phoneNumber);
                if (results && results.length > 0) {
                    this.loadCustomerFromCopper(results[0]);
                }
            }
        } catch (error) {
            console.error('❌ Customer lookup failed:', error);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.kanvaWidget = new KanvaWidgetIntegration();
    initializeCustomDialer();
  });
} else {
  window.kanvaWidget = new KanvaWidgetIntegration();
  initializeCustomDialer();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KanvaWidgetIntegration;
}
