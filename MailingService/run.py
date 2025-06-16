import uvicorn
from dotenv import load_dotenv
import os
import multiprocessing

load_dotenv()
port = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    multiprocessing.freeze_support()
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)