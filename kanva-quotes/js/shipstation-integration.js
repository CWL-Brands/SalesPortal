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
        
        // Set API base URL based on environment
        this.apiBase = this.environment === 'production' 
            ? 'https://ssapi.shipstation.com' 
            : 'https://ssapi.shipstation.com/sandbox';
        
        console.log('🚢 ShipStationIntegration initialized');
        
        // Load connection from server if available
        this.loadConnectionFromServer();
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
                        
                        // Update API base URL with new environment
                        this.apiBase = this.environment === 'production' 
                            ? 'https://ssapi.shipstation.com' 
                            : 'https://ssapi.shipstation.com/sandbox';
                        
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
                
                // Update API base URL with new environment
                this.apiBase = this.environment === 'production' 
                    ? 'https://ssapi.shipstation.com' 
                    : 'https://ssapi.shipstation.com/sandbox';
                
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
            
            // Update API base URL with new environment
            this.apiBase = this.environment === 'production' 
                ? 'https://ssapi.shipstation.com' 
                : 'https://ssapi.shipstation.com/sandbox';
                
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
            const authHeader = 'Basic ' + btoa(`${this.apiKey}:${this.apiSecret}`);
            
            // Test connection by fetching account information
            const response = await fetch(`${this.apiBase}/accounts`, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const accountInfo = await response.json();
                
                // Connection successful, save to server
                this.connected = true;
                await this.saveConnectionToServer();
                
                return {
                    success: true,
                    message: `Successfully connected to ShipStation API (${this.environment})`,
                    details: {
                        environment: this.environment,
                        accountName: accountInfo.name || 'Unknown',
                        accountEmail: accountInfo.email || 'Unknown'
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
            lastSync: this.lastSync
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
            const authHeader = 'Basic ' + btoa(`${this.apiKey}:${this.apiSecret}`);
            
            const response = await fetch(`${this.apiBase}/shipments/getrates`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
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
     * Create a shipping label
     * @param {Object} order - Order details
     * @returns {Promise<Object>} - Label information
     */
    async createLabel(order) {
        if (!this.apiKey || !this.apiSecret || !this.connected) {
            throw new Error('ShipStation not configured or connected');
        }
        
        try {
            // Create Authorization header with Base64 encoded API key and secret
            const authHeader = 'Basic ' + btoa(`${this.apiKey}:${this.apiSecret}`);
            
            const response = await fetch(`${this.apiBase}/orders/createlabelfororder`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(order)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create label: ${response.statusText}`);
            }
            
            const labelInfo = await response.json();
            return labelInfo;
        } catch (error) {
            console.error('❌ Error creating shipping label:', error);
            throw error;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ShipStationIntegration = ShipStationIntegration;
    
    // Initialize on page load if needed
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚢 ShipStation integration ready');
    });
}

console.log('✅ ShipStation integration module loaded successfully');
