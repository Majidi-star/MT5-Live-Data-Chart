/**
 * Main application code for the MT5 Chart application
 */
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const symbolSelect = document.getElementById('symbol-select');
    const timeframeSelect = document.getElementById('timeframe-select');
    const chartTypeSelect = document.getElementById('chart-type');
    const showVolumeCheckbox = document.getElementById('show-volume');
    const updateIntervalInput = document.getElementById('update-interval');
    const updateIntervalValue = document.getElementById('update-interval-value');
    const applySettingsButton = document.getElementById('apply-settings');
    const fetchDataButton = document.getElementById('fetch-data');
    const reloadChartButton = document.getElementById('reload-chart');
    
    // Application state
    let updateInterval = CONFIG.defaultUpdateInterval;
    let updateTimer = null;
    
    /**
     * Initialize the application
     */
    async function init() {
        // Load symbols from API
        try {
            await loadSymbols();
            
            // Set up event listeners
            setupEventListeners();
            
            // Set initial update interval
            updateIntervalValue.textContent = `${parseFloat(updateIntervalInput.value).toFixed(2)}s`;
            updateInterval = parseFloat(updateIntervalInput.value) * 1000;
            
            // Wait a moment for chartService to initialize
            setTimeout(() => {
                // Start update timer
                startUpdateTimer();
                
                // Try to load initial chart data
                if (symbolSelect.value && timeframeSelect.value) {
                    loadChartData();
                }
                
                // Add periodic check to make sure the timer is running
                setInterval(() => {
                    if (!updateTimer) {
                        console.log("Update timer not running, restarting...");
                        startUpdateTimer();
                    }
                }, 30000); // Check every 30 seconds
            }, 2000); // Increased delay to ensure chart is fully initialized
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }
    
    /**
     * Load symbols from API and populate select element
     */
    async function loadSymbols() {
        try {
            const symbols = await apiService.getSymbols();
            
            // Clear loading option
            symbolSelect.innerHTML = '';
            
            // Add symbols to select
            symbols.forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol;
                option.textContent = symbol;
                symbolSelect.appendChild(option);
            });
            
            // If symbols available, trigger change to load timeframes
            if (symbols.length > 0) {
                symbolSelect.value = symbols[0];
                symbolSelect.dispatchEvent(new Event('change'));
            }
        } catch (error) {
            console.error('Failed to load symbols:', error);
            symbolSelect.innerHTML = '<option value="">Error loading symbols</option>';
        }
    }
    
    /**
     * Load timeframes for a symbol
     * @param {string} symbol - Trading symbol
     */
    async function loadTimeframes(symbol) {
        try {
            const timeframes = await apiService.getTimeframes(symbol);
            
            // Clear previous options
            timeframeSelect.innerHTML = '';
            
            // Add timeframes to select
            timeframes.forEach(timeframe => {
                const option = document.createElement('option');
                option.value = timeframe;
                option.textContent = timeframe;
                timeframeSelect.appendChild(option);
            });
            
            // Enable timeframe select
            timeframeSelect.disabled = false;
            
            // If timeframes available, select first one and load data
            if (timeframes.length > 0) {
                timeframeSelect.value = timeframes[0];
                // Auto-load chart when timeframe is selected
                setTimeout(() => loadChartData(), 500);
            }
        } catch (error) {
            console.error(`Failed to load timeframes for ${symbol}:`, error);
            timeframeSelect.innerHTML = '<option value="">Error loading timeframes</option>';
            timeframeSelect.disabled = true;
        }
    }
    
    /**
     * Load chart data and display it
     */
    async function loadChartData() {
        const symbol = symbolSelect.value;
        const timeframe = timeframeSelect.value;
        
        if (!symbol || !timeframe) {
            return false;
        }
        
        try {
            console.log(`Loading chart data for ${symbol} ${timeframe}...`);
            
            // Show loading indicator
            const chartContainer = document.getElementById('chart');
            if (chartContainer) {
                chartContainer.classList.add('loading');
            }
            
            // Update chart and UI
            await chartService.loadData(symbol, timeframe);
            
            document.title = `${symbol} ${timeframe} - MT5 Live Charts`;
            
            // Hide loading indicator
            if (chartContainer) {
                chartContainer.classList.remove('loading');
            }
            
            console.log(`Chart data loaded for ${symbol} ${timeframe}`);
            
            // Restart the update timer after loading new data
            clearInterval(updateTimer);
            updateTimer = null;
            startUpdateTimer();
            
            return true;
        } catch (error) {
            console.error('Failed to load chart data:', error);
            
            // Hide loading indicator
            const chartContainer = document.getElementById('chart');
            if (chartContainer) {
                chartContainer.classList.remove('loading');
            }
            
            return false;
        }
    }
    
    /**
     * Start the update timer
     */
    function startUpdateTimer() {
        // Clear existing timer if any
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
        
        console.log(`Starting update timer with interval: ${updateInterval}ms`);
        
        // Create new timer with globally assigned updateTimer variable
        updateTimer = setInterval(async () => {
            if (chartService && chartService.checkIfReady() && chartService.symbol && chartService.timeframe) {
                console.log(`Auto-updating chart data for ${chartService.symbol} ${chartService.timeframe}...`);
                const success = await chartService.updateData();
                
                if (!success) {
                    console.log("Auto-update failed, will retry next interval");
                } else {
                    console.log(`Auto-update successful at ${new Date().toLocaleTimeString()}`);
                }
            } else {
                console.log("Chart not ready for update:", {
                    chartServiceExists: !!chartService,
                    chartReady: chartService ? chartService.checkIfReady() : false,
                    symbolExists: chartService ? !!chartService.symbol : false,
                    timeframeExists: chartService ? !!chartService.timeframe : false
                });
                
                // If chart is not ready after multiple checks, try reinitializing
                if (chartService && !chartService.checkIfReady() && symbolSelect.value && timeframeSelect.value) {
                    console.log("Chart not ready after waiting, attempting to reload data");
                    await loadChartData();
                }
            }
        }, updateInterval);
        
        // Check if timer is running properly by testing after a short delay
        setTimeout(() => {
            if (!updateTimer) {
                console.error("Timer failed to start, recreating...");
                updateTimer = setInterval(async () => {
                    if (chartService && chartService.checkIfReady() && chartService.symbol && chartService.timeframe) {
                        await chartService.updateData();
                    }
                }, updateInterval);
            }
        }, 500);
    }
    
    /**
     * Manual fetch of latest data
     */
    async function manualFetchData() {
        console.log("Manual fetch requested");
        
        if (chartService && chartService.checkIfReady() && chartService.symbol && chartService.timeframe) {
            console.log("Manually updating chart data...");
            
            // Show loading indicator
            const chartContainer = document.getElementById('chart');
            if (chartContainer) {
                chartContainer.classList.add('loading');
            }
            
            // Update the chart
            await chartService.updateData();
            
            // Hide loading indicator
            if (chartContainer) {
                chartContainer.classList.remove('loading');
            }
            
            console.log("Manual update completed");
        } else {
            console.log("Chart not ready for manual update");
            
            // Try loading initial data instead
            if (symbolSelect.value && timeframeSelect.value) {
                await loadChartData();
            }
        }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Symbol select change
        symbolSelect.addEventListener('change', () => {
            const symbol = symbolSelect.value;
            if (symbol) {
                loadTimeframes(symbol);
            }
        });
        
        // Timeframe select change
        timeframeSelect.addEventListener('change', () => {
            if (symbolSelect.value && timeframeSelect.value) {
                // Auto-load chart when timeframe is changed
                loadChartData();
            }
        });
        
        // Apply settings button
        applySettingsButton.addEventListener('click', async () => {
            // Update chart type
            if (chartService && chartService.chart && chartService.data) {
                chartService.setChartType(chartTypeSelect.value);
            }
            
            // Update volume visibility
            if (chartService && chartService.chart && chartService.data) {
                chartService.toggleVolume(showVolumeCheckbox.checked);
            }
            
            // Load data if symbol or timeframe changed
            if (!chartService || !chartService.chart || 
                chartService.symbol !== symbolSelect.value || 
                chartService.timeframe !== timeframeSelect.value) {
                await loadChartData();
            }
        });
        
        // Fetch data button
        fetchDataButton.addEventListener('click', async () => {
            await manualFetchData();
        });
        
        // Reload chart button
        if (reloadChartButton) {
            reloadChartButton.addEventListener('click', async () => {
                console.log("Forcing complete chart reload...");
                
                // Show loading indicator
                const chartContainer = document.getElementById('chart');
                if (chartContainer) {
                    chartContainer.classList.add('loading');
                }
                
                try {
                    // Reset chart instance completely
                    if (chartService) {
                        // Remove the current chart
                        const container = document.getElementById('chart');
                        if (container) {
                            container.innerHTML = '';
                        }
                        
                        // Create new chart service
                        chartService = new ChartService('chart');
                        
                        // Wait for initialization
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Load data
                        if (symbolSelect.value && timeframeSelect.value) {
                            await chartService.loadData(symbolSelect.value, timeframeSelect.value);
                        }
                    }
                } catch (error) {
                    console.error("Error reloading chart:", error);
                } finally {
                    // Hide loading indicator
                    if (chartContainer) {
                        chartContainer.classList.remove('loading');
                    }
                    
                    // Restart update timer
                    clearInterval(updateTimer);
                    updateTimer = null;
                    startUpdateTimer();
                }
            });
        }
        
        // Update interval change
        updateIntervalInput.addEventListener('input', () => {
            updateIntervalValue.textContent = `${parseFloat(updateIntervalInput.value).toFixed(2)}s`;
        });
        
        updateIntervalInput.addEventListener('change', () => {
            updateInterval = parseFloat(updateIntervalInput.value) * 1000;
            startUpdateTimer();
            console.log(`Update interval changed to ${updateInterval}ms`);
        });
        
        // Chart type change
        chartTypeSelect.addEventListener('change', () => {
            if (chartService && chartService.chart && chartService.data) {
                chartService.setChartType(chartTypeSelect.value);
            }
        });
        
        // Show volume checkbox
        showVolumeCheckbox.addEventListener('change', () => {
            if (chartService && chartService.chart && chartService.data) {
                chartService.toggleVolume(showVolumeCheckbox.checked);
            }
        });
    }
    
    // Initialize the application
    init();
}); 