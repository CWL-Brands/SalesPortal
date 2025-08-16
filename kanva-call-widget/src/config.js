export default {
  // RingCentral API Configuration
  apiConfig: {
    server: process.env.REACT_APP_RC_SERVER || 'https://platform.ringcentral.com',
    clientId: process.env.REACT_APP_RC_CLIENT_ID,
    clientSecret: process.env.REACT_APP_RC_CLIENT_SECRET,
    redirectUri: process.env.REACT_APP_RC_REDIRECT_URI || window.location.origin + '/redirect.html',
  },
  
  // Kanva-specific configuration
  kanva: {
    companyName: 'Kanva Botanicals',
    supportEmail: 'it@kanvabotanicals.com',
    copperIntegration: true,
    aiSummaryEnabled: true,
    
    // Firebase Functions endpoints (existing functions)
    endpoints: {
      copperLookup: '/copperLookup',
      copperLogCall: '/copperLogCall',
      copperAddSummary: '/copperAddSummary',
      aiSummary: '/aiSummary',
    },
    
    // UI customization
    theme: {
      primaryColor: '#2d5a2d',
      secondaryColor: '#4a7c59',
      accentColor: '#6b8e6b',
      backgroundColor: '#f8fdf8',
      textColor: '#1f2937',
    },
    
    // Modal settings
    modal: {
      width: 420,
      height: 600,
      borderRadius: 16,
      showInCopper: true,
      autoShowOnIncomingCall: true,
    },
    
    // Call handling
    callSettings: {
      autoAnswer: false,
      recordCalls: true,
      enableAISummary: true,
      logCallsInCopper: true,
      showCallerInfo: true,
    },
  },
  
  // Feature flags
  features: {
    dialer: true,
    calls: true,
    settings: true,
    contacts: false,
    messages: false,
    meetings: false,
    analytics: false,
  },
  
  // Branding
  branding: {
    logo: '/assets/logo/kanva-logo-white.png',
    favicon: '/assets/logo/kanva-favicon.ico',
    appName: 'Kanva Call Center',
    companyName: 'Kanva Botanicals',
  },
};
