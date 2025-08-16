# Kanva Call Widget

A branded RingCentral Widgets integration for Kanva Botanicals, designed to work as a modal within Copper CRM.

## Features

- **Branded UI**: Custom Kanva Botanicals styling and colors
- **Modal Display**: Embeds seamlessly within Copper CRM as a modal popup
- **Call Control**: Answer, hangup, voicemail, and dialer functionality
- **Copper Integration**: Automatic customer lookup and call logging
- **AI Summaries**: Post-call AI-generated summaries via RingSense
- **Note Taking**: In-call note taking with Copper sync

## Setup

### 1. Environment Configuration

Copy the environment template and configure your RingCentral credentials:

```bash
cp .env.example .env
```

Edit `.env` with your RingCentral app credentials:

```bash
REACT_APP_RC_CLIENT_ID=your_ringcentral_client_id
REACT_APP_RC_CLIENT_SECRET=your_ringcentral_client_secret
REACT_APP_RC_REDIRECT_URI=https://yourdomain.com/redirect.html
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build for Production

```bash
npm run build
```

This creates a `build/` directory with the compiled widget that can be embedded in your main application.

### 4. Integration

The widget is designed to be embedded as an iframe within the main SalesPortal application. The integration is handled by `kanva-widget-integration.js` which:

- Creates a modal overlay within Copper CRM
- Embeds the widget iframe
- Handles communication between widget and Copper
- Connects to Firebase Functions for CRM operations

## Architecture

```
┌─────────────────────────────────────┐
│           Copper CRM                │
│  ┌─────────────────────────────────┐│
│  │     Kanva Widget Modal          ││
│  │  ┌─────────────────────────────┐││
│  │  │   RingCentral Widget        │││
│  │  │   (iframe)                  │││
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│       Firebase Functions            │
│  • Copper customer lookup           │
│  • Call logging                     │
│  • AI summary processing            │
└─────────────────────────────────────┘
```

## Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run ESLint

### File Structure

```
src/
├── brand.js              # Kanva branding configuration
├── config.js             # Application configuration
├── theme.scss            # Custom Kanva styling
├── index.js              # Main application entry
├── containers/
│   ├── App/              # Main app container
│   ├── AppView/          # App view wrapper
│   └── MainView/         # Navigation and routing
└── modules/
    └── Phone/            # RingCentral phone module
```

## Integration with Copper CRM

The widget integrates with Copper CRM through:

1. **Customer Lookup**: Incoming calls trigger automatic customer lookup by phone number
2. **Call Logging**: All calls are logged as activities in Copper
3. **Note Sync**: Call notes are saved to customer profiles
4. **AI Summaries**: Post-call summaries are added to customer records

## Customization

### Branding

Edit `src/brand.js` to customize:
- Company name and app name
- Colors and styling
- Logo and favicon

### Theme

Edit `src/theme.scss` to customize:
- Modal appearance
- Button styles
- Layout and spacing
- Responsive behavior

### Features

Edit `src/config.js` to enable/disable:
- Dialer, calls, settings tabs
- Copper integration features
- AI summary processing
- Call recording

## Deployment

1. Build the widget: `npm run build`
2. Copy `build/` contents to your web server
3. Update iframe src in `kanva-widget-integration.js` to point to your deployed widget
4. Ensure Firebase Functions are deployed and accessible

## Troubleshooting

### Common Issues

- **Widget not loading**: Check iframe src path and CORS settings
- **Authentication errors**: Verify RingCentral credentials in .env
- **Copper integration failing**: Check Firebase Functions endpoints
- **Modal not showing**: Verify Copper DOM selectors in integration script

### Debug Mode

Enable debug mode in `.env`:
```bash
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=debug
