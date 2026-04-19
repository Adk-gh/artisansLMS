$(document).ready(function() {
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/reports.php';

    fetchReportData();

    function fetchReportData() {
        $.ajax({
            url: `${API_URL}?action=get_dashboard_data`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    renderSummaryPills(json.data.summary);
                    renderPerformanceCards(json.data.summary);
                    renderCourseTable(json.data.courses);
                    renderFacultyWorkload(json.data.faculty_load);
                    renderTopStudents(json.data.top_students);
                    renderInstructorPerformance(json.data.instructor_performance);
                } else {
                    console.error("Failed to load report data:", json.message);
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error:", error);
            }
        });
    }

    function renderSummaryPills(summary) {
        $('#statStudents').text(summary.total_students);
        $('#statClasses').text(summary.total_classes);
        $('#statTasks').text(summary.total_tasks);
        $('#statQuizzes').text(summary.total_quizzes);
    }

    function renderPerformanceCards(summary) {
        $('#avgGradeVal').text(summary.avg_grade + '%');
        $('#avgGradeSub').text(summary.avg_grade + '%');
        $('#avgGradeBar').css({
            'width': Math.min(summary.avg_grade, 100) + '%',
            'background': summary.avg_grade >= 85 ? '#22c55e' : (summary.avg_grade >= 70 ? '#f59e0b' : '#ef4444')
        });
        let avgStatus = '';
        if (summary.avg_grade >= 85)      avgStatus = '<span class="status-good"><i class="fas fa-check-circle me-1"></i>Meeting target</span>';
        else if (summary.avg_grade >= 70) avgStatus = '<span class="status-warn"><i class="fas fa-exclamation-circle me-1"></i>Below target</span>';
        else                              avgStatus = '<span class="status-bad"><i class="fas fa-times-circle me-1"></i>Needs attention</span>';
        $('#avgGradeStatus').html(avgStatus);

        $('#subRateVal').text(summary.submission_rate + '%');
        $('#subRateSub').text(`${summary.total_submitted} of ${summary.total_expected} expected submissions turned in.`);
        $('#subRateBar').css({
            'width': Math.min(summary.submission_rate, 100) + '%',
            'background': summary.submission_rate >= 80 ? '#22c55e' : (summary.submission_rate >= 60 ? '#f59e0b' : '#ef4444')
        });
        let subStatus = '';
        if (summary.submission_rate >= 80)      subStatus = '<span class="status-good"><i class="fas fa-check-circle me-1"></i>High engagement</span>';
        else if (summary.submission_rate >= 60) subStatus = '<span class="status-warn"><i class="fas fa-exclamation-circle me-1"></i>Moderate engagement</span>';
        else                                    subStatus = '<span class="status-bad"><i class="fas fa-times-circle me-1"></i>Low submission rate</span>';
        $('#subRateStatus').html(subStatus);

        $('#quizRateVal').text(summary.quiz_pass_rate + '%');
        $('#quizRateSub').text(`${summary.total_quiz_passed} of ${summary.total_quiz_attempts} attempts scored ≥75%.`);
        $('#quizRateBar').css({
            'width': Math.min(summary.quiz_pass_rate, 100) + '%',
            'background': summary.quiz_pass_rate >= 75 ? '#22c55e' : (summary.quiz_pass_rate >= 50 ? '#f59e0b' : '#ef4444')
        });
        let quizStatus = '';
        if (summary.quiz_pass_rate >= 75)      quizStatus = '<span class="status-good"><i class="fas fa-check-circle me-1"></i>Strong performance</span>';
        else if (summary.quiz_pass_rate >= 50) quizStatus = '<span class="status-warn"><i class="fas fa-exclamation-circle me-1"></i>Needs review</span>';
        else                                   quizStatus = '<span class="status-bad"><i class="fas fa-times-circle me-1"></i>Intervention needed</span>';
        $('#quizRateStatus').html(quizStatus);
    }

    function renderCourseTable(courses) {
        const $tbody = $('#courseTableBody');
        $tbody.empty();

        if (courses.length === 0) {
            $tbody.html('<tr><td colspan="5" class="text-center py-4 text-muted small">No class data available yet.</td></tr>');
            return;
        }

        let html = '';
        courses.forEach(c => {
            const avg = parseFloat(c.avg_g);
            let quizCell = '<span class="text-muted small">—</span>';
            if (c.quiz_attempts > 0) {
                quizCell = `<span class="badge bg-light border" style="color:#7c3aed;">${c.quiz_passed}/${c.quiz_attempts} passed</span>`;
            }

            let gradeCell = '<div class="fw-bold text-primary">—</div>';
            if (avg > 0) {
                const bgCol = avg >= 75 ? '#22c55e' : (avg >= 60 ? '#f59e0b' : '#ef4444');
                gradeCell = `
                    <div class="fw-bold text-primary">${avg}%</div>
                    <div class="prog-thin" style="width:80px;">
                        <div class="prog-thin-fill" style="width:${avg}%;background:${bgCol}"></div>
                    </div>`;
            }

            let statusCell = '<span class="text-muted small">No grades yet</span>';
            if (avg >= 75)     statusCell = '<span class="status-good"><i class="fas fa-check-circle me-1"></i>Meeting Targets</span>';
            else if (avg > 0)  statusCell = '<span class="status-bad"><i class="fas fa-exclamation-triangle me-1"></i>Intervention Needed</span>';

            html += `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold">${c.course_code}</div>
                    <small class="text-muted">${c.name}</small>
                </td>
                <td><span class="badge bg-light text-dark border">${c.sub_count}</span></td>
                <td>${quizCell}</td>
                <td>${gradeCell}</td>
                <td class="text-end pe-4">${statusCell}</td>
            </tr>`;
        });
        $tbody.html(html);
    }

    function renderFacultyWorkload(loads) {
        const $container = $('#facultyLoadContainer');
        $container.empty();

        if (loads.length === 0) {
            $container.html('<p class="text-center text-muted small py-3 mb-0">No instructor data.</p>');
            return;
        }

        const maxLoad = parseInt(loads[0].class_count) || 1;
        let html = '';
        loads.forEach(l => {
            const cnt = parseInt(l.class_count);
            const pct = Math.round((cnt / maxLoad) * 100);
            html += `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="fw-bold text-dark">Prof. ${l.last_name}</small>
                    <span class="badge bg-primary-subtle text-primary rounded-pill">${cnt} class${cnt !== 1 ? 'es' : ''}</span>
                </div>
                <div class="prog-thin">
                    <div class="prog-thin-fill" style="width:${pct}%;background:#0ea5e9;"></div>
                </div>
            </div>`;
        });
        $container.html(html);
    }

    function renderTopStudents(students) {
        const $container = $('#topStudentsContainer');
        $container.empty();

        if (students.length === 0) {
            $container.html('<p class="text-center text-muted small py-3 mb-0">No graded data yet.</p>');
            return;
        }

        const medals = ['🥇', '🥈', '🥉', '#4', '#5'];
        let html = '';
        students.forEach((st, idx) => {
            const borderCls = idx < students.length - 1 ? 'border-bottom' : '';
            html += `
            <div class="d-flex justify-content-between align-items-center py-2 ${borderCls}">
                <div class="d-flex align-items-center gap-2">
                    <span style="font-size:.9rem;width:24px;">${medals[idx]}</span>
                    <div>
                        <div class="small fw-bold text-dark">${st.first_name} ${st.last_name}</div>
                        <div style="font-size:.68rem;color:#94a3b8;">${st.sub_count} submissions</div>
                    </div>
                </div>
                <span class="fw-bold text-success small">${st.avg_grade}%</span>
            </div>`;
        });
        $container.html(html);
    }

    // ── Instructor Performance ────────────────────────────────────────────────
    function renderInstructorPerformance(instructors) {
        const $tbody = $('#instructorPerfBody');
        $tbody.empty();

        if (!instructors || instructors.length === 0) {
            $tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted small">No instructor data available.</td></tr>');
            return;
        }

        let html = '';
        instructors.forEach(inst => {
            const avg       = parseFloat(inst.avg_grade) || 0;
            const subRate   = parseFloat(inst.submission_rate) || 0;
            const quizRate  = inst.quiz_pass_rate !== null ? parseFloat(inst.quiz_pass_rate) : null;

            // Avatar initials + colour
            const initials  = (inst.first_name.charAt(0) + inst.last_name.charAt(0)).toUpperCase();
            const avatarBg  = avg >= 80 ? '#dcfce7' : (avg >= 65 ? '#fef3c7' : (avg > 0 ? '#fee2e2' : '#f1f5f9'));
            const avatarCol = avg >= 80 ? '#15803d' : (avg >= 65 ? '#b45309' : (avg > 0 ? '#b91c1c' : '#64748b'));

            // Avg grade cell
            const gradeColor = avg >= 80 ? '#22c55e' : (avg >= 65 ? '#f59e0b' : (avg > 0 ? '#ef4444' : '#e2e8f0'));
            const gradeCell  = avg > 0
                ? `<div class="fw-bold" style="color:${avg >= 80 ? '#15803d' : (avg >= 65 ? '#b45309' : '#b91c1c')};">${avg}%</div>
                   <div class="prog-thin" style="width:80px;">
                       <div class="prog-thin-fill" style="width:${Math.min(avg,100)}%;background:${gradeColor};"></div>
                   </div>`
                : '<span class="text-muted small">No grades</span>';

            // Submission rate cell
            const subColor  = subRate >= 80 ? '#22c55e' : (subRate >= 60 ? '#f59e0b' : '#ef4444');
            const subCell   = inst.task_count > 0
                ? `<div class="fw-bold" style="color:${subRate >= 80 ? '#15803d' : (subRate >= 60 ? '#b45309' : '#b91c1c')};">${subRate}%</div>
                   <div class="prog-thin" style="width:80px;">
                       <div class="prog-thin-fill" style="width:${Math.min(subRate,100)}%;background:${subColor};"></div>
                   </div>`
                : '<span class="text-muted small">No tasks</span>';

            // Quiz pass rate cell
            const quizCell  = quizRate !== null
                ? `<span class="badge rounded-pill px-2 py-1" style="background:${quizRate >= 75 ? '#dcfce7' : (quizRate >= 50 ? '#fef3c7' : '#fee2e2')};color:${quizRate >= 75 ? '#15803d' : (quizRate >= 50 ? '#b45309' : '#b91c1c')};">${quizRate}%</span>`
                : '<span class="text-muted small">—</span>';

            // Overall rating — weighted: grade 50%, submission 30%, quiz 20%
            let score = 0;
            let factors = 0;
            if (avg > 0)          { score += avg * 0.5;      factors += 0.5; }
            if (inst.task_count > 0) { score += subRate * 0.3; factors += 0.3; }
            if (quizRate !== null)   { score += quizRate * 0.2; factors += 0.2; }
            const rating = factors > 0 ? Math.round(score / factors) : null;

            let ratingHtml = '<span class="text-muted small">No data</span>';
            if (rating !== null) {
                const rBg  = rating >= 80 ? '#dcfce7' : (rating >= 65 ? '#fef3c7' : '#fee2e2');
                const rCol = rating >= 80 ? '#15803d' : (rating >= 65 ? '#b45309' : '#b91c1c');
                const rLbl = rating >= 80 ? 'Excellent' : (rating >= 65 ? 'Fair' : 'Needs Support');
                ratingHtml = `
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <span class="small fw-bold" style="color:${rCol};">${rLbl}</span>
                        <span class="perf-score" style="background:${rBg};color:${rCol};">${rating}</span>
                    </div>`;
            }

            html += `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-2">
                        <div class="inst-avatar" style="background:${avatarBg};color:${avatarCol};">${initials}</div>
                        <div>
                            <div class="fw-bold text-dark" style="font-size:.85rem;">
                                ${inst.first_name} ${inst.last_name}
                            </div>
                            <div style="font-size:.68rem;color:#94a3b8;">ID #${inst.employee_id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border" style="font-size:.7rem;">
                        ${inst.dept_name || 'Unassigned'}
                    </span>
                </td>
                <td>
                    <span class="badge bg-primary-subtle text-primary rounded-pill px-2">${inst.class_count}</span>
                </td>
                <td>
                    <span class="small text-dark fw-medium">${inst.task_count} tasks</span>
                    <span class="text-muted small"> / </span>
                    <span class="small text-dark fw-medium">${inst.quiz_count} quizzes</span>
                </td>
                <td>${subCell}</td>
                <td>${gradeCell}</td>
                <td>${quizCell}</td>
                <td class="text-end pe-4">${ratingHtml}</td>
            </tr>`;
        });

        $tbody.html(html);
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

    const currentPage = window.location.pathname.split('/').pop() || 'reports.html';
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