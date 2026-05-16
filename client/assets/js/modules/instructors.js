// client/assets/js/modules/instructors.js

$(document).ready(function () {

    // ── Load UI Components ──────────────────────────────────────────────────
    $('#sidebar-placeholder').load('../components/sidebar.html');
    $('#header-placeholder').load('../components/header.html', function (res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/instructors.php';

    // ── Global Pagination State ──────────────────────────────────────────────
    let _allInstructorsRaw   = [];
    let _filteredInstructors = [];
    let _currentPage         = 1;
    const _itemsPerPage      = 50;

    let currentView = localStorage.getItem('instructorViewPref') || 'grid';

    // ── Initial load ────────────────────────────────────────────────────────
    fetchInstructors();

    // ── Filter listeners ────────────────────────────────────────────────────
    $('#instSearch').on('input', filterInstructors);
    $('#instDeptFilter').on('change', filterInstructors);
    $('#instClassFilter').on('change', filterInstructors);

    // ── Refresh button ──────────────────────────────────────────────────────
    $('#btnSyncHris').on('click', function () {
        const $btn         = $(this);
        const originalHtml = $btn.html();

        $btn.html('<i class="fas fa-spinner fa-spin me-1 me-md-2"></i><span class="d-none d-sm-inline">Refreshing...</span>')
            .prop('disabled', true);

        fetchInstructors(function () {
            $btn.html(originalHtml).prop('disabled', false);
            showToast('Instructor list refreshed.', 'success');
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // API CALLS
    // ════════════════════════════════════════════════════════════════════════

    function fetchInstructors(onComplete) {
        $.ajax({
            url     : `${API_URL}?action=get_all`,
            method  : 'GET',
            dataType: 'json',
            success : function (json) {
                if (json.status === 'success') {
                    _allInstructorsRaw = json.data || [];
                    populateSelects(json.departments);
                    filterInstructors();
                    if (typeof onComplete === 'function') onComplete();
                } else {
                    showToast(json.message || 'Failed to load instructors.', 'error');
                    if (typeof onComplete === 'function') onComplete();
                }
            },
            error: function (xhr, status, error) {
                console.error('AJAX Error:', xhr.responseText || error);
                showToast('Server error loading instructors.', 'error');
                if (typeof onComplete === 'function') onComplete();
            }
        });
    }

  // ── Generate Temporary Password ─────────────────────────────────────────
window.generatePassword = function (employeeId) {
    // 1. Initial Confirmation Modal (Replacing native confirm)
    Swal.fire({
        title: 'Generate New Key?',
        text: "This will override the instructor's current password with a new temporary one.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1e293b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, generate'
    }).then((result) => {
        if (!result.isConfirmed) return;

        // Perform AJAX to generate the password
        $.ajax({
            url: `${API_URL}?action=generate_password`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ employee_id: employeeId }),
            dataType: 'json',
            success: function (res) {
                if (res.status === 'success') {
                    // 2. Success Modal with Password and Email Button
                    Swal.fire({
                        icon: 'success',
                        title: 'Login Activated!',
                        allowOutsideClick: false, // Prevents closing without finishing
                        html: `
                            <p>Give these credentials to <strong>${res.instructor_name}</strong>:</p>
                            <div class="p-3 bg-light border rounded mt-3 text-center"
                                 style="font-family:monospace;font-size:1.5rem;letter-spacing:3px;">
                                <strong>${res.temp_password}</strong>
                            </div>
                            <p class="text-muted small mt-3">
                                They will use their official email and this password to log in.
                            </p>
                            <hr class="swal-divider">
                            <p class="swal-email-hint">Want to send the credentials directly to their inbox?</p>
                            <button id="swalSendEmailBtn"
                                    class="swal-email-btn"
                                    data-email="${res.instructor_email}"
                                    data-name="${res.instructor_name}"
                                    data-pass="${res.temp_password}">
                                <i class="fas fa-envelope me-2"></i>Send Credentials via Email
                            </button>
                            <div id="swalEmailStatus" class="mt-2"></div>`,
                        confirmButtonText: 'Done',
                        confirmButtonColor: '#1e293b',
                        didOpen: () => {
                            // 3. Disable the "Done" button immediately upon opening
                            const doneBtn = Swal.getConfirmButton();
                            doneBtn.disabled = true;

                            // Email Sending Logic
                            document.getElementById('swalSendEmailBtn').addEventListener('click', function () {
                                const btn = this;
                                const email = btn.dataset.email;
                                const name = btn.dataset.name;
                                const password = btn.dataset.pass;
                                const $status = $('#swalEmailStatus');

                                btn.disabled = true;
                                btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending…';

                                $.ajax({
                                    url: `${API_URL}?action=send_credentials_email`,
                                    method: 'POST',
                                    contentType: 'application/json',
                                    data: JSON.stringify({
                                        employee_id: employeeId,
                                        email: email,
                                        name: name,
                                        temp_password: password
                                    }),
                                    dataType: 'json',
                                    success: function (emailRes) {
                                        if (emailRes.status === 'success') {
                                            btn.innerHTML = '<i class="fas fa-check me-2"></i>Email Sent!';
                                            btn.classList.add('sent');
                                            $status.html(
                                                `<span class="text-success small">
                                                    <i class="fas fa-check-circle me-1"></i>
                                                    Sent to <strong>${email}</strong>
                                                </span>`
                                            );

                                            // 4. ENABLE the "Done" button now that email is sent
                                            doneBtn.disabled = false;
                                        } else {
                                            btn.disabled = false;
                                            btn.innerHTML = '<i class="fas fa-envelope me-2"></i>Send Credentials via Email';
                                            $status.html(`<span class="text-danger small">${emailRes.message}</span>`);
                                        }
                                    },
                                    error: function () {
                                        btn.disabled = false;
                                        btn.innerHTML = '<i class="fas fa-envelope me-2"></i>Send Credentials via Email';
                                        $status.html('<span class="text-danger small">Server error. Try again.</span>');
                                    }
                                });
                            });
                        }
                    });
                } else {
                    Swal.fire('Error', res.message, 'error');
                }
            },
            error: function () {
                Swal.fire('Error', 'Server error while generating password.', 'error');
            }
        });
    });
};

    // ════════════════════════════════════════════════════════════════════════
    // VIEW TOGGLE
    // ════════════════════════════════════════════════════════════════════════

    window.toggleView = function (viewType) {
        currentView = viewType;
        localStorage.setItem('instructorViewPref', viewType);

        if (viewType === 'list') {
            $('#gridView').hide();
            $('#tableView').show();
            $('#btnGrid').removeClass('active');
            $('#btnList').addClass('active');
        } else {
            $('#tableView').hide();
            $('#gridView').css('display', 'flex');
            $('#btnList').removeClass('active');
            $('#btnGrid').addClass('active');
        }
    };

    function toggleEmptyState() {
        if (_filteredInstructors.length === 0) {
            $('#noResultsMsg').show();
            $('#gridView, #tableView').hide();
        } else {
            $('#noResultsMsg').hide();
            if (currentView === 'list') {
                $('#gridView').hide();
                $('#tableView').css('display', 'flex');
            } else {
                $('#tableView').hide();
                $('#gridView').css('display', 'flex');
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // FILTERING & PAGINATION
    // ════════════════════════════════════════════════════════════════════════

    function filterInstructors() {
        const q    = $('#instSearch').val().toLowerCase().trim();
        const dept = $('#instDeptFilter').val().toLowerCase();
        const clsF = $('#instClassFilter').val();

        _filteredInstructors = _allInstructorsRaw.filter(row => {
            const name    = (`${row.first_name} ${row.last_name}`).toLowerCase();
            const email   = (row.email || '').toLowerCase();
            const deptVal = (row.dept_name || '').toLowerCase();
            const classes = parseInt(row.class_count) || 0;

            const nameOk = !q || name.includes(q) || email.includes(q) || deptVal.includes(q);
            const deptOk = !dept || deptVal === dept;
            let   clsOk  = true;

            if (clsF === '0') clsOk = classes === 0;
            else if (clsF === '1') clsOk = classes >= 1;
            else if (clsF === '3') clsOk = classes >= 3;

            return nameOk && deptOk && clsOk;
        });

        _currentPage = 1;
        renderTablePage();
    }

    function renderTablePage() {
        const $gridContent = $('#gridView');
        const $tbody       = $('#instTableBody');

        $gridContent.empty();
        $tbody.empty();

        const total = _filteredInstructors.length;
        $('#instCountNum').text(total);

        toggleEmptyState();

        if (total === 0) {
            updatePaginationUI(0);
            return;
        }

        const start    = (_currentPage - 1) * _itemsPerPage;
        const pageData = _filteredInstructors.slice(start, start + _itemsPerPage);

        let gridHtml = '';
        let listHtml = '';

        pageData.forEach(row => {
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.first_name + '+' + row.last_name)}&background=0ea5e9&color=fff&bold=true`;

            let genderStr = '—';
            const g = (row.gender || '').toLowerCase();
            if (g === 'm' || g === 'male')   genderStr = 'Male';
            if (g === 'f' || g === 'female') genderStr = 'Female';
            if (g === 'other')               genderStr = 'Other';

            const badgeClass = row.class_count > 0
                ? 'bg-primary-subtle text-primary'
                : 'bg-secondary-subtle text-secondary';

            // ── Grid card ──────────────────────────────────────────────────
            gridHtml +=
            `<div class="instructor-card-container">
                <div class="faculty-card shadow-sm h-100 p-4 bg-white rounded-4 d-flex flex-column">
                    <div class="d-flex align-items-center mb-3">
                        <img src="${avatarUrl}&size=80"
                             class="rounded-circle border me-3 shadow-sm flex-shrink-0"
                             width="56" height="56">
                        <div style="min-width:0;">
                            <h6 class="fw-bold mb-0 text-dark text-truncate">
                                ${row.first_name} ${row.last_name}
                            </h6>
                            <small class="text-primary fw-bold">${row.pos_title || 'Instructor'}</small>
                        </div>
                    </div>
                    <div class="bg-light rounded-3 p-3 mb-3 flex-grow-1">
                        <div class="row g-2">
                            <div class="col-6">
                                <div class="info-label">Department</div>
                                <small class="fw-medium text-dark"
                                       style="display:-webkit-box;-webkit-line-clamp:2;
                                              -webkit-box-orient:vertical;overflow:hidden;min-height:2.4rem;">
                                    ${row.dept_name || 'Unassigned'}
                                </small>
                            </div>
                            <div class="col-6">
                                <div class="info-label">Gender</div>
                                <small class="fw-medium text-dark d-block" style="min-height:2.4rem;">${genderStr}</small>
                            </div>
                            <div class="col-12 mt-1">
                                <div class="info-label">Email</div>
                                <small class="fw-medium text-dark text-truncate d-block" style="min-height:1.4rem;">
                                    ${row.email || '—'}
                                </small>
                            </div>
                            <div class="col-6 mt-1">
                                <div class="info-label">Classes</div>
                                <small class="fw-medium text-dark d-block" style="min-height:1.4rem;">
                                    <span class="badge ${badgeClass} rounded-pill">${row.class_count} assigned</span>
                                </small>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex gap-2 flex-wrap mt-auto">
                        <button class="btn-gen-pass flex-grow-1 fw-bold justify-content-center"
                                onclick="generatePassword(${row.employee_id})">
                            <i class="fas fa-key me-1"></i> Password
                        </button>
                    </div>
                </div>
            </div>`;

            // ── List row ───────────────────────────────────────────────────
            listHtml += `
            <tr class="inst-table-row">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-2">
                        <img src="${avatarUrl}&size=40"
                             class="rounded-circle border flex-shrink-0" width="38" height="38">
                        <div style="min-width:0;">
                            <div class="fw-bold text-dark text-truncate">${row.first_name} ${row.last_name}</div>
                            <div class="text-primary" style="font-size:.72rem;font-weight:600;">
                                ${row.pos_title || 'Instructor'}
                            </div>
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
                    <button class="btn-gen-pass"
                            onclick="generatePassword(${row.employee_id})">
                        <i class="fas fa-key"></i> Key
                    </button>
                </td>
            </tr>`;
        });

        $gridContent.html(gridHtml);
        $tbody.html(listHtml);

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

    window.changePage = function (p) {
        _currentPage = p;
        renderTablePage();
        $('#gridView, .table-scroll-wrapper').scrollTop(0);
    };

    function populateSelects(depts) {
        let html = '<option value="">All Departments</option>';
        (depts || []).forEach(d => {
            html += `<option value="${d.name.toLowerCase()}">${d.name}</option>`;
        });
        $('#instDeptFilter').html(html);
    }

    // ════════════════════════════════════════════════════════════════════════
    // TOASTS
    // ════════════════════════════════════════════════════════════════════════

    function showToast(msg, type) {
        $('#toast').remove();
        const bgClass     = type === 'error' ? '' : 'toast-ok';
        const icon        = type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle';
        const customStyle = type === 'error'
            ? 'background:#fee2e2;color:#be123c;border:1px solid #fecdd3;'
            : '';

        $('body').append(`
            <div id="toast" class="toast-bar ${bgClass}" style="${customStyle}">
                <i class="fas ${icon}"></i> ${msg}
            </div>`);
        setTimeout(() => $('#toast').css('opacity', '0'), 3500);
        setTimeout(() => $('#toast').remove(), 4000);
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// HEADER & SESSION LOGIC
// ═════════════════════════════════════════════════════════════════════════════

const AUTH_API = 'https://artisanslms.onrender.com/backend/index.php';

function initHeader() {
    const PAGE_TITLES = {
        'dashboard.html'             : { title: 'Dashboard',             subtitle: 'Overview of your academic progress and activities.' },
        'collaborations.html'        : { title: 'Collaboration Spaces',  subtitle: 'Select a class to enter the live chat and video space.' },
        'messages.html'              : { title: 'Direct Messages',       subtitle: 'Communicate privately with instructors and peers.' },
        'my_grades.html'             : { title: 'My Grades',             subtitle: 'Track your academic performance and feedback.' },
        'my_analytics.html'          : { title: 'Achievement Board',     subtitle: 'View your milestones, badges, and learning statistics.' },
        'instructor_dashboard.html'  : { title: 'Instructor Dashboard',  subtitle: 'Manage your assigned courses and student spaces.' },
        'instructor_courses.html'    : { title: 'Course Materials',      subtitle: 'Upload and organize files, lectures, and resources.' },
        'instructor_assignments.html': { title: 'Task Manager',          subtitle: 'Create and manage assignments for your assigned classes.' },
        'students.html'              : { title: 'Manage Students',       subtitle: 'Manage student profiles, accounts, and records.' },
        'instructors.html'           : { title: 'Master Instructors',    subtitle: 'Manage faculty accounts, profiles, and subject loads.' },
        'enrollment.html'            : { title: 'Student Enrollment',    subtitle: 'Manage and track student class enrollments.' },
        'classes.html'               : { title: 'Class Management',      subtitle: 'Create and manage class sections by course.' },
        'courses.html'               : { title: 'Course Management',     subtitle: 'Create, edit, and organize system courses and materials.' },
        'reports.html'               : { title: 'System Reports',        subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html'               : { title: 'My Profile',            subtitle: 'Manage your personal information and account settings.' },
        'archived.html'              : { title: 'Archives',              subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
    };

    const currentPage = window.location.pathname.split('/').pop() || 'instructors.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };

    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url        : AUTH_API,
        method     : 'POST',
        xhrFields  : { withCredentials: true },
        contentType: 'application/json',
        dataType   : 'json',
        data       : JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success    : function (res) {
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
        error: function () {
            window.location.href = '/client/pages/login.html';
        }
    });

    $(document).on('click', '#logoutBtn', function (e) {
        e.preventDefault();
        $.ajax({
            url        : AUTH_API,
            method     : 'POST',
            contentType: 'application/json',
            dataType   : 'json',
            xhrFields  : { withCredentials: true },
            data       : JSON.stringify({ route: 'auth', action: 'logout' }),
            complete   : function () { window.location.href = '/client/pages/login.html'; }
        });
    });
}