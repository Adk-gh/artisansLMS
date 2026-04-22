// enrollment.js

let currentTab    = 'all';
let _pendingData  = [];
let _enrolledData = {};
let _allClasses   = [];

// ── Tab switch ───────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
    currentTab = tab;
    $('#tabAll, #tabPending').removeClass('active');
    $(`#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).addClass('active');

    if (tab === 'pending') {
        $('#allSection').hide();
        $('#pendingSection').show();
        renderPendingList();
    } else {
        $('#pendingSection').hide();
        $('#allSection').show();
        filterEnrollment();
    }
};

// ── Filter (all tab) ─────────────────────────────────────────────────────────
function filterEnrollment() {
    const q       = $('#enrollSearch').val().toLowerCase().trim();
    const cf      = $('#enrollClassFilter').val();
    const statf   = $('#enrollStatusFilter').val();
    let   visible = 0;

    $('.student-row-wrap').each(function() {
        const $wrap   = $(this);
        const name    = $wrap.attr('data-name')   || '';
        const sid     = $wrap.attr('data-id')     || '';
        const count   = parseInt($wrap.attr('data-count')) || 0;
        const statuses = ($wrap.attr('data-statuses') || '').split(',');

        const nameOk   = !q     || name.includes(q) || sid.includes(q);
        const statusOk = !statf || statuses.includes(statf);
        let   cntOk    = true;
        if      (cf === '1') cntOk = count === 1;
        else if (cf === '2') cntOk = count === 2;
        else if (cf === '3') cntOk = count >= 3;

        const show = nameOk && cntOk && statusOk;
        $wrap.toggleClass('hidden', !show);
        if (show) visible++;
    });

    $('#enrollCountNum').text(visible);
    if (visible === 0) $('#enrollNoResults').addClass('show');
    else               $('#enrollNoResults').removeClass('show');
}
window.filterEnrollment = filterEnrollment;

// ── Pending search ───────────────────────────────────────────────────────────
function filterPending() {
    const q   = $('#pendingSearch').val().toLowerCase().trim();
    let   vis = 0;
    $('.pending-student-card').each(function() {
        const show = !q || $(this).text().toLowerCase().includes(q);
        $(this).toggleClass('d-none', !show);
        if (show) vis++;
    });
    $('#pendingCountNum').text(vis);
}

// ── Modal Class Filter ───────────────────────────────────────────────────────
function filterModalClasses() {
    const sid = $('#studentSelect').val();
    if (!sid) return;

    const q = $('#modalClassSearch').val().toLowerCase().trim();
    const dept = $('#modalClassDept').val();
    const alreadyEnrolled = _enrolledData[sid] || [];
    let availableCount = 0;
    
    const $helperText = $('#enrollmentHelperText');

    $('.class-check-wrapper').each(function() {
        const $wrap = $(this);
        const cid = $wrap.attr('data-class-id');
        const nameData = $wrap.attr('data-name') || '';
        const cDept = $wrap.attr('data-dept') || '';

        if (alreadyEnrolled.includes(cid)) {
            $wrap.addClass('d-none');
            $wrap.find('input').prop('disabled', true);
            return;
        }

        $wrap.find('input').prop('disabled', false);

        const matchesSearch = !q || nameData.includes(q);
        const matchesDept = !dept || cDept === dept;

        if (matchesSearch && matchesDept) {
            $wrap.removeClass('d-none');
            availableCount++;
        } else {
            $wrap.addClass('d-none');
        }
    });

    if (availableCount === 0 && !q && !dept) {
        $helperText.removeClass('d-none').html("<span class='text-danger fw-bold'>This student is already enrolled in all active classes!</span>");
    } else if (availableCount === 0) {
        $helperText.removeClass('d-none').html("<span class='text-muted fst-italic'>No classes match your filter.</span>");
    } else {
        $helperText.addClass('d-none');
    }
}

$(document).ready(function() {

    $('#sidebar-placeholder').load('../components/sidebar.html');
    $('#header-placeholder').load('../components/header.html', function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL      = '../../backend/endpoints/enrollments.php';
    let enrollModalObj = null;
    let rejectModalObj = null;

    const enrollEl = document.getElementById('enrollModal');
    const rejectEl = document.getElementById('rejectModal');
    if (enrollEl) enrollModalObj = new bootstrap.Modal(enrollEl);
    if (rejectEl) rejectModalObj = new bootstrap.Modal(rejectEl);

    // ── Initial load ─────────────────────────────────────────────────────────
    fetchEnrollments();
    fetchFormData();

    // ── Event listeners ──────────────────────────────────────────────────────
    $('#enrollSearch, #enrollClassFilter, #enrollStatusFilter').on('input change', filterEnrollment);
    $('#pendingSearch').on('input', filterPending);
    $('#modalClassSearch').on('input', filterModalClasses);
    $('#modalClassDept').on('change', filterModalClasses);
    $('#enrollForm').on('submit', handleEnrollmentSubmit);

    // Student select change
    $('#studentSelect').on('change', function() {
        const sid = $(this).val();
        const $helperText = $('#enrollmentHelperText');
        const $filterRow  = $('#modalClassFilters');
        const $wrappers   = $('.class-check-wrapper');
        const $checkboxes = $('.class-checkbox');

        $('#modalClassSearch').val('');
        $('#modalClassDept').val('');

        if (!sid) {
            $filterRow.attr('style', 'display: none !important');
            $wrappers.addClass('d-none');
            $checkboxes.prop('checked', false);
            $helperText.removeClass('d-none').text('Select a student to view available classes.');
            $('#selectedCount').hide();
            return;
        }

        $filterRow.attr('style', 'display: flex !important');
        $helperText.addClass('d-none');
        $checkboxes.prop('checked', false);
        buildCheckboxList(sid);
        filterModalClasses();
    });

    // Reject confirm
    $('#confirmRejectBtn').on('click', function() {
        const eid = $('#reject_enrollment_id').val();
        if (!eid) return;
        $.ajax({
            url: `${API_URL}?action=reject`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ enrollment_id: parseInt(eid) }),
            dataType: 'json',
            success: function(json) {
                showToast(json.message, json.status === 'success' ? 'success' : 'error');
                if (json.status === 'success') {
                    if (rejectModalObj) rejectModalObj.hide();
                    fetchEnrollments();
                }
            }
        });
    });

    // ── API ───────────────────────────────────────────────────────────────────

    function fetchEnrollments() {
        $.ajax({
            url: `${API_URL}?action=get_all`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    const pendingByStudent = {};
                    json.data.forEach(student => {
                        student.classes.forEach(cls => {
                            if (cls.status === 'Pending Finance') {
                                if (!pendingByStudent[student.student_id]) {
                                    pendingByStudent[student.student_id] = { student, classes: [] };
                                }
                                pendingByStudent[student.student_id].classes.push(cls);
                            }
                        });
                    });
                    _pendingData = Object.values(pendingByStudent);

                    const pendingStudentCount = _pendingData.length;
                    if (pendingStudentCount > 0) {
                        $('#pendingBadge').text(pendingStudentCount).show();
                    } else {
                        $('#pendingBadge').hide();
                    }

                    renderTable(json.data, json.archives);
                    if (currentTab === 'pending') renderPendingList();
                } else {
                    showToast(json.message || 'Failed to load enrollments.', 'error');
                }
            },
            error: function(xhr) {
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
            success: function(json) {
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
        $('#checkboxList input[type=checkbox]:checked').each(function() {
            classIds.push($(this).val());
        });

        if (!studentId || classIds.length === 0) {
            showToast('Please select a student and at least one class.', 'error');
            return;
        }

        $.ajax({
            url: `${API_URL}?action=enroll`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ student_id: studentId, class_ids: classIds }),
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    showToast(json.message, 'success');
                    if (enrollModalObj) enrollModalObj.hide();
                    $('#enrollForm')[0].reset();
                    $('#studentSelect').trigger('change');
                    fetchEnrollments();
                    fetchFormData();
                    switchTab('pending');
                } else {
                    showToast(json.message, 'error');
                }
            },
            error: function(xhr) {
                console.error('Enroll error:', xhr.responseText);
                showToast('An error occurred while enrolling.', 'error');
            }
        });
    }

    window.handleDrop = function(enrollmentId, studentName, courseCode) {
        if (!confirm(`Drop ${studentName} from ${courseCode}?\nThis will be saved to Archives.`)) return;
        $.ajax({
            url: `${API_URL}?action=drop`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ enrollment_id: enrollmentId }),
            dataType: 'json',
            success: function(json) {
                showToast(json.message, json.status === 'success' ? 'success' : 'error');
                if (json.status === 'success') { fetchEnrollments(); fetchFormData(); }
            }
        });
    };

    window.openRejectModal = function(eid, studentName, courseCode, semester, year) {
        $('#reject_enrollment_id').val(eid);
        $('#rejectStudentInfo').text(studentName);
        $('#rejectCourseInfo').text(`${courseCode} — ${semester} ${year}`);
        if (rejectModalObj) rejectModalObj.show();
    };

    // ── DOM rendering ─────────────────────────────────────────────────────────

    function populateStudentSelect(students) {
        let html = '<option value="">-- Choose Student --</option>';
        students.forEach(s => {
            html += `<option value="${s.student_id}">${s.last_name}, ${s.first_name} (ID: ${s.student_id})</option>`;
        });
        $('#studentSelect').html(html);
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
        for (let id in depts) {
            dHtml += `<option value="${id}">${depts[id]}</option>`;
        }
        $('#modalClassDept').html(dHtml);

        $list.off('change').on('change', '.class-checkbox', function() {
            const checked   = $list.find('.class-checkbox:checked').length;
            const $counter  = $('#selectedCount');
            if (checked > 0) $counter.show().find('span').text(checked);
            else             $counter.hide();
        });
    }

    function buildCheckboxList(sid) {
        $('#selectedCount').hide();
    }

    function renderTable(groupedData, archivesData) {
        const $tbody = $('#enrollBody');
        $tbody.empty();
        $('#enrollCountNum').text(groupedData.length);

        if (groupedData.length === 0) {
            $tbody.html(`<tr><td colspan="3" class="text-center py-5 text-muted small">No enrollments found.</td></tr>`);
            return;
        }

        groupedData.forEach(student => {
            const sid        = student.student_id;
            const classCount = student.classes.length;
            const statuses   = [...new Set(student.classes.map(c => c.status))].join(',');
            const archiveHtml = buildArchiveHtml(sid, archivesData);

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

                // Only Approved enrollments can be dropped.
                // Pending Finance enrollments are rejected here by admin; approval is Finance's job.
                let actionBtns = '';
                if (cls.status === 'Approved') {
                    actionBtns = `<button type="button" class="btn-drop"
                        onclick="handleDrop(${cls.enrollment_id},'${safeStudentName}','${safeCourseCode}')">
                        <i class="fas fa-archive"></i> Drop
                    </button>`;
                } else if (cls.status === 'Pending Finance') {
                    actionBtns = `<button type="button" class="btn-reject"
                        onclick="openRejectModal(${cls.enrollment_id},'${safeStudentName}','${safeCourseCode}','${cls.semester}','${cls.year}')">
                        <i class="fas fa-times"></i> Reject
                    </button>`;
                }

                classesHtml += `
                <tr>
                    <td class="ps-3 py-2">
                        <div class="d-flex align-items-center flex-wrap gap-2">
                            <span class="badge bg-info-subtle text-info">${cls.course_code}</span>
                            <span class="small fw-medium text-dark">${cls.course_name}</span>
                        </div>
                    </td>
                    <td class="small text-muted py-2">Prof. ${cls.prof}</td>
                    <td class="py-2" style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:#64748b;">
                        ${cls.semester} ${cls.year}
                    </td>
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

            const rowHtml = `
            <tbody class="student-row-wrap"
                data-name="${(student.name || '').toLowerCase()}"
                data-id="${sid}"
                data-count="${classCount}"
                data-statuses="${statuses}">
                <tr class="collapse-toggle" data-bs-toggle="collapse" data-bs-target="#student-${sid}" aria-expanded="false">
                    <td class="ps-4 py-3">
                        <div class="fw-bold text-dark">${student.name}</div>
                        <small class="text-muted" style="font-family:'JetBrains Mono',monospace;">ID: #${sid}</small>
                    </td>
                    <td class="py-3">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fw-bold me-2">
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
                    <td colspan="3" class="p-0 border-0">
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
            </tbody>`;

            $tbody.append(rowHtml);
        });

        $tbody.append(`
            <tr class="no-results-row" id="enrollNoResults">
                <td colspan="3" class="text-center py-5">
                    <i class="fas fa-search d-block fs-3 text-muted opacity-25 mb-2"></i>
                    <div class="fw-bold text-muted">No students match your search</div>
                    <div class="text-muted small">Try a different name, count, or status filter</div>
                </td>
            </tr>
        `);

        filterEnrollment();
    }

    // ── Pending finance panel — grouped by student ───────────────────────────
    window.renderPendingList = function() {
        const $list = $('#pendingList');
        $list.empty();
        $('#pendingCountNum').text(_pendingData.length);

        if (_pendingData.length === 0) {
            $list.html(`
                <div class="text-center py-5">
                    <i class="fas fa-check-circle d-block fs-2 text-success opacity-50 mb-3"></i>
                    <div class="fw-bold text-muted">No pending enrollments</div>
                    <div class="text-muted small">All enrollments have been processed.</div>
                </div>
            `);
            return;
        }

        _pendingData.forEach(({ student, classes }) => {
            const safeStudentName = student.name.replace(/'/g, "\\'");
            const pendingCount    = classes.length;

            const submittedDate = classes
                .map(c => c.enroll_date ? new Date(c.enroll_date) : null)
                .filter(Boolean)
                .sort((a, b) => a - b)[0];
            const submittedStr = submittedDate
                ? submittedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';

            let courseListHtml = classes.map(cls => `
                <div class="d-flex align-items-center gap-2 flex-wrap py-2" style="border-bottom:1px solid #fde68a;">
                    <span class="badge bg-info-subtle text-info border border-info-subtle" style="font-size:.68rem;">${cls.course_code}</span>
                    <span class="small fw-medium text-dark">${cls.course_name}</span>
                    <span class="text-muted small">— ${cls.semester} ${cls.year}</span>
                    <span class="text-muted small ms-auto">Prof. ${cls.prof}</span>
                    <button class="btn-reject ms-1"
                        onclick="openRejectModal(${cls.enrollment_id},'${safeStudentName}','${cls.course_code.replace(/'/g,"\\'")}','${cls.semester}','${cls.year}')"
                        title="Reject this course">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            `).join('');

            $list.append(`
                <div class="pending-student-card mb-3" style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:16px;overflow:hidden;">
                    <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap px-4 py-3"
                         style="background:#fef3c7;border-bottom:1.5px solid #fde68a;">
                        <div class="d-flex align-items-center gap-3 flex-wrap">
                            <div style="width:38px;height:38px;border-radius:50%;background:#fde68a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;color:#92400e;flex-shrink:0;">
                                ${student.name.split(',')[0].trim().charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="fw-bold text-dark" style="font-size:.9rem;">${student.name}</div>
                                <div class="text-muted small" style="font-family:'JetBrains Mono',monospace;">
                                    ID: ${student.student_id}
                                    <span class="ms-2 text-muted">·</span>
                                    <i class="fas fa-calendar ms-2 me-1 opacity-50"></i>Submitted: ${submittedStr}
                                </div>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="status-badge status-pending">
                                <i class="fas fa-clock" style="font-size:.6rem;"></i>
                                ${pendingCount} Pending
                            </span>
                            <!-- Approval is handled by the Finance system via the Tuition API -->
                            <span class="finance-notice">
                                <i class="fas fa-university" style="font-size:.6rem;"></i>
                                Awaiting Finance
                            </span>
                        </div>
                    </div>
                    <div class="px-4 py-2">
                        ${courseListHtml}
                    </div>
                </div>
            `);
        });
    };

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

    const currentPage = window.location.pathname.split('/').pop() || 'enrollment.html';
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
        error: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
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