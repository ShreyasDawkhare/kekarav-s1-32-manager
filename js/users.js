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

