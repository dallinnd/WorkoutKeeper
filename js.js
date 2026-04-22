// --- 1. STATE MANAGEMENT ---
let appState = {
    name: "",
    theme: "purple",
    time: "120m",
    sets: []
};

// Modal specific state
let targetSetIndex = null;
let modalMode = 'reps'; // 'reps' or 'timed'
let timeUnit = 'sec'; // 'sec' or 'min'
let modalValue = 10;

// --- 2. INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Load from storage safely
    try {
        const saved = localStorage.getItem('workoutKeeperData');
        if (saved) {
            appState = JSON.parse(saved);
        }
    } catch (e) {
        console.error("Could not load save data, starting fresh.");
    }

    // Force at least one set to exist
    if (!appState.sets || appState.sets.length === 0) {
        appState.sets = [{ repeat: 1, exercises: [] }];
    }

    // Bind static inputs to state
    document.getElementById('workout-name').value = appState.name || "";
    document.getElementById('time-select').value = appState.time || "120m";

    // Initial Draw
    applyTheme(appState.theme);
    renderApp();
});

// --- 3. CORE RENDER FUNCTION ---
function renderApp() {
    const container = document.getElementById('sets-container');
    container.innerHTML = ''; 

    appState.sets.forEach((set, setIndex) => {
        const card = document.createElement('div');
        card.className = 'set-card';
        
        let exercisesHTML = '';
        set.exercises.forEach((ex) => {
            // Use the saved label, fallback to old logic if it's an older save
            const label = ex.label || (ex.type === 'reps' ? 'ct' : 'sec');
            exercisesHTML += `
                <div class="exercise-row">
                    <span>${ex.name}</span>
                    <span>${ex.value} ${label}</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="set-header">
                <span>Set ${setIndex + 1}</span>
                <span>x <input type="number" min="1" value="${set.repeat}" onchange="updateRepeat(${setIndex}, this.value)"></span>
            </div>
            <div class="exercises-list">
                ${exercisesHTML}
            </div>
            <button class="add-ex-btn" onclick="openModal(${setIndex})">+ New Exercise</button>
        `;

        container.appendChild(card);
    });

    saveData();
}

// --- 4. DATA MUTATIONS ---
function applyTheme(themeName) {
    appState.theme = themeName;
    document.body.className = `theme-${themeName}`;
    
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.theme === themeName);
    });
    saveData();
}

function updateRepeat(setIndex, newRepeatValue) {
    appState.sets[setIndex].repeat = parseInt(newRepeatValue) || 1;
    saveData();
}

function saveData() {
    appState.name = document.getElementById('workout-name').value;
    appState.time = document.getElementById('time-select').value;
    localStorage.setItem('workoutKeeperData', JSON.stringify(appState));
}

// --- 5. EVENT LISTENERS ---
document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => applyTheme(e.target.dataset.theme));
});

document.getElementById('add-set-btn').addEventListener('click', () => {
    appState.sets.push({ repeat: 1, exercises: [] });
    renderApp();
});

document.getElementById('workout-name').addEventListener('input', saveData);
document.getElementById('time-select').addEventListener('change', saveData);

// --- 6. MODAL LOGIC & SAVING ---
const modalOverlay = document.getElementById('modal-overlay');

window.openModal = function(setIndex) {
    targetSetIndex = setIndex;
    document.getElementById('modal-name').value = '';
    modalValue = 10;
    setModalMode('reps'); // Reset to reps
    setTimeUnit('sec'); // Reset to seconds
    updateModalCounter();
    modalOverlay.classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
});

// Main Toggles
document.getElementById('toggle-reps').addEventListener('click', () => setModalMode('reps'));
document.getElementById('toggle-timed').addEventListener('click', () => setModalMode('timed'));

function setModalMode(mode) {
    modalMode = mode;
    document.getElementById('toggle-reps').classList.toggle('active', mode === 'reps');
    document.getElementById('toggle-timed').classList.toggle('active', mode === 'timed');
    
    const unitContainer = document.getElementById('time-unit-container');
    if (mode === 'timed') {
        unitContainer.classList.remove('hidden');
    } else {
        unitContainer.classList.add('hidden');
    }
}

// Sub Toggles (Sec/Min)
document.getElementById('unit-sec').addEventListener('click', () => setTimeUnit('sec'));
document.getElementById('unit-min').addEventListener('click', () => setTimeUnit('min'));

function setTimeUnit(unit) {
    timeUnit = unit;
    document.getElementById('unit-sec').classList.toggle('active', unit === 'sec');
    document.getElementById('unit-min').classList.toggle('active', unit === 'min');
}

// Smart Counter Logic
function getStepAmount() {
    if (modalMode === 'reps') return 1;
    if (modalMode === 'timed' && timeUnit === 'min') return 1;
    return 5; // Timed and Seconds
}

document.getElementById('counter-minus').addEventListener('click', () => {
    const step = getStepAmount();
    if (modalValue >= step) modalValue -= step;
    updateModalCounter();
});

document.getElementById('counter-plus').addEventListener('click', () => {
    const step = getStepAmount();
    modalValue += step;
    updateModalCounter();
});

function updateModalCounter() {
    document.getElementById('counter-value').innerText = modalValue;
}

// Save Exercise to Set
document.getElementById('modal-save').addEventListener('click', () => {
    const exName = document.getElementById('modal-name').value || "Exercise";
    
    let displayLabel = 'ct';
    if (modalMode === 'timed') {
        displayLabel = timeUnit; // 'sec' or 'min'
    }

    appState.sets[targetSetIndex].exercises.push({
        name: exName,
        type: modalMode,
        value: modalValue,
        label: displayLabel 
    });
    
    modalOverlay.classList.add('hidden');
    renderApp(); 
});

// --- 7. EXPORT / SAVE WORKOUT BUTTON ---
document.getElementById('save-workout-btn').addEventListener('click', () => {
    saveData(); 
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    let fileName = appState.name ? appState.name.replace(/\s+/g, '_').toLowerCase() : "my_workout";
    downloadAnchorNode.setAttribute("download", fileName + ".json");
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});
