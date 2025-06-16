from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import email_routes

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",     # Frontend URL (dev)
        "http://localhost:8020",     # MailingService URL
        "http://127.0.0.1:8020",     # Alternative MailingService URL
        "http://192.168.1.145:5173", # Frontend URL with IP (from error message)
        "http://192.168.1.145:3000", # Possible production or alternative port
        "http://192.168.1.145"       # Root domain
    ],
    allow_credentials=True,
    allow_methods=["*"],             # Allows all methods
    allow_headers=["*"],             # Allows all headers
)

app.include_router(email_routes.router, prefix="/api")
