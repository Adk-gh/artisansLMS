$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/api/instructors.php'; // ensure this path matches your setup

    let instructorsData = [];
    let currentView = localStorage.getItem('instructorViewPref') || 'grid';

    // ── INITIAL LOAD ──
    fetchInstructors();
    applyView(currentView); // apply view without triggering filter (data not loaded yet)

    // ── EVENT LISTENERS ──
    $('#instSearch').on('input', filterInstructors);
    $('#instDeptFilter').on('change', filterInstructors);
    $('#instClassFilter').on('change', filterInstructors);

    // Trigger HRIS Sync
    $('#btnSyncHris').on('click', function() {
        const $btn = $(this);
        const originalHtml = $btn.html();
        
        // Add loading spinner
        $btn.html('<i class="fas fa-spinner fa-spin me-1 me-md-2"></i><span class="d-none d-sm-inline">Syncing...</span>').prop('disabled', true);

        $.ajax({
            url: `${API_URL}?action=sync_hris`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                $btn.html(originalHtml).prop('disabled', false);
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    fetchInstructors(); // Reload the table with fresh data
                } else {
                    showToast(json.message || "Sync failed.", "error");
                }
            },
            error: function(xhr) {
                $btn.html(originalHtml).prop('disabled', false);
                let errMsg = "Server error during sync.";
                if(xhr.responseJSON && xhr.responseJSON.message) errMsg = xhr.responseJSON.message;
                showToast(errMsg, "error");
            }
        });
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
                    populateSelects(json.departments);
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

    // Generate Temporary Password
    window.generatePassword = function(employeeId) {
        if (!confirm("Generate a new temporary password for this instructor?")) return;

        $.ajax({
            url: `${API_URL}?action=generate_password`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ employee_id: employeeId }),
            dataType: 'json',
            success: function(res) {
                if (res.status === 'success') {
                    // Use SweetAlert to prominently display the password
                    Swal.fire({
                        icon: 'success',
                        title: 'Login Activated!',
                        html: `
                            <p>Give these credentials to <strong>${res.instructor_name}</strong>:</p>
                            <div class="p-3 bg-light border rounded mt-3 text-center" style="font-family: monospace; font-size: 1.5rem; letter-spacing: 3px;">
                                <strong>${res.temp_password}</strong>
                            </div>
                            <p class="text-muted small mt-3">They will use their official email and this password to log in.</p>
                        `,
                        confirmButtonText: 'Done'
                    });
                } else {
                    Swal.fire('Error', res.message, 'error');
                }
            },
            error: function() {
                Swal.fire('Error', 'Server error while generating password.', 'error');
            }
        });
    };

    window.archiveInstructor = function(id, name, classCount) {
        let msg = `Archive ${name}?\n`;
        msg += classCount > 0
            ? `⚠️ They have ${classCount} assigned class(es) which will also be removed.`
            : `Their record will be saved to Archives.`;

        if (!confirm(msg)) return;

        $.ajax({
            url: `${API_URL}?action=archive`,
            method: 'POST',
            xhrFields: { withCredentials: true },
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
            $('#gridView').css('display', 'flex');
            $('#btnList').removeClass('active');
            $('#btnGrid').addClass('active');
        }
    }

    window.toggleView = function(viewType) {
        applyView(viewType);
        filterInstructors();
    };

    // ── DOM RENDERING ──
    function populateSelects(depts) {
        // Filter bar — value is the lowercased name for matching data-dept
        let dFilterHtml = '<option value="">All Departments</option>';
        depts.forEach(d => {
            dFilterHtml += `<option value="${d.name.toLowerCase()}">${d.name}</option>`;
        });
        $('#instDeptFilter').html(dFilterHtml);
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
            // HRIS gives us date format that might need parsing, assuming YYYY-MM-DD
            const hireStr    = row.hire_date
                ? new Date(row.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
            const badgeClass = row.class_count > 0 ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary';

            // ── Grid card ──
            gridHtml += `
            <div class="col-12 col-sm-6 col-xl-4 inst-card-col"
                 data-name="${nameLower}"
                 data-email="${emailLower}"
                 data-dept="${deptLower}"
                 data-classes="${row.class_count}">
                <div class="faculty-card shadow-sm h-100 p-4 bg-white rounded-4 d-flex flex-column">
                     <div class="d-flex align-items-center mb-3">
                        <img src="${avatarUrl}&size=80" class="rounded-circle border me-3 shadow-sm flex-shrink-0" width="56" height="56">
                        <div style="min-width:0;">
                            <h6 class="fw-bold mb-0 text-dark text-truncate">${row.first_name} ${row.last_name}</h6>
                            <small class="text-primary fw-bold">${row.pos_title || 'Instructor'}</small>
                        </div>
                    </div>
                    <div class="bg-light rounded-3 p-3 mb-3 flex-grow-1">
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="info-label">Department</div>
                                <small class="fw-medium text-dark" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.4rem;">${row.dept_name || 'Unassigned'}</small>
                            </div>
                            <div class="col-6">
                                <div class="info-label">Gender</div>
                                <small class="fw-medium text-dark d-block" style="min-height:2.4rem;">${genderStr}</small>
                            </div>
                            <div class="col-12 mt-1">
                                <div class="info-label">Email</div>
                                <small class="fw-medium text-dark text-truncate d-block" style="min-height:1.4rem;">${row.email || '—'}</small>
                            </div>
                            <div class="col-6 mt-1">
                                <div class="info-label">Classes</div>
                                <small class="fw-medium text-dark d-block" style="min-height:1.4rem;"><span class="badge ${badgeClass} rounded-pill">${row.class_count} assigned</span></small>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex gap-2 flex-wrap mt-auto">
                        <button class="btn-gen-pass flex-grow-1 fw-bold justify-content-center" onclick="generatePassword(${row.employee_id})">
                            <i class="fas fa-key me-1"></i> Password
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
                <td class="text-end pe-4">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                        <button class="btn-gen-pass" onclick="generatePassword(${row.employee_id})"><i class="fas fa-key"></i> Key</button>
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
            const name    = $el.attr('data-name')    || '';  
            const email   = $el.attr('data-email')   || '';
            const deptVal = $el.attr('data-dept')    || '';  
            const classes = parseInt($el.attr('data-classes')) || 0;

            const nameOk  = !q || name.includes(q) || email.includes(q) || deptVal.includes(q);
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

        if (currentView === 'grid') {
            if (visible === 0) $('#noResultsGrid').addClass('show').show();
            else               $('#noResultsGrid').removeClass('show').hide();
        } else {
            if (visible === 0) $('#noResultsList').addClass('show').show();
            else               $('#noResultsList').removeClass('show').hide();
        }
    }

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
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json', xhrFields: { withCredentials: true },
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/client/pages/login.html'; }
        });
    });
}