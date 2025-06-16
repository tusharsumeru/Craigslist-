from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
import os
import re
import logging
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mailing_service.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(override=True)

EMAIL_ADDRESS = os.getenv("EMAIL_ID")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

# Ensure output directory exists
os.makedirs('output', exist_ok=True)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Frontend URL
        "http://localhost:61325",  # MailGenrator service URL
        "http://127.0.0.1:61325",  # Alternative MailGenrator URL
        "http://0.0.0.0:61325",    # Another alternative
        "https://scrapper.sumerudigital.com:5173",  # Production frontend
        "https://scrapper.sumerudigital.com:61325",  # Production MailGenrator
        "http://192.168.1.145:5173",  # Frontend IP from error
        "http://192.168.1.145:61325"  # MailGenrator IP
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Request body model
class MailRequest(BaseModel):
    mail_id: EmailStr
    subject: str
    mail_body: str

def sanitize_subject(subject):
    """Remove newlines and carriage returns from subject line"""
    if not subject:
        return "No Subject"
    # Replace any combination of newlines, carriage returns with a space
    return re.sub(r'[\r\n]+', ' ', subject).strip()

def sanitize_email_body(body):
    """Ensure the email body doesn't contain problematic characters"""
    if not body:
        return "Empty email body"
    return body

@app.get("/health")
def health_check():
    """Health check endpoint to verify the service is running."""
    return {
        "status": "healthy",
        "service": "MailingService",
        "version": "1.0.0"
    }

@app.post("/send-mail")
def send_mail(request: MailRequest):
    try:
        # Clean subject and body to prevent headers issues
        clean_subject = sanitize_subject(request.subject)
        clean_body = sanitize_email_body(request.mail_body)
        
        logger.info(f"Sending email to: {request.mail_id}")
        logger.info(f"Subject: {clean_subject}")
        
        msg = EmailMessage()
        msg['Subject'] = clean_subject
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = request.mail_id
        msg.set_content(clean_body)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            smtp.send_message(msg)

        return {
            "status": 200,
            "message": f"Mail sent to {request.mail_id}"
        }

    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cleanup")
def cleanup():
    """Clean up any temporary files and reset the service state."""
    try:
        logger.info("Starting cleanup process...")
        
        # Clean up output directory
        output_dir = 'output'
        if os.path.exists(output_dir):
            try:
                shutil.rmtree(output_dir)
                os.makedirs(output_dir, exist_ok=True)
                logger.info("Output directory cleaned successfully")
            except Exception as e:
                logger.error(f"Error cleaning output directory: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to clean output directory: {str(e)}"
                )
        
        # Clean up any temporary files
        temp_files = [f for f in os.listdir('.') if f.endswith('.tmp')]
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
                logger.info(f"Removed temporary file: {temp_file}")
            except Exception as e:
                logger.error(f"Error removing temporary file {temp_file}: {str(e)}")
        
        logger.info("Cleanup completed successfully")
        return {
            "status": 200,
            "message": "Cleanup completed successfully"
        }
        
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clean up server files: {str(e)}"
        )
