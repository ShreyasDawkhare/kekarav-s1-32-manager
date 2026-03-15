# 🔥 Firebase Deployment Guide — Kekarav S1-32 Manager

This guide walks you through hosting the Kekarav S1-32 Manager on Firebase, using:

- **Firebase Hosting** — serves the frontend (HTML, CSS, JS)
- **Firebase Cloud Functions** — runs the Node.js API server
- **Cloud Firestore** — stores task data, users, config (replaces `data.json`)
- **Cloud Storage** — stores uploaded files and backups (replaces `uploads/` and `backups/` folders)

---

## 📑 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a Firebase Project](#2-create-a-firebase-project)
3. [Enable Required Services](#3-enable-required-services)
4. [Configure the Project](#4-configure-the-project)
5. [Deploy to Firebase](#5-deploy-to-firebase)
6. [Verify the Deployment](#6-verify-the-deployment)
7. [How It Works — Architecture](#7-how-it-works--architecture)
8. [Firebase Directory Structure](#8-firebase-directory-structure)
9. [Updating the App](#9-updating-the-app)
10. [Cost & Free Tier](#10-cost--free-tier)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+ installed
- A Google account
- Firebase CLI installed globally:

```bash
npm install -g firebase-tools
```

---

## 2. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (e.g., `kekarav-s132-manager`)
4. (Optional) Disable Google Analytics if you don't need it
5. Click **"Create project"**
6. Wait for it to be created, then click **"Continue"**

> 📝 Note your **Project ID** (shown under the project name, e.g., `kekarav-s132-manager`). You'll need it in Step 4.

---

## 3. Enable Required Services

From the Firebase Console, enable these services for your project:

### a) Cloud Firestore (Database)
1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (our security rules block direct access — all data goes through Cloud Functions)
4. Select a location close to your users (e.g., `us-central1`, `asia-south1`)
5. Click **"Enable"**

### b) Cloud Storage (File Storage)
1. Go to **Build → Storage**
2. Click **"Get started"**
3. Choose **"Start in production mode"**
4. Select the same location as Firestore
5. Click **"Done"**

### c) Upgrade to Blaze Plan (Required for Cloud Functions)
1. Go to **⚙️ Settings → Usage and billing → Details & settings**
2. Click **"Modify plan"** and select **"Blaze (Pay as you go)"**
3. Link a billing account (you won't be charged if you stay within free tier limits — see [Cost section](#10-cost--free-tier))

> ⚠️ **Cloud Functions require the Blaze plan**, but Firebase has a generous free tier. A small team will typically stay within free limits.

---

## 4. Configure the Project

### a) Login to Firebase CLI

Open a terminal and run:

```bash
firebase login
```

This opens your browser to authenticate with your Google account.

### b) Set Your Project ID

Edit the file `firebase/.firebaserc` and replace the placeholder with your actual Firebase Project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

For example, if your project ID is `kekarav-s132-manager`:

```json
{
  "projects": {
    "default": "kekarav-s132-manager"
  }
}
```

> 💡 Alternatively, run this from inside the `firebase/` directory:
> ```bash
> firebase use your-actual-project-id
> ```

---

## 5. Deploy to Firebase

Open a terminal in the `firebase/` directory:

```bash
cd firebase
```

### a) Install Cloud Functions dependencies (if not done already)

```bash
cd functions
npm install
cd ..
```

### b) Deploy everything at once

```bash
firebase deploy
```

This deploys:
- ✅ **Hosting** — your frontend files
- ✅ **Functions** — your API server
- ✅ **Firestore rules** — security rules for the database
- ✅ **Storage rules** — security rules for file storage

You'll see output like:

```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project-id/overview
Hosting URL: https://your-project-id.web.app
```

### c) Or deploy individually

```bash
# Deploy only hosting (frontend)
firebase deploy --only hosting

# Deploy only functions (API)
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Storage rules
firebase deploy --only storage
```

---

## 6. Verify the Deployment

1. Open the **Hosting URL** shown after deployment:
   ```
   https://your-project-id.web.app
   ```
   You should be redirected to `https://your-project-id.web.app/kekarav-s132/`

2. You should see the **login screen**

3. Login with the default credentials:
   - **Admin** → password: `admin123`
   - **Other users** → password: `welcome123`

4. On first visit, the app automatically creates default data in Firestore

5. Test uploading a file — it should be stored in Cloud Storage

> 💡 You can also access the app at: `https://your-project-id.firebaseapp.com`

---

## 7. How It Works — Architecture

```
┌─────────────────────────────────────────────────┐
│                  User's Browser                  │
│                                                  │
│   index.html, styles.css, js/*.js                │
│   (served by Firebase Hosting)                   │
└──────────────────────┬──────────────────────────┘
                       │ API calls to /kekarav-s132/api/*
                       ▼
┌─────────────────────────────────────────────────┐
│           Firebase Cloud Functions               │
│                                                  │
│   Express.js app (functions/index.js)            │
│   - Login, auth, password management             │
│   - Task CRUD, state transitions                 │
│   - File upload/download/delete                  │
│   - Activity logging                             │
│   - App configuration                            │
│   - ZIP download of all files                    │
└────────┬───────────────────────┬────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐   ┌─────────────────────────┐
│ Cloud Firestore  │   │  Cloud Storage (Bucket)  │
│                  │   │                           │
│ app/data         │   │  uploads/                 │
│  - tasks[]       │   │    {fileId}.jpg           │
│  - users[]       │   │    {fileId}.pdf           │
│  - activityLog[] │   │                           │
│  - taskIdCounter │   │  backups/                 │
│                  │   │    data-20260315-1450.json │
│ app/config       │   │    data-20260315-1455.json │
│  - maxFileSizeMB │   │                           │
│  - allowedTypes  │   │                           │
│                  │   │                           │
│ app/fileMeta     │   │                           │
│  - files[]       │   │                           │
└─────────────────┘   └─────────────────────────┘
```

### What changed from the local version:

| Feature          | Local Version              | Firebase Version                  |
|------------------|----------------------------|-----------------------------------|
| Data storage     | `data.json` file           | Cloud Firestore document          |
| App config       | `appconfig.json` file      | Cloud Firestore document          |
| File metadata    | `file-metadata.json` file  | Cloud Firestore document          |
| File uploads     | `uploads/` folder          | Cloud Storage `uploads/` prefix   |
| Data backups     | `backups/` folder          | Cloud Storage `backups/` prefix   |
| Server           | `node server.js` (port 132)| Cloud Functions (auto-scaling)    |
| Frontend         | Served by Node.js          | Firebase Hosting (CDN)            |

---

## 8. Firebase Directory Structure

```
firebase/
├── .firebaserc              # Project ID configuration
├── .gitignore               # Ignore node_modules, .firebase, logs
├── firebase.json            # Firebase services configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore index definitions
├── storage.rules            # Cloud Storage security rules
│
├── functions/               # Cloud Functions (API server)
│   ├── index.js             # Express app with all API routes
│   ├── package.json         # Dependencies (firebase-admin, bcryptjs, etc.)
│   └── package-lock.json
│
└── public/                  # Firebase Hosting (static files)
    ├── index.html           # Root redirect → /kekarav-s132/
    └── kekarav-s132/        # App static files
        ├── index.html       # Main Kanban board page
        ├── activity-log.html
        ├── file-manager.html
        ├── styles.css
        └── js/
            ├── config.js
            ├── utils.js
            ├── state.js
            ├── auth.js
            ├── app.js
            ├── board.js
            ├── tasks.js
            ├── comments.js
            ├── dragdrop.js
            ├── files.js
            ├── users.js
            ├── appconfig.js
            └── exportimport.js
```

---

## 9. Updating the App

When you make changes to the app:

### Frontend changes (HTML/CSS/JS)

1. Make edits in the original project files (`index.html`, `styles.css`, `js/*.js`)
2. Copy the changed files to `firebase/public/kekarav-s132/`
3. Deploy:
   ```bash
   cd firebase
   firebase deploy --only hosting
   ```

### Backend changes (API logic)

1. Edit `firebase/functions/index.js`
2. Deploy:
   ```bash
   cd firebase
   firebase deploy --only functions
   ```

### Deploy everything

```bash
cd firebase
firebase deploy
```

---

## 10. Cost & Free Tier

Firebase Blaze plan includes generous free quotas:

| Service             | Free Tier                            | Your Usage (Small Team)      |
|---------------------|--------------------------------------|------------------------------|
| Cloud Functions     | 2M invocations/month, 400K GB-sec    | Well within limits           |
| Cloud Firestore     | 50K reads, 20K writes, 20K deletes/day | Well within limits        |
| Cloud Storage       | 5 GB stored, 1 GB/day download       | Depends on file uploads      |
| Firebase Hosting    | 10 GB stored, 360 MB/day transfer    | Well within limits           |

> 💡 For a team of 5-10 users, you'll likely stay **completely within the free tier**.

To monitor usage:
- Go to [Firebase Console](https://console.firebase.google.com/) → **Usage and billing**
- Set up **budget alerts** to get notified before incurring charges

---

## 11. Troubleshooting

### "Error: Cloud Functions require the Blaze plan"

You need to upgrade your Firebase project from Spark (free) to Blaze (pay-as-you-go). See [Step 3c](#c-upgrade-to-blaze-plan-required-for-cloud-functions).

### "Functions deploy failed — could not find package.json"

Make sure you're running `firebase deploy` from the `firebase/` directory (not the project root).

### "CORS error" or "API not found"

Make sure the rewrite in `firebase.json` is correct:
```json
{
  "source": "/kekarav-s132/api/**",
  "function": "api"
}
```
The function is exported as `api` in `functions/index.js`.

### Data not showing up after first deploy

On first visit, the Cloud Function automatically creates default data in Firestore. Refresh the page if it appears empty.

### File upload fails

- Check Cloud Storage is enabled in the Firebase Console
- Check the Cloud Function logs: **Firebase Console → Functions → Logs**
- Ensure the file size doesn't exceed the configured limit

### Checking logs

```bash
cd firebase
firebase functions:log
```

Or view logs in the Firebase Console → **Functions → Logs**

### Running locally for development

```bash
cd firebase
firebase emulators:start
```

This starts local emulators for Hosting, Functions, Firestore, and Storage. Open: `http://localhost:5000/kekarav-s132/`

### Reverting to local mode

Your original `server.js` and local files still work! Just run `start.bat` or `npm start` from the project root as before. The Firebase deployment is independent.

---

## Quick Reference — Commands Cheat Sheet

```bash
# Login to Firebase
firebase login

# Set project
cd firebase
firebase use your-project-id

# Install dependencies
cd functions && npm install && cd ..

# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# View function logs
firebase functions:log

# Run locally with emulators
firebase emulators:start

# Open Firebase Console
firebase open
```

---

*Your local version (`server.js` + `start.bat`) continues to work for development. The `firebase/` directory is the cloud deployment — both can coexist.*

