// ===== PP. Air & Electric - Firebase Bento Dashboard =====
// Using Firebase Compat (works without server)

// ===== PIN Lock System =====
const PIN_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // SHA256 of '123456'
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes

function hashPin(pin) {
    // Simple hash for demo - in production use proper crypto
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        const char = pin.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

function checkPinLock() {
    const lockScreen = document.getElementById('pinLockScreen');
    const appContainer = document.getElementById('appContainer');

    // Check if already authenticated in this session
    if (sessionStorage.getItem('ppair_auth') === 'true') {
        lockScreen.style.display = 'none';
        appContainer.style.display = 'block';
        return true;
    }

    // Check lockout
    const lockoutUntil = localStorage.getItem('ppair_lockout');
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
        const remaining = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 1000 / 60);
        document.getElementById('pinError').textContent = `ล็อคอยู่ กรุณารอ ${remaining} นาที`;
    }

    // PIN submit handler
    document.getElementById('pinSubmitBtn').addEventListener('click', submitPin);
    document.getElementById('pinInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitPin();
    });

    return false;
}

function submitPin() {
    const pinInput = document.getElementById('pinInput');
    const pinError = document.getElementById('pinError');
    const lockScreen = document.getElementById('pinLockScreen');
    const appContainer = document.getElementById('appContainer');

    // Check lockout
    const lockoutUntil = localStorage.getItem('ppair_lockout');
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
        const remaining = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 1000 / 60);
        pinError.textContent = `ล็อคอยู่ กรุณารอ ${remaining} นาที`;
        return;
    }

    const enteredPin = pinInput.value;

    // Load PIN from Firebase or use default
    db.collection('settings').doc('security').get()
        .then((doc) => {
            let correctPin = '1234'; // Default PIN
            if (doc.exists && doc.data().pin) {
                correctPin = doc.data().pin;
            }

            if (enteredPin === correctPin) {
                // Success
                sessionStorage.setItem('ppair_auth', 'true');
                localStorage.removeItem('ppair_attempts');
                localStorage.removeItem('ppair_lockout');
                lockScreen.style.display = 'none';
                appContainer.style.display = 'block';
            } else {
                // Failed
                let attempts = parseInt(localStorage.getItem('ppair_attempts') || '0') + 1;
                localStorage.setItem('ppair_attempts', attempts.toString());

                if (attempts >= MAX_ATTEMPTS) {
                    // Lock out
                    localStorage.setItem('ppair_lockout', (Date.now() + LOCKOUT_TIME).toString());
                    pinError.textContent = `ล็อค 5 นาที เนื่องจากรหัสผิดหลายครั้ง`;
                } else {
                    pinError.textContent = `รหัสไม่ถูกต้อง (${MAX_ATTEMPTS - attempts} ครั้งที่เหลือ)`;
                }
                pinInput.value = '';
            }
        })
        .catch(() => {
            // If can't access Firebase, use default pin
            if (enteredPin === '1234') {
                sessionStorage.setItem('ppair_auth', 'true');
                lockScreen.style.display = 'none';
                appContainer.style.display = 'block';
            } else {
                pinError.textContent = 'รหัสไม่ถูกต้อง';
                pinInput.value = '';
            }
        });
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

// Check PIN on load
document.addEventListener('DOMContentLoaded', checkPinLock);

// ===== State =====
let appointments = [];
let currentFilter = 'all';
let editingId = null;
let currentMonth = new Date();

// ===== Date Functions =====
const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatDate(dateString) {
    const date = new Date(dateString);
    return { day: date.getDate(), month: thaiMonthsShort[date.getMonth()] };
}

function formatFullDate(dateString) {
    const date = new Date(dateString);
    return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function addSixMonths(dateString) {
    const date = new Date(dateString);
    date.setMonth(date.getMonth() + 6);
    return date.toISOString().split('T')[0];
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

// ===== DOM Elements =====
const addAppointmentBtn = document.getElementById('addAppointmentBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const appointmentForm = document.getElementById('appointmentForm');
const appointmentsList = document.getElementById('appointmentsList');
const emptyState = document.getElementById('emptyState');
const filterPills = document.querySelectorAll('.pill');
const modalTitle = document.getElementById('modalTitle');
const loadingOverlay = document.getElementById('loadingOverlay');

// ===== Loading =====
function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('show');
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('show');
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initPricing();
    setDefaultDate();
    subscribeToAppointments();
    loadPricing();
});

// ===== Real-time Subscription =====
function subscribeToAppointments() {
    showLoading();

    appointmentsRef.orderBy('appointmentDate', 'asc').onSnapshot((snapshot) => {
        appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderCalendar();
        renderAppointments();
        updateStats();
        hideLoading();
    }, (error) => {
        console.error('Error fetching appointments:', error);
        hideLoading();
        showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    });
}

// ===== Event Listeners =====
function initEventListeners() {
    addAppointmentBtn?.addEventListener('click', () => openModal());
    modalClose?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    appointmentForm?.addEventListener('submit', handleSubmit);

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter;
            renderAppointments();
        });
    });

    // Service Type Toggle
    document.querySelectorAll('.service-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.service-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.dataset.type;
            document.getElementById('serviceType').value = type;

            // Toggle fields visibility
            const acFields = document.querySelectorAll('.ac-field');
            const electricalFields = document.querySelectorAll('.electrical-field');
            const otherFields = document.querySelectorAll('.other-field');

            // Hide all first
            acFields.forEach(f => f.style.display = 'none');
            electricalFields.forEach(f => f.style.display = 'none');
            otherFields.forEach(f => f.style.display = 'none');

            // Show based on type
            if (type === 'ac') {
                acFields.forEach(f => f.style.display = 'block');
            } else if (type === 'electrical') {
                electricalFields.forEach(f => f.style.display = 'block');
            } else if (type === 'other') {
                otherFields.forEach(f => f.style.display = 'block');
            }
        });
    });

    document.getElementById('prevMonth')?.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth')?.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) dateInput.value = today;
}

// ===== Calendar =====
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    document.getElementById('currentMonth').textContent = `${thaiMonths[month]} ${year + 543}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Only show pending appointments in calendar
    const pendingAppointments = appointments.filter(a => a.status === 'pending');
    const today = new Date();
    let html = '';

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${prevMonthLastDay - i}</div>`;
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const isToday = isSameDay(date, today);

        // Count appointments for this day
        const dayAppointments = pendingAppointments.filter(a => isSameDay(new Date(a.appointmentDate), date));
        const jobCount = dayAppointments.length;

        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (jobCount > 0) classes += ' has-appointment';

        const jobBadge = jobCount > 0 ? `<span class="job-count">${jobCount}</span>` : '';

        html += `<div class="${classes}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}${jobBadge}</div>`;
    }

    // Next month days
    const remainingDays = 42 - (startDay + totalDays);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month">${day}</div>`;
    }

    document.getElementById('calendarDays').innerHTML = html;

    // Click on calendar day - show appointments for that day
    document.querySelectorAll('.calendar-day:not(.other-month)').forEach(day => {
        day.addEventListener('click', () => {
            const date = day.dataset.date;
            if (date) {
                showDayAppointments(date);
            }
        });
    });
}

// ===== Show Day Appointments Modal =====
function showDayAppointments(dateStr) {
    const dayAppts = appointments.filter(a => a.appointmentDate === dateStr);
    const dateObj = new Date(dateStr);
    const thaiDate = `${dateObj.getDate()} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;

    // Create modal HTML
    const modalHtml = `
        <div class="day-modal-overlay" id="dayModalOverlay">
            <div class="day-modal">
                <div class="day-modal-header">
                    <h3>📅 ${thaiDate}</h3>
                    <button class="day-modal-close" id="dayModalClose">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="day-modal-body">
                    ${dayAppts.length > 0 ? dayAppts.map(a => `
                        <div class="day-appt-card ${a.status}">
                            <div class="day-appt-header">
                                <span class="day-appt-name">${a.customerName}</span>
                                <span class="day-appt-badge ${a.status}">${a.status === 'pending' ? 'รอดำเนินการ' : a.status === 'confirmed' ? 'ยืนยันแล้ว' : 'เสร็จสิ้น'}</span>
                            </div>
                            <div class="day-appt-rows">
                                <div class="day-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                    <a href="tel:${a.phone}" class="day-link">${a.phone}</a>
                                </div>
                                ${a.appointmentTime ? `
                                <div class="day-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <span>${a.appointmentTime}</span>
                                </div>
                                ` : ''}
                                ${a.serviceType === 'electrical' ? `
                                <div class="day-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                    <span style="color: var(--accent);">งานไฟฟ้า</span>
                                </div>
                                ${a.electricalDetails ? `
                                <div class="day-row notes">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <span>${a.electricalDetails}</span>
                                </div>
                                ` : ''}
                                ` : `
                                <div class="day-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2V12Z"/><path d="M6 8h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6V8Z"/></svg>
                                    <span>${a.acCount || 1} เครื่อง</span>
                                </div>
                                `}
                                <div class="day-row address">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <span>${a.address || '-'}</span>
                                </div>
                                ${a.location ? `
                                <div class="day-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                                    <a href="${a.location}" target="_blank" class="day-link">เปิด Google Maps</a>
                                </div>
                                ` : ''}
                                ${a.notes ? `
                                <div class="day-row notes">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <span>${a.notes}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('') : '<p class="no-appts">ไม่มีนัดหมายในวันนี้</p>'}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Event listeners
    document.getElementById('dayModalClose').addEventListener('click', closeDayModal);
    document.getElementById('dayModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'dayModalOverlay') closeDayModal();
    });
}

function closeDayModal() {
    const modal = document.getElementById('dayModalOverlay');
    if (modal) modal.remove();
}

// ===== Modal =====
function openModal(appointment = null) {
    // Reset service type toggle to default
    document.querySelectorAll('.service-type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.service-type-btn[data-type="ac"]').classList.add('active');
    document.getElementById('serviceType').value = 'ac';
    document.querySelectorAll('.ac-field').forEach(f => f.style.display = 'block');
    document.querySelectorAll('.electrical-field').forEach(f => f.style.display = 'none');
    document.querySelectorAll('.other-field').forEach(f => f.style.display = 'none');

    if (appointment) {
        editingId = appointment.id;
        modalTitle.textContent = 'แก้ไขนัดหมาย';
        document.getElementById('appointmentId').value = appointment.id;
        document.getElementById('customerName').value = appointment.customerName;
        document.getElementById('phone').value = appointment.phone;
        document.getElementById('address').value = appointment.address;
        document.getElementById('appointmentDate').value = appointment.appointmentDate;
        document.getElementById('acCount').value = appointment.acCount || 1;
        document.getElementById('notes').value = appointment.notes || '';
        document.getElementById('electricalDetails').value = appointment.electricalDetails || '';
        document.getElementById('otherDetails').value = appointment.otherDetails || '';

        // Set service type if exists
        const serviceType = appointment.serviceType || 'ac';
        document.getElementById('serviceType').value = serviceType;
        document.querySelectorAll('.service-type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.service-type-btn[data-type="${serviceType}"]`)?.classList.add('active');

        // Show/hide fields based on type
        document.querySelectorAll('.ac-field').forEach(f => f.style.display = 'none');
        document.querySelectorAll('.electrical-field').forEach(f => f.style.display = 'none');
        document.querySelectorAll('.other-field').forEach(f => f.style.display = 'none');

        if (serviceType === 'ac') {
            document.querySelectorAll('.ac-field').forEach(f => f.style.display = 'block');
        } else if (serviceType === 'electrical') {
            document.querySelectorAll('.electrical-field').forEach(f => f.style.display = 'block');
        } else if (serviceType === 'other') {
            document.querySelectorAll('.other-field').forEach(f => f.style.display = 'block');
        }
    } else {
        editingId = null;
        modalTitle.textContent = 'เพิ่มนัดหมายใหม่';
        appointmentForm.reset();
        document.getElementById('acCount').value = 1;
        setDefaultDate();
    }
    modalOverlay.classList.add('show');
}

function closeModal() {
    modalOverlay.classList.remove('show');
    appointmentForm.reset();
    editingId = null;
}

// ===== Form Submit =====
function handleSubmit(e) {
    e.preventDefault();
    showLoading();

    const serviceType = document.getElementById('serviceType').value;

    const appointmentData = {
        customerName: document.getElementById('customerName').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        appointmentDate: document.getElementById('appointmentDate').value,
        serviceType: serviceType,
        acCount: serviceType === 'ac' ? parseInt(document.getElementById('acCount').value) || 1 : null,
        electricalDetails: serviceType === 'electrical' ? document.getElementById('electricalDetails').value : null,
        otherDetails: serviceType === 'other' ? document.getElementById('otherDetails').value : null,
        notes: document.getElementById('notes').value,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    if (editingId) {
        // Update existing
        const existingApt = appointments.find(a => a.id === editingId);
        appointmentData.status = existingApt?.status || 'pending';
        appointmentData.createdAt = existingApt?.createdAt || appointmentData.createdAt;
        if (existingApt?.nextAppointment) {
            appointmentData.nextAppointment = existingApt.nextAppointment;
        }

        appointmentsRef.doc(editingId).update(appointmentData)
            .then(() => {
                showToast('แก้ไขเรียบร้อย');
                closeModal();
            })
            .catch((error) => {
                console.error('Error updating:', error);
                showToast('เกิดข้อผิดพลาด');
            })
            .finally(() => hideLoading());
    } else {
        // Add new
        appointmentsRef.add(appointmentData)
            .then(() => {
                showToast('เพิ่มนัดหมายแล้ว');
                closeModal();
            })
            .catch((error) => {
                console.error('Error adding:', error);
                showToast('เกิดข้อผิดพลาด');
            })
            .finally(() => hideLoading());
    }
}

// ===== Render Appointments =====
function renderAppointments() {
    let filtered = [...appointments];

    if (currentFilter === 'pending') {
        // งานใหม่: pending status AND not from auto_reschedule
        filtered = filtered.filter(a => a.status === 'pending' && a.source !== 'auto_reschedule');
    } else if (currentFilter === 'confirmed') {
        // ยืนยันแล้ว: confirmed status (ทั้งงานใหม่และนัดถัดไป)
        filtered = filtered.filter(a => a.status === 'confirmed');
    } else if (currentFilter === 'completed') {
        // เสร็จ: completed status (ทั้งงานใหม่และนัดถัดไป)
        filtered = filtered.filter(a => a.status === 'completed');
    } else if (currentFilter === 'reschedule') {
        // นัดถัดไป: from auto_reschedule AND pending only
        filtered = filtered.filter(a => a.source === 'auto_reschedule' && a.status === 'pending');
    }

    filtered.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(a.appointmentDate) - new Date(b.appointmentDate);
    });

    if (filtered.length === 0) {
        appointmentsList.innerHTML = '';
        emptyState.classList.add('show');
    } else {
        emptyState.classList.remove('show');
        appointmentsList.innerHTML = filtered.map(createAppointmentItem).join('');
        attachListeners();
    }
}

function createAppointmentItem(appointment) {
    const { day, month } = formatDate(appointment.appointmentDate);
    const isCompleted = appointment.status === 'completed';

    let nextBadge = '';
    if (isCompleted && appointment.nextAppointment) {
        nextBadge = `<div class="next-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            นัดถัดไป ${formatFullDate(appointment.nextAppointment)}
        </div>`;
    }

    // Status badge
    let statusBadge = '';
    if (appointment.status === 'completed') {
        statusBadge = `<span class="status-badge completed">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            เสร็จ
           </span>`;
    } else if (appointment.status === 'confirmed') {
        statusBadge = `<span class="status-badge confirmed">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            ยืนยันแล้ว
           </span>`;
    } else {
        // Check if it's auto-reschedule or new job
        if (appointment.source === 'auto_reschedule') {
            statusBadge = `<span class="status-badge reschedule">🔄 นัดถัดไป</span>`;
        } else {
            statusBadge = `<span class="status-badge pending">งานใหม่</span>`;
        }
    }

    const serviceClass = appointment.serviceType === 'electrical' ? 'electrical' : 'ac';

    return `
        <div class="appointment-item ${isCompleted ? 'completed' : ''} ${serviceClass}" data-id="${appointment.id}">
            <div class="appointment-date-badge">
                <span class="date-day">${day}</span>
                <span class="date-month">${month}</span>
            </div>
            <div class="appointment-details">
                <div class="appointment-name-row">
                    <span class="appointment-name">${appointment.customerName}</span>
                    ${statusBadge}
                </div>
                <div class="appointment-meta">
                    <a href="tel:${appointment.phone}" class="phone-link" onclick="event.stopPropagation()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        ${appointment.phone}
                    </a>
                    ${appointment.serviceType === 'electrical' ? `
                    <span class="service-electrical">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        ทำไฟ
                    </span>
                    ` : appointment.serviceType === 'other' ? `
                    <span class="service-other">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        อื่นๆ
                    </span>
                    ` : `
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M2 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2V12Z"/>
                            <path d="M6 8h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6V8Z"/>
                        </svg>
                        ${appointment.acCount || 1} เครื่อง
                    </span>
                    `}
                    ${appointment.appointmentTime ? `
                    <span class="time-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${appointment.appointmentTime}
                    </span>
                    ` : ''}
                    ${appointment.location ? `
                    <a href="${appointment.location.mapUrl}" target="_blank" class="location-link" title="ดูแผนที่">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        แผนที่
                    </a>
                    ` : ''}
                </div>
                ${appointment.notes && appointment.notes !== 'จองผ่านหน้าเว็บลูกค้า' ? `
                <div class="appointment-notes">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span>${appointment.notes}</span>
                </div>
                ` : ''}
                ${nextBadge}
            </div>
            <div class="appointment-actions">
                ${appointment.status === 'pending' ? `<button class="action-btn confirm" data-action="confirm" title="โทรยืนยันแล้ว">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                </button>` : ''}
                ${appointment.status === 'confirmed' ? `<button class="action-btn complete" data-action="complete" title="เสร็จสิ้น">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </button>` : ''}
                <button class="action-btn" data-action="edit" title="แก้ไข">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="action-btn delete" data-action="delete" title="ลบ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function attachListeners() {
    document.querySelectorAll('.appointment-item').forEach(item => {
        item.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = item.dataset.id;

                if (action === 'complete') markComplete(id);
                else if (action === 'confirm') markConfirmed(id);
                else if (action === 'edit') {
                    const appointment = appointments.find(a => a.id === id);
                    if (appointment) openModal(appointment);
                }
                else if (action === 'delete') deleteAppointment(id);
            });
        });
    });
}

// ===== Actions =====
function markConfirmed(id) {
    // Show time input dialog
    showTimeInputDialog((selectedTime) => {
        if (!selectedTime) return; // Cancelled

        showLoading();

        appointmentsRef.doc(id).update({
            status: 'confirmed',
            appointmentTime: selectedTime,
            confirmedAt: new Date().toISOString()
        })
            .then(() => {
                showToast(`ยืนยันเวลา ${selectedTime} แล้ว`);
            })
            .catch((error) => {
                console.error('Error confirming:', error);
                showToast('เกิดข้อผิดพลาด');
            })
            .finally(() => hideLoading());
    });
}

function showTimeInputDialog(callback) {
    // Create modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 320px;">
            <div class="modal-header">
                <h2>⏰ ระบุเวลานัด</h2>
                <button class="modal-close" id="timeModalClose">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label>เวลาที่จะไปหาลูกค้า</label>
                    <input type="time" id="appointmentTimeInput" style="font-size: 18px; padding: 12px;">
                </div>
                <div class="time-presets" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                    <button type="button" class="time-preset" data-time="09:00">09:00</button>
                    <button type="button" class="time-preset" data-time="10:00">10:00</button>
                    <button type="button" class="time-preset" data-time="11:00">11:00</button>
                    <button type="button" class="time-preset" data-time="13:00">13:00</button>
                    <button type="button" class="time-preset" data-time="14:00">14:00</button>
                    <button type="button" class="time-preset" data-time="15:00">15:00</button>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-cancel" id="timeCancelBtn">ยกเลิก</button>
                    <button type="button" class="btn-submit" id="timeConfirmBtn">ยืนยัน</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const timeInput = overlay.querySelector('#appointmentTimeInput');
    const closeBtn = overlay.querySelector('#timeModalClose');
    const cancelBtn = overlay.querySelector('#timeCancelBtn');
    const confirmBtn = overlay.querySelector('#timeConfirmBtn');
    const presetBtns = overlay.querySelectorAll('.time-preset');

    // Preset buttons
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeInput.value = btn.dataset.time;
        });
    });

    // Close handlers
    const close = () => {
        overlay.remove();
        callback(null);
    };

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);

    // Confirm handler
    confirmBtn.addEventListener('click', () => {
        const time = timeInput.value;
        if (!time) {
            showToast('กรุณาเลือกเวลา');
            return;
        }
        overlay.remove();
        callback(time);
    });
}

// ===== Actions =====
function markComplete(id) {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) return;

    // Show reschedule confirmation
    showRescheduleConfirm(appointment, (shouldReschedule) => {
        showLoading();

        const updateData = {
            status: 'completed',
            completedAt: new Date().toISOString()
        };

        if (shouldReschedule) {
            // Create next appointment in 6 months
            const nextDate = addSixMonths(appointment.appointmentDate);

            const newAppointment = {
                customerName: appointment.customerName,
                phone: appointment.phone,
                address: appointment.address,
                acCount: appointment.acCount,
                appointmentDate: nextDate,
                status: 'pending',
                notes: 'นัดล้างครั้งถัดไป (อัตโนมัติ)',
                source: 'auto_reschedule',
                previousAppointmentId: id,
                createdAt: new Date().toISOString()
            };

            if (appointment.location) {
                newAppointment.location = appointment.location;
            }

            // Update current and create new
            Promise.all([
                appointmentsRef.doc(id).update(updateData),
                appointmentsRef.add(newAppointment)
            ])
                .then(() => {
                    showToast('เสร็จสิ้น + นัดครั้งถัดไปแล้ว');
                })
                .catch((error) => {
                    console.error('Error:', error);
                    showToast('เกิดข้อผิดพลาด');
                })
                .finally(() => hideLoading());
        } else {
            // Just complete, no reschedule
            appointmentsRef.doc(id).update(updateData)
                .then(() => {
                    showToast('เสร็จสิ้นแล้ว');
                })
                .catch((error) => {
                    console.error('Error marking complete:', error);
                    showToast('เกิดข้อผิดพลาด');
                })
                .finally(() => hideLoading());
        }
    });
}

function showRescheduleConfirm(appointment, callback) {
    const nextDate = addSixMonths(appointment.appointmentDate);
    const formattedDate = formatFullDate(nextDate);

    const modal = document.createElement('div');
    modal.className = 'warning-modal show';
    modal.innerHTML = `
        <div class="warning-content reschedule-modal">
            <div class="warning-icon success-icon-bg">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            </div>
            <h3>เสร็จสิ้นงาน</h3>
            <p>นัดล้างครั้งถัดไปอีก 6 เดือน?</p>
            <p class="reschedule-date">📅 ${formattedDate}</p>
            <div class="warning-actions reschedule-actions">
                <button class="btn-warning-cancel">ไม่นัด</button>
                <button class="btn-warning-confirm">นัดเลย</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.btn-warning-cancel').addEventListener('click', () => {
        modal.remove();
        callback(false);
    });

    modal.querySelector('.btn-warning-confirm').addEventListener('click', () => {
        modal.remove();
        callback(true);
    });
}

function deleteAppointment(id) {
    if (confirm('ต้องการลบนัดหมายนี้?')) {
        showLoading();
        appointmentsRef.doc(id).delete()
            .then(() => showToast('ลบแล้ว'))
            .catch((error) => {
                console.error('Error deleting:', error);
                showToast('เกิดข้อผิดพลาด');
            })
            .finally(() => hideLoading());
    }
}

// ===== Update Stats =====
function updateStats() {
    const pending = appointments.filter(a => a.status === 'pending');
    const completed = appointments.filter(a => a.status === 'completed');
    const uniqueCustomers = new Set(appointments.map(a => a.phone)).size;

    document.getElementById('pendingCount').textContent = pending.length;
    document.getElementById('completedCount').textContent = completed.length;
    document.getElementById('totalCustomers').textContent = uniqueCustomers;

    // Monthly stats
    const now = new Date();
    const thisMonth = appointments.filter(a => {
        const d = new Date(a.appointmentDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlyDone = thisMonth.filter(a => a.status === 'completed').length;

    document.getElementById('monthlyJobs').textContent = thisMonth.length;
    document.getElementById('monthlyDone').textContent = monthlyDone;

    updateCircle('monthlyJobsCircle', thisMonth.length, 20);
    updateCircle('monthlyDoneCircle', monthlyDone, thisMonth.length || 1);
    updateCircle('totalCustomersCircle', uniqueCustomers, 50);

    // Today and week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    const todayJobs = pending.filter(a => {
        const d = new Date(a.appointmentDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    }).length;

    const weekJobs = pending.filter(a => {
        const d = new Date(a.appointmentDate);
        return d >= today && d < weekLater;
    }).length;

    document.getElementById('todayJobs').textContent = todayJobs;
    document.getElementById('weekJobs').textContent = weekJobs;
}

function updateCircle(elementId, value, max) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const percentage = Math.min((value / max) * 100, 100);
    const degrees = (percentage / 100) * 360;

    let color = '#0891b2';
    if (element.classList.contains('success')) color = '#22c55e';
    if (element.classList.contains('accent')) color = '#8b5cf6';

    element.style.background = `conic-gradient(${color} ${degrees}deg, #f5f5f5 ${degrees}deg)`;
}

// ===== Toast =====
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #1f2937;
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: 'Kanit', sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1001;
        transition: transform 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(0)', 10);
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ===== Pricing Management =====
function initPricing() {
    const editPricingBtn = document.getElementById('editPricingBtn');
    const pricingModalOverlay = document.getElementById('pricingModalOverlay');
    const pricingModalClose = document.getElementById('pricingModalClose');
    const pricingCancelBtn = document.getElementById('pricingCancelBtn');
    const pricingForm = document.getElementById('pricingForm');

    if (editPricingBtn) {
        editPricingBtn.addEventListener('click', () => {
            pricingModalOverlay.classList.add('show');
        });
    }

    if (pricingModalClose) {
        pricingModalClose.addEventListener('click', () => {
            pricingModalOverlay.classList.remove('show');
        });
    }

    if (pricingCancelBtn) {
        pricingCancelBtn.addEventListener('click', () => {
            pricingModalOverlay.classList.remove('show');
        });
    }

    if (pricingModalOverlay) {
        pricingModalOverlay.addEventListener('click', (e) => {
            if (e.target === pricingModalOverlay) {
                pricingModalOverlay.classList.remove('show');
            }
        });
    }

    if (pricingForm) {
        pricingForm.addEventListener('submit', savePricing);
    }
}

// Default services
let services = [
    { name: 'ล้างธรรมดา', price: 400, desc: 'ฉีดน้ำยา ล้างฟิลเตอร์' },
    { name: 'ล้างแบบถอด', price: 800, desc: 'ถอดล้าง เช็คแก๊ส เช็คระบบ' }
];

function loadPricing() {
    db.collection('settings').doc('pricing').get()
        .then((doc) => {
            if (doc.exists) {
                const pricing = doc.data();

                // Load services array (new format)
                if (pricing.services && Array.isArray(pricing.services)) {
                    services = pricing.services;
                } else {
                    // Convert old format to new
                    services = [
                        { name: pricing.nameNormal || 'ล้างธรรมดา', price: pricing.normal || 400, desc: pricing.descNormal || '' },
                        { name: pricing.nameDeep || 'ล้างแบบถอด', price: pricing.deep || 800, desc: pricing.descDeep || '' }
                    ];
                }

                // Render services in form and display
                renderServicesForm();
                renderServicesDisplay();

                // Update promo display
                const promoDisplay = document.getElementById('displayPromo');
                if (promoDisplay && pricing.promoLabel && pricing.promoValue) {
                    promoDisplay.textContent = `${pricing.promoLabel} ${pricing.promoValue}`;
                }

                // Pre-fill promo inputs
                const promoLabelInput = document.getElementById('inputPromoLabel');
                const promoValueInput = document.getElementById('inputPromoValue');
                if (promoLabelInput && pricing.promoLabel) promoLabelInput.value = pricing.promoLabel;
                if (promoValueInput && pricing.promoValue) promoValueInput.value = pricing.promoValue;
            } else {
                renderServicesForm();
                renderServicesDisplay();
            }
        })
        .catch((error) => {
            console.log('Using default pricing');
            renderServicesForm();
            renderServicesDisplay();
        });
}

function renderServicesForm() {
    const container = document.getElementById('servicesContainer');
    if (!container) return;

    container.innerHTML = services.map((service, index) => `
        <div class="service-item" data-index="${index}">
            <div class="service-item-header">
                <span class="service-item-title">บริการที่ ${index + 1}</span>
                ${services.length > 1 ? `
                    <button type="button" class="btn-remove-service" onclick="removeService(${index})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                ` : ''}
            </div>
            <div class="form-group">
                <label>ชื่อบริการ</label>
                <input type="text" class="service-name" value="${service.name}" placeholder="ชื่อบริการ">
            </div>
            <div class="form-group">
                <label>ราคา (บาท)</label>
                <input type="number" class="service-price" min="0" value="${service.price}" required>
            </div>
            <div class="form-group">
                <label>คำอธิบาย</label>
                <input type="text" class="service-desc" value="${service.desc || ''}" placeholder="รายละเอียดบริการ">
            </div>
        </div>
    `).join('');
}

function renderServicesDisplay() {
    const container = document.getElementById('pricingSettingsList');
    if (!container) return;

    container.innerHTML = services.map(service => `
        <div class="pricing-row">
            <span class="pricing-label">${service.name}</span>
            <span class="pricing-value">${service.price}</span>
            <span class="pricing-unit">บาท</span>
        </div>
    `).join('');
}

function addService() {
    services.push({ name: '', price: 0, desc: '' });
    renderServicesForm();
}

function removeService(index) {
    if (services.length > 1) {
        services.splice(index, 1);
        renderServicesForm();
    }
}

function savePricing(e) {
    e.preventDefault();
    showLoading();

    // Collect services from form
    const serviceItems = document.querySelectorAll('.service-item');
    const updatedServices = [];

    serviceItems.forEach(item => {
        const name = item.querySelector('.service-name').value;
        const price = parseInt(item.querySelector('.service-price').value) || 0;
        const desc = item.querySelector('.service-desc').value;

        if (name.trim()) {
            updatedServices.push({ name, price, desc });
        }
    });

    services = updatedServices;

    const pricing = {
        services: services,
        promoLabel: document.getElementById('inputPromoLabel').value,
        promoValue: document.getElementById('inputPromoValue').value,
        updatedAt: new Date().toISOString()
    };

    db.collection('settings').doc('pricing').set(pricing)
        .then(() => {
            hideLoading();
            document.getElementById('pricingModalOverlay').classList.remove('show');
            renderServicesDisplay();
            document.getElementById('displayPromo').textContent = `${pricing.promoLabel} ${pricing.promoValue}`;
            showToast('บันทึกราคาเรียบร้อย');
        })
        .catch((error) => {
            console.error('Error saving pricing:', error);
            hideLoading();
            showToast('เกิดข้อผิดพลาด');
        });
}

// Add service button event
document.addEventListener('DOMContentLoaded', () => {
    const addServiceBtn = document.getElementById('addServiceBtn');
    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', addService);
    }

    // Notification modal events
    const editNotificationBtn = document.getElementById('editNotificationBtn');
    const notificationModalOverlay = document.getElementById('notificationModalOverlay');
    const notificationModalClose = document.getElementById('notificationModalClose');
    const notificationCancelBtn = document.getElementById('notificationCancelBtn');
    const notificationForm = document.getElementById('notificationForm');

    if (editNotificationBtn) {
        editNotificationBtn.addEventListener('click', () => {
            notificationModalOverlay.classList.add('show');
        });
    }

    if (notificationModalClose) {
        notificationModalClose.addEventListener('click', () => {
            notificationModalOverlay.classList.remove('show');
        });
    }

    if (notificationCancelBtn) {
        notificationCancelBtn.addEventListener('click', () => {
            notificationModalOverlay.classList.remove('show');
        });
    }

    if (notificationForm) {
        notificationForm.addEventListener('submit', saveNotificationSettings);
    }

    // Load notification settings
    loadNotificationSettings();
});

// ===== Notification Settings =====
function loadNotificationSettings() {
    db.collection('settings').doc('notifications').get()
        .then((doc) => {
            if (doc.exists) {
                const settings = doc.data();
                const input = document.getElementById('inputNotificationEmails');
                const display = document.getElementById('notificationEmailsDisplay');

                if (input && settings.emails) {
                    input.value = settings.emails;
                }

                if (display && settings.emails) {
                    const emails = settings.emails.split(',').map(e => e.trim());
                    display.innerHTML = emails.map(email =>
                        `<span class="email-tag">${email}</span>`
                    ).join('');
                }
            }
        })
        .catch((error) => {
            console.log('Using default notification settings');
        });
}

function saveNotificationSettings(e) {
    e.preventDefault();
    showLoading();

    const emails = document.getElementById('inputNotificationEmails').value;

    db.collection('settings').doc('notifications').set({
        emails: emails,
        updatedAt: new Date().toISOString()
    })
        .then(() => {
            hideLoading();
            document.getElementById('notificationModalOverlay').classList.remove('show');

            // Update display
            const display = document.getElementById('notificationEmailsDisplay');
            const emailList = emails.split(',').map(e => e.trim());
            display.innerHTML = emailList.map(email =>
                `<span class="email-tag">${email}</span>`
            ).join('');

            showToast('บันทึกการตั้งค่าเรียบร้อย');
        })
        .catch((error) => {
            console.error('Error saving notification settings:', error);
            hideLoading();
            showToast('เกิดข้อผิดพลาด');
        });
}

console.log('%c🔥 PP. Air & Electric + Firebase', 'font-size: 16px; font-weight: bold; color: #0891b2;');

