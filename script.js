// TODO: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID"
};

// Initialize Firebase (Compat version)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

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

function initLiveFloorPlan() {
    const occupancyRef = db.ref('library/rooms');
    occupancyRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            for (const [roomId, percentage] of Object.entries(data)) {
                updateSVGRoomColor(roomId, percentage);
            }
        }
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
        title: 'Book Shelves Area',
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
        title: 'Silent Reading Area',
        totalSeats: 100,
        occupiedSeats: 95, // 95% (Red)
        amenities: ['wifi', 'quiet']
    },
    {
        id: 'group-work',
        title: 'Group Work Area',
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

    const card = document.createElement('div');
    card.className = 'room-card';
    card.style.setProperty('--status-color', stateInfo.colorVar);
    
    card.innerHTML = `
        <div class="card-header">
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
    document.getElementById('main-dashboard-view').style.display = 'none';
    document.getElementById('room-detail-view').style.display = 'block';

    const percentage = Math.round((room.occupiedSeats / room.totalSeats) * 100);
    const stateInfo = getOccupancyState(percentage);

    // Populate Sidebar Stats
    document.getElementById('detail-title').textContent = room.title;
    document.getElementById('detail-percentage').textContent = percentage + '%';
    document.getElementById('detail-occupied').textContent = room.occupiedSeats;
    document.getElementById('detail-total').textContent = room.totalSeats;
    
    // Update Detail Ring
    const detailRing = document.getElementById('detail-ring');
    detailRing.style.setProperty('--status-color', stateInfo.colorVar);
    detailRing.style.setProperty('--percentage', percentage + '%');

    // Populate Amenities
    const amenitiesContainer = document.getElementById('detail-amenities');
    amenitiesContainer.innerHTML = room.amenities.map(amenity => {
        const iconData = iconMap[amenity];
        return `<i class="${iconData.class} amenity" title="${iconData.title}"></i>`;
    }).join('');

    // Generate Chart
    renderChart(room, stateInfo);
}

// SPA Routing: Show Main Dashboard
function showDashboard() {
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

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Start listening to Firebase for SVG rooms
    initLiveFloorPlan();
    
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
    sortSelect.addEventListener('change', (e) => {
        sortData(e.target.value);
    });

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
    backBtn.addEventListener('click', showDashboard);
    
    // Poll timestamp every 30 seconds (simulated sync)
    setInterval(updateTimestamp, 30000);
});
