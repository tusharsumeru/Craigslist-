import os
import time
import random
import pandas as pd
from dotenv import load_dotenv
import traceback

# Load environment variables
try:
    load_dotenv()
    print("Environment variables loaded successfully")
except Exception as e:
    print(f"Warning: Failed to load environment variables: {str(e)}")

# Create only the output directory
try:
    os.makedirs('output', exist_ok=True)
    print(f"Ensured output directory exists")
except Exception as e:
    print(f"Warning: Failed to create output directory: {str(e)}")

# List of user agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
]

def get_random_user_agent():
    """Return a random user agent from the list."""
    if not USER_AGENTS:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    return random.choice(USER_AGENTS)

def random_delay(min_delay=None, max_delay=None):
    """Apply a random delay within the specified range."""
    try:
        if min_delay is None:
            min_delay = float(os.getenv('MIN_DELAY_BETWEEN_ACTIONS', 2))
        if max_delay is None:
            max_delay = float(os.getenv('MAX_DELAY_BETWEEN_ACTIONS', 5))
        
        # Ensure valid delay values
        min_delay = max(0.1, float(min_delay))
        max_delay = max(min_delay, float(max_delay))
        
        delay = random.uniform(min_delay, max_delay)
        time.sleep(delay)
        return delay
    except (ValueError, TypeError) as e:
        print(f"Warning in random_delay: {str(e)}. Using default delay.")
        time.sleep(2)
        return 2

def save_to_csv(data, filepath):
    """Save data to a CSV file."""
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Convert to DataFrame if it's not already
        if not isinstance(data, pd.DataFrame):
            df = pd.DataFrame(data)
        else:
            df = data
                
        # Save the file
        df.to_csv(filepath, index=False)
        print(f"Successfully saved {len(df)} rows to {filepath}")
        return df
    except Exception as e:
        print(f"Error saving to CSV {filepath}: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        # Try to save to a backup location
        try:
            backup_filepath = f"output/error_backup_{int(time.time())}.csv"
            pd.DataFrame(data).to_csv(backup_filepath, index=False)
            print(f"Saved backup to {backup_filepath}")
        except:
            print("Failed to save backup file")
        return pd.DataFrame(data)

def load_from_csv(filepath):
    """Load data from a CSV file."""
    try:
        if os.path.exists(filepath):
            df = pd.DataFrame(pd.read_csv(filepath))
            print(f"Loaded {len(df)} rows from {filepath}")
            return df
        else:
            print(f"Warning: File not found: {filepath}")
        return pd.DataFrame()
    except Exception as e:
        print(f"Error loading from CSV {filepath}: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return pd.DataFrame()

def remove_duplicates(df, column_name):
    """Remove duplicate rows based on a specific column."""
    try:
        if column_name not in df.columns:
            print(f"Warning: Column '{column_name}' not found in DataFrame. Cannot remove duplicates.")
            return df
            
        original_count = len(df)
        df = df.drop_duplicates(subset=[column_name])
        removed_count = original_count - len(df)
        
        print(f"Removed {removed_count} duplicates based on column '{column_name}'")
        return df
    except Exception as e:
        print(f"Error removing duplicates: {str(e)}")
        return df

try:
    from tqdm import tqdm
    
    def create_progress_bar(total, desc="Progress"):
        """Create a progress bar for better user experience."""
        return tqdm(total=total, desc=desc, unit="listings")
except ImportError:
    def create_progress_bar(total, desc="Progress"):
        return range(total) 