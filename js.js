let appData = {
    library: [], 
    schedule: {} 
};

let currentDate = new Date(); 
let selectedDateStr = currentDate.toISOString().split('T')[0]; 
let builderState = { name: "", time: "10", sets: [] };

// Execution Engine State
let activeSession = null;
let activeTimers = {};

window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_final');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    // Auto-populate library for testing if empty
    if(appData.library.length === 0) {
        appData.library.push({id: 'w1', name: 'Workout #1', time: '5', sets: []});
        appData.library.push({id: 'w2', name: 'Wednesday Evening', time: '10', sets: []});
    }

    setupRouter();
    renderCalendar();
    showDailySchedule(selectedDateStr);
});

function saveData() {
    localStorage.setItem('wk_data_final', JSON.stringify(appData));
}

// --- VIEW ROUTER ---
// Central logic to switch between pages and hide nav bars properly
function switchView(targetId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    
    // Update navigation dots
    document.querySelectorAll('.nav-btn').forEach(b => {
        if(b.dataset.target) b.classList.toggle('active', b.dataset.target === targetId);
    });

    // Handle Themes & Bottom Nav Visibility
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
        
        // Add indicator dot
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

document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

// --- SCHEDULE CARDS ---
function showDailySchedule(dateStr) {
    const todayStr = new Date().toISOString().split('T')[0];
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
            // Trigger Live Tracker when clicked
            card.addEventListener('click', () => startWorkout(workout.id));
            list.appendChild(card);
        }
    });

    document.getElementById('btn-schedule-new').classList.remove('hidden');
}

// Scheduling a new workout from library
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
        sets: JSON.parse(JSON.stringify(builderState.sets)) // Deep copy
    });
    saveData();

    // Reset Builder and Return Home!
    builderState = { name: "", time: "10", sets: [] };
    document.getElementById('workout-name').value = "";
    alert("Workout Saved to Library!");
    switchView('view-calendar');
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
                <div>x <select onchange="builderState.sets[${idx}].repeat = parseInt(this.value)">
                    <option ${set.repeat===1?'selected':''}>1</option>
                    <option ${set.repeat===2?'selected':''}>2</option>
                    <option ${set.repeat===3?'selected':''}>3</option>
                </select></div>
            </div>
            ${set.exercises.map(ex => `<div class="exercise-row"><span>${ex.name}</span><span>${ex.val} ${ex.label} <span style="color:#888; margin-left:10px;">✏️</span></span></div>`).join('')}
            <button class="btn-add-ex full-width" onclick="openModal(${idx})">+ New Exercise</button>
        `;
        container.appendChild(card);
    });
}

// Modal Editor
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
window.startWorkout = function(id) {
    const template = appData.library.find(w => w.id === id);
    if(!template) return;

    activeSession = {
        name: template.name, total: 0, completed: 0, tasks: []
    };

    template.sets.forEach((set, sIdx) => {
        for(let r=0; r<set.repeat; r++) {
            set.exercises.forEach((ex, eIdx) => {
                activeSession.total++;
                activeSession.tasks.push({
                    id: `t_${sIdx}_${r}_${eIdx}`,
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
            btnHTML = `<button class="${t.done ? 'btn-save-green' : 'btn-ghost'}" style="width:auto;margin:0;padding:10px 20px;border-width:2px;" onclick="toggleTask('${t.id}')">${t.done ? 'Done' : 'Complete'}</button>`;
        } else {
            if(t.done) {
                btnHTML = `<button class="btn-save-green" style="width:auto;margin:0;padding:10px 20px">00:00</button>`;
            } else {
                const isRunning = !!activeTimers[t.id];
                const bg = isRunning ? '#2ecc71' : '#e74c3c';
                const format = secs => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                btnHTML = `<button style="background:${bg};color:white;border:none;border-radius:12px;padding:10px 20px;font-weight:bold;cursor:pointer;" onclick="toggleTimer('${t.id}')">${format(t.timeLeft)}</button>`;
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
        clearInterval(activeTimers[id]);
        delete activeTimers[id];
        renderActiveWorkout();
    } else {
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
        renderActiveWorkout(); // Force green running state
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
