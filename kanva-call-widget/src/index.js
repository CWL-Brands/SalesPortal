import 'regenerator-runtime/runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from 'redux';

import { createPhone } from './modules/Phone';
import App from './containers/App';
import brandConfig from './brand';
import config from './config';
import prefix from './prefix';

const apiConfig = {
  server: process.env.REACT_APP_RC_SERVER || config.apiConfig.server,
  clientId: process.env.REACT_APP_RC_CLIENT_ID || config.apiConfig.clientId,
  clientSecret: process.env.REACT_APP_RC_CLIENT_SECRET || config.apiConfig.clientSecret,
  redirectUri: process.env.REACT_APP_RC_REDIRECT_URI || config.apiConfig.redirectUri,
};

const appVersion = process.env.REACT_APP_APP_VERSION || '1.0.0';
const hostingUrl = process.env.REACT_APP_HOSTING_URL || window.location.origin;

const phone = createPhone({
  apiConfig,
  brandConfig,
  prefix,
  appVersion,
  redirectUri: apiConfig.redirectUri,
});

const store = createStore(phone.reducer);

phone.setStore(store);

// Make phone available globally for integration
window.phone = phone;
window.kanvaConfig = config;

// Listen for messages from parent window (Copper integration)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'navigate':
        if (event.data.path && phone.routerInteraction) {
          phone.routerInteraction.push(event.data.path);
        }
        break;
      case 'make-call':
        if (event.data.phoneNumber && phone.webphone) {
          phone.webphone.makeCall({ phoneNumber: event.data.phoneNumber });
        }
        break;
      case 'copper-customer-data':
        // Store customer data for use in call handling
        window.copperCustomer = event.data.customer;
        break;
    }
  }
});

// Send status updates to parent window
if (phone.webphone) {
  phone.webphone.on('callRing', (call) => {
    window.parent.postMessage({
      type: 'rc-call-ring-notify',
      call: call
    }, '*');
  });

  phone.webphone.on('callStart', (call) => {
    window.parent.postMessage({
      type: 'rc-call-start-notify',
      call: call
    }, '*');
  });

  phone.webphone.on('callEnd', (call) => {
    window.parent.postMessage({
      type: 'rc-call-end-notify',
      call: call
    }, '*');
  });
}

ReactDOM.render(
  <App phone={phone} hostingUrl={hostingUrl} />,
  document.querySelector('div#viewport'),
);
