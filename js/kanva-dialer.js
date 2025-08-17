/**
 * Kanva Dialer - Consolidated Implementation
 * Replaces all bloated dialer implementations with clean, unified functionality
 * Integrates RingCentral WebPhone SDK with Copper CRM
 */
class KanvaDialer {
    constructor() {
        this.webPhone = null;
        this.currentCall = null;
        this.isAuthenticated = false;
        this.callTimer = null;
        this.callStartTime = null;
        this.customerData = null;
        this.callNotes = '';
        
        // Configuration
        this.config = {
            ringcentral: {
                clientId: localStorage.getItem('rc_client_id') || '',
                server: 'https://platform.ringcentral.com',
                redirectUri: `${window.location.origin}/rc/auth/callback`
            },
            copper: {
                apiUrl: 'https://api.copper.com/developer_api/v1',
                apiKey: localStorage.getItem('copper_api_key') || '',
                userEmail: localStorage.getItem('copper_user_email') || ''
            },
            functions: {
                baseUrl: `${window.location.origin}/rc`
            }
        };

        this.init();
    }

    /**
     * Initialize the dialer
     */
    async init() {
        console.log('🚀 Initializing Kanva Dialer...');
        
        try {
            this.bindEvents();
            await this.checkAuthStatus();
            this.updateConnectionStatus();
            this.loadCallHistory();
            
            console.log('✅ Kanva Dialer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Kanva Dialer:', error);
            this.updateConnectionStatus('error', 'Initialization failed');
        }
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Number pad
        document.querySelectorAll('.number-pad button').forEach(button => {
            button.addEventListener('click', () => {
                const digit = button.dataset.number;
                if (digit) this.addDigit(digit);
            });
        });

        // Phone input
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = this.formatPhoneNumber(e.target.value);
            });
            phoneInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.makeCall();
            });
        }

        // Action buttons
        document.getElementById('callButton')?.addEventListener('click', () => this.makeCall());
        document.getElementById('clearButton')?.addEventListener('click', () => this.clearNumber());
        document.getElementById('loginButton')?.addEventListener('click', () => this.startOAuth());

        // Call controls
        document.getElementById('answerButton')?.addEventListener('click', () => this.answerCall());
        document.getElementById('declineButton')?.addEventListener('click', () => this.declineCall());
        document.getElementById('hangupButton')?.addEventListener('click', () => this.hangupCall());
        document.getElementById('muteButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('holdButton')?.addEventListener('click', () => this.toggleHold());

        // Notes
        const callNotes = document.getElementById('callNotes');
        const activeCallNotes = document.getElementById('activeCallNotes');
        
        if (callNotes) {
            callNotes.addEventListener('input', (e) => {
                this.callNotes = e.target.value;
                this.autoSaveNotes();
            });
        }
        
        if (activeCallNotes) {
            activeCallNotes.addEventListener('input', (e) => {
                this.callNotes = e.target.value;
                // Sync with main notes
                if (callNotes) callNotes.value = e.target.value;
            });
        }

        document.getElementById('saveNotesButton')?.addEventListener('click', () => this.saveNotes());

        // Copper navigation buttons
        document.getElementById('openLeadButton')?.addEventListener('click', () => this.openCopperRecord('lead'));
        document.getElementById('openCompanyButton')?.addEventListener('click', () => this.openCopperRecord('company'));
        document.getElementById('openPersonButton')?.addEventListener('click', () => this.openCopperRecord('person'));
        
        // Active call copper buttons
        document.getElementById('activeOpenLeadButton')?.addEventListener('click', () => this.openCopperRecord('lead'));
        document.getElementById('activeOpenCompanyButton')?.addEventListener('click', () => this.openCopperRecord('company'));
        document.getElementById('activeOpenPersonButton')?.addEventListener('click', () => this.openCopperRecord('person'));

        // Click-to-dial support from Copper embedded app via postMessage
        // Accepts messages like { type: 'phoneNumberClicked', phone: '5551234567' }
        window.addEventListener('message', (event) => {
            try {
                const data = event?.data || {};
                const type = data.type || data.event || '';
                if (type === 'phoneNumberClicked' || type === 'kanva:copper:clickToDial') {
                    const num = this.extractPhoneNumber(data.phone || data.number || data.value || '');
                    if (num && num.length >= 10) {
                        const input = document.getElementById('phoneNumber');
                        if (input) input.value = this.formatPhoneNumber(num);
                        if (this.isAuthenticated) this.makeCall();
                    }
                }
            } catch (e) {
                console.warn('click-to-dial message ignored', e);
            }
        }, false);
    }

    /**
     * Check authentication status
     */
    async checkAuthStatus() {
        try {
            console.log('🔍 Checking authentication status...');
            
            // Check Firebase Functions for token status
            const response = await fetch(`${this.config.functions.baseUrl}/status`);
            
            if (response.ok) {
                const status = await response.json();
                this.isAuthenticated = status.data?.tokens || false;
                
                console.log('🔐 Auth status:', this.isAuthenticated ? 'Authenticated' : 'Not authenticated');
                
                // Update UI based on auth status
                if (this.isAuthenticated) {
                    this.showConnectedStatus();
                    this.hideAuthSection();
                } else {
                    this.showDisconnectedStatus();
                    this.showAuthSection();
                }
                
                return this.isAuthenticated;
            } else {
                console.warn('⚠️ Could not check auth status');
                this.isAuthenticated = false;
                this.showAuthSection();
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error checking auth status:', error);
            this.isAuthenticated = false;
            this.showAuthSection();
            return false;
        }
    }

    showConnectedStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'text-green-600 font-medium';
        }
    }

    showDisconnectedStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = 'Not Connected';
            statusElement.className = 'text-red-600 font-medium';
        }
    }

    /**
     * Initialize RingCentral WebPhone
     */
    async initializeWebPhone(accessToken) {
        try {
            console.log('📞 Initializing WebPhone...');
            
            const sdk = new RingCentral({
                clientId: this.config.ringcentral.clientId,
                server: this.config.ringcentral.server
            });

            sdk.platform().auth().setData({ access_token: accessToken });

            this.webPhone = new RingCentralWebPhone(sdk, {
                appName: 'Kanva Dialer',
                appVersion: '1.0.0',
                uuid: this.generateUUID(),
                logLevel: 1,
                audioHelper: {
                    enabled: true
                }
            });

            this.setupWebPhoneEvents();
            
            this.isAuthenticated = true;
            this.updateConnectionStatus('connected', 'Connected');
            this.enableCallButton();
            
            console.log('✅ WebPhone initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize WebPhone:', error);
            this.updateConnectionStatus('error', 'Connection failed');
            this.showAuthSection();
            throw error;
        }
    }

    /**
     * Set up WebPhone event listeners
     */
    setupWebPhoneEvents() {
        if (!this.webPhone) return;

        // Incoming call
        this.webPhone.userAgent.on('invite', (session) => {
            console.log('📞 Incoming call detected:', session);
            this.handleIncomingCall(session);
        });

        // Call connected
        this.webPhone.userAgent.on('connected', (session) => {
            console.log('✅ Call connected:', session);
            this.handleCallConnected(session);
        });

        // Call ended
        this.webPhone.userAgent.on('disconnected', (session) => {
            console.log('📴 Call ended:', session);
            this.handleCallEnded(session);
        });

        // Registration events
        this.webPhone.userAgent.on('registered', () => {
            console.log('✅ WebPhone registered');
            this.updateConnectionStatus('connected', 'Connected');
        });

        this.webPhone.userAgent.on('unregistered', () => {
            console.log('❌ WebPhone unregistered');
            this.updateConnectionStatus('disconnected', 'Disconnected');
        });
    }

    /**
     * Handle incoming call
     */
    async handleIncomingCall(session) {
        this.currentCall = session;
        const callerNumber = this.extractPhoneNumber(session.request.from.uri.user);
        
        console.log('📞 Incoming call from:', callerNumber);
        
        // Update UI
        document.getElementById('incomingCallerNumber').textContent = this.formatPhoneNumber(callerNumber);
        
        // Lookup caller in Copper CRM
        await this.lookupCustomerInCopper(callerNumber);
        
        // Show incoming call popup
        this.showIncomingCallPopup();
        
        // Send browser notification
        this.sendBrowserNotification('Incoming Call', `Call from ${this.formatPhoneNumber(callerNumber)}`);
        
        // Auto-popup if running in background
        if (document.hidden) {
            this.openDialerWindow();
        }
    }

    /**
     * Handle call connected
     */
    handleCallConnected(session) {
        this.currentCall = session;
        this.callStartTime = new Date();
        
        // Hide incoming call popup and show active call interface
        this.hideIncomingCallPopup();
        this.showActiveCallInterface();
        
        // Start call timer
        this.startCallTimer();
        
        // Update active call display
        const phoneNumber = this.extractPhoneNumber(session.request.from.uri.user || session.request.to.uri.user);
        document.getElementById('activeCallNumber').textContent = this.formatPhoneNumber(phoneNumber);
        document.getElementById('callStatus').textContent = 'Connected';
    }

    /**
     * Handle call ended
     */
    async handleCallEnded(session) {
        console.log('📴 Call ended');
        
        // Stop call timer
        this.stopCallTimer();
        
        // Hide active call interface
        this.hideActiveCallInterface();
        
        // Save call notes and log to Copper
        if (this.callNotes) {
            await this.saveNotes();
            await this.logCallToCopper();
        }
        
        // Update call history
        this.addToCallHistory();
        
        // Clear current call
        this.currentCall = null;
        this.callStartTime = null;
        this.customerData = null;
        this.callNotes = '';
        
        // Clear notes UI
        document.getElementById('callNotes').value = '';
        document.getElementById('activeCallNotes').value = '';
        
        // Hide customer info
        this.hideCustomerInfo();
    }

    /**
     * Make outbound call
     */
    async makeCall() {
        const phoneNumber = document.getElementById('phoneNumber').value.replace(/\D/g, '');
        
        if (!phoneNumber) {
            this.showError('Please enter a phone number');
            return;
        }

        if (!this.isAuthenticated || !this.webPhone) {
            this.showAuthSection();
            return;
        }

        try {
            console.log('📞 Making call to:', phoneNumber);
            
            // Lookup customer before making call
            await this.lookupCustomerInCopper(phoneNumber);
            
            // Make the call using WebPhone
            const session = this.webPhone.userAgent.invite(`+1${phoneNumber}`, {
                media: {
                    render: {
                        remote: document.getElementById('remoteVideo'),
                        local: document.getElementById('localVideo')
                    }
                }
            });
            
            this.currentCall = session;
            this.updateConnectionStatus('calling', `Calling ${this.formatPhoneNumber(phoneNumber)}...`);
            
        } catch (error) {
            console.error('❌ Call failed:', error);
            this.showError('Call failed. Please try again.');
            this.updateConnectionStatus('connected', 'Connected');
        }
    }

    /**
     * Answer incoming call
     */
    answerCall() {
        if (this.currentCall) {
            this.currentCall.accept();
            console.log('✅ Call answered');
        }
    }

    /**
     * Decline incoming call
     */
    declineCall() {
        if (this.currentCall) {
            this.currentCall.reject();
            this.hideIncomingCallPopup();
            this.currentCall = null;
            console.log('❌ Call declined');
        }
    }

    /**
     * Hang up active call
     */
    hangupCall() {
        if (this.currentCall) {
            this.currentCall.terminate();
            console.log('📴 Call hung up');
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        if (this.currentCall) {
            const isMuted = this.currentCall.isMuted();
            if (isMuted) {
                this.currentCall.unmute();
            } else {
                this.currentCall.mute();
            }
            
            const muteButton = document.getElementById('muteButton');
            const icon = muteButton.querySelector('i');
            icon.className = isMuted ? 'fas fa-microphone text-xl' : 'fas fa-microphone-slash text-xl';
            muteButton.classList.toggle('bg-red-500', !isMuted);
            muteButton.classList.toggle('bg-gray-700', isMuted);
        }
    }

    /**
     * Toggle hold
     */
    toggleHold() {
        if (this.currentCall) {
            const isOnHold = this.currentCall.isOnHold();
            if (isOnHold) {
                this.currentCall.unhold();
            } else {
                this.currentCall.hold();
            }
            
            const holdButton = document.getElementById('holdButton');
            const icon = holdButton.querySelector('i');
            icon.className = isOnHold ? 'fas fa-pause text-xl' : 'fas fa-play text-xl';
            holdButton.classList.toggle('bg-yellow-500', !isOnHold);
            holdButton.classList.toggle('bg-gray-700', isOnHold);
        }
    }

    /**
     * Lookup customer in Copper CRM
     */
    async lookupCustomerInCopper(phoneNumber) {
        if (!this.config.copper.apiKey || !this.config.copper.userEmail) {
            console.warn('⚠️ Copper CRM not configured');
            return null;
        }

        try {
            console.log('🔍 Looking up customer in Copper:', phoneNumber);
            
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            
            // Use Firebase Function for Copper lookup
            const response = await fetch(`${this.config.functions.baseUrl}/copper/lookup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone: cleanNumber })
            });
            
            if (response.ok) {
                this.customerData = await response.json();
                this.displayCustomerInfo();
                console.log('📋 Customer found:', this.customerData);
            } else {
                console.log('👤 No customer found for:', phoneNumber);
                this.customerData = null;
                this.hideCustomerInfo();
            }
            
        } catch (error) {
            console.error('❌ Error looking up customer:', error);
            this.customerData = null;
            this.hideCustomerInfo();
        }
    }

    /**
     * Display customer information
     */
    displayCustomerInfo() {
        if (!this.customerData) return;
        
        const customerInfo = document.getElementById('customerInfo');
        const incomingCustomerInfo = document.getElementById('incomingCustomerInfo');
        
        // Update main customer info
        document.getElementById('customerName').textContent = this.customerData.name || '-';
        document.getElementById('customerCompany').textContent = this.customerData.company || '-';
        document.getElementById('customerEmail').textContent = this.customerData.email || '-';
        
        // Update incoming call customer info
        if (incomingCustomerInfo) {
            document.getElementById('incomingCustomerDetails').innerHTML = `
                <div class="text-sm text-gray-600">
                    <div><strong>Name:</strong> ${this.customerData.name || '-'}</div>
                    <div><strong>Company:</strong> ${this.customerData.company || '-'}</div>
                    <div><strong>Email:</strong> ${this.customerData.email || '-'}</div>
                </div>
            `;
            incomingCustomerInfo.classList.remove('hidden');
        }
        
        // Show navigation buttons based on record type
        this.showCopperNavigationButtons();
        
        customerInfo.classList.remove('hidden');
    }

    /**
     * Show Copper navigation buttons
     */
    showCopperNavigationButtons() {
        if (!this.customerData) return;
        
        // Hide all buttons first
        document.querySelectorAll('[id*="openLeadButton"], [id*="openCompanyButton"], [id*="openPersonButton"]').forEach(btn => {
            btn.classList.add('hidden');
        });
        
        // Show relevant buttons based on record type
        if (this.customerData.recordType === 'lead' || this.customerData.leads?.length > 0) {
            document.querySelectorAll('[id*="openLeadButton"]').forEach(btn => btn.classList.remove('hidden'));
        }
        
        if (this.customerData.recordType === 'company' || this.customerData.companies?.length > 0) {
            document.querySelectorAll('[id*="openCompanyButton"]').forEach(btn => btn.classList.remove('hidden'));
        }
        
        if (this.customerData.recordType === 'person' || this.customerData.people?.length > 0) {
            document.querySelectorAll('[id*="openPersonButton"]').forEach(btn => btn.classList.remove('hidden'));
        }
    }

    /**
     * Open Copper record
     */
    openCopperRecord(recordType) {
        if (!this.customerData) return;
        
        let recordId = null;
        
        switch (recordType) {
            case 'lead':
                recordId = this.customerData.leadId || this.customerData.leads?.[0]?.id;
                break;
            case 'company':
                recordId = this.customerData.companyId || this.customerData.companies?.[0]?.id;
                break;
            case 'person':
                recordId = this.customerData.personId || this.customerData.people?.[0]?.id;
                break;
        }
        
        if (recordId) {
            const copperUrl = `https://app.copper.com/${recordType}s/${recordId}`;
            window.open(copperUrl, '_blank', 'noopener');
        }
    }

    /**
     * Save call notes
     */
    async saveNotes() {
        try {
            const response = await fetch(`${this.config.functions.baseUrl}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentCall?.id || `draft-${Date.now()}`,
                    notes: this.callNotes,
                    customerData: this.customerData,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                this.showSaveStatus('Notes saved');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to save notes:', error);
            this.showSaveStatus('Save failed');
        }
    }

    /**
     * Log call to Copper CRM
     */
    async logCallToCopper() {
        if (!this.customerData || !this.currentCall) return;
        
        try {
            await fetch(`${this.config.functions.baseUrl}/copper/log-call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentCall.id,
                    customerData: this.customerData,
                    notes: this.callNotes,
                    startTime: this.callStartTime?.toISOString(),
                    endTime: new Date().toISOString(),
                    direction: this.currentCall.direction || 'outbound'
                })
            });
            
            console.log('✅ Call logged to Copper');
            
        } catch (error) {
            console.error('❌ Failed to log call to Copper:', error);
        }
    }

    /**
     * Authentication methods
     */
    startOAuth() {
        try {
            console.log('🔐 Starting OAuth flow...');
            
            // Use existing Firebase Functions OAuth flow
            const authUrl = `${window.location.origin}/rc/auth/start`;
            
            // Open OAuth in popup window
            const popup = window.open(
                authUrl,
                'ringcentral-oauth',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );
            
            // Monitor popup for completion
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    console.log('✅ OAuth popup closed, checking for tokens...');
                    
                    // Check for tokens after popup closes
                    setTimeout(() => {
                        this.checkAuthStatus();
                    }, 1000);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ OAuth start error:', error);
            this.showError('Failed to start authentication');
        }
    }

    showAuthSection() {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('callButton').disabled = true;
        this.updateConnectionStatus('disconnected', 'Authentication required');
    }

    hideAuthSection() {
        document.getElementById('authSection').classList.add('hidden');
        this.enableCallButton();
    }

    enableCallButton() {
        const callButton = document.getElementById('callButton');
        if (callButton) callButton.disabled = false;
    }

    /**
     * UI Helper methods
     */
    addDigit(digit) {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.value += digit;
            phoneInput.value = this.formatPhoneNumber(phoneInput.value);
        }
    }

    clearNumber() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput) {
            phoneInput.value = phoneInput.value.slice(0, -1);
            phoneInput.value = this.formatPhoneNumber(phoneInput.value);
        }
    }

    formatPhoneNumber(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        return phone;
    }

    extractPhoneNumber(input) {
        return input ? input.replace(/\D/g, '') : '';
    }

    updateConnectionStatus(status = 'connecting', text = 'Connecting...') {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator status-${status}`;
        }
        
        if (statusText) {
            statusText.textContent = text;
        }
    }

    showIncomingCallPopup() {
        document.getElementById('incomingCallPopup').classList.remove('hidden');
    }

    hideIncomingCallPopup() {
        document.getElementById('incomingCallPopup').classList.add('hidden');
    }

    showActiveCallInterface() {
        document.getElementById('activeCallInterface').classList.remove('hidden');
    }

    hideActiveCallInterface() {
        document.getElementById('activeCallInterface').classList.add('hidden');
    }

    hideCustomerInfo() {
        document.getElementById('customerInfo').classList.add('hidden');
        document.getElementById('incomingCustomerInfo')?.classList.add('hidden');
    }

    showError(message) {
        // Simple alert for now - could be enhanced with better UI
        alert(message);
    }

    showSaveStatus(message) {
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = message;
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 3000);
        }
    }

    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const elapsed = Math.floor((new Date() - this.callStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                
                const durationEl = document.getElementById('callDuration');
                if (durationEl) durationEl.textContent = `${minutes}:${seconds}`;
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    autoSaveNotes() {
        // Auto-save notes every 5 seconds
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            if (this.callNotes) {
                this.saveNotes();
            }
        }, 5000);
    }

    addToCallHistory() {
        const historyList = document.getElementById('callHistoryList');
        if (!historyList || !this.currentCall) return;
        
        const callItem = document.createElement('div');
        callItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded text-sm';
        
        const phoneNumber = this.extractPhoneNumber(this.currentCall.request?.from?.uri?.user || this.currentCall.request?.to?.uri?.user || '');
        const customerName = this.customerData?.name || 'Unknown';
        const duration = this.callStartTime ? Math.floor((new Date() - this.callStartTime) / 1000) : 0;
        
        callItem.innerHTML = `
            <div>
                <div class="font-medium">${customerName}</div>
                <div class="text-gray-500">${this.formatPhoneNumber(phoneNumber)}</div>
            </div>
            <div class="text-right">
                <div>${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</div>
                <div class="text-gray-500">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        historyList.insertBefore(callItem, historyList.firstChild);
        
        // Keep only last 10 calls
        while (historyList.children.length > 10) {
            historyList.removeChild(historyList.lastChild);
        }
    }

    loadCallHistory() {
        // Load call history from localStorage
        const history = JSON.parse(localStorage.getItem('kanva_call_history') || '[]');
        const historyList = document.getElementById('callHistoryList');
        
        if (historyList && history.length > 0) {
            historyList.innerHTML = '';
            history.slice(0, 10).forEach(call => {
                const callItem = document.createElement('div');
                callItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded text-sm';
                callItem.innerHTML = `
                    <div>
                        <div class="font-medium">${call.customerName || 'Unknown'}</div>
                        <div class="text-gray-500">${this.formatPhoneNumber(call.phoneNumber)}</div>
                    </div>
                    <div class="text-right">
                        <div>${call.duration || '0:00'}</div>
                        <div class="text-gray-500">${new Date(call.timestamp).toLocaleTimeString()}</div>
                    </div>
                `;
                historyList.appendChild(callItem);
            });
        }
    }

    sendBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/assets/logo/kanva-logo.png' });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body, icon: '/assets/logo/kanva-logo.png' });
                }
            });
        }
    }

    openDialerWindow() {
        // Open dialer in new window if running in background
        if (document.hidden) {
            window.open(window.location.href, 'KanvaDialer', 'width=500,height=800,resizable=yes,scrollbars=yes');
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.kanvaDialer = new KanvaDialer();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KanvaDialer;
}
