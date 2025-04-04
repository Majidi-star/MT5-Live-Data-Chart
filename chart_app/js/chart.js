/**
 * Chart service for managing TradingView Lightweight Charts
 */
class ChartService {
    constructor(containerId) {
        this.containerId = containerId;
        this.chart = null;
        this.mainSeries = null;
        this.volumeSeries = null;
        this.chartType = CONFIG.defaultChartType;
        this.symbol = null;
        this.timeframe = null;
        this.data = null;
        this.showVolume = true;
        this.lastUpdateTime = 0;
        this.currentCandleData = null;
        this.isReady = false;
        
        // Create chart instance
        setTimeout(() => this.initChart(), 200); // Small delay to ensure DOM is ready
    }

    /**
     * Initialize chart instance
     */
    initChart() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Chart container #${this.containerId} not found`);
            return;
        }

        try {
            // Make sure LightweightCharts is available
            if (typeof LightweightCharts === 'undefined') {
                throw new Error('LightweightCharts library not loaded. Check your network connection and try again.');
            }
            
            console.log('Creating chart with options:', JSON.stringify(CONFIG.chartOptions.common));
            
            // Create chart instance with common options
            this.chart = LightweightCharts.createChart(container, CONFIG.chartOptions.common);
            
            // Set chart size to container size
            this.resizeChart();
            
            // Add window resize event listener
            window.addEventListener('resize', () => this.resizeChart());
            
            console.log('Chart initialized successfully');
            
            // Add a default empty series to initialize the chart
            this.mainSeries = this.chart.addCandlestickSeries({
                ...CONFIG.chartOptions.candlestick,
                priceFormat: {
                    type: 'price',
                    precision: 8, // Still keep precision for internal calculations
                    minMove: 0.00000001 // Minimum price movement
                }
            });
            this.mainSeries.setData([]);
            
            // Mark chart as ready
            this.isReady = true;
            
        } catch (error) {
            console.error('Failed to initialize chart:', error);
            
            // Show error message in the container
            container.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px;">
                    <h3>Failed to initialize chart</h3>
                    <p>${error.message}</p>
                    <p>Please check the console for more details.</p>
                </div>
            `;
        }
    }

    /**
     * Check if chart is ready
     * @returns {boolean} - Whether chart is ready for operations
     */
    checkIfReady() {
        return this.isReady && this.chart && this.mainSeries;
    }

    /**
     * Resize chart to fit container
     */
    resizeChart() {
        if (!this.chart) return;
        
        try {
            const container = document.getElementById(this.containerId);
            if (!container) return;
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            console.log(`Resizing chart to ${width}x${height}`);
            this.chart.resize(width, height);
        } catch (error) {
            console.error('Error resizing chart:', error);
        }
    }

    /**
     * Set the chart type
     * @param {string} type - Chart type ('candlestick', 'line', 'area', 'bar')
     */
    setChartType(type) {
        if (!this.chart) {
            console.error('Cannot change chart type - chart not initialized');
            return;
        }
        
        if (!this.data || !this.data.t || this.data.t.length === 0) {
            console.log('No data available to render chart');
            return;
        }
        
        try {
            console.log(`Changing chart type to ${type}`);
            
            // Save current visible time range
            let visibleRange = null;
            try {
                visibleRange = this.chart.timeScale().getVisibleRange();
            } catch (e) {
                console.log('Could not get visible range:', e.message);
            }
            
            // Remove existing series
            if (this.mainSeries) {
                try {
                    this.chart.removeSeries(this.mainSeries);
                } catch (e) {
                    console.log('Could not remove existing series:', e.message);
                }
            }
            
            // Define common price format for high precision
            const highPrecisionFormat = {
                type: 'price',
                precision: 8, // Keep internal precision high
                minMove: 0.00000001, // Minimum price movement
                // Add formatter to remove trailing zeros in tooltips
                formatter: (price) => {
                    if (price === undefined || price === null) return '';
                    return price.toString().replace(/(\.\d*?[1-9])0+$|\.0*$/, '$1');
                }
            };
            
            // Create new series based on type
            switch (type) {
                case 'candlestick':
                    this.mainSeries = this.chart.addCandlestickSeries({
                        ...CONFIG.chartOptions.candlestick,
                        priceFormat: highPrecisionFormat
                    });
                    break;
                case 'line':
                    this.mainSeries = this.chart.addLineSeries({
                        ...CONFIG.chartOptions.line,
                        priceFormat: highPrecisionFormat
                    });
                    break;
                case 'area':
                    this.mainSeries = this.chart.addAreaSeries({
                        ...CONFIG.chartOptions.area,
                        priceFormat: highPrecisionFormat
                    });
                    break;
                case 'bar':
                    this.mainSeries = this.chart.addBarSeries({
                        ...CONFIG.chartOptions.bar,
                        priceFormat: highPrecisionFormat
                    });
                    break;
                default:
                    this.mainSeries = this.chart.addCandlestickSeries({
                        ...CONFIG.chartOptions.candlestick,
                        priceFormat: highPrecisionFormat
                    });
            }
            
            // Set data to the new series
            const formattedData = this.formatCandleData(this.data);
            console.log(`Setting ${formattedData.length} candles to chart`);
            this.mainSeries.setData(formattedData);
            
            // Restore visible range
            if (visibleRange) {
                try {
                    this.chart.timeScale().setVisibleRange(visibleRange);
                } catch (e) {
                    console.log('Could not restore visible range:', e.message);
                    this.chart.timeScale().fitContent();
                }
            } else {
                this.chart.timeScale().fitContent();
            }
            
            this.chartType = type;
            console.log(`Chart type changed to ${type}`);
        } catch (error) {
            console.error(`Error changing chart type to ${type}:`, error);
        }
    }

    /**
     * Toggle volume display
     * @param {boolean} show - Whether to show volume
     */
    toggleVolume(show) {
        if (!this.chart) {
            console.error('Cannot toggle volume - chart not initialized');
            return;
        }
        
        if (!this.data || !this.data.t || this.data.t.length === 0) {
            console.log('No data available to display volume');
            return;
        }
        
        try {
            if (show && !this.volumeSeries) {
                console.log('Adding volume series to chart');
                // Create volume series
                this.volumeSeries = this.chart.addHistogramSeries(CONFIG.chartOptions.volume);
                this.volumeSeries.setData(this.formatVolumeData(this.data));
            } else if (!show && this.volumeSeries) {
                console.log('Removing volume series from chart');
                // Remove volume series
                this.chart.removeSeries(this.volumeSeries);
                this.volumeSeries = null;
            }
            
            this.showVolume = show;
        } catch (error) {
            console.error(`Error toggling volume display:`, error);
        }
    }

    /**
     * Format candle data for the chart
     * @param {Object} data - OHLC data from API
     * @returns {Array} - Formatted data for chart
     */
    formatCandleData(data) {
        if (!data || !data.t) {
            console.warn('No candle data to format');
            return [];
        }
        
        try {
            const formattedData = data.t.map((time, i) => ({
                time: time / 1000, // Convert from milliseconds to seconds
                open: data.o[i],
                high: data.h[i],
                low: data.l[i],
                close: data.c[i]
            }));
            
            console.log(`Formatted ${formattedData.length} candles for chart`);
            return formattedData;
        } catch (error) {
            console.error('Error formatting candle data:', error);
            return [];
        }
    }

    /**
     * Format volume data for the chart
     * @param {Object} data - OHLC data from API
     * @returns {Array} - Formatted volume data for chart
     */
    formatVolumeData(data) {
        if (!data || !data.t) {
            console.warn('No volume data to format');
            return [];
        }
        
        try {
            const formattedData = data.t.map((time, i) => ({
                time: time / 1000, // Convert from milliseconds to seconds
                value: data.v[i],
                color: data.c[i] >= data.o[i] 
                    ? CONFIG.chartOptions.volume.upColor 
                    : CONFIG.chartOptions.volume.downColor
            }));
            
            console.log(`Formatted ${formattedData.length} volume bars for chart`);
            return formattedData;
        } catch (error) {
            console.error('Error formatting volume data:', error);
            return [];
        }
    }

    /**
     * Update candle information panel
     * @param {Object} candle - Candle data
     */
    updateInfoPanel(candle) {
        if (!candle) {
            console.warn('No candle data to update info panel');
            return;
        }
        
        try {
            this.currentCandleData = candle;
            
            // Update info panel elements with trimmed values (remove trailing zeros)
            document.getElementById('info-open').textContent = this.trimTrailingZeros(candle.open);
            document.getElementById('info-high').textContent = this.trimTrailingZeros(candle.high);
            document.getElementById('info-low').textContent = this.trimTrailingZeros(candle.low);
            document.getElementById('info-close').textContent = this.trimTrailingZeros(candle.close);
            document.getElementById('info-volume').textContent = candle.tick_volume;
            
            // Format time
            const time = new Date(candle.time * 1000);
            document.getElementById('info-time').textContent = time.toLocaleString();
            
            // Show completion status
            document.getElementById('info-status').textContent = candle.is_completed ? 'Completed' : 'Forming';
            document.getElementById('info-status').className = candle.is_completed ? 'text-success' : 'text-warning';
        } catch (error) {
            console.error('Error updating info panel:', error);
        }
    }

    /**
     * Trim trailing zeros from a number
     * @param {number} value - Number to trim
     * @returns {string} - Formatted number without trailing zeros
     */
    trimTrailingZeros(value) {
        if (value === undefined || value === null) return '';
        
        // Convert to string and remove trailing zeros
        return value.toString().replace(/(\.\d*?[1-9])0+$|\.0*$/, '$1');
    }

    /**
     * Load initial data for a symbol and timeframe
     * @param {string} symbol - Trading symbol
     * @param {string} timeframe - Timeframe name
     */
    async loadData(symbol, timeframe) {
        console.log(`Loading data for ${symbol} ${timeframe}`);
        
        try {
            // Check if chart is initialized
            if (!this.chart) {
                console.error('Chart not initialized, reinitializing...');
                this.initChart();
                // Wait a moment for chart to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (!this.chart) {
                    throw new Error('Chart initialization failed');
                }
            }
            
            // Fetch data from API
            console.log(`Fetching OHLC data for ${symbol} ${timeframe}`);
            const data = await apiService.getOhlcData(symbol, timeframe);
            
            if (!data || !data.t || data.t.length === 0) {
                console.error(`No data received for ${symbol} ${timeframe}`);
                throw new Error(`No data available for ${symbol} ${timeframe}`);
            }
            
            console.log(`Received ${data.t.length} candles for ${symbol} ${timeframe}`);
            
            // Store data and settings
            this.data = data;
            this.symbol = symbol;
            this.timeframe = timeframe;
            
            // Create new chart with data
            this.setChartType(this.chartType);
            
            // Add volume if enabled
            if (this.showVolume) {
                this.toggleVolume(true);
            }
            
            // Fit content to view
            try {
                this.chart.timeScale().fitContent();
            } catch (e) {
                console.log('Could not fit content:', e.message);
            }
            
            // Get latest candle for info panel
            const latestCandle = await apiService.getLatestCandle(symbol, timeframe);
            this.updateInfoPanel(latestCandle);
            
            // Record update time
            this.lastUpdateTime = Date.now();
            
            console.log(`Chart data loaded successfully for ${symbol} ${timeframe}`);
            return true;
        } catch (error) {
            console.error(`Failed to load chart data for ${symbol} ${timeframe}:`, error);
            
            const container = document.getElementById(this.containerId);
            if (container) {
                // If no data or API error, show message in chart
                let errorMessage = 'Failed to load chart data';
                
                if (error.message.includes('No data available')) {
                    errorMessage = `No data available for ${symbol} ${timeframe}`;
                } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    errorMessage = 'Cannot connect to API server. Please make sure the server is running.';
                } else {
                    errorMessage = `Error: ${error.message}`;
                }
                
                // Create error overlay if it doesn't exist
                let errorEl = document.getElementById('chart-error-message');
                if (!errorEl) {
                    errorEl = document.createElement('div');
                    errorEl.id = 'chart-error-message';
                    errorEl.className = 'chart-error';
                    container.appendChild(errorEl);
                }
                
                errorEl.innerHTML = `
                    <div class="chart-error-icon">⚠️</div>
                    <div class="chart-error-text">${errorMessage}</div>
                `;
            }
            
            return false;
        }
    }

    /**
     * Format a timestamp for the chart
     * @param {number} timestamp - Unix timestamp in seconds
     * @returns {number} - Formatted timestamp for TV chart
     */
    formatTimestamp(timestamp) {
        // LightweightCharts uses seconds, API may return milliseconds
        return timestamp > 10000000000 ? Math.floor(timestamp / 1000) : timestamp;
    }

    /**
     * Update chart with latest data
     */
    async updateData() {
        if (!this.checkIfReady()) {
            console.error('Cannot update chart - chart not ready');
            return false;
        }
        
        if (!this.symbol || !this.timeframe) {
            console.log('Cannot update chart - symbol and timeframe not set');
            return false;
        }
        
        try {
            console.log(`Fetching latest data for ${this.symbol} ${this.timeframe} at ${new Date().toLocaleTimeString()}`);
            
            // Get the latest candle
            const latestCandle = await apiService.getLatestCandle(this.symbol, this.timeframe);
            
            if (!latestCandle) {
                console.error('No latest candle data received');
                return false;
            }
            
            // Update info panel
            this.updateInfoPanel(latestCandle);
            
            const lastDataUpdate = this.lastUpdateTime;
            const currentTime = Date.now();
            
            // Always consider data as changed to force chart update
            let hasChanged = true;
                
            if (hasChanged) {
                console.log(`Updating candle at ${new Date(latestCandle.time * 1000).toLocaleString()}`);
                
                // Format candle for the chart
                const formattedTime = this.formatTimestamp(latestCandle.time);
                
                const formattedCandle = {
                    time: formattedTime,
                    open: latestCandle.open,
                    high: latestCandle.high,
                    low: latestCandle.low,
                    close: latestCandle.close
                };
                
                console.log('Updating chart with candle:', formattedCandle);
                
                try {
                    // Ensure mainSeries is still valid before updating
                    if (this.mainSeries) {
                        // Update main series
                        this.mainSeries.update(formattedCandle);
                        
                        // Update volume series if visible
                        if (this.volumeSeries) {
                            this.volumeSeries.update({
                                time: formattedTime,
                                value: latestCandle.tick_volume,
                                color: latestCandle.close >= latestCandle.open 
                                    ? CONFIG.chartOptions.volume.upColor 
                                    : CONFIG.chartOptions.volume.downColor
                            });
                        }
                    } else {
                        console.error('Main series is not available for update. Attempting to recreate...');
                        // Try to recreate the chart
                        this.setChartType(this.chartType);
                        
                        if (this.mainSeries) {
                            this.mainSeries.update(formattedCandle);
                        } else {
                            throw new Error('Failed to recreate main series');
                        }
                    }
                } catch (updateError) {
                    console.error('Error updating chart series:', updateError);
                    console.log('Attempting to reload all data...');
                    // Force a full reload
                    await this.loadData(this.symbol, this.timeframe);
                    return true;
                }
                
                // If this is a new completed candle (previous one is done)
                if (latestCandle.is_completed && 
                    (!this.currentCandleData || 
                     (this.currentCandleData.time === latestCandle.time && !this.currentCandleData.is_completed))) {
                    console.log('Candle completed, will reload data on next update');
                    
                    // Reload all data on the next update cycle to get new candles
                    setTimeout(() => {
                        console.log('Reloading all data after candle completion');
                        this.loadData(this.symbol, this.timeframe);
                    }, 1000);
                }
                
                // Hide any error messages once we successfully update
                const errorEl = document.getElementById('chart-error-message');
                if (errorEl && errorEl.parentNode) {
                    errorEl.parentNode.removeChild(errorEl);
                }
            } else {
                console.log('No changes in latest candle data');
            }
            
            // Update last update time
            this.lastUpdateTime = currentTime;
            
            return true;
        } catch (error) {
            console.error('Failed to update chart data:', error);
            return false;
        }
    }
}

// Create chart service instance - wrapped in a timeout to ensure DOM is ready
let chartService;
document.addEventListener('DOMContentLoaded', () => {
    chartService = new ChartService('chart');
}); 