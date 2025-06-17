import re
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
import importlib
from utils import random_delay, save_to_csv, load_from_csv, remove_duplicates, get_random_user_agent
import traceback
import shutil
from datetime import datetime
import logging
import tempfile
import subprocess
import sys
import json
import random

# Configure logging
def setup_logging():
    """Set up logging configuration."""
    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)
    
    # Configure the root logger
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join('logs', 'scraper.log')),
            logging.StreamHandler()
        ]
    )
    
    # Create a logger for the scraper
    logger = logging.getLogger('scraper')
    logger.setLevel(logging.DEBUG)
    
    # Create a formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Create a file handler for detailed debug logs
    debug_handler = logging.FileHandler(os.path.join('logs', 'debug.log'))
    debug_handler.setLevel(logging.DEBUG)
    debug_handler.setFormatter(formatter)
    logger.addHandler(debug_handler)
    
    # Create a file handler for errors
    error_handler = logging.FileHandler(os.path.join('logs', 'error.log'))
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    logger.addHandler(error_handler)
    
    return logger

# Initialize logger
logger = setup_logging()

# Get logger for scraping process
scraping_logger = logging.getLogger("scraping")

# Ensure cookies directory exists
os.makedirs('cookies', exist_ok=True)

# Default cookies file path
COOKIES_FILE = os.path.join('cookies', 'cookies.json')

def kill_chromedriver_processes():
    """Kill any running ChromeDriver processes to avoid conflicts."""
    try:
        logger.info("Killing any existing ChromeDriver processes...")
        # Different commands based on platform
        if sys.platform.startswith('win'):
            # Windows
            subprocess.run(['taskkill', '/F', '/IM', 'chromedriver.exe'], 
                          stdout=subprocess.DEVNULL, 
                          stderr=subprocess.DEVNULL,
                          shell=True)
        else:
            # Linux/Unix
            subprocess.run(['pkill', '-f', 'chromedriver'], 
                          stdout=subprocess.DEVNULL, 
                          stderr=subprocess.DEVNULL)
        logger.info("ChromeDriver processes killed successfully.")
    except Exception as e:
        logger.error(f"Error killing ChromeDriver processes: {e}")

class CraigslistScraper:
    def __init__(self):
        self.logger = logging.getLogger('scraper.CraigslistScraper')
        self.logger.info("Initializing CraigslistScraper...")
        
        # Reload config module to get fresh values
        import config
        importlib.reload(config)
        
        # Get the latest config values
        self.urls = config.CRAIGSLIST_URLS
        self.keywords = config.KEYWORDS
        self.remote_keywords = config.REMOTE_KEYWORDS
        self.non_remote_keywords = config.NON_REMOTE_KEYWORDS
        
        # Initialize attributes
        self.driver = None
        self._captcha_detected = False
        self.use_headless = os.getenv('USE_HEADLESS', 'false').lower() == 'true'
        
        # Ensure output directory exists
        os.makedirs('output', exist_ok=True)
        
        # Initialize paths and settings
        self.links_file = os.getenv('LINKS_FILE', 'output/links.csv')
        self.history_links_file = os.getenv('HISTORY_LINKS_FILE', 'history_links.csv')
        self.output_file = os.getenv('OUTPUT_FILE', 'output/results.csv')
        self.batch_size = int(os.getenv('BATCH_SIZE', 10))
        self.max_retries = int(os.getenv('MAX_RETRIES', 3))
        
        # Setup ChromeDriver logging
        self.chromedriver_log = os.path.join('logs', 'chromedriver.log')
        
        # Ensure the history file exists
        if not os.path.exists(self.history_links_file):
            # Create an empty history file with headers if it doesn't exist
            with open(self.history_links_file, 'w', encoding='utf-8') as f:
                f.write('link,city,title,date_scraped\n')
        
        # If output/links.csv exists, copy its contents to history_links.csv
        if os.path.exists(self.links_file):
            self._update_history_file()
        
        # Kill any existing ChromeDriver processes before setting up a new one
        kill_chromedriver_processes()
        
        # Setup the driver
        self.driver = self._setup_driver()
        
    def _setup_driver(self):
        """Set up and return a Chrome WebDriver instance."""
        try:
            chrome_options = Options()
            if self.use_headless:
                chrome_options.add_argument("--headless=new")
            
            # Create a temporary directory for user data
            self.user_data_dir = tempfile.mkdtemp()
            chrome_options.add_argument(f"--user-data-dir={self.user_data_dir}")
            
            # Add essential options
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--disable-notifications")
            chrome_options.add_argument("--disable-popup-blocking")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            chrome_options.add_argument("--disable-site-isolation-trials")
            chrome_options.add_argument("--disable-web-security")  # Add this to handle cross-domain issues
            chrome_options.add_argument("--allow-running-insecure-content")  # Add this for mixed content
            
            # Set random user agent
            chrome_options.add_argument(f"user-agent={get_random_user_agent()}")
            
            # Add experimental options
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option("useAutomationExtension", False)
            
            # Add prefs to handle permissions and geolocation
            prefs = {
                "profile.default_content_setting_values.notifications": 2,
                "profile.default_content_setting_values.geolocation": 2,
                "profile.managed_default_content_settings.geolocation": 2,
                "profile.default_content_settings.cookies": 1,  # Allow cookies
                "profile.block_third_party_cookies": False  # Allow third-party cookies
            }
            chrome_options.add_experimental_option("prefs", prefs)
            
            # Set up service
            driver_path = "/usr/local/bin/chromedriver"
            service = Service(driver_path)
            
            # Create driver
            self.logger.info("Creating Chrome WebDriver instance...")
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.set_page_load_timeout(30)
            
            # Test the driver
            try:
                self.logger.info("Testing driver with initial page load...")
                driver.get("https://www.craigslist.org")
                time.sleep(2)  # Short wait to ensure page loads
            except Exception as e:
                self.logger.error(f"Error during initial page load: {str(e)}")
                raise
            
            return driver
            
        except Exception as e:
            self.logger.error(f"Error setting up Chrome WebDriver: {str(e)}")
            if hasattr(self, 'user_data_dir') and os.path.exists(self.user_data_dir):
                try:
                    shutil.rmtree(self.user_data_dir)
                except Exception:
                    pass
            raise

    def _check_session_valid(self):
        """Check if the current session is valid and try to recover if not."""
        try:
            # Try to execute a simple command to check session
            self.driver.current_url
            return True
        except Exception as e:
            self.logger.warning(f"Session invalid: {str(e)}")
            self.logger.info("Attempting to recover session...")
            try:
                # Close the current driver if it exists
                if hasattr(self, 'driver') and self.driver:
                    try:
                        self.driver.quit()
                    except Exception as quit_error:
                        self.logger.error(f"Error quitting driver: {str(quit_error)}")
                
                # Clean up the user data directory
                if hasattr(self, 'user_data_dir') and os.path.exists(self.user_data_dir):
                    try:
                        shutil.rmtree(self.user_data_dir)
                    except Exception as cleanup_error:
                        self.logger.error(f"Error cleaning up user data directory: {str(cleanup_error)}")
                
                # Kill any existing ChromeDriver processes
                kill_chromedriver_processes()
                
                # Create a new driver
                self.driver = self._setup_driver()
                self.logger.info("Session recovered successfully")
                return True
            except Exception as recovery_error:
                self.logger.error(f"Failed to recover session: {str(recovery_error)}")
                self.logger.error(f"Traceback: {traceback.format_exc()}")
                return False

    def _load_page_with_retry(self, url, max_retries=None):
        """Load a page with retries for reliability."""
        if max_retries is None:
            max_retries = self.max_retries
            
        if not url or not isinstance(url, str):
            return False
            
        attempts = 0
        while attempts < max_retries:
            try:
                self.logger.info(f"Attempting to load page: {url} (attempt {attempts + 1}/{max_retries})")
                
                # Check if this is a listing detail page
                is_listing_page = '/d/' in url
                
                # Check if driver is still valid
                try:
                    # Quick test of driver
                    _ = self.driver.current_url
                except Exception:
                    self.logger.warning("Driver appears invalid, attempting to recreate...")
                    try:
                        self.driver.quit()
                    except:
                        pass
                    kill_chromedriver_processes()
                    self.driver = self._setup_driver()
                
                # Set shorter timeout for listing pages
                if is_listing_page:
                    self.driver.set_page_load_timeout(15)  # Shorter timeout for listing pages
                else:
                    self.driver.set_page_load_timeout(30)  # Normal timeout for search pages
                
                # Load the page
                try:
                    self.driver.get(url)
                except Exception as e:
                    if "timeout" in str(e).lower():
                        # If timeout on listing page, consider it a success if we got partial content
                        if is_listing_page:
                            try:
                                # Check if we got the essential elements
                                WebDriverWait(self.driver, 2).until(
                                    lambda d: d.find_element(By.ID, "postingbody") or 
                                            d.find_element(By.CSS_SELECTOR, "section#postingbody") or
                                            d.find_element(By.CSS_SELECTOR, "div[data-testid='postingbody']")
                                )
                                self.logger.info("Got partial content, proceeding...")
                                return True
                            except:
                                pass
                    raise  # Re-raise if not a timeout or if we didn't get partial content
                
                # Wait for page load
                if is_listing_page:
                    # For listing pages, wait for specific elements with shorter timeout
                    try:
                        WebDriverWait(self.driver, 15).until(
                            lambda d: d.find_element(By.ID, "postingbody") or 
                                    d.find_element(By.CSS_SELECTOR, "section#postingbody") or
                                    d.find_element(By.CSS_SELECTOR, "div[data-testid='postingbody']")
                        )
                    except:
                        # If timeout waiting for elements, check if we got partial content
                        try:
                            if self.driver.find_element(By.ID, "postingbody") or \
                               self.driver.find_element(By.CSS_SELECTOR, "section#postingbody") or \
                               self.driver.find_element(By.CSS_SELECTOR, "div[data-testid='postingbody']"):
                                self.logger.info("Got partial content, proceeding...")
                                return True
                        except:
                            pass
                        raise TimeoutException("Timed out waiting for posting body")
                else:
                    # For search pages, wait for complete page load
                    WebDriverWait(self.driver, 30).until(
                        lambda driver: driver.execute_script("return document.readyState") == "complete"
                    )
                
                # Check for CAPTCHA/blocking
                if self._check_for_blocking():
                    attempts += 1
                    continue
                
                self.logger.info(f"Successfully loaded page: {url}")
                return True
                
            except Exception as e:
                self.logger.error(f"Error loading page (attempt {attempts + 1}/{max_retries}): {str(e)}")
                self.logger.error(f"Traceback: {traceback.format_exc()}")
                attempts += 1
                
                if attempts < max_retries:
                    wait_time = 5 * (2 ** attempts)  # Exponential backoff
                    self.logger.info(f"Waiting {wait_time} seconds before retry")
                    time.sleep(wait_time)
                    
                    # Try to recover the session
                    try:
                        if self.driver:
                            self.driver.quit()
                    except:
                        pass
                    kill_chromedriver_processes()
                    self.driver = self._setup_driver()
                else:
                    self.logger.error(f"Failed to load page after {max_retries} attempts: {url}")
                    return False
        
        return False

    def _has_keyword(self, text):
        """Check if the text contains any of the keywords."""
        if not text:
            return False
            
        text = text.lower()
        print(f"Checking title: '{text}'")
        
        for keyword in self.keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in text:
                print(f"✓ Matched keyword: '{keyword}' in title: '{text}'")
                return True
                
        # Additional check for partial word matches (e.g., "developer" in "web developer")
        text_words = text.split()
        for keyword in self.keywords:
            keyword_lower = keyword.lower()
            keyword_parts = keyword_lower.split()
            
            for part in keyword_parts:
                if part in text_words and len(part) > 3:  # Avoid matching short words
                    print(f"✓ Matched partial keyword: '{part}' (from '{keyword}') in title: '{text}'")
                    return True
                    
        print(f"✗ No keyword match for title: '{text}'")
        return False
        
    def _check_remote_status(self, text):
        """Check if the job is remote, non-remote, or not specified."""
        if not text:
            return "Not Specified"
            
        text = text.lower()
        
        for keyword in self.remote_keywords:
            if keyword.lower() in text:
                return "Remote"
                
        for keyword in self.non_remote_keywords:
            if keyword.lower() in text:
                return "Non-Remote"
                
        return "Not Specified"

    def _notify_user_for_captcha(self):
        """Notify the user that CAPTCHA solving is needed."""
        print("=" * 50)
        print("CAPTCHA DETECTED! Please solve the CAPTCHA in the browser window.")
        print("The script will continue after CAPTCHA is solved.")
        print("=" * 50)
        
        try:
            # Beep to alert user (Windows only)
            import winsound
            for _ in range(3):
                winsound.Beep(1000, 500)
        except:
            print("\a")  # Print bell character for non-Windows systems

    def _check_for_blocking(self):
        """Check if Craigslist is blocking or throttling requests."""
        try:
            block_indicators = [
                "IP has been automatically blocked",
                "please solve the CAPTCHA below",
                "your connection has been limited",
                "detected unusual activity"
            ]
            
            page_source = self.driver.page_source.lower()
            
            for indicator in block_indicators:
                if indicator.lower() in page_source:
                    if "captcha" in indicator.lower():
                        self._captcha_detected = True
                        # Open a visible browser if in headless mode
                        if self.use_headless:
                            self.driver.quit()
                            
                            # Create a visible browser
                            chrome_options = Options()
                            chrome_options.add_argument("--window-size=1920,1080")
                            chrome_options.add_argument(f"user-agent={get_random_user_agent()}")
                            
                            service = Service(ChromeDriverManager().install())
                            self.driver = webdriver.Chrome(service=service, options=chrome_options)
                            
                            # Return to the current page
                            self.driver.get(self.driver.current_url)
                    
                    self._notify_user_for_captcha()
                    self._wait_for_captcha_solution()
                    return True
                    
            return False
        except:
            return False
            
    def _wait_for_captcha_solution(self):
        """Wait for the CAPTCHA to be solved by checking for absence of CAPTCHA elements."""
        max_wait_time = 300  # 5 minutes maximum wait time
        check_interval = 5    # Check every 5 seconds
        start_time = time.time()
        
        print("Waiting for CAPTCHA to be solved...")
        
        while time.time() - start_time < max_wait_time:
            try:
                # Check various CAPTCHA indicators
                canvas_elements = self.driver.find_elements(By.TAG_NAME, "canvas")
                captcha_inputs = self.driver.find_elements(By.XPATH, "//input[@id='g-recaptcha-response']")
                captcha_iframes = self.driver.find_elements(By.XPATH, "//iframe[contains(@src, 'recaptcha') or contains(@src, 'captcha')]")
                
                page_text = self.driver.page_source.lower()
                captcha_text_present = any(text in page_text for text in [
                    "captcha", "robot", "human verification", "prove you're human"
                ])
                
                # If no CAPTCHA indicators, it's solved
                if (not canvas_elements and not captcha_inputs and not captcha_iframes and not captcha_text_present):
                    print("CAPTCHA appears to be solved! Continuing...")
                    self._captcha_detected = False
                    return True
                
                # Check if we're on a new page that doesn't have CAPTCHA
                if "craigslist" in self.driver.current_url and not captcha_text_present:
                    print("Page navigation detected. CAPTCHA appears to be solved.")
                    self._captcha_detected = False
                    return True
                
            except Exception as e:
                pass
            
            time.sleep(check_interval)
        
        print("CAPTCHA solving timeout reached. Continuing anyway...")
        self._captcha_detected = False
        return False

    def scrape_listings(self, max_listings=None):
        """
        PHASE 1: Scrape job listings from Craigslist for all URLs.
        """
        all_listings = []
        
        # Import scraping_status from app.py for updating current city
        from app import scraping_status
        
        for url in self.urls:
            # Extract city name from URL for status tracking
            city = url.split('/')[2].split('.')[0]  # e.g., "newyork" from "newyork.craigslist.org"
            scraping_status["current_city"] = city
            
            if not self._load_page_with_retry(url):
                continue
                
            # Check if we're being blocked
            if self._check_for_blocking():
                continue
            
            random_delay()
            
            # Wait for the results to load
            try:
                # Wait for either the old or new style results container
                WebDriverWait(self.driver, 10).until(
                    lambda driver: driver.find_elements(By.CSS_SELECTOR, "div.result-info") or 
                                 driver.find_elements(By.CSS_SELECTOR, "div.cl-search-result")
                )
                
                # Try to find listings with both old and new selectors
                listings = (
                    self.driver.find_elements(By.CSS_SELECTOR, "div.result-info") or 
                    self.driver.find_elements(By.CSS_SELECTOR, "div.cl-search-result")
                )
                
                if not listings:
                    print(f"No listings found for URL: {url}")
                    continue
                    
                print(f"Found {len(listings)} listings for URL: {url}")
                
                # Process each listing
                for listing in listings:
                    try:
                        # Try both new and old title selectors
                        title_element = (
                            listing.find_element(By.CSS_SELECTOR, "a.cl-app-anchor.cl-search-anchor.posting-title") or
                            listing.find_element(By.CSS_SELECTOR, "a.posting-title")
                        )
                        
                        # Get title text, checking for span.label if needed
                        title = title_element.text.strip()
                        if not title:
                            try:
                                span = title_element.find_element(By.CSS_SELECTOR, "span.label")
                                title = span.text.strip()
                            except:
                                continue
                        
                        # Get link
                        link = title_element.get_attribute("href")
                        
                        # Get post date using multiple selectors
                        try:
                            date_element = (
                                listing.find_element(By.CSS_SELECTOR, "span[title]") or
                                listing.find_element(By.CSS_SELECTOR, "time.posted-date") or
                                listing.find_element(By.CSS_SELECTOR, "time.result-date")
                            )
                            post_date = date_element.get_attribute("title") or date_element.text.strip()
                            if not post_date:
                                post_date = datetime.now().strftime("%Y-%m-%d")
                        except:
                            post_date = datetime.now().strftime("%Y-%m-%d")
                            
                        # Check if the title contains any of our keywords
                        if self._has_keyword(title):
                            # Check if the title contains any blacklisted keywords
                            contains_blacklisted = False
                            title_lower = title.lower()
                            
                            # Blacklist check
                            blacklisted_keywords = [
                                "paid research", "get paid", "paid wellness", "sis4", 
                                "research", "study", "studies", "make america", 
                                "thinking about drinking less", "paid cash", "survey", 
                                "cash relief", "local", "extra income", "daily pay", 
                                "easiest money online", "paid to post", "paid for your opinions", 
                                "online survey"
                            ]
                            
                            for keyword in blacklisted_keywords:
                                if keyword.lower() in title_lower:
                                    contains_blacklisted = True
                                    print(f"Skipping blacklisted title: '{title}' containing keyword: '{keyword}'")
                                    break
                            
                            if not contains_blacklisted:
                                print(f"✅ Adding listing: '{title}' from {city}")
                                all_listings.append({
                                    "City": city,
                                    "Title": title,
                                    "Link": link,
                                    "Post Date": post_date,
                                    "Processed": False
                                })
                            else:
                                print(f"❌ Skipping blacklisted: '{title}'")
                                
                    except Exception as e:
                        print(f"Error processing listing: {str(e)}")
                        continue
                        
                    random_delay(0.5, 1.5)
                    
            except Exception as e:
                print(f"Error scraping URL {url}: {str(e)}")
                continue
                
            # Random delay between URLs
            random_delay(5, 10)
            
            # If we've reached max_listings, stop
            if max_listings and len(all_listings) >= max_listings:
                break
                
        # Convert to DataFrame and save
        if all_listings:
            df = pd.DataFrame(all_listings)
            save_to_csv(df, self.links_file)
            
            # Update history file after saving all links
            self._update_history_file()
            
            return df
        else:
            print("No listings found matching criteria")
            return pd.DataFrame()

    def clean_listings(self, df=None):
        """
        PHASE 2 - STEP 1: Remove duplicate listings and filter out unwanted listings based on keywords.
        """
        if df is None:
            df = load_from_csv(self.links_file)
            
        if df.empty:
            return df
        
        # Clean up titles to improve duplicate detection
        def normalize_title(title):
            """Normalize titles by removing emojis, extra spaces, and lowercasing"""
            title = re.sub(r'[^\x00-\x7F]+', '', title)  # Remove emojis
            title = re.sub(r'\s+', ' ', title)           # Remove extra spaces
            return title.lower().strip()                 # Lowercase
        
        # Add normalized title for comparison
        df['NormalizedTitle'] = df['Title'].apply(normalize_title)
        
        # Remove duplicates based on normalized title
        df = df.drop_duplicates(subset=['NormalizedTitle'])
        
        # Filter out unwanted listings based on blacklisted keywords
        df = self._filter_blacklisted_keywords(df)
        
        # Drop the temporary column
        df = df.drop(columns=['NormalizedTitle'])
        
        # Save the cleaned DataFrame
        save_to_csv(df, self.links_file)
        
        return df
        
    def _filter_blacklisted_keywords(self, df):
        """
        Filter out listings that contain blacklisted keywords in title or description.
        Uses case-insensitive matching for all comparisons.
        """
        # List of blacklisted keywords to filter out
        blacklisted_keywords = [
            "paid research",
            "get paid",
            "paid wellness",
            "sis4",
            "research",
            "study",
            "studies",
            "make america", 
            "thinking about drinking less",
            "paid cash",
            "survey",
            "cash relief",
            "local",
            "extra income", 
            "daily pay",
            "easiest money online",
            "paid to post",
            "paid for your opinions",
            "online survey"
        ]
        
        # Make a copy to avoid modifying the original
        filtered_df = df.copy()
        
        # Initial size
        initial_size = len(filtered_df)
        rows_to_drop = []
        
        # Go through each row and check for blacklisted keywords
        for idx, row in filtered_df.iterrows():
            should_filter = False
            
            # Check title
            if 'NormalizedTitle' in row:
                title = row['NormalizedTitle'].lower()
                for keyword in blacklisted_keywords:
                    if keyword.lower() in title:
                        should_filter = True
                        print(f"Filtering out title: '{row.get('Title', '')}' containing keyword: '{keyword}'")
                        break
            
            # Also check the original title
            if not should_filter and 'Title' in row:
                title = str(row['Title']).lower()
                for keyword in blacklisted_keywords:
                    if keyword.lower() in title:
                        should_filter = True
                        print(f"Filtering out title: '{row.get('Title', '')}' containing keyword: '{keyword}'")
                        break
            
            # Check description if available
            if not should_filter and 'Description' in row and pd.notna(row['Description']):
                desc = str(row['Description']).lower()
                for keyword in blacklisted_keywords:
                    if keyword.lower() in desc:
                        should_filter = True
                        print(f"Filtering out listing with blacklisted keyword '{keyword}' in description: {row.get('Title', '')}")
                        break
            
            if should_filter:
                rows_to_drop.append(idx)
        
        # Drop the filtered rows
        filtered_df = filtered_df.drop(rows_to_drop)
        
        # Report how many were filtered out
        filtered_out = initial_size - len(filtered_df)
        print(f"Filtered out {filtered_out} listings containing blacklisted keywords")
        
        return filtered_df
        
    def _replace_empty_with_null(self, df):
        """Replace empty values with 'null' in rows that have at least some data."""
        df_copy = df.copy()
        
        # Get rows that have at least some data
        has_data_mask = df_copy.notna().any(axis=1) & (df_copy != "").any(axis=1)
        
        # For rows with data, replace empty values with 'null'
        for idx in df_copy[has_data_mask].index:
            for col in df_copy.columns:
                if pd.isna(df_copy.at[idx, col]) or df_copy.at[idx, col] == "":
                    df_copy.at[idx, col] = "null"
        
        return df_copy

    def _extract_email_info(self, max_attempts=3):
        """Extract email information with retries and fallbacks."""
        email_data = {
            'Email': "Not Available",
            'Default Mail': "",
            'Gmail': "",
            'Yahoo': "",
            'Outlook': "",
            'AOL': ""
        }
        
        for attempt in range(max_attempts):
            try:
                # Find and click the reply button with multiple selectors
                reply_button = None
                reply_selectors = [
                    "button.reply-button",
                    "button[data-href*='/reply/']",
                    "a.reply-button",
                    "a[href*='/reply/']",
                    "button[class*='show-email']",
                    "a[class*='show-email']"
                ]
                
                for selector in reply_selectors:
                    try:
                        reply_button = WebDriverWait(self.driver, 5).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                        )
                        if reply_button:
                            break
                    except:
                        continue
                
                if not reply_button:
                    self.logger.warning("Reply button not found")
                    return email_data
                
                # Click with JavaScript to avoid potential click intercepted errors
                self.driver.execute_script("arguments[0].click();", reply_button)
                time.sleep(2)  # Short wait for reply options
                
                # Check for CAPTCHA after clicking
                if self._check_for_blocking():
                    if attempt < max_attempts - 1:
                        continue
                    else:
                        return email_data
                
                # Try multiple approaches to get email
                email_found = False
                
                # Approach 1: Direct email button
                email_button_selectors = [
                    "button.reply-option-header",
                    "button[class*='reply-email']",
                    "div[class*='reply-email']",
                    "a[class*='show-email']"
                ]
                
                for selector in email_button_selectors:
                    try:
                        email_button = WebDriverWait(self.driver, 5).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                        )
                        self.driver.execute_script("arguments[0].click();", email_button)
                        email_found = True
                        break
                    except:
                        continue
                
                if email_found:
                    # Wait for email info with a shorter timeout
                    try:
                        email_container = WebDriverWait(self.driver, 8).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "div.reply-info, div[class*='reply-email']"))
                        )
                        
                        # Try multiple selectors for email address
                        email_selectors = [
                            "div.reply-email-address a",
                            "a[href^='mailto:']",
                            "span[class*='email-address']",
                            "div[class*='email-address']"
                        ]
                        
                        for selector in email_selectors:
                            try:
                                email_element = email_container.find_element(By.CSS_SELECTOR, selector)
                                email = email_element.text.strip()
                                if email:
                                    email_data['Email'] = email
                                    # Get mailto URL
                                    href = email_element.get_attribute("href")
                                    if href and href.startswith("mailto:"):
                                        email_data['Default Mail'] = href
                                    break
                            except:
                                continue
                        
                        # Get webmail links
                        webmail_selectors = "a[class*='webmail'], a[href*='gmail'], a[href*='yahoo'], a[href*='outlook'], a[href*='aol']"
                        webmail_links = email_container.find_elements(By.CSS_SELECTOR, webmail_selectors)
                        
                        for link in webmail_links:
                            href = link.get_attribute("href")
                            if href:
                                class_attr = link.get_attribute("class").lower()
                                if "gmail" in class_attr or "gmail" in href:
                                    email_data['Gmail'] = href
                                elif "yahoo" in class_attr or "yahoo" in href:
                                    email_data['Yahoo'] = href
                                elif "outlook" in class_attr or "outlook" in href:
                                    email_data['Outlook'] = href
                                elif "aol" in class_attr or "aol" in href:
                                    email_data['AOL'] = href
                        
                        return email_data
                        
                    except Exception as e:
                        self.logger.error(f"Error extracting email info: {str(e)}")
                        if attempt < max_attempts - 1:
                            time.sleep(2 * (attempt + 1))  # Progressive delay
                            continue
                
            except Exception as e:
                self.logger.error(f"Error in email extraction attempt {attempt + 1}: {str(e)}")
                if attempt < max_attempts - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
        
        return email_data

    def _load_listing_page(self, url, max_retries=3):
        """Special handler for loading individual listing pages."""
        for attempt in range(max_retries):
            try:
                self.logger.info(f"Loading listing page (attempt {attempt + 1}/{max_retries}): {url}")
                
                # Create fresh driver for each listing
                if self.driver:
                    try:
                        self.driver.quit()
                    except:
                        pass
                kill_chromedriver_processes()
                self.driver = self._setup_driver()
                
                # Set shorter timeout for listing pages
                self.driver.set_page_load_timeout(15)
                
                try:
                    self.driver.get(url)
                except Exception as e:
                    if "timeout" in str(e).lower():
                        # Check if we got enough of the page
                        try:
                            body = WebDriverWait(self.driver, 2).until(
                                EC.presence_of_element_located((By.TAG_NAME, "body"))
                            )
                            if body and len(body.text) > 100:  # If we got substantial content
                                return True
                        except:
                            pass
                    raise
                
                # Wait for essential elements
                try:
                    WebDriverWait(self.driver, 10).until(
                        lambda d: d.find_element(By.ID, "postingbody") or 
                                d.find_element(By.CSS_SELECTOR, "section#postingbody") or
                                d.find_element(By.CSS_SELECTOR, "div[data-testid='postingbody']")
                    )
                    return True
                except:
                    # If timeout but we have content, consider it success
                    try:
                        body = self.driver.find_element(By.TAG_NAME, "body")
                        if body and len(body.text) > 100:  # If we got substantial content
                            return True
                    except:
                        pass
                    raise TimeoutException("Could not find posting body")
                
            except Exception as e:
                self.logger.error(f"Error loading listing page (attempt {attempt + 1}): {str(e)}")
                if attempt < max_retries - 1:
                    wait_time = 5 * (2 ** attempt)  # Exponential backoff
                    self.logger.info(f"Waiting {wait_time} seconds before retry")
                    time.sleep(wait_time)
                else:
                    self.logger.error(f"Failed to load listing page after {max_retries} attempts")
                    return False
        
        return False

    def scrape_details(self, df=None, start_index=0, max_listings=None):
        """
        PHASE 2 - STEP 2: Visit each listing and extract email, description, and remote status.
        """
        if df is None:
            df = load_from_csv(self.links_file)
            
        if df.empty:
            return pd.DataFrame()
            
        results = []
        
        # Handle start_index and max_listings
        if start_index > 0:
            if start_index >= len(df):
                return pd.DataFrame()
            filtered_df = df.iloc[start_index:]
        else:
            filtered_df = df
        
        if max_listings is not None:
            filtered_df = filtered_df.iloc[:max_listings]
            
        # Import scraping_status from app.py for updating current city
        from app import scraping_status
        
        # Add already processed listings to results
        if start_index > 0:
            already_processed_df = load_from_csv(self.output_file)
            if not already_processed_df.empty:
                results.extend(already_processed_df.to_dict('records'))
        
        # Reset driver before starting detail scraping
        self.logger.info("Resetting driver before detail scraping...")
        try:
            if hasattr(self, 'driver') and self.driver:
                self.driver.quit()
        except:
            pass
        kill_chromedriver_processes()
        
        # Process each listing
        for idx, row in filtered_df.iterrows():
            if max_listings is not None and len(results) >= max_listings:
                break
            
            # Check if this row has been processed already
            if 'Processed' in row and row['Processed']:
                continue
            
            # Update status with current city
            city = row.get('City', 'Unknown')
            scraping_status["current_city"] = city
            
            link = row.get('Link', '')
            if not link:
                continue
            
            # Initialize listing data
            listing_data = row.to_dict()
            listing_data.update({
                'Description': "Error: Failed to load page",
                'Remote': "Not Specified",
                'Email': "Not Available",
                'Default Mail': "",
                'Gmail': "",
                'Yahoo': "",
                'Outlook': "",
                'AOL': "",
                'Processed': True
            })
            
            try:
                # Instead of using _load_page_with_retry, use the special listing page handler
                if not self._load_listing_page(link):
                    self.logger.error(f"Failed to load listing page: {link}")
                    results.append(listing_data)
                    continue
                
                # Extract description
                try:
                    description_element = None
                    desc_selectors = ["#postingbody", "section#postingbody", "div[data-testid='postingbody']"]
                    
                    for selector in desc_selectors:
                        try:
                            description_element = WebDriverWait(self.driver, 10).until(
                                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                            )
                            if description_element:
                                break
                        except:
                            continue
                    
                    if description_element:
                        description = description_element.text.strip()
                        listing_data['Description'] = description
                        listing_data['Remote'] = self._check_remote_status(description)
                except Exception as e:
                    self.logger.error(f"Error extracting description: {str(e)}")
                
                # Extract email information
                email_info = self._extract_email_info()
                listing_data.update(email_info)
                
                # Add to results
                results.append(listing_data)
                
                # Save progress after each batch
                if len(results) % self.batch_size == 0:
                    progress_df = pd.DataFrame(results)
                    save_to_csv(progress_df, self.output_file)
                    self.logger.info(f"Saved {len(results)} results to {self.output_file}")
                
                # Random delay between listings
                time.sleep(random.uniform(2, 5))
                
            except Exception as e:
                self.logger.error(f"Error processing listing {idx}: {str(e)}")
                self.logger.error(f"Traceback: {traceback.format_exc()}")
                results.append(listing_data)
                
                # Reset driver on error
                try:
                    if self.driver:
                        self.driver.quit()
                except:
                    pass
                kill_chromedriver_processes()
                self.driver = self._setup_driver()
        
        # Save final results
        final_df = pd.DataFrame(results)
        save_to_csv(final_df, self.output_file)
        self.logger.info(f"Final results saved to {self.output_file}")
        
        return final_df

    def close(self):
        """Close the browser and save cookies."""
        if hasattr(self, 'driver') and self.driver:
            try:
                # Save cookies before closing
                self._save_cookies()
                
                self.driver.quit()
            except Exception as e:
                print(f"Error closing browser: {str(e)}")
                
        # Clean up the temporary user data directory
        if hasattr(self, 'user_data_dir') and os.path.exists(self.user_data_dir):
            try:
                shutil.rmtree(self.user_data_dir)
                print(f"Removed temporary user data directory: {self.user_data_dir}")
            except Exception as e:
                print(f"Error removing temporary directory: {str(e)}")
                
        # Reset CAPTCHA flag
        self._captcha_detected = False

    def _update_history_file(self):
        """Update the history file with new links from the current scraping run"""
        try:
            # Read existing links from history file
            existing_links = set()
            if os.path.exists(self.history_links_file):
                with open(self.history_links_file, 'r', encoding='utf-8') as f:
                    # Skip header
                    next(f)
                    for line in f:
                        link = line.split(',')[0].strip()
                        existing_links.add(link)

            # Read new links from current scraping run
            new_links = []
            if os.path.exists(self.links_file):
                with open(self.links_file, 'r', encoding='utf-8') as f:
                    # Skip header
                    next(f)
                    for line in f:
                        parts = line.strip().split(',')
                        if len(parts) >= 3:
                            link, city, title = parts[0], parts[1], parts[2]
                            if link not in existing_links:
                                new_links.append(f"{link},{city},{title},{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

            # Append new links to history file
            if new_links:
                with open(self.history_links_file, 'a', encoding='utf-8') as f:
                    f.writelines(new_links)
                print(f"Added {len(new_links)} new links to history file")

        except Exception as e:
            print(f"Error updating history file: {str(e)}")

    def cleanup(self):
        """Cleanup method that also updates the history file"""
        self._update_history_file()
        # Add any other cleanup code here 

    def _save_cookies(self):
        """Save current cookies to file."""
        if self.driver:
            try:
                cookies = self.driver.get_cookies()
                with open(COOKIES_FILE, 'w') as f:
                    json.dump(cookies, f)
                print("Successfully saved cookies to file")
            except Exception as e:
                print(f"Error saving cookies: {str(e)}")

    def _setup_driver(self):
        """Set up and return a Chrome WebDriver instance."""
        try:
            chrome_options = Options()
            if self.use_headless:
                chrome_options.add_argument("--headless=new")
            
            # Create a temporary directory for user data
            self.user_data_dir = tempfile.mkdtemp()
            chrome_options.add_argument(f"--user-data-dir={self.user_data_dir}")
            
            # Add essential options
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--disable-notifications")
            chrome_options.add_argument("--disable-popup-blocking")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            chrome_options.add_argument("--disable-site-isolation-trials")
            chrome_options.add_argument("--disable-web-security")  # Add this to handle cross-domain issues
            chrome_options.add_argument("--allow-running-insecure-content")  # Add this for mixed content
            
            # Set random user agent
            chrome_options.add_argument(f"user-agent={get_random_user_agent()}")
            
            # Add experimental options
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option("useAutomationExtension", False)
            
            # Add prefs to handle permissions and geolocation
            prefs = {
                "profile.default_content_setting_values.notifications": 2,
                "profile.default_content_setting_values.geolocation": 2,
                "profile.managed_default_content_settings.geolocation": 2,
                "profile.default_content_settings.cookies": 1,  # Allow cookies
                "profile.block_third_party_cookies": False  # Allow third-party cookies
            }
            chrome_options.add_experimental_option("prefs", prefs)
            
            # Set up service
            driver_path = "/usr/local/bin/chromedriver"
            service = Service(driver_path)
            
            # Create driver
            self.logger.info("Creating Chrome WebDriver instance...")
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.set_page_load_timeout(30)
            
            # Test the driver
            try:
                self.logger.info("Testing driver with initial page load...")
                driver.get("https://www.craigslist.org")
                time.sleep(2)  # Short wait to ensure page loads
            except Exception as e:
                self.logger.error(f"Error during initial page load: {str(e)}")
                raise
            
            return driver
            
        except Exception as e:
            self.logger.error(f"Error setting up Chrome WebDriver: {str(e)}")
            if hasattr(self, 'user_data_dir') and os.path.exists(self.user_data_dir):
                try:
                    shutil.rmtree(self.user_data_dir)
                except Exception:
                    pass
            raise 