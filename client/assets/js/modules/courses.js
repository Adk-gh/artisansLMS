$(document).ready(function() {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. GLOBAL EXPORTS (Fixes "is not defined" errors for HTML onclicks)
    // ═════════════════════════════════════════════════════════════════════════
    
    window.toggleView = function(viewType) {
        const isList = (viewType === 'list');
        
        // Show/Hide Main Views
        $('#gridView').css('display', isList ? 'none' : 'flex');
        $('#tableView').css('display', isList ? 'block' : 'none');
        
        // Update View Toggle Buttons
        $('#btnGrid').toggleClass('active', !isList);
        $('#btnList').toggleClass('active', isList);
        
        localStorage.setItem('courseViewPref', viewType);
        if (typeof window.applyCourseFilters === 'function') window.applyCourseFilters();
    };

    window.viewFile = function(path, name) {
        $('#viewFileName').text(name);
        $('#fileViewerFrame').attr('src', path);
        new bootstrap.Modal(document.getElementById('viewFileModal')).show();
    };

    window.archiveCourse = function(courseId) {
        if (!confirm('Archive this course? All related classes and materials will be archived.')) return;
        $.ajax({
            url: `${API_URL}?action=archive`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ course_id: courseId }),
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "archived");
                    fetchCourses();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    };

    window.deleteResource = function(resourceId, fileName, btn) {
        if (!confirm(`Permanently delete "${fileName}"?`)) return;
        const origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        $.ajax({
            url: `${API_URL}?action=delete_resource`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ resource_id: resourceId }),
            success: function(json) {
                if (json.status === 'success') {
                    $('.res-item-' + resourceId).fadeOut(300, function() { $(this).remove(); });
                    showToast("File deleted successfully.", "success");
                } else {
                    showToast(json.message, "error");
                    btn.innerHTML = origHtml;
                    btn.disabled = false;
                }
            }
        });
    };

    window.submitResourceUpload = function() {
        const fileInput = document.getElementById('res_file_input');
        const file = fileInput ? fileInput.files[0] : null;
        
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        $('#uploadProgressWrap').show();
        $('#uploadSubmitBtn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Uploading...');

        const fd = new FormData();
        fd.append('course_id', $('#res_course_id').val());
        fd.append('custom_name', $('#res_custom_name').val().trim());
        fd.append('file_desc', $('#res_file_desc').val().trim());
        fd.append('file_to_upload', file);

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                $('#uploadProgressBar').css('width', pct + '%');
                $('#uploadPct').text(pct + '%');
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const res = JSON.parse(xhr.responseText);
                if (res.status === 'success') {
                    showToast("File uploaded successfully!", "success");
                    bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
                    fetchCourses(); 
                } else {
                    showToast(res.message || "Upload failed.", "error");
                    $('#uploadSubmitBtn').prop('disabled', false).html('<i class="fas fa-upload me-2"></i> Push File');
                }
            } catch (err) {
                showToast("Server error during upload.", "error");
                $('#uploadSubmitBtn').prop('disabled', false).html('<i class="fas fa-upload me-2"></i> Push File');
            }
        });

        xhr.open('POST', `${API_URL}?action=upload_resource`);
        xhr.send(fd);
    };

    // ═════════════════════════════════════════════════════════════════════════
    // 2. CORE APPLICATION SETUP
    // ═════════════════════════════════════════════════════════════════════════

    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/courses.php';
    let addModalObj = null;
    let editModalObj = null;

    const addEl = document.getElementById('addCourseModal');
    if (addEl) addModalObj = new bootstrap.Modal(addEl);
    const editEl = document.getElementById('editCourseModal');
    if (editEl) editModalObj = new bootstrap.Modal(editEl);

    let savedView = localStorage.getItem('courseViewPref') || 'grid';

    // Initial Load
    fetchCourses();
    window.toggleView(savedView);

    // ── EVENT LISTENERS ──
    $('#courseSearch').on('input', filterCourses);
    $('#courseUnitsFilter').on('change', filterCourses);
    $('#courseMaterialFilter').on('change', filterCourses);
    $('#courseDeptFilter').on('change', filterCourses); // Replaced tab click with Dropdown Change

    $('#addCourseForm').on('submit', handleAddSubmit);
    $('#editCourseForm').on('submit', handleEditSubmit);

    // Delegate edit click
    $(document).on('click', '.edit-course-btn', function() {
        $('#edit_course_id').val($(this).data('id'));
        $('#edit_course_code').val($(this).data('code'));
        $('#edit_course_name').val($(this).data('name'));
        $('#edit_course_credits').val($(this).data('credits'));
        $('#edit_course_desc').val($(this).data('desc'));
        $('#edit_course_dept').val($(this).data('dept'));
        if (editModalObj) editModalObj.show();
    });

    $(document).on('click', '.upload-btn', function() {
        $('#res_course_id').val($(this).data('course-id'));
        $('#res_custom_name, #res_file_desc, #res_file_input').val('');
        $('#dropZoneLabel').text('Click to browse or drag & drop');
        $('#dropZoneFileName').text('');
        $('#dropZone').removeClass('has-file');
        $('#uploadProgressWrap').hide();
        $('#uploadProgressBar').css('width', '0%');
        $('#uploadPct').text('0%');
        $('#uploadSubmitBtn').prop('disabled', false).html('<i class="fas fa-upload me-2"></i> Push File');
        new bootstrap.Modal(document.getElementById('uploadModal')).show();
    });

    $('#viewFileModal').on('hidden.bs.modal', function() {
        $('#fileViewerFrame').attr('src', '');
    });

    // Drag and Drop Logic
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('res_file_input');

    if (dropZone && fileInput) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateDropZoneLabel(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', function() { 
            if (this.files.length) updateDropZoneLabel(this.files[0]); 
        });
    }

    function updateDropZoneLabel(file) {
        $('#dropZone').addClass('has-file');
        $('#dropZoneLabel').text('File selected:');
        $('#dropZoneFileName').text(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        if (!$('#res_custom_name').val().trim()) {
            $('#res_custom_name').val(file.name.replace(/\.[^/.]+$/, ''));
        }
    }


    // ── API AND DATA FUNCTIONS ──

    function fetchCourses() {
        $.ajax({
            url: `${API_URL}?action=get_all`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    populateFilters(json.units, json.departments);
                    renderCourses(json.data);
                } else {
                    showToast(json.message || "Failed to load courses.", "error");
                }
            }
        });
    }

    function handleAddSubmit(e) {
        e.preventDefault();
        const data = {
            code: $('#addCourseForm [name="code"]').val(),
            name: $('#addCourseForm [name="name"]').val(),
            credits: $('#addCourseForm [name="credits"]').val(),
            description: $('#addCourseForm [name="description"]').val(),
            department_id: $('#addCourseForm [name="department_id"]').val()
        };

        $.ajax({
            url: `${API_URL}?action=create`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    if (addModalObj) addModalObj.hide();
                    $('#addCourseForm')[0].reset();
                    fetchCourses();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    function handleEditSubmit(e) {
        e.preventDefault();
        const data = {
            course_id: $('#edit_course_id').val(),
            code: $('#edit_course_code').val(),
            name: $('#edit_course_name').val(),
            credits: $('#edit_course_credits').val(),
            description: $('#edit_course_desc').val(),
            department_id: $('#edit_course_dept').val()
        };

        $.ajax({
            url: `${API_URL}?action=update`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    if (editModalObj) editModalObj.hide();
                    fetchCourses();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }


    // ── UI RENDERING & FILTERING ──

    function populateFilters(units, departments) {
        let uHtml = '<option value="">All Units</option>';
        (units || []).forEach(u => uHtml += `<option value="${u}">${u} Units</option>`);
        $('#courseUnitsFilter').html(uHtml);

        let dHtml = '<option value="">-- No Department --</option>';
        let filterHtml = '<option value="">All Departments</option>'; // For search bar dropdown
        
        (departments || []).forEach(d => {
            dHtml += `<option value="${d.department_id}">${d.name}</option>`;
            filterHtml += `<option value="${d.department_id}">${d.name}</option>`;
        });
        
        $('#add_course_dept, #edit_course_dept').html(dHtml);
        
        // Preserve selected filter value if regenerating list
        const currentSelection = $('#courseDeptFilter').val();
        $('#courseDeptFilter').html(filterHtml);
        if (currentSelection) $('#courseDeptFilter').val(currentSelection);
    }

    function renderCourses(data) {
        const $grid = $('#gridView');
        const $list = $('#courseTableBody');
        $grid.empty(); 
        $list.empty();

        data.forEach(c => {
            const items = c.resources || c.materials || [];
            const hasMats = items.length > 0 ? 'has' : 'none';
            
            const safeName = (c.name || '').replace(/'/g, "&apos;");
            const safeCode = (c.course_code || '').replace(/'/g, "&apos;");
            const safeDesc = (c.description || '').replace(/'/g, "&apos;");
            const deptId = (c.department_id || '').toString();
            const deptName = c.dept_name || '';

            let matHtmlList = '';
            if (items.length > 0) {
                items.forEach(f => {
                    matHtmlList += `
                    <div class="resource-item res-item-${f.resource_id} d-flex justify-content-between align-items-center py-1">
                        <span onclick="viewFile('${f.file_path}', '${f.file_name.replace(/'/g, "\\'")}')" class="file-link flex-grow-1 pe-2" style="font-size:.75rem;">
                            <i class="fas fa-file-alt me-1 text-danger"></i>${f.file_name}
                        </span>
                        <button class="btn btn-link text-danger p-0 ms-2" onclick="deleteResource(${f.resource_id}, '${f.file_name.replace(/'/g, "\\'")}', this)"><i class="fas fa-times-circle"></i></button>
                    </div>`;
                });
            } else {
                matHtmlList = `<div class="text-muted small fst-italic py-1">No materials yet.</div>`;
            }

            const deptBadge = deptName ? `<span class="badge bg-secondary-subtle text-secondary rounded-pill px-2 mb-2" style="font-size:.65rem;"><i class="fas fa-building me-1"></i>${deptName}</span>` : '';

            // Attributes needed for Multi-Search (Includes department name)
            const attrString = `
                data-name="${c.name.toLowerCase()}" 
                data-code="${c.course_code.toLowerCase()}"
                data-deptname="${deptName.toLowerCase()}"
                data-units="${c.credits}" 
                data-materials="${hasMats}" 
                data-dept="${deptId}"
            `;

            // Grid Template
            $grid.append(`
            <div class="col-md-6 col-xl-4 course-card-container" ${attrString}>
                <div class="stat-card border-top border-info border-4 shadow-sm h-100 d-flex flex-column bg-white rounded-3 p-4">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge bg-info-subtle text-info rounded-pill px-3">${c.course_code}</span>
                        <small class="fw-bold text-muted">${c.credits} Units</small>
                    </div>
                    ${deptBadge}
                    <h5 class="fw-bold text-dark mt-1">${c.name}</h5>
                    <p class="text-muted small mb-3" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${c.description || ''}</p>
                    <div class="bg-light p-3 rounded-3 mb-4 flex-grow-1">
                        <div class="list-group list-group-flush">${matHtmlList}</div>
                    </div>
                    <div class="mt-auto pt-3 border-top d-flex align-items-center justify-content-between gap-2">
                        <button class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold upload-btn" data-course-id="${c.course_id}" data-course-name="${safeName}">Upload</button>
                        <div class="d-flex gap-2">
                            <button class="btn-edit-course edit-course-btn" data-id="${c.course_id}" data-code="${safeCode}" data-name="${safeName}" data-credits="${c.credits}" data-desc="${safeDesc}" data-dept="${deptId}"><i class="fas fa-edit"></i></button>
                            <button class="btn-archive-course" onclick="archiveCourse(${c.course_id})"><i class="fas fa-archive"></i></button>
                        </div>
                    </div>
                </div>
            </div>`);

            // List Template
            $list.append(`
            <tr class="course-table-row" ${attrString}>
                <td class="ps-4">
                    <span class="badge bg-info-subtle text-info rounded-pill px-2 mb-1">${c.course_code}</span>
                    <div class="fw-bold text-dark mt-1">${c.name}</div>
                    ${deptName ? `<span class="badge bg-secondary-subtle text-secondary mt-1" style="font-size:.65rem;">${deptName}</span>` : ''}
                </td>
                <td><p class="text-muted mb-0 small" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${c.description || 'No description.'}</p></td>
                <td><div class="bg-light p-2 rounded-3 border">${matHtmlList}</div></td>
                <td class="text-end pe-4 align-middle">
                    <div class="d-flex flex-column gap-2 align-items-end">
                        <button class="btn-edit-course edit-course-btn" data-id="${c.course_id}" data-code="${safeCode}" data-name="${safeName}" data-credits="${c.credits}" data-desc="${safeDesc}" data-dept="${deptId}"><i class="fas fa-edit me-1"></i> Edit</button>
                        <button type="button" class="btn-archive-course" onclick="archiveCourse(${c.course_id})"><i class="fas fa-archive me-1"></i> Archive</button>
                    </div>
                </td>
            </tr>`);
        });
        
        filterCourses();
    }

    function filterCourses() {
        const q = $('#courseSearch').val().toLowerCase().trim();
        const unit = $('#courseUnitsFilter').val() ? $('#courseUnitsFilter').val().toString() : '';
        const mat = $('#courseMaterialFilter').val();
        
        // Grab from dropdown instead of activeDept variable
        const activeDept = $('#courseDeptFilter').val() ? $('#courseDeptFilter').val().toString() : ''; 
        
        let visibleCount = 0;

        $('.course-card-container, .course-table-row').each(function() {
            const $el = $(this);
            
            // Search Data
            const nameAttr = $el.attr('data-name') || '';
            const codeAttr = $el.attr('data-code') || '';
            const deptNameAttr = $el.attr('data-deptname') || '';
            
            // Filter Data
            const unitAttr = ($el.attr('data-units') || '').toString();
            const matAttr = $el.attr('data-materials') || '';
            const deptAttr = ($el.attr('data-dept') || '').toString();

            // Matches Query against Name, Code, OR Department Name
            const matchesSearch = !q || nameAttr.includes(q) || codeAttr.includes(q) || deptNameAttr.includes(q);
            
            // Matches Filters
            const matchesUnit = !unit || unitAttr === unit;
            const matchesMat = !mat || matAttr === mat;
            const matchesDept = !activeDept || deptAttr === activeDept;

            const isVisible = matchesSearch && matchesUnit && matchesMat && matchesDept;
            $el.toggleClass('hidden', !isVisible);

            // Increment count only for cards to avoid double counting
            if (isVisible && $el.hasClass('course-card-container')) {
                visibleCount++;
            }
        });

        $('#courseCountNum').text(visibleCount);

        const currentView = localStorage.getItem('courseViewPref') || 'grid';
        $('#noResultsGrid').toggleClass('show', visibleCount === 0 && currentView === 'grid');
        $('#noResultsList').toggleClass('show', visibleCount === 0 && currentView === 'list');
    }

    // Expose internal filter logic to the global toggleView function
    window.applyCourseFilters = filterCourses;

    function showToast(msg, type) {
        $('#toast').remove();
        let bgClass = "background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;";
        let iconClass = "fa-check-circle";

        if (type === "error") {
            bgClass = "background:#fee2e2; color:#be123c; border:1px solid #fecdd3;";
            iconClass = "fa-exclamation-triangle";
        } else if (type === "archived") {
            bgClass = "background:#fff7ed; color:#c2410c; border:1px solid #fed7aa;";
            iconClass = "fa-archive";
        }

        $('body').append(`<div id="toast" class="toast-bar" style="${bgClass}; z-index: 9999;"><i class="fas ${iconClass} me-2"></i> ${msg}</div>`);
        setTimeout(() => $('#toast').fadeOut(() => $('#toast').remove()), 3500);
    }
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. HEADER LOGIC
// ═════════════════════════════════════════════════════════════════════════════
const AUTH_API = '/artisansLMS/backend/index.php';

function initHeader() {
    const PAGE_TITLES = {
        'dashboard.html':              { title: 'Dashboard',              subtitle: 'Overview of your academic progress.' },
        'courses.html':                { title: 'Course Management',      subtitle: 'Create, edit, and organize system courses and materials.' },
        'students.html':               { title: 'Manage Students',        subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html':            { title: 'Master Instructors',     subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'enrollment.html':             { title: 'Student Enrollment',     subtitle: 'Manage and track student class enrollments.' },
        'classes.html':                { title: 'Class Management',       subtitle: 'Create and manage class sections by course.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' }
    };

    const currentPage = window.location.pathname.split('/').pop() || 'courses.html';
    const page = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };

    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: AUTH_API,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function(res) {
            if (res.status === 'success' && res.logged_in) {
                const u = res.user;
                const avt = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=475569`;

                $('#headerUserName, #dropdownUserName').text(u.name);
                $('#headerUserRole, #dropdownUserRole').text(u.role || 'Admin');
                $('#headerAvatar, #dropdownAvatar').attr('src', avt);
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
            } else {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function() {
            window.location.href = '/artisansLMS/client/pages/login.html';
        }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: AUTH_API, 
            method: 'POST', 
            contentType: 'application/json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { 
                window.location.href = '/artisansLMS/client/pages/login.html'; 
            }
        });
    });
}