const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

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
    fishbowl: null
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
            
            if (!['github', 'copper', 'fishbowl'].includes(connectionType)) {
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
