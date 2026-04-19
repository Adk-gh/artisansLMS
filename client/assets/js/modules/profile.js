$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/profile.php';

    // ── INITIAL LOAD ──
    fetchProfileData();

    // ── EVENT LISTENERS ──
    $('#updateProfileForm').on('submit', handleUpdateProfile);
    $('#changePasswordForm').on('submit', handleChangePassword);

    window.togglePw = function(id, btn) {
        const input = document.getElementById(id);
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    };

    // ── API CALLS ──

    function fetchProfileData() {
        $.ajax({
            url: `${API_URL}?action=get_profile`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    renderProfile(json);
                } else {
                    showToast(json.message || "Failed to load profile.", "error");
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error:", xhr.responseText || error);
                showToast("Server error loading profile.", "error");
            }
        });
    }

    function handleUpdateProfile(e) {
        e.preventDefault();
        
        const data = {
            first_name: $('#prof_fname').val(),
            last_name: $('#prof_lname').val(),
            email: $('#prof_email').val()
        };

        const $btn = $(this).find('button[type="submit"]');
        const origText = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Saving...');

        $.ajax({
            url: `${API_URL}?action=update_profile`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            dataType: 'json',
            success: function(json) {
                $btn.prop('disabled', false).html(origText);
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    // Refresh data to sync header and hero names
                    fetchProfileData();
                    // Optionally force-refresh header name if necessary
                    $('#headerUserName, #dropdownUserName').text(json.new_name);
                    $('#heroName').html(json.new_name + ' <span class="fs-3">👋</span>');
                } else {
                    showToast(json.message, "error");
                }
            },
            error: function() {
                $btn.prop('disabled', false).html(origText);
                showToast("An error occurred.", "error");
            }
        });
    }

    function handleChangePassword(e) {
        e.preventDefault();

        const data = {
            current_password: $('#cur_pw').val(),
            new_password: $('#new_pw').val(),
            confirm_password: $('#cfm_pw').val()
        };

        if (data.new_password !== data.confirm_password) {
            showToast("New passwords do not match.", "error");
            return;
        }

        const $btn = $(this).find('button[type="submit"]');
        const origText = $btn.html();
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Updating...');

        $.ajax({
            url: `${API_URL}?action=change_password`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            dataType: 'json',
            success: function(json) {
                $btn.prop('disabled', false).html(origText);
                if (json.status === 'success') {
                    showToast(json.message, "success");
                    $('#changePasswordForm')[0].reset();
                } else {
                    showToast(json.message, "error");
                }
            },
            error: function(xhr) {
                $btn.prop('disabled', false).html(origText);
                try {
                    let err = JSON.parse(xhr.responseText);
                    showToast(err.message, "error");
                } catch(e) {
                    showToast("Failed to change password.", "error");
                }
            }
        });
    }

    // ── DOM RENDERING ──

    function renderProfile(data) {
        const p = data.profile;
        const fullName = `${p.first_name} ${p.last_name}`;
        
        // Render Hero
        $('#heroAvatar').attr('src', `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0ea5e9&color=fff&bold=true&size=128`);
        $('#heroFullName').text(fullName);
        $('#heroEmail').html(`<i class="fas fa-envelope me-1"></i>${p.email || 'No email set'}`);
        
        // Render Role Badge
        let badgeHtml = '📚 Student';
        if (data.is_teacher) {
            badgeHtml = data.role === 'admin' ? '⚙️ Admin' : '🎓 Instructor';
        }
        $('#heroRoleBadge').html(badgeHtml);

        // Render Form Inputs
        $('#prof_fname').val(p.first_name);
        $('#prof_lname').val(p.last_name);
        $('#prof_email').val(p.email);

        // Render Stats Blocks
        let statsHtml = '';
        if (data.is_teacher) {
            statsHtml = `
                <div class="col-4">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.classes}</div>
                        <div class="stat-label">Classes</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.students}</div>
                        <div class="stat-label">Students</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.tasks}</div>
                        <div class="stat-label">Tasks</div>
                    </div>
                </div>`;
        } else {
            statsHtml = `
                <div class="col-4">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.classes}</div>
                        <div class="stat-label">Classes</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.submitted}</div>
                        <div class="stat-label">Submitted</div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.quizzes}</div>
                        <div class="stat-label">Quizzes</div>
                    </div>
                </div>`;
        }
        $('#statsContainer').html(statsHtml);
    }

    // ── UTILITIES ──

    function showToast(msg, type) {
        $('#toast').remove();
        const isSuccess = type === "success";
        const bgColor = isSuccess ? '#dcfce7' : '#fee2e2';
        const color = isSuccess ? '#15803d' : '#be123c';
        const border = isSuccess ? '#bbf7d0' : '#fecdd3';
        const icon = isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle';

        const toastHtml = `
            <div id="toast" class="toast-bar" style="background:${bgColor}; color:${color}; border:1px solid ${border}; position:fixed; top:20px; right:20px; z-index:9999; padding:12px 20px; border-radius:10px; font-size:.8rem; font-weight:600; display:flex; align-items:center; gap:8px; animation:slideIn .3s ease; box-shadow:0 4px 20px rgba(0,0,0,.12); transition:opacity .5s;">
                <i class="fas ${icon}"></i> ${msg}
            </div>
        `;
        $('body').append(toastHtml);
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

    const currentPage = window.location.pathname.split('/').pop() || 'profile.html';
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