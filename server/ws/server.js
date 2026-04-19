const WebSocket = require('ws');
const mysql = require('mysql2');

// 1. Connect to MySQL (Read-Only Mode essentially)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'itprofel3'
});

db.connect(err => {
    if (err) return console.error('❌ Database connection failed:', err.message);
    console.log('✅ Connected to itprofel3 MySQL Database.');
});

// 2. IN-MEMORY STATE (Since we cannot modify the database)
// In a production app, you would sync this to Firebase instead.
const runtimeState = {
    xpTracker: {},       // Format: { "student_id": total_xp }
    activeClasses: {}    // Format: { "class_id": Set([student_ids]) }
};

// 3. Start WebSocket Server
const wss = new WebSocket.Server({ port: 8080 }, () => {
    console.log('🚀 LMS WebSocket Server running on ws://localhost:8080');
});

wss.on('connection', (ws) => {
    console.log('📱 Client connected to WebSocket.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // SECURITY CHECK: Verify student is actually enrolled before giving XP or allowing attendance
            verifyEnrollment(data.student_id, data.class_id, (isEnrolled) => {
                if (!isEnrolled) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Not enrolled in this class.' }));
                    return;
                }

                // If enrolled, process the event
                if (data.type === 'POST_MESSAGE') {
                    handleXPIncrease(ws, data.student_id, 10);
                } 
                else if (data.type === 'ATTENDANCE') {
                    handleAttendance(data.student_id, data.class_id, data.status);
                }
            });

        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });
});

// --- CORE LOGIC ---

// Verifies against your actual `enrollments` table without modifying it
function verifyEnrollment(studentId, classId, callback) {
    const query = `SELECT enrollment_id FROM enrollments WHERE student_id = ? AND class_id = ?`;
    db.query(query, [studentId, classId], (err, rows) => {
        if (err) {
            console.error("SQL Error:", err.message);
            callback(false);
        } else {
            callback(rows.length > 0);
        }
    });
}

// Manages XP in server memory
function handleXPIncrease(ws, studentId, points) {
    // Initialize if they don't exist in memory yet
    if (!runtimeState.xpTracker[studentId]) {
        runtimeState.xpTracker[studentId] = 0;
    }
    
    // Add points
    runtimeState.xpTracker[studentId] += points;
    const newXp = runtimeState.xpTracker[studentId];
    
    // Send back to the browser
    ws.send(JSON.stringify({
        type: 'XP_UPDATE',
        new_xp: newXp
    }));
    
    console.log(`⭐ Student ${studentId} gained ${points} XP. Total: ${newXp}`);
}

// Manages live attendance in server memory
function handleAttendance(studentId, classId, status) {
    // Initialize class room if it doesn't exist
    if (!runtimeState.activeClasses[classId]) {
        runtimeState.activeClasses[classId] = new Set();
    }

    if (status === 'joined') {
        runtimeState.activeClasses[classId].add(studentId);
        console.log(`[LIVE] Student ${studentId} joined Class ${classId}`);
    } else if (status === 'left') {
        runtimeState.activeClasses[classId].delete(studentId);
        console.log(`[LIVE] Student ${studentId} left Class ${classId}`);
    }
    
    // You could broadcast the new active user count here if needed
    console.log(`Total active in class ${classId}:`, runtimeState.activeClasses[classId].size);
}