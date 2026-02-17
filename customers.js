// ===== PP. Air & Electric - Customers Page =====

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

// DOM Elements
const customersList = document.getElementById('customersList');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const customerCount = document.getElementById('customerCount');
const loadingOverlay = document.getElementById('loadingOverlay');

// Data
let customers = [];

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadCustomers();
    initSearch();
});

function showLoading() {
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// ===== Load Customers =====
function loadCustomers() {
    showLoading();

    appointmentsRef.get()
        .then((snapshot) => {
            const customerMap = new Map();

            snapshot.forEach((doc) => {
                const data = doc.data();
                const phone = data.phone;

                // Use phone as unique key, keep most recent data
                if (!customerMap.has(phone) ||
                    new Date(data.createdAt) > new Date(customerMap.get(phone).createdAt)) {
                    customerMap.set(phone, {
                        id: doc.id,
                        name: data.customerName,
                        phone: data.phone,
                        address: data.address,
                        location: data.location || null,
                        createdAt: data.createdAt
                    });
                }
            });

            customers = Array.from(customerMap.values());
            customers.sort((a, b) => a.name.localeCompare(b.name, 'th'));

            hideLoading();
            renderCustomers();
        })
        .catch((error) => {
            console.error('Error loading customers:', error);
            hideLoading();
        });
}

// ===== Search =====
function initSearch() {
    searchInput.addEventListener('input', () => {
        renderCustomers();
    });
}

// ===== Render Customers =====
function renderCustomers() {
    const searchTerm = searchInput.value.toLowerCase().trim();

    let filtered = customers;
    if (searchTerm) {
        filtered = customers.filter(c =>
            c.name.toLowerCase().includes(searchTerm) ||
            c.phone.includes(searchTerm)
        );
    }

    customerCount.textContent = `${filtered.length} คน`;

    if (filtered.length === 0) {
        customersList.innerHTML = '';
        emptyState.classList.add('show');
    } else {
        emptyState.classList.remove('show');
        customersList.innerHTML = filtered.map(createCustomerCard).join('');
    }
}

function createCustomerCard(customer) {
    const initial = customer.name.charAt(0).toUpperCase();
    const mapLink = customer.location
        ? `<a href="${customer.location.mapUrl}" target="_blank" class="customer-map-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            ดูแผนที่
           </a>`
        : '';

    return `
        <div class="customer-card">
            <div class="customer-avatar">${initial}</div>
            <div class="customer-info">
                <h3 class="customer-name">${customer.name}</h3>
                <div class="customer-details-row">
                    <a href="tel:${customer.phone}" class="customer-phone">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        ${customer.phone}
                    </a>
                    ${mapLink}
                </div>
                <p class="customer-address">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    ${customer.address}
                </p>
            </div>
        </div>
    `;
}

console.log('%c👥 PP. Air & Electric Customers Page', 'font-size: 14px; font-weight: bold; color: #0891b2;');
