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

