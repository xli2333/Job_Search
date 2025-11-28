import subprocess
import time
import os
import sys

def main():
    print("Starting JobScout AI...")
    
    # Paths
    root = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root, "ai-job-scout-filter-workbench")
    
    # Start Backend (server.py in root)
    print("🚀 Starting Backend (server.py)...")
    # We run uvicorn on server:app. 
    # server.py is in 'root', so we can run from 'root'.
    backend_cmd = f'"{sys.executable}" -m uvicorn server:app --reload --port 8000'
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=root,
        shell=True
    )
    
    # Start Frontend
    print("🚀 Starting Frontend (Vite)...")
    # check if node_modules exists
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
         print("Installing frontend dependencies...")
         subprocess.run("npm install", cwd=frontend_dir, shell=True)

    frontend_process = subprocess.Popen(
        "npm run dev",
        cwd=frontend_dir,
        shell=True
    )
    
    print("\n✅ System running!")
    print("   Backend API: http://localhost:8000/docs")
    print("   Frontend UI: http://localhost:5173") 
    print("\nPress Ctrl+C to stop everything.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping services...")
        backend_process.terminate()
        frontend_process.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()