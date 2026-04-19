/**
 * tasks.js  —  Unified module for artisansLMS todo.html
 * Handles: Tasks panel (assignments + activities) + Quizzes panel
 * Single API call to assignment.php (get_tasks) returns both assignments AND quizzes.
 * Replaces: assignment.js  +  quizzes.js
 */
$(document).ready(function () {

    // ── 1. Shared Setup ──────────────────────────────────────────────
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const urlParams = new URLSearchParams(window.location.search);
    const classId   = urlParams.get('class_id');

    if (!classId) { window.location.href = 'collaborations.html'; return; }

    let isTeacher = false;

    function escHtml(s) {
        return (s || '').toString()
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function showAlert(type, msg) {
        const html = `
            <div class="alert alert-${type} alert-dismissible shadow-sm fw-bold rounded-4 mb-4" role="alert">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>${msg}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>`;
        $('#alertsContainer').html(html);
        setTimeout(() => $('.alert').fadeOut(300, function () { $(this).remove(); }), 4000);
    }


    // ════════════════════════════════════════════════════════════════
    //  SECTION A — TASKS PANEL (assignment.js logic)
    // ════════════════════════════════════════════════════════════════

    let taskList            = [];   // assignments + activities (type !== 'quiz')
    let quizList            = [];   // quizzes extracted from the same API response
    let allClasses          = [];
    let currentFilterStatus = 'all';
    let currentFilterCat    = 'all';

    // ── A1. Single fetch — drives BOTH panels ──
    function fetchTasks() {
        $.ajax({
            url: '/artisansLMS/backend/endpoints/assignments.php',
            method: 'GET',
            data: { action: 'get_tasks', class_id: classId },
            dataType: 'json',
            success: function (data) {
                if (data.status === 'error') {
                    $('#taskGrid').html(`<div class="col-12 text-center text-danger fw-bold py-5">${data.message}</div>`);
                    $('#quizGrid').html(`<div class="col-12 text-center text-danger fw-bold py-5">${data.message}</div>`);
                    return;
                }

                isTeacher = data.is_teacher;

                // Split the flat tasks array into assignments and quizzes
                const allTasks = data.tasks || [];
                taskList  = allTasks.filter(t => t.type !== 'quiz');
                quizList  = allTasks
                    .filter(t => t.type === 'quiz')
                    .map(q => {
                        // Normalise quiz fields to match what renderQuizzes() expects
                        const due_ts  = new Date(q.due_date).getTime();
                        const is_past = due_ts < new Date().setHours(0,0,0,0);

                        let status = '';
                        if (isTeacher) {
                            const sub_count    = q.attempt_count || 0;
                            const graded_count = 0; // assignment.php doesn't return this; default safe
                            if (!is_past)                                                status = 'active';
                            else if (sub_count > 0 && graded_count >= sub_count) status = 'graded';
                            else if (sub_count > 0)                              status = 'pending';
                            else                                                  status = 'overdue';
                            q.sub_count = sub_count;
                        } else {
                            if (q.my_attempt)   status = 'done';
                            else if (is_past)   status = 'overdue';
                            else                status = 'upcoming';
                        }

                        q.due_ts  = due_ts;
                        q.is_past = is_past;
                        q.status  = status;
                        q.randomize = q.randomize || 0;
                        q.time_limit = q.time_limit || 0;
                        q.description = q.description || '';
                        return q;
                    });

                $('#courseCodeLabel').text(data.class_info.course_code);
                $('#courseNameLabel').text(data.class_info.name);

                if (isTeacher) {
                    $('#btnCreateTask').removeClass('d-none');
                    $('#btnCreateQuiz').removeClass('d-none');
                    // teacher_classes comes free from the same API call
                    allClasses = data.teacher_classes || [];
                    populateCreateModals();
                }

                renderTaskFilterTabs();
                renderTasks();
                renderQuizFilterTabs();
                renderQuizzes();
                updateQuizCounts();
            },
            error: function (xhr) {
                console.error('fetchTasks error:', xhr.responseText);
                $('#taskGrid').html('<div class="col-12 text-center text-danger fw-bold py-5">Failed to fetch tasks.</div>');
                $('#quizGrid').html('<div class="col-12 text-center text-danger fw-bold py-5">Failed to fetch quizzes.</div>');
            }
        });
    }

    fetchTasks();

    // ── A2. Render filter tabs ──
    function renderTaskFilterTabs() {
        const filters = isTeacher
            ? `
                <button class="btn btn-sm btn-primary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="all">All</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="active">Active</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="pending">Needs Grading</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="graded">Graded</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="overdue">Overdue</button>`
            : `
                <button class="btn btn-sm btn-primary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="all">All</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="pending">Pending</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="done">Done</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold filter-pill status-pill" data-filter-type="status" data-val="missing">Missing</button>`;

        $('#statusFilters').html(filters);

        const mobOptions = isTeacher
            ? `<option value="all">All Status</option><option value="active">Active</option><option value="pending">Needs Grading</option><option value="graded">Graded</option><option value="overdue">Overdue</option>`
            : `<option value="all">All Status</option><option value="pending">Pending</option><option value="done">Done</option><option value="missing">Missing</option>`;
        $('#mobStatusFilter').html(mobOptions);

        // Bind filter pills
        $(document).on('click', '.filter-pill', function () {
            const ftype = $(this).data('filter-type');
            const val   = $(this).data('val');

            $(`.filter-pill[data-filter-type="${ftype}"]`).removeClass('active btn-primary text-white').addClass('btn-outline-secondary');
            $(this).removeClass('btn-outline-secondary').addClass('active btn-primary text-white');

            if (ftype === 'status') { currentFilterStatus = val; $('#mobStatusFilter').val(val); }
            if (ftype === 'cat')    { currentFilterCat    = val; $('#mobCatFilter').val(val); }

            renderTasks();
        });

        $('#mobStatusFilter').on('change', function () { currentFilterStatus = $(this).val(); $(`.status-pill[data-val="${currentFilterStatus}"]`).trigger('click'); });
        $('#mobCatFilter').on('change',    function () { currentFilterCat    = $(this).val(); $(`.filter-pill[data-filter-type="cat"][data-val="${currentFilterCat}"]`).trigger('click'); });
    }

    // ── A3. Compute task status ──
    function getTaskStatus(t) {
        const isPast = new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
        if (isTeacher) {
            if (t.type === 'assignment') {
                if (isPast && t.sub_count === 0)                          return 'overdue';
                if (t.sub_count > 0 && t.graded_count === t.sub_count)   return 'graded';
                if (t.sub_count > 0)                                      return 'pending';
                return isPast ? 'overdue' : 'active';
            }
            return isPast ? 'overdue' : 'active';
        }
        if (t.type === 'assignment') return t.my_submission ? 'done' : (isPast ? 'missing' : 'pending');
        return t.my_attempt ? 'done' : (isPast ? 'missing' : 'pending');
    }

    // ── A4. Render task cards ──
    function renderTasks() {
        const grid = $('#taskGrid');
        let html = '', visibleCount = 0;

        if (taskList.length === 0) {
            grid.html(`
                <div class="col-12 text-center py-5 mt-3">
                    <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle shadow-sm mb-3" style="width:80px;height:80px;">
                        <i class="fas fa-clipboard-list fa-2x text-muted opacity-50"></i>
                    </div>
                    <h6 class="fw-bold">No Tasks Yet</h6>
                </div>`);
            return;
        }

        taskList.forEach(t => {
            const status      = getTaskStatus(t);
            t.computedStatus  = status;
            const matchStatus = currentFilterStatus === 'all' || status === currentFilterStatus;
            const matchCat    = currentFilterCat    === 'all' || t.category === currentFilterCat;

            if (!matchStatus || !matchCat) return;
            visibleCount++;

            const dueStr = new Date(t.due_date).toLocaleDateString("en-US", { month:'short', day:'numeric', year:'numeric' });
            const isPast = new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

            let icon, badgeCls, badgeText, borderClass;
            if (t.type === 'quiz') {
                icon = 'fa-brain'; badgeCls = 'bg-purple-subtle text-purple border-purple-subtle'; badgeText = 'Quiz'; borderClass = 'border-purple';
            } else if (t.category === 'activity') {
                icon = 'fa-running'; badgeCls = 'bg-info-subtle text-info border-info-subtle'; badgeText = 'Activity'; borderClass = 'border-info';
            } else {
                icon = 'fa-file-alt'; badgeCls = 'bg-primary-subtle text-primary border-primary-subtle'; badgeText = 'Assignment'; borderClass = 'border-primary';
            }

            let actionHtml = '';
            if (isTeacher) {
                if (t.type === 'assignment') {
                    actionHtml = `
                        <div class="d-flex align-items-center gap-2 ms-auto">
                            <small class="text-muted fw-bold"><span class="${t.graded_count === t.sub_count && t.sub_count > 0 ? 'text-success' : 'text-primary'}">${t.graded_count}</span>/${t.sub_count} Graded</small>
                            <button class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold shadow-sm" onclick="openGradeModal(${t.assignment_id})">View &amp; Grade</button>
                            <button class="btn btn-sm btn-outline-danger rounded-pill px-3 shadow-sm" onclick="deleteTask(${t.assignment_id}, 'assignment')"><i class="fas fa-trash"></i></button>
                        </div>`;
                } else {
                    actionHtml = `
                        <div class="d-flex align-items-center gap-2 ms-auto">
                            <small class="text-muted fw-bold">${t.attempt_count} attempted</small>
                            <button class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold shadow-sm" onclick="viewQuizResults(${t.quiz_id}, '${escHtml(t.title).replace(/'/g, "\\'")}', ${t.total_pts})"><i class="fas fa-chart-bar me-1"></i> Results</button>
                            <button class="btn btn-outline-danger btn-sm rounded-pill px-3 shadow-sm" onclick="deleteTask(${t.quiz_id}, 'quiz')"><i class="fas fa-trash"></i></button>
                        </div>`;
                }
            } else {
                if (status === 'done') {
                    let gradeTxt = '';
                    if (t.type === 'assignment' && t.my_submission && t.my_submission.grade) gradeTxt = `<span class="badge bg-light text-dark border ms-2">Grade: ${t.my_submission.grade}</span>`;
                    if (t.type === 'quiz' && t.my_attempt) gradeTxt = `<span class="badge bg-purple-subtle text-purple border border-purple-subtle ms-2">${t.my_attempt.score}/${t.my_attempt.total_points}</span>`;
                    actionHtml = `<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill fw-bold"><i class="fas fa-check-circle me-1"></i>Done ${gradeTxt}</span>`;
                } else if (status === 'missing') {
                    actionHtml = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 rounded-pill fw-bold"><i class="fas fa-exclamation-circle me-1"></i>Missing</span>`;
                } else {
                    if (t.type === 'assignment') {
                        actionHtml = `<button class="btn btn-primary btn-sm rounded-pill px-4 fw-bold shadow-sm" onclick="openSubmitTask(${t.assignment_id}, '${escHtml(t.title)}')"><i class="fas fa-upload me-1"></i>Turn In</button>`;
                    } else {
                        actionHtml = `<button class="btn btn-primary btn-sm rounded-pill px-4 fw-bold shadow-sm text-white" style="background:#7c3aed;border:none;" onclick="startQuiz(${t.quiz_id}, '${escHtml(t.title)}')"><i class="fas fa-play me-1"></i>Take Quiz</button>`;
                    }
                }
            }

            html += `
            <div class="col-12 col-xl-6 task-item" data-due="${t.due_date}">
                <div class="card h-100 border-0 shadow-sm rounded-4 border-start border-4 ${borderClass} p-4 d-flex flex-column">
                    <div class="d-flex align-items-start justify-content-between mb-2">
                        <h5 class="fw-bold text-dark m-0 pe-2">${escHtml(t.title)}</h5>
                        <span class="badge flex-shrink-0 ${isPast && status !== 'done' ? 'bg-danger text-white' : 'bg-light text-danger border'} rounded-pill">
                            <i class="far fa-clock me-1"></i>${isPast && status !== 'done' ? 'Overdue: ' : 'Due: '}${dueStr}
                        </span>
                    </div>
                    <div class="mb-3">
                        <span class="badge ${badgeCls} px-2 py-1 rounded-2"><i class="fas ${icon} me-1"></i>${badgeText}</span>
                        ${t.type === 'quiz' && t.time_limit > 0 ? `<span class="badge bg-warning-subtle text-warning ms-1"><i class="fas fa-clock me-1"></i>${t.time_limit}m</span>` : ''}
                    </div>
                    <p class="text-muted small mb-4 flex-grow-1">${escHtml(t.description).replace(/\n/g, '<br>')}</p>
                    ${t.files && t.files.length > 0 ? `
                    <div class="mb-3">
                        <a href="${t.files[0]}" target="_blank" class="btn btn-sm btn-light border text-primary fw-bold rounded-pill px-3"><i class="fas fa-paperclip me-1"></i>Reference File</a>
                    </div>` : ''}
                    <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                        ${actionHtml}
                    </div>
                </div>
            </div>`;
        });

        grid.html(html);
        $('#filterEmpty').toggleClass('d-none', visibleCount > 0);
    }

    // ── A5. Sort tasks ──
    window.sortTasks = function (dir, btn) {
        $('.sort-btn').removeClass('active btn-dark text-white').addClass('btn-outline-secondary');
        $(btn).addClass('active btn-dark text-white').removeClass('btn-outline-secondary');
        const grid  = $('#taskGrid');
        const items = grid.find('.task-item').get();
        items.sort((a, b) => {
            const valA = new Date($(a).data('due')).getTime();
            const valB = new Date($(b).data('due')).getTime();
            return dir === 'asc' ? valA - valB : valB - valA;
        });
        $.each(items, (_, itm) => grid.append(itm));
    };

    // ── A6. Delete task ──
    window.deleteTask = function (id, type) {
        if (!confirm('Are you sure you want to delete this task and all submissions?')) return;
        $.post('/artisansLMS/backend/endpoints/assignment.php', { action: 'delete_task', task_id: id, task_type: type, class_id: classId }, function (res) {
            if (res.status === 'success') { showAlert('success', 'Task deleted.'); fetchTasks(); }
        }, 'json');
    };

    // ── A7. Populate Create modals with class list ──
    function populateCreateModals() {
        let clsHtml = '';
        allClasses.forEach(c => {
            clsHtml += `
            <label class="cls-item d-flex align-items-center gap-3 p-3 rounded-3 bg-white" id="cb_lbl_${c.class_id}">
                <input type="checkbox" name="class_ids[]" value="${c.class_id}" class="form-check-input mt-0" onchange="$(this).closest('.cls-item').toggleClass('chk', this.checked)">
                <div>
                    <div class="fw-bold text-dark small">${c.course_code} — ${c.name}</div>
                    <div class="small text-muted font-monospace-sm">${c.semester} ${c.year}</div>
                </div>
            </label>`;
        });
        $('#createClassList').html(clsHtml);

        // Quiz modal class list (same data, different IDs)
        const quizClsHtml = clsHtml
            .replace(/name="class_ids\[\]"/g, 'name="quiz_class_ids[]"')
            .replace(/cb_lbl_/g, 'qz_lbl_');
        $('#quizClassList').html(quizClsHtml);

        // Reassign modal class list
        const riClsHtml = clsHtml
            .replace(/name="class_ids\[\]"/g, 'name="new_class_ids[]"')
            .replace(/cb_lbl_/g, 'ri_lbl_');
        $('#ri_classList').html(riClsHtml);
    }

    // ── A8. Create Task form submit ──
    $('#createTaskForm').on('submit', function (e) {
        e.preventDefault();
        const cids = [];
        $('input[name="class_ids[]"]:checked').each(function () { cids.push($(this).val()); });
        if (cids.length === 0) { alert('Select at least one class.'); return; }

        const formData = new FormData(this);
        formData.append('action', 'create_task');
        formData.append('class_ids', cids.join(','));

        const btn = $('#createSubmitBtn');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Creating...');

        $.ajax({
            url: '/artisansLMS/backend/endpoints/instructor_assignments.php',
            type: 'POST', data: formData, contentType: false, processData: false, dataType: 'json',
            success: function (res) {
                if (res.status === 'success') {
                    $('#createModal').modal('hide');
                    this.reset && this.reset();
                    showAlert('success', res.message);
                    fetchTasks();
                } else { alert(res.message); }
                btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i>Post to Selected Classes');
            }.bind(this),
            error: function () {
                alert('Network Error');
                btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i>Post to Selected Classes');
            }
        });
    });

    // ── A9. Reassign task ──
    window.openReassign = function (id, type, title, currentClassId) {
        $('#ri_id').val(id); $('#ri_type').val(type); $('#ri_title').text(title); $('#ri_meta').text(type);
        const iconMap = { assignment: '<i class="fas fa-file-alt text-primary"></i>', activity: '<i class="fas fa-running text-info"></i>', quiz: '<i class="fas fa-brain" style="color:#7c3aed"></i>' };
        $('#ri_icon').html(iconMap[type] || '<i class="fas fa-tasks"></i>');

        $('#ri_classList .cls-item').removeClass('chk disabled-cls').find('input').prop('checked', false).prop('disabled', false);
        $('#ri_classList .already-tag').remove();
        const currentItem = $(`#ri_lbl_${currentClassId}`);
        if (currentItem.length) {
            currentItem.addClass('disabled-cls').find('input').prop('disabled', true);
            currentItem.find('> div').append('<span class="already-tag badge bg-secondary ms-2 small">✓ Current</span>');
        }
        new bootstrap.Modal(document.getElementById('reassignModal')).show();
    };

    $('#reassignForm').on('submit', function (e) {
        e.preventDefault();
        const cids = [];
        $('input[name="new_class_ids[]"]:checked').each(function () { cids.push($(this).val()); });
        if (cids.length === 0) { alert('Select at least one class.'); return; }

        const btn = $('#reassignSubmitBtn');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Assigning...');

        $.post('/artisansLMS/backend/endpoints/instructor_assignments.php', {
            action: 'reassign_task', reassign_id: $('#ri_id').val(), reassign_type: $('#ri_type').val(), new_class_ids: cids.join(',')
        }, function (res) {
            if (res.status === 'success') { $('#reassignModal').modal('hide'); showAlert('success', res.message); fetchTasks(); }
            else { alert(res.message); }
            btn.prop('disabled', false).html('<i class="fas fa-share-nodes me-2"></i>Assign to Selected Classes');
        }, 'json');
    });

    // ── A10. Student submit task ──
    window.openSubmitTask = function (id, title) {
        $('#submit_aid').val(id);
        $('#submitTaskTitle').text('Turn In: ' + title);
        new bootstrap.Modal(document.getElementById('submitTaskModal')).show();
    };

    $('#studentSubmitForm').on('submit', function (e) {
        e.preventDefault();
        const formData = new FormData(this);
        formData.append('action', 'submit_assignment');
        formData.append('class_id', classId);

        const btn = $('#btnSubmitTaskForm');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Submitting...');

        $.ajax({
            url: '/artisansLMS/backend/endpoints/assignment.php',
            type: 'POST', data: formData, contentType: false, processData: false, dataType: 'json',
            success: function () { $('#submitTaskModal').modal('hide'); fetchTasks(); btn.prop('disabled', false).html('Submit Work'); }
        });
    });

    // ── A11. Teacher grade modal ──
    window.openGradeModal = function (aid) {
        const task = taskList.find(t => t.assignment_id == aid);
        if (!task) return;
        $('#gradeTaskTitle').text(task.title);

        let html = '';
        if (!task.submissions || task.submissions.length === 0) {
            html = '<div class="text-center py-5 text-muted fw-bold"><i class="fas fa-inbox fa-2x mb-2 opacity-50 d-block"></i>No submissions yet.</div>';
        } else {
            task.submissions.forEach(sub => {
                const init      = (sub.first_name[0] + sub.last_name[0]).toUpperCase();
                const fileHtml  = sub.file ? `<a href="${sub.file}" target="_blank" class="btn btn-sm btn-outline-primary bg-white rounded-pill fw-bold px-3"><i class="fas fa-file-download me-1"></i>View Attached File</a>` : '<span class="text-muted small fst-italic">No file attached</span>';
                const gradeBadge = sub.grade ? `<span class="badge bg-success ms-auto fs-6">${sub.grade}</span>` : `<span class="badge bg-warning text-dark ms-auto">Pending Grading</span>`;
                html += `
                <div class="card border shadow-sm rounded-4 mb-3 bg-light overflow-hidden">
                    <div class="card-header bg-white border-bottom d-flex align-items-center p-3">
                        <div class="badge bg-primary rounded-circle p-2 d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;font-size:1rem;">${init}</div>
                        <div>
                            <div class="fw-bold text-dark fs-6">${sub.first_name} ${sub.last_name}</div>
                            <div class="small text-muted"><i class="far fa-clock me-1"></i>${new Date(sub.submit_date).toLocaleString()}</div>
                        </div>
                        ${gradeBadge}
                    </div>
                    <div class="card-body p-3">
                        <div class="mb-3 pb-3 border-bottom">${fileHtml}</div>
                        <form onsubmit="submitGrade(event, ${sub.submission_id})">
                            <div class="d-flex gap-2 align-items-center mb-2">
                                <input type="text" id="g_val_${sub.submission_id}" class="form-control border shadow-sm" placeholder="Grade (e.g. 95/100)" value="${sub.grade || ''}" required>
                                <button type="submit" class="btn btn-success fw-bold rounded-3 shadow-sm px-4" id="g_btn_${sub.submission_id}"><i class="fas fa-check me-1"></i>Save</button>
                            </div>
                            <textarea id="g_fb_${sub.submission_id}" class="form-control border shadow-sm" placeholder="Write feedback...">${sub.feedback || ''}</textarea>
                        </form>
                    </div>
                </div>`;
            });
        }
        $('#gradeTaskBody').html(html);
        new bootstrap.Modal(document.getElementById('gradeTaskModal')).show();
    };

    window.submitGrade = function (e, sid) {
        e.preventDefault();
        const grade    = $(`#g_val_${sid}`).val();
        const feedback = $(`#g_fb_${sid}`).val();
        const btn      = $(`#g_btn_${sid}`);
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
        $.post('/artisansLMS/backend/endpoints/assignment.php', { action: 'grade_submission', submission_id: sid, grade, feedback, class_id: classId }, function () {
            btn.prop('disabled', false).html('<i class="fas fa-check me-1"></i>Saved').removeClass('btn-success').addClass('btn-secondary');
            setTimeout(() => { btn.removeClass('btn-secondary').addClass('btn-success'); fetchTasks(); }, 1500);
        }, 'json');
    };


    // ════════════════════════════════════════════════════════════════
    //  SECTION B — QUIZZES PANEL
    //  quizList is populated by fetchTasks() — no separate endpoint needed
    // ════════════════════════════════════════════════════════════════

    // ── B1. Render quiz filter tabs ──
    function renderQuizFilterTabs() {
        const filters = isTeacher
            ? `
                <button class="btn btn-sm btn-primary rounded-pill fw-semibold quiz-filter-tab" data-filter="all">All <span class="badge bg-light text-primary ms-1" id="cnt-all">0</span></button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold quiz-filter-tab" data-filter="active">Active <span class="badge bg-primary ms-1" id="cnt-active">0</span></button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold quiz-filter-tab" data-filter="overdue">Overdue <span class="badge bg-danger ms-1" id="cnt-overdue">0</span></button>`
            : `
                <button class="btn btn-sm btn-primary rounded-pill fw-semibold quiz-filter-tab" data-filter="all">All <span class="badge bg-light text-primary ms-1" id="cnt-all">0</span></button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold quiz-filter-tab" data-filter="upcoming">Upcoming <span class="badge bg-primary ms-1" id="cnt-upcoming">0</span></button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold quiz-filter-tab" data-filter="done">Completed <span class="badge bg-success ms-1" id="cnt-done">0</span></button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill fw-semibold quiz-filter-tab" data-filter="overdue">Missed <span class="badge bg-danger ms-1" id="cnt-overdue">0</span></button>`;

        $('#dynamicQuizFilters').html(filters);

        $(document).on('click', '.quiz-filter-tab', function () {
            $('.quiz-filter-tab').removeClass('btn-primary text-white').addClass('btn-outline-secondary');
            $(this).removeClass('btn-outline-secondary').addClass('btn-primary text-white');

            const filter = $(this).data('filter');
            let visible  = 0;
            $('.quiz-item').each(function () {
                const match = filter === 'all' || $(this).data('status') === filter;
                $(this).toggle(match);
                if (match) visible++;
            });
            $('#quizFilterEmpty').toggleClass('d-none', visible > 0);
        });
    }

    // ── B3. Render quiz cards ──
    function renderQuizzes() {
        const grid = $('#quizGrid');
        if (quizList.length === 0) {
            grid.html(`
                <div class="col-12 text-center py-5 mt-3">
                    <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle shadow-sm mb-3" style="width:80px;height:80px;">
                        <i class="fas fa-brain fa-2x text-primary opacity-50"></i>
                    </div>
                    <h6 class="fw-bold mt-3">No Quizzes Yet</h6>
                    <p class="small text-muted">${isTeacher ? "Click 'Create Quiz' to add your first quiz." : "Your instructor hasn't posted any quizzes yet."}</p>
                </div>`);
            return;
        }

        const html = quizList.map(qz => {
            const dueStr = new Date(qz.due_ts).toLocaleDateString("en-US", { month:'short', day:'numeric', year:'numeric' });
            let statusBadge = '', actionHtml = '';

            if (isTeacher) {
                if      (qz.status === 'active')  statusBadge = `<span class="badge bg-primary-subtle text-primary rounded-pill">Active</span>`;
                else if (qz.status === 'pending') statusBadge = `<span class="badge bg-warning-subtle text-warning rounded-pill">Needs Grading</span>`;
                else if (qz.status === 'graded')  statusBadge = `<span class="badge bg-success-subtle text-success rounded-pill">Graded</span>`;
                else                              statusBadge = `<span class="badge bg-danger-subtle text-danger rounded-pill">Overdue</span>`;

                actionHtml = `
                    <div class="d-flex align-items-center gap-2">
                        <small class="text-muted fw-bold">${qz.sub_count} submitted</small>
                        <button class="btn btn-outline-primary btn-sm rounded-pill fw-semibold px-3" onclick="viewQuizResults(${qz.quiz_id}, '${escHtml(qz.title).replace(/'/g, "\\'")}', ${qz.total_pts})">
                            <i class="fas fa-chart-bar me-1"></i>Results
                        </button>
                    </div>`;
            } else {
                if (qz.status === 'done') {
                    statusBadge = `<span class="badge bg-success-subtle text-success rounded-pill">Completed</span>`;
                    const pct       = qz.my_attempt.total_points > 0 ? Math.round((qz.my_attempt.score / qz.my_attempt.total_points) * 100) : 0;
                    const grade_cls = pct >= 75 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle';
                    actionHtml = `<span class="badge ${grade_cls} px-3 py-2 fw-bold rounded-pill"><i class="fas fa-check-circle me-1"></i>${qz.my_attempt.score}/${qz.my_attempt.total_points} (${pct}%)</span>`;
                } else if (qz.status === 'overdue') {
                    statusBadge = `<span class="badge bg-danger-subtle text-danger rounded-pill">Missed</span>`;
                    actionHtml  = `<span class="badge bg-danger text-white px-3 py-2 fw-bold rounded-pill"><i class="fas fa-ban me-1"></i>Missed</span>`;
                } else {
                    statusBadge = `<span class="badge bg-primary-subtle text-primary rounded-pill">Upcoming</span>`;
                    actionHtml  = `<button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm fw-bold text-white" onclick="startQuiz(${qz.quiz_id}, '${escHtml(qz.title).replace(/'/g, "\\'")}')"><i class="fas fa-play me-1"></i>Start Quiz</button>`;
                }
            }

            return `
            <div class="col-12 col-xl-6 quiz-item" data-status="${qz.status}" data-due="${qz.due_ts}">
                <div class="card h-100 border-0 shadow-sm rounded-4 border-start border-4 border-primary p-4 d-flex flex-column">
                    <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                        <span class="badge bg-primary-subtle text-primary rounded-pill px-3 fw-bold">🧠 QUIZ</span>
                        ${qz.time_limit > 0 ? `<span class="badge bg-warning-subtle text-warning rounded-pill px-3 fw-bold"><i class="fas fa-clock me-1"></i>${qz.time_limit} min</span>` : ''}
                        ${qz.randomize  ? `<span class="badge bg-light text-muted border rounded-pill fw-semibold"><i class="fas fa-shuffle me-1"></i>Random</span>` : ''}
                        ${statusBadge}
                    </div>
                    <h5 class="fw-bold text-dark mb-2">${escHtml(qz.title)}</h5>
                    <p class="text-muted small mb-4 flex-grow-1">${escHtml(qz.description || '').replace(/\n/g, '<br>')}</p>
                    <div class="d-flex gap-3 mb-3 bg-light rounded-3 p-2 px-3">
                        <small class="text-muted fw-semibold"><i class="fas fa-question-circle me-1 text-primary"></i>${qz.q_count} Qs</small>
                        <small class="text-muted fw-semibold"><i class="fas fa-star me-1 text-warning"></i>${qz.total_pts} Pts</small>
                        <small class="text-muted fw-semibold"><i class="fas fa-shield-alt me-1 text-success"></i>1 Try</small>
                    </div>
                    <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                        <span class="small fw-bold ${qz.is_past ? 'text-danger' : 'text-muted'}">
                            <i class="far fa-calendar-alt me-1"></i>${qz.is_past ? 'Was due: ' : 'Due: '}${dueStr}
                        </span>
                        ${actionHtml}
                    </div>
                </div>
            </div>`;
        }).join('');

        grid.html(html);
    }

    function updateQuizCounts() {
        $('#cnt-all').text($('.quiz-item').length);
        if (isTeacher) {
            $('#cnt-active').text($('.quiz-item[data-status="active"]').length);
            $('#cnt-overdue').text($('.quiz-item[data-status="overdue"]').length);
        } else {
            $('#cnt-upcoming').text($('.quiz-item[data-status="upcoming"]').length);
            $('#cnt-done').text($('.quiz-item[data-status="done"]').length);
            $('#cnt-overdue').text($('.quiz-item[data-status="overdue"]').length);
        }
    }

    // ── B4. Sort quizzes ──
    window.sortQuizzes = function (dir, btn) {
        $('#qsort-asc, #qsort-desc').removeClass('active btn-dark text-white').addClass('btn-outline-secondary');
        $(btn).addClass('active btn-dark text-white').removeClass('btn-outline-secondary');
        const grid  = $('#quizGrid');
        const items = grid.find('.quiz-item').get();
        items.sort((a, b) => {
            const valA = parseInt($(a).data('due'));
            const valB = parseInt($(b).data('due'));
            return dir === 'asc' ? valA - valB : valB - valA;
        });
        $.each(items, (_, itm) => grid.append(itm));
    };

    // ── B5. Create Quiz (teacher) ──
    let quizBuilderQuestions = [];

    window.addQuestion = function (type) {
        quizBuilderQuestions.push({ type, text: '', choices: { A:'', B:'', C:'', D:'' }, correct: type === 'true_false' ? 'TRUE' : 'A', points: 1 });
        renderBuilderQuestions();
        $('#qCountBadge').text(quizBuilderQuestions.length);
    };

    function renderBuilderQuestions() {
        const list = $('#questionBuilderList');
        list.empty();
        $('#noQuestionsHint').toggle(quizBuilderQuestions.length === 0);

        quizBuilderQuestions.forEach((q, idx) => {
            let choicesHTML = '';
            if (q.type === 'multiple_choice') {
                ['A','B','C','D'].forEach(k => {
                    choicesHTML += `
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <input type="radio" name="correct_${idx}" class="form-check-input mt-0" value="${k}" ${q.correct === k ? 'checked' : ''} onchange="setCorrect(${idx},'${k}')">
                        <span class="badge bg-secondary rounded-2">${k}</span>
                        <input type="text" class="form-control form-control-sm border shadow-sm" placeholder="Choice ${k}" value="${escHtml(q.choices[k])}" oninput="setChoice(${idx},'${k}',this.value)">
                    </div>`;
                });
            } else {
                choicesHTML = `
                <div class="d-flex gap-3 mt-2">
                    <label class="d-flex align-items-center gap-2 fw-bold cursor-pointer">
                        <input type="radio" class="form-check-input mt-0" name="correct_${idx}" value="TRUE" ${q.correct === 'TRUE' ? 'checked' : ''} onchange="setCorrect(${idx},'TRUE')">
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill">✅ True</span>
                    </label>
                    <label class="d-flex align-items-center gap-2 fw-bold cursor-pointer">
                        <input type="radio" class="form-check-input mt-0" name="correct_${idx}" value="FALSE" ${q.correct === 'FALSE' ? 'checked' : ''} onchange="setCorrect(${idx},'FALSE')">
                        <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 rounded-pill">❌ False</span>
                    </label>
                </div>`;
            }

            list.append(`
            <div class="card bg-white border rounded-4 shadow-sm mb-3 position-relative p-4" id="qblock_${idx}">
                <button class="btn btn-sm btn-danger rounded-circle position-absolute" style="top:15px;right:15px;width:30px;height:30px;padding:0;" onclick="removeQuestion(${idx})" type="button"><i class="fas fa-times"></i></button>
                <div class="d-flex align-items-start gap-3 mb-3">
                    <span class="badge bg-primary rounded-circle fs-6 p-2 d-flex align-items-center justify-content-center" style="width:35px;height:35px;">${idx + 1}</span>
                    <div class="flex-grow-1 pe-4">
                        <textarea class="form-control shadow-sm border-0 bg-light mb-3" rows="2" placeholder="Enter your question here..." oninput="setQText(${idx},this.value)">${escHtml(q.text)}</textarea>
                        <div class="d-flex gap-3 align-items-center">
                            <span class="small fw-bold text-muted">Points:</span>
                            <input type="number" class="form-control form-control-sm border shadow-sm" style="width:80px;" min="1" value="${q.points}" oninput="setQPoints(${idx},this.value)">
                            <span class="badge ${q.type === 'multiple_choice' ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success'} rounded-pill px-3 py-2">
                                ${q.type === 'multiple_choice' ? 'Multiple Choice' : 'True / False'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="ms-5 ps-2 border-start border-2 border-light">${choicesHTML}</div>
            </div>`);
        });
    }

    window.removeQuestion = function (idx) {
        quizBuilderQuestions.splice(idx, 1);
        renderBuilderQuestions();
        $('#qCountBadge').text(quizBuilderQuestions.length);
    };

    window.setQText   = function (i, v) { quizBuilderQuestions[i].text = v; };
    window.setChoice  = function (i, k, v) { quizBuilderQuestions[i].choices[k] = v; };
    window.setCorrect = function (i, v) { quizBuilderQuestions[i].correct = v; };
    window.setQPoints = function (i, v) { quizBuilderQuestions[i].points = parseInt(v) || 1; };

    window.saveQuiz = function () {
        const title = $('#qzTitle').val().trim();
        const due   = $('#qzDue').val();
        const cids  = [];
        $('input[name="quiz_class_ids[]"]:checked').each(function () { cids.push($(this).val()); });

        if (!title || !due)               { alert('Please fill in the Quiz Title and Due Date.'); return; }
        if (cids.length === 0)            { alert('Select at least one class.'); return; }
        if (quizBuilderQuestions.length === 0) { alert('Please add at least one question.'); return; }

        for (let i = 0; i < quizBuilderQuestions.length; i++) {
            const q = quizBuilderQuestions[i];
            if (!q.text.trim()) { alert(`Question ${i + 1} has no text.`); return; }
            if (q.type === 'multiple_choice') {
                for (const k of ['A','B','C','D']) {
                    if (!q.choices[k].trim()) { alert(`Question ${i + 1}: Choice ${k} is empty.`); return; }
                }
            }
        }

        const btn     = $('#createQuizModal .modal-footer button');
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Publishing...');

        const payload = quizBuilderQuestions.map(q => ({
            text: q.text, type: q.type,
            choices: q.type === 'multiple_choice' ? q.choices : {},
            correct: q.correct, points: q.points
        }));

        $.ajax({
            url: '/artisansLMS/backend/endpoints/quiz_handler.php',
            method: 'POST',
            data: {
                action: 'create_quiz', class_ids: cids.join(','),
                title, description: $('#qzDesc').val(),
                time_limit: parseInt($('#qzTime').val()) || 0,
                due_date: due,
                randomize: $('#qzRandomize').is(':checked') ? '1' : '',
                questions_json: JSON.stringify(payload)
            },
            dataType: 'json',
            success: function (res) {
                if (res.success) {
                    $('#createQuizModal').modal('hide');
                    quizBuilderQuestions = [];
                    renderBuilderQuestions();
                    $('#qCountBadge').text(0);
                    showAlert('success', 'Quiz published successfully!');
                    fetchTasks();
                } else {
                    alert(res.message || 'Error saving quiz.');
                    btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i>Publish Quiz to Class');
                }
            },
            error: function () {
                alert('Server error.');
                btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i>Publish Quiz to Class');
            }
        });
    };

    // ── B6. Teacher: view quiz results ──
    window.viewQuizResults = function (quizId, title, totalPts) {
        $('#quizResultsModalTitle').text('📊 Results: ' + title);
        $('#quizResultsModalBody').html('<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>');
        new bootstrap.Modal(document.getElementById('quizResultsModal')).show();

        $.ajax({
            url: '/artisansLMS/backend/endpoints/quiz_handler.php',
            method: 'GET',
            data: { action: 'get_results', quiz_id: quizId },
            dataType: 'json',
            success: function (data) {
                if (!data.attempts || data.attempts.length === 0) {
                    $('#quizResultsModalBody').html('<p class="text-center py-5 text-muted fw-bold">No submissions yet.</p>');
                    return;
                }
                const avg       = data.attempts.reduce((a, b) => a + parseInt(b.score), 0) / data.attempts.length;
                const passCount = data.attempts.filter(a => (a.score / totalPts) >= 0.75).length;

                let html = `
                <div class="p-3 bg-light border-bottom d-flex gap-4 flex-wrap">
                    <div><small class="text-muted d-block text-uppercase fw-bold">Submissions</small><strong class="fs-5">${data.attempts.length}</strong></div>
                    <div><small class="text-muted d-block text-uppercase fw-bold">Avg Score</small><strong class="fs-5">${avg.toFixed(1)} / ${totalPts}</strong></div>
                    <div><small class="text-muted d-block text-uppercase fw-bold">Pass Rate</small><strong class="fs-5 text-primary">${Math.round(passCount / data.attempts.length * 100)}%</strong></div>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="bg-light text-muted small text-uppercase">
                            <tr><th class="ps-4">Student</th><th>Score</th><th>Percentage</th><th>Submitted</th></tr>
                        </thead><tbody>`;

                data.attempts.forEach(a => {
                    const pct       = totalPts > 0 ? Math.round((a.score / totalPts) * 100) : 0;
                    const pillClass = pct >= 75 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle';
                    html += `<tr>
                        <td class="ps-4 fw-bold text-dark">${escHtml(a.first_name + ' ' + a.last_name)}</td>
                        <td class="fw-bold">${a.score} / ${totalPts}</td>
                        <td><span class="badge ${pillClass} rounded-pill px-3 py-2">${pct}%</span></td>
                        <td class="small text-muted fw-semibold">${new Date(a.submitted_at).toLocaleString()}</td>
                    </tr>`;
                });

                html += '</tbody></table></div>';
                $('#quizResultsModalBody').html(html);
            },
            error: function () {
                $('#quizResultsModalBody').html('<p class="text-center py-5 text-danger fw-bold">Error loading results.</p>');
            }
        });
    };


    // ════════════════════════════════════════════════════════════════
    //  SECTION C — SHARED QUIZ OVERLAY (take quiz — student)
    //  Used by BOTH panels (task card "Take Quiz" btn + quiz card "Start Quiz" btn)
    // ════════════════════════════════════════════════════════════════

    let quizState = { quizId: null, attemptId: null, questions: [], answers: {}, timerInterval: null, timeLeft: 0 };

    window.startQuiz = function (quizId, title) {
        if (!confirm(`You are about to start "${title}".\n\n⚠️ You only get ONE attempt. Start now?`)) return;

        $.ajax({
            url: '/artisansLMS/backend/endpoints/quiz_handler.php',
            method: 'GET',
            data: { action: 'get_quiz', quiz_id: quizId },
            dataType: 'json',
            success: function (data) {
                if (data.error === 'already_attempted') { alert('You have already submitted this quiz.'); return; }
                if (data.error) { alert('Error: ' + data.error); return; }

                quizState = {
                    quizId, attemptId: data.attempt_id,
                    questions: data.questions, answers: {},
                    timerInterval: null,
                    timeLeft: (data.quiz.time_limit || 0) * 60
                };

                $('#quizOverlayTitle').text(data.quiz.title);
                renderTakeQuestions(data.questions);

                $('#quizResultScreen').hide();
                $('#quizBody, #quizFooter').removeClass('d-none').addClass('d-flex');
                $('#quizOverlay').addClass('active');

                updateQuizProgress();

                const timerBox = $('#quizTimerBox');
                timerBox.removeClass('bg-warning text-dark bg-secondary').addClass('bg-danger text-white');

                if (quizState.timeLeft > 0) {
                    updateTimerDisplay();
                    quizState.timerInterval = setInterval(() => {
                        quizState.timeLeft--;
                        updateTimerDisplay();
                        if (quizState.timeLeft <= 60) timerBox.removeClass('bg-danger text-white').addClass('bg-warning text-dark');
                        if (quizState.timeLeft <= 0)  { clearInterval(quizState.timerInterval); alert('Time is up! Submitting now.'); submitQuiz(true); }
                    }, 1000);
                } else {
                    timerBox.text('No Time Limit').addClass('bg-secondary text-white');
                }
            },
            error: function () { alert('Failed to load quiz.'); }
        });
    };

    function renderTakeQuestions(questions) {
        const body = $('#quizBody');
        let html   = '';
        questions.forEach((q, idx) => {
            let choicesHTML = '';
            if (q.question_type === 'multiple_choice') {
                for (const [key, text] of Object.entries(q.choices)) {
                    choicesHTML += `<div class="d-flex align-items-center gap-3 p-3 border border-secondary rounded-3 mb-2 text-light bg-dark cursor-pointer quiz-choice-btn" id="choice_${q.question_id}_${key}" onclick="selectAnswer(${q.question_id},'${key}',this)"><span class="badge bg-secondary p-2">${key}</span><span class="fs-6">${escHtml(text)}</span></div>`;
                }
            } else {
                choicesHTML = `
                <div class="d-flex align-items-center gap-3 p-3 border border-secondary rounded-3 mb-2 text-light bg-dark cursor-pointer quiz-choice-btn" id="choice_${q.question_id}_TRUE"  onclick="selectAnswer(${q.question_id},'TRUE',this)"><span class="badge bg-secondary p-2">T</span><span class="fs-6">True</span></div>
                <div class="d-flex align-items-center gap-3 p-3 border border-secondary rounded-3 mb-2 text-light bg-dark cursor-pointer quiz-choice-btn" id="choice_${q.question_id}_FALSE" onclick="selectAnswer(${q.question_id},'FALSE',this)"><span class="badge bg-secondary p-2">F</span><span class="fs-6">False</span></div>`;
            }
            html += `
            <div class="card bg-secondary bg-opacity-25 text-white rounded-4 p-4 mb-4 border-0">
                <div class="text-uppercase small fw-bold text-muted mb-2">Question ${idx + 1} of ${questions.length}</div>
                <div class="fs-5 fw-semibold mb-3">${escHtml(q.question_text)}</div>
                <span class="badge bg-dark text-muted align-self-start mb-4 px-3 py-2">${q.points} pt${q.points != 1 ? 's' : ''}</span>
                <div>${choicesHTML}</div>
            </div>`;
        });
        body.html(html);
    }

    window.selectAnswer = function (qId, answer, el) {
        $(`[id^="choice_${qId}_"]`).removeClass('selected border-primary');
        $(el).addClass('selected border-primary');
        quizState.answers[qId] = answer;
        updateQuizProgress();
    };

    function updateQuizProgress() {
        const t = quizState.questions.length;
        const a = Object.keys(quizState.answers).length;
        $('#quizProgressBar').css('width', (t > 0 ? a / t * 100 : 0) + '%');
        $('#answeredCount').text(`${a} of ${t} answered`);
    }

    function updateTimerDisplay() {
        const m = Math.floor(quizState.timeLeft / 60).toString().padStart(2, '0');
        const s = (quizState.timeLeft % 60).toString().padStart(2, '0');
        $('#quizTimerBox').text(`${m}:${s}`);
    }

    window.confirmLeaveQuiz = function () {
        if (confirm('⚠️ Exit quiz? Progress will NOT be saved and this counts as your one attempt.')) {
            clearInterval(quizState.timerInterval);
            $('#quizOverlay').removeClass('active');
        }
    };

    window.submitQuiz = function (forced = false) {
        if (!forced && !confirm('Submit your quiz now?')) return;
        clearInterval(quizState.timerInterval);

        const btn = $('#submitQuizBtn');
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Submitting...');

        $.ajax({
            url: '/artisansLMS/backend/endpoints/quiz_handler.php',
            method: 'POST',
            data: { action: 'submit_quiz', attempt_id: quizState.attemptId, quiz_id: quizState.quizId, answers: JSON.stringify(quizState.answers) },
            dataType: 'json',
            success: function (res) {
                if (res.success) showResult(res);
                else alert(res.error || 'Submission error.');
            },
            error: function () { alert('Network error.'); btn.prop('disabled', false).html('Submit Quiz'); }
        });
    };

    function showResult(res) {
        $('#quizBody, #quizFooter').removeClass('d-flex').addClass('d-none');
        $('#quizResultScreen').css('display', 'flex');

        const deg = Math.round(res.percentage / 100 * 360);
        document.getElementById('resultCircle').style.setProperty('--pct', deg + 'deg');
        $('#resultScoreText').text(res.percentage + '%');
        $('#resultGrade').text(`${res.score} / ${res.total} Points`);
        $('#resultSub').text(
            res.percentage >= 90 ? '🎉 Excellent!' :
            res.percentage >= 75 ? '✅ Passed!'    :
            res.percentage >= 50 ? '⚠️ Needs improvement.' : '❌ Failed.'
        );
    }

    window.closeQuizOverlay = function () {
        $('#quizOverlay').removeClass('active');
        fetchTasks();    // single call refreshes both tasks and quizzes
    };

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
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
        'todo.html':                   { title: 'Tasks & Quizzes',        subtitle: 'Manage your assignments, activities, and quizzes.' } 
    };

    const currentPage = window.location.pathname.split('/').pop() || 'todo.html';
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
                $('#headerUserRole').text(u.role || 'User'); 
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'User');
                $('#dropdownAvatar').attr({ src: lgAvt, alt: u.name });
                $('#heroName').html(u.name + ' <span class="fs-3">👋</span>');
                
                sessionStorage.setItem('sb_role', (u.role || '').toLowerCase());
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