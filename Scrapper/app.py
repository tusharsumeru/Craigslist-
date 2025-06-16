from fastapi import FastAPI, HTTPException, BackgroundTasks, APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError
from typing import Optional, Dict, Any, List, Set
import os
import json
import pandas as pd
import base64
import asyncio
import time
import traceback
from datetime import datetime
from scraper import CraigslistScraper
import subprocess
import sys
import logging
import os.path

# Load configuration initially
from config import CRAIGSLIST_URLS, KEYWORDS, REMOTE_KEYWORDS, NON_REMOTE_KEYWORDS

# Create FastAPI app and router
app = FastAPI(title="Craigslist Scraper API", 
             description="API for scraping and managing Craigslist job listings",
             version="1.0.0")
router = APIRouter(prefix="/api")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Global variables
scraper = None
scraping_status = {
    "is_running": False,
    "progress": 0,
    "current_phase": "Not Started",
    "last_completed": None,
    "completed": False,
    "error": False,
    "no_results": False,
    "current_url": None
}

# Current configuration (modified via API)
current_config = {
    "urls": CRAIGSLIST_URLS,
    "keywords": KEYWORDS,
    "remote_keywords": REMOTE_KEYWORDS,
    "non_remote_keywords": NON_REMOTE_KEYWORDS,
    "use_headless": os.getenv('USE_HEADLESS', 'false').lower() == 'true',
    "batch_size": int(os.getenv('BATCH_SIZE', 10)),
    "max_retries": int(os.getenv('MAX_RETRIES', 3))
}

class ConfigUpdate(BaseModel):
    urls: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    remote_keywords: Optional[List[str]] = None
    non_remote_keywords: Optional[List[str]] = None
    use_headless: Optional[bool] = None
    batch_size: Optional[int] = None
    max_retries: Optional[int] = None

def update_config_file(config: Dict[str, Any]):
    """Update the config.py file with new configuration values."""
    config_content = f"""CRAIGSLIST_URLS = {json.dumps(config['urls'], indent=4)}
KEYWORDS = {json.dumps(config['keywords'], indent=4)}
REMOTE_KEYWORDS = {json.dumps(config['remote_keywords'], indent=4)}
NON_REMOTE_KEYWORDS = {json.dumps(config['non_remote_keywords'], indent=4)}
"""
    with open('config.py', 'w') as f:
        f.write(config_content)
        f.flush()

def reset_status():
    """Reset the scraping status to default values."""
    global scraping_status
    scraping_status = {
        "is_running": False,
        "progress": 0,
        "current_phase": "Not Started",
        "last_completed": None,
        "completed": False,
        "error": False,
        "no_results": False,
        "current_url": None
    }

# Configure logging
log_dir = "logs"
os.makedirs(log_dir, exist_ok=True)
today = datetime.now().strftime("%Y-%m-%d")
scraping_log_file = os.path.join(log_dir, f"scraping_{today}.log")

# Setup logger for scraping process
scraping_logger = logging.getLogger("scraping")
scraping_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(scraping_log_file)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
scraping_logger.addHandler(file_handler)

# Keep original stdout for server messages
original_stdout = sys.stdout

@router.get("/")
async def root():
    """Root endpoint with API information."""
    response = {
        "name": "Craigslist Scraper API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "GET /api": "This information",
            "POST /api/start-scraping": "Start the scraping process",
            "GET /api/scraping-status": "Get current scraping status",
            "GET /api/download-results": "Download or save results to frontend public folder",
            "POST /api/update-config": "Update scraper configuration",
            "GET /api/current-config": "Get current configuration",
            "POST /api/cleanup": "Clean up resources and stop scraping",
            "GET /api/view-logs": "View the most recent scraping log entries",
            "GET /api/files": "List all files in the frontend public folder",
            "DELETE /api/files/{filename}": "Delete a file from the frontend public folder",
            "DELETE /api/clean-frontend-files": "Delete all files from the frontend public output directory"
        }
    }
    return response

@router.post("/start-scraping")
async def start_scraping(background_tasks: BackgroundTasks):
    """Start the scraping process in the background."""
    global scraper, scraping_status
    
    if scraping_status["is_running"]:
        raise HTTPException(status_code=400, detail="Scraping is already running")
    
    try:
        # Clean up any stray ChromeDriver processes
        try:
            import psutil
            
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    if 'chromedriver' in proc.info['name'].lower():
                        subprocess.run(['taskkill', '/F', '/PID', str(proc.info['pid'])], 
                                       stdout=subprocess.DEVNULL, 
                                       stderr=subprocess.DEVNULL)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
        except:
            pass
        
        # Reset status if not in no_results state
        if not scraping_status["no_results"]:
            reset_status()
        
        # Open a new terminal to display scraping logs on Windows
        try:
            # Check if we should spawn a new terminal for logs
            if os.getenv('SHOW_SCRAPE_TERMINAL', 'false').lower() == 'true':
                log_file_path = os.path.abspath(scraping_log_file)
                subprocess.Popen(
                    ['cmd', '/k', f'echo Scraping logs will appear here && powershell -command "Get-Content -Path \"{log_file_path}\" -Wait"'],
                    creationflags=subprocess.CREATE_NEW_CONSOLE
                )
                print(f"Opened new terminal for scraping logs - see '{scraping_log_file}'")
        except Exception as e:
            print(f"Warning: Could not open separate terminal for logs: {str(e)}")
        
        # Create a new scraper instance
        scraper = CraigslistScraper()
        
        # Handle existing result file
        output_file = os.getenv('OUTPUT_FILE', 'output/results.csv')
        if os.path.exists(output_file):
            os.remove(output_file)
        
        scraping_status["is_running"] = True
        
        # Log scraping start
        scraping_logger.info("Scraping process started")
        
        background_tasks.add_task(run_scraper)
        return {"message": "Scraping started successfully", "status": "running"}
    except Exception as e:
        scraping_status["is_running"] = False
        scraper = None
        scraping_logger.error(f"Error starting scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_scraper():
    """Run the scraper process."""
    global scraper, scraping_status
    
    try:
        # Phase 1: Scrape listings
        scraping_status.update({
            "is_running": True,
            "progress": 0,
            "current_phase": "Phase 1: Scraping listings",
            "last_completed": "Starting Phase 1",
            "completed": False,
            "error": False,
            "no_results": False
        })
        
        # Redirect logging
        scraping_logger.info("Phase 1: Starting to scrape listings")
        
        # Verify the driver is responsive
        try:
            current_url = scraper.driver.current_url
            scraping_logger.info(f"Driver initialized, current URL: {current_url}")
        except Exception as e:
            error_msg = f"Error with ChromeDriver: {str(e)}"
            scraping_logger.error(error_msg)
            scraping_status.update({
                "is_running": False,
                "current_phase": "Error",
                "last_completed": error_msg,
                "error": True,
                "completed": False
            })
            return
        
        # Scrape listings
        scraping_logger.info("Scraping listings from configured URLs...")
        df = scraper.scrape_listings()
        
        if df is None or df.empty:
            scraping_logger.info("No listings found - scraping complete")
            scraping_status.update({
                "is_running": False,
                "progress": 0,
                "current_phase": "Completed",
                "last_completed": "No listings found",
                "completed": True,
                "error": False,
                "no_results": True
            })
            return
        
        scraping_logger.info(f"Found {len(df)} listings")
            
        # Phase 2 - Step 1: Clean listings
        scraping_status.update({
            "is_running": True,
            "progress": 30,
            "current_phase": "Phase 2: Cleaning listings",
            "last_completed": f"Found {len(df)} listings",
        })
        
        scraping_logger.info("Phase 2: Cleaning listings and removing duplicates")
        df = scraper.clean_listings(df)
        scraping_logger.info(f"After cleaning: {len(df)} unique listings remain")
        
        # Phase 2 - Step 2: Scrape details
        scraping_status.update({
            "is_running": True,
            "progress": 50,
            "current_phase": "Phase 2: Scraping details",
            "last_completed": f"Processing {len(df)} listings",
        })
        
        scraping_logger.info(f"Phase 2: Scraping details for {len(df)} listings")
        results_df = scraper.scrape_details(df)
        
        # Update final status
        scraping_logger.info(f"Scraping complete! Total results: {len(results_df)} listings")
        scraping_status.update({
            "is_running": False,
            "progress": 100,
            "current_phase": "Completed",
            "last_completed": "Scraping Complete",
            "completed": True,
            "error": False,
            "no_results": False
        })
        
    except Exception as e:
        error_msg = f"Error during scraping: {str(e)}"
        scraping_logger.error(error_msg)
        scraping_logger.error(traceback.format_exc())
        scraping_status.update({
            "is_running": False,
            "current_phase": "Error",
            "last_completed": f"Error: {str(e)}",
            "error": True,
            "completed": False
        })
        
    finally:
        # Ensure browser is closed
        if scraper:
            try:
                scraper.close()
                scraping_logger.info("Browser closed successfully")
            except Exception as e:
                scraping_logger.error(f"Error closing browser: {str(e)}")
            scraper = None

@router.get("/scraping-status")
async def get_scraping_status():
    """Get the current status of the scraping process."""
    return scraping_status

@router.get("/download-results")
async def download_results(save_to_frontend: bool = True):
    """Download scraped results as CSV and save to frontend public folder if requested."""
    try:
        output_file = os.getenv('OUTPUT_FILE', 'output/results.csv')
        
        if not os.path.exists(output_file):
            raise HTTPException(
                status_code=404,
                detail="No results found. Please run the scraper first."
            )
        
        # Define the frontend public output directory
        # This should be configured via environment variable
        frontend_public_dir = os.getenv('FRONTEND_PUBLIC_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'Frontend', 'public', 'output'))
        
        # If save_to_frontend is true, save to the frontend public directory
        if save_to_frontend:
            try:
                # Ensure the frontend public directory exists
                os.makedirs(frontend_public_dir, exist_ok=True)
                scraping_logger.info(f"Frontend public directory: {frontend_public_dir}")
                
                # Define the destination file path
                frontend_file_path = os.path.join(frontend_public_dir, "results.csv")
                scraping_logger.info(f"Attempting to copy file from {output_file} to {frontend_file_path}")
                
                # Copy the results file
                import shutil
                shutil.copy2(output_file, frontend_file_path)
                scraping_logger.info("File copied successfully")
                
                # Calculate relative URL for the frontend
                frontend_url = "/output/results.csv"
                absolute_url = f"http://localhost:{os.getenv('FRONTEND_PORT', '5173')}{frontend_url}"
                
                scraping_logger.info(f"Results saved to frontend public directory: {frontend_file_path}")
                scraping_logger.info(f"File accessible at: {absolute_url}")
                
                # Return the file information
                return {
                    "success": True,
                    "message": "Results saved to frontend public directory",
                    "file_path": frontend_file_path,
                    "file_url": frontend_url,
                    "absolute_url": absolute_url,
                    "size": os.path.getsize(output_file)
                }
            except Exception as e:
                scraping_logger.error(f"Error saving to frontend: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error saving to frontend: {str(e)}"
                )
        
        # If not saving to frontend, return base64 encoded content (legacy behavior)
        with open(output_file, 'rb') as file:
            file_content = file.read()
            
        # Encode the content to base64
        base64_content = base64.b64encode(file_content).decode('utf-8')
        
        return {
            "filename": "scraped_results.csv",
            "content": base64_content,
            "content_type": "text/csv",
            "size": len(file_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error downloading results: {str(e)}"
        )

@router.get("/files")
async def list_frontend_files():
    """List all files in the frontend public output directory."""
    try:
        # Define the frontend public output directory
        frontend_public_dir = os.getenv('FRONTEND_PUBLIC_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'Frontend', 'public', 'output'))
        
        # Ensure the directory exists
        os.makedirs(frontend_public_dir, exist_ok=True)
        
        # Get list of files
        files = []
        for filename in os.listdir(frontend_public_dir):
            file_path = os.path.join(frontend_public_dir, filename)
            if os.path.isfile(file_path):
                # Get file stats
                file_stats = os.stat(file_path)
                files.append({
                    "name": filename,
                    "size": file_stats.st_size,
                    "modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                    "url": f"/output/{filename}"
                })
        
        return {
            "success": True,
            "files": files
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing files: {str(e)}"
        )
        
@router.delete("/files/{filename}")
async def delete_frontend_file(filename: str):
    """Delete a file from the frontend public output directory."""
    try:
        # Define the frontend public output directory
        frontend_public_dir = os.getenv('FRONTEND_PUBLIC_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'Frontend', 'public', 'output'))
        
        # Define the file path
        file_path = os.path.join(frontend_public_dir, filename)
        
        # Check if file exists
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"File {filename} not found"
            )
        
        # Delete the file
        os.remove(file_path)
        
        return {
            "success": True,
            "message": f"File {filename} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting file: {str(e)}"
        )

@router.post("/update-config")
async def update_config(config_update: ConfigUpdate):
    """Update the configuration values."""
    global current_config, CRAIGSLIST_URLS, KEYWORDS, REMOTE_KEYWORDS, NON_REMOTE_KEYWORDS
    
    try:
        # Update only the provided fields
        update_dict = config_update.dict(exclude_unset=True)
        
        # Validate the update
        if 'urls' in update_dict and not isinstance(update_dict['urls'], list):
            raise HTTPException(status_code=422, detail="URLs must be a list")
        if 'keywords' in update_dict and not isinstance(update_dict['keywords'], list):
            raise HTTPException(status_code=422, detail="Keywords must be a list")
        if 'use_headless' in update_dict and not isinstance(update_dict['use_headless'], bool):
            raise HTTPException(status_code=422, detail="use_headless must be a boolean")
        if 'batch_size' in update_dict and not isinstance(update_dict['batch_size'], int):
            raise HTTPException(status_code=422, detail="batch_size must be an integer")
        if 'max_retries' in update_dict and not isinstance(update_dict['max_retries'], int):
            raise HTTPException(status_code=422, detail="max_retries must be an integer")
        
        # Update the current config
        current_config.update(update_dict)
        
        # Update global variables directly
        if 'urls' in update_dict:
            CRAIGSLIST_URLS = update_dict['urls']
        if 'keywords' in update_dict:
            KEYWORDS = update_dict['keywords']
        if 'remote_keywords' in update_dict and update_dict['remote_keywords']:
            REMOTE_KEYWORDS = update_dict['remote_keywords']
        if 'non_remote_keywords' in update_dict and update_dict['non_remote_keywords']:
            NON_REMOTE_KEYWORDS = update_dict['non_remote_keywords']
        
        # Update the config file
        update_config_file(current_config)
        
        return {
            "message": "Configuration updated successfully",
            "config": current_config
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating configuration: {str(e)}")

@router.get("/current-config")
async def get_current_config():
    """Get the current configuration values."""
    return current_config

@router.post("/cleanup")
async def cleanup():
    """Clean up resources and stop any running scraping process."""
    global scraping_status, scraper
    
    try:
        # Close the scraper if it's running
        if scraper:
            try:
                scraper.close()
                scraper = None
            except:
                pass
            
            # Kill any remaining ChromeDriver processes
            try:
                import psutil
                import subprocess
                for proc in psutil.process_iter(['pid', 'name']):
                    if 'chromedriver' in proc.info['name'].lower():
                        subprocess.run(['taskkill', '/F', '/PID', str(proc.info['pid'])], 
                                    stdout=subprocess.DEVNULL, 
                                    stderr=subprocess.DEVNULL)
            except:
                pass
        
        # Clean up output files
        output_dir = "output"
        if os.path.exists(output_dir):
            for filename in os.listdir(output_dir):
                file_path = os.path.join(output_dir, filename)
                if os.path.isfile(file_path):
                    try:
                        os.remove(file_path)
                    except:
                        pass
        
        # Reset status
        reset_status()
        
        return {"message": "Cleanup completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/view-logs")
async def view_logs(lines: int = 50):
    """View the most recent scraping log entries."""
    try:
        if not os.path.exists(scraping_log_file):
            return {"message": "No log file found", "logs": []}
            
        # Read the last N lines from the log file
        with open(scraping_log_file, 'r') as f:
            # Simple way to get last N lines
            all_lines = f.readlines()
            last_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
        return {
            "message": f"Last {len(last_lines)} log entries",
            "logs": last_lines
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading logs: {str(e)}")

@router.delete("/clean-frontend-files")
async def clean_frontend_files():
    """Delete all files from the frontend public output directory."""
    try:
        # Define the frontend public output directory
        frontend_public_dir = os.getenv('FRONTEND_PUBLIC_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'Frontend', 'public', 'output'))
        
        # Ensure the directory exists
        os.makedirs(frontend_public_dir, exist_ok=True)
        
        # Count deleted files
        deleted_count = 0
        
        # Delete all files in the directory
        for filename in os.listdir(frontend_public_dir):
            file_path = os.path.join(frontend_public_dir, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
                deleted_count += 1
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} files from frontend public directory",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error cleaning frontend files: {str(e)}"
        )

# Include the router in the app
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variables, default to 8000
    port = int(os.getenv('PORT', 8000))
    print(f"\nStarting server on port: {port}")
    print(f"API endpoints: http://localhost:{port}/api")
    print(f"Scraping logs will be saved to: {scraping_log_file}")
    
    # Run the server
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=port, 
        reload=False,
        log_level="info"
    ) 