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

let activePreviewInstance = null; 
let activeSession = null;
let activeTimers = {};

const clockIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
const checkIcon = `<span style="color:#2ecc71; font-weight:bold; margin-right:10px;">✓</span>`;

// --- AUDIO CUES (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(type) {
    // Browsers require audio context to be resumed after a user gesture
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'countdown') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Standard Beep
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'finish') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Higher Ding!
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.6);
    }
}

// --- WAKE LOCK API ---
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock acquired');
        }
    } catch (err) {
        console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock released');
    }
}

// Re-acquire wake lock if user tabs out and comes back
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && activeSession !== null) {
        await requestWakeLock();
    }
});


// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = localStorage.getItem('wk_data_v10');
        if (saved) appData = JSON.parse(saved);
    } catch(e) {}
    
    if(appData.library.length === 0) {
        appData.library.push({
            id: 'wk_' + Date.now(), name: 'Workouts #1', time: '1.5 - 2 hours', theme: 'purple',
            sets: [{ repeat: 2, exercises: [
                {name: 'Pushups', type: 'reps', val: 20, label: 'ct'},
                {name: 'Planks', type: 'timed', val: 10, label: 'sec'} // 10 sec to easily test audio
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

function saveData() { localStorage.setItem('wk_data_v10', JSON.stringify(appData)); }

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

// --- DATA EXPORT / IMPORT ---
document.getElementById('btn-export-data').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const dlNode = document.createElement('a');
    dlNode.setAttribute("href", dataStr);
    dlNode.setAttribute("download", "workout_keeper_backup.json");
    document.body.appendChild(dlNode);
    dlNode.click();
    dlNode.remove();
});

document.getElementById('btn-import-data').addEventListener('click', () => {
    document.getElementById('file-import').click();
});

document.getElementById('file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if(importedData.library && importedData.schedule) {
                appData = importedData;
                saveData();
                renderProfile();
                alert("Workout data imported successfully!");
            } else {
                alert("Invalid backup file structure.");
            }
        } catch(err) {
            alert("Error parsing JSON file.");
        }
    };
    reader.readAsText(file);
});

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

document.getElementById('btn-schedule-new').addEventListener('click', () => {
    const list = document.getElementById('library-list');
    list.innerHTML = '';
    if(appData.library.length === 0) list.innerHTML = '<p style="color:black;">No saved workouts.</p>';
    else {
        appData.library.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'btn-ghost';
            btn.style.color = 'black'; btn.style.borderColor = 'rgba(0,0,0,0.2)';
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

// --- PROFILE / LIBRARY ---
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
        builderState = JSON.parse(JSON.stringify(w)); 
        switchView('view-builder');
    }
}

window.deleteWorkout = function(id) {
    if(!confirm("Are you sure you want to delete this workout? It will be removed from your schedule.")) return;
    appData.library = appData.library.filter(w => w.id !== id);
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
            let displayVal = ex.type === 'timed' ? 
                             `${Math.floor(ex.val/60)}:${String(ex.val%60).padStart(2,'0')}` 
                             : ex.val;

            exHtml += `<div class="ex-badge-row"><div><div class="ex-badge">${badgeContent}</div><span>${ex.name}</span></div><span style="font-size:1.1rem; opacity:0.8">${displayVal}</span></div>`;
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
    // Wake Lock Request!
    requestWakeLock();

    const template = appData.library.find(w => w.id === previewInstance.workoutId);
    if(!template) return;

    activeSession = { name: template.name, instanceId: previewInstance.instanceId, sets: [] };

    template.sets.forEach((set, sIdx) => {
        for(let r=0; r<set.repeat; r++) {
            const uniqueExercises = set.exercises.map((ex, eIdx) => ({
                ...ex,
                uid: `ex_${sIdx}_${r}_${eIdx}`,
                timeLeft: ex.val, 
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
    // Ensure audio API is unlocked when they click a timer
    if (audioCtx.state === 'suspended') audioCtx.resume();

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
            
            // AUDIO CUE LOGIC
            if (foundEx.timeLeft > 0 && foundEx.timeLeft <= 3) {
                playBeep('countdown');
            } else if (foundEx.timeLeft === 0) {
                playBeep('finish');
            }

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

// --- LIVE WORKOUT EXECUTION ENGINE ---
// ... (startWorkout, renderActiveWorkout, and toggleExerciseTimer stay the same) ...

let restInterval = null;
let restTimeLeft = 30;

window.toggleSetComplete = function(setId) {
    const set = activeSession.sets.find(s => s.id === setId);
    
    // Only trigger rest if turning it ON
    if (!set.isDone) {
        set.isDone = true;
        renderActiveWorkout();
        
        if(activeSession.sets.every(s => s.isDone)) {
            // ALL SETS DONE -> Trigger Cooldown
            setTimeout(() => {
                document.getElementById('cooldown-modal').classList.remove('hidden');
                playBeep('finish'); // Play ding!
            }, 500); 
        } else {
            // NOT LAST SET -> Trigger Rest
            setTimeout(() => {
                startRestTimer(30); // 30 seconds default rest
            }, 300);
        }
    } else {
        set.isDone = false; // Allow un-checking without triggering rest
        renderActiveWorkout();
    }
};

// --- REST TIMER LOGIC ---
function startRestTimer(seconds) {
    restTimeLeft = seconds;
    updateRestDisplay();
    document.getElementById('rest-modal').classList.remove('hidden');
    
    if(restInterval) clearInterval(restInterval);
    restInterval = setInterval(() => {
        restTimeLeft--;
        updateRestDisplay();
        
        if(restTimeLeft <= 3 && restTimeLeft > 0) playBeep('countdown');

        if(restTimeLeft <= 0) {
            endRestTimer();
            playBeep('finish');
        }
    }, 1000);
}

function updateRestDisplay() {
    let m = Math.floor(restTimeLeft / 60);
    let s = restTimeLeft % 60;
    document.getElementById('rest-timer-display').innerText = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function endRestTimer() {
    if(restInterval) clearInterval(restInterval);
    document.getElementById('rest-modal').classList.add('hidden');
}

document.getElementById('btn-skip-rest').addEventListener('click', endRestTimer);
document.getElementById('btn-add-rest').addEventListener('click', () => { 
    restTimeLeft += 15; 
    updateRestDisplay();
});

// --- COOLDOWN FINISH LOGIC ---
document.getElementById('btn-finish-cooldown').addEventListener('click', () => {
    document.getElementById('cooldown-modal').classList.add('hidden');
    
    // Finalize Workout Data
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
    if (typeof releaseWakeLock === 'function') releaseWakeLock();
    
    switchView('view-calendar');
});

// Manual Quit (Optional Escape Hatch)
document.getElementById('btn-cancel-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    if (typeof releaseWakeLock === 'function') releaseWakeLock();
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
    if (typeof releaseWakeLock === 'function') releaseWakeLock();
    switchView('view-calendar');
});

// ... (Builder engine code below stays the same) ...

document.getElementById('btn-finish-workout').addEventListener('click', () => {
    Object.values(activeTimers).forEach(clearInterval);
    activeTimers = {};
    const daySchedule = appData.schedule[selectedDateStr];
    if (daySchedule) {
        const item = daySchedule.find(i => i.instanceId === activeSession.instanceId);
        if (item) item.completed = true;
        saveData();
    }
    releaseWakeLock(); // Release lock on manual finish
    switchView('view-calendar');
});

// --- BUILDER ENGINE ---
document.getElementById('add-set-btn').addEventListener('click', () => { builderState.sets.push({ repeat: 1, exercises: [] }); renderBuilder(); });

document.getElementById('save-to-library-btn').addEventListener('click', () => {
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
    builderState = { id: null, name: "", time: "1.5 - 2 hours", theme: "purple", sets: [] };
    document.getElementById('workout-name').value = "";
    switchView('view-profile');
});

window.changeSetRepeat = function(setIdx, delta) {
    builderState.sets[setIdx].repeat = Math.max(1, builderState.sets[setIdx].repeat + delta);
    renderBuilder();
};

window.removeSet = function(setIdx) {
    if(confirm("Remove this set?")) {
        builderState.sets.splice(setIdx, 1);
        renderBuilder();
    }
};

window.removeExercise = function(setIdx, exIdx) {
    builderState.sets[setIdx].exercises.splice(exIdx, 1);
    renderBuilder();
};

function renderBuilder() {
    const container = document.getElementById('sets-container');
    container.innerHTML = '';
    
    document.getElementById('workout-name').value = builderState.name;
    document.getElementById('time-select').value = builderState.time;

    document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
    const dot = document.querySelector(`.theme-dot.${builderState.theme}`);
    if(dot) dot.classList.add('active');

    builderState.sets.forEach((set, idx) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        
        let exRows = set.exercises.map((ex, exIdx) => {
            let displayVal = ex.val;
            if(ex.type === 'timed') displayVal = `${Math.floor(ex.val/60)}:${String(ex.val%60).padStart(2,'0')}`;
            let label = ex.type === 'timed' ? '' : ex.label;
            
            return `
            <div class="exercise-row">
                <span>${ex.name}</span>
                <div style="display:flex; align-items:center;">
                    <span>${displayVal} ${label}</span>
                    <button class="btn-remove-ex" onclick="removeExercise(${idx}, ${exIdx})">✕</button>
                </div>
            </div>`;
        }).join('');

        card.innerHTML = `
            <div class="set-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>Set ${idx + 1}</span>
                    <button class="btn-remove-set" onclick="removeSet(${idx})">✕</button>
                </div>
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

// Modal Logic
let targetSet = null, mMode = 'reps';

window.openModal = function(idx) { 
    targetSet = idx; 
    document.getElementById('modal-overlay').classList.remove('hidden'); 
    document.getElementById('modal-name').value = '';
    
    mMode = 'reps';
    document.getElementById('toggle-reps').classList.add('active');
    document.getElementById('toggle-timed').classList.remove('active');
    document.getElementById('input-reps-container').classList.remove('hidden');
    document.getElementById('input-time-container').classList.add('hidden');
    
    document.getElementById('modal-val-reps').value = "10";
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

document.getElementById('modal-val-sec').addEventListener('input', function() {
    if(parseInt(this.value) > 59) this.value = 59;
});

document.getElementById('modal-save').onclick = () => {
    let finalVal = 0;
    if(mMode === 'reps') {
        finalVal = parseInt(document.getElementById('modal-val-reps').value) || 0;
    } else {
        const mins = parseInt(document.getElementById('modal-val-min').value) || 0;
        const secs = parseInt(document.getElementById('modal-val-sec').value) || 0;
        finalVal = (mins * 60) + secs; 
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
