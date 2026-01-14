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

    // Function to speak text
    function speakText(text) {
        if (!ttsEnabled || !ttsSupported) return;

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        speechSynthesis.speak(utterance);
    }

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

    // Load saved progress
    let currentXP = parseInt(localStorage.getItem('wellnessXP') || '0');
    let currentLevel = parseInt(localStorage.getItem('wellnessLevel') || '1');
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

        // Sprite Sheet Logic for 3D Plant
        // 4 Stages mapped to sprite width of 400%
        // Translate X: 0% (Seed), -25% (Sprout), -50% (Bush), -75% (Flower)

        let spriteOffset = '0%'; // Default Lv.1
        let statusText = 'Seedling';

        if (currentLevel >= 2 && currentLevel < 4) {
            spriteOffset = '-25%'; // Lv.2-3 (Sprout)
            statusText = 'Sprouting';
        } else if (currentLevel >= 4 && currentLevel < 6) {
            spriteOffset = '-50%'; // Lv.4-5 (Bush)
            statusText = 'Growing';
        } else if (currentLevel >= 6) {
            spriteOffset = '-75%'; // Lv.6+ (Bloom)
            statusText = 'Blooming';
        }

        if (plantSprite) {
            plantSprite.style.transform = `translateX(${spriteOffset})`;
            // Update status text near level
            plantLevel.nextElementSibling.textContent = statusText;
        }

        // Level up if enough XP
        if (currentXP >= xpNeeded) {
            currentLevel++;
            currentXP = 0;
            localStorage.setItem('wellnessLevel', currentLevel);
            localStorage.setItem('wellnessXP', currentXP);

            // Celebration
            alert(`🎉 Level Up! Your plant is now Level ${currentLevel}!`);
            updatePlant();
        }
    }

    // Handle task completion
    wellnessTasks.forEach(task => {
        task.addEventListener('change', (e) => {
            const points = parseInt(e.target.dataset.points);
            const parentLabel = e.target.parentElement.parentElement;

            if (e.target.checked) {
                // Add XP
                currentXP += points;
                completedToday.push(e.target.id);

                // Celebration animation
                parentLabel.classList.add('ring-2', 'ring-brand-400', 'scale-105');
                setTimeout(() => {
                    parentLabel.classList.remove('ring-2', 'ring-brand-400', 'scale-105');
                }, 300);
            } else {
                // Remove XP
                currentXP -= points;
                completedToday = completedToday.filter(id => id !== e.target.id);
            }

            // Save progress
            localStorage.setItem('wellnessXP', currentXP);
            localStorage.setItem('completedToday', JSON.stringify(completedToday));

            updatePlant();
        });
    });

    // Initial plant render
    updatePlant();


});
