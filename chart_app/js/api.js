/**
 * API service for interacting with the MT5 Data API
 */
class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.connectionStatus = 'offline';
        
        // Debug log - console messages for debugging API calls
        this.debugLog = true;
        
        // Connection status stabilization
        this.pendingStatusChange = null;
        this.statusChangeTimer = null;
        this.stabilityDelay = 1000; // 1 second delay to prevent status flicker
        this.lastStatusChangeTime = Date.now();
        this.minimumStatusDuration = 2000; // Minimum time to show a status (2 seconds)
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.failureThreshold = 3; // Number of consecutive failures before showing offline
        this.successThreshold = 2; // Number of consecutive successes before showing online
    }

    /**
     * Update connection status
     * @param {string} status - 'online', 'offline', or 'connecting'
     */
    setConnectionStatus(status) {
        const currentTime = Date.now();
        const timeSinceLastChange = currentTime - this.lastStatusChangeTime;
        
        // Clear any pending status change
        if (this.statusChangeTimer) {
            clearTimeout(this.statusChangeTimer);
            this.statusChangeTimer = null;
        }
        
        // Update success/failure counters based on the requested status
        if (status === 'online') {
            this.consecutiveSuccesses++;
            this.consecutiveFailures = 0;
        } else if (status === 'offline') {
            this.consecutiveFailures++;
            this.consecutiveSuccesses = 0;
        }
        
        // If current status is same as new status, just exit
        if (this.connectionStatus === status) {
            return;
        }

        // Don't change status too frequently 
        if (timeSinceLastChange < this.minimumStatusDuration) {
            // For important transitions (like complete connection loss), use thresholds
            if (status === 'offline' && this.consecutiveFailures < this.failureThreshold) {
                // Don't show offline until we have several consecutive failures
                return;
            }
            
            if (status === 'online' && this.consecutiveSuccesses < this.successThreshold) {
                // Don't show online until we have several consecutive successes
                return;
            }
            
            // For less critical states like 'connecting', we can delay the change
            if (status === 'connecting' && this.connectionStatus === 'online') {
                // Don't flicker to 'connecting' when currently online and request is just starting
                return;
            }
        }
        
        // For transitioning from online to offline, add extra delay to prevent flickering
        if (this.connectionStatus === 'online' && status === 'offline') {
            this.pendingStatusChange = status;
            this.statusChangeTimer = setTimeout(() => {
                if (this.consecutiveFailures >= this.failureThreshold) {
                    this.updateStatusIndicator(this.pendingStatusChange);
                    this.lastStatusChangeTime = Date.now();
                }
                this.statusChangeTimer = null;
            }, this.stabilityDelay);
        } else {
            // For other transitions, update after a shorter delay
            this.pendingStatusChange = status;
            this.statusChangeTimer = setTimeout(() => {
                this.updateStatusIndicator(this.pendingStatusChange);
                this.lastStatusChangeTime = Date.now();
                this.statusChangeTimer = null;
            }, status === 'online' ? 300 : 600); // Faster for online, slower for others
        }
    }
    
    /**
     * Update the visual status indicator
     * @param {string} status - 'online', 'offline', or 'connecting'
     */
    updateStatusIndicator(status) {
        this.connectionStatus = status;
        const indicator = document.getElementById('connection-indicator');
        const statusText = document.getElementById('connection-text');
        
        if (indicator && statusText) {
            // Remove all current classes
            indicator.classList.remove('online', 'offline', 'connecting');
            
            // Add the appropriate class
            indicator.classList.add(status);
            
            // Update the status text
            switch (status) {
                case 'online':
                    statusText.textContent = 'Connected';
                    break;
                case 'offline':
                    statusText.textContent = 'Disconnected';
                    break;
                case 'connecting':
                    statusText.textContent = 'Connecting...';
                    break;
            }
        }
    }

    /**
     * Make an API request with error handling
     * @param {string} endpoint - API endpoint to call
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - API response
     */
    async request(endpoint, params = {}) {
        try {
            // Only show connecting state if we're not already connected or
            // if the last status change was a while ago
            if (this.connectionStatus !== 'online' || 
                (Date.now() - this.lastStatusChangeTime > this.minimumStatusDuration)) {
                this.setConnectionStatus('connecting');
            }
            
            // Build URL with query parameters
            const url = new URL(`${this.baseUrl}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });
            
            // Log request details
            if (this.debugLog) {
                console.log(`API Request: ${url.toString()}`);
            }
            
            // Make the request
            const response = await fetch(url.toString());
            
            // Handle HTTP errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error(`API Error (${response.status}): ${errorData.detail || 'Unknown error'}`);
                throw new Error(errorData.detail || `HTTP error ${response.status}`);
            }
            
            // Parse JSON response
            const data = await response.json();
            
            // Log response for debugging
            if (this.debugLog) {
                console.log(`API Response (${endpoint}):`, 
                    endpoint === '/ohlc' ? `${data.symbol} ${data.timeframe} - ${data.t ? data.t.length : 0} candles` : data);
            }
            
            // Update connection status to online
            this.setConnectionStatus('online');
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            this.setConnectionStatus('offline');
            
            // Show a user-friendly error message in the UI
            const chartContainer = document.getElementById('chart');
            if (chartContainer) {
                // Create or update error message
                let errorEl = document.getElementById('api-error-message');
                if (!errorEl) {
                    errorEl = document.createElement('div');
                    errorEl.id = 'api-error-message';
                    errorEl.className = 'api-error';
                    chartContainer.appendChild(errorEl);
                }
                
                // Check if it's a connection error
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    errorEl.textContent = `Cannot connect to API server at ${this.baseUrl}. Make sure the server is running.`;
                } else {
                    errorEl.textContent = `API Error: ${error.message}`;
                }
                
                // Hide error after 10 seconds
                setTimeout(() => {
                    if (errorEl && errorEl.parentNode) {
                        errorEl.parentNode.removeChild(errorEl);
                    }
                }, 10000);
            }
            
            throw error;
        }
    }

    /**
     * Check if API server is running
     * @returns {Promise<boolean>} - True if API is available
     */
    async checkConnection() {
        try {
            // Try to access the root endpoint
            await this.request('/');
            return true;
        } catch (error) {
            console.error('API connection check failed:', error);
            return false;
        }
    }

    /**
     * Get list of available symbols
     * @returns {Promise<string[]>} - List of symbol names
     */
    async getSymbols() {
        return this.request('/symbols');
    }

    /**
     * Get list of available timeframes for a symbol
     * @param {string} symbol - Trading symbol
     * @returns {Promise<string[]>} - List of timeframe names
     */
    async getTimeframes(symbol) {
        return this.request('/timeframes', { symbol });
    }

    /**
     * Get OHLC data for a symbol and timeframe
     * @param {string} symbol - Trading symbol
     * @param {string} timeframe - Timeframe name
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - OHLC data
     */
    async getOhlcData(symbol, timeframe, options = {}) {
        const params = {
            symbol,
            timeframe,
            limit: options.limit || CONFIG.initialCandleCount,
            completed_only: options.completedOnly || false
        };
        
        // Log the limit being used for debugging
        console.log(`API Request with candle limit: ${params.limit}`);
        
        if (options.startTime) {
            params.start_time = options.startTime;
        }
        
        if (options.endTime) {
            params.end_time = options.endTime;
        }
        
        return this.request('/ohlc', params);
    }

    /**
     * Get the latest candle for a symbol and timeframe
     * @param {string} symbol - Trading symbol
     * @param {string} timeframe - Timeframe name
     * @returns {Promise<Object>} - Latest candle data
     */
    async getLatestCandle(symbol, timeframe) {
        return this.request('/latest', { symbol, timeframe });
    }

    /**
     * Get database information
     * @returns {Promise<Object>} - Database information
     */
    async getDatabaseInfo() {
        return this.request('/info');
    }
}

// Create and export API service instance
const apiService = new ApiService(CONFIG.apiBaseUrl); 