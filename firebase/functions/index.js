const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const Busboy = require("busboy");
const archiver = require("archiver");
const crypto = require("crypto");
const path = require("path");

// ============================================
// Firebase Initialization
// ============================================

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// ============================================
// Constants
// ============================================

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = "welcome123";

const DEFAULT_APP_CONFIG = {
  maxFileSizeMB: 5,
  allowedFileTypes: ["image/jpeg", "image/png", "application/pdf"],
  backupRetentionDays: 3,
  maxBackupFiles: 50,
};

// ============================================
// Express App
// ============================================

const app = express();
app.use(cors({origin: true}));
app.use(express.json({limit: "50mb"}));

// ============================================
// Helpers
// ============================================

function isBcryptHash(str) {
  return str && (str.startsWith("$2a$") || str.startsWith("$2b$") || str.startsWith("$2y$"));
}

function formatTimestamp() {
  return new Date().toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function backupTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") + "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

// ============================================
// Firestore Data Helpers
// ============================================

// Main data document: db/app/data
const DATA_DOC = db.collection("app").doc("data");
const CONFIG_DOC = db.collection("app").doc("config");
const FILEMETA_DOC = db.collection("app").doc("fileMeta");

async function readData() {
  const doc = await DATA_DOC.get();
  if (!doc.exists) {
    // Initialize with default data
    const hashedAdmin = bcrypt.hashSync("admin123", BCRYPT_ROUNDS);
    const hashedDefault = bcrypt.hashSync(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
    const defaultData = {
      tasks: [],
      taskIdCounter: 1,
      users: [
        {id: 0, name: "Admin", role: "Admin", password: hashedAdmin, mustResetPassword: false},
        {id: 1, name: "John Developer", role: "Developer", password: hashedDefault, mustResetPassword: true},
        {id: 2, name: "Jane QA", role: "QA", password: hashedDefault, mustResetPassword: true},
        {id: 3, name: "Bob Manager", role: "Manager", password: hashedDefault, mustResetPassword: true},
        {id: 4, name: "Alice Lead", role: "Lead", password: hashedDefault, mustResetPassword: true},
      ],
      activityLog: [],
    };
    await DATA_DOC.set(defaultData);
    console.log("Created default data in Firestore");
    return defaultData;
  }
  return doc.data();
}

async function writeData(data) {
  // Create backup in Cloud Storage before overwriting
  try {
    const existing = await DATA_DOC.get();
    if (existing.exists) {
      const ts = backupTimestamp();
      const backupPath = `backups/data-${ts}.json`;
      const file = bucket.file(backupPath);
      await file.save(JSON.stringify(existing.data(), null, 2), {
        contentType: "application/json",
        metadata: {contentType: "application/json"},
      });

      // Cleanup old backups
      await cleanupBackups();
    }
  } catch (err) {
    console.error("Backup error (non-fatal):", err.message);
  }

  await DATA_DOC.set(data);
}

async function cleanupBackups() {
  try {
    const config = await readAppConfig();
    const retentionDays = config.backupRetentionDays || 3;
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const [files] = await bucket.getFiles({prefix: "backups/data-"});
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const createdTime = new Date(metadata.timeCreated).getTime();
      if (createdTime < cutoffTime) {
        await file.delete();
        console.log(`Deleted old backup: ${file.name}`);
      }
    }
  } catch (err) {
    console.error("Backup cleanup error:", err.message);
  }
}

async function readAppConfig() {
  try {
    const doc = await CONFIG_DOC.get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (err) {
    console.error("Error reading config:", err.message);
  }
  return {...DEFAULT_APP_CONFIG};
}

async function writeAppConfig(config) {
  await CONFIG_DOC.set(config);
}

async function readFileMeta() {
  try {
    const doc = await FILEMETA_DOC.get();
    if (doc.exists) {
      return doc.data().files || [];
    }
  } catch (err) {
    console.error("Error reading file metadata:", err.message);
  }
  return [];
}

async function writeFileMeta(meta) {
  await FILEMETA_DOC.set({files: meta});
}

// ============================================
// Multipart Parser using Busboy
// ============================================

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({headers: req.headers});
    const fields = {};
    const files = {};

    busboy.on("file", (fieldname, file, info) => {
      const {filename, mimeType} = info;
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        files[fieldname] = {
          filename: filename,
          contentType: mimeType,
          data: Buffer.concat(chunks),
        };
      });
    });

    busboy.on("field", (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on("finish", () => {
      resolve({...fields, ...files});
    });

    busboy.on("error", reject);

    // Cloud Functions may already have parsed the raw body
    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}

// ============================================
// API Routes
// ============================================

// ---------- Login ----------
app.post("/kekarav-s132/api/login", async (req, res) => {
  try {
    const body = req.body;
    const data = await readData();
    const user = data.users.find((u) => u.id === body.userId);
    if (!user) {
      return res.status(401).json({success: false, message: "User not found"});
    }
    if (!user.password) {
      return res.status(401).json({success: false, message: "Account not configured. Contact admin."});
    }

    let passwordMatch = false;
    if (isBcryptHash(user.password)) {
      passwordMatch = bcrypt.compareSync(body.password, user.password);
    } else {
      passwordMatch = (user.password === body.password);
      if (passwordMatch) {
        user.password = bcrypt.hashSync(body.password, BCRYPT_ROUNDS);
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({success: false, message: "Incorrect password"});
    }

    // Log login activity
    if (!data.activityLog) data.activityLog = [];
    data.activityLog.push({
      action: "Login",
      userId: user.id,
      userName: user.name,
      details: `${user.name} logged in`,
      timestamp: formatTimestamp(),
    });
    await writeData(data);

    return res.json({
      success: true,
      user: {id: user.id, name: user.name, role: user.role, mustResetPassword: user.mustResetPassword || false},
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({success: false, message: "Server error"});
  }
});

// ---------- Change Password ----------
app.post("/kekarav-s132/api/change-password", async (req, res) => {
  try {
    const body = req.body;
    const data = await readData();
    const user = data.users.find((u) => u.id === body.userId);
    if (!user) {
      return res.status(404).json({success: false, message: "User not found"});
    }

    if (body.oldPassword) {
      let oldMatch = false;
      if (isBcryptHash(user.password)) {
        oldMatch = bcrypt.compareSync(body.oldPassword, user.password);
      } else {
        oldMatch = (user.password === body.oldPassword);
      }
      if (!oldMatch) {
        return res.status(401).json({success: false, message: "Current password is incorrect"});
      }
    }

    if (!body.newPassword || body.newPassword.length < 4) {
      return res.status(400).json({success: false, message: "New password must be at least 4 characters"});
    }
    if (body.newPassword === DEFAULT_PASSWORD) {
      return res.status(400).json({success: false, message: "Cannot use the default password. Please choose a different password."});
    }

    user.password = bcrypt.hashSync(body.newPassword, BCRYPT_ROUNDS);
    user.mustResetPassword = false;

    if (!data.activityLog) data.activityLog = [];
    data.activityLog.push({
      action: "Password Changed",
      userId: user.id,
      userName: user.name,
      details: `${user.name} changed their password`,
      timestamp: formatTimestamp(),
    });
    await writeData(data);

    return res.json({success: true, message: "Password changed successfully"});
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({success: false, message: "Server error"});
  }
});

// ---------- Reset Password (Admin) ----------
app.post("/kekarav-s132/api/reset-password", async (req, res) => {
  try {
    const body = req.body;
    const data = await readData();
    const requester = data.users.find((u) => u.id === body.requesterId);
    if (!requester || requester.role !== "Admin") {
      return res.status(403).json({success: false, message: "Only Admin can reset passwords"});
    }
    const user = data.users.find((u) => u.id === body.userId);
    if (!user) {
      return res.status(404).json({success: false, message: "User not found"});
    }

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    user.password = bcrypt.hashSync(tempPassword, BCRYPT_ROUNDS);
    user.mustResetPassword = true;

    if (!data.activityLog) data.activityLog = [];
    data.activityLog.push({
      action: "Password Reset",
      userId: requester.id,
      userName: requester.name,
      details: `${requester.name} reset password for ${user.name}`,
      timestamp: formatTimestamp(),
    });
    await writeData(data);

    return res.json({success: true, message: `Password reset for ${user.name}`, tempPassword});
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({success: false, message: "Server error"});
  }
});

// ---------- Activity Log ----------
app.get("/kekarav-s132/api/activity-log", async (req, res) => {
  try {
    const data = await readData();
    return res.json({activityLog: data.activityLog || []});
  } catch (err) {
    console.error("Activity log read error:", err);
    return res.status(500).json({activityLog: []});
  }
});

app.post("/kekarav-s132/api/activity-log", async (req, res) => {
  try {
    const body = req.body;
    const data = await readData();
    if (!data.activityLog) data.activityLog = [];
    data.activityLog.push(body);
    await writeData(data);
    return res.json({success: true});
  } catch (err) {
    console.error("Activity log write error:", err);
    return res.status(500).json({success: false});
  }
});

// ---------- Data API ----------
app.get("/kekarav-s132/api/data", async (req, res) => {
  try {
    const data = await readData();
    const safeData = {
      ...data,
      users: data.users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        mustResetPassword: u.mustResetPassword || false,
      })),
    };
    return res.json(safeData);
  } catch (err) {
    console.error("Data read error:", err);
    return res.status(500).json({tasks: [], users: [], taskIdCounter: 1});
  }
});

app.post("/kekarav-s132/api/data", async (req, res) => {
  try {
    const body = req.body;
    const existingData = await readData();

    if (body.users && Array.isArray(body.users)) {
      const existingUsers = existingData.users || [];
      body.users.forEach((user) => {
        if (user.password && !isBcryptHash(user.password)) {
          user.password = bcrypt.hashSync(user.password, BCRYPT_ROUNDS);
        } else if (!user.password) {
          const existing = existingUsers.find((u) => u.id === user.id);
          if (existing) {
            user.password = existing.password;
            if (user.mustResetPassword === undefined) {
              user.mustResetPassword = existing.mustResetPassword;
            }
          } else {
            user.password = bcrypt.hashSync(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
            user.mustResetPassword = true;
          }
        }
      });
    }

    if (!body.activityLog) {
      body.activityLog = existingData.activityLog || [];
    }

    await writeData(body);
    return res.json({success: true});
  } catch (err) {
    console.error("Data write error:", err);
    return res.status(500).json({success: false});
  }
});

// ---------- App Config API ----------
app.get("/kekarav-s132/api/config", async (req, res) => {
  try {
    const config = await readAppConfig();
    return res.json({success: true, config});
  } catch (err) {
    console.error("Config read error:", err);
    return res.status(500).json({success: false, config: DEFAULT_APP_CONFIG});
  }
});

app.post("/kekarav-s132/api/config", async (req, res) => {
  try {
    const body = req.body;
    const config = await readAppConfig();
    if (body.maxFileSizeMB !== undefined) config.maxFileSizeMB = body.maxFileSizeMB;
    if (body.allowedFileTypes !== undefined) config.allowedFileTypes = body.allowedFileTypes;
    if (body.backupRetentionDays !== undefined) config.backupRetentionDays = body.backupRetentionDays;
    if (body.maxBackupFiles !== undefined) config.maxBackupFiles = body.maxBackupFiles;
    await writeAppConfig(config);
    return res.json({success: true});
  } catch (err) {
    console.error("Config write error:", err);
    return res.status(500).json({success: false});
  }
});

// ---------- File Upload ----------
app.post("/kekarav-s132/api/files/upload", async (req, res) => {
  try {
    const parts = await parseMultipart(req);
    const filePart = parts.file;
    const taskId = parseInt(parts.taskId);
    const uploaderId = parseInt(parts.uploaderId);
    const uploaderName = parts.uploaderName || "Unknown";

    if (!filePart || !filePart.data) {
      return res.status(400).json({success: false, message: "No file provided"});
    }

    // Validate file type
    const config = await readAppConfig();
    const allowedTypes = config.allowedFileTypes || DEFAULT_APP_CONFIG.allowedFileTypes;
    if (!allowedTypes.includes(filePart.contentType)) {
      return res.status(400).json({success: false, message: "File type not allowed. Only images and PDFs are accepted."});
    }

    // Validate file size
    const maxSizeBytes = (config.maxFileSizeMB || 5) * 1024 * 1024;
    if (filePart.data.length > maxSizeBytes) {
      return res.status(400).json({success: false, message: `File size exceeds the limit of ${config.maxFileSizeMB || 5} MB.`});
    }

    // Generate unique file ID and upload to Cloud Storage
    const fileId = crypto.randomUUID();
    const ext = path.extname(filePart.filename) || "";
    const storedName = fileId + ext;
    const storagePath = `uploads/${storedName}`;

    const storageFile = bucket.file(storagePath);
    await storageFile.save(filePart.data, {
      contentType: filePart.contentType,
      metadata: {
        contentType: filePart.contentType,
        metadata: {
          originalName: filePart.filename,
          taskId: String(taskId),
          uploaderId: String(uploaderId),
        },
      },
    });

    // Save metadata to Firestore
    const meta = await readFileMeta();
    const fileMeta = {
      id: fileId,
      originalName: filePart.filename,
      storedName: storedName,
      storagePath: storagePath,
      mimeType: filePart.contentType,
      size: filePart.data.length,
      taskId: taskId,
      uploaderId: uploaderId,
      uploaderName: uploaderName,
      uploadedAt: formatTimestamp(),
    };
    meta.push(fileMeta);
    await writeFileMeta(meta);

    return res.json({success: true, file: fileMeta});
  } catch (err) {
    console.error("File upload error:", err);
    return res.status(500).json({success: false, message: "Upload failed: " + err.message});
  }
});

// ---------- File List ----------
app.get("/kekarav-s132/api/files/list", async (req, res) => {
  try {
    const meta = await readFileMeta();
    const taskIdParam = req.query.taskId;
    let files = meta;
    if (taskIdParam) {
      const tid = parseInt(taskIdParam);
      files = meta.filter((f) => f.taskId === tid);
    }
    return res.json({success: true, files});
  } catch (err) {
    console.error("File list error:", err);
    return res.status(500).json({success: false, files: []});
  }
});

// ---------- File Metadata ----------
app.get("/kekarav-s132/api/files/meta/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const meta = await readFileMeta();
    const file = meta.find((f) => f.id === fileId);
    if (!file) {
      return res.status(404).json({success: false, message: "File not found"});
    }
    return res.json({success: true, file});
  } catch (err) {
    console.error("File meta error:", err);
    return res.status(500).json({success: false, message: "Server error"});
  }
});

// ---------- File Download ----------
app.get("/kekarav-s132/api/files/download/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const meta = await readFileMeta();
    const file = meta.find((f) => f.id === fileId);
    if (!file) {
      return res.status(404).send("File not found");
    }

    const storagePath = file.storagePath || `uploads/${file.storedName}`;
    const storageFile = bucket.file(storagePath);
    const [exists] = await storageFile.exists();
    if (!exists) {
      return res.status(404).send("File not found in storage");
    }

    const [content] = await storageFile.download();
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader("Content-Length", content.length);
    return res.send(content);
  } catch (err) {
    console.error("File download error:", err);
    return res.status(500).send("Download failed");
  }
});

// ---------- File Pin/Unpin ----------
app.post("/kekarav-s132/api/files/pin/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const meta = await readFileMeta();
    const file = meta.find((f) => f.id === fileId);
    if (!file) {
      return res.status(404).json({success: false, message: "File not found"});
    }
    file.pinned = !file.pinned;
    await writeFileMeta(meta);
    return res.json({success: true, pinned: file.pinned, fileName: file.originalName});
  } catch (err) {
    console.error("File pin error:", err);
    return res.status(500).json({success: false, message: "Server error"});
  }
});

// ---------- File Delete ----------
app.delete("/kekarav-s132/api/files/delete/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const meta = await readFileMeta();
    const fileIndex = meta.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) {
      return res.status(404).json({success: false, message: "File not found"});
    }
    const file = meta[fileIndex];
    const fileName = file.originalName;

    // Delete from Cloud Storage
    try {
      const storagePath = file.storagePath || `uploads/${file.storedName}`;
      const storageFile = bucket.file(storagePath);
      const [exists] = await storageFile.exists();
      if (exists) {
        await storageFile.delete();
      }
    } catch (err) {
      console.error("Error deleting file from storage:", err.message);
    }

    meta.splice(fileIndex, 1);
    await writeFileMeta(meta);

    return res.json({success: true, fileName});
  } catch (err) {
    console.error("File delete error:", err);
    return res.status(500).json({success: false, message: "Server error"});
  }
});

// ---------- Download All Files as ZIP ----------
app.get("/kekarav-s132/api/files/download-all-zip", async (req, res) => {
  try {
    const meta = await readFileMeta();
    if (meta.length === 0) {
      return res.status(404).json({success: false, message: "No files to download"});
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=\"all-files.zip\"");

    const archive = archiver("zip", {zlib: {level: 9}});
    archive.pipe(res);

    for (const file of meta) {
      try {
        const storagePath = file.storagePath || `uploads/${file.storedName}`;
        const storageFile = bucket.file(storagePath);
        const [exists] = await storageFile.exists();
        if (exists) {
          const [content] = await storageFile.download();
          archive.append(content, {name: `TASK-${file.taskId}/${file.originalName}`});
        }
      } catch (err) {
        console.error(`Error adding file to zip: ${file.originalName}`, err.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error("ZIP download error:", err);
    return res.status(500).json({success: false, message: "ZIP creation failed"});
  }
});

// ============================================
// Export the Express app as a Firebase Function
// ============================================

exports.api = functions
    .runWith({
      timeoutSeconds: 120,
      memory: "512MB",
    })
    .https.onRequest(app);

