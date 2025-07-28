// Enhanced Copper CRM integration with Auto-Population for Activity Panel
// FIXED: Single customer lookup section only

const CopperIntegration = {
    searchInterfaceAdded: false, // FIXED: Prevent duplicate search interfaces

    // Initialize Copper SDK and detect environment
    initialize: async function() {
        console.log('🔗 Initializing Copper CRM integration...');
        
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
                        console.log('✅ Copper credentials loaded from secure storage');
                    }
                } catch (configError) {
                    console.warn('⚠️ Could not load Copper credentials from secure storage:', configError);
                }
            }
            
            // Check if we're running in Copper environment
            if (typeof window.Copper !== 'undefined') {
                appState.sdk = window.Copper.init();
                console.log('✅ Copper SDK initialized successfully');
                
                // Configure SDK based on mode
                this.configureSdk();
                
                // Get user context with enhanced detection
                this.getUserContextEnhanced();
                
                return true;
            } else {
                console.log('⚠️  Running outside Copper environment - CRM features will be simulated');
                this.setupStandaloneMode();
                return false;
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

    // Detect what kind of integration mode we're in
    detectIntegrationMode: function(context) {
        appState.integrationMode = 'left_nav'; // Default
        
        if (context && context.location) {
            if (context.location.includes('activity_panel')) {
                appState.integrationMode = 'activity_panel';
                appState.isActivityPanel = true;
                console.log('📍 Activity panel mode: Context-aware auto-population');
            } else if (context.location.includes('left_nav')) {
                appState.integrationMode = 'left_nav';
                appState.isLeftNav = true;
                console.log('📍 Left navigation mode: Universal access with search');
            }
        }
        
        // Check for entity context regardless of location
        if (context && context.context && context.context.entity) {
            appState.contextEntity = context.context.entity;
            console.log(`📍 Entity context: ${context.context.entity.type} - ${context.context.entity.name}`);
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
    CopperIntegration.saveQuoteToCRM();
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

console.log('✅ Enhanced Copper integration module loaded successfully');
