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

// ============================================
// Deadline Helpers
// ============================================

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

function formatDeadlineDisplay(deadline) {
    const date = new Date(deadline);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function populateLoginUserSelect() {
    const select = document.getElementById('loginUserSelect');
    select.innerHTML = users.map(u =>
        `<option value="${u.id}">${u.name} (${u.role})</option>`
    ).join('');
}

