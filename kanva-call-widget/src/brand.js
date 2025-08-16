import { createBrandConfig } from '@ringcentral-integration/commons/modules/Brand/createBrandConfig';

export default createBrandConfig({
  id: '1210',
  code: 'kanva',
  name: 'Kanva Botanicals',
  appName: 'Kanva Caller',
  application: 'Kanva Sales Portal',
  allowRegionSettings: true,
  callWithJupiter: {
    link: 'https://app.ringcentral.com/',
    protocol: 'rcapp://',
    name: 'RingCentral Phone',
  },
  callWithSoftphone: {
    protocol: 'rcmobile://',
    name: 'RingCentral Phone',
  },
  rcvTeleconference: 'https://v.ringcentral.com/teleconference',
  meetingUriReg: {
    rcm: undefined,
    rcv: undefined,
  },
  allowJupiterUniversalLink: true,
  // Kanva-specific customizations
  colors: {
    primary: '#2d5a2d',
    secondary: '#4a7c59',
    accent: '#6b8e6b',
    background: '#f8fdf8',
    text: '#1f2937'
  },
  logo: '/assets/logo/kanva-logo-white.png',
  favicon: '/assets/logo/kanva-favicon.ico'
});
