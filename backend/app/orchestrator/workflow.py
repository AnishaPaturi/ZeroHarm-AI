import uuid
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SafetyWorkflow(BaseModel):
    workflow_id: str = Field(..., description="Unique workflow/ticket identifier")
    incident_id: str = Field(..., description="Linked incident report ID")
    task_description: str = Field(..., description="Actionable safety task description")
    assigned_role: str = Field(..., description="Role responsible for execution (e.g., Maintenance Engineer)")
    status: str = Field("Pending", description="Task status: Pending, In Progress, Completed")
    required_signoff_role: str = Field(..., description="Role required to close/sign-off the task")
    created_at: str = Field(..., description="ISO timestamp of creation")
    updated_at: str = Field(..., description="ISO timestamp of last update")


_WORKFLOWS: List[SafetyWorkflow] = []


_TASK_ROLE_MAP = {
    "ventilat": ("Maintenance Engineer", "Safety Officer"),
    "valve": ("Operations Lead", "Plant Manager"),
    "permit": ("Safety Officer", "Plant Manager"),
    "gas detector": ("Instrumentation Engineer", "Safety Officer"),
    "calibrat": ("Instrumentation Engineer", "Safety Officer"),
    "toolbox": ("Operations Lead", "Safety Officer"),
    "ppe": ("Safety Officer", "Plant Manager"),
    "evacuat": ("Operations Lead", "Safety Officer"),
    "rescue": ("Operations Lead", "Safety Officer"),
    "firefighting": ("Fire Safety Officer", "Plant Manager"),
    "cctv": ("Instrumentation Engineer", "Safety Officer"),
    "sensor": ("Instrumentation Engineer", "Safety Officer"),
    "siren": ("Electrical Engineer", "Safety Officer"),
    "electrical": ("Electrical Engineer", "Safety Officer"),
    "ground": ("Electrical Engineer", "Safety Officer"),
    "water spray": ("Maintenance Engineer", "Safety Officer"),
    "dyke": ("Maintenance Engineer", "Plant Manager"),
    "inspect": ("Operations Lead", "Safety Officer"),
    "re-audit": ("Safety Officer", "Plant Manager"),
    "audit": ("Safety Officer", "Plant Manager"),
    "isolate": ("Operations Lead", "Plant Manager"),
    "suspend": ("Safety Officer", "Plant Manager"),
    "revoke": ("Safety Officer", "Plant Manager"),
    "deploy": ("Operations Lead", "Safety Officer"),
    "breathing": ("Operations Lead", "Safety Officer"),
    "harness": ("Safety Officer", "Plant Manager"),
    "monitor": ("Instrumentation Engineer", "Safety Officer"),
    "test": ("Instrumentation Engineer", "Safety Officer"),
    "repair": ("Maintenance Engineer", "Plant Manager"),
    "replace": ("Maintenance Engineer", "Plant Manager"),
    "clamp": ("Maintenance Engineer", "Plant Manager"),
    "vent": ("Maintenance Engineer", "Safety Officer"),
    "exhaust": ("Maintenance Engineer", "Safety Officer"),
}


def _infer_role(task_text: str) -> tuple[str, str]:
    lower = task_text.lower()
    for keyword, (exec_role, sign_role) in _TASK_ROLE_MAP.items():
        if keyword in lower:
            return exec_role, sign_role
    return "Operations Lead", "Safety Officer"


def _parse_actionable_tasks(rag_answer: str, risk_factors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    tasks: List[Dict[str, Any]] = []
    seen = set()

    lines = rag_answer.splitlines()
    in_actions = False
    action_lines: List[str] = []

    for line in lines:
        if "Preemptive Safety Recommendations" in line or "#### 3." in line:
            in_actions = True
            continue
        if in_actions:
            if line.startswith("####") or line.startswith("---"):
                break
            action_lines.append(line)

    action_text = "\n".join(action_lines)

    numbered_items = re.findall(r"\d+\.\s+\*\*(.+?)\*\*[:\-]?\s*(.*)", action_text)
    for title, desc in numbered_items:
        title = title.strip()
        desc = desc.strip()
        full = f"{title}: {desc}" if desc else title
        full = full.strip()
        if full and full not in seen:
            seen.add(full)
            exec_role, sign_role = _infer_role(full)
            tasks.append({
                "task_description": full,
                "assigned_role": exec_role,
                "required_signoff_role": sign_role,
            })

    bullet_items = re.findall(r"^\s*[-*]\s+\*\*(.+?)\*\*[:\-]?\s*(.*)", action_text, re.MULTILINE)
    for title, desc in bullet_items:
        title = title.strip()
        desc = desc.strip()
        full = f"{title}: {desc}" if desc else title
        full = full.strip()
        if full and full not in seen:
            seen.add(full)
            exec_role, sign_role = _infer_role(full)
            tasks.append({
                "task_description": full,
                "assigned_role": exec_role,
                "required_signoff_role": sign_role,
            })

    if not tasks:
        for factor in risk_factors:
            name = factor.get("name", "")
            details = factor.get("details", "")
            if name:
                task_text = f"Mitigate {name}: {details}" if details else f"Mitigate {name}"
                if task_text not in seen:
                    seen.add(task_text)
                    exec_role, sign_role = _infer_role(task_text)
                    tasks.append({
                        "task_description": task_text,
                        "assigned_role": exec_role,
                        "required_signoff_role": sign_role,
                    })

    return tasks


def create_workflows_for_incident(incident_id: str, rag_answer: str, risk_factors: List[Dict[str, Any]]) -> List[SafetyWorkflow]:
    now = datetime.now(timezone.utc).isoformat()
    task_defs = _parse_actionable_tasks(rag_answer, risk_factors)
    workflows = []
    for task in task_defs:
        wf = SafetyWorkflow(
            workflow_id=f"WF-{str(uuid.uuid4())[:8].upper()}",
            incident_id=incident_id,
            task_description=task["task_description"],
            assigned_role=task["assigned_role"],
            status="Pending",
            required_signoff_role=task["required_signoff_role"],
            created_at=now,
            updated_at=now,
        )
        _WORKFLOWS.append(wf)
        workflows.append(wf)
    return workflows


def get_workflows(incident_id: Optional[str] = None) -> List[SafetyWorkflow]:
    if incident_id:
        return [w for w in _WORKFLOWS if w.incident_id == incident_id]
    return list(_WORKFLOWS)


def update_workflow_status(workflow_id: str, new_status: str) -> Optional[SafetyWorkflow]:
    valid_statuses = {"Pending", "In Progress", "Completed"}
    if new_status not in valid_statuses:
        return None
    for wf in _WORKFLOWS:
        if wf.workflow_id == workflow_id:
            wf.status = new_status
            wf.updated_at = datetime.now(timezone.utc).isoformat()
            return wf
    return None
