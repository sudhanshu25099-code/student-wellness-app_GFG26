// Pomodoro Timer Logic
let timeLeft = 25 * 60; // 25 minutes in seconds
let totalTime = 25 * 60;
let timerInterval = null;
let isWorkSession = true;
let isPaused = false;
let sessionsCompleted = 0;

const timerDisplay = document.getElementById('timer-display');
const progressRing = document.getElementById('progress-ring');
const sessionLabel = document.getElementById('session-label');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const sessionCount = document.getElementById('session-count');
const breakModal = document.getElementById('break-modal');
const breakPrompt = document.getElementById('break-prompt');

const circumference = 2 * Math.PI * 120; // radius = 120
progressRing.style.strokeDasharray = circumference;

const breakPrompts = [
    "Look at something 20 feet away for 20 seconds (20-20-20 rule)",
    "Stand up and do 10 gentle stretches",
    "Drink a full glass of water",
    "Take 5 deep breaths - in for 4, hold for 4, out for 6",
    "Walk around your room for 2 minutes",
    "Roll your shoulders and neck slowly",
    "Close your eyes and relax for 30 seconds"
];

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Update progress ring
    const progress = (totalTime - timeLeft) / totalTime;
    const offset = circumference * (1 - progress);
    progressRing.style.strokeDashoffset = offset;
}

function startTimer() {
    if (timerInterval) return; // Already running

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    isPaused = false;

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            onSessionComplete();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    isPaused = true;
}

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isWorkSession = true;
    timeLeft = 25 * 60;
    totalTime = 25 * 60;
    updateTimerDisplay();
    sessionLabel.textContent = 'Work Session';
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    progressRing.style.stroke = '#0ea5e9';
}

function onSessionComplete() {
    if (isWorkSession) {
        // Work session completed
        sessionsCompleted++;
        sessionCount.textContent = sessionsCompleted;

        // Start break
        isWorkSession = false;
        timeLeft = 5 * 60;
        totalTime = 5 * 60;
        sessionLabel.textContent = 'Break Time';
        progressRing.style.stroke = '#10b981';

        // Show break prompt
        showBreakPrompt();

    } else {
        // Break completed
        isWorkSession = true;
        timeLeft = 25 * 60;
        totalTime = 25 * 60;
        sessionLabel.textContent = 'Work Session';
        progressRing.style.stroke = '#0ea5e9';
    }

    updateTimerDisplay();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

function showBreakPrompt() {
    const randomPrompt = breakPrompts[Math.floor(Math.random() * breakPrompts.length)];
    breakPrompt.textContent = randomPrompt;
    breakModal.classList.remove('hidden');
}

function closeBreakModal() {
    breakModal.classList.add('hidden');
}

// Music Player
function changePlaylist(videoId) {
    const iframe = document.getElementById('youtube-player');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}`;
}

// Event Listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Global function for closing break modal
window.closeBreakModal = closeBreakModal;

// Initialize
updateTimerDisplay();
