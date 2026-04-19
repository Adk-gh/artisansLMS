$(document).ready(function() {
    // ── 1. Load sidebar & header components via jQuery ──────────────────
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    // ── 2. Helpers ──────────────────────────────────────────────────────
    const fmt     = n => Number(n).toLocaleString();
    const pct     = n => `${n}%`;
    const setText  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setWidth = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = `${Math.min(val, 100)}%`; };

    function badgeCardHTML(badge) {
        const catClass    = badge.cat === 'Tasks' ? 'Tasks' : 'Quizzes';
        const lockedClass = badge.earned ? '' : 'locked';
        const statusBadge = badge.earned
            ? `<span class="badge bg-success-subtle text-success border border-success-subtle w-100 py-2">
                   <i class="fas fa-unlock me-1"></i> Unlocked
               </span>`
            : `<span class="badge bg-light text-muted border w-100 py-2">
                   <i class="fas fa-lock me-1"></i> Locked
               </span>`;
        return `
            <div class="col-6 col-md-3">
                <div class="badge-card shadow-sm ${lockedClass}">
                    <span class="badge-cat ${catClass}">${badge.cat}</span>
                    <div class="badge-icon-wrapper" style="background:${badge.color};">
                        <i class="fas ${badge.icon}"></i>
                    </div>
                    <h6 class="fw-bold text-dark mb-1">${badge.title}</h6>
                    <p class="text-muted m-0" style="font-size:.73rem;">${badge.desc}</p>
                    <div class="mt-3">${statusBadge}</div>
                </div>
            </div>`;
    }

    // ── 3. Fetch Data via jQuery AJAX ───────────────────────────────────
    $.ajax({
        url: '/artisansLMS/backend/endpoints/my_analytics.php',
        method: 'GET',
        dataType: 'json',
        success: function(d) {
            if (d.status === 'error') {
                console.error('Server returned an error:', d.message);
                $('#analytics-skeleton').hide();
                $('#analytics-error').removeClass('d-none').text(d.message);
                return;
            }

            // Player card
            setText('pc-name',        d.student.name);
            setText('pc-level',       d.exp.level);
            setText('pc-total-exp',   fmt(d.exp.total));
            setText('pc-task-exp',    fmt(d.exp.from_tasks));
            setText('pc-quiz-exp',    fmt(d.exp.from_quizzes));
            setText('pc-lvl-from',    d.exp.level);
            setText('pc-lvl-to',      d.exp.level + 1);
            setText('pc-cur-exp',     d.exp.cur_level_exp);
            setText('pc-max-exp',     d.exp.exp_per_level);
            setText('pc-exp-to-next', fmt(d.exp.exp_to_next));

            setTimeout(() => {
                $('#exp-bar').css('width', `${d.exp.exp_percent}%`);
            }, 150);

            // Stat boxes
            setText('stat-task-completion', pct(d.tasks.completion_rate));
            setWidth('bar-task-completion',     d.tasks.completion_rate);
            setText('stat-task-detail',
                `${d.tasks.submitted} / ${d.tasks.total} submitted`);

            setText('stat-avg-grade', pct(d.tasks.average_grade));
            setWidth('bar-avg-grade',     d.tasks.average_grade);

            setText('stat-quiz-completion', pct(d.quizzes.completion_rate));
            setWidth('bar-quiz-completion',     d.quizzes.completion_rate);
            setText('stat-quiz-detail',
                `${d.quizzes.attempts} / ${d.quizzes.total_posted} taken`);

            setText('stat-avg-quiz', pct(d.quizzes.average_pct));
            setWidth('bar-avg-quiz',     d.quizzes.average_pct);
            setText('stat-quiz-pass',
                `${d.quizzes.pass_count} passed · ${d.quizzes.pass_rate}% pass rate`);

            // Badges
            const earned    = d.badges.filter(b => b.earned).length;
            const total     = d.badges.length;
            const remaining = total - earned;
            setText('badge-summary',
                earned < total
                    ? `${earned} of ${total} badges unlocked. Keep going — ${remaining} more to unlock!`
                    : `${earned} of ${total} badges unlocked. 🎉 You've unlocked everything!`
            );

            const taskBadges = d.badges.filter(b => b.cat === 'Tasks');
            const quizBadges = d.badges.filter(b => b.cat === 'Quizzes');

            $('#task-badges').html(taskBadges.map(badgeCardHTML).join(''));
            $('#quiz-badges').html(quizBadges.map(badgeCardHTML).join(''));

            $('#analytics-skeleton').hide();
            $('#analytics-content').fadeIn();
        },
        error: function(xhr, status, error) {
            console.error('Analytics AJAX error:', error);
            console.error('Response text:', xhr.responseText);
            $('#analytics-skeleton').hide();
            $('#analytics-error').removeClass('d-none');
        }
    });
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

    const currentPage = window.location.pathname.split('/').pop() || 'my_analytics.html';
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