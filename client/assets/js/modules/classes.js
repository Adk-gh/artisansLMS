// classes.js

function filterClasses() {
    const q    = $('#classSearch').val().toLowerCase().trim();
    const dept = $('#classDeptFilter').val();
    const term = $('#classTermFilter').val().toLowerCase();
    const cap  = $('#classCapFilter').val();
    let visible = 0;

    $('.class-row-wrap').each(function() {
        const $row   = $(this);
        const name   = ($row.attr('data-name')  || '').toLowerCase();
        const rowTerm = ($row.attr('data-term') || '').toLowerCase();
        const rowDept = $row.attr('data-dept')  || '';
        const isOpen  = $row.attr('data-open') === '1';
        const isFull  = $row.attr('data-full') === '1';

        const nameOk = !q    || name.includes(q);
        const termOk = !term || rowTerm.includes(term);
        const deptOk = !dept || rowDept === dept;
        let   capOk  = true;
        if (cap === 'open') capOk = isOpen;
        else if (cap === 'full') capOk = isFull;

        const show = nameOk && termOk && deptOk && capOk;
        $row.toggleClass('hidden', !show);
        if (show) visible++;
    });

    $('#classCountNum').text(visible);
    if (visible === 0) $('#classNoResults').addClass('show');
    else               $('#classNoResults').removeClass('show');
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

    // ── Flat per-section render ──
    // Each class section gets its own <tr> — no collapsible grouping.
    // Filtering is now per row, so a "CS101 1st Sem 2026" and "CS101 2nd Sem 2026"
    // are completely independent rows that can be shown/hidden individually.
    function renderTable(groupedData) {
        const $tbody = $('#classBody');
        $tbody.empty();

        // Flatten all sections into one array
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

        $('#classCountNum').text(allSections.length);

        if (allSections.length === 0) {
            $tbody.html(`<tr><td colspan="5" class="text-center py-5 text-muted small">No active classes found.</td></tr>`);
            return;
        }

        allSections.forEach(sec => {
            const cur      = parseInt(sec.current_students);
            const max      = parseInt(sec.max_enrollment);
            const isFull   = cur >= max;
            const statusColor = isFull ? 'text-danger' : 'text-success';
            const barColor    = isFull ? 'bg-danger'   : 'bg-success';
            const pct         = Math.min((cur / Math.max(1, max)) * 100, 100);
            const avatar      = `https://ui-avatars.com/api/?name=${encodeURIComponent(sec.first_name+'+'+sec.last_name)}&background=f1f5f9&color=0ea5e9&bold=true`;
            const termStr     = `${sec.semester} ${sec.year}`;
            const deptBadge   = sec.dept_name
                ? `<span class="badge bg-secondary-subtle text-secondary border mt-1" style="font-size:.65rem;">
                       <i class="fas fa-building me-1"></i>${sec.dept_name}
                   </span>`
                : '';

            // data-name includes course name + code for search
            // data-term for term filter
            // data-dept for dept dropdown filter
            // data-open / data-full for capacity filter
            const rowHtml = `
            <tr class="class-row-wrap"
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
                    <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle fw-bold me-2" style="font-family:'JetBrains Mono',monospace;">
                        #${sec.class_id}
                    </span>
                    <span class="small text-muted fw-medium">${termStr}</span>
                </td>
                <td class="py-3">
                    <div class="d-flex align-items-center">
                        <img src="${avatar}" class="rounded-circle me-2 avatar-sm" alt="avatar">
                        <span class="small fw-bold text-dark">Prof. ${sec.last_name}</span>
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
                        <button class="btn btn-sm btn-outline-primary border-0 edit-class-btn"
                            data-bs-toggle="modal" data-bs-target="#editClassModal"
                            data-id="${sec.class_id}"
                            data-course="${sec.course_id}"
                            data-instructor="${sec.instructor_id}"
                            data-semester="${sec.semester}"
                            data-year="${sec.year}"
                            data-capacity="${sec.max_enrollment}"
                            title="Edit Section">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-archive-sm" onclick="archiveClass(${sec.class_id})">
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
const AUTH_API = '/artisansLMS/backend/index.php';

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
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
        });
    });
}