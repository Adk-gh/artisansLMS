import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, onValue, set, remove, get, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const API = '/artisansLMS/backend/index.php';

$(document).ready(function() {
    $("#sidebar-container").load("../components/sidebar.html");
    $("#header-container").load("../components/header.html", function(res, status) {
        if (status !== 'error') initHeader();
    });
});

// ─── Header ───────────────────────────────────────────────────────────────────
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

    const currentPage = window.location.pathname.split('/').pop() || 'messages.html';
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

// ─── 1. Fetch Data via jQuery AJAX ────────────────────────────────────────────
let usersData = [];
let myUid = '';
let myName = '';
let groupsData = [];

try {
    const result = await $.ajax({
        url: '../../backend/endpoints/messages.php?action=get_initial_data',
        type: 'GET',
        dataType: 'json'
    });
    
    if (result.status !== 'success') {
        window.location.href = '/artisansLMS/login.php';
    }

    usersData = result.data.all_users;
    usersData.forEach(u => { u.rel_status = 'none'; u.rel_type = 'none'; u.isGroup = false; });
    
    myUid = result.data.my_uid;
    myName = result.data.my_name;

} catch (error) {
    console.error("Error loading chat data via AJAX:", error);
}

// ─── 2. Firebase Initialization ───────────────────────────────────────────────
const app = initializeApp({
    apiKey:            "AIzaSyDQfwNYptf-gWqIQVs0welvz86DwqPI6VQ",
    authDomain:        "artisans-lms.firebaseapp.com",
    projectId:         "artisans-lms",
    storageBucket:     "artisans-lms.firebasestorage.app",
    messagingSenderId: "897938751816",
    appId:             "1:897938751816:web:9cbdeb9ae93020dfff737d"
});
const db = getDatabase(app);

// ─── 3. Global State & Helpers ────────────────────────────────────────────────
let activeTab     = 'contacts';
let searchQuery   = '';
let selectedUser  = null;
let currentMsgRef = null;
let jitsiApi      = null;
let incomingData  = null;
let ringtoneTimer = null;
let audioCtx      = null;

const colors   = ['#0ea5e9','#22c55e','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];
const colorFor = uid => { let h=0; for(let c of uid) h=c.charCodeAt(0)+((h<<5)-h); return colors[Math.abs(h)%colors.length]; };
const el       = id => document.getElementById(id);

// ─── 4. Audio / Ringtone Setup ────────────────────────────────────────────────
document.addEventListener('click', () => {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
}, { once: true });

function beep() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(.3, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .4);
        o.start(); o.stop(audioCtx.currentTime + .4);
    } catch(e){}
}
function startRing() { beep(); ringtoneTimer = setInterval(beep, 1200); }
function stopRing()  { clearInterval(ringtoneTimer); ringtoneTimer = null; }

// ─── 5. Firebase Listeners ────────────────────────────────────────────────────
onValue(ref(db, `lms_contacts/${myUid}`), snap => {
    const data = snap.val() || {};
    usersData.forEach(u => {
        if (data[u.uid]) { u.rel_status = data[u.uid].status; u.rel_type = data[u.uid].type; }
        else             { u.rel_status = 'none'; u.rel_type = 'none'; }
    });
    if (activeTab !== 'groups') renderList();
    if (selectedUser && !selectedUser.isGroup) openView(selectedUser.uid);
});

onValue(ref(db, `lms_user_groups/${myUid}`), snap => {
    const data = snap.val() || {};
    groupsData = Object.keys(data).map(key => ({
        uid:        key,
        name:       data[key].name,
        createdBy:  data[key].createdBy,
        isGroup:    true,
        role:       'Group Chat',
        display_id: 'GROUP'
    }));
    groupsData.sort((a,b) => (a.name || "").localeCompare(b.name || ""));
    if (activeTab === 'groups') renderList();
    if (selectedUser && selectedUser.isGroup) openView(selectedUser.uid);
});

// ─── 6. Group Management Logic ────────────────────────────────────────────────
el('confirmCreateGroup').addEventListener('click', function() {
    this.blur();
    const groupName = el('newGroupName').value.trim();
    if(!groupName) return alert("Please enter a group name.");
    
    const newGroupRef = push(ref(db, 'lms_groups'));
    const groupId     = newGroupRef.key;
    
    set(newGroupRef, {
        name: groupName, createdBy: myUid,
        timestamp: Date.now(), members: { [myUid]: myName }
    });
    set(ref(db, `lms_user_groups/${myUid}/${groupId}`), { name: groupName, createdBy: myUid });
    
    el('newGroupName').value = '';
    bootstrap.Modal.getInstance(el('createGroupModal')).hide();
    switchTab('groups');
    setTimeout(() => openView(groupId), 500);
});

el('confirmJoinGroup').addEventListener('click', function() {
    this.blur();
    const code = el('joinGroupCode').value.trim();
    if(!code) return alert("Please enter a group code.");
    
    get(ref(db, `lms_groups/${code}`)).then(snap => {
        if(snap.exists()) {
            if (groupsData.find(g => g.uid === code)) return alert("You are already in this group!");
            set(ref(db, `lms_group_requests/${code}/${myUid}`), {
                name: myName, timestamp: Date.now()
            }).then(() => {
                alert("Join request sent! Please wait for the group admin to approve.");
                el('joinGroupCode').value = '';
                bootstrap.Modal.getInstance(el('joinGroupModal')).hide();
            });
        } else {
            alert("Invalid Group Code. Please check and try again.");
        }
    });
});

window.loadGroupDetails = function() {
    if (!selectedUser || !selectedUser.isGroup) return;
    const groupId = selectedUser.uid;

    if(window.groupDataListener) off(window.groupDataListener);
    if(window.groupReqListener)  off(window.groupReqListener);
    window.groupReqListenerBound = false;

    window.groupDataListener = ref(db, `lms_groups/${groupId}`);
    onValue(window.groupDataListener, snap => {
        const groupData = snap.val();
        if(!groupData) return;

        window.currentGroupCreator = groupData.createdBy;
        const isAdmin = (groupData.createdBy === myUid);

        el('modalGroupName').textContent = groupData.name;
        const initials = groupData.name.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2) || 'GC';
        el('modalGroupAvatar').textContent = initials;

        el('modalGroupCode').innerHTML = `<span>#${groupId}</span> <i class="fas fa-copy opacity-75"></i>`;
        el('modalGroupCode').onclick = () => {
            navigator.clipboard.writeText(groupId).then(() => {
                el('modalGroupCode').innerHTML = `<span>Copied!</span> <i class="fas fa-check opacity-75"></i>`;
                setTimeout(() => { el('modalGroupCode').innerHTML = `<span>#${groupId}</span> <i class="fas fa-copy opacity-75"></i>`; }, 1500);
            });
        };

        const adminUser = usersData.find(u => u.uid === groupData.createdBy);
        const adminName = adminUser ? adminUser.name : (isAdmin ? myName : 'Admin');
        el('modalAdminAvatar').textContent      = adminName.charAt(0).toUpperCase();
        el('modalAdminAvatar').style.background = colorFor(groupData.createdBy || 'admin');
        el('modalAdminName').textContent         = adminName;

        el('modalReqStatBox').style.display      = isAdmin ? 'block' : 'none';
        el('modalRequestsSection').style.display = isAdmin ? 'block' : 'none';
        el('modalDangerSection').style.display   = isAdmin ? 'block' : 'none';

        window.gipMembersCache = groupData.members || {};
        el('modalMemberCount').textContent = Object.keys(window.gipMembersCache).length;
        window.renderModalMembers();

        if (isAdmin && !window.groupReqListenerBound) {
            window.groupReqListenerBound = true;
            window.groupReqListener = ref(db, `lms_group_requests/${groupId}`);
            onValue(window.groupReqListener, reqSnap => {
                const data  = reqSnap.val() || {};
                const count = Object.keys(data).length;
                el('modalReqCount').textContent = count;
                el('modalReqBadge').textContent = count;
                
                const list  = el('modalRequestsList');
                const empty = el('modalRequestsEmpty');
                list.innerHTML = '';
                
                if (count === 0) {
                    empty.style.display = 'block';
                } else {
                    empty.style.display = 'none';
                    Object.keys(data).forEach(reqUid => {
                        const req      = data[reqUid];
                        const init     = (req.name||'?').charAt(0).toUpperCase();
                        const safeName = (req.name||'').replace(/'/g,"\\'");
                        const div      = document.createElement('div');
                        div.className  = 'd-flex align-items-center justify-content-between p-2 bg-white border border-light-subtle rounded-4 mb-2 shadow-sm';
                        div.innerHTML  = `
                            <div class="d-flex align-items-center gap-2">
                                <div style="width:34px;height:34px;border-radius:10px;background:${colorFor(reqUid)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:.8rem;">${init}</div>
                                <div>
                                    <div style="font-size:.85rem;font-weight:700;color:#1e293b;line-height:1.2;">${req.name}</div>
                                    <div style="font-size:.65rem;color:#94a3b8;">Wants to join</div>
                                </div>
                            </div>
                            <div class="d-flex gap-1 me-1">
                                <button class="btn btn-success p-0 d-flex align-items-center justify-content-center" style="width:32px;height:32px;border-radius:10px;" onclick="window.approveGroupReq('${reqUid}','${safeName}')"><i class="fas fa-check"></i></button>
                                <button class="btn btn-danger p-0 d-flex align-items-center justify-content-center"  style="width:32px;height:32px;border-radius:10px;" onclick="window.declineGroupReq('${reqUid}')"><i class="fas fa-times"></i></button>
                            </div>`;
                        list.appendChild(div);
                    });
                }
            });
        }
    });
};

window.filterModalMembers = function(q) { window.renderModalMembers(q.toLowerCase()); };

window.renderModalMembers = function(query = '') {
    const list = el('modalMembersList');
    list.innerHTML = '';
    const keys = Object.keys(window.gipMembersCache);
    let shown  = 0;
    
    if (keys.length === 0) {
        list.innerHTML = `<div class="text-center text-muted small py-2 bg-white border border-light-subtle rounded-3">No members found.</div>`;
        return;
    }

    keys.forEach(uid => {
        const name = window.gipMembersCache[uid];
        if(query && !name.toLowerCase().includes(query)) return;
        
        const isMe       = (uid === myUid);
        const col        = colorFor(uid);
        const init       = name.charAt(0).toUpperCase();
        const adminBadge = (uid === window.currentGroupCreator)
            ? `<span class="badge rounded-pill ms-2" style="background:#fef3c7;color:#b45309;font-size:.55rem;">Admin</span>` : '';
        const meBadge    = isMe
            ? `<span class="badge rounded-pill ms-1" style="background:#f0fdf4;color:#166534;font-size:.55rem;">You</span>` : '';
            
        list.innerHTML += `
            <div class="d-flex align-items-center p-2 bg-white border border-light-subtle rounded-4 mb-2 shadow-sm">
                <div style="width:36px;height:36px;border-radius:10px;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:.85rem;margin-right:10px;">${init}</div>
                <div style="flex:1;min-width:0;">
                    <div class="text-truncate" style="font-size:.85rem;font-weight:700;color:#1e293b;line-height:1.2;">${name}${adminBadge}${meBadge}</div>
                    <div style="font-size:.65rem;color:#94a3b8;">${uid.startsWith('E_') ? 'Teacher' : 'Student'}</div>
                </div>
            </div>`;
        shown++;
    });
    
    if (shown === 0) list.innerHTML = `<div class="text-center text-muted small py-3 bg-white border border-light-subtle rounded-4">No matching members.</div>`;
};

window.approveGroupReq = function(reqUid, reqName) {
    if(!selectedUser || !selectedUser.isGroup) return;
    const groupId   = selectedUser.uid;
    const groupName = selectedUser.name;
    const creator   = window.currentGroupCreator;

    set(ref(db, `lms_user_groups/${reqUid}/${groupId}`), { name: groupName, createdBy: creator }).then(() => {
        set(ref(db, `lms_groups/${groupId}/members/${reqUid}`), reqName);
        remove(ref(db, `lms_group_requests/${groupId}/${reqUid}`));
    });
};

window.declineGroupReq = function(reqUid) {
    if(!selectedUser || !selectedUser.isGroup) return;
    remove(ref(db, `lms_group_requests/${selectedUser.uid}/${reqUid}`));
};

window.deleteCurrentGroup = function() {
    if(!selectedUser || !selectedUser.isGroup) return;
    const groupId = selectedUser.uid;

    if(!confirm(`Are you sure you want to delete "${selectedUser.name}"? This cannot be undone.`)) return;

    const memberUids = Object.keys(window.gipMembersCache);
    memberUids.forEach(uid => remove(ref(db, `lms_user_groups/${uid}/${groupId}`)));

    remove(ref(db, `lms_group_requests/${groupId}`));
    remove(ref(db, `lms_group_messages/${groupId}`));
    remove(ref(db, `lms_groups/${groupId}`)).then(() => {
        bootstrap.Modal.getInstance(el('groupDetailsModal')).hide();
        el('stateChat').classList.add('d-none');
        el('stateChat').style.display = 'none !important';
        el('stateEmpty').style.display = 'flex';
        selectedUser = null;
        switchTab('groups');
    });
};

el('btnGroupInfo').addEventListener('click', () => window.loadGroupDetails());

// ─── 7. Calls & WebRTC Logic ──────────────────────────────────────────────────
onValue(ref(db, `lms_calls/${myUid}`), snap => {
    const d        = snap.val();
    const backdrop = el('incomingBackdrop');
    if (!backdrop) return;

    if (d && d.status === 'ringing' && !jitsiApi) {
        incomingData = d;
        const caller = usersData.find(u => u.uid === d.callerUid);
        const col    = colorFor(d.callerUid);

        el('incomingAvatar').textContent      = (d.callerName || '?').charAt(0).toUpperCase();
        el('incomingAvatar').style.background = col;
        el('incomingName').textContent         = d.callerName || 'Unknown';
        el('incomingRole').textContent         = caller ? `${caller.role} · #${caller.display_id}` : 'User';

        const isVideo = d.type !== 'audio';
        el('incomingBadge').className = `call-type-badge ${isVideo ? 'video' : 'audio'}`;
        el('incomingBadge').innerHTML = isVideo ? '<i class="fas fa-video"></i> Video Call' : '<i class="fas fa-phone"></i> Audio Call';
        el('incomingCard').classList.toggle('audio', !isVideo);
        el('btnAccept').innerHTML = isVideo ? '<i class="fas fa-video"></i>' : '<i class="fas fa-phone"></i>';

        backdrop.classList.add('active');
        backdrop.style.display = 'flex';
        startRing();

    } else if (backdrop.style.display === 'flex' || backdrop.classList.contains('active')) {
        dismissModal();
    }
});

function dismissModal() {
    const backdrop = el('incomingBackdrop');
    backdrop.classList.remove('active');
    backdrop.style.display = 'none';
    stopRing();
    incomingData = null;
}

el('btnDecline').addEventListener('click', () => {
    if (incomingData) {
        remove(ref(db, `lms_calls/${myUid}`));
        remove(ref(db, `lms_calls/${incomingData.callerUid}`));
    }
    dismissModal();
});

el('btnAccept').addEventListener('click', () => {
    if (!incomingData) return;
    const d = { ...incomingData };
    dismissModal();
    remove(ref(db, `lms_calls/${myUid}`));
    el('callOverlayTitle').textContent = (d.type === 'video' ? '📹 Video' : '📞 Audio') + ' · ' + d.callerName;
    openJitsi(d.roomName, d.type);
});

el('btnEndCall').addEventListener('click', endCall);
el('btnAudioCall').addEventListener('click', () => startCall('audio'));
el('btnVideoCall').addEventListener('click', () => startCall('video'));

function startCall(type) {
    if (!selectedUser) return;

    if (selectedUser.isGroup) {
        const roomName = `ArtisansGC_${selectedUser.uid.replace(/[^a-zA-Z0-9]/g,'_')}`;
        el('callOverlayTitle').textContent = (type==='video' ? '📹 Group Video' : '📞 Group Audio') + ' · ' + selectedUser.name;
        if (currentMsgRef) {
            push(currentMsgRef, {
                is_system: true,
                text: `🎥 ${myName} started a ${type} call. Click the ${type==='video'?'video':'phone'} icon at the top to join!`,
                timestamp: Date.now()
            });
        }
        openJitsi(roomName, type);
        return;
    }
    
    const roomId   = myUid < selectedUser.uid ? `${myUid}_${selectedUser.uid}` : `${selectedUser.uid}_${myUid}`;
    const roomName = `ArtisansDM_${roomId.replace(/[^a-zA-Z0-9]/g,'_')}`;

    set(ref(db, `lms_calls/${selectedUser.uid}`), {
        callerUid: myUid, callerName: myName,
        type, roomName, status: 'ringing', timestamp: Date.now()
    });
    set(ref(db, `lms_calls/${myUid}`), {
        callerUid: myUid, callerName: myName,
        type, roomName, status: 'outgoing', timestamp: Date.now()
    });

    el('callOverlayTitle').textContent = (type==='video' ? '📹 Video' : '📞 Audio') + ' · ' + selectedUser.name;
    openJitsi(roomName, type);
}

function openJitsi(roomName, type) {
    el('callOverlay').classList.add('active');
    if (!jitsiApi) {
        jitsiApi = new window.JitsiMeetExternalAPI('meet.jit.si', {
            roomName,
            parentNode: el('jitsiContainer'),
            userInfo:   { displayName: myName },
            configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: type==='audio', prejoinPageEnabled: false }
        });
        jitsiApi.addListener('videoConferenceLeft', endCall);
    }
}

function endCall() {
    if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
    el('callOverlay').classList.remove('active');
    el('jitsiContainer').innerHTML = '';
    remove(ref(db, `lms_calls/${myUid}`));
    if (selectedUser && !selectedUser.isGroup) remove(ref(db, `lms_calls/${selectedUser.uid}`));
}

// ─── 8. UI Rendering & Interactions ──────────────────────────────────────────
el('tab-contacts').addEventListener('click', () => switchTab('contacts'));
el('tab-groups').addEventListener('click',   () => switchTab('groups'));
el('tab-requests').addEventListener('click', () => switchTab('requests'));

function switchTab(tab) {
    activeTab = tab;
    el('tab-contacts').classList.toggle('active', tab === 'contacts');
    el('tab-groups').classList.toggle('active',   tab === 'groups');
    el('tab-requests').classList.toggle('active', tab === 'requests');
    el('btnCreateGroup').style.display = tab === 'groups' ? 'flex' : 'none';
    el('btnJoinGroup').style.display   = tab === 'groups' ? 'flex' : 'none';
    renderList();
}

el('searchInput').addEventListener('input', function() { searchQuery = this.value.toLowerCase(); renderList(); });

function renderList() {
    const list = el('contactsList');
    list.innerHTML = '';
    
    let sourceData = activeTab === 'groups' ? groupsData : usersData;
    let filtered   = sourceData.filter(u =>
        u.name?.toLowerCase().includes(searchQuery) || (u.display_id && u.display_id.toString().includes(searchQuery))
    );
    
    if (!searchQuery && activeTab !== 'groups') {
        filtered = activeTab === 'contacts'
            ? filtered.filter(u => u.rel_status === 'accepted')
            : filtered.filter(u => u.rel_status === 'pending');
    }
    
    if (!filtered.length) {
        list.innerHTML = `<div style="padding:32px 20px;text-align:center;color:#94a3b8;font-size:.78rem;">
            <i class="fas fa-folder-open" style="font-size:1.5rem;opacity:.3;display:block;margin-bottom:8px;"></i>Nothing found.</div>`;
        return;
    }
    
    filtered.forEach(u => {
        const col        = u.isGroup ? '#8b5cf6' : colorFor(u.uid);
        const isSelected = selectedUser?.uid === u.uid;
        let badge        = '';
        
        if (u.rel_status === 'pending') {
            badge = u.rel_type === 'received'
                ? `<span class="req-badge" style="background:#fef3c7;color:#b45309;">New</span>`
                : `<span class="req-badge" style="background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;">Sent</span>`;
        }
        
        const div       = document.createElement('div');
        div.className   = `contact-item${isSelected ? ' selected' : ''}`;
        div.dataset.uid = u.uid;
        div.innerHTML   = `
            <div class="ci-avatar" style="background:${col};">${u.name.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
                <div class="ci-name text-truncate">${u.name}</div>
                <div class="d-flex gap-1 align-items-center">
                    <span class="ci-role">${u.role}</span>
                    ${u.isGroup ? '' : `<span class="ci-id">#${u.display_id}</span>`}
                </div>
            </div>${badge}`;
        div.addEventListener('click', () => openView(u.uid));
        list.appendChild(div);
    });
}

function openView(uid) {
    selectedUser = (activeTab === 'groups' ? groupsData : usersData).find(u => u.uid === uid);
    if (!selectedUser) return;
    
    renderList();
    if (window.innerWidth <= 768) el('contactsSidebar').classList.add('hidden');
    el('stateEmpty').style.display  = 'none';
    el('stateProfile').classList.add('d-none');
    el('stateChat').style.display   = 'none !important';
    el('stateChat').classList.add('d-none');
    
    if (selectedUser.isGroup || selectedUser.rel_status === 'accepted') showChat();
    else showProfile();
}

function showProfile() {
    const pv = el('stateProfile');
    pv.classList.remove('d-none');
    const col = colorFor(selectedUser.uid);
    el('profileAvatar').textContent      = selectedUser.name.charAt(0).toUpperCase();
    el('profileAvatar').style.background = col;
    el('profileName').textContent         = selectedUser.name;
    el('profileRole').textContent         = `${selectedUser.role} · #${selectedUser.display_id}`;

    const area = el('profileActionArea');
    area.innerHTML = '';

    if (selectedUser.rel_status === 'none') {
        const b     = document.createElement('button');
        b.className = 'action-btn action-btn-primary';
        b.innerHTML = '<i class="fas fa-paper-plane"></i> Send Request';
        b.addEventListener('click', () => {
            set(ref(db, `lms_contacts/${myUid}/${selectedUser.uid}`), {status:'pending',type:'sent',timestamp:Date.now()});
            set(ref(db, `lms_contacts/${selectedUser.uid}/${myUid}`), {status:'pending',type:'received',timestamp:Date.now()});
        });
        area.appendChild(b);
    } else if (selectedUser.rel_status === 'pending' && selectedUser.rel_type === 'sent') {
        area.innerHTML = `<button class="action-btn action-btn-ghost" disabled style="cursor:default;"><i class="fas fa-clock"></i> Request Sent</button>`;
        const cb      = document.createElement('button');
        cb.className  = 'action-btn action-btn-danger';
        cb.innerHTML  = '<i class="fas fa-times"></i> Cancel';
        cb.addEventListener('click', () => {
            remove(ref(db, `lms_contacts/${myUid}/${selectedUser.uid}`));
            remove(ref(db, `lms_contacts/${selectedUser.uid}/${myUid}`));
        });
        area.appendChild(cb);
    } else if (selectedUser.rel_status === 'pending' && selectedUser.rel_type === 'received') {
        area.innerHTML = `<div class="text-center mb-4" style="font-size:.82rem;color:#475569;font-weight:600;"><i class="fas fa-user-plus me-1" style="color:#0ea5e9;"></i> Wants to connect with you</div>`;
        const ab      = document.createElement('button');
        ab.className  = 'action-btn action-btn-success me-2';
        ab.innerHTML  = '<i class="fas fa-check"></i> Accept';
        ab.addEventListener('click', () => {
            set(ref(db, `lms_contacts/${myUid}/${selectedUser.uid}`), {status:'accepted',type:'accepted',timestamp:Date.now()});
            set(ref(db, `lms_contacts/${selectedUser.uid}/${myUid}`), {status:'accepted',type:'accepted',timestamp:Date.now()});
        });
        area.appendChild(ab);
        const db2     = document.createElement('button');
        db2.className = 'action-btn action-btn-decline';
        db2.innerHTML = '<i class="fas fa-times"></i> Decline';
        db2.addEventListener('click', () => {
            remove(ref(db, `lms_contacts/${myUid}/${selectedUser.uid}`));
            remove(ref(db, `lms_contacts/${selectedUser.uid}/${myUid}`));
        });
        area.appendChild(db2);
    }
}

function showChat() {
    const chat = el('stateChat');
    chat.classList.remove('d-none');
    chat.style.cssText = 'display:flex!important;flex-direction:column;flex:1;min-height:0;';

    const col = selectedUser.isGroup ? '#8b5cf6' : colorFor(selectedUser.uid);
    el('chatAvatar').textContent      = selectedUser.name.charAt(0).toUpperCase();
    el('chatAvatar').style.background = col;
    
    if (selectedUser.isGroup) {
        el('chatName').textContent   = selectedUser.name;
        el('chatStatus').innerHTML   = `<span class="text-truncate" style="color:#8b5cf6;font-size:.65rem;font-weight:700;"><i class="fas fa-users me-1"></i> Group Chat</span>`;
        el('btnAudioCall').style.display    = 'flex';
        el('btnVideoCall').style.display    = 'flex';
        el('btnCopyGroupCode').style.display = 'block';
        el('groupInfoBtnWrap').style.display = 'block';

        el('btnCopyGroupCode').onclick = () => {
            navigator.clipboard.writeText(selectedUser.uid).then(() => {
                el('btnCopyGroupCode').innerHTML = `<i class="fas fa-check text-success"></i> <span class="d-none d-sm-inline ms-1 text-success">Copied</span>`;
                setTimeout(() => {
                    el('btnCopyGroupCode').innerHTML = `<i class="fas fa-copy text-primary"></i> <span class="d-none d-sm-inline ms-1 text-primary">Code</span>`;
                }, 1500);
            });
        };

        get(ref(db, `lms_groups/${selectedUser.uid}`)).then(snap => {
            if(snap.exists()) {
                const grp = snap.val();
                if(grp.createdBy === myUid) {
                    if(window.headerReqListener) off(window.headerReqListener);
                    window.headerReqListener = ref(db, `lms_group_requests/${selectedUser.uid}`);
                    onValue(window.headerReqListener, reqSnap => {
                        const cnt = reqSnap.val() ? Object.keys(reqSnap.val()).length : 0;
                        el('infoNotifDot').style.display = cnt > 0 ? 'block' : 'none';
                    });
                } else {
                    el('infoNotifDot').style.display = 'none';
                    if(window.headerReqListener) { off(window.headerReqListener); window.headerReqListener = null; }
                }
            }
        });
    } else {
        el('chatName').textContent           = `${selectedUser.name} (#${selectedUser.display_id})`;
        el('chatStatus').innerHTML           = `<span class="text-truncate"><i class="fas fa-circle" style="font-size:.4rem;color:#22c55e;"></i> Connected</span>`;
        el('btnAudioCall').style.display     = 'flex';
        el('btnVideoCall').style.display     = 'flex';
        el('btnCopyGroupCode').style.display = 'none';
        el('groupInfoBtnWrap').style.display = 'none';
    }
    
    el('chatMessages').innerHTML = '';

    const refPath = selectedUser.isGroup
        ? `lms_group_messages/${selectedUser.uid}`
        : `lms_direct_messages/${myUid < selectedUser.uid ? `${myUid}_${selectedUser.uid}` : `${selectedUser.uid}_${myUid}`}`;

    if (currentMsgRef) off(currentMsgRef);
    currentMsgRef = ref(db, refPath);

    onChildAdded(currentMsgRef, snap => {
        const msg = snap.val();
        const box = el('chatMessages');

        if (msg.is_system) {
            const row     = document.createElement('div');
            row.className = 'text-center my-3';
            row.innerHTML = `<span class="badge bg-white text-muted border px-3 py-2 rounded-pill shadow-sm" style="font-size:.7rem;">${msg.text}</span>`;
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
            return;
        }

        const isMe       = msg.sender_uid === myUid;
        const time       = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        const row        = document.createElement('div');
        row.className    = `msg-row ${isMe ? 'text-end' : 'text-start'}`;
        const senderName = isMe ? 'You' : (msg.sender_name || 'Unknown');
        let messageContent = '';

        if (msg.fileUrl) {
            if (msg.fileType && msg.fileType.startsWith('image/')) {
                messageContent = `<div class="mb-1">${msg.text || ''}</div>
                    <a href="${msg.fileUrl}" target="_blank">
                        <img src="${msg.fileUrl}" alt="Attached Image" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:5px;border:1px solid rgba(0,0,0,0.1);">
                    </a>`;
            } else {
                const iconColor = isMe ? 'text-white' : 'text-primary';
                const linkColor = isMe ? 'text-white' : 'text-dark';
                messageContent = `<div class="mb-1">${msg.text || ''}</div>
                    <a href="${msg.fileUrl}" target="_blank" class="d-inline-flex align-items-center gap-2 p-2 rounded text-decoration-none ${linkColor}" style="background:rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.1);">
                        <i class="fas fa-file-alt fs-5 ${iconColor}"></i>
                        <span style="font-size:.8rem;font-weight:600;">View Attachment</span>
                    </a>`;
            }
        } else {
            messageContent = msg.text || '';
        }

        row.innerHTML = `<div class="msg-meta">${senderName} · ${time}</div>
                         <div class="msg-bubble ${isMe ? 'bubble-me' : 'bubble-them'}" style="text-align:left;">${messageContent}</div>`;
        box.appendChild(row);
        box.scrollTop = box.scrollHeight;
    });
}

function sendMsg() {
    const inp  = el('msgInput');
    const text = inp.value.trim();
    if (text && currentMsgRef) {
        push(currentMsgRef, { sender_uid: myUid, sender_name: myName, text, timestamp: Date.now() });
        inp.value = '';
    }
}
el('sendBtn').addEventListener('click', sendMsg);
el('msgInput').addEventListener('keypress', e => { if (e.which === 13) sendMsg(); });

// ─── Emoji Logic ──────────────────────────────────────────────────────────────
el('emojiBtn').addEventListener('click', e => {
    e.preventDefault();
    const p = document.querySelector('emoji-picker');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
});
document.querySelector('emoji-picker').addEventListener('emoji-click', e => {
    el('msgInput').value += e.detail.unicode;
    document.querySelector('emoji-picker').style.display = 'none';
    el('msgInput').focus();
});
document.addEventListener('click', e => {
    if (!e.target.closest('emoji-picker') && !e.target.closest('#emojiBtn'))
        document.querySelector('emoji-picker').style.display = 'none';
});

// ─── 9. File Upload Logic ─────────────────────────────────────────────────────
$('#attachBtn').click(() => $('#fileUploadInput').click());
$('#fileUploadInput').change(function () {
    const file = this.files[0]; if (!file) return;
    const btn  = $('#attachBtn');
    btn.html('<i class="fas fa-spinner fa-spin"></i>').prop('disabled', true);
    const fd = new FormData(); fd.append('file', file);
    
    $.ajax({
        url: '/artisansLMS/backend/endpoints/upload.php',
        type: 'POST', data: fd, processData: false, contentType: false,
        success: res => {
            if (res.status === 'success') {
                push(currentMsgRef, {
                    sender_uid: myUid, sender_name: myName,
                    text: $('#msgInput').val().trim() || '',
                    fileUrl: res.fileUrl, fileType: res.fileType, timestamp: Date.now()
                });
                $('#msgInput').val('');
            } else alert(res.message);
        },
        complete: () => {
            $('#fileUploadInput').val('');
            btn.html('<i class="fas fa-paperclip"></i>').prop('disabled', false);
        }
    });
});

el('chatBackBtn').addEventListener('click',    () => el('contactsSidebar').classList.remove('hidden'));
el('profileBackBtn').addEventListener('click', () => el('contactsSidebar').classList.remove('hidden'));