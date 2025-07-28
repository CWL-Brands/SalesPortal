# Kanva Botanicals - Advanced Copper CRM Integration Guide

## 🎯 Overview

This document outlines advanced Copper SDK features for bilateral communication between the Kanva Quote Calculator and Copper CRM, plus integration with ShipStation and Fishbowl ERP. This creates a complete business intelligence platform that connects all of Kanva's systems.

## 📋 Table of Contents

- [Current Implementation Status](#current-implementation-status)
- [Advanced Features to Implement](#advanced-features-to-implement)
- [Code Implementation Guide](#code-implementation-guide)
- [Bilateral Integration Flow](#bilateral-integration-flow)
- [Field Mapping System](#field-mapping-system)
- [Implementation Priority](#implementation-priority)
- [Testing and Validation](#testing-and-validation)

## 🔄 Current Implementation Status

### ✅ Already Implemented
- Basic Copper SDK initialization
- Customer context detection
- Quote saving as CRM activities
- Basic opportunity creation
- Customer search functionality
- Modal and Activity Panel modes

### 🚧 Ready to Implement
- Real-time data synchronization
- Advanced entity management
- Smart search with filters
- UI control and navigation
- Bilateral API integration
- Advanced email features
- Analytics and reporting
- Field mapping system

## 🚀 Advanced Features to Implement

### 1. Real-Time Data Sync & Listening

**Why Implement**: Keeps your app synchronized with CRM changes in real-time, preventing data conflicts and improving user experience.

**How It Works**: Uses Copper SDK event listeners to detect changes and automatically update the quote calculator.

```javascript
// File: js/advanced-copper-sync.js
const AdvancedCopperSync = {
    
    // Initialize real-time synchronization
    initialize: function() {
        if (!appState.sdk) return false;
        
        console.log('🔄 Initializing real-time Copper sync...');
        
        // Listen for context changes (user switches between customers)
        appState.sdk.onContextChange((newContext) => {
            console.log('🔄 Customer switched in CRM');
            this.handleCustomerSwitch(newContext);
        });
        
        // Listen for entity updates (customer data changes)
        appState.sdk.onEntityUpdate((entityData) => {
            console.log('📝 Customer data updated in CRM');
            this.refreshCustomerData(entityData);
        });
        
        // Listen for navigation changes
        appState.sdk.onNavigate((navData) => {
            console.log('🧭 User navigated in CRM');
            this.handleNavigation(navData);
        });
        
        return true;
    },
    
    // Handle customer switching with external API sync
    handleCustomerSwitch: function(newContext) {
        // Auto-clear current quote
        if (typeof Calculator !== 'undefined') {
            Calculator.clearOrder();
        }
        
        // Auto-populate new customer data
        if (typeof CopperIntegration !== 'undefined') {
            CopperIntegration.populateCustomerData(newContext);
        }
        
        // Show notification
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showInfo(`Switched to ${newContext.entity?.name || 'new customer'}`);
        }
        
        // Pull latest Fishbowl inventory for this customer
        this.syncCustomerInventory(newContext.entity?.id);
        
        // Update ShipStation customer preferences
        this.syncShipStationProfile(newContext.entity);
    },
    
    // Sync customer inventory from Fishbowl
    syncCustomerInventory: async function(customerId) {
        try {
            if (!customerId) return;
            
            // Get customer's purchase history to determine preferred products
            const history = await this.getCustomerHistory(customerId);
            const preferredProducts = this.extractPreferredProducts(history);
            
            // Check Fishbowl inventory for preferred products
            const inventoryData = await FishbowlAPI.checkInventory(preferredProducts);
            
            // Update calculator with live inventory
            if (typeof Calculator !== 'undefined') {
                Calculator.updateInventoryData(inventoryData);
            }
            
            console.log('✅ Synced customer inventory from Fishbowl');
            
        } catch (error) {
            console.error('❌ Failed to sync customer inventory:', error);
        }
    },
    
    // Refresh customer data when CRM is updated
    refreshCustomerData: function(entityData) {
        if (entityData.type === 'company' || entityData.type === 'person') {
            // Update customer form fields
            this.updateCustomerForm(entityData.data);
            
            // Recalculate quote if customer address changed (affects shipping)
            if (this.hasAddressChanged(entityData.data)) {
                this.recalculateShipping();
            }
        }
    },
    
    // Check if address changed (affects shipping calculations)
    hasAddressChanged: function(customerData) {
        const currentAddress = appState.currentCustomer?.address;
        const newAddress = customerData.address;
        
        return JSON.stringify(currentAddress) !== JSON.stringify(newAddress);
    },
    
    // Recalculate shipping when address changes
    recalculateShipping: async function() {
        const currentQuote = Calculator.getCurrentQuote();
        if (currentQuote && currentQuote.products.length > 0) {
            const newShipping = await ShipStationAPI.calculateShipping(
                appState.currentCustomer.address,
                currentQuote.products
            );
            
            Calculator.updateShipping(newShipping);
            NotificationManager.showInfo('Shipping recalculated due to address change');
        }
    }
};
```

### 2. Advanced Entity Management

**Why Implement**: Creates comprehensive customer profiles with Kanva-specific data and automates follow-up workflows.

**How It Works**: Extends Copper records with custom fields and creates related entities automatically.

```javascript
// File: js/entity-manager.js
const EntityManager = {
    
    // Add Kanva-specific custom fields to customer records
    addKanvaFields: async function(customerId, customerType = 'company') {
        try {
            const kanvaFields = {
                // Kanva-specific tracking fields
                'kanva_preferred_products': JSON.stringify(['focus', 'release']),
                'kanva_volume_tier': 'tier1', // tier1, tier2, tier3
                'kanva_payment_terms': 'Net 30',
                'kanva_last_order_date': new Date().toISOString(),
                'kanva_lifetime_value': 0.00,
                'kanva_customer_since': new Date().toISOString(),
                'kanva_sales_rep': appState.currentUser?.id || '',
                'kanva_shipping_preferences': JSON.stringify({
                    preferred_carrier: 'FedEx',
                    delivery_instructions: '',
                    signature_required: false
                }),
                'kanva_inventory_alerts': true, // Send low inventory alerts
                'kanva_quote_frequency': 0, // Number of quotes generated
                'kanva_conversion_rate': 0.0 // Quote to order conversion rate
            };
            
            await appState.sdk.updateEntity(customerType, customerId, {
                custom_fields: kanvaFields
            });
            
            console.log('✅ Added Kanva tracking fields to customer');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to add custom fields:', error);
            return false;
        }
    },
    
    // Create comprehensive follow-up workflow
    createFollowUpWorkflow: async function(quoteData) {
        const tasks = [
            {
                name: 'Follow up on Kanva quote',
                due_date: this.addDays(new Date(), 3), // 3 days from now
                assignee_id: appState.currentUser?.id,
                details: `Follow up on quote ${quoteData.quoteNumber} for ${quoteData.totalCases} cases - $${quoteData.totalWithTax}`,
                priority: 'Normal',
                status: 'Open'
            },
            {
                name: 'Check inventory availability',
                due_date: this.addDays(new Date(), 1), // 1 day from now
                assignee_id: appState.currentUser?.id,
                details: `Verify Fishbowl inventory levels for: ${quoteData.products.map(p => p.name).join(', ')}`,
                priority: 'High',
                status: 'Open'
            },
            {
                name: 'Send product samples if needed',
                due_date: this.addDays(new Date(), 7), // 1 week from now
                assignee_id: appState.currentUser?.id,
                details: 'Consider sending product samples for large quotes or new customers',
                priority: 'Low',
                status: 'Open'
            }
        ];
        
        const createdTasks = [];
        for (const task of tasks) {
            try {
                const created = await appState.sdk.createEntity('task', task);
                createdTasks.push(created);
            } catch (error) {
                console.error('❌ Failed to create task:', error);
            }
        }
        
        console.log(`✅ Created ${createdTasks.length} follow-up tasks`);
        return createdTasks;
    },
    
    // Link quotes to opportunities with comprehensive data
    linkToOpportunity: async function(quoteData, customerId) {
        try {
            const opportunityData = {
                name: `Kanva Quote ${quoteData.quoteNumber} - ${quoteData.customerName}`,
                assignee_id: appState.currentUser?.id,
                close_date: this.addDays(new Date(), 30), // 30 days to close
                company_id: customerId,
                monetary_value: Math.round(quoteData.totalWithTax * 100), // Copper uses cents
                priority: this.calculatePriority(quoteData.totalWithTax),
                status: 'Open',
                details: this.formatOpportunityDetails(quoteData),
                custom_fields: {
                    'kanva_quote_id': quoteData.quoteNumber,
                    'kanva_products': JSON.stringify(quoteData.products),
                    'quote_generated_date': new Date().toISOString(),
                    'kanva_volume_tier': quoteData.volumeTier,
                    'kanva_total_cases': quoteData.totalCases,
                    'kanva_estimated_shipping': quoteData.shipping?.cost || 0
                }
            };
            
            const opportunity = await appState.sdk.createEntity('opportunity', opportunityData);
            console.log('✅ Created opportunity linked to quote');
            
            return opportunity;
            
        } catch (error) {
            console.error('❌ Failed to create opportunity:', error);
            throw error;
        }
    },
    
    // Calculate opportunity priority based on value
    calculatePriority: function(value) {
        if (value >= 10000) return 'High';
        if (value >= 5000) return 'Medium';
        return 'Low';
    },
    
    // Format opportunity details
    formatOpportunityDetails: function(quoteData) {
        return `
Kanva Botanicals Quote Details:

Quote Number: ${quoteData.quoteNumber}
Generated: ${new Date(quoteData.generatedDate).toLocaleDateString()}
Total Cases: ${quoteData.totalCases}
Volume Tier: ${quoteData.volumeTier}
Discount Applied: ${quoteData.discountPercent}%

Products:
${quoteData.products.map(p => `- ${p.name}: ${p.quantity} cases @ $${p.price}/case`).join('\n')}

Subtotal: $${quoteData.subtotal}
Tax: $${quoteData.tax}
Shipping: $${quoteData.shipping?.cost || 'TBD'}
Total: $${quoteData.totalWithTax}

Next Steps:
1. Follow up within 3 business days
2. Verify inventory availability
3. Prepare shipping quote if not included
        `.trim();
    },
    
    // Utility function to add days to date
    addDays: function(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return Math.floor(result.getTime() / 1000); // Copper uses Unix timestamps
    }
};
```

### 3. Smart Search & Customer Intelligence

**Why Implement**: Provides sales reps with comprehensive customer insights and predictive recommendations.

**How It Works**: Combines Copper data with external systems to create intelligent customer profiles.

```javascript
// File: js/smart-search.js
const SmartSearch = {
    
    // Advanced customer search with multiple filters
    searchCustomersAdvanced: async function(query, filters = {}) {
        try {
            const searchPromises = [];
            
            // Build search parameters
            const baseParams = {
                page_size: filters.limit || 20,
                search: {},
                sort: filters.sort || { name: 'asc' }
            };
            
            // Add search terms
            if (query) {
                baseParams.search.name = query;
                baseParams.search.email = query;
            }
            
            // Add filters
            if (filters.state) baseParams.filters = { state: filters.state };
            if (filters.tags) baseParams.filters = { ...baseParams.filters, tags: filters.tags };
            if (filters.customFields) baseParams.filters = { ...baseParams.filters, custom_fields: filters.customFields };
            
            // Search companies
            if (!filters.contactsOnly) {
                searchPromises.push(
                    appState.sdk.api.companies.search(baseParams)
                        .then(results => ({
                            type: 'companies',
                            data: results.data || results || []
                        }))
                        .catch(error => {
                            console.warn('Company search failed:', error);
                            return { type: 'companies', data: [] };
                        })
                );
            }
            
            // Search contacts
            if (!filters.companiesOnly) {
                searchPromises.push(
                    appState.sdk.api.people.search(baseParams)
                        .then(results => ({
                            type: 'people',
                            data: results.data || results || []
                        }))
                        .catch(error => {
                            console.warn('Contact search failed:', error);
                            return { type: 'people', data: [] };
                        })
                );
            }
            
            const results = await Promise.all(searchPromises);
            return this.combineAndEnrichResults(results);
            
        } catch (error) {
            console.error('❌ Advanced search failed:', error);
            return [];
        }
    },
    
    // Combine search results and add intelligence
    combineAndEnrichResults: async function(results) {
        const combined = [];
        
        for (const resultSet of results) {
            for (const record of resultSet.data) {
                // Add intelligence to each record
                const enriched = {
                    ...record,
                    type: resultSet.type.slice(0, -1), // 'companies' -> 'company'
                    display_name: record.name,
                    intelligence: await this.getCustomerIntelligence(record.id, resultSet.type.slice(0, -1))
                };
                
                combined.push(enriched);
            }
        }
        
        // Sort by intelligence score
        return combined.sort((a, b) => (b.intelligence?.score || 0) - (a.intelligence?.score || 0));
    },
    
    // Get comprehensive customer intelligence
    getCustomerIntelligence: async function(customerId, customerType) {
        try {
            // Get customer history from Copper
            const history = await this.getCustomerHistory(customerId, customerType);
            
            // Get external data
            const external = await Promise.allSettled([
                this.getFishbowlData(customerId),
                this.getShipStationData(customerId)
            ]);
            
            const fishbowlData = external[0].status === 'fulfilled' ? external[0].value : null;
            const shipStationData = external[1].status === 'fulfilled' ? external[1].value : null;
            
            // Calculate intelligence score
            const score = this.calculateIntelligenceScore(history, fishbowlData, shipStationData);
            
            return {
                score: score,
                totalOrders: history.totalOrders,
                lastOrderDate: history.lastOrderDate,
                totalValue: history.totalValue,
                quotesGenerated: history.quotesGenerated,
                conversionRate: history.conversionRate,
                preferredProducts: history.preferredProducts,
                paymentTrends: history.paymentTrends,
                seasonality: history.seasonality,
                riskFactors: this.identifyRiskFactors(history, fishbowlData, shipStationData),
                opportunities: this.identifyOpportunities(history, fishbowlData, shipStationData),
                recommendations: this.generateRecommendations(history, fishbowlData, shipStationData)
            };
            
        } catch (error) {
            console.error('❌ Failed to get customer intelligence:', error);
            return { score: 0 };
        }
    },
    
    // Get comprehensive customer history from Copper
    getCustomerHistory: async function(customerId, customerType) {
        try {
            const promises = [
                // Get opportunities
                appState.sdk.api.opportunities.search({
                    filters: customerType === 'company' 
                        ? { company_id: customerId }
                        : { person_id: customerId },
                    sort: { created_date: 'desc' }
                }),
                
                // Get activities (including quotes)
                appState.sdk.api.activities.search({
                    filters: customerType === 'company'
                        ? { company_id: customerId }
                        : { person_id: customerId },
                    sort: { created_date: 'desc' }
                })
            ];
            
            const [opportunities, activities] = await Promise.allSettled(promises);
            
            const opps = opportunities.status === 'fulfilled' ? (opportunities.value.data || opportunities.value || []) : [];
            const acts = activities.status === 'fulfilled' ? (activities.value.data || activities.value || []) : [];
            
            // Analyze the data
            const quotes = acts.filter(a => a.type === 'quote' || a.subject?.includes('Quote'));
            const wonOpps = opps.filter(o => o.status === 'Won');
            
            return {
                totalOrders: wonOpps.length,
                lastOrderDate: wonOpps[0]?.created_date,
                totalValue: wonOpps.reduce((sum, opp) => sum + (opp.monetary_value || 0), 0) / 100, // Convert from cents
                quotesGenerated: quotes.length,
                conversionRate: quotes.length > 0 ? (wonOpps.length / quotes.length) * 100 : 0,
                preferredProducts: this.analyzeProductPreferences(quotes),
                paymentTrends: this.analyzePaymentTrends(wonOpps),
                seasonality: this.analyzeSeasonality(opps),
                averageOrderValue: wonOpps.length > 0 ? (wonOpps.reduce((sum, opp) => sum + (opp.monetary_value || 0), 0) / 100) / wonOpps.length : 0
            };
            
        } catch (error) {
            console.error('❌ Failed to get customer history:', error);
            return {
                totalOrders: 0,
                quotesGenerated: 0,
                conversionRate: 0,
                totalValue: 0,
                preferredProducts: [],
                paymentTrends: {},
                seasonality: {}
            };
        }
    },
    
    // Calculate intelligence score (0-100)
    calculateIntelligenceScore: function(history, fishbowlData, shipStationData) {
        let score = 0;
        
        // Order history weight (40 points)
        if (history.totalOrders > 0) {
            score += Math.min(40, history.totalOrders * 5); // 5 points per order, max 40
        }
        
        // Total value weight (30 points)
        if (history.totalValue > 0) {
            score += Math.min(30, (history.totalValue / 1000) * 3); // 3 points per $1k, max 30
        }
        
        // Conversion rate weight (20 points)
        if (history.conversionRate > 0) {
            score += (history.conversionRate / 100) * 20; // Up to 20 points for 100% conversion
        }
        
        // Recency weight (10 points)
        if (history.lastOrderDate) {
            const daysSinceLastOrder = (Date.now() - new Date(history.lastOrderDate * 1000).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastOrder < 30) score += 10;
            else if (daysSinceLastOrder < 90) score += 5;
        }
        
        return Math.min(100, Math.round(score));
    },
    
    // Analyze product preferences from quote history
    analyzeProductPreferences: function(quotes) {
        const productCounts = {};
        
        quotes.forEach(quote => {
            try {
                // Try to extract product info from quote details
                const details = quote.details || quote.description || '';
                
                // Look for Kanva product names
                if (details.includes('Focus+Flow') || details.includes('focus')) {
                    productCounts['focus'] = (productCounts['focus'] || 0) + 1;
                }
                if (details.includes('Release+Relax') || details.includes('release')) {
                    productCounts['release'] = (productCounts['release'] || 0) + 1;
                }
                if (details.includes('Zoom') || details.includes('zoom')) {
                    productCounts['zoom'] = (productCounts['zoom'] || 0) + 1;
                }
                if (details.includes('Mango') || details.includes('mango')) {
                    productCounts['mango'] = (productCounts['mango'] || 0) + 1;
                }
            } catch (error) {
                // Ignore parsing errors
            }
        });
        
        // Return sorted preferences
        return Object.entries(productCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([product, count]) => ({ product, count }));
    }
};
```

### 4. Bilateral Integration with External APIs

**Why Implement**: Creates a unified workflow that combines Copper CRM data with real-time inventory and shipping information.

**How It Works**: Orchestrates data flow between Copper, Fishbowl, and ShipStation to provide comprehensive quotes.

```javascript
// File: js/integrated-workflow.js
const IntegratedWorkflow = {
    
    // Generate comprehensive quote with live data from all systems
    generateSmartQuote: async function(products, customerId) {
        try {
            console.log('🎯 Generating smart quote with integrated data...');
            
            // Step 1: Get customer data from Copper
            const customerData = await this.getCustomerFromCopper(customerId);
            
            // Step 2: Check real-time inventory in Fishbowl
            const inventoryData = await this.checkFishbowlInventory(products);
            
            // Step 3: Get shipping rates from ShipStation
            const shippingRates = await this.getShipStationRates(customerData.address, products);
            
            // Step 4: Get customer-specific pricing (if any)
            const pricingData = await this.getCustomerPricing(customerId, products);
            
            // Step 5: Calculate comprehensive quote
            const quote = {
                quoteNumber: this.generateQuoteNumber(),
                generatedDate: new Date().toISOString(),
                customer: customerData,
                products: products.map(p => {
                    const inventory = inventoryData[p.id] || {};
                    const pricing = pricingData[p.id] || {};
                    
                    return {
                        ...p,
                        availability: inventory.available || 0,
                        reserved: inventory.reserved || 0,
                        estimatedShipDate: inventory.shipDate || this.calculateShipDate(inventory.available),
                        customPrice: pricing.customPrice,
                        discountApplied: pricing.discount || 0
                    };
                }),
                shipping: shippingRates,
                pricing: {
                    subtotal: this.calculateSubtotal(products, pricingData),
                    discount: this.calculateVolumeDiscount(products),
                    tax: this.calculateTax(customerData.address),
                    shipping: shippingRates.cost,
                    total: 0 // Will be calculated
                },
                deliveryEstimate: this.calculateDelivery(customerData.address, shippingRates),
                paymentTerms: customerData.paymentTerms || 'Net 30',
                validUntil: this.addDays(new Date(), 30) // Quote valid for 30 days
            };
            
            // Calculate final total
            quote.pricing.total = quote.pricing.subtotal - quote.pricing.discount + quote.pricing.tax + quote.pricing.shipping;
            
            // Step 6: Save comprehensive quote back to Copper
            await this.saveQuoteToCopper(quote);
            
            // Step 7: Update customer intelligence
            await this.updateCustomerIntelligence(customerId, quote);
            
            console.log('✅ Smart quote generated successfully');
            return quote;
            
        } catch (error) {
            console.error('❌ Smart quote generation failed:', error);
            throw error;
        }
    },
    
    // Check Fishbowl inventory for all products
    checkFishbowlInventory: async function(products) {
        try {
            // This would integrate with your actual Fishbowl API
            console.log('🐠 Checking Fishbowl inventory...');
            
            const inventoryPromises = products.map(async product => {
                try {
                    // Simulated Fishbowl API call
                    const response = await fetch(`/api/fishbowl/inventory/${product.id}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${appState.fishbowlToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        return await response.json();
                    } else {
                        console.warn(`Fishbowl inventory check failed for ${product.id}`);
                        return this.getDefaultInventoryData(product.id);
                    }
                } catch (error) {
                    console.warn(`Fishbowl API error for ${product.id}:`, error);
                    return this.getDefaultInventoryData(product.id);
                }
            });
            
            const inventoryResults = await Promise.all(inventoryPromises);
            
            // Convert array to object keyed by product ID
            return inventoryResults.reduce((acc, result, index) => {
                acc[products[index].id] = {
                    available: result.quantity_available || 0,
                    reserved: result.quantity_reserved || 0,
                    onOrder: result.quantity_on_order || 0,
                    shipDate: result.next_ship_date || this.calculateShipDate(result.quantity_available)
                };
                return acc;
            }, {});
            
        } catch (error) {
            console.error('❌ Fishbowl inventory check failed:', error);
            // Return default data for all products
            return products.reduce((acc, product) => {
                acc[product.id] = this.getDefaultInventoryData(product.id);
                return acc;
            }, {});
        }
    },
    
    // Get ShipStation shipping rates
    getShipStationRates: async function(address, products) {
        try {
            console.log('📦 Getting ShipStation shipping rates...');
            
            const shipmentData = {
                toAddress: {
                    name: address.name || 'Customer',
                    street1: address.street || address.address,
                    city: address.city,
                    state: address.state,
                    postalCode: address.postal_code || address.zip,
                    country: address.country || 'US'
                },
                fromAddress: {
                    // Kanva's shipping address
                    name: 'Kanva Botanicals',
                    street1: '123 Botanical Way',
                    city: 'Portland',
                    state: 'OR',
                    postalCode: '97201',
                    country: 'US'
                },
                packages: [{
                    weight: this.calculateTotalWeight(products),
                    dimensions: this.calculatePackageDimensions(products)
                }],
                serviceCode: 'fedex_ground' // Default service
            };
            
            // Call ShipStation API
            const response = await fetch('/api/shipstation/rates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${appState.shipStationToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(shipmentData)
            });
            
            if (response.ok) {
                const rates = await response.json();
                return {
                    cost: rates.cost || 0,
                    service: rates.serviceName || 'Ground',
                    deliveryDays: rates.deliveryDays || 5,
                    carrier: rates.carrier || 'FedEx'
                };
            } else {
                console.warn('ShipStation rates request failed');
                return this.getDefaultShippingRates(address, products);
            }
            
        } catch (error) {
            console.error('❌ ShipStation rates failed:', error);
            return this.getDefaultShippingRates(address, products);
        }
    },
    
    // Auto-create shipment when opportunity closes
    createShipmentOnClose: async function() {
        if (!appState.sdk) return;
        
        // Listen for opportunity status changes
        appState.sdk.onEntityUpdate(async (entity) => {
            if (entity.type === 'opportunity' && 
                entity.data.status === 'Won' &&
                entity.data.custom_fields?.kanva_quote_id) {
                
                console.log('🎉 Opportunity won! Creating shipment...');
                
                try {
                    // Get quote data from opportunity
                    const quoteData = this.extractQuoteFromOpportunity(entity.data);
                    
                    // Create shipment in ShipStation
                    const shipment = await this.createShipStationOrder(quoteData);
                    
                    // Update inventory in Fishbowl
                    await this.updateFishbowlInventory(quoteData.products, 'reserve');
                    
                    // Update opportunity with shipping info
                    await appState.sdk.updateEntity('opportunity', entity.id, {
                        details: `${entity.data.details}\n\nShipment Created:\nTracking: ${shipment.trackingNumber}\nShip Date: ${shipment.shipDate}`,
                        custom_fields: {
                            ...entity.data.custom_fields,
                            'kanva_tracking_number': shipment.trackingNumber,
                            'kanva_ship_date': shipment.shipDate,
                            'kanva_shipment_id': shipment.id
                        }
                    });
                    
                    // Log success activity
                    await appState.sdk.logActivity(0, {
                        subject: 'Order Processing Started',
                        details: `Shipment created in ShipStation (${shipment.trackingNumber}), inventory reserved in Fishbowl`,
                        activity_type: 'system'
                    });
                    
                    // Create follow-up tasks for fulfillment
                    await EntityManager.createShippingTasks(shipment);
                    
                    console.log('✅ Automated order processing completed');
                    
                } catch (error) {
                    console.error('❌ Automated order processing failed:', error);
                    
                    // Log error activity
                    await appState.sdk.logActivity(0, {
                        subject: 'Order Processing Error',
                        details: `Failed to create shipment: ${error.message}`,
                        activity_type: 'error'
                    });
                }
            }
        });
    },
    
    // Generate unique quote number
    generateQuoteNumber: function() {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `KNV-${timestamp}-${random}`;
    },
    
    // Default inventory data when Fishbowl is unavailable
    getDefaultInventoryData: function(productId) {
        return {
            available: 100, // Assume good availability
            reserved: 0,
            onOrder: 0,
            shipDate: this.addDays(new Date(), 2) // 2 days default
        };
    },
    
    // Default shipping rates when ShipStation is unavailable
    getDefaultShippingRates: function(address, products) {
        const weight = this.calculateTotalWeight(products);
        const estimatedCost = Math.max(15, weight * 0.5); // $0.50 per lb, minimum $15
        
        return {
            cost: estimatedCost,
            service: 'Ground (Estimated)',
            deliveryDays: 5,
            carrier: 'Estimated'
        };
    },
    
    // Calculate total package weight
    calculateTotalWeight: function(products) {
        return products.reduce((total, product) => {
            const weightPerCase = product.weightPerCase || 10; // Default 10 lbs per case
            return total + (weightPerCase * product.quantity);
        }, 0);
    },
    
    // Utility function to add days to date
    addDays: function(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
};
```

### 5. Field Mapping System

**Why Implement**: Creates a visual interface for mapping Copper CRM fields to your application fields, ensuring data consistency.

**How It Works**: Provides an admin dashboard to view all available fields and create mappings between systems.

```javascript
// File: js/field-mapping-system.js
const FieldMappingSystem = {
    
    copperFields: {}, // Will store all Copper fields
    appFields: {}, // Our application fields
    fieldMappings: {}, // Current mappings
    
    // Initialize field mapping system
    initialize: async function() {
        console.log('🗺️ Initializing field mapping system...');
        
        try {
            // Load Copper field definitions
            await this.loadCopperFields();
            
            // Define our application fields
            this.defineAppFields();
            
            // Load existing mappings
            this.loadFieldMappings();
            
            console.log('✅ Field mapping system initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Field mapping initialization failed:', error);
            return false;
        }
    },
    
    // Load all available Copper fields
    loadCopperFields: async function() {
        if (!appState.sdk || !appState.sdk.api) {
            console.warn('⚠️ Copper SDK not available for field discovery');
            this.copperFields = this.getDefaultCopperFields();
            return;
        }
        
        try {
            // Get field definitions for each entity type
            const entityTypes = ['companies', 'people', 'opportunities', 'activities', 'tasks'];
            
            for (const entityType of entityTypes) {
                console.log(`📋 Loading ${entityType} fields...`);
                
                try {
                    // Get custom field definitions
                    const customFields = await appState.sdk.api[entityType].getCustomFields();
                    
                    // Get standard field definitions (if available)
                    const standardFields = await this.getStandardFields(entityType);
                    
                    this.copperFields[entityType] = {
                        standard: standardFields,
                        custom: customFields || []
                    };
                    
                } catch (error) {
                    console.warn(`⚠️ Failed to load ${entityType} fields:`, error);
                    this.copperFields[entityType] = this.getDefaultFieldsForType(entityType);
                }
            }
            
            console.log('✅ Copper fields loaded:', this.copperFields);
            
        } catch (error) {
            console.error('❌ Failed to load Copper fields:', error);
            this.copperFields = this.getDefaultCopperFields();
        }
    },
    
    // Get standard Copper fields for each entity type
    getStandardFields: function(entityType) {
        const standardFields = {
            companies: [
                { id: 'name', name: 'Company Name', type: 'String', required: true },
                { id: 'email_domain', name: 'Email Domain', type: 'String' },
                { id: 'phone_numbers', name: 'Phone Numbers', type: 'Array' },
                { id: 'address', name: 'Address', type: 'Object' },
                { id: 'website', name: 'Website', type: 'String' },
                { id: 'details', name: 'Details', type: 'Text' },
                { id: 'tags', name: 'Tags', type: 'Array' },
                { id: 'assignee_id', name: 'Assignee', type: 'User' },
                { id: 'contact_type_id', name: 'Contact Type', type: 'ContactType' },
                { id: 'date_created', name: 'Date Created', type: 'Date', readonly: true },
                { id: 'date_modified', name: 'Date Modified', type: 'Date', readonly: true }
            ],
            people: [
                { id: 'name', name: 'Full Name', type: 'String', required: true },
                { id: 'first_name', name: 'First Name', type: 'String' },
                { id: 'last_name', name: 'Last Name', type: 'String' },
                { id: 'middle_name', name: 'Middle Name', type: 'String' },
                { id: 'email', name: 'Email', type: 'Email' },
                { id: 'phone_numbers', name: 'Phone Numbers', type: 'Array' },
                { id: 'address', name: 'Address', type: 'Object' },
                { id: 'title', name: 'Title', type: 'String' },
                { id: 'company_id', name: 'Company', type: 'Company' },
                { id: 'details', name: 'Details', type: 'Text' },
                { id: 'tags', name: 'Tags', type: 'Array' },
                { id: 'assignee_id', name: 'Assignee', type: 'User' },
                { id: 'contact_type_id', name: 'Contact Type', type: 'ContactType' },
                { id: 'date_created', name: 'Date Created', type: 'Date', readonly: true },
                { id: 'date_modified', name: 'Date Modified', type: 'Date', readonly: true }
            ],
            opportunities: [
                { id: 'name', name: 'Opportunity Name', type: 'String', required: true },
                { id: 'assignee_id', name: 'Assignee', type: 'User' },
                { id: 'close_date', name: 'Close Date', type: 'Date' },
                { id: 'company_id', name: 'Company', type: 'Company' },
                { id: 'customer_source_id', name: 'Customer Source', type: 'CustomerSource' },
                { id: 'details', name: 'Details', type: 'Text' },
                { id: 'loss_reason_id', name: 'Loss Reason', type: 'LossReason' },
                { id: 'monetary_value', name: 'Monetary Value', type: 'Currency' },
                { id: 'pipeline_id', name: 'Pipeline', type: 'Pipeline' },
                { id: 'pipeline_stage_id', name: 'Pipeline Stage', type: 'PipelineStage' },
                { id: 'primary_contact_id', name: 'Primary Contact', type: 'Person' },
                { id: 'priority', name: 'Priority', type: 'String' },
                { id: 'status', name: 'Status', type: 'String' },
                { id: 'tags', name: 'Tags', type: 'Array' },
                { id: 'win_probability', name: 'Win Probability', type: 'Number' },
                { id: 'date_created', name: 'Date Created', type: 'Date', readonly: true },
                { id: 'date_modified', name: 'Date Modified', type: 'Date', readonly: true }
            ],
            activities: [
                { id: 'subject', name: 'Subject', type: 'String', required: true },
                { id: 'details', name: 'Details', type: 'Text' },
                { id: 'activity_date', name: 'Activity Date', type: 'Date' },
                { id: 'assignee_id', name: 'Assignee', type: 'User' },
                { id: 'company_id', name: 'Company', type: 'Company' },
                { id: 'person_id', name: 'Person', type: 'Person' },
                { id: 'opportunity_id', name: 'Opportunity', type: 'Opportunity' },
                { id: 'type', name: 'Activity Type', type: 'String' },
                { id: 'date_created', name: 'Date Created', type: 'Date', readonly: true },
                { id: 'date_modified', name: 'Date Modified', type: 'Date', readonly: true }
            ],
            tasks: [
                { id: 'name', name: 'Task Name', type: 'String', required: true },
                { id: 'details', name: 'Details', type: 'Text' },
                { id: 'due_date', name: 'Due Date', type: 'Date' },
                { id: 'assignee_id', name: 'Assignee', type: 'User' },
                { id: 'company_id', name: 'Company', type: 'Company' },
                { id: 'person_id', name: 'Person', type: 'Person' },
                { id: 'opportunity_id', name: 'Opportunity', type: 'Opportunity' },
                { id: 'priority', name: 'Priority', type: 'String' },
                { id: 'status', name: 'Status', type: 'String' },
                { id: 'date_created', name: 'Date Created', type: 'Date', readonly: true },
                { id: 'date_modified', name: 'Date Modified', type: 'Date', readonly: true }
            ]
        };
        
        return standardFields[entityType] || [];
    },
    
    // Define our application fields
    defineAppFields: function() {
        this.appFields = {
            customer: [
                { id: 'name', name: 'Customer Name', type: 'String', required: true },
                { id: 'email', name: 'Email Address', type: 'Email', required: true },
                { id: 'phone', name: 'Phone Number', type: 'Phone' },
                { id: 'address', name: 'Address', type: 'Address' },
                { id: 'city', name: 'City', type: 'String' },
                { id: 'state', name: 'State', type: 'String' },
                { id: 'zip', name: 'ZIP Code', type: 'String' },
                { id: 'taxExempt', name: 'Tax Exempt', type: 'Boolean' },
                { id: 'paymentTerms', name: 'Payment Terms', type: 'String' },
                { id: 'preferredShipping', name: 'Preferred Shipping', type: 'String' }
            ],
            quote: [
                { id: 'quoteNumber', name: 'Quote Number', type: 'String' },
                { id: 'products', name: 'Products', type: 'Array' },
                { id: 'quantities', name: 'Quantities', type: 'Array' },
                { id: 'totalCases', name: 'Total Cases', type: 'Number' },
                { id: 'subtotal', name: 'Subtotal', type: 'Currency' },
                { id: 'discount', name: 'Discount', type: 'Currency' },
                { id: 'tax', name: 'Tax', type: 'Currency' },
                { id: 'shipping', name: 'Shipping', type: 'Currency' },
                { id: 'total', name: 'Total', type: 'Currency' },
                { id: 'validUntil', name: 'Valid Until', type: 'Date' }
            ],
            kanva_tracking: [
                { id: 'preferredProducts', name: 'Preferred Products', type: 'Array' },
                { id: 'volumeTier', name: 'Volume Tier', type: 'String' },
                { id: 'lastOrderDate', name: 'Last Order Date', type: 'Date' },
                { id: 'lifetimeValue', name: 'Lifetime Value', type: 'Currency' },
                { id: 'quoteFrequency', name: 'Quote Frequency', type: 'Number' },
                { id: 'conversionRate', name: 'Conversion Rate', type: 'Percentage' },
                { id: 'salesRep', name: 'Sales Rep', type: 'String' },
                { id: 'shippingPreferences', name: 'Shipping Preferences', type: 'Object' }
            ]
        };
    },
    
    // Create field mapping dashboard
    createMappingDashboard: function() {
        return `
        <div class="field-mapping-dashboard">
            <div class="dashboard-header">
                <h2>🗺️ Field Mapping System</h2>
                <p>Map Copper CRM fields to Kanva application fields for seamless data synchronization.</p>
            </div>
            
            <div class="mapping-sections">
                <!-- Copper Fields Section -->
                <div class="mapping-section">
                    <h3>Copper CRM Fields</h3>
                    <div class="field-groups">
                        ${this.renderCopperFields()}
                    </div>
                </div>
                
                <!-- Mapping Arrows -->
                <div class="mapping-arrows">
                    <div class="arrow">→</div>
                </div>
                
                <!-- App Fields Section -->
                <div class="mapping-section">
                    <h3>Kanva App Fields</h3>
                    <div class="field-groups">
                        ${this.renderAppFields()}
                    </div>
                </div>
            </div>
            
            <!-- Current Mappings -->
            <div class="current-mappings">
                <h3>Current Field Mappings</h3>
                <div class="mappings-list">
                    ${this.renderCurrentMappings()}
                </div>
            </div>
            
            <!-- Actions -->
            <div class="mapping-actions">
                <button class="btn btn-primary" onclick="FieldMappingSystem.autoMapFields()">
                    🤖 Auto-Map Similar Fields
                </button>
                <button class="btn btn-secondary" onclick="FieldMappingSystem.saveMappings()">
                    💾 Save Mappings
                </button>
                <button class="btn btn-success" onclick="FieldMappingSystem.testMappings()">
                    🧪 Test Mappings
                </button>
                <button class="btn btn-info" onclick="FieldMappingSystem.exportMappings()">
                    📤 Export Configuration
                </button>
            </div>
        </div>
        `;
    },
    
    // Auto-map fields with similar names
    autoMapFields: function() {
        console.log('🤖 Auto-mapping similar fields...');
        
        const autoMappings = {};
        
        // Define mapping rules
        const mappingRules = [
            { copper: 'name', app: 'name', confidence: 1.0 },
            { copper: 'email', app: 'email', confidence: 1.0 },
            { copper: 'phone_numbers[0]', app: 'phone', confidence: 0.9 },
            { copper: 'address.street', app: 'address', confidence: 0.9 },
            { copper: 'address.city', app: 'city', confidence: 1.0 },
            { copper: 'address.state', app: 'state', confidence: 1.0 },
            { copper: 'address.postal_code', app: 'zip', confidence: 1.0 },
            { copper: 'custom_fields.kanva_payment_terms', app: 'paymentTerms', confidence: 1.0 },
            { copper: 'custom_fields.kanva_preferred_products', app: 'preferredProducts', confidence: 1.0 }
        ];
        
        // Apply mapping rules
        mappingRules.forEach(rule => {
            if (this.fieldExists('copper', rule.copper) && 
                this.fieldExists('app', rule.app)) {
                autoMappings[rule.app] = {
                    copperField: rule.copper,
                    confidence: rule.confidence,
                    type: 'auto'
                };
            }
        });
        
        // Merge with existing mappings
        this.fieldMappings = { ...this.fieldMappings, ...autoMappings };
        
        console.log(`✅ Auto-mapped ${Object.keys(autoMappings).length} fields`);
        
        // Refresh dashboard
        this.refreshDashboard();
        
        return autoMappings;
    },
    
    // Test field mappings
    testMappings: async function() {
        console.log('🧪 Testing field mappings...');
        
        try {
            // Get test customer data from Copper
            const testCustomer = await this.getTestCustomerData();
            
            if (!testCustomer) {
                alert('❌ No test customer data available. Please create a test customer in Copper first.');
                return;
            }
            
            // Apply mappings to test data
            const mappedData = this.applyMappings(testCustomer);
            
            // Show results
            const testResults = {
                original: testCustomer,
                mapped: mappedData,
                mappingsUsed: Object.keys(this.fieldMappings).length,
                successfulMappings: Object.keys(mappedData).length,
                errors: []
            };
            
            this.showTestResults(testResults);
            
            console.log('✅ Field mapping test completed');
            return testResults;
            
        } catch (error) {
            console.error('❌ Field mapping test failed:', error);
            alert(`❌ Test failed: ${error.message}`);
        }
    },
    
    // Apply field mappings to data
    applyMappings: function(copperData) {
        const mappedData = {};
        
        Object.entries(this.fieldMappings).forEach(([appField, mapping]) => {
            try {
                const value = this.extractValue(copperData, mapping.copperField);
                if (value !== undefined && value !== null) {
                    mappedData[appField] = this.transformValue(value, mapping);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to map field ${appField}:`, error);
            }
        });
        
        return mappedData;
    },
    
    // Extract value from nested object using dot notation
    extractValue: function(obj, path) {
        return path.split('.').reduce((current, key) => {
            if (key.includes('[') && key.includes(']')) {
                // Handle array notation like "phone_numbers[0]"
                const [arrayName, indexStr] = key.split('[');
                const index = parseInt(indexStr.replace(']', ''));
                return current?.[arrayName]?.[index];
            }
            return current?.[key];
        }, obj);
    },
    
    // Default Copper fields when API is not available
    getDefaultCopperFields: function() {
        return {
            companies: {
                standard: this.getStandardFields('companies'),
                custom: [
                    { id: 'kanva_preferred_products', name: 'Kanva Preferred Products', type: 'String' },
                    { id: 'kanva_volume_tier', name: 'Kanva Volume Tier', type: 'String' },
                    { id: 'kanva_payment_terms', name: 'Kanva Payment Terms', type: 'String' },
                    { id: 'kanva_lifetime_value', name: 'Kanva Lifetime Value', type: 'Currency' }
                ]
            },
            people: {
                standard: this.getStandardFields('people'),
                custom: []
            },
            opportunities: {
                standard: this.getStandardFields('opportunities'),
                custom: [
                    { id: 'kanva_quote_id', name: 'Kanva Quote ID', type: 'String' },
                    { id: 'kanva_products', name: 'Kanva Products', type: 'String' },
                    { id: 'kanva_total_cases', name: 'Kanva Total Cases', type: 'Number' }
                ]
            }
        };
    }
};
```

## 🔄 Complete Bilateral Integration Flow

### 1. Customer Context Detection
```javascript
// When sales rep opens customer record
sdk.onContextChange(async (customer) => {
    // Pull customer intelligence
    const intelligence = await SmartSearch.getCustomerIntelligence(customer.id);
    
    // Check live inventory
    const inventory = await IntegratedWorkflow.checkFishbowlInventory(intelligence.preferredProducts);
    
    // Pre-populate recommendations
    Calculator.preloadRecommendations(intelligence, inventory);
    
    // Update UI with predictions
    UIController.updateSidebar(intelligence);
});
```

### 2. Quote Generation with Live Data
```javascript
async function generateComprehensiveQuote(products) {
    // Get live pricing from Fishbowl
    const pricing = await FishbowlAPI.getCurrentPricing(products);
    
    // Calculate shipping via ShipStation
    const shipping = await ShipStationAPI.calculateShipping(customer.address, products);
    
    // Generate quote with all live data
    const quote = await IntegratedWorkflow.generateSmartQuote(products, customer.id);
    
    // Save comprehensive data to Copper
    await CopperIntegration.saveComprehensiveQuote(quote);
    
    // Create automated workflow
    await EntityManager.createFollowUpWorkflow(quote);
    
    // Send professional email
    await EmailIntegration.sendQuoteEmail(quote);
    
    return quote;
}
```

### 3. Order Fulfillment Automation
```javascript
// Auto-fulfillment when deal closes
sdk.onEntityUpdate(async (entity) => {
    if (entity.type === 'opportunity' && entity.status === 'Won') {
        // Create shipment
        const shipment = await ShipStationAPI.createOrder(entity.quoteData);
        
        // Update inventory
        await FishbowlAPI.reserveInventory(entity.products);
        
        // Update CRM
        await sdk.updateEntity('opportunity', entity.id, {
            tracking_number: shipment.trackingNumber,
            ship_date: shipment.shipDate
        });
        
        // Create follow-up tasks
        await EntityManager.createShippingTasks(shipment);
    }
});
```

## 📊 Implementation Priority

### Phase 1: Core Bilateral Features (Week 1-2)
1. **Real-time sync** - Immediate CRM responsiveness
2. **Advanced entity management** - Rich customer profiles
3. **Field mapping system** - Data consistency

### Phase 2: External Integration (Week 3-4)
1. **Fishbowl inventory integration** - Live product data
2. **ShipStation shipping calculator** - Complete quotes
3. **Automated workflows** - Order processing

### Phase 3: Intelligence & Analytics (Week 5-6)
1. **Smart search** - Customer insights
2. **Predictive analytics** - Sales intelligence
3. **Advanced email features** - Professional communication

## 🧪 Testing and Validation

### Field Mapping Validation
```javascript
// Test field mappings before production
const testResults = await FieldMappingSystem.testMappings();
console.log('Mapping success rate:', testResults.successfulMappings / testResults.mappingsUsed);
```

### Integration Health Monitoring
```javascript
// Monitor all integrations
const health = await IntegrationValidator.validateAll();
if (health.overall !== 'success') {
    console.warn('Integration issues detected:', health);
}
```

## 📁 File Structure for Implementation

```
js/
├── advanced-copper-sync.js      # Real-time synchronization
├── entity-manager.js            # Advanced CRM entity management
├── smart-search.js              # Intelligent customer search
├── integrated-workflow.js       # Multi-system orchestration
├── field-mapping-system.js      # CRM field mapping
├── ui-controller.js             # Advanced UI control
├── email-integration.js         # Professional email features
├── analytics-engine.js          # Business intelligence
└── external-apis/
    ├── fishbowl-api.js          # Fishbowl ERP integration
    └── shipstation-api.js       # ShipStation shipping
```

This comprehensive integration transforms your quote calculator into a complete business intelligence platform that seamlessly connects Copper CRM, Fishbowl ERP, and ShipStation for automated, intelligent sales workflows.