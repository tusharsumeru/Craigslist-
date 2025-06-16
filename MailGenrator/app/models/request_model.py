from pydantic import BaseModel, EmailStr
from typing import Optional

class EmailRequest(BaseModel):
    title: str
    description: str
    dateOfPost: str
    persona: str
    link: str
    city: str
    recipient: Optional[EmailStr] = None
