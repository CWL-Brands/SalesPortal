// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
import multiparty from 'multiparty';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Store for integration connections
const connectionsStore = {
    github: null,
    copper: null,
    fishbowl: null,
    shipstation: null
};

// Path to store connections locally
const CONNECTIONS_FILE = path.join(__dirname, 'data', 'connections.json');

// Load existing connections if available
try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
        const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
        const savedConnections = JSON.parse(data);
        Object.assign(connectionsStore, savedConnections);
        console.log('✅ Loaded existing connections from file');
    }
} catch (error) {
    console.error('❌ Error loading connections:', error);
}

// Save connections to file
function saveConnectionsToFile() {
    try {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Write connections to file
        fs.writeFileSync(
            CONNECTIONS_FILE, 
            JSON.stringify(connectionsStore, null, 2),
            'utf8'
        );
        console.log('✅ Saved connections to file');
        return true;
    } catch (error) {
        console.error('❌ Error saving connections:', error);
        return false;
    }
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`${req.method} ${pathname}`);

    // Handle API requests
    if (pathname.startsWith('/api/')) {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // -------------------------------
        // Metadata: Copper (refresh & get)
        // -------------------------------
        else if (pathname === '/api/metadata/copper/refresh' && req.method === 'GET') {
            // Fetch live Copper metadata and cache to data/metadata.copper.json
            (async () => {
                try {
                    // Resolve credentials: prefer stored connections, fallback to env
                    const copperCfg = connectionsStore.copper || {};
                    const apiKey = copperCfg.apiKey || process.env.COPPER_API_KEY || '';
                    const userEmail = copperCfg.userEmail || process.env.COPPER_USER_EMAIL || '';
                    if (!apiKey || !userEmail) {
                        throw new Error('Missing Copper API credentials (apiKey/userEmail)');
                    }

                    const baseUrl = 'https://api.prosperworks.com/developer_api/v1';

                    // Use global fetch if available, else dynamic import
                    const fetchImpl = (typeof fetch !== 'undefined') ? fetch : (await import('node-fetch')).default;
                    const headers = {
                        'X-PW-AccessToken': apiKey,
                        'X-PW-Application': 'developer_api',
                        'X-PW-UserEmail': userEmail,
                        'Content-Type': 'application/json'
                    };

                    const [oppFieldsRes, companyFieldsRes, pipelinesRes, stagesRes] = await Promise.all([
                        fetchImpl(`${baseUrl}/custom_field_definitions?parent_type=opportunity`, { headers }),
                        fetchImpl(`${baseUrl}/custom_field_definitions?parent_type=company`, { headers }),
                        fetchImpl(`${baseUrl}/pipelines`, { headers }),
                        fetchImpl(`${baseUrl}/stages`, { headers })
                    ]);

                    if (!oppFieldsRes.ok || !companyFieldsRes.ok || !pipelinesRes.ok || !stagesRes.ok) {
                        const details = {
                            opportunityFieldsStatus: oppFieldsRes.status,
                            companyFieldsStatus: companyFieldsRes.status,
                            pipelinesStatus: pipelinesRes.status,
                            stagesStatus: stagesRes.status
                        };
                        throw new Error(`Copper metadata fetch failed: ${JSON.stringify(details)}`);
                    }

                    const [opportunityFields, companyFields, pipelines, stages] = await Promise.all([
                        oppFieldsRes.json(),
                        companyFieldsRes.json(),
                        pipelinesRes.json(),
                        stagesRes.json()
                    ]);

                    const copperMetadata = {
                        fetchedAt: new Date().toISOString(),
                        customFields: {
                            opportunity: opportunityFields,
                            company: companyFields
                        },
                        pipelines,
                        stages
                    };

                    const metadataDir = path.join(__dirname, 'data');
                    if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });
                    fs.writeFileSync(path.join(metadataDir, 'metadata.copper.json'), JSON.stringify(copperMetadata, null, 2), 'utf8');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, data: copperMetadata }));
                } catch (error) {
                    console.error('❌ Copper metadata refresh error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Copper metadata refresh failed', error: error.message }));
                }
            })();
            return;
        }
        else if (pathname === '/api/metadata/copper' && req.method === 'GET') {
            try {
                const file = path.join(__dirname, 'data', 'metadata.copper.json');
                if (!fs.existsSync(file)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Copper metadata not found. Refresh first.' }));
                    return;
                }
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Failed to read Copper metadata', error: error.message }));
            }
            return;
        }
        // ------------------------------------
        // Metadata: ShipStation (refresh & get)
        // ------------------------------------
        else if (pathname === '/api/metadata/shipstation/refresh' && req.method === 'GET') {
            (async () => {
                try {
                    const ssCfg = connectionsStore.shipstation || {};
                    const apiKey = ssCfg.apiKey || process.env.SHIPSTATION_API_KEY || '';
                    const apiSecret = ssCfg.apiSecret || process.env.SHIPSTATION_API_SECRET || '';
                    if (!apiKey || !apiSecret) {
                        throw new Error('Missing ShipStation API credentials (apiKey/apiSecret)');
                    }

                    const baseUrl = 'https://ssapi.shipstation.com';
                    const fetchImpl = (typeof fetch !== 'undefined') ? fetch : (await import('node-fetch')).default;

                    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
                    const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json' };

                    // Fetch carriers and stores first
                    const [carriersRes, storesRes] = await Promise.all([
                        fetchImpl(`${baseUrl}/carriers`, { headers }),
                        fetchImpl(`${baseUrl}/stores`, { headers })
                    ]);
                    if (!carriersRes.ok || !storesRes.ok) {
                        const details = { carriersStatus: carriersRes.status, storesStatus: storesRes.status };
                        throw new Error(`ShipStation carriers/stores fetch failed: ${JSON.stringify(details)}`);
                    }
                    const carriers = await carriersRes.json();
                    const stores = await storesRes.json();

                    // For each carrier, fetch services and packages (best-effort)
                    const servicesByCarrier = {};
                    const packagesByCarrier = {};
                    for (const c of carriers) {
                        const code = c.code || c.carrierCode || c.name;
                        if (!code) continue;
                        try {
                            const [servicesRes, packagesRes] = await Promise.all([
                                fetchImpl(`${baseUrl}/carriers/listservices?carrierCode=${encodeURIComponent(code)}`, { headers }),
                                fetchImpl(`${baseUrl}/carriers/listpackages?carrierCode=${encodeURIComponent(code)}`, { headers })
                            ]);
                            servicesByCarrier[code] = servicesRes.ok ? await servicesRes.json() : [];
                            packagesByCarrier[code] = packagesRes.ok ? await packagesRes.json() : [];
                        } catch (e) {
                            console.warn(`⚠️ ShipStation services/packages fetch failed for ${code}:`, e.message);
                            servicesByCarrier[code] = servicesByCarrier[code] || [];
                            packagesByCarrier[code] = packagesByCarrier[code] || [];
                        }
                    }

                    const ssMetadata = {
                        fetchedAt: new Date().toISOString(),
                        carriers,
                        servicesByCarrier,
                        packagesByCarrier,
                        stores
                    };

                    const metadataDir = path.join(__dirname, 'data');
                    if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });
                    fs.writeFileSync(path.join(metadataDir, 'metadata.shipstation.json'), JSON.stringify(ssMetadata, null, 2), 'utf8');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, data: ssMetadata }));
                } catch (error) {
                    console.error('❌ ShipStation metadata refresh error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'ShipStation metadata refresh failed', error: error.message }));
                }
            })();
            return;
        }
        else if (pathname === '/api/metadata/shipstation' && req.method === 'GET') {
            try {
                const file = path.join(__dirname, 'data', 'metadata.shipstation.json');
                if (!fs.existsSync(file)) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'ShipStation metadata not found. Refresh first.' }));
                    return;
                }
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Failed to read ShipStation metadata', error: error.message }));
            }
            return;
        }
        // -------------------------------
        // Mapping: ShipStation → Copper
        // -------------------------------
        else if (pathname === '/api/mappings/shipstation-to-copper' && req.method === 'GET') {
            try {
                const file = path.join(__dirname, 'data', 'mappings.shipstation_to_copper.json');
                if (!fs.existsSync(file)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, data: null, message: 'No mapping found yet' }));
                    return;
                }
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Failed to read mapping', error: error.message }));
            }
            return;
        }
        else if (pathname === '/api/mappings/shipstation-to-copper' && req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const file = path.join(__dirname, 'data', 'mappings.shipstation_to_copper.json');
                    const dir = path.dirname(file);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Mapping saved', data }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Invalid mapping payload', error: error.message }));
                }
            });
            return;
        }
        
        // Handle API endpoints
        if (pathname === '/api/connections' && req.method === 'GET') {
            // Get connections
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: connectionsStore
            }));
            return;
        } 
        else if (pathname === '/api/connections' && req.method === 'POST') {
            // Update connections
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    // Update connections store
                    if (data.github) connectionsStore.github = data.github;
                    if (data.copper) connectionsStore.copper = data.copper;
                    if (data.fishbowl) connectionsStore.fishbowl = data.fishbowl;
                    if (data.shipstation) connectionsStore.shipstation = data.shipstation;
                    
                    // Save to file
                    const saved = saveConnectionsToFile();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: saved,
                        message: saved ? 'Connections saved successfully' : 'Failed to save connections',
                        data: connectionsStore
                    }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid request data',
                        error: error.message
                    }));
                }
            });
            return;
        }
        else if (pathname.startsWith('/api/connections/') && req.method === 'PUT') {
            // Update specific connection
            const connectionType = pathname.split('/').pop();
            
            if (!['github', 'copper', 'fishbowl', 'shipstation'].includes(connectionType)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Invalid connection type'
                }));
                return;
            }
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    // Update specific connection
                    connectionsStore[connectionType] = data;
                    
                    // Save to file
                    const saved = saveConnectionsToFile();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: saved,
                        message: saved ? `${connectionType} connection saved successfully` : `Failed to save ${connectionType} connection`,
                        data: connectionsStore[connectionType]
                    }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Invalid request data',
                        error: error.message
                    }));
                }
            });
            return;
        }
        else if (pathname === '/api/env-config' && req.method === 'GET') {
            // Securely provide environment variables to admin dashboard
            try {
                const envConfig = {
                    github: {
                        token: process.env.GITHUB_TOKEN || '',
                        repo: process.env.GITHUB_REPO || 'benatkanva/kanva-quotes',
                        branch: process.env.GITHUB_BRANCH || 'main',
                        username: process.env.GITHUB_USERNAME || 'benatkanva',
                        email: process.env.GITHUB_EMAIL || 'ben@kanvabotanicals.com'
                    },
                    copper: {
                        apiKey: process.env.COPPER_API_KEY || '',
                        userEmail: process.env.COPPER_USER_EMAIL || ''
                    },
                    shipstation: {
                        apiKey: process.env.SHIPSTATION_API_KEY || '',
                        apiSecret: process.env.SHIPSTATION_API_SECRET || ''
                    }
                };
                
                console.log('🔐 Providing environment config to admin dashboard');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: envConfig
                }));
            } catch (error) {
                console.error('❌ Error providing env config:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Failed to load environment configuration',
                    error: error.message
                }));
            }
            return;
        }
        else if (pathname === '/api/save-data' && req.method === 'POST') {
            // Save data to JSON files
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const { filename, data, message } = JSON.parse(body);
                    
                    if (!filename || !data) {
                        throw new Error('Filename and data are required');
                    }
                    
                    // Ensure the file path is safe (within project directory)
                    const safePath = path.join(__dirname, filename);
                    const projectDir = path.resolve(__dirname);
                    const resolvedPath = path.resolve(safePath);
                    
                    if (!resolvedPath.startsWith(projectDir)) {
                        throw new Error('Invalid file path');
                    }
                    
                    // Ensure directory exists
                    const dir = path.dirname(resolvedPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    
                    // Write data to file (stringify if it's an object)
                    const dataToWrite = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                    fs.writeFileSync(resolvedPath, dataToWrite, 'utf8');
                    
                    console.log(`✅ Saved data to ${filename}`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: `Data saved to ${filename} successfully`,
                        filename: filename
                    }));
                } catch (error) {
                    console.error('❌ Error saving data:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Failed to save data',
                        error: error.message
                    }));
                }
            });
            return;
        }
        else if (pathname === '/api/upload-image' && req.method === 'POST') {
            // Handle image upload
            const form = new multiparty.Form();
            
            form.parse(req, (err, fields, files) => {
                if (err) {
                    console.error('❌ Error parsing form:', err);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Failed to parse upload form',
                        error: err.message
                    }));
                    return;
                }
                
                try {
                    const productId = fields.productId ? fields.productId[0] : 'unknown';
                    const imageFile = files.image ? files.image[0] : null;
                    
                    if (!imageFile) {
                        throw new Error('No image file provided');
                    }
                    
                    // Generate filename
                    const timestamp = Date.now();
                    const ext = path.extname(imageFile.originalFilename) || '.png';
                    const filename = `${productId}_${timestamp}${ext}`;
                    const targetPath = path.join(__dirname, 'assets', 'product_renders', filename);
                    
                    // Ensure directory exists
                    const dir = path.dirname(targetPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    
                    // Move uploaded file to target location
                    fs.copyFileSync(imageFile.path, targetPath);
                    
                    // Clean up temp file
                    fs.unlinkSync(imageFile.path);
                    
                    console.log(`✅ Image uploaded: ${filename}`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Image uploaded successfully',
                        filename: filename,
                        path: `assets/product_renders/${filename}`
                    }));
                } catch (error) {
                    console.error('❌ Error uploading image:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        message: 'Failed to upload image',
                        error: error.message
                    }));
                }
            });
            return;
        }
        else if (pathname === '/api/env-config' && req.method === 'GET') {
            // Get environment configuration for integrations
            try {
                // Load environment variables (only expose what's needed for integrations)
                const envConfig = {
                    github: {
                        token: process.env.GITHUB_TOKEN || '',
                        repo: process.env.GITHUB_REPO || 'benatkanva/kanva-quotes',
                        branch: process.env.GITHUB_BRANCH || 'main',
                        username: process.env.GITHUB_USERNAME || 'benatkanva',
                        email: process.env.GITHUB_EMAIL || 'ben@kanvabotanicals.com'
                    },
                    copper: {
                        apiKey: process.env.COPPER_API_KEY || '',
                        email: process.env.COPPER_EMAIL || '',
                        environment: process.env.COPPER_ENVIRONMENT || 'production'
                    },
                    shipstation: {
                        apiKey: process.env.SHIPSTATION_API_KEY || '',
                        apiSecret: process.env.SHIPSTATION_API_SECRET || '',
                        environment: process.env.SHIPSTATION_ENVIRONMENT || 'production'
                    },
                    fishbowl: {
                        host: process.env.FISHBOWL_HOST || '',
                        username: process.env.FISHBOWL_USERNAME || '',
                        password: process.env.FISHBOWL_PASSWORD || ''
                    }
                };
                
                console.log('✅ Environment config requested');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Environment configuration loaded',
                    data: envConfig
                }));
            } catch (error) {
                console.error('❌ Error loading environment config:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Failed to load environment configuration',
                    error: error.message
                }));
            }
            return;
        }
        
        // API endpoint not found
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'API endpoint not found'
        }));
        return;
    }

    // Handle favicon.ico request
    if (pathname === '/favicon.ico') {
        res.statusCode = 204; // No content
        res.end();
        return;
    }

    // Normalize URL path for static files
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                fs.readFile('./404.html', (error, content) => {
                    if (error) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1>');
                    } else {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
    console.log(`API endpoints available at http://127.0.0.1:${PORT}/api/connections`);
});
