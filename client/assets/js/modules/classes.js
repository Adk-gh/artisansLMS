// classes.js

// ─── Avatar Colors (matches students.js) ─────────────────────────────────────
const AVATAR_COLORS = [
    '#0ea5e9','#22c55e','#f59e0b','#f43f5e',
    '#8b5cf6','#06b6d4','#ec4899','#14b8a6',
    '#f97316','#6366f1'
];

// Derive a stable color index from a string (instructor name / id)
function avatarColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Pagination State ─────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
let currentPage = 1;
let allSectionsCache = []; // holds the full flat list after renderTable builds it

function filterClasses() {
    const q    = $('#classSearch').val().toLowerCase().trim();
    const dept = $('#classDeptFilter').val();
    const term = $('#classTermFilter').val().toLowerCase();
    const cap  = $('#classCapFilter').val();

    // Apply filter flags to every row-wrap
    let filtered = [];
    $('.class-row-wrap').each(function() {
        const $row    = $(this);
        const name    = ($row.attr('data-name')  || '').toLowerCase();
        const rowTerm = ($row.attr('data-term')  || '').toLowerCase();
        const rowDept = $row.attr('data-dept')   || '';
        const isOpen  = $row.attr('data-open')  === '1';
        const isFull  = $row.attr('data-full')  === '1';

        const nameOk = !q    || name.includes(q);
        const termOk = !term || rowTerm.includes(term);
        const deptOk = !dept || rowDept === dept;
        let   capOk  = true;
        if (cap === 'open') capOk = isOpen;
        else if (cap === 'full') capOk = isFull;

        const matches = nameOk && termOk && deptOk && capOk;
        $row.data('matches', matches);
        if (matches) filtered.push($row);
    });

    // Reset to page 1 whenever filter changes
    currentPage = 1;
    applyPagination(filtered);
}

/**
 * Given the list of matched rows, show only the current page slice
 * and rebuild the pagination bar.
 */
function applyPagination(matchedRows) {
    const total     = matchedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage     = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end   = start + PAGE_SIZE;

    // Hide all rows, then show only this page's slice
    $('.class-row-wrap').addClass('hidden');
    matchedRows.forEach(($row, idx) => {
        if (idx >= start && idx < end) $row.removeClass('hidden');
    });

    $('#classCountNum').text(total);

   $('#classNoResults').toggle(total === 0);

    // Pagination info text
    const showingFrom = total === 0 ? 0 : start + 1;
    const showingTo   = Math.min(end, total);
    $('#paginationInfo').text(`Showing ${showingFrom}–${showingTo} of ${total} sections`);

    // Build page buttons
    buildPageButtons(totalPages);
}

function buildPageButtons(totalPages) {
    const $ctrl = $('#paginationControls');
    $ctrl.empty();

    // Prev
    const $prev = $(`<button class="page-btn" title="Previous">&lsaquo;</button>`);
    if (currentPage === 1) $prev.prop('disabled', true).css('opacity', '.4');
    $prev.on('click', function() { if (currentPage > 1) { currentPage--; refilter(); } });
    $ctrl.append($prev);

    // Page numbers — show at most 7 buttons with ellipsis
    const pages = pagesToShow(currentPage, totalPages);
    let last = 0;
    pages.forEach(p => {
        if (p - last > 1) {
            $ctrl.append(`<span class="page-btn" style="cursor:default;border:none;">…</span>`);
        }
        const $btn = $(`<button class="page-btn${p === currentPage ? ' active' : ''}">${p}</button>`);
        $btn.on('click', function() { currentPage = p; refilter(); });
        $ctrl.append($btn);
        last = p;
    });

    // Next
    const $next = $(`<button class="page-btn" title="Next">&rsaquo;</button>`);
    if (currentPage === totalPages) $next.prop('disabled', true).css('opacity', '.4');
    $next.on('click', function() { if (currentPage < totalPages) { currentPage++; refilter(); } });
    $ctrl.append($next);
}

/** Decide which page numbers to display (max ~7, with ellipsis gaps). */
function pagesToShow(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, cur]);
    for (let d = 1; d <= 2; d++) { set.add(cur - d); set.add(cur + d); }
    return [...set].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
}

/** Re-run the filter logic and paginate without resetting currentPage. */
function refilter() {
    const q    = $('#classSearch').val().toLowerCase().trim();
    const dept = $('#classDeptFilter').val();
    const term = $('#classTermFilter').val().toLowerCase();
    const cap  = $('#classCapFilter').val();

    let filtered = [];
    $('.class-row-wrap').each(function() {
        const $row    = $(this);
        const name    = ($row.attr('data-name')  || '').toLowerCase();
        const rowTerm = ($row.attr('data-term')  || '').toLowerCase();
        const rowDept = $row.attr('data-dept')   || '';
        const isOpen  = $row.attr('data-open')  === '1';
        const isFull  = $row.attr('data-full')  === '1';

        const nameOk = !q    || name.includes(q);
        const termOk = !term || rowTerm.includes(term);
        const deptOk = !dept || rowDept === dept;
        let   capOk  = true;
        if (cap === 'open') capOk = isOpen;
        else if (cap === 'full') capOk = isFull;

        const matches = nameOk && termOk && deptOk && capOk;
        if (matches) filtered.push($row);
    });

    applyPagination(filtered);
}

$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/classes.php';
    let addModalObj  = null;
    let editModalObj = null;

    const addEl  = document.getElementById('addClassModal');
    if (addEl)  addModalObj  = new bootstrap.Modal(addEl);
    const editEl = document.getElementById('editClassModal');
    if (editEl) editModalObj = new bootstrap.Modal(editEl);

    // ── INITIAL LOAD ──
    fetchClasses();
    fetchFormData();

    // ── EVENT LISTENERS ──
    $('#classSearch').on('input', filterClasses);
    $('#classDeptFilter').on('change', filterClasses);
    $('#classTermFilter').on('change', filterClasses);
    $('#classCapFilter').on('change', filterClasses);

    $('#addClassForm').on('submit', handleAddSubmit);
    $('#editClassForm').on('submit', handleEditSubmit);

    // Delegate edit click
    $(document).on('click', '.edit-class-btn', function() {
        $('#edit_class_id').val($(this).data('id'));
        $('#edit_course_id').val($(this).data('course'));
        $('#edit_instructor_id').val($(this).data('instructor'));
        $('#edit_semester').val($(this).data('semester'));
        $('#edit_year').val($(this).data('year'));
        $('#edit_capacity').val($(this).data('capacity'));
    });

    // ── API CALLS ──

    function fetchClasses() {
        $.ajax({
            url: `${API_URL}?action=get_all`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    populateDeptDropdown(json.departments);
                    renderTable(json.data);
                } else {
                    showToast(json.message || "Failed to load classes.", "error");
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error fetchClasses:", xhr.responseText || error);
                showToast("Server error loading classes.", "error");
            }
        });
    }

    function fetchFormData() {
        $.ajax({
            url: `${API_URL}?action=get_form_data`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    populateSelects(json.courses, json.instructors, json.semesters);
                }
            }
        });
    }

    function handleAddSubmit(e) {
        e.preventDefault();
        const data = {
            course_id:      $('#add_course_id').val(),
            instructor_id:  $('#add_instructor_id').val(),
            semester:       $('#add_semester').val(),
            year:           $('#add_year').val(),
            max_enrollment: $('#add_capacity').val()
        };

        $.ajax({
            url: `${API_URL}?action=create`,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            data: JSON.stringify(data),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    if (addModalObj) addModalObj.hide();
                    $('#addClassForm')[0].reset();
                    fetchClasses();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    function handleEditSubmit(e) {
        e.preventDefault();
        const data = {
            class_id:       $('#edit_class_id').val(),
            course_id:      $('#edit_course_id').val(),
            instructor_id:  $('#edit_instructor_id').val(),
            semester:       $('#edit_semester').val(),
            year:           $('#edit_year').val(),
            max_enrollment: $('#edit_capacity').val()
        };

        $.ajax({
            url: `${API_URL}?action=update`,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            data: JSON.stringify(data),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    if (editModalObj) editModalObj.hide();
                    fetchClasses();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    window.archiveClass = function(classId) {
        if (!confirm(`Are you sure you want to archive Section #${classId}?\nThis will remove related enrollments and assignments.`)) return;

        $.ajax({
            url: `${API_URL}?action=archive`,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            data: JSON.stringify({ class_id: classId }),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    fetchClasses();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    };

    // ── DOM RENDERING ──

    function populateDeptDropdown(departments) {
        let html = '<option value="">All Departments</option>';
        (departments || []).forEach(d => {
            html += `<option value="${d.department_id}">${d.name}</option>`;
        });
        $('#classDeptFilter').html(html);
    }

    function populateSelects(courses, instructors, semesters) {
        // Courses
        let cHtml = '<option value="">-- Select Course --</option>';
        courses.forEach(c => cHtml += `<option value="${c.course_id}">${c.course_code} - ${c.name}</option>`);
        $('#add_course_id, #edit_course_id').html(cHtml);

        // Instructors
        let iHtml = '<option value="">-- Select Faculty --</option>';
        instructors.forEach(i => iHtml += `<option value="${i.employee_id}">Prof. ${i.first_name} ${i.last_name}</option>`);
        $('#add_instructor_id, #edit_instructor_id').html(iHtml);

        // Term filter dropdown
        let sHtml = '<option value="">All Terms</option>';
        semesters.forEach(s => sHtml += `<option value="${s.semester} ${s.year}">${s.semester} ${s.year}</option>`);
        $('#classTermFilter').html(sHtml);
    }

    function renderTable(groupedData) {
        const $tbody = $('#classBody');
        $tbody.empty();
        currentPage = 1; // reset on fresh load

        const allSections = [];
        groupedData.forEach(group => {
            group.sections.forEach(sec => {
                allSections.push({
                    ...sec,
                    course_name:   group.course_name,
                    course_code:   group.course_code,
                    department_id: group.department_id !== null && group.department_id !== undefined
                                   ? String(group.department_id) : '',
                    dept_name:     group.dept_name || ''
                });
            });
        });

        if (allSections.length === 0) {
            $tbody.html(`<tr><td colspan="5" class="text-center py-5 text-muted small">No active classes found.</td></tr>`);
            $('#classCountNum').text(0);
            $('#paginationInfo').text('Showing 0–0 of 0 sections');
            $('#paginationControls').empty();
            return;
        }

        // Render ALL rows into the DOM (hidden by default); pagination will reveal the right slice
        allSections.forEach(sec => {
            const cur      = parseInt(sec.current_students);
            const max      = parseInt(sec.max_enrollment);
            const isFull   = cur >= max;
            const statusColor = isFull ? 'text-danger' : 'text-success';
            const barColor    = isFull ? 'bg-danger'   : 'bg-success';
            const pct         = Math.min((cur / Math.max(1, max)) * 100, 100);
            const termStr     = `${sec.semester} ${sec.year}`;
            const deptBadge   = sec.dept_name
                ? `<span class="badge bg-secondary-subtle text-secondary border mt-1" style="font-size:.65rem;">
                       <i class="fas fa-building me-1"></i>${sec.dept_name}
                   </span>`
                : '';

            // ── Colorful square initials avatar (same system as students) ──
            const firstName  = sec.first_name || '';
            const lastName   = sec.last_name  || '';
            const initials   = ((firstName.charAt(0) || '') + (lastName.charAt(0) || '')).toUpperCase();
            const seed       = `${firstName} ${lastName}`.trim() || String(sec.instructor_id);
            const bgColor    = avatarColor(seed);

            const avatarHtml = `<div class="instructor-avatar" style="background:${bgColor};">${initials}</div>`;

            const rowHtml = `
            <tr class="class-row-wrap hidden"
                data-name="${(sec.course_name + ' ' + sec.course_code).toLowerCase()}"
                data-term="${termStr.toLowerCase()}"
                data-dept="${sec.department_id}"
                data-open="${isFull ? '0' : '1'}"
                data-full="${isFull ? '1' : '0'}">
                <td class="ps-4 py-3">
                    <div class="fw-bold text-dark">${sec.course_name}</div>
                    <span class="badge bg-info-subtle text-info border border-info-subtle mt-1">${sec.course_code}</span>
                    ${deptBadge}
                </td>
                <td class="py-3">
                    <span class="badge fw-bold me-2" style="font-family:'JetBrains Mono',monospace;background:#1e293b;color:#fff;font-size:.72rem;padding:5px 10px;border-radius:8px;">
                        #${sec.class_id}
                    </span>
                    <span class="small text-muted fw-medium">${termStr}</span>
                </td>
                <td class="py-3">
                    <div class="d-flex align-items-center gap-2">
                        ${avatarHtml}
                        <span class="small fw-bold text-dark">Prof. ${lastName}</span>
                    </div>
                </td>
                <td class="py-3">
                    <div class="small fw-bold ${statusColor}">${cur} / ${max}</div>
                    <div class="progress mt-1" style="height:4px;width:80px;">
                        <div class="progress-bar ${barColor}" style="width:${pct}%"></div>
                    </div>
                </td>
                <td class="text-end pe-4 py-3">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <button class="btn-action btn-edit edit-class-btn"
                            data-bs-toggle="modal" data-bs-target="#editClassModal"
                            data-id="${sec.class_id}"
                            data-course="${sec.course_id}"
                            data-instructor="${sec.instructor_id}"
                            data-semester="${sec.semester}"
                            data-year="${sec.year}"
                            data-capacity="${sec.max_enrollment}"
                            title="Edit Section">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button type="button" class="btn-action btn-archive" onclick="archiveClass(${sec.class_id})">
                            <i class="fas fa-archive"></i> Archive
                        </button>
                    </div>
                </td>
            </tr>`;

            $tbody.append(rowHtml);
        });

        $tbody.append(`
            <tr class="no-results-row" id="classNoResults">
                <td colspan="5" class="text-center py-5">
                    <i class="fas fa-search d-block fs-3 text-muted opacity-25 mb-2"></i>
                    <div class="fw-bold text-muted">No classes match your search</div>
                    <div class="text-muted small">Try a different name, department, term, or capacity filter</div>
                </td>
            </tr>
        `);

        // Trigger initial filter + paginate (shows first page)
        filterClasses();
    }

    function showToast(msg, type) {
        $('#toast').remove();
        const isSuccess = type === "success";
        const bgColor   = isSuccess ? '#dcfce7' : '#fee2e2';
        const color     = isSuccess ? '#15803d' : '#be123c';
        const border    = isSuccess ? '#bbf7d0' : '#fecdd3';
        const icon      = isSuccess ? 'fa-check-circle' : 'fa-exclamation-triangle';

        const toastHtml = `
            <div id="toast" class="toast-bar" style="background:${bgColor}; color:${color}; border:1px solid ${border};">
                <i class="fas ${icon}"></i> ${msg}
            </div>`;
        $('body').append(toastHtml);
        setTimeout(() => $('#toast').css('opacity', '0'), 3500);
        setTimeout(() => $('#toast').remove(), 4000);
    }
});

// ─── Header & Session Logic ───────────────────────────────────────────────────
const AUTH_API = 'https://artisanslms.onrender.com/backend/index.php';

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
        'enrollment.html':             { title: 'Student Enrollment',     subtitle: 'Manage and track student class enrollments.' },
        'classes.html':                { title: 'Class Management',       subtitle: 'Create and manage class sections by course.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
        'assignments.html':            { title: 'Assignments',            subtitle: 'View and submit your class assignments.' },
        'grades.html':                 { title: 'Grades',                 subtitle: 'View your academic performance and feedback.' },
        'quizzes.html':                { title: 'Quizzes',                subtitle: 'Take and review your quizzes.' },
        'modules.html':                { title: 'Course Materials',       subtitle: 'Browse uploaded files, lectures, and resources.' },
        'todo.html':                   { title: 'Task Manager',           subtitle: 'Manage your personal tasks and to-dos.' },
    };

    const currentPage = window.location.pathname.split('/').pop() || 'classes.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };

    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: AUTH_API,
        method: 'POST',
        xhrFields: { withCredentials: true },
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function(res) {
            if (res.status === 'success' && res.logged_in) {
                const u     = res.user;
                const smAvt = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=475569`;
                const lgAvt = smAvt + '&size=128';

                $('#headerUserName').text(u.name);
                $('#headerUserRole').text(u.role || 'Admin');
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'Admin');
                $('#dropdownAvatar').attr({ src: lgAvt, alt: u.name });
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
            } else {
                window.location.href = '/client/pages/login.html';
            }
        },
        error: function() {
            window.location.href = '/client/pages/login.html';
        }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/client/pages/login.html'; }
        });
    });
}