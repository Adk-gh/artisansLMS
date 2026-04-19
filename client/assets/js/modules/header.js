const API = '/artisansLMS/backend/index.php';

// ─── Page Title Map ───────────────────────────────────────────────────────────

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

// ─── Set Page Title ───────────────────────────────────────────────────────────
// Exposed globally so dashboard.js / collaborations.js can call it
// from inside the $.load() callback once the header HTML is in the DOM

window.setPageTitle = function () {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const page        = PAGE_TITLES[currentPage] || { title: 'Artisans LMS', subtitle: 'Learning Management System' };

    $('#headerPageTitle').text(page.title);
    $('#headerPageSubtitle').text(page.subtitle);
    document.title = 'LMS | ' + page.title;
};

// ─── Header Init (called from $.load() callback in each page's JS) ────────────

window.initHeader = function () {

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
                $('#headerAvatar').attr('src', avatarSm);
                $('#dropdownUserName').text(fullName);
                $('#dropdownUserRole').text(role);
                $('#dropdownAvatar').attr('src', avatarLg);

            } else {
                window.location.href = '/artisansLMS/client/pages/login.html';
            }
        },
        error: function () {
            window.location.href = '/artisansLMS/client/pages/login.html';
        }
    });

    // Call setPageTitle immediately — header DOM is already loaded at this point
    window.setPageTitle();

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
};