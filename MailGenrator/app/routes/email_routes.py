from fastapi import APIRouter, HTTPException
from app.models.request_model import EmailRequest
from app.services.llama_service import generate_reply
from app.config.prompts import get_prompt_by_persona
from app.utils.cleaner import clean_input_json
import requests
import re
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MailingService endpoint
MAILING_SERVICE_URL = os.getenv("MAILING_SERVICE_URL", "http://localhost:8020/send-mail")

router = APIRouter()

@router.post("/generate/")
async def generate_email(request: EmailRequest):
    prompt_config = get_prompt_by_persona(request.persona)

    if not prompt_config:
        raise HTTPException(status_code=404, detail="Persona not found")

    # ✅ Clean the incoming input JSON
    cleaned_request = clean_input_json(request.dict())

    # Now pass clean values into Llama service
    reply = generate_reply(
        prompt_config,
        cleaned_request['title'],
        cleaned_request['description'],
        cleaned_request['dateOfPost'],
        cleaned_request['link'],
        cleaned_request['city']
    )

    return {"reply": reply}

# Function to extract subject from generated email
def extract_subject_from_email(email_body):
    subject_match = re.search(r'Subject:(.*?)(\n|$)', email_body, re.IGNORECASE)
    if subject_match:
        subject = subject_match.group(1).strip()
        # Sanitize subject by removing newlines and carriage returns
        subject = re.sub(r'[\r\n]+', ' ', subject).strip()
        return subject
    return "Response to your job posting"

@router.post("/send/")
async def send_email(request: EmailRequest):
    """Generate an email and send it directly to the specified Craigslist address"""
    
    # Check if recipient is provided
    if not request.recipient:
        raise HTTPException(status_code=400, detail="Recipient email address is required")
    
    # First generate the email content
    prompt_config = get_prompt_by_persona(request.persona)
    if not prompt_config:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    # Clean the request data
    cleaned_request = clean_input_json(request.dict())
    
    try:
        # Generate the email content
        email_body = generate_reply(
            prompt_config,
            cleaned_request['title'],
            cleaned_request['description'],
            cleaned_request['dateOfPost'],
            cleaned_request['link'],
            cleaned_request['city']
        )
        
        # Extract the subject from the email body
        subject = extract_subject_from_email(email_body)
        
        # Remove the subject line from the email body before sending
        email_body = re.sub(r'Subject:.*?(\n|$)', '', email_body, flags=re.IGNORECASE).strip()
        
        # Prepare the payload for the mailing service
        mail_request = {
            "mail_id": request.recipient,
            "subject": subject,
            "mail_body": email_body
        }
        
        # Call the mailing service to send the email
        response = requests.post(MAILING_SERVICE_URL, json=mail_request)
        
        if response.status_code == 200:
            return {
                "success": True,
                "message": f"Email sent to {request.recipient}",
                "email_content": email_body
            }
        else:
            error_detail = response.json().get("detail", str(response.status_code))
            return {
                "success": False,
                "message": f"Failed to send email: {error_detail}",
                "email_content": email_body
            }
    except requests.RequestException as e:
        return {
            "success": False,
            "message": f"Network error: {str(e)}",
            "email_content": email_body if 'email_body' in locals() else "Email generation failed"
        }
    except Exception as e:
        error_type = type(e).__name__
        return {
            "success": False,
            "message": f"Error ({error_type}): {str(e)}",
            "email_content": email_body if 'email_body' in locals() else "Email generation failed"
        }
