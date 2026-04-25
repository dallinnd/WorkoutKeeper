let appData = { library: [], schedule: {} };

function getLocalYYYYMMDD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

let currentDate = new Date(); 
let selectedDateStr = getLocalYYYYMMDD(currentDate); 
let builderState = { id: null, name: "", time: "1.5 - 2 hours", theme: "purple", sets: [] };

// Execution Engine State
let activePreviewInstance = null; 
let activeSession = null;
let activeTimers = {};

const clockIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
const checkIcon = `<span style="color:#2ecc71; font-weight:bold; margin-right:10px;">✓</span>`;

window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_v7');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    if(appData.library.length === 0) {
        appData.library.push({
            id: 'wk_' + Date.now(), name: 'Workouts #1', time: '1.5 - 2 hours', theme: 'purple',
            sets: [{ repeat: 2, exercises: [
                {name: 'Pushups', type: 'reps', val: 20, label: 'ct'},
                {name: 'Planks', type: 'timed', val: 10, label: 'sec'}
            ]}]
        });
        appData.schedule[selectedDateStr] = [{ id: appData.library[0].id, instanceId: Date.now(), completed: false }];
        saveData();
    }

    setupRouter();
    setupThemeSelector();
    renderCalendar();
    showDailySchedule(selectedDateStr);
});

function saveData() { localStorage.setItem('wk_data_v7', JSON.stringify(appData)); }

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
    } else if (targetId === 'view-profile') {
        renderProfile();
    } else if (targetId === 'view-builder') {
        document.body.setAttribute('data-theme', builderState.theme || 'purple');
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
            builderState.theme = color;
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
    
    const scheduledItems = appData.schedule[dateStr] || [];
    scheduledItems.forEach(item => {
        const workout = appData.library.find(w => w.id === item.id);
        if(workout) {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h3>${item.completed ? checkIcon : ''}${workout.name}</h3>
                <div class="workout-time-block"><span class="val">${workout.time.split(' ')[0]}</span></div>
            `;
            card.addEventListener('click', () => openPreview(item.instanceId, workout.id));
            list.appendChild(card);
        }
    });
    document.getElementById('btn-schedule-new').classList.remove('hidden');
}

// Scheduling Modal
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
                appData.schedule[selectedDateStr].push({ id: w.id, instanceId: Date.now(), completed: false });
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

// --- PROFILE / LIBRARY (NEW) ---
function renderProfile() {
    const list = document.getElementById('profile-library-list');
    list.innerHTML = '';
    
    if(appData.library.length === 0) {
        list.innerHTML = '<p style="text-align:center;">You have no saved workouts.</p>';
        return;
    }

    appData.library.forEach(w => {
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.innerHTML = `
            <h3>${w.name}</h3>
            <p>${w.time} | Theme: ${w.theme}</p>
            <div class="profile-actions">
                <button class="btn-prof-start" onclick="openPreview(Date.now(), '${w.id}')">Start</button>
                <button class="btn-prof-edit" onclick="editWorkout('${w.id}')">Edit</button>
                <button class="btn-prof-del" onclick="deleteWorkout('${w.id}')">Delete</button>
            </div>
        `;
        list.appendChild(card);
    });
}

window.editWorkout = function(id) {
    const w = appData.library.find(x => x.id === id);
    if(w) {
        builderState = JSON.parse(JSON.stringify(w)); // Deep copy into builder state
        switchView('view-builder');
    }
}

window.deleteWorkout = function(id) {
    if(!confirm("Are you sure you want to delete this workout? It will be removed from your schedule.")) return;
    // Remove from Library
    appData.library = appData.library.filter(w => w.id !== id);
    // Remove from Schedule
    for(let date in appData.schedule) {
        appData.schedule[date] = appData.schedule[date].filter(item => item.id !== id);
        if(appData.schedule[date].length === 0) delete appData.schedule[date];
    }
    saveData();
    renderProfile();
}


// --- PREVIEW SCREEN ---
function openPreview(instanceId, workoutId) {
    const w = appData.library.find(x => x.id === workoutId);
    if(!w) return;
    
    activePreviewInstance = { instanceId: instanceId, workoutId: workoutId };

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
            let label = ex.type === 'timed' ? (ex.val > 60 ? 'min:sec' : 'sec') : ex.label;
            
            let displayVal = ex.type === 'timed' ? 
                             `${Math.floor(ex.val/60)}:${String(ex.val%60).padStart(2,'0')}` 
                             : ex.val;

            exHtml += `<div class="ex-badge-row"><div><div class="ex-badge">${badgeContent}</div><span>${ex.name}</span></div><span style="font-size:1rem; opacity:0.8">${displayVal}</span></div>`;
        });
        card.innerHTML = `<div class="set-card-header"><span>Set ${idx + 1}</span><span>x${set.repeat}</span></div>${exHtml}`;
        container.appendChild(card);
    });

    switchView('view-preview');
}

document.getElementById('btn-back-schedule').addEventListener('click', () => switchView('view-calendar'));
document.getElementById('btn-start-workout').addEventListener('click', () => startWorkout(activePreviewInstance));

// --- ACTIVE WORKOUT ENGINE ---
window.startWorkout = function(previewInstance) {
    const template = appData.library.find(w => w.id === previewInstance.workoutId);
    if(!template) return;

    activeSession = { name: template.name, instanceId: previewInstance.instanceId, sets: [] };

    template.sets.forEach((set, sIdx) => {
        for(let r=0; r<set.repeat; r++) {
            const uniqueExercises = set.exercises.map((ex, eIdx) => ({
                ...ex,
                uid: `ex_${sIdx}_${r}_${eIdx}`,
                timeLeft: ex.val, // Val is already normalized to seconds
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
        card.className = `themed-set-card`; 
        
        let exHtml = '';
        set.exercises.forEach(ex => {
            const badgeContent = ex.type === 'timed' ? clockIcon : ex.val;
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
                    <div><div class="ex-badge">${badgeContent}</div><span>${ex.name}</span></div>
                    ${timerBtn}
                </div>
            `;
        });

        let completeBtn = `<button class="btn-complete-set ${set.isDone ? 'completed' : ''}" onclick="toggleSetComplete('${set.id}')">${set.isDone ? 'Completed' : 'Complete'}</button>`;
        card.innerHTML = `<div class="set-card-header"><span>${set.title}</span></div>${exHtml}${completeBtn}`;
        container.appendChild(card);
    });

    const pct = activeSession.sets.length === 0 ? 0 : (completedSetsCount / activeSession.sets.length) * 100;
    document.getElementById('active-progress-bar').style.width = pct + '%';
}

window.toggleExerciseTimer = function(exUid) {
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
    renderActiveWorkout(); 
};

window.toggleSetComplete = function(setId) {
    const set = activeSession.sets.find(s => s.id === setId);
    set.isDone = true; 
    renderActiveWorkout();
    
    if(activeSession.sets.every(s => s.isDone)) {
        setTimeout(() => {
            const daySchedule = appData.schedule[selectedDateStr];
            if (daySchedule) {
                const scheduledItem = daySchedule.find(i => i.instanceId === activeSession.instanceId);
                if (scheduledItem) {
                    scheduledItem.completed = true;
                    saveData();
                }
            }
            Object.values(activeTimers).forEach(clearInterval);
            activeTimers = {};
            switchView('view-calendar');
        }, 500); 
    }
};

document.getElementById('btn-cancel-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    switchView('view-calendar');
});
document.getElementById('btn-finish-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    const daySchedule = appData.schedule[selectedDateStr];
    if (daySchedule) {
        const item = daySchedule.find(i => i.instanceId === activeSession.instanceId);
        if (item) item.completed = true;
        saveData();
    }
    switchView('view-calendar');
});

// --- BUILDER ENGINE ---
document.getElementById('add-set-btn').addEventListener('click', () => { builderState.sets.push({ repeat: 1, exercises: [] }); renderBuilder(); });

document.getElementById('save-to-library-btn').addEventListener('click', () => {
    // If Editing existing workout, remove old version
    if(builderState.id) {
        appData.library = appData.library.filter(w => w.id !== builderState.id);
    }

    appData.library.push({
        id: builderState.id || 'wk_' + Date.now(),
        name: document.getElementById('workout-name').value || "My Workout",
        time: document.getElementById('time-select').value,
        theme: builderState.theme,
        sets: JSON.parse(JSON.stringify(builderState.sets)) 
    });
    saveData();
    
    // Reset state
    builderState = { id: null, name: "", time: "1.5 - 2 hours", theme: "purple", sets: [] };
    document.getElementById('workout-name').value = "";
    
    // Switch to Profile to see the saved workout
    switchView('view-profile');
});

window.changeSetRepeat = function(setIdx, delta) {
    builderState.sets[setIdx].repeat = Math.max(1, builderState.sets[setIdx].repeat + delta);
    renderBuilder();
};

function renderBuilder() {
    const container = document.getElementById('sets-container');
    container.innerHTML = '';
    
    // Bind top level fields
    document.getElementById('workout-name').value = builderState.name;
    document.getElementById('time-select').value = builderState.time;

    // Set Theme dot
    document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
    const dot = document.querySelector(`.theme-dot.${builderState.theme}`);
    if(dot) dot.classList.add('active');

    builderState.sets.forEach((set, idx) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        
        let exRows = set.exercises.map(ex => {
            let label = ex.type === 'timed' ? 'sec' : ex.label;
            return `<div class="exercise-row"><span>${ex.name}</span><span>${ex.val} ${label}</span></div>`;
        }).join('');

        card.innerHTML = `
            <div class="set-header">
                <span>Set ${idx + 1}</span>
                <div class="set-counter">
                    <button onclick="changeSetRepeat(${idx}, -1)">-</button>
                    <span>x${set.repeat}</span>
                    <button onclick="changeSetRepeat(${idx}, 1)">+</button>
                </div>
            </div>
            ${exRows}
            <button class="btn-add-ex full-width" onclick="openModal(${idx})">+ New Exercise</button>
        `;
        container.appendChild(card);
    });
}

// Modal Logic (Direct Text Input Version)
let targetSet = null, mMode = 'reps';
window.openModal = function(idx) { 
    targetSet = idx; 
    document.getElementById('modal-overlay').classList.remove('hidden'); 
    document.getElementById('modal-name').value = '';
    
    // Default to REPS
    mMode = 'reps';
    document.getElementById('toggle-reps').classList.add('active');
    document.getElementById('toggle-timed').classList.remove('active');
    document.getElementById('input-reps-container').classList.remove('hidden');
    document.getElementById('input-time-container').classList.add('hidden');
    
    document.getElementById('modal-val-reps').value = 10;
}
document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));

document.getElementById('toggle-reps').onclick = (e) => { 
    mMode='reps'; 
    e.target.classList.add('active'); document.getElementById('toggle-timed').classList.remove('active'); 
    document.getElementById('input-reps-container').classList.remove('hidden');
    document.getElementById('input-time-container').classList.add('hidden');
}
document.getElementById('toggle-timed').onclick = (e) => { 
    mMode='timed'; 
    e.target.classList.add('active'); document.getElementById('toggle-reps').classList.remove('active'); 
    document.getElementById('input-reps-container').classList.add('hidden');
    document.getElementById('input-time-container').classList.remove('hidden');
}

document.getElementById('modal-save').onclick = () => {
    let finalVal = 0;
    if(mMode === 'reps') {
        finalVal = parseInt(document.getElementById('modal-val-reps').value) || 0;
    } else {
        const mins = parseInt(document.getElementById('modal-val-min').value) || 0;
        const secs = parseInt(document.getElementById('modal-val-sec').value) || 0;
        finalVal = (mins * 60) + secs; // Convert everything to total seconds for the engine
    }

    builderState.sets[targetSet].exercises.push({
        name: document.getElementById('modal-name').value || 'Exercise',
        type: mMode, 
        val: finalVal, 
        label: mMode === 'timed' ? 'sec' : 'ct'
    });
    
    document.getElementById('modal-overlay').classList.add('hidden');
    renderBuilder();
}
