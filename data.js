// ===== PP. Air & Electric - Data Page =====

// ===== Session Security Check =====
if (sessionStorage.getItem('ppair_auth') !== 'true') {
    // Not authenticated, redirect to login
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
const appointmentsRef = db.collection('appointments');

// ===== State =====
let appointments = [];
let currentFilter = 'all';
let searchQuery = '';

// ===== Date Functions =====
const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
}

// ===== DOM Elements =====
const loadingOverlay = document.getElementById('loadingOverlay');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const dataCount = document.getElementById('dataCount');
const searchInput = document.getElementById('searchInput');
const filterChips = document.querySelectorAll('.chip');
const exportBtn = document.getElementById('exportBtn');

// ===== Loading =====
function showLoading() {
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initSearch();
    initExport();
    initDragScroll();
    subscribeToAppointments();
});

// ===== Drag Scroll =====
function initDragScroll() {
    const container = document.querySelector('.table-container');
    if (!container) return;

    let isDown = false;
    let startX;
    let scrollLeft;
    let velX = 0;
    let momentumID;

    // Mouse events for desktop
    container.addEventListener('mousedown', (e) => {
        if (e.target.closest('a, button, input')) return;

        isDown = true;
        container.classList.add('dragging');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        cancelMomentum();
    });

    container.addEventListener('mouseleave', () => {
        if (isDown) {
            isDown = false;
            container.classList.remove('dragging');
            startMomentum();
        }
    });

    container.addEventListener('mouseup', () => {
        isDown = false;
        container.classList.remove('dragging');
        startMomentum();
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = x - startX;
        velX = walk;
        container.scrollLeft = scrollLeft - walk;
        startX = x;
        scrollLeft = container.scrollLeft;
    });

    // Momentum scrolling
    function startMomentum() {
        cancelMomentum();
        momentumID = requestAnimationFrame(momentumLoop);
    }

    function cancelMomentum() {
        if (momentumID) {
            cancelAnimationFrame(momentumID);
        }
    }

    function momentumLoop() {
        container.scrollLeft -= velX;
        velX *= 0.92; // Friction
        if (Math.abs(velX) > 0.5) {
            momentumID = requestAnimationFrame(momentumLoop);
        }
    }

    // Touch events use native scroll (smoother)
    // Just let the browser handle touch scrolling natively
}

// ===== Real-time Subscription =====
function subscribeToAppointments() {
    showLoading();

    appointmentsRef.orderBy('appointmentDate', 'desc').onSnapshot((snapshot) => {
        appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderTable();
        hideLoading();
    }, (error) => {
        console.error('Error fetching:', error);
        hideLoading();
    });
}

// ===== Filters =====
function initFilters() {
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderTable();
        });
    });
}

// ===== Search =====
function initSearch() {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTable();
    });
}

// ===== Export =====
function initExport() {
    exportBtn.addEventListener('click', exportToCSV);
}

function exportToCSV() {
    const filtered = getFilteredData();

    if (filtered.length === 0) {
        alert('ไม่มีข้อมูลให้ export');
        return;
    }

    const headers = ['วันที่', 'เวลา', 'ชื่อลูกค้า', 'เบอร์โทร', 'ที่อยู่', 'จำนวนแอร์', 'สถานะ', 'หมายเหตุ', 'แผนที่'];

    const rows = filtered.map(apt => [
        formatDate(apt.appointmentDate),
        apt.appointmentTime || '-',
        apt.customerName,
        apt.phone,
        apt.address ? apt.address.replace(/,/g, ' ') : '',
        apt.acCount,
        apt.status === 'completed' ? 'เสร็จสิ้น' : 'รอดำเนินการ',
        apt.notes ? apt.notes.replace(/,/g, ' ') : '',
        apt.location ? apt.location.mapUrl : ''
    ]);

    const csvContent = '\ufeff' + [headers, ...rows].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ron-air-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ===== Render Table =====
function getFilteredData() {
    let filtered = [...appointments];

    // Filter by status
    if (currentFilter === 'pending') {
        filtered = filtered.filter(a => a.status === 'pending');
    } else if (currentFilter === 'completed') {
        filtered = filtered.filter(a => a.status === 'completed');
    }

    // Search
    if (searchQuery) {
        filtered = filtered.filter(a =>
            a.customerName.toLowerCase().includes(searchQuery) ||
            a.phone.includes(searchQuery) ||
            (a.address && a.address.toLowerCase().includes(searchQuery)) ||
            (a.notes && a.notes.toLowerCase().includes(searchQuery))
        );
    }

    return filtered;
}

function renderTable() {
    const filtered = getFilteredData();

    dataCount.textContent = `${filtered.length} รายการ`;

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    tableBody.innerHTML = filtered.map(createTableRow).join('');
    attachRowListeners();
}

function createTableRow(apt) {
    const statusClass = apt.status === 'completed' ? 'completed' : 'pending';
    const statusText = apt.status === 'completed' ? 'เสร็จสิ้น' : 'รอ';

    const mapLink = apt.location
        ? `<a href="${apt.location.mapUrl}" target="_blank" class="map-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
           </a>`
        : '';

    return `
        <tr data-id="${apt.id}">
            <td class="col-date">${formatDate(apt.appointmentDate)}${apt.appointmentTime ? ` <span class="time-text">${apt.appointmentTime}</span>` : ''}</td>
            <td class="col-name">${apt.customerName}</td>
            <td class="col-phone">
                <a href="tel:${apt.phone}" class="phone-link">${apt.phone}</a>
            </td>
            <td class="col-address">
                <span class="address-text">${apt.address || '-'}</span>
                ${mapLink}
            </td>
            <td class="col-ac">${apt.acCount}</td>
            <td class="col-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td class="col-notes">${apt.notes || '-'}</td>
            <td class="col-actions">
                <button class="row-action delete" data-action="delete" title="ลบ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </td>
        </tr>
    `;
}

function attachRowListeners() {
    document.querySelectorAll('.row-action.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            const id = row.dataset.id;

            if (confirm('ต้องการลบข้อมูลนี้?')) {
                appointmentsRef.doc(id).delete()
                    .catch(err => console.error('Delete error:', err));
            }
        });
    });
}

console.log('%c📊 PP. Air & Electric Data Page', 'font-size: 14px; font-weight: bold; color: #0891b2;');
