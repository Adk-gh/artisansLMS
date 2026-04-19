const API = '/artisansLMS/backend/index.php';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

$(document).ready(function () {

    $("#sidebar-container").load("/artisansLMS/client/components/sidebar.html", function (res, status, xhr) {
        if (status === 'error') console.error('Sidebar failed:', xhr.status, xhr.statusText);
    });

    $("#header-container").load("/artisansLMS/client/components/header.html", function (res, status, xhr) {
        if (status === 'error') {
            console.error('Header failed:', xhr.status, xhr.statusText);
            return;
        }
        initHeader();
    });

    initDashboard();
});

// ─── Header ──────────────────────────────────────────────────────────────────

function initHeader() {

    // ── Page Title ────────────────────────────────────────────────────────
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

    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };
    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;

    // ── User Session ──────────────────────────────────────────────────────
    $.ajax({
        url: API,
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ route: 'auth', action: 'checkSession' }),
        success: function (res) {
            if (res.status === 'success' && res.logged_in) {
                const user     = res.user;
                const fullName = user.name;
                const role     = user.role || 'Student';
                const avatarSm = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=e2e8f0&color=475569`;
                const avatarLg = avatarSm + '&size=128';

                $('#headerUserName').text(fullName);
                $('#headerUserRole').text(role);
                $('#headerAvatar').attr({ src: avatarSm, alt: fullName });
                $('#dropdownUserName').text(fullName);
                $('#dropdownUserRole').text(role);
                $('#dropdownAvatar').attr({ src: avatarLg, alt: fullName });
                $('#heroName').html(fullName + ' <span class="fs-3">👋</span>');

            } else {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function () {
            window.location.href = '/artisansLMS/client/pages/login.html';
        }
    });

    // ── Logout ────────────────────────────────────────────────────────────
    $(document).on('click', '#logoutBtn', function (e) {
        e.preventDefault();
        $.ajax({
            url: API,
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function () {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        });
    });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function initDashboard() {

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    $('#dateText').text(new Date().toLocaleDateString('en-US', dateOptions));

    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12)      greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    $('#greetingText').text(greeting);

    fetch('/artisansLMS/backend/endpoints/dashboard.php')
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                renderStats(data.stats);
                renderTopCourses(data.top_courses);
                renderGender(data.gender_data, data.stats.total_students);
                renderDepts(data.dept_stats);
                renderRecentActivity(data.recent_enrollments);
                renderActiveClasses(data.active_classes);
            }
        })
        .catch(err => console.error('Dashboard fetch error:', err));
}

// ─── Render Functions ─────────────────────────────────────────────────────────

function renderStats(stats) {
    $('#statStudents').text(stats.total_students);
    $('#statFaculty').text(stats.total_professors);
    $('#statClasses').text(stats.total_classes);
    $('#statCourses').text(stats.total_courses);
    $('#statDepts').text(stats.total_depts);
    $('#mTotal_students').text(stats.total_students);
    $('#mTotal_courses').text(stats.total_courses);
    $('#mTotal_professors').text(stats.total_professors);
    $('#mTotal_depts').text(stats.total_depts);
    $('#mTotal_classes').text(stats.total_classes);
    $('#mTotal_enrolled').text(stats.total_enrolled);

    const avg = stats.total_classes > 0
        ? (stats.total_enrolled / stats.total_classes).toFixed(1)
        : '—';
    $('#mAvg_per_class').text(avg);
}

function renderTopCourses(courses) {
    const container = $('#courseEnrollList');
    if (!courses || courses.length === 0) {
        container.html('<p class="text-center text-muted small py-4 mb-0">No enrollment data yet.</p>');
        return;
    }
    const maxTotal = Math.max(...courses.map(c => c.total));
    container.html(courses.map((c, i) => {
        const pct = Math.round((c.total / maxTotal) * 100);
        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div class="d-flex align-items-center gap-2 text-truncate" style="min-width:0;">
                        <span class="text-muted small font-monospace">${i + 1}.</span>
                        <span class="badge bg-light text-primary border font-monospace">${c.course_code}</span>
                        <span class="small text-truncate">${c.name}</span>
                    </div>
                    <span class="fw-bold text-primary small font-monospace flex-shrink-0">${c.total}</span>
                </div>
                <div class="progress" style="height:5px;">
                    <div class="progress-bar bg-primary" style="width:${pct}%"></div>
                </div>
            </div>`;
    }).join(''));
}

function renderGender(genders, totalStudents) {
    const container = $('#genderList');
    if (!genders || genders.length === 0 || totalStudents === 0) {
        container.html('<p class="text-muted small text-center mb-0 py-2">No data available.</p>');
        return;
    }
    const colors = ['bg-info', 'bg-danger', 'bg-warning', 'bg-success'];
    const html = genders.map((g, i) => {
        const pct   = Math.round((g.total / totalStudents) * 100);
        const label = g.gender || 'Other';
        return `
            <div class="d-flex align-items-center gap-3 mb-3">
                <div class="fw-bold small text-secondary text-capitalize" style="width:50px;">${label}</div>
                <div class="progress flex-grow-1" style="height:8px;">
                    <div class="progress-bar ${colors[i % colors.length]}" style="width:${pct}%"></div>
                </div>
                <div class="fw-bold small font-monospace text-secondary text-end" style="width:30px;">${g.total}</div>
            </div>`;
    }).join('');
    container.html(html + `<div class="text-end mt-2" style="font-size:.7rem;color:#6c757d;">Total: ${totalStudents} students</div>`);
}

function renderDepts(depts) {
    const container = $('#deptList');
    if (!depts || depts.length === 0) {
        container.html('<p class="text-muted small text-center mb-0 py-2">No department data.</p>');
        return;
    }
    const colors = ['bg-primary', 'bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-secondary'];
    container.html(depts.map((d, i) => `
        <div class="d-flex align-items-center gap-2 py-2 border-bottom">
            <div class="rounded-circle ${colors[i % colors.length]}" style="width:10px;height:10px;flex-shrink:0;"></div>
            <div class="small fw-semibold text-dark flex-grow-1 text-truncate">${d.name}</div>
            <div class="small fw-bold font-monospace">${d.total}</div>
        </div>`
    ).join(''));
}

function renderRecentActivity(enrollments) {
    const container = $('#recentEnrollFeed');
    if (!enrollments || enrollments.length === 0) {
        container.html('<p class="text-center text-muted small py-4 mb-0">No recent activity.</p>');
        return;
    }
    const colors = ['bg-primary', 'bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-dark'];
    container.html(enrollments.map((e, i) => {
        const initials = (e.first_name.charAt(0) + e.last_name.charAt(0)).toUpperCase();
        const dateStr  = e.enroll_date
            ? new Date(e.enroll_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'Recent';
        return `
            <div class="d-flex align-items-center gap-3 py-3 border-bottom">
                <div class="rounded border ${colors[i % colors.length]} text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                     style="width:36px;height:36px;font-size:.8rem;flex-shrink:0;">${initials}</div>
                <div class="flex-grow-1 text-truncate" style="min-width:0;">
                    <div class="small fw-bold text-dark text-truncate">${e.first_name} ${e.last_name}</div>
                    <div class="text-muted text-truncate" style="font-size:.7rem;">Enrolled in <span class="fw-bold">${e.course_code}</span></div>
                </div>
                <div class="text-muted font-monospace flex-shrink-0" style="font-size:.65rem;">${dateStr}</div>
            </div>`;
    }).join(''));
}

function renderActiveClasses(classes) {
    const container = $('#classSessionsBody');
    if (!classes || classes.length === 0) {
        container.html('<tr><td colspan="5" class="text-center py-4 text-muted small">No active classes.</td></tr>');
        return;
    }
    container.html(classes.map(c => `
        <tr>
            <td>
                <div class="fw-bold text-dark small text-truncate" style="max-width:200px;">${c.course_name}</div>
                <div class="text-muted font-monospace" style="font-size:.7rem;">ID #${c.class_id}</div>
            </td>
            <td><span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle font-monospace">${c.course_code}</span></td>
            <td>
                <div class="fw-semibold text-dark small text-nowrap">${c.first_name} ${c.last_name}</div>
                <div class="text-muted" style="font-size:.7rem;">Instructor</div>
            </td>
            <td><span class="badge bg-light text-secondary border font-monospace">${c.semester} ${c.year}</span></td>
            <td>
                <span class="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill d-inline-flex align-items-center gap-1">
                    <span class="spinner-grow text-success" style="width:6px;height:6px;" role="status"></span> Active
                </span>
            </td>
        </tr>`
    ).join(''));
}