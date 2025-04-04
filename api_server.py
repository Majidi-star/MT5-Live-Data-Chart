import os
import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import uvicorn
import pytz
from pydantic import BaseModel, Field

# Create FastAPI instance
app = FastAPI(
    title="MT5 Data API",
    description="API for accessing MetaTrader 5 historical data",
    version="1.0.0"
)

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Path to the SQLite database
current_dir = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(current_dir, "mt5_historical_data.db")

# Pydantic models for response validation
class CandleData(BaseModel):
    datetime: str
    time: int
    open: float
    high: float
    low: float
    close: float
    tick_volume: int
    spread: int
    real_volume: int
    is_completed: int

class SymbolInfo(BaseModel):
    symbol: str
    timeframes: List[str]

class DatabaseInfo(BaseModel):
    symbols: List[SymbolInfo]
    total_tables: int
    total_candles: int
    oldest_candle: Optional[str]
    newest_candle: Optional[str]

def get_db_connection():
    """Create a connection to the SQLite database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Use row factory for dict-like results
        return conn
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "MT5 Data API",
        "version": "1.0.0",
        "description": "API for accessing MetaTrader 5 historical data",
        "endpoints": [
            {"path": "/", "method": "GET", "description": "This information"},
            {"path": "/info", "method": "GET", "description": "Database information"},
            {"path": "/symbols", "method": "GET", "description": "List available symbols"},
            {"path": "/timeframes", "method": "GET", "description": "List available timeframes for a symbol"},
            {"path": "/candles", "method": "GET", "description": "Get candle data for a symbol and timeframe"},
        ]
    }

@app.get("/info", response_model=DatabaseInfo)
async def get_database_info():
    """Get information about the database content"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Get all tables in the database
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Organize tables by symbol and timeframe
        symbols_dict = {}
        for table in tables:
            parts = table.split('_')
            if len(parts) >= 2:
                symbol = parts[0]
                timeframe = '_'.join(parts[1:])
                
                if symbol not in symbols_dict:
                    symbols_dict[symbol] = []
                
                symbols_dict[symbol].append(timeframe)
        
        symbols_info = [SymbolInfo(symbol=symbol, timeframes=timeframes) for symbol, timeframes in symbols_dict.items()]
        
        # Count total candles
        total_candles = 0
        oldest_datetime = None
        newest_datetime = None
        
        for table in tables:
            try:
                cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                count = cursor.fetchone()[0]
                total_candles += count
                
                # Get oldest and newest candle
                if count > 0:
                    cursor.execute(f'SELECT datetime FROM "{table}" ORDER BY time ASC LIMIT 1')
                    oldest = cursor.fetchone()
                    
                    cursor.execute(f'SELECT datetime FROM "{table}" ORDER BY time DESC LIMIT 1')
                    newest = cursor.fetchone()
                    
                    if oldest and (oldest_datetime is None or oldest[0] < oldest_datetime):
                        oldest_datetime = oldest[0]
                    
                    if newest and (newest_datetime is None or newest[0] > newest_datetime):
                        newest_datetime = newest[0]
            except sqlite3.Error:
                # Skip tables that don't have expected structure
                continue
        
        return DatabaseInfo(
            symbols=symbols_info,
            total_tables=len(tables),
            total_candles=total_candles,
            oldest_candle=oldest_datetime,
            newest_candle=newest_datetime
        )
    finally:
        conn.close()

@app.get("/symbols", response_model=List[str])
async def get_symbols():
    """Get list of available symbols"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Get all tables in the database
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Extract unique symbols
        symbols = set()
        for table in tables:
            parts = table.split('_')
            if len(parts) >= 2:
                symbols.add(parts[0])
        
        return sorted(list(symbols))
    finally:
        conn.close()

@app.get("/timeframes", response_model=List[str])
async def get_timeframes(symbol: str):
    """Get list of available timeframes for a symbol"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Get all tables in the database
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Find timeframes for the given symbol
        timeframes = []
        for table in tables:
            parts = table.split('_')
            if len(parts) >= 2 and parts[0] == symbol:
                timeframes.append('_'.join(parts[1:]))
        
        if not timeframes:
            raise HTTPException(status_code=404, detail=f"No data found for symbol: {symbol}")
        
        return timeframes
    finally:
        conn.close()

@app.get("/candles", response_model=List[CandleData])
async def get_candles(
    symbol: str,
    timeframe: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: Optional[int] = Query(default=100, le=100000),
    completed_only: Optional[bool] = False,
):
    """
    Get candle data for a symbol and timeframe
    
    - **symbol**: Trading symbol (e.g., EURUSD)
    - **timeframe**: Timeframe (e.g., M1, H1)
    - **start_time**: Optional start time in format 'YYYY-MM-DD HH:MM:SS'
    - **end_time**: Optional end time in format 'YYYY-MM-DD HH:MM:SS'
    - **limit**: Maximum number of candles to return (default: 100, max: 100000)
    - **completed_only**: If true, return only completed candles
    """
    table_name = f"{symbol}_{timeframe}"
    query = f'SELECT * FROM "{table_name}"'
    params = []
    
    # Add time filters if specified
    conditions = []
    if start_time:
        conditions.append("datetime >= ?")
        params.append(start_time)
    if end_time:
        conditions.append("datetime <= ?")
        params.append(end_time)
    if completed_only:
        conditions.append("is_completed = 1")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY time DESC LIMIT ?"
    params.append(limit)
    
    conn = get_db_connection()
    try:
        # Check if table exists
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"No data found for {symbol} with timeframe {timeframe}")
        
        # Execute query
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert to list of dictionaries
        result = []
        for row in rows:
            result.append(dict(row))
        
        return result
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@app.get("/latest", response_model=CandleData)
async def get_latest_candle(symbol: str, timeframe: str):
    """
    Get the latest candle for a symbol and timeframe
    
    - **symbol**: Trading symbol (e.g., EURUSD)
    - **timeframe**: Timeframe (e.g., M1, H1)
    """
    table_name = f"{symbol}_{timeframe}"
    query = f'SELECT * FROM "{table_name}" ORDER BY time DESC LIMIT 1'
    
    conn = get_db_connection()
    try:
        # Check if table exists
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"No data found for {symbol} with timeframe {timeframe}")
        
        # Execute query
        cursor.execute(query)
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail=f"No candles found for {symbol} with timeframe {timeframe}")
        
        return dict(row)
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

@app.get("/ohlc", response_model=Dict[str, Any])
async def get_ohlc_data(
    symbol: str,
    timeframe: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: Optional[int] = Query(default=100, le=100000),
    completed_only: Optional[bool] = False,
):
    """
    Get OHLC data for charting libraries in a simplified format
    
    - **symbol**: Trading symbol (e.g., EURUSD)
    - **timeframe**: Timeframe (e.g., M1, H1)
    - **start_time**: Optional start time in format 'YYYY-MM-DD HH:MM:SS'
    - **end_time**: Optional end time in format 'YYYY-MM-DD HH:MM:SS'
    - **limit**: Maximum number of candles to return (default: 100, max: 100000)
    - **completed_only**: If true, return only completed candles
    """
    table_name = f"{symbol}_{timeframe}"
    query = f'SELECT time, open, high, low, close, tick_volume FROM "{table_name}"'
    params = []
    
    # Add time filters if specified
    conditions = []
    if start_time:
        conditions.append("datetime >= ?")
        params.append(start_time)
    if end_time:
        conditions.append("datetime <= ?")
        params.append(end_time)
    if completed_only:
        conditions.append("is_completed = 1")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY time DESC LIMIT ?"
    params.append(limit)
    
    conn = get_db_connection()
    try:
        # Check if table exists
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"No data found for {symbol} with timeframe {timeframe}")
        
        # Execute query
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        if not rows:
            raise HTTPException(status_code=404, detail=f"No candles found for {symbol} with timeframe {timeframe}")
        
        # Format data for charting libraries
        times = []
        opens = []
        highs = []
        lows = []
        closes = []
        volumes = []
        
        for row in rows:
            times.append(row[0] * 1000)  # Convert to milliseconds for JS
            opens.append(row[1])
            highs.append(row[2])
            lows.append(row[3])
            closes.append(row[4])
            volumes.append(row[5])
        
        # Reverse to get chronological order
        times.reverse()
        opens.reverse()
        highs.reverse()
        lows.reverse()
        closes.reverse()
        volumes.reverse()
        
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "t": times,
            "o": opens,
            "h": highs,
            "l": lows,
            "c": closes,
            "v": volumes
        }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True) 