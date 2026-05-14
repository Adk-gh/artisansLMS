// archived.js

$(document).ready(function() {
    // ── Load UI Components ──
    $("#sidebar-placeholder").load("../components/sidebar.html");
    $("#header-placeholder").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });

    const API_URL = '../../backend/endpoints/archived.php';

    // Parse URL for active tab or default to 'classes'
    const urlParams = new URLSearchParams(window.location.search);
    let currentTab = urlParams.get('tab') || 'classes';
    let dateFilter = 'all';

    // ── 1. FUNCTION DEFINITIONS (Must be defined first) ──

    function switchTab(tab, updateUrl = true) {
        currentTab = tab;
        $('.arch-tab').removeClass('active');
        $(`.arch-tab[data-tab="${tab}"]`).addClass('active');

        if (updateUrl) {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?tab=' + tab;
            window.history.pushState({path:newUrl}, '', newUrl);
        }

        fetchArchivedData(tab);
    }

    function setDateFilter(el, val) {
        $('.arch-filter-chip').removeClass('factive');
        $(el).addClass('factive');
        dateFilter = val;
        applyFilters();
    }

    function toggleEnr(idx) {
        const $body = $('#enr-body-' + idx);
        const $chev = $('#enr-chev-' + idx);
        const $card = $('#enr-card-' + idx);
        if ($body.length) {
            const isOpen = $body.is(':visible');
            $body.slideToggle(180);
            $chev.toggleClass('fa-chevron-down', isOpen).toggleClass('fa-chevron-up', !isOpen);
            $card.toggleClass('border-primary', !isOpen);
        }
    }

    function fetchArchivedData(tab) {
        $('#tableContainer').html('<div class="text-center py-5 text-muted fw-bold"><div class="spinner-border spinner-border-sm mb-3 text-primary" style="width: 1.5rem; height: 1.5rem;"></div><br><span style="font-size: .9rem;">Loading archives...</span></div>');

        $.ajax({
            url: `${API_URL}?action=get_data&tab=${tab}`,
            method: 'GET',
            dataType: 'json',
            success: function(json) {
                if (json.status === 'success') {
                    Object.keys(json.counts).forEach(key => {
                        $(`.arch-tab[data-tab="${key}"] .tab-count`).text(json.counts[key]);
                    });
                    renderTable(tab, json.records);
                } else {
                    showToast(json.message || "Failed to load records.", "error");
                }
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error:", xhr.responseText || error);
                showToast("Server error loading archives.", "error");
            }
        });
    }

    // ── Custom Confirm Modal ──
    function showConfirmModal({ icon, iconClass, title, message, confirmLabel, confirmClass, onConfirm }) {
        $('#archModal').remove();
        const html = `
        <div id="archModal" class="arch-modal-backdrop">
            <div class="arch-modal">
                <div class="arch-modal-icon ${iconClass}"><i class="fas ${icon}"></i></div>
                <div class="arch-modal-title">${title}</div>
                <div class="arch-modal-message">${message}</div>
                <div class="arch-modal-actions">
                    <button class="arch-modal-cancel" id="archModalCancel">Cancel</button>
                    <button class="arch-modal-confirm ${confirmClass}" id="archModalConfirm">${confirmLabel}</button>
                </div>
            </div>
        </div>`;
        $('body').append(html);

        $('#archModalCancel, #archModal').on('click', function(e) {
            if (e.target === this) $('#archModal').remove();
        });
        $('#archModalConfirm').on('click', function() {
            $('#archModal').remove();
            onConfirm();
        });
        // Prevent modal box click from closing
        $('.arch-modal').on('click', e => e.stopPropagation());
    }

    function restoreRecord(id) {
        showConfirmModal({
            icon: 'fa-undo',
            iconClass: 'success',
            title: 'Restore Record',
            message: 'This item will be moved back to the active system and become visible again.',
            confirmLabel: '<i class="fas fa-undo me-1"></i> Restore',
            confirmClass: 'success',
            onConfirm: () => {
                $.ajax({
                    url: `${API_URL}?action=restore`,
                    method: 'POST',
                    xhrFields: { withCredentials: true },
                    contentType: 'application/json',
                    data: JSON.stringify({ archive_id: id }),
                    dataType: 'json',
                    success: function(json) {
                        if (json.status === 'success') {
                            showToast(json.message, "success");
                            fetchArchivedData(currentTab);
                        } else showToast(json.message, "error");
                    }
                });
            }
        });
    }

    function purgeRecord(id) {
        showConfirmModal({
            icon: 'fa-trash',
            iconClass: 'danger',
            title: 'Permanently Delete?',
            message: 'This record will be erased forever and cannot be recovered. Are you sure you want to continue?',
            confirmLabel: '<i class="fas fa-trash me-1"></i> Delete Forever',
            confirmClass: 'danger',
            onConfirm: () => {
                $.ajax({
                    url: `${API_URL}?action=purge`,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ archive_id: id }),
                    dataType: 'json',
                    success: function(json) {
                        if (json.status === 'success') {
                            showToast(json.message, "deleted");
                            fetchArchivedData(currentTab);
                        } else showToast(json.message, "error");
                    }
                });
            }
        });
    }

    function applyFilters() {
        const q = ($('#archSearch').val() || '').toLowerCase().trim();
        const now = new Date();
        let visible = 0;

        $('.arch-row').each(function() {
            const $row = $(this);
            const searchStr = ($row.attr('data-search') || '').toLowerCase();
            const dateStr = $row.attr('data-date');
            const d = dateStr ? new Date(dateStr) : null;

            const textOk = !q || searchStr.includes(q);
            let dateOk = true;

            if (d && dateFilter !== 'all') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (dateFilter === 'today') {
                    const rowDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    dateOk = rowDay.getTime() === today.getTime();
                } else if (dateFilter === 'week') {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(today.getDate() - 7);
                    dateOk = d >= weekAgo;
                } else if (dateFilter === 'month') {
                    dateOk = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                }
            }

            const show = textOk && dateOk;
            if (show) { $row.show(); visible++; }
            else { $row.hide(); }
        });

        $('#archResultCount').text(visible);
    }

    function formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
               date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function showToast(msg, type) {
        $('#toast').remove();

        let bgColor = '#fff', color = '#333', border = '#ccc', icon = 'fa-info-circle';

        if (type === "error") {
            bgColor = '#fee2e2'; color = '#be123c'; border = '#fecdd3'; icon = 'fa-exclamation-triangle';
        } else if (type === "deleted") {
            bgColor = '#fef2f2'; color = '#b91c1c'; border = '#fecaca'; icon = 'fa-trash';
        } else {
            bgColor = '#f0fdf4'; color = '#15803d'; border = '#bbf7d0'; icon = 'fa-check-circle';
        }

        const toastHtml = `
            <div id="toast" class="toast-bar" style="position:fixed; top:20px; right:20px; z-index:9999; padding:12px 20px; border-radius:10px; font-size:.8rem; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:0 4px 20px rgba(0,0,0,.12); animation:slideIn .3s ease; transition:opacity .5s; background:${bgColor}; color:${color}; border:1px solid ${border};">
                <i class="fas ${icon}"></i> ${msg}
            </div>`;
        $('body').append(toastHtml);
        setTimeout(() => $('#toast').css('opacity', '0'), 3500);
        setTimeout(() => $('#toast').remove(), 4000);
    }

    // ── 2. DOM RENDERING LOGIC ──

    function renderTable(tab, records) {
        const $container = $('#tableContainer');
        $container.empty();

        if (records.length === 0) {
            $container.html(`
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-inbox d-block fs-2 opacity-25 mb-3"></i>
                    <div class="fw-bold">No archived ${tab} found.</div>
                </div>
            `);
            $('#archResultCount').text('0');
            return;
        }

        let html = '';

        if (tab === 'classes') {
            html += `<div class="table-responsive"><table class="table align-middle mb-0 text-nowrap table-hover">
                <thead><tr><th class="ps-4">Course Code</th><th>Course Name</th><th>Semester</th><th>Archived By</th><th>Archived At</th><th class="text-end pe-4">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.course_code||''} ${d.name||d.course_name||''} ${d.semester||''} ${d.year||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td class="ps-4"><span class="badge bg-secondary-subtle text-secondary border">${d.course_code||'—'}</span><span class="badge bg-light text-muted border ms-2"><i class="fas fa-archive me-1"></i> Archived</span></td>
                    <td class="fw-bold text-dark">${d.name||d.course_name||'—'}</td>
                    <td class="small text-muted fw-medium">${d.semester||''} ${d.year||''}</td>
                    <td><span class="small text-muted"><i class="fas fa-user-shield me-1"></i>${r.archiver_name}</span></td>
                    <td class="small text-muted">${formatDate(r.archived_at)}</td>
                    <td class="text-end pe-4">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <button class="btn-action btn-restore" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                            <button class="btn-action btn-delete" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                        </div>
                    </td></tr>`;
            });
            html += `</tbody></table></div>`;
        }
        else if (tab === 'students') {
            html += `<div class="table-responsive"><table class="table align-middle mb-0 text-nowrap table-hover">
                <thead><tr><th class="ps-4">ID</th><th>Name</th><th>Email</th><th>Archived By</th><th>Archived At</th><th class="text-end pe-4">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.first_name||''} ${d.last_name||''} ${d.email||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td class="ps-4" style="font-family:'JetBrains Mono',monospace;font-size:.75rem;color:#64748b;">STU-${String(d.student_id||0).padStart(4,'0')}</td>
                    <td class="fw-bold text-dark">${d.first_name||''} ${d.last_name||''} <span class="badge bg-light text-muted border ms-2"><i class="fas fa-archive me-1"></i> Archived</span></td>
                    <td class="small text-muted">${d.email||'—'}</td>
                    <td><span class="small text-muted"><i class="fas fa-user-shield me-1"></i>${r.archiver_name}</span></td>
                    <td class="small text-muted">${formatDate(r.archived_at)}</td>
                    <td class="text-end pe-4">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <button class="btn-action btn-restore" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                            <button class="btn-action btn-delete" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                        </div>
                    </td></tr>`;
            });
            html += `</tbody></table></div>`;
        }
        else if (tab === 'courses') {
            html += `<div class="table-responsive"><table class="table align-middle mb-0 text-nowrap table-hover">
                <thead><tr><th class="ps-4">Code</th><th>Course Name</th><th>Units</th><th>Archived By</th><th>Archived At</th><th class="text-end pe-4">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.course_code||''} ${d.name||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td class="ps-4"><span class="badge bg-secondary-subtle text-secondary border">${d.course_code||'—'}</span><span class="badge bg-light text-muted border ms-2"><i class="fas fa-archive me-1"></i> Archived</span></td>
                    <td class="fw-bold text-dark">${d.name||'—'}</td>
                    <td class="small text-muted">${d.credits||d.units||'—'} units</td>
                    <td><span class="small text-muted"><i class="fas fa-user-shield me-1"></i>${r.archiver_name}</span></td>
                    <td class="small text-muted">${formatDate(r.archived_at)}</td>
                    <td class="text-end pe-4">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <button class="btn-action btn-restore" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                            <button class="btn-action btn-delete" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                        </div>
                    </td></tr>`;
            });
            html += `</tbody></table></div>`;
        }
        else if (tab === 'instructors') {
            html += `<div class="table-responsive"><table class="table align-middle mb-0 text-nowrap table-hover">
                <thead><tr><th class="ps-4">ID</th><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Archived By</th><th>Archived At</th><th class="text-end pe-4">Actions</th></tr></thead><tbody>`;
            records.forEach(r => {
                const d = r.data;
                const searchStr = `${d.first_name||''} ${d.last_name||''} ${d.email||''} ${d.dept_name||''} ${d.pos_title||''} ${r.archiver_name}`.toLowerCase();
                html += `<tr class="arch-row" data-search="${searchStr}" data-date="${r.archived_at}">
                    <td class="ps-4" style="font-family:'JetBrains Mono',monospace;font-size:.75rem;color:#64748b;">EMP-${String(d.employee_id||0).padStart(4,'0')}</td>
                    <td><div class="fw-bold text-dark">${d.first_name||''} ${d.last_name||''}</div><span class="badge bg-light text-muted border mt-1"><i class="fas fa-archive me-1"></i> Archived</span></td>
                    <td class="small text-muted">${d.email||'—'}</td>
                    <td class="small text-muted">${d.dept_name||'—'}</td>
                    <td class="small text-muted">${d.pos_title||'—'}</td>
                    <td><span class="small text-muted"><i class="fas fa-user-shield me-1"></i>${r.archiver_name}</span></td>
                    <td class="small text-muted">${formatDate(r.archived_at)}</td>
                    <td class="text-end pe-4">
                        <div class="d-flex align-items-center justify-content-end gap-2">
                            <button class="btn-action btn-restore" onclick="restoreRecord(${r.archive_id})"><i class="fas fa-undo"></i> <span class="d-none d-md-inline">Restore</span></button>
                            <button class="btn-action btn-delete" onclick="purgeRecord(${r.archive_id})"><i class="fas fa-trash"></i> <span class="d-none d-md-inline">Delete</span></button>
                        </div>
                    </td></tr>`;
            });
            html += `</tbody></table></div>`;
        }

        // ── ENROLLMENTS ──────────────────────────────────────────
        else if (tab === 'enrollments') {
            const grouped = {};
            records.forEach(r => {
                const d = r.data;
                const sid = d.student_id || 'unknown';
                if (!grouped[sid]) {
                    const fname = d.student_name || '?';
                    const parts = fname.trim().split(' ');
                    const initials = (parts[0].charAt(0) + (parts[parts.length - 1].charAt(0) || '')).toUpperCase();
                    const colors = [
                        { bg: '#dbeafe', color: '#1d4ed8' },
                        { bg: '#dcfce7', color: '#15803d' },
                        { bg: '#f3e8ff', color: '#7c3aed' },
                        { bg: '#fef3c7', color: '#b45309' },
                        { bg: '#fce7f3', color: '#be185d' },
                        { bg: '#e0f2fe', color: '#0369a1' },
                    ];
                    const accent = colors[parseInt(sid) % colors.length];
                    grouped[sid] = { name: fname, initials, records: [], accent };
                }
                grouped[sid].records.push(r);
            });

            html += `<div class="p-3 p-md-4 d-flex flex-column gap-3">`;

            let gi = 0;
            for (let sid in grouped) {
                gi++;
                const sg = grouped[sid];
                const dropCount = sg.records.length;

                let allSearch = sg.name.toLowerCase();
                sg.records.forEach(sr => {
                    const sd = sr.data;
                    allSearch += ` ${sd.course_code||''} ${sd.course_name||''} ${sd.semester||''} ${sd.year||''}`.toLowerCase();
                });
                const latestDate = sg.records[0].archived_at;

                let courseRows = '';
                sg.records.forEach((r, idx) => {
                    const d = r.data;
                    const enrDate = d.enroll_date
                        ? new Date(d.enroll_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—';
                    const isLast = idx === sg.records.length - 1;

                    courseRows += `
                    <div class="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2 gap-md-3 px-3 py-3 ${!isLast ? 'border-bottom' : ''}">

                        <!-- Course badge + name -->
                        <div class="d-flex align-items-center gap-2" style="min-width:200px;">
                            <div class="d-flex align-items-center justify-content-center rounded-2 px-2 py-1 fw-bold"
                                 style="background:${sg.accent.bg};color:${sg.accent.color};font-size:.7rem;white-space:nowrap;">
                                ${d.course_code || '—'}
                            </div>
                            <div style="font-size:.78rem;color:#334155;font-weight:500;">${d.course_name || '—'}</div>
                        </div>

                        <!-- Term -->
                        <div class="d-flex align-items-center gap-1" style="min-width:130px;">
                            <i class="fas fa-calendar-alt text-muted" style="font-size:.65rem;"></i>
                            <span class="text-muted" style="font-size:.72rem;">${d.semester || ''} ${d.year || ''}</span>
                        </div>

                        <!-- Enroll date -->
                        <div class="d-flex align-items-center gap-1" style="min-width:130px;">
                            <i class="fas fa-user-plus text-muted" style="font-size:.65rem;"></i>
                            <span class="text-muted" style="font-size:.72rem;">Enrolled ${enrDate}</span>
                        </div>

                        <!-- Archived by -->
                        <div class="d-flex align-items-center gap-1">
                            <i class="fas fa-user-shield text-muted" style="font-size:.65rem;"></i>
                            <span class="text-muted" style="font-size:.72rem;">${r.archiver_name}</span>
                        </div>

                        <!-- Dropped at -->
                        <div class="d-flex align-items-center gap-1 me-md-auto">
                            <i class="fas fa-clock text-muted" style="font-size:.65rem;"></i>
                            <span class="text-muted" style="font-size:.72rem;">${formatDate(r.archived_at)}</span>
                        </div>

                        <!-- Actions using the new unified classes -->
                        <div class="d-flex gap-2 ms-md-auto flex-shrink-0">
                            <button class="btn-action btn-restore" onclick="restoreRecord(${r.archive_id})">
                                <i class="fas fa-undo"></i> Restore
                            </button>
                            <button class="btn-action btn-delete" onclick="purgeRecord(${r.archive_id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>`;
                });

                html += `
                <div class="border rounded-3 overflow-hidden arch-row bg-white"
                     id="enr-card-${gi}"
                     data-search="${allSearch}"
                     data-date="${latestDate}"
                     style="transition: border-color 0.2s;">

                    <!-- Student Header Row -->
                    <div class="d-flex align-items-center gap-3 px-3 py-3 bg-white"
                         onclick="toggleEnr(${gi})"
                         style="cursor:pointer;border-bottom:1px solid #f1f5f9;">

                        <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                             style="width:40px;height:40px;background:${sg.accent.bg};color:${sg.accent.color};font-size:.8rem;">
                            ${sg.initials}
                        </div>

                        <div class="flex-grow-1">
                            <div class="fw-bold text-dark" style="font-size:.88rem;">${sg.name}</div>
                            <div class="text-muted" style="font-size:.68rem;font-family:'JetBrains Mono',monospace;">
                                STU-${String(sid).padStart(4, '0')}
                            </div>
                        </div>

                        <div class="d-flex align-items-center gap-2">
                            <span class="badge rounded-pill px-3 py-2"
                                  style="background:#fff1f2;color:#be123c;border:1px solid #fecdd3;font-size:.7rem;font-weight:600;">
                                <i class="fas fa-minus-circle me-1" style="font-size:.6rem;"></i>
                                ${dropCount} dropped class${dropCount !== 1 ? 'es' : ''}
                            </span>
                            <span class="badge rounded-pill px-2 py-1"
                                  style="background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;font-size:.68rem;">
                                <i class="fas fa-clock me-1" style="font-size:.6rem;"></i>
                                ${formatDate(latestDate)}
                            </span>
                            <i class="fas fa-chevron-down text-muted ms-1" id="enr-chev-${gi}" style="font-size:.75rem;transition:transform .2s;"></i>
                        </div>
                    </div>

                    <!-- Expandable Course List -->
                    <div id="enr-body-${gi}" style="display:none;background:#fafbfc;">
                        ${courseRows}
                    </div>
                </div>`;
            }

            html += `</div>`;
        }

        $container.html(html);
        applyFilters();
    }

    // ── 3. ATTACH TO WINDOW (For inline HTML handlers) ──
    window.switchTab = switchTab;
    window.setDateFilter = setDateFilter;
    window.toggleEnr = toggleEnr;
    window.restoreRecord = restoreRecord;
    window.purgeRecord = purgeRecord;

    // ── 4. EVENT LISTENERS & INITIAL LOAD ──
    $('#archSearch').on('input', applyFilters);

    // Initial fetch
    switchTab(currentTab, false);
});

// ─── Header & Session Logic ───────────────────────────────────────────────────
const AUTH_API = 'https://artisanslms.onrender.com/backend/index.php';

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

    const currentPage = window.location.pathname.split('/').pop() || 'archived.html';
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
                window.location.href = '/client/pages/login.html';
            }
        },
        error: function() {
            window.location.href = '/client/pages/login.html';
        }
    });

    $(document).on('click', '#logoutBtn', function(e) {
        e.preventDefault();
        $.ajax({
            url: AUTH_API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete: function() { window.location.href = '/client/pages/login.html'; }
        });
    });
}