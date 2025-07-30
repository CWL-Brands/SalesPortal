# Copper CRM SDK Integration Analysis

## Executive Summary

After deep analysis of the Copper SDK documentation and our current implementation, several critical issues have been identified that explain why the integration is not working as expected:

1. **Field Mapping Mismatch**: Our form field IDs don't align with Copper's entity structure
2. **Context Extraction Issues**: We're not properly extracting data from Copper's `getContext()` response
3. **Activity Panel Detection Problems**: The Launch Modal button isn't appearing
4. **Modal Parameter Passing**: Parameters aren't being passed correctly to modal instances

## Copper SDK Core Methods & Data Structure

### getContext() Response Structure
Based on SDK documentation, `getContext()` returns:
```javascript
{
  type: 'person' | 'lead' | 'company' | 'opportunity' | 'project' | 'task',
  context: {
    entity: {
      id: number,
      name: string,
      email?: string,
      phone_number?: string,
      company_name?: string,
      address?: {
        street: string,
        city: string,
        state: string,
        postal_code: string,
        country: string
      },
      // ... other entity-specific fields
    }
  }
}
```

### showModal() Behavior
- Automatically appends `?location=modal` to the app URL
- Passes parameters as URL query parameters
- Example: `sdk.showModal({ customer_id: 123, company: 'Acme' })`
- Results in: `https://app.com/?location=modal&customer_id=123&company=Acme`

## Current Implementation Issues

### 1. Field Mapping Problems

**Our Current Form Fields:**
- `quoteName` - Custom field for quote naming
- `companyName` - Maps to entity.name or entity.company_name
- `customerSegment` - Custom business logic field
- `customerState` - Maps to entity.address.state
- `customerEmail` - Maps to entity.email
- `customerPhone` - Maps to entity.phone_number

**Copper Entity Fields:**
- `entity.name` - Person/Company name
- `entity.company_name` - Company name (for person entities)
- `entity.email` - Email address
- `entity.phone_number` - Phone number
- `entity.address.street` - Street address
- `entity.address.city` - City
- `entity.address.state` - State
- `entity.address.postal_code` - ZIP code
- `entity.address.country` - Country

### 2. Context Extraction Issues

**Current Implementation:**
```javascript
// We're extracting from URL parameters (incorrect)
const context = {
    companyName: urlParams.get('companyName'),
    contactName: urlParams.get('contactName'),
    // ...
};
```

**Correct Implementation Should Be:**
```javascript
// Extract from Copper SDK getContext() response
sdk.getContext().then(({ type, context }) => {
    const entity = context.entity;
    const extractedData = {
        entityType: type,
        entityId: entity.id,
        companyName: entity.name || entity.company_name,
        email: entity.email,
        phone: entity.phone_number,
        address: entity.address,
        // ...
    };
});
```

### 3. Activity Panel Detection Problems

**Current Logic:**
```javascript
// Checking for iframe context
if (window.self !== window.top) {
    appState.integrationMode = 'activity_panel';
    this.showLaunchModalButton();
}
```

**Issues:**
- Not reliably detecting Activity Panel vs other iframe contexts
- Launch Modal button may not be visible due to CSS/display issues
- Button might be hidden by other UI elements

### 4. Modal Parameter Passing

**Current Approach:**
- Extracting parameters from URL query string
- Assuming parameters are passed as URL params

**Correct Approach:**
- Parameters passed to `showModal()` become URL query parameters
- Need to ensure parameter names match our extraction logic

## Recommended Fixes

### 1. Fix Context Extraction
Replace URL parameter extraction with proper SDK context extraction:

```javascript
// In modal mode, get context from Copper SDK
if (this.isModalMode() && typeof window.Copper !== 'undefined') {
    const sdk = window.Copper.init();
    sdk.getContext().then(({ type, context }) => {
        const entity = context.entity;
        this.populateFormFromEntity(entity, type);
    });
}
```

### 2. Align Form Field Mapping
Update form population to match Copper entity structure:

```javascript
populateFormFromEntity: function(entity, entityType) {
    // Company name mapping
    const companyField = document.getElementById('companyName');
    if (companyField) {
        companyField.value = entity.name || entity.company_name || '';
    }
    
    // Email mapping
    const emailField = document.getElementById('customerEmail');
    if (emailField && entity.email) {
        emailField.value = entity.email;
    }
    
    // Phone mapping
    const phoneField = document.getElementById('customerPhone');
    if (phoneField && entity.phone_number) {
        phoneField.value = entity.phone_number;
    }
    
    // Address mapping
    const stateField = document.getElementById('customerState');
    if (stateField && entity.address && entity.address.state) {
        stateField.value = entity.address.state;
    }
}
```

### 3. Fix Activity Panel Detection
Improve Activity Panel detection and button visibility:

```javascript
detectIntegrationMode: function() {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get('location');
    
    if (location === 'modal') {
        appState.integrationMode = 'modal';
        return 'modal';
    }
    
    // Check for Copper SDK availability
    if (typeof window.Copper !== 'undefined') {
        // In iframe but not modal = Activity Panel
        if (window.self !== window.top) {
            appState.integrationMode = 'activity_panel';
            appState.isActivityPanel = true;
            // Ensure button is visible
            setTimeout(() => this.showLaunchModalButton(), 1000);
            return 'activity_panel';
        }
    }
    
    return 'standalone';
}
```

### 4. Fix Modal Launch with Proper Context
Update modal launch to pass context correctly:

```javascript
launchQuoteModal: function() {
    if (!appState.sdk) return;
    
    appState.sdk.getContext()
        .then(({ type, context }) => {
            const entity = context.entity;
            
            // Pass entity data as modal parameters
            const modalParams = {
                entity_type: type,
                entity_id: entity.id,
                entity_name: entity.name || entity.company_name || '',
                entity_email: entity.email || '',
                entity_phone: entity.phone_number || '',
                entity_state: entity.address?.state || ''
            };
            
            console.log('🚀 Launching modal with entity data:', modalParams);
            appState.sdk.showModal(modalParams);
        })
        .catch(error => {
            console.error('❌ Error getting context:', error);
            appState.sdk.showModal({}); // Fallback
        });
}
```

## Testing Strategy

### 1. Verify SDK Initialization
- Check console for Copper SDK availability
- Confirm `window.Copper` is defined
- Verify `sdk.init()` succeeds

### 2. Test Context Extraction
- Log `getContext()` response structure
- Verify entity data is available
- Check entity type and field availability

### 3. Test Activity Panel Detection
- Confirm iframe detection works
- Verify Launch Modal button appears
- Check button click functionality

### 4. Test Modal Launch & Population
- Verify modal opens with `?location=modal`
- Check URL parameters are passed correctly
- Confirm form fields populate from entity data

## Next Steps

1. **Implement Context Extraction Fix** - Replace URL param extraction with SDK context extraction
2. **Fix Field Mapping** - Align form fields with Copper entity structure
3. **Debug Activity Panel Detection** - Ensure Launch Modal button appears
4. **Test End-to-End Flow** - Verify complete Activity Panel → Modal → Form Population workflow
5. **Implement Quote Saving** - Use `sdk.logActivity()` to save quotes as CRM activities

## Key Insights

- **Field mapping is critical** - Form field IDs must align with Copper entity structure
- **Context comes from SDK, not URL** - Use `getContext()` instead of URL parameters
- **Activity Panel detection is tricky** - Need reliable iframe detection
- **Modal parameters become URL params** - Ensure parameter names match extraction logic
- **SDK methods are asynchronous** - Always use promises/async-await

This analysis provides the foundation for fixing the Copper CRM integration and achieving the desired modal-first user experience.
