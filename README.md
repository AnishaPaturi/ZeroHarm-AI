# 🛡️ SentinelSafe: AI-Powered Industrial Safety Intelligence for Zero-Harm Operations

[![Theme: Industrial Safety & AI](https://img.shields.io/badge/Theme-Industrial%20Safety%20%26%20AI-red.svg)](#)
[![Tech: React + Vite](https://img.shields.io/badge/Tech-React%20%2B%20Vite-blue.svg)](#)
[![Styling: Vanilla CSS](https://img.shields.io/badge/Styling-Vanilla%20CSS-ff69b4.svg)](#)
[![Compliance: OISD & Factory Act](https://img.shields.io/badge/Compliance-OISD%20%26%20Factory%20Act-green.svg)](#)

SentinelSafe is a next-generation, AI-driven **Industrial Safety Intelligence (ISI) platform** designed to eliminate fatal workplace accidents in heavy industries (steel, chemical, mining, and manufacturing). By bridging the gap between isolated safety tools, SentinelSafe fuses real-time IoT sensor telemetry, digital Work Permits (PTW), worker geolocation, and regulatory compliance into a unified intelligence layer that predicts and prevents accidents before they occur.

---

## 📌 About the Project

### The Problem Context
India's heavy industrial sector continues to pay a devastating human cost. According to **DGFASLI**, over **6,500 fatal workplace accidents** were recorded in FY2023 alone (excluding most mining and construction sectors). In January 2025, eight workers tragically died at the Visakhapatnam Steel Plant when entrapped gases triggered a sudden explosion in the coke oven battery. This facility had fully functional gas detectors, permit-to-work protocols, and SCADA systems. However, warning signals existed on isolated dashboards and were **unacted upon** because there was no intelligence layer to correlate gas pressure sensor spikes with active hot-work permits in the vicinity. 

A **FICCI survey in 2024** revealed that **over 60% of large industrial facilities** rely on manual handoffs to coordinate between their own digital safety tools. The bottleneck is not a lack of safety systems; it is the **absence of a unified intelligence layer** that translates disjointed data points into preemptive, life-saving operational decisions.

### Our Solution
**SentinelSafe** addresses this critical vulnerability by acting as the plant's digital central nervous system. It continuously ingests streams from:
1. **IoT / SCADA Telemetry**: Gas concentrations (CO, CH4, O2), temperature, and pressure.
2. **Digital Permit to Work (PTW)**: Details, locations, and timings of active maintenance, hot work, and confined space entries.
3. **Geospatial Worker Badges**: Live locations of field workers and maintenance crews.
4. **Shift Logs & Historical Incident Files**: Regulatory standards (OISD, Factory Act) and past near-miss records.

By correlating these inputs, the platform's multi-agent risk engine detects **compound risk conditions**—such as active hot work permits in zones experiencing sub-critical gas accumulation—and triggers immediate emergency response protocols or automatic permit suspensions.

---

## 🏗️ System Architecture

SentinelSafe operates using a decentralized multi-agent system where specialized agents monitor individual safety vectors, collaborate to identify compound risks, and output real-time alerts.

```mermaid
graph TD
    %% Inputs
    SubGraph1[IoT & SCADA Telemetry] --> |Gas/Temp/Pressure Feeds| SensorAgent[Sensor Monitoring Agent]
    SubGraph2[Digital PTW Systems] --> |Permit Types & Locations| PermitAgent[Permit Intelligence Agent]
    SubGraph3[Worker Badges] --> |Real-time Geospatial coordinates| GeoAgent[Geospatial Tracker Agent]
    
    %% Agents & Intelligence Layer
    SensorAgent --> |State updates| CentralOrchestrator[Compound Risk Orchestrator]
    PermitAgent --> |State updates| CentralOrchestrator
    GeoAgent --> |State updates| CentralOrchestrator

    %% Decision Engine
    CentralOrchestrator --> |Detects Compound Risks| Heatmap[Geospatial Heatmap View]
    CentralOrchestrator --> |Permit Conflicts / SIMOPs| AlertSystem[Preemptive Alerting & Siren Controls]
    CentralOrchestrator --> |Critical Breach Trigger| EmergencyOrchestrator[Emergency Response Orchestrator]

    %% Knowledge Bases & Auditing
    RegulatoryDB[(OISD, Factory Act & Incident Corpus)] --> |Contextual RAG| ChatAgent[Incident Pattern Intelligence RAG]
    ComplianceDB[(Shift logs, Checklists, Sign-offs)] --> |Continuous Compliance Audit| AuditAgent[Quality & Compliance Audit Agent]

    %% Output UI
    Heatmap --> UI[SentinelSafe Premium Control Center Dashboard]
    AlertSystem --> UI
    EmergencyOrchestrator --> UI
    ChatAgent --> UI
    AuditAgent --> UI
```

---

## 🚀 Core Features

### 1. Compound Risk Detection Engine
Correlates disparate data points in real time to detect high-risk configurations that single-sensor baselines miss. 
* *Example:* It will not flag a 10ppm CO reading alone, nor an active hot work permit alone, but will immediately raise a **Critical Alert** if both occur in the same coke oven zone simultaneously.

### 2. Geospatial Safety Heatmap
An interactive, high-fidelity 2D plant layout SVG showing dynamic hazard indexes (Safe, Warning, Critical) across key plant structures, detailing active permits, active workers, and real-time gas/sensor overlays.

### 3. Digital Permit Intelligence Agent
Monitors active permits against live plant telemetry. Automatically identifies **Simultaneous Operations (SIMOPs)** conflicts (e.g., hot work authorized near active gas venting lines) and suggests permit suspensions.

### 4. Incident Pattern Intelligence (RAG Chat)
An interactive AI assistant pre-loaded with regulatory documentation (Factory Act 1948, OISD-137, OISD-105) and historical incident profiles. It allows safety officers to ask questions and receive structured guidance with direct regulatory citations.

### 5. Emergency Response Orchestrator
When a critical compound risk is triggered, this module handles the first 10 minutes of crisis: activates plant-wide alarms, displays an evacuation tracker, triggers shut-off valves, alerts first responders, and generates a preliminary regulatory incident report.

### 6. Quality & Compliance Audit Agent
Monitors shift changeovers, pre-work safety check logs, and training records. Calculates a real-time compliance score and automatically generates corrective actions for procedural deviations.

---

## 🛠️ Tech Stack

* **Frontend**: React (Vite), JavaScript (ES6+)
* **Styling**: Vanilla CSS (Custom properties, grid systems, glassmorphism, responsive grids, and neon-alert glow variables)
* **Visualization**: Interactive SVG layouts, Recharts for sensor history graphs
* **Agent Simulation**: Stateful react-context engine simulating collaborative multi-agent decisions (debates, telemetry, location movements)
* **Icons**: `lucide-react`

---

## 📅 5-Day Implementation Timeline

```mermaid
gantt
    title SentinelSafe 5-Day Development Schedule
    dateFormat  YYYY-MM-DD
    section Foundation & Styling
    Project Init & Vanilla CSS Design Tokens  :active, day1, 2026-07-07, 1d
    Dynamic Simulation Engine (Telemetry/Workers) :active, day1_sim, 2026-07-07, 1d
    section Heatmap & PTW
    Interactive SVG Geospatial Plant Layout   : day2_heat, after day1_sim, 1d
    Digital Permit Intelligence & SIMOPs Log  : day2_ptw, after day1_sim, 1d
    section Risk Engine & Logs
    Compound Risk Formulation & Rules         : day3_risk, after day2_ptw, 1d
    Agent Collaboration Log Panel             : day3_log, after day2_ptw, 1d
    section RAG & Emergency
    Safety Chat (RAG Engine over OISD Docs)   : day4_rag, after day3_log, 1d
    Emergency Response Orchestrator Workflow  : day4_em, after day3_log, 1d
    section Audit & Review
    Quality & Compliance Audit Dashboard      : day5_aud, after day4_em, 1d
    Polishing Visuals, Testing & Pitch Deck  : day5_pol, after day4_em, 1d
```

---

## 🏷️ Tags

`#IndustrialSafety` `#AIAgents` `#GeospatialAnalytics` `#MultiAgentSystems` `#ZeroHarm` `#RAG` `#RiskIntelligence` `#FactoryAct` `#OISD` `#SCADADetector`
