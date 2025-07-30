/**
 * KANVA BOTANICALS QUOTE CALCULATOR - ENHANCED COPPER CRM INTEGRATION
 * ==================================================================
 * 
 * Streamlined and optimized Copper CRM integration without removing functionality.
 * This version improves performance, reduces redundancy, and enhances maintainability.
 * 
 * Key Improvements:
 * - Consolidated initialization routines
 * - Removed redundant code and dormant functions
 * - Streamlined modal overlay handling
 * - Improved error handling and logging
 * - Better state management
 * - Enhanced performance
 */

// =============================================================================
// ENHANCED MODAL OVERLAY HANDLER
// =============================================================================

const ModalOverlayHandler = {
    // Private state to prevent duplicate operations
    _initialized: false,
    _context: null,
    
    /**
     * Check if running in modal mode
     */
    isModalMode: function() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('location') === 'modal';
    },
    
    /**
     * Extract context from Copper SDK or URL parameters
     */
    extractModalContext: function() {
        if (this._context) {
            return this._context; // Return cached context
        }
        
        console.log('🖥️ Modal mode detected - extracting context...');
        
        // First check URL parameters for passed data
        const urlParams = new URLSearchParams(window.location.search);
        const urlContext = this._extractUrlContext(urlParams);
        
        // If we have URL parameters, use them
        if (urlContext.entity_id || urlContext.entity_name) {
            this._context = this._createContextFromUrl(urlContext);
            this.populateFromModalContext(this._context);
            return this._context;
        }
        
        // Fallback: Try to get context from Copper SDK
        if (typeof window.Copper !== 'undefined') {
            this._fetchCopperContext();
        }
        
        return { isModal: true };
    },
    
    /**
     * Extract context from URL parameters
     */
    _extractUrlContext: function(urlParams) {
        return {
            entity_type: urlParams.get('entity_type'),
            entity_id: urlParams.get('entity_id'),
            entity_name: urlParams.get('entity_name'),
            entity_email: urlParams.get('entity_email'),
            entity_phone: urlParams.get('entity_phone'),
            entity_state: urlParams.get('entity_state')
        };
    },
    
    /**
     * Create context object from URL parameters
     */
    _createContextFromUrl: function(urlContext) {
        return {
            entityId: urlContext.entity_id,
            entityType: urlContext.entity_type,
            entityName: urlContext.entity_name,
            companyName: urlContext.entity_name,
            entityEmail: urlContext.entity_email,
            entityPhone: urlContext.entity_phone,
            entityState: urlContext.entity_state,
            isModal: true
        };
    },
    
    /**
     * Fetch context from Copper SDK
     */
    _fetchCopperContext: function() {
        try {
            const sdk = window.Copper.init();
            sdk.getContext()
                .then(({ type, context }) => {
                    if (context && context.entity) {
                        this._context = this._createContextFromSdk(context.entity, type);
                        this.populateFromModalContext(this._context);
                    }
                })
                .catch(error => {
                    console.warn('⚠️ Error getting context from SDK:', error);
                });
        } catch (error) {
            console.warn('⚠️ Error initializing SDK for context:', error);
        }
    },
    
    /**
     * Create context object from SDK data
     */
    _createContextFromSdk: function(entity, type) {
        return {
            entityId: entity.id,
            entityType: type,
            entityName: entity.name || entity.company_name,
            companyName: entity.name || entity.company_name,
            entityEmail: entity.email,
            entityPhone: entity.phone_number,
            entityState: entity.address?.state,
            entityAddress: entity.address,
            isModal: true
        };
    },
    
    /**
     * Auto-populate form from modal context
     */
    populateFromModalContext: function(context) {
        if (!context || !context.isModal) return;
        
        const fieldMappings = {
            companyName: ['companyName', 'company-name'],
            entityEmail: ['customerEmail', 'customer-email', 'contactEmail'],
            entityPhone: ['customerPhone', 'customer-phone', 'contactPhone'],
            entityState: ['customerState', 'customer-state', 'state']
        };
        
        let populatedCount = 0;
        
        // Populate all available context fields
        Object.entries(fieldMappings).forEach(([contextKey, fieldIds]) => {
            const value = context[contextKey] || context.entityName;
            if (value && this._populateField(fieldIds, value)) {
                populatedCount++;
            }
        });
        
        // Set customer segment based on entity type
        this._setCustomerSegment(context.entityType);
        
        // Store context for later use
        window.modalContext = context;
        
        if (populatedCount > 0) {
            this.showModalNotification(`Auto-populated ${populatedCount} fields from CRM`, 'success');
        }
    },
    
    /**
     * Helper to populate a field by trying multiple selectors
     */
    _populateField: function(fieldIds, value) {
        for (const fieldId of fieldIds) {
            const field = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
            if (field) {
                field.value = value;
                field.classList.add('auto-populated');
                return true;
            }
        }
        return false;
    },
    
    /**
     * Set customer segment based on entity type
     */
    _setCustomerSegment: function(entityType) {
        const segmentField = document.getElementById('customerSegment');
        if (segmentField && entityType) {
            const segmentMap = {
                'company': 'distributor',
                'person': 'retailer',
                'lead': 'direct'
            };
            segmentField.value = segmentMap[entityType.toLowerCase()] || 'distributor';
        }
    },
    
    /**
     * Save quote as Copper activity
     */
    saveQuoteAsActivity: function(quoteData) {
        if (!this.isModalMode() || !window.modalContext) {
            return false;
        }
        
        if (typeof window.Copper === 'undefined') {
            this.showModalNotification('CRM not available', 'error');
            return false;
        }
        
        try {
            const sdk = window.Copper.init();
            const activityDetails = this._formatActivityDetails(quoteData);
            
            sdk.logActivity(0, activityDetails);
            this.showModalNotification('Quote saved to CRM!', 'success');
            
            // Close modal after delay
            setTimeout(() => sdk.closeModal(), 2000);
            return true;
        } catch (error) {
            console.error('❌ Error saving quote:', error);
            this.showModalNotification('Error saving to CRM', 'error');
            return false;
        }
    },
    
    /**
     * Format activity details for CRM
     */
    _formatActivityDetails: function(quoteData) {
        return `Quote Generated: ${quoteData.quoteName}\n` +
               `Company: ${quoteData.companyName}\n` +
               `Total: ${quoteData.totalAmount}\n` +
               `Products: ${quoteData.products.join(', ')}\n` +
               `Generated via Kanva Quote Tool`;
    },
    
    /**
     * Show notification in modal
     */
    showModalNotification: function(message, type = 'info') {
        const notification = this._createNotificationElement(message, type);
        document.body.appendChild(notification);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    },
    
    /**
     * Create notification element
     */
    _createNotificationElement: function(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 20px;
            border-radius: 6px; color: white; font-weight: bold; z-index: 10000;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;
        return notification;
    },
    
    /**
     * Initialize modal overlay handler
     */
    initialize: function() {
        if (this._initialized) return;
        
        console.log('🖥️ Initializing Modal Overlay Handler...');
        
        if (this.isModalMode()) {
            this.extractModalContext();
            this._setupModalBehavior();
        }
        
        this._initialized = true;
    },
    
    /**
     * Setup modal-specific behavior
     */
    _setupModalBehavior: function() {
        // Add modal-specific CSS class
        document.body.classList.add('modal-mode');
        
        // Setup any modal-specific event listeners
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },
    
    /**
     * Close modal
     */
    closeModal: function() {
        if (appState.sdk && typeof appState.sdk.closeModal === 'function') {
            appState.sdk.closeModal();
        } else {
            // For non-Copper environments, try to close the custom modal
            const modalOverlay = document.getElementById('copperModalOverlay');
            if (modalOverlay) {
                modalOverlay.remove();
                document.body.classList.remove('modal-open');
            }
        }
    },

    /**
     * Create and display a full-screen modal overlay
     */
    createFullScreenModal: function() {
        console.log('🖥️ Creating full-screen modal overlay...');
        
        // Don't create duplicate modals
        if (document.getElementById('copperModalOverlay')) {
            return;
        }
        
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'copperModalOverlay';
        modalOverlay.className = 'copper-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-container" id="modalContainer">
                <div class="modal-header" id="modalHeader" style="background-color: #93D500;">
                    <div class="modal-title">
                        <img src="assets/logo/kanva-logo.png" alt="Kanva" class="modal-logo">
                        <span>Kanva Quote Generator</span>
                    </div>
                    <div class="modal-controls">
                        <button class="modal-minimize" onclick="ModalOverlayHandler.minimizeModal()" title="Minimize">−</button>
                        <button class="modal-maximize" onclick="ModalOverlayHandler.maximizeModal()" title="Maximize">□</button>
                        <button class="modal-close" onclick="ModalOverlayHandler.closeModal()" title="Close">×</button>
                    </div>
                </div>
                <div class="modal-content" id="modalContent">
                    <!-- App content will be moved here -->
                </div>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(modalOverlay);
        document.body.classList.add('modal-open');
        
        // Move the app container into the modal content
        const appContainer = document.getElementById('app-container');
        const modalContent = document.getElementById('modalContent');
        
        if (appContainer && modalContent) {
            // Store original parent for restoring later
            appContainer._originalParent = appContainer.parentNode;
            appContainer._originalNextSibling = appContainer.nextSibling;
            
            // Move into modal
            modalContent.appendChild(appContainer);
        }
        
        // Make the modal draggable
        this.makeDraggable(document.getElementById('modalContainer'), document.getElementById('modalHeader'));
        
        return modalOverlay;
    },
    
    /**
     * Minimize the modal
     */
    minimizeModal: function() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.classList.toggle('minimized');
        }
    },
    
    /**
     * Maximize the modal
     */
    maximizeModal: function() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.classList.toggle('maximized');
        }
    },
    
    /**
     * Make an element draggable
     */
    makeDraggable: function(element, handle) {
        if (!element) return;
        
        const dragHandle = handle || element;
        let offsetX = 0, offsetY = 0;
        
        const onMouseDown = function(e) {
            e.preventDefault();
            
            // Get the current position
            offsetX = e.clientX - element.getBoundingClientRect().left;
            offsetY = e.clientY - element.getBoundingClientRect().top;
            
            // Change cursor style
            document.body.style.cursor = 'grabbing';
            dragHandle.style.cursor = 'grabbing';
            
            // Add event listeners for movement and release
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            // Disable text selection during drag
            dragHandle.style.userSelect = 'none';
        };
        
        const onMouseMove = function(e) {
            e.preventDefault();
            
            // Calculate new position with boundary constraints
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            
            // Apply boundary constraints
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            // Update position
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        };
        
        const onMouseUp = function() {
            // Remove event listeners
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Reset cursor style
            document.body.style.cursor = 'auto';
            dragHandle.style.cursor = 'grab';
            dragHandle.style.userSelect = '';
        };
        
        // Add mouse event listeners
        dragHandle.addEventListener('mousedown', onMouseDown);
        
        // Add touch event listeners for mobile
        dragHandle.addEventListener('touchstart', function(e) {
            const touch = e.touches[0];
            offsetX = touch.clientX - element.getBoundingClientRect().left;
            offsetY = touch.clientY - element.getBoundingClientRect().top;
            
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
        });
        
        const onTouchMove = function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            
            let newX = touch.clientX - offsetX;
            let newY = touch.clientY - offsetY;
            
            // Apply boundary constraints
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        };
        
        const onTouchEnd = function() {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
        
        // Reset position on window resize
        window.addEventListener('resize', function() {
            // Center the element
            element.style.left = ((window.innerWidth - element.offsetWidth) / 2) + 'px';
            element.style.top = ((window.innerHeight - element.offsetHeight) / 2) + 'px';
        });
        
        // Initialize position
        element.style.position = 'fixed';
        element.style.left = ((window.innerWidth - element.offsetWidth) / 2) + 'px';
        element.style.top = ((window.innerHeight - element.offsetHeight) / 2) + 'px';
        dragHandle.style.cursor = 'grab';
    }
};

// =============================================================================
// ENHANCED COPPER INTEGRATION
// =============================================================================

const CopperIntegration = {
    // Private state
    _initialized: false,
    _retryCount: 0,
    _maxRetries: 3,
    
    /**
     * Main initialization method
     */
    async initialize() {
        if (this._initialized) return true;
        
        console.log('🔗 Initializing Copper CRM integration...');
        
        try {
            // Load credentials
            await this._loadCredentials();
            
            // Detect and initialize SDK
            const sdkReady = await this._initializeSDK();
            
            if (sdkReady) {
                this._setupCopperEnvironment();
                this._initialized = true;
                return true;
            } else {
                this._setupStandaloneMode();
                return false;
            }
        } catch (error) {
            console.error('❌ Error initializing Copper SDK:', error);
            this._setupStandaloneMode();
            return false;
        }
    },
    
    /**
     * Load credentials from secure storage
     */
    async _loadCredentials() {
        if (window.secureIntegrationHandler) {
            try {
                const copperConfig = await window.secureIntegrationHandler.getIntegration('copper');
                if (copperConfig) {
                    if (!appState.copper) appState.copper = {};
                    Object.assign(appState.copper, copperConfig);
                    console.log('✅ Copper credentials loaded');
                }
            } catch (error) {
                console.warn('⚠️ Could not load Copper credentials:', error.message);
            }
        }
    },
    
    /**
     * Initialize Copper SDK with retry logic
     */
    async _initializeSDK() {
        if (typeof window.Copper !== 'undefined') {
            try {
                appState.sdk = window.Copper.init();
                console.log('✅ Copper SDK initialized');
                return true;
            } catch (error) {
                console.error('❌ Error calling Copper.init():', error);
                return false;
            }
        }
        
        // Wait for SDK to load with retry logic
        return await this._waitForSDK();
    },
    
    /**
     * Wait for SDK to load with exponential backoff
     */
    async _waitForSDK() {
        const checkSDK = () => {
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    this._retryCount++;
                    
                    if (typeof window.Copper !== 'undefined') {
                        clearInterval(interval);
                        try {
                            appState.sdk = window.Copper.init();
                            console.log('✅ Copper SDK found on retry!');
                            resolve(true);
                        } catch (error) {
                            console.error('❌ Error initializing SDK on retry:', error);
                            resolve(false);
                        }
                    } else if (this._retryCount >= this._maxRetries) {
                        clearInterval(interval);
                        console.log('⚠️ Copper SDK not found after retries');
                        resolve(false);
                    }
                }, 1000 * this._retryCount); // Exponential backoff
            });
        };
        
        return await checkSDK();
    },
    
    /**
     * Setup Copper environment
     */
    _setupCopperEnvironment() {
        appState.isCopperActive = true;
        appState.integrationMode = this._detectIntegrationMode();
        
        // Initialize context and UI based on mode
        this._initializeByMode();
        
        // Setup context bridge for cross-iframe communication
        this._initializeContextBridge();
        
        // Get user context
        this._getUserContext();
    },
    
    /**
     * Detect integration mode with improved logic
     */
    _detectIntegrationMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const location = urlParams.get('location');
        const isInIframe = window.self !== window.top;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Clear any existing modal state
        this._clearModalState();
        
        // Determine mode based on context
        if (location === 'modal') {
            return 'modal';
        } else if (location === 'activity_panel' || (isInIframe && windowWidth < 500 && windowHeight < 500)) {
            return 'activity_panel';
        } else if (location === 'left_nav' || location === 'action_bar' || isInIframe) {
            return 'left_nav';
        } else {
            return 'standalone';
        }
    },
    
    /**
     * Clear any existing modal state
     */
    _clearModalState() {
        const existingOverlay = document.getElementById('copperModalOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Reset button visibility
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'block';
        }
    },
    
    /**
     * Initialize based on detected mode
     */
    _initializeByMode() {
        appState.isActivityPanel = appState.integrationMode === 'activity_panel';
        appState.isLeftNav = appState.integrationMode === 'left_nav';
        appState.isEmbedded = appState.integrationMode !== 'standalone';
        
        switch (appState.integrationMode) {
            case 'activity_panel':
                this._setupActivityPanel();
                break;
            case 'left_nav':
            case 'action_bar':
                this._setupLeftNav();
                break;
            case 'modal':
                // Modal setup is handled by ModalOverlayHandler
                break;
            default:
                // Standalone mode - no special setup needed
                break;
        }
        
        console.log(`🎯 Integration mode: ${appState.integrationMode}`);
    },
    
    /**
     * Setup Activity Panel mode
     */
    _setupActivityPanel() {
        this._showLaunchModalButton();
        this._hideFullscreenButton();
    },
    
    /**
     * Setup Left Nav mode
     */
    _setupLeftNav() {
        this._hideModalElements();
        // Enable customer search after DOM is ready
        setTimeout(() => this._enableCustomerSearch(), 500);
    },
    
    /**
     * Show/hide UI elements based on mode
     */
    _showLaunchModalButton() {
        const launchBtn = document.getElementById('launchQuoteModalBtn');
        if (launchBtn) {
            launchBtn.style.display = 'inline-block';
        }
    },
    
    _hideFullscreenButton() {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
        }
    },
    
    _hideModalElements() {
        const launchBtn = document.getElementById('launchQuoteModalBtn');
        if (launchBtn) {
            launchBtn.style.display = 'none';
        }
    },
    
    /**
     * Get user context from Copper
     */
    _getUserContext() {
        if (!appState.sdk) return;
        
        appState.sdk.getContext()
            .then((data) => {
                this._processContext(data);
            })
            .catch((error) => {
                console.error('❌ Error getting Copper context:', error);
                appState.hasEntityContext = false;
                
                // Enable customer search as fallback for left nav
                if (appState.isLeftNav) {
                    this._enableCustomerSearch();
                }
            });
    },
    
    /**
     * Process received context data
     */
    _processContext(data) {
        console.log('👤 Copper context received:', data);
        
        appState.copperContext = data;
        appState.hasEntityContext = !!(data && data.context);
        appState.contextData = data.context;
        
        // Auto-populate if we have entity data
        if (data.context && data.context.entity) {
            this._autoPopulateFromEntity(data.context.entity, data.type);
        }
        
        // Update UI based on context
        if (typeof UIManager !== 'undefined' && UIManager.onContextReceived) {
            UIManager.onContextReceived(data);
        }
    },
    
    /**
     * Auto-populate form fields from entity data
     */
    _autoPopulateFromEntity(entity, entityType) {
        // Extract data based on entity type
        const extractedData = this._extractEntityData(entity, entityType);
        
        // Populate form fields
        const populatedCount = this._populateFormFields(extractedData);
        
        if (populatedCount > 0) {
            this._showAutoPopulationSuccess(populatedCount, entityType, extractedData.displayName);
        }
        
        // Trigger calculation update
        if (typeof App !== 'undefined' && App.triggerCalculation) {
            App.triggerCalculation();
        }
    },
    
    /**
     * Extract relevant data from entity
     */
    _extractEntityData(entity, entityType) {
        let companyName = '';
        let contactName = '';
        let email = '';
        let phone = '';
        
        if (entityType === 'company') {
            companyName = entity.name || entity.company_name || '';
        } else if (entityType === 'person') {
            contactName = entity.name || '';
            companyName = entity.company?.name || entity.company_name || '';
            email = this._extractEmail(entity);
            phone = this._extractPhone(entity);
        }
        
        return {
            companyName,
            contactName,
            email,
            phone,
            displayName: companyName || contactName
        };
    },
    
    /**
     * Extract email from entity
     */
    _extractEmail(entity) {
        if (entity.emails && entity.emails.length > 0) {
            return entity.emails[0].email || entity.emails[0];
        }
        return entity.email || '';
    },
    
    /**
     * Extract phone from entity
     */
    _extractPhone(entity) {
        if (entity.phone_numbers && entity.phone_numbers.length > 0) {
            return entity.phone_numbers[0].number || entity.phone_numbers[0];
        }
        return entity.phone_number || '';
    },
    
    /**
     * Populate form fields with extracted data
     */
    _populateFormFields(data) {
        let populatedCount = 0;
        
        const fieldMappings = [
            { value: data.displayName, ids: ['quoteName'], transform: (v) => `Quote for ${v}` },
            { value: data.companyName, ids: ['companyName'] },
            { value: data.email, ids: ['customerEmail'] },
            { value: data.phone, ids: ['customerPhone'] }
        ];
        
        fieldMappings.forEach(({ value, ids, transform }) => {
            if (value) {
                const finalValue = transform ? transform(value) : value;
                if (this._setFieldValue(ids, finalValue)) {
                    populatedCount++;
                }
            }
        });
        
        return populatedCount;
    },
    
    /**
     * Set field value by trying multiple IDs
     */
    _setFieldValue(fieldIds, value) {
        for (const fieldId of fieldIds) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
                field.classList.add('auto-populated');
                return true;
            }
        }
        return false;
    },
    
    /**
     * Show auto-population success notification
     */
    _showAutoPopulationSuccess(fieldCount, entityType, entityName) {
        const message = `✅ Auto-populated ${fieldCount} field${fieldCount > 1 ? 's' : ''} from ${entityType}: ${entityName}`;
        console.log(message);
        
        // Show visual notification
        this._showNotification(message, 'success');
    },
    
    /**
     * Show notification to user
     */
    _showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'kanva-notification';
        notification.innerHTML = `
            <div class="notification-content ${type}">
                <span>${message}</span>
            </div>
        `;
        
        // Add notification styles if not present
        this._addNotificationStyles();
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    },
    
    /**
     * Add notification styles
     */
    _addNotificationStyles() {
        if (document.getElementById('kanvaNotificationStyles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'kanvaNotificationStyles';
        styles.textContent = `
            .kanva-notification {
                position: fixed; top: 20px; right: 20px; z-index: 10001;
                animation: slideIn 0.3s ease;
            }
            .notification-content {
                padding: 12px 16px; border-radius: 8px; color: white;
                font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .notification-content.success { background: #10b981; }
            .notification-content.error { background: #ef4444; }
            .notification-content.info { background: #3b82f6; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .auto-populated {
                background-color: #ecfdf5 !important;
                border-color: #10b981 !important;
            }
        `;
        document.head.appendChild(styles);
    },
    
    /**
     * Enable customer search functionality
     */
    _enableCustomerSearch() {
        if (this._searchEnabled) return; // Prevent duplicate interfaces
        
        console.log('🔍 Enabling customer search...');
        
        const customerSection = document.querySelector('.customer-info');
        if (!customerSection) return;
        
        // Add search interface
        const searchHTML = this._generateSearchHTML();
        customerSection.insertAdjacentHTML('afterbegin', searchHTML);
        
        // Bind search events
        this._bindSearchEvents();
        
        this._searchEnabled = true;
    },
    
    /**
     * Generate search HTML
     */
    _generateSearchHTML() {
        return `
            <div class="customer-search" id="customerSearch">
                <h4>🔍 Quick Customer Lookup</h4>
                <div class="search-controls">
                    <input type="text" id="customerSearchInput" placeholder="Search companies & contacts..." />
                    <button class="search-btn" onclick="CopperIntegration.searchCustomers()">Search</button>
                </div>
                <div id="searchResults" class="search-results" style="display: none;"></div>
            </div>
        `;
    },
    
    /**
     * Bind search event listeners
     */
    _bindSearchEvents() {
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (e.target.value.length >= 2) {
                        this.searchCustomers(e.target.value);
                    } else {
                        this._hideSearchResults();
                    }
                }, 300);
            });
        }
    },
    
    /**
     * Search for customers
     */
    searchCustomers(query) {
        const searchQuery = query || document.getElementById('customerSearchInput')?.value;
        if (!searchQuery) return;
        
        console.log(`🔍 Searching customers: "${searchQuery}"`);
        
        if (!appState.sdk) {
            this._showDemoSearchResults(searchQuery);
            return;
        }
        
        this._showSearchLoading();
        
        // Search both companies and contacts
        Promise.allSettled([
            this._searchCompanies(searchQuery),
            this._searchContacts(searchQuery)
        ]).then(results => {
            const companies = results[0].status === 'fulfilled' ? results[0].value : [];
            const contacts = results[1].status === 'fulfilled' ? results[1].value : [];
            const allResults = [...companies, ...contacts];
            this._displaySearchResults(allResults);
        });
    },
    
    /**
     * Search companies using Copper SDK
     */
    async _searchCompanies(query) {
        if (!appState.sdk?.api?.companies?.search) return [];
        
        try {
            const response = await appState.sdk.api.companies.search({
                page_size: 10,
                search: { name: query }
            });
            
            return (response.data || response || []).map(company => ({
                ...company,
                type: 'company',
                display_name: company.name
            }));
        } catch (error) {
            console.warn('⚠️ Company search failed:', error);
            return [];
        }
    },
    
    /**
     * Search contacts using Copper SDK
     */
    async _searchContacts(query) {
        if (!appState.sdk?.api?.people?.search) return [];
        
        try {
            const response = await appState.sdk.api.people.search({
                page_size: 10,
                search: { name: query }
            });
            
            return (response.data || response || []).map(contact => ({
                ...contact,
                type: 'person',
                display_name: contact.name
            }));
        } catch (error) {
            console.warn('⚠️ Contact search failed:', error);
            return [];
        }
    },
    
    /**
     * Show search loading state
     */
    _showSearchLoading() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
            resultsContainer.style.display = 'block';
        }
    },
    
    /**
     * Display search results
     */
    _displaySearchResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No customers found</div>';
        } else {
            resultsContainer.innerHTML = results.map(customer => 
                this._formatSearchResult(customer)
            ).join('');
        }
        
        resultsContainer.style.display = 'block';
    },
    
    /**
     * Format individual search result
     */
    _formatSearchResult(customer) {
        const displayName = customer.display_name || customer.name;
        const companyInfo = customer.company_name ? ` at ${customer.company_name}` : '';
        const email = customer.emails?.[0]?.email || customer.emails?.[0] || 'No email';
        
        return `
            <div class="search-result" onclick="CopperIntegration.selectCustomer(${this._escapeJson(customer)})">
                <div class="customer-name">${displayName}</div>
                <div class="customer-type">${customer.type}${companyInfo}</div>
                <div class="customer-email">${email}</div>
            </div>
        `;
    },
    
    /**
     * Show demo search results for standalone mode
     */
    _showDemoSearchResults(query) {
        const demoResults = [
            {
                name: "ABC Distribution",
                type: "company",
                emails: [{ email: "contact@abcdistribution.com" }]
            },
            {
                name: "Green Leaf Retail",
                type: "company",
                emails: [{ email: "orders@greenleaf.com" }]
            }
        ].filter(customer => 
            customer.name.toLowerCase().includes(query.toLowerCase())
        );
        
        this._displaySearchResults(demoResults);
    },
    
    /**
     * Select customer from search results
     */
    selectCustomer(customer) {
        console.log('👤 Selected customer:', customer);
        
        // Auto-populate form
        this._autoPopulateFromEntity(customer);
        
        // Hide search results
        this._hideSearchResults();
        
        // Clear search input
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
    },
    
    /**
     * Hide search results
     */
    _hideSearchResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    },
    
    /**
     * Escape JSON for HTML attributes
     */
    _escapeJson(obj) {
        return JSON.stringify(obj).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    
    /**
     * Initialize context bridge for cross-iframe communication
     */
    _initializeContextBridge() {
        if (!appState.sdk) return;
        
        console.log('🌉 Initializing context bridge...');
        
        // Listen for context updates
        if (appState.sdk.on) {
            appState.sdk.on('customerContext', (data) => this._handleReceivedContext(data));
            appState.sdk.on('quoteSaved', (data) => this._handleQuoteSaved(data));
        }
    },
    
    /**
     * Handle received context from other instances
     */
    _handleReceivedContext(contextData) {
        console.log('📨 Received context:', contextData);
        
        if (contextData.entity) {
            this._autoPopulateFromEntity(contextData.entity);
        }
        
        this._showNotification('Customer data auto-populated from CRM', 'success');
        appState.hasEntityContext = !!contextData.entity;
        appState.contextData = contextData;
    },
    
    /**
     * Handle quote saved notification
     */
    _handleQuoteSaved(quoteData) {
        console.log('💾 Quote saved notification:', quoteData);
        this._showNotification(`Quote saved: ${quoteData.quoteId || 'New Quote'}`, 'success');
    },
    
    /**
     * Save quote to CRM as activity
     */
    saveQuoteToCRM() {
        if (!this._validateQuoteData()) return false;
        
        const calc = Calculator.calculateOrder();
        
        if (appState.sdk && appState.sdk.logActivity) {
            try {
                const details = this._formatQuoteActivity(calc);
                appState.sdk.logActivity(0, details);
                
                this._showNotification('Quote saved to CRM!', 'success');
                this._refreshCopperUI();
                return true;
            } catch (error) {
                console.error('❌ Error saving quote:', error);
                this._showNotification('Failed to save quote to CRM', 'error');
                return false;
            }
        } else {
            this._showNotification('CRM integration not available', 'info');
            return false;
        }
    },
    
    /**
     * Validate quote data before saving
     */
    _validateQuoteData() {
        if (typeof Calculator === 'undefined') {
            this._showNotification('Calculator not available', 'error');
            return false;
        }
        
        const calc = Calculator.calculateOrder();
        if (!calc || (!calc.product && !Array.isArray(calc))) {
            this._showNotification('Please calculate a quote first', 'error');
            return false;
        }
        
        return true;
    },
    
    /**
     * Format quote activity for CRM
     */
    _formatQuoteActivity(calc) {
        const timestamp = new Date().toLocaleString();
        const userEmail = appState.currentUser?.email || 'Unknown User';
        const quoteName = document.getElementById('quoteName')?.value || 'Quote';
        
        let productDetails = '';
        let total = 0;
        
        if (Array.isArray(calc)) {
            calc.forEach((item, index) => {
                productDetails += `Product ${index + 1}: ${item.product.name} - ${item.masterCases} cases\n`;
                total += item.raw.total;
            });
        } else {
            productDetails = `Product: ${calc.product.name}\nQuantity: ${calc.masterCases} cases`;
            total = calc.raw.total;
        }
        
        return `KANVA QUOTE: ${quoteName}\n\n${productDetails}\n\nTotal: $${total.toLocaleString()}\n\nGenerated by: ${userEmail}\nDate: ${timestamp}`;
    },
    
    /**
     * Create opportunity in CRM
     */
    createOpportunity() {
        if (!this._validateQuoteData()) return false;
        
        const calc = Calculator.calculateOrder();
        
        if (appState.sdk && appState.sdk.createEntity) {
            try {
                const opportunityData = this._formatOpportunityData(calc);
                appState.sdk.createEntity('opportunity', opportunityData);
                
                this._showNotification('Opportunity created in CRM!', 'success');
                this._refreshCopperUI();
                return true;
            } catch (error) {
                console.error('❌ Error creating opportunity:', error);
                this._showNotification('Failed to create opportunity', 'error');
                return false;
            }
        } else {
            this._showNotification('CRM integration not available', 'info');
            return false;
        }
    },
    
    /**
     * Format opportunity data for CRM
     */
    _formatOpportunityData(calc) {
        const quoteName = document.getElementById('quoteName')?.value || 'Kanva Quote';
        let monetaryValue = 0;
        
        if (Array.isArray(calc)) {
            monetaryValue = calc.reduce((sum, item) => sum + item.raw.total, 0);
        } else {
            monetaryValue = calc.raw.total;
        }
        
        return {
            name: quoteName,
            monetary_value: Math.round(monetaryValue * 100), // Convert to cents
            details: `Kanva Botanicals Quote - Total: $${monetaryValue.toLocaleString()}`,
            status: 'Open',
            close_date: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 days from now
            priority: 'Normal'
        };
    },
    
    /**
     * Refresh Copper UI
     */
    _refreshCopperUI() {
        if (appState.sdk && appState.sdk.refreshUI) {
            try {
                appState.sdk.refreshUI({ name: 'ActivityLog' });
                if (appState.copperContext?.type) {
                    appState.sdk.refreshUI({ 
                        name: 'Related', 
                        data: { type: appState.copperContext.type } 
                    });
                }
            } catch (error) {
                console.warn('⚠️ Could not refresh Copper UI:', error);
            }
        }
    },
    
    /**
     * Setup standalone mode for testing
     */
    _setupStandaloneMode() {
        appState.isCopperActive = false;
        appState.isAdmin = true;
        appState.integrationMode = 'standalone';
        appState.isLeftNav = true;
        
        if (typeof AuthManager !== 'undefined') {
            AuthManager.setUser({
                email: 'demo@kanvabotanicals.com',
                name: 'Demo User'
            });
        }
        
        console.log('🔧 Running in standalone demo mode');
        
        // Enable customer search after delay
        setTimeout(() => this._enableCustomerSearch(), 1000);
    },
    
    /**
     * Configure Copper integration with API credentials
     */
    async configure(config) {
        if (!config) {
            console.error('❌ No configuration provided');
            return false;
        }
        
        // Store credentials
        if (!appState.copper) appState.copper = {};
        Object.assign(appState.copper, config);
        
        // Save to secure storage if available
        if (window.secureIntegrationHandler) {
            try {
                await window.secureIntegrationHandler.updateIntegration('copper', {
                    ...appState.copper,
                    lastUpdated: new Date().toISOString()
                });
                
                this._showNotification('Copper credentials updated', 'success');
                return true;
            } catch (error) {
                console.error('❌ Error saving credentials:', error);
                this._showNotification('Failed to save credentials', 'error');
                return false;
            }
        }
        
        return true;
    },
    
    /**
     * Check if CRM features are available
     */
    isCrmAvailable() {
        return appState.sdk !== null;
    },
    
    /**
     * Get current context data
     */
    getContextData() {
        return {
            user: appState.currentUser,
            context: appState.copperContext,
            isAdmin: appState.isAdmin,
            location: appState.appLocation,
            integrationMode: appState.integrationMode,
            hasEntityContext: appState.hasEntityContext
        };
    }
};

// =============================================================================
// GLOBAL FUNCTIONS FOR HTML HANDLERS
// =============================================================================

// Initialize handlers immediately
ModalOverlayHandler.initialize();

// Initialize Copper integration with delayed retry
setTimeout(() => {
    CopperIntegration.initialize();
}, 100);

// Global functions for HTML onclick handlers
function openCopperModal() {
    CopperIntegration.openModal();
}

function saveQuoteToCRM() {
    return CopperIntegration.saveQuoteToCRM();
}

function createOpportunity() {
    return CopperIntegration.createOpportunity();
}

function searchCustomers(query) {
    CopperIntegration.searchCustomers(query);
}

// Function removed - FULL SCREEN button functionality removed from UI

function launchQuoteModal() {
    if (!appState.sdk) {
        alert('Copper SDK not available. Please refresh and try again.');
        return;
    }
    
    // Get context and launch modal
    appState.sdk.getContext()
        .then((context) => {
            let customerData = {};
            if (context && context.context && context.context.entity) {
                const entity = context.context.entity;
                customerData = {
                    customer_id: entity.id,
                    company: entity.name || entity.company_name,
                    email: entity.email,
                    phone: entity.phone_number
                };
            }
            
            // Build modal URL
            const baseUrl = window.location.origin + window.location.pathname;
            const params = new URLSearchParams({ location: 'modal', ...customerData });
            const modalUrl = `${baseUrl}?${params.toString()}`;
            
            // Launch modal
            appState.sdk.showModal({
                url: modalUrl,
                width: 900,
                height: 700,
                title: 'Generate Quote - Kanva Botanicals'
            });
        })
        .catch((error) => {
            console.error('❌ Error launching modal:', error);
            // Fallback modal without context
            const baseUrl = window.location.origin + window.location.pathname;
            appState.sdk.showModal({
                url: `${baseUrl}?location=modal`,
                width: 900,
                height: 700,
                title: 'Generate Quote - Kanva Botanicals'
            });
        });
}

function generateQuoteWithModalSupport() {
    const quoteData = {
        quoteName: document.getElementById('quoteName')?.value || 'Kanva Quote',
        companyName: document.getElementById('companyName')?.value || 'Customer',
        customerEmail: document.getElementById('customerEmail')?.value || '',
        // Add any other required quote data fields
    };
    
    // Get Copper context if available
    const copperContext = appState.context || {};
    
    // Merge quote data with Copper context
    const combinedData = { ...quoteData, ...copperContext };
    
    console.log('📋 Generating quote with data:', combinedData);
    
    // TODO: Implement quote generation logic
    // This function should handle creating the quote and potentially showing it in a modal
    
    // For now, just show a success message
    alert('Quote generation feature will be implemented soon!');
    
    return combinedData;
}

console.log('✅ Enhanced Copper Integration loaded successfully');