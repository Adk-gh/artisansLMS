// client/assets/js/modules/instructor_courses.js

// ── FIREBASE SETUP ────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQfwNYptf-gWqIQVs0welvz86DwqPI6VQ",
    authDomain: "artisans-lms.firebaseapp.com",
    projectId: "artisans-lms",
    storageBucket: "artisans-lms.firebasestorage.app",
    messagingSenderId: "897938751816",
    appId: "1:897938751816:web:9cbdeb9ae93020dfff737d",
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// ── API Constants ─────────────────────────────────────────────────────────────
const API_COURSES = 'https://artisanslms.onrender.com/backend/endpoints/instructor_courses.php';
const API = 'https://artisanslms.onrender.com/backend/index.php';

$(document).ready(function() {
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error' && typeof initHeader === 'function') {
            initHeader();
        }
    });

    loadCourses();
    initDropZone();
});

// ─── Header & Session ─────────────────────────────────────────────────────────
function initHeader() {
    const PAGE_TITLES = {
        'dashboard.html':              { title: 'Dashboard',              subtitle: 'Overview of your academic progress and activities.' },
        'collaborations.html':         { title: 'Collaboration Spaces',   subtitle: 'Select a class to enter the live chat and video space.' },
        'instructor_courses.html':     { title: 'My Courses',             subtitle: 'Manage your course materials, assignments, and students.' },
        'courses.html':                { title: 'Course Materials',       subtitle: 'Upload and organize files, lectures, and resources.' }
    };

    const currentPage = window.location.pathname.split('/').pop() || 'instructor_courses.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: API,
        method: 'POST',
        xhrFields: { withCredentials: true },
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function(res) {
            if (res.status === 'success' && res.logged_in) {
                const u     = res.user;
                const smAvt = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=475569`;
                $('#headerUserName').text(u.name);
                $('#headerUserRole').text(u.role || 'Instructor');
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
            } else {
                window.location.href = '/client/pages/login.html';
            }
        },
        error: function() { window.location.href = '/client/pages/login.html'; }
    });
}

// ── PATH HELPER ───────────────────────────────────────────────────────────────
function resolveFilePath(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/artisansLMS/client/assets/')) return path;

    const clean = path.replace(/^\/+/, '');
    if (clean.startsWith('assets/')) return '/artisansLMS/client/' + clean;
    if (clean.startsWith('uploads/')) return '/artisansLMS/client/assets/' + clean;
    return '/artisansLMS/client/assets/uploads/resources/' + clean.replace(/^resources\//, '');
}

// ── RENDER DATA ───────────────────────────────────────────────────────────────
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
                <p class="text-muted small">You are not assigned to any courses as an instructor.</p>
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
    <div class="col-md-6 col-xl-4 course-card-container hover-lift" data-course-title="${escHtml(course.name)}">
        <div class="card border-0 shadow-sm rounded-4 h-100" style="border-top: 4px solid #0ea5e9 !important; transition: transform 0.2s ease;">
            <div class="card-body p-4 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <span class="badge bg-info bg-opacity-10 text-info rounded-pill px-3 py-2 fw-bold">${escHtml(course.course_code)}</span>
                    <small class="fw-bold text-dark">${escHtml(String(course.credits))} Units</small>
                </div>
                <h5 class="fw-bold text-dark mb-1 course-title">${escHtml(course.name)}</h5>
                <p class="text-muted small mb-4">${escHtml(course.description || 'No description available.')}</p>
                <div class="bg-light p-3 rounded-3 mb-4 flex-grow-1 border border-light">
                    <h6 class="small fw-bold text-uppercase text-muted mb-3" style="font-size:.65rem;letter-spacing:.5px;">Active Materials</h6>
                    <div class="resource-list-wrapper">
                        <div class="list-group list-group-flush bg-transparent" id="resource-list-${cid}">${resourcesHtml}</div>
                    </div>
                </div>
                <div class="mt-auto d-flex align-items-center justify-content-between pt-2">
                    <button class="btn btn-outline-primary btn-sm rounded-pill px-4 fw-bold shadow-sm" onclick="openUploadModal('${cid}')">
                        <i class="fas fa-plus me-1"></i> Upload
                    </button>
                    <a href="../pages/collaborations.html?class_id=${chatClassId}" class="btn btn-link btn-sm text-info text-decoration-none p-0 fw-bold">Open Chat</a>
                </div>
            </div>
        </div>
    </div>`;
}

function getFileIcon(ext) {
    const map = {
        pdf: 'fa-file-pdf text-danger', doc: 'fa-file-word text-primary', docx: 'fa-file-word text-primary',
        ppt: 'fa-file-powerpoint text-warning', pptx: 'fa-file-powerpoint text-warning', xls: 'fa-file-excel text-success',
        xlsx: 'fa-file-excel text-success', mp4: 'fa-file-video text-danger', png: 'fa-file-image text-secondary',
        jpg: 'fa-file-image text-secondary', jpeg: 'fa-file-image text-secondary', zip: 'fa-file-archive text-warning'
    };
    return map[ext] || 'fa-file text-secondary';
}

function buildResourceItem(file) {
    const rid  = file.resource_id;
    const name = escHtml(file.file_name);
    const ext  = file.file_name.split('.').pop().toLowerCase();
    const icon = getFileIcon(ext);
    const path = escAttr(resolveFilePath(file.file_path));

    return `
    <div class="resource-item d-flex justify-content-between align-items-center py-2 border-bottom" id="resource-${rid}" style="border-color: #f1f5f9 !important; overflow: visible !important;">
        <span onclick="viewFile('${path}', '${escAttr(file.file_name)}')"
              class="file-link flex-grow-1 text-truncate pe-2 fw-medium text-dark" style="cursor: pointer; font-size: 0.85rem; text-decoration: none;">
            <i class="fas ${icon} me-2"></i>${name}
        </span>

        <div class="dropdown" style="position: static;">
            <a class="text-muted px-2" href="#" role="button" data-bs-toggle="dropdown" data-bs-boundary="window">
                <i class="fas fa-ellipsis-v"></i>
            </a>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3" style="z-index: 9999 !important;">
                <li>
                    <button class="dropdown-item small py-2" onclick="openEditModal(${rid}, this)" data-name="${escAttr(file.file_name)}" data-desc="${escAttr(file.description ?? '')}">
                        <i class="fas fa-edit me-2 text-info"></i> Edit
                    </button>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                    <button class="dropdown-item small py-2 text-danger" onclick="openDeleteModal(${rid}, '${escAttr(file.file_name)}')">
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
    const fullPath  = resolveFilePath(path);
    const ext       = name.split('.').pop().toLowerCase();
    const container = document.getElementById('fileViewerContainer');

    if (ext === 'pdf') {
        container.innerHTML = `<iframe src="${fullPath}" style="width:100%;height:75vh;min-height:500px;border:none;" title="${escHtml(name)}"></iframe>`;
    } else if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) {
        container.innerHTML = `<div class="d-flex align-items-center justify-content-center" style="min-height:500px;background:#0f172a;"><img src="${fullPath}" alt="${escHtml(name)}" style="max-width:100%;max-height:75vh;object-fit:contain;border-radius:8px;"></div>`;
    } else if (['mp4','webm','ogg'].includes(ext)) {
        container.innerHTML = `<video controls style="width:100%;height:75vh;min-height:500px;background:#000;display:block;"><source src="${fullPath}" type="video/${ext}"></video>`;
    } else {
        container.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center text-center" style="min-height:500px;background:#f8fafc;">
                <i class="fas fa-file-alt fa-5x text-primary mb-4 opacity-50"></i>
                <h5 class="fw-bold text-dark mb-1">${escHtml(name)}</h5>
                <p class="text-muted small mb-4">This file type cannot be previewed.<br>Download it to open natively.</p>
                <a href="${fullPath}" download="${escHtml(name)}" target="_blank" class="btn btn-primary rounded-pill px-5 fw-bold shadow-sm"><i class="fas fa-download me-2"></i> Download File</a>
            </div>`;
    }

    document.getElementById('viewFileName').innerText = name;
    new bootstrap.Modal(document.getElementById('viewFileModal')).show();
};

document.getElementById('viewFileModal')?.addEventListener('hidden.bs.modal', () => {
    document.getElementById('fileViewerContainer').innerHTML = '';
});

// ── MODALS & BASIC CRUD ───────────────────────────────────────────────────────
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
            if (link) {
                const textNode = [...link.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
                if (textNode) textNode.textContent = name;
            }
            const editBtn = row.querySelector('[data-name]');
            if (editBtn) { editBtn.dataset.name = name; editBtn.dataset.desc = desc; }
        }
        bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
        showAlert('Resource updated successfully.');
    } catch (err) { alert('Error: ' + err.message); }
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

// ── DELETE MODAL ──────────────────────────────────────────────────────────────
window.openDeleteModal = function(resourceId, fileName) {
    document.getElementById('deleteFileName').textContent = `"${fileName}"`;

    const modal      = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    const confirmBtn = document.getElementById('deleteConfirmBtn');

    // Clone to remove any previously attached listeners
    const freshBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(freshBtn, confirmBtn);

    freshBtn.addEventListener('click', async function() {
        freshBtn.disabled  = true;
        freshBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Deleting...';

        try {
            const fd = new FormData();
            fd.append('action',      'delete_resource');
            fd.append('resource_id', resourceId);

            const response = await fetch(API_COURSES, { method: 'POST', body: fd });
            const res      = await response.json();

            if (res.status === 'success') {
                if (res.file_path && res.file_path.includes('firebasestorage')) {
                    try {
                        const fileRef = ref(storage, res.file_path);
                        await deleteObject(fileRef);
                    } catch (fbErr) {
                        console.warn('Deleted from DB, but failed to delete from Firebase Storage:', fbErr);
                    }
                }

                modal.hide();

                const row = document.getElementById(`resource-${resourceId}`);
                if (row) {
                    row.style.transition = 'opacity 0.3s';
                    row.style.opacity    = '0';
                    setTimeout(() => row.remove(), 320);
                }

                showAlert(`"${fileName}" deleted.`);
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            modal.hide();
            showAlert(`Error: ${err.message}`);
            freshBtn.disabled  = false;
            freshBtn.innerHTML = '<i class="fas fa-trash-alt me-2"></i> Delete';
        }
    });

    modal.show();
};

// ── FIREBASE UPLOAD ───────────────────────────────────────────────────────────
window.submitResourceUpload = function() {
    const file     = document.getElementById('res_file_input').files[0];
    const courseId = document.getElementById('res_course_id').value;
    const custName = document.getElementById('res_custom_name').value.trim() || file?.name;
    const desc     = document.getElementById('res_file_desc').value.trim();

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

    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const storageRef   = ref(storage, `course_resources/${safeFileName}`);
    const uploadTask   = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            bar.style.width      = pct + '%';
            pctLabel.textContent = pct + '%';
            if (pct === 100) statusText.textContent = 'Saving to database...';
        },
        (error) => {
            statusText.textContent = '❌ Upload failed: ' + error.message;
            bar.classList.replace('bg-primary', 'bg-danger');
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-upload me-2"></i> Try Again';
        },
        async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                const fd = new FormData();
                fd.append('action',      'upload_resource');
                fd.append('course_id',   courseId);
                fd.append('custom_name', custName);
                fd.append('file_desc',   desc);
                fd.append('file_url',    downloadURL);

                const response = await fetch(API_COURSES, { method: 'POST', body: fd });
                const res      = await response.json();

                if (res.status !== 'success') throw new Error(res.message || 'Database save failed.');

                statusText.textContent = '✅ Saved successfully!';
                bar.classList.remove('progress-bar-striped', 'progress-bar-animated');
                bar.classList.add('bg-success');

                const listEl = document.getElementById(`resource-list-${courseId}`);
                if (listEl) {
                    listEl.querySelector('.no-materials-msg')?.remove();
                    listEl.insertAdjacentHTML('beforeend', buildResourceItem({
                        resource_id: res.resource_id,
                        file_name:   res.file_name,
                        file_path:   res.file_path,
                        description: desc
                    }));
                }

                setTimeout(() => {
                    bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
                    showAlert('File uploaded successfully.');
                }, 900);

            } catch (err) {
                statusText.textContent = '❌ ' + err.message;
                bar.classList.replace('bg-primary', 'bg-danger');
                btn.disabled  = false;
                btn.innerHTML = '<i class="fas fa-upload me-2"></i> Upload to Course';
            }
        }
    );
};

// ── UTILITIES ─────────────────────────────────────────────────────────────────
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
    document.getElementById('dropZoneFileName').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const nameInput = document.getElementById('res_custom_name');
    if (!nameInput.value.trim()) {
        nameInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
}

function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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