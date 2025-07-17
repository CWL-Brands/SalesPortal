/**
 * Enhanced Admin Dashboard for Kanva Quotes
 * Integrates admin functionality with modern UI and Kanva branding
 */

class AdminDashboard {
    constructor(options = {}) {
        this.calculator = options.calculator || window.calculator;
        this.adminManager = options.adminManager || window.adminManager;
        this.container = null;
        this.floatingButton = null;
        this.loginModal = null;
        this.adminModal = null;
        this.isInitialized = false;
        this.isLoggedIn = false;
        this.currentSection = 'products';
        
        // Admin emails loaded from data file
        this.adminEmails = [];
        this.defaultPassword = 'K@nva2025'; // Default password for all admin emails
        
        // Load admin emails
        this.loadAdminEmails();
        
        console.log('🎛️ AdminDashboard instance created');
    }

    /**
     * Load admin emails from data file
     */
    async loadAdminEmails() {
        try {
            const response = await fetch('data/admin-emails.json');
            if (response.ok) {
                this.adminEmails = await response.json();
                console.log('✅ Admin emails loaded:', this.adminEmails.length, 'emails');
            } else {
                console.warn('⚠️ Could not load admin emails, using fallback');
                this.adminEmails = ['admin@kanvabotanicals.com'];
            }
        } catch (error) {
            console.error('❌ Error loading admin emails:', error);
            this.adminEmails = ['admin@kanvabotanicals.com'];
        }
    }

    /**
     * Initialize the admin dashboard
     */
    init() {
        if (this.isInitialized) {
            console.log('⚠️ AdminDashboard already initialized, skipping...');
            return;
        }
        
        console.log('🔄 Initializing AdminDashboard...');
        
        try {
            // Create UI elements
            this.createFloatingButton();
            this.createLoginModal();
            this.createAdminModal();
            
            // Bind events
            this.bindEvents();
            
            // Load data
            this.loadProductsData();
            this.loadTiersData();
            this.loadShippingData();
            this.loadIntegrationsData();
            
            this.isInitialized = true;
            console.log('✅ AdminDashboard initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing AdminDashboard:', error);
            throw error;
        }
    }
    
    /**
     * Create floating admin button
     */
    createFloatingButton() {
        // Remove existing button if any
        const existing = document.getElementById('floating-admin-btn');
        if (existing) {
            existing.remove();
        }

        this.floatingButton = document.createElement('button');
        this.floatingButton.id = 'floating-admin-btn';
        this.floatingButton.className = 'floating-admin-btn';
        this.floatingButton.innerHTML = 'Admin';
        this.floatingButton.title = 'Admin Panel';
        
        // Force append to body to ensure it's visible
        setTimeout(() => {
            document.body.appendChild(this.floatingButton);
            console.log('✅ Floating admin button created and appended to body');
        }, 500); // Small delay to ensure DOM is ready
    }

    /**
     * Create login modal
     */
    createLoginModal() {
        this.loginModal = document.createElement('div');
        this.loginModal.id = 'admin-login-modal';
        this.loginModal.className = 'modal';
        this.loginModal.style.display = 'none';
        
        this.loginModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; height: auto; margin: 10% auto;">
                <div class="admin-header">
                    <h2>🔐 Admin Login</h2>
                    <button class="close-btn" onclick="window.adminDashboard.hideLoginModal()">&times;</button>
                </div>
                <div class="admin-content" style="padding: 30px;">
                    <form id="admin-login-form" style="display: flex; flex-direction: column; gap: 20px;">
                        <div class="form-group">
                            <label for="admin-email" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--kanva-dark-blue);">Admin Email</label>
                            <input type="email" id="admin-email" class="form-control" placeholder="Enter admin email" style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;" required>
                        </div>
                        <div class="form-group">
                            <label for="admin-password" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--kanva-dark-blue);">Password</label>
                            <div class="password-input-container" style="position: relative;">
                                <input type="text" id="admin-password" class="form-control" placeholder="Enter admin password" style="width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 6px; font-size: 14px;" required>
                                <!-- Password toggle button removed - password is now always visible -->
                            </div>
                        </div>
                        <div id="login-error" style="color: var(--admin-danger); font-size: 14px; display: none;"></div>
                        <button type="submit" class="btn btn-primary" style="padding: 12px 24px; font-size: 16px;">Login</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.loginModal);
        console.log('✅ Login modal created');
    }

    /**
     * Create main admin modal
     */
    createAdminModal() {
        this.adminModal = document.createElement('div');
        this.adminModal.id = 'admin-modal';
        this.adminModal.className = 'modal';
        this.adminModal.style.display = 'none';
        
        this.adminModal.innerHTML = `
            <div class="modal-content">
                <div class="admin-header">
                    <h2>🎛️ Admin Dashboard</h2>
                    <button class="close-btn" onclick="window.adminDashboard.hideAdminModal()">&times;</button>
                </div>
                <div class="admin-navigation">
                    <button class="nav-btn active" data-section="products">
                        📦 Manage Products
                    </button>
                    <button class="nav-btn" data-section="tiers">
                        📊 Manage Tiers
                    </button>
                    <button class="nav-btn" data-section="shipping">
                        🚚 Manage Shipping
                    </button>
                    <button class="nav-btn" data-section="integrations">
                        🔗 Integrations
                    </button>
                    <button class="nav-btn btn-danger" data-section="logout">
                        🚪 Logout
                    </button>
                </div>
                <div class="admin-content">
                    <div id="admin-section-content">
                        <!-- Content will be dynamically loaded -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.adminModal);
        console.log('✅ Admin modal created');
    }

    /**
     * Bind events to floating button, login modal, and admin modal
     */
    bindEvents() {
        this.floatingButton.addEventListener('click', () => {
            if (!this.isLoggedIn) {
                this.showLoginModal();
            } else {
                this.showAdminModal();
            }
        });

        document.getElementById('admin-login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('admin-email').value.toLowerCase().trim();
            const password = document.getElementById('admin-password').value;
            
            // Debug logging
            console.log('🔍 Login attempt:');
            console.log('  Email entered:', email);
            console.log('  Password entered:', password);
            console.log('  Expected password:', this.defaultPassword);
            console.log('  Available admin emails:', this.adminEmails);
            console.log('  Password match:', password === this.defaultPassword);
            
            // Check if email is in admin list and password matches
            const isValidAdmin = this.adminEmails.some(adminEmail => 
                adminEmail.toLowerCase() === email
            );
            
            console.log('  Email is valid admin:', isValidAdmin);
            
            if (isValidAdmin && password === this.defaultPassword) {
                this.isLoggedIn = true;
                this.currentAdminEmail = email;
                this.loginModal.style.display = 'none';
                this.showAdminModal();
                
                console.log('✅ Admin logged in:', email);
                
                // Clear form
                document.getElementById('admin-email').value = '';
                document.getElementById('admin-password').value = '';
            } else {
                alert('Invalid credentials. Please check your email and password.');
                console.warn('❌ Failed login attempt for:', email);
            }
        });

        // Use event delegation for navigation buttons since they're created dynamically
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                const section = e.target.dataset.section;
                this.showAdminSection(section);
            }
        });
    }

    /**
     * Show login modal
     */
    showLoginModal() {
        this.loginModal.style.display = 'block';
    }

    /**
     * Hide login modal
     */
    hideLoginModal() {
        this.loginModal.style.display = 'none';
    }

    /**
     * Show admin modal
     */
    showAdminModal() {
        this.adminModal.style.display = 'block';
        this.showAdminSection('products'); // Default to products section
    }

    /**
     * Hide admin modal
     */
    hideAdminModal() {
        this.adminModal.style.display = 'none';
    }

    /**
     * Show admin section
     */
    showAdminSection(section) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === section) {
                btn.classList.add('active');
            }
        });

        const content = document.getElementById('admin-section-content');
        content.innerHTML = '';

        switch (section) {
            case 'products':
                content.innerHTML = this.renderProductsSection();
                break;
            case 'tiers':
                content.innerHTML = this.renderTiersSection();
                break;
            case 'shipping':
                content.innerHTML = this.renderShippingSection();
                break;
            case 'integrations':
                content.innerHTML = this.renderIntegrationsSection();
                break;
            case 'logout':
                this.isLoggedIn = false;
                this.hideAdminModal();
                break;
        }
    }

    /**
     * Render products section with real data
     */
    renderProductsSection() {
        // Load products data and render table
        this.loadProductsData();
        
        return `
            <div class="card">
                <h3>📦 Product Management</h3>
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="window.adminDashboard.addNewProduct()">
                        <span class="icon">➕</span> Add New Product
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshProductsData()">
                        <span class="icon">🔄</span> Refresh Data
                    </button>
                    <button class="btn btn-warning" onclick="window.adminDashboard.exportProductsData()">
                        <span class="icon">📄</span> Export Data
                    </button>
                </div>
                
                <div class="data-table-container">
                    <table class="admin-data-table" id="products-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Image</th>
                                <th>Product Name</th>
                                <th>Price</th>
                                <th>MSRP</th>
                                <th>Cost</th>
                                <th>Category</th>
                                <th>Units/Case</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="products-table-body">
                            <tr><td colspan="10" class="loading-row">Loading products data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    /**
     * Load products data from JSON file
     */
    async loadProductsData() {
        try {
            console.log('🔄 Loading products data...');
            const response = await fetch('data/products.json');
            if (response.ok) {
                const productsData = await response.json();
                console.log('✅ Products data loaded:', productsData);
                
                // Convert object to array format for table rendering
                const productsArray = Object.entries(productsData).map(([id, product]) => ({
                    id,
                    name: product.name,
                    price: product.price,
                    msrp: product.msrp,
                    cost: (product.price * 0.7).toFixed(2), // Estimated cost
                    category: product.category,
                    unitsPerCase: product.unitsPerCase,
                    active: true // Default to active
                }));
                
                console.log('📊 Processed products array:', productsArray);
                this.renderProductsTable(productsArray);
            } else {
                console.error('❌ Failed to load products data:', response.status, response.statusText);
                this.renderProductsError();
            }
        } catch (error) {
            console.error('❌ Error loading products:', error);
            this.renderProductsError();
        }
    }
    
    /**
     * Render products table with data
     */
    renderProductsTable(products) {
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = products.map(product => {
            // Get image source - use product image or fallback to logo
            const imageSrc = product.picture || 'assets/logo/Kanva_Logo_White_Master.png';
            
            return `
                <tr data-product-id="${product.id}">
                    <td class="product-id">${product.id}</td>
                    <td class="product-image">
                        <img src="${imageSrc}" alt="${product.name}" class="product-thumbnail" 
                             onerror="this.src='assets/logo/Kanva_Logo_White_Master.png'" />
                    </td>
                    <td class="product-name editable" data-field="name">${product.name}</td>
                    <td class="product-price editable" data-field="price">$${product.price}</td>
                    <td class="product-msrp editable" data-field="msrp">$${product.msrp || 'N/A'}</td>
                    <td class="product-cost editable" data-field="cost">$${product.cost || 'N/A'}</td>
                    <td class="product-category editable" data-field="category">${product.category}</td>
                    <td class="product-units editable" data-field="unitsPerCase">${product.unitsPerCase || 1}</td>
                    <td class="product-status">
                        <span class="status-badge status-${product.active ? 'active' : 'inactive'}">
                            ${product.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td class="product-actions">
                        <button class="btn-small btn-edit" onclick="window.adminDashboard.editProduct('${product.id}')" title="Edit Product">
                            ✏️
                        </button>
                        <button class="btn-small btn-toggle" onclick="window.adminDashboard.toggleProductStatus('${product.id}')" title="Toggle Status">
                            ${product.active ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteProduct('${product.id}')" title="Delete Product">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add click listeners for inline editing
        this.setupInlineEditing();
    }
    
    /**
     * Render error state for products table
     */
    renderProductsError() {
        const tbody = document.getElementById('products-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="error-row">
                        ❌ Failed to load products data. 
                        <button onclick="window.adminDashboard.loadProductsData()" class="btn btn-small">
                            Try Again
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Load tiers data from JSON file
     */
    async loadTiersData() {
        try {
            console.log('🔄 Loading tiers data...');
            const response = await fetch('data/tiers.json');
            if (response.ok) {
                const tiersData = await response.json();
                console.log('✅ Tiers data loaded:', tiersData);
                
                // Convert object to array format for table rendering
                const tiersArray = Object.entries(tiersData).map(([id, tier]) => ({
                    id,
                    name: tier.name,
                    minQuantity: tier.minQuantity || tier.threshold,
                    discount: tier.discount,
                    description: tier.description,
                    active: true
                }));
                
                console.log('📊 Processed tiers array:', tiersArray);
                this.renderTiersTable(tiersArray);
            } else {
                console.error('❌ Failed to load tiers data:', response.status, response.statusText);
                this.renderTiersError();
            }
        } catch (error) {
            console.error('❌ Error loading tiers:', error);
            this.renderTiersError();
        }
    }

    /**
     * Load shipping data from JSON file
     */
    async loadShippingData() {
        try {
            console.log('🔄 Loading shipping data...');
            const response = await fetch('data/shipping.json');
            if (response.ok) {
                const shippingData = await response.json();
                console.log('✅ Shipping data loaded:', shippingData);
                
                // Convert zones object to array format for table rendering
                const zonesArray = Object.entries(shippingData.zones || {}).map(([id, zone]) => ({
                    id,
                    name: zone.name,
                    ltlPercentage: zone.ltlPercentage,
                    states: Array.isArray(zone.states) ? zone.states.join(', ') : '',
                    color: zone.color || '#4CAF50',
                    active: true
                }));
                
                console.log('📊 Processed shipping zones array:', zonesArray);
                this.renderShippingTable(zonesArray);
            } else {
                console.error('❌ Failed to load shipping data:', response.status, response.statusText);
                this.renderShippingError();
            }
        } catch (error) {
            console.error('❌ Error loading shipping:', error);
            this.renderShippingError();
        }
    }

/**
 * Render tiers table with data
 */
renderTiersTable(tiers) {
    const tbody = document.getElementById('tiers-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = tiers.map(tier => `
        <tr data-tier-id="${tier.id}">
            <td class="tier-id">${tier.id}</td>
            <td class="tier-name editable" data-field="name">${tier.name}</td>
            <td class="tier-min-qty editable" data-field="minQuantity">${tier.minQuantity}</td>
            <td class="tier-discount editable" data-field="discount">${(tier.discount * 100).toFixed(1)}%</td>
            <td class="tier-description editable" data-field="description">${tier.description || ''}</td>
            <td class="tier-status">
                <span class="status-badge status-active">✓ Active</span>
            </td>
            <td class="tier-actions">
                <button class="btn-small btn-edit" onclick="window.adminDashboard.editTier('${tier.id}')" title="Edit Tier">
                    ✏️
                </button>
                <button class="btn-small btn-toggle" onclick="window.adminDashboard.toggleTierStatus('${tier.id}')" title="Toggle Status">
                    ⏸️
                </button>
                <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteTier('${tier.id}')" title="Delete Tier">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add click listeners for inline editing
    this.setupInlineEditing();
}

/**
 * Render shipping table with data
 */
renderShippingTable(zones) {
    const tbody = document.getElementById('shipping-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = zones.map(zone => `
        <tr data-zone-id="${zone.id}">
            <td class="zone-id">${zone.id}</td>
            <td class="zone-name editable" data-field="name">${zone.name}</td>
            <td class="zone-ltl editable" data-field="ltlPercentage">${zone.ltlPercentage}%</td>
            <td class="zone-states" title="${zone.states}">${zone.states.length > 50 ? zone.states.substring(0, 50) + '...' : zone.states}</td>
            <td class="zone-color">
                <div class="color-indicator" style="background-color: ${zone.color}; width: 20px; height: 20px; border-radius: 3px; display: inline-block;"></div>
            </td>
            <td class="zone-status">
                <span class="status-badge status-active">✓ Active</span>
            </td>
            <td class="zone-actions">
                <button class="btn-small btn-edit" onclick="window.adminDashboard.editShippingZone('${zone.id}')" title="Edit Zone">
                    ✏️
                </button>
                <button class="btn-small btn-toggle" onclick="window.adminDashboard.toggleShippingZoneStatus('${zone.id}')" title="Toggle Status">
                    ⏸️
                </button>
                <button class="btn-small btn-delete" onclick="window.adminDashboard.deleteShippingZone('${zone.id}')" title="Delete Zone">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add click listeners for inline editing
    this.setupInlineEditing();
}

/**
 * Render error state for tiers table
 */
renderTiersError() {
    const tbody = document.getElementById('tiers-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    ❌ Failed to load tiers data. 
                    <button onclick="window.adminDashboard.loadTiersData()" class="btn btn-small">
                        Try Again
                    </button>
                </td>
            </tr>
        `;
    }
}

/**
 * Render error state for shipping table
 */
renderShippingError() {
    const tbody = document.getElementById('shipping-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="error-row">
                    ❌ Failed to load shipping data. 
                    <button onclick="window.adminDashboard.loadShippingData()" class="btn btn-small">
                        Try Again
                    </button>
                </td>
            </tr>
        `;
    }
}

/**
 * Setup inline editing for data tables
 */
setupInlineEditing() {
    const editableCells = document.querySelectorAll('.editable');
    editableCells.forEach(cell => {
        cell.addEventListener('click', (e) => {
            this.startInlineEdit(e.target);
        });
    });
}

/**
 * Start inline editing for a cell
 */
startInlineEdit(cell) {
    if (cell.classList.contains('editing')) return;
    
    const originalValue = cell.textContent.replace('$', '');
    const field = cell.dataset.field;
    
    cell.classList.add('editing');
    cell.innerHTML = `
        <input type="text" 
               value="${originalValue}" 
               class="inline-edit-input"
               data-original="${originalValue}"
               onblur="window.adminDashboard.finishInlineEdit(this)"
               onkeydown="window.adminDashboard.handleInlineEditKey(event, this)">
    `;
    
    const input = cell.querySelector('input');
    input.focus();
    input.select();
}

/**
 * Handle keyboard events in inline edit
 */
handleInlineEditKey(event, input) {
    if (event.key === 'Enter') {
        this.finishInlineEdit(input);
    } else if (event.key === 'Escape') {
        this.cancelInlineEdit(input);
    }
}

/**
 * Finish inline editing
 */
finishInlineEdit(input) {
    const cell = input.parentElement;
    const newValue = input.value;
    const originalValue = input.dataset.original;
    const field = cell.dataset.field;
    const row = cell.closest('tr');
    const productId = row.dataset.productId;
    
    if (newValue !== originalValue) {
        // Save the change
        this.saveProductField(productId, field, newValue);
        
        // Update display
        let displayValue = newValue;
        if (field === 'price' || field === 'msrp' || field === 'cost') {
            displayValue = `$${newValue}`;
        }
        
        cell.innerHTML = displayValue;
        cell.classList.add('field-updated');
        
        // Remove the updated class after animation
        setTimeout(() => {
            cell.classList.remove('field-updated');
        }, 2000);
    } else {
        cell.innerHTML = field.includes('price') || field.includes('msrp') || field.includes('cost') 
            ? `$${originalValue}` : originalValue;
    }
    
    cell.classList.remove('editing');
}

/**
 * Cancel inline editing
 */
cancelInlineEdit(input) {
    const cell = input.parentElement;
    const originalValue = input.dataset.original;
    const field = cell.dataset.field;
    
    const displayValue = field.includes('price') || field.includes('msrp') || field.includes('cost') 
        ? `$${originalValue}` : originalValue;
        
    cell.innerHTML = displayValue;
    cell.classList.remove('editing');
}

/**
 * Save product field change
 */
async saveProductField(productId, field, value) {
        try {
            console.log(`💾 Saving ${field} = ${value} for product ${productId}`);
            
            // Here you would typically make an API call to save the data
            // For now, we'll just show a success message
            
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.innerHTML = `✅ ${field} updated for product ${productId}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
            
        } catch (error) {
            console.error('Error saving product field:', error);
            alert(`❌ Failed to save ${field} change`);
        }
    }
    
    /**
     * Edit product in modal
     */
    editProduct(productId) {
        console.log(`✏️ Editing product ${productId}`);
        
        // Create and show edit modal
        this.showProductEditModal(productId);
    }
    
    /**
     * Toggle product active status
     */
    async toggleProductStatus(productId) {
        console.log(`🔄 Toggling status for product ${productId}`);
        
        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
        if (row) {
            const statusCell = row.querySelector('.product-status');
            const statusBadge = statusCell.querySelector('.status-badge');
            const actionButton = row.querySelector('.btn-toggle');
            
            const isActive = statusBadge.classList.contains('status-active');
            const newStatus = !isActive;
            
            // Update UI
            statusBadge.className = `status-badge status-${newStatus ? 'active' : 'inactive'}`;
            statusBadge.textContent = newStatus ? 'Active' : 'Inactive';
            actionButton.innerHTML = newStatus ? '⏸️' : '▶️';
            actionButton.title = newStatus ? 'Deactivate Product' : 'Activate Product';
            
            // Save change
            await this.saveProductField(productId, 'active', newStatus);
        }
    }
    
    /**
     * Delete product
     */
    deleteProduct(productId) {
        if (confirm(`⚠️ Are you sure you want to delete product ${productId}?\n\nThis action cannot be undone.`)) {
            console.log(`🗑️ Deleting product ${productId}`);
            
            const row = document.querySelector(`tr[data-product-id="${productId}"]`);
            if (row) {
                row.style.opacity = '0.5';
                row.style.transform = 'scale(0.95)';
                
                setTimeout(() => {
                    row.remove();
                    this.showNotification(`Product ${productId} deleted successfully`, 'success');
                }, 300);
            }
        }
    }
    
    /**
     * Add new product
     */
    addNewProduct() {
        console.log('➕ Adding new product');
        this.showProductEditModal();
    }
    
    /**
     * Refresh products data
     */
    refreshProductsData() {
        console.log('🔄 Refreshing products data');
        this.loadProductsData();
        this.showNotification('Products data refreshed', 'info');
    }
    
    /**
     * Export products data
     */
    exportProductsData() {
        console.log('📄 Exporting products data');
        
        // Get table data
        const table = document.getElementById('products-table');
        if (table) {
            const data = this.tableToCSV(table);
            this.downloadCSV(data, 'kanva-products.csv');
            this.showNotification('Products data exported', 'success');
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `admin-notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Show product edit modal
     */
    showProductEditModal(productId = null) {
        const isEdit = productId !== null;
        const title = isEdit ? `Edit Product ${productId}` : 'Add New Product';
        
        const modalHTML = `
            <div class="product-edit-modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form class="product-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Product Name:</label>
                                <input type="text" name="name" required>
                            </div>
                            <div class="form-group">
                                <label>Category:</label>
                                <select name="category" required>
                                    <option value="">Select Category</option>
                                    <option value="Topicals">Topicals</option>
                                    <option value="Edibles">Edibles</option>
                                    <option value="Tinctures">Tinctures</option>
                                    <option value="Accessories">Accessories</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Price ($):</label>
                                <input type="number" name="price" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label>MSRP ($):</label>
                                <input type="number" name="msrp" step="0.01">
                            </div>
                            <div class="form-group">
                                <label>Cost ($):</label>
                                <input type="number" name="cost" step="0.01">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Units per Case:</label>
                                <input type="number" name="unitsPerCase" value="1" min="1">
                            </div>
                            <div class="form-group">
                                <label>Status:</label>
                                <select name="active">
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group" style="width: 100%;">
                                <label>Product Picture:</label>
                                <div class="image-upload-container">
                                    <input type="file" name="picture" accept="image/*" class="file-input-hidden" onchange="window.adminDashboard.handlePictureUpload(event)">
                                    <div class="picture-preview">
                                        <img class="image-preview" src="assets/logo/Kanva_Logo_White_Master.png" alt="Product preview">
                                        <div class="upload-placeholder" style="color: #6c757d; font-size: 14px; margin-top: 10px;">
                                            📷 Click to upload product image (200x200 recommended)
                                        </div>
                                    </div>
                                    <button type="button" class="image-upload-btn" onclick="this.parentElement.querySelector('input[type=file]').click()">
                                        Choose Image
                                    </button>
                                    <button type="button" class="btn btn-outline-secondary" onclick="window.adminDashboard.clearPictureUpload(this)" style="display: none; margin-top: 8px;">
                                        Remove Image
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${isEdit ? 'Update' : 'Create'} Product
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = modalHTML;
        document.body.appendChild(overlay);
        
        // If editing, populate form with existing data
        if (isEdit) {
            this.populateProductForm(productId);
        }
        
        // Handle click outside modal to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // Handle form submission
        const form = overlay.querySelector('.product-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable form during submission
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            
            try {
                await this.saveProductForm(form, productId);
                overlay.remove();
            } catch (error) {
                console.error('Error saving product:', error);
                this.showNotification('Failed to save product. Please try again.', 'error');
            } finally {
                // Re-enable form
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    /**
     * Resize image to thumbnail size
     */
    resizeImage(file, maxWidth = 200, maxHeight = 200, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and resize image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64
                const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(resizedDataUrl);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Populate product form with existing data
     */
    populateProductForm(productId) {
        // Find the product data
        const product = this.productsData.find(p => p.id === productId);
        if (!product) return;
        
        const form = document.querySelector('.product-form');
        if (!form) return;
        
        // Populate form fields
        form.querySelector('input[name="name"]').value = product.name || '';
        form.querySelector('select[name="category"]').value = product.category || '';
        form.querySelector('input[name="price"]').value = product.price || '';
        form.querySelector('input[name="msrp"]').value = product.msrp || '';
        form.querySelector('input[name="cost"]').value = product.cost || '';
        form.querySelector('input[name="unitsPerCase"]').value = product.unitsPerCase || 1;
        form.querySelector('select[name="active"]').value = product.active ? 'true' : 'false';
        
        // Handle existing product image
        const container = form.querySelector('.image-upload-container');
        const previewImg = container.querySelector('.image-preview');
        const placeholder = container.querySelector('.upload-placeholder');
        const removeBtn = container.querySelector('.btn-outline-secondary');
        const fileInput = container.querySelector('input[type="file"]');
        
        if (product.picture) {
            // Use existing product image
            previewImg.src = product.picture;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
            
            // Store existing image data
            fileInput.setAttribute('data-image-data', product.picture);
            
            console.log('✅ Loaded existing product image for editing');
        } else {
            // Use fallback logo as placeholder
            previewImg.src = 'assets/logo/Kanva_Logo_White_Master.png';
            previewImg.style.display = 'block';
            placeholder.style.display = 'block';
            placeholder.textContent = '📷 Click to upload product image (200x200 recommended)';
            removeBtn.style.display = 'none';
            
            // Don't store fallback image as data - let user choose to keep or replace
            fileInput.removeAttribute('data-image-data');
            
            console.log('🖼️ Using fallback logo for product without image');
        }
    }

    /**
     * Save product form data
     */
    async saveProductForm(form, productId) {
        const formData = new FormData(form);
        const fileInput = form.querySelector('input[name="picture"]');
        const imageData = fileInput.getAttribute('data-image-data');
        
        // Create product object
        const productData = {
            name: formData.get('name'),
            category: formData.get('category'),
            price: parseFloat(formData.get('price')) || 0,
            msrp: parseFloat(formData.get('msrp')) || 0,
            cost: parseFloat(formData.get('cost')) || 0,
            unitsPerCase: parseInt(formData.get('unitsPerCase')) || 1,
            active: formData.get('active') === 'true',
            picture: imageData || null
        };
        
        let isNewProduct = false;
        let productKey = '';
        
        if (productId) {
            // Update existing product
            const productIndex = this.productsData.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                // Preserve the product ID
                productData.id = productId;
                
                // If no new image was uploaded, keep the existing one
                if (!productData.picture && this.productsData[productIndex].picture) {
                    productData.picture = this.productsData[productIndex].picture;
                    console.log('✅ Preserved existing product image');
                }
                
                this.productsData[productIndex] = { ...this.productsData[productIndex], ...productData };
                productKey = this.productsData[productIndex].name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                this.showNotification(`Product "${productData.name}" updated successfully`, 'success');
            }
        } else {
            // Add new product
            isNewProduct = true;
            const newProduct = {
                id: `PROD-${Date.now()}`,
                ...productData
            };
            this.productsData.push(newProduct);
            productKey = newProduct.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            this.showNotification(`Product "${productData.name}" created successfully`, 'success');
        }
        
        // Refresh the products table
        this.renderProductsTable();
        
        // Save to Git repository if AdminManager is available
        if (this.adminManager && typeof this.adminManager.saveData === 'function') {
            try {
                // Show saving notification
                this.showNotification('Saving to Git repository...', 'info');
                
                // Convert products array to object format for Git storage
                const productsForGit = {};
                this.productsData.forEach(product => {
                    // Use a clean key based on product name
                    const key = product.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    
                    // Ensure we have all required fields
                    productsForGit[key] = {
                        id: product.id,
                        name: product.name,
                        category: product.category || '',
                        price: product.price || 0,
                        msrp: product.msrp || 0,
                        cost: product.cost || 0,
                        unitsPerCase: product.unitsPerCase || 1,
                        active: product.active !== undefined ? product.active : true,
                        picture: product.picture || null,
                        description: product.description || '',
                        displayBoxesPerCase: product.displayBoxesPerCase || product.unitsPerCase || 1,
                        lastUpdated: new Date().toISOString()
                    };
                });
                
                // Log the product being saved for debugging
                if (productKey && productsForGit[productKey]) {
                    const savedProduct = productsForGit[productKey];
                    console.log(`Saving product ${savedProduct.id} with image: ${savedProduct.picture ? 'Yes (length: ' + savedProduct.picture.substring(0, 30) + '...)' : 'No'}`);
                }
                
                // Save to Git
                const success = await this.adminManager.saveData('products', productsForGit);
                
                if (success) {
                    this.showNotification(
                        `Product data saved to Git repository! ${isNewProduct ? 'New product' : 'Product updates'} are now live.`,
                        'success'
                    );
                    console.log('✅ Products saved to Git repository successfully');
                } else {
                    this.showNotification(
                        'Product saved locally but failed to sync with Git repository. Changes may not persist.',
                        'warning'
                    );
                    console.warn('⚠️ Failed to save products to Git repository');
                }
            } catch (error) {
                console.error('❌ Error saving to Git:', error);
                this.showNotification(
                    'Product saved locally but Git sync failed. Please check your connection.',
                    'warning'
                );
            }
        } else {
            console.warn('⚠️ AdminManager or saveData method not available');
            this.showNotification(
                'Product saved locally. Git integration not available.',
                'warning'
            );
        }
    }
    
    /**
     * Convert table to CSV
     */
    tableToCSV(table) {
        const rows = [];
        const headers = Array.from(table.querySelectorAll('thead th'))
            .map(th => th.textContent.trim());
        rows.push(headers.join(','));
        
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'))
                .slice(0, -1) // Exclude actions column
                .map(td => {
                    let text = td.textContent.trim();
                    // Handle CSV escaping
                    if (text.includes(',') || text.includes('"')) {
                        text = `"${text.replace(/"/g, '""')}"`;
                    }
                    return text;
                });
            rows.push(cells.join(','));
        });
        
        return rows.join('\n');
    }
    
    /**
     * Download CSV file
     */
    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Render tiers section
     */
    renderTiersSection() {
        // Load tiers data and render table
        this.loadTiersData();
        
        return `
            <div class="card">
                <h3>📊 Tier Management</h3>
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="window.adminDashboard.addNewTier()">
                        <span class="icon">➕</span> Add New Tier
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshTiersData()">
                        <span class="icon">🔄</span> Refresh
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.exportTiersData()">
                        <span class="icon">📄</span> Export CSV
                    </button>
                </div>
                <div class="table-container">
                    <table id="tiers-table" class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Min Quantity</th>
                                <th>Discount %</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tiers-table-body">
                            <tr><td colspan="7" class="loading-row">Loading tiers data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render shipping section
     */
    renderShippingSection() {
        // Load shipping data and render table
        this.loadShippingData();
        
        return `
            <div class="card">
                <h3>🚚 Shipping Management</h3>
                <div class="admin-actions">
                    <button class="btn btn-primary" onclick="window.adminDashboard.addNewShippingZone()">
                        <span class="icon">➕</span> Add New Zone
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.refreshShippingData()">
                        <span class="icon">🔄</span> Refresh
                    </button>
                    <button class="btn btn-secondary" onclick="window.adminDashboard.exportShippingData()">
                        <span class="icon">📄</span> Export CSV
                    </button>
                </div>
                <div class="table-container">
                    <table id="shipping-table" class="data-table">
                        <thead>
                            <tr>
                                <th>Zone ID</th>
                                <th>Zone Name</th>
                                <th>LTL Rate %</th>
                                <th>States</th>
                                <th>Color</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="shipping-table-body">
                            <tr><td colspan="7" class="loading-row">Loading shipping data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render integrations section
     */
    renderIntegrationsSection() {
        return `
            <div class="integrations-section">
                <div class="section-header">
                    <h2>🔗 Integrations</h2>
                    <button class="btn btn-accent" onclick="window.adminDashboard.runIntegrationValidation()">
                        🔍 Validate All Integrations
                    </button>
                </div>
                
                <div class="integration-cards">
                    <!-- GitHub Integration -->
                    <div class="integration-card">
                        <div class="integration-header">
                            <h3>💙 GitHub Integration</h3>
                            <div class="integration-status" id="github-status">
                                <span class="status-indicator status-unknown">❔</span>
                                <span>Not Tested</span>
                            </div>
                        </div>
                        <div class="integration-content">
                            <div class="form-group">
                                <label>Repository Owner:</label>
                                <input type="text" id="github-owner" value="benatkanva" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Repository Name:</label>
                                <input type="text" id="github-repo" value="kanva-quotes" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Access Token:</label>
                                <input type="password" id="github-token" placeholder="Enter GitHub token" class="form-control">
                            </div>
                            <div class="integration-actions">
                                <button class="btn btn-primary" onclick="window.adminDashboard.testGitHubIntegration()">
                                    🧪 Test Connection
                                </button>
                                <button class="btn btn-secondary" onclick="window.adminDashboard.saveGitHubSettings()">
                                    💾 Save Settings
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Copper CRM Integration -->
                    <div class="integration-card">
                        <div class="integration-header">
                            <h3>🥇 Copper CRM</h3>
                            <div class="integration-status" id="copper-status">
                                <span class="status-indicator status-unknown">❓</span>
                                <span>Not Tested</span>
                            </div>
                        </div>
                        <div class="integration-content">
                            <p>Configure Copper CRM API credentials to enable customer data auto-population and activity logging.</p>
                            <div class="form-group">
                                <label>API Key:</label>
                                <input type="password" id="copper-api-key" placeholder="Enter Copper API key" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Email Address:</label>
                                <input type="email" id="copper-email" placeholder="Enter Copper user email" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Environment:</label>
                                <select id="copper-environment" class="form-control">
                                    <option value="production">Production</option>
                                    <option value="sandbox">Sandbox</option>
                                </select>
                            </div>
                            <div class="integration-features">
                                <div class="feature-item">
                                    <span class="feature-icon">👥</span>
                                    <span>Customer Auto-Population</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-icon">💾</span>
                                    <span>Quote Activity Logging</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-icon">📧</span>
                                    <span>Email Activity Tracking</span>
                                </div>
                            </div>
                            <div class="integration-actions">
                                <button class="btn btn-primary" onclick="window.adminDashboard.testCopperIntegration()">
                                    🧪 Test Connection
                                </button>
                                <button class="btn btn-secondary" onclick="window.adminDashboard.saveCopperSettings()">
                                    💾 Save Settings
                                </button>
                                <button class="btn btn-secondary" onclick="window.adminDashboard.viewCopperLogs()">
                                    📔 View Activity Logs
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Fishbowl ERP Integration -->
                    <div class="integration-card">
                        <div class="integration-header">
                            <h3>🐟 Fishbowl ERP</h3>
                            <div class="integration-status" id="fishbowl-status">
                                <span class="status-indicator status-unknown">❓</span>
                                <span>Not Tested</span>
                            </div>
                        </div>
                        <div class="integration-content">
                            <p>Configure Fishbowl ERP connection to enable inventory synchronization and order management.</p>
                            <div class="form-group">
                                <label>Host:</label>
                                <input type="text" id="fishbowl-host" placeholder="Fishbowl server hostname or IP" value="localhost" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Port:</label>
                                <input type="text" id="fishbowl-port" placeholder="Fishbowl server port" value="28192" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Username:</label>
                                <input type="text" id="fishbowl-username" placeholder="Fishbowl username" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Password:</label>
                                <input type="password" id="fishbowl-password" placeholder="Fishbowl password" class="form-control">
                            </div>
                            <div class="integration-features">
                                <div class="feature-item">
                                    <span class="feature-icon">📦</span>
                                    <span>Product Inventory Sync</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-icon">💰</span>
                                    <span>Real-time Pricing</span>
                                </div>
                                <div class="feature-item">
                                    <span class="feature-icon">📈</span>
                                    <span>Order Management</span>
                                </div>
                            </div>
                            <div class="integration-actions">
                                <button class="btn btn-primary" onclick="window.adminDashboard.testFishbowlIntegration()">
                                    🧪 Test Connection
                                </button>
                                <button class="btn btn-secondary" onclick="window.adminDashboard.saveFishbowlSettings()">
                                    💾 Save Settings
                                </button>
                                <button class="btn btn-secondary" onclick="window.adminDashboard.syncFishbowlData()">
                                    🔄 Sync Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="integration-validation-results" class="validation-results" style="display: none;">
                    <!-- Validation results will be displayed here -->
                </div>
            </div>
        `;
    }

    /**
     * Show admin dashboard (public method for compatibility)
     */
    show() {
        if (!this.isLoggedIn) {
            this.showLoginModal();
        } else {
            this.showAdminModal();
        }
    }

    // =====================================
    // INTEGRATION ACTION METHODS
    // =====================================

    /**
     * Run comprehensive integration validation
     */
    async runIntegrationValidation() {
        console.log('🔍 Running integration validation...');
        
        if (window.IntegrationValidator) {
            const validator = new window.IntegrationValidator();
            const results = await validator.validateAllIntegrations();
            
            const resultsContainer = document.getElementById('integration-validation-results');
            if (resultsContainer) {
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = validator.generateHTMLReport(results);
            }
        } else {
            console.warn('IntegrationValidator not available');
            alert('Integration validator is not loaded. Please refresh the page.');
        }
    }

    /**
     * Test GitHub integration (called by the UI button)
     */
    async testGitHubIntegration() {
        return this.testGitHubConnection();
    }

    /**
     * Test GitHub integration
     */
    async testGitHubConnection() {
        console.log('🧪 Testing GitHub integration...');
        
        const owner = document.getElementById('github-owner')?.value || 'benatkanva';
        const repo = document.getElementById('github-repo')?.value || 'kanva-quotes';
        const token = document.getElementById('github-token')?.value;
        
        const statusElement = document.getElementById('github-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            if (window.GitConnector) {
                // Configure GitConnector with the form values
                const gitConnector = new window.GitConnector({ 
                    repo: `${owner}/${repo}`, 
                    token: token 
                });
                
                // Test the connection
                const testResult = await gitConnector.testConnection();
                
                if (testResult.success) {
                    // Update UI to show success
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                    
                    // Save the connection to the server if successful
                    await gitConnector.saveConnectionToServer();
                    
                    // Show detailed connection info
                    const details = testResult.details;
                    let message = `✅ GitHub API Connection Successful\n\n`;
                    message += `Repository: ${details.full_name}\n`;
                    message += `Owner: ${details.owner}\n`;
                    message += `Default Branch: ${details.default_branch || 'main'}\n`;
                    message += `Description: ${details.description || 'No description'}\n`;
                    
                    alert(message);
                    
                    // Update the admin manager with the new token
                    if (this.adminManager) {
                        this.adminManager.github.token = token;
                        this.adminManager.github.owner = owner;
                        this.adminManager.github.repo = repo;
                    }
                } else {
                    // Update UI to show error
                    this.updateIntegrationStatus(statusElement, 'error', testResult.message);
                    alert(`❌ GitHub Connection Failed\n\nError: ${testResult.message}`);
                }
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'GitConnector not loaded');
                alert('❌ GitConnector not loaded. Please refresh the page and try again.');
            }
        } catch (error) {
            console.error('GitHub test failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Test Failed');
            alert(`❌ GitHub Test Failed\n\nError: ${error.message}`);
        }
    }

    /**
     * Save GitHub settings
     */
    async saveGitHubSettings() {
        const owner = document.getElementById('github-owner')?.value;
        const repo = document.getElementById('github-repo')?.value;
        const token = document.getElementById('github-token')?.value;
        const branch = document.getElementById('github-branch')?.value || 'main';
        
        if (!owner || !repo || !token) {
            alert('Please fill in all required GitHub settings');
            return;
        }
        
        try {
            // Update admin manager settings
            if (this.adminManager) {
                this.adminManager.github = { owner, repo, branch, token };
                await this.adminManager.setGitHubToken(token);
            }
            
            // Configure GitConnector with the new settings
            if (window.GitConnector) {
                const gitConnector = new window.GitConnector({
                    repo: `${owner}/${repo}`,
                    branch: branch,
                    token: token
                });
                
                // Save connection to server
                await gitConnector.saveConnectionToServer();
                
                console.log('✅ GitHub settings saved to server');
                alert('GitHub settings saved successfully!');
                
                // Update status indicator
                const statusElement = document.getElementById('github-status');
                if (statusElement) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                }
            } else {
                console.error('GitConnector not available');
                alert('Could not save GitHub settings: GitConnector not available');
            }
        } catch (error) {
            console.error('Failed to save GitHub settings:', error);
            alert(`Failed to save GitHub settings: ${error.message}`);
        }
    }

    /**
     * Test Copper CRM integration
     */
    async testCopperIntegration() {
        console.log('🧪 Testing Copper CRM integration...');
        
        const apiKey = document.getElementById('copper-api-key')?.value;
        const email = document.getElementById('copper-email')?.value;
        const environment = document.getElementById('copper-environment')?.value || 'production';
        
        const statusElement = document.getElementById('copper-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            // Check if Copper integration is available
            if (window.CopperIntegration) {
                // Save credentials to server first
                await this.saveCopperSettings(false); // Don't show alert
                
                // Configure Copper SDK with new credentials
                if (typeof window.CopperIntegration.configure === 'function') {
                    await window.CopperIntegration.configure({
                        apiKey: apiKey,
                        email: email,
                        environment: environment
                    });
                }
                
                const isCrmAvailable = window.CopperIntegration.isCrmAvailable();
                
                if (isCrmAvailable) {
                    // Try to get context data to verify connection
                    const contextData = window.CopperIntegration.getContextData();
                    
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                    
                    let message = `✅ Copper CRM Connection Successful\n\n`;
                    message += `API Key: ${apiKey ? '✓ Configured' : '✗ Missing'}\n`;
                    message += `Email: ${email || 'Not configured'}\n`;
                    message += `Environment: ${environment === 'production' ? 'Production' : 'Sandbox'}\n`;
                    message += `Mode: ${typeof window.Copper !== 'undefined' ? 'Copper CRM' : 'Standalone'}\n`;
                    
                    if (contextData) {
                        message += `Context Available: Yes\n`;
                        if (contextData.user) {
                            message += `User: ${contextData.user.name || 'Unknown'}\n`;
                        }
                        if (contextData.entity) {
                            message += `Entity: ${contextData.entity.type || 'Unknown'}\n`;
                        }
                    } else {
                        message += `Context Available: No\n`;
                    }
                    
                    message += `SDK Available: ${typeof window.Copper !== 'undefined' ? 'Yes' : 'No'}\n`;
                    message += `Search Functions: Available\n`;
                    message += `CRM Save Functions: Available`;
                    
                    alert(message);
                } else {
                    // If API key is provided but connection failed
                    if (apiKey) {
                        this.updateIntegrationStatus(statusElement, 'error', 'Authentication Failed');
                        alert('❌ Copper CRM authentication failed.\n\nPlease check your API key and email address.');
                    } else {
                        this.updateIntegrationStatus(statusElement, 'warning', 'Not in CRM Environment');
                        alert('⚠️ Copper CRM is not available.\n\nThis is normal when running outside the Copper CRM environment.\nCRM features will work in simulation mode.');
                    }
                }
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'Integration Not Loaded');
                alert('❌ Copper CRM integration not loaded.\nPlease check that copper-integration.js is included.');
            }
        } catch (error) {
            console.error('Copper test failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Test Failed');
            alert(`❌ Copper CRM test failed\n\nError: ${error.message}`);
        }
    }
    
    /**
     * Save Copper CRM settings
     */
    async saveCopperSettings(showAlert = true) {
        console.log('💾 Saving Copper CRM settings...');
        
        const apiKey = document.getElementById('copper-api-key')?.value;
        const email = document.getElementById('copper-email')?.value;
        const environment = document.getElementById('copper-environment')?.value || 'production';
        
        if (!apiKey) {
            if (showAlert) alert('Please enter a Copper API key');
            return false;
        }
        
        try {
            // Save to server via API
            const response = await fetch('/api/connections/copper', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: apiKey,
                    email: email,
                    environment: environment,
                    lastUpdated: new Date().toISOString()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Copper CRM settings saved to server');
                
                // Update status indicator
                const statusElement = document.getElementById('copper-status');
                if (statusElement) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                }
                
                // Configure Copper SDK with new credentials if available
                if (window.CopperIntegration && typeof window.CopperIntegration.configure === 'function') {
                    await window.CopperIntegration.configure({
                        apiKey: apiKey,
                        email: email,
                        environment: environment
                    });
                }
                
                if (showAlert) alert('Copper CRM settings saved successfully!');
                return true;
            } else {
                console.error('Failed to save Copper settings:', result.message);
                if (showAlert) alert(`Failed to save Copper settings: ${result.message}`);
                return false;
            }
        } catch (error) {
            console.error('Error saving Copper settings:', error);
            if (showAlert) alert(`Error saving Copper settings: ${error.message}`);
            return false;
        }
    }

    /**
     * View Copper activity logs
     */
    viewCopperLogs() {
        console.log('📄 Opening Copper activity logs...');
        alert('Copper activity logs would be displayed here. This feature shows recent CRM activities and quote submissions.');
    }

    /**
     * Test Fishbowl ERP integration
     */
    async testFishbowlIntegration() {
        console.log('🧪 Testing Fishbowl integration...');
        
        const host = document.getElementById('fishbowl-host')?.value || 'localhost';
        const port = document.getElementById('fishbowl-port')?.value || '28192';
        const username = document.getElementById('fishbowl-username')?.value;
        const password = document.getElementById('fishbowl-password')?.value;
        
        if (!username || !password) {
            alert('Please enter both username and password for Fishbowl ERP');
            return;
        }
        
        const statusElement = document.getElementById('fishbowl-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Testing...');
        
        try {
            if (window.FishbowlIntegration) {
                // Save credentials to server first
                await this.saveFishbowlSettings(false); // Don't show alert
                
                // Create new instance with the credentials
                const fishbowlIntegration = new window.FishbowlIntegration({
                    host: host,
                    port: port,
                    username: username,
                    password: password
                });
                
                // Test connection
                const testResult = await fishbowlIntegration.testConnection();
                
                if (testResult.success) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Connected');
                    
                    // Store reference to fishbowl integration
                    window.fishbowlIntegration = fishbowlIntegration;
                    
                    alert(`✅ Fishbowl API Connection Successful\n\nServer: ${testResult.details.serverInfo || host + ':' + port}\nVersion: ${testResult.details.version || 'Unknown'}\nUser: ${testResult.details.userName || username}`);
                } else {
                    this.updateIntegrationStatus(statusElement, 'error', testResult.message);
                    alert(`❌ Fishbowl Connection Failed\n\nError: ${testResult.message}`);
                }
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'Integration Not Loaded');
                alert('❌ FishbowlIntegration not loaded. Please refresh the page and try again.');
            }
        } catch (error) {
            console.error('Fishbowl test failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Test Failed');
            alert(`❌ Fishbowl Test Failed\n\nError: ${error.message}`);
        }
    }

    /**
     * Sync Fishbowl data
     */
    async syncFishbowlData() {
        console.log('🔄 Syncing Fishbowl data...');
        
        const statusElement = document.getElementById('fishbowl-status');
        this.updateIntegrationStatus(statusElement, 'testing', 'Syncing...');
        
        try {
            if (window.fishbowlIntegration) {
                // Use existing instance if available
                const syncResult = await window.fishbowlIntegration.syncProductData();
                
                if (syncResult.success) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Synced');
                    alert(`✅ Fishbowl Data Sync Successful\n\nUpdated ${syncResult.updatedCount} products\nLast Sync: ${new Date().toLocaleString()}`);
                    
                    // Refresh products data if we're on the products tab
                    if (this.currentSection === 'products') {
                        this.refreshProductsData();
                    }
                } else {
                    this.updateIntegrationStatus(statusElement, 'error', 'Sync Failed');
                    alert(`❌ Fishbowl Sync Failed\n\nError: ${syncResult.message}`);
                }
            } else if (window.FishbowlIntegration) {
                // Create new instance if needed
                const fishbowlIntegration = new window.FishbowlIntegration();
                await fishbowlIntegration.loadConnectionFromServer();
                
                // Test connection first
                const testResult = await fishbowlIntegration.testConnection();
                
                if (testResult.success) {
                    // Connection successful, now sync data
                    const syncResult = await fishbowlIntegration.syncProductData();
                    
                    if (syncResult.success) {
                        this.updateIntegrationStatus(statusElement, 'ok', 'Synced');
                        alert(`✅ Fishbowl Data Sync Successful\n\nUpdated ${syncResult.updatedCount} products\nLast Sync: ${new Date().toLocaleString()}`);
                        
                        // Store reference to fishbowl integration
                        window.fishbowlIntegration = fishbowlIntegration;
                        
                        // Refresh products data if we're on the products tab
                        if (this.currentSection === 'products') {
                            this.refreshProductsData();
                        }
                    } else {
                        this.updateIntegrationStatus(statusElement, 'error', 'Sync Failed');
                        alert(`❌ Fishbowl Sync Failed\n\nError: ${syncResult.message}`);
                    }
                } else {
                    this.updateIntegrationStatus(statusElement, 'error', 'Connection Failed');
                    alert(`❌ Fishbowl Connection Failed\n\nPlease test the connection first.\nError: ${testResult.message}`);
                }
            } else {
                this.updateIntegrationStatus(statusElement, 'error', 'Integration Not Loaded');
                alert('❌ FishbowlIntegration not loaded. Please refresh the page and try again.');
            }
        } catch (error) {
            console.error('Fishbowl sync failed:', error);
            this.updateIntegrationStatus(statusElement, 'error', 'Sync Failed');
            alert(`❌ Fishbowl Sync Failed\n\nError: ${error.message}`);
        }
    }
    
    /**
     * Save Fishbowl ERP settings
     */
    async saveFishbowlSettings(showAlert = true) {
        console.log('💾 Saving Fishbowl ERP settings...');
        
        const host = document.getElementById('fishbowl-host')?.value || 'localhost';
        const port = document.getElementById('fishbowl-port')?.value || '28192';
        const username = document.getElementById('fishbowl-username')?.value;
        const password = document.getElementById('fishbowl-password')?.value;
        
        if (!username || !password) {
            if (showAlert) alert('Please enter both username and password for Fishbowl ERP');
            return false;
        }
        
        try {
            // Save to server via API
            const response = await fetch('/api/connections/fishbowl', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host: host,
                    port: port,
                    username: username,
                    password: password,
                    lastUpdated: new Date().toISOString()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Fishbowl ERP settings saved to server');
                
                // Update status indicator
                const statusElement = document.getElementById('fishbowl-status');
                if (statusElement) {
                    this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                }
                
                // Configure Fishbowl integration with new credentials if available
                if (window.fishbowlIntegration) {
                    await window.fishbowlIntegration.configure({
                        host: host,
                        port: port,
                        username: username,
                        password: password
                    });
                } else if (window.FishbowlIntegration) {
                    // Create new instance with the credentials
                    window.fishbowlIntegration = new window.FishbowlIntegration({
                        host: host,
                        port: port,
                        username: username,
                        password: password
                    });
                }
                
                if (showAlert) alert('Fishbowl ERP settings saved successfully!');
                return true;
            } else {
                console.error('Failed to save Fishbowl settings:', result.message);
                if (showAlert) alert(`Failed to save Fishbowl settings: ${result.message}`);
                return false;
            }
        } catch (error) {
            console.error('Error saving Fishbowl settings:', error);
            if (showAlert) alert(`Error saving Fishbowl settings: ${error.message}`);
            return false;
        }
    }

    /**
     * Load integrations data from the server
     */
    async loadIntegrationsData() {
        console.log('📂 Loading integrations data from server...');
        
        try {
            // Fetch all connections data
            const response = await fetch('/api/connections');
            
            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                console.warn(`⚠️ Server returned ${response.status} when loading integrations data`);
                // Try to load from localStorage instead
                return;
            }
            
            try {
                const data = await response.json();
                
                if (data && data.connections) {
                    console.log('✅ Loaded connections data:', data.connections);
                    
                    // Load GitHub credentials
                    if (data.connections.github) {
                    const github = data.connections.github;
                    const githubOwnerEl = document.getElementById('github-owner');
                    if (githubOwnerEl) githubOwnerEl.value = github.owner || '';
                    const githubRepoEl = document.getElementById('github-repo');
                    if (githubRepoEl) githubRepoEl.value = github.repo || '';
                    const githubTokenEl = document.getElementById('github-token');
                    if (githubTokenEl) githubTokenEl.value = github.token || '';
                    
                    // Update status if token exists
                    if (github.token) {
                        const statusElement = document.getElementById('github-status');
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                    }
                }
                
                // Load Copper credentials
                if (data.connections.copper) {
                    const copper = data.connections.copper;
                    const copperApiKeyEl = document.getElementById('copper-api-key');
                    if (copperApiKeyEl) copperApiKeyEl.value = copper.apiKey || '';
                    const copperEmailEl = document.getElementById('copper-email');
                    if (copperEmailEl) copperEmailEl.value = copper.email || '';
                    
                    if (document.getElementById('copper-environment')) {
                        document.getElementById('copper-environment').value = copper.environment || 'production';
                    }
                    
                    // Update status if API key exists
                    if (copper.apiKey) {
                        const statusElement = document.getElementById('copper-status');
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                        
                        // Configure Copper SDK with credentials if available
                        if (window.CopperIntegration && typeof window.CopperIntegration.configure === 'function') {
                            window.CopperIntegration.configure({
                                apiKey: copper.apiKey,
                                email: copper.email,
                                environment: copper.environment || 'production'
                            });
                        }
                    }
                }
                
                // Load Fishbowl credentials
                if (data.connections.fishbowl) {
                    const fishbowl = data.connections.fishbowl;
                    const fishbowlHostEl = document.getElementById('fishbowl-host');
                    if (fishbowlHostEl) fishbowlHostEl.value = fishbowl.host || 'localhost';
                    const fishbowlPortEl = document.getElementById('fishbowl-port');
                    if (fishbowlPortEl) fishbowlPortEl.value = fishbowl.port || '28192';
                    const fishbowlUsernameEl = document.getElementById('fishbowl-username');
                    if (fishbowlUsernameEl) fishbowlUsernameEl.value = fishbowl.username || '';
                    const fishbowlPasswordEl = document.getElementById('fishbowl-password');
                    if (fishbowlPasswordEl) fishbowlPasswordEl.value = fishbowl.password || '';
                    
                    // Update status if username and password exist
                    if (fishbowl.username && fishbowl.password) {
                        const statusElement = document.getElementById('fishbowl-status');
                        this.updateIntegrationStatus(statusElement, 'ok', 'Configured');
                        
                        // Initialize Fishbowl integration with credentials if available
                        if (window.FishbowlIntegration && !window.fishbowlIntegration) {
                            window.fishbowlIntegration = new window.FishbowlIntegration({
                                host: fishbowl.host || 'localhost',
                                port: fishbowl.port || '28192',
                                username: fishbowl.username,
                                password: fishbowl.password
                            });
                        }
                    }
                }
                }
            } catch (jsonError) {
                console.error('❌ Error parsing integrations data JSON:', jsonError);
            }
        } catch (error) {
            console.error('❌ Error loading integrations data:', error);
        }
    }

    /**
     * Update integration status indicator
     */
    updateIntegrationStatus(element, status, message) {
        if (!element) return;
        
        const indicator = element.querySelector('.status-indicator');
        const text = element.querySelector('span:last-child');
        
        if (indicator) {
            indicator.className = 'status-indicator';
            
            switch (status) {
                case 'ok':
                    indicator.classList.add('status-ok');
                    indicator.innerHTML = '✅';
                    break;
                case 'error':
                    indicator.classList.add('status-error');
                    indicator.innerHTML = '❌';
                    break;
                case 'warning':
                    indicator.classList.add('status-warning');
                    indicator.innerHTML = '⚠️';
                    break;
                case 'testing':
                    indicator.classList.add('status-testing');
                    indicator.innerHTML = '⏳';
                    break;
                default:
                    indicator.classList.add('status-unknown');
                    indicator.innerHTML = '❓';
            }
        }
        
        if (text && message) {
            text.textContent = message;
        }
    }

    // =====================================
    // PASSWORD TOGGLE AND PICTURE UPLOAD METHODS
    // =====================================

    /**
     * Password visibility function - now just a stub since we're making passwords always visible
     */
    togglePasswordVisibility(button) {
        // Function kept as a stub to prevent errors, but no longer toggles password visibility
        console.log('Password toggle functionality removed - passwords are now always visible');
    }

    /**
     * Handle picture upload with resizing and validation
     */
    async handlePictureUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            this.showNotification('❌ Please select a valid image file (JPEG, PNG, GIF, etc.)', 'error');
            return;
        }
        
        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showNotification('⚠️ Image size should be less than 5MB', 'warning');
            return;
        }
        
        // Show loading state
        const container = event.target.closest('.image-upload-container');
        const previewImg = container.querySelector('.image-preview');
        const placeholder = container.querySelector('.upload-placeholder');
        const removeBtn = container.querySelector('.btn-outline-secondary');
        const uploadBtn = container.querySelector('.image-upload-btn');
        
        const originalBtnText = uploadBtn.textContent;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Processing...';
        
        try {
            // Resize image before preview
            const resizedImageUrl = await this.resizeImage(file, 800, 800, 0.8);
            
            // Update preview
            previewImg.src = resizedImageUrl;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-block';
            
            // Store the resized image data for form submission
            event.target.setAttribute('data-image-data', resizedImageUrl);
            
            // Show success feedback
            this.showNotification('✅ Image uploaded successfully', 'success');
            console.log('🖼️ Image processed and preview updated');
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showNotification('❌ Failed to process image. Please try another one.', 'error');
            
            // Reset to default state
            previewImg.src = 'assets/logo/Kanva_Logo_White_Master.png';
            placeholder.style.display = 'block';
            removeBtn.style.display = 'none';
            event.target.value = ''; // Clear file input
            event.target.removeAttribute('data-image-data');
        } finally {
            // Restore button state
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalBtnText;
        }
    }

    /**
     * Clear picture upload and reset to default state
     */
    clearPictureUpload(removeBtn) {
        const container = removeBtn.closest('.image-upload-container');
        const fileInput = container.querySelector('input[type="file"]');
        const previewImg = container.querySelector('.image-preview');
        const placeholder = container.querySelector('.upload-placeholder');
        
        // Clear file input and reset to fallback logo
        fileInput.value = '';
        fileInput.removeAttribute('data-image-data');
        previewImg.src = 'assets/logo/Kanva_Logo_White_Master.png';
        previewImg.style.display = 'block';
        placeholder.style.display = 'block';
        placeholder.textContent = '📷 Click to upload product image (200x200 recommended)';
        removeBtn.style.display = 'none';
        
        console.log('🗑️ Image cleared, reset to fallback logo');
    }

    // =====================================
    // PLACEHOLDER METHODS FOR FUTURE IMPLEMENTATION
    // =====================================

    addNewTier() {
        alert('Add New Tier functionality would be implemented here.');
    }

    addNewShippingZone() {
        alert('Add New Shipping Zone functionality would be implemented here.');
    }
}

// Initialize AdminDashboard when DOM is loaded
if (typeof window !== 'undefined') {
    window.AdminDashboard = AdminDashboard;
    
    // Auto-initialize if page is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.adminDashboard = new AdminDashboard({
                adminManager: window.adminManager
            });
            window.adminDashboard.init();
        });
    } else {
        // DOM already loaded
        window.adminDashboard = new AdminDashboard({
            adminManager: window.adminManager
        });
        window.adminDashboard.init();
    }
}
