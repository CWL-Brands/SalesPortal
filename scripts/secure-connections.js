/**
 * Secure Connections Handler
 * Manages connections.json by substituting sensitive values with environment variables
 * 
 * This script:
 * 1. Reads the existing connections.json file
 * 2. Replaces sensitive values with values from .env
 * 3. Provides methods to update connections while keeping sensitive data secure
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const CONNECTIONS_PATH = path.join(__dirname, '..', 'data', 'connections.json');
const SENSITIVE_KEYS = {
  github: ['token'],
  copper: ['apiKey'],
  fishbowl: ['password'],
  shipstation: ['apiKey', 'apiSecret', 'webhookSecret']
};

/**
 * Read connections.json and replace sensitive values with environment variables
 */
function secureConnections() {
  try {
    // Read the current connections file
    const connections = JSON.parse(fs.readFileSync(CONNECTIONS_PATH, 'utf8'));
    
    // Update with values from environment variables
    if (process.env.GITHUB_TOKEN && connections.github) {
      connections.github.token = process.env.GITHUB_TOKEN;
    }
    
    if (process.env.COPPER_API_KEY && connections.copper) {
      connections.copper.apiKey = process.env.COPPER_API_KEY;
    }
    
    if (process.env.FISHBOWL_PASSWORD && connections.fishbowl) {
      connections.fishbowl.password = process.env.FISHBOWL_PASSWORD;
    }
    
    if (connections.shipstation) {
      if (process.env.SHIPSTATION_API_KEY) {
        connections.shipstation.apiKey = process.env.SHIPSTATION_API_KEY;
      }
      if (process.env.SHIPSTATION_API_SECRET) {
        connections.shipstation.apiSecret = process.env.SHIPSTATION_API_SECRET;
      }
      if (process.env.SHIPSTATION_WEBHOOK_SECRET) {
        connections.shipstation.webhookSecret = process.env.SHIPSTATION_WEBHOOK_SECRET;
      }
    }
    
    // Update timestamps for all integrations
    if (connections.github) connections.github.timestamp = new Date().toISOString();
    if (connections.copper) connections.copper.lastUpdated = new Date().toISOString();
    if (connections.fishbowl) connections.fishbowl.lastUpdated = new Date().toISOString();
    if (connections.shipstation) connections.shipstation.lastUpdated = new Date().toISOString();
    
    // Write back to the file
    fs.writeFileSync(CONNECTIONS_PATH, JSON.stringify(connections, null, 2));
    console.log('✅ Secured connections.json with values from .env');
    
    return true;
  } catch (error) {
    console.error('❌ Error securing connections:', error);
    return false;
  }
}

/**
 * Create a sanitized version of connections.json for Git
 * This replaces sensitive values with placeholders
 */
function createSanitizedConnections() {
  try {
    // Read the current connections file
    const connections = JSON.parse(fs.readFileSync(CONNECTIONS_PATH, 'utf8'));
    
    // Create a deep copy
    const sanitized = JSON.parse(JSON.stringify(connections));
    
    // Replace sensitive values with placeholders
    if (sanitized.github && sanitized.github.token) {
      sanitized.github.token = 'YOUR_GITHUB_TOKEN';
    }
    
    if (sanitized.copper && sanitized.copper.apiKey) {
      sanitized.copper.apiKey = 'YOUR_COPPER_API_KEY';
    }
    
    if (sanitized.fishbowl && sanitized.fishbowl.password) {
      sanitized.fishbowl.password = 'YOUR_FISHBOWL_PASSWORD';
    }
    
    if (sanitized.shipstation) {
      if (sanitized.shipstation.apiKey) {
        sanitized.shipstation.apiKey = 'YOUR_SHIPSTATION_API_KEY';
      }
      if (sanitized.shipstation.apiSecret) {
        sanitized.shipstation.apiSecret = 'YOUR_SHIPSTATION_API_SECRET';
      }
      if (sanitized.shipstation.webhookSecret) {
        sanitized.shipstation.webhookSecret = 'YOUR_SHIPSTATION_WEBHOOK_SECRET';
      }
    }
    
    // Write to a sanitized file that can be committed to Git
    const sanitizedPath = path.join(__dirname, '..', 'data', 'connections.example.json');
    fs.writeFileSync(sanitizedPath, JSON.stringify(sanitized, null, 2));
    console.log('✅ Created sanitized connections.example.json');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating sanitized connections:', error);
    return false;
  }
}

/**
 * Update connections.json with new values and update .env file
 * @param {Object} updates - Object with updates to apply
 */
function updateConnections(updates) {
  try {
    // Read the current connections file
    const connections = JSON.parse(fs.readFileSync(CONNECTIONS_PATH, 'utf8'));
    
    // Apply updates
    for (const [section, values] of Object.entries(updates)) {
      if (!connections[section]) {
        connections[section] = {};
      }
      
      for (const [key, value] of Object.entries(values)) {
        connections[section][key] = value;
        
        // If this is a sensitive value, update the .env file
        if (SENSITIVE_KEYS[section] && SENSITIVE_KEYS[section].includes(key)) {
          updateEnvFile(section, key, value);
        }
      }
    }
    
    // Update timestamps
    if (connections.github) {
      connections.github.timestamp = new Date().toISOString();
    }
    if (connections.copper) {
      connections.copper.lastUpdated = new Date().toISOString();
    }
    
    // Write back to the file
    fs.writeFileSync(CONNECTIONS_PATH, JSON.stringify(connections, null, 2));
    console.log('✅ Updated connections.json with new values');
    
    return true;
  } catch (error) {
    console.error('❌ Error updating connections:', error);
    return false;
  }
}

/**
 * Update a value in the .env file
 * @param {String} section - Section name (github, copper, etc.)
 * @param {String} key - Key name
 * @param {String} value - New value
 */
function updateEnvFile(section, key, value) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Map section and key to environment variable name
    let envVar;
    if (section === 'github' && key === 'token') {
      envVar = 'GITHUB_TOKEN';
    } else if (section === 'copper' && key === 'apiKey') {
      envVar = 'COPPER_API_KEY';
    } else if (section === 'fishbowl' && key === 'password') {
      envVar = 'FISHBOWL_PASSWORD';
    } else if (section === 'shipstation') {
      if (key === 'apiKey') {
        envVar = 'SHIPSTATION_API_KEY';
      } else if (key === 'apiSecret') {
        envVar = 'SHIPSTATION_API_SECRET';
      } else if (key === 'webhookSecret') {
        envVar = 'SHIPSTATION_WEBHOOK_SECRET';
      }
    }
    
    if (!envVar) {
      return;
    }
    
    // Check if the variable already exists in the .env file
    const regex = new RegExp(`^${envVar}=.*$`, 'm');
    if (regex.test(envContent)) {
      // Update existing variable
      envContent = envContent.replace(regex, `${envVar}=${value}`);
    } else {
      // Add new variable
      envContent += `\n${envVar}=${value}`;
    }
    
    // Write back to the .env file
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated ${envVar} in .env file`);
  } catch (error) {
    console.error(`❌ Error updating .env file:`, error);
  }
}

// Run the script
secureConnections();
createSanitizedConnections();

module.exports = {
  secureConnections,
  createSanitizedConnections,
  updateConnections
};
