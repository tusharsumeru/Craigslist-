import os
import requests
import json
import time
import re
from dotenv import load_dotenv
from app.utils.cleaner import clean_input_json

# Force reload of environment variables
print("Loading environment variables...")
load_dotenv(override=True)

# Ollama API URL should be set in .env
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://ollama.sumerudigital.com:11500/")
MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "llama3:70b")
print(f"Using OLLAMA_API_URL: {OLLAMA_API_URL}")
print(f"Using MODEL_NAME: {MODEL_NAME}")

# Reset global variables
server_available = False
available_models = []

# Check if Ollama server is available
def check_ollama_server():
    print(f"Checking Ollama server at {OLLAMA_API_URL}...")
    try:
        response = requests.get(f"{OLLAMA_API_URL}", timeout=5)
        if response.status_code == 200:
            print("✅ Ollama server is available!")
            return True
        else:
            print(f"⚠️ Ollama server returned status code {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not connect to Ollama server: {str(e)}")
        return False

# List available models on the Ollama server
def list_available_models():
    print(f"Listing available models on Ollama server {OLLAMA_API_URL}...")
    
    try:
        # Try different API endpoints for listing models
        endpoints = [
            f"{OLLAMA_API_URL.rstrip('/')}/api/tags",
            f"{OLLAMA_API_URL.rstrip('/')}/api/models"
        ]
        
        for endpoint in endpoints:
            try:
                print(f"Trying to list models from: {endpoint}")
                response = requests.get(endpoint, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"Available models: {json.dumps(result, indent=2)}")
                    
                    # Extract model names depending on the API response format
                    if "models" in result:
                        model_names = [model.get("name") for model in result.get("models", [])]
                        print(f"Available model names: {', '.join(model_names)}")
                        return model_names
                    elif isinstance(result, list):
                        model_names = [model.get("name") for model in result]
                        print(f"Available model names: {', '.join(model_names)}")
                        return model_names
                    
                    return []
                else:
                    print(f"Error listing models from {endpoint}: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"Exception listing models from {endpoint}: {str(e)}")
                continue
                
        print("Could not list models from any endpoint")
        return []
    except Exception as e:
        print(f"Exception listing models: {str(e)}")
        return []

# Run the check when this module is imported
server_available = check_ollama_server()
available_models = []
if server_available:
    available_models = list_available_models()
    if MODEL_NAME not in available_models and available_models:
        print(f"⚠️ Warning: Configured model '{MODEL_NAME}' not found in available models.")
        print(f"Please choose one of: {', '.join(available_models)}")
        print(f"Attempting to use the first available model instead...")
        if available_models:
            # Use the first available model if the configured one isn't available
            print(f"Using model: {available_models[0]}")

def clean_generated_text(text):
    """Clean up the generated text to extract just the email content"""
    
    # First, try to extract just the email part using common patterns
    email_pattern = r'Subject:.*?Reference:.*?$'
    email_match = re.search(email_pattern, text, re.DOTALL | re.IGNORECASE)
    if email_match:
        text = email_match.group(0).strip()
    
    # Remove any AI self-references
    text = re.sub(r'(as an AI|language model|I apologize|I am unable)', '', text, flags=re.IGNORECASE)
    
    # Remove specific instruction patterns that appear in output
    text = re.sub(r'you must write an email|write a job application email|specifically tailored|software developer writing', '', text, flags=re.IGNORECASE)
    text = re.sub(r'keep.*?under \d+ words', '', text, flags=re.IGNORECASE)
    text = re.sub(r'never mention puzzles|never add explanations', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Remember to keep your email.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    text = re.sub(r'This is an example of a job application email.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    text = re.sub(r'The email is kept under.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    
    # Remove all puzzle content
    text = re.sub(r'.*has received \d+ different responses.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    text = re.sub(r'Assume:.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    text = re.sub(r'.*puzzle.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    text = re.sub(r'.*skill is rated.*', '', text, flags=re.DOTALL|re.IGNORECASE)
    
    # Remove random "Hey Abj" inside the email content
    text = re.sub(r'Hey Abj,', '', text)
    
    # Remove any mention of email format instructions
    text = re.sub(r'\[.*?\]', '', text)  # Remove all bracketed instructions
    
    # Remove extraneous newlines and clean up
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

def reconstruct_email(text, link):
    """Reconstruct a properly formatted email from cleaned text"""
    
    # Extract subject if present, or create a generic one
    subject_match = re.search(r'Subject:(.*?)(\n|$)', text, re.IGNORECASE)
    subject = subject_match.group(1).strip() if subject_match else "Job Application"
    
    # Remove existing Subject line to avoid duplication
    text = re.sub(r'Subject:.*?\n', '', text, flags=re.IGNORECASE)
    
    # Split remaining content by paragraphs
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    # Build a proper email
    email = f"Subject: {subject}\n\nHey there,\n\n"
    
    # Add content paragraphs (skip any that look like greetings or signatures)
    content_paragraphs = []
    for p in paragraphs:
        if not re.match(r'(Hey there|Hello|Hi|Dear|Best regards|Regards|Sincerely|Thank you)', p, re.IGNORECASE):
            if not re.match(r'Job Reference:', p, re.IGNORECASE):
                if len(p.split()) > 3:  # Skip very short paragraphs
                    content_paragraphs.append(p)
    
    # If we have content paragraphs, use them
    if content_paragraphs:
        for p in content_paragraphs[:2]:  # Use up to first 2 paragraphs
            email += p + "\n\n"
    else:
        # Fallback content
        email += "I saw your job posting and I'm interested in applying.\n\n"
        email += "I'd love to discuss how my skills align with your requirements.\n\n"
    
    email += "Best regards,\nAbj\n\nJob Reference: " + link
    
    return email

def enforce_template(text, link):
    """Ensure the output follows our template structure while preserving specifics"""
    
    # Clean up the text first - remove all meta instructions and puzzle content
    text = clean_generated_text(text)
    
    # If text is too short after cleaning, use a simple template
    if len(text.strip()) < 20:
        template = f"""Subject: Job Application

Hey there,

I saw your job posting and I'm interested in the position.

I'd love to discuss how my skills match your requirements.

Best regards,
Abj

Job Reference: {link}"""
        return template
    
    # Check if we already have all required components
    has_subject = "Subject:" in text
    has_greeting = any(greeting in text for greeting in ["Hey there", "Hello", "Hi ", "Dear"])
    has_signature = "Best regards" in text or "Regards" in text or "Sincerely" in text
    has_job_ref = "Job Reference:" in text
    
    # If the email seems well-structured, just fix the job reference
    if has_subject and has_greeting and has_signature and len(text.split()) > 20:
        # Fix or add the job reference
        if not has_job_ref:
            text += f"\n\nJob Reference: {link}"
        elif not (f"Job Reference: {link}" in text):
            text = re.sub(r'Job Reference:.*?(\n|$)', f'Job Reference: {link}\n', text, flags=re.DOTALL|re.IGNORECASE)
        return text
    
    # Otherwise reconstruct a proper email from the cleaned text
    return reconstruct_email(text, link)

def generate_reply(prompt_config, title, description, date, link, city):
    # Clean the input using the cleaner utility
    cleaned_input = clean_input_json({
        "title": title,
        "description": description,
        "dateOfPost": date,
        "persona": prompt_config.get("name", "Abj"),
        "link": link,
        "city": city
    })

    # Get the system prompt from the prompt config
    system_prompt = prompt_config['system_prompt']
    
    # Extract key skills and requirements from the job description
    job_desc = cleaned_input['description']
    job_title = cleaned_input['title']
    
    # Check if the server is running and get available models
    server_available = check_ollama_server()
    if not server_available:
        # If Ollama is not available, provide a fallback template response
        print("⚠️ WARNING: Ollama server is not running. Using fallback template response.")
        print("To use Ollama models, make sure Ollama is installed and running on your system.")
        print("Download Ollama from: https://ollama.ai/download")
        
        # Create a simple fallback response
        return f"""Subject: Interested in {job_title}

Hey there,

I came across your job posting for {job_title} and I'm very interested in the position. The role aligns well with my skills and experience.

I'd love to discuss how I can contribute to your team. Please let me know if you'd like to connect.

Best regards,
Abj

Job Reference: {cleaned_input['link']}
"""
    
    # Optimized prompt specifically for Llama 3 70B
    llama3_prompt = f"""
You are Abj, a professional job applicant writing an email for a job.

Write a job application email for this position:
TITLE: {job_title}

DESCRIPTION: {job_desc}

The email must:
1. Include a relevant subject line (4-6 words)
2. Start with "Hey there,"
3. Have a first paragraph mentioning the job and highlighting relevant skills (2-3 sentences)
4. Have a second paragraph expressing interest and suggesting to connect (1-2 sentences)
5. End with "Best regards, Abj"
6. Include the job reference URL: {cleaned_input['link']}

IMPORTANT: Write ONLY the email content. Do not include any explanations.
Output the email in this exact format:
Subject: [relevant job title]

Hey there,

[First paragraph]

[Second paragraph]

Best regards,
Abj

Job Reference: {cleaned_input['link']}
"""

    models = list_available_models()
    if not models:
        print("⚠️ WARNING: No models available on Ollama server. Using fallback template response.")
        return f"""Subject: Interested in {job_title}

Hey there,

I came across your job posting for {job_title} and I'm very interested in the position. The role aligns well with my skills and experience.

I'd love to discuss how I can contribute to your team. Please let me know if you'd like to connect.

Best regards,
Abj

Job Reference: {cleaned_input['link']}
"""
    
    # Look for Llama 3 70B specifically
    model_to_use = None
    for model in models:
        model_lower = model.lower()
        if any(pattern in model_lower for pattern in [
            "llama3:70b", 
            "llama3-70b", 
            "llama-3-70b", 
            "llama-3:70b", 
            "llama3-70b-q", 
            "llama3:70b-q",
            "llama-70b",
            "llama3",
            "llama-3"
        ]):
            model_to_use = model
            print(f"Found Llama model: {model}")
            break
    
    # Try other capable models if Llama not found
    if not model_to_use:
        for model in models:
            model_lower = model.lower()
            if any(pattern in model_lower for pattern in ["mistral", "phi3", "phi-3", "phi", "gemma", "qwen"]):
                model_to_use = model
                print(f"Found alternative model: {model}")
                break
    
    # Last resort fallback to any available model
    if not model_to_use and models:
        model_to_use = models[0]
        print(f"Using fallback model: {model_to_use}")
    
    if not model_to_use:
        print("⚠️ WARNING: No suitable model found on Ollama server. Using fallback template response.")
        return f"""Subject: Interested in {job_title}

Hey there,

I came across your job posting for {job_title} and I'm very interested in the position. The role aligns well with my skills and experience.

I'd love to discuss how I can contribute to your team. Please let me know if you'd like to connect.

Best regards,
Abj

Job Reference: {cleaned_input['link']}
"""
    
    # Optimized settings for Llama 3 70B
    # Use API method tailored for the model
    print(f"Starting generation with model: {model_to_use}")
    start_time = time.time()
    
    # Build the API call to Ollama
    try:
        # Prepare the JSON payload for the Ollama API
        payload = {
            "model": MODEL_NAME,
            "prompt": llama3_prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40
            }
        }
        
        # Log the API request
        api_url = f"{OLLAMA_API_URL.rstrip('/')}/api/generate"
        print(f"Making API request to: {api_url}")
        print(f"Using model: {MODEL_NAME}")
        
        # Try using the larger model first
        try:
            print(f"Attempting to generate with {MODEL_NAME} (this may take several minutes)...")
            # Make the API call to Ollama with increased timeout
            response = requests.post(
                api_url,
                json=payload,
                timeout=300  # Increased timeout from 120 to 300 seconds (5 minutes)
            )
            
            # Check the response status
            if response.status_code == 200:
                result = response.json()
                generated_text = result.get("response", "")
                print(f"Generated {len(generated_text)} characters of text")
            else:
                raise Exception(f"Ollama API returned status {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout:
            # If the larger model times out, try with a smaller model
            print(f"⚠️ Timeout with {MODEL_NAME}, attempting to use a smaller model...")
            
            # Try to find a smaller model (8B or 1B variant)
            for smaller_model in ["llama3:8b", "llama3.2:1b", "phi:latest"]:
                if smaller_model in available_models:
                    print(f"Found smaller model: {smaller_model}")
                    # Update the payload with the smaller model
                    payload["model"] = smaller_model
                    
                    try:
                        # Try with the smaller model
                        print(f"Attempting to generate with {smaller_model}...")
                        response = requests.post(
                            api_url,
                            json=payload,
                            timeout=180  # 3 minutes timeout for smaller model
                        )
                        
                        if response.status_code == 200:
                            result = response.json()
                            generated_text = result.get("response", "")
                            print(f"Generated {len(generated_text)} characters of text with {smaller_model}")
                            break
                    except Exception as e:
                        print(f"Error with smaller model {smaller_model}: {str(e)}")
                        continue
            else:
                # If no smaller model worked, use the fallback template
                print("⚠️ All model attempts failed. Using fallback template.")
                return f"""Subject: Interested in {job_title}

Hey there,

I came across your job posting for {job_title} and I'm very interested in the position. The role aligns well with my skills and experience.

I'd love to discuss how I can contribute to your team. Please let me know if you'd like to connect.

Best regards,
Abj

Job Reference: {cleaned_input['link']}
"""
        
        # Post-process the generated text
        clean_text = clean_generated_text(generated_text)
        final_email = enforce_template(clean_text, cleaned_input['link'])
        
        return final_email
    except Exception as e:
        error_msg = f"Exception occurred: {str(e)}"
        print(error_msg)
        return error_msg 