# Kanva Quotes - Copper CRM Integration Guide

## 🎯 Overview

This document provides a comprehensive guide to the Kanva Quotes integration with Copper CRM, featuring a seamless modal overlay approach for embedded quoting workflows.

## 🚀 Key Features

### ✅ **Modal Overlay Integration**
- **Seamless UX**: Launch quotes as modal overlays within Copper CRM
- **Context Auto-Population**: Automatically populate customer data from CRM context
- **Activity Logging**: Save quotes directly as Copper CRM activities
- **Smart Detection**: Automatically detect Activity Panel vs. Left Navigation modes

### ✅ **Enhanced Context Extraction**
- **Dual-Path Approach**: Extract context from both URL parameters and Copper SDK
- **Field Mapping**: Robust mapping between Copper CRM fields and form fields
- **Fallback Detection**: Multiple field ID detection strategies for reliability
- **Visual Feedback**: Success indicators when fields are auto-populated

### ✅ **Integration Modes**
- **Activity Panel** (Recommended): Modal overlay with customer context
- **Left Navigation**: Full app with customer search functionality
- **Action Bar**: Global access (limited modal support)
- **Standalone**: Testing mode outside Copper CRM

## 📋 Integration Setup

### 1. **Copper CRM App Configuration**

#### Activity Panel Setup (Recommended)
```json
{
  "name": "Kanva Quotes",
  "url": "https://kanva-quotes--kanvaportal.us-central1.hosted.app/?location=activity_panel",
  "icon": "quote",
  "description": "Generate professional quotes with modal overlay"
}
```

#### Left Navigation Setup
```json
{
  "name": "Kanva Quotes",
  "url": "https://kanva-quotes--kanvaportal.us-central1.hosted.app/?location=left_nav",
  "icon": "calculator",
  "description": "Full quote calculator with customer search"
}
```

### 2. **Environment Variables**

Create `.env` file with required credentials:
```env
COPPER_API_KEY=your_copper_api_key
COPPER_EMAIL=your_copper_email
COPPER_ENVIRONMENT=production
GITHUB_TOKEN=your_github_token
SHIPSTATION_API_KEY=your_shipstation_key
SHIPSTATION_API_SECRET=your_shipstation_secret
FISHBOWL_HOST=your_fishbowl_host
FISHBOWL_PORT=your_fishbowl_port
FISHBOWL_USERNAME=your_fishbowl_username
FISHBOWL_PASSWORD=your_fishbowl_password
ADMIN_PASSWORD=your_admin_password
```

## 🔧 Technical Implementation

### Context Extraction Flow

```javascript
// 1. Detect modal mode
if (ModalOverlayHandler.isModalMode()) {
    // 2. Extract context from URL parameters (passed from modal launch)
    const urlContext = extractFromURLParams();
    
    // 3. Fallback to Copper SDK if no URL params
    if (!urlContext.entity_id) {
        sdk.getContext().then(({ context }) => {
            const entity = context.entity;
            populateFromSDKContext(entity);
        });
    }
}
```

### Field Mapping Strategy

```javascript
const fieldMappings = {
    // Copper CRM → Form Fields
    'entity.name': ['companyName', 'company-name'],
    'entity.email': ['customerEmail', 'customer-email'],
    'entity.phone_number': ['customerPhone', 'customer-phone'],
    'entity.address.state': ['customerState', 'customer-state']
};
```

### Modal Launch Process

```javascript
// Activity Panel → Modal Launch
function launchQuoteModal() {
    sdk.getContext().then(({ context }) => {
        const modalParams = {
            entity_type: type,
            entity_id: entity.id,
            entity_name: entity.name,
            entity_email: entity.email,
            entity_phone: entity.phone_number
        };
        sdk.showModal(modalParams);
    });
}
```

## 🎨 User Experience Flow

### Activity Panel Workflow (Recommended)

1. **User navigates to customer/company record in Copper CRM**
2. **Activity Panel shows "Launch Quote Modal" button**
3. **User clicks button → Modal opens with customer context**
4. **Form auto-populates with customer data**
5. **User configures quote and generates**
6. **Quote saves as Copper CRM activity**
7. **Modal closes automatically**

### Left Navigation Workflow

1. **User accesses Kanva Quotes from left navigation**
2. **App opens in fullscreen with customer search**
3. **User searches and selects customer**
4. **Form auto-populates from selected customer**
5. **Quote generation and CRM saving**

## 🔍 Integration Mode Detection

The app automatically detects the integration mode using multiple strategies:

### Primary Detection: URL Parameters
```javascript
const location = urlParams.get('location');
// 'activity_panel', 'left_nav', 'action_bar'
```

### Secondary Detection: Iframe Analysis
```javascript
const isInIframe = window.self !== window.top;
const windowWidth = window.innerWidth;
const windowHeight = window.innerHeight;

// Activity Panel: iframe + constrained dimensions
if (isInIframe && (windowWidth < 800 || windowHeight < 600)) {
    mode = 'activity_panel';
}
```

## 📊 Field Population Logic

### Auto-Population Success Indicators

When fields are successfully populated, users see:
- ✅ Visual success notification
- 🎯 Field count indicator
- 📋 Console logging for debugging

### Field Mapping Fallbacks

```javascript
const populateField = (contextKey, contextValue) => {
    const possibleIds = fieldMappings[contextKey] || [contextKey];
    
    for (const fieldId of possibleIds) {
        const field = document.getElementById(fieldId) || 
                     document.querySelector(`[name="${fieldId}"]`);
        if (field) {
            field.value = contextValue;
            return true;
        }
    }
    return false;
};
```

## 🛠️ Debugging & Troubleshooting

### Console Debugging

Enable detailed logging by checking browser console:

```javascript
// Integration mode detection
🔍 Detecting Copper CRM integration mode...
📍 Activity panel mode detected (URL param)

// Context extraction
🖥️ Modal mode detected - extracting context from Copper SDK...
🔗 URL parameters: { entity_id: "123", entity_name: "Acme Corp" }

// Field population
✅ companyName populated in field 'companyName': Acme Corp
✅ entityEmail populated in field 'customerEmail': contact@acme.com
🎯 Form population complete - 3 fields populated
```

### Common Issues & Solutions

#### Issue: Launch Modal Button Not Visible
**Solution**: Check Activity Panel detection
```javascript
// Verify detection logic
console.log('Detection data:', {
    location: urlParams.get('location'),
    isInIframe: window.self !== window.top,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
});
```

#### Issue: Fields Not Auto-Populating
**Solution**: Verify field mapping
```javascript
// Check field IDs in HTML
const companyField = document.getElementById('companyName');
console.log('Company field found:', !!companyField);
```

#### Issue: Context Not Available
**Solution**: Verify Copper SDK initialization
```javascript
// Check SDK availability
console.log('Copper SDK available:', typeof window.Copper !== 'undefined');
console.log('SDK initialized:', !!appState.sdk);
```

## 🚀 Deployment & Testing

### Firebase Deployment

Changes are automatically deployed when pushed to the `main` branch:

```bash
git add .
git commit -m "Integration improvements"
git push origin main
# Firebase auto-deploys to: https://kanva-quotes--kanvaportal.us-central1.hosted.app/
```

### Live Testing in Copper CRM

1. **Configure app in Copper CRM with live URL**
2. **Navigate to customer record**
3. **Test Activity Panel modal launch**
4. **Verify context auto-population**
5. **Test quote saving as activity**

### Standalone Testing

For testing outside Copper CRM:
```
https://kanva-quotes--kanvaportal.us-central1.hosted.app/
```

## 📈 Future Enhancements

### Planned Features
- [ ] **Pipeline Integration**: Save quotes as opportunities
- [ ] **Follow-up Automation**: Automated follow-up sequences
- [ ] **Advanced Product Catalog**: Dynamic product loading from ERP
- [ ] **Multi-Currency Support**: International quote generation
- [ ] **Template System**: Customizable quote templates

### Advanced Configuration Options
- [ ] **Custom Field Mapping**: User-defined field mappings
- [ ] **Workflow Triggers**: Custom CRM workflow integration
- [ ] **Notification System**: Real-time quote status updates

## 🔐 Security & Best Practices

### Environment Security
- ✅ Sensitive credentials in `.env` (not committed)
- ✅ `connections.json` excluded from git
- ✅ Secure API key management
- ✅ HTTPS-only deployment

### Integration Security
- ✅ Copper SDK authentication
- ✅ Cross-origin request handling
- ✅ Input validation and sanitization

## 📞 Support & Maintenance

### Key Files
- `js/copper-integration.js` - Main integration logic
- `docs/COPPER_SDK_ANALYSIS.md` - Technical analysis
- `connections.example.json` - Configuration template
- `scripts/secure-connections.cjs` - Environment management

### Monitoring
- Firebase Hosting logs
- Browser console debugging
- Copper CRM activity logs
- Integration success metrics

---

## ✅ Integration Status: **COMPLETE**

The Kanva Quotes Copper CRM integration is now fully operational with:
- ✅ Modal overlay functionality
- ✅ Context auto-population
- ✅ Activity Panel detection
- ✅ Field mapping alignment
- ✅ Quote saving as CRM activities
- ✅ Comprehensive debugging
- ✅ Live deployment ready

**Ready for production use in Copper CRM Activity Panel mode.**
