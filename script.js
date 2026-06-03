import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDccQmni5a0ADbf_kZHY39WjJVznoxbdlk",
    authDomain: "smart-library-system-b58b5.firebaseapp.com",
    databaseURL: "https://smart-library-system-b58b5-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-library-system-b58b5",
    storageBucket: "smart-library-system-b58b5.firebasestorage.app",
    messagingSenderId: "902943069114",
    appId: "1:902943069114:web:b219210299fd2456530383"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Keep track of active room in detail view
let activeDetailRoomId = null;

// Track previous occupied seats to detect seat availability transitions
let previousOccupiedSeats = {};

// Track ambient light status of all rooms
let roomsAmbient = {
    'collaboration-area': 'BRIGHT',
    'book-shelves': 'BRIGHT',
    'meeting-booth': 'BRIGHT',
    'digital-media': 'BRIGHT',
    'computer-section': 'BRIGHT',
    'silent-reading': 'BRIGHT',
    'group-work': 'BRIGHT'
};

function getOccupancyColorSVG(percentage) {
    if (percentage >= 0 && percentage <= 49) return "rgba(129, 199, 132, 0.5)";
    if (percentage >= 50 && percentage <= 80) return "rgba(255, 241, 118, 0.5)";
    if (percentage >= 81 && percentage <= 100) return "rgba(229, 115, 115, 0.5)";
    return "rgba(0, 0, 0, 0.1)";
}

function updateSVGRoomColor(roomId, percentage) {
    const roomElement = document.getElementById(roomId);
    if (roomElement) {
        roomElement.style.fill = getOccupancyColorSVG(percentage);
    }
}

function updateRoomDetailUI(room) {
    const percentage = Math.round((room.occupiedSeats / room.totalSeats) * 100);
    const stateInfo = getOccupancyState(percentage);

    const titleEl = document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = room.title;

    const percentageEl = document.getElementById('detail-percentage');
    if (percentageEl) percentageEl.textContent = percentage + '%';

    const occupiedEl = document.getElementById('detail-occupied');
    if (occupiedEl) occupiedEl.textContent = room.occupiedSeats;

    const totalEl = document.getElementById('detail-total');
    if (totalEl) totalEl.textContent = room.totalSeats;
    
    const detailRing = document.getElementById('detail-ring');
    if (detailRing) {
        detailRing.style.setProperty('--status-color', stateInfo.colorVar);
        detailRing.style.setProperty('--percentage', percentage + '%');
    }

    const amenitiesContainer = document.getElementById('detail-amenities');
    if (amenitiesContainer) {
        amenitiesContainer.innerHTML = room.amenities.map(amenity => {
            const iconData = iconMap[amenity];
            return `<i class="${iconData.class} amenity" title="${iconData.title}"></i>`;
        }).join('');
    }

    // Update Room Ambient Status Badge
    const ambientStatus = roomsAmbient[room.id] || 'BRIGHT';
    const isDark = ambientStatus === 'DARK';
    const detailBadge = document.getElementById('detail-ambient-badge');
    const detailText = document.getElementById('detail-ambient-text');
    if (detailBadge && detailText) {
        detailText.textContent = isDark ? 'Dark' : 'Bright';
        detailBadge.className = isDark ? 'room-card-ambient dark' : 'room-card-ambient bright';
        const icon = detailBadge.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        }
    }
}

function initLiveFloorPlan() {
    const occupancyRef = ref(db, 'library/rooms');
    onValue(occupancyRef, (snapshot) => {
        let data = snapshot.val();
        if (!data) {
            // Auto-populate the database with standard room data on first run
            const initialData = {};
            roomsData.forEach(room => {
                const percentage = Math.round((room.occupiedSeats / room.totalSeats) * 100);
                initialData[room.id] = percentage;
            });
            set(occupancyRef, initialData);
            data = initialData;
        }
        
        for (const [roomId, percentage] of Object.entries(data)) {
            updateSVGRoomColor(roomId, percentage);
            
            // Sync Firebase database updates back to our in-memory roomsData structure
            const room = roomsData.find(r => r.id === roomId);
            if (room) {
                const prevOccupied = previousOccupiedSeats[roomId];
                const newOccupied = Math.round((percentage / 100) * room.totalSeats);
                
                // Check if a seat opened up
                if (prevOccupied !== undefined && newOccupied < prevOccupied) {
                    if (localStorage.getItem('library_waitlisted') === 'true') {
                        const diff = prevOccupied - newOccupied;
                        const seatText = diff === 1 ? '1 empty seat' : `${diff} empty seats`;
                        const msg = ` ${seatText} in ${room.title}`;
                        
                        // Show website toast overlay
                        showToast(msg, 'success');
                        
                        // Show native desktop notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification("Seat Available!", {
                                body: msg,
                                icon: 'favicon.ico'
                            });
                        }
                        
                        // Reset waitlist state now that user is notified
                        localStorage.removeItem('library_waitlisted');
                    }
                }
                
                room.occupiedSeats = newOccupied;
                previousOccupiedSeats[roomId] = newOccupied;
            }
        }
        
        // Dynamically update detail stats if currently active
        if (activeDetailRoomId) {
            const activeRoom = roomsData.find(r => r.id === activeDetailRoomId);
            if (activeRoom) {
                updateRoomDetailUI(activeRoom);
            }
        }
        
        // Update dashboard lists and overall summaries
        updateOverallStats();
        const sortSelect = document.getElementById('sort-select');
        sortData(sortSelect ? sortSelect.value : 'most-empty');
    });
}

// Dummy data for the 8 rooms
// Dummy data for the 9 rooms
// Dummy data for the 7 rooms
const roomsData = [
    {
        id: 'collaboration-area',
        title: 'Collaboration Area',
        totalSeats: 60,
        occupiedSeats: 15, // 25% (Green)
        amenities: ['wifi', 'coffee']
    },
    {
        id: 'book-shelves',
        title: 'Book Collection Shelves',
        totalSeats: 30,
        occupiedSeats: 12, // 40% (Green)
        amenities: ['wifi', 'quiet']
    },
    {
        id: 'meeting-booth',
        title: 'Meeting Booth',
        totalSeats: 20,
        occupiedSeats: 15, // 75% (Yellow)
        amenities: ['wifi', 'power', 'quiet']
    },
    {
        id: 'digital-media',
        title: 'Digital Media Section',
        totalSeats: 40,
        occupiedSeats: 18, // 45% (Green)
        amenities: ['wifi', 'power', 'desktop']
    },
    {
        id: 'computer-section',
        title: 'Computer Section',
        totalSeats: 80,
        occupiedSeats: 50, // 62.5% (Yellow)
        amenities: ['wifi', 'power', 'desktop']
    },
    {
        id: 'silent-reading',
        title: 'Silent zone/Study area',
        totalSeats: 100,
        occupiedSeats: 95, // 95% (Red)
        amenities: ['wifi', 'quiet']
    },
    {
        id: 'group-work',
        title: 'Group Area Work',
        totalSeats: 40,
        occupiedSeats: 35, // 87.5% (Red)
        amenities: ['wifi', 'power']
    }
];

// Map amenity strings to FontAwesome icons and tooltip titles
const iconMap = {
    'wifi': { class: 'fa-solid fa-wifi', title: 'High-Speed Wi-Fi' },
    'power': { class: 'fa-solid fa-plug', title: 'Power Outlets' },
    'quiet': { class: 'fa-solid fa-volume-xmark', title: 'Quiet Zone' },
    'coffee': { class: 'fa-solid fa-mug-hot', title: 'Cafe Nearby' },
    'desktop': { class: 'fa-solid fa-desktop', title: 'Desktop Computers' }
};

let currentChart = null;

// Function to determine traffic light state
function getOccupancyState(percentage) {
    if (percentage < 50) return { state: 'green', colorVar: 'var(--state-green)', text: 'Highly Available' };
    if (percentage <= 80) return { state: 'yellow', colorVar: 'var(--state-yellow)', text: 'Filling Up' };
    return { state: 'red', colorVar: 'var(--state-red)', text: 'Overcrowded/Full' };
}

// Update Overall Library Stats
function updateOverallStats() {
    let totalCapacity = 0;
    let totalOccupied = 0;

    roomsData.forEach(room => {
        totalCapacity += room.totalSeats;
        totalOccupied += room.occupiedSeats;
    });

    const percentage = Math.round((totalOccupied / totalCapacity) * 100);
    const stateInfo = getOccupancyState(percentage);

    document.getElementById('overall-occupied').textContent = totalOccupied;
    document.getElementById('overall-total').textContent = totalCapacity;
    document.getElementById('overall-percentage').textContent = percentage + '%';
    document.getElementById('overall-status-text').textContent = stateInfo.text;
    
    // Update Overall Ring
    const ring = document.getElementById('overall-ring');
    ring.style.setProperty('--status-color', stateInfo.colorVar);
    ring.style.setProperty('--percentage', percentage + '%');
    
    // Update Waitlist Button State
    const waitlistBtn = document.getElementById('join-waitlist-btn');
    if (waitlistBtn) {
        const isWaitlisted = localStorage.getItem('library_waitlisted') === 'true';
        if (isWaitlisted) {
            waitlistBtn.innerHTML = '<i class="fa-solid fa-check"></i> On Waitlist';
            waitlistBtn.classList.add('waitlisted');
            waitlistBtn.disabled = false;
        } else {
            waitlistBtn.classList.remove('waitlisted');
            if (totalOccupied >= totalCapacity) {
                waitlistBtn.disabled = false;
                waitlistBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Join Waitlist';
            } else {
                waitlistBtn.disabled = true;
                waitlistBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Join Waitlist';
            }
        }
    }
}

// Function to render a single card
function createRoomCard(room) {
    const percentage = Math.round((room.occupiedSeats / room.totalSeats) * 100);
    const stateInfo = getOccupancyState(percentage);
    
    // Generate amenities HTML
    const amenitiesHTML = room.amenities.map(amenity => {
        const iconData = iconMap[amenity];
        return `<i class="${iconData.class} amenity" title="${iconData.title}"></i>`;
    }).join('');

    const ambientStatus = roomsAmbient[room.id] || 'BRIGHT';
    const isDark = ambientStatus === 'DARK';
    const ambientIcon = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    const ambientText = isDark ? 'Dark' : 'Bright';

    const card = document.createElement('div');
    card.className = 'room-card';
    card.style.setProperty('--status-color', stateInfo.colorVar);
    
    card.innerHTML = `
        <div class="room-card-ambient ${isDark ? 'dark' : 'bright'}">
            <i class="${ambientIcon}"></i> Ambient: ${ambientText}
        </div>
        <div class="card-header" style="margin-top: 1rem;">
            <h2 class="room-title">${room.title}</h2>
        </div>
        <div class="card-body">
            <div class="occupancy-ring" style="--percentage: ${percentage}%">
                <div class="ring-content">
                    <span class="occupancy-percentage">${percentage}%</span>
                    <span class="occupancy-label">Full</span>
                </div>
            </div>
            <div class="capacity-counter">
                Seats: <strong>${room.occupiedSeats}</strong> / ${room.totalSeats}
            </div>
        </div>
        <div class="card-footer">
            ${amenitiesHTML}
        </div>
    `;

    // Add click event for SPA navigation
    card.addEventListener('click', () => {
        showRoomDetail(room);
    });
    
    return card;
}

// Function to render all cards based on current sorting
function renderDashboard(data) {
    const grid = document.getElementById('room-grid');
    grid.innerHTML = ''; // Clear existing
    
    data.forEach(room => {
        const card = createRoomCard(room);
        grid.appendChild(card);
    });
}

// Sorting logic
function sortData(sortBy) {
    let sortedData = [...roomsData];
    
    if (sortBy === 'most-empty') {
        sortedData.sort((a, b) => {
            const percA = a.occupiedSeats / a.totalSeats;
            const percB = b.occupiedSeats / b.totalSeats;
            return percA - percB;
        });
    } else if (sortBy === 'most-full') {
        sortedData.sort((a, b) => {
            const percA = a.occupiedSeats / a.totalSeats;
            const percB = b.occupiedSeats / b.totalSeats;
            return percB - percA;
        });
    } else if (sortBy === 'alphabetical') {
        sortedData.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    renderDashboard(sortedData);
}

// SPA Routing: Show Room Detail
function showRoomDetail(room) {
    activeDetailRoomId = room.id;
    document.getElementById('main-dashboard-view').style.display = 'none';
    document.getElementById('room-detail-view').style.display = 'block';

    updateRoomDetailUI(room);

    const percentage = Math.round((room.occupiedSeats / room.totalSeats) * 100);
    const stateInfo = getOccupancyState(percentage);
    renderChart(room, stateInfo);
}

// SPA Routing: Show Main Dashboard
function showDashboard() {
    activeDetailRoomId = null;
    document.getElementById('room-detail-view').style.display = 'none';
    document.getElementById('main-dashboard-view').style.display = 'block';
}

// Render Chart.js
function renderChart(room, stateInfo) {
    const ctx = document.getElementById('historicalChart').getContext('2d');
    
    // Destroy previous chart instance if exists
    if (currentChart) {
        currentChart.destroy();
    }

    // Generate dummy historical data (last 12 hours)
    const labels = [];
    const data = [];
    const currentHour = new Date().getHours();
    
    let baseOccupancy = Math.round((room.occupiedSeats / room.totalSeats) * 100);

    for (let i = 11; i >= 0; i--) {
        let hour = currentHour - i;
        if (hour < 0) hour += 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        labels.push(`${displayHour} ${ampm}`);

        // Add some random variation, converging on current baseOccupancy at the end
        if (i === 0) {
            data.push(baseOccupancy);
        } else {
            let variation = Math.floor(Math.random() * 30) - 15;
            let val = baseOccupancy + variation;
            val = Math.max(0, Math.min(100, val));
            data.push(val);
        }
    }

    // Get exact color code from CSS vars (simulated here for chart)
    let lineColor = '#8A9A86'; // default green
    if (stateInfo.state === 'yellow') lineColor = '#D1A258';
    if (stateInfo.state === 'red') lineColor = '#A85751';

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Occupancy %',
                data: data,
                borderColor: lineColor,
                backgroundColor: lineColor + '33', // 20% opacity hex
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: lineColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#2C2621',
                    titleFont: { family: 'Inter' },
                    bodyFont: { family: 'Inter' },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + '% Full';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(92, 74, 61, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { family: 'Inter' },
                        color: '#4A4A4A',
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: { family: 'Inter' },
                        color: '#4A4A4A',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Time formatting for Timestamp
function updateTimestamp() {
    const now = new Date();
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const dateOptions = { month: 'short', day: 'numeric' };
    
    const timeString = now.toLocaleTimeString('en-US', timeOptions);
    const dateString = now.toLocaleDateString('en-US', dateOptions);
    
    document.getElementById('timestamp-text').textContent = `${dateString}, ${timeString}`;
}

// Show Premium Toast Alerts
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="fa-solid fa-circle-check" style="color: var(--state-green);"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Automatically remove toast after fadeOut completes (5s total)
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Setup Waitlist Button Event Listener
function setupWaitlistButton() {
    const waitlistBtn = document.getElementById('join-waitlist-btn');
    if (!waitlistBtn) return;
    
    waitlistBtn.addEventListener('click', () => {
        if (localStorage.getItem('library_waitlisted') === 'true') {
            return; // Already subscribed
        }
        
        // Request desktop notifications if browser supports it
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted.');
                }
            });
        }
        
        // Set waitlist state
        localStorage.setItem('library_waitlisted', 'true');
        
        // Show success alert toast
        showToast('Successfully joined waitlist! We will alert you when a seat opens up.', 'success');
        
        // Refresh button display states
        updateOverallStats();
    });
}

// Start listening to Firebase for ambient light levels (LDR sensor)
function initAmbientLightListener() {
    const ambientRef = ref(db, 'library/rooms_ambient');
    onValue(ambientRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            // Auto-populate rooms_ambient in database on first run
            const initialAmbient = {};
            roomsData.forEach(room => {
                initialAmbient[room.id] = 'BRIGHT';
            });
            set(ambientRef, initialAmbient);
            return;
        }

        // Update local status map
        for (const [roomId, status] of Object.entries(data)) {
            roomsAmbient[roomId] = status;
        }

        // Refresh dashboard (which updates the cards)
        const sortSelect = document.getElementById('sort-select');
        sortData(sortSelect ? sortSelect.value : 'most-empty');

        // Dynamically update detail stats if currently active
        if (activeDetailRoomId) {
            const activeRoom = roomsData.find(r => r.id === activeDetailRoomId);
            if (activeRoom) {
                updateRoomDetailUI(activeRoom);
            }
        }
    });
}

// Initialize Application
setupWaitlistButton();

// Start listening to Firebase for SVG rooms
initLiveFloorPlan();
initAmbientLightListener();

// Initial Render & Stats
updateOverallStats();
sortData('most-empty');
updateTimestamp();

// Set initial dummy colors on SVG overlays
roomsData.forEach(room => {
    const percentage = Math.round((room.occupiedSeats / room.totalSeats) * 100);
    updateSVGRoomColor(room.id, percentage);
});

// Setup Sort Listener
const sortSelect = document.getElementById('sort-select');
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        sortData(e.target.value);
    });
}

// Setup interactive SVG room clicks
roomsData.forEach(room => {
    const roomElement = document.getElementById(room.id);
    if (roomElement) {
        roomElement.addEventListener('click', () => {
            showRoomDetail(room);
        });
    }
});

// Setup Back Button
const backBtn = document.getElementById('back-button');
if (backBtn) {
    backBtn.addEventListener('click', showDashboard);
}

// Poll timestamp every 30 seconds (simulated sync)
setInterval(updateTimestamp, 30000);
