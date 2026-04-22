// --- 1. GLOBAL STATE & DB ---
let appData = {
    library: [], // Array of built workout objects
    schedule: {}, // Dictionary: { "2026-04-21": ["workoutId1", "workoutId2"] }
};

let currentView = 'view-calendar';
let currentDate = new Date();
let selectedDateStr = "";
let activeWorkoutSession = null; // Holds state when a workout is running
let activeTimers = {}; // Holds setInterval IDs

// Modal states for builder
let builderState = { id: null, name: "", sets: [] };
let targetSetIndex = null, modalMode = 'reps', timeUnit = 'sec', modalValue = 10;

// --- 2. INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data');
        if (saved) appData = JSON.parse(saved);
    } catch(e) { console.error("Data load failed"); }

    setupRouter();
    renderCalendar();
});

function saveData() { localStorage.setItem('wk_data', JSON.stringify(appData)); }

// --- 3. SPA ROUTER ---
function setupRouter() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.dataset.target;
            switchView(target);
            // Update active nav styling
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    currentView = viewId;
    
    // Hide bottom nav if we are in an active workout
    document.getElementById('bottom-nav').style.display = (viewId === 'view-active') ? 'none' : 'flex';

    if(viewId === 'view-calendar') renderCalendar();
    if(viewId === 'view-builder') renderBuilder();
}

// --- 4. CALENDAR LOGIC ---
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    document.getElementById('month-display').innerText = new Date(year, month).toLocaleDateString('default', { month: 'long', year: 'numeric' });

    // Blank spaces for start of month
    for(let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        grid.appendChild(empty);
    }

    // Actual days
    for(let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = `day-cell ${dateStr === selectedDateStr ? 'selected' : ''}`;
        dayCell.innerText = i;
        
        // Show dot if workout scheduled
        if(appData.schedule[dateStr] && appData.schedule[dateStr].length > 0) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dayCell.appendChild(dot);
        }

        dayCell.addEventListener('click', () => {
            selectedDateStr = dateStr;
            renderCalendar(); // Re-render to update selection highlight
            showDailySchedule(dateStr);
        });

        grid.appendChild(dayCell);
    }
}

document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

// --- 5. SCHEDULING LOGIC ---
function showDailySchedule(dateStr) {
    document.getElementById('daily-schedule').classList.remove('hidden');
    document.getElementById('selected-date-title').innerText = `Schedule for ${dateStr}`;
    
    const list = document.getElementById('scheduled-workouts-list');
    list.innerHTML = '';

    const scheduledIds = appData.schedule[dateStr] || [];
    
    if(scheduledIds.length === 0) {
        list.innerHTML = '<p style="color:#888;">No workouts scheduled.</p>';
    } else {
        scheduledIds.forEach((id, index) => {
            const workout = appData.library.find(w => w.id === id);
            if(workout) {
                const item = document.createElement('div');
                item.className = 'scheduled-item';
                item.innerHTML = `
                    <strong>${workout.name}</strong>
                    <button class="btn-primary" onclick="startWorkout('${workout.id}')">Start</button>
                `;
                list.appendChild(item);
            }
        });
    }
}

document.getElementById('btn-schedule-new').addEventListener('click', () => {
    if(!selectedDateStr) return alert("Select a date first!");
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    
    if(appData.library.length === 0) {
        list.innerHTML = '<p>No saved workouts. Go to Create tab!</p>';
    } else {
        appData.library.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'btn-secondary full-width mt-10';
            btn.innerText = w.name;
            btn.onclick = () => {
                if(!appData.schedule[selectedDateStr]) appData.schedule[selectedDateStr] = [];
                appData.schedule[selectedDateStr].push(w.id);
                saveData();
                document.getElementById('schedule-modal').classList.add('hidden');
                showDailySchedule(selectedDateStr);
                renderCalendar();
            };
            list.appendChild(btn);
        });
    }
    document.getElementById('schedule-modal').classList.remove('hidden');
});
document.getElementById('close-schedule-modal').addEventListener('click', () => document.getElementById('schedule-modal').classList.add('hidden'));

// --- 6. ACTIVE WORKOUT ENGINE ---
window.startWorkout = function(workoutId) {
    const workoutTemplate = appData.library.find(w => w.id === workoutId);
    if(!workoutTemplate) return;

    // Build the execution session tracking
    activeWorkoutSession = {
        name: workoutTemplate.name,
        totalTasks: 0,
        completedTasks: 0,
        tasks: [] // flat list for rendering
    };

    workoutTemplate.sets.forEach((set, setIdx) => {
        for(let r = 0; r < set.repeat; r++) {
            set.exercises.forEach((ex, exIdx) => {
                activeWorkoutSession.totalTasks++;
                activeWorkoutSession.tasks.push({
                    id: `task_${setIdx}_${r}_${exIdx}`,
                    name: ex.name,
                    type: ex.type,
                    val: ex.value,
                    label: ex.label,
                    completed: false,
                    // If timed, convert everything to standard seconds for the engine
                    timeRemaining: ex.type === 'timed' ? (ex.label === 'min' ? ex.value * 60 : ex.value) : null
                });
            });
        }
    });

    document.getElementById('active-workout-title').innerText = activeWorkoutSession.name;
    renderActiveWorkout();
    switchView('view-active');
}

function renderActiveWorkout() {
    const container = document.getElementById('active-sets-container');
    container.innerHTML = '';

    activeWorkoutSession.tasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'task-row';
        
        let controlHTML = '';
        if(task.type === 'reps') {
            const btnClass = task.completed ? 'btn-done completed' : 'btn-done';
            const btnText = task.completed ? 'Done' : 'Complete';
            controlHTML = `<button class="${btnClass}" onclick="toggleTask('${task.id}')">${btnText}</button>`;
        } else {
            // Smart Timer UI
            if(task.completed) {
                controlHTML = `<button class="btn-timer finished">00:00 (Done)</button>`;
            } else {
                const isRunning = activeTimers[task.id] ? true : false;
                const btnClass = isRunning ? 'btn-timer running' : 'btn-timer ready';
                const formatTime = (secs) => `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
                
                controlHTML = `<button class="${btnClass}" onclick="handleTimer('${task.id}')">${formatTime(task.timeRemaining)}</button>`;
            }
        }

        row.innerHTML = `
            <div>
                <strong>${task.name}</strong><br>
                <small>${task.val} ${task.label}</small>
            </div>
            ${controlHTML}
        `;
        container.appendChild(row);
    });

    // Update Progress Bar
    const pct = (activeWorkoutSession.completedTasks / activeWorkoutSession.totalTasks) * 100;
    document.getElementById('active-progress-bar').style.width = `${pct}%`;
}

window.toggleTask = function(taskId) {
    const task = activeWorkoutSession.tasks.find(t => t.id === taskId);
    task.completed = !task.completed;
    activeWorkoutSession.completedTasks += task.completed ? 1 : -1;
    renderActiveWorkout();
}

window.handleTimer = function(taskId) {
    const task = activeWorkoutSession.tasks.find(t => t.id === taskId);
    if(task.completed) return;

    if(activeTimers[taskId]) {
        // Pause
        clearInterval(activeTimers[taskId]);
        delete activeTimers[taskId];
        renderActiveWorkout();
    } else {
        // Start/Resume
        activeTimers[taskId] = setInterval(() => {
            task.timeRemaining--;
            if(task.timeRemaining <= 0) {
                clearInterval(activeTimers[taskId]);
                delete activeTimers[taskId];
                task.completed = true;
                activeWorkoutSession.completedTasks++;
            }
            renderActiveWorkout();
        }, 1000);
        renderActiveWorkout(); // immediate render to show green state
    }
}

document.getElementById('btn-cancel-workout').addEventListener('click', () => {
    // Clear all intervals
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    activeWorkoutSession = null;
    switchView('view-calendar');
});

document.getElementById('btn-finish-workout').addEventListener('click', () => {
    if(activeWorkoutSession.completedTasks < activeWorkoutSession.totalTasks) {
        if(!confirm("You haven't finished all exercises. End anyway?")) return;
    }
    // Cleanup
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    activeWorkoutSession = null;
    alert("Workout Saved to your history!");
    switchView('view-calendar');
});

// --- 7. WORKOUT BUILDER (Abridged for brevity) ---
document.getElementById('add-set-btn').addEventListener('click', () => {
    builderState.sets.push({ repeat: 1, exercises: [] });
    renderBuilder();
});

document.getElementById('workout-name').addEventListener('input', (e) => builderState.name = e.target.value);

function renderBuilder() {
    const container = document.getElementById('sets-container');
    container.innerHTML = ''; 
    builderState.sets.forEach((set, setIndex) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        let exHTML = set.exercises.map(ex => `<div class="exercise-row"><span>${ex.name}</span><span>${ex.value} ${ex.label}</span></div>`).join('');
        card.innerHTML = `
            <div class="set-header"><span>Set ${setIndex + 1}</span><span>x <input type="number" min="1" value="${set.repeat}" onchange="builderState.sets[${setIndex}].repeat = parseInt(this.value)"></span></div>
            ${exHTML}
            <button class="btn-secondary full-width mt-10" onclick="openModal(${setIndex})">+ New Exercise</button>
        `;
        container.appendChild(card);
    });
}

document.getElementById('save-to-library-btn').addEventListener('click', () => {
    if(!builderState.name) return alert("Please name your workout!");
    if(builderState.sets.length === 0) return alert("Add at least one set!");
    
    appData.library.push({
        id: 'wk_' + Date.now(),
        name: builderState.name,
        sets: JSON.parse(JSON.stringify(builderState.sets)) // deep copy
    });
    saveData();
    
    // Reset builder
    builderState = { id: null, name: "", sets: [] };
    document.getElementById('workout-name').value = "";
    
    alert("Saved to Library!");
    switchView('view-calendar');
});

// Modal Toggles (Re-used from previous steps)
const modalOverlay = document.getElementById('modal-overlay');
window.openModal = function(setIdx) { targetSetIndex = setIdx; modalOverlay.classList.remove('hidden'); }
document.getElementById('modal-close').addEventListener('click', () => modalOverlay.classList.add('hidden'));
document.getElementById('toggle-reps').addEventListener('click', () => { modalMode = 'reps'; document.getElementById('time-unit-container').classList.add('hidden'); });
document.getElementById('toggle-timed').addEventListener('click', () => { modalMode = 'timed'; document.getElementById('time-unit-container').classList.remove('hidden'); });
document.getElementById('unit-sec').addEventListener('click', () => timeUnit = 'sec');
document.getElementById('unit-min').addEventListener('click', () => timeUnit = 'min');

function getStep() { return (modalMode === 'reps' || (modalMode === 'timed' && timeUnit === 'min')) ? 1 : 5; }
document.getElementById('counter-plus').addEventListener('click', () => { modalValue += getStep(); document.getElementById('counter-value').innerText = modalValue; });
document.getElementById('counter-minus').addEventListener('click', () => { if(modalValue > 0) modalValue -= getStep(); document.getElementById('counter-value').innerText = modalValue; });

document.getElementById('modal-save').addEventListener('click', () => {
    const name = document.getElementById('modal-name').value || "Exercise";
    const label = modalMode === 'timed' ? timeUnit : 'ct';
    builderState.sets[targetSetIndex].exercises.push({ name, type: modalMode, value: modalValue, label });
    modalOverlay.classList.add('hidden
