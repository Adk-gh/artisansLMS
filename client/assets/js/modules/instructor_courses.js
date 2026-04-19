const API_COURSES = '../../backend/endpoints/instructor_courses.php';
const API         = '/artisansLMS/backend/index.php';

$(document).ready(function() {
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    loadCourses();
    initDropZone();
});

// ─── Header ───────────────────────────────────────────────────────────────────
function initHeader() {
    const PAGE_TITLES = {
        'dashboard.html':              { title: 'Dashboard',              subtitle: 'Overview of your academic progress and activities.' },
        'collaborations.html':         { title: 'Collaboration Spaces',   subtitle: 'Select a class to enter the live chat and video space.' },
        'messages.html':               { title: 'Direct Messages',        subtitle: 'Communicate privately with instructors and peers.' },
        'my_grades.html':              { title: 'My Grades',              subtitle: 'Track your academic performance and feedback.' },
        'my_analytics.html':           { title: 'Achievement Board',      subtitle: 'View your milestones, badges, and learning statistics.' },
        'instructor_dashboard.html':   { title: 'Instructor Dashboard',   subtitle: 'Manage your assigned courses and student spaces.' },
        'courses.html':                { title: 'Course Materials',       subtitle: 'Upload and organize files, lectures, and resources.' },
        'instructor_assignments.html': { title: 'Task Manager',           subtitle: 'Create and manage assignments for your assigned classes.' },
        'students.html':               { title: 'Manage Students',        subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html':            { title: 'Master Instructors',     subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
        'assignments.html':            { title: 'Assignments',            subtitle: 'View and submit your class assignments.' },
        'grades.html':                 { title: 'Grades',                 subtitle: 'View your academic performance and feedback.' },
        'quizzes.html':                { title: 'Quizzes',                subtitle: 'Take and review your quizzes.' },
        'modules.html':                { title: 'Course Materials',       subtitle: 'Browse uploaded files, lectures, and resources.' },
        'todo.html':                   { title: 'Task Manager',           subtitle: 'Manage your personal tasks and to-dos.' },
    };

    const currentPage = window.location.pathname.split('/').pop() || 'courses.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: API,
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function(res) {
            if (res.status === 'success' && res.logged_in) {
                const u     = res.user;
                const smAvt = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=475569`;
                const lgAvt = smAvt + '&size=128';
                $('#headerUserName').text(u.name);
                $('#headerUserRole').text(u.role || 'Student');
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'Student');
                $('#dropdownAvatar').attr({ src: lgAvt, alt: u.name });
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
            } else {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
        });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// LOAD & RENDER COURSES
// ════════════════════════════════════════════════════════════════════════════

async function loadCourses() {
    try {
        const res  = await fetch(`${API_COURSES}?action=get_courses`);
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);
        renderCourseGrid(json.data);
    } catch (err) {
        document.getElementById('courseGrid').innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-exclamation-circle fa-3x text-danger mb-3 opacity-50"></i>
                <h5 class="text-muted fw-bold">Failed to load courses</h5>
                <p class="text-muted small">${err.message}</p>
            </div>`;
    }
}

function renderCourseGrid(courses) {
    const grid = document.getElementById('courseGrid');

    if (!courses || courses.length === 0) {
        grid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-folder-open fa-4x text-muted mb-3 opacity-25"></i>
                <h5 class="text-muted fw-bold">No Courses Handled</h5>
                <p class="text-muted small">You are not currently assigned to any courses as an instructor.</p>
            </div>`;
        return;
    }

    grid.innerHTML = courses.map(course => buildCourseCard(course)).join('');
}

function buildCourseCard(course) {
    const cid         = course.course_id;
    const chatClassId = course.class_id_for_chat ?? 0;
    const resources   = course.resources ?? [];

    const resourcesHtml = resources.length
        ? resources.map(f => buildResourceItem(f)).join('')
        : `<small class="text-muted fst-italic no-materials-msg d-block py-2">No resources found.</small>`;

    return `
    <div class="col-md-6 col-xl-4 course-card-container" data-course-title="${escHtml(course.name)}">
        <div class="card border-0 shadow-sm rounded-4 h-100" style="border-top: 4px solid #0ea5e9 !important; transition: transform 0.2s ease;">
            <div class="card-body p-4 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <span class="badge bg-info bg-opacity-10 text-info rounded-pill px-3 py-2 fw-bold">
                        ${escHtml(course.course_code)}
                    </span>
                    <small class="fw-bold text-dark">${escHtml(String(course.credits))} Units</small>
                </div>
                
                <h5 class="fw-bold text-dark mb-1 course-title">${escHtml(course.name)}</h5>
                <p class="text-muted small mb-4">${escHtml(course.description || 'No description available.')}</p>

                <div class="bg-light p-3 rounded-3 mb-4 flex-grow-1 border border-light">
                    <h6 class="small fw-bold text-uppercase text-muted mb-3" style="font-size:.65rem;letter-spacing:.5px;">Active Materials</h6>
                    <div class="list-group list-group-flush bg-transparent" id="resource-list-${cid}">
                        ${resourcesHtml}
                    </div>
                </div>

                <div class="mt-auto d-flex align-items-center justify-content-between pt-2">
                    <button class="btn btn-outline-primary btn-sm rounded-pill px-4 fw-bold shadow-sm" onclick="openUploadModal('${cid}')">
                        <i class="fas fa-plus me-1"></i> Upload
                    </button>
                    <a href="../pages/interactions.html?class_id=${chatClassId}" class="btn btn-link btn-sm text-info text-decoration-none p-0 fw-bold">
                        Open Chat
                    </a>
                </div>
            </div>
        </div>
    </div>`;
}

function buildResourceItem(file) {
    const rid  = file.resource_id;
    const name = escHtml(file.file_name);
    const path = escHtml(file.file_path);
    
    return `
    <div class="resource-item d-flex justify-content-between align-items-center py-2 border-bottom" id="resource-${rid}" style="border-color: #f1f5f9 !important;">
        <span onclick="viewFile('${path}', '${escAttr(file.file_name)}')" 
              class="file-link flex-grow-1 text-truncate pe-2 fw-medium text-dark" 
              style="cursor: pointer; font-size: 0.85rem; text-decoration: none;">
            <i class="fas fa-file-pdf me-2 text-danger"></i>${name}
        </span>
        <div class="dropdown">
            <a class="text-muted px-2" href="#" role="button" data-bs-toggle="dropdown" style="cursor: pointer; text-decoration: none;">
                <i class="fas fa-ellipsis-v"></i>
            </a>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3">
                <li>
                    <button class="dropdown-item small py-2" onclick="openEditModal(${rid}, this)" 
                            data-name="${escAttr(file.file_name)}" data-desc="${escAttr(file.description ?? '')}">
                        <i class="fas fa-edit me-2 text-info"></i> Edit
                    </button>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                    <button class="dropdown-item small py-2 text-danger" onclick="deleteResource(${rid}, '${escAttr(file.file_name)}', this)">
                        <i class="fas fa-trash-alt me-2"></i> Delete
                    </button>
                </li>
            </ul>
        </div>
    </div>`;
}

window.filterCourses = function() {
    const q = document.getElementById('courseSearch').value.toLowerCase();
    document.querySelectorAll('.course-card-container').forEach(card => {
        const title = card.dataset.courseTitle?.toLowerCase() ?? '';
        card.style.display = title.includes(q) ? '' : 'none';
    });
};

window.viewFile = function(path, name) {
    document.getElementById('viewFileName').innerText = name;
    document.getElementById('fileViewerFrame').src    = path;
    new bootstrap.Modal(document.getElementById('viewFileModal')).show();
};

document.getElementById('viewFileModal')?.addEventListener('hidden.bs.modal', () => {
    document.getElementById('fileViewerFrame').src = '';
});

window.openEditModal = function(id, btn) {
    document.getElementById('edit_res_id').value   = id;
    document.getElementById('edit_res_name').value = btn.dataset.name;
    document.getElementById('edit_res_desc').value = btn.dataset.desc;
    new bootstrap.Modal(document.getElementById('editModal')).show();
};

window.submitEditResource = async function() {
    const id   = document.getElementById('edit_res_id').value;
    const name = document.getElementById('edit_res_name').value.trim();
    const desc = document.getElementById('edit_res_desc').value.trim();

    if (!name) { alert('Title is required.'); return; }

    const fd = new FormData();
    fd.append('action',      'edit_resource');
    fd.append('resource_id', id);
    fd.append('custom_name', name);
    fd.append('file_desc',   desc);

    try {
        const res  = await fetch(API_COURSES, { method: 'POST', body: fd });
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);

        const row = document.getElementById(`resource-${id}`);
        if (row) {
            const link = row.querySelector('.file-link');
            if (link) link.childNodes[1].textContent = name;
            const editBtn = row.querySelector('[data-name]');
            if (editBtn) { editBtn.dataset.name = name; editBtn.dataset.desc = desc; }
        }

        bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
        showAlert('Resource updated successfully.');
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.openUploadModal = function(courseId) {
    document.getElementById('res_course_id').value          = courseId;
    document.getElementById('res_custom_name').value        = '';
    document.getElementById('res_file_desc').value          = '';
    document.getElementById('res_file_input').value         = '';
    document.getElementById('dropZoneLabel').textContent    = 'Click to browse or drag & drop';
    document.getElementById('dropZoneFileName').textContent = '';
    document.getElementById('dropZone').classList.remove('has-file');
    document.getElementById('uploadProgressWrap').style.display = 'none';
    resetProgressBar();
    document.getElementById('uploadSubmitBtn').disabled  = false;
    document.getElementById('uploadSubmitBtn').innerHTML = '<i class="fas fa-upload me-2"></i> Upload to Course';
    new bootstrap.Modal(document.getElementById('uploadModal')).show();
};

window.submitResourceUpload = function() {
    const file     = document.getElementById('res_file_input').files[0];
    const courseId = document.getElementById('res_course_id').value;

    if (!file)     { alert('Please select a file to upload.'); return; }
    if (!courseId) { alert('Course ID missing.'); return; }

    const progressWrap = document.getElementById('uploadProgressWrap');
    const bar          = document.getElementById('uploadProgressBar');
    const pctLabel     = document.getElementById('uploadPct');
    const statusText   = document.getElementById('uploadStatusText');
    const btn          = document.getElementById('uploadSubmitBtn');

    progressWrap.style.display = 'block';
    btn.disabled               = true;
    btn.innerHTML              = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

    const fd = new FormData();
    fd.append('action',         'upload_resource');
    fd.append('course_id',      courseId);
    fd.append('custom_name',    document.getElementById('res_custom_name').value.trim());
    fd.append('file_desc',      document.getElementById('res_file_desc').value.trim());
    fd.append('file_to_upload', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            bar.style.width      = pct + '%';
            pctLabel.textContent = pct + '%';
            if (pct === 100) statusText.textContent = 'Processing...';
        }
    });

    xhr.addEventListener('load', () => {
        try {
            const res = JSON.parse(xhr.responseText);
            if (res.status !== 'success') throw new Error(res.message || 'Upload failed.');

            statusText.textContent = '✅ Uploaded successfully!';
            bar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            bar.classList.add('bg-success');
            bar.style.width      = '100%';
            pctLabel.textContent = '100%';
            btn.innerHTML        = '<i class="fas fa-check me-2"></i> Done';

            const listEl = document.getElementById(`resource-list-${courseId}`);
            if (listEl) {
                listEl.querySelector('.no-materials-msg')?.remove();
                listEl.insertAdjacentHTML('beforeend', buildResourceItem({
                    resource_id: res.resource_id,
                    file_name:   res.file_name,
                    file_path:   res.file_path,
                    description: '',
                }));
            }

            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
                showAlert('File uploaded successfully.');
            }, 900);

        } catch (err) {
            statusText.textContent = '❌ ' + err.message;
            bar.classList.replace('bg-primary', 'bg-danger');
            bar.classList.remove('progress-bar-striped', 'progress-bar-animated');
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-upload me-2"></i> Upload to Course';
        }
    });

    xhr.addEventListener('error', () => {
        statusText.textContent = '❌ Network error. Please try again.';
        bar.classList.replace('bg-primary', 'bg-danger');
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-upload me-2"></i> Upload to Course';
    });

    xhr.open('POST', API_COURSES);
    xhr.send(fd);
};

window.deleteResource = function(resourceId, fileName, btn) {
    if (!confirm(`Permanently delete "${fileName}"?\nThis will also remove the file from the server.`)) return;

    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Deleting...';

    const fd = new FormData();
    fd.append('action',      'delete_resource');
    fd.append('resource_id', resourceId);

    fetch(API_COURSES, { method: 'POST', body: fd })
        .then(r => r.json())
        .then(res => {
            if (res.status === 'success') {
                const row = document.getElementById(`resource-${resourceId}`);
                if (row) {
                    row.style.transition = 'opacity 0.3s';
                    row.style.opacity    = '0';
                    setTimeout(() => row.remove(), 320);
                }
                showAlert(`"${fileName}" deleted.`);
            } else {
                alert('Error: ' + res.message);
                btn.disabled  = false;
                btn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Delete';
            }
        })
        .catch(() => {
            alert('Network error. Please try again.');
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Delete';
        });
};

function initDropZone() {
    const dropZone  = document.getElementById('dropZone');
    const fileInput = document.getElementById('res_file_input');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateDropZoneLabel(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', function () {
        if (this.files.length) updateDropZoneLabel(this.files[0]);
    });
}

function updateDropZoneLabel(file) {
    document.getElementById('dropZone').classList.add('has-file');
    document.getElementById('dropZoneLabel').textContent    = 'File selected:';
    document.getElementById('dropZoneFileName').textContent =
        `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const nameInput = document.getElementById('res_custom_name');
    if (!nameInput.value.trim()) {
        nameInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
}

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escAttr(str) {
    return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showAlert(msg) {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    $(container).html(`
        <div class="alert alert-success alert-dismissible fade show rounded-4 shadow-sm fw-bold mb-4" role="alert">
            <i class="fas fa-check-circle me-2"></i> ${escHtml(msg)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    setTimeout(() => { $(container).find('.alert').fadeOut(300, function() { $(this).remove(); }); }, 4000);
}

function resetProgressBar() {
    const bar = document.getElementById('uploadProgressBar');
    bar.style.width     = '0%';
    bar.className       = 'progress-bar bg-primary progress-bar-striped progress-bar-animated';
    document.getElementById('uploadPct').textContent        = '0%';
    document.getElementById('uploadStatusText').textContent = 'Uploading...';
}