import uvicorn
import os
import sys

# Add the current directory to Python path to ensure 'app' is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting SentinelSafe Risk Engine backend server...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
