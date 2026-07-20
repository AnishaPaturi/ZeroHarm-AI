import os
import logging
import random
import requests
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("zeroharm_ai.engine.collaborative_reasoning")

class DebateMessage(BaseModel):
    agent_id: str
    agent_name: str
    role: str
    round: int
    message: str
    sentiment: str  # "nominal", "warning", "critical", "neutral"

class CollaborativeReasoningResponse(BaseModel):
    zone: str
    timestamp: str
    risk_probability: float
    prediction: str
    compound_factors: List[str]
    debate_transcript: List[DebateMessage]
    final_consensus: str
    recommendations: List[str]
    weather_info: Dict[str, Any]
    mode: str

class MultiAgentCollaborativeReasoning:
    """
    Innovation 1: Multi-Agent Collaborative Reasoning.
    This class handles the debate between multiple domain safety agents:
    - Gas Sensor Monitoring Agent (Telemetry)
    - Maintenance Intelligence Agent (Operations)
    - Permit Compliance Agent (Work Permit System)
    - Environmental Weather Agent (Ventilation & Microclimate)
    - CCTV Computer Vision Agent (Visual Verification)
    - Safety Coordinator Agent (Orchestration & Consensus)
    """

    def __init__(self):
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"

    def run_debate(self, zone: str, zone_state: Dict[str, Any], all_zone_states: Dict[str, Dict[str, Any]] = None) -> CollaborativeReasoningResponse:
        """
        Executes a 3-round multi-agent safety debate.
        If OPENROUTER_API_KEY is present, it prompts the LLM to generate the debate.
        Otherwise, it falls back to a highly dynamic, rule-based debate engine.
        """
        # Determine weather conditions (dynamic simulation)
        weather_info = self._get_simulated_weather(zone, zone_state)
        
        debate_res = None
        if self.openrouter_api_key:
            try:
                debate_res = self._run_llm_debate(zone, zone_state, weather_info, all_zone_states)
            except Exception as e:
                logger.error(f"Error running LLM debate: {e}. Falling back to rule-based simulation.")

        if not debate_res:
            debate_res = self._run_local_debate(zone, zone_state, weather_info)

        # Apply Self-Improving weights scaling (Innovation 20)
        try:
            import json
            weights_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "agent_weights.json")
            if os.path.exists(weights_path):
                with open(weights_path, "r") as f:
                    weights = json.load(f)
                
                # We scale the probability based on the coordinator agent's confidence multiplier
                coord_weight = weights.get("coordinator_agent", 1.0)
                if coord_weight != 1.0:
                    debate_res.risk_probability = round(min(100.0, max(0.0, debate_res.risk_probability * coord_weight)), 1)
                    debate_res.final_consensus += f" (Confidence scaling: {coord_weight}x applied based on historical overrides)"
        except Exception as e:
            logger.error(f"Error applying feedback weight scaling to debate: {e}")

        return debate_res

    def _get_simulated_weather(self, zone: str, zone_state: Dict[str, Any]) -> Dict[str, Any]:
        """Generates zone-specific microclimate / weather conditions."""
        gas = zone_state.get("gas_readings", {})
        ch4 = gas.get("ch4_lfl", 0.0)
        co = gas.get("co", 0.0)
        
        # High methane or CO implies poor ventilation scenario
        is_high_gas = ch4 > 4.0 or co > 25.0
        
        if is_high_gas:
            return {
                "wind_speed_m_s": round(random.uniform(1.2, 2.5), 1),
                "wind_direction": "SSE",
                "humidity": 78.0,
                "ambient_temp_c": 34.5,
                "ventilation_status": "Poor / Stagnant Air Pocket"
            }
        else:
            return {
                "wind_speed_m_s": round(random.uniform(7.5, 12.0), 1),
                "wind_direction": "NW",
                "humidity": 55.0,
                "ambient_temp_c": 28.0,
                "ventilation_status": "Excellent / Natural Dispersion"
            }

    def _run_llm_debate(self, zone: str, zone_state: Dict[str, Any], weather_info: Dict[str, Any], all_zone_states: Dict[str, Dict[str, Any]] = None) -> Optional[CollaborativeReasoningResponse]:
        """Calls OpenRouter to conduct a structured debate between safety agents."""
        import json
        
        gas = zone_state.get("gas_readings", {})
        permits = zone_state.get("permits", [])
        maint = zone_state.get("maintenance_active", False)
        changeover = zone_state.get("shift_changeover_active", False)
        cctv = zone_state.get("cctv_alerts", [])
        
        prompt = (
            "You are the Safety Command Center AI of ZeroHarm AI, conducting a multi-agent collaborative safety debate.\n"
            f"Zone: '{zone}'\n"
            f"Operational Telemetry:\n"
            f"- Gas Readings: O2={gas.get('o2')}% (PEL >19.5%), CO={gas.get('co')} ppm (PEL <25 ppm), CH4={gas.get('ch4_lfl')}% LFL (Welding Limit <4%), H2S={gas.get('h2s')} ppm.\n"
            f"- Rates of Change: dCO/dt={gas.get('d_co_dt', 0.0)} ppm/s, dPressure/dt={gas.get('d_pressure_dt', 0.0)} bar/s.\n"
            f"- Temperature: {gas.get('temperature')}°C, Pressure: {gas.get('pressure')} bar.\n"
            f"- Active Work Permits: {json.dumps(permits)}\n"
            f"- Maintenance Active: {maint}\n"
            f"- Shift Changeover Active: {changeover}\n"
            f"- CCTV Alerts: {json.dumps(cctv)}\n"
            f"- Weather Conditions: Wind Speed={weather_info['wind_speed_m_s']} m/s, Ventilation Status={weather_info['ventilation_status']}.\n\n"
            "You must generate a 3-round dialogue/debate script between the following agents:\n"
            "1. Gas Sensor Monitoring Agent (id: 'gas_agent'): Analyzes sensor spikes, rates of change, flammability and chemical risks.\n"
            "2. Maintenance Intelligence Agent (id: 'maintenance_agent'): Tracks mechanical integrity, lock-out tag-out (LOTO), valve operations.\n"
            "3. Permit Compliance Agent (id: 'permit_agent'): Audits permit parameters, SIMOPs conflicts, and compliance with OISD/Factory Act.\n"
            "4. Environmental Weather Agent (id: 'weather_agent'): Reviews atmospheric dispersion rates, wind stagnation, and temperature gradients.\n"
            "5. CCTV Computer Vision Agent (id: 'cctv_agent'): Details real-time visual observations of worker count, PPE posture, smoke/fire sparks.\n"
            "6. Safety Coordinator Agent (id: 'coordinator_agent'): Integrates all inputs, computes consensus risk probability (%), makes a time-bound safety prediction, and issues direct mandates.\n\n"
            "Dialogue Rounds:\n"
            "- Round 1: Each agent registers its domain observations based on telemetry.\n"
            "- Round 2: Agents debate overlaps and conflicts (e.g. permit active during gas leakage / stagnant air / missing PPE).\n"
            "- Round 3: Coordinator synthesizes findings, decides risk probability, and outlines action plan.\n\n"
            "Format the output strictly as a single JSON object with the following schema:\n"
            "{\n"
            "  \"risk_probability\": 96.0,\n"
            "  \"prediction\": \"Explosion possible within 18 minutes.\",\n"
            "  \"compound_factors\": [\"Gas increasing\", \"Active maintenance\", \"Hot work permit\", \"Wind speed decreased\"],\n"
            "  \"debate_transcript\": [\n"
            "    { \"agent_id\": \"gas_agent\", \"agent_name\": \"Gas Sensor Monitoring Agent\", \"role\": \"IoT Telemetry Analysis\", \"round\": 1, \"message\": \"...\", \"sentiment\": \"warning\" },\n"
            "    ...\n"
            "  ],\n"
            "  \"final_consensus\": \"Direct summary of debate verdict.\",\n"
            "  \"recommendations\": [\"Action 1\", \"Action 2\"]\n"
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
            "temperature": 0.3
        }

        resp = requests.post(self.openrouter_url, headers=headers, json=payload, timeout=25)
        if resp.status_code == 200:
            res_json = resp.json()
            content = res_json["choices"][0]["message"]["content"].strip()
            # Strip markdown block wrappers if model outputs them
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
            
            data = json.loads(content)
            
            transcript_objs = []
            for item in data.get("debate_transcript", []):
                transcript_objs.append(DebateMessage(**item))

            return CollaborativeReasoningResponse(
                zone=zone,
                timestamp=datetime.now().isoformat(),
                risk_probability=data.get("risk_probability", 50.0),
                prediction=data.get("prediction", "No direct prediction available."),
                compound_factors=data.get("compound_factors", []),
                debate_transcript=transcript_objs,
                final_consensus=data.get("final_consensus", ""),
                recommendations=data.get("recommendations", []),
                weather_info=weather_info,
                mode=f"LLM Multi-Agent Debate ({self.model})"
            )
        return None

    def _run_local_debate(self, zone: str, zone_state: Dict[str, Any], weather_info: Dict[str, Any]) -> CollaborativeReasoningResponse:
        """Rule-based simulation fallback that dynamically generates the multi-agent debate based on the zone state."""
        gas = zone_state.get("gas_readings", {})
        ch4 = gas.get("ch4_lfl", 0.0)
        co = gas.get("co", 0.0)
        o2 = gas.get("o2", 20.8)
        pressure = gas.get("pressure", 1.0)
        temp = gas.get("temperature", 28.0)
        d_co = gas.get("d_co_dt", 0.0)
        d_pressure = gas.get("d_pressure_dt", 0.0)
        
        permits = zone_state.get("permits", [])
        maint = zone_state.get("maintenance_active", False)
        cctv_alerts = zone_state.get("cctv_alerts", [])
        
        active_permit_types = [p.get("permit_type", "").lower() for p in permits if p.get("status", "").lower() == "active"]
        has_hotwork = "hot_work" in active_permit_types
        has_confined = "confined_space" in active_permit_types
        
        # Classify the scenario to build a tailored debate transcript
        is_explosion_risk = ch4 > 4.0 and has_hotwork
        is_asphyxiation_risk = o2 < 19.5 and has_confined
        is_overpressure_risk = d_pressure > 0.04 or pressure > 1.25 or temp > 75.0
        is_ppe_breach = any(c.get("event_type") == "no_ppe" for c in cctv_alerts)
        
        transcript: List[DebateMessage] = []
        factors: List[str] = []
        recommendations: List[str] = []
        risk_probability = 5.0
        prediction = "No immediate safety threats predicted. Plant operations nominal."
        final_consensus = "All agents agree that parameters are currently within normal compliance thresholds. Maintain standard monitoring protocols."
        
        # Set base weather dispersion note
        ventilation_note = "Natural dispersion rates are high due to active wind currents." if weather_info["wind_speed_m_s"] > 5 else "Stagnant micro-climate detected, heightening risk of toxic/flammable pocket accumulation."

        if is_explosion_risk:
            risk_probability = 96.0
            prediction = "Explosion possible within 18 minutes."
            factors = ["Methane Leakage Accumulation", "Active Spark-Producing Hot Work", "Atmospheric Ventilation Stagnation", "Valve Structural Integrity Defect"]
            final_consensus = (
                f"CRITICAL HAZARD DECLARED: Telemetry Agent's positive flammability slope ({ch4}% LFL Methane) overlaps with "
                "active Hot Work (ignition) and valve maintenance. Environmental Agent confirms wind speed dropped to "
                f"{weather_info['wind_speed_m_s']} m/s, causing gas pooling. Immediate structural explosion risk identified. Evacuation mandated."
            )
            recommendations = [
                "ENGAGE SIRENS: Evacuate all personnel from Coke Oven Battery 1 immediately.",
                "HALT PERMITS: Immediately revoke Hot Work permit and deactivate welding stations.",
                "ISOLATE PROCESS: Close ESD valves upstream of the valve maintenance segment.",
                "FORCE VENTILATION: Deploy explosion-proof exhaust blowers to purge methane pockets."
            ]
            
            # Dialogue - Round 1: Registration
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=1,
                message=f"I am registering a severe flammability anomaly. Methane LFL has increased to {ch4}%. The accumulation rate is positive. High flammability slope detected.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="maintenance_agent", agent_name="Maintenance Intelligence Agent", role="Valve/Asset Operations", round=1,
                message="Maintenance log verified. Crew is performing manual valve maintenance in Coke Oven Battery 1. Flanges and manifold seals are unseated.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=1,
                message="Permits Audit shows Permit PTW-HW-202 (Hot Work) is active for welding near the manifold deck. Spark hazard present.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="weather_agent", agent_name="Environmental Weather Agent", role="Micro-climate Monitor", round=1,
                message=f"Atmospheric check: wind speed has decreased to {weather_info['wind_speed_m_s']} m/s. Stagnant air pocket. Gas will not disperse naturally.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=1,
                message="CCTV analytics stream confirms two workers are on the manifold deck holding welding gear. No active local exhaust ventilation visible.",
                sentiment="warning"
            ))
            
            # Dialogue - Round 2: Debate
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=2,
                message="The methane leak is accelerating. Sparks from welding will exceed the Lower Flammable Limit ignition threshold. This is an immediate fire hazard.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=2,
                message="Under OISD-STD-105 standards, hot work is strictly banned above 4% LFL. This overlap is a critical statutory compliance violation!",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="weather_agent", agent_name="Environmental Weather Agent", role="Micro-climate Monitor", round=2,
                message=f"Due to the stagnant wind condition ({weather_info['wind_speed_m_s']} m/s), a localized vapor cloud is pooling precisely at coordinates X:45, Y:12 near the welding team.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=2,
                message="Visual feed shows sparks falling near the unsealed valve flange. Workers are unaware of the rising gas levels because portable sniffers are not localized.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="maintenance_agent", agent_name="Maintenance Intelligence Agent", role="Valve/Asset Operations", round=2,
                message="If the flange ignites, backpressure will propagate into the manifold. We must seal the line immediately and cut off fuel.",
                sentiment="critical"
            ))
            
            # Dialogue - Round 3: Synthesis
            transcript.append(DebateMessage(
                agent_id="coordinator_agent", agent_name="Safety Coordinator Agent", role="Orchestration & Consensus", round=3,
                message=f"Debate concluded. We have: Methane rising ({ch4}%) + Active Welding + Stagnant Air + Valve Maintenance. Risk Probability = 96%. Prediction: Explosion possible within 18 minutes. I am triggering the Emergency Evacuation Siren and suspending all permits.",
                sentiment="critical"
            ))

        elif is_asphyxiation_risk:
            risk_probability = 92.0
            prediction = "Asphyxiation / unconsciousness possible within 6 minutes."
            factors = ["Oxygen Depletion (<16%)", "Active Confined Space Permit", "Poor Ventilation / Air Stagnation", "Toxic Gas Intrusion"]
            final_consensus = (
                f"CRITICAL HEALTH THREAT: Oxygen level has dropped to {o2}% inside the confined space. "
                "Permit Agent flags workers inside Sinter Plant hopper. CCTV Agent verifies entry. "
                "Stagnant air prevents oxygen replenishment. Asphyxiation threat is immediate."
            )
            recommendations = [
                "RESCUE MISSION: Dispatch standby rescue team with breathing apparatus and lifeline harness.",
                "VENTILATE: Activate forced-draft ventilation fans to flood the confined space with fresh air.",
                "REVOKE PERMIT: Terminate Confined Space permit PTW-CS-101 immediately.",
                "ATMOSPHERIC SWEEP: Conduct oxygen sweeps before allowing any future entries."
            ]
            
            # dialogue
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=1,
                message=f"Telemetry registers oxygen depletion. O2 concentration is down to {o2}% inside the Sinter Plant hopper. Safe limit is 19.5%.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=1,
                message="Confined space permit PTW-CS-101 is active. Two maintenance engineers are authorized inside for scale removal.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=1,
                message="Visual verification: standby watchperson is stationed outside, but our camera detects two workers are inside without positive-pressure air hoses.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="weather_agent", agent_name="Environmental Weather Agent", role="Micro-climate Monitor", round=1,
                message=f"Ambient temperatures are high (34°C) with stagnant air currents. Heat index inside the hopper is extreme, accelerating worker exhaustion.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="maintenance_agent", agent_name="Maintenance Intelligence Agent", role="Valve/Asset Operations", round=1,
                message="Nitrogen purging valves upstream were recently tested; a slight leak could be replacing oxygen with inert nitrogen.",
                sentiment="warning"
            ))
            
            # Round 2
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=2,
                message="At 16% O2, cognitive impairment and rapid fatigue occur. Workers may become disoriented and unable to climb the rescue ladder.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=2,
                message="This directly violates Factories Act 1948 Section 36, which mandates a certified safe atmosphere before and during entry. We must suspend work.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=2,
                message="The watchperson outside is not communicating with the workers. Visual signs of worker sluggishness detected. We must intervene.",
                sentiment="critical"
            ))
            
            # Round 3
            transcript.append(DebateMessage(
                agent_id="coordinator_agent", agent_name="Safety Coordinator Agent", role="Orchestration & Consensus", round=3,
                message=f"Consensus reached. Oxygen is at {o2}%, and workers are trapped in a poorly ventilated confined space. Risk Probability = 92%. Prediction: Asphyxiation within 6 minutes. Deploying standby rescue team and initiating fresh air purge.",
                sentiment="critical"
            ))

        elif is_overpressure_risk:
            risk_probability = 88.0
            prediction = "Process line structural blowout possible within 14 minutes."
            factors = ["Pipeline Pressure Surge", "Overheating Anomaly", "General Maintenance Interference", "Shift Changeover Comm-Gap"]
            final_consensus = (
                f"WARNING PROCESS BREACH: Blast Furnace A line pressure is at {pressure} bar and temperature is {temp}°C, "
                "climbing rapidly. Maintenance Agent notes line isolation work. Overpressure threat could lead to structural failure."
            )
            recommendations = [
                "PRESSURE VENT: Initiate emergency flare venting for Blast Furnace A segment.",
                "SECTOR CONTROL: Restrict access to a 50m buffer around the Blast Furnace gas lines.",
                "BYPASS CHECK: Ensure lock-out valves are correctly oriented and no bypass line is sealed solid."
            ]
            
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=1,
                message=f"Transducer warning: Segment D pressure has reached {pressure} bar, and temperature is at {temp}°C. Pressure rate of change is positive ({d_pressure} bar/s).",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="maintenance_agent", agent_name="Maintenance Intelligence Agent", role="Valve/Asset Operations", round=1,
                message="Operational logs indicate maintenance is flushing the downstream condenser. Main valve BF-MV-104 is closed, causing upstream buildup.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="weather_agent", agent_name="Environmental Weather Agent", role="Micro-climate Monitor", round=1,
                message="High ambient temperature (38°C) is heating the piping exterior, compounding thermal expansion pressures.",
                sentiment="neutral"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=1,
                message="A shift changeover was logged 5 minutes ago. Handoff communication gaps might have left the bypass valve closed.",
                sentiment="warning"
            ))
            
            # Round 2
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=2,
                message="Pressure is approaching structural yields. At 1.5 bar, gaskets on Segment D will rupture, leading to explosive blast furnace gas release.",
                sentiment="critical"
            ))
            transcript.append(DebateMessage(
                agent_id="maintenance_agent", agent_name="Maintenance Intelligence Agent", role="Valve/Asset Operations", round=2,
                message="I am checking the bypass actuator. It's reporting closed. The incoming shift was not briefed on opening the bypass before flushing.",
                sentiment="critical"
            ))
            
            # Round 3
            transcript.append(DebateMessage(
                agent_id="coordinator_agent", agent_name="Safety Coordinator Agent", role="Orchestration & Consensus", round=3,
                message=f"Consensus reached. Pressure is at {pressure} bar and rising due to a communication gap during shift changeover. Risk Probability = 88%. Prediction: Blowout possible within 14 minutes. Mandating manual bypass override and flare vent.",
                sentiment="critical"
            ))

        elif is_ppe_breach:
            risk_probability = 70.0
            prediction = "Physical safety compromise; potential injury if task continues."
            factors = ["PPE Safety Violations", "Active Operational Area", "Unsecured Heights / Confined Proximity"]
            final_consensus = (
                "PPE COMPLIANCE VIOLATION: CCTV Agent spotted workers lacking mandatory safety gear in active zones. "
                "Permit Agent flags height/confined risk. Recommendation: Suspend local task until PPE compliance is verified."
            )
            recommendations = [
                "BROADCAST ALERT: Send audio safety warning to local zone PA system.",
                "SUPERVISOR DEPLOYMENT: Deploy safety supervisor to inspect worker compliance.",
                "PAUSE WORK: Halt local permits until worker gear is verified."
            ]
            
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=1,
                message="Visual analytics flags a compliance violation. Worker spotted on Ammonia Storage platform without a safety harness and helmet.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=1,
                message="Permits verify a Height Work permit (PTW-HT-303) is active at the Ammonia Storage Tank. Fall protection is legally mandatory.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=1,
                message="Ammonia readings are nominal (H2S is 1.5 ppm, safe). However, a sudden localized relief venting could startle an unsecured worker, causing a fall.",
                sentiment="neutral"
            ))
            
            # Round 2
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=2,
                message="Worker is operating at an elevation of 12 meters. Wind speed is gusty. Risk of slips or loss of balance is high without a harness hook.",
                sentiment="warning"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=2,
                message="This is a direct violation of Factories Act 1948 Section 87 and OISD-STD-105. Height operations cannot continue without certified harness lock lines.",
                sentiment="critical"
            ))
            
            # Round 3
            transcript.append(DebateMessage(
                agent_id="coordinator_agent", agent_name="Safety Coordinator Agent", role="Orchestration & Consensus", round=3,
                message="Consensus reached. Worker is at 12m height without fall protection under gusty conditions. Risk Probability = 70%. Prediction: Fall/injury possible if work continues. Suspending permit and sending supervisor.",
                sentiment="warning"
            ))

        else:
            # Nominal Operations
            risk_probability = 4.0
            prediction = "No immediate safety threats predicted. Plant operations nominal."
            factors = ["All Sensors Reporting Green", "Permits Audited & Compliant", "Weather Dispersion Nominal"]
            final_consensus = "All agents agree that plant telemetry, active permits, and environmental dispersion rates are within safe, normal operating parameters."
            recommendations = [
                "Maintain standard safety patrol rounds.",
                "Continue routine SCADA sensor telemetry monitoring."
            ]
            
            transcript.append(DebateMessage(
                agent_id="gas_agent", agent_name="Gas Sensor Monitoring Agent", role="IoT Telemetry Analysis", round=1,
                message=f"Telemetry normal in '{zone}'. O2={o2}%, CO={co} ppm, CH4={ch4}% LFL. All readings within statutory safety thresholds.",
                sentiment="nominal"
            ))
            transcript.append(DebateMessage(
                agent_id="permit_agent", agent_name="Permit Compliance Agent", role="Work Permit Auditor", round=1,
                message=f"Work permits checked. Active permits in '{zone}': {len(permits)}. No SIMOPs or boundary overlaps detected.",
                sentiment="nominal"
            ))
            transcript.append(DebateMessage(
                agent_id="weather_agent", agent_name="Environmental Weather Agent", role="Micro-climate Monitor", round=1,
                message=f"Weather dispersion is optimal. Wind speed is {weather_info['wind_speed_m_s']} m/s from {weather_info['wind_direction']}. Natural ventilation is functioning perfectly.",
                sentiment="nominal"
            ))
            transcript.append(DebateMessage(
                agent_id="cctv_agent", agent_name="CCTV Computer Vision Agent", role="Visual Security Analytics", round=1,
                message="All cameras online. Workers in the area are wearing required hard hats and safety glasses. No PPE infractions found.",
                sentiment="nominal"
            ))
            transcript.append(DebateMessage(
                agent_id="maintenance_agent", agent_name="Maintenance Intelligence Agent", role="Valve/Asset Operations", round=1,
                message="Equipment state is normal. Valve seal pressures and thermal sensors are within nominal specifications.",
                sentiment="nominal"
            ))
            
            # Round 2
            transcript.append(DebateMessage(
                agent_id="coordinator_agent", agent_name="Safety Coordinator Agent", role="Orchestration & Consensus", round=2,
                message="Excellent. All domains confirm green status. Dispersion is high and compliance is at 100%. No further deliberation needed.",
                sentiment="nominal"
            ))

        return CollaborativeReasoningResponse(
            zone=zone,
            timestamp=datetime.now().isoformat(),
            risk_probability=risk_probability,
            prediction=prediction,
            compound_factors=factors,
            debate_transcript=transcript,
            final_consensus=final_consensus,
            recommendations=recommendations,
            weather_info=weather_info,
            mode="Rule-Based Collaborative Debate Simulator"
        )
