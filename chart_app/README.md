# MT5 Live Charts

A web-based charting application for visualizing MetaTrader 5 data in real-time using the MT5 Data API.

## Features

- Real-time charting of MT5 data
- Multiple chart types (candlestick, line, area, bar)
- Automatic updates of the current candle
- Volume display
- Symbol and timeframe selection
- Customizable update intervals
- Detailed OHLC information panel

## Prerequisites

- Running MT5 Data API server (see the `api_server.py` in the parent directory)
- Web browser with JavaScript enabled
- Internet connection to load external libraries

## Getting Started

1. Make sure the MT5 Data API server is running:
   ```
   python ../api_server.py
   ```

2. Open the chart application in a web browser:
   - Either serve the files with a web server (recommended)
   - Or open `index.html` directly in your browser

### Serving with a Simple HTTP Server

If you have Python installed, you can start a simple HTTP server:

```
cd chart_app
python -m http.server 8080
```

Then open your browser and navigate to `http://localhost:8080`

## Usage

1. Select a symbol from the dropdown menu
2. Select a timeframe for the selected symbol
3. Choose chart type (candlestick, line, area, bar)
4. Toggle volume display on/off
5. Adjust the update interval as needed
6. Click "Apply Settings" to update the chart
7. Use "Fetch Data Now" to manually update the chart at any time

## Chart Types

- **Candlestick**: Traditional OHLC candlestick chart (default)
- **Line**: Simple line chart showing closing prices
- **Area**: Filled area chart showing closing prices
- **Bar**: OHLC bar chart

## Chart Controls

- **Mouse wheel**: Zoom in/out
- **Right-click + drag**: Move the chart
- **Left-click + drag**: Select area to zoom
- **Double-click**: Reset zoom

## Connection Status

The connection status indicator shows the current state of the API connection:
- **Red**: Disconnected from API
- **Yellow**: Connecting to API
- **Green**: Connected to API

## File Structure

- `index.html`: Main HTML file
- `css/styles.css`: Styling for the application
- `js/config.js`: Configuration settings
- `js/api.js`: API service for data retrieval
- `js/chart.js`: Chart service for visualization
- `js/app.js`: Main application logic

## External Libraries

- [Lightweight Charts](https://github.com/tradingview/lightweight-charts): TradingView's open-source charting library
- [Bootstrap](https://getbootstrap.com/): UI components and styling
- [Font Awesome](https://fontawesome.com/): Icons

## Customization

To customize the application, you can modify:
- Chart colors and styling in `js/config.js`
- UI layout and design in `css/styles.css`
- API endpoint in `js/config.js` if your API server is running on a different host/port

## Troubleshooting

- If no symbols appear in the dropdown, make sure the API server is running and accessible
- If the chart doesn't update, check the connection status indicator and browser console for errors
- If you see CORS errors in the console, make sure your API server has CORS enabled 