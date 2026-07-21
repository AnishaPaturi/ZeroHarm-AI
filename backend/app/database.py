import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger("zeroharm_ai.database")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "zeroharm.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    employee_id TEXT,
    mobile TEXT,
    gov_id TEXT,
    company_name TEXT,
    plant_location TEXT,
    department TEXT,
    designation TEXT,
    reporting_manager_name TEXT,
    reporting_manager_email TEXT,
    cert_number TEXT,
    cert_authority TEXT,
    cert_expiry TEXT,
    cert_file_name TEXT,
    requested_scopes TEXT,
    submitted_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    role TEXT,
    created_at TEXT,
    updated_at TEXT
);
"""

CREATE_INDEX_EMAIL = "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"
CREATE_INDEX_STATUS = "CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);"
CREATE_NOTIFICATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    title TEXT NOT NULL,

    message TEXT NOT NULL,

    category TEXT NOT NULL,

    severity TEXT NOT NULL,

    created_at TEXT NOT NULL,

    is_read INTEGER DEFAULT 0
);
"""

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    try:
        conn.execute(CREATE_USERS_TABLE)
        conn.execute(CREATE_INDEX_EMAIL)
        conn.execute(CREATE_INDEX_STATUS)
        conn.execute(CREATE_NOTIFICATIONS_TABLE)
        conn.commit()
        logger.info(f"Database initialized at {DB_PATH}")
    finally:
        conn.close()


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    if d.get("requested_scopes"):
        try:
            d["requested_scopes"] = json.loads(d["requested_scopes"])
        except json.JSONDecodeError:
            d["requestedScopes"] = []
    return d


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),))
        row = cur.fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def get_users_by_status(status: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.execute("SELECT * FROM users WHERE status = ?", (status,))
        return [_row_to_dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def create_pending_user(data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()
    user_id = f"usr_{int(datetime.utcnow().timestamp() * 1000)}"
    scopes = data.get("requestedScopes", [])
    if isinstance(scopes, list):
        scopes = json.dumps(scopes)
    else:
        scopes = json.dumps([])

    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO users (
                id, email, full_name, employee_id, mobile, gov_id, company_name,
                plant_location, department, designation, reporting_manager_name,
                reporting_manager_email, cert_number, cert_authority, cert_expiry,
                cert_file_name, requested_scopes, submitted_at, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                data["email"].lower(),
                data["fullName"],
                data.get("employeeId"),
                data.get("mobile"),
                data.get("govId"),
                data.get("companyName"),
                data.get("plantLocation"),
                data.get("department"),
                data.get("designation"),
                data.get("reportingManagerName"),
                data.get("reportingManagerEmail"),
                data.get("certNumber"),
                data.get("certAuthority"),
                data.get("certExpiry"),
                data.get("certFileName"),
                scopes,
                now,
                "pending",
                now,
                now,
            ),
        )
        conn.commit()
        return get_user_by_email(data["email"])
    finally:
        conn.close()


def approve_user(email: str, role: str) -> Optional[Dict[str, Any]]:
    now = datetime.utcnow().isoformat()
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE users SET status = 'approved', role = ?, updated_at = ? WHERE email = ? AND status = 'pending'",
            (role, now, email.lower()),
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
        return get_user_by_email(email)
    finally:
        conn.close()


def reject_user(email: str) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM users WHERE email = ? AND status = 'pending'", (email.lower(),))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def seed_default_users():
    default_accounts = [
        {
            "id": "usr_1",
            "email": "safety@zeroharm.ai",
            "full_name": "Sarah Jenkins",
            "employee_id": "EMP-1001",
            "mobile": "+919900000001",
            "gov_id": None,
            "company_name": "ZeroHarm AI",
            "plant_location": "Plant A - Refinery Complex",
            "department": "HSE (Health, Safety, Environment)",
            "designation": "safety officer",
            "reporting_manager_name": "David Vance",
            "reporting_manager_email": "manager@zeroharm.ai",
            "cert_number": None,
            "cert_authority": None,
            "cert_expiry": None,
            "cert_file_name": None,
            "requested_scopes": json.dumps(["read", "write"]),
            "submitted_at": datetime.utcnow().isoformat(),
            "status": "approved",
            "role": "Safety Officer",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "usr_2",
            "email": "manager@zeroharm.ai",
            "full_name": "David Vance",
            "employee_id": "EMP-1002",
            "mobile": "+919900000002",
            "gov_id": None,
            "company_name": "ZeroHarm AI",
            "plant_location": "Plant A - Refinery Complex",
            "department": "Plant Operations",
            "designation": "plant manager",
            "reporting_manager_name": "Marcus Brody",
            "reporting_manager_email": "inspector@zeroharm.ai",
            "cert_number": None,
            "cert_authority": None,
            "cert_expiry": None,
            "cert_file_name": None,
            "requested_scopes": json.dumps(["read", "write", "approve"]),
            "submitted_at": datetime.utcnow().isoformat(),
            "status": "approved",
            "role": "Plant Manager",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        {
            "id": "usr_3",
            "email": "inspector@zeroharm.ai",
            "full_name": "Marcus Brody",
            "employee_id": "EMP-1003",
            "mobile": "+919900000003",
            "gov_id": None,
            "company_name": "ZeroHarm AI",
            "plant_location": "Plant B - Chemical Storage",
            "department": "Compliance Auditing",
            "designation": "industrial inspector",
            "reporting_manager_name": "Sarah Jenkins",
            "reporting_manager_email": "safety@zeroharm.ai",
            "cert_number": None,
            "cert_authority": None,
            "cert_expiry": None,
            "cert_file_name": None,
            "requested_scopes": json.dumps(["read", "audit"]),
            "submitted_at": datetime.utcnow().isoformat(),
            "status": "approved",
            "role": "Industrial Inspector",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
    ]

    conn = get_connection()
    try:
        for user in default_accounts:
            conn.execute(
                """
                INSERT OR IGNORE INTO users (
                    id, email, full_name, employee_id, mobile, gov_id, company_name,
                    plant_location, department, designation, reporting_manager_name,
                    reporting_manager_email, cert_number, cert_authority, cert_expiry,
                    cert_file_name, requested_scopes, submitted_at, status, role, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user["id"],
                    user["email"],
                    user["full_name"],
                    user["employee_id"],
                    user["mobile"],
                    user["gov_id"],
                    user["company_name"],
                    user["plant_location"],
                    user["department"],
                    user["designation"],
                    user["reporting_manager_name"],
                    user["reporting_manager_email"],
                    user["cert_number"],
                    user["cert_authority"],
                    user["cert_expiry"],
                    user["cert_file_name"],
                    user["requested_scopes"],
                    user["submitted_at"],
                    user["status"],
                    user["role"],
                    user["created_at"],
                    user["updated_at"],
                ),
            )
        conn.commit()
        logger.info("Default users seeded successfully")
    finally:
        conn.close()
