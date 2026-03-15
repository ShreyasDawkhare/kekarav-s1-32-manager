// ============================================
// Shared Mutable State & Data Persistence
// ============================================

let tasks = [];
let users = [];
let taskIdCounter = 1;
let currentTaskId = null;
let loggedInUser = null;

async function loadData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        tasks = data.tasks || [];
        users = data.users || DEFAULT_USERS;
        taskIdCounter = data.taskIdCounter || 1;
    } catch (err) {
        console.error('Error loading data:', err);
        tasks = [];
        users = DEFAULT_USERS;
        taskIdCounter = 1;
    }
    // Also load app config
    await loadAppConfig();
}

async function loadAppConfig() {
    try {
        const response = await fetch(BASE_PATH + '/api/config');
        const data = await response.json();
        if (data.success) {
            appConfig = { ...appConfig, ...data.config };
        }
    } catch (err) {
        console.error('Error loading app config:', err);
    }
}

async function saveAppConfig(config) {
    try {
        const response = await fetch(BASE_PATH + '/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        const result = await response.json();
        if (result.success) {
            appConfig = { ...appConfig, ...config };
        }
        return result;
    } catch (err) {
        console.error('Error saving app config:', err);
        return { success: false, message: 'Error connecting to server.' };
    }
}

async function saveData() {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks, users, taskIdCounter })
        });
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

async function saveUsers() {
    await saveData();
}

async function logActivity(action, details) {
    if (!loggedInUser) return;
    try {
        await fetch(BASE_PATH + '/api/activity-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                userId: loggedInUser.id,
                userName: loggedInUser.name,
                details,
                timestamp: formatDateTime(new Date())
            })
        });
    } catch (err) {
        console.error('Error logging activity:', err);
    }
}

