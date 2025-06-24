// Enhanced Copper CRM integration with Hybrid Mode
// Supports both context-aware auto-population AND left nav functionality

const CopperIntegration = {
    // Initialize Copper SDK and detect environment
    initialize: function() {
        console.log('🔗 Initializing Copper CRM integration...');
        
        try {
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
                
                // Auto-populate if context available
                if (data.context && data.context.entity) {
                    console.log('🎯 Context entity detected - enabling auto-population');
                    this.autoPopulateFromEntity(data.context.entity);
                    appState.hasEntityContext = true;
                } else {
                    console.log('🔍 No entity context - enabling customer search');
                    this.enableCustomerSearch();
                    appState.hasEntityContext = false;
                }
                
                // Set up hybrid UI
                this.setupHybridUI();
                
                // Trigger UI update
                if (typeof UIManager !== 'undefined') {
                    UIManager.onContextReceived(data);
                }
            })
            .catch((error) => {
                console.error('❌ Error getting Copper context:', error);
                // Fallback to search mode
                this.enableCustomerSearch();
                appState.hasEntityContext = false;
            });
    },

    // Detect what kind of integration mode we're in
    detectIntegrationMode: function(context) {
        appState.integrationMode = 'left_nav'; // Default
        
        if (context && context.location) {
            if (context.location.includes('person') || context.location.includes('company')) {
                appState.integrationMode = 'context_aware';
                console.log('📍 Context-aware mode: On contact/company page');
            } else if (context.location.includes('left_nav')) {
                appState.integrationMode = 'left_nav';
                console.log('📍 Left navigation mode: Universal access');
            }
        }
        
        // Check for entity context regardless of location
        if (context && context.context && context.context.entity) {
            appState.integrationMode = 'context_aware';
            appState.contextEntity = context.context.entity;
            console.log(`📍 Entity context: ${context.context.entity.type} - ${context.context.entity.name}`);
        }
    },

    // Auto-populate fields from Copper entity context
    autoPopulateFromEntity: function(entity) {
        console.log('🔄 Auto-populating from entity:', entity);
        
        try {
            // Customer name (works for both contacts and companies)
            if (entity.name && !document.getElementById('prospectName')?.value) {
                document.getElementById('prospectName').value = entity.name;
                console.log('📝 Auto-filled prospect name:', entity.name);
            }
            
            // Company name
            const companyName = entity.company_name || (entity.type === 'company' ? entity.name : '');
            if (companyName && !document.getElementById('companyName')?.value) {
                document.getElementById('companyName').value = companyName;
                console.log('📝 Auto-filled company name:', companyName);
            }
            
            // Email address
            if (entity.emails && entity.emails.length > 0 && !document.getElementById('prospectEmail')?.value) {
                const email = entity.emails[0].email;
                const emailInput = document.getElementById('prospectEmail');
                if (emailInput) {
                    emailInput.value = email;
                    console.log('📝 Auto-filled email:', email);
                }
            }
            
            // Phone number
            if (entity.phone_numbers && entity.phone_numbers.length > 0 && !document.getElementById('prospectPhone')?.value) {
                const phone = entity.phone_numbers[0].number;
                const phoneInput = document.getElementById('prospectPhone');
                if (phoneInput) {
                    phoneInput.value = phone;
                    console.log('📝 Auto-filled phone:', phone);
                }
            }
            
            // Address information
            if (entity.address && !document.getElementById('prospectAddress')?.value) {
                const address = `${entity.address.street || ''}, ${entity.address.city || ''}, ${entity.address.state || ''}`.trim();
                const addressInput = document.getElementById('prospectAddress');
                if (addressInput && address !== ', ,') {
                    addressInput.value = address;
                    console.log('📝 Auto-filled address:', address);
                }
            }
            
            // Smart customer base detection
            this.detectCustomerBase(entity);
            
            // Show context indicator
            this.showContextIndicator(entity);
            
        } catch (error) {
            console.error('❌ Error auto-populating from entity:', error);
        }
    },

    // Smart detection of customer base type
    detectCustomerBase: function(entity) {
        const customerBaseInput = document.getElementById('customerBase');
        if (!customerBaseInput || customerBaseInput.value) return;
        
        const companyName = (entity.company_name || entity.name || '').toLowerCase();
        const tags = entity.tags || [];
        
        // Smart detection based on company name and tags
        let customerBase = '';
        
        if (companyName.includes('smoke') || companyName.includes('vape') || 
            tags.some(tag => tag.includes('smoke') || tag.includes('vape'))) {
            customerBase = 'smoke and vape shops';
        } else if (companyName.includes('convenience') || companyName.includes('c-store') ||
                  tags.some(tag => tag.includes('convenience'))) {
            customerBase = 'convenience stores';
        } else if (companyName.includes('distribution') || companyName.includes('wholesale') ||
                  tags.some(tag => tag.includes('wholesale'))) {
            customerBase = 'wholesale distribution';
        } else if (companyName.includes('dispensary') || companyName.includes('cannabis') ||
                  tags.some(tag => tag.includes('dispensary'))) {
            customerBase = 'cannabis dispensaries';
        } else {
            customerBase = 'retail customers';
        }
        
        customerBaseInput.value = customerBase;
        console.log('📝 Auto-detected customer base:', customerBase);
    },

    // Show visual indicator that context was auto-populated
    showContextIndicator: function(entity) {
        const indicator = document.createElement('div');
        indicator.className = 'context-indicator';
        indicator.innerHTML = `
            <div class="context-banner">
                🎯 Auto-populated from ${entity.type}: <strong>${entity.name}</strong>
                <button onclick="this.clearAutoPopulation()" class="clear-context-btn">Clear & Manual Entry</button>
            </div>
        `;
        
        // Add to top of calculator
        const calculator = document.getElementById('mainCalculator');
        if (calculator) {
            calculator.insertBefore(indicator, calculator.firstChild);
        }
    },

    // Enable customer search functionality for left nav mode
    enableCustomerSearch: function() {
        console.log('🔍 Enabling customer search functionality');
        
        // Add search interface after a brief delay to ensure DOM is ready
        setTimeout(() => {
            this.addCustomerSearchInterface();
        }, 500);
    },

    // Add customer search interface to the form
    addCustomerSearchInterface: function() {
        const customerSection = document.querySelector('.customer-info');
        if (!customerSection) return;
        
        const searchHTML = `
            <div class="customer-search" id="customerSearch">
                <h4>🔍 Quick Customer Lookup</h4>
                <div class="search-controls">
                    <input type="text" id="customerSearchInput" placeholder="Search contacts & companies..." />
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
        
        console.log('✅ Customer search interface added');
    },

    // Search for customers in Copper
    searchCustomers: function(query) {
        if (!appState.sdk) {
            console.log('📝 Simulating customer search (no CRM available)');
            this.showDemoSearchResults(query);
            return;
        }
        
        const searchQuery = query || document.getElementById('customerSearchInput')?.value;
        if (!searchQuery) return;
        
        console.log(`🔍 Searching for customers: "${searchQuery}"`);
        
        // Search both people and companies
        Promise.all([
            this.searchEntities('person', searchQuery),
            this.searchEntities('company', searchQuery)
        ]).then(([people, companies]) => {
            const allResults = [...people, ...companies];
            this.displaySearchResults(allResults);
        }).catch(error => {
            console.error('❌ Error searching customers:', error);
            this.showSearchError();
        });
    },

    // Search specific entity type
    searchEntities: function(entityType, query) {
        return new Promise((resolve, reject) => {
            try {
                appState.sdk.searchEntities(entityType, {
                    name: query
                }).then(results => {
                    resolve(results || []);
                }).catch(error => {
                    console.warn(`⚠️ Error searching ${entityType}:`, error);
                    resolve([]); // Return empty array on error
                });
            } catch (error) {
                console.warn(`⚠️ Search not available for ${entityType}:`, error);
                resolve([]); // Return empty array if search not available
            }
        });
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
        
        const resultsHTML = results.map(customer => `
            <div class="search-result" onclick="CopperIntegration.selectCustomer(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
                <div class="customer-name">${customer.name}</div>
                <div class="customer-type">${customer.type} ${customer.company_name ? `at ${customer.company_name}` : ''}</div>
                <div class="customer-email">${customer.emails?.[0]?.email || 'No email'}</div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.style.display = 'block';
        
        console.log(`✅ Displayed ${results.length} search results`);
    },

    // Demo search results for standalone mode
    showDemoSearchResults: function(query) {
        const demoResults = [
            {
                name: "Eddie Johnson",
                type: "person",
                company_name: "ABC Distribution",
                emails: [{ email: "eddie@abcdistribution.com" }],
                phone_numbers: [{ number: "(555) 123-4567" }]
            },
            {
                name: "Sarah Miller",
                type: "person", 
                company_name: "Green Leaf Smoke Shop",
                emails: [{ email: "sarah@greenleaf.com" }],
                phone_numbers: [{ number: "(555) 987-6543" }]
            },
            {
                name: "ABC Distribution",
                type: "company",
                emails: [{ email: "orders@abcdistribution.com" }],
                phone_numbers: [{ number: "(555) 111-2222" }]
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
        ['prospectName', 'companyName', 'customerBase', 'prospectEmail', 'prospectPhone', 'prospectAddress'].forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
        
        // Remove context indicator
        const indicator = document.querySelector('.context-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // Show manual entry message
        this.showMessage('Switched to manual entry mode', 'info');
        
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

    // Setup hybrid UI based on context
    setupHybridUI: function() {
        console.log(`🎨 Setting up hybrid UI for ${appState.integrationMode} mode`);
        
        if (appState.integrationMode === 'context_aware') {
            // Context-aware mode: emphasis on the current record
            this.setupContextAwareUI();
        } else {
            // Left nav mode: emphasis on search and universal access
            this.setupLeftNavUI();
        }
    },

    // Setup UI for context-aware mode
    setupContextAwareUI: function() {
        // Hide search interface if auto-populated
        const searchSection = document.getElementById('customerSearch');
        if (searchSection && appState.hasEntityContext) {
            searchSection.style.display = 'none';
        }
        
        // Add context-specific buttons
        this.addContextActions();
    },

    // Setup UI for left navigation mode
    setupLeftNavUI: function() {
        // Ensure search interface is visible
        const searchSection = document.getElementById('customerSearch');
        if (searchSection) {
            searchSection.style.display = 'block';
        }
        
        // Add universal actions
        this.addUniversalActions();
    },

    // Add context-specific action buttons
    addContextActions: function() {
        const actionsSection = document.querySelector('.actions');
        if (!actionsSection) return;
        
        const contextActionsHTML = `
            <div class="context-actions">
                <button class="copy-btn context-btn" onclick="CopperIntegration.saveQuoteToCurrentRecord()">
                    💾 Save Quote to This Record
                </button>
                <button class="copy-btn context-btn" onclick="CopperIntegration.createOpportunityForRecord()">
                    🎯 Create Opportunity for This Contact
                </button>
            </div>
        `;
        
        actionsSection.insertAdjacentHTML('beforeend', contextActionsHTML);
    },

    // Add universal action buttons
    addUniversalActions: function() {
        // Universal actions are already in the main interface
        console.log('✅ Universal actions available');
    },

    // Save quote to current record (context-aware)
    saveQuoteToCurrentRecord: function() {
        const calc = Calculator.calculateOrder();
        if (!calc.product) {
            alert('Please calculate a quote first');
            return;
        }
        
        if (appState.contextEntity) {
            console.log(`💾 Saving quote to ${appState.contextEntity.type}: ${appState.contextEntity.name}`);
            
            const activityData = {
                entity_id: appState.contextEntity.id,
                entity_type: appState.contextEntity.type,
                details: this.formatQuoteActivityWithContext(calc, appState.contextEntity)
            };
            
            if (appState.sdk && appState.sdk.logActivity) {
                appState.sdk.logActivity(0, activityData.details, activityData.entity_id);
                this.showSuccessMessage(`Quote saved to ${appState.contextEntity.name}!`);
            } else {
                console.log('📝 Simulated save to current record');
                alert(`Quote would be saved to ${appState.contextEntity.name}`);
            }
        } else {
            // Fallback to regular save
            this.saveQuoteToCRM();
        }
    },

    // Create opportunity for current record
    createOpportunityForRecord: function() {
        const calc = Calculator.calculateOrder();
        if (!calc.product) {
            alert('Please calculate a quote first');
            return;
        }
        
        if (appState.contextEntity) {
            const opportunityData = this.formatOpportunityDataWithContext(calc, appState.contextEntity);
            
            if (appState.sdk && appState.sdk.createEntity) {
                appState.sdk.createEntity('opportunity', opportunityData);
                this.showSuccessMessage(`Opportunity created for ${appState.contextEntity.name}!`);
            } else {
                console.log('📝 Simulated opportunity creation for current record');
                alert(`Opportunity would be created for ${appState.contextEntity.name}`);
            }
        } else {
            // Fallback to regular opportunity creation
            this.createOpportunity();
        }
    },

    // Format quote activity with context
    formatQuoteActivityWithContext: function(calc, entity) {
        const timestamp = new Date().toLocaleString();
        const userEmail = appState.currentUser?.email || 'Unknown User';
        
        return `KANVA QUOTE GENERATED FOR ${entity.name.toUpperCase()}

Contact: ${entity.name}
${entity.company_name ? `Company: ${entity.company_name}` : ''}
${entity.emails?.[0]?.email ? `Email: ${entity.emails[0].email}` : ''}

Product: ${calc.product.name}
Quantity: ${calc.masterCases} Master Cases (${calc.displayBoxes} Display Boxes)
Individual Units: ${Calculator.formatNumber(calc.totalUnits)}

Pricing:
• Unit Price: ${calc.unitPrice} (${calc.tierInfo.name})
• Case Price: ${calc.casePrice}
• Subtotal: ${calc.subtotal}
• Shipping: ${calc.freeShipping ? 'FREE' : calc.shipping}
• Total: ${calc.total}

Generated by: ${userEmail}
Generated on: ${timestamp}
Calculator Version: ${adminConfig.metadata.version}
Context: ${appState.integrationMode}`;
    },

    // Format opportunity data with context
    formatOpportunityDataWithContext: function(calc, entity) {
        const opportunityName = `${calc.product.name} - ${calc.masterCases} MC - ${entity.name}`;
        const monetaryValue = Math.round(calc.raw.total * 100);
        
        return {
            name: opportunityName,
            monetary_value: monetaryValue,
            primary_contact_id: entity.type === 'person' ? entity.id : null,
            company_id: entity.type === 'company' ? entity.id : entity.company_id,
            details: `Quote for ${entity.name}: ${calc.masterCases} Master Cases of ${calc.product.name}\nTotal Value: ${calc.total}\nTier: ${calc.tierInfo.name}`,
            status: 'Open',
            close_date: this.getCloseDate(),
            priority: 'Normal'
        };
    },

    // Setup standalone mode for testing
    setupStandaloneMode: function() {
        appState.isCopperActive = false;
        appState.isAdmin = true;
        appState.integrationMode = 'standalone';
        
        AuthManager.setUser({
            email: 'demo@kanvabotanicals.com',
            name: 'Demo User'
        });
        
        console.log('🔧 Running in standalone demo mode with customer search');
        
        // Enable customer search even in standalone mode
        setTimeout(() => {
            this.enableCustomerSearch();
        }, 1000);
    },

    // Show user message
    showMessage: function(message, type = 'info') {
        if (typeof AdminPanel !== 'undefined' && AdminPanel.showSuccess) {
            if (type === 'error') {
                AdminPanel.showError(message);
            } else {
                AdminPanel.showSuccess(message);
            }
        } else {
            console.log(`📢 ${type.toUpperCase()}: ${message}`);
        }
    },

    // All the existing methods from the original file...
    configureSdk: function() {
        if (!appState.sdk) return;

        try {
            if (appState.isModalMode) {
                appState.sdk.setAppUI({
                    width: 1200,
                    height: 800,
                    showActionBar: false,
                    disableAddButton: true
                });
                console.log('📐 Configured SDK for modal mode (1200x800)');
            }
        } catch (error) {
            console.error('❌ Error configuring SDK:', error);
        }
    },

    detectLocationMode: function(context) {
        const isLeftNav = context && (
            context.location === 'left_nav' || 
            window.innerWidth > 800 ||
            window.location.search.includes('nav=left')
        );
        
        if (isLeftNav) {
            appState.isLeftNav = true;
            appState.appLocation = 'left_nav';
            document.body.className = 'left-nav-mode';
            console.log('📍 Detected left navigation mode');
        }
    },

    openModal: function() {
        if (appState.sdk && appState.sdk.showModal) {
            try {
                appState.sdk.showModal();
                console.log('🔄 Opened Copper native modal');
            } catch (error) {
                console.error('❌ Error opening Copper modal:', error);
                alert('Failed to open modal. Please try again.');
            }
        } else {
            console.warn('⚠️  Copper SDK not available - modal cannot be opened');
            alert('Copper SDK not available. This feature requires running within Copper CRM.');
        }
    },

    saveQuoteToCRM: function() {
        const calc = Calculator.calculateOrder();
        if (!calc.product) {
            alert('Please calculate a quote first');
            return;
        }

        if (appState.sdk && appState.sdk.logActivity) {
            try {
                const details = this.formatQuoteActivity(calc);
                appState.sdk.logActivity(0, details);
                console.log('💾 Quote saved to CRM activity log');
                this.showSuccessMessage('Quote saved to CRM activity log!');
                this.refreshCopperUI();
            } catch (error) {
                console.error('❌ Error saving quote to CRM:', error);
                alert('Failed to save quote to CRM: ' + error.message);
            }
        } else {
            console.log('📝 Simulating CRM save (SDK not available)');
            const message = `Quote would be saved to CRM!\n\nProduct: ${calc.product.name}\nCases: ${calc.masterCases}\nTotal: ${calc.total}`;
            alert(message);
        }
    },

    createOpportunity: function() {
        const calc = Calculator.calculateOrder();
        if (!calc.product) {
            alert('Please calculate a quote first');
            return;
        }

        if (appState.sdk && appState.sdk.createEntity) {
            try {
                const opportunityData = this.formatOpportunityData(calc);
                appState.sdk.createEntity('opportunity', opportunityData);
                console.log('🎯 Opportunity created in Copper');
                this.showSuccessMessage('Opportunity created in Copper CRM!');
                this.refreshCopperUI();
            } catch (error) {
                console.error('❌ Error creating opportunity:', error);
                alert('Failed to create opportunity: ' + error.message);
            }
        } else {
            console.log('💼 Simulating opportunity creation (SDK not available)');
            const message = `Opportunity would be created!\n\nValue: ${calc.total}\nProduct: ${calc.product.name}\nStatus: Quote Sent`;
            alert(message);
        }
    },

    formatQuoteActivity: function(calc) {
        const timestamp = new Date().toLocaleString();
        const userEmail = appState.currentUser?.email || 'Unknown User';
        
        return `KANVA QUOTE GENERATED

Product: ${calc.product.name}
Quantity: ${calc.masterCases} Master Cases (${calc.displayBoxes} Display Boxes)
Individual Units: ${Calculator.formatNumber(calc.totalUnits)}

Pricing:
• Unit Price: ${calc.unitPrice} (${calc.tierInfo.name})
• Case Price: ${calc.casePrice}
• Subtotal: ${calc.subtotal}
• Shipping: ${calc.freeShipping ? 'FREE' : calc.shipping}
• Total: ${calc.total}

Generated by: ${userEmail}
Generated on: ${timestamp}
Calculator Version: ${adminConfig.metadata.version}`;
    },

    formatOpportunityData: function(calc) {
        const opportunityName = `${calc.product.name} - ${calc.masterCases} MC Quote`;
        const monetaryValue = Math.round(calc.raw.total * 100);
        
        return {
            name: opportunityName,
            monetary_value: monetaryValue,
            details: `Quote: ${calc.masterCases} Master Cases of ${calc.product.name}\nTotal Value: ${calc.total}\nTier: ${calc.tierInfo.name}`,
            status: 'Open',
            close_date: this.getCloseDate(),
            priority: 'Normal',
            custom_fields: [
                {
                    custom_field_definition_id: 'quote_tool_generated',
                    value: true
                }
            ]
        };
    },

    getCloseDate: function() {
        const closeDate = new Date();
        closeDate.setDate(closeDate.getDate() + 30);
        return Math.floor(closeDate.getTime() / 1000);
    },

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

    navigateToEntity: function(entityType, entityId) {
        if (appState.sdk && appState.sdk.navigateTo) {
            try {
                appState.sdk.navigateTo(entityType, entityId);
                console.log(`🧭 Navigated to ${entityType} ${entityId}`);
            } catch (error) {
                console.error('❌ Error navigating to entity:', error);
            }
        }
    },

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

    isCrmAvailable: function() {
        return appState.sdk !== null;
    },

    showSuccessMessage: function(message) {
        if (typeof AdminPanel !== 'undefined' && AdminPanel.showSuccess) {
            AdminPanel.showSuccess(message);
        } else {
            alert(message);
        }
    },

    populateCustomerInfo: function() {
        if (!appState.copperContext) return;

        try {
            const context = appState.copperContext.context;
            if (!context) return;

            if (context.name && !document.getElementById('prospectName')?.value) {
                const nameInput = document.getElementById('prospectName');
                if (nameInput) nameInput.value = context.name;
            }

            if (context.company_name && !document.getElementById('companyName')?.value) {
                const companyInput = document.getElementById('companyName');
                if (companyInput) companyInput.value = context.company_name;
            }

            if (context.email && !document.getElementById('prospectEmail')?.value) {
                const emailInput = document.getElementById('prospectEmail');
                if (emailInput) emailInput.value = context.email;
            }

            console.log('📝 Customer information auto-populated from Copper context');
        } catch (error) {
            console.error('⚠️  Error auto-populating customer info:', error);
        }
    },

    checkEnvironment: function() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('location') === 'modal') {
            appState.isModalMode = true;
            appState.appLocation = 'modal';
            document.body.className = 'modal-mode';
            console.log('📍 Modal mode detected from URL parameters');
        }

        if (!this.isCrmAvailable()) {
            appState.isAdmin = true;
            appState.isLeftNav = true;
            appState.appLocation = 'standalone';
            document.body.className = 'left-nav-mode';
            console.log('🔧 Running in standalone demo mode');
        }
    }
};

// Global functions for HTML onclick handlers
function openCopperModal() {
    CopperIntegration.openModal();
}

function saveQuoteToCRM() {
    CopperIntegration.saveQuoteToCRM();
}

function createOpportunity() {
    CopperIntegration.createOpportunity();
}

// Additional global functions for hybrid features
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
