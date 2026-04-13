// Initial Data Structure
let workoutData = {
    name: "",
    theme: "purple",
    sets: []
};

let currentTargetSet = null;
let currentExMode = 'reps';

// --- CORE FUNCTIONS ---

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    workoutData.theme = theme;
    document.querySelectorAll('.dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === theme);
    });
    saveToCache();
}

function addNewSet() {
    workoutData.sets.push({ id: Date.now(), repeat: 1, exercises: [] });
    renderBuilder();
    saveToCache();
}

function renderBuilder() {
    const container = document.getElementById('builder-area');
    if (!container) return;
    
    container.innerHTML = '';
    
    workoutData.sets.forEach((set, idx) => {
        const div = document.createElement('div');
        div.className = 'set-card';
        div.innerHTML = `
            <div class="set-header">
                <strong>Set ${idx + 1}</strong>
                <div class="set-ctrl">
                    x <input type="number" class="set-rep-input" value="${set.repeat}" data-idx="${idx}">
                </div>
            </div>
            <div class="ex-list">
                ${set.exercises.map(ex => `
                    <div class="ex-row">
                        <span>${ex.name}</span>
                        <span>${ex.val} ${ex.type === 'reps' ? 'ct' : 'sec'}</span>
                    </div>
                `).join('')}
            </div>
            <button class="add-ex-trigger" data-idx="${idx}">+ New Exercise</button>
        `;
        container.appendChild(div);
    });
}

function saveToCache() {
    localStorage.setItem('workoutKeep_save', JSON.stringify(workoutData));
}

// --- EVENT LISTENERS (The "Safety" Way) ---

document.addEventListener('click', (e) => {
    // Theme Switcher
    if (e.target.classList.contains('dot')) {
        setTheme(e.target.dataset.color);
    }
    
    // Add Set
    if (e.target.id === 'add-set-btn') {
        addNewSet();
    }
    
    // Open Modal
    if (e.target.classList.contains('add-ex-trigger')) {
        currentTargetSet = e.target.dataset.idx;
        document.getElementById('ex-modal').classList.remove('hidden');
    }

    // Modal Controls
    if (e.target.id === 'modal-close') document.getElementById('ex-modal').classList.add('hidden');
    
    if (e.target.id === 'mode-reps') setExMode('reps');
    if (e.target.id === 'mode-timed') setExMode('timed');
    
    if (e.target.id === 'val-minus') adjustVal(-5);
    if (e.target.id === 'val-plus') adjustVal(5);
    
    if (e.target.id === 'modal-save') {
        const name = document.getElementById('modal-ex-name').value || "Exercise";
        const val = document.getElementById('modal-val').innerText;
        workoutData.sets[currentTargetSet].exercises.push({
            name: name,
            type: currentExMode,
            val: val
        });
        document.getElementById('ex-modal').classList.add('hidden');
        renderBuilder();
        saveToCache();
    }
});

function setExMode(mode) {
    currentExMode = mode;
    document.getElementById('mode-reps').classList.toggle('active', mode === 'reps');
    document.getElementById('mode-timed').classList.toggle('active', mode === 'timed');
}

function adjustVal(amt) {
    const el = document.getElementById('modal-val');
    el.innerText = Math.max(0, parseInt(el.innerText) + amt);
}

// --- APP STARTUP ---

window.onload = () => {
    const saved = localStorage.getItem('workoutKeep_save');
    if (saved) {
        try {
            workoutData = JSON.parse(saved);
            setTheme(workoutData.theme || 'purple');
        } catch(e) {
            console.error("JSON Parse Error");
        }
    }
    
    // If no sets exist, start with one
    if (workoutData.sets.length === 0) {
        addNewSet();
    } else {
        renderBuilder();
    }
};
