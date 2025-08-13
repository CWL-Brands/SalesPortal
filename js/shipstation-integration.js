/**
 * ShipStation Integration for Kanva Quotes
 * Handles shipping rate calculations and order fulfillment
 * Based on ShipStation API: https://www.shipstation.com/docs/api/
 */

class ShipStationIntegration {
    /**
     * Initialize the ShipStation integration
     * @param {Object} config - Configuration object
     * @param {string} config.apiKey - ShipStation API key
     * @param {string} config.apiSecret - ShipStation API secret
     * @param {string} config.environment - Environment (production or sandbox)
     */
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.apiSecret = config.apiSecret || '';
        this.environment = config.environment || 'sandbox';
        this.connected = false;
        this.lastSync = null;
        this.useProxy = true; // route through Firebase Function by default
        this.allowOrderCreation = config.allowOrderCreation !== undefined ? config.allowOrderCreation : false; // Do not send orders to ShipStation from this app
        
        // ShipStation uses a single base URL; sandbox/prod is determined by credentials
        this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
        
        console.log('🚢 ShipStationIntegration initialized');
        
        // Load connection from server if available
        this.loadConnectionFromServer();
    }

    /**
     * Build full API URL respecting proxy vs direct mode
     */
    _endpoint(path) {
        const base = this.apiBase.endsWith('/') ? this.apiBase.slice(0, -1) : this.apiBase;
        const p = path.startsWith('/') ? path : `/${path}`;
        return `${base}${p}`;
    }

    /**
     * Build headers. In proxy mode, do NOT attach Authorization in browser.
     */
    _headers() {
        if (this.useProxy) {
            return { 'Content-Type': 'application/json' };
        }
        const authHeader = 'Basic ' + btoa(`${this.apiKey}:${this.apiSecret}`);
        return { 'Authorization': authHeader, 'Content-Type': 'application/json' };
    }
    
    /**
     * Load ShipStation connection from server
     */
    async loadConnectionFromServer() {
        try {
            // First try to load from secure integration handler if available
            if (window.secureIntegrationHandler) {
                try {
                    const shipstationConfig = await window.secureIntegrationHandler.getIntegration('shipstation');
                    if (shipstationConfig) {
                        // Update configuration from secure storage
                        if (shipstationConfig.apiKey) this.apiKey = shipstationConfig.apiKey;
                        if (shipstationConfig.apiSecret) this.apiSecret = shipstationConfig.apiSecret;
                        if (shipstationConfig.environment) this.environment = shipstationConfig.environment;
                        if (shipstationConfig.connected) this.connected = shipstationConfig.connected;
                        if (shipstationConfig.lastUpdated) this.lastSync = new Date(shipstationConfig.lastUpdated);
                        
                        // Always use proxy base by default
                        this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
                        
                        console.log('✅ ShipStation connection loaded from secure storage');
                        return;
                    }
                } catch (secureError) {
                    console.warn('⚠️ Could not load ShipStation credentials from secure storage:', secureError);
                }
            }
            
            // Fallback to legacy method
            const response = await fetch('/api/connections');
            const result = await response.json();
            
            if (result.success && result.data && result.data.shipstation) {
                const shipstationConfig = result.data.shipstation;
                
                // Update configuration from server
                if (shipstationConfig.apiKey) this.apiKey = shipstationConfig.apiKey;
                if (shipstationConfig.apiSecret) this.apiSecret = shipstationConfig.apiSecret;
                if (shipstationConfig.environment) this.environment = shipstationConfig.environment;
                if (shipstationConfig.connected) this.connected = shipstationConfig.connected;
                if (shipstationConfig.lastUpdated) this.lastSync = new Date(shipstationConfig.lastUpdated);
                
                // Always use proxy base by default
                this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
                
                console.log('✅ ShipStation connection loaded from server');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load ShipStation connection from server:', error);
        }
    }
    
    /**
     * Save ShipStation connection to server
     */
    async saveConnectionToServer() {
        const shipstationConfig = {
            apiKey: this.apiKey,
            apiSecret: this.apiSecret,
            environment: this.environment,
            connected: this.connected,
            lastUpdated: new Date().toISOString()
        };
        
        // First try to save using secure integration handler if available
        if (window.secureIntegrationHandler) {
            try {
                await window.secureIntegrationHandler.updateIntegration('shipstation', shipstationConfig);
                console.log('✅ ShipStation connection saved to secure storage');
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('ShipStation API credentials updated successfully', 'success');
                }
                
                return true;
            } catch (secureError) {
                console.warn('⚠️ Could not save ShipStation credentials to secure storage:', secureError);
                
                // Show notification to user
                if (window.showNotification) {
                    window.showNotification('Failed to save ShipStation API credentials securely', 'warning');
                }
                
                // Fall through to legacy method
            }
        }
        
        // Fallback to legacy method
        try {
            const response = await fetch('/api/connections/shipstation', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(shipstationConfig)
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ ShipStation connection saved to server');
                return true;
            } else {
                console.warn('⚠️ Failed to save ShipStation connection to server:', result.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Error saving ShipStation connection to server:', error);
            return false;
        }
    }
    
    /**
     * Configure ShipStation connection settings
     * @param {Object} config - Configuration object
     * @param {string} config.apiKey - ShipStation API key
     * @param {string} config.apiSecret - ShipStation API secret
     * @param {string} config.environment - Environment (production or sandbox)
     * @returns {Promise<boolean>} - Success status
     */
    async configure(config = {}) {
        let updated = false;
        
        if (config.apiKey) {
            this.apiKey = config.apiKey;
            updated = true;
        }
        
        if (config.apiSecret) {
            this.apiSecret = config.apiSecret;
            updated = true;
        }
        
        if (config.environment) {
            this.environment = config.environment;
            // Always use single endpoint; prefer proxy when enabled
            this.apiBase = this.useProxy ? '/api/shipstation' : 'https://ssapi.shipstation.com';
            
            updated = true;
        }
        
        if (config.allowOrderCreation !== undefined) {
            this.allowOrderCreation = config.allowOrderCreation;
            updated = true;
        }
        
        if (updated) {
            console.log('✅ ShipStationIntegration configuration updated');
            
            // Save to server
            return await this.saveConnectionToServer();
        }
        
        return updated;
    }
    
    /**
     * Test ShipStation connection
     * @returns {Promise<Object>} - Test result with status and message
     */
    async testConnection() {
        if (!this.apiKey || !this.apiSecret) {
            return {
                success: false,
                message: 'ShipStation credentials not configured. Please enter valid API key and secret.',
                details: null
            };
        }
        
        try {
            console.log('🔍 Testing ShipStation connection...');
            
            // Create Authorization header with Base64 encoded API key and secret
            // Test connection by fetching stores (reliable endpoint)
            const response = await fetch(this._endpoint('/stores'), {
                method: 'GET',
                headers: this._headers()
            });
            
            if (response.ok) {
                const stores = await response.json();
                
                // Connection successful, save to server
                this.connected = true;
                await this.saveConnectionToServer();
                
                return {
                    success: true,
                    message: `Successfully connected to ShipStation API (${this.environment})`,
                    details: {
                        environment: this.environment,
                        storesCount: Array.isArray(stores) ? stores.length : (stores?.length || 0)
                    }
                };
            } else {
                // Authentication failed
                this.connected = false;
                await this.saveConnectionToServer();
                
                return {
                    success: false,
                    message: `Failed to authenticate with ShipStation API: ${response.statusText}`,
                    details: null
                };
            }
        } catch (error) {
            console.error('❌ ShipStation connection test failed:', error);
            
            this.connected = false;
            await this.saveConnectionToServer();
            
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                details: error
            };
        }
    }
    
    /**
     * Get configuration information
     * @returns {Object} - Configuration object
     */
    getConfig() {
        return {
            apiKey: this.apiKey ? '••••••••' + this.apiKey.substring(this.apiKey.length - 4) : '',
            apiSecret: this.apiSecret ? '••••••••' + this.apiSecret.substring(this.apiSecret.length - 4) : '',
            environment: this.environment,
            connected: this.connected,
            lastSync: this.lastSync,
            allowOrderCreation: this.allowOrderCreation
        };
    }

    /**
     * Get a single order by ShipStation orderId
     * @param {number|string} orderId
     * @returns {Promise<Object>}
     */
    async getOrder(orderId) {
        if (!this.apiKey || !this.apiSecret) throw new Error('ShipStation not configured');
        const resp = await fetch(this._endpoint(`/orders/${orderId}`), {
            method: 'GET',
            headers: this._headers()
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`Failed to get order ${orderId}: ${resp.status} ${txt}`);
        }
        return await resp.json();
    }

    /**
     * Get a single order by orderNumber (first match)
     * @param {string} orderNumber
     * @returns {Promise<Object|null>}
     */
    async getOrderByOrderNumber(orderNumber) {
        if (!this.apiKey || !this.apiSecret) throw new Error('ShipStation not configured');
        const params = new URLSearchParams({ orderNumber });
        const resp = await fetch(this._endpoint(`/orders?${params.toString()}`), {
            method: 'GET',
            headers: this._headers()
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`Failed to find order ${orderNumber}: ${resp.status} ${txt}`);
        }
        const data = await resp.json();
        if (Array.isArray(data?.orders) && data.orders.length) return data.orders[0];
        if (Array.isArray(data) && data.length) return data[0];
        return null;
    }

    /**
     * Fetch ShipStation orders for a date range (created date)
     * @param {Object} opts
     * @param {string|Date} opts.start - inclusive start (Date or ISO string)
     * @param {string|Date} opts.end - inclusive end (Date or ISO string)
     * @param {number} [opts.pageSize=50] - page size (max 500 per API docs)
     * @param {number} [opts.page=1] - page number
     * @returns {Promise<{orders: Array, total: number, page: number, pages: number}>}
     */
    async listOrders({ start, end, page = 1, pageSize = 50 } = {}) {
        if (!this.apiKey || !this.apiSecret) throw new Error('ShipStation not configured');
        const startIso = (start instanceof Date) ? start.toISOString() : (start || new Date(Date.now() - 24*3600*1000).toISOString());
        const endIso = (end instanceof Date) ? end.toISOString() : (end || new Date().toISOString());

        const params = new URLSearchParams({
            'createDateStart': startIso,
            'createDateEnd': endIso,
            pageSize: String(pageSize),
            page: String(page)
        });

        const url = this._endpoint(`/orders?${params.toString()}`);
        const resp = await fetch(url, {
            method: 'GET',
            headers: this._headers()
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`ShipStation orders failed: ${resp.status} ${txt}`);
        }
        const data = await resp.json();
        // Normalize response
        return {
            orders: data.orders || data || [],
            total: data.total,
            page: data.page || page,
            pages: data.pages || (data.total && pageSize ? Math.ceil(data.total / pageSize) : undefined)
        };
    }

    /**
     * Get shipping rates for a package
     * @param {Object} shipment - Shipment details
     * @returns {Promise<Array>} - Array of rate options
     */
    async getRates(shipment) {
        if (!this.apiKey || !this.apiSecret || !this.connected) {
            throw new Error('ShipStation not configured or connected');
        }
        
        try {
            // Create Authorization header with Base64 encoded API key and secret
            const response = await fetch(this._endpoint('/shipments/getrates'), {
                method: 'POST',
                headers: this._headers(),
                body: JSON.stringify(shipment)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get rates: ${response.statusText}`);
            }
            
            const rates = await response.json();
            return rates;
        } catch (error) {
            console.error('❌ Error getting shipping rates:', error);
            throw error;
        }
    }
    
    /**
     * Lightweight configuration check
     */
    get isConfigured() {
        return Boolean(this.apiKey && this.apiSecret);
    }

    /**
     * Create a ShipStation order from calculator quote data
     * @param {Object} quoteData - calculator quote object (products/items, totals, etc.)
     * @param {Object} customerData - {companyName, email, phone, state, name, address fields}
     * @returns {Promise<Object>} ShipStation API response
     */
    async createOrderFromQuote(quoteData, customerData = {}) {
        if (!this.allowOrderCreation) {
            console.warn('ShipStation order creation is disabled by configuration. Skipping.');
            return { skipped: true, reason: 'disabled' };
        }
        if (!this.isConfigured) {
            throw new Error('ShipStation not configured');
        }
        if (!this.connected) {
            // Optionally attempt a connection test before creating an order
            try {
                await this.testConnection();
            } catch (e) {
                console.warn('ShipStation connection test failed before order creation:', e);
            }
            if (!this.connected) throw new Error('ShipStation not connected');
        }

        const nowIso = new Date().toISOString();
        const orderNumber = quoteData?.quoteNumber || `KANVA-${nowIso.replace(/[-:TZ.]/g, '').slice(0,14)}`;

        const company = customerData.companyName || customerData.company || '';
        const contactName = customerData.name || customerData.contactName || company || 'Customer';
        const email = customerData.email || '';
        const phone = customerData.phone || '';

        const shipTo = {
            name: contactName,
            company,
            street1: customerData.address1 || customerData.street1 || customerData.address || 'TBD',
            street2: customerData.address2 || customerData.street2 || '',
            city: customerData.city || 'TBD',
            state: customerData.state || customerData.region || 'NA',
            postalCode: customerData.postalCode || customerData.zip || '00000',
            country: customerData.country || 'US',
            phone,
            residential: false
        };

        const itemsSource = quoteData?.items || quoteData?.products || [];
        const itemsArray = Array.isArray(itemsSource) ? itemsSource : Object.values(itemsSource || {});
        const items = itemsArray.map((p, idx) => ({
            lineItemKey: p.sku || p.key || String(idx + 1),
            sku: p.sku || p.key || `SKU-${idx + 1}`,
            name: p.name || p.productName || `Item ${idx + 1}`,
            quantity: Number(p.quantity ?? ((p.displayBoxes || p.cases || 1) * (p.unitsPerCase || 1))) || 1,
            unitPrice: Number(p.unitPrice ?? p.price ?? 0),
        }));

        const orderPayload = {
            orderNumber,
            orderDate: nowIso,
            orderStatus: 'awaiting_shipment',
            customerEmail: email,
            billTo: { name: contactName, company, phone },
            shipTo,
            items,
            amountPaid: 0,
            taxAmount: Number(quoteData?.tax || 0),
            shippingAmount: Number(quoteData?.shipping || 0),
            customerNotes: quoteData?.notes || '',
            internalNotes: `Created from Kanva quote ${orderNumber}`,
            advancedOptions: { source: 'Kanva Quotes' }
        };

        const resp = await fetch(this._endpoint('/orders/createorder'), {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(orderPayload)
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`ShipStation create order failed: ${resp.status} ${resp.statusText} ${text}`);
        }
        return await resp.json();
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ShipStationIntegration = ShipStationIntegration;
    
    // Initialize on page load if needed
    document.addEventListener('DOMContentLoaded', () => {
        console.log(' ShipStation integration ready');
        // Create a singleton instance for app-wide use if not present
        if (!window.shipStation) {
            window.shipStation = new ShipStationIntegration();
        }
    });
}

console.log(' ShipStation integration module loaded successfully');
