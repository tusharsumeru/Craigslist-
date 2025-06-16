import os
from openai import OpenAI
from dotenv import load_dotenv
from app.utils.cleaner import clean_input_json


load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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

    system_prompt = prompt_config['system_prompt']

    user_prompt = f"""
    City: {cleaned_input['city']}
    Title: {cleaned_input['title']}
    Date Posted: {cleaned_input['dateOfPost']}
    Job Link: {cleaned_input['link']}

    Job Description:
    {cleaned_input['description']}

    Write a full professional email based on the above content. Make sure to:
    1. Reference the job link in your response
    2. Add the job link at the very bottom of the email after your signature, formatted as:
    
    Job Reference: {cleaned_input['link']}
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    response = client.chat.completions.create(
        model="gpt-4",
        messages=messages,
        temperature=0.7
    )

    return response.choices[0].message.content
