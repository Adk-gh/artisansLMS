import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase, ref, push, onChildAdded,
    set, onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ── ADDED: Import the room request module ────────────────────────────────────
import { initRoomRequest, renderRoomSystemMessage } from './collaborations_room_request.js';
// ─────────────────────────────────────────────────────────────────────────────

const API = '/artisansLMS/backend/index.php';

// ─── Globals ─────────────────────────────────────────────────────────────────
let currentUser = {};
let isTeacher   = false;
const urlParams = new URLSearchParams(window.location.search);
const classId   = urlParams.get('class_id');

// ─── Grid / List toggle (must be global for onclick attributes) ───────────────
window.toggleView = function (type) {
    const grid    = document.getElementById('gridViewContainer');
    const list    = document.getElementById('listViewContainer');
    const btnGrid = document.getElementById('btnGrid');
    const btnList = document.getElementById('btnList');

    if (type === 'list') {
        grid.classList.add('d-none');
        list.classList.remove('d-none');
        btnList.classList.replace('btn-light', 'btn-dark');
        btnList.classList.remove('text-secondary');
        btnGrid.classList.replace('btn-dark', 'btn-light');
        btnGrid.classList.add('text-secondary');
        localStorage.setItem('classViewPref', 'list');
    } else {
        list.classList.add('d-none');
        grid.classList.remove('d-none');
        btnGrid.classList.replace('btn-light', 'btn-dark');
        btnGrid.classList.remove('text-secondary');
        btnList.classList.replace('btn-dark', 'btn-light');
        btnList.classList.add('text-secondary');
        localStorage.setItem('classViewPref', 'grid');
    }
};

// ─── View helpers ─────────────────────────────────────────────────────────────
function showSelectionView() {
    document.getElementById('selectionView').classList.add('visible');
    document.getElementById('chatView').classList.remove('visible');
}

function showChatView() {
    document.getElementById('selectionView').classList.remove('visible');
    document.getElementById('chatView').classList.add('visible');
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
$(document).ready(function () {
    $("#sidebar-container").load("/artisansLMS/client/components/sidebar.html");
    $("#header-container").load("/artisansLMS/client/components/header.html", function (res, status) {
        if (status !== 'error') initHeader();
    });
});

// ─── Header init ─────────────────────────────────────────────────────────────
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

    const currentPage = window.location.pathname.split('/').pop() || 'collaborations.html';
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
        success(res) {
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
        error() { window.location.href = '/artisansLMS/client/pages/login.html'; }
    });

    // ── Logout ────────────────────────────────────────────────────────────
    $(document).on('click', '#logoutBtn', function (e) {
        e.preventDefault();
        $.ajax({
            url: API, method: 'POST', contentType: 'application/json', dataType: 'json',
            data: JSON.stringify({ route: 'auth', action: 'logout' }),
            complete() { window.location.href = '/artisansLMS/client/pages/login.html'; }
        });
    });
}

// ─── Entry point ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // Restore saved view preference (only relevant for selection view)
    if (!classId && localStorage.getItem('classViewPref') === 'list') {
        window.toggleView('list');
    }

    // Check session first, then branch
    fetch('/artisansLMS/backend/endpoints/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkSession' })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success' && data.logged_in) {
            currentUser = { id: data.user.id, name: data.user.name, role: data.user.role };
            isTeacher   = (currentUser.role === 'teacher' || currentUser.role === 'admin');

            if (classId) {
                initChatView();     // has ?class_id=  → show chat
            } else {
                initSelectionGrid(); // no param        → show class picker
            }
        } else {
            window.location.href = '/artisansLMS/client/pages/login.html';
        }
    })
    .catch(() => {
        window.location.href = '/artisansLMS/client/pages/login.html';
    });

});

// ═══════════════════════════════════════════════════════════════════════════════
//  SELECTION GRID
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
//  SELECTION GRID
// ═══════════════════════════════════════════════════════════════════════════════
function initSelectionGrid() {
    showSelectionView();

    fetch('/artisansLMS/backend/endpoints/collaborations.php?action=get_classes')
        .then(async r => {
            // Grab the raw text FIRST before trying to read it as JSON
            const text = await r.text(); 
            try {
                return JSON.parse(text); 
            } catch (e) {
                // If it fails, print the ugly HTML/PHP warning to the console
                console.error("🚨 RAW PHP RESPONSE THAT CRASHED THE JSON:", text);
                throw new Error("Backend returned HTML or a PHP Warning instead of clean JSON.");
            }
        })
        .then(data => {
            if (data.status === 'success') {
                renderGrid(data.classes);
                renderList(data.classes);
            } else {
                document.getElementById('gridViewContainer').innerHTML =
                    `<div class="col-12"><div class="alert alert-danger shadow-sm border-0"><i class="fas fa-exclamation-triangle me-2"></i>${data.message}</div></div>`;
            }
        })
        .catch(err => {
            console.error("Fetch Error:", err);
            // Replace the infinite spinner with an actual error message on screen
            document.getElementById('gridViewContainer').innerHTML =
                `<div class="col-12 text-center py-5">
                    <div class="alert alert-danger shadow-sm border-0 d-inline-block text-start">
                        <strong><i class="fas fa-plug me-2"></i>Connection Failed</strong><br>
                        <small>Check your console (F12) and look for the red 'RAW PHP RESPONSE' to see what's broken.</small>
                    </div>
                </div>`;
            document.getElementById('listViewContainer').classList.add('d-none');
        });
}

function renderGrid(classes) {
    const el = document.getElementById('gridViewContainer');
    if (!classes.length) {
        el.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-chalkboard fs-1 text-muted opacity-25 mb-3 d-block"></i>
                <p class="text-muted fw-bold">No active classes found.</p>
            </div>`;
        return;
    }
    el.innerHTML = classes.map(c => `
        <div class="col-12 col-sm-6 col-xl-4">
            <div class="class-card card h-100 p-4 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle font-monospace px-2 py-1">${c.course_code}</span>
                    <span class="badge bg-light text-secondary border font-monospace px-2 py-1">${c.semester} ${c.year}</span>
                </div>
                <h5 class="fw-bold text-dark mb-3">
                    <i class="fas fa-hashtag me-2 text-muted opacity-50"></i>Section ${c.class_id}
                </h5>
                <div class="d-flex align-items-center gap-2 mb-2 text-muted small fw-bold">
                    <i class="fas fa-user-tie text-warning"></i> Prof. ${c.last_name}
                </div>
                <p class="text-muted small fw-medium mb-4 flex-grow-1">${c.name}</p>
                <a href="collaborations.html?class_id=${c.class_id}" class="btn btn-dark w-100 fw-bold rounded-3 py-2">
                    Enter Class Space <i class="fas fa-arrow-right ms-2"></i>
                </a>
            </div>
        </div>`).join('');
}

function renderList(classes) {
    const el = document.getElementById('listBodyContainer');
    if (!classes.length) {
        el.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted fw-bold">No active classes found.</td></tr>';
        return;
    }
    el.innerHTML = classes.map(c => `
        <tr>
            <td class="ps-4 py-3">
                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle font-monospace mb-1">${c.course_code}</span>
                <div class="fw-bold text-dark small mt-1">${c.name}</div>
            </td>
            <td><span class="badge bg-light text-dark border font-monospace"><i class="fas fa-hashtag text-muted me-1"></i>Section ${c.class_id}</span></td>
            <td><div class="text-dark small fw-bold"><i class="fas fa-user-tie me-1 text-warning"></i>Prof. ${c.last_name}</div></td>
            <td><span class="badge bg-light text-secondary border font-monospace">${c.semester} ${c.year}</span></td>
            <td class="text-end pe-4">
                <a href="collaborations.html?class_id=${c.class_id}" class="btn btn-sm btn-dark fw-bold rounded-3 px-3">
                    Enter <i class="fas fa-arrow-right ms-1"></i>
                </a>
            </td>
        </tr>`).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHAT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function initChatView() {
    showChatView();

    // Wire up tab hrefs — include class_id so the other pages know which class
    document.getElementById('tabModulesLink').href = `modules.html?class_id=${classId}`;
    document.getElementById('tabTasksLink').href   = `todo.html?class_id=${classId}`;

    // Chat tab stays on this page — just prevents default
    document.getElementById('tabChatLink').addEventListener('click', e => e.preventDefault());

    fetch(`/artisansLMS/backend/endpoints/collaborations.php?action=get_class_details&class_id=${classId}`)
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                populateRoomInfo(data);

                // ── ADDED: Initialize Room Request functionality ─────────────
                initRoomRequest(classId, currentUser, isTeacher);
                // ─────────────────────────────────────────────────────────────

                initFirebase();
                initInputBar();
            } else {
                alert(data.message);
                window.location.href = 'collaborations.html';
            }
        });
}

// ─── Room Info Offcanvas ──────────────────────────────────────────────────────
function populateRoomInfo(data) {
    const c = data.class_info;
    const t = data.teacher;

    document.getElementById('chatCourseCode').textContent      = c.course_code;
    document.getElementById('chatSecureRoomName').textContent  = c.course_code;
    document.getElementById('offcanvasAvatar').textContent     = c.course_code.substring(0, 2).toUpperCase();
    document.getElementById('offcanvasCourseCode').textContent = c.course_code;
    document.getElementById('offcanvasCourseName').textContent = c.name;
    document.getElementById('offcanvasTerm').textContent       = `${c.semester} ${c.year}`;
    document.getElementById('statStudents').textContent        = data.members.length;
    document.getElementById('statTasks').textContent           = data.task_count;
    document.getElementById('statQuizzes').textContent         = data.quiz_count;
    document.getElementById('memberCountBadge').textContent    = data.members.length;
    document.getElementById('teacherName').textContent         = `Prof. ${t.first_name} ${t.last_name}`;
    document.getElementById('teacherEmail').textContent        = t.email || 'No email';
    document.getElementById('teacherAvatar').src =
        `https://ui-avatars.com/api/?name=${encodeURIComponent(t.first_name + '+' + t.last_name)}&background=f59e0b&color=fff&bold=true`;

    // Member list
    const mList = document.getElementById('memberListContainer');
    mList.innerHTML = data.members.map(m => {
        const isMe = m.student_id == currentUser.id;
        return `
            <div class="d-flex align-items-center gap-3 p-2 rounded-3 member-item"
                 data-name="${(m.first_name + ' ' + m.last_name).toLowerCase()}">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.first_name + '+' + m.last_name)}&background=0ea5e9&color=fff&bold=true"
                     class="rounded-circle shadow-sm" width="36" height="36" alt="">
                <div>
                    <div class="fw-bold text-dark small lh-1">
                        ${m.first_name} ${m.last_name}
                        ${isMe ? '<span class="badge bg-primary rounded-pill ms-1" style="font-size:.55rem;">You</span>' : ''}
                    </div>
                    <div class="text-muted fw-semibold" style="font-size:.65rem;">Student</div>
                </div>
            </div>`;
    }).join('');

    // Member search
    document.getElementById('memberSearch').addEventListener('input', function () {
        const q = this.value.toLowerCase().trim();
        let found = 0;
        document.querySelectorAll('.member-item').forEach(item => {
            const show = !q || item.dataset.name.includes(q);
            item.style.display = show ? 'flex' : 'none';
            if (show) found++;
        });
        document.getElementById('memberSearchEmpty').classList.toggle('d-none', found > 0);
    });
}

// ─── Input bar: emoji + attach + enter-to-send ────────────────────────────────
function initInputBar() {
    const picker    = document.getElementById('emojiPicker');
    const emojiBtn  = document.getElementById('emojiBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileUploadInput');

    // Emoji toggle
    emojiBtn.addEventListener('click', e => {
        e.stopPropagation();
        picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
    });
    picker.addEventListener('emoji-click', e => {
        document.getElementById('msgInput').value += e.detail.unicode;
        picker.style.display = 'none';
        document.getElementById('msgInput').focus();
    });
    document.addEventListener('click', () => { picker.style.display = 'none'; });

    // Attach
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () {
        // TODO: implement file upload to your storage endpoint
        alert('File upload: map this to your storage endpoint.');
    });
}

// ─── Firebase: chat + lecture ─────────────────────────────────────────────────
function initFirebase() {
    const app = initializeApp({
        apiKey:            "AIzaSyDQfwNYptf-gWqIQVs0welvz86DwqPI6VQ",
        authDomain:        "artisans-lms.firebaseapp.com",
        projectId:         "artisans-lms",
        storageBucket:     "artisans-lms.firebasestorage.app",
        messagingSenderId: "897938751816",
        appId:             "1:897938751816:web:9cbdeb9ae93020dfff737d"
    });

    const db          = getDatabase(app);
    const messagesRef = ref(db, `lms_chats/${classId}`);
    const statusRef   = ref(db, `lms_classes/${classId}/status`);

    // ── Render incoming messages ──────────────────────────────────────────────
    onChildAdded(messagesRef, snap => {
        const m   = snap.val();
        const box = document.getElementById('chatMessages');

        // ── ADDED: Render custom room request system messages ────────────────
        if (m.is_system && (m.type === 'room_approved' || m.type === 'room_rejected')) {
            renderRoomSystemMessage(m, box);
            return;
        }
        // ─────────────────────────────────────────────────────────────────────

        if (m.is_system) {
            box.insertAdjacentHTML('beforeend', `
                <div class="text-center my-2">
                    <span class="badge bg-white text-muted border px-3 py-2 rounded-pill shadow-sm" style="font-size:.75rem;">
                        ${m.text || ''}
                    </span>
                </div>`);
            box.scrollTop = box.scrollHeight;
            return;
        }

        const isMe   = m.student_id == currentUser.id;
        const align  = isMe ? 'align-self-end text-end' : 'align-self-start';
        const bg     = isMe ? 'bg-primary text-white' : 'bg-white text-dark border';
        const time   = m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        const sender = isMe ? 'You' : (m.student_name || 'Unknown');

        let content = m.text || '';
        if (m.fileUrl) {
            if (m.fileType?.startsWith('image/')) {
                content = `<div class="mb-1">${m.text || ''}</div>
                    <a href="${m.fileUrl}" target="_blank">
                        <img src="${m.fileUrl}" alt="Attachment"
                             style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid rgba(0,0,0,.1);">
                    </a>`;
            } else {
                const ic = isMe ? 'text-white' : 'text-primary';
                const lc = isMe ? 'text-white' : 'text-dark';
                content = `<div class="mb-1">${m.text || ''}</div>
                    <a href="${m.fileUrl}" target="_blank"
                       class="d-inline-flex align-items-center gap-2 p-2 rounded text-decoration-none ${lc}"
                       style="background:rgba(0,0,0,.1);border:1px solid rgba(0,0,0,.1);">
                        <i class="fas fa-file-alt fs-5 ${ic}"></i>
                        <span style="font-size:.8rem;font-weight:600;">View Attachment</span>
                    </a>`;
            }
        }

        box.insertAdjacentHTML('beforeend', `
            <div class="mb-2 d-flex flex-column ${align}" style="max-width:85%;">
                <small class="text-muted mb-1" style="font-size:.65rem;font-weight:600;">
                    ${sender} <span class="opacity-50 fw-normal ms-1">${time}</span>
                </small>
                <div class="d-inline-block p-2 px-3 rounded-4 shadow-sm ${bg}" style="font-size:.88rem;text-align:left;">
                    ${content}
                </div>
            </div>`);
        box.scrollTop = box.scrollHeight;
    });

    // ── Send message ──────────────────────────────────────────────────────────
    const msgInput = document.getElementById('msgInput');

    function sendMsg() {
        const text = msgInput.value.trim();
        if (!text) return;
        push(messagesRef, {
            student_id:   currentUser.id,
            student_name: currentUser.name,
            text,
            timestamp: Date.now()
        });
        msgInput.value = '';
        msgInput.focus();
    }

    document.getElementById('sendBtn').addEventListener('click', sendMsg);
    msgInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });

    // ── Lecture / Jitsi ───────────────────────────────────────────────────────
    let jitsiApi = null;

    const btnLecture  = document.getElementById('actionLectureBtn');
    const iconLecture = document.getElementById('lectureIcon');
    const textLecture = document.getElementById('lectureText');
    const callUI      = document.getElementById('callUI');

    onValue(statusRef, snap => {
        const isLive = snap.val()?.is_live === true;

        if (!isTeacher) {
            if (isLive) {
                btnLecture.disabled = false;
                btnLecture.classList.remove('btn-secondary');
                btnLecture.classList.add('btn-danger', 'pulse-shadow');
                iconLecture.className   = 'fas fa-video';
                textLecture.textContent = 'Join Live';
            } else {
                btnLecture.disabled = true;
                btnLecture.classList.remove('btn-danger', 'pulse-shadow');
                btnLecture.classList.add('btn-secondary');
                iconLecture.className   = 'fas fa-video-slash';
                textLecture.textContent = 'Waiting';
                if (callUI.classList.contains('active')) closeCall();
            }
        } else {
            btnLecture.disabled     = false;
            textLecture.textContent = isLive ? 'End Live' : 'Start Live';
            iconLecture.className   = isLive ? 'fas fa-stop-circle' : 'fas fa-video';
        }
    });

    btnLecture.addEventListener('click', () => {
        if (isTeacher) {
            set(statusRef, { is_live: true });
            onDisconnect(statusRef).set({ is_live: false });
            push(messagesRef, {
                is_system: true,
                text: `🎥 A live lecture has been started by ${currentUser.name}.`,
                timestamp: Date.now()
            });
        } else {
            push(messagesRef, {
                is_system: true,
                text: `👋 ${currentUser.name} joined the lecture.`,
                timestamp: Date.now()
            });
        }
        openCall();
    });

    function openCall() {
        callUI.classList.add('active');
        if (!jitsiApi) {
            jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
                roomName:   `ArtisansLMS_Class_${classId}_SecureRoom`,
                parentNode: document.getElementById('jitsiContainer'),
                userInfo:   { displayName: currentUser.name },
                configOverwrite: {
                    startWithAudioMuted: true,
                    startWithVideoMuted: true,
                    prejoinPageEnabled:  false
                }
            });
            jitsiApi.addListener('videoConferenceLeft', closeCall);
        }
    }

    function closeCall() {
        if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
        callUI.classList.remove('active');
        document.getElementById('jitsiContainer').innerHTML = '';

        if (isTeacher) {
            set(statusRef, { is_live: false });
            push(messagesRef, {
                is_system: true,
                text: `🛑 The live lecture has been ended by ${currentUser.name}.`,
                timestamp: Date.now()
            });
        } else {
            push(messagesRef, {
                is_system: true,
                text: `👋 ${currentUser.name} left the lecture.`,
                timestamp: Date.now()
            });
        }
    }

    document.getElementById('leaveLectureBtn').addEventListener('click', closeCall);
}