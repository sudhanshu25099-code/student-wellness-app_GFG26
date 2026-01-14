document.addEventListener('DOMContentLoaded', () => {
    // --- Resource Hub Logic ---
    const resourceGrid = document.getElementById('resource-grid');

    // Fetch resources from API
    fetch('/api/resources')
        .then(response => response.json())
        .then(data => {
            renderResources(data);
        })
        .catch(err => console.error('Error loading resources:', err));

    function renderResources(resources) {
        resourceGrid.innerHTML = resources.map(resource => `
            <a href="${resource.url}" class="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div class="flex items-center justify-between mb-4">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 border border-brand-100">
                        ${resource.category}
                    </span>
                    <span class="text-gray-400">
                        ${getIconForType(resource.type)}
                    </span>
                </div>
                <h3 class="font-bold text-lg text-slate-800 mb-2 group-hover:text-brand-600 transition-colors">${resource.title}</h3>
                <p class="text-sm text-slate-500">Click to view this ${resource.type}...</p>
            </a>
        `).join('');
    }

    function getIconForType(type) {
        // Simple mock icons
        const icons = {
            'video': '🎥',
            'audio': '🎧',
            'article': '📄'
        };
        return icons[type] || '📌';
    }

    // --- Chatbot Logic ---
    const chatForm = document.getElementById('chat-form');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const helplineModal = document.getElementById('helpline-modal');
    const micBtn = document.getElementById('mic-btn');

    // Speech to Text Logic
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('text-red-500')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });

        recognition.onstart = () => {
            micBtn.classList.add('text-red-500', 'animate-pulse');
            userInput.placeholder = "Listening...";
        };

        recognition.onend = () => {
            micBtn.classList.remove('text-red-500', 'animate-pulse');
            userInput.placeholder = "Type your message...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            // Optional: Auto-submit
            // chatForm.dispatchEvent(new Event('submit')); 
        };
    } else {
        micBtn.style.display = 'none'; // Hide if not supported
        console.warn('Web Speech API not supported in this browser.');
    }

    // --- Text-to-Speech Logic ---
    const speakerToggle = document.getElementById('speaker-toggle');
    const speakerIcon = document.getElementById('speaker-icon');
    const speakerMutedIcon = document.getElementById('speaker-muted-icon');
    let ttsEnabled = false; // Voice responses disabled by default

    // Check if SpeechSynthesis is supported
    const ttsSupported = 'speechSynthesis' in window;
    if (!ttsSupported) {
        speakerToggle.style.display = 'none';
        console.warn('Text-to-Speech not supported in this browser.');
    }

    // Toggle TTS on/off
    speakerToggle.addEventListener('click', () => {
        ttsEnabled = !ttsEnabled;

        // Update icon
        if (ttsEnabled) {
            speakerIcon.classList.remove('hidden');
            speakerMutedIcon.classList.add('hidden');
            speakerToggle.classList.add('text-green-400');
            speakerToggle.classList.remove('text-white/80');
        } else {
            speakerIcon.classList.add('hidden');
            speakerMutedIcon.classList.remove('hidden');
            speakerToggle.classList.remove('text-green-400');
            speakerToggle.classList.add('text-white/80');
            // Stop any ongoing speech
            if (ttsSupported) {
                speechSynthesis.cancel();
            }
        }
    });

    // --- Voice Selection Logic (Human Lady Voice) ---
    let selectedVoice = null;
    function loadVoices() {
        if (!ttsSupported) return;
        const voices = speechSynthesis.getVoices();
        // Priority for Google Indian English or other Indian English female voices
        selectedVoice = voices.find(v => v.name.includes('Indian English') || v.lang === 'en-IN')
            || voices.find(v => v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Google US English'))
            || voices.find(v => v.name.toLowerCase().includes('female'))
            || voices[0];
    }

    if (ttsSupported) {
        loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    // Function to speak text
    function speakText(text) {
        if (!ttsEnabled || !ttsSupported || !text) return;

        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.05; // Slightly higher pitch for a warmer female tone
        utterance.volume = 1.0;

        speechSynthesis.speak(utterance);
    }

    // --- Personalized Greeting ---
    function sendWelcomeMessage() {
        const username = window.userContext?.username || 'friend';
        const welcomeText = `Hi ${username}! I'm Willow, your wellness companion. How are you feeling today? 🌿`;

        // Add message to UI
        setTimeout(() => {
            addMessage(welcomeText, 'bot');
            // We don't speak the welcome message immediately to avoid startling the user
            // and because TTS might be disabled by default.
        }, 1000);
    }

    // Trigger welcome
    sendWelcomeMessage();

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        // Add User Message
        addMessage(message, 'user');
        userInput.value = '';

        // Show typing indicator
        const typingId = addTypingIndicator();
        scrollToBottom();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            const data = await response.json();

            // Remove typing indicator
            removeMessage(typingId);

            // Check for crisis action
            if (data.action === 'trigger_helpline') {
                helplineModal.classList.remove('hidden');
                showCrisisBanner(); // Show persistent banner in chat
            } else if (data.action === 'trigger_panic') {
                startPanicMode();
            }

            // Add Bot Response
            addMessage(data.response, 'bot');

            // Speak the response if TTS is enabled
            speakText(data.response);

        } catch (error) {
            removeMessage(typingId);
            addMessage("Sorry, I'm having trouble connecting right now.", 'bot');
        }
    });

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `flex items-start gap-3 ${sender === 'user' ? 'flex-row-reverse' : ''}`;

        const avatar = sender === 'user'
            ? `<div class="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-xs">👤</div>`
            : `<div class="w-8 h-8 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center text-xs">🤖</div>`;

        const bubbleClass = sender === 'user'
            ? 'bg-brand-600 text-white rounded-tr-none shadow-brand-500/20'
            : 'bg-white text-slate-700 rounded-tl-none border border-gray-100';

        div.innerHTML = `
            ${avatar}
            <div class="${bubbleClass} p-4 rounded-2xl shadow-sm text-sm max-w-[85%] animate-fade-in">
                ${text}
            </div>
        `;

        chatBox.appendChild(div);
        scrollToBottom();
        return div.id = 'msg-' + Date.now();
    }

    function addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = `flex items-start gap-3`;
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center text-xs">🤖</div>
            <div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm text-sm text-slate-500">
                <span class="animate-pulse">...</span>
            </div>
        `;
        chatBox.appendChild(div);
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Modal Global Function
    window.closeModal = () => {
        helplineModal.classList.add('hidden');
    };

    function showCrisisBanner() {
        const existingBanner = document.getElementById('crisis-banner');
        if (existingBanner) return; // Don't duplicate

        const banner = document.createElement('div');
        banner.id = 'crisis-banner';
        banner.className = 'sticky top-0 z-10 bg-red-600 text-white p-4 text-xs font-bold text-center animate-pulse border-b border-red-500 shadow-lg';
        banner.innerHTML = `
            🚨 IMMEDIATE HELP AVAILABLE: 
            <a href="tel:988" class="underline ml-2">Call 988</a> 
            or 
            <button onclick="document.getElementById('get-help-btn').click()" class="underline ml-2">Request Counselor</button>
        `;
        chatBox.prepend(banner);
    }

    // --- Panic Mode Logic ---
    const panicOverlay = document.getElementById('panic-overlay');
    const exitPanic = document.getElementById('exit-panic');
    const breathCircle = document.getElementById('breath-circle');
    const breathText = document.getElementById('breath-text');

    function startPanicMode() {
        if (!panicOverlay) return;
        panicOverlay.classList.remove('hidden');
        panicOverlay.classList.remove('opacity-0');
        startBreathingExercise();
    }

    function endPanicMode() {
        if (!panicOverlay) return;
        panicOverlay.classList.add('opacity-0');
        setTimeout(() => {
            panicOverlay.classList.add('hidden');
        }, 500);
    }

    function startBreathingExercise() {
        let phase = 0; // 0=inhale, 1=hold, 2=exhale, 3=hold
        const phases = [
            { duration: 4000, scale: '1.5', text: 'Breathe In (4s)', color: 'bg-blue-400/30' },
            { duration: 4000, scale: '1.5', text: 'Hold (4s)', color: 'bg-blue-400/50' },
            { duration: 6000, scale: '1.0', text: 'Breathe Out (6s)', color: 'bg-blue-400/20' },
            { duration: 2000, scale: '1.0', text: 'Hold (2s)', color: 'bg-blue-400/10' }
        ];

        function nextPhase() {
            if (panicOverlay.classList.contains('hidden')) return; // Stop if closed

            const current = phases[phase];
            breathCircle.style.transform = `scale(${current.scale})`;
            breathCircle.style.transition = `all ${current.duration}ms ease-in-out`;
            breathText.textContent = current.text;

            // Apply color class
            breathCircle.className = `absolute inset-0 rounded-full border-4 border-blue-300 flex items-center justify-center ${current.color}`;

            setTimeout(() => {
                phase = (phase + 1) % phases.length;
                nextPhase();
            }, current.duration);
        }

        nextPhase();
    }

    if (exitPanic) {
        exitPanic.addEventListener('click', endPanicMode);
    }

    // --- Wellness Avatar Logic ---
    const wellnessTasks = document.querySelectorAll('.wellness-task');
    const xpBar = document.getElementById('xp-bar');
    const progressText = document.getElementById('progress-text');
    const plantLevel = document.getElementById('plant-level');
    const plantSprite = document.getElementById('plant-sprite');
    const dropletCountEl = document.getElementById('droplet-count');
    const waterPlantBtn = document.getElementById('water-plant-btn');

    // Load saved progress
    let currentXP = parseInt(localStorage.getItem('wellnessXP') || '0');
    let currentLevel = parseInt(localStorage.getItem('wellnessLevel') || '1');
    let droplets = parseInt(localStorage.getItem('wellnessDroplets') || '0');
    let completedToday = JSON.parse(localStorage.getItem('completedToday') || '[]');
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('lastDate') || '';

    // Reset daily tasks if new day
    if (today !== lastDate) {
        completedToday = [];
        localStorage.setItem('lastDate', today);
    }

    // Restore checkbox states
    wellnessTasks.forEach(task => {
        if (completedToday.includes(task.id)) {
            task.checked = true;
        }
    });

    // Update plant visualization
    function updatePlant() {
        const xpNeeded = currentLevel * 10;
        const progress = Math.min((currentXP / xpNeeded) * 100, 100);

        xpBar.style.width = `${progress}%`;
        progressText.textContent = `${currentXP} / ${xpNeeded} XP`;
        plantLevel.textContent = `Lv.${currentLevel}`;

        // Update Droplets UI
        if (dropletCountEl) dropletCountEl.textContent = droplets;
        if (waterPlantBtn) waterPlantBtn.disabled = droplets <= 0;

        let plantImg = '/static/images/p1.png';
        let statusText = 'Seedling';

        if (currentLevel >= 2 && currentLevel < 4) {
            plantImg = '/static/images/p2.png';
            statusText = 'Sprouting';
        } else if (currentLevel >= 4 && currentLevel < 6) {
            plantImg = '/static/images/p3.png';
            statusText = 'Growing';
        } else if (currentLevel >= 6) {
            plantImg = '/static/images/p4.png';
            statusText = 'Blooming';
        }

        if (plantSprite && plantSprite.src !== window.location.origin + plantImg) {
            // Smooth Cross-fade effect
            plantSprite.style.opacity = '0';
            setTimeout(() => {
                plantSprite.src = plantImg;
                plantSprite.style.opacity = '1';
            }, 300);

            // Update status text
            const statusTarget = document.getElementById('plant-stage-name');
            if (statusTarget) statusTarget.textContent = statusText;
        }

        // Level up if enough XP
        if (currentXP >= xpNeeded) {
            currentLevel++;
            currentXP = 0;
            localStorage.setItem('wellnessLevel', currentLevel);
            localStorage.setItem('wellnessXP', currentXP);

            // Celebration
            showCelebration();
            updatePlant();
        }
    }

    function showCelebration() {
        // Create a simple level up notification
        const toast = document.createElement('div');
        toast.className = 'fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-green-600 text-white px-8 py-4 rounded-3xl shadow-2xl font-bold animate-bounce-in';
        toast.innerHTML = `🎉 Level Up! Your plant is now Level ${currentLevel}!`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // --- Watering Mechanic ---
    if (waterPlantBtn) {
        waterPlantBtn.addEventListener('click', () => {
            if (droplets > 0) {
                droplets--;
                currentXP += 5; // Each watering gives 5 XP
                localStorage.setItem('wellnessDroplets', droplets);
                localStorage.setItem('wellnessXP', currentXP);

                // Visual feedback
                waterPlantBtn.classList.add('animate-ping');
                setTimeout(() => waterPlantBtn.classList.remove('animate-ping'), 500);

                // Glow effect on plant container
                const container = plantSprite.closest('div.relative');
                if (container) {
                    container.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50');
                    setTimeout(() => container.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50'), 1000);
                }

                updatePlant();
            }
        });
    }

    // Handle task completion
    wellnessTasks.forEach(task => {
        task.addEventListener('change', (e) => {
            const points = parseInt(e.target.dataset.points);
            const parentLabel = e.target.parentElement.parentElement;

            if (e.target.checked) {
                // Add Droplets instead of direct XP
                droplets += points;
                completedToday.push(e.target.id);

                // Celebration animation
                parentLabel.classList.add('ring-2', 'ring-brand-400', 'scale-105');
                setTimeout(() => {
                    parentLabel.classList.remove('ring-2', 'ring-brand-400', 'scale-105');
                }, 300);
            } else {
                // Remove Droplets
                droplets = Math.max(0, droplets - points);
                completedToday = completedToday.filter(id => id !== e.target.id);
            }

            // Save progress
            localStorage.setItem('wellnessDroplets', droplets);
            localStorage.setItem('completedToday', JSON.stringify(completedToday));

            updatePlant();
        });
    });

    // Initial plant render
    updatePlant();


});
