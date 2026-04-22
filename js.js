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

let activePreviewId = null;
let activeSession = null;
let activeTimers = {};

const clockIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_v5');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    if(appData.library.length === 0) {
        appData.library.push({
            id: 'w1', name: 'Workouts #1', time: '1.5 - 2 hours', theme: 'purple',
            sets: [{ repeat: 2, exercises: [
                {name: 'Pushups', type: 'reps', val: 20, label: 'ct'},
                {name: 'Planks', type: 'timed', val: 10, label: 'sec'}
            ]}]
        });
        appData.schedule[selectedDateStr] = ['w1'];
    }

    setupRouter();
    setupThemeSelector();
    renderCalendar();
    showDailySchedule(selectedDateStr);
});

function saveData() { localStorage.setItem('wk_data_v5', JSON.stringify(appData)); }

// --- ROUTER & THEMES ---
function switchView(targetId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(b => {
        if(b.dataset.target) b.classList.toggle('active', b.dataset.target === targetId);
    });

    document.getElementById('bottom-nav').style.display = (targetId === 'view-preview' || targetId === 'view-active') ? 'none' : 'flex';

    document.body.classList.remove('bg-green', 'bg-wash');
    if(targetId === 'view-calendar') {
        document.body.classList.add('bg-green');
        renderCalendar();
        showDailySchedule(selectedDateStr);
    } else if (targetId === 'view-active') {
        document.body.classList.add('bg-wash');
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
    grid.innerHTML = ''; 
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    document.getElementById('month-display').innerText = new Date(year, month).toLocaleDateString('default', { month: 'long', year: 'numeric' });

    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    daysOfWeek.forEach(day => {
        const el = document.createElement('div');
        el.className = 'day-cell header';
        el.innerText = day;
        grid.appendChild(el);
    });

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
        grid.appendChild(cell);
    }
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
                <div class="workout-time-block"><span class="val">${workout.time.split(' ')[0]}</span></div>
            `;
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

// --- PREVIEW SCREEN ---
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
            exHtml += `<div class="ex-badge-row"><div><div class="ex-badge">${badgeContent}</div><span>${ex.name}</span></div></div>`;
        });
        card.innerHTML = `<div class="set-card-header"><span>Set ${idx + 1}</span><span>x${set.repeat}</span></div>${exHtml}`;
        container.appendChild(card);
    });

    switchView('view-preview');
}

document.getElementById('btn-back-schedule').addEventListener('click', () => switchView('view-calendar'));
document.getElementById('btn-start-workout').addEventListener('click', () => startWorkout(activePreviewId));

// --- ACTIVE WORKOUT ENGINE ---
window.startWorkout = function(id) {
    const template = appData.library.find(w => w.id === id);
    if(!template) return;

    activeSession = { name: template.name, currentActiveIndex: 0, sets: [] };

    template.sets.forEach((set, sIdx) => {
        for(let r=0; r<set.repeat; r++) {
            // Assign unique ID to every exercise so timers don't overlap
            const uniqueExercises = set.exercises.map((ex, eIdx) => ({
                ...ex,
                uid: `ex_${sIdx}_${r}_${eIdx}`,
                timeLeft: ex.type === 'timed' ? (ex.label === 'min' ? ex.val * 60 : ex.val) : null,
                isFinished: false
            }));

            activeSession.sets.push({
                id: `set_${sIdx}_${r}`,
                title: `Set ${sIdx + 1}.${r + 1}`,
                exercises: uniqueExercises,
                isDone: false
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
    
    let completedSetsCount = 0;

    activeSession.sets.forEach((set, idx) => {
        if (set.isDone) completedSetsCount++;
        
        const card = document.createElement('div');
        // Let the user scroll through all. Dim the future ones slightly.
        card.className = `themed-set-card ${idx > activeSession.currentActiveIndex ? 'faded' : ''}`;
        
        let exHtml = '';
        set.exercises.forEach(ex => {
            const badgeContent = ex.type === 'timed' ? clockIcon : ex.val;
            
            // Smart Timer Logic (Green -> Red -> Gold)
            let timerBtn = '';
            if (ex.type === 'timed') {
                if (ex.isFinished) {
                    timerBtn = `<button class="btn-timer-finished">00:00</button>`;
                } else {
                    const isRunning = !!activeTimers[ex.uid];
                    const btnClass = isRunning ? 'btn-timer-running' : 'btn-timer-ready';
                    const format = secs => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                    timerBtn = `<button class="${btnClass}" onclick="toggleExerciseTimer('${ex.uid}')">${format(ex.timeLeft)}</button>`;
                }
            }

            exHtml += `
                <div class="ex-badge-row">
                    <div>
                        <div class="ex-badge">${badgeContent}</div>
                        <span>${ex.name}</span>
                    </div>
                    ${timerBtn}
                </div>
            `;
        });

        // Set Completion toggle at the bottom
        let completeBtn = `<button class="btn-complete-set ${set.isDone ? 'completed' : ''}" onclick="toggleSetComplete('${set.id}')">${set.isDone ? 'Completed' : 'Complete'}</button>`;

        card.innerHTML = `<div class="set-card-header"><span>${set.title}</span></div>${exHtml}${completeBtn}`;
        container.appendChild(card);
    });

    // Update Progress Bar
    const pct = activeSession.sets.length === 0 ? 0 : (completedSetsCount / activeSession.sets.length) * 100;
    document.getElementById('active-progress-bar').style.width = pct + '%';
}

window.toggleExerciseTimer = function(exUid) {
    // Find exercise
    let foundEx = null;
    for (let s of activeSession.sets) {
        foundEx = s.exercises.find(e => e.uid === exUid);
        if (foundEx) break;
    }
    if(!foundEx || foundEx.isFinished) return;

    if(activeTimers[exUid]) {
        clearInterval(activeTimers[exUid]);
        delete activeTimers[exUid];
    } else {
        activeTimers[exUid] = setInterval(() => {
            foundEx.timeLeft--;
            if(foundEx.timeLeft <= 0) {
                clearInterval(activeTimers[exUid]);
                delete activeTimers[exUid];
                foundEx.isFinished = true;
            }
            renderActiveWorkout();
        }, 1000);
    }
    renderActiveWorkout(); // Update to show red state immediately
};

window.toggleSetComplete = function(setId) {
    const set = activeSession.sets.find(s => s.id === setId);
    set.isDone = !set.isDone; // Allow toggling on and off
    
    // Update active index to the first non-completed set
    activeSession.currentActiveIndex = activeSession.sets.findIndex(s => !s.isDone);
    if(activeSession.currentActiveIndex === -1) activeSession.currentActiveIndex = activeSession.sets.length;
    
    renderActiveWorkout();
};

document.getElementById('btn-cancel-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    switchView('view-calendar');
});

document.getElementById('btn-finish-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    switchView('view-calendar');
});

// --- BUILDER ENGINE ---
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
    builderState = { name: "", time: "1.5 - 2 hours", sets: [] };
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

// Modal Logic w/ Defaults
let targetSet = null, mMode = 'reps', mVal = 10, timeUnit = 'sec';
window.openModal = function(idx) { 
    targetSet = idx; 
    document.getElementById('modal-overlay').classList.remove('hidden'); 
    document.getElementById('modal-name').value = '';
    
    // Auto-select REPS and set default to 10
    mMode = 'reps'; mVal = 10;
    document.getElementById('toggle-reps').classList.add('active');
    document.getElementById('toggle-timed').classList.remove('active');
    document.getElementById('time-unit-container').classList.add('hidden');
    document.getElementById('counter-value').innerText = mVal;
}
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));

document.getElementById('toggle-reps').onclick = (e) => { 
    mMode='reps'; mVal = 10; // Default reps
    e.target.classList.add('active'); document.getElementById('toggle-timed').classList.remove('active'); 
    document.getElementById('time-unit-container').classList.add('hidden');
    document.getElementById('counter-value').innerText = mVal;
}
document.getElementById('toggle-timed').onclick = (e) => { 
    mMode='timed'; mVal = 30; timeUnit = 'sec'; // Default seconds
    e.target.classList.add('active'); document.getElementById('toggle-reps').classList.remove('active'); 
    document.getElementById('time-unit-container').classList.remove('hidden');
    document.getElementById('unit-sec').classList.add('active'); document.getElementById('unit-min').classList.remove('active');
    document.getElementById('counter-value').innerText = mVal;
}
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
