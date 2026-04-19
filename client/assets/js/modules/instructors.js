$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/instructors.php';
    let addModalObj = null;
    let editModalObj = null;

    const addEl = document.getElementById('addInstructorModal');
    if (addEl) addModalObj = new bootstrap.Modal(addEl);
    const editEl = document.getElementById('editInstructorModal');
    if (editEl) editModalObj = new bootstrap.Modal(editEl);

    let instructorsData = [];
    let currentView = localStorage.getItem('instructorViewPref') || 'grid';

    // ── INITIAL LOAD ──
    fetchInstructors();
    applyView(currentView); // apply view without triggering filter (data not loaded yet)

    // ── EVENT LISTENERS ──
    $('#instSearch').on('input', filterInstructors);
    $('#instDeptFilter').on('change', filterInstructors);
    $('#instClassFilter').on('change', filterInstructors);

    $('#addInstructorForm').on('submit', handleAddSubmit);
    $('#editInstructorForm').on('submit', handleEditSubmit);

    $(document).on('click', '.edit-instructor-btn', function() {
        $('#edit_emp_id').val($(this).data('id'));
        $('#edit_fname').val($(this).data('fname'));
        $('#edit_lname').val($(this).data('lname'));
        $('#edit_email').val($(this).data('email'));
        $('#edit_gender').val($(this).data('gender'));
        $('#edit_dob').val($(this).data('dob'));
        $('#edit_hire').val($(this).data('hire'));
        $('#edit_salary').val($(this).data('salary'));
        $('#edit_dept').val($(this).data('dept'));
        $('#edit_pos').val($(this).data('pos'));
        $('#edit_password').val('');
        if (editModalObj) editModalObj.show();
    });

    // ── API CALLS ──

    function fetchInstructors() {
        $.ajax({
            url: `${API_URL}?action=get_all`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    instructorsData = json.data;
                    populateSelects(json.departments, json.positions);
                    renderInstructors(json.data);
                } else {
                    showToast(json.message || "Failed to load instructors.", "error");
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error:", xhr.responseText || error);
                showToast("Server error loading instructors.", "error");
            }
        });
    }

    function handleAddSubmit(e) {
        e.preventDefault();
        const data = {
            fname:         $('[name="fname"]',  '#addInstructorForm').val(),
            lname:         $('[name="lname"]',  '#addInstructorForm').val(),
            dob:           $('[name="dob"]',    '#addInstructorForm').val(),
            gender:        $('[name="gender"]', '#addInstructorForm').val(),
            hire_date:     $('[name="hire_date"]', '#addInstructorForm').val(),
            department_id: $('[name="department_id"]', '#addInstructorForm').val(),
            position_id:   $('[name="position_id"]',   '#addInstructorForm').val(),
            salary:        $('[name="salary"]', '#addInstructorForm').val(),
            email:         $('[name="email"]',  '#addInstructorForm').val(),
            password:      $('#passInput').val()
        };

        $.ajax({
            url: `${API_URL}?action=create`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showCreateToast(json.email, json.pass);
                    if (addModalObj) addModalObj.hide();
                    $('#addInstructorForm')[0].reset();
                    fetchInstructors();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    function handleEditSubmit(e) {
        e.preventDefault();
        const data = {
            employee_id:   $('#edit_emp_id').val(),
            fname:         $('#edit_fname').val(),
            lname:         $('#edit_lname').val(),
            dob:           $('#edit_dob').val(),
            gender:        $('#edit_gender').val(),
            hire_date:     $('#edit_hire').val(),
            department_id: $('#edit_dept').val(),
            position_id:   $('#edit_pos').val(),
            salary:        $('#edit_salary').val(),
            email:         $('#edit_email').val(),
            new_password:  $('#edit_password').val()
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
                    fetchInstructors();
                } else {
                    showToast(json.message, "error");
                }
            }
        });
    }

    window.archiveInstructor = function(id, name, classCount) {
        let msg = `Archive ${name}?\n`;
        msg += classCount > 0
            ? `⚠️ They have ${classCount} assigned class(es) which will also be removed.`
            : `Their record will be saved to Archives.`;

        if (!confirm(msg)) return;

        $.ajax({
            url: `${API_URL}?action=archive`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ archive_id: id }),
            dataType: 'json',
            success: function(json) {
                showToast(json.message, json.status === 'success' ? "archived" : "error");
                if (json.status === 'success') fetchInstructors();
            }
        });
    };

    // ── VIEW TOGGLE ──

    // Only switches the DOM visibility — does NOT call filterInstructors itself.
    // filterInstructors() calls this indirectly via the button onclick → toggleView → applyView.
    function applyView(viewType) {
        currentView = viewType;
        localStorage.setItem('instructorViewPref', viewType);

        if (viewType === 'list') {
            $('#gridView').hide();
            $('#noResultsGrid').removeClass('show').hide();
            $('#tableView').show();
            $('#btnGrid').removeClass('active');
            $('#btnList').addClass('active');
        } else {
            $('#tableView').hide();
            $('#noResultsList').removeClass('show').hide();
            // Use flex for the grid
            $('#gridView').css('display', 'flex');
            $('#btnList').removeClass('active');
            $('#btnGrid').addClass('active');
        }
    }

    // Called by the HTML onclick buttons — applies view then re-filters
    window.toggleView = function(viewType) {
        applyView(viewType);
        filterInstructors();
    };

    // ── DOM RENDERING ──

    function populateSelects(depts, pos) {
        // Dropdowns inside add/edit modals
        let dHtml = '<option value="">-- Select Department --</option>';
        depts.forEach(d => {
            dHtml += `<option value="${d.department_id}">${d.name}</option>`;
        });
        $('#add_dept, #edit_dept').html(dHtml);

        // Filter bar — value is the lowercased name for matching data-dept
        let dFilterHtml = '<option value="">All Departments</option>';
        depts.forEach(d => {
            dFilterHtml += `<option value="${d.name.toLowerCase()}">${d.name}</option>`;
        });
        $('#instDeptFilter').html(dFilterHtml);

        let pHtml = '<option value="">-- Select Position --</option>';
        pos.forEach(p => pHtml += `<option value="${p.position_id}">${p.title}</option>`);
        $('#add_pos, #edit_pos').html(pHtml);
    }

    function renderInstructors(data) {
        const $grid  = $('#gridView');
        const $tbody = $('#instTableBody');
        $grid.empty();
        $tbody.empty();

        if (data.length === 0) {
            $('#instCountNum').text(0);
            filterInstructors(); // will show the correct no-results block
            return;
        }

        let gridHtml = '';
        let listHtml = '';

        data.forEach(row => {
            // Normalise for filtering — all lowercase
            const nameLower  = `${row.first_name} ${row.last_name}`.toLowerCase();
            const emailLower = (row.email || '').toLowerCase();
            const deptLower  = (row.dept_name || '').toLowerCase();

            const safeFname  = (row.first_name || '').replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            const safeLname  = (row.last_name  || '').replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            const avatarUrl  = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.first_name + '+' + row.last_name)}&background=0ea5e9&color=fff&bold=true`;
            const genderStr  = row.gender === 'M' ? 'Male' : (row.gender === 'F' ? 'Female' : (row.gender || '—'));
            const hireStr    = row.hire_date
                ? new Date(row.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
            const badgeClass = row.class_count > 0 ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary';

            const editAttrs = `
                data-id="${row.employee_id}"
                data-fname="${safeFname}" data-lname="${safeLname}"
                data-email="${row.email || ''}" data-gender="${row.gender || ''}"
                data-dob="${row.date_of_birth || ''}" data-hire="${row.hire_date || ''}"
                data-salary="${row.salary || ''}"
                data-dept="${row.department_id || ''}" data-pos="${row.position_id || ''}"
            `;

            // ── Grid card ──
            gridHtml += `
            <div class="col-12 col-sm-6 col-xl-4 inst-card-col"
                 data-name="${nameLower}"
                 data-email="${emailLower}"
                 data-dept="${deptLower}"
                 data-classes="${row.class_count}">
                <div class="faculty-card shadow-sm h-100 p-4 bg-white rounded-4">
                    <div class="d-flex align-items-center mb-3">
                        <img src="${avatarUrl}&size=80" class="rounded-circle border me-3 shadow-sm flex-shrink-0" width="56" height="56">
                        <div style="min-width:0;">
                            <h6 class="fw-bold mb-0 text-dark text-truncate">${row.first_name} ${row.last_name}</h6>
                            <small class="text-primary fw-bold">${row.pos_title || 'Instructor'}</small>
                        </div>
                    </div>
                    <div class="bg-light rounded-3 p-3 mb-3">
                        <div class="row g-2">
                            <div class="col-6"><div class="info-label">Department</div><small class="fw-medium text-dark">${row.dept_name || 'Unassigned'}</small></div>
                            <div class="col-6"><div class="info-label">Gender</div><small class="fw-medium text-dark">${genderStr}</small></div>
                            <div class="col-12 mt-1"><div class="info-label">Email</div><small class="fw-medium text-dark text-truncate d-block">${row.email || '—'}</small></div>
                            <div class="col-6 mt-1"><div class="info-label">Hired</div><small class="fw-medium text-dark">${hireStr}</small></div>
                            <div class="col-6 mt-1"><div class="info-label">Classes</div><small class="fw-medium text-dark"><span class="badge ${badgeClass} rounded-pill">${row.class_count} assigned</span></small></div>
                        </div>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-light border btn-sm flex-grow-1 fw-bold edit-instructor-btn" ${editAttrs}>
                            <i class="fas fa-edit me-1 text-primary"></i> Edit Info
                        </button>
                        <button type="button" class="btn-archive-inst" onclick="archiveInstructor(${row.employee_id},'${safeFname} ${safeLname}',${row.class_count})">
                            <i class="fas fa-archive"></i> Archive
                        </button>
                    </div>
                </div>
            </div>`;

            // ── List row ──
            listHtml += `
            <tr class="inst-table-row"
                data-name="${nameLower}"
                data-email="${emailLower}"
                data-dept="${deptLower}"
                data-classes="${row.class_count}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-2">
                        <img src="${avatarUrl}&size=40" class="rounded-circle border flex-shrink-0" width="38" height="38">
                        <div style="min-width:0;">
                            <div class="fw-bold text-dark text-truncate">${row.first_name} ${row.last_name}</div>
                            <div class="text-primary" style="font-size:.72rem;font-weight:600;">${row.pos_title || 'Instructor'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="text-dark" style="font-size:.82rem;">${row.email || '—'}</div>
                    <div class="text-muted" style="font-size:.7rem;">${genderStr}</div>
                </td>
                <td><span class="badge bg-light text-dark border">${row.dept_name || 'Unassigned'}</span></td>
                <td><span class="badge ${badgeClass} rounded-pill px-2">${row.class_count}</span></td>
                <td style="font-size:.8rem;">${hireStr}</td>
                <td class="text-end pe-4">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                        <button class="btn-edit-inst edit-instructor-btn" ${editAttrs}><i class="fas fa-edit"></i> Edit</button>
                        <button type="button" class="btn-archive-inst" onclick="archiveInstructor(${row.employee_id},'${safeFname} ${safeLname}',${row.class_count})">
                            <i class="fas fa-archive"></i> Archive
                        </button>
                    </div>
                </td>
            </tr>`;
        });

        $grid.html(gridHtml);
        $tbody.html(listHtml);

        // Re-apply current view so grid flex is correct after innerHTML swap
        applyView(currentView);
        filterInstructors();
    }

    function filterInstructors() {
        const q      = $('#instSearch').val().toLowerCase().trim();
        const dept   = $('#instDeptFilter').val().toLowerCase();  // already lowercased value
        const clsF   = $('#instClassFilter').val();
        let visible  = 0;

        function matches($el) {
            const name    = $el.attr('data-name')    || '';  // "john doe"
            const email   = $el.attr('data-email')   || '';
            const deptVal = $el.attr('data-dept')    || '';  // "computer science"
            const classes = parseInt($el.attr('data-classes')) || 0;

            // Search checks name, email, AND department
            const nameOk  = !q || name.includes(q) || email.includes(q) || deptVal.includes(q);
            // Dropdown dept filter: exact match on lowercased dept name
            const deptOk  = !dept || deptVal === dept;
            let   clsOk   = true;
            if      (clsF === '0') clsOk = classes === 0;
            else if (clsF === '1') clsOk = classes >= 1;
            else if (clsF === '3') clsOk = classes >= 3;

            return nameOk && deptOk && clsOk;
        }

        $('.inst-card-col').each(function() {
            const show = matches($(this));
            $(this).toggleClass('hidden', !show);
            if (show) visible++;
        });

        $('.inst-table-row').each(function() {
            $(this).toggleClass('hidden', !matches($(this)));
        });

        $('#instCountNum').text(visible);

        // Show/hide no-results block for the active view only
        if (currentView === 'grid') {
            if (visible === 0) $('#noResultsGrid').addClass('show').show();
            else               $('#noResultsGrid').removeClass('show').hide();
        } else {
            if (visible === 0) $('#noResultsList').addClass('show').show();
            else               $('#noResultsList').removeClass('show').hide();
        }
    }

    // ── PASSWORD GENERATORS ──
    window.generatePass = function() {
        const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        let v = "FAC-";
        for (let i = 0; i < 6; i++) v += c[Math.floor(Math.random() * c.length)];
        $('#passInput').val(v);
    };

    window.generatePassEdit = function() {
        const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        let v = "FAC-";
        for (let i = 0; i < 6; i++) v += c[Math.floor(Math.random() * c.length)];
        $('#edit_password').val(v);
    };

    // ── TOASTS ──
    function showToast(msg, type) {
        $('#toast').remove();
        const bgClass    = type === 'archived' ? 'toast-arch' : (type === 'error' ? '' : 'toast-ok');
        const icon       = type === 'error' ? 'fa-exclamation-triangle' : (type === 'archived' ? 'fa-archive' : 'fa-check-circle');
        const customStyle = type === 'error' ? 'background:#fee2e2;color:#be123c;border:1px solid #fecdd3;' : '';
        $('body').append(`
            <div id="toast" class="toast-bar ${bgClass}" style="${customStyle}">
                <i class="fas ${icon}"></i> ${msg}
            </div>`);
        setTimeout(() => $('#toast').css('opacity', '0'), 3500);
        setTimeout(() => $('#toast').remove(), 4000);
    }

    function showCreateToast(email, pass) {
        $('#toast').remove();
        $('body').append(`
            <div id="toast" class="toast-bar toast-ok">
                <i class="fas fa-check-circle"></i>
                Account created &middot; Email: <strong style="margin:0 4px;">${email}</strong>
                &middot; Pass: <strong style="margin:0 4px;">${pass}</strong>
            </div>`);
        setTimeout(() => $('#toast').css('opacity', '0'), 7500);
        setTimeout(() => $('#toast').remove(), 8000);
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
        'instructor_courses.html':     { title: 'Course Materials',       subtitle: 'Upload and organize files, lectures, and resources.' },
        'instructor_assignments.html': { title: 'Task Manager',           subtitle: 'Create and manage assignments for your assigned classes.' },
        'students.html':               { title: 'Manage Students',        subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html':            { title: 'Master Instructors',     subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'enrollment.html':             { title: 'Student Enrollment',     subtitle: 'Manage and track student class enrollments.' },
        'classes.html':                { title: 'Class Management',       subtitle: 'Create and manage class sections by course.' },
        'courses.html':                { title: 'Course Management',      subtitle: 'Create, edit, and organize system courses and materials.' },
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' }
    };

    const currentPage = window.location.pathname.split('/').pop() || 'instructors.html';
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