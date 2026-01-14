// Task Scheduler - Drag and Drop Task Management with Modal
let taskIdCounter = 0;
let tasks = JSON.parse(localStorage.getItem('matrixTasks') || '{}');
let selectedQuadrant = 'do'; // Default selection

// Load existing tasks from localStorage
window.addEventListener('DOMContentLoaded', () => {
    Object.keys(tasks).forEach(quadrant => {
        const quadrantElement = document.getElementById(`quadrant-${quadrant}`);
        tasks[quadrant].forEach(taskText => {
            createTaskElement(taskText, quadrantElement);
        });
    });
});

// Open add task modal
function openAddTaskModal() {
    document.getElementById('add-task-modal').classList.remove('hidden');
    document.getElementById('modal-task-input').value = '';
    document.getElementById('modal-task-input').focus();

    // Reset selection to default
    selectedQuadrant = 'do';
    updateQuadrantSelection();
}

// Close add task modal
function closeAddTaskModal() {
    document.getElementById('add-task-modal').classList.add('hidden');
}

// Select quadrant
function selectQuadrant(quadrantName) {
    selectedQuadrant = quadrantName;
    updateQuadrantSelection();
}

// Update visual selection
function updateQuadrantSelection() {
    document.querySelectorAll('.quadrant-option').forEach(btn => {
        btn.classList.remove('ring-4', 'ring-brand-500', 'ring-offset-2');
    });
    document.getElementById(`select-${selectedQuadrant}`).classList.add('ring-4', 'ring-brand-500', 'ring-offset-2');
}

// Confirm and add task from modal
function confirmAddTask() {
    const input = document.getElementById('modal-task-input');
    const taskText = input.value.trim();

    if (!taskText) {
        alert('Please enter a task description');
        return;
    }

    const quadrant = document.getElementById(`quadrant-${selectedQuadrant}`);
    createTaskElement(taskText, quadrant);
    saveTasks();
    closeAddTaskModal();
}

// Add task directly to a specific quadrant (from + buttons)
function addTaskToQuadrant(quadrantName) {
    const taskText = prompt('Enter task:');

    if (!taskText || !taskText.trim()) return;

    const quadrant = document.getElementById(`quadrant-${quadrantName}`);
    createTaskElement(taskText.trim(), quadrant);
    saveTasks();
}

// Create task element
function createTaskElement(text, quadrant) {
    const taskId = `task-${taskIdCounter++}`;
    const task = document.createElement('div');
    task.id = taskId;
    task.className = 'task-item bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-all';
    task.draggable = true;
    task.ondragstart = drag;

    task.innerHTML = `
        <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-slate-800 flex-1">${text}</span>
            <button onclick="deleteTask('${taskId}')" class="text-red-500 hover:text-red-700 text-xl leading-none">
                ×
            </button>
        </div>
    `;

    quadrant.appendChild(task);
}

// Drag and drop functions
function allowDrop(e) {
    e.preventDefault();
}

function drag(e) {
    e.dataTransfer.setData('taskId', e.target.id);
}

function drop(e) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = document.getElementById(taskId);

    // Get the quadrant
    let dropTarget = e.target;
    while (dropTarget && !dropTarget.hasAttribute('data-quadrant')) {
        dropTarget = dropTarget.parentElement;
    }

    if (dropTarget && task) {
        dropTarget.appendChild(task);
        saveTasks();
    }
}

// Delete task
function deleteTask(taskId) {
    const task = document.getElementById(taskId);
    if (task && confirm('Delete this task?')) {
        task.remove();
        saveTasks();
    }
}

// Save tasks to localStorage
function saveTasks() {
    tasks = {
        do: [],
        schedule: [],
        delegate: [],
        delete: []
    };

    Object.keys(tasks).forEach(quadrant => {
        const quadrantElement = document.getElementById(`quadrant-${quadrant}`);
        const taskElements = quadrantElement.querySelectorAll('.task-item');

        taskElements.forEach(taskEl => {
            const text = taskEl.querySelector('span').textContent;
            tasks[quadrant].push(text);
        });
    });

    localStorage.setItem('matrixTasks', JSON.stringify(tasks));
}

// Handle Enter key in modal
document.addEventListener('DOMContentLoaded', () => {
    const modalInput = document.getElementById('modal-task-input');
    if (modalInput) {
        modalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmAddTask();
            }
        });
    }
});

// Global functions
window.openAddTaskModal = openAddTaskModal;
window.closeAddTaskModal = closeAddTaskModal;
window.selectQuadrant = selectQuadrant;
window.confirmAddTask = confirmAddTask;
window.addTaskToQuadrant = addTaskToQuadrant;
window.deleteTask = deleteTask;
window.allowDrop = allowDrop;
window.drop = drop;
