let appData = {
    library: [], 
    schedule: {} 
};

let currentView = 'view-calendar';
let currentDate = new Date(2026, 3, 15); // Default to April 2026 as per mockup
let selectedDateStr = "2026-04-15"; // Selected day 15 (Gold)
let builderState = { name: "", time: "10", sets: [] };

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_v2');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    // Inject some dummy data if empty so the mockup looks right
    if(appData.library.length === 0) {
        appData.library.push({id: 'w1', name: 'Workout #1', time: '5'});
        appData.library.push({id: 'w2', name: 'Wednesday Evening', time: '10'});
        appData.schedule["2026-04-15"] = ['w1', 'w2'];
        appData.schedule["2026-04-06"] = ['w1'];
        appData.schedule["2026-04-08"] = ['w2'];
        appData.schedule["2026-04-10"] = ['w1'];
        appData.schedule["2026-04-13"] = ['w1'];
        appData.schedule["2026-04-14"] = ['w2'];
        appData.schedule["2026-04-16"] = ['w1'];
    }

    setupRouter();
    renderCalendar();
    showDailySchedule(selectedDateStr);
});

// ROUTER
function setupRouter() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Toggle Theme Backgrounds
            if(target === 'view-calendar') {
                document.body.classList.add('bg-green');
                renderCalendar();
            } else {
                document.body.classList.remove('bg-green');
                if(target === 'view-builder') renderBuilder();
            }
        });
    });
    // Set initial background
    document.body.classList.add('bg-green');
}

// CALENDAR
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    document.getElementById('month-display').innerText = new Date(year, month).toLocaleDateString('default', { month: 'long' });

    for(let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        grid.appendChild(empty);
    }

    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cell = document.createElement('div');
        
        let classes = 'day-cell';
        if (dateStr === selectedDateStr) classes += ' current-selected';
        else if (appData.schedule[dateStr] && appData.schedule[dateStr].length > 0) classes += ' active-scheduled';
        
        cell.className = classes;
        cell.innerText = i;
        
        // Add dot if scheduled
        if(appData.schedule[dateStr] && appData.schedule[dateStr].length > 0) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            cell.appendChild(dot);
        }

        cell.addEventListener('click', () => {
            selectedDateStr = dateStr;
            renderCalendar();
            showDailySchedule(dateStr);
        });

        grid.appendChild(cell);
    }
}

// SCHEDULE CARDS
function showDailySchedule(dateStr) {
    // Check if it's "Today"
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('selected-date-title').innerText = (dateStr === todayStr || dateStr === "2026-04-15") ? "Today" : `Schedule for ${dateStr}`;
    
    const list = document.getElementById('scheduled-workouts-list');
    list.innerHTML = '';

    const scheduledIds = appData.schedule[dateStr] || [];
    
    scheduledIds.forEach(id => {
        const workout = appData.library.find(w => w.id === id);
        if(workout) {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h3>${workout.name}</h3>
                <div class="workout-time-block">
                    <span class="val">${workout.time}</span>
                    <span class="lbl">mins</span>
                </div>
            `;
            list.appendChild(card);
        }
    });

    document.getElementById('btn-schedule-new').classList.remove('hidden');
}

// Dummy Builder Logic to allow "+ New Set" to work visually
document.getElementById('add-set-btn').addEventListener('click', () => {
    builderState.sets.push({ repeat: 1, exercises: [] });
    renderBuilder();
});

function renderBuilder() {
    const container = document.getElementById('sets-container');
    container.innerHTML = '';
    
    builderState.sets.forEach((set, idx) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        card.innerHTML = `
            <div class="set-header">
                <span>Set ${idx + 1}</span>
                <div>x <select><option>1</option><option>2</option><option>3</option></select></div>
            </div>
            ${set.exercises.map(ex => `<div class="exercise-row"><span>${ex.name}</span><span>${ex.val} ${ex.label} <span style="color:#888">✏️</span></span></div>`).join('')}
            <button class="btn-add-ex" onclick="openModal(${idx})">+ New Exercise</button>
        `;
        container.appendChild(card);
    });
}

// Modal Logic
let targetSet = null, mMode = 'reps', mVal = 10;
window.openModal = function(idx) { targetSet = idx; document.getElementById('modal-overlay').classList.remove('hidden'); }
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));

document.getElementById('counter-plus').onclick = () => { mVal += 5; document.getElementById('counter-value').innerText = mVal; };
document.getElementById('counter-minus').onclick = () => { if(mVal>0) mVal -= 5; document.getElementById('counter-value').innerText = mVal; };

document.getElementById('modal-save').onclick = () => {
    builderState.sets[targetSet].exercises.push({
        name: document.getElementById('modal-name').value || 'Exercise',
        val: mVal,
        label: 'ct'
    });
    document.getElementById('modal-overlay').classList.add('hidden');
    renderBuilder();
}
