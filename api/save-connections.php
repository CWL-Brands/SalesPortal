<?php
/**
 * Save Connections API Endpoint
 * Securely saves connection settings while protecting sensitive data
 */

// Allow cross-origin requests from the same domain
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only POST requests are allowed']);
    exit;
}

// Get the raw POST data
$rawData = file_get_contents("php://input");
$connections = json_decode($rawData, true);

if (!$connections) {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Invalid JSON data']);
    exit;
}

// Define sensitive keys that should be handled securely
$sensitiveKeys = [
    'github' => ['token'],
    'copper' => ['apiKey'],
    'fishbowl' => ['password'],
    'shipstation' => ['apiKey', 'apiSecret', 'webhookSecret']
];

// Load the current connections file
$connectionsPath = '../data/connections.json';
$currentConnections = [];

if (file_exists($connectionsPath)) {
    $currentConnections = json_decode(file_get_contents($connectionsPath), true);
}

// Merge the new connections with the current ones
foreach ($connections as $section => $values) {
    if (!isset($currentConnections[$section])) {
        $currentConnections[$section] = [];
    }
    
    foreach ($values as $key => $value) {
        // Update the value
        $currentConnections[$section][$key] = $value;
        
        // If this is a sensitive value, update the .env file
        if (isset($sensitiveKeys[$section]) && in_array($key, $sensitiveKeys[$section])) {
            updateEnvFile($section, $key, $value);
        }
    }
}

// Update timestamps for all integrations
if (isset($currentConnections['github'])) {
    $currentConnections['github']['timestamp'] = date('c');
}
if (isset($currentConnections['copper'])) {
    $currentConnections['copper']['lastUpdated'] = date('c');
}
if (isset($currentConnections['fishbowl'])) {
    $currentConnections['fishbowl']['lastUpdated'] = date('c');
}
if (isset($currentConnections['shipstation'])) {
    $currentConnections['shipstation']['lastUpdated'] = date('c');
}

// Write the updated connections back to the file
if (file_put_contents($connectionsPath, json_encode($currentConnections, JSON_PRETTY_PRINT))) {
    // Also create a sanitized version for Git
    createSanitizedConnections($currentConnections, $sensitiveKeys);
    
    echo json_encode(['success' => true, 'message' => 'Connections saved successfully']);
} else {
    http_response_code(500); // Internal Server Error
    echo json_encode(['success' => false, 'message' => 'Failed to save connections']);
}

/**
 * Update a value in the .env file
 * @param string $section Section name (github, copper, etc.)
 * @param string $key Key name
 * @param string $value New value
 */
function updateEnvFile($section, $key, $value) {
    $envPath = '../.env';
    
    if (!file_exists($envPath)) {
        return;
    }
    
    $envContent = file_get_contents($envPath);
    
    // Map section and key to environment variable name
    $envVar = null;
    if ($section === 'github' && $key === 'token') {
        $envVar = 'GITHUB_TOKEN';
    } else if ($section === 'copper' && $key === 'apiKey') {
        $envVar = 'COPPER_API_KEY';
    } else if ($section === 'fishbowl' && $key === 'password') {
        $envVar = 'FISHBOWL_PASSWORD';
    } else if ($section === 'shipstation') {
        if ($key === 'apiKey') {
            $envVar = 'SHIPSTATION_API_KEY';
        } else if ($key === 'apiSecret') {
            $envVar = 'SHIPSTATION_API_SECRET';
        } else if ($key === 'webhookSecret') {
            $envVar = 'SHIPSTATION_WEBHOOK_SECRET';
        }
    }
    
    if (!$envVar) {
        return;
    }
    
    // Check if the variable already exists in the .env file
    $pattern = '/^' . preg_quote($envVar, '/') . '=.*$/m';
    if (preg_match($pattern, $envContent)) {
        // Update existing variable
        $envContent = preg_replace($pattern, $envVar . '=' . $value, $envContent);
    } else {
        // Add new variable
        $envContent .= "\n" . $envVar . '=' . $value;
    }
    
    // Write back to the .env file
    file_put_contents($envPath, $envContent);
}

/**
 * Create a sanitized version of connections.json for Git
 * @param array $connections Connections data
 * @param array $sensitiveKeys Sensitive keys to sanitize
 */
function createSanitizedConnections($connections, $sensitiveKeys) {
    // Create a deep copy
    $sanitized = json_decode(json_encode($connections), true);
    
    // Replace sensitive values with placeholders
    foreach ($sensitiveKeys as $section => $keys) {
        if (isset($sanitized[$section])) {
            foreach ($keys as $key) {
                if (isset($sanitized[$section][$key])) {
                    $sanitized[$section][$key] = 'YOUR_' . strtoupper($section) . '_' . strtoupper($key);
                }
            }
        }
    }
    
    // Write to a sanitized file that can be committed to Git
    $sanitizedPath = '../data/connections.example.json';
    file_put_contents($sanitizedPath, json_encode($sanitized, JSON_PRETTY_PRINT));
}
?>
