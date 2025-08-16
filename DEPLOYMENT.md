# Kanva RingCentral-Copper Integration Deployment Guide

This guide covers deploying the complete RingCentral-Copper CRM integration for Kanva Botanicals.

## Prerequisites

- Node.js 16+ and npm
- Firebase CLI installed and authenticated
- RingCentral Business account with app credentials
- Copper CRM API access

## Step 1: Fix Firebase Functions Dependencies

Navigate to the functions directory and install dependencies:

```bash
cd functions/
npm install
```

If you encounter issues, the `package.json` has been fixed to remove circular dependencies and deprecated packages.

## Step 2: Deploy Firebase Functions

Deploy the backend functions that handle Copper integration and AI processing:

```bash
firebase deploy --only functions
```

This deploys the following endpoints:
- `/api/rc/copper/lookup` - Customer lookup by phone
- `/api/rc/copper/log-call` - Log calls in Copper
- `/api/rc/copper/add-summary` - Add AI summaries to Copper
- `/api/rc/ai/summary` - Process AI call summaries

## Step 3: Configure RingCentral Widget

### Environment Setup

1. Navigate to the widget directory:
```bash
cd kanva-call-widget/
```

2. Copy and configure environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` with your RingCentral credentials:
```bash
REACT_APP_RC_CLIENT_ID=your_ringcentral_client_id
REACT_APP_RC_CLIENT_SECRET=your_ringcentral_client_secret
REACT_APP_RC_REDIRECT_URI=https://yourdomain.com/redirect.html
```

### Install Dependencies and Build

```bash
npm install
npm run build
```

This creates a `build/` directory with the compiled widget.

## Step 4: Deploy Widget Files

Copy the built widget files to your web server:

```bash
# Copy build contents to your web server
cp -r build/* /path/to/your/webserver/kanva-call-widget/
```

Or if using Firebase Hosting, update `firebase.json` to include the widget build:

```json
{
  "hosting": {
    "public": ".",
    "rewrites": [
      {
        "source": "/kanva-call-widget/**",
        "destination": "/kanva-call-widget/index.html"
      }
    ]
  }
}
```

## Step 5: Update Integration Script

Ensure the iframe src in `js/kanva-widget-integration.js` points to your deployed widget:

```javascript
iframe.src = 'https://yourdomain.com/kanva-call-widget/index.html';
```

## Step 6: Configure RingCentral App

In your RingCentral Developer Console:

1. Set **Redirect URI** to match your deployment:
   - `https://yourdomain.com/redirect.html`

2. Enable required permissions:
   - **Call Control**
   - **Read Call Log**
   - **WebRTC**
   - **Subscription**

3. Configure webhooks (if using RingSense AI):
   - Webhook URL: `https://yourdomain.com/api/rc/ringsense`

## Step 7: Configure Copper CRM

1. Obtain Copper API key from your Copper settings
2. Add API key to Firebase Functions environment:

```bash
firebase functions:config:set copper.api_key="your_copper_api_key"
firebase functions:config:set copper.user_email="your_copper_email"
```

3. Deploy functions with new config:
```bash
firebase deploy --only functions
```

## Step 8: Test Integration

### Basic Tests

1. **Widget Loading**: Visit your deployment and verify the phone icon appears in Copper
2. **Modal Display**: Click phone icon to ensure widget modal opens
3. **Authentication**: Verify RingCentral login works in the widget
4. **Dialer**: Test making outbound calls through the widget

### End-to-End Tests

1. **Incoming Call Flow**:
   - Make a call to your RingCentral number
   - Verify modal pops up with caller info
   - Check customer lookup works (if phone number exists in Copper)

2. **Call Logging**:
   - Complete a call
   - Verify call is logged as activity in Copper CRM

3. **AI Summary** (if configured):
   - Complete a recorded call
   - Check that AI summary is added to customer profile

## Troubleshooting

### Common Issues

**Widget not loading in modal**:
- Check iframe src path
- Verify CORS headers allow embedding
- Check browser console for errors

**Authentication failures**:
- Verify RingCentral credentials in .env
- Check redirect URI matches exactly
- Ensure app permissions are correct

**Copper integration not working**:
- Verify Firebase Functions are deployed
- Check Copper API key configuration
- Review function logs: `firebase functions:log`

**Modal not appearing on incoming calls**:
- Check webhook configuration
- Verify RingCentral subscription setup
- Review browser console for JavaScript errors

### Debug Mode

Enable debug logging:

1. In widget `.env`:
```bash
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=debug
```

2. Rebuild and redeploy widget:
```bash
npm run build
# Copy build files to server
```

### Log Monitoring

Monitor Firebase Functions logs:
```bash
firebase functions:log --only ringcentralCopper,ringcentralAI
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files with real credentials
2. **CORS**: Configure proper CORS headers for iframe embedding
3. **API Keys**: Use Firebase Functions config for sensitive keys
4. **HTTPS**: Ensure all endpoints use HTTPS in production
5. **Webhook Security**: Implement HMAC signature verification for webhooks

## Performance Optimization

1. **Widget Loading**: Consider lazy loading the widget iframe
2. **Caching**: Enable appropriate caching headers for static assets
3. **CDN**: Use CDN for widget assets if serving globally
4. **Function Cold Starts**: Consider keeping functions warm for critical paths

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep RingCentral SDK and other packages updated
2. **Monitor Logs**: Regular review of function logs for errors
3. **Test Integration**: Periodic end-to-end testing
4. **Backup Configuration**: Keep environment configs backed up securely

### Scaling Considerations

- Firebase Functions auto-scale, but monitor usage and costs
- Consider implementing rate limiting for webhook endpoints
- Monitor Copper API rate limits and implement backoff strategies

## Support

For issues with this integration:
1. Check Firebase Functions logs
2. Review browser console errors
3. Test individual components (widget, functions, Copper API)
4. Verify all configuration matches this deployment guide
