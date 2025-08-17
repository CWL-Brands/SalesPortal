/**
 * Kanva Dialer Service Worker
 * Provides background call detection and automatic popup functionality
 */

const CACHE_NAME = 'kanva-dialer-v1';
const DIALER_URL = '/copper-dialer.html';

// Install service worker
self.addEventListener('install', (event) => {
    console.log('📦 Dialer Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                DIALER_URL,
                '/assets/logo/kanva-logo.png'
            ]);
        })
    );
});

// Activate service worker
self.addEventListener('activate', (event) => {
    console.log('✅ Dialer Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Handle background sync for call detection
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-incoming-calls') {
        event.waitUntil(checkForIncomingCalls());
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const action = event.action;
    const data = event.notification.data || {};
    
    if (action === 'answer') {
        // Open dialer and answer call
        event.waitUntil(
            clients.openWindow(`${DIALER_URL}?answer=${data.callId}`)
        );
    } else if (action === 'decline') {
        // Send decline signal
        event.waitUntil(
            fetch('/api/decline-call', {
                method: 'POST',
                body: JSON.stringify({ callId: data.callId })
            })
        );
    } else {
        // Default: open dialer
        event.waitUntil(
            clients.openWindow(DIALER_URL)
        );
    }
});

// Handle push notifications (for future RingCentral webhook integration)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        
        if (data.type === 'incoming-call') {
            const options = {
                body: `Incoming call from ${data.from}`,
                icon: '/assets/logo/kanva-logo.png',
                badge: '/assets/logo/kanva-logo.png',
                tag: 'incoming-call',
                requireInteraction: true,
                actions: [
                    { action: 'answer', title: 'Answer', icon: '/icons/answer.png' },
                    { action: 'decline', title: 'Decline', icon: '/icons/decline.png' }
                ],
                data: {
                    callId: data.callId,
                    from: data.from
                }
            };
            
            event.waitUntil(
                self.registration.showNotification('Kanva Dialer', options)
            );
        }
    } catch (error) {
        console.error('❌ Error handling push notification:', error);
    }
});

// Background call checking function
async function checkForIncomingCalls() {
    try {
        const response = await fetch('/api/check-calls');
        if (response.ok) {
            const calls = await response.json();
            
            for (const call of calls.incomingCalls || []) {
                // Show notification for each incoming call
                await self.registration.showNotification('Incoming Call', {
                    body: `Call from ${call.from}`,
                    icon: '/assets/logo/kanva-logo.png',
                    tag: `call-${call.id}`,
                    requireInteraction: true,
                    actions: [
                        { action: 'answer', title: 'Answer' },
                        { action: 'decline', title: 'Decline' }
                    ],
                    data: { callId: call.id }
                });
            }
        }
    } catch (error) {
        console.error('❌ Error checking for calls:', error);
    }
}

// Keep service worker alive for call detection
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'KEEP_ALIVE') {
        // Respond to keep alive ping
        event.ports[0].postMessage({ type: 'ALIVE' });
    }
    
    if (event.data && event.data.type === 'INCOMING_CALL') {
        // Handle incoming call from main app
        const { from, callId } = event.data;
        
        // Show notification
        self.registration.showNotification('Incoming Call', {
            body: `Call from ${from}`,
            icon: '/assets/logo/kanva-logo.png',
            tag: `call-${callId}`,
            requireInteraction: true,
            actions: [
                { action: 'answer', title: 'Answer' },
                { action: 'decline', title: 'Decline' }
            ],
            data: { callId }
        });
        
        // Try to open popup if no active window
        clients.matchAll({ type: 'window' }).then(clientList => {
            const hasActiveWindow = clientList.some(client => 
                client.url.includes('copper-dialer.html') && client.focused
            );
            
            if (!hasActiveWindow) {
                clients.openWindow(`${DIALER_URL}?incoming=${from}&callId=${callId}`);
            }
        });
    }
});
