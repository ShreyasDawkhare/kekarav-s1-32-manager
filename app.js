// ============================================
// Data Storage & State Management
// ============================================

const BASE_PATH = '/kekarav-s132';
const API_URL = BASE_PATH + '/api/data';

const DEFAULT_USERS = [
    { id: 0, name: 'Admin', role: 'Admin' },
    { id: 1, name: 'John Developer', role: 'Developer' },
    { id: 2, name: 'Jane QA', role: 'QA' },
    { id: 3, name: 'Bob Manager', role: 'Manager' },
    { id: 4, name: 'Alice Lead', role: 'Lead' }
];

const STATES = ['New', 'InProgress', 'Ready', 'Approved', 'Declined', 'Done', 'RecycleBin'];

const STATE_TRANSITIONS = {
    'New': ['InProgress', 'RecycleBin'],
    'InProgress': ['Ready', 'New', 'RecycleBin'],
    'Ready': ['Approved', 'Declined', 'InProgress', 'RecycleBin'],
    'Approved': ['InProgress', 'Done', 'RecycleBin'],
    'Declined': ['Done', 'InProgress', 'RecycleBin'],
    'Done': ['RecycleBin'],
    'RecycleBin': []
};

const STATE_COLORS = {
    'New': 'secondary',
    'InProgress': 'primary',
    'Ready': 'info',
    'Approved': 'success',
    'Declined': 'danger',
    'Done': 'teal',
    'RecycleBin': 'dark'
};

let tasks = [];
let users = [];
let taskIdCounter = 1;
let currentTaskId = null;
let loggedInUser = null;

// ============================================
// Initialization
// ============================================

async function initializeApp() {
    await loadData();
    populateLoginUserSelect();
    checkSession();
}

function checkSession() {
    const sessionData = sessionStorage.getItem('loggedInUser');
    if (sessionData) {
        try {
            loggedInUser = JSON.parse(sessionData);
            // Verify user still exists
            const userExists = users.find(u => u.id === loggedInUser.id);
            if (userExists) {
                showApp();
                return;
            }
        } catch (e) {
            // Invalid session
        }
    }
    showLoginScreen();
}

function showLoginScreen() {
    loggedInUser = null;
    sessionStorage.removeItem('loggedInUser');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('d-none');
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('loggedInUserLabel').textContent = `Logged in as: ${loggedInUser.name}`;
    // Show/hide admin-only elements
    const isAdmin = loggedInUser && loggedInUser.role === 'Admin';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    renderBoard();
    populateUserSelects();
}

function populateLoginUserSelect() {
    const select = document.getElementById('loginUserSelect');
    // Show all users in login dropdown
    select.innerHTML = users.map(u =>
        `<option value="${u.id}">${u.name} (${u.role})</option>`
    ).join('');
}

// ============================================
// Login / Logout / Password Management
// ============================================

async function loginUser() {
    const userId = parseInt(document.getElementById('loginUserSelect').value);
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!password) {
        errorDiv.textContent = 'Please enter your password.';
        errorDiv.classList.remove('d-none');
        return;
    }

    try {
        const response = await fetch(BASE_PATH + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password })
        });

        const result = await response.json();

        if (!result.success) {
            errorDiv.textContent = result.message;
            errorDiv.classList.remove('d-none');
            return;
        }

        errorDiv.classList.add('d-none');
        loggedInUser = result.user;
        sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));

        // Check if user must reset password
        if (result.user.mustResetPassword) {
            document.getElementById('loginScreen').style.display = 'none';
            showForceResetPasswordModal();
        } else {
            showApp();
        }
    } catch (err) {
        errorDiv.textContent = 'Error connecting to server.';
        errorDiv.classList.remove('d-none');
    }
}

function showForceResetPasswordModal() {
    document.getElementById('forceNewPassword').value = '';
    document.getElementById('forceConfirmPassword').value = '';
    document.getElementById('forceResetError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('forceResetPasswordModal')).show();
}

async function forceResetPassword() {
    const newPassword = document.getElementById('forceNewPassword').value;
    const confirmPassword = document.getElementById('forceConfirmPassword').value;
    const errorDiv = document.getElementById('forceResetError');

    if (!newPassword || newPassword.length < 4) {
        errorDiv.textContent = 'Password must be at least 4 characters.';
        errorDiv.classList.remove('d-none');
        return;
    }
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match.';
        errorDiv.classList.remove('d-none');
        return;
    }

    try {
        const response = await fetch(BASE_PATH + '/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loggedInUser.id, newPassword })
        });

        const result = await response.json();

        if (!result.success) {
            errorDiv.textContent = result.message;
            errorDiv.classList.remove('d-none');
            return;
        }

        // Update session - no longer needs reset
        loggedInUser.mustResetPassword = false;
        sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));

        bootstrap.Modal.getInstance(document.getElementById('forceResetPasswordModal')).hide();

        // Reload data since password changed on server
        await loadData();
        showApp();
    } catch (err) {
        errorDiv.textContent = 'Error connecting to server.';
        errorDiv.classList.remove('d-none');
    }
}

function openChangePasswordModal() {
    document.getElementById('currentPassword').value = '';
    document.getElementById('changeNewPassword').value = '';
    document.getElementById('changeConfirmPassword').value = '';
    document.getElementById('changePasswordError').classList.add('d-none');
    document.getElementById('changePasswordSuccess').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
}

async function changePassword() {
    const oldPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('changeNewPassword').value;
    const confirmPassword = document.getElementById('changeConfirmPassword').value;
    const errorDiv = document.getElementById('changePasswordError');
    const successDiv = document.getElementById('changePasswordSuccess');

    errorDiv.classList.add('d-none');
    successDiv.classList.add('d-none');

    if (!oldPassword) {
        errorDiv.textContent = 'Please enter your current password.';
        errorDiv.classList.remove('d-none');
        return;
    }
    if (!newPassword || newPassword.length < 4) {
        errorDiv.textContent = 'New password must be at least 4 characters.';
        errorDiv.classList.remove('d-none');
        return;
    }
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'New passwords do not match.';
        errorDiv.classList.remove('d-none');
        return;
    }

    try {
        const response = await fetch(BASE_PATH + '/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loggedInUser.id, oldPassword, newPassword })
        });

        const result = await response.json();

        if (!result.success) {
            errorDiv.textContent = result.message;
            errorDiv.classList.remove('d-none');
            return;
        }

        successDiv.textContent = 'Password changed successfully!';
        successDiv.classList.remove('d-none');

        // Reload data
        await loadData();

        // Auto-close modal after a moment
        setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
        }, 1500);
    } catch (err) {
        errorDiv.textContent = 'Error connecting to server.';
        errorDiv.classList.remove('d-none');
    }
}

async function resetUserPassword(userId) {
    // Only admin can reset passwords
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can reset passwords.');
        return;
    }
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`Reset password for "${user.name}"? A temporary password will be generated.`)) return;

    try {
        const response = await fetch(BASE_PATH + '/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, requesterId: loggedInUser.id })
        });

        const result = await response.json();

        if (result.success) {
            alert(`${result.message}\nTemporary password: ${result.tempPassword}\n\nPlease share this with the user. They will be required to change it on next login.`);
            await loadData();
            renderUsersList();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (err) {
        alert('Error connecting to server.');
    }
}

async function logoutUser() {
    await logActivity('Logout', `${loggedInUser.name} logged out`);
    loggedInUser = null;
    sessionStorage.removeItem('loggedInUser');
    showLoginScreen();
}

async function loadData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        tasks = data.tasks || [];
        users = data.users || DEFAULT_USERS;
        taskIdCounter = data.taskIdCounter || 1;
    } catch (err) {
        console.error('Error loading data:', err);
        // Fallback to defaults
        tasks = [];
        users = DEFAULT_USERS;
        taskIdCounter = 1;
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

async function saveUsers() {
    await saveData();
}

// ============================================
// User Select Population
// ============================================

function populateUserSelects() {
    const selects = ['newTaskAssignee', 'detailTaskAssignee', 'commentAuthor'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = users.map(u =>
                `<option value="${u.id}">${u.name} (${u.role})</option>`
            ).join('');
        }
    });
}

// ============================================
// Board Rendering
// ============================================

function renderBoard() {
    STATES.forEach(state => {
        const column = document.getElementById(`column-${state}`);
        const stateTasks = tasks.filter(t => t.state === state);

        // Update count badge
        document.getElementById(`count-${state}`).textContent = stateTasks.length;

        if (stateTasks.length === 0) {
            column.innerHTML = '<div class="empty-column">No tasks</div>';
            return;
        }

        column.innerHTML = stateTasks.map(task => {
            const assignee = users.find(u => u.id === task.assigneeId);
            const assigneeName = assignee ? assignee.name : 'Admin';
            const isUnknown = !assignee;
            const assigneeClass = isUnknown ? 'badge bg-light text-muted assignee-badge fst-italic' : 'badge bg-light text-dark assignee-badge';

            // Check deadline status
            const deadlineInfo = getDeadlineInfo(task);
            const isOverdue = deadlineInfo.isOverdue && state !== 'Done' && state !== 'RecycleBin';
            const overdueClass = isOverdue ? 'overdue' : '';

            // Deadline badge HTML
            let deadlineBadge = '';
            if (task.deadline) {
                deadlineBadge = `
                    <span class="badge bg-light deadline-badge ${deadlineInfo.class}">
                        <i class="bi bi-calendar"></i> ${formatDeadlineDisplay(task.deadline)}
                    </span>
                `;
            }

            return `
                <div class="task-card state-${state} ${overdueClass}" draggable="true" data-task-id="${task.id}" data-task-state="${state}" onclick="openTaskDetail(${task.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="task-id">TASK-${task.id}</div>
                        ${isOverdue ? '<span class="badge bg-danger" style="font-size: 10px;">OVERDUE</span>' : ''}
                    </div>
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <span class="${assigneeClass}">
                            <i class="bi bi-person"></i> ${assigneeName}
                        </span>
                        <span class="badge bg-light text-dark">
                            <i class="bi bi-chat"></i> ${task.comments ? task.comments.length : 0}
                        </span>
                    </div>
                    ${deadlineBadge ? `<div class="mt-1">${deadlineBadge}</div>` : ''}
                </div>
            `;
        }).join('');
    });

    // Re-attach drag-and-drop event listeners
    initDragAndDrop();
}

// Check deadline status
function getDeadlineInfo(task) {
    if (!task.deadline) {
        return { isOverdue: false, class: '' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { isOverdue: true, class: 'deadline-overdue' };
    } else if (diffDays <= 2) {
        return { isOverdue: false, class: 'deadline-warning' };
    } else {
        return { isOverdue: false, class: 'deadline-ok' };
    }
}

// Format deadline for display
function formatDeadlineDisplay(deadline) {
    const date = new Date(deadline);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================
// Drag and Drop
// ============================================

let draggedTaskId = null;
let draggedTaskState = null;

function initDragAndDrop() {
    // Add drag events to all task cards
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });

    // Add drop events to all drop zones
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedTaskId = parseInt(e.target.dataset.taskId);
    draggedTaskState = e.target.dataset.taskState;
    e.target.classList.add('dragging');

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTaskId);

    // Highlight all valid/invalid target columns immediately
    document.querySelectorAll('.board-column').forEach(col => {
        const colState = col.dataset.state;
        if (isValidStateTransition(draggedTaskState, colState)) {
            col.classList.add('drop-target-valid');
        } else if (colState !== draggedTaskState) {
            col.classList.add('drop-target-invalid');
        }
    });
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTaskId = null;
    draggedTaskState = null;

    // Remove all drag highlight classes
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('drag-over-valid', 'drag-over-invalid');
    });
    document.querySelectorAll('.board-column').forEach(col => {
        col.classList.remove('drop-target-valid', 'drop-target-invalid');
    });
}

function handleDragOver(e) {
    e.preventDefault();

    const targetState = e.currentTarget.dataset.state;
    const isValidMove = isValidStateTransition(draggedTaskState, targetState);

    // Remove previous classes
    e.currentTarget.classList.remove('drag-over-valid', 'drag-over-invalid');

    // Add appropriate class
    if (isValidMove) {
        e.currentTarget.classList.add('drag-over-valid');
        e.dataTransfer.dropEffect = 'move';
    } else {
        e.currentTarget.classList.add('drag-over-invalid');
        e.dataTransfer.dropEffect = 'none';
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-valid', 'drag-over-invalid');
}

async function handleDrop(e) {
    e.preventDefault();

    const targetState = e.currentTarget.dataset.state;

    // Remove drag-over classes
    e.currentTarget.classList.remove('drag-over-valid', 'drag-over-invalid');

    // Check if valid move
    if (!isValidStateTransition(draggedTaskState, targetState)) {
        return;
    }

    // Find and update the task
    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    const oldState = task.state;

    // Add to state history
    if (!task.stateHistory) {
        task.stateHistory = [];
    }

    task.stateHistory.push({
        fromState: oldState,
        toState: targetState,
        actorId: task.assigneeId,
        timestamp: formatDateTime(new Date())
    });

    // Update state
    task.state = targetState;

    await saveData();
    await logActivity('Task Transitioned', `TASK-${task.id} dragged from ${formatStateName(oldState)} to ${formatStateName(targetState)}`);
    renderBoard();
}

// Check if state transition is valid (only one step forward or backward)
function isValidStateTransition(fromState, toState) {
    if (fromState === toState) return false;
    const allowed = STATE_TRANSITIONS[fromState] || [];
    return allowed.includes(toState);
}

// ============================================
// Task Creation
// ============================================

function openCreateTaskModal() {
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDescription').value = '';
    // Default to Unknown User (id: 0)
    const unknownUser = users.find(u => u.id === 0);
    if (unknownUser) {
        document.getElementById('newTaskAssignee').value = 0;
    } else if (users.length > 0) {
        document.getElementById('newTaskAssignee').value = users[0].id;
    }
    document.getElementById('newTaskDeadline').value = '';
    new bootstrap.Modal(document.getElementById('createTaskModal')).show();
}

async function createTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    const description = document.getElementById('newTaskDescription').value.trim();
    const assigneeId = parseInt(document.getElementById('newTaskAssignee').value);
    const deadline = document.getElementById('newTaskDeadline').value || null;

    if (!title) {
        alert('Please enter a title');
        return;
    }

    const newTask = {
        id: taskIdCounter++,
        title,
        description,
        state: 'New',
        assigneeId,
        deadline,
        createdAt: formatDateTime(new Date()),
        comments: [],
        stateHistory: []
    };

    tasks.push(newTask);
    await saveData();
    await logActivity('Task Created', `Created TASK-${newTask.id}: ${title}`);
    renderBoard();

    bootstrap.Modal.getInstance(document.getElementById('createTaskModal')).hide();
}

// ============================================
// Task Detail View
// ============================================

function openTaskDetail(taskId) {
    currentTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Set basic info
    document.getElementById('detailTaskId').textContent = `TASK-${task.id}`;
    document.getElementById('detailTaskTitle').textContent = task.title;
    document.getElementById('detailTaskDescription').textContent = task.description || 'No description';
    document.getElementById('detailTaskCreated').textContent = task.createdAt;

    // Handle assignee dropdown
    const assigneeSelect = document.getElementById('detailTaskAssignee');
    assigneeSelect.innerHTML = users.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
    assigneeSelect.value = task.assigneeId;

    // Handle deadline
    document.getElementById('detailTaskDeadline').value = task.deadline || '';

    // Set state badge
    const stateColor = STATE_COLORS[task.state];
    document.getElementById('detailTaskState').innerHTML =
        `<span class="badge bg-${stateColor}">${formatStateName(task.state)}</span>`;

    // Render transition buttons
    const transitions = STATE_TRANSITIONS[task.state] || [];
    document.getElementById('transitionButtons').innerHTML = transitions.length === 0
        ? '<p class="text-muted small">No transitions available</p>'
        : transitions.map(nextState =>
            `<button class="btn btn-sm btn-outline-primary btn-state mb-2 w-100" onclick="transitionTask('${nextState}')">
                <i class="bi bi-arrow-right"></i> ${formatStateName(nextState)}
            </button>`
        ).join('');

    // Render comments
    renderComments(task.comments || []);

    // Default comment author to logged-in user
    const commentAuthorSelect = document.getElementById('commentAuthor');
    if (loggedInUser && commentAuthorSelect) {
        commentAuthorSelect.value = loggedInUser.id;
    }

    // Render state history
    renderStateHistory(task.stateHistory || []);

    new bootstrap.Modal(document.getElementById('taskDetailModal')).show();
}

function formatStateName(state) {
    if (state === 'InProgress') return 'In Progress';
    if (state === 'RecycleBin') return 'Recycle Bin';
    return state;
}

// ============================================
// Comments
// ============================================

function renderComments(comments) {
    const container = document.getElementById('commentsSection');

    if (comments.length === 0) {
        container.innerHTML = '<p class="text-muted small">No comments yet</p>';
        return;
    }

    const isAdmin = loggedInUser && loggedInUser.role === 'Admin';
    container.innerHTML = comments.map((c, index) => {
        const author = users.find(u => u.id === c.authorId);
        const authorName = author ? author.name : 'Deleted User';
        const authorClass = author ? 'comment-author' : 'comment-author text-muted fst-italic';
        const deleteBtn = isAdmin ? `<button class="btn btn-sm btn-outline-danger ms-2 py-0 px-1" onclick="deleteComment(${index})" title="Delete comment"><i class="bi bi-trash"></i></button>` : '';
        return `
            <div class="comment-item">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="${authorClass}">${authorName}</span>
                    <span class="comment-time">${c.timestamp}${deleteBtn}</span>
                </div>
                <div class="comment-text">${escapeHtml(c.text)}</div>
            </div>
        `;
    }).join('');
}

async function addComment() {
    const text = document.getElementById('newComment').value.trim();
    const authorId = parseInt(document.getElementById('commentAuthor').value);

    if (!text) return;

    const task = tasks.find(t => t.id === currentTaskId);
    if (!task) return;

    if (!task.comments) {
        task.comments = [];
    }

    task.comments.push({
        text,
        authorId,
        timestamp: formatDateTime(new Date())
    });

    await saveData();
    await logActivity('Comment Added', `Commented on TASK-${task.id}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    document.getElementById('newComment').value = '';
    renderComments(task.comments);
}

async function deleteComment(index) {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can delete comments.');
        return;
    }
    if (!confirm('Are you sure you want to delete this comment?')) return;

    const task = tasks.find(t => t.id === currentTaskId);
    if (!task || !task.comments || index < 0 || index >= task.comments.length) return;

    const deleted = task.comments.splice(index, 1)[0];
    const commentPreview = deleted.text.substring(0, 50) + (deleted.text.length > 50 ? '...' : '');
    await saveData();
    await logActivity('Comment Deleted', `Deleted comment on TASK-${task.id}: "${commentPreview}"`);
    renderComments(task.comments);
}

// ============================================
// State History
// ============================================

function renderStateHistory(history) {
    const container = document.getElementById('stateHistory');

    if (history.length === 0) {
        container.innerHTML = '<p class="text-muted small">No transitions yet</p>';
        return;
    }

    container.innerHTML = history.map(h => {
        const actor = users.find(u => u.id === h.actorId);
        const actorName = actor ? actor.name : 'Deleted User';
        return `
            <div class="transition-item">
                <div>
                    <strong>${formatStateName(h.fromState)}</strong> 
                    <span class="transition-arrow">→</span> 
                    <strong>${formatStateName(h.toState)}</strong>
                </div>
                <div class="text-muted small">${actorName} • ${h.timestamp}</div>
            </div>
        `;
    }).join('');
}

// ============================================
// Task State Transitions
// ============================================

async function transitionTask(newState) {
    const task = tasks.find(t => t.id === currentTaskId);
    if (!task) return;

    const actorId = parseInt(document.getElementById('detailTaskAssignee').value);
    const oldState = task.state;

    // Add to state history
    if (!task.stateHistory) {
        task.stateHistory = [];
    }

    task.stateHistory.push({
        fromState: oldState,
        toState: newState,
        actorId,
        timestamp: formatDateTime(new Date())
    });

    // Update state
    task.state = newState;

    await saveData();
    await logActivity('Task Transitioned', `TASK-${task.id} moved from ${formatStateName(oldState)} to ${formatStateName(newState)}`);
    renderBoard();

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('taskDetailModal')).hide();
}

// ============================================
// Update Assignee
// ============================================

async function updateAssignee() {
    const task = tasks.find(t => t.id === currentTaskId);
    if (!task) return;

    const assigneeId = parseInt(document.getElementById('detailTaskAssignee').value);
    const assignee = users.find(u => u.id === assigneeId);
    task.assigneeId = assigneeId;

    await saveData();
    await logActivity('Assignee Changed', `TASK-${task.id} assigned to ${assignee ? assignee.name : 'Unknown'}`);
    renderBoard();
}

// ============================================
// Update Deadline
// ============================================

async function updateDeadline() {
    const task = tasks.find(t => t.id === currentTaskId);
    if (!task) return;

    const deadline = document.getElementById('detailTaskDeadline').value || null;
    task.deadline = deadline;

    await saveData();
    await logActivity('Deadline Changed', `TASK-${task.id} deadline ${deadline ? 'set to ' + formatDeadlineDisplay(deadline) : 'removed'}`);
    renderBoard();
}

// ============================================
// Delete Task
// ============================================

async function deleteTask() {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const task = tasks.find(t => t.id === currentTaskId);
    const taskTitle = task ? task.title : '';
    tasks = tasks.filter(t => t.id !== currentTaskId);
    await saveData();
    await logActivity('Task Deleted', `Deleted TASK-${currentTaskId}: ${taskTitle}`);
    renderBoard();

    bootstrap.Modal.getInstance(document.getElementById('taskDetailModal')).hide();
}

// ============================================
// User Management
// ============================================

function openManageUsersModal() {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can manage users.');
        return;
    }
    renderUsersList();
    new bootstrap.Modal(document.getElementById('manageUsersModal')).show();
}

function renderUsersList() {
    const container = document.getElementById('usersList');
    const isAdmin = loggedInUser && loggedInUser.role === 'Admin';
    container.innerHTML = users.map(u => {
        const isAdminUser = u.id === 0;
        const needsReset = u.mustResetPassword;
        const resetBadge = needsReset ? '<span class="badge bg-warning text-dark ms-2" style="font-size: 10px;">Must Reset Password</span>' : '';
        const resetBtn = (isAdmin && !isAdminUser) ? `<button class="btn btn-sm btn-outline-warning" onclick="resetUserPassword(${u.id})" title="Reset Password"><i class="bi bi-arrow-counterclockwise"></i></button>` : '';
        const deleteBtn = isAdminUser ? '' : `<button class="btn btn-sm btn-outline-danger" onclick="removeUser(${u.id})"><i class="bi bi-trash"></i></button>`;
        return `
            <div class="user-item">
                <div class="user-info">
                    <i class="bi bi-person-circle${isAdminUser ? ' text-danger' : ''}"></i>
                    <span>${escapeHtml(u.name)}</span>
                    <span class="user-role">(${escapeHtml(u.role)})</span>
                    ${resetBadge}
                </div>
                <div class="d-flex gap-1">
                    ${resetBtn}
                    ${deleteBtn}
                </div>
            </div>
        `;
    }).join('');
}

async function addUser() {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can add users.');
        return;
    }
    const name = document.getElementById('newUserName').value.trim();
    const role = document.getElementById('newUserRole').value.trim();

    if (!name || !role) {
        alert('Please enter both name and role');
        return;
    }

    const maxId = users.reduce((max, u) => Math.max(max, u.id), 0);
    users.push({
        id: maxId + 1,
        name,
        role,
        mustResetPassword: true
    });

    await saveUsers();
    await logActivity('User Added', `Added user: ${name} (${role})`);
    populateUserSelects();
    populateLoginUserSelect();
    renderUsersList();

    document.getElementById('newUserName').value = '';
    document.getElementById('newUserRole').value = '';
}

async function removeUser(userId) {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can remove users.');
        return;
    }
    // Prevent deleting Admin
    if (userId === 0) {
        alert('Cannot delete "Admin". This is a system user.');
        return;
    }

    const user = users.find(u => u.id === userId);
    const userName = user ? user.name : 'this user';

    // Check if user is assigned to any task
    const assignedTasks = tasks.filter(t => t.assigneeId === userId);

    if (assignedTasks.length > 0) {
        // Separate tasks by state
        const doneTasks = assignedTasks.filter(t => t.state === 'Done' || t.state === 'RecycleBin');
        const activeTasks = assignedTasks.filter(t => t.state !== 'Done' && t.state !== 'RecycleBin');

        if (activeTasks.length > 0) {
            // There are active tasks - need to reassign
            const otherUsers = users.filter(u => u.id !== userId);
            if (otherUsers.length === 0) {
                alert('Cannot remove the last user. Add another user first.');
                return;
            }

            if (!confirm(`${userName} is assigned to ${activeTasks.length} active task(s). Do you want to reassign these tasks and remove the user?`)) {
                return;
            }

            // Reassign active tasks to the first available user
            const newAssignee = otherUsers[0];
            activeTasks.forEach(task => {
                task.assigneeId = newAssignee.id;
            });

            // Mark done tasks as Admin (id: 0)
            doneTasks.forEach(task => {
                task.assigneeId = 0;
            });

            alert(`Active tasks reassigned to ${newAssignee.name}. ${doneTasks.length} completed task(s) marked as "Admin".`);
        } else {
            // All tasks are in Done state - just mark as Admin
            if (!confirm(`${userName} has ${doneTasks.length} completed task(s). Remove user and mark tasks as "Admin"?`)) {
                return;
            }

            doneTasks.forEach(task => {
                task.assigneeId = 0;
            });
        }
    } else {
        if (!confirm(`Are you sure you want to remove ${userName}?`)) {
            return;
        }
    }

    users = users.filter(u => u.id !== userId);
    await saveData();
    await logActivity('User Removed', `Removed user: ${userName}`);
    populateUserSelects();
    populateLoginUserSelect();
    renderUsersList();
    renderBoard();
}

// ============================================
// Export / Import
// ============================================

function exportData() {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can export data.');
        return;
    }
    const data = {
        tasks,
        users,
        taskIdCounter,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `task-tracker-export-${formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(event) {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can import data.');
        event.target.value = '';
        return;
    }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.tasks || !data.users) {
                throw new Error('Invalid file format');
            }

            if (!confirm('This will replace all existing data. Continue?')) {
                return;
            }

            tasks = data.tasks;
            users = data.users;
            taskIdCounter = data.taskIdCounter || 1;

            await saveData();
            renderBoard();
            populateUserSelects();

            alert('Data imported successfully!');
        } catch (err) {
            alert('Error importing file: ' + err.message);
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

// ============================================
// Utility Functions
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// ============================================
// Initialize App on Load
// ============================================

document.addEventListener('DOMContentLoaded', initializeApp);

