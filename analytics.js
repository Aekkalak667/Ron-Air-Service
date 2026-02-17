// ===== PP. Air & Electric - Analytics Page =====

// ===== Session Security Check =====
if (sessionStorage.getItem('ppair_auth') !== 'true') {
    window.location.href = 'index.html';
}

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCR9mJjcnvtgrO46a6GU-MNsESAZkrZagM",
    authDomain: "pron-air.firebaseapp.com",
    projectId: "pron-air",
    storageBucket: "pron-air.firebasestorage.app",
    messagingSenderId: "700848107946",
    appId: "1:700848107946:web:2f5ed203968e236f0c3bd3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const loadingOverlay = document.getElementById('loadingOverlay');
const totalVisitsEl = document.getElementById('totalVisits');
const todayVisitsEl = document.getElementById('todayVisits');
const uniqueIPsEl = document.getElementById('uniqueIPs');
const dailyChartEl = document.getElementById('dailyChart');
const ipListEl = document.getElementById('ipList');
const terminalLogEl = document.getElementById('terminalLog');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
    subscribeToVisitors(); // Real-time terminal
});

// Real-time subscription for terminal
function subscribeToVisitors() {
    db.collection('visitors')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            const visitors = snapshot.docs.map(doc => doc.data());
            renderTerminalLog(visitors);

            // Also update stats in real-time
            updateStats(visitors);
        });
}

function updateStats(recentVisitors) {
    // Get all visitors for accurate stats
    db.collection('visitors').get().then((snapshot) => {
        const allVisitors = snapshot.docs.map(doc => doc.data());
        const today = new Date().toISOString().split('T')[0];
        const todayVisitors = allVisitors.filter(v => v.date === today);
        const uniqueIPs = [...new Set(allVisitors.map(v => v.ip))];

        totalVisitsEl.textContent = allVisitors.length.toLocaleString();
        todayVisitsEl.textContent = todayVisitors.length.toLocaleString();
        uniqueIPsEl.textContent = uniqueIPs.length.toLocaleString();

        renderIPList(todayVisitors);
    });
}

function showLoading() {
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// ===== Load Analytics Data =====
async function loadAnalytics() {
    showLoading();

    try {
        const snapshot = await db.collection('visitors').orderBy('timestamp', 'desc').get();
        const visitors = snapshot.docs.map(doc => doc.data());

        if (visitors.length === 0) {
            totalVisitsEl.textContent = '0';
            todayVisitsEl.textContent = '0';
            uniqueIPsEl.textContent = '0';
            dailyChartEl.innerHTML = '<p class="no-data">ยังไม่มีข้อมูล</p>';
            ipListEl.innerHTML = '<p class="no-data">ยังไม่มีข้อมูล</p>';
            terminalLogEl.innerHTML = '<div class="log-line"><span class="log-info">[INFO]</span> No visitors yet</div>';
            hideLoading();
            return;
        }

        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const todayVisitors = visitors.filter(v => v.date === today);
        const uniqueIPs = [...new Set(visitors.map(v => v.ip))];

        totalVisitsEl.textContent = visitors.length.toLocaleString();
        todayVisitsEl.textContent = todayVisitors.length.toLocaleString();
        uniqueIPsEl.textContent = uniqueIPs.length.toLocaleString();

        // Daily chart (last 7 days)
        renderDailyChart(visitors);

        // IP list for today
        renderIPList(todayVisitors);

        // Terminal log (last 50)
        renderTerminalLog(visitors.slice(0, 50));

    } catch (error) {
        console.error('Error loading analytics:', error);
    }

    hideLoading();
}

// ===== Render Daily Chart =====
function renderDailyChart(visitors) {
    const dailyData = {};
    const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyData[dateStr] = {
            count: 0,
            day: thaiDays[date.getDay()],
            date: date.getDate()
        };
    }

    // Count visitors per day
    visitors.forEach(v => {
        if (dailyData[v.date]) {
            dailyData[v.date].count++;
        }
    });

    // Find max for scaling
    const maxCount = Math.max(...Object.values(dailyData).map(d => d.count), 1);

    // Render bars
    const bars = Object.entries(dailyData).map(([date, data]) => {
        const height = (data.count / maxCount) * 100;
        const isToday = date === new Date().toISOString().split('T')[0];
        return `
            <div class="chart-bar ${isToday ? 'today' : ''}">
                <span class="bar-value">${data.count}</span>
                <div class="bar-fill" style="height: ${Math.max(height, 5)}%"></div>
                <span class="bar-label">${data.day}<br>${data.date}</span>
            </div>
        `;
    }).join('');

    dailyChartEl.innerHTML = bars;
}

// ===== Render IP List =====
function renderIPList(todayVisitors) {
    if (todayVisitors.length === 0) {
        ipListEl.innerHTML = '<p class="no-data">ยังไม่มีผู้เข้าชมวันนี้</p>';
        return;
    }

    // Group by IP
    const ipCounts = {};
    todayVisitors.forEach(v => {
        if (!ipCounts[v.ip]) {
            ipCounts[v.ip] = {
                count: 0,
                lastVisit: v.timestamp,
                isp: v.isp || '',
                city: v.city || '',
                region: v.region || ''
            };
        }
        ipCounts[v.ip].count++;
        if (v.timestamp > ipCounts[v.ip].lastVisit) {
            ipCounts[v.ip].lastVisit = v.timestamp;
        }
    });

    // Sort by count
    const sortedIPs = Object.entries(ipCounts)
        .sort((a, b) => b[1].count - a[1].count);

    const rows = sortedIPs.map(([ip, data]) => {
        const time = new Date(data.lastVisit).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const location = [data.city, data.region].filter(Boolean).join(', ') || '-';
        return `
            <div class="ip-row">
                <div class="ip-info">
                    <span class="ip-address">${ip}</span>
                    <span class="ip-isp">${data.isp || '-'}</span>
                    <span class="ip-location">${location}</span>
                    <span class="ip-time">ล่าสุด: ${time}</span>
                </div>
                <div class="ip-count">${data.count} ครั้ง</div>
            </div>
        `;
    }).join('');

    ipListEl.innerHTML = rows;
}

// ===== Render Terminal Log =====
function renderTerminalLog(visitors) {
    const lines = visitors.map(v => {
        const timestamp = new Date(v.timestamp);
        const dateStr = timestamp.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit'
        });
        const timeStr = timestamp.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        return `<div class="log-line">
            <span class="log-time">[${dateStr} ${timeStr}]</span>
            <span class="log-status">VISIT</span>
            <span class="log-ip">${v.ip}</span>
            <span class="log-isp">${v.isp || ''}</span>
            <span class="log-page">→ ${v.page || 'customer'}</span>
        </div>`;
    }).join('');

    terminalLogEl.innerHTML = lines;
}

console.log('%c📊 PP. Air Analytics', 'font-size: 16px; font-weight: bold; color: #0891b2;');
