const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connections = {
  github: {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO || 'benatkanva/kanva-quotes',
    branch: process.env.GITHUB_BRANCH || 'main',
    username: process.env.GITHUB_USERNAME || 'benatkanva',
    email: process.env.GITHUB_EMAIL || 'ben@kanvabotanicals.com',
    timestamp: new Date().toISOString()
  },
  copper: {
    apiKey: process.env.COPPER_API_KEY,
    email: process.env.COPPER_USER_EMAIL || 'ben@kanvabotanicals.com',
    environment: process.env.NODE_ENV || 'production',
    lastUpdated: new Date().toISOString()
  },
  fishbowl: {
    connected: !!(process.env.FISHBOWL_USERNAME && process.env.FISHBOWL_PASSWORD),
    username: process.env.FISHBOWL_USERNAME || null,
    password: process.env.FISHBOWL_PASSWORD || null,
    host: process.env.FISHBOWL_HOST || null,
    port: process.env.FISHBOWL_PORT || 28192,
    iaid: process.env.FISHBOWL_IAID || '42',
    ianame: process.env.FISHBOWL_IANAME || 'KanvaSync',
    iadescription: process.env.FISHBOWL_IADESCRIPTION || 'Sync orders and inventory'
  },
  shipstation: {
    apiKey: process.env.SHIPSTATION_API_KEY || process.env.ShipStation_API_Key,
    apiSecret: process.env.SHIPSTATION_API_SECRET || process.env.ShipStation_Secret_Key,
    webhookUrl: process.env.SHIPSTATION_WEBHOOK_URL || '',
    webhookSecret: process.env.SHIPSTATION_WEBHOOK_SECRET || ''
  }
};

const outputPath = path.join(__dirname, '..', 'data', 'connections.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(connections, null, 2));

console.log('Generated connections.json from environment variables');
