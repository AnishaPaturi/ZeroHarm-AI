from typing import List, Tuple
from .models import RiskCheckRequest, FactorRisk, GasReadings, PermitInfo, CCTVAlert

def calculate_gas_risk(gas: GasReadings) -> Tuple[float, List[FactorRisk]]:
    factors = []
    max_gas_score = 0.0

    # 1. Oxygen (O2) - Normal range: 19.5% to 23.5%
    o2_score = 0.0
    o2_details = "Oxygen levels are within the safe working range (19.5% - 23.5%)."
    if gas.o2 < 19.5:
        # Asphyxiation Risk
        o2_score = 40.0 + (19.5 - gas.o2) * 15.0
        if gas.o2 <= 17.0:
            o2_score = max(o2_score, 85.0)
        if gas.o2 <= 15.0:
            o2_score = max(o2_score, 98.0)
        o2_score = min(o2_score, 100.0)
        o2_details = f"ASPHYXIATION HAZARD: Oxygen level is critical at {gas.o2}% (below 19.5% standard threshold, Factories Act Sec 36)."
        factors.append(FactorRisk(
            name="Asphyxiation Risk (Oxygen Deficiency)",
            score=o2_score,
            contribution=0.0, # Will calculate relative contribution later
            details=o2_details
        ))
    elif gas.o2 > 23.5:
        # Fire Enrichment Risk
        o2_score = 40.0 + (gas.o2 - 23.5) * 15.0
        if gas.o2 >= 25.0:
            o2_score = max(o2_score, 95.0)
        o2_score = min(o2_score, 100.0)
        o2_details = f"FLAMMABILITY HAZARD: Oxygen enrichment at {gas.o2}% (increases explosion/fire propagation risk)."
        factors.append(FactorRisk(
            name="Oxygen Enrichment Risk",
            score=o2_score,
            contribution=0.0,
            details=o2_details
        ))
    max_gas_score = max(max_gas_score, o2_score)

    # 2. Carbon Monoxide (CO) - Toxic Gas - Normal: < 25 ppm, OSHA PEL: 50 ppm
    co_score = 0.0
    co_details = "Carbon Monoxide levels are safe (< 25 ppm)."
    if gas.co >= 25.0:
        if gas.co < 50.0:
            co_score = 20.0 + (gas.co - 25.0) * 2.0  # 20 - 70
        elif gas.co < 100.0:
            co_score = 70.0 + (gas.co - 50.0) * 0.5  # 70 - 95
        else:
            co_score = 100.0
        co_details = f"TOXIC GAS ALARM: Carbon Monoxide level is {gas.co} ppm (OSHA PEL: 50 ppm, OISD-137 limits exceeded)."
        factors.append(FactorRisk(
            name="CO Toxicity Risk",
            score=co_score,
            contribution=0.0,
            details=co_details
        ))
    max_gas_score = max(max_gas_score, co_score)

    # 3. Methane (CH4) - Flammable Gas - Normal: < 5% LFL
    ch4_score = 0.0
    ch4_details = "Methane levels are safe (< 5% LFL)."
    if gas.ch4_lfl >= 5.0:
        if gas.ch4_lfl < 10.0:
            ch4_score = 20.0 + (gas.ch4_lfl - 5.0) * 8.0  # 20 - 60
        elif gas.ch4_lfl < 20.0:
            ch4_score = 60.0 + (gas.ch4_lfl - 10.0) * 3.5  # 60 - 95
        else:
            ch4_score = 100.0
        ch4_details = f"FLAMMABLE GAS DETECTED: Methane level is {gas.ch4_lfl}% LFL (Lower Flammable Limit). Explosion risk elevated."
        factors.append(FactorRisk(
            name="Explosion Hazard (CH4 Flammability)",
            score=ch4_score,
            contribution=0.0,
            details=ch4_details
        ))
    max_gas_score = max(max_gas_score, ch4_score)

    # 4. Hydrogen Sulfide (H2S) - Highly Toxic Gas - Normal: < 5 ppm
    h2s_score = 0.0
    h2s_details = "Hydrogen Sulfide levels are safe (< 5 ppm)."
    if gas.h2s >= 5.0:
        if gas.h2s < 10.0:
            h2s_score = 20.0 + (gas.h2s - 5.0) * 10.0  # 20 - 70
        elif gas.h2s < 20.0:
            h2s_score = 70.0 + (gas.h2s - 10.0) * 2.5  # 70 - 95
        else:
            h2s_score = 100.0
        h2s_details = f"ACUTE TOXICITY HAZARD: Hydrogen Sulfide level is {gas.h2s} ppm (High toxicity at low concentrations, OISD-137 standard)."
        factors.append(FactorRisk(
            name="H2S Toxicity Risk",
            score=h2s_score,
            contribution=0.0,
            details=h2s_details
        ))
    # 5. Rate of Change (Temporal Telemetry Hazards)
    d_co = getattr(gas, "d_co_dt", 0.0) or 0.0
    d_press = getattr(gas, "d_pressure_dt", 0.0) or 0.0

    if d_co > 0.3:  # CO accumulation rate > 0.3 ppm/s
        co_roc_score = min(100.0, 30.0 + (d_co - 0.3) * 80.0)
        max_gas_score = max(max_gas_score, co_roc_score)
        factors.append(FactorRisk(
            name="CO Rapid Accumulation Anomaly",
            score=round(co_roc_score, 1),
            contribution=0.0,
            details=f"TEMPORAL HAZARD: Carbon Monoxide is rising rapidly at {round(d_co, 2)} ppm/s. Indication of a process gas leak."
        ))

    if d_press > 0.05:  # pressure buildup rate > 0.05 bar/s
        press_roc_score = min(100.0, 30.0 + (d_press - 0.05) * 800.0)
        max_gas_score = max(max_gas_score, press_roc_score)
        factors.append(FactorRisk(
            name="Rapid Pressure Buildup",
            score=round(press_roc_score, 1),
            contribution=0.0,
            details=f"TEMPORAL HAZARD: Zone pressure is climbing rapidly at {round(d_press, 3)} bar/s. Threat of mechanical containment blowout."
        ))

    return max_gas_score, factors

def evaluate_rules(req: RiskCheckRequest) -> Tuple[float, str, List[FactorRisk], List[str]]:
    factors: List[FactorRisk] = []
    suspend_permits: List[str] = []

    # 1. Base gas readings evaluation
    gas_score, gas_factors = calculate_gas_risk(req.gas_readings)
    factors.extend(gas_factors)

    # Track active permit types
    active_permits = [p for p in req.permits if p.status.lower() == "active"]
    permit_types = [p.permit_type.lower() for p in active_permits]

    has_hot_work = "hot_work" in permit_types
    has_confined_space = "confined_space" in permit_types
    has_height_work = "height_work" in permit_types

    # Base score defaults to gas risk
    composite_score = gas_score

    # 2. Compound Risk: Confined Space Entry + Gas Spike
    # Factories Act Sec 36: Requires atmospheric test before entry.
    if has_confined_space:
        cs_permits = [p for p in active_permits if p.permit_type.lower() == "confined_space"]
        # In a confined space, even small deviations are extremely dangerous
        gas_warning_detected = (
            req.gas_readings.o2 < 19.5 or 
            req.gas_readings.co > 15.0 or 
            req.gas_readings.h2s > 3.0 or 
            req.gas_readings.ch4_lfl > 3.0
        )
        if gas_warning_detected:
            cs_score = 92.0
            # Elevate composite score
            composite_score = max(composite_score, cs_score)
            suspend_permits.extend([p.permit_id for p in cs_permits])
            factors.append(FactorRisk(
                name="Confined Space Compound Risk",
                score=cs_score,
                contribution=0.0,
                details=(
                    f"CRITICAL: Active Confined Space permit overlapping with abnormal gas readings. "
                    f"Poor ventilation in confined spaces creates lethal hazard traps (Factories Act 1948 Section 36 compliance breach)."
                )
            ))
        else:
            # Confined space entry is inherently higher risk
            factors.append(FactorRisk(
                name="Confined Space Operations",
                score=30.0,
                contribution=0.0,
                details="Active Confined Space entry. Requires continuous atmospheric monitoring."
            ))
            composite_score = max(composite_score, 30.0)

    # 3. Compound Risk: Hot Work + Flammable Gas (CH4)
    # OISD-STD-105: Hot work prohibited where flammable gas exceeds safety limits
    if has_hot_work:
        hw_permits = [p for p in active_permits if p.permit_type.lower() == "hot_work"]
        # Methane above 3% LFL is warning, above 5% is critical during welding
        if req.gas_readings.ch4_lfl > 4.0:
            hw_score = 95.0
            composite_score = max(composite_score, hw_score)
            suspend_permits.extend([p.permit_id for p in hw_permits])
            factors.append(FactorRisk(
                name="Hot Work Flammable Gas Overlap",
                score=hw_score,
                contribution=0.0,
                details=(
                    f"CRITICAL: Active Hot Work (ignition source) in area with {req.gas_readings.ch4_lfl}% LFL Methane. "
                    f"High risk of immediate fire/explosion. Violation of OISD-STD-105 Work Permit standards."
                )
            ))
        else:
            factors.append(FactorRisk(
                name="Hot Work Operations",
                score=25.0,
                contribution=0.0,
                details="Active welding, grinding or other hot work. Sparks present. Flammable gases must remain < 4% LFL."
            ))
            composite_score = max(composite_score, 25.0)

    # 4. Simultaneous Operations (SIMOPs) Conflict
    # Multiple overlapping permits in the same zone
    if len(active_permits) >= 2:
        simops_score = 15.0 + (len(active_permits) - 2) * 5.0
        simops_score = min(simops_score, 40.0)
        # Increase the composite score due to interaction complexities
        composite_score += simops_score
        
        # Specific SIMOPs clash: Hot Work + Confined Space or Height Work
        clash_details = []
        if has_hot_work and has_confined_space:
            clash_details.append("Hot Work (ignition) and Confined Space (toxic hazard) active simultaneously.")
            composite_score = max(composite_score, 80.0) # Elevate to high risk
        if has_hot_work and has_height_work:
            clash_details.append("Hot Work occurring above other active work zones (falling spark hazard).")
            composite_score = max(composite_score, 65.0)
            
        details_str = " | ".join(clash_details) if clash_details else f"{len(active_permits)} active permits in the same zone."
        factors.append(FactorRisk(
            name="SIMOPs (Simultaneous Operations) Hazard",
            score=simops_score,
            contribution=0.0,
            details=f"SIMOPs Conflict: {details_str} Increases likelihood of accidents due to team interaction errors."
        ))

    # 5. Maintenance Window Overlap
    if req.maintenance_active:
        maint_risk = 15.0
        composite_score += maint_risk
        factors.append(FactorRisk(
            name="Active Maintenance Activity",
            score=maint_risk,
            contribution=0.0,
            details="Zone is undergoing active equipment maintenance. Transient conditions and bypassed safety systems may exist."
        ))

    # 6. Shift Changeover Handover Risk
    if req.shift_changeover_active:
        changeover_risk = 12.0
        composite_score += changeover_risk
        
        details = "Shift changeover in progress. Historical data shows heighted risk due to handoff communication gaps."
        if req.maintenance_active:
            changeover_risk += 8.0
            composite_score += 8.0
            details += " Critical: Handover is occurring during active equipment maintenance."
            
        factors.append(FactorRisk(
            name="Shift Changeover Risk",
            score=changeover_risk,
            contribution=0.0,
            details=details
        ))

    # 7. CCTV / Computer Vision Alerts
    # Evaluate physical safety anomalies detected by computer vision streams.
    for alert in getattr(req, "cctv_alerts", []):
        alert_type = alert.event_type.lower()
        conf = alert.confidence
        
        if conf > 0.5:
            cv_risk = 0.0
            cv_details = ""
            
            if alert_type == "no_ppe":
                # Escalates risk, especially if hazardous work is active
                cv_risk = 35.0 * conf
                if req.maintenance_active or has_hot_work or has_confined_space:
                    cv_risk += 15.0
                    cv_details = (
                        f"CRITICAL: Worker spotted without proper PPE (helmet/harness/mask) via CCTV "
                        f"in '{req.zone}' during active hazardous operations. Breach of Factories Act 1948 Sec. 87."
                    )
                else:
                    cv_details = f"CCTV Alert: Worker spotted without proper PPE (helmet/harness/mask) in '{req.zone}'."
                
                factors.append(FactorRisk(
                    name="CCTV: PPE Non-Compliance",
                    score=round(cv_risk, 1),
                    contribution=0.0,
                    details=cv_details
                ))
                composite_score += cv_risk
                
            elif alert_type in ("smoke_detected", "fire_detected"):
                # Extreme physical threat
                cv_risk = 85.0 if alert_type == "fire_detected" else 60.0
                cv_risk = cv_risk * conf
                
                if has_hot_work:
                    cv_risk = max(cv_risk, 95.0)
                    suspend_permits.extend([p.permit_id for p in active_permits if p.permit_type.lower() == "hot_work"])
                
                factors.append(FactorRisk(
                    name=f"CCTV: {alert_type.replace('_', ' ').title()}",
                    score=round(cv_risk, 1),
                    contribution=0.0,
                    details=(
                        f"CRITICAL: Visual detection of {alert_type.replace('_', ' ')} in '{req.zone}' "
                        f"({int(conf*100)}% detection confidence)."
                    )
                ))
                composite_score = max(composite_score, cv_risk)
                
            elif alert_type == "unauthorized_entry":
                cv_risk = 25.0 * conf
                # If there's an active hazard or gas buildup in this zone, entry is extremely risky
                if gas_score > 40.0:
                    cv_risk = max(cv_risk, 70.0)
                
                factors.append(FactorRisk(
                    name="CCTV: Unauthorized Zone Entry",
                    score=round(cv_risk, 1),
                    contribution=0.0,
                    details=(
                        f"CCTV Alert: Unauthorized personnel detected in restricted zone '{req.zone}' "
                        f"({int(conf*100)}% confidence)."
                    )
                ))
                composite_score += cv_risk

    # Clamp composite score to 100
    composite_score = min(composite_score, 100.0)
    
    # If no risk factors registered, set a baseline low score based on active permits
    if not factors:
        if active_permits:
            composite_score = 15.0
            factors.append(FactorRisk(
                name="Normal Operations (Active Permits)",
                score=15.0,
                contribution=100.0,
                details="Active routine permits with all sensor parameters within normal green thresholds."
            ))
        else:
            composite_score = 5.0
            factors.append(FactorRisk(
                name="Normal Operations (Clean Telemetry)",
                score=5.0,
                contribution=100.0,
                details="No active hazardous permits, no maintenance, and all sensors reporting green."
            ))

    # Calculate contribution percentages
    total_factor_scores = sum(f.score for f in factors)
    if total_factor_scores > 0:
        for f in factors:
            f.contribution = round((f.score / total_factor_scores) * 100.0, 1)
    
    # Categorize Risk Level
    if composite_score >= 75.0:
        risk_level = "Critical"
        action_required = (
            "EVACUATE AREA & HALT PERMITS - Composite risk score is critical. "
            "Safety sirens should be activated. Emergency Response Orchestrator must coordinate evacuation."
        )
    elif composite_score >= 40.0:
        risk_level = "Warning"
        action_required = (
            "INCREASE SURVEILLANCE & RE-AUDIT PERMITS - Active anomalies detected. "
            "Safety supervisor must inspect site, verify gas ventilation, and review SIMOPs guidelines."
        )
    else:
        risk_level = "Safe"
        action_required = "ROUTINE MONITORING - Standard operating procedures apply. No corrective action needed."

    return round(composite_score, 1), risk_level, factors, list(set(suspend_permits))
