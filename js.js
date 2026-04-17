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

    // Force at least one set to exist so the page isn't blank
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
// This wipes the sets and redraws them exactly as the appState dictates
function renderApp() {
    const container = document.getElementById('sets-container');
    container.innerHTML = ''; // Clear it out

    appState.sets.forEach((set, setIndex) => {
        // Create the card
        const card = document.createElement('div');
        card.className = 'set-card';
        
        // Build the HTML for the exercises inside this set
        let exercisesHTML = '';
        set.exercises.forEach((ex) => {
            const label = ex.type === 'reps' ? 'ct' : 'sec';
            exercisesHTML += `
                <div class="exercise-row">
                    <span>${ex.name}</span>
                    <span>${ex.value} ${label}</span>
                </div>
            `;
        });

        // Put it all together
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

    saveData(); // Save every time we render
}

// --- 4. DATA MUTATIONS (Changing the state) ---
function applyTheme(themeName) {
    appState.theme = themeName;
    document.body.className = `theme-${themeName}`;
    
    // Update active dot
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
    // Grab the top level inputs before saving
    appState.name = document.getElementById('workout-name').value;
    appState.time = document.getElementById('time-select').value;
    
    localStorage.setItem('workoutKeeperData', JSON.stringify(appState));
}

// --- 5. EVENT LISTENERS ---

// Theme clicking
document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
        applyTheme(e.target.dataset.theme);
    });
});

// Add new set button
document.getElementById('add-set-btn').addEventListener('click', () => {
    appState.sets.push({ repeat: 1, exercises: [] });
    renderApp();
});

// Name & Time blur/change saves
document.getElementById('workout-name').addEventListener('input', saveData);
document.getElementById('time-select').addEventListener('change', saveData);

// --- 6. MODAL LOGIC ---
const modalOverlay = document.getElementById('modal-overlay');

window.openModal = function(setIndex) {
    targetSetIndex = setIndex;
    
    // Reset modal state
    document.getElementById('modal-name').value = '';
    modalValue = 10;
    updateModalCounter();
    setModalMode('reps');
    
    modalOverlay.classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
});

document.getElementById('toggle-reps').addEventListener('click', () => setModalMode('reps'));
document.getElementById('toggle-timed').addEventListener('click', () => setModalMode('timed'));

function setModalMode(mode) {
    modalMode = mode;
    document.getElementById('toggle-reps').classList.toggle('active', mode === 'reps');
    document.getElementById('toggle-timed').classList.toggle('active', mode === 'timed');
}

// Counter logic
document.getElementById('counter-minus').addEventListener('click', () => {
    if (modalValue > 0) modalValue -= 5;
    updateModalCounter();
});
document.getElementById('counter-plus').addEventListener('click', () => {
    modalValue += 5;
    updateModalCounter();
});
function updateModalCounter() {
    document.getElementById('counter-value').innerText = modalValue;
}

// Save Exercise
document.getElementById('modal-save').addEventListener('click', () => {
    const exName = document.getElementById('modal-name').value || "Exercise";
    
    // Push the new exercise to the correct set
    appState.sets[targetSetIndex].exercises.push({
        name: exName,
        type: modalMode,
        value: modalValue
    });
    
    modalOverlay.classList.add('hidden');
    renderApp(); // Redraw everything!
});
