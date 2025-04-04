# MT5 Data API Server

A FastAPI-based REST API for serving MetaTrader 5 historical data from SQLite database.

## Features

- RESTful API access to MT5 historical data
- Supports multiple symbols and timeframes
- Provides data filtering options (time range, completed candles only)
- OHLC data format for charting libraries
- Interactive API documentation with Swagger UI
- Optimized for real-time data access

## Requirements

- Python 3.7+
- SQLite database with MT5 historical data (created by the live_updater.py)
- FastAPI and Uvicorn

## Installation

1. Install the required packages:

```
pip install -r api_requirements.txt
```

2. Make sure the `mt5_historical_data.db` file exists (created by the live_updater.py)

## Usage

To start the API server:

```
python api_server.py
```

This will start a FastAPI server on http://localhost:8000.

### API Documentation

After starting the server, you can access the interactive API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/` | GET | API information | None |
| `/info` | GET | Database information | None |
| `/symbols` | GET | List all available symbols | None |
| `/timeframes` | GET | List timeframes for a symbol | `symbol` |
| `/candles` | GET | Get candle data | `symbol`, `timeframe`, optional: `start_time`, `end_time`, `limit`, `completed_only` |
| `/latest` | GET | Get latest candle | `symbol`, `timeframe` |
| `/ohlc` | GET | Get OHLC data for charting | `symbol`, `timeframe`, optional: `start_time`, `end_time`, `limit`, `completed_only` |

## Data Access Examples

### Get available symbols

```
GET http://localhost:8000/symbols
```

Response:
```json
["EURUSD", "GBPUSD", "XAUUSD"]
```

### Get available timeframes for a symbol

```
GET http://localhost:8000/timeframes?symbol=EURUSD
```

Response:
```json
["M1", "M5", "H1"]
```

### Get candle data

```
GET http://localhost:8000/candles?symbol=EURUSD&timeframe=M5&limit=10&completed_only=true
```

Response:
```json
[
  {
    "datetime": "2023-04-05 15:05:00",
    "time": 1680706500,
    "open": 1.09032,
    "high": 1.09045,
    "low": 1.09017,
    "close": 1.09025,
    "tick_volume": 312,
    "spread": 2,
    "real_volume": 0,
    "is_completed": 1
  },
  // ... more candles
]
```

### Get latest candle

```
GET http://localhost:8000/latest?symbol=EURUSD&timeframe=M5
```

Response:
```json
{
  "datetime": "2023-04-05 15:10:00",
  "time": 1680706800,
  "open": 1.09025,
  "high": 1.09043,
  "low": 1.09015,
  "close": 1.09032,
  "tick_volume": 287,
  "spread": 2,
  "real_volume": 0,
  "is_completed": 0
}
```

### Get OHLC data for charting

```
GET http://localhost:8000/ohlc?symbol=EURUSD&timeframe=M5&limit=100
```

Response:
```json
{
  "symbol": "EURUSD",
  "timeframe": "M5",
  "t": [1680699300000, 1680699600000, 1680699900000, ...],
  "o": [1.09045, 1.09032, 1.09028, ...],
  "h": [1.09062, 1.09045, 1.09048, ...],
  "l": [1.09028, 1.09017, 1.09012, ...],
  "c": [1.09032, 1.09028, 1.09035, ...],
  "v": [345, 312, 298, ...]
}
```

## Client Integration

This API server is designed to be easily integrated with various client applications:

- Trading bots and algorithms
- Web-based charting applications
- Mobile trading applications
- Market analysis tools
- Backtesting frameworks

## Running in Production

For production deployment, consider:

1. Using a proper WSGI server like Gunicorn with Uvicorn workers
2. Adding authentication to the API
3. Setting up HTTPS
4. Implementing request rate limiting

Example production-ready command:

```
gunicorn api_server:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
``` 