// ============================================
// App Configuration (Admin Only)
// ============================================

function openAppConfigModal() {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can access app configuration.');
        return;
    }

    // Populate form fields with current config
    document.getElementById('configMaxFileSizeMB').value = appConfig.maxFileSizeMB || 5;
    document.getElementById('configBackupRetentionDays').value = appConfig.backupRetentionDays || 3;
    document.getElementById('configMaxBackupFiles').value = appConfig.maxBackupFiles || 50;

    // Set allowed file types checkboxes
    const allowed = appConfig.allowedFileTypes || [];
    document.getElementById('configAllowJPEG').checked = allowed.includes('image/jpeg');
    document.getElementById('configAllowPNG').checked = allowed.includes('image/png');
    document.getElementById('configAllowPDF').checked = allowed.includes('application/pdf');

    document.getElementById('configSaveSuccess').classList.add('d-none');
    document.getElementById('configSaveError').classList.add('d-none');

    new bootstrap.Modal(document.getElementById('appConfigModal')).show();
}

async function saveAppConfigForm() {
    const maxFileSizeMB = parseFloat(document.getElementById('configMaxFileSizeMB').value);
    const backupRetentionDays = parseInt(document.getElementById('configBackupRetentionDays').value);
    const maxBackupFiles = parseInt(document.getElementById('configMaxBackupFiles').value);

    const errorDiv = document.getElementById('configSaveError');
    const successDiv = document.getElementById('configSaveSuccess');
    errorDiv.classList.add('d-none');
    successDiv.classList.add('d-none');

    // Validation
    if (isNaN(maxFileSizeMB) || maxFileSizeMB < 0.1 || maxFileSizeMB > 100) {
        errorDiv.textContent = 'Max file size must be between 0.1 and 100 MB.';
        errorDiv.classList.remove('d-none');
        return;
    }
    if (isNaN(backupRetentionDays) || backupRetentionDays < 1 || backupRetentionDays > 365) {
        errorDiv.textContent = 'Backup retention must be between 1 and 365 days.';
        errorDiv.classList.remove('d-none');
        return;
    }
    if (isNaN(maxBackupFiles) || maxBackupFiles < 1 || maxBackupFiles > 1000) {
        errorDiv.textContent = 'Max backup files must be between 1 and 1000.';
        errorDiv.classList.remove('d-none');
        return;
    }

    // Collect allowed file types
    const allowedFileTypes = [];
    if (document.getElementById('configAllowJPEG').checked) allowedFileTypes.push('image/jpeg');
    if (document.getElementById('configAllowPNG').checked) allowedFileTypes.push('image/png');
    if (document.getElementById('configAllowPDF').checked) allowedFileTypes.push('application/pdf');

    if (allowedFileTypes.length === 0) {
        errorDiv.textContent = 'At least one file type must be allowed.';
        errorDiv.classList.remove('d-none');
        return;
    }

    const config = {
        maxFileSizeMB,
        backupRetentionDays,
        maxBackupFiles,
        allowedFileTypes
    };

    const result = await saveAppConfig(config);
    if (result.success) {
        successDiv.textContent = 'Configuration saved successfully!';
        successDiv.classList.remove('d-none');
        await logActivity('Config Changed', 'Updated app configuration');
        setTimeout(() => {
            successDiv.classList.add('d-none');
        }, 3000);
    } else {
        errorDiv.textContent = result.message || 'Error saving configuration.';
        errorDiv.classList.remove('d-none');
    }
}

