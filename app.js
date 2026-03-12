// ============================================
// Data Storage & State Management
// ============================================

const BASE_PATH = '/kekarav-s132';
const API_URL = BASE_PATH + '/api/data';

const DEFAULT_USERS = [
    { id: 0, name: 'Unknown User', role: 'Unassigned' },
    { id: 1, name: 'John Developer', role: 'Developer' },
    { id: 2, name: 'Jane QA', role: 'QA' },
    { id: 3, name: 'Bob Manager', role: 'Manager' },
    { id: 4, name: 'Alice Lead', role: 'Lead' }
];

const STATES = ['New', 'InProgress', 'Completed', 'Reviewed', 'Done'];

const STATE_TRANSITIONS = {
    'New': ['InProgress'],
    'InProgress': ['Completed', 'New'],
    'Completed': ['Reviewed', 'InProgress'],
    'Reviewed': ['Done', 'Completed'],
    'Done': []
};

const STATE_COLORS = {
    'New': 'secondary',
    'InProgress': 'primary',
    'Completed': 'success',
    'Reviewed': 'purple',
    'Done': 'teal'
};

let tasks = [];
let users = [];
let taskIdCounter = 1;
let currentTaskId = null;

// ============================================
// Initialization
// ============================================

async function initializeApp() {
    await loadData();
    renderBoard();
    populateUserSelects();
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
            const assigneeName = assignee ? assignee.name : 'Unknown User';
            const isUnknown = !assignee || task.assigneeId === 0;
            const assigneeClass = isUnknown ? 'badge bg-light text-muted assignee-badge fst-italic' : 'badge bg-light text-dark assignee-badge';

            // Check deadline status
            const deadlineInfo = getDeadlineInfo(task);
            const isOverdue = deadlineInfo.isOverdue && state !== 'Done';
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
                <div class="task-card state-${state} ${overdueClass}" onclick="openTaskDetail(${task.id})">
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
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTaskId = null;
    draggedTaskState = null;

    // Remove all drag-over classes
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('drag-over-valid', 'drag-over-invalid');
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
    renderBoard();
}

// Check if state transition is valid (only one step forward or backward)
function isValidStateTransition(fromState, toState) {
    if (fromState === toState) return false;

    const fromIndex = STATES.indexOf(fromState);
    const toIndex = STATES.indexOf(toState);

    // Allow only one step forward or backward
    return Math.abs(toIndex - fromIndex) === 1;
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

    // Render state history
    renderStateHistory(task.stateHistory || []);

    new bootstrap.Modal(document.getElementById('taskDetailModal')).show();
}

function formatStateName(state) {
    if (state === 'InProgress') return 'In Progress';
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

    container.innerHTML = comments.map(c => {
        const author = users.find(u => u.id === c.authorId);
        const authorName = author ? author.name : 'Unknown User';
        const authorClass = author ? 'comment-author' : 'comment-author text-muted fst-italic';
        return `
            <div class="comment-item">
                <div class="d-flex justify-content-between">
                    <span class="${authorClass}">${authorName}</span>
                    <span class="comment-time">${c.timestamp}</span>
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
    document.getElementById('newComment').value = '';
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
        const actorName = actor ? actor.name : 'Unknown User';
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
    task.assigneeId = assigneeId;

    await saveData();
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
    renderBoard();
}

// ============================================
// Delete Task
// ============================================

async function deleteTask() {
    if (!confirm('Are you sure you want to delete this task?')) return;

    tasks = tasks.filter(t => t.id !== currentTaskId);
    await saveData();
    renderBoard();

    bootstrap.Modal.getInstance(document.getElementById('taskDetailModal')).hide();
}

// ============================================
// User Management
// ============================================

function openManageUsersModal() {
    renderUsersList();
    new bootstrap.Modal(document.getElementById('manageUsersModal')).show();
}

function renderUsersList() {
    const container = document.getElementById('usersList');
    container.innerHTML = users.map(u => `
        <div class="user-item">
            <div class="user-info">
                <i class="bi bi-person-circle"></i>
                <span>${escapeHtml(u.name)}</span>
                <span class="user-role">(${escapeHtml(u.role)})</span>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="removeUser(${u.id})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `).join('');
}

async function addUser() {
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
        role
    });

    await saveUsers();
    populateUserSelects();
    renderUsersList();

    document.getElementById('newUserName').value = '';
    document.getElementById('newUserRole').value = '';
}

async function removeUser(userId) {
    // Prevent deleting Unknown User
    if (userId === 0) {
        alert('Cannot delete "Unknown User". This is a system user.');
        return;
    }

    const user = users.find(u => u.id === userId);
    const userName = user ? user.name : 'this user';

    // Check if user is assigned to any task
    const assignedTasks = tasks.filter(t => t.assigneeId === userId);

    if (assignedTasks.length > 0) {
        // Separate tasks by state
        const doneTasks = assignedTasks.filter(t => t.state === 'Done');
        const activeTasks = assignedTasks.filter(t => t.state !== 'Done');

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

            // Mark done tasks as Unknown User (id: 0)
            doneTasks.forEach(task => {
                task.assigneeId = 0;
            });

            alert(`Active tasks reassigned to ${newAssignee.name}. ${doneTasks.length} completed task(s) marked as "Unknown User".`);
        } else {
            // All tasks are in Done state - just mark as Unknown User
            if (!confirm(`${userName} has ${doneTasks.length} completed task(s). Remove user and mark tasks as "Unknown User"?`)) {
                return;
            }

            doneTasks.forEach(task => {
                task.assigneeId = 0;
            });
        }
    } else {
        if (!confirm(`Are you sure you want to remove ${userName}? Their comments will show as "Unknown User".`)) {
            return;
        }
    }

    users = users.filter(u => u.id !== userId);
    await saveData();
    populateUserSelects();
    renderUsersList();
    renderBoard();
}

// ============================================
// Export / Import
// ============================================

function exportData() {
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

