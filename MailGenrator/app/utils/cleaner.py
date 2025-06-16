import re
from datetime import datetime

def clean_text(text):
    # Remove non-ASCII characters and collapse extra spaces
    text = text.encode('ascii', 'ignore').decode()
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def normalize_date(date_str):
    try:
        # Parse JavaScript-style timestamp
        parsed = datetime.strptime(date_str[:24], '%a %b %d %Y %H:%M:%S')
        return parsed.strftime('%Y-%m-%d')
    except Exception:
        return date_str.strip()

def clean_input_json(raw_json):
    return {
        "title": clean_text(raw_json.get("title", "")),
        "description": clean_text(raw_json.get("description", "")),
        "dateOfPost": normalize_date(raw_json.get("dateOfPost", "")),
        "persona": raw_json.get("persona", "Abj"),
        "link": raw_json.get("link", ""),
        "city": clean_text(raw_json.get("city", ""))
    }
