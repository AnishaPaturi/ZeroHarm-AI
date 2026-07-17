import os
import logging
import random
import requests
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("zeroharm_ai.engine.predictive_timeline")

class TimelineStep(BaseModel):
    minutes_offset: int = Field(..., description="Minutes from now when this event is projected to occur")
    event: str = Field(..., description="Short name of the projected event/checkpoint")
    description: str = Field(..., description="Detailed description of what will transpire")
    severity: str = Field(..., description="Severity level: Nominal, Warning, Critical")
    variable_trigger: str = Field(..., description="Variable condition that triggers this event (e.g. 'CH4 > 6.0% LFL')")

class PredictiveTimelineResponse(BaseModel):
    zone: str = Field(..., description="Refinery zone name")
    timestamp: str = Field(..., description="ISO timestamp of the prediction")
    estimated_time_to_incident: int = Field(..., description="Estimated minutes until maximum critical hazard occurs (e.g. 22)")
    incident_type: str = Field(..., description="Type of incident predicted (e.g. Explosion, Asphyxiation, Pressure Blowout)")
    timeline: List[TimelineStep] = Field(..., description="Chronological sequence of projected checkpoints")
    mitigation_actions: List[str] = Field(..., description="Mandatory interventions to interrupt this timeline and avert disaster")
    mode: str = Field(..., description="Source of prediction (e.g. LLM, Local Simulation)")

class PredictiveTimelineEngine:
    """
    Innovation 2: Predictive Timeline Simulation.
    Like Google Maps predicts traffic, this engine projects future safety events
    if current telemetry trends continue without intervention.
    """

    def __init__(self):
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"

    def run_prediction(self, zone: str, zone_state: Dict[str, Any], all_zone_states: Dict[str, Dict[str, Any]] = None) -> PredictiveTimelineResponse:
        """
        Runs the timeline simulation for the specified zone.
        Uses OpenRouter if available; falls back to deterministic state extrapolation otherwise.
        """
        if self.openrouter_api_key:
            try:
                response = self._run_llm_prediction(zone, zone_state, all_zone_states)
                if response:
                    return response
            except Exception as e:
                logger.error(f"Error running LLM timeline simulation: {e}. Falling back to rule-based simulation.")

        return self._run_local_prediction(zone, zone_state)

    def _run_llm_prediction(self, zone: str, zone_state: Dict[str, Any], all_zone_states: Dict[str, Dict[str, Any]] = None) -> Optional[PredictiveTimelineResponse]:
        """Calls OpenRouter to generate a predictive timeline based on active variables."""
        gas = zone_state.get("gas_readings", {})
        permits = zone_state.get("permits", [])
        maint = zone_state.get("maintenance_active", False)
        changeover = zone_state.get("shift_changeover_active", False)
        cctv = zone_state.get("cctv_alerts", [])

        prompt = (
            "You are the Predictive Timeline Safety Simulation Engine of ZeroHarm AI.\n"
            "Like Google Maps predicts traffic, you project what will happen in the future if current safety violations "
            "and telemetry trends continue without intervention.\n\n"
            f"Zone: '{zone}'\n"
            f"Current Telemetry:\n"
            f"- Gas Readings: O2={gas.get('o2')}% (PEL >19.5%), CO={gas.get('co')} ppm (PEL <25 ppm), CH4={gas.get('ch4_lfl')}% LFL (Welding Limit <4%), H2S={gas.get('h2s')} ppm.\n"
            f"- Temperature: {gas.get('temperature')}°C, Pressure: {gas.get('pressure')} bar.\n"
            f"- Rates of Change: dCO/dt={gas.get('d_co_dt', 0.0)} ppm/s, dPressure/dt={gas.get('d_pressure_dt', 0.0)} bar/s.\n"
            f"- Active Permits: {json.dumps(permits)}\n"
            f"- Maintenance Active: {maint}\n"
            f"- Shift Changeover Active: {changeover}\n"
            f"- CCTV Alerts: {json.dumps(cctv)}\n\n"
            "You must project a chronological timeline (minimum 4 steps, maximum 6 steps) leading up to a safety failure "
            "if current anomalies are left unresolved.\n"
            "If current telemetry is nominal and there are no permits conflicts or work hazards, project a nominal "
            "monitoring timeline showing routine audits, checkouts, and sensor drift recalibration.\n\n"
            "Format the output strictly as a single JSON object matching this schema:\n"
            "{\n"
            "  \"estimated_time_to_incident\": 22,\n"
            "  \"incident_type\": \"Explosion\",\n"
            "  \"timeline\": [\n"
            "    {\n"
            "      \"minutes_offset\": 10,\n"
            "      \"event\": \"Pressure rises\",\n"
            "      \"description\": \"LFL increase causes gas buildup inside manifold seals.\",\n"
            "      \"severity\": \"Warning\",\n"
            "      \"variable_trigger\": \"CH4 > 3% LFL\"\n"
            "    },\n"
            "    ...\n"
            "  ],\n"
            "  \"mitigation_actions\": [\n"
            "    \"Evacuate all workers in area immediately\",\n"
            "    \"Revoke hot work permit PTW-2026-001\"\n"
            "  ]\n"
            "}\n"
            "Respond ONLY with valid JSON. Do not include markdown code block backticks."
        )

        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "ZeroHarm AI"
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }

        resp = requests.post(self.openrouter_url, headers=headers, json=payload, timeout=25)
        if resp.status_code == 200:
            res_json = resp.json()
            content = res_json["choices"][0]["message"]["content"].strip()
            
            # Strip markdown block wrappers if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

            data = json.loads(content)
            timeline_steps = []
            for item in data.get("timeline", []):
                timeline_steps.append(TimelineStep(**item))

            return PredictiveTimelineResponse(
                zone=zone,
                timestamp=datetime.now().isoformat(),
                estimated_time_to_incident=data.get("estimated_time_to_incident", 30),
                incident_type=data.get("incident_type", "Operational Incident"),
                timeline=timeline_steps,
                mitigation_actions=data.get("mitigation_actions", []),
                mode=f"LLM Predictive Simulation ({self.model})"
            )
        return None

    def _run_local_prediction(self, zone: str, zone_state: Dict[str, Any]) -> PredictiveTimelineResponse:
        """Determines the active threat and simulates a predictive timeline locally."""
        gas = zone_state.get("gas_readings", {})
        ch4 = gas.get("ch4_lfl", 0.0)
        co = gas.get("co", 0.0)
        o2 = gas.get("o2", 20.8)
        pressure = gas.get("pressure", 1.0)
        temp = gas.get("temperature", 28.0)
        permits = zone_state.get("permits", [])
        maint = zone_state.get("maintenance_active", False)

        has_hot_work = any(p.get("permit_type") == "hot_work" and p.get("status") == "active" for p in permits)
        has_confined_space = any(p.get("permit_type") == "confined_space" and p.get("status") == "active" for p in permits)

        # coke oven flammability timeline
        if zone == "Coke Oven Battery 1" and (ch4 > 0.0 or has_hot_work or maint):
            timeline = [
                TimelineStep(
                    minutes_offset=5,
                    event="Gas Accumulation Initialized",
                    description=f"Methane leak detected near valve seals. Gas concentration is currently at {ch4}% LFL and rising.",
                    severity="Warning",
                    variable_trigger="CH4 > 0.1% LFL"
                ),
                TimelineStep(
                    minutes_offset=10,
                    event="System Overpressurization",
                    description=f"Leaked methane accumulates in stagnant overhead ceiling cavity. Local pressure exceeds {pressure:.2f} bar.",
                    severity="Warning",
                    variable_trigger="Local Accumulation > 3% Volume"
                ),
                TimelineStep(
                    minutes_offset=15,
                    event="Toxic & Flammable Exposure",
                    description="Flashing gas cloud spreads to welding deck. Maintenance crew exposed to hydrocarbons.",
                    severity="Critical",
                    variable_trigger="Dispersion radius > 8 meters"
                ),
                TimelineStep(
                    minutes_offset=20,
                    event="LFL Ignition Threshold Crossed",
                    description="Methane concentration reaches Lower Flammable Limit ignition threshold near welding deck sparks.",
                    severity="Critical",
                    variable_trigger="CH4 >= 4.0% LFL under Hot Work"
                ),
                TimelineStep(
                    minutes_offset=22,
                    event="Detonation / Explosion",
                    description="Spark ignites methane pocket. Overpressure causes secondary pipe ruptures and BLEVE event.",
                    severity="Critical",
                    variable_trigger="Ignition under Stagnant Conditions"
                )
            ]
            return PredictiveTimelineResponse(
                zone=zone,
                timestamp=datetime.now().isoformat(),
                estimated_time_to_incident=22,
                incident_type="Explosion",
                timeline=timeline,
                mitigation_actions=[
                  "ENGAGE SIRENS: Immediately evacuate Coke Oven Battery 1.",
                  "SUSPEND PERMITS: Immediately revoke Hot Work permit PTW-2026-001.",
                  "ISOLATE LINE: Close ESD-10 valve upstream of maintenance manifold."
                ],
                mode="Local Trend Extrapolator"
            )

        # Blast Furnace pressure timeline
        elif zone == "Blast Furnace A" and (pressure > 1.2 or maint):
            timeline = [
                TimelineStep(
                    minutes_offset=5,
                    event="Pressure Transients Escalate",
                    description=f"Top pressure rises to {pressure:.2f} bar due to throttling downstream vent valves.",
                    severity="Warning",
                    variable_trigger="Furnace pressure > 1.15 bar"
                ),
                TimelineStep(
                    minutes_offset=12,
                    event="Cooling Stave Thermal Stress",
                    description=f"Cooling stave thermometers report heat spikes. Water inlet/outlet delta-T increases to {temp:.1f}°C.",
                    severity="Warning",
                    variable_trigger="Delta Temp > 15°C"
                ),
                TimelineStep(
                    minutes_offset=18,
                    event="Thermal Boundary Breach",
                    description="Elevated temperature strains secondary packing seals. casting crew exposed to hot CO gases.",
                    severity="Critical",
                    variable_trigger="Carbon Monoxide > 25 ppm"
                ),
                TimelineStep(
                    minutes_offset=25,
                    event="Bleeder Valve Mechanical Strain",
                    description="Safety release valves vibrate under mechanical stress. Seat seal erosion occurs.",
                    severity="Critical",
                    variable_trigger="Vent flow velocity > 300 m/s"
                ),
                TimelineStep(
                    minutes_offset=30,
                    event="Mechanical Blowout / Metal Spill",
                    description="Gasket fails completely. Molten iron/slag breakout in upper casting deck.",
                    severity="Critical",
                    variable_trigger="Gasket failure pressure threshold"
                )
            ]
            return PredictiveTimelineResponse(
                zone=zone,
                timestamp=datetime.now().isoformat(),
                estimated_time_to_incident=30,
                incident_type="Pressure Blowout",
                timeline=timeline,
                mitigation_actions=[
                  "MANUAL BYPASS: Activate safety flare bypass dump.",
                  "DECREASE BLAST: Reduce wind blast rate on combustion fans.",
                  "EVACUATE CASTING: Move personnel out of upper casting deck."
                ],
                mode="Local Trend Extrapolator"
            )

        # Sinter Plant oxygen depletion timeline
        elif zone == "Sinter Plant" and (o2 < 20.0 or has_confined_space):
            timeline = [
                TimelineStep(
                    minutes_offset=5,
                    event="Ventilation Stagnation",
                    description="Exhaust damper valve unseated. Air changes inside hopper decrease significantly.",
                    severity="Warning",
                    variable_trigger="Fan current < 15 Amps"
                ),
                TimelineStep(
                    minutes_offset=8,
                    event="Oxygen Level Depletion",
                    description=f"Oxygen level inside confined space hopper drops to {o2:.1f}% due to gas displacement.",
                    severity="Warning",
                    variable_trigger="O2 < 19.5% (OSHA PEL)"
                ),
                TimelineStep(
                    minutes_offset=12,
                    event="Worker Anoxia / Hypoxia",
                    description="Confined space workers report lightheadedness and coordination loss. Standby watchperson notices slurred speech.",
                    severity="Critical",
                    variable_trigger="O2 < 17% (Oxygen Deficient)"
                ),
                TimelineStep(
                    minutes_offset=15,
                    event="Asphyxiation & Collapse",
                    description="Oxygen level falls below 16%. Cleaning personnel lose consciousness inside hopper.",
                    severity="Critical",
                    variable_trigger="O2 < 16% (Critical Threshold)"
                ),
                TimelineStep(
                    minutes_offset=20,
                    event="Irreversible Brain Anoxia",
                    description="Workers remain trapped in oxygen-starved pocket. Fatal asphyxiation occurs.",
                    severity="Critical",
                    variable_trigger="Exposure duration > 5 minutes"
                )
            ]
            return PredictiveTimelineResponse(
                zone=zone,
                timestamp=datetime.now().isoformat(),
                estimated_time_to_incident=20,
                incident_type="Asphyxiation",
                timeline=timeline,
                mitigation_actions=[
                  "FRESH AIR BLAST: Activate forced ventilation fans at 100%.",
                  "RESCUE PROTOCOL: Dispatch standby rescue team with SCBA breathing gear.",
                  "HALT PERMIT: Immediately suspend confined space entry permit PTW-CS-101."
                ],
                mode="Local Trend Extrapolator"
            )

        # Default Nominal Timeline
        else:
            timeline = [
                TimelineStep(
                    minutes_offset=30,
                    event="Standard Safety Patrol Round",
                    description="Shift Safety Officer performs visual walk-around inspection. All parameters verified green.",
                    severity="Nominal",
                    variable_trigger="Periodic inspection timer"
                ),
                TimelineStep(
                    minutes_offset=60,
                    event="Routine Calibration Check",
                    description="Automatic self-test of gas sniffer transducers completed. Zero-drift adjusted.",
                    severity="Nominal",
                    variable_trigger="Hourly instrument self-test"
                ),
                TimelineStep(
                    minutes_offset=120,
                    event="Shift Handover Audit",
                    description="Outgoing crew log parameters. Next shift reviews active permits and logs on.",
                    severity="Nominal",
                    variable_trigger="Shift transition window"
                )
            ]
            return PredictiveTimelineResponse(
                zone=zone,
                timestamp=datetime.now().isoformat(),
                estimated_time_to_incident=120,
                incident_type="Nominal Operations",
                timeline=timeline,
                mitigation_actions=[
                  "Maintain standard shift safety patrol rotations.",
                  "Ensure sensor calibration offsets are cataloged."
                ],
                mode="Local Trend Extrapolator"
            )
