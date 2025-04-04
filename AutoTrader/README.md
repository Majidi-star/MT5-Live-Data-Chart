# MetaTrader 5 Historical Data Downloader

A Python tool to automatically download historical OHLCV (Open, High, Low, Close, Volume) data from MetaTrader 5 and store it in a SQLite database with a clean, structured format.

## Features

- **Configurable via JSON**: Easy setup through a configuration file without code changes
- **Multiple Symbols & Timeframes**: Download data for multiple trading instruments and timeframes at once
- **Smart Data Management**: Avoids duplicate entries and stores only complete candles
- **Automatic Table Creation**: Creates separate database tables for each symbol/timeframe pair
- **Human-Readable Datetime**: Stores both Unix timestamps and formatted datetime strings
- **Resume Capability**: Continues from where it left off in previous runs

## Requirements

- Python 3.7 or higher
- MetaTrader 5 installed on your computer
- An active MT5 trading account (demo or real)
- Required Python packages:
  - MetaTrader5
  - pandas
  - numpy

## Installation

1. Clone or download this repository to your local machine
2. Install the required packages:
   ```
   pip install MetaTrader5 pandas numpy
   ```
3. Ensure MetaTrader 5 is installed and running

## Configuration

Before running the script, configure your settings in `config.json`. The file contains:

```json
{
    "mt5_credentials": {
        "account": 12345678,
        "password": "your_password_here",
        "server": "Your-Broker-Server"
    },
    "symbols": [
        "EURUSD",
        "GBPUSD",
        "XAUUSD"
    ],
    "timeframes": [
        "M1",
        "M5",
        "H1",
        "D1"
    ]
}
```

### Configuration Options:

1. **mt5_credentials**: Your MetaTrader 5 login details
   - `account`: Your MT5 account number
   - `password`: Your MT5 password
   - `server`: Your broker's server name

2. **symbols**: Trading instruments to download data for
   - Common forex pairs: "EURUSD", "GBPUSD", "USDJPY", etc.
   - Commodities: "XAUUSD" (Gold), "XAGUSD" (Silver), etc.
   - Indices: "US30", "US500", etc.
   - Cryptocurrencies: "BTCUSD", "ETHUSD", etc.

3. **timeframes**: Candle timeframes to download
   - Minutes: "M1", "M5", "M15", "M30"
   - Hours: "H1", "H4"
   - Days and higher: "D1", "W1", "MN1"

## Usage

Run the script using:

```
python main.py
```

The script will:
1. Connect to MetaTrader 5 and log in with your credentials
2. Create a SQLite database (if it doesn't exist)
3. Set up tables for each symbol/timeframe combination
4. Download historical data for each configuration
5. Store the data in the appropriate tables
6. Skip any duplicates if you run the script again

## Database Structure

The script creates a SQLite database file `mt5_historical_data.db` with separate tables for each symbol/timeframe combination. For example:

- `EURUSD_M1`: EURUSD 1-minute candles
- `GBPUSD_H1`: GBPUSD 1-hour candles

Each table has the following columns:
- `id`: Auto-incremented primary key
- `datetime`: Human-readable date and time (e.g., "2023-06-15 10:30:00")
- `time`: Unix timestamp
- `open`: Opening price
- `high`: Highest price
- `low`: Lowest price
- `close`: Closing price
- `tick_volume`: Volume in ticks
- `spread`: Spread value
- `real_volume`: Actual trading volume (if available)

## Examples

### Adding New Symbols

To add more trading instruments, simply add them to the "symbols" array in config.json:

```json
"symbols": [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "BTCUSD",
    "US30"
]
```

### Changing Timeframes

To change the timeframes, modify the "timeframes" array:

```json
"timeframes": [
    "M1",
    "M5",
    "H4",
    "D1"
]
```

## Troubleshooting

- **Login Failed**: Check your account number, password, and server name
- **Symbol Not Found**: Verify the symbol exists in your MT5 platform and you have access to it
- **No Data Downloaded**: Ensure your MT5 platform has access to the historical data you're requesting
- **Connection Issues**: Check that MT5 is running and connected to your broker

## License

This project is available for personal and commercial use.

## Acknowledgements

This tool uses the official MetaTrader 5 Python integration to access trading data.