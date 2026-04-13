let workoutData = {
    name: "",
    theme: "purple",
    estTime: "1.5-2 hours",
    sets: []
};

let currentTargetSet = null;
let currentExMode = 'reps';

// Initialize
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    workoutData.theme = theme;
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
    document.querySelector(`.${theme}`).classList.add('active');
    saveToCache();
}

function addNewSet() {
    workoutData.sets.push({ id: Date.now(), repeat: 1, exercises: [] });
    renderBuilder();
}

function renderBuilder() {
    const container = document.getElementById('builder-area');
    container.innerHTML = '';
    
    workoutData.sets.forEach((set, idx) => {
        const div = document.createElement('div');
        div.className = 'set-card';
        div.innerHTML = `
            <div class="set-header">
                <strong>Set ${idx+1}</strong>
                <span>x ${set.repeat}</span>
            </div>
            <div id="ex-list-${idx}">
                ${set.exercises.map(ex => `
                    <div class="ex-row">
                        <span>${ex.name}</span>
                        <span>${ex.val} ${ex.type === 'reps' ? 'ct' : 'sec'}</span>
                    </div>
                `).join('')}
            </div>
            <button class="btn-footer-sec" onclick="openModal(${idx})">+ New Exercise</button>
        `;
        container.appendChild(div);
    });
}

// Modal Logic
function openModal(setIdx) {
    currentTargetSet = setIdx;
    document.getElementById('ex-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('ex-modal').classList.add('hidden');
}

function setExMode(mode) {
    currentExMode = mode;
    document.getElementById('mode-reps').classList.toggle('active', mode === 'reps');
    document.getElementById('mode-timed').classList.toggle('active', mode === 'timed');
}

function adjustVal(amt) {
    const el = document.getElementById('modal-val');
    let curr = parseInt(el.innerText);
    el.innerText = Math.max(0, curr + amt);
}

function saveExercise() {
    const name = document.getElementById('modal-ex-name').value || "Exercise";
    const val = document.getElementById('modal-val').innerText;
    
    workoutData.sets[currentTargetSet].exercises.push({
        name: name,
        type: currentExMode,
        val: val
    });
    
    closeModal();
    renderBuilder();
    saveToCache();
}

function saveToCache() {
    localStorage.setItem('workoutKeep_save', JSON.stringify(workoutData));
}

// Load on start
window.onload = () => {
    const saved = localStorage.getItem('workoutKeep_save');
    if(saved) {
        workoutData = JSON.parse(saved);
        setTheme(workoutData.theme);
        renderBuilder();
    }
};

