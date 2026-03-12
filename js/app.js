// ============================================
// App Initialization
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

// ============================================
// Initialize App on Load
// ============================================

document.addEventListener('DOMContentLoaded', initializeApp);

