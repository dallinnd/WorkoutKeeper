let appData = { library: [], schedule: {} };

function getLocalYYYYMMDD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

let currentDate = new Date(); 
let selectedDateStr = getLocalYYYYMMDD(currentDate); 
let builderState = { name: "", time: "1.5 - 2 hours", sets: [] };

// Execution Engine State
let activePreviewId = null;
let activeSession = null;
let activeTimers = {};

// The Clock SVG for timed exercises
const clockIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_v4');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    if(appData.library.length === 0) {
        // Dummy data for testing
        appData.library.push({
            id: 'w1', name: 'Workouts #1', time: '1.5 - 2 hours', theme: 'purple',
            sets: [{ repeat: 3, exercises: [
                {name: 'Pushups', type: 'reps', val: 20, label: 'ct'},
                {name: 'Crunches', type: 'reps', val: 30, label: 'ct'},
                {name: 'Planks', type: 'timed', val: 60, label: 'sec'}
            ]}]
        });
        appData.schedule[selectedDateStr] = ['w1'];
    }

    setupRouter();
    setupThemeSelector();
    renderCalendar();
    showDailySchedule(selectedDateStr);
});

function saveData() { localStorage.setItem('wk_data_v4', JSON.stringify(appData)); }

// --- ROUTER & THEMES ---
function switchView(targetId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(b => {
        if(b.dataset.target) b.classList.toggle('active', b.dataset.target === targetId);
    });

    // Hide bottom nav on preview and active views
    document.getElementById('bottom-nav').style.display = (targetId === 'view-preview' || targetId === 'view-active') ? 'none' : 'flex';

    // Background Management
    document.body.classList.remove('bg-green', 'bg-wash');
    if(targetId === 'view-calendar') {
        document.body.classList.add('bg-green');
        renderCalendar();
        showDailySchedule(selectedDateStr);
    } else if (targetId === 'view-active') {
        document.body.classList.add('bg-wash'); // Light faded background for active workout
    } else if (targetId === 'view-builder') {
        document.body.setAttribute('data-theme', 'purple');
        renderBuilder();
    }
}

function setupRouter() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(e.currentTarget.dataset.target) switchView(e.currentTarget.dataset.target);
        });
    });
    switchView('view-calendar');
}

function setupThemeSelector() {
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const color = e.target.dataset.theme;
            document.body.setAttribute('data-theme', color);
            document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

// --- CALENDAR LOGIC ---
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if(!grid) return; 
    grid.innerHTML = '<div class="calendar-grid-header"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    document.getElementById('month-display').innerText = new Date(year, month).toLocaleDateString('default', { month: 'long', year: 'numeric' });

    const dayContainer = document.createElement('div');
    dayContainer.className = 'calendar-grid';

    for(let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        dayContainer.appendChild(empty);
    }

    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cell = document.createElement('div');
        
        let classes = 'day-cell';
        if (dateStr === selectedDateStr) classes += ' current-selected';
        const hasWorkouts = appData.schedule[dateStr] && appData.schedule[dateStr].length > 0;
        if (hasWorkouts) classes += ' active-scheduled';
        
        cell.className = classes;
        cell.innerText = i;
        
        if(hasWorkouts) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            cell.appendChild(dot);
        }

        cell.addEventListener('click', () => {
            selectedDateStr = dateStr;
            renderCalendar();
            showDailySchedule(dateStr);
        });
        dayContainer.appendChild(cell);
    }
    grid.appendChild(dayContainer);
}

document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

function showDailySchedule(dateStr) {
    const todayStr = getLocalYYYYMMDD(new Date());
    document.getElementById('selected-date-title').innerText = (dateStr === todayStr) ? "Today" : `Schedule for ${dateStr}`;
    
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
                    <span class="val">${workout.time.split(' ')[0]}</span>
                </div>
            `;
            // NEW: Launch Preview instead of directly starting
            card.addEventListener('click', () => openPreview(workout.id));
            list.appendChild(card);
        }
    });
    document.getElementById('btn-schedule-new').classList.remove('hidden');
}

document.getElementById('btn-schedule-new').addEventListener('click', () => {
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    if(appData.library.length === 0) list.innerHTML = '<p style="color:black;">No saved workouts.</p>';
    else {
        appData.library.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'btn-ghost';
            btn.style.color = 'black'; btn.style.borderColor = 'black';
            btn.innerText = w.name;
            btn.onclick = () => {
                if(!appData.schedule[selectedDateStr]) appData.schedule[selectedDateStr] = [];
                appData.schedule[selectedDateStr].push(w.id);
                saveData();
                document.getElementById('schedule-modal').classList.add('hidden');
                renderCalendar();
                showDailySchedule(selectedDateStr);
            };
            list.appendChild(btn);
        });
    }
    document.getElementById('schedule-modal').classList.remove('hidden');
});
document.getElementById('close-schedule-modal').addEventListener('click', () => document.getElementById('schedule-modal').classList.add('hidden'));

// --- PREVIEW SCREEN (NEW) ---
function openPreview(workoutId) {
    const w = appData.library.find(x => x.id === workoutId);
    if(!w) return;
    activePreviewId = w.id;

    document.body.setAttribute('data-theme', w.theme || 'purple');
    document.getElementById('preview-title').innerText = w.name;
    document.getElementById('preview-time').innerText = w.time;

    const container = document.getElementById('preview-sets-container');
    container.innerHTML = '';

    w.sets.forEach((set, idx) => {
        const card = document.createElement('div');
        card.className = 'themed-set-card';
        
        let exHtml = '';
        set.exercises.forEach(ex => {
            const badgeContent = ex.type === 'timed' ? clockIcon : ex.val;
            exHtml += `
                <div class="ex-badge-row">
                    <div class="ex-badge">${badgeContent}</div>
                    <span>${ex.name}</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="set-card-header">
                <span>Set ${idx + 1}</span>
                <span>x${set.repeat}</span>
            </div>
            ${exHtml}
        `;
        container.appendChild(card);
    });

    switchView('view-preview');
}

document.getElementById('btn-back-schedule').addEventListener('click', () => switchView('view-calendar'));
document.getElementById('btn-start-workout').addEventListener('click', () => startWorkout(activePreviewId));

// --- ACTIVE WORKOUT ENGINE (UNROLLED) ---
window.startWorkout = function(id) {
    const template = appData.library.find(w => w.id === id);
    if(!template) return;

    // Build unrolled sets: Set 1 x3 -> Set 1.1, 1.2, 1.3
    activeSession = { name: template.name, currentActiveIndex: 0, sets: [] };

    template.sets.forEach((set, sIdx) => {
        for(let r=0; r<set.repeat; r++) {
            // Check if set has timed exercises to spawn a timer button
            let hasTimed = set.exercises.some(ex => ex.type === 'timed');
            let totalTime = 0;
            if(hasTimed) {
                set.exercises.forEach(ex => {
                    if(ex.type === 'timed') totalTime += (ex.label === 'min' ? ex.val * 60 : parseInt(ex.val));
                });
            }

            activeSession.sets.push({
                id: `set_${sIdx}_${r}`,
                title: `Set ${sIdx + 1}.${r + 1}`,
                exercises: set.exercises,
                isDone: false,
                hasTimer: hasTimed,
                timeLeft: totalTime
            });
        }
    });

    document.getElementById('active-workout-title').innerText = activeSession.name;
    renderActiveWorkout();
    switchView('view-active');
};

function renderActiveWorkout() {
    const container = document.getElementById('active-sets-container');
    container.innerHTML = '';
    
    activeSession.sets.forEach((set, idx) => {
        const card = document.createElement('div');
        
        // Styling logic: The active card is solid. Future cards are faded gradients.
        let cardClass = 'themed-set-card';
        if (idx > activeSession.currentActiveIndex) cardClass += ' faded';
        if (set.isDone) cardClass += ' hidden'; // Hide completed sets to auto-scroll
        
        card.className = cardClass;
        
        let exHtml = '';
        set.exercises.forEach(ex => {
            const badgeContent = ex.type === 'timed' ? clockIcon : ex.val;
            exHtml += `
                <div class="ex-badge-row">
                    <div class="ex-badge">${badgeContent}</div>
                    <span>${ex.name}</span>
                </div>
            `;
        });

        // Controls at the bottom of the Set card
        let controlsHtml = '';
        if (idx === activeSession.currentActiveIndex) {
            if (set.hasTimer) {
                const isRunning = !!activeTimers[set.id];
                const format = secs => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                controlsHtml += `<button class="btn-timer-gold" onclick="toggleSetTimer('${set.id}')">${format(set.timeLeft)}</button>`;
            }
            controlsHtml += `<button class="btn-complete-green" onclick="completeSet('${set.id}')">Completed</button>`;
        }

        card.innerHTML = `
            <div class="set-card-header">
                <span>${set.title}</span>
            </div>
            ${exHtml}
            ${controlsHtml}
        `;
        container.appendChild(card);
    });
}

window.toggleSetTimer = function(setId) {
    const set = activeSession.sets.find(s => s.id === setId);
    if(activeTimers[setId]) {
        clearInterval(activeTimers[setId]);
        delete activeTimers[setId];
    } else {
        activeTimers[setId] = setInterval(() => {
            set.timeLeft--;
            if(set.timeLeft <= 0) {
                clearInterval(activeTimers[setId]);
                delete activeTimers[setId];
            }
            renderActiveWorkout();
        }, 1000);
    }
    renderActiveWorkout();
};

window.completeSet = function(setId) {
    if(activeTimers[setId]) {
        clearInterval(activeTimers[setId]);
        delete activeTimers[setId];
    }
    const set = activeSession.sets.find(s => s.id === setId);
    set.isDone = true;
    activeSession.currentActiveIndex++;
    
    // Check if workout is finished
    if(activeSession.currentActiveIndex >= activeSession.sets.length) {
        alert("Workout Complete!");
        switchView('view-calendar');
    } else {
        renderActiveWorkout();
    }
};

document.getElementById('btn-cancel-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    switchView('view-calendar');
});

// --- BUILDER ENGINE ---
// Re-uses logic from previous versions, ensuring data structure fits the new unrolled engine.
document.getElementById('add-set-btn').addEventListener('click', () => { builderState.sets.push({ repeat: 1, exercises: [] }); renderBuilder(); });

document.getElementById('save-to-library-btn').addEventListener('click', () => {
    appData.library.push({
        id: 'wk_' + Date.now(),
        name: document.getElementById('workout-name').value || "My Workout",
        time: document.getElementById('time-select').value,
        theme: document.body.getAttribute('data-theme'),
        sets: JSON.parse(JSON.stringify(builderState.sets)) 
    });
    saveData();
    builderState = { name: "", time: "10 mins", sets: [] };
    document.getElementById('workout-name').value = "";
    switchView('view-calendar');
});

window.changeSetRepeat = function(setIdx, delta) {
    builderState.sets[setIdx].repeat = Math.max(1, builderState.sets[setIdx].repeat + delta);
    renderBuilder();
};

function renderBuilder() {
    const container = document.getElementById('sets-container');
    container.innerHTML = '';
    builderState.sets.forEach((set, idx) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        card.innerHTML = `
            <div class="set-header">
                <span>Set ${idx + 1}</span>
                <div class="set-counter">
                    <button onclick="changeSetRepeat(${idx}, -1)">-</button>
                    <span>x${set.repeat}</span>
                    <button onclick="changeSetRepeat(${idx}, 1)">+</button>
                </div>
            </div>
            ${set.exercises.map(ex => `<div class="exercise-row"><span>${ex.name}</span><span>${ex.val} ${ex.label}</span></div>`).join('')}
            <button class="btn-add-ex full-width" onclick="openModal(${idx})">+ New Exercise</button>
        `;
        container.appendChild(card);
    });
}

// Modal Logic
let targetSet = null, mMode = 'reps', mVal = 10, timeUnit = 'sec';
window.openModal = function(idx) { targetSet = idx; document.getElementById('modal-overlay').classList.remove('hidden'); }
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));

document.getElementById('toggle-reps').onclick = (e) => { mMode='reps'; e.target.classList.add('active'); document.getElementById('toggle-timed').classList.remove('active'); document.getElementById('time-unit-container').classList.add('hidden');}
document.getElementById('toggle-timed').onclick = (e) => { mMode='timed'; e.target.classList.add('active'); document.getElementById('toggle-reps').classList.remove('active'); document.getElementById('time-unit-container').classList.remove('hidden');}
document.getElementById('unit-sec').onclick = (e) => { timeUnit='sec'; e.target.classList.add('active'); document.getElementById('unit-min').classList.remove('active');}
document.getElementById('unit-min').onclick = (e) => { timeUnit='min'; e.target.classList.add('active'); document.getElementById('unit-sec').classList.remove('active');}

document.getElementById('counter-plus').onclick = () => { mVal += (mMode==='reps'||timeUnit==='min')?1:5; document.getElementById('counter-value').innerText = mVal; };
document.getElementById('counter-minus').onclick = () => { if(mVal>0) mVal -= (mMode==='reps'||timeUnit==='min')?1:5; document.getElementById('counter-value').innerText = mVal; };

document.getElementById('modal-save').onclick = () => {
    builderState.sets[targetSet].exercises.push({
        name: document.getElementById('modal-name').value || 'Exercise',
        type: mMode, val: mVal, label: mMode === 'timed' ? timeUnit : 'ct'
    });
    document.getElementById('modal-overlay').classList.add('hidden');
    renderBuilder();
}
