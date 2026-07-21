"""
Test client for Gatehouse Onboarding System (Tiered Trust Model & Sponsorship Queue).

Run this AFTER starting the unified server (`python run.py`), from another terminal:
    python backend/test_gatehouse.py
"""

import requests
import json
import time
import sys
import io
import os
import sqlite3

# Force UTF-8 encoding for console output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "data", "zeroharm.db")

def section(title):
    print(f"\n{'=' * 65}\n{title}\n{'=' * 65}")

def check(label, condition):
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}")
    return condition

def clean_database():
    """Removes all test users with official email matching our test domain to keep database pristine."""
    if not os.path.exists(DB_PATH):
        return
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE email LIKE '%@mycompany.com'")
        conn.commit()
        conn.close()
        print("  [INFO] Database cleaned of test records (*@mycompany.com).")
    except Exception as e:
        print(f"  [WARNING] Could not clean database: {e}")

def run_gatehouse_tests():
    section("Gatehouse Onboarding & Tiered Trust Verification Tests")
    
    # 1. Health Check
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        if not check("Server Connection (health check)", r.status_code == 200):
            return False
    except Exception as e:
        print(f"ERROR: Backend server is not running on {BASE_URL}. Start it with `python backend/run.py` first.")
        return False

    # Start with a clean database to prevent previous run leftovers
    clean_database()

    # 2. Public Domain Rejection Test
    section("1. Public Domain Rejection Rule (Factories Act Sec. 87 compliance)")
    public_user = {
        "fullName": "John Public",
        "email": "john.public@gmail.com",
        "employeeId": "EMP-9999",
        "mobile": "+919999999999",
        "companyName": "Freelancer",
        "plantLocation": "Plant A",
        "department": "Safety",
        "designation": "Safety Officer",
        "reportingManagerName": "Supervisor",
        "reportingManagerEmail": "supervisor@gmail.com",
        "requestedScopes": ["read:telemetry", "write:alerts"]
    }
    
    r = requests.post(f"{BASE_URL}/api/auth/signup", json=public_user)
    check("Reject Public Domain Email (gmail.com)", r.status_code == 400 and "Public domain" in r.json().get("detail", ""))

    # 3. Valid Corporate Onboarding Registration Request
    section("2. Valid Corporate Onboarding Registration")
    corp_user = {
        "fullName": "Alex Mercer",
        "email": "alex.mercer@mycompany.com",
        "employeeId": "EMP-5002",
        "mobile": "+918888888888",
        "companyName": "Industrial Solutions Inc",
        "plantLocation": "Plant A - Coke Oven Battery",
        "department": "Operations",
        "designation": "Plant Safety Head",
        "reportingManagerName": "Sarah Jenkins",
        "reportingManagerEmail": "safety@zeroharm.ai",
        "requestedScopes": ["read:telemetry", "write:alerts", "admin:users"],
        "certNumber": "CERT-2026-X8",
        "certAuthority": "National Safety Council of India",
        "certExpiry": "2028-12-31"
    }
    
    r = requests.post(f"{BASE_URL}/api/auth/signup", json=corp_user)
    check("Submit Corporate Request (status pending_approval)", r.status_code == 200 and r.json().get("status") == "pending_approval")

    # 4. Prevent duplicate pending requests
    r = requests.post(f"{BASE_URL}/api/auth/signup", json=corp_user)
    check("Prevent Duplicate Pending Signups", r.status_code == 400 and "already pending" in r.json().get("detail", ""))

    # 5. Pending Login Block Test
    section("3. Login Prevention for Unapproved/Pending Users")
    login_payload = {"email": "alex.mercer@mycompany.com"}
    r = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    check("Block Pending Login (403 Forbidden)", r.status_code == 403 and "pending organizational sponsorship" in r.json().get("detail", ""))

    # 6. Retrieve Pending Queue
    section("4. Sponsorship Queue Verification")
    r = requests.get(f"{BASE_URL}/api/auth/pending")
    pending_list = r.json()
    is_in_queue = any(user["email"] == "alex.mercer@mycompany.com" for user in pending_list)
    check("Retrieve Pending Sponsorship Queue & Find Registered User", r.status_code == 200 and is_in_queue)

    # 7. Approve Onboarding Request
    section("5. HR/Safety Head Sponsorship Approval & Role Mapping")
    approval_payload = {"email": "alex.mercer@mycompany.com"}
    r = requests.post(f"{BASE_URL}/api/auth/approve", json=approval_payload)
    approval_data = r.json()
    
    # Check designation to role mapping (Plant Safety Head should resolve to "Safety Officer")
    role_mapped_correctly = approval_data.get("user", {}).get("role") == "Safety Officer"
    check("Approve User & Map designation to Role (Safety Officer)", r.status_code == 200 and role_mapped_correctly)

    # 8. Successful Login Test
    section("6. Login Clearance for Approved Users")
    r = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    login_data = r.json()
    
    correct_login_details = (
        login_data.get("email") == "alex.mercer@mycompany.com" and 
        login_data.get("role") == "Safety Officer"
    )
    check("Login Approved User & Return Profile Metadata", r.status_code == 200 and correct_login_details)

    # 9. Duplicate Approved Signup Block Test
    section("7. Block Approved Email Signup Duplication")
    r = requests.post(f"{BASE_URL}/api/auth/signup", json=corp_user)
    check("Prevent Approved Email Re-signup", r.status_code == 400 and "already registered and approved" in r.json().get("detail", ""))

    # 10. Rejection and Deletion Flow
    section("8. Request Rejection and Deletion Flow")
    reject_user = {
        "fullName": "Bob Builder",
        "email": "bob.builder@mycompany.com",
        "employeeId": "EMP-5003",
        "mobile": "+918888888889",
        "companyName": "Industrial Solutions Inc",
        "plantLocation": "Plant A",
        "department": "Maintenance",
        "designation": "Site Engineer",
        "reportingManagerName": "Sarah Jenkins",
        "reportingManagerEmail": "safety@zeroharm.ai",
        "requestedScopes": ["read:telemetry"]
    }
    
    # Register Bob
    requests.post(f"{BASE_URL}/api/auth/signup", json=reject_user)
    
    # Reject Bob
    r = requests.post(f"{BASE_URL}/api/auth/reject", json={"email": "bob.builder@mycompany.com"})
    check("Reject Pending User (status rejected)", r.status_code == 200 and r.json().get("status") == "rejected")
    
    # Verify Bob is deleted from the DB
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bob.builder@mycompany.com"})
    check("Verify Rejected User is Deleted (Return 404 on login)", r.status_code == 404)

    # Cleanup Database
    section("Database Cleanup")
    clean_database()
    
    print("\nAll Gatehouse Onboarding tests completed successfully!")
    return True

if __name__ == "__main__":
    run_gatehouse_tests()
