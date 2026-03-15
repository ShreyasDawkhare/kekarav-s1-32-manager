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

function isValidStateTransition(fromState, toState) {
    if (fromState === toState) return false;
    const allowed = STATE_TRANSITIONS[fromState] || [];
    return allowed.includes(toState);
}

