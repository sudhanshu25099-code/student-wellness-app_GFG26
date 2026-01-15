/**
 * 30-Second Stress Check Logic
 * Handles the multi-step modal flow, ethical guardrails, and recommendations.
 */

// State
let checkState = {
    source: '',
    intensity: 5,
    time: 0
};

// Start the check-in
function startStressCheck() {
    // Reset state
    checkState = { source: '', intensity: 5, time: 0 };

    // Reset UI
    document.getElementById('intensity-slider').value = 5;
    updateIntensityLabel(5);

    // Show Modal
    document.getElementById('stress-check-modal').classList.remove('hidden');
    setStep(1);
}

// Close the check-in
function closeStressCheck() {
    document.getElementById('stress-check-modal').classList.add('hidden');
}

// Navigate between steps
function setStep(step) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));

    // Show current step
    if (step === 'crisis') {
        document.getElementById('step-crisis').classList.remove('hidden');
        updateProgress(100); // Crisis is a "stop" state
    } else {
        document.getElementById(`step-${step}`).classList.remove('hidden');
        // Update Progress Bar (33%, 66%, 100%)
        updateProgress(step * 33);
    }
}

function updateProgress(percent) {
    document.getElementById('check-progress').style.width = `${percent}%`;
}

// Step 1: Select Source
function selectSource(source) {
    checkState.source = source;
    console.log(`Source selected: ${source}`);
    setStep(2);
}

// Step 2: Intensity Logic
function updateIntensityLabel(val) {
    checkState.intensity = parseInt(val);
    document.getElementById('intensity-value').innerText = `${val}/10`;

    // Dynamic color for intensity
    const valueDisplay = document.getElementById('intensity-value');
    if (val <= 4) valueDisplay.className = "mt-4 text-4xl font-bold text-brand-600";
    else if (val <= 7) valueDisplay.className = "mt-4 text-4xl font-bold text-orange-500";
    else valueDisplay.className = "mt-4 text-4xl font-bold text-red-600";
}

function confirmIntensity() {
    const intensity = checkState.intensity;

    // Log to backend
    fetch('/api/log_stress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            level: intensity,
            source: checkState.source
        })
    }).then(res => res.json())
        .then(data => {
            console.log("Logged stress:", data);
            // Refresh graph if it exists
            if (typeof loadStressGraph === 'function') loadStressGraph();
        })
        .catch(err => console.error("Error logging stress:", err));

    // ETHICAL GUARDRAIL: If stress >= 8, trigger crisis intervention
    if (intensity >= 8) {
        setStep('crisis');
    } else {
        setStep(3);
    }
}

// Step 3: Time Selection & Recommendation
function selectTime(minutes) {
    checkState.time = minutes;
    console.log("Check complete:", checkState);

    // Close modal
    closeStressCheck();

    // Route to solution
    routeToSolution(minutes);
}

function routeToSolution(minutes) {
    const source = checkState.source;

    // 2 Minutes -> Instant Panic Mode (Breathing)
    if (minutes === 2) {
        // Trigger the Panic Mode overlay from main.js/panic.js logic
        // We can simulate a click on the "Panic Mode" button if it exists, 
        // or directly call the function if available.
        // Assuming startPanicMode() is globally available or we can trigger the overlay.

        // Let's assume we can trigger the existing panic overlay directly
        const panicOverlay = document.getElementById('panic-overlay');
        if (panicOverlay) {
            panicOverlay.classList.remove('hidden');
            // Start breathing logic if not auto-started
            if (typeof startBreathingAnimation === 'function') {
                startBreathingAnimation();
            }
        }
    }
    // 5 Minutes -> Chat with Willow (Context Injection)
    else if (minutes === 5) {
        // Scroll to chat
        const chatSection = document.getElementById('chat-interface');
        if (chatSection) chatSection.scrollIntoView({ behavior: 'smooth' });

        // Inject context into chat input (if possible) or just focus
        // We could theoretically send a hidden system message, but for now let's just focus.
        // Better: Populate the input field
        const chatInput = document.getElementById('user-input');
        if (chatInput) {
            chatInput.value = `I'm feeling stressed about ${source} (Level ${checkState.intensity}). Can we talk for 5 minutes?`;
            chatInput.focus();
        }
    }
    // 10 Minutes -> Focus Zone or Tools
    else if (minutes === 10) {
        // Redirect to appropriate tool based on source
        if (source === 'Exam/Deadline' || source === 'Overthinking') {
            window.location.href = '/focus'; // Focus Zone
        } else {
            window.location.href = '/tools'; // Tools (Sleep, Chunking)
        }
    }
}

// Crisis Handlers
function startPanicModeFromCheck() {
    closeStressCheck();
    // Trigger main panic mode
    const panicOverlay = document.getElementById('panic-overlay');
    if (panicOverlay) {
        panicOverlay.classList.remove('hidden');
        if (typeof startBreathingAnimation === 'function') {
            startBreathingAnimation();
        }
    }
}

function overrideCrisis() {
    // User chose to continue despite high stress
    setStep(3);
}

// Make accessible globally
window.startStressCheck = startStressCheck;
window.closeStressCheck = closeStressCheck;
window.selectSource = selectSource;
window.updateIntensityLabel = updateIntensityLabel;
window.confirmIntensity = confirmIntensity;
window.selectTime = selectTime;
window.startPanicModeFromCheck = startPanicModeFromCheck;
window.overrideCrisis = overrideCrisis;
window.setStep = setStep;
