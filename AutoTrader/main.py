import time
import json
import os
import sqlite3
from datetime import datetime, timedelta
import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import pytz

def load_config(config_path):
    """
    Load configuration from JSON file.
    If the file doesn't exist, create it with default values.
    
    :param config_path: Path to the configuration file
    :return: Configuration dictionary
    """
    default_config = {
        "mt5_credentials": {
            "account": 12345678,
            "password": "your_password_here",
            "server": "MetaQuotes-Demo"
        },
        "symbols": [
            "EURUSD",
            "GBPUSD",
            "USDJPY",
            "BTCUSD"
        ],
        "timeframes": [
            "M1",
            "M5",
            "M15",
            "H1",
            "H4",
            "D1"
        ]
    }
    
    try:
        # Try to load existing config file
        with open(config_path, 'r') as f:
            config = json.load(f)
            print(f"Configuration loaded from {config_path}")
            return config
    except FileNotFoundError:
        # File doesn't exist, create it with default values
        with open(config_path, 'w') as f:
            json.dump(default_config, f, indent=4)
        print(f"Default configuration created at {config_path}")
        return default_config
    except json.JSONDecodeError:
        # File exists but has invalid JSON
        print(f"Error: {config_path} contains invalid JSON. Using default configuration.")
        return default_config

def create_db_connection(db_path):
    """
    Create a connection to the SQLite database.
    
    :param db_path: Path to the SQLite database file
    :return: SQLite connection object
    """
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        print(f"Successfully connected to database at {db_path}")
        return conn
    except sqlite3.Error as e:
        print(f"Error connecting to database: {e}")
        return None

def init_database(conn, symbols, timeframes):
    """
    Initialize database with tables for each symbol and timeframe combination.
    
    :param conn: SQLite connection object
    :param symbols: List of symbols
    :param timeframes: List of timeframes
    """
    if conn is None:
        return
        
    cursor = conn.cursor()
    
    # Create tables for each symbol and timeframe combination
    for symbol in symbols:
        for timeframe in timeframes:
            # Create a valid table name using the timeframe name (M1, H1, etc.)
            table_name = f"{symbol}_{timeframe}"
            
            # Create table if it doesn't exist
            cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS "{table_name}" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                datetime TEXT UNIQUE,
                time INTEGER,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                tick_volume INTEGER,
                spread INTEGER,
                real_volume INTEGER
            )
            ''')
            
            # Create index for faster querying
            cursor.execute(f'CREATE INDEX IF NOT EXISTS idx_{table_name}_datetime ON "{table_name}" (datetime)')
    
    conn.commit()
    print("Database tables initialized")

def get_timeframe_constant(timeframe_str):
    """
    Convert timeframe string to MetaTrader timeframe constant.
    
    :param timeframe_str: String representation of the timeframe (e.g., "M1", "H1")
    :return: MetaTrader timeframe constant
    """
    timeframe_dict = {
        "M1": mt5.TIMEFRAME_M1,
        "M2": mt5.TIMEFRAME_M2,
        "M3": mt5.TIMEFRAME_M3,
        "M4": mt5.TIMEFRAME_M4,
        "M5": mt5.TIMEFRAME_M5,
        "M6": mt5.TIMEFRAME_M6,
        "M10": mt5.TIMEFRAME_M10,
        "M12": mt5.TIMEFRAME_M12,
        "M15": mt5.TIMEFRAME_M15,
        "M20": mt5.TIMEFRAME_M20,
        "M30": mt5.TIMEFRAME_M30,
        "H1": mt5.TIMEFRAME_H1,
        "H2": mt5.TIMEFRAME_H2,
        "H3": mt5.TIMEFRAME_H3,
        "H4": mt5.TIMEFRAME_H4,
        "H6": mt5.TIMEFRAME_H6,
        "H8": mt5.TIMEFRAME_H8,
        "H12": mt5.TIMEFRAME_H12,
        "D1": mt5.TIMEFRAME_D1,
        "W1": mt5.TIMEFRAME_W1,
        "MN1": mt5.TIMEFRAME_MN1
    }
    return timeframe_dict.get(timeframe_str)

def get_timeframe_name(timeframe):
    """
    Convert MetaTrader timeframe constant to a string representation.
    
    :param timeframe: MetaTrader timeframe constant
    :return: String representation of the timeframe
    """
    timeframe_dict = {
        mt5.TIMEFRAME_M1: "M1",
        mt5.TIMEFRAME_M2: "M2",
        mt5.TIMEFRAME_M3: "M3",
        mt5.TIMEFRAME_M4: "M4",
        mt5.TIMEFRAME_M5: "M5",
        mt5.TIMEFRAME_M6: "M6",
        mt5.TIMEFRAME_M10: "M10",
        mt5.TIMEFRAME_M12: "M12",
        mt5.TIMEFRAME_M15: "M15",
        mt5.TIMEFRAME_M20: "M20",
        mt5.TIMEFRAME_M30: "M30",
        mt5.TIMEFRAME_H1: "H1",
        mt5.TIMEFRAME_H2: "H2",
        mt5.TIMEFRAME_H3: "H3",
        mt5.TIMEFRAME_H4: "H4",
        mt5.TIMEFRAME_H6: "H6",
        mt5.TIMEFRAME_H8: "H8",
        mt5.TIMEFRAME_H12: "H12",
        mt5.TIMEFRAME_D1: "D1",
        mt5.TIMEFRAME_W1: "W1",
        mt5.TIMEFRAME_MN1: "MN1"
    }
    return timeframe_dict.get(timeframe, f"Unknown_{timeframe}")

def save_to_database(conn, symbol, timeframe, timeframe_str, data):
    """
    Save data to the database, avoiding duplicates based on datetime.
    Creates the table if it doesn't exist.
    
    :param conn: SQLite connection object
    :param symbol: Trading symbol
    :param timeframe: MetaTrader timeframe constant
    :param timeframe_str: String representation of timeframe (M1, H1, etc.)
    :param data: Numpy array with candle data
    :return: Tuple (total_rows, inserted_rows)
    """
    if conn is None or data is None or len(data) == 0:
        return 0, 0
        
    # Convert numpy array to pandas DataFrame for easier manipulation
    df = pd.DataFrame(data)
    
    # Convert the time column (Unix timestamp) to datetime format
    df['datetime'] = pd.to_datetime(df['time'], unit='s')
    
    # Format datetime to string for storage and comparison
    df['datetime_str'] = df['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Remove the last (current) candle which might be incomplete
    df = df.iloc[:-1]
    
    if df.empty:
        print(f"No complete candles found for {symbol} {timeframe_str}")
        return 0, 0
    
    # Get the table name for this symbol and timeframe
    table_name = f"{symbol}_{timeframe_str}"
    
    cursor = conn.cursor()
    
    # Ensure the table exists - create it if it doesn't
    try:
        # Try to query the table
        cursor.execute(f'SELECT name FROM sqlite_master WHERE type="table" AND name="{table_name}"')
        table_exists = cursor.fetchone() is not None
        
        if not table_exists:
            print(f"Table {table_name} doesn't exist. Creating it now...")
            # Create the table
            cursor.execute(f'''
            CREATE TABLE "{table_name}" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                datetime TEXT UNIQUE,
                time INTEGER,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                tick_volume INTEGER,
                spread INTEGER,
                real_volume INTEGER
            )
            ''')
            
            # Create index for faster querying
            cursor.execute(f'CREATE INDEX idx_{table_name}_datetime ON "{table_name}" (datetime)')
            conn.commit()
            print(f"Table {table_name} created successfully")
    except sqlite3.Error as e:
        print(f"Error checking/creating table {table_name}: {e}")
        return 0, 0
    
    total_rows = len(df)
    inserted_rows = 0
    
    # Check which datetimes already exist in the database
    existing_datetimes = set()
    try:
        cursor.execute(f'SELECT datetime FROM "{table_name}"')
        for row in cursor.fetchall():
            existing_datetimes.add(row[0])
    except sqlite3.Error as e:
        print(f"Error retrieving existing datetimes: {e}")
        # Continue with an empty set - will attempt to insert all rows
    
    # Insert rows that don't already exist in the database
    for _, row in df.iterrows():
        if row['datetime_str'] not in existing_datetimes:
            try:
                cursor.execute(f'''
                INSERT INTO "{table_name}" (datetime, time, open, high, low, close, tick_volume, spread, real_volume)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row['datetime_str'],
                    int(row['time']),
                    float(row['open']),
                    float(row['high']),
                    float(row['low']),
                    float(row['close']),
                    int(row['tick_volume']),
                    int(row['spread']) if 'spread' in row and not np.isnan(row['spread']) else 0,
                    int(row['real_volume']) if 'real_volume' in row and not np.isnan(row['real_volume']) else 0
                ))
                inserted_rows += 1
            except sqlite3.Error as e:
                print(f"Error inserting row: {e}")
    
    conn.commit()
    print(f"Saved {inserted_rows} new candles out of {total_rows} for {symbol} {timeframe_str}")
    return total_rows, inserted_rows

def download_data(symbol, timeframe):
    """
    Download historical data from MetaTrader 5.
    
    :param symbol: Trading symbol
    :param timeframe: MetaTrader timeframe constant
    :return: Numpy array with candle data
    """
    # Select the symbol in Market Watch to ensure we can get data
    if not mt5.symbol_select(symbol, True):
        print(f"Failed to select {symbol} in Market Watch")
        return None
        
    print(f"Downloading data for {symbol} {get_timeframe_name(timeframe)}...")
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, 99999)
    
    if rates is None or len(rates) == 0:
        print(f"No data available for {symbol} {get_timeframe_name(timeframe)}")
        return None
        
    print(f"Downloaded {len(rates)} candles for {symbol} {get_timeframe_name(timeframe)}")
    return rates

def main():
    # Paths and configuration
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, "mt5_historical_data.db")
    config_path = os.path.join(current_dir, "config.json")
    
    # Load configuration
    config = load_config(config_path)
    
    # Extract settings from configuration
    credentials = config["mt5_credentials"]
    symbols = config["symbols"]
    timeframe_strings = config["timeframes"]
    
    # Convert timeframe strings to MT5 constants
    timeframes = []
    for tf_str in timeframe_strings:
        tf_const = get_timeframe_constant(tf_str)
        if tf_const is not None:
            timeframes.append((tf_const, tf_str))
        else:
            print(f"Warning: Unknown timeframe {tf_str}, skipping")
    
    # Initialize MetaTrader 5
    if not mt5.initialize():
        print(f"MetaTrader 5 initialization failed, error code: {mt5.last_error()}")
        return
    
    # Display MetaTrader 5 version
    print(f"MetaTrader 5 version: {mt5.version()}")
    
    # Login to MT5
    login_result = mt5.login(
        credentials["account"],
        credentials["password"],
        credentials["server"]
    )
    if not login_result:
        print(f"Login failed, error code: {mt5.last_error()}")
        mt5.shutdown()
        return
    
    print(f"Successfully logged in to account {credentials['account']} on server {credentials['server']}")
    
    # Debug: Check if MT5 is connected and symbols are available
    print(f"MT5 is connected: {mt5.terminal_info().connected}")
    
    # Create database connection
    conn = create_db_connection(db_path)
    if conn is None:
        print("Failed to create database connection")
        mt5.shutdown()
        return
    
    # Initialize database tables (using timeframe strings directly)
    init_database(conn, symbols, [tf_str for _, tf_str in timeframes])
    
    # Track total statistics
    total_downloaded = 0
    total_inserted = 0
    
    # Process each symbol and timeframe
    for symbol in symbols:
        for tf_const, tf_str in timeframes:
            # Download historical data
            data = download_data(symbol, tf_const)
            
            if data is not None:
                # Save to database
                downloaded, inserted = save_to_database(conn, symbol, tf_const, tf_str, data)
                total_downloaded += downloaded
                total_inserted += inserted
                
            # Small delay to avoid overwhelming the server
            time.sleep(1)
    
    # Close database connection
    conn.close()
    
    # Summary
    print(f"\nDownload complete. Retrieved {total_downloaded} candles, added {total_inserted} new candles to the database.")
    
    # Disconnect from MetaTrader 5
    mt5.shutdown()
    print("Successfully disconnected from MetaTrader 5")

if __name__ == "__main__":
    main()