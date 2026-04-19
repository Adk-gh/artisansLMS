$(document).ready(function() {
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    let allTasks = [];
    let allClasses = [];
    let currentFilterClass = 'all';
    let currentFilterType = 'all';

    function escHtml(s) { return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function fetchData() {
        $.ajax({
            url: '/artisansLMS/backend/endpoints/instructor_assignments.php',
            method: 'GET',
            data: { action: 'get_all' },
            dataType: 'json',
            success: function(data) {
                if (data.status === 'success') {
                    allClasses = data.classes;
                    
                    const assigns = data.assignments.map(a => ({...a, real_type: a.category, is_quiz: false}));
                    const quizzes = data.quizzes.map(q => ({...q, real_type: 'quiz', is_quiz: true, assignment_id: q.quiz_id, category: 'quiz'}));
                    
                    allTasks = [...assigns, ...quizzes];
                    allTasks.sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
                    
                    populateClassFilters();
                    populateModals();
                    renderTable();
                } else { showAlert('danger', data.message || 'Error loading data.'); }
            },
            error: function() { showAlert('danger', 'Server connection failed.'); }
        });
    }

    fetchData();

    function populateClassFilters() {
        let deskHtml = '';
        let mobHtml = '<option value="all">All Classes</option>';
        
        allClasses.forEach(c => {
            deskHtml += `<button class="btn btn-outline-secondary rounded-pill filter-pill" data-filter-type="class" data-val="${c.class_id}">
                <span class="badge bg-light text-dark border me-1">${c.course_code}</span> ${c.name}
                <span class="badge bg-secondary ms-1 rounded-pill" id="cnt-cls-${c.class_id}">0</span>
            </button>`;
            mobHtml += `<option value="${c.class_id}">${c.course_code} - ${c.name}</option>`;
        });
        
        $('#classFilters').find('button:not([data-val="all"])').remove();
        $('#classFilters').append(deskHtml);
        $('#mobClassFilter').html(mobHtml);

        $('.filter-pill').off('click').on('click', function() {
            const ftype = $(this).data('filter-type');
            const val = $(this).data('val');
            $(`.filter-pill[data-filter-type="${ftype}"]`).removeClass('active btn-dark text-white').addClass('btn-outline-secondary');
            $(this).removeClass('btn-outline-secondary').addClass('active btn-dark text-white');
            if (ftype === 'class') { currentFilterClass = val; $('#mobClassFilter').val(val); }
            if (ftype === 'type') { currentFilterType = val; $('#mobTypeFilter').val(val); }
            renderTable();
        });

        $('#mobClassFilter').off('change').on('change', function() { currentFilterClass = $(this).val(); $(`.filter-pill[data-filter-type="class"][data-val="${currentFilterClass}"]`).click(); });
        $('#mobTypeFilter').off('change').on('change', function() { currentFilterType = $(this).val(); $(`.filter-pill[data-filter-type="type"][data-val="${currentFilterType}"]`).click(); });
    }

    function renderTable() {
        const body = $('#taskTableBody');
        let html = '';
        let visibleCount = 0;

        let cntTypeAll=0, cntAssign=0, cntAct=0, cntQuiz=0;
        let classCounts = { 'all': allTasks.length };

        allTasks.forEach(t => {
            if (!classCounts[t.class_id]) classCounts[t.class_id] = 0;
            classCounts[t.class_id]++;
            
            const matchClass = currentFilterClass === 'all' || t.class_id == currentFilterClass;
            const matchType = currentFilterType === 'all' || t.real_type === currentFilterType;

            if (matchClass) {
                cntTypeAll++;
                if (t.real_type === 'assignment') cntAssign++;
                if (t.real_type === 'activity') cntAct++;
                if (t.real_type === 'quiz') cntQuiz++;
            }

            if (matchClass && matchType) {
                visibleCount++;
                const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric'}) : '—';
                const past = t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0));
                
                let icon, badgeCls, badgeText;
                if (t.is_quiz) { icon='fa-brain'; badgeCls='bg-purple-subtle text-purple border border-purple-subtle'; badgeText='Quiz'; }
                else if (t.category === 'activity') { icon='fa-running'; badgeCls='bg-info-subtle text-info border border-info-subtle'; badgeText='Activity'; }
                else { icon='fa-file-alt'; badgeCls='bg-primary-subtle text-primary border border-primary-subtle'; badgeText='Assignment'; }

                const responses = t.is_quiz ? `${t.attempt_count} attempted` : `${t.sub_count} submitted`;

                html += `
                <tr>
                    <td class="ps-4">
                        <div class="fw-bold text-dark mb-1">${t.title}</div>
                        <div class="font-monospace-sm text-muted">ID #${t.assignment_id} ${t.is_quiz ? `· ${t.q_count} Qs` : ''}</div>
                    </td>
                    <td><span class="badge ${badgeCls} px-2 py-1"><i class="fas ${icon} me-1"></i>${badgeText}</span></td>
                    <td>
                        <span class="badge bg-light text-dark border mb-1">${t.course_code}</span>
                        <div class="font-monospace-sm text-muted">${t.semester} ${t.year}</div>
                    </td>
                    <td class="small fw-bold ${past ? 'text-danger' : 'text-muted'}"><i class="far fa-calendar-alt me-1"></i>${dueStr}</td>
                    <td class="small fw-bold font-monospace-sm text-primary">${responses}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-light border text-success fw-bold me-1" onclick="openReassign(${t.assignment_id}, '${t.real_type}', '${escHtml(t.title)}', ${t.class_id})" title="Assign to other classes"><i class="fas fa-share-nodes"></i></button>
                        <a href="assignment.html?class_id=${t.class_id}" class="btn btn-sm btn-light border text-primary fw-bold me-1" title="View in class"><i class="fas fa-external-link-alt"></i></a>
                        <button class="btn btn-sm btn-light border text-danger fw-bold" onclick="deleteTask(${t.assignment_id}, '${t.real_type}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }
        });

        if (visibleCount === 0) {
            html = `<tr><td colspan="6" class="text-center py-5 text-muted fw-bold"><i class="fas fa-filter d-block fs-3 mb-2 opacity-50"></i>No tasks match the selected filters.</td></tr>`;
        }

        body.html(html);

        $('#cnt-type-all').text(cntTypeAll);
        $('#cnt-type-assignment').text(cntAssign);
        $('#cnt-type-activity').text(cntAct);
        $('#cnt-type-quiz').text(cntQuiz);
        $('#cnt-cls-all').text(classCounts['all'] || 0);
        allClasses.forEach(c => { $(`#cnt-cls-${c.class_id}`).text(classCounts[c.class_id] || 0); });
    }

    function populateModals() {
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
        $('#ri_classList').html(clsHtml.replace(/name="class_ids\[\]"/g, 'name="new_class_ids[]"').replace(/cb_lbl_/g, 'ri_lbl_'));
    }

    window.deleteTask = function(id, type) {
        if (!confirm('Delete this task and all submissions?')) return;
        $.post('/artisansLMS/backend/endpoints/instructor_assignments.php', { action: 'delete_task', task_id: id, task_type: type }, function(res) {
            if(res.status==='success') { showAlert('success', 'Task deleted.'); fetchData(); }
        }, 'json');
    };

    window.openReassign = function(id, type, title, currentClassId) {
        $('#ri_id').val(id);
        $('#ri_type').val(type);
        $('#ri_title').text(title);
        $('#ri_meta').text(type);

        const iconMap = { assignment:'<i class="fas fa-file-alt text-primary"></i>', activity:'<i class="fas fa-running text-info"></i>', quiz:'<i class="fas fa-brain text-purple"></i>' };
        $('#ri_icon').html(iconMap[type] || '<i class="fas fa-tasks"></i>');

        $('#ri_classList .cls-item').removeClass('chk disabled-cls').find('input').prop('checked', false).prop('disabled', false);
        $('#ri_classList .already-tag').remove();

        const currentItem = $(`#ri_lbl_${currentClassId}`);
        if(currentItem.length) {
            currentItem.addClass('disabled-cls').find('input').prop('disabled', true);
            currentItem.find('> div').append('<span class="already-tag badge bg-secondary ms-2 small">✓ Current</span>');
        }
        new bootstrap.Modal(document.getElementById('reassignModal')).show();
    };

    $('#reassignForm').on('submit', function(e) {
        e.preventDefault();
        const btn = $('#reassignSubmitBtn');
        const cids = [];
        $('input[name="new_class_ids[]"]:checked').each(function() { cids.push($(this).val()); });
        if(cids.length === 0) { alert('Select at least one class.'); return; }
        
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Assigning...');
        $.post('/artisansLMS/backend/endpoints/instructor_assignments.php', {
            action: 'reassign_task', reassign_id: $('#ri_id').val(), reassign_type: $('#ri_type').val(), new_class_ids: cids.join(',')
        }, function(res) {
            if(res.status==='success') { $('#reassignModal').modal('hide'); showAlert('success', res.message); fetchData(); } 
            else { alert(res.message); }
            btn.prop('disabled', false).html('<i class="fas fa-share-nodes me-2"></i> Assign to Selected Classes');
        }, 'json');
    });

    $('input[name="task_type"]').on('change', function() {
        const isQuiz = $(this).val() === 'quiz';
        $('#sec-file').toggleClass('d-none', isQuiz);
        $('#sec-quiz').toggleClass('d-none', !isQuiz);
    });

    let qs = [];
    window.addQ = function(type) { qs.push({ type: type, text:'', choices:{A:'',B:'',C:'',D:''}, correct: type==='true_false'?'TRUE':'A', points:1 }); renderQs(); };
    window.removeQ = function(i) { qs.splice(i, 1); renderQs(); };
    window.setQText = function(i,v) { qs[i].text=v; };
    window.setChoice = function(i,k,v) { qs[i].choices[k]=v; };
    window.setCorrect = function(i,v) { qs[i].correct=v; };
    window.setQPoints = function(i,v) { qs[i].points=parseInt(v)||1; };
    
    function renderQs() {
        const list = $('#qlist'); list.empty();
        $('#qcnt').text(qs.length); $('#qhint').toggle(qs.length === 0);

        qs.forEach((q, i) => {
            let choicesHTML = '';
            if (q.type === 'multiple_choice') {
                ['A','B','C','D'].forEach(k => { choicesHTML += `<div class="d-flex align-items-center gap-2 mb-2"><input type="radio" name="cor${i}" class="form-check-input mt-0" value="${k}" ${q.correct===k?'checked':''} onchange="setCorrect(${i},'${k}')"><span class="badge bg-secondary">${k}</span><input type="text" class="form-control form-control-sm border shadow-sm" placeholder="Choice ${k}" value="${escHtml(q.choices[k])}" oninput="setChoice(${i},'${k}',this.value)"></div>`; });
            } else {
                choicesHTML = `<div class="d-flex gap-3 mt-2"><label class="d-flex align-items-center gap-2 fw-bold cursor-pointer"><input type="radio" class="form-check-input mt-0" name="cor${i}" value="TRUE" ${q.correct==='TRUE'?'checked':''} onchange="setCorrect(${i},'TRUE')"><span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill">✅ True</span></label><label class="d-flex align-items-center gap-2 fw-bold cursor-pointer"><input type="radio" class="form-check-input mt-0" name="cor${i}" value="FALSE" ${q.correct==='FALSE'?'checked':''} onchange="setCorrect(${i},'FALSE')"><span class="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 rounded-pill">❌ False</span></label></div>`;
            }
            list.append(`<div class="card bg-white border rounded-4 shadow-sm mb-3 position-relative p-4"><button class="btn btn-sm btn-danger rounded-circle position-absolute" style="top:15px;right:15px;width:30px;height:30px;padding:0;" onclick="removeQ(${i})" type="button"><i class="fas fa-times"></i></button><div class="d-flex align-items-start gap-3 mb-3"><span class="badge bg-primary rounded-circle fs-6 p-2 d-flex align-items-center justify-content-center" style="width:35px;height:35px;">${i+1}</span><div class="flex-grow-1 pe-4"><textarea class="form-control shadow-sm border-0 bg-light mb-3" rows="2" placeholder="Question text..." oninput="setQText(${i},this.value)">${escHtml(q.text)}</textarea><div class="d-flex gap-3 align-items-center"><span class="small fw-bold text-muted">Points:</span><input type="number" class="form-control form-control-sm border shadow-sm" style="width:80px;" min="1" value="${q.points}" oninput="setQPoints(${i},this.value)"><span class="badge ${q.type==='multiple_choice'?'bg-primary-subtle text-primary':'bg-success-subtle text-success'} rounded-pill px-3 py-2">${q.type==='multiple_choice'?'Multiple Choice':'True / False'}</span></div></div></div><div class="ms-5 ps-2 border-start border-2 border-light">${choicesHTML}</div></div>`);
        });
    }

    $('#createTaskForm').on('submit', function(e) {
        e.preventDefault();
        const isQuiz = $('input[name="task_type"]:checked').val() === 'quiz';
        const cids = [];
        $('input[name="class_ids[]"]:checked').each(function() { cids.push($(this).val()); });
        if(cids.length === 0) { alert('Select at least one class.'); return; }
        
        if (isQuiz) {
            if (qs.length === 0) { alert('Add at least one question.'); return; }
            for (let i = 0; i < qs.length; i++) {
                if (!qs[i].text.trim()) { alert(`Question ${i+1} has no text.`); return; }
                if (qs[i].type==='multiple_choice') { for(const k of['A','B','C','D']){ if(!qs[i].choices[k].trim()){alert(`Question ${i+1}: Choice ${k} is empty.`);return;} } }
            }
            $('#qjson').val(JSON.stringify(qs));
        }
        
        const form = this;
        const formData = new FormData(form);
        formData.append('action', 'create_task');
        formData.append('class_ids', cids.join(','));
        
        const btn = $('#createSubmitBtn');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Creating...');

        $.ajax({
            url: '/artisansLMS/backend/endpoints/instructor_assignments.php', type: 'POST', data: formData, contentType: false, processData: false, dataType: 'json',
            success: function(res) {
                if(res.status==='success') { $('#createModal').modal('hide'); form.reset(); qs = []; renderQs(); showAlert('success', res.message); fetchData(); }
                else { alert(res.message); }
                btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i> Post to Selected Classes');
            },
            error: function() { alert('Network Error'); btn.prop('disabled', false).html('<i class="fas fa-paper-plane me-2"></i> Post to Selected Classes'); }
        });
    });

    function showAlert(type, msg) {
        const html = `<div class="alert alert-${type} alert-dismissible shadow-sm fw-bold rounded-4 mb-4" role="alert"><i class="fas fa-${type==='success'?'check-circle':'exclamation-triangle'} me-2"></i>${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
        $('#alertsContainer').html(html);
        setTimeout(() => $('.alert').fadeOut(300, function(){ $(this).remove(); }), 4000);
    }
});

// ─── Header ───────────────────────────────────────────────────────────────────
const API = '/artisansLMS/backend/index.php';

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
        'reports.html':                { title: 'System Reports',         subtitle: 'Generate insights and analytics on system activity.' },
        'profile.html':                { title: 'My Profile',             subtitle: 'Manage your personal information and account settings.' },
        'archived.html':               { title: 'Archives',               subtitle: 'All archived records are stored here. Restore or permanently delete them.' },
        'assignments.html':            { title: 'Assignments',            subtitle: 'View and submit your class assignments.' },
        'grades.html':                 { title: 'Grades',                 subtitle: 'View your academic performance and feedback.' },
        'quizzes.html':                { title: 'Quizzes',                subtitle: 'Take and review your quizzes.' },
        'modules.html':                { title: 'Course Materials',       subtitle: 'Browse uploaded files, lectures, and resources.' },
        'todo.html':                   { title: 'Task Manager',           subtitle: 'Manage your personal tasks and to-dos.' },
    };

    const currentPage = window.location.pathname.split('/').pop() || 'instructor_assignments.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    $.ajax({
        url: API,
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
                $('#headerUserRole').text(u.role || 'Student');
                $('#headerAvatar').attr({ src: smAvt, alt: u.name });
                $('#dropdownUserName').text(u.name);
                $('#dropdownUserRole').text(u.role || 'Student');
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
            url: API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/artisansLMS/client/pages/login.html'; }
        });
    });
}