from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
from datetime import datetime
from scraper_past_24h import scrape_jobs

app = FastAPI()

# Enable CORS - Allow Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your Vercel URL e.g. ["https://your-app.vercel.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-Memory Storage (Replaces CSV file)
# Note: Data will be lost if the Render server restarts (spins down).
# This is acceptable for a free-tier prototype.
GLOBAL_JOBS_CACHE = []

# Global Scraper State
SCRAPER_STATE = {
    "is_running": False,
    "current": 0,
    "total": 0,
    "message": "Idle"
}

def update_progress(current, total, message):
    SCRAPER_STATE["current"] = current
    SCRAPER_STATE["total"] = total
    SCRAPER_STATE["message"] = message

def run_scraper_background():
    global SCRAPER_STATE, GLOBAL_JOBS_CACHE
    try:
        SCRAPER_STATE["is_running"] = True
        SCRAPER_STATE["current"] = 0
        SCRAPER_STATE["total"] = 0
        SCRAPER_STATE["message"] = "Initializing..."
        
        # Run scraper and update global cache directly
        jobs_data = scrape_jobs(progress_callback=update_progress)
        
        # Transform keys to match frontend expectation if needed, 
        # or ensure frontend matches scraper output.
        # Scraper outputs: Title, Company, Location, Date, Link, Description
        # Frontend expects: title, company, location, postedDate, url, description
        
        formatted_jobs = []
        for index, item in enumerate(jobs_data):
            formatted_jobs.append({
                "id": f"job-{index}",
                "title": item.get("Title", "Unknown"),
                "company": item.get("Company", "Unknown"),
                "location": item.get("Location", "Unknown"),
                "postedDate": item.get("Date", "Recent"),
                "url": item.get("Link", "#"),
                "description": item.get("Description", "No description")
            })
            
        GLOBAL_JOBS_CACHE = formatted_jobs
        
    except Exception as e:
        SCRAPER_STATE["message"] = f"Error: {str(e)}"
    finally:
        SCRAPER_STATE["is_running"] = False
        SCRAPER_STATE["message"] = "Completed"

@app.get("/api/status")
async def get_status():
    return SCRAPER_STATE

@app.get("/api/db_check")
async def check_db():
    global GLOBAL_JOBS_CACHE
    exists = len(GLOBAL_JOBS_CACHE) > 0
    return {
        "exists": exists, 
        "count": len(GLOBAL_JOBS_CACHE), 
        "filename": "Memory Cache"
    }

@app.post("/api/scrape")
async def trigger_scrape(background_tasks: BackgroundTasks):
    if SCRAPER_STATE["is_running"]:
        return {"status": "error", "message": "Scraper is already running"}
    
    background_tasks.add_task(run_scraper_background)
    return {"status": "started", "message": "Scraper started"}

@app.get("/api/jobs")
async def get_jobs():
    global GLOBAL_JOBS_CACHE
    
    if GLOBAL_JOBS_CACHE:
         return {"status": "ready", "jobs": GLOBAL_JOBS_CACHE, "source": "memory"}
    else:
        return {"status": "missing", "message": "No data found. Please run scraper."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)