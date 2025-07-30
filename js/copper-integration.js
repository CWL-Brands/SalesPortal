// Enhanced Copper CRM integration with Auto-Population for Activity Panel
// FIXED: Single customer lookup section only
// MODAL OVERLAY SUPPORT: Seamless UX with context extraction

// Modal Overlay Detection and Context Extraction
const ModalOverlayHandler = {
    // Check if running in modal mode
    isModalMode: function() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('location') === 'modal';
    },
    
    // Extract context from modal launch parameters
    extractModalContext: function() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (!this.isModalMode()) {
            return null;
        }
        
        console.log('🖥️ Modal mode detected - extracting context...');
        
        const context = {
            action: urlParams.get('action') || 'generateQuote',
            entityId: urlParams.get('entityId'),
            entityType: urlParams.get('entityType'),
            entityName: urlParams.get('entityName'),
            entityEmail: urlParams.get('entityEmail'),
            entityPhone: urlParams.get('entityPhone'),
            entityAddress: urlParams.get('entityAddress'),
            entityState: urlParams.get('entityState'),
            // Additional context data
            companyName: urlParams.get('companyName'),
            contactName: urlParams.get('contactName'),
            isModal: true
        };
        
        console.log('🎯 Modal context extracted:', context);
        return context;
    },
    
    // Auto-populate form from modal context
    populateFromModalContext: function(context) {
        if (!context) return;
        
        console.log('📋 Auto-populating form from modal context...');
        
        // Populate customer information
        if (context.companyName || context.entityName) {
            const companyField = document.getElementById('companyName');
            if (companyField) {
                companyField.value = context.companyName || context.entityName;
                console.log('✅ Company name populated:', companyField.value);
            }
        }
        
        if (context.contactName) {
            const quoteNameField = document.getElementById('quoteName');
            if (quoteNameField) {
                quoteNameField.value = `Quote for ${context.contactName}`;
                console.log('✅ Quote name populated:', quoteNameField.value);
            }
        }
        
        if (context.entityEmail) {
            const emailField = document.getElementById('customerEmail');
            if (emailField) {
                emailField.value = context.entityEmail;
                console.log('✅ Email populated:', emailField.value);
            }
        }
        
        if (context.entityPhone) {
            const phoneField = document.getElementById('customerPhone');
            if (phoneField) {
                phoneField.value = context.entityPhone;
                console.log('✅ Phone populated:', phoneField.value);
            }
        }
        
        if (context.entityState) {
            const stateField = document.getElementById('customerState');
            if (stateField) {
                stateField.value = context.entityState;
                console.log('✅ State populated:', stateField.value);
                // Trigger change event to update shipping
                stateField.dispatchEvent(new Event('change'));
            }
        }
        
        // Set customer segment based on entity type
        if (context.entityType) {
            const segmentField = document.getElementById('customerSegment');
            if (segmentField) {
                // Map entity types to customer segments
                const segmentMap = {
                    'company': 'distributor',
                    'person': 'retailer',
                    'lead': 'direct'
                };
                const segment = segmentMap[context.entityType.toLowerCase()] || 'distributor';
                segmentField.value = segment;
                console.log('✅ Customer segment set:', segment);
            }
        }
        
        // Store context for later use (quote saving)
        window.modalContext = context;
        console.log('✅ Modal context stored for quote saving');
    },
    
    // Save quote as Copper activity
    saveQuoteAsActivity: function(quoteData) {
        if (!this.isModalMode() || !window.modalContext) {
            console.log('⚠️ Not in modal mode or no context - skipping activity save');
            return;
        }
        
        console.log('💾 Saving quote as Copper activity...');
        
        // Check if Copper SDK is available
        if (typeof window.Copper === 'undefined') {
            console.warn('⚠️ Copper SDK not available - cannot save activity');
            return;
        }
        
        try {
            const sdk = window.Copper.init();
            
            // Format activity details
            const activityDetails = `Quote Generated: ${quoteData.quoteName}\n` +
                                  `Company: ${quoteData.companyName}\n` +
                                  `Total: ${quoteData.totalAmount}\n` +
                                  `Products: ${quoteData.products.join(', ')}\n` +
                                  `Generated via Kanva Quote Tool`;
            
            // Save as activity (type 0 = note)
            sdk.logActivity(0, activityDetails);
            console.log('✅ Quote saved as Copper activity');
            
            // Show success notification
            this.showModalNotification('Quote saved to CRM!', 'success');
            
            // Close modal after short delay
            setTimeout(() => {
                sdk.closeModal();
                console.log('✅ Modal closed after quote save');
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error saving quote as activity:', error);
            this.showModalNotification('Error saving to CRM', 'error');
        }
    },
    
    // Show notification in modal
    showModalNotification: function(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('modalNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'modalNotification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-weight: bold;
                z-index: 10000;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(notification);
        }
        
        // Set message and style based on type
        notification.textContent = message;
        notification.style.backgroundColor = type === 'success' ? '#10B981' : 
                                           type === 'error' ? '#EF4444' : '#3B82F6';
        notification.style.opacity = '1';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 3000);
    },
    
    // Initialize modal overlay handler
    initialize: function() {
        console.log('🖥️ Initializing Modal Overlay Handler...');
        
        if (this.isModalMode()) {
            console.log('✅ Modal mode detected!');
            this.extractModalContext();
            this.applyModalStyling();
            this.setupModalBehavior();
            this.optimizeModalDimensions();
        } else {
            console.log('🌐 Standard mode - no modal overlay needed');
        }
    },
    
    // Apply modal-specific styling
    applyModalStyling: function() {
        // Add modal-specific CSS class to body
        document.body.classList.add('modal-mode');
        
        // Add modal-specific styles
        const modalStyles = document.createElement('style');
        modalStyles.textContent = `
            .modal-mode {
                background: #f8fafc;
            }
            .modal-mode .app-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                padding: 1rem;
            }
            .modal-mode .brand-logo {
                filter: brightness(0) invert(1);
            }
        `;
        document.head.appendChild(modalStyles);
        
        console.log('✅ Modal styling applied');
    }
};

// Initialize modal handler immediately
ModalOverlayHandler.initialize();

const CopperIntegration = {
    searchInterfaceAdded: false, // FIXED: Prevent duplicate search interfaces

    // Initialize Copper SDK and detect environment
    initialize: async function() {
        console.log('🔗 Initializing Copper CRM integration...');
        console.log('🔍 DEBUG: Current URL:', window.location.href);
        console.log('🔍 DEBUG: User Agent:', navigator.userAgent);
        console.log('🔍 DEBUG: Window object keys:', Object.keys(window).filter(key => key.toLowerCase().includes('copper')));
        
        try {
            // Load credentials from secure integration handler if available
            if (window.secureIntegrationHandler) {
                try {
                    const copperConfig = await window.secureIntegrationHandler.getIntegration('copper');
                    if (copperConfig) {
                        if (!appState.copper) appState.copper = {};
                        appState.copper.apiKey = copperConfig.apiKey || appState.copper.apiKey;
                        appState.copper.email = copperConfig.email || appState.copper.email;
                        appState.copper.environment = copperConfig.environment || 'production';
                        console.log('✅ Copper credentials loaded from secure handler');
                    }
                } catch (error) {
                    console.warn('⚠️ Could not load Copper credentials:', error.message);
                }
            }
            
            // Enhanced Copper SDK detection
            console.log('🔍 DEBUG: Checking for Copper SDK...');
            console.log('🔍 DEBUG: typeof window.Copper:', typeof window.Copper);
            console.log('🔍 DEBUG: window.Copper exists:', !!window.Copper);
            
            if (typeof window.Copper !== 'undefined') {
                console.log('✅ Copper SDK detected on window');
                console.log('🔍 DEBUG: Available Copper methods:', Object.keys(window.Copper));
                
                try {
                    appState.sdk = window.Copper.init();
                    console.log('✅ Copper SDK initialized successfully');
                    console.log('🔍 DEBUG: SDK object:', appState.sdk);
                    if (appState.sdk) {
                        console.log('🔍 DEBUG: SDK methods after init:', Object.keys(appState.sdk));
                    }
                    
                    // Configure SDK based on mode
                    this.configureSdk();
                    
                    // Initialize context bridge for cross-iframe communication
                    this.initializeContextBridge();
                    
                    // Get user context with enhanced detection
                    this.getUserContextEnhanced();
                    
                    // Mark as Copper environment
                    appState.isCopperActive = true;
                    appState.integrationMode = 'copper';
                    
                    return true;
                } catch (sdkError) {
                    console.error('❌ Error calling Copper.init():', sdkError);
                    this.setupStandaloneMode();
                    return false;
                }
            } else {
                console.log('⚠️ Copper SDK not found on window object');
                console.log('🔍 DEBUG: Will check for delayed SDK loading...');
                
                // Try to wait for SDK to load (sometimes it loads after our script)
                let retryCount = 0;
                const maxRetries = 5;
                const retryDelay = 1000; // 1 second
                
                const checkForSDK = () => {
                    return new Promise((resolve) => {
                        const interval = setInterval(() => {
                            retryCount++;
                            console.log(`🔄 Retry ${retryCount}/${maxRetries}: Checking for Copper SDK...`);
                             
                            if (typeof window.Copper !== 'undefined') {
                                clearInterval(interval);
                                console.log('✅ Copper SDK found on retry!');
                                resolve(true);
                            } else if (retryCount >= maxRetries) {
                                clearInterval(interval);
                                console.log('⚠️ Copper SDK not found after retries');
                                resolve(false);
                            }
                        }, retryDelay);
                    });
                };
                
                const sdkFound = await checkForSDK();
                if (sdkFound) {
                    // Recursively call initialize now that SDK is available
                    return this.initialize();
                } else {
                    console.log('⚠️ Running outside Copper environment - CRM features will be simulated');
                    this.setupStandaloneMode();
                    return false;
                }
            }
        } catch (error) {
            console.error('❌ Error initializing Copper SDK:', error);
            this.setupStandaloneMode();
            return false;
        }
    },

    // Enhanced context detection with hybrid capabilities
    getUserContextEnhanced: function() {
        if (!appState.sdk) return;

        appState.sdk.getContext()
            .then((data) => {
                console.log('👤 Copper context received:', data);
                appState.copperContext = data;
                
                // Set user information
                if (data.user) {
                    AuthManager.setUser(data.user);
                }
                
                // Detect integration mode
                this.detectIntegrationMode(data);
                
                // Auto-populate if context available and in activity panel
                if (data.context && data.context.entity && appState.isActivityPanel) {
                    console.log('🎯 Activity panel context detected - enabling auto-population');
                    this.autoPopulateFromEntity(data.context.entity);
                    appState.hasEntityContext = true;
                } else if (appState.isLeftNav && !this.searchInterfaceAdded) {
                    console.log('🔍 Left nav mode - enabling customer search');
                    this.enableCustomerSearch();
                    appState.hasEntityContext = false;
                }
                
                // Trigger UI update
                if (typeof UIManager !== 'undefined') {
                    UIManager.onContextReceived(data);
                }
            })
            .catch((error) => {
                console.error('❌ Error getting Copper context:', error);
                // Fallback based on mode
                if (appState.isLeftNav && !this.searchInterfaceAdded) {
                    this.enableCustomerSearch();
                }
                appState.hasEntityContext = false;
            });
    },

    /**
     * Detect integration mode and set up appropriate UI
     */
    detectIntegrationMode: function() {
        console.log('🔍 Detecting Copper CRM integration mode...');
        
        // Check if running inside Copper CRM
        if (typeof window.Copper !== 'undefined') {
            console.log('✅ Copper SDK detected');
            appState.isEmbedded = true;
            
            // Detect specific embedding location
            const urlParams = new URLSearchParams(window.location.search);
            const location = urlParams.get('location');
            
            if (location === 'left_nav') {
                appState.integrationMode = 'left_nav';
                appState.isLeftNav = true;
                console.log('📍 Left navigation mode detected');
            } else if (location === 'activity_panel') {
                appState.integrationMode = 'activity_panel';
                appState.isActivityPanel = true;
                console.log('📍 Activity panel mode detected');
                this.showLaunchModalButton();
            } else if (location === 'action_bar') {
                appState.integrationMode = 'action_bar';
                appState.isActionBar = true;
                console.log('📍 Action bar mode detected');
            } else {
                // Try to detect based on iframe context or other indicators
                // Check if we're in an iframe (likely Activity Panel)
                if (window.self !== window.top) {
                    appState.integrationMode = 'activity_panel';
                    appState.isActivityPanel = true;
                    console.log('📍 Activity panel mode detected (iframe)');
                    this.showLaunchModalButton();
                } else {
                    appState.integrationMode = 'embedded';
                    console.log('📍 Generic embedded mode detected');
                }
            }
        } else {
            console.log('🌐 Standalone mode - no Copper SDK detected');
            appState.isEmbedded = false;
            appState.integrationMode = 'standalone';
        }
        
        console.log(`🎯 Integration mode: ${appState.integrationMode}`);
        return appState.integrationMode;
    },

    /**
     * Show Launch Modal button for Activity Panel mode
     */
    showLaunchModalButton: function() {
        console.log('🚀 Showing Launch Modal button for Activity Panel mode...');
        
        const launchModalBtn = document.getElementById('launchModalBtn');
        if (launchModalBtn) {
            launchModalBtn.style.display = 'inline-block';
            console.log('✅ Launch Modal button is now visible');
        } else {
            console.warn('⚠️ Launch Modal button not found in DOM');
        }
        
        // Also hide fullscreen button in Activity Panel mode since modal is preferred
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
            console.log('📱 Fullscreen button hidden in Activity Panel mode');
        }
    },

    // Enable customer search functionality for left nav mode
    enableCustomerSearch: function() {
        if (this.searchInterfaceAdded) {
            console.log('🔍 Customer search interface already added');
            return;
        }

        console.log('🔍 Enabling customer search functionality');
        
        // Add search interface after a brief delay to ensure DOM is ready
        setTimeout(() => {
            this.addCustomerSearchInterface();
        }, 500);
    },

    // Add customer search interface to the form (FIXED: Only add once)
    addCustomerSearchInterface: function() {
        if (this.searchInterfaceAdded) {
            console.log('🔍 Search interface already exists, skipping');
            return;
        }

        const customerSection = document.querySelector('.customer-info');
        if (!customerSection) {
            console.warn('Customer info section not found');
            return;
        }

        // FIXED: Check if search interface already exists
        const existingSearch = document.getElementById('customerSearch');
        if (existingSearch) {
            console.log('🔍 Search interface already exists in DOM');
            this.searchInterfaceAdded = true;
            return;
        }
        
        const searchHTML = `
            <div class="customer-search" id="customerSearch">
                <h4>🔍 Quick Customer Lookup</h4>
                <div class="search-controls">
                    <input type="text" id="customerSearchInput" placeholder="Search companies & contacts..." />
                    <button class="search-btn" onclick="CopperIntegration.searchCustomers()">Search</button>
                </div>
                <div id="searchResults" class="search-results" style="display: none;"></div>
            </div>
        `;
        
        // Insert search interface at the top of customer section
        customerSection.insertAdjacentHTML('afterbegin', searchHTML);
        
        // Add real-time search
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (e.target.value.length >= 2) {
                        this.searchCustomers(e.target.value);
                    } else {
                        this.hideSearchResults();
                    }
                }, 300);
            });
        }
        
        this.searchInterfaceAdded = true; // FIXED: Mark as added
        console.log('✅ Customer search interface added');
    },

    // Search for customers using proper Copper SDK methods
    searchCustomers: function(query) {
        const searchQuery = query || document.getElementById('customerSearchInput')?.value;
        if (!searchQuery) return;
        
        console.log(`🔍 Searching for customers: "${searchQuery}"`);
        
        if (!appState.sdk) {
            console.log('📝 Using demo search (no CRM available)');
            this.showDemoSearchResults(searchQuery);
            return;
        }
        
        // Show loading state
        this.showSearchLoading();
        
        // Use proper Copper SDK search methods
        Promise.allSettled([
            this.searchCompanies(searchQuery),
            this.searchContacts(searchQuery)
        ]).then(results => {
            const companies = results[0].status === 'fulfilled' ? results[0].value : [];
            const contacts = results[1].status === 'fulfilled' ? results[1].value : [];
            
            const allResults = [...companies, ...contacts];
            this.displaySearchResults(allResults);
        }).catch(error => {
            console.error('❌ Error searching customers:', error);
            this.showSearchError();
        });
    },

    // Search companies using Copper SDK
    searchCompanies: function(query) {
        return new Promise((resolve) => {
            if (!appState.sdk || !appState.sdk.api) {
                resolve([]);
                return;
            }
            
            try {
                const searchParams = {
                    page_size: 10,
                    search: { name: query }
                };
                
                if (appState.sdk.api.companies && appState.sdk.api.companies.search) {
                    appState.sdk.api.companies.search(searchParams)
                        .then(response => {
                            const companies = (response.data || response || []).map(company => ({
                                ...company,
                                type: 'company',
                                display_name: company.name
                            }));
                            resolve(companies);
                        })
                        .catch(error => {
                            console.warn('⚠️ Company search failed:', error);
                            resolve([]);
                        });
                } else {
                    resolve([]);
                }
            } catch (error) {
                resolve([]);
            }
        });
    },

    // Search contacts using Copper SDK
    searchContacts: function(query) {
        return new Promise((resolve) => {
            if (!appState.sdk || !appState.sdk.api) {
                resolve([]);
                return;
            }
            
            try {
                const searchParams = {
                    page_size: 10,
                    search: { name: query }
                };
                
                if (appState.sdk.api.people && appState.sdk.api.people.search) {
                    appState.sdk.api.people.search(searchParams)
                        .then(response => {
                            const contacts = (response.data || response || []).map(contact => ({
                                ...contact,
                                type: 'person',
                                display_name: contact.name
                            }));
                            resolve(contacts);
                        })
                        .catch(error => {
                            console.warn('⚠️ Contact search failed:', error);
                            resolve([]);
                        });
                } else {
                    resolve([]);
                }
            } catch (error) {
                resolve([]);
            }
        });
    },

    // Show loading state during search
    showSearchLoading: function() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="search-loading">Searching customers...</div>';
            resultsContainer.style.display = 'block';
        }
    },

    // Display search results
    displaySearchResults: function(results) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No customers found</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        
        const resultsHTML = results.map(customer => {
            const displayName = customer.display_name || customer.name;
            const companyInfo = customer.company_name ? ` at ${customer.company_name}` : '';
            const email = customer.emails?.[0]?.email || customer.emails?.[0] || 'No email';
            
            return `
                <div class="search-result" onclick="CopperIntegration.selectCustomer(${this.escapeJson(customer)})">
                    <div class="customer-name">${displayName}</div>
                    <div class="customer-type">${customer.type}${companyInfo}</div>
                    <div class="customer-email">${email}</div>
                </div>
            `;
        }).join('');
        
        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.style.display = 'block';
        
        console.log(`✅ Displayed ${results.length} search results`);
    },

    // Escape JSON for HTML attributes
    escapeJson: function(obj) {
        return JSON.stringify(obj).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    // Demo search results for standalone mode
    showDemoSearchResults: function(query) {
        const demoResults = [
            {
                name: "Eddie Johnson",
                type: "person",
                company_name: "ABC Distribution",
                emails: [{ email: "eddie@abcdistribution.com" }],
                phone_numbers: [{ number: "(555) 123-4567" }],
                websites: [{ url: "https://abcdistribution.com" }],
                tags: ["wholesale", "distribution"]
            },
            {
                name: "Sarah Miller",
                type: "person", 
                company_name: "Green Leaf Smoke Shop",
                emails: [{ email: "sarah@greenleaf.com" }],
                phone_numbers: [{ number: "(555) 987-6543" }],
                websites: [{ url: "https://greenleaf.com" }],
                tags: ["smoke shop", "retail"]
            }
        ].filter(customer => 
            customer.name.toLowerCase().includes(query.toLowerCase()) ||
            customer.company_name?.toLowerCase().includes(query.toLowerCase())
        );
        
        this.displaySearchResults(demoResults);
    },

    // Select customer from search results
    selectCustomer: function(customer) {
        console.log('👤 Selected customer:', customer);
        
        // Auto-populate form with selected customer
        this.autoPopulateFromEntity(customer);
        
        // Hide search results
        this.hideSearchResults();
        
        // Clear search input
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Show selection indicator
        this.showSelectionIndicator(customer);
    },

    // Auto-populate fields from Copper entity context
    autoPopulateFromEntity: function(entity) {
        console.log('🔄 Auto-populating from entity:', entity);
        
        try {
            // Wait for DOM to be ready
            setTimeout(() => {
                // Generate Quote Name: "${product} Quote for ${company}"
                const productSelect = document.getElementById('primaryProduct') || document.getElementById('quickProduct');
                const productName = productSelect?.selectedOptions[0]?.text?.split(' (')[0] || 'Product';
                const companyName = entity.company_name || (entity.type === 'company' ? entity.name : '');
                
                if (companyName) {
                    const quoteName = `${productName} Quote for ${companyName}`;
                    const quoteNameInput = document.getElementById('quoteName');
                    if (quoteNameInput) {
                        quoteNameInput.value = quoteName;
                        quoteNameInput.classList.add('auto-populated');
                        console.log('📝 Auto-filled quote name:', quoteName);
                    }
                }
                
                // Company name
                if (companyName) {
                    const companyInput = document.getElementById('companyName');
                    if (companyInput) {
                        companyInput.value = companyName;
                        companyInput.classList.add('auto-populated');
                        console.log('📝 Auto-filled company name:', companyName);
                    }
                }
                
                // Segment (from custom fields or tags)
                this.autoPopulateSegment(entity);
                
                // Email domain from company website
                this.autoPopulateEmailDomain(entity);
                
                // Phone number (Contact first, then Account)
                this.autoPopulatePhone(entity);
                
                // Show context indicator
                this.showContextIndicator(entity);
                
                // Trigger initial calculation
                if (typeof App !== 'undefined' && App.triggerCalculation) {
                    App.triggerCalculation();
                }
                
            }, 500); // Give DOM time to render
            
        } catch (error) {
            console.error('❌ Error auto-populating from entity:', error);
        }
    },

    // Auto-populate segment from entity data
    autoPopulateSegment: function(entity) {
        const segmentInput = document.getElementById('segment');
        if (!segmentInput || segmentInput.value) return;
        
        let segment = '';
        
        // Check custom fields for segment
        if (entity.custom_fields) {
            const segmentField = entity.custom_fields.find(field => 
                field.custom_field_definition_id && 
                (field.custom_field_definition_id.includes('segment') || 
                 field.custom_field_definition_id.includes('industry'))
            );
            if (segmentField && segmentField.value) {
                segment = segmentField.value;
            }
        }
        
        // Fallback to smart detection from company name and tags
        if (!segment) {
            const companyName = (entity.company_name || entity.name || '').toLowerCase();
            const tags = entity.tags || [];
            
            if (companyName.includes('smoke') || companyName.includes('vape') || 
                tags.some(tag => tag.includes('smoke') || tag.includes('vape'))) {
                segment = 'smoke and vape shops';
            } else if (companyName.includes('convenience') || companyName.includes('c-store') ||
                      tags.some(tag => tag.includes('convenience'))) {
                segment = 'convenience stores';
            } else if (companyName.includes('distribution') || companyName.includes('wholesale') ||
                      tags.some(tag => tag.includes('wholesale'))) {
                segment = 'wholesale distribution';
            } else if (companyName.includes('dispensary') || companyName.includes('cannabis') ||
                      tags.some(tag => tag.includes('dispensary'))) {
                segment = 'cannabis dispensaries';
            } else {
                segment = 'retail customers';
            }
        }
        
        if (segment) {
            segmentInput.value = segment;
            segmentInput.classList.add('auto-populated');
            console.log('📝 Auto-filled segment:', segment);
        }
    },

    // Auto-populate email domain from company website
    autoPopulateEmailDomain: function(entity) {
        const emailDomainInput = document.getElementById('emailDomain');
        if (!emailDomainInput || emailDomainInput.value) return;
        
        let emailDomain = '';
        
        // First priority: company website
        if (entity.websites && entity.websites.length > 0) {
            const website = entity.websites[0].url || entity.websites[0];
            emailDomain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        }
        
        // Second priority: extract domain from contact emails
        if (!emailDomain && entity.emails && entity.emails.length > 0) {
            const email = entity.emails[0].email || entity.emails[0];
            if (email.includes('@')) {
                emailDomain = email.split('@')[1];
            }
        }
        
        if (emailDomain) {
            emailDomainInput.value = emailDomain;
            emailDomainInput.classList.add('auto-populated');
            console.log('📝 Auto-filled email domain:', emailDomain);
        }
    },

    // Auto-populate phone number (Contact first, then Account)
    autoPopulatePhone: function(entity) {
        const phoneInput = document.getElementById('phone');
        if (!phoneInput || phoneInput.value) return;
        
        let phone = '';
        
        // Contact phone numbers first priority
        if (entity.phone_numbers && entity.phone_numbers.length > 0) {
            phone = entity.phone_numbers[0].number || entity.phone_numbers[0];
        }
        
        if (phone) {
            phoneInput.value = phone;
            phoneInput.classList.add('auto-populated');
            console.log('📝 Auto-filled phone:', phone);
        }
    },

    // Show visual indicator that context was auto-populated
    showContextIndicator: function(entity) {
        // Remove existing indicators
        const existingIndicator = document.querySelector('.context-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'context-indicator';
        indicator.innerHTML = `
            <div class="context-banner">
                🎯 Auto-populated from ${entity.type}: <strong>${entity.name}</strong>
                <button onclick="CopperIntegration.clearAutoPopulation()" class="clear-context-btn">Clear & Manual Entry</button>
            </div>
        `;
        
        // Add to top of calculator or activity panel
        const calculator = document.getElementById('mainCalculator') || document.querySelector('.activity-panel-calculator');
        if (calculator) {
            calculator.insertBefore(indicator, calculator.firstChild);
        }
    },

    // Show indicator that customer was selected from search
    showSelectionIndicator: function(customer) {
        // Remove existing indicators
        const existingIndicator = document.querySelector('.context-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'context-indicator';
        indicator.innerHTML = `
            <div class="context-banner selection-banner">
                ✅ Selected: <strong>${customer.name}</strong> ${customer.company_name ? `(${customer.company_name})` : ''}
                <button onclick="CopperIntegration.clearSelection()" class="clear-context-btn">Clear Selection</button>
            </div>
        `;
        
        const calculator = document.getElementById('mainCalculator');
        if (calculator) {
            calculator.insertBefore(indicator, calculator.firstChild);
        }
    },

    // Hide search results
    hideSearchResults: function() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    },

    // Show search error
    showSearchError: function() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="search-error">Error searching customers. Please try again.</div>';
            resultsContainer.style.display = 'block';
        }
    },

    // Clear auto-population and switch to manual mode
    clearAutoPopulation: function() {
        // Clear form fields
        ['quoteName', 'companyName', 'segment', 'emailDomain', 'phone'].forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                field.classList.remove('auto-populated');
            }
        });
        
        // Remove context indicator
        const indicator = document.querySelector('.context-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // Show notification
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showInfo('Switched to manual entry mode');
        }
        
        console.log('🔄 Cleared auto-population, switched to manual entry');
    },

    // Clear customer selection
    clearSelection: function() {
        this.clearAutoPopulation();
        
        // Show search interface again if it exists
        const searchSection = document.getElementById('customerSearch');
        if (searchSection) {
            searchSection.style.display = 'block';
        }
    },

    // Configure SDK settings based on current mode
    configureSdk: function() {
        if (!appState.sdk) return;

        try {
            if (appState.isModalMode) {
                appState.sdk.setAppUI({
                    width: 1000,
                    height: 700,
                    showActionBar: false,
                    disableAddButton: true
                });
                console.log('📐 Configured SDK for modal mode (1000x700)');
            } else if (appState.isActivityPanel) {
                appState.sdk.setAppUI({
                    width: 400,
                    height: 600,
                    showActionBar: false,
                    disableAddButton: true
                });
                console.log('📐 Configured SDK for activity panel mode (400x600)');
            }
        } catch (error) {
            console.error('❌ Error configuring SDK:', error);
        }
    },

    // Setup standalone mode for testing
    setupStandaloneMode: function() {
        appState.isCopperActive = false;
        appState.isAdmin = true;
        appState.integrationMode = 'standalone';
        appState.isLeftNav = true; // Enable search in standalone
        
        if (typeof AuthManager !== 'undefined') {
            AuthManager.setUser({
                email: 'demo@kanvabotanicals.com',
                name: 'Demo User'
            });
        }
        
        console.log('🔧 Running in standalone demo mode');
        
        // Enable customer search in left nav mode
        setTimeout(() => {
            this.enableCustomerSearch();
        }, 1000);
    },

    // Save quote to CRM as activity
    saveQuoteToCRM: function() {
        const calc = Calculator.calculateOrder();
        if (!calc || (!calc.product && !Array.isArray(calc))) {
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showError('Please calculate a quote first');
            }
            return;
        }

        if (appState.sdk && appState.sdk.logActivity) {
            try {
                const details = this.formatQuoteActivity(calc);
                appState.sdk.logActivity(0, details);
                console.log('💾 Quote saved to CRM activity log');
                
                if (typeof NotificationManager !== 'undefined') {
                    NotificationManager.showSuccess('Quote saved to CRM activity log!');
                }
                
                this.refreshCopperUI();
            } catch (error) {
                console.error('❌ Error saving quote to CRM:', error);
                if (typeof NotificationManager !== 'undefined') {
                    NotificationManager.showError('Failed to save quote to CRM: ' + error.message);
                }
            }
        } else {
            console.log('📝 Simulating CRM save (SDK not available)');
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showInfo('CRM integration not available - quote ready to copy');
            }
        }
    },

    // Create opportunity in Copper
    createOpportunity: function() {
        const calc = Calculator.calculateOrder();
        if (!calc || (!calc.product && !Array.isArray(calc))) {
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showError('Please calculate a quote first');
            }
            return;
        }

        if (appState.sdk && appState.sdk.createEntity) {
            try {
                const opportunityData = this.formatOpportunityData(calc);
                appState.sdk.createEntity('opportunity', opportunityData);
                console.log('🎯 Opportunity created in Copper');
                
                if (typeof NotificationManager !== 'undefined') {
                    NotificationManager.showSuccess('Opportunity created in Copper CRM!');
                }
                
                this.refreshCopperUI();
            } catch (error) {
                console.error('❌ Error creating opportunity:', error);
                if (typeof NotificationManager !== 'undefined') {
                    NotificationManager.showError('Failed to create opportunity: ' + error.message);
                }
            }
        } else {
            console.log('💼 Simulating opportunity creation (SDK not available)');
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showInfo('CRM integration not available');
            }
        }
    },

    // Open modal with full calculator
    openModal: function() {
        if (appState.sdk && appState.sdk.showModal) {
            try {
                // Configure modal for full calculator
                appState.sdk.setAppUI({
                    width: 1000,
                    height: 700,
                    showActionBar: false
                });
                
                // Open modal
                appState.sdk.showModal();
                console.log('🔄 Opened Copper native modal');
            } catch (error) {
                console.error('❌ Error opening Copper modal:', error);
                if (typeof NotificationManager !== 'undefined') {
                    NotificationManager.showError('Failed to open modal. Please try again.');
                } else {
                    console.error('Failed to open modal. Please try again.');
                }
            }
        } else {
            console.warn('⚠️  Copper SDK not available - modal cannot be opened');
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showWarning('Modal functionality requires Copper CRM integration.');
            }
        }
    },

    // Format quote activity
    formatQuoteActivity: function(calc) {
        const timestamp = new Date().toLocaleString();
        const userEmail = appState.currentUser?.email || 'Unknown User';
        const quoteName = document.getElementById('quoteName')?.value || 'Quote';
        
        let productDetails = '';
        let total = 0;
        
        if (Array.isArray(calc)) {
            // Multiple products
            calc.forEach((item, index) => {
                productDetails += `Product ${index + 1}: ${item.product.name} - ${item.masterCases} cases - ${item.total}\n`;
                total += item.raw.total;
            });
        } else {
            // Single product
            productDetails = `Product: ${calc.product.name}\nQuantity: ${calc.masterCases} Master Cases (${calc.displayBoxes} Display Boxes)\nIndividual Units: ${calc.totalUnits.toLocaleString()}\nUnit Price: ${calc.unitPrice} (${calc.tierInfo.name})\nCase Price: ${calc.casePrice}\nSubtotal: ${calc.subtotal}\nShipping: ${calc.freeShipping ? 'FREE' : calc.shipping}`;
            total = calc.raw.total;
        }
        
        return `KANVA QUOTE GENERATED: ${quoteName}

${productDetails}

Total: ${total.toLocaleString()}

Generated by: ${userEmail}
Generated on: ${timestamp}
Calculator Version: ${adminConfig.metadata.version}`;
    },

    // Format opportunity data for Copper
    formatOpportunityData: function(calc) {
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
            details: `Kanva Botanicals Quote\nTotal Value: ${monetaryValue.toLocaleString()}`,
            status: 'Open',
            close_date: this.getCloseDate(),
            priority: 'Normal'
        };
    },

    // Get suggested close date (30 days from now)
    getCloseDate: function() {
        const closeDate = new Date();
        closeDate.setDate(closeDate.getDate() + 30);
        return Math.floor(closeDate.getTime() / 1000);
    },

    // Refresh Copper UI to show new data
    refreshCopperUI: function() {
        if (appState.sdk && appState.sdk.refreshUI) {
            try {
                appState.sdk.refreshUI({ name: 'ActivityLog' });
                
                if (appState.copperContext?.type) {
                    appState.sdk.refreshUI({ 
                        name: 'Related', 
                        data: { type: appState.copperContext.type } 
                    });
                }
                
                console.log('🔄 Copper UI refreshed');
            } catch (error) {
                console.error('⚠️  Could not refresh Copper UI:', error);
            }
        }
    },

    // Check if CRM features are available
    isCrmAvailable: function() {
        return appState.sdk !== null;
    },

    // Get current context data
    getContextData: function() {
        return {
            user: appState.currentUser,
            context: appState.copperContext,
            isAdmin: appState.isAdmin,
            location: appState.appLocation,
            integrationMode: appState.integrationMode,
            hasEntityContext: appState.hasEntityContext,
            contextEntity: appState.contextEntity
        };
    },
    
    /**
     * Configure Copper integration with API credentials
     * @param {Object} config - Configuration object with apiKey, email, and environment
     * @returns {Promise} - Promise that resolves when configuration is complete
     */
    configure: async function(config) {
        console.log('🔧 Configuring Copper integration with new credentials...');
        
        if (!config) {
            console.error('❌ No configuration provided to Copper.configure()');
            return false;
        }
        
        // Store credentials in appState
        if (!appState.copper) appState.copper = {};
        
        appState.copper.apiKey = config.apiKey || appState.copper.apiKey;
        appState.copper.email = config.email || appState.copper.email;
        appState.copper.environment = config.environment || 'production';
        
        console.log(`✅ Copper credentials configured for ${appState.copper.environment} environment`);
        
        // Save to secure integration handler if available
        if (window.secureIntegrationHandler) {
            try {
                await window.secureIntegrationHandler.updateIntegration('copper', {
                    apiKey: appState.copper.apiKey,
                    email: appState.copper.email,
                    environment: appState.copper.environment,
                    lastUpdated: new Date().toISOString()
                });
                console.log('✅ Copper credentials saved to secure storage');
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('Copper API credentials updated successfully', 'success');
                }
            } catch (error) {
                console.error('❌ Error saving Copper credentials:', error);
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('Failed to save Copper API credentials', 'error');
                }
            }
        }
        
        // If we're in standalone mode, update the configuration
        if (!this.isCrmAvailable() && appState.copper.apiKey) {
            try {
                // Here we would initialize the standalone API client with the new credentials
                // This would typically involve setting up API headers or authentication
                console.log('🔄 Updating standalone API configuration with new credentials');
                
                // For now, we'll just update the appState and return success
                return true;
            } catch (error) {
                console.error('❌ Error configuring Copper API:', error);
                return false;
            }
        }
        
        return true;
    },

    // ==============================================
    // CONTEXT BRIDGE IMPLEMENTATION
    // Enables seamless context sharing between sidebar and fullscreen modes
    // ==============================================

    /**
     * Initialize context bridge messaging system
     * Sets up listeners for cross-iframe communication
     */
    initializeContextBridge: function() {
        if (!appState.sdk) {
            console.warn('⚠️ SDK not available for context bridge');
            return;
        }

        console.log('🌉 Initializing Copper SDK context bridge...');

        // Listen for context updates from other app instances
        appState.sdk.on('customerContext', (data) => {
            console.log('📨 Received customer context via bridge:', data);
            this.handleReceivedContext(data);
        });

        // Listen for quote updates from other instances
        appState.sdk.on('quoteSaved', (data) => {
            console.log('📊 Received quote saved notification:', data);
            this.handleQuoteSaved(data);
        });

        // Listen for fullscreen requests with context
        appState.sdk.on('openFullscreenWithContext', (data) => {
            console.log('🖥️ Received fullscreen request with context:', data);
            this.openFullscreenWithContext(data);
        });

        // Listen for context requests from other instances
        appState.sdk.on('requestContext', (data) => {
            console.log('📞 Received context request from:', data.source);
            this.shareCurrentContext(data.source);
        });

        console.log('✅ Context bridge initialized successfully');
    },

    /**
     * Open fullscreen mode with current context
     * Publishes context data before opening fullscreen
     */
    openFullscreenWithContext: async function(customData = null) {
        if (!appState.sdk) {
            console.warn('⚠️ SDK not available for fullscreen context sharing');
            // Fallback to regular fullscreen
            if (appState.sdk && typeof appState.sdk.showFullScreen === 'function') {
                appState.sdk.showFullScreen();
            }
            return;
        }

        try {
            console.log('🚀 Opening fullscreen with context bridge...');

            // Get current context if not provided
            let contextData = customData;
            if (!contextData) {
                const copperContext = await appState.sdk.getContext();
                contextData = this.extractContextData(copperContext);
            }

            // Add current form data to context
            const currentFormData = this.getCurrentFormData();
            contextData = { ...contextData, ...currentFormData };

            console.log('📤 Publishing context to fullscreen:', contextData);

            // Publish context to fullscreen instance
            appState.sdk.publishMessage('customerContext', 'fullscreen', contextData);

            // Small delay to ensure message is sent before opening fullscreen
            setTimeout(() => {
                appState.sdk.showFullScreen();
                console.log('🖥️ Fullscreen opened with context');
            }, 100);

        } catch (error) {
            console.error('❌ Error opening fullscreen with context:', error);
            // Fallback to regular fullscreen
            if (typeof appState.sdk.showFullScreen === 'function') {
                appState.sdk.showFullScreen();
            }
        }
    },

    /**
     * Extract relevant context data from Copper SDK context
     */
    extractContextData: function(copperContext) {
        const contextData = {
            timestamp: new Date().toISOString(),
            source: 'sidebar',
            location: copperContext?.location || 'unknown'
        };

        // Extract entity data if available
        if (copperContext?.context?.entity) {
            const entity = copperContext.context.entity;
            contextData.entity = {
                id: entity.id,
                type: entity.type, // person, company, lead, etc.
                name: entity.name,
                email: entity.email,
                phone: entity.phone,
                company: entity.company_name || entity.name,
                address: entity.address,
                website: entity.website
            };

            console.log('📋 Extracted entity context:', contextData.entity);
        }

        // Extract user data
        if (copperContext?.user) {
            contextData.user = {
                id: copperContext.user.id,
                name: copperContext.user.name,
                email: copperContext.user.email
            };
        }

        return contextData;
    },

    /**
     * Get current form data to preserve user input
     */
    getCurrentFormData: function() {
        const formData = {};

        try {
            // Extract current form values
            const quoteName = document.getElementById('quoteName')?.value;
            const companyName = document.getElementById('companyName')?.value;
            const email = document.getElementById('email')?.value;
            const phone = document.getElementById('phone')?.value;
            const customerSegment = document.getElementById('customerSegment')?.value;
            const state = document.getElementById('state')?.value;

            if (quoteName) formData.quoteName = quoteName;
            if (companyName) formData.companyName = companyName;
            if (email) formData.email = email;
            if (phone) formData.phone = phone;
            if (customerSegment) formData.customerSegment = customerSegment;
            if (state) formData.state = state;

            // Get selected products if any
            const selectedProducts = this.getSelectedProducts();
            if (selectedProducts.length > 0) {
                formData.selectedProducts = selectedProducts;
            }

            console.log('📝 Current form data extracted:', formData);
        } catch (error) {
            console.warn('⚠️ Error extracting form data:', error);
        }

        return formData;
    },

    /**
     * Get currently selected products from the form
     */
    getSelectedProducts: function() {
        const selectedProducts = [];
        
        try {
            // Look for selected product elements
            const productElements = document.querySelectorAll('.product-card.selected, .product-item.selected');
            productElements.forEach(element => {
                const productData = {
                    id: element.dataset.productId,
                    name: element.dataset.productName,
                    price: element.dataset.price,
                    quantity: element.querySelector('.quantity-input')?.value || 1
                };
                selectedProducts.push(productData);
            });
        } catch (error) {
            console.warn('⚠️ Error getting selected products:', error);
        }

        return selectedProducts;
    },

    /**
     * Handle received context data from other app instances
     */
    handleReceivedContext: function(contextData) {
        console.log('🎯 Processing received context data...');

        try {
            // Auto-populate form fields with received context
            if (contextData.entity) {
                this.populateFormFromContext(contextData.entity);
            }

            // Restore form data if provided
            if (contextData.quoteName || contextData.companyName || contextData.email) {
                this.restoreFormData(contextData);
            }

            // Restore selected products if provided
            if (contextData.selectedProducts && contextData.selectedProducts.length > 0) {
                this.restoreSelectedProducts(contextData.selectedProducts);
            }

            // Show success notification
            if (window.showNotification) {
                window.showNotification('Customer data auto-populated from CRM context', 'success');
            }

            // Update app state
            appState.hasEntityContext = !!contextData.entity;
            appState.contextData = contextData;

        } catch (error) {
            console.error('❌ Error handling received context:', error);
            if (window.showNotification) {
                window.showNotification('Error processing CRM context data', 'error');
            }
        }
    },

    /**
     * Populate form fields from entity context
     */
    populateFormFromContext: function(entity) {
        console.log('📝 Populating form from entity context:', entity);

        // Populate basic fields
        if (entity.name) {
            const companyField = document.getElementById('companyName');
            if (companyField) {
                companyField.value = entity.company || entity.name;
                companyField.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (entity.email) {
            const emailField = document.getElementById('email');
            if (emailField) {
                emailField.value = entity.email;
                emailField.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (entity.phone) {
            const phoneField = document.getElementById('phone');
            if (phoneField) {
                phoneField.value = entity.phone;
                phoneField.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // Set quote name based on entity
        const quoteNameField = document.getElementById('quoteName');
        if (quoteNameField && !quoteNameField.value) {
            const quoteName = `Product Quote for ${entity.company || entity.name}`;
            quoteNameField.value = quoteName;
            quoteNameField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('✅ Form populated from entity context');
    },

    /**
     * Restore form data from context
     */
    restoreFormData: function(formData) {
        console.log('🔄 Restoring form data from context...');

        const fields = [
            { id: 'quoteName', value: formData.quoteName },
            { id: 'companyName', value: formData.companyName },
            { id: 'email', value: formData.email },
            { id: 'phone', value: formData.phone },
            { id: 'customerSegment', value: formData.customerSegment },
            { id: 'state', value: formData.state }
        ];

        fields.forEach(field => {
            if (field.value) {
                const element = document.getElementById(field.id);
                if (element) {
                    element.value = field.value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });

        console.log('✅ Form data restored from context');
    },

    /**
     * Restore selected products from context
     */
    restoreSelectedProducts: function(selectedProducts) {
        console.log('🛍️ Restoring selected products from context:', selectedProducts);

        try {
            selectedProducts.forEach(product => {
                // Find and select the product
                const productElement = document.querySelector(`[data-product-id="${product.id}"]`);
                if (productElement) {
                    productElement.classList.add('selected');
                    
                    // Set quantity if available
                    const quantityInput = productElement.querySelector('.quantity-input');
                    if (quantityInput && product.quantity) {
                        quantityInput.value = product.quantity;
                    }
                }
            });

            // Trigger calculation update if available
            if (typeof window.updateCalculation === 'function') {
                window.updateCalculation();
            }

            console.log('✅ Selected products restored');
        } catch (error) {
            console.warn('⚠️ Error restoring selected products:', error);
        }
    },

    /**
     * Share current context with requesting instance
     */
    shareCurrentContext: async function(targetLocation) {
        console.log(`📤 Sharing current context with ${targetLocation}...`);

        try {
            const copperContext = await appState.sdk.getContext();
            const contextData = this.extractContextData(copperContext);
            const formData = this.getCurrentFormData();
            const fullContext = { ...contextData, ...formData };

            appState.sdk.publishMessage('customerContext', targetLocation, fullContext);
            console.log('✅ Context shared successfully');
        } catch (error) {
            console.error('❌ Error sharing context:', error);
        }
    },

    /**
     * Handle quote saved notification from other instances
     */
    handleQuoteSaved: function(quoteData) {
        console.log('💾 Quote saved notification received:', quoteData);

        // Update UI to reflect saved quote
        if (window.showNotification) {
            window.showNotification(`Quote saved successfully: ${quoteData.quoteId || 'New Quote'}`, 'success');
        }

        // Refresh sidebar display if needed
        if (appState.isLeftNav && typeof this.refreshSidebarDisplay === 'function') {
            this.refreshSidebarDisplay(quoteData);
        }
    },

    /**
     * Publish quote saved notification to other instances
     */
    publishQuoteSaved: function(quoteData) {
        if (!appState.sdk) return;

        console.log('📢 Publishing quote saved notification...');
        
        const notificationData = {
            quoteId: quoteData.id || quoteData.quoteId,
            total: quoteData.total,
            customer: quoteData.customer,
            timestamp: new Date().toISOString(),
            source: appState.integrationMode || 'unknown'
        };

        appState.sdk.publishMessage('quoteSaved', 'sidebar', notificationData);
        appState.sdk.publishMessage('quoteSaved', 'activity_panel', notificationData);
    },

    /**
     * Request context from other app instances
     */
    requestContextFromOtherInstances: function() {
        if (!appState.sdk) return;

        console.log('📞 Requesting context from other app instances...');
        
        const requestData = {
            source: appState.integrationMode || 'unknown',
            timestamp: new Date().toISOString()
        };

        appState.sdk.publishMessage('requestContext', 'sidebar', requestData);
        appState.sdk.publishMessage('requestContext', 'activity_panel', requestData);
    },

    /**
     * Enhanced fullscreen button handler with context bridge
     */
    enhancedOpenFullscreen: function() {
        console.log('🖥️ Enhanced fullscreen requested...');
        console.log('🔍 DEBUG: Current app state:', {
            hasSDK: !!appState.sdk,
            integrationMode: appState.integrationMode,
            hasEntityContext: appState.hasEntityContext,
            contextData: appState.contextData,
            copperContext: appState.copperContext
        });
        
        // Enhanced debugging for SDK availability
        if (typeof window.Copper !== 'undefined') {
            console.log('✅ Copper SDK is available on window');
            if (appState.sdk) {
                console.log('✅ SDK initialized in appState');
                console.log('🔧 Available SDK methods:', Object.keys(appState.sdk));
                
                if (typeof appState.sdk.publishMessage === 'function') {
                    console.log('✅ publishMessage method available');
                } else {
                    console.log('❌ publishMessage method NOT available');
                }
                
                if (typeof appState.sdk.showFullScreen === 'function') {
                    console.log('✅ showFullScreen method available');
                } else {
                    console.log('❌ showFullScreen method NOT available');
                }
            } else {
                console.log('❌ SDK not initialized in appState');
            }
        } else {
            console.log('❌ Copper SDK not available on window');
        }
        
        // Try to get current context for debugging
        if (appState.sdk && typeof appState.sdk.getContext === 'function') {
            console.log('🔍 Attempting to get current context...');
            appState.sdk.getContext()
                .then((context) => {
                    console.log('📋 Current Copper context:', context);
                    if (context && context.context && context.context.entity) {
                        console.log('🎯 Entity found in context:', context.context.entity);
                    } else {
                        console.log('⚠️ No entity found in current context');
                    }
                })
                .catch((error) => {
                    console.error('❌ Error getting context:', error);
                });
        }
        
        if (appState.sdk && typeof appState.sdk.publishMessage === 'function') {
            // Use context bridge for enhanced experience
            console.log('🌉 Using context bridge for fullscreen');
            this.openFullscreenWithContext();
        } else {
            // Fallback to regular fullscreen
            console.log('📱 Fallback to regular fullscreen mode');
            if (appState.sdk && typeof appState.sdk.showFullScreen === 'function') {
                console.log('🚀 Calling SDK showFullScreen...');
                try {
                    appState.sdk.showFullScreen();
                    console.log('✅ showFullScreen called successfully');
                } catch (error) {
                    console.error('❌ Error calling showFullScreen:', error);
                }
            } else {
                console.log('🔄 Opening new window as final fallback');
                window.open(window.location.href, '_blank');
            }
        }
    }
};

// Global functions for HTML onclick handlers
function openCopperModal() {
    CopperIntegration.openModal();
}

function openFullCalculatorModal() {
    CopperIntegration.openModal();
}

function saveQuoteToCRM() {
    const result = CopperIntegration.saveQuoteToCRM();
    
    // Publish quote saved notification via context bridge
    if (result && typeof CopperIntegration.publishQuoteSaved === 'function') {
        CopperIntegration.publishQuoteSaved(result);
    }
}

function createOpportunity() {
    CopperIntegration.createOpportunity();
}

function searchCustomers() {
    CopperIntegration.searchCustomers();
}

function clearAutoPopulation() {
    CopperIntegration.clearAutoPopulation();
}

function clearSelection() {
    CopperIntegration.clearSelection();
}

// Enhanced fullscreen with context bridge
function openEnhancedFullscreen() {
    CopperIntegration.enhancedOpenFullscreen();
}

// Request context from other app instances
function requestContextFromSidebar() {
    CopperIntegration.requestContextFromOtherInstances();
}

// Modal overlay quote saving integration
function saveQuoteToModal(quoteData) {
    if (ModalOverlayHandler.isModalMode()) {
        console.log('💾 Modal mode detected - saving quote as activity...');
        ModalOverlayHandler.saveQuoteAsActivity(quoteData);
        return true;
    }
    return false;
}

// Enhanced quote generation with modal support
function generateQuoteWithModalSupport() {
    console.log('📄 Generating quote with modal support...');
    
    // Get quote data from form
    const quoteData = {
        quoteName: document.getElementById('quoteName')?.value || 'Kanva Quote',
        companyName: document.getElementById('companyName')?.value || 'Customer',
        customerEmail: document.getElementById('customerEmail')?.value || '',
        totalAmount: document.getElementById('totalAmount')?.textContent || '$0.00',
        products: getSelectedProducts() || ['Products'],
        timestamp: new Date().toISOString()
    };
    
    console.log('📊 Quote data collected:', quoteData);
    
    // If in modal mode, save to CRM
    if (ModalOverlayHandler.isModalMode()) {
        ModalOverlayHandler.saveQuoteAsActivity(quoteData);
    } else {
        console.log('📋 Standard mode - quote generation without CRM save');
        // Standard quote generation logic here
        if (typeof generateQuote === 'function') {
            generateQuote();
        }
    }
}

// Helper function to get selected products
function getSelectedProducts() {
    const products = [];
    
    // Check for product lines in the form
    const productLines = document.querySelectorAll('.product-line');
    productLines.forEach(line => {
        const productSelect = line.querySelector('select[id^="product"]');
        const quantityInput = line.querySelector('input[id^="quantity"]');
        
        if (productSelect && productSelect.value && quantityInput && quantityInput.value > 0) {
            products.push(`${productSelect.options[productSelect.selectedIndex].text} (${quantityInput.value})`);
        }
    });
    
    // Fallback: check product catalog selections
    if (products.length === 0) {
        const selectedTiles = document.querySelectorAll('.product-tile.selected');
        selectedTiles.forEach(tile => {
            const productName = tile.querySelector('.product-name')?.textContent;
            if (productName) {
                products.push(productName);
            }
        });
    }
    
    return products.length > 0 ? products : ['Selected Products'];
}

// Launch quote modal from Activity Panel
function launchQuoteModal() {
    console.log('🚀 Launching quote modal from Activity Panel...');
    
    if (!appState.sdk) {
        console.error('❌ Copper SDK not available for modal launch');
        alert('Copper SDK not available. Please refresh and try again.');
        return;
    }
    
    // Get current customer context
    appState.sdk.getContext()
        .then((context) => {
            console.log('📋 Current context for modal:', context);
            
            // Extract customer data from context
            let customerData = {};
            if (context && context.context && context.context.entity) {
                const entity = context.context.entity;
                customerData = {
                    customer_id: entity.id,
                    company: entity.name || entity.company_name,
                    email: entity.email,
                    phone: entity.phone_number,
                    address: entity.address ? `${entity.address.street}, ${entity.address.city}, ${entity.address.state}` : ''
                };
            }
            
            // Build modal URL with context
            const baseUrl = window.location.origin + window.location.pathname;
            const params = new URLSearchParams({
                location: 'modal',
                ...customerData
            });
            const modalUrl = `${baseUrl}?${params.toString()}`;
            
            console.log('🔗 Modal URL:', modalUrl);
            
            // Launch modal
            appState.sdk.showModal({
                url: modalUrl,
                width: 900,
                height: 700,
                title: 'Generate Quote - Kanva Botanicals'
            });
            
            console.log('✅ Modal launched successfully');
        })
        .catch((error) => {
            console.error('❌ Error getting context for modal:', error);
            
            // Fallback: launch modal without context
            const baseUrl = window.location.origin + window.location.pathname;
            const modalUrl = `${baseUrl}?location=modal`;
            
            appState.sdk.showModal({
                url: modalUrl,
                width: 900,
                height: 700,
                title: 'Generate Quote - Kanva Botanicals'
            });
            
            console.log('⚠️ Modal launched without context due to error');
        });
}

console.log('✅ Enhanced Copper integration module loaded successfully');
console.log('🖥️ Modal overlay support enabled');
