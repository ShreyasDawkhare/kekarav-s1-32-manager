// ============================================
// File Upload & Management (Task-level)
// ============================================

// Upload file for a task
async function uploadTaskFile() {
    const fileInput = document.getElementById('taskFileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    // Validate file type
    const allowedTypes = appConfig.allowedFileTypes || ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        alert('Only JPEG, PNG and PDF files are allowed.');
        fileInput.value = '';
        return;
    }

    // Validate file size
    const maxSizeMB = appConfig.maxFileSizeMB || 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`File size exceeds the limit of ${maxSizeMB} MB.`);
        fileInput.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', currentTaskId);
    formData.append('uploaderId', loggedInUser.id);
    formData.append('uploaderName', loggedInUser.name);

    try {
        const uploadBtn = document.getElementById('uploadFileBtn');
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';

        const response = await fetch(BASE_PATH + '/api/files/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            fileInput.value = '';
            await logActivity('File Uploaded', `Uploaded "${result.file.originalName}" to TASK-${currentTaskId}`);
            renderTaskFiles(currentTaskId);
        } else {
            alert('Upload failed: ' + result.message);
        }
    } catch (err) {
        alert('Error uploading file.');
        console.error(err);
    } finally {
        const uploadBtn = document.getElementById('uploadFileBtn');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-upload"></i> Upload';
    }
}

// Render files for a task in the task detail modal
async function renderTaskFiles(taskId) {
    const container = document.getElementById('taskFilesSection');
    if (!container) return;

    try {
        const response = await fetch(BASE_PATH + '/api/files/list?taskId=' + taskId);
        const result = await response.json();

        if (!result.success || !result.files || result.files.length === 0) {
            container.innerHTML = '<p class="text-muted small">No files attached</p>';
            return;
        }

        // Sort: pinned first
        const files = result.files.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
        });

        container.innerHTML = files.map(f => {
            const isImage = f.mimeType && f.mimeType.startsWith('image/');
            const icon = isImage ? 'bi-file-image' : 'bi-file-pdf';
            const iconColor = isImage ? 'text-success' : 'text-danger';
            const sizeStr = formatFileSize(f.size);
            const pinIcon = f.pinned ? 'bi-pin-fill text-warning' : 'bi-pin text-muted';
            const pinTitle = f.pinned ? 'Unpin this file' : 'Pin this file';
            const pinnedBg = f.pinned ? 'background-color:#fff9e6;' : '';
            return `
                <div class="file-item d-flex justify-content-between align-items-center" style="${pinnedBg}">
                    <div class="d-flex align-items-center gap-2 overflow-hidden">
                        <i class="bi ${icon} ${iconColor}"></i>
                        <div class="overflow-hidden">
                            <div class="small text-truncate" title="${escapeHtml(f.originalName)}">
                                ${f.pinned ? '<i class="bi bi-pin-fill text-warning" style="font-size:10px;"></i> ' : ''}${escapeHtml(f.originalName)}
                            </div>
                            <div class="text-muted" style="font-size:10px;">${sizeStr} • ${f.uploaderName} • ${f.uploadedAt}</div>
                        </div>
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button class="btn btn-sm btn-outline-warning py-0 px-1" onclick="toggleFilePin('${f.id}', ${taskId})" title="${pinTitle}">
                            <i class="bi ${pinIcon}" style="font-size:12px;"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary py-0 px-1" onclick="previewFile('${f.id}')" title="Preview">
                            <i class="bi bi-eye"></i>
                        </button>
                        <a class="btn btn-sm btn-outline-secondary py-0 px-1" href="${BASE_PATH}/api/files/download/${f.id}" title="Download">
                            <i class="bi bi-download"></i>
                        </a>
                        <button class="btn btn-sm btn-outline-danger py-0 px-1 admin-only" onclick="deleteFile('${f.id}')" title="Delete" style="${loggedInUser && loggedInUser.role === 'Admin' ? '' : 'display:none'}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-muted small">Error loading files</p>';
        console.error(err);
    }
}

// Toggle pin/unpin a file (from task detail view)
async function toggleFilePin(fileId, taskId) {
    try {
        const response = await fetch(BASE_PATH + '/api/files/pin/' + fileId, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            await logActivity(result.pinned ? 'File Pinned' : 'File Unpinned',
                `${result.pinned ? 'Pinned' : 'Unpinned'} "${result.fileName}" in TASK-${taskId}`);
            renderTaskFiles(taskId);
        } else {
            alert('Error: ' + result.message);
        }
    } catch (err) {
        alert('Error toggling pin.');
        console.error(err);
    }
}

// Preview a file in a modal
async function previewFile(fileId) {
    try {
        const response = await fetch(BASE_PATH + '/api/files/meta/' + fileId);
        const result = await response.json();
        if (!result.success) {
            alert('File not found.');
            return;
        }

        const file = result.file;
        const previewTitle = document.getElementById('previewFileTitle');
        const previewBody = document.getElementById('previewFileBody');

        previewTitle.textContent = file.originalName;

        const fileUrl = BASE_PATH + '/api/files/download/' + file.id;

        if (file.mimeType && file.mimeType.startsWith('image/')) {
            previewBody.innerHTML = `<img src="${fileUrl}" class="img-fluid rounded" alt="${escapeHtml(file.originalName)}" style="max-height:70vh;">`;
        } else if (file.mimeType === 'application/pdf') {
            previewBody.innerHTML = `<iframe src="${fileUrl}" style="width:100%;height:70vh;border:none;" title="${escapeHtml(file.originalName)}"></iframe>`;
        } else {
            previewBody.innerHTML = '<p class="text-muted">Preview not available for this file type.</p>';
        }

        new bootstrap.Modal(document.getElementById('filePreviewModal')).show();
    } catch (err) {
        alert('Error loading file preview.');
        console.error(err);
    }
}

// Delete a file (admin only)
async function deleteFile(fileId) {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can delete files.');
        return;
    }
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
        const response = await fetch(BASE_PATH + '/api/files/delete/' + fileId, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requesterId: loggedInUser.id })
        });
        const result = await response.json();
        if (result.success) {
            const taskCtx = currentTaskId ? ` from TASK-${currentTaskId}` : '';
            await logActivity('File Deleted', `Deleted file "${result.fileName}"${taskCtx}`);
            // Refresh file list in task detail if open
            if (currentTaskId) {
                renderTaskFiles(currentTaskId);
            }
        } else {
            alert('Error: ' + result.message);
        }
    } catch (err) {
        alert('Error deleting file.');
        console.error(err);
    }
}

// ============================================
// Utility
// ============================================

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

