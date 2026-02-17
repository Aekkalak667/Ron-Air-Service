// ===== PP. Air & Electric - Customer Page with Booking =====

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

// ===== Visitor Logging =====
async function logVisitor() {
    try {
        // Get IP and location info from free HTTPS API
        const response = await fetch('https://ipwho.is/');
        const data = await response.json();

        if (!data.success) {
            console.log('Could not get IP info');
            return;
        }

        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        // Log to Firebase with location info
        await db.collection('visitors').add({
            ip: data.ip,
            isp: data.connection?.isp || '',
            city: data.city,
            region: data.region,
            country: data.country,
            date: today,
            timestamp: new Date().toISOString(),
            page: 'customer'
        });

        console.log('📊 Visitor logged:', data.ip, data.connection?.isp);
    } catch (error) {
        console.log('Could not log visitor:', error);
    }
}

// Log visitor on page load
logVisitor();

// ===== Date Functions =====
const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function formatFullDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
}

function formatShortDate(dateString) {
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
}

// ===== DOM Elements =====
const phoneSearch = document.getElementById('phoneSearch');
const searchBtn = document.getElementById('searchBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultsSection = document.getElementById('resultsSection');
const initialState = document.getElementById('initialState');
const noResults = document.getElementById('noResults');
const appointmentsList = document.getElementById('appointmentsList');
const bookingForm = document.getElementById('bookingForm');
const successModal = document.getElementById('successModal');
const closeSuccessModal = document.getElementById('closeSuccessModal');

// Tab elements
const customerTabs = document.querySelectorAll('.customer-tab');
const tabContents = document.querySelectorAll('.tab-content');

// ===== Loading =====
function showLoading() {
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initCustomerType();
    initLookup();
    initBookingForm();
    initSearchForm();
    initLocation();
    setMinDate();
    loadPricing();
});

// ===== Tabs =====
function initTabs() {
    customerTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;

            // Update active tab
            customerTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId + 'Tab').classList.add('active');
        });
    });
}

// ===== Customer Type Toggle =====
let customerType = 'new';

function initCustomerType() {
    const typeBtns = document.querySelectorAll('.type-btn');
    const existingLookup = document.getElementById('existingLookup');
    const bookingForm = document.getElementById('bookingForm');

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            customerType = btn.dataset.type;

            if (customerType === 'existing') {
                existingLookup.style.display = 'block';
                bookingForm.style.display = 'none';
            } else {
                existingLookup.style.display = 'none';
                bookingForm.style.display = 'block';
                // Clear form
                bookingForm.reset();
                setMinDate();
            }
        });
    });
}

// ===== Existing Customer Lookup =====
function initLookup() {
    const lookupBtn = document.getElementById('lookupBtn');
    const lookupPhone = document.getElementById('lookupPhone');

    if (lookupBtn) {
        lookupBtn.addEventListener('click', lookupCustomer);
    }

    if (lookupPhone) {
        lookupPhone.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') lookupCustomer();
        });

        lookupPhone.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.slice(0, 10);
            e.target.value = value;
        });
    }
}

function lookupCustomer() {
    const phone = document.getElementById('lookupPhone').value.trim();
    const lookupStatus = document.getElementById('lookupStatus');

    if (!phone || phone.length < 9) {
        lookupStatus.innerHTML = '<span class="lookup-error">กรุณากรอกเบอร์โทรศัพท์</span>';
        return;
    }

    lookupStatus.innerHTML = '<span class="lookup-loading">กำลังค้นหา...</span>';

    appointmentsRef.where('phone', '==', phone).limit(1).get()
        .then((snapshot) => {
            if (snapshot.empty) {
                lookupStatus.innerHTML = '<span class="lookup-error">ไม่พบข้อมูล - กรุณาลงทะเบียนใหม่</span>';
            } else {
                const customer = snapshot.docs[0].data();
                fillCustomerData(customer);
                lookupStatus.innerHTML = `<span class="lookup-success">พบข้อมูล: ${customer.customerName}</span>`;
            }
        })
        .catch((error) => {
            console.error('Lookup error:', error);
            lookupStatus.innerHTML = '<span class="lookup-error">เกิดข้อผิดพลาด</span>';
        });
}

function fillCustomerData(customer) {
    document.getElementById('bookingName').value = customer.customerName || '';
    document.getElementById('bookingPhone').value = customer.phone || '';
    document.getElementById('bookingAddress').value = customer.address || '';

    // Show the form
    document.getElementById('bookingForm').style.display = 'block';

    // If has location, set it
    if (customer.location) {
        document.getElementById('locationCoords').value = `${customer.location.lat},${customer.location.lng}`;
        document.getElementById('locationStatus').innerHTML = `
            <a href="${customer.location.mapUrl}" target="_blank" class="map-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                ที่อยู่เดิม
            </a>
        `;
        const btn = document.getElementById('getLocationBtn');
        btn.classList.add('success');
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            ใช้ที่อยู่เดิม
        `;
    }

    showToast('ดึงข้อมูลเรียบร้อย กรุณาเลือกวันที่');
}

// ===== Load Pricing from Firebase =====
function loadPricing() {
    db.collection('settings').doc('pricing').get()
        .then((doc) => {
            if (doc.exists) {
                const pricing = doc.data();
                if (pricing.normal) {
                    document.getElementById('priceNormal').textContent = `${pricing.normal} บาท/เครื่อง`;
                }
                if (pricing.deep) {
                    document.getElementById('priceDeep').textContent = `${pricing.deep} บาท/เครื่อง`;
                }
                if (pricing.promoLabel) {
                    document.getElementById('promoLabel').textContent = pricing.promoLabel;
                }
                if (pricing.promoValue) {
                    document.getElementById('promoValue').textContent = pricing.promoValue;
                }
            }
        })
        .catch((error) => {
            console.log('Using default pricing');
        });
}

// ===== Booking Form =====
function initBookingForm() {
    bookingForm.addEventListener('submit', handleBooking);
    closeSuccessModal.addEventListener('click', () => {
        successModal.classList.remove('show');
    });

    // Format phone input
    document.getElementById('bookingPhone').addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 10) value = value.slice(0, 10);
        e.target.value = value;
    });
}

// ===== Location =====
let currentLocation = null;

function initLocation() {
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');

    if (getLocationBtn) {
        getLocationBtn.addEventListener('click', getLocation);
    }
}

function getLocation() {
    const locationStatus = document.getElementById('locationStatus');
    const getLocationBtn = document.getElementById('getLocationBtn');

    if (!navigator.geolocation) {
        locationStatus.innerHTML = '<span class="location-error">เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง</span>';
        return;
    }

    // Show loading
    getLocationBtn.disabled = true;
    getLocationBtn.innerHTML = `
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        กำลังค้นหาตำแหน่ง...
    `;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            currentLocation = { lat, lng };

            // Store in hidden field
            document.getElementById('locationCoords').value = `${lat},${lng}`;

            // Update button to show success
            getLocationBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                ปักหมุดแล้ว
            `;
            getLocationBtn.classList.add('success');
            getLocationBtn.disabled = false;

            // Show map link
            locationStatus.innerHTML = `
                <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="map-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    ดูแผนที่
                </a>
            `;

            showToast('ปักหมุดตำแหน่งสำเร็จ');
        },
        (error) => {
            getLocationBtn.disabled = false;
            getLocationBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                ปักหมุดตำแหน่งปัจจุบัน
            `;

            let errorMsg = 'ไม่สามารถระบุตำแหน่งได้';
            if (error.code === 1) {
                errorMsg = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง';
            } else if (error.code === 2) {
                errorMsg = 'ไม่พบตำแหน่ง กรุณาลองใหม่';
            }
            locationStatus.innerHTML = `<span class="location-error">${errorMsg}</span>`;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function setMinDate() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('bookingDate').min = minDate;
    document.getElementById('bookingDate').value = minDate;
}

function handleBooking(e) {
    e.preventDefault();
    showLoading();

    const name = document.getElementById('bookingName').value.trim();
    const phone = document.getElementById('bookingPhone').value.trim();
    const address = document.getElementById('bookingAddress').value.trim();
    const date = document.getElementById('bookingDate').value;
    const acCount = parseInt(document.getElementById('bookingAcCount').value);
    const notes = document.getElementById('bookingNotes').value.trim();

    if (phone.length < 9) {
        hideLoading();
        showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
        return;
    }

    const locationCoords = document.getElementById('locationCoords').value;

    const appointmentData = {
        customerName: name,
        phone: phone,
        address: address,
        appointmentDate: date,
        acCount: acCount,
        notes: notes || 'จองผ่านหน้าเว็บลูกค้า',
        status: 'pending',
        source: 'customer_booking',
        createdAt: new Date().toISOString()
    };

    // Add location if available
    if (locationCoords) {
        const [lat, lng] = locationCoords.split(',');
        appointmentData.location = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            mapUrl: `https://www.google.com/maps?q=${lat},${lng}`
        };
    }

    // First check daily limit (max 4 AC units per day) - sum all acCount
    appointmentsRef.where('appointmentDate', '==', date).get()
        .then((dailySnapshot) => {
            // Sum up total AC units for the day
            let totalUnits = 0;
            dailySnapshot.forEach(doc => {
                totalUnits += doc.data().acCount || 1;
            });

            // Check if adding new units would exceed limit
            if (totalUnits + acCount > 4) {
                hideLoading();
                showFullDayWarning(date, totalUnits, acCount);
                return Promise.reject('day_full');
            }

            // Check for existing pending appointments for this customer
            return appointmentsRef.where('phone', '==', phone).where('status', '==', 'pending').get();
        })
        .then((snapshot) => {
            if (!snapshot) return; // Already rejected

            if (!snapshot.empty) {
                hideLoading();
                // Found existing pending appointment
                const existingApt = snapshot.docs[0].data();
                const existingDate = formatThaiDate(existingApt.appointmentDate);

                showDuplicateWarning(existingDate, () => {
                    // User confirmed, proceed with booking
                    showLoading();
                    saveAppointment(appointmentData);
                });
            } else {
                // No existing appointment, proceed
                saveAppointment(appointmentData);
            }
        })
        .catch((error) => {
            if (error === 'day_full') return; // Already handled
            console.error('Error checking:', error);
            // Proceed anyway if check fails
            saveAppointment(appointmentData);
        });
}

function saveAppointment(appointmentData) {
    appointmentsRef.add(appointmentData)
        .then(() => {
            hideLoading();
            bookingForm.reset();
            setMinDate();
            resetLocation();
            showSuccessModal();

            // Send email notification
            sendNotificationEmail(appointmentData);
        })
        .catch((error) => {
            console.error('Error booking:', error);
            hideLoading();
            showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
        });
}

// ===== EmailJS Notification =====
const EMAILJS_SERVICE_ID = 'service_sxf5pi8';
const EMAILJS_TEMPLATE_ID = 'template_8kj26lm';
const EMAILJS_PUBLIC_KEY = '6o1zxlktO09yhee8s';

function sendNotificationEmail(data) {
    // Load notification settings from Firebase
    db.collection('settings').doc('notifications').get()
        .then((doc) => {
            let recipientEmails = 'luxyamaha66@gmail.com'; // Default

            if (doc.exists && doc.data().emails) {
                recipientEmails = doc.data().emails;
            }

            // Split emails and send to each one
            const emailList = recipientEmails.split(',').map(e => e.trim()).filter(e => e);

            emailList.forEach(email => {
                const templateParams = {
                    to_email: email,
                    customer_name: data.customerName || data.name || '-',
                    phone: data.phone,
                    date: data.appointmentDate || data.date || '-',
                    time: data.time || 'ไม่ระบุ',
                    address: data.address,
                    service: data.serviceType || 'ล้างแอร์',
                    quantity: data.acCount || data.units || 1,
                    notes: data.notes || '-'
                };

                emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY)
                    .then(() => {
                        console.log(`📧 Email sent to: ${email}`);
                    })
                    .catch((error) => {
                        console.error(`Email failed for ${email}:`, error);
                    });
            });
        })
        .catch((error) => {
            console.log('Using default notification email');
        });
}

function formatThaiDate(dateString) {
    const date = new Date(dateString);
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function showDuplicateWarning(existingDate, onConfirm) {
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.className = 'warning-modal show';
    warningModal.innerHTML = `
        <div class="warning-content">
            <div class="warning-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <h3>มีนัดหมายอยู่แล้ว</h3>
            <p>คุณมีนัดหมายรอดำเนินการอยู่แล้ว<br>วันที่ <strong>${existingDate}</strong></p>
            <p class="warning-hint">ต้องการจองเพิ่มเติมหรือไม่?</p>
            <div class="warning-actions">
                <button class="btn-warning-cancel">ยกเลิก</button>
                <button class="btn-warning-confirm">จองต่อ</button>
            </div>
        </div>
    `;

    document.body.appendChild(warningModal);

    warningModal.querySelector('.btn-warning-cancel').addEventListener('click', () => {
        warningModal.remove();
    });

    warningModal.querySelector('.btn-warning-confirm').addEventListener('click', () => {
        warningModal.remove();
        onConfirm();
    });
}

function showFullDayWarning(date, currentUnits, requestedUnits) {
    const formattedDate = formatThaiDate(date);
    const remaining = 4 - currentUnits;

    let message = '';
    if (remaining <= 0) {
        message = `มีจองครบ 4 เครื่องแล้ว`;
    } else {
        message = `มีจองแล้ว ${currentUnits} เครื่อง (เหลือ ${remaining})<br>คุณเลือก ${requestedUnits} เครื่อง`;
    }

    const warningModal = document.createElement('div');
    warningModal.className = 'warning-modal show';
    warningModal.innerHTML = `
        <div class="warning-content">
            <div class="warning-icon full-day">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="9" y1="16" x2="15" y2="16"/>
                </svg>
            </div>
            <h3>วันนี้จองไม่ได้</h3>
            <p>วันที่ <strong>${formattedDate}</strong><br>${message}</p>
            <p class="warning-hint">กรุณาเลือกวันอื่นหรือลดจำนวนเครื่อง</p>
            <div class="warning-actions">
                <button class="btn-warning-confirm single">เข้าใจแล้ว</button>
            </div>
        </div>
    `;

    document.body.appendChild(warningModal);

    warningModal.querySelector('.btn-warning-confirm').addEventListener('click', () => {
        warningModal.remove();
    });
}

function showSuccessModal() {
    successModal.classList.add('show');
}

function resetLocation() {
    currentLocation = null;
    document.getElementById('locationCoords').value = '';
    document.getElementById('locationStatus').innerHTML = '';
    const btn = document.getElementById('getLocationBtn');
    btn.classList.remove('success');
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
        </svg>
        ปักหมุดตำแหน่งปัจจุบัน
    `;
}

// ===== Search Form =====
function initSearchForm() {
    searchBtn.addEventListener('click', searchAppointments);
    phoneSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchAppointments();
    });

    // Format phone input
    phoneSearch.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 10) value = value.slice(0, 10);
        e.target.value = value;
    });
}

// ===== Search =====
function searchAppointments() {
    const phone = phoneSearch.value.trim();

    if (!phone || phone.length < 9) {
        showToast('กรุณากรอกเบอร์โทรศัพท์');
        return;
    }

    showLoading();
    hideAllStates();

    appointmentsRef.where('phone', '==', phone).get()
        .then((snapshot) => {
            if (snapshot.empty) {
                showNoResults();
            } else {
                const appointments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                displayResults(appointments);
            }
        })
        .catch((error) => {
            console.error('Error searching:', error);
            showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
        })
        .finally(() => hideLoading());
}

// ===== Display Functions =====
function hideAllStates() {
    resultsSection.style.display = 'none';
    initialState.style.display = 'none';
    noResults.style.display = 'none';
}

function showNoResults() {
    noResults.style.display = 'flex';
}

function displayResults(appointments) {
    // Sort by date (newest first)
    appointments.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

    // Get customer info from first appointment
    const customer = appointments[0];
    document.getElementById('customerName').textContent = customer.customerName;
    document.getElementById('customerPhone').textContent = formatPhone(customer.phone);
    document.getElementById('totalAppointments').textContent = appointments.length;

    // Render appointments
    appointmentsList.innerHTML = appointments.map(createAppointmentCard).join('');

    resultsSection.style.display = 'block';
}

function formatPhone(phone) {
    if (phone.length === 10) {
        return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
}

function createAppointmentCard(apt) {
    const isCompleted = apt.status === 'completed';
    const isPast = new Date(apt.appointmentDate) < new Date();

    let statusClass = 'pending';
    let statusText = 'รอดำเนินการ';
    let statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
    </svg>`;

    if (isCompleted) {
        statusClass = 'completed';
        statusText = 'เสร็จสิ้น';
        statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
        </svg>`;
    } else if (isPast) {
        statusClass = 'overdue';
        statusText = 'เลยกำหนด';
        statusIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>`;
    }

    return `
        <div class="customer-apt-card ${statusClass}">
            <div class="apt-date-section">
                <div class="apt-date-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                </div>
                <div class="apt-date-text">
                    <span class="apt-date">${formatFullDate(apt.appointmentDate)}</span>
                </div>
            </div>
            <div class="apt-info-section">
                <div class="apt-info-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2V12Z"/>
                        <path d="M6 8h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6V8Z"/>
                    </svg>
                    <span>${apt.acCount} เครื่อง</span>
                </div>
                ${apt.appointmentTime ? `
                <div class="apt-info-row time-display">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>เวลา ${apt.appointmentTime} น.</span>
                </div>
                ` : ''}
                ${apt.address ? `
                <div class="apt-info-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span class="apt-address">${apt.address}</span>
                </div>
                ` : ''}
            </div>
            <div class="apt-status ${statusClass}">
                ${statusIcon}
                <span>${statusText}</span>
            </div>
        </div>
    `;
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

console.log('%c👤 PP. Air & Electric Customer Page', 'font-size: 14px; font-weight: bold; color: #0891b2;');

// ===== Load Pricing =====
function loadPricing() {
    db.collection('settings').doc('pricing').get()
        .then((doc) => {
            if (doc.exists) {
                const pricing = doc.data();
                const pricingList = document.getElementById('pricingList');

                // Check for new array format
                if (pricing.services && Array.isArray(pricing.services)) {
                    // Render dynamic services
                    if (pricingList) {
                        let html = pricing.services.map(service => `
                            <div class="pricing-item">
                                <div class="pricing-item-header">
                                    <span class="pricing-label">${service.name}</span>
                                    <span class="pricing-value">${service.price} บาท/เครื่อง</span>
                                </div>
                                ${service.desc ? `<p class="pricing-desc">${service.desc}</p>` : ''}
                            </div>
                        `).join('');

                        // Add promo
                        if (pricing.promoLabel && pricing.promoValue) {
                            html += `
                                <div class="pricing-item highlight">
                                    <span class="pricing-label">${pricing.promoLabel}</span>
                                    <span class="pricing-value">${pricing.promoValue}</span>
                                </div>
                            `;
                        }

                        pricingList.innerHTML = html;
                    }
                } else {
                    // Old format fallback
                    const nameNormal = document.getElementById('nameNormal');
                    const nameDeep = document.getElementById('nameDeep');
                    if (nameNormal && pricing.nameNormal) nameNormal.textContent = pricing.nameNormal;
                    if (nameDeep && pricing.nameDeep) nameDeep.textContent = pricing.nameDeep;

                    const priceNormal = document.getElementById('priceNormal');
                    const priceDeep = document.getElementById('priceDeep');
                    if (priceNormal && pricing.normal) priceNormal.textContent = `${pricing.normal} บาท/เครื่อง`;
                    if (priceDeep && pricing.deep) priceDeep.textContent = `${pricing.deep} บาท/เครื่อง`;

                    const descNormal = document.getElementById('descNormal');
                    const descDeep = document.getElementById('descDeep');
                    if (descNormal && pricing.descNormal) descNormal.textContent = pricing.descNormal;
                    if (descDeep && pricing.descDeep) descDeep.textContent = pricing.descDeep;

                    const promoLabel = document.getElementById('promoLabel');
                    const promoValue = document.getElementById('promoValue');
                    if (promoLabel && pricing.promoLabel) promoLabel.textContent = pricing.promoLabel;
                    if (promoValue && pricing.promoValue) promoValue.textContent = pricing.promoValue;
                }
            }
        })
        .catch((error) => {
            console.log('Using default pricing');
        });
}
