// Sleep Calculator
function calculateSleep() {
    const wakeTimeInput = document.getElementById('wake-time').value;
    if (!wakeTimeInput) {
        alert('Please select a wake-up time');
        return;
    }

    const [hours, minutes] = wakeTimeInput.split(':').map(Number);
    const wakeTime = new Date();
    wakeTime.setHours(hours, minutes, 0, 0);

    const results = document.getElementById('sleep-results');
    const bedtimeList = document.getElementById('bedtime-list');

    bedtimeList.innerHTML = '';

    // Calculate bedtimes (90-min cycles + 15 min to fall asleep)
    const cycles = [6, 5, 4]; // 6 cycles = 9 hours, 5 = 7.5 hours, 4 = 6 hours
    const fallAsleepTime = 15; // minutes

    cycles.forEach((numCycles, index) => {
        const totalMinutes = (numCycles * 90) + fallAsleepTime;
        const bedtime = new Date(wakeTime.getTime() - totalMinutes * 60000);

        const bedtimeStr = bedtime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const hoursOfSleep = (numCycles * 90) / 60;
        const emoji = index === 0 ? '⭐' : index === 1 ? '✅' : '⚠️';
        const label = index === 0 ? 'Ideal' : index === 1 ? 'Good' : 'Minimum';

        bedtimeList.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                    <div class="font-bold text-slate-900">${bedtimeStr}</div>
                    <div class="text-xs text-slate-500">${hoursOfSleep.toFixed(1)} hours (${numCycles} cycles)</div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xl">${emoji}</span>
                    <span class="text-xs font-semibold text-slate-600">${label}</span>
                </div>
            </div>
        `;
    });

    results.classList.remove('hidden');
}

// Task Chunking Wizard
function chunkTask() {
    const taskName = document.getElementById('big-task').value;
    const days = parseInt(document.getElementById('days-available').value);

    if (!taskName || !days) {
        alert('Please fill in both fields');
        return;
    }

    const results = document.getElementById('chunk-results');
    const chunkList = document.getElementById('chunk-list');

    // Smart task breakdown based on common academic tasks
    let subtasks = [];

    const taskLower = taskName.toLowerCase();

    if (taskLower.includes('thesis') || taskLower.includes('paper') || taskLower.includes('essay')) {
        subtasks = [
            '📚 Research & gather 5-7 sources',
            '📝 Create detailed outline with main arguments',
            '✍️ Write introduction (10% of total)',
            '🔍 Draft body paragraphs (Section 1)',
            '🔍 Draft body paragraphs (Section 2)',
            '🔍 Draft body paragraphs (Section 3)',
            '🎯 Write conclusion & refine thesis',
            '✨ Edit for clarity & flow',
            '🔤 Proofread & check citations'
        ];
    } else if (taskLower.includes('study') || taskLower.includes('exam') || taskLower.includes('test')) {
        subtasks = [
            '📋 Review syllabus & identify key topics',
            '🗂️ Organize notes by chapter/topic',
            '📖 Read/skim Chapter 1-3',
            '📖 Read/skim Chapter 4-6',
            '✏️ Make flashcards for key terms',
            '🧠 Practice problems (Set 1)',
            '🧠 Practice problems (Set 2)',
            '👥 Study group or office hours',
            '🔄 Review all flashcards & weak spots'
        ];
    } else if (taskLower.includes('project') || taskLower.includes('assignment')) {
        subtasks = [
            '🎯 Read requirements & rubric carefully',
            '💡 Brainstorm 3 potential approaches',
            '📊 Create project outline/plan',
            '🛠️ Complete Part 1 (Foundation)',
            '🛠️ Complete Part 2 (Core work)',
            '🛠️ Complete Part 3 (Finishing touches)',
            '✅ Self-review against rubric',
            '🎨 Polish & final formatting'
        ];
    } else {
        // Generic breakdown
        subtasks = [
            '🎯 Clarify exact requirements',
            '📋 Break into 3-5 major parts',
            '🛠️ Complete Part 1',
            '🛠️ Complete Part 2',
            '🛠️ Complete Part 3',
            '✅ Review & refine',
            '✨ Final polish'
        ];
    }

    // Distribute tasks across available days
    const tasksPerDay = Math.ceil(subtasks.length / days);
    chunkList.innerHTML = '';

    let currentDay = 1;
    let tasksToday = [];

    subtasks.forEach((task, index) => {
        tasksToday.push(task);

        if (tasksToday.length === tasksPerDay || index === subtasks.length - 1) {
            chunkList.innerHTML += `
                <div class="p-3 bg-white rounded-lg">
                    <div class="font-bold text-purple-900 mb-2">Day ${currentDay}</div>
                    <ul class="space-y-1">
                        ${tasksToday.map(t => `<li class="text-sm text-slate-700">• ${t}</li>`).join('')}
                    </ul>
                </div>
            `;
            currentDay++;
            tasksToday = [];
        }
    });

    results.classList.remove('hidden');
}
