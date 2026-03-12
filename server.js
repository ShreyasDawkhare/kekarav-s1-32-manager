const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 132;
const BASE_PATH = '/kekarav-s132';
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file if not exists
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const defaultData = {
            tasks: [],
            taskIdCounter: 1,
            users: [
                { id: 0, name: 'Unknown User', role: 'Unassigned' },
                { id: 1, name: 'John Developer', role: 'Developer' },
                { id: 2, name: 'Jane QA', role: 'QA' },
                { id: 3, name: 'Bob Manager', role: 'Manager' },
                { id: 4, name: 'Alice Lead', role: 'Lead' }
            ]
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        console.log('Created data.json with default data');
    }
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json'
};

// Read data
function readData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Write data
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Parse request body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Create server
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Redirect root to base path
    if (pathname === '/') {
        res.writeHead(302, { 'Location': BASE_PATH });
        res.end();
        return;
    }

    // Check if path starts with base path
    if (!pathname.startsWith(BASE_PATH)) {
        res.writeHead(404);
        res.end('Not found. Go to: ' + BASE_PATH);
        return;
    }

    // Remove base path for internal routing
    pathname = pathname.substring(BASE_PATH.length) || '/';

    // API Routes
    if (pathname === '/api/data' && req.method === 'GET') {
        // Get all data
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readData()));
        return;
    }

    if (pathname === '/api/data' && req.method === 'POST') {
        // Save all data
        const body = await parseBody(req);
        writeData(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err) {
        res.writeHead(404);
        res.end('File not found');
    }
});

// Start server
initDataFile();
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Kekarav S1-32 Manager Running!`);
    console.log(`  Open: http://localhost:${PORT}${BASE_PATH}`);
    console.log(`  Data stored in: data.json`);
    console.log(`  Press Ctrl+C to stop`);
    console.log(`========================================\n`);
});

// Graceful shutdown handling
function shutdown() {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
    // Force exit after 3 seconds if server doesn't close
    setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', shutdown);  // Ctrl+C
process.on('SIGTERM', shutdown); // Kill command
process.on('SIGHUP', shutdown);  // Terminal closed (Unix)

// Windows-specific: handle when console window is closed
if (process.platform === 'win32') {
    process.on('SIGBREAK', shutdown);

    // Keep the process referenced so it can be killed
    process.stdin.resume();
}

