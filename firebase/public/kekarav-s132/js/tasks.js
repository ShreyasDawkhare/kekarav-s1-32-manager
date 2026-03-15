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

    // Render file attachments
    renderTaskFiles(taskId);

    new bootstrap.Modal(document.getElementById('taskDetailModal')).show();
}

function formatStateName(state) {
    if (state === 'InProgress') return 'In Progress';
    if (state === 'RecycleBin') return 'Recycle Bin';
    return state;
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
    // Only Admin can delete tasks
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can delete tasks.');
        return;
    }

    if (!confirm('Are you sure you want to delete this task?')) return;

    const task = tasks.find(t => t.id === currentTaskId);
    const taskTitle = task ? task.title : '';
    tasks = tasks.filter(t => t.id !== currentTaskId);
    await saveData();
    await logActivity('Task Deleted', `Deleted TASK-${currentTaskId}: ${taskTitle}`);
    renderBoard();

    bootstrap.Modal.getInstance(document.getElementById('taskDetailModal')).hide();
}

