import subprocess
import sys
import requests
import time

BASE_URL = "http://127.0.0.1:8000"

TEST_SCRIPTS = [
    ("Person A: Risk Rules & ML Engine", "backend/test_api.py"),
    ("Person B: Heatmap & Evacuations", "backend/test_api_b.py"),
    ("Person C: RAG & Compliance Audit", "backend/test_api_c.py"),
    ("Person D: Permits & Integration", "backend/test_api_d.py"),
    ("CCTV / Computer Vision Analytics", "backend/test_cctv.py"),
    ("Temporal Rate-of-Change Tracking", "backend/test_temporal.py"),
    ("Plant Topology cascading risk", "backend/test_topology.py"),
    ("Black Box Evidence Preservation", "backend/test_blackbox.py"),
    ("Near Miss Prediction Engine", "backend/test_near_miss.py")
]

def check_server_running():
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=3)
        return response.status_code == 200
    except Exception as e:
        print(f"DEBUG: check_server_running failed with exception: {type(e).__name__}: {e}")
        return False

def run_script(name, path):
    print(f"\n======================================================================")
    print(f"RUNNING: {name} ({path})")
    print(f"======================================================================")
    
    # Run the script and stream its stdout/stderr
    result = subprocess.run([sys.executable, path], text=True)
    return result.returncode == 0

def main():
    print("ZeroHarm AI - Unified Test Runner")
    print("---------------------------------")
    
    if not check_server_running():
        print("ERROR: ZeroHarm AI backend server is not running on http://127.0.0.1:8000.")
        print("Please start the server first in another window/terminal by running:")
        print("    python backend/run.py")
        sys.exit(1)
        
    print("Backend server is running. Initiating tests...\n")
    time.sleep(1)
    
    summary = []
    
    for name, path in TEST_SCRIPTS:
        success = run_script(name, path)
        summary.append((name, path, "PASS" if success else "FAIL"))
        # Add a tiny delay between test suites to let async operations settle
        time.sleep(0.5)
        
    print("\n" + "="*50)
    print("FINAL TEST RUNNER SUMMARY")
    print("="*50)
    for name, path, status in summary:
        print(f"  [{status}] {name:<35} ({path})")
    print("="*50)

if __name__ == "__main__":
    main()
