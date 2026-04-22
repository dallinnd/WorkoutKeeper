let appData = {
    library: [], 
    schedule: {} 
};

// 1. Helper to get Local Date Strings (Fixes the "Today" offset bug)
function getLocalYYYYMMDD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

let currentDate = new Date(); 
let selectedDateStr = getLocalYYYYMMDD(currentDate); // Automatically selects TODAY
let builderState = { name: "", time: "10", sets: [] };

// Execution Engine State
let activeSession = null;
let activeTimers = {};

window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_v3');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    // Clean up schedule (remove empty arrays that cause ghost dots)
    for (let date in appData.schedule) {
        if (appData.schedule[date].length === 0) {
            delete appData.schedule[date];
        }
    }

    setupRouter();
    setupThemeSelector();
    renderCalendar();
    showDailySchedule(selectedDateStr);
});

function saveData() {
    localStorage.setItem('wk_data_v3', JSON.stringify(appData));
}

// --- ROUTER & THEMES ---
function switchView(targetId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(b => {
        if(b.dataset.target) b.classList.toggle('active', b.dataset.target === targetId);
    });

    document.getElementById('bottom-nav').style.display = (targetId === 'view-active') ? 'none' : 'flex';

    if(targetId === 'view-calendar') {
        document.body.classList.add('bg-green');
        renderCalendar();
        showDailySchedule(selectedDateStr);
    } else {
        document.body.classList.remove('bg-green');
        if(targetId === 'view-builder') renderBuilder();
    }
}

function setupRouter() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(e.currentTarget.dataset.target) switchView(e.currentTarget.dataset.target);
        });
    });
    document.body.classList.add('bg-green');
    document.body.setAttribute('data-theme', 'purple'); // Default theme
}

// Fix 3: Theme Selector logic
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
    
    // Add Days of Week Header
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
        // Build local date string
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cell = document.createElement('div');
        
        let classes = 'day-cell';
        if (dateStr === selectedDateStr) classes += ' current-selected';
        
        // Fix 5: Dots only appear if workouts actually exist in the array
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

// Fix 7: Calendar Arrows
document.getElementById('prev-month').addEventListener('click', () => { 
    currentDate.setMonth(currentDate.getMonth() - 1); 
    renderCalendar(); 
});
document.getElementById('next-month').addEventListener('click', () => { 
    currentDate.setMonth(currentDate.getMonth() + 1); 
    renderCalendar(); 
});

// --- SCHEDULE CARDS ---
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
                    <span class="val">${workout.time}</span>
                    <span class="lbl">mins</span>
                </div>
            `;
            card.addEventListener('click', () => startWorkout(workout.id));
            list.appendChild(card);
        }
    });

    document.getElementById('btn-schedule-new').classList.remove('hidden');
}

// Fix 4: Scheduling Workouts correctly
document.getElementById('btn-schedule-new').addEventListener('click', () => {
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    if(appData.library.length === 0) {
        list.innerHTML = '<p style="color:black;">No saved workouts. Create one first!</p>';
    } else {
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

// --- BUILDER ENGINE ---
document.getElementById('add-set-btn').addEventListener('click', () => {
    builderState.sets.push({ repeat: 1, exercises: [] });
    renderBuilder();
});

document.getElementById('save-to-library-btn').addEventListener('click', () => {
    const wName = document.getElementById('workout-name').value || "My Workout";
    const wTime = document.getElementById('time-select').value;

    appData.library.push({
        id: 'wk_' + Date.now(),
        name: wName,
        time: wTime,
        sets: JSON.parse(JSON.stringify(builderState.sets)) 
    });
    saveData();

    builderState = { name: "", time: "10", sets: [] };
    document.getElementById('workout-name').value = "";
    alert("Workout Saved to Library!");
    switchView('view-calendar');
});

// Fix 2: Up/Down Counter for Set Multiplier
window.changeSetRepeat = function(setIdx, delta) {
    const current = builderState.sets[setIdx].repeat;
    builderState.sets[setIdx].repeat = Math.max(1, current + delta); // Cannot go below 1
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
            ${set.exercises.map(ex => `<div class="exercise-row"><span>${ex.name}</span><span>${ex.val} ${ex.label} <span style="color:#888; margin-left:10px;">✏️</span></span></div>`).join('')}
            <button class="btn-add-ex full-width" onclick="openModal(${idx})">+ New Exercise</button>
        `;
        container.appendChild(card);
    });
}

// Modal Editor (Retained)
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
        type: mMode,
        val: mVal,
        label: mMode === 'timed' ? timeUnit : 'ct'
    });
    document.getElementById('modal-overlay').classList.add('hidden');
    renderBuilder();
}

// --- LIVE WORKOUT EXECUTION ENGINE ---
// Fix 1: Timed Exercises Logic
window.startWorkout = function(id) {
    const template = appData.library.find(w => w.id === id);
    if(!template) return;

    activeSession = { name: template.name, total: 0, completed: 0, tasks: [] };

    template.sets.forEach((set, sIdx) => {
        for(let r=0; r<set.repeat; r++) {
            set.exercises.forEach((ex, eIdx) => {
                activeSession.total++;
                activeSession.tasks.push({
                    id: `t_${sIdx}_${r}_${eIdx}_${Date.now()}`, // Unique IDs
                    name: ex.name,
                    type: ex.type,
                    val: ex.val,
                    label: ex.label,
                    done: false,
                    timeLeft: ex.type === 'timed' ? (ex.label === 'min' ? ex.val * 60 : ex.val) : null
                });
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
    
    if(activeSession.tasks.length === 0) {
        container.innerHTML = "<p style='color:white;text-align:center'>No exercises in this workout.</p>";
    }

    activeSession.tasks.forEach(t => {
        const row = document.createElement('div');
        row.className = 'exercise-row';
        
        let btnHTML = '';
        if(t.type === 'reps') {
            btnHTML = `<button class="${t.done ? 'btn-save-green' : 'btn-ghost'}" style="width:auto;margin:0;padding:10px 20px;border-width:2px; color:${t.done ? 'black' : 'white'}; border-color:white;" onclick="toggleTask('${t.id}')">${t.done ? 'Done' : 'Complete'}</button>`;
        } else {
            if(t.done) {
                btnHTML = `<button class="btn-save-green" style="width:auto;margin:0;padding:10px 20px">00:00</button>`;
            } else {
                const isRunning = !!activeTimers[t.id];
                const bg = isRunning ? '#2ecc71' : '#e74c3c';
                const format = secs => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                btnHTML = `<button style="background:${bg};color:${isRunning ? 'black' : 'white'};border:none;border-radius:12px;padding:10px 20px;font-weight:bold;cursor:pointer;" onclick="toggleTimer('${t.id}')">${format(t.timeLeft)}</button>`;
            }
        }

        row.innerHTML = `
            <div>
                <div style="font-size:1.2rem">${t.name}</div>
                <div style="color:#aaa;font-size:0.9rem">${t.val} ${t.label}</div>
            </div>
            ${btnHTML}
        `;
        container.appendChild(row);
    });

    const pct = activeSession.total === 0 ? 0 : (activeSession.completed / activeSession.total) * 100;
    document.getElementById('active-progress-bar').style.width = pct + '%';
}

window.toggleTask = function(id) {
    const t = activeSession.tasks.find(x => x.id === id);
    t.done = !t.done;
    activeSession.completed += t.done ? 1 : -1;
    renderActiveWorkout();
};

window.toggleTimer = function(id) {
    const t = activeSession.tasks.find(x => x.id === id);
    if(t.done) return;

    if(activeTimers[id]) {
        // Pause Timer
        clearInterval(activeTimers[id]);
        delete activeTimers[id];
        renderActiveWorkout();
    } else {
        // Start Timer
        activeTimers[id] = setInterval(() => {
            t.timeLeft--;
            if(t.timeLeft <= 0) {
                clearInterval(activeTimers[id]);
                delete activeTimers[id];
                t.done = true;
                activeSession.completed++;
            }
            renderActiveWorkout();
        }, 1000);
        renderActiveWorkout(); 
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
    alert("Workout complete!");
    switchView('view-calendar');
});
