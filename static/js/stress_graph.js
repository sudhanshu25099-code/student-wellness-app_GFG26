/**
 * Stress Trend Visualization
 * Uses Chart.js to render a smooth line graph of the user's recent stress levels.
 */

document.addEventListener("DOMContentLoaded", function () {
    loadStressGraph();
});

let stressChartInstance = null;

function loadStressGraph() {
    // Only run if the canvas exists (i.e. we are on index.html)
    const ctx = document.getElementById('stressChart');
    if (!ctx) return;

    fetch('/api/stress_history')
        .then(response => response.json())
        .then(data => {
            let labels, levels;

            if (data.length === 0) {
                // DEMO MODE: Show placeholder data so the graph isn't empty
                console.log("No data found - Using Demo Data");
                document.getElementById('no-data-msg').classList.add('hidden');
                ctx.classList.remove('hidden');

                labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
                levels = [3, 5, 4, 7, 6, 4, 5]; // Fake trend
            } else {
                document.getElementById('no-data-msg').classList.add('hidden');
                ctx.classList.remove('hidden');

                labels = data.map(entry => entry.date);
                levels = data.map(entry => entry.level);
            }

            renderChart(ctx, labels, levels);
        })
        .catch(err => console.error("Error loading stress graph:", err));
}

function renderChart(ctx, labels, dataPoints) {
    // Destroy previous instance to avoid "canvas reuse" errors
    if (stressChartInstance) {
        stressChartInstance.destroy();
    }

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(14, 165, 233, 0.5)'); // Brand Blue
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.0)'); // Transparent

    stressChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Stress Level',
                data: dataPoints,
                borderColor: '#0284c7', // Brand 600
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4, // Smooths the curve
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#0284c7',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1e293b',
                    bodyColor: '#1e293b',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return 'Level: ' + context.parsed.y + '/10';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    grid: {
                        color: '#f1f5f9',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        font: {
                            family: "'Outfit', sans-serif"
                        },
                        stepSize: 2
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: "'Outfit', sans-serif"
                        }
                    }
                }
            },
            animation: {
                y: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            }
        }
    });
}
