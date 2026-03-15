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

