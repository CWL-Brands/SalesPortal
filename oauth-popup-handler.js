/**
 * OAuth Popup Handler for Copper iframe context
 * Handles postMessage requests to open OAuth popups from embedded dialer
 */

// Listen for OAuth popup requests from embedded dialer
window.addEventListener('message', function(event) {
    // Security check - only allow from our domain
    if (event.origin !== 'https://kanvaportal.web.app') {
        return;
    }
    
    if (event.data && event.data.type === 'OPEN_OAUTH_POPUP') {
        console.log('🔄 Opening OAuth popup for embedded dialer...');
        
        const popup = window.open(
            event.data.url,
            event.data.windowName || 'oauth-popup',
            event.data.features || 'width=500,height=600,resizable=yes,scrollbars=yes'
        );
        
        if (!popup) {
            console.error('❌ Failed to open OAuth popup - popup blocked');
            // Send failure message back to iframe
            event.source.postMessage({
                type: 'OAUTH_POPUP_BLOCKED'
            }, event.origin);
            return;
        }
        
        // Monitor popup for completion
        const checkClosed = setInterval(() => {
            try {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    console.log('✅ OAuth popup closed, notifying dialer...');
                    
                    // Notify the dialer that OAuth is complete
                    event.source.postMessage({
                        type: 'OAUTH_COMPLETE'
                    }, event.origin);
                }
            } catch (e) {
                // Cross-origin access error is expected
                clearInterval(checkClosed);
                
                // Send completion message after delay
                setTimeout(() => {
                    event.source.postMessage({
                        type: 'OAUTH_COMPLETE'
                    }, event.origin);
                }, 2000);
            }
        }, 1000);
        
        // Timeout after 5 minutes
        setTimeout(() => {
            if (!popup.closed) {
                popup.close();
            }
            clearInterval(checkClosed);
        }, 300000);
    }
});

console.log('🔗 OAuth popup handler loaded for Copper integration');
