import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
import os

# Load environment variables
print("Loading environment variables...")
load_dotenv(override=True)

EMAIL_ADDRESS = os.getenv("EMAIL_ID")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

print(f"Email Address from .env: {EMAIL_ADDRESS}")
print(f"Password length from .env: {len(EMAIL_PASSWORD) if EMAIL_PASSWORD else 0} characters")

print(f"Testing connection with: {EMAIL_ADDRESS}")

try:
    # Connect to Gmail SMTP server
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        print("Attempting to login...")
        smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        print("Login successful!")
        
        # Create a simple test email
        msg = EmailMessage()
        msg['Subject'] = 'Test Email'
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = EMAIL_ADDRESS  # Sending to self for testing
        msg.set_content('This is a test email to verify SMTP credentials.')
        
        # Send the email
        print("Sending test email...")
        smtp.send_message(msg)
        print("Email sent successfully!")

except Exception as e:
    print(f"Error: {str(e)}") 