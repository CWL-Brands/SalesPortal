// Copper CRM Advanced Configuration for Action Bar
// This script should be added to the "Optional Advanced Configuration" field
// in the Copper CRM Embedded App settings

(function() {
    'use strict';
    
    console.log('🔧 Copper Advanced Configuration loading...');
    
    // Wait for Copper SDK to be available
    function waitForCopperSDK(callback, maxAttempts = 10) {
        let attempts = 0;
        
        function checkSDK() {
            attempts++;
            
            if (typeof window.Copper !== 'undefined' && window.Copper.init) {
                console.log('✅ Copper SDK found, initializing...');
                callback();
            } else if (attempts < maxAttempts) {
                console.log(`⏳ Waiting for Copper SDK... (${attempts}/${maxAttempts})`);
                setTimeout(checkSDK, 500);
            } else {
                console.error('❌ Copper SDK not found after maximum attempts');
            }
        }
        
        checkSDK();
    }
    
    // Initialize when SDK is ready
    waitForCopperSDK(function() {
        try {
            // Initialize Copper SDK
            const sdk = window.Copper.init();
            console.log('🚀 Copper SDK initialized for Action Bar');
            
            // Get current context to pass to modal
            sdk.getContext()
                .then((context) => {
                    console.log('📋 Current context:', context);
                    
                    // Extract customer data
                    let modalParams = {};
                    if (context && context.context && context.context.entity) {
                        const entity = context.context.entity;
                        modalParams = {
                            customer_id: entity.id,
                            company: entity.name || entity.company_name || '',
                            email: entity.email || '',
                            phone: entity.phone_number || '',
                            address: entity.address ? `${entity.address.street || ''}, ${entity.address.city || ''}, ${entity.address.state || ''}`.trim() : ''
                        };
                        console.log('🎯 Customer data extracted:', modalParams);
                    }
                    
                    // Launch modal with customer context
                    console.log('🚀 Launching quote modal with context...');
                    sdk.showModal(modalParams);
                    
                })
                .catch((error) => {
                    console.warn('⚠️ Could not get context, launching modal without it:', error);
                    // Launch modal without context as fallback
                    sdk.showModal({});
                });
                
        } catch (error) {
            console.error('❌ Error in advanced configuration:', error);
        }
    });
    
    console.log('✅ Copper Advanced Configuration loaded');
    
})();
