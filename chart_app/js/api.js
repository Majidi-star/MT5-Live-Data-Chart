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
        this.stabilityDelay = 500; // 500ms delay to prevent status flicker
    }

    /**
     * Update connection status
     * @param {string} status - 'online', 'offline', or 'connecting'
     */
    setConnectionStatus(status) {
        // Clear any pending status change
        if (this.statusChangeTimer) {
            clearTimeout(this.statusChangeTimer);
            this.statusChangeTimer = null;
        }
        
        // If we're going from online to offline, delay the change to prevent flicker
        if (this.connectionStatus === 'online' && status === 'offline') {
            this.pendingStatusChange = status;
            this.statusChangeTimer = setTimeout(() => {
                this.updateStatusIndicator(this.pendingStatusChange);
                this.statusChangeTimer = null;
            }, this.stabilityDelay);
        } else {
            // For any other status changes, update immediately
            this.updateStatusIndicator(status);
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
            this.setConnectionStatus('connecting');
            
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