/**
 * Configuration settings for the MT5 Chart application
 */
const CONFIG = {
    // API endpoint
    apiBaseUrl: 'http://localhost:8000',
    
    // Default update interval in milliseconds
    defaultUpdateInterval: 5000,
    
    // Minimum update interval in milliseconds (0.05 seconds)
    minUpdateInterval: 50,
    
    // Default chart settings
    defaultChartType: 'candlestick',
    
    // Number of candles to fetch initially
    initialCandleCount: 500,
    
    // Chart colors and styling
    chartOptions: {
        // Common options for all charts
        common: {
            width: 800,  // Default width, will be resized later
            height: 400, // Default height, will be resized later
            layout: {
                background: { color: '#131722' },
                textColor: '#d1d4dc',
                fontSize: 12,
                fontFamily: 'Trebuchet MS, Roboto, Ubuntu, sans-serif',
            },
            grid: {
                vertLines: { color: '#242832' },
                horzLines: { color: '#242832' }
            },
            crosshair: {
                mode: 0, // CrosshairMode.Normal
            },
            timeScale: {
                borderColor: '#242832',
                timeVisible: true,
                secondsVisible: false,
            }
        },
        
        // Candlestick chart specific options
        candlestick: {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
        },
        
        // Line chart specific options
        line: {
            color: '#2196F3',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            lastValueVisible: true
        },
        
        // Area chart specific options
        area: {
            topColor: 'rgba(33, 150, 243, 0.56)',
            bottomColor: 'rgba(33, 150, 243, 0.04)',
            lineColor: 'rgba(33, 150, 243, 1)',
            lineWidth: 2
        },
        
        // Bar chart specific options
        bar: {
            upColor: '#26a69a',
            downColor: '#ef5350',
            thinBars: true
        },
        
        // Volume chart options
        volume: {
            upColor: 'rgba(38, 166, 154, 0.5)',
            downColor: 'rgba(239, 83, 80, 0.5)',
            priceFormat: {
                type: 'volume',
                precision: 0,
            },
            priceScaleId: '',
            scaleMargins: {
                top: 0.8,
                bottom: 0
            }
        }
    }
}; 