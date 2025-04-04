import time
import json
import os
import sqlite3
from datetime import datetime, timedelta
import MetaTrader5 as mt5
import pandas as pd
import numpy as np
import pytz
import logging
import signal
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("live_updater.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Global variable to control the main loop
running = True

def signal_handler(sig, frame):
    """Handle termination signals to gracefully shut down"""
    global running
    logger.info("Received termination signal. Shutting down...")
    running = False

def load_config(config_path):
    """
    Load configuration from JSON file.
    
    :param config_path: Path to the configuration file
    :return: Configuration dictionary
    """
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
            logger.info(f"Configuration loaded from {config_path}")
            return config
    except FileNotFoundError:
        logger.error(f"Configuration file not found at {config_path}")
        sys.exit(1)
    except json.JSONDecodeError:
        logger.error(f"Error: {config_path} contains invalid JSON.")
        sys.exit(1)

def create_db_connection(db_path):
    """
    Create a connection to the SQLite database.
    
    :param db_path: Path to the SQLite database file
    :return: SQLite connection object
    """
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        logger.info(f"Successfully connected to database at {db_path}")
        return conn
    except sqlite3.Error as e:
        logger.error(f"Error connecting to database: {e}")
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
                real_volume INTEGER,
                is_completed INTEGER DEFAULT 1
            )
            ''')
            
            # Create index for faster querying
            cursor.execute(f'CREATE INDEX IF NOT EXISTS idx_{table_name}_datetime ON "{table_name}" (datetime)')
    
    conn.commit()
    logger.info("Database tables initialized")

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

def get_timeframe_seconds(timeframe_str):
    """
    Get the number of seconds for a given timeframe.
    
    :param timeframe_str: String representation of timeframe (M1, H1, etc.)
    :return: Number of seconds
    """
    if timeframe_str.startswith('M'):
        return int(timeframe_str[1:]) * 60
    elif timeframe_str.startswith('H'):
        return int(timeframe_str[1:]) * 3600
    elif timeframe_str == 'D1':
        return 86400
    elif timeframe_str == 'W1':
        return 604800
    elif timeframe_str == 'MN1':
        return 2592000  # Approximation for a month (30 days)
    else:
        return None

def is_candle_complete(current_time, candle_time, timeframe_str):
    """
    Check if a candle is complete based on its time and the current time.
    
    :param current_time: Current UTC timestamp
    :param candle_time: Candle's timestamp
    :param timeframe_str: Timeframe string (M1, H1, etc.)
    :return: True if candle is complete, False otherwise
    """
    timeframe_seconds = get_timeframe_seconds(timeframe_str)
    if timeframe_seconds is None:
        return True  # Default to complete if we can't determine
    
    # A candle is complete if the current time is past the end of the candle period
    candle_end_time = candle_time + timeframe_seconds
    return current_time >= candle_end_time

def update_database(conn, symbol, timeframe_const, timeframe_str, lookback=99999):
    """
    Update the database with the latest candles, marking the current candle as incomplete.
    
    :param conn: SQLite connection object
    :param symbol: Trading symbol
    :param timeframe_const: MetaTrader timeframe constant
    :param timeframe_str: String representation of timeframe (M1, H1, etc.)
    :param lookback: Number of recent candles to check
    :return: Number of updated candles
    """
    if conn is None:
        return 0
    
    # Select the symbol in Market Watch
    if not mt5.symbol_select(symbol, True):
        logger.error(f"Failed to select {symbol} in Market Watch")
        return 0
    
    # Download recent data
    rates = mt5.copy_rates_from_pos(symbol, timeframe_const, 0, lookback)
    if rates is None or len(rates) == 0:
        logger.warning(f"No data available for {symbol} {timeframe_str}")
        return 0
    
    # Convert to pandas DataFrame
    df = pd.DataFrame(rates)
    
    # Current UTC time for determining completed candles
    current_time = int(datetime.now(pytz.UTC).timestamp())
    
    # Convert the time column to datetime format
    df['datetime'] = pd.to_datetime(df['time'], unit='s')
    df['datetime_str'] = df['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Determine which candles are complete
    df['is_completed'] = df['time'].apply(
        lambda x: 1 if is_candle_complete(current_time, x, timeframe_str) else 0
    )
    
    table_name = f"{symbol}_{timeframe_str}"
    cursor = conn.cursor()
    
    # Get existing candles
    existing_candles = {}
    try:
        cursor.execute(f'SELECT datetime, is_completed FROM "{table_name}"')
        for row in cursor.fetchall():
            existing_candles[row[0]] = row[1]
    except sqlite3.Error as e:
        logger.error(f"Error retrieving existing candles: {e}")
        return 0
    
    updated_count = 0
    
    # Process each candle
    for _, row in df.iterrows():
        datetime_str = row['datetime_str']
        is_completed = row['is_completed']
        
        if datetime_str in existing_candles:
            # Update existing candle if it's not completed or if the completion status changed
            if existing_candles[datetime_str] == 0 or existing_candles[datetime_str] != is_completed:
                try:
                    cursor.execute(f'''
                    UPDATE "{table_name}" SET 
                        time = ?, open = ?, high = ?, low = ?, close = ?, 
                        tick_volume = ?, spread = ?, real_volume = ?, is_completed = ?
                    WHERE datetime = ?
                    ''', (
                        int(row['time']),
                        float(row['open']),
                        float(row['high']),
                        float(row['low']),
                        float(row['close']),
                        int(row['tick_volume']),
                        int(row['spread']) if 'spread' in row and not np.isnan(row['spread']) else 0,
                        int(row['real_volume']) if 'real_volume' in row and not np.isnan(row['real_volume']) else 0,
                        int(is_completed),
                        datetime_str
                    ))
                    updated_count += 1
                except sqlite3.Error as e:
                    logger.error(f"Error updating row: {e}")
        else:
            # Insert new candle
            try:
                cursor.execute(f'''
                INSERT INTO "{table_name}" (
                    datetime, time, open, high, low, close, 
                    tick_volume, spread, real_volume, is_completed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    datetime_str,
                    int(row['time']),
                    float(row['open']),
                    float(row['high']),
                    float(row['low']),
                    float(row['close']),
                    int(row['tick_volume']),
                    int(row['spread']) if 'spread' in row and not np.isnan(row['spread']) else 0,
                    int(row['real_volume']) if 'real_volume' in row and not np.isnan(row['real_volume']) else 0,
                    int(is_completed)
                ))
                updated_count += 1
            except sqlite3.Error as e:
                logger.error(f"Error inserting row: {e}")
    
    conn.commit()
    
    if updated_count > 0:
        logger.info(f"Updated {updated_count} candles for {symbol} {timeframe_str}")
    
    return updated_count

def calculate_update_interval(timeframes):
    """
    Calculate the optimal update interval based on the smallest timeframe.
    
    :param timeframes: List of timeframe strings
    :return: Update interval in seconds
    """
    min_interval = float('inf')
    
    for tf_str in timeframes:
        seconds = get_timeframe_seconds(tf_str)
        if seconds and seconds < min_interval:
            min_interval = seconds
    
    # Default to 60 seconds if we couldn't determine
    if min_interval == float('inf'):
        min_interval = 60
    
    # Return 1/4 of the smallest timeframe, but not less than 0.05 second
    # and not more than 60 seconds
    return max(0.05, min(60, min_interval // 4))

def main():
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Paths and configuration
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, "mt5_historical_data.db")
    config_path = os.path.join(current_dir, "AutoTrader/config.json")
    
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
            logger.warning(f"Unknown timeframe {tf_str}, skipping")
    
    # Initialize MetaTrader 5
    if not mt5.initialize():
        logger.error(f"MetaTrader 5 initialization failed, error code: {mt5.last_error()}")
        return
    
    # Display MetaTrader 5 version
    logger.info(f"MetaTrader 5 version: {mt5.version()}")
    print(credentials["account"],credentials["password"],credentials["server"])
    # Login to MT5
    login_result = mt5.login(
        credentials["account"],
        credentials["password"],
        credentials["server"]
    )
    if not login_result:
        logger.error(f"Login failed, error code: {mt5.last_error()}")
        mt5.shutdown()
        return
    
    logger.info(f"Successfully logged in to account {credentials['account']} on server {credentials['server']}")
    
    # Create database connection
    conn = create_db_connection(db_path)
    if conn is None:
        logger.error("Failed to create database connection")
        mt5.shutdown()
        return
    
    # Initialize database tables
    init_database(conn, symbols, [tf_str for _, tf_str in timeframes])
    
    # Calculate optimal update interval
    update_interval = calculate_update_interval([tf_str for _, tf_str in timeframes])
    logger.info(f"Using update interval of {update_interval} seconds")
    
    # Initialize counters for statistics
    update_count = 0
    start_time = time.time()
    
    try:
        # Main update loop
        while running:
            update_start_time = time.time()
            total_updates = 0
            
            # Process each symbol and timeframe
            for symbol in symbols:
                for tf_const, tf_str in timeframes:
                    updates = update_database(conn, symbol, tf_const, tf_str)
                    total_updates += updates
            
            update_count += 1
            elapsed = time.time() - update_start_time
            
            # Log statistics every 10 updates
            if update_count % 10 == 0:
                total_elapsed = time.time() - start_time
                logger.info(f"Stats: {update_count} updates, {total_elapsed:.1f}s total time, avg {total_elapsed/update_count:.2f}s per cycle")
            
            # Sleep for the remaining time in the update interval
            sleep_time = max(0.05, update_interval - elapsed)
            if total_updates > 0:
                logger.info(f"Updated {total_updates} candles in {elapsed:.2f}s, sleeping for {sleep_time:.2f}s")
            time.sleep(0.1)
    
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
    
    finally:
        # Clean up
        if conn:
            conn.close()
            logger.info("Database connection closed")
        
        mt5.shutdown()
        logger.info("MetaTrader 5 connection closed")
        logger.info("Live updater shutdown complete")

if __name__ == "__main__":
    main() 