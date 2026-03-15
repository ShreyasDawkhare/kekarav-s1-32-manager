// ============================================
// Comments
// ============================================

function renderComments(comments) {
    const container = document.getElementById('commentsSection');

    if (comments.length === 0) {
        container.innerHTML = '<p class="text-muted small">No comments yet</p>';
        return;
    }

    const isAdmin = loggedInUser && loggedInUser.role === 'Admin';
    container.innerHTML = comments.map((c, index) => {
        const author = users.find(u => u.id === c.authorId);
        const authorName = author ? author.name : 'Deleted User';
        const authorClass = author ? 'comment-author' : 'comment-author text-muted fst-italic';
        const deleteBtn = isAdmin ? `<button class="btn btn-sm btn-outline-danger ms-2 py-0 px-1" onclick="deleteComment(${index})" title="Delete comment"><i class="bi bi-trash"></i></button>` : '';
        return `
            <div class="comment-item">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="${authorClass}">${authorName}</span>
                    <span class="comment-time">${c.timestamp}${deleteBtn}</span>
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
    await logActivity('Comment Added', `Commented on TASK-${task.id}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    document.getElementById('newComment').value = '';
    renderComments(task.comments);
}

async function deleteComment(index) {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        alert('Only Admin can delete comments.');
        return;
    }
    if (!confirm('Are you sure you want to delete this comment?')) return;

    const task = tasks.find(t => t.id === currentTaskId);
    if (!task || !task.comments || index < 0 || index >= task.comments.length) return;

    const deleted = task.comments.splice(index, 1)[0];
    const commentPreview = deleted.text.substring(0, 50) + (deleted.text.length > 50 ? '...' : '');
    await saveData();
    await logActivity('Comment Deleted', `Deleted comment on TASK-${task.id}: "${commentPreview}"`);
    renderComments(task.comments);
}

