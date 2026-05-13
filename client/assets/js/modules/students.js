$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/students.php';
    let addModalObj   = null;
    let editModalObj  = null;
    let activeGender  = 'all';
    let activeDept    = '';          // '' = All Departments

    // Global Data State for Pagination
    let _allStudentsRaw = [];
    let _filteredStudents = [];
    let _currentPage = 1;
    const _itemsPerPage = 50;

    // Avatar Colors array matching the PHP original
    const avatar_colors = ['#0ea5e9','#22c55e','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1'];

    // Initialize Modals
    const addEl  = document.getElementById('addStudentModal');
    if (addEl)  addModalObj  = new bootstrap.Modal(addEl);
    const editEl = document.getElementById('editStudentModal');
    if (editEl) editModalObj = new bootstrap.Modal(editEl);

    // ── INITIAL LOAD ──
    fetchStudents();

    // ── EVENT LISTENERS ──

    // Search
    $('#studentSearch').on('input', function() {
        applyFilters($(this).val().toLowerCase().trim());
    });

    // Gender chip filter
    window.filterChip = function(el, gender) {
        $('.filter-chip').removeClass('active');
        $(el).addClass('active');
        activeGender = gender;
        applyFilters();
    };

    // Department dropdown filter (triggers backend query)
    $('#studentDeptFilter').on('change', function() {
        activeDept = $(this).val();
        fetchStudents(activeDept);
    });

    // Form Submissions
    $('#addStudentForm').on('submit', handleAddSubmit);
    $('#editStudentForm').on('submit', handleEditSubmit);

    // Edit Button Click (Event Delegation)
    $(document).on('click', '.btn-edit', function() {
        $('#edit_student_id').val($(this).data('id'));
        $('#edit_fname').val($(this).data('fname'));
        $('#edit_lname').val($(this).data('lname'));
        $('#edit_email').val($(this).data('email'));
        $('#edit_dob').val($(this).data('dob'));

        let gender = $(this).data('gender');
        if (gender === 'M' || gender === 'F' || gender === 'Other') {
            $('#edit_gender').val(gender);
        } else {
            let gLow = (gender || '').toLowerCase();
            $('#edit_gender').val(
                (gLow === 'male'   || gLow === 'm') ? 'M' :
                (gLow === 'female' || gLow === 'f') ? 'F' : 'Other'
            );
        }
    });

    // ── API CALLS ──

    function fetchStudents(deptId) {
        let url = `${API_URL}?action=get_all`;
        if (deptId && deptId !== '') url += `&department_id=${encodeURIComponent(deptId)}`;

        $.ajax({
            url: url,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    renderStats(json.stats);
                    populateDeptFilter(json.departments);
                    _allStudentsRaw = json.data || [];
                    applyFilters(); // Triggers renderTablePage
                } else {
                    showToast(json.message || "Failed to load students.", "error");
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error:", xhr.responseText || error);
                showToast("Server error loading students.", "error");
            }
        });
    }

    function handleAddSubmit(e) {
        e.preventDefault();
        const data = {
            fname:    $('#addStudentForm [name="fname"]').val(),
            lname:    $('#addStudentForm [name="lname"]').val(),
            email:    $('#addStudentForm [name="email"]').val(),
            dob:      $('#addStudentForm [name="dob"]').val(),
            gender:   $('#addStudentForm [name="gender"]').val(),
            password: $('#addStudentForm [name="password"]').val()
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
                    $('#addStudentForm')[0].reset();
                    fetchStudents(activeDept);
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    function handleEditSubmit(e) {
        e.preventDefault();
        const data = {
            student_id: $('#edit_student_id').val(),
            fname:      $('#edit_fname').val(),
            lname:      $('#edit_lname').val(),
            email:      $('#edit_email').val(),
            dob:        $('#edit_dob').val(),
            gender:     $('#edit_gender').val()
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
                    fetchStudents(activeDept);
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    window.archiveStudent = function(studentId) {
        if (!confirm('Archive this student? They can be restored from the Archives page.')) return;

        $.ajax({
            url: `${API_URL}?action=archive`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ student_id: studentId }),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, "archived");
                    fetchStudents(activeDept);
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    };

    // ── DOM RENDERING ──

    function renderStats(stats) {
        $('#statTotal').text(stats.total);
        $('#statMale').text(stats.male);
        $('#statFemale').text(stats.female);
        $('#statNew').text(stats.new);
    }

    function populateDeptFilter(departments) {
        const $sel = $('#studentDeptFilter');
        if ($sel.find('option').length > 1) return;

        let html = '<option value="">All Departments</option>';
        (departments || []).forEach(d => {
            html += `<option value="${d.department_id}">${d.name}</option>`;
        });
        $sel.html(html);
        if (activeDept) $sel.val(activeDept);
    }

    // ── FILTERING & PAGINATION ──
    function applyFilters(q) {
        if (q === undefined) q = $('#studentSearch').val().toLowerCase().trim();

        _filteredStudents = _allStudentsRaw.filter(row => {
            const searchStr = `${row.first_name || ''} ${row.last_name || ''} ${row.email || ''} STU-${String(row.student_id).padStart(4, '0')} ${row.dept_name || ''}`.toLowerCase();
            const textMatch = !q || searchStr.includes(q);

            let g = (row.gender || '').toLowerCase();
            let gkey = { m: 'm', male: 'm', f: 'f', female: 'f' }[g] || 'other';
            const genderMatch = activeGender === 'all' || gkey === activeGender;

            return textMatch && genderMatch;
        });

        _currentPage = 1;
        renderTablePage();
    }

    function renderTablePage() {
        const $tbody = $('#studentBody');
        $tbody.empty();

        const isAdmin = (sessionStorage.getItem('sb_role') || '').toLowerCase() === 'admin';
        const total = _filteredStudents.length;

        $('#studentCountNum').text(total);

        if (total === 0) {
            $tbody.html(`
                <tr><td colspan="${isAdmin ? 7 : 6}">
                    <div class="empty-state">
                        <i class="fas fa-user-graduate d-block mb-2"></i>
                        <p>No students found.</p>
                    </div>
                </td></tr>
            `);
            updatePaginationUI(0);
            return;
        }

        const start = (_currentPage - 1) * _itemsPerPage;
        const pageData = _filteredStudents.slice(start, start + _itemsPerPage);

        let html = '';
        pageData.forEach((row, i) => {
            const first    = row.first_name || '';
            const last     = row.last_name  || '';
            const initials = ((first.charAt(0) || '') + (last.charAt(0) || '')).toUpperCase();

            // Generate stable colors based on full array index
            const col = avatar_colors[(start + i) % avatar_colors.length];

            let g      = (row.gender || '').toLowerCase();
            const gkey   = { m: 'm', male: 'm', f: 'f', female: 'f' }[(row.gender || '').toLowerCase()] || 'other';
            const glabel = { m: 'Male', f: 'Female' }[gkey] || (row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : '—');
            const gbg    = { m: 'background:#dbeafe;color:#1d4ed8;', f: 'background:#fce7f3;color:#be185d;', other: 'background:#f1f5f9;color:#475569;' }[gkey];

            const dateStr  = row.enrollment_date
                ? new Date(row.enrollment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
            const paddedId = String(row.student_id).padStart(4, '0');

            const deptLabel = row.dept_name || '—';
            const deptHtml = row.dept_name
                ? `<span class="badge bg-light text-dark border text-truncate d-inline-block" style="font-size:.72rem;max-width:220px;vertical-align:middle;" title="${deptLabel}">${deptLabel}</span>`
                : `<span class="text-muted small">—</span>`;

            let actionHtml = '';
            if (isAdmin) {
                const safeFname = first.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                const safeLname = last.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                const safeEmail = (row.email || '').replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                actionHtml = `
                <td class="text-end pe-4">
                    <div class="d-flex gap-2 justify-content-end">
                        <button class="btn-edit"
                            style="width:34px;height:34px;padding:0;justify-content:center;"
                            data-bs-toggle="modal" data-bs-target="#editStudentModal"
                            data-id="${row.student_id}" data-fname="${safeFname}"
                            data-lname="${safeLname}" data-email="${safeEmail}"
                            data-dob="${row.dob || ''}" data-gender="${row.gender || ''}"
                            title="Edit Student">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-archive"
                            style="width:34px;height:34px;padding:0;justify-content:center;"
                            onclick="archiveStudent(${row.student_id})"
                            title="Archive Student">
                            <i class="fas fa-archive"></i>
                        </button>
                    </div>
                </td>`;
            }

            html += `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <div class="stu-avatar" style="background:${col};">${initials}</div>
                        <div>
                            <div class="stu-name">${first} ${last}</div>
                            <div class="stu-id">STU-${paddedId}</div>
                        </div>
                    </div>
                </td>
                <td><span class="stu-email">${row.email || '—'}</span></td>
                <td>${deptHtml}</td>
                <td>
                    <span style="font-size:.72rem;font-weight:600;padding:3px 9px;border-radius:6px;display:inline-block;min-width:60px;text-align:center;${gbg}">
                        ${glabel}
                    </span>
                </td>
                <td><span class="stu-date">${dateStr}</span></td>
                <td><span class="badge-active">Active</span></td>
                ${actionHtml}
            </tr>`;
        });

        $tbody.html(html);
        updatePaginationUI(total);
    }

    function updatePaginationUI(totalItems) {
        const totalPages = Math.ceil(totalItems / _itemsPerPage) || 1;
        $('#paginationInfo').text(`Page ${_currentPage} of ${totalPages}`);

        let html = `<button class="page-btn" ${_currentPage === 1 ? 'disabled' : ''} onclick="changePage(${_currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= _currentPage - 1 && i <= _currentPage + 1)) {
                html += `<button class="page-btn ${i === _currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
            } else if (i === _currentPage - 2 || i === _currentPage + 2) {
                html += `<span class="px-2 text-muted small">...</span>`;
            }
        }

        html += `<button class="page-btn" ${_currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${_currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;

        $('#paginationControls').html(html);
    }

    window.changePage = function(p) {
        _currentPage = p;
        renderTablePage();
        $('.table-scroll-wrapper').scrollTop(0); // Scroll table back to top
    };

    function showToast(msg, type) {
        $('#toast').remove();
        let bgClass = "toast-success";
        let icon    = "fa-check-circle";

        if (type === "error") {
            bgClass = "";
            icon    = "fa-exclamation-triangle";
        } else if (type === "archived") {
            bgClass = "toast-archived";
            icon    = "fa-archive";
        }

        let customStyle = type === "error" ? 'background:#fee2e2; color:#be123c; border:1px solid #fecdd3;' : '';

        const toastHtml = `
            <div id="toast" class="toast-bar ${bgClass}" style="${customStyle}">
                <i class="fas ${icon}"></i> ${msg}
            </div>
        `;

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
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' }
    };

    const currentPage = window.location.pathname.split('/').pop() || 'students.html';
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

                // Save role for UI conditionals
                sessionStorage.setItem('sb_role', (u.role || '').toLowerCase());
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
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json', xhrFields: { withCredentials: true },
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/client/pages/login.html'; }
        });
    });
}