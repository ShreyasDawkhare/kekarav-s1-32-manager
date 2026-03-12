# 📋 Kekarav S1-32 Manager

A **Kanban-style task management board** built with Node.js. Designed for small teams to track tasks through a customizable workflow — with user authentication, file attachments, comments, activity logging, and automatic backups.

> **No database required** — all data is stored in local JSON files.

---

## 📑 Table of Contents

- [Quick Start](#-quick-start)
- [Default Login Credentials](#-default-login-credentials)
- [Features Overview](#-features-overview)
- [Task Board & Workflow](#-task-board--workflow)
- [Task Management](#-task-management)
- [Drag and Drop](#-drag-and-drop)
- [Comments](#-comments)
- [File Attachments](#-file-attachments)
- [User Management](#-user-management)
- [Authentication & Passwords](#-authentication--passwords)
- [Activity Log](#-activity-log)
- [App Configuration (Admin)](#%EF%B8%8F-app-configuration-admin)
- [Export & Import Data](#-export--import-data)
- [Automatic Backups](#-automatic-backups)
- [Role-Based Access](#-role-based-access)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher) installed on your machine.

### Starting the Server

**Option A — Double-click (Windows):**

1. Double-click **`start.bat`**
2. Wait for the message: `Kekarav S1-32 Manager Running!`
3. Open your browser and go to: **http://localhost:132/kekarav-s132**

**Option B — Command line:**

```bash
npm install
npm start
```

### Stopping the Server

- Press `Ctrl+C` in the terminal, **or**
- Double-click **`stop.bat`**

### Restarting the Server

- Double-click **`restart.bat`** (stops then starts automatically)

---

## 🔑 Default Login Credentials

On first launch, the following users are created automatically:

| User             | Role      | Password      |
|------------------|-----------|---------------|
| **Admin**        | Admin     | `admin123`    |
| John Developer   | Developer | `welcome123`  |
| Jane QA          | QA        | `welcome123`  |
| Bob Manager      | Manager   | `welcome123`  |
| Alice Lead       | Lead      | `welcome123`  |

> ⚠️ All non-admin users will be **prompted to change their password** on first login.

---

## ✨ Features Overview

| Feature                  | Description                                                |
|--------------------------|------------------------------------------------------------|
| Kanban Board             | 7-column board with drag-and-drop task movement            |
| Task Management          | Create, edit, assign, set deadlines, and delete tasks      |
| State Workflow           | Defined transitions between task states                    |
| Drag & Drop              | Move tasks between columns (valid transitions only)        |
| Comments                 | Add comments to any task; admins can delete comments       |
| File Attachments         | Upload JPEG, PNG, PDF files to tasks; pin, preview, delete |
| User Management          | Add, remove users; admin password reset                    |
| Secure Authentication    | bcrypt-hashed passwords; forced password reset on first login |
| Activity Log             | Full audit trail of all actions                            |
| Export / Import          | Download or restore all data as JSON                       |
| Automatic Backups        | Rolling JSON backups with configurable retention           |
| App Configuration        | Admin-configurable file size limits, backup retention, etc.|
| Role-Based Access        | Admin-only actions clearly separated                       |
| Overdue Highlighting     | Visual indicators for overdue or upcoming deadlines        |
| Session Persistence      | Stay logged in until you log out or close the browser tab  |

---

## 📊 Task Board & Workflow

The board has **7 columns**, each representing a task state:

```
┌──────────┐  ┌─────────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌─────────────┐
│   New    │→ │ In Progress │→ │  Ready  │→ │ Approved │→ │   Done   │  │ Recycle Bin │
│          │  │             │  │         │  ├──────────┤  │          │  │             │
│          │  │             │  │         │  │ Declined │→ │          │  │             │
└──────────┘  └─────────────┘  └─────────┘  └──────────┘  └──────────┘  └─────────────┘
```

### Allowed State Transitions

| From State    | Can Move To                              |
|---------------|------------------------------------------|
| **New**       | In Progress, Recycle Bin                 |
| **In Progress** | Ready, New, Recycle Bin               |
| **Ready**     | Approved, Declined, In Progress, Recycle Bin |
| **Approved**  | In Progress, Done, Recycle Bin           |
| **Declined**  | Done, In Progress, Recycle Bin           |
| **Done**      | Recycle Bin                              |
| **Recycle Bin** | *(no transitions — tasks are archived)* |

> 💡 You can only move tasks to **allowed** next states. Invalid moves are blocked on both the buttons and drag-and-drop.

---

## 📝 Task Management

### Creating a Task

1. Click the **`+ Create Task`** button in the top navigation bar.
2. Fill in the details:
   - **Title** *(required)* — a short name for the task.
   - **Description** *(optional)* — more detail about the task.
   - **Deadline** *(optional)* — a target due date.
   - **Assignee** — the team member responsible for the task.
3. Click **Create Task**. The task appears in the **New** column.

### Viewing & Editing a Task

Click on any task card on the board to open the **Task Detail** modal:

- **Left panel:**
  - View description
  - Read and add **comments**
  - View and upload **file attachments**
- **Right panel:**
  - See current **status** with a colored badge
  - Change the **assignee** via dropdown
  - Set or update the **deadline**
  - See **creation date**
  - **Transition buttons** to move the task to the next state
  - Full **state history** (who moved it and when)

### Deadline Indicators

| Indicator         | Meaning                             |
|-------------------|-------------------------------------|
| 🟢 Green date    | Deadline is more than 2 days away   |
| 🟡 Yellow date   | Deadline is within 2 days           |
| 🔴 Red **OVERDUE** badge | Deadline has passed (task not Done) |

### Deleting a Task

- Open a task → click **Delete Task** at the bottom *(Admin only)*.
- This permanently removes the task from the system.

> 💡 **Tip:** Instead of deleting, move tasks to the **Recycle Bin** column to soft-archive them.

---

## 🖱️ Drag and Drop

You can drag task cards between columns to change their state:

1. **Click and hold** a task card.
2. **Drag** it to a target column.
   - ✅ **Green highlight** = valid move (release to confirm).
   - ❌ **Red highlight** = invalid move (cannot drop).
3. **Release** to complete the transition.

The state history is automatically updated when you drop a task.

---

## 💬 Comments

- Open any task to see existing comments.
- To add a comment:
  1. Select the author from the dropdown (defaults to the logged-in user).
  2. Type your comment in the text field.
  3. Press **Enter** or click the **Send** button.
- **Admin** can delete any comment by clicking the trash icon next to it.

---

## 📎 File Attachments

Each task can have file attachments (images and PDFs).

### Uploading a File

1. Open a task's detail view.
2. In the **Attachments** section, click **Choose File**.
3. Select a JPEG, PNG, or PDF file.
4. Click **Upload**.

### File Actions

| Action      | Icon   | Description                                    |
|-------------|--------|------------------------------------------------|
| **Pin**     | 📌     | Pin a file to the top of the list              |
| **Preview** | 👁️     | View the image or PDF in a modal               |
| **Download**| ⬇️     | Download the file to your computer             |
| **Delete**  | 🗑️     | Remove the file permanently *(Admin only)*     |

### File Manager (Admin)

Admins can access the **File Manager** page from the navigation bar (`Files` button):
- View all uploaded files across all tasks.
- Download all files as a ZIP (organized by task).

### File Limits

- **Default max file size:** 5 MB (configurable by Admin).
- **Allowed file types:** JPEG, PNG, PDF (configurable by Admin).

---

## 👥 User Management

> 🔒 Only the **Admin** user can manage users.

### Adding a User

1. Click **Users** in the navigation bar.
2. In the modal, enter the new user's **Name** and **Role**.
3. Click the **+** button.
4. The new user gets the default password (`welcome123`) and must change it on first login.

### Removing a User

1. Click the **trash icon** next to the user's name.
2. If the user has active tasks, they will be **reassigned** to another user.
3. Completed/recycled tasks are reassigned to Admin.

> ⚠️ The **Admin** user (id: 0) cannot be deleted.

### Resetting a Password (Admin)

1. Click **Users** in the navigation bar.
2. Click the **reset icon** (↺) next to the user's name.
3. A **random temporary password** is generated and shown to you.
4. Share this password with the user — they will be forced to change it on next login.

---

## 🔐 Authentication & Passwords

### Login Flow

1. Select your user from the dropdown on the login screen.
2. Enter your password and click **Sign In**.
3. If this is your first login (or after a password reset), you will be **forced to set a new password** before accessing the board.

### Changing Your Password

1. Click the **key icon** (🔑) in the top navigation bar.
2. Enter your current password, new password, and confirm it.
3. Password must be at least **4 characters** and cannot be the default (`welcome123`).

### Security Details

- All passwords are hashed using **bcrypt** before storage.
- On first launch, if legacy plain-text passwords are detected, they are automatically migrated to bcrypt.
- Sessions are stored in `sessionStorage` (cleared when the browser tab is closed).

---

## 📜 Activity Log

> 🔒 Only **Admin** can view the Activity Log.

The Activity Log records every action performed in the system:

- Task created, transitioned, deleted
- Comments added or deleted
- File uploaded, pinned, deleted
- User added, removed
- Password changes and resets
- Login / Logout events

**To access:** Click **Activity Log** in the navigation bar (opens in a new tab).

---

## ⚙️ App Configuration (Admin)

> 🔒 Only **Admin** can access app configuration.

Click **Config** (gear icon) in the navigation bar to open the configuration modal.

### File Upload Settings

| Setting            | Default | Range        | Description                         |
|--------------------|---------|--------------|-------------------------------------|
| Max File Size (MB) | 5       | 0.1 – 100   | Maximum allowed size per uploaded file |
| Allowed File Types | JPEG, PNG, PDF | At least one | File types users can upload     |

### Backup Settings

| Setting              | Default | Range      | Description                              |
|----------------------|---------|------------|------------------------------------------|
| Backup Retention     | 3 days  | 1 – 365   | Backups older than this are auto-deleted  |
| Max Backup Files     | 50      | 1 – 1000  | Maximum number of backup files to keep    |

---

## 📦 Export & Import Data

> 🔒 Only **Admin** can export/import data.

### Export

1. Click **Export** in the navigation bar.
2. A JSON file is downloaded containing all tasks, users, and settings.
3. File is named `task-tracker-export-YYYY-MM-DD.json`.

### Import

1. Click **Import** in the navigation bar.
2. Select a previously exported JSON file.
3. **⚠️ This replaces ALL existing data** — you will be asked to confirm.

---

## 💾 Automatic Backups

Every time data is saved to `data.json`, a timestamped backup copy is created in the **`backups/`** folder:

```
backups/
├── data-20260312-221555.json
├── data-20260312-232506.json
├── data-20260313-001246.json
└── ...
```

- **File naming:** `data-YYYYMMDD-HHMMSS.json`
- **Auto-cleanup:** Backups older than the configured retention period (default: 3 days) are automatically deleted.
- To restore from a backup, simply copy the backup file over `data.json` and restart the server.

---

## 🛡️ Role-Based Access

| Action                       | Admin | Other Roles |
|------------------------------|:-----:|:-----------:|
| View board & tasks           | ✅    | ✅          |
| Create tasks                 | ✅    | ✅          |
| Transition tasks (buttons)   | ✅    | ✅          |
| Drag & drop tasks            | ✅    | ✅          |
| Change assignee & deadline   | ✅    | ✅          |
| Add comments                 | ✅    | ✅          |
| Upload files                 | ✅    | ✅          |
| Preview & download files     | ✅    | ✅          |
| Change own password          | ✅    | ✅          |
| Delete tasks                 | ✅    | ❌          |
| Delete comments              | ✅    | ❌          |
| Delete files                 | ✅    | ❌          |
| Manage users                 | ✅    | ❌          |
| Reset user passwords         | ✅    | ❌          |
| View activity log            | ✅    | ❌          |
| Access file manager          | ✅    | ❌          |
| App configuration            | ✅    | ❌          |
| Export / Import data         | ✅    | ❌          |

---

## 📁 Project Structure

```
kekarav-s1-32-manager/
├── server.js              # Node.js HTTP server (all API routes)
├── index.html             # Main Kanban board page
├── styles.css             # All custom styles
├── activity-log.html      # Activity log page (admin)
├── file-manager.html      # File manager page (admin)
├── data.json              # Task & user data (auto-created)
├── appconfig.json         # App configuration (auto-created)
├── file-metadata.json     # Uploaded file metadata (auto-created)
├── package.json           # Node.js dependencies
├── start.bat              # Start server (Windows)
├── stop.bat               # Stop server (Windows)
├── restart.bat            # Restart server (Windows)
├── js/                    # Frontend JavaScript modules
│   ├── config.js          #   Constants, states, transitions
│   ├── utils.js           #   Utility functions
│   ├── state.js           #   Shared state & data persistence
│   ├── auth.js            #   Login, logout, password management
│   ├── app.js             #   App initialization & session
│   ├── board.js           #   Board rendering & deadline helpers
│   ├── tasks.js           #   Task CRUD & state transitions
│   ├── comments.js        #   Comment rendering & management
│   ├── dragdrop.js        #   Drag-and-drop logic
│   ├── files.js           #   File upload, preview, pin, delete
│   ├── users.js           #   User management (admin)
│   ├── appconfig.js       #   App configuration UI (admin)
│   └── exportimport.js    #   Export/import data (admin)
├── uploads/               # Uploaded file storage (auto-created)
└── backups/               # Rolling data backups (auto-created)
```

---

## ❓ Troubleshooting

### Server won't start

- Make sure **Node.js** is installed: run `node -v` in a terminal.
- Make sure **port 132** is not in use by another application.
- Run `npm install` to ensure dependencies are installed.

### Can't access the page

- Verify the server is running (check the terminal window).
- Go to exactly: **http://localhost:132/kekarav-s132**
- If accessing from another device on the same network, replace `localhost` with the host machine's IP address.

### Forgot the Admin password

1. Stop the server.
2. Delete `data.json`.
3. Restart the server — a fresh `data.json` with default users and passwords will be created.

> ⚠️ This will **erase all tasks and users**. To keep your data, restore from a backup in the `backups/` folder instead.

### Restoring from a backup

1. Stop the server.
2. Copy a backup file from `backups/` (e.g., `data-20260313-001246.json`).
3. Rename it to `data.json` and place it in the project root.
4. Restart the server.

### Files not uploading

- Check that the file is a supported type (JPEG, PNG, or PDF).
- Check the file size does not exceed the configured limit (default: 5 MB).
- The Admin can adjust limits in **Config** → **File Upload Settings**.

---

## 🧰 Tech Stack

| Layer      | Technology                           |
|------------|--------------------------------------|
| Backend    | Node.js (vanilla HTTP server)        |
| Frontend   | HTML5, Bootstrap 5, Bootstrap Icons  |
| Auth       | bcrypt.js (password hashing)         |
| Storage    | JSON files (no database required)    |
| Archiving  | archiver (ZIP download for files)    |

---

*Built for simplicity. No database, no complex setup — just run and manage your tasks.*

