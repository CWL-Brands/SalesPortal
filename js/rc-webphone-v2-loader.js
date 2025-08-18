// Loads RingCentral WebPhone v2 (ESM) with deps bundled and exposes it as a browser global
// Using esm.sh with ?bundle resolves bare imports like "mixpanel-browser" for direct browser use
import WebPhone from 'https://esm.sh/ringcentral-web-phone@2.2.7?bundle';
window.RingCentralWebPhone = WebPhone;
