let _enrolledData  = {};
let _allClasses    = [];
let _allStudents   = [];   // full dataset for pagination
let _filteredStudents = []; // after filters applied
let _currentPage   = 1;
const PAGE_SIZE    = 50;
let _allStudentsOptions = []; // Stores all options for modal search

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const $wrap      = $('#paginationWrap');
    const $controls  = $('#paginationControls');
    const $info      = $('#pageInfo');

    if (total === 0) {
        $wrap.hide();
        return;
    }

    $wrap.css('display', 'flex');

    const start = (_currentPage - 1) * PAGE_SIZE + 1;
    const end   = Math.min(_currentPage * PAGE_SIZE, total);
    $info.text(`Showing ${start}–${end} of ${total} students`);

    let html = '';

    // Prev button
    html += `<button class="page-btn" id="prevPage" ${_currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left" style="font-size:.7rem;"></i>
             </button>`;

    // Page number buttons — show max 5 around current
    const maxBtns  = 5;
    let   startPg  = Math.max(1, _currentPage - Math.floor(maxBtns / 2));
    let   endPg    = Math.min(totalPages, startPg + maxBtns - 1);
    if (endPg - startPg < maxBtns - 1) startPg = Math.max(1, endPg - maxBtns + 1);

    if (startPg > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPg > 2) html += `<span class="page-info px-1">…</span>`;
    }

    for (let p = startPg; p <= endPg; p++) {
        html += `<button class="page-btn ${p === _currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    if (endPg < totalPages) {
        if (endPg < totalPages - 1) html += `<span class="page-info px-1">…</span>`;
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    html += `<button class="page-btn" id="nextPage" ${_currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right" style="font-size:.7rem;"></i>
             </button>`;

    $controls.html(html);

    // Events
    $controls.find('[data-page]').on('click', function () {
        _currentPage = parseInt($(this).data('page'));
        applyFiltersAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#prevPage').on('click', function () {
        if (_currentPage > 1) { _currentPage--; applyFiltersAndRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });

    $('#nextPage').on('click', function () {
        if (_currentPage < totalPages) { _currentPage++; applyFiltersAndRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
}

// ── Filter + paginate ─────────────────────────────────────────────────────────
function applyFiltersAndRender() {
    const q     = $('#enrollSearch').val().toLowerCase().trim();
    const cf    = $('#enrollClassFilter').val();
    const statf = $('#enrollStatusFilter').val();
    const df    = $('#enrollDeptFilter').val();

    _filteredStudents = _allStudents.filter(student => {
        const name     = (student.name || '').toLowerCase();
        const sid      = String(student.student_id);
        const sDeptId  = String(student.dept_id || '');
        const count    = student.classes.length;
        const statuses = [...new Set(student.classes.map(c => c.status))];

        const nameOk   = !q     || name.includes(q) || sid.includes(q);
        const statusOk = !statf || statuses.includes(statf);
        const deptOk   = !df    || sDeptId === df;

        let cntOk = true;
        if      (cf === '1') cntOk = count === 1;
        else if (cf === '2') cntOk = count === 2;
        else if (cf === '3') cntOk = count >= 3;

        return nameOk && cntOk && statusOk && deptOk;
    });

    _currentPage = Math.min(_currentPage, Math.ceil(_filteredStudents.length / PAGE_SIZE)) || 1;

    const start   = (_currentPage - 1) * PAGE_SIZE;
    const pageData = _filteredStudents.slice(start, start + PAGE_SIZE);

    $('#enrollCountNum').text(_filteredStudents.length);
    renderTablePage(pageData, _filteredStudents.length);
    renderPagination(_filteredStudents.length);
}

function filterEnrollment() {
    _currentPage = 1;
    applyFiltersAndRender();
}
window.filterEnrollment = filterEnrollment;

// ── Modal Class Filter ────────────────────────────────────────────────────────
function filterModalClasses() {
    const sid = $('#studentSelect').val();
    if (!sid) return;

    const targetDept = String($('#studentSelect').data('current-dept') || '');
    const q = $('#modalClassSearch').val().toLowerCase().trim();
    const already = _enrolledData[sid] || [];
    let count = 0;

    const $helperText = $('#enrollmentHelperText');

    $('.class-check-wrapper').each(function () {
        const $wrap = $(this);
        const cid = $wrap.attr('data-class-id');
        const cDept = String($wrap.attr('data-dept') || '');

        if (already.includes(cid)) {
            $wrap.addClass('d-none');
            $wrap.find('input').prop('disabled', true);
            return;
        }

        $wrap.find('input').prop('disabled', false);

        const nameData = $wrap.attr('data-name') || '';
        const matchSearch = !q || nameData.includes(q);

        const matchDept = (targetDept === "" || cDept === targetDept);

        if (matchSearch && matchDept) {
            $wrap.removeClass('d-none');
            count++;
        } else {
            $wrap.addClass('d-none');
        }
    });

    if (count === 0 && !q) {
        $helperText.removeClass('d-none').html("<span class='text-danger fw-bold'>This student is already enrolled in all active classes!</span>");
    } else if (count === 0) {
        $helperText.removeClass('d-none').html("<span class='text-muted fst-italic'>No classes match your filter.</span>");
    } else {
        $helperText.addClass('d-none');
    }
}

$(document).ready(function () {

    $('#sidebar-placeholder').load('../components/sidebar.html');
    $('#header-placeholder').load('../components/header.html', function (res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL      = '../../backend/endpoints/enrollments.php';
    let enrollModalObj = null;

    const enrollEl = document.getElementById('enrollModal');
    if (enrollEl) enrollModalObj = new bootstrap.Modal(enrollEl);

    // Reset search bar when modal is closed
    if (enrollEl) {
        enrollEl.addEventListener('hidden.bs.modal', function () {
            $('#modalStudentSearch').val('');
            $('#modalStudentSearch').trigger('input');
        });
    }

    fetchEnrollments();
    fetchFormData();

    $('#enrollSearch, #enrollClassFilter, #enrollStatusFilter').on('input change', filterEnrollment);
    $('#modalClassSearch').on('input', filterModalClasses);
    $('#modalClassDept').on('change', filterModalClasses);
    $('#enrollForm').on('submit', handleEnrollmentSubmit);

    // ── Modal Student Search Filter (Max 50) ──
    $('#modalStudentSearch').on('input', function() {
        const query = $(this).val().toLowerCase().trim();
        const $select = $('#studentSelect');
        const currentVal = $select.val();

        $select.empty();

        // Always append the default placeholder option
        $select.append(_allStudentsOptions.filter('option[value=""]').clone());

        let count = 0;

        _allStudentsOptions.each(function() {
            if ($(this).val() === "") return; // Skip placeholder in loop

            const searchData = $(this).attr('data-search') || '';
            if (!query || searchData.includes(query)) {
                if (count < 50) {
                    $select.append($(this).clone());
                    count++;
                }
            }
        });

        // Try to keep previous selection active if it's still in the list
        if ($select.find(`option[value="${currentVal}"]`).length) {
            $select.val(currentVal);
        } else {
            $select.val('');
            $select.trigger('change');
        }
    });

    $('#studentSelect').on('change', function () {
        const $selectedOption = $(this).find('option:selected');
        const sid = $(this).val();
        const deptId = $selectedOption.attr('data-dept') || '';

        $(this).data('current-dept', deptId);

        const $helperText = $('#enrollmentHelperText');
        const $filterRow  = $('#modalClassFilters');

        $('#modalClassSearch').val('');
        $('#modalClassDept').val(deptId).prop('disabled', true);

        if (!sid) {
            $filterRow.attr('style', 'display: none !important');
            $('.class-check-wrapper').addClass('d-none');
            $('.class-checkbox').prop('checked', false);
            $helperText.removeClass('d-none').text('Select a student to view available classes.');
            return;
        }

        $filterRow.attr('style', 'display: flex !important');
        $helperText.addClass('d-none');
        $('.class-checkbox').prop('checked', false);

        filterModalClasses();
    });

    // ── API ───────────────────────────────────────────────────────────────────
    function fetchEnrollments() {
        $.ajax({
            url: `${API_URL}?action=get_all`,
            method: 'GET',
            dataType: 'json',
            success: function (json) {
                if (json.status === 'success') {
                    _allStudents = json.data;
                    _archivesData = json.archives;

                    if (json.departments) {
                        let dHtml = '<option value="">All Departments</option>';
                        json.departments.forEach(d => {
                            dHtml += `<option value="${d.department_id}">${d.name}</option>`;
                        });
                        $('#enrollDeptFilter').html(dHtml);
                    }

                    applyFiltersAndRender();
                } else {
                    showToast(json.message || 'Failed to load enrollments.', 'error');
                }
            },
            error: function (xhr) {
                console.error('fetchEnrollments error:', xhr.responseText);
                showToast('Server error loading enrollments.', 'error');
            }
        });
    }

    function fetchFormData() {
        $.ajax({
            url: `${API_URL}?action=get_form_data`,
            method: 'GET',
            dataType: 'json',
            success: function (json) {
                if (json.status === 'success') {
                    _enrolledData = json.enrollments;
                    _allClasses   = json.classes;
                    populateStudentSelect(json.students);
                    populateClassCheckboxes();
                }
            }
        });
    }

    function handleEnrollmentSubmit(e) {
        e.preventDefault();
        const studentId = $('#studentSelect').val();
        const classIds  = [];
        $('#checkboxList input[type=checkbox]:checked').each(function () {
            classIds.push($(this).val());
        });

        if (!studentId || classIds.length === 0) {
            showToast('Please select a student and at least one class.', 'error');
            return;
        }

        $.ajax({
            url: `${API_URL}?action=enroll`,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            data: JSON.stringify({ student_id: studentId, class_ids: classIds }),
            dataType: 'json',
            success: function (json) {
                if (json.status === 'success') {
                    showToast(json.message, 'success');
                    if (enrollModalObj) enrollModalObj.hide();
                    $('#enrollForm')[0].reset();
                    $('#studentSelect').trigger('change');
                    $('#modalStudentSearch').val(''); // Clear modal search
                    fetchEnrollments();
                    fetchFormData();
                } else {
                    showToast(json.message, 'error');
                }
            },
            error: function (xhr) {
                console.error('Enroll error:', xhr.responseText);
                showToast('An error occurred while enrolling.', 'error');
            }
        });
    }

    window.handleDrop = function (enrollmentId, studentName, courseCode) {
        if (!confirm(`Drop ${studentName} from ${courseCode}?\nThis will be saved to Archives.`)) return;
        $.ajax({
            url: `${API_URL}?action=drop`,
            method: 'POST',
            xhrFields: { withCredentials: true },
            contentType: 'application/json',
            data: JSON.stringify({ enrollment_id: enrollmentId }),
            dataType: 'json',
            success: function (json) {
                showToast(json.message, json.status === 'success' ? 'success' : 'error');
                if (json.status === 'success') { fetchEnrollments(); fetchFormData(); }
            }
        });
    };

    function populateStudentSelect(students) {
        let html = '<option value="">-- Choose Student --</option>';
        students.forEach(s => {
            const searchString = `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase();
            html += `<option value="${s.student_id}" data-dept="${s.department_id || ''}" data-search="${searchString}">
                        ${s.last_name}, ${s.first_name} (ID: ${s.student_id})
                     </option>`;
        });

        const $select = $('#studentSelect');
        $select.html(html);

        // Clone and save ALL options to memory
        _allStudentsOptions = $select.find('option').clone();

        // Immediately limit the initial DOM display to 50 items
        $select.empty();
        let count = 0;
        _allStudentsOptions.each(function() {
            if ($(this).val() === "" || count < 50) {
                $select.append($(this).clone());
                if ($(this).val() !== "") count++;
            }
        });
    }

    function populateClassCheckboxes() {
        const $list = $('#checkboxList');
        let cHtml = '';
        let depts  = {};

        _allClasses.forEach(c => {
            const deptId   = c.department_id || '';
            const deptName = c.dept_name     || 'Unassigned';
            if (deptId) depts[deptId] = deptName;

            cHtml += `
                <label class="class-check-item class-check-wrapper d-none"
                       data-class-id="${c.class_id}"
                       data-name="${(c.name + ' ' + c.course_code + ' ' + deptName).toLowerCase()}"
                       data-dept="${deptId}">
                    <input class="form-check-input class-checkbox" type="checkbox" value="${c.class_id}">
                    <div class="ms-2">
                        <div class="fw-bold small" style="color:#1e293b;">${c.course_code} - ${c.name}</div>
                        <div class="text-muted" style="font-size: 0.72rem;">Prof. ${c.last_name} &bull; <span class="badge bg-secondary-subtle text-secondary" style="font-size:.6rem">${deptName}</span></div>
                    </div>
                </label>`;
        });

        $list.html(cHtml);

        let dHtml = '<option value="">All Depts</option>';
        for (let id in depts) dHtml += `<option value="${id}">${depts[id]}</option>`;
        $('#modalClassDept').html(dHtml);

        $list.off('change').on('change', '.class-checkbox', function () {
            const checked  = $list.find('.class-checkbox:checked').length;
            const $counter = $('#selectedCount');
            if (checked > 0) $counter.show().find('span').text(checked);
            else             $counter.hide();
        });
    }

    function buildCheckboxList(sid) {
        $('#selectedCount').hide();
    }

    function showToast(msg, type) {
        $('#toast').remove();
        const ok     = type === 'success';
        const bg     = ok ? '#dcfce7' : '#fee2e2';
        const color  = ok ? '#15803d' : '#be123c';
        const border = ok ? '#bbf7d0' : '#fecdd3';
        const icon   = ok ? 'fa-check-circle' : 'fa-exclamation-triangle';
        $('body').append(`
            <div id="toast" class="toast-bar" style="background:${bg};color:${color};border:1px solid ${border};">
                <i class="fas ${icon}"></i> ${msg}
            </div>`);
        setTimeout(() => $('#toast').css('opacity', '0'), 3500);
        setTimeout(() => $('#toast').remove(), 4000);
    }
});

// ── Table Renderer (page slice only) ─────────────────────────────────────────
let _archivesData = {};

function renderTablePage(pageData, totalFiltered) {
    const $tbody = $('#enrollBody');
    $tbody.empty();

    if (totalFiltered === 0) {
        $tbody.html(`<tr><td colspan="4" class="text-center py-5 text-muted small">No enrollments found.</td></tr>`);
        return;
    }

    if (pageData.length === 0) {
        $tbody.html(`<tr><td colspan="4" class="text-center py-5 text-muted small">No students on this page.</td></tr>`);
        return;
    }

    pageData.forEach(student => {
        const sid        = student.student_id;
        const classCount = student.classes.length;
        const statuses   = [...new Set(student.classes.map(c => c.status))].join(',');
        const archiveHtml = buildArchiveHtml(sid, _archivesData);

        let classesHtml = '';
        student.classes.forEach(cls => {
            const dateStr = cls.enroll_date
                ? new Date(cls.enroll_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '<span class="text-danger">No Date</span>';

            const statusMap = {
                'Pending Finance': `<span class="status-badge status-pending"><i class="fas fa-clock" style="font-size:.6rem;"></i> Pending Finance</span>`,
                'Approved':        `<span class="status-badge status-approved"><i class="fas fa-check-circle" style="font-size:.6rem;"></i> Approved</span>`,
                'Rejected':        `<span class="status-badge status-rejected"><i class="fas fa-times-circle" style="font-size:.6rem;"></i> Rejected</span>`
            };
            const statusBadge = statusMap[cls.status] || '';

            const safeStudentName = (student.name || '').replace(/'/g, "\\'");
            const safeCourseCode  = (cls.course_code || '').replace(/'/g, "\\'");

            let actionBtns = '';
            if (cls.status === 'Approved') {
                actionBtns = `<button type="button" class="btn-drop"
                    onclick="handleDrop(${cls.enrollment_id},'${safeStudentName}','${safeCourseCode}')">
                    <i class="fas fa-archive"></i> Drop
                </button>`;
            } else if (cls.status === 'Pending Finance') {
                actionBtns = `<span class="finance-notice" style="font-size:.65rem;">
                    <i class="fas fa-university"></i> Awaiting Finance
                </span>`;
            }

            classesHtml += `
            <tr>
                <td class="ps-3 py-2">
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <span class="badge bg-info-subtle text-info" style="min-width:70px;text-align:center;">${cls.course_code}</span>
                        <span class="small fw-medium text-dark">${cls.course_name}</span>
                    </div>
                </td>
                <td class="small text-muted py-2">Prof. ${cls.prof}</td>
                <td class="py-2" style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:#64748b;">${cls.semester} ${cls.year}</td>
                <td class="py-2">${statusBadge}</td>
                <td class="small text-muted py-2">${dateStr}</td>
                <td class="text-end pe-3 py-2">${actionBtns}</td>
            </tr>`;
        });

        const hasPending  = student.classes.some(c => c.status === 'Pending Finance');
        const hasRejected = student.classes.some(c => c.status === 'Rejected');
        const summaryBadge = hasPending
            ? `<span class="status-badge status-pending"><i class="fas fa-clock" style="font-size:.6rem;"></i> Has Pending</span>`
            : hasRejected
            ? `<span class="status-badge status-rejected"><i class="fas fa-times-circle" style="font-size:.6rem;"></i> Has Rejected</span>`
            : `<span class="status-badge status-approved"><i class="fas fa-check-circle" style="font-size:.6rem;"></i> All Approved</span>`;

        $tbody.append(`
            <tbody class="student-row-wrap" ...>
            <tr class="collapse-toggle" data-bs-toggle="collapse" data-bs-target="#student-${sid}">
                <td class="ps-4 py-3">
                    <div class="fw-bold text-dark">${student.name}</div>
                    <small class="text-muted" style="font-family:'JetBrains Mono',monospace;">ID: #${sid}</small>
                </td>
                <td class="py-3">
                    <span class="dept-badge" title="${student.dept_name}">
                        <i class="fas fa-university me-1" style="font-size: .6rem;"></i>
                        ${student.dept_name || 'Unassigned'}
                    </span>
                </td>
                <td class="py-3">
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fw-bold me-2" style="min-width:90px;text-align:center;">
                        ${classCount} ${classCount === 1 ? 'Class' : 'Classes'}
                    </span>
                    ${summaryBadge}
                </td>
                <td class="text-end pe-4 py-3">
                    <button class="btn btn-sm btn-light border shadow-sm rounded-circle" style="width:35px;height:35px;">
                        <i class="fas fa-chevron-down text-muted"></i>
                    </button>
                </td>
            </tr>
            <tr>
                <td colspan="100" class="p-0 border-0">
                    <div class="collapse" id="student-${sid}">
                        <div class="p-3 p-md-4 expanded-row-bg border-bottom">
                            <h6 class="fw-bold text-dark mb-3">
                                <i class="fas fa-layer-group text-primary me-2"></i>Classes for ${student.name}
                            </h6>
                            <div class="card shadow-sm border-0 rounded-3 overflow-hidden">
                                <div class="table-responsive">
                                    <table class="table nested-table mb-0 table-sm align-middle">
                                        <thead>
                                            <tr>
                                                <th class="ps-3 py-2">Course</th>
                                                <th class="py-2">Instructor</th>
                                                <th class="py-2">Term</th>
                                                <th class="py-2">Status</th>
                                                <th class="py-2">Enroll Date</th>
                                                <th class="text-end pe-3 py-2">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody class="bg-white">${classesHtml}</tbody>
                                    </table>
                                </div>
                            </div>
                            ${archiveHtml}
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>`);
    });
}

function buildArchiveHtml(sid, archivesData) {
    if (!archivesData || !archivesData[sid] || archivesData[sid].length === 0) return '';

    let rows = '';
    archivesData[sid].forEach(dr => {
        const dateStr = dr.archived_at
            ? new Date(dr.archived_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })
            : 'N/A';
        rows += `
        <tr>
            <td class="ps-3 py-2">
                <span class="badge me-1" style="background:#fde68a;color:#92400e;font-family:'JetBrains Mono',monospace;">${dr.course_code}</span>
                <span class="small" style="color:#78350f;">${dr.course_name}</span>
            </td>
            <td class="small py-2" style="color:#92400e;font-family:'JetBrains Mono',monospace;font-size:.68rem;">${dr.semester} ${dr.year}</td>
            <td class="py-2">
                <span style="font-size:.7rem;font-weight:700;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;">
                    <i class="fas fa-user-shield" style="font-size:.6rem;"></i> ${dr.archiver}
                </span>
            </td>
            <td class="small py-2" style="color:#92400e;">${dateStr}</td>
        </tr>`;
    });

    return `
    <div class="mt-3">
        <h6 class="small fw-bold text-muted text-uppercase mb-2" style="font-size:.65rem;letter-spacing:.8px;">
            <i class="fas fa-archive me-1" style="color:#f59e0b;"></i> Dropped / Archived Enrollments
        </h6>
        <div class="card border-0 rounded-3 overflow-hidden" style="border:1px solid #fde68a!important;">
            <div class="table-responsive">
                <table class="table table-sm mb-0 align-middle">
                    <thead style="background:#fef3c7;">
                        <tr>
                            <th class="ps-3 py-2" style="font-size:.6rem;text-transform:uppercase;color:#92400e;">Course</th>
                            <th class="py-2"       style="font-size:.6rem;text-transform:uppercase;color:#92400e;">Term</th>
                            <th class="py-2"       style="font-size:.6rem;text-transform:uppercase;color:#92400e;">Dropped By</th>
                            <th class="py-2"       style="font-size:.6rem;text-transform:uppercase;color:#92400e;">Dropped At</th>
                        </tr>
                    </thead>
                    <tbody style="background:#fffbeb;">${rows}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

// ─── Header ───────────────────────────────────────────────────────────────────
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

    const currentPage = window.location.pathname.split('/').pop() || 'enrollment.html';
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
        success: function (res) {
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
            } else {
                window.location.href = '/client/pages/login.html';
            }
        },
        error: function () { window.location.href = '/client/pages/login.html'; }
    });

    $(document).on('click', '#logoutBtn', function (e) {
        e.preventDefault();
        $.ajax({
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json', xhrFields: { withCredentials: true },
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function () { window.location.href = '/client/pages/login.html'; }
        });
    });
}