const http = require('http');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const archiver = require('archiver');
const crypto = require('crypto');

const PORT = 132;
const BASE_PATH = '/kekarav-s132';
const DATA_FILE = path.join(__dirname, 'data.json');
const CONFIG_FILE = path.join(__dirname, 'appconfig.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BACKUP_RETENTION_DAYS = 3;
const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'welcome123';

const DEFAULT_APP_CONFIG = {
    maxFileSizeMB: 5,
    allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    backupRetentionDays: 3,
    maxBackupFiles: 50
};

// Check if a stored password is a bcrypt hash
function isBcryptHash(str) {
    return str && (str.startsWith('$2a$') || str.startsWith('$2b$') || str.startsWith('$2y$'));
}

// Initialize data file if not exists
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const hashedAdmin = bcrypt.hashSync('admin123', BCRYPT_ROUNDS);
        const hashedDefault = bcrypt.hashSync(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
        const defaultData = {
            tasks: [],
            taskIdCounter: 1,
            users: [
                { id: 0, name: 'Admin', role: 'Admin', password: hashedAdmin, mustResetPassword: false },
                { id: 1, name: 'John Developer', role: 'Developer', password: hashedDefault, mustResetPassword: true },
                { id: 2, name: 'Jane QA', role: 'QA', password: hashedDefault, mustResetPassword: true },
                { id: 3, name: 'Bob Manager', role: 'Manager', password: hashedDefault, mustResetPassword: true },
                { id: 4, name: 'Alice Lead', role: 'Lead', password: hashedDefault, mustResetPassword: true }
            ],
            activityLog: []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        console.log('Created data.json with default data (passwords hashed with bcrypt)');
    }
}

// Migrate existing plain-text passwords to bcrypt hashes
function migratePasswords() {
    const data = readData();
    let migrated = false;

    if (data.users && Array.isArray(data.users)) {
        data.users.forEach(user => {
            if (user.password && !isBcryptHash(user.password)) {
                const plainPassword = user.password;
                user.password = bcrypt.hashSync(plainPassword, BCRYPT_ROUNDS);
                console.log(`  Migrated password for user: ${user.name}`);
                migrated = true;
            }
        });
    }

    if (migrated) {
        writeData(data);
        console.log('Password migration completed - all passwords now hashed with bcrypt.');
    } else {
        console.log('All passwords already hashed. No migration needed.');
    }
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf'
};

// ============================================
// App Config Helpers
// ============================================

function readAppConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error reading config:', err.message);
    }
    return { ...DEFAULT_APP_CONFIG };
}

function writeAppConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getBackupRetentionDays() {
    const config = readAppConfig();
    return config.backupRetentionDays || BACKUP_RETENTION_DAYS;
}

// ============================================
// File Metadata Helpers
// ============================================

const FILE_META_FILE = path.join(__dirname, 'file-metadata.json');

function readFileMeta() {
    try {
        if (fs.existsSync(FILE_META_FILE)) {
            return JSON.parse(fs.readFileSync(FILE_META_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error reading file metadata:', err.message);
    }
    return [];
}

function writeFileMeta(meta) {
    fs.writeFileSync(FILE_META_FILE, JSON.stringify(meta, null, 2));
}

// Initialize uploads directory
function initUploadsDir() {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        console.log('Created uploads/ directory');
    }
}

// ============================================
// Multipart Form Data Parser
// ============================================

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)/);
        if (!boundaryMatch) {
            return reject(new Error('No boundary found'));
        }
        const boundary = boundaryMatch[1];
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const parts = {};
                const boundaryBuf = Buffer.from('--' + boundary);
                const endBoundaryBuf = Buffer.from('--' + boundary + '--');

                // Split by boundary
                let start = 0;
                const positions = [];
                while (true) {
                    const pos = buffer.indexOf(boundaryBuf, start);
                    if (pos === -1) break;
                    positions.push(pos);
                    start = pos + boundaryBuf.length;
                }

                for (let i = 0; i < positions.length - 1; i++) {
                    const partStart = positions[i] + boundaryBuf.length + 2; // skip boundary + \r\n
                    const partEnd = positions[i + 1] - 2; // skip \r\n before next boundary
                    const partBuf = buffer.slice(partStart, partEnd);

                    // Find header/body separator (\r\n\r\n)
                    const headerEnd = partBuf.indexOf('\r\n\r\n');
                    if (headerEnd === -1) continue;

                    const headerStr = partBuf.slice(0, headerEnd).toString('utf8');
                    const bodyBuf = partBuf.slice(headerEnd + 4);

                    // Parse Content-Disposition
                    const nameMatch = headerStr.match(/name="([^"]+)"/);
                    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
                    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

                    if (nameMatch) {
                        const name = nameMatch[1];
                        if (filenameMatch) {
                            parts[name] = {
                                filename: filenameMatch[1],
                                contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
                                data: bodyBuf
                            };
                        } else {
                            parts[name] = bodyBuf.toString('utf8');
                        }
                    }
                }

                resolve(parts);
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

// Read data
function readData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Write data (with automatic rolling backup)
function writeData(data) {
    // Create backup before overwriting
    try {
        if (fs.existsSync(DATA_FILE)) {
            if (!fs.existsSync(BACKUP_DIR)) {
                fs.mkdirSync(BACKUP_DIR, { recursive: true });
            }
            const now = new Date();
            const timestamp = now.getFullYear().toString()
                + String(now.getMonth() + 1).padStart(2, '0')
                + String(now.getDate()).padStart(2, '0')
                + '-'
                + String(now.getHours()).padStart(2, '0')
                + String(now.getMinutes()).padStart(2, '0')
                + String(now.getSeconds()).padStart(2, '0');
            const backupFile = path.join(BACKUP_DIR, `data-${timestamp}.json`);
            fs.copyFileSync(DATA_FILE, backupFile);

            // Cleanup: delete backups older than configured retention
            const retentionDays = getBackupRetentionDays();
            const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
            const backups = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('data-') && f.endsWith('.json'));
            backups.forEach(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stat = fs.statSync(filePath);
                if (stat.mtimeMs < cutoffTime) {
                    fs.unlinkSync(filePath);
                }
            });
        }
    } catch (err) {
        console.error('Backup error (non-fatal):', err.message);
    }

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

    // Login endpoint
    if (pathname === '/api/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const data = readData();
        const user = data.users.find(u => u.id === body.userId);
        if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'User not found' }));
            return;
        }
        if (!user.password) {
            // User has no password set (shouldn't happen, but handle it)
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Account not configured. Contact admin.' }));
            return;
        }
        // Compare password using bcrypt (supports both hashed and legacy plain-text)
        let passwordMatch = false;
        if (isBcryptHash(user.password)) {
            passwordMatch = bcrypt.compareSync(body.password, user.password);
        } else {
            // Legacy plain-text comparison (should not happen after migration)
            passwordMatch = (user.password === body.password);
            // Opportunistic migration: hash it now
            if (passwordMatch) {
                user.password = bcrypt.hashSync(body.password, BCRYPT_ROUNDS);
                writeData(data);
            }
        }
        if (!passwordMatch) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Incorrect password' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            user: { id: user.id, name: user.name, role: user.role, mustResetPassword: user.mustResetPassword || false }
        }));
        // Log login activity
        if (!data.activityLog) data.activityLog = [];
        data.activityLog.push({
            action: 'Login',
            userId: user.id,
            userName: user.name,
            details: `${user.name} logged in`,
            timestamp: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        writeData(data);
        return;
    }

    // Change password endpoint
    if (pathname === '/api/change-password' && req.method === 'POST') {
        const body = await parseBody(req);
        const data = readData();
        const user = data.users.find(u => u.id === body.userId);
        if (!user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'User not found' }));
            return;
        }
        // Verify old password if provided (not required for forced reset)
        if (body.oldPassword) {
            let oldMatch = false;
            if (isBcryptHash(user.password)) {
                oldMatch = bcrypt.compareSync(body.oldPassword, user.password);
            } else {
                oldMatch = (user.password === body.oldPassword);
            }
            if (!oldMatch) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Current password is incorrect' }));
                return;
            }
        }
        if (!body.newPassword || body.newPassword.length < 4) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'New password must be at least 4 characters' }));
            return;
        }
        if (body.newPassword === DEFAULT_PASSWORD) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Cannot use the default password. Please choose a different password.' }));
            return;
        }
        // Hash the new password with bcrypt
        user.password = bcrypt.hashSync(body.newPassword, BCRYPT_ROUNDS);
        user.mustResetPassword = false;
        // Log activity
        if (!data.activityLog) data.activityLog = [];
        data.activityLog.push({
            action: 'Password Changed',
            userId: user.id,
            userName: user.name,
            details: `${user.name} changed their password`,
            timestamp: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        writeData(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Password changed successfully' }));
        return;
    }

    // Reset password (admin only) endpoint - generates a random temporary password
    if (pathname === '/api/reset-password' && req.method === 'POST') {
        const body = await parseBody(req);
        const data = readData();
        // Check if requester is admin
        const requester = data.users.find(u => u.id === body.requesterId);
        if (!requester || requester.role !== 'Admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Only Admin can reset passwords' }));
            return;
        }
        const user = data.users.find(u => u.id === body.userId);
        if (!user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'User not found' }));
            return;
        }
        // Generate random temporary password (8 chars)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPassword = '';
        for (let i = 0; i < 8; i++) {
            tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Hash the temporary password with bcrypt before storing
        user.password = bcrypt.hashSync(tempPassword, BCRYPT_ROUNDS);
        user.mustResetPassword = true;
        // Log activity
        if (!data.activityLog) data.activityLog = [];
        data.activityLog.push({
            action: 'Password Reset',
            userId: requester.id,
            userName: requester.name,
            details: `${requester.name} reset password for ${user.name}`,
            timestamp: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        writeData(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Password reset for ${user.name}`, tempPassword }));
        return;
    }

    // Activity log endpoint - admin only
    if (pathname === '/api/activity-log' && req.method === 'GET') {
        const data = readData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ activityLog: data.activityLog || [] }));
        return;
    }

    // Log activity endpoint
    if (pathname === '/api/activity-log' && req.method === 'POST') {
        const body = await parseBody(req);
        const data = readData();
        if (!data.activityLog) data.activityLog = [];
        data.activityLog.push(body);
        writeData(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    if (pathname === '/api/data' && req.method === 'GET') {
        // Get all data (strip passwords from response)
        const data = readData();
        const safeData = {
            ...data,
            users: data.users.map(u => ({
                id: u.id,
                name: u.name,
                role: u.role,
                mustResetPassword: u.mustResetPassword || false
            }))
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(safeData));
        return;
    }

    if (pathname === '/api/data' && req.method === 'POST') {
        // Save all data
        const body = await parseBody(req);
        const existingData = readData();
        // Preserve existing passwords and hash any new plain-text ones
        if (body.users && Array.isArray(body.users)) {
            const existingUsers = existingData.users || [];
            body.users.forEach(user => {
                if (user.password && !isBcryptHash(user.password)) {
                    // New plain-text password — hash it
                    user.password = bcrypt.hashSync(user.password, BCRYPT_ROUNDS);
                } else if (!user.password) {
                    // No password sent from client — preserve existing
                    const existing = existingUsers.find(u => u.id === user.id);
                    if (existing) {
                        user.password = existing.password;
                        // Also preserve mustResetPassword if not explicitly sent
                        if (user.mustResetPassword === undefined) {
                            user.mustResetPassword = existing.mustResetPassword;
                        }
                    } else {
                        // Brand new user with no password — set default
                        user.password = bcrypt.hashSync(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
                        user.mustResetPassword = true;
                    }
                }
            });
        }
        // Preserve activity log if not sent by client
        if (!body.activityLog) {
            body.activityLog = existingData.activityLog || [];
        }
        writeData(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // ============================================
    // App Config API
    // ============================================

    if (pathname === '/api/config' && req.method === 'GET') {
        const config = readAppConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config }));
        return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
        const body = await parseBody(req);
        const config = readAppConfig();
        // Merge with existing
        if (body.maxFileSizeMB !== undefined) config.maxFileSizeMB = body.maxFileSizeMB;
        if (body.allowedFileTypes !== undefined) config.allowedFileTypes = body.allowedFileTypes;
        if (body.backupRetentionDays !== undefined) config.backupRetentionDays = body.backupRetentionDays;
        if (body.maxBackupFiles !== undefined) config.maxBackupFiles = body.maxBackupFiles;
        writeAppConfig(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // ============================================
    // File Upload API
    // ============================================

    if (pathname === '/api/files/upload' && req.method === 'POST') {
        try {
            const parts = await parseMultipart(req);
            const filePart = parts.file;
            const taskId = parseInt(parts.taskId);
            const uploaderId = parseInt(parts.uploaderId);
            const uploaderName = parts.uploaderName || 'Unknown';

            if (!filePart || !filePart.data) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No file provided' }));
                return;
            }

            // Validate file type using config
            const config = readAppConfig();
            const allowedTypes = config.allowedFileTypes || DEFAULT_APP_CONFIG.allowedFileTypes;
            if (!allowedTypes.includes(filePart.contentType)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'File type not allowed. Only images and PDFs are accepted.' }));
                return;
            }

            // Validate file size using config
            const maxSizeBytes = (config.maxFileSizeMB || 5) * 1024 * 1024;
            if (filePart.data.length > maxSizeBytes) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: `File size exceeds the limit of ${config.maxFileSizeMB || 5} MB.` }));
                return;
            }

            // Generate unique file ID and save
            const fileId = crypto.randomUUID();
            const ext = path.extname(filePart.filename) || '';
            const storedName = fileId + ext;
            const filePath = path.join(UPLOADS_DIR, storedName);

            fs.writeFileSync(filePath, filePart.data);

            // Save metadata
            const meta = readFileMeta();
            const fileMeta = {
                id: fileId,
                originalName: filePart.filename,
                storedName: storedName,
                mimeType: filePart.contentType,
                size: filePart.data.length,
                taskId: taskId,
                uploaderId: uploaderId,
                uploaderName: uploaderName,
                uploadedAt: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            };
            meta.push(fileMeta);
            writeFileMeta(meta);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, file: fileMeta }));
            return;
        } catch (err) {
            console.error('File upload error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Upload failed: ' + err.message }));
            return;
        }
    }

    // ============================================
    // File List API
    // ============================================

    if (pathname === '/api/files/list' && req.method === 'GET') {
        const meta = readFileMeta();
        const taskIdParam = url.searchParams.get('taskId');
        let files = meta;
        if (taskIdParam) {
            const tid = parseInt(taskIdParam);
            files = meta.filter(f => f.taskId === tid);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, files }));
        return;
    }

    // ============================================
    // File Metadata API
    // ============================================

    const fileMetaMatch = pathname.match(/^\/api\/files\/meta\/(.+)$/);
    if (fileMetaMatch && req.method === 'GET') {
        const fileId = fileMetaMatch[1];
        const meta = readFileMeta();
        const file = meta.find(f => f.id === fileId);
        if (!file) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'File not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, file }));
        return;
    }

    // ============================================
    // File Download API
    // ============================================

    const fileDownloadMatch = pathname.match(/^\/api\/files\/download\/(.+)$/);
    if (fileDownloadMatch && req.method === 'GET') {
        const fileId = fileDownloadMatch[1];
        const meta = readFileMeta();
        const file = meta.find(f => f.id === fileId);
        if (!file) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        const filePath = path.join(UPLOADS_DIR, file.storedName);
        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('File not found on disk');
            return;
        }
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
            'Content-Length': content.length
        });
        res.end(content);
        return;
    }

    // ============================================
    // File Pin/Unpin API
    // ============================================

    const filePinMatch = pathname.match(/^\/api\/files\/pin\/(.+)$/);
    if (filePinMatch && req.method === 'POST') {
        const fileId = filePinMatch[1];
        const meta = readFileMeta();
        const file = meta.find(f => f.id === fileId);
        if (!file) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'File not found' }));
            return;
        }
        file.pinned = !file.pinned;
        writeFileMeta(meta);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pinned: file.pinned, fileName: file.originalName }));
        return;
    }

    // ============================================
    // File Delete API
    // ============================================

    const fileDeleteMatch = pathname.match(/^\/api\/files\/delete\/(.+)$/);
    if (fileDeleteMatch && req.method === 'DELETE') {
        const fileId = fileDeleteMatch[1];
        const meta = readFileMeta();
        const fileIndex = meta.findIndex(f => f.id === fileId);
        if (fileIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'File not found' }));
            return;
        }
        const file = meta[fileIndex];
        const fileName = file.originalName;

        // Delete file from disk
        const filePath = path.join(UPLOADS_DIR, file.storedName);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            console.error('Error deleting file from disk:', err.message);
        }

        // Remove metadata
        meta.splice(fileIndex, 1);
        writeFileMeta(meta);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fileName }));
        return;
    }

    // ============================================
    // Download All Files as ZIP
    // ============================================

    if (pathname === '/api/files/download-all-zip' && req.method === 'GET') {
        const meta = readFileMeta();
        if (meta.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'No files to download' }));
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="all-files.zip"'
        });

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        meta.forEach(file => {
            const filePath = path.join(UPLOADS_DIR, file.storedName);
            if (fs.existsSync(filePath)) {
                // Organize by task: TASK-{id}/{filename}
                archive.file(filePath, { name: `TASK-${file.taskId}/${file.originalName}` });
            }
        });

        archive.finalize();
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
initUploadsDir();
console.log('Checking password encryption...');
migratePasswords();
server.listen(PORT, () => {
    const config = readAppConfig();
    console.log(`\n========================================`);
    console.log(`  Kekarav S1-32 Manager Running!`);
    console.log(`  Open: http://localhost:${PORT}${BASE_PATH}`);
    console.log(`  Data stored in: data.json`);
    console.log(`  Uploads in: uploads/`);
    console.log(`  Backups in: backups/ (${config.backupRetentionDays}-day retention)`);
    console.log(`  Max file size: ${config.maxFileSizeMB} MB`);
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

