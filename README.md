# MetaTrader5 Live Data Chart

A comprehensive solution for collecting real-time trading data from MetaTrader 5, storing it in a database, and visualizing it through an interactive web-based chart interface.

## Overview

This project consists of three main components:

1. **Live Data Updater**: Continuously fetches and updates trading data from MetaTrader 5
2. **API Server**: Provides endpoints to access the stored data
3. **Chart Application**: Visualizes the data in interactive, real-time charts

## Features

- Real-time data collection from MetaTrader 5
- Support for multiple symbols and timeframes simultaneously
- Interactive candlestick charts with technical indicators
- Automatic updates of current (incomplete) candles
- RESTful API for accessing historical and current market data
- Persistent storage using SQLite database
- Detailed logging of all operations

## Requirements

- Python 3.7 or higher
- MetaTrader 5 platform installed and running
- Web browser for chart visualization
- MetaTrader 5 account credentials

## Installation

1. Clone this repository:
```
git clone https://github.com/yourusername/MetaTrader5-Live-Data-Chart.git
cd MetaTrader5-Live-Data-Chart
```

2. Install the required packages:
```
pip install -r requirements.txt
pip install -r api_requirements.txt
```

3. Ensure MetaTrader 5 platform is installed, running, and logged in
4. Create or update your configuration file (see Configuration section)

## Configuration

The application uses a configuration file located in the `AutoTrader` directory. Create a `config.json` file with the following structure:

```json
{
    "mt5_credentials": {
        "account": 123456,
        "password": "your_password_here",
        "server": "your_metatrader_server"
    },
    "symbols": [
        "EURUSD",
        "GBPUSD",
        "XAUUSD"
    ],
    "timeframes": [
        "M1",
        "M5",
        "H1"
    ]
}
```

- `mt5_credentials`: Your MetaTrader 5 account information
- `symbols`: List of trading symbols to track
- `timeframes`: List of timeframes to collect (supported: M1, M5, M15, M30, H1, H4, D1, W1, MN1)

## Running the Application

### 1. Start the Live Data Updater

```
python live_updater.py
```

This will connect to MetaTrader 5, create a database (if it doesn't exist), and start collecting data.

### 2. Start the API Server

```
python api_server.py
```

The API server will start on http://localhost:5000 by default.

### 3. Open the Chart Application

Navigate to the `chart_app` directory in your browser or set up a simple HTTP server:

```
cd chart_app
python -m http.server 8080
```

Then open http://localhost:8000 in your web browser.

## API Endpoints

The API provides several endpoints for accessing market data:

- `GET /symbols`: List all available symbols
- `GET /timeframes`: List all available timeframes
- `GET /data/{symbol}/{timeframe}`: Get historical data for a specific symbol and timeframe
- `GET /current/{symbol}/{timeframe}`: Get the current (latest) candle data

For detailed API documentation, see [api_readme.md](api_readme.md).

## Database Structure

The application uses a SQLite database (`mt5_historical_data.db`) with tables for each symbol and timeframe combination. Each table includes:

- `id`: Unique identifier
- `datetime`: Candle datetime in 'YYYY-MM-DD HH:MM:SS' format
- `time`: Candle timestamp (Unix time)
- `open`, `high`, `low`, `close`: Price data
- `tick_volume`, `spread`, `real_volume`: Volume and spread data
- `is_completed`: Flag indicating if the candle is complete (1) or still forming (0)

## Troubleshooting

- **Chart not updating**: Use the reload button on the chart interface to force a complete refresh
- **Connection errors**: Ensure MetaTrader 5 is running and you're logged in
- **Missing data**: Check the `live_updater.log` for any errors in data collection

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) for the charting library
- MetaTrader 5 for providing the data API 