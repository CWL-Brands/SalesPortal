/**
 * Admin Manager - Handles admin functionality and JSON file editing
 * Enhanced with integrated admin components from kanva-portal
 */
class AdminManager {
    constructor(calculator = null) {
        this.calculator = calculator;
        this.data = {
            products: null,
            tiers: null,
            shipping: null,
            payment: null
        };
        
        // Initialize enhanced admin components after page load
        setTimeout(() => {
            this.initializeComponents();
        }, 500);
        
        // GitHub configuration
        this.github = {
            owner: 'benatkanva', // Your GitHub username
            repo: 'kanva-quotes', // Your repository name
            branch: 'main', // or 'master' depending on your default branch
            token: null // Will be set by admin
        };
        
        // Load data immediately if calculator is provided
        if (calculator && calculator.data) {
            this.data = { ...calculator.data };
        } else {
            this.loadData().catch(console.error);
        }
        
        // Load GitHub token if available
        this.loadGitHubToken();
    }

    /**
     * Initialize enhanced admin components
     */
    initializeComponents() {
        // Initialize GitConnector with admin configuration
        if (typeof window.GitConnector !== 'undefined') {
            this.gitConnector = new window.GitConnector({
                owner: 'benatkanva',
                repo: 'kanva-quotes',
                branch: 'main'
            });
            console.log('✅ GitConnector initialized');
        }
        
        // Initialize FormManager
        if (typeof window.FormManager !== 'undefined') {
            this.formManager = new window.FormManager();
            console.log('✅ FormManager initialized');
        }
        
        // Initialize IntegrationValidator
        if (typeof window.IntegrationValidator !== 'undefined') {
            this.integrationValidator = new window.IntegrationValidator({
                gitConnector: this.gitConnector,
                copperIntegration: window.copperIntegration,
                adminManager: this
            });
            console.log('✅ IntegrationValidator initialized');
        }
        
        // Initialize AdminDashboard
        if (typeof window.AdminDashboard !== 'undefined') {
            this.adminDashboard = new window.AdminDashboard({
                calculator: this.calculator,
                adminManager: this
            });
            console.log('✅ AdminDashboard initialized');
        }
        
        console.log('🚀 Enhanced admin components initialized');
    }

    /**
     * Show enhanced admin dashboard
     */
    showEnhancedDashboard() {
        if (this.adminDashboard) {
            this.adminDashboard.show();
        } else {
            console.error('❌ AdminDashboard not available');
            alert('Enhanced admin dashboard not available. Please refresh the page.');
        }
    }

    /**
     * Run integration validation
     */
    async runIntegrationValidation() {
        if (this.integrationValidator) {
            const results = await this.integrationValidator.validateAll();
            console.log('🔍 Integration validation results:', results);
            return results;
        } else {
            console.error('❌ IntegrationValidator not available');
            return null;
        }
    }

    /**
     * Load all JSON data
     */
    async loadData() {
        try {
            const [products, tiers, shipping, payment] = await Promise.all([
                fetch('/data/products.json').then(r => r.json()),
                fetch('/data/tiers.json').then(r => r.json()),
                fetch('/data/shipping.json').then(r => r.json()),
                fetch('/data/payment.json').then(r => r.json())
            ]);

            this.data = { products, tiers, shipping, payment };
            console.log('✅ Admin data loaded');
        } catch (error) {
            console.error('❌ Failed to load admin data:', error);
            throw error;
        }
    }

    /**
     * Save data to JSON file (simulated - would need backend in real implementation)
     */
    async saveData(type, data) {
        try {
            // Try GitHub API first if token is available
            if (this.github.token) {
                const success = await this.saveToGitHub(type, data);
                if (success) {
                    console.log(`✅ ${type} data saved to GitHub`);
                    return true;
                }
            }
            
            // Fallback to localStorage and download
            localStorage.setItem(`kanva_${type}`, JSON.stringify(data, null, 2));
            
            // Update local data
            this.data[type] = data;
            
            // Offer download of updated JSON
            this.downloadJSON(type, data);
            
            console.log(`✅ ${type} data saved locally`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to save ${type} data:`, error);
            return false;
        }
    }

    /**
     * Save data directly to GitHub repository
     */
    async saveToGitHub(type, data) {
        try {
            const filePath = `data/${type}.json`;
            const content = JSON.stringify(data, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            // Get current file SHA (required for updates)
            const currentFile = await this.getGitHubFile(filePath);
            
            const response = await fetch(`https://api.github.com/repos/${this.github.owner}/${this.github.repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.github.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Update ${type}.json via admin panel`,
                    content: encodedContent,
                    sha: currentFile.sha,
                    branch: this.github.branch
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Successfully updated ${filePath} on GitHub`);
                return true;
            } else {
                const error = await response.json();
                console.error('GitHub API Error:', error);
                return false;
            }
        } catch (error) {
            console.error('Error saving to GitHub:', error);
            return false;
        }
    }

    /**
     * Get current file from GitHub (needed for SHA)
     */
    async getGitHubFile(filePath) {
        const response = await fetch(`https://api.github.com/repos/${this.github.owner}/${this.github.repo}/contents/${filePath}?ref=${this.github.branch}`, {
            headers: {
                'Authorization': `token ${this.github.token}`,
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`Failed to get file: ${filePath}`);
        }
    }

    /**
     * Set GitHub token for API access
     */
    async setGitHubToken(token) {
        this.github.token = token;
        
        // Save to localStorage for immediate use
        localStorage.setItem('github_token', token);
        
        // Save to server for persistence across devices
        try {
            const response = await fetch('/api/connections/github', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    owner: this.github.owner,
                    repo: this.github.repo,
                    branch: this.github.branch,
                    timestamp: new Date().toISOString()
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ GitHub token saved to server');
            } else {
                console.warn('⚠️ GitHub token saved locally but not to server:', result.message);
            }
        } catch (error) {
            console.error('❌ Failed to save GitHub token to server:', error);
        }
        
        console.log('✅ GitHub token set');
    }

    /**
     * Load GitHub token from storage
     */
    async loadGitHubToken() {
        // Try to load from server first
        try {
            const response = await fetch('/api/connections');
            const result = await response.json();
            
            if (result.success && result.data && result.data.github && result.data.github.token) {
                // Update GitHub config from server
                this.github.token = result.data.github.token;
                if (result.data.github.owner) this.github.owner = result.data.github.owner;
                if (result.data.github.repo) this.github.repo = result.data.github.repo;
                if (result.data.github.branch) this.github.branch = result.data.github.branch;
                
                // Update localStorage for consistency
                localStorage.setItem('github_token', this.github.token);
                
                console.log('✅ GitHub token loaded from server');
                return this.github.token;
            }
        } catch (error) {
            console.warn('⚠️ Failed to load GitHub token from server:', error);
        }
        
        // Fall back to localStorage if server fails
        const token = localStorage.getItem('github_token');
        if (token) {
            this.github.token = token;
            console.log('✅ GitHub token loaded from local storage');
            
            // Try to sync back to server
            this.setGitHubToken(token).catch(console.error);
        }
        
        return this.github.token;
    }

    /**
     * Download JSON file
     */
    downloadJSON(type, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Show product manager modal
     */
    showProductManager() {
        console.log('🔧 AdminManager.showProductManager() called');
        console.log('Products data:', this.data.products);
        
        if (!this.data.products) {
            console.error('❌ No products data available');
            alert('Products data not loaded. Please refresh the page.');
            return;
        }

        const modalContent = `
            <h3>Product Manager</h3>
            <div class="product-list">
                ${Object.entries(this.data.products).map(([key, product]) => `
                    <div class="product-item">
                        <strong>${product.name}</strong> - $${product.price}
                        <button onclick="window.adminManager.editProduct('${key}')" class="btn btn-sm btn-outline-primary">Edit</button>
                        <button onclick="window.adminManager.deleteProduct('${key}')" class="btn btn-sm btn-outline-danger">Delete</button>
                    </div>
                `).join('')}
            </div>
            
            <hr>
            <h4>Add New Product</h4>
            <form onsubmit="window.adminManager.addProduct(event)">
                <input type="text" name="key" placeholder="Product Key (e.g., focus-flow)" required>
                <input type="text" name="name" placeholder="Product Name" required>
                <input type="number" name="price" placeholder="Price" step="0.01" required>
                <input type="number" name="msrp" placeholder="MSRP" step="0.01" required>
                <textarea name="description" placeholder="Description"></textarea>
                <button type="submit" class="btn btn-primary">Add Product</button>
            </form>
            
            <hr>
            <button onclick="window.adminManager.saveProducts()" class="btn btn-success">Save Products</button>
        `;

        console.log('✅ Creating modal with content');
        this.createModal('Product Manager', modalContent);
    }

    /**
     * Show tier manager modal
     */
    showTierManager() {
        console.log('🔧 AdminManager.showTierManager() called');
        console.log('Tiers data:', this.data.tiers);
        
        if (!this.data.tiers) {
            console.error('❌ No tiers data available');
            alert('Tiers data not loaded. Please refresh the page.');
            return;
        }

        const modalContent = `
            <h3>Tier Manager</h3>
            <div class="tier-list">
                ${Object.entries(this.data.tiers).map(([key, tier]) => `
                    <div class="tier-item">
                        <strong>${tier.name}</strong> - ${tier.discount}% discount (Min: ${tier.minQuantity})
                        <button onclick="window.adminManager.editTier('${key}')" class="btn btn-sm btn-outline-primary">Edit</button>
                        <button onclick="window.adminManager.deleteTier('${key}')" class="btn btn-sm btn-outline-danger">Delete</button>
                    </div>
                `).join('')}
            </div>
            
            <hr>
            <h4>Add New Tier</h4>
            <form onsubmit="window.adminManager.addTier(event)">
                <input type="text" name="key" placeholder="Tier Key (e.g., bronze)" required>
                <input type="text" name="name" placeholder="Tier Name" required>
                <input type="number" name="minQuantity" placeholder="Minimum Quantity" required>
                <input type="number" name="discount" placeholder="Discount %" step="0.01" required>
                <button type="submit" class="btn btn-primary">Add Tier</button>
            </form>
            
            <hr>
            <button onclick="window.adminManager.saveTiers()" class="btn btn-success">Save Tiers</button>
        `;

        console.log('✅ Creating modal with content');
        this.createModal('Tier Manager', modalContent);
    }

    /**
     * Create modal dialog
     */
    createModal(title, content) {
        console.log('🔧 AdminManager.createModal() called');
        console.log('Modal title:', title);
        console.log('Modal content:', content);
        
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.innerHTML = `
            <div class="admin-modal-content">
                <div class="admin-modal-header">
                    <h3>${title}</h3>
                    <button class="admin-modal-close" onclick="window.adminManager.closeModal()">&times;</button>
                </div>
                <div class="admin-modal-body">
                    ${content}
                </div>
            </div>
        `;
        console.log('✅ Modal created');
        document.body.appendChild(modal);
    }

    /**
     * Close modal
     */
    closeModal() {
        console.log('🔧 AdminManager.closeModal() called');
        const modal = document.querySelector('.admin-modal');
        if (modal) {
            modal.remove();
            console.log('✅ Modal closed');
        }
    }

    /**
     * Add new product
     */
    addProduct(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const productData = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price')),
            msrp: parseFloat(formData.get('msrp')),
            description: formData.get('description'),
            unitsPerCase: 12,
            displayBoxesPerCase: 12,
            category: 'custom'
        };

        this.data.products[formData.get('key')] = productData;
        
        // Update calculator if available
        if (this.calculator) {
            this.calculator.data.products = this.data.products;
            this.calculator.populateProductDropdowns();
        }
        
        this.showProductManager(); // Refresh the modal
    }

    /**
     * Add new tier
     */
    addTier(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const tierData = {
            name: formData.get('name'),
            minQuantity: parseInt(formData.get('minQuantity')),
            discount: parseFloat(formData.get('discount'))
        };

        this.data.tiers[formData.get('key')] = tierData;
        
        // Update calculator if available
        if (this.calculator) {
            this.calculator.data.tiers = this.data.tiers;
        }
        
        this.showTierManager(); // Refresh the modal
    }

    /**
     * Save products
     */
    async saveProducts() {
        const success = await this.saveData('products', this.data.products);
        if (success) {
            // Update calculator data if available
            if (this.calculator) {
                this.calculator.data.products = this.data.products;
                this.calculator.populateProductDropdowns();
                this.calculator.calculateAll();
            }
            
            const message = this.github.token 
                ? '✅ Products saved to GitHub! Changes are live immediately.'
                : '✅ Products saved! Please replace the products.json file with the downloaded version to make changes permanent.';
            
            alert(message);
            this.closeModal();
        }
    }

    /**
     * Save tiers
     */
    async saveTiers() {
        const success = await this.saveData('tiers', this.data.tiers);
        if (success) {
            // Update calculator data if available
            if (this.calculator) {
                this.calculator.data.tiers = this.data.tiers;
                this.calculator.calculateAll();
            }
            
            const message = this.github.token 
                ? '✅ Tiers saved to GitHub! Changes are live immediately.'
                : '✅ Tiers saved! Please replace the tiers.json file with the downloaded version to make changes permanent.';
            
            alert(message);
            this.closeModal();
        }
    }

    /**
     * Edit product
     */
    editProduct(key) {
        const product = this.data.products[key];
        const modalContent = `
            <h3>Edit Product: ${product.name}</h3>
            <form onsubmit="window.adminManager.saveEditedProduct('${key}', event)">
                <input type="text" name="name" value="${product.name}" required>
                <input type="number" name="price" value="${product.price}" step="0.01" required>
                <input type="number" name="msrp" value="${product.msrp}" step="0.01" required>
                <textarea name="description">${product.description}</textarea>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        `;
        this.createModal('Edit Product', modalContent);
    }

    /**
     * Edit tier
     */
    editTier(key) {
        const tier = this.data.tiers[key];
        const modalContent = `
            <h3>Edit Tier: ${tier.name}</h3>
            <form onsubmit="window.adminManager.saveEditedTier('${key}', event)">
                <input type="text" name="name" value="${tier.name}" required>
                <input type="number" name="minQuantity" value="${tier.minQuantity}" required>
                <input type="number" name="discount" value="${tier.discount}" step="0.01" required>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        `;
        this.createModal('Edit Tier', modalContent);
    }

    /**
     * Save edited product
     */
    saveEditedProduct(key, event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        // Preserve existing product structure and update only changed fields
        const updatedProduct = {
            ...this.data.products[key], // Keep all existing properties
            name: formData.get('name'),
            price: parseFloat(formData.get('price')),
            msrp: parseFloat(formData.get('msrp')),
            description: formData.get('description')
        };

        this.data.products[key] = updatedProduct;
        
        // Update calculator if available
        if (this.calculator) {
            this.calculator.data.products = this.data.products;
            this.calculator.populateProductDropdowns();
        }
        
        this.closeModal();
        this.showProductManager(); // Refresh the modal
    }

    /**
     * Save edited tier
     */
    saveEditedTier(key, event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        // Preserve existing tier structure and update only changed fields
        const updatedTier = {
            ...this.data.tiers[key], // Keep all existing properties
            name: formData.get('name'),
            minQuantity: parseInt(formData.get('minQuantity')),
            discount: parseFloat(formData.get('discount'))
        };

        this.data.tiers[key] = updatedTier;
        
        // Update calculator if available
        if (this.calculator) {
            this.calculator.data.tiers = this.data.tiers;
        }
        
        this.closeModal();
        this.showTierManager(); // Refresh the modal
    }

    /**
     * Delete product
     */
    deleteProduct(key) {
        if (confirm(`Delete product: ${this.data.products[key].name}?`)) {
            delete this.data.products[key];
            
            // Update calculator if available
            if (this.calculator) {
                this.calculator.data.products = this.data.products;
                this.calculator.populateProductDropdowns();
            }
            
            this.showProductManager(); // Refresh the modal
        }
    }

    /**
     * Delete tier
     */
    deleteTier(key) {
        if (confirm(`Delete tier: ${this.data.tiers[key].name}?`)) {
            delete this.data.tiers[key];
            
            // Update calculator if available
            if (this.calculator) {
                this.calculator.data.tiers = this.data.tiers;
            }
            
            this.showTierManager(); // Refresh the modal
        }
    }

    /**
     * Show GitHub settings modal
     */
    showGitHubSettings() {
        const hasToken = !!this.github.token;
        const tokenStatus = hasToken ? '✅ Connected' : '❌ Not Connected';
        
        const modalContent = `
            <h3>GitHub Integration Settings</h3>
            <p><strong>Status:</strong> ${tokenStatus}</p>
            <p><strong>Repository:</strong> ${this.github.owner}/${this.github.repo}</p>
            <p><strong>Branch:</strong> ${this.github.branch}</p>
            
            <hr>
            <h4>Setup GitHub Token</h4>
            <p class="text-sm text-gray-600">To automatically update JSON files on GitHub, you need a Personal Access Token:</p>
            <ol class="text-sm">
                <li>Go to <a href="https://github.com/settings/tokens" target="_blank">GitHub Settings → Personal Access Tokens</a></li>
                <li>Click "Generate new token (classic)"</li>
                <li>Give it a name like "Kanva Calculator Admin"</li>
                <li>Select scope: <strong>repo</strong> (Full control of private repositories)</li>
                <li>Click "Generate token" and copy it</li>
                <li>Paste the token below:</li>
            </ol>
            
            <form onsubmit="window.adminManager.saveGitHubToken(event)">
                <input type="password" name="token" placeholder="GitHub Personal Access Token" class="form-control" style="margin-bottom: 10px;" ${hasToken ? 'value="' + '●'.repeat(20) + '"' : ''}>
                <button type="submit" class="btn btn-primary">Save Token</button>
                ${hasToken ? '<button type="button" class="btn btn-danger" onclick="window.adminManager.removeGitHubToken()">Remove Token</button>' : ''}
            </form>
            
            <hr>
            <div class="alert alert-info">
                <strong>How it works:</strong>
                <ul class="text-sm">
                    <li>✅ With token: Changes save directly to GitHub (live immediately)</li>
                    <li>❌ Without token: Downloads JSON files (manual upload required)</li>
                </ul>
            </div>
        `;

        this.createModal('GitHub Settings', modalContent);
    }

    /**
     * Save GitHub token from form
     */
    saveGitHubToken(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const token = formData.get('token').trim();
        
        if (token && !token.includes('●')) {
            this.setGitHubToken(token);
            alert('✅ GitHub token saved! Changes will now be automatically saved to GitHub.');
            this.closeModal();
        } else {
            alert('Please enter a valid GitHub token.');
        }
    }

    /**
     * Remove GitHub token
     */
    removeGitHubToken() {
        if (confirm('Remove GitHub token? You will need to manually upload JSON files after this.')) {
            this.github.token = null;
            localStorage.removeItem('github_token');
            alert('GitHub token removed. Changes will now download as files.');
            this.closeModal();
        }
    }

    /**
     * Show shipping manager modal
     */
    showShippingManager() {
        console.log('🔧 AdminManager.showShippingManager() called');
        
        if (!this.data.shipping || !this.data.shipping.zones) {
            alert('❌ Shipping data not loaded');
            return;
        }

        const zones = this.data.shipping.zones;
        const standardShipping = this.data.shipping.standardShipping || {};
        
        let zonesHtml = '';
        for (const [zoneKey, zoneData] of Object.entries(zones)) {
            const states = Array.isArray(zoneData.states) ? zoneData.states.join(', ') : '';
            const perBoxRate = standardShipping.perDisplayBox ? standardShipping.perDisplayBox[zoneKey] || 0 : 0;
            const baseRate = standardShipping.baseRate ? standardShipping.baseRate[zoneKey] || 0 : 0;
            
            zonesHtml += `
                <div class="shipping-zone-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                    <div style="display: flex; justify-content: between; align-items: center;">
                        <div style="flex: 1;">
                            <h5 style="color: ${zoneData.color || '#333'}; margin: 0 0 5px 0;">
                                ${zoneData.name} Zone (${zoneKey})
                            </h5>
                            <p style="margin: 5px 0; font-size: 14px;">
                                <strong>States:</strong> ${states}<br>
                                <strong>LTL %:</strong> ${zoneData.ltlPercentage}%<br>
                                <strong>Per Box:</strong> $${perBoxRate}<br>
                                <strong>Base Rate:</strong> $${baseRate}
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" onclick="window.adminManager.editShippingZone('${zoneKey}')">Edit</button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.adminManager.deleteShippingZone('${zoneKey}')">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }

        const modalContent = `
            <h3>Shipping Zone Manager</h3>
            
            <div class="shipping-zones-list">
                ${zonesHtml}
            </div>
            
            <hr>
            <h4>Add New Shipping Zone</h4>
            <form onsubmit="window.adminManager.addShippingZone(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <input type="text" name="zoneKey" placeholder="Zone Key (e.g., west)" class="form-control" required>
                    <input type="text" name="zoneName" placeholder="Zone Name (e.g., West)" class="form-control" required>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <input type="number" name="ltlPercentage" placeholder="LTL %" step="0.1" class="form-control" required>
                    <input type="color" name="color" value="#3b82f6" class="form-control">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <input type="number" name="perBoxRate" placeholder="Per Display Box Rate" step="0.01" class="form-control" required>
                    <input type="number" name="baseRate" placeholder="Base Rate" step="0.01" class="form-control" required>
                </div>
                <textarea name="states" placeholder="States (comma separated, e.g., CA, NV, OR)" class="form-control" style="margin-bottom: 10px;" required></textarea>
                <button type="submit" class="btn btn-primary">Add Zone</button>
            </form>
            
            <hr>
            <button class="btn btn-success" onclick="window.adminManager.saveShipping()">Save Shipping Config</button>
        `;

        this.createModal('Shipping Manager', modalContent);
    }

    /**
     * Edit shipping zone
     */
    editShippingZone(zoneKey) {
        const zone = this.data.shipping.zones[zoneKey];
        const standardShipping = this.data.shipping.standardShipping || {};
        
        if (!zone) {
            alert('Zone not found');
            return;
        }

        const perBoxRate = standardShipping.perDisplayBox ? standardShipping.perDisplayBox[zoneKey] || 0 : 0;
        const baseRate = standardShipping.baseRate ? standardShipping.baseRate[zoneKey] || 0 : 0;
        const states = Array.isArray(zone.states) ? zone.states.join(', ') : '';

        const modalContent = `
            <h3>Edit Shipping Zone: ${zone.name}</h3>
            
            <form onsubmit="window.adminManager.saveEditedShippingZone('${zoneKey}', event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label>Zone Name:</label>
                        <input type="text" name="zoneName" value="${zone.name}" class="form-control" required>
                    </div>
                    <div>
                        <label>LTL Percentage:</label>
                        <input type="number" name="ltlPercentage" value="${zone.ltlPercentage}" step="0.1" class="form-control" required>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label>Per Display Box Rate:</label>
                        <input type="number" name="perBoxRate" value="${perBoxRate}" step="0.01" class="form-control" required>
                    </div>
                    <div>
                        <label>Base Rate:</label>
                        <input type="number" name="baseRate" value="${baseRate}" step="0.01" class="form-control" required>
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label>Zone Color:</label>
                    <input type="color" name="color" value="${zone.color || '#3b82f6'}" class="form-control">
                </div>
                <div style="margin-bottom: 10px;">
                    <label>States (comma separated):</label>
                    <textarea name="states" class="form-control" required>${states}</textarea>
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" class="btn btn-secondary" onclick="window.adminManager.showShippingManager()">Back to List</button>
            </form>
        `;

        this.createModal('Edit Shipping Zone', modalContent);
    }

    /**
     * Save edited shipping zone
     */
    saveEditedShippingZone(zoneKey, event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        // Update zone data
        this.data.shipping.zones[zoneKey] = {
            ...this.data.shipping.zones[zoneKey],
            name: formData.get('zoneName'),
            ltlPercentage: parseFloat(formData.get('ltlPercentage')),
            color: formData.get('color'),
            states: formData.get('states').split(',').map(s => s.trim().toUpperCase())
        };
        
        // Update standard shipping rates
        if (!this.data.shipping.standardShipping) {
            this.data.shipping.standardShipping = { perDisplayBox: {}, baseRate: {} };
        }
        if (!this.data.shipping.standardShipping.perDisplayBox) {
            this.data.shipping.standardShipping.perDisplayBox = {};
        }
        if (!this.data.shipping.standardShipping.baseRate) {
            this.data.shipping.standardShipping.baseRate = {};
        }
        
        this.data.shipping.standardShipping.perDisplayBox[zoneKey] = parseFloat(formData.get('perBoxRate'));
        this.data.shipping.standardShipping.baseRate[zoneKey] = parseFloat(formData.get('baseRate'));
        
        alert('✅ Shipping zone updated!');
        this.showShippingManager(); // Refresh the modal
    }

    /**
     * Add new shipping zone
     */
    addShippingZone(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const zoneKey = formData.get('zoneKey').toLowerCase();
        
        if (this.data.shipping.zones[zoneKey]) {
            alert('❌ Zone key already exists');
            return;
        }
        
        // Add new zone
        this.data.shipping.zones[zoneKey] = {
            name: formData.get('zoneName'),
            ltlPercentage: parseFloat(formData.get('ltlPercentage')),
            color: formData.get('color'),
            states: formData.get('states').split(',').map(s => s.trim().toUpperCase())
        };
        
        // Add standard shipping rates
        if (!this.data.shipping.standardShipping) {
            this.data.shipping.standardShipping = { perDisplayBox: {}, baseRate: {} };
        }
        if (!this.data.shipping.standardShipping.perDisplayBox) {
            this.data.shipping.standardShipping.perDisplayBox = {};
        }
        if (!this.data.shipping.standardShipping.baseRate) {
            this.data.shipping.standardShipping.baseRate = {};
        }
        
        this.data.shipping.standardShipping.perDisplayBox[zoneKey] = parseFloat(formData.get('perBoxRate'));
        this.data.shipping.standardShipping.baseRate[zoneKey] = parseFloat(formData.get('baseRate'));
        
        alert('✅ New shipping zone added!');
        this.showShippingManager(); // Refresh the modal
    }

    /**
     * Delete shipping zone
     */
    deleteShippingZone(zoneKey) {
        if (confirm(`Delete shipping zone "${zoneKey}"? This cannot be undone.`)) {
            delete this.data.shipping.zones[zoneKey];
            
            // Also remove from standard shipping rates
            if (this.data.shipping.standardShipping) {
                if (this.data.shipping.standardShipping.perDisplayBox) {
                    delete this.data.shipping.standardShipping.perDisplayBox[zoneKey];
                }
                if (this.data.shipping.standardShipping.baseRate) {
                    delete this.data.shipping.standardShipping.baseRate[zoneKey];
                }
            }
            
            alert('✅ Shipping zone deleted!');
            this.showShippingManager(); // Refresh the modal
        }
    }

    /**
     * Save shipping configuration
     */
    async saveShipping() {
        const success = await this.saveData('shipping', this.data.shipping);
        if (success) {
            // Update calculator data if available
            if (this.calculator) {
                this.calculator.data.shipping = this.data.shipping;
                this.calculator.populateStateDropdown();
                this.calculator.calculateAll();
            }
            
            const message = this.github.token 
                ? '✅ Shipping config saved to GitHub! Changes are live immediately.'
                : '✅ Shipping config saved! Please replace the shipping.json file with the downloaded version to make changes permanent.';
            
            alert(message);
            this.closeModal();
        }
    }
}

// Global admin manager instance
let adminManager;