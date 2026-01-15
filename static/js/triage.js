document.addEventListener('DOMContentLoaded', () => {
    const getHelpBtn = document.getElementById('get-help-btn');
    const triageModal = document.getElementById('triage-modal');
    const triageForm = document.getElementById('triage-form');

    // Step Elements
    const step1 = document.getElementById('triage-step-1');
    const step2 = document.getElementById('triage-step-2');
    const step3 = document.getElementById('triage-step-3');
    const successFeedback = document.getElementById('success-feedback');

    if (getHelpBtn) {
        getHelpBtn.addEventListener('click', () => {
            triageModal.classList.remove('hidden');
            resetTriage();
        });
    }

    window.closeTriage = () => {
        triageModal.classList.add('hidden');
    };

    window.resetTriage = () => {
        step1.classList.remove('hidden');
        step2.classList.add('hidden');
        step3.classList.add('hidden');
    };

    window.handleSafetyResponse = (inDanger) => {
        if (inDanger) {
            // Step 1: Redirect to crisis resources
            window.location.href = "tel:01127666806";
            // Also show the fallback helpline modal as a backup
            document.getElementById('helpline-modal').classList.remove('hidden');
            closeTriage();
        } else {
            // Step 2: Show the booking form
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
        }
    };

    if (triageForm) {
        triageForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const severity = document.getElementById('severity').value;
            const message = document.getElementById('triage-message').value;

            try {
                const response = await fetch('/api/request_help', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ severity, message })
                });

                const data = await response.json();

                if (response.ok) {
                    step2.classList.add('hidden');
                    step3.classList.remove('hidden');

                    if (data.after_hours) {
                        successFeedback.innerHTML = `
                            <p class="font-bold text-slate-800">Request Received!</p>
                            <p class="mt-2 text-sm">Our counselors are currently offline (Hours: 9am-5pm). We have sent your request for priority review in the morning.</p>
                            <div class="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-sm">
                                <strong>Need someone now?</strong><br>
                                Call the 24/7 Peer Support Line: <a href="tel:1234567890" class="underline font-bold">123-456-7890</a>
                            </div>
                        `;
                    } else {
                        successFeedback.innerText = "We've received your request. A campus counselor will reach out to you as soon as possible.";
                    }
                } else if (response.status === 401) {
                    alert("Please log in to request counselor support.");
                    window.location.href = "/login";
                } else {
                    alert(data.error || "Something went wrong. Please try again.");
                }
            } catch (error) {
                console.error('Triage Error:', error);
                alert("Failed to send request. Please check your connection.");
            }
        });
    }
});
