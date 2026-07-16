# Curated Document Corpus representing statutory frameworks and historical incident/near-miss profiles.
# Used for semantic search and compliance auditing (Person C RAG).

REGULATORY_DOCS = [
    {
        "id": "factories_act_sec_36",
        "title": "The Factories Act, 1948 - Section 36 (Confined Space Precautions)",
        "source": "statutory_compliance",
        "content": (
            "Section 36 of the Factories Act, 1948 outlines precautions against dangerous fumes, gases, and asphyxiation hazards.\n"
            "1. No person shall be allowed to enter any chamber, tank, vat, pit, pipe, flue or other confined space in which "
            "any gas, fume, vapour or dust is likely to be present to such an extent as to involve risk to persons being overcome "
            "thereby, unless it is provided with a manhole of adequate size or other effective means of egress.\n"
            "2. No person shall enter such confined space until a certificate in writing has been given by a competent person "
            "based on a test carried out by himself that the space is reasonably free from dangerous gas, fume, vapour or dust.\n"
            "3. Workers entering must wear suitable breathing apparatus and a safety harness securely attached to a rope, "
            "with the free end held by a standby person outside the confined space.\n"
            "4. Oxygen concentration in any confined space must be maintained strictly between 19.5% and 23.5%. "
            "Any atmosphere below 19.5% is classified as oxygen-deficient and carries an immediate asphyxiation hazard, "
            "requiring immediate suspension of work and evacuation."
        )
    },
    {
        "id": "factories_act_sec_37",
        "title": "The Factories Act, 1948 - Section 37 (Explosive or Inflammable Dust, Gas, etc.)",
        "source": "statutory_compliance",
        "content": (
            "Section 37 of the Factories Act, 1948 governs safety precautions regarding explosive or inflammable gas, dust, or vapor.\n"
            "1. Where in any factory any manufacturing process produces dust, gas, fume or vapour of such character and to such "
            "extent as to be likely to explode on ignition, all practicable measures shall be taken to prevent any such explosion "
            "by: (a) effective enclosure of the plant or machinery used, (b) removal or prevention of accumulation of such dust, "
            "gas, fume or vapour, and (c) exclusion or effective isolation of all possible sources of ignition.\n"
            "2. No plant, tank or vessel which contains or has contained any explosive or inflammable substance shall be subjected "
            "to any welding, brazing, soldering or cutting operation (hot work) until all practicable steps have been taken "
            "to remove the substance and any fumes, or to render it non-explosive or non-inflammable."
        )
    },
    {
        "id": "factories_act_sec_38",
        "title": "The Factories Act, 1948 - Section 38 (Precautions in Case of Fire)",
        "source": "statutory_compliance",
        "content": (
            "Section 38 of the Factories Act, 1948 mandates precautions in case of fire.\n"
            "1. In every factory, there shall be provided safe and clear means of escape for all persons in the event of fire, "
            "which must remain unlocked and unobstructed during working hours.\n"
            "2. All factories must provide adequate and suitable firefighting equipment, which must be regularly maintained, "
            "inspected, and tested by competent authorities.\n"
            "3. Alarm systems (sirens or electronic warnings) must be installed to alert all workers throughout the facility "
            "immediately upon fire detection.\n"
            "4. A sufficient number of workers must be trained in the correct use of firefighting equipment, and regular "
            "evacuation drills must be conducted and logged."
        )
    },
    {
        "id": "oisd_std_105_permits",
        "title": "OISD-STD-105: Work Permit System (Hot Work, Confined Space, Height Work)",
        "source": "oisd_standards",
        "content": (
            "OISD-STD-105 defines standard operating guidelines for industrial Work Permit Systems (Permit-to-Work or PTW).\n"
            "1. Hot Work Permit: Prohibits welding, cutting, grinding, or any spark-producing activity in any zone where "
            "flammable gas exceeds 4% LFL (Lower Flammable Limit). Fixed or portable gas test measurements must be taken "
            "prior to authorization and continuously during the work window.\n"
            "2. Confined Space Permit: Requires complete electrical isolation, blanking/blinding of process lines, gas checks "
            "for flammability, oxygen levels, and toxic gases (CO, H2S), an entry coordinator, and a dedicated standby person.\n"
            "3. Height Work Permit: Required for any maintenance or construction at heights of 2 meters or more. Safety "
            "harnesses, safety nets, scaffolding integrity checks, and tool fall-protection are mandatory.\n"
            "4. Simultaneous Operations (SIMOPs): Co-locating conflicting tasks (e.g. welding near active hydrocarbon venting, "
            "or hot work occurring directly above active worker zones) is strictly restricted and requires senior safety director "
            "countersignatures."
        )
    },
    {
        "id": "oisd_gdn_137_gas",
        "title": "OISD-GDN-137: Hazardous Gas Monitoring Systems & Placement Standards",
        "source": "oisd_standards",
        "content": (
            "OISD-GDN-137 establishes guidelines for continuous gas monitoring systems in industrial facilities.\n"
            "1. Gas Detection thresholds:\n"
            "  - Carbon Monoxide (CO): Toxic gas warning threshold is 25 ppm. Critical alarm/evacuation threshold is 50 ppm (OSHA PEL limits).\n"
            "  - Hydrogen Sulfide (H2S): Highly toxic gas warning threshold is 5 ppm. Critical alarm/evacuation threshold is 10 ppm.\n"
            "  - Flammable Methane (CH4): Warning threshold is 10% LFL. Critical threshold is 20% LFL. (Note: Hot work has a stricter threshold of < 4% LFL).\n"
            "2. Fixed sensors must be placed near likely leak sources (flanges, valves, storage domes) and calibrated quarterly.\n"
            "3. Any telemetry gap or sensor malfunction must be flagged within 10 minutes, and temporary hand-held detectors "
            "must be deployed in the zone immediately."
        )
    },
    {
        "id": "oisd_std_113_electrical",
        "title": "OISD-STD-113: Classification of Hazardous Areas for Electrical Installations",
        "source": "oisd_standards",
        "content": (
            "OISD-STD-113 details electrical safety classification in explosive hydrocarbon environments.\n"
            "1. Zones classification:\n"
            "  - Zone 0: Area where explosive gas mixtures are continuously present or present for long periods.\n"
            "  - Zone 1: Area where explosive gas mixtures are likely to occur in normal operation.\n"
            "  - Zone 2: Area where explosive gas mixtures are not likely to occur, or if they occur, will exist only for a short period.\n"
            "2. Electrical equipment installed in Zone 0 and Zone 1 must be certified flameproof (Ex-d), intrinsically safe (Ex-i), "
            "or pressurized (Ex-p) to prevent spark-induced ignition.\n"
            "3. All structural metalwork, storage tanks, and pumping systems must be securely grounded to prevent static charge accumulation."
        )
    },
    {
        "id": "oisd_std_116_fire",
        "title": "OISD-STD-116: Fire Protection Facilities for Petroleum Refineries and Process Plants",
        "source": "oisd_standards",
        "content": (
            "OISD-STD-116 outlines firefighting facilities, water systems, and foam requirements.\n"
            "1. Fire Water Ring Mains: Must surround all process blocks, storage areas, and utility plants, maintaining a "
            "minimum pressure of 7.0 kg/cm2 at the farthest point.\n"
            "2. Hydrant Spacing: Hydrants must be located at a spacing of not more than 30 meters in process units and "
            "45 meters in storage areas.\n"
            "3. Medium Expansion Foam Systems: Mandatory for all floating and fixed-roof storage tanks containing class A/B "
            "flammable liquids. Foam application must commence within 10 minutes of ignition detection."
        )
    },
    {
        "id": "oisd_gdn_145_layout",
        "title": "OISD-GDN-145: Layout and Spacing Standards for Process Units and Gas Storage",
        "source": "oisd_standards",
        "content": (
            "OISD-GDN-145 establishes spatial and safety spacing rules to prevent domino fire effects.\n"
            "1. Inter-unit distance between high-hazard units (like Coke Oven byproduct blocks and Blast Furnaces) must be "
            "at least 50 meters.\n"
            "2. Control rooms must be located upwind of potential hydrocarbon leak sources and constructed with blast-resistant "
            "reinforced concrete if within 60 meters of process equipment.\n"
            "3. Storage tanks for toxic or flammable liquefied gases must have a minimum clear safety zone of 30 meters from "
            "any property boundary or main roadway."
        )
    },
    {
        "id": "oisd_std_117_depots",
        "title": "OISD-STD-117: Fire Protection Facilities for Depots and Terminals",
        "source": "oisd_standards",
        "content": (
            "OISD-STD-117 outlines safety distance and fire control systems for storage depots and product terminals.\n"
            "1. Dyke Enclosures: All storage tanks for flammable liquids must be surrounded by a secure concrete or masonry dyke wall.\n"
            "2. Dyke capacity must be sufficient to contain the volume of the largest tank in the enclosure.\n"
            "3. Fixed water-spray deluge systems and semi-fixed foam lines must be installed on all tanks with a diameter greater than 15 meters.\n"
            "4. Fire water storage reservoirs must hold a minimum volume equivalent to 4 hours of design fire-fighting flow."
        )
    },
    {
        "id": "dgms_circular_emergency",
        "title": "DGMS Circular - Emergency Preparedness and Evacuation Plans",
        "source": "dgms_guidelines",
        "content": (
            "Directorate General of Mines Safety (DGMS) circulars dictate emergency preparedness and plant evacuation drills.\n"
            "1. Any zone experiencing a critical alarm (gas leak, fire, structural warning) must activate safety sirens immediately.\n"
            "2. Evacuation coordinators must track active worker counts in the affected zone using spatial worker badges.\n"
            "3. Preliminary incident reports must be generated within 2 hours of the alarm trigger, documenting telemetry values, "
            "active permits at the time of the event, and worker counts.\n"
            "4. All process feed valves leading to the critical zone must be closed immediately to prevent hazard propagation."
        )
    },
    {
        "id": "dgms_smp_hira",
        "title": "DGMS Circular - Safety Management Plan (SMP) & Hazard Identification (HIRA)",
        "source": "dgms_guidelines",
        "content": (
            "DGMS guidelines on Risk-Based Safety Management Plans (SMP) and HIRA implementation.\n"
            "1. Every mine and associated mineral processing plant must formulate a site-specific Safety Management Plan "
            "detailing all major operational hazards (e.g. gas outbursts, machinery impact, slope failure).\n"
            "2. HIRA (Hazard Identification and Risk Assessment) must be performed prior to any major maintenance block or "
            "change in operating conditions. Control measures must follow the hierarchy of controls (Elimination, Substitution, "
            "Engineering controls, Administrative controls, PPE).\n"
            "3. Standard Operating Procedures (SOPs) must be documented for all critical tasks and read out to technicians "
            "during tool-box talks before shifts."
        )
    },
    {
        "id": "dgms_circular_dust_limit",
        "title": "DGMS Circular - Respirable Coal and Ore Dust Control Standards",
        "source": "dgms_guidelines",
        "content": (
            "DGMS regulations on dust exposure control in mines and mineral processing operations.\n"
            "1. Permissible limit of respirable dust in the work environment must not exceed 3 mg/m³ (8-hour Time Weighted Average).\n"
            "2. Continuous water suppression sprays must be installed and active at all conveyor discharge chutes and transfer points.\n"
            "3. Approved wetting chemical agents must be blended into the suppression water to increase dust-binding efficiency.\n"
            "4. Personal dust sampling and health checks must be conducted quarterly for all high-exposure operators, and results "
            "must be submitted to the regional DGMS director."
        )
    },
    {
        "id": "dgms_tech_04_gas",
        "title": "DGMS Technical Circular 04 of 2020 - Prevention of Inflammable Gas Hazards",
        "source": "dgms_guidelines",
        "content": (
            "DGMS circular on controlling inflammable gas accumulation in mining and ventilation ducts.\n"
            "1. Pre-mining methane drainage is mandatory for coal/mineral seams with gas content exceeding 10 cubic meters per ton.\n"
            "2. Mechanical ventilation fans must operate continuously, maintaining methane concentrations strictly below 0.75% "
            "in the general body of ventilation and below 1.25% in any local workings/pockets.\n"
            "3. If methane levels exceed 1.25% at any point, all power to electrical installations in that zone must be cut "
            "off automatically, and personnel must evacuate immediately."
        )
    },
    {
        "id": "cctv_compliance_guidelines",
        "title": "Industrial Safety Standards - Real-Time Video Analytics & PPE Enforcement",
        "source": "statutory_compliance",
        "content": (
            "Guidelines on visual monitoring systems and PPE enforcement in heavy industrial operations.\n"
            "1. Automated Video Surveillance (CCTV): High-risk work zones (welding blocks, coke oven batteries, confined entries) "
            "must be covered by continuous CCTV monitoring linked to real-time Computer Vision (CV) alert systems.\n"
            "2. Personal Protective Equipment (PPE) detection: CV models must continuously audit workers for helmet compliance, "
            "safety harness attachment during height work, and breathing apparatus in toxic gas zones. Detection of 'no_ppe' "
            "breaches must immediately trigger local warnings and notify the safety supervisor.\n"
            "3. Restricted Area Access: CV systems must establish virtual geofences (exclusion zones) around high-temperature, "
            "high-pressure, or toxic-gas venting areas. Detected unauthorized entry must raise immediate alarms, and all nearby "
            "hot work permits must be reassessed/suspended to avoid ignition risks."
        )
    }
]

HISTORICAL_INCIDENTS = [
    {
        "id": "inc_2025_coke_oven_leak",
        "title": "Historical Incident: Coke Oven CO Poisoning Case (April 2025)",
        "source": "incident_records",
        "content": (
            "Incident Summary: A severe Carbon Monoxide leak occurred in Coke Oven Battery 1 on April 12, 2025.\n"
            "Contributing Factors:\n"
            "  - General maintenance was active on Gas main valve 'V-102'.\n"
            "  - A shift changeover occurred during the maintenance window.\n"
            "  - Communication failure during handover resulted in incoming operators opening pressure valves while maintenance seals were unseated.\n"
            "  - CO concentration spiked from 5 ppm to 85 ppm within 4 minutes.\n"
            "Casualties: Two technicians lost consciousness due to lack of immediate self-rescue respirators in the area.\n"
            "Violations: Factories Act Sec. 36 breached (no continuous atmospheric monitoring during handover; no standby safety watch)."
        )
    },
    {
        "id": "inc_2024_sinter_welding_fire",
        "title": "Historical Incident: Flammable Gas Fire at Sinter Plant (November 2024)",
        "source": "incident_records",
        "content": (
            "Incident Summary: A flash fire occurred at Sinter Plant hopper during a welding task on November 5, 2024.\n"
            "Contributing Factors:\n"
            "  - A welder was operating under an active Hot Work permit.\n"
            "  - Sub-critical methane leakage (around 4.2% LFL) was drifting from a nearby gas line joint.\n"
            "  - The welder's sparks ignited the gas pocket, resulting in a flash fire.\n"
            "Casualties: One welder suffered minor thermal burns.\n"
            "Violations: OISD-STD-105 was violated. Hot work was permitted to continue in the presence of flammable gas exceeding "
            "the strict 4% LFL welding safety limit."
        )
    },
    {
        "id": "inc_2023_ammonia_leak",
        "title": "Historical Incident: Ammonia Storage Valve Gasket Blowout (August 2023)",
        "source": "incident_records",
        "content": (
            "Incident Summary: Toxic Ammonia release occurred in Ammonia Storage Tank area on August 18, 2023.\n"
            "Contributing Factors:\n"
            "  - High summer ambient temperature (42°C) combined with a failure of the tank cooling water spray system.\n"
            "  - Internal pressure spiked to 2.1 bar. Gasket on outlet valve 'AV-04' failed, releasing ammonia vapor.\n"
            "  - Delay in activating the evacuation siren (15 minutes) because operators attempted to manually clamp the leak first without proper PPE.\n"
            "Casualties: 4 workers required hospitalization for respiratory irritation.\n"
            "Violations: OISD-GDN-137 violated (failed to flag sensor alarm promptly and delay in manual override). Emergency evacuation rules breached."
        )
    },
    {
        "id": "inc_2025_vizag_explosion",
        "title": "Historical Incident: Visakhapatnam Valve Room Gas Explosion (January 2025)",
        "source": "incident_records",
        "content": (
            "Incident Summary: A massive gas explosion in a byproduct valve room resulted in 8 worker fatalities on January 15, 2025.\n"
            "Contributing Factors:\n"
            "  - Technicians were operating under a Hot Work permit, executing structural welding adjacent to gas main piping.\n"
            "  - A bypass valve unseated silently, causing methane and CO gases to accumulate in the enclosed valve room.\n"
            "  - Fixed gas detectors registered elevations, but data sat on a isolated SCADA screen and did not cross-reference the active permit.\n"
            "  - Welding sparks ignited the flammable gas mixture, triggering a catastrophic blast.\n"
            "Casualties: 8 workers died; structural collapse of the valve room building.\n"
            "Violations: OISD-STD-105 violated (hot work permitted while flammable gas was accumulating). Failure to implement SIMOPs risk verification."
        )
    },
    {
        "id": "inc_2022_ammonia_spark",
        "title": "Historical Incident: Ammonia Dyke Static Spark Ignition (August 2022)",
        "source": "incident_records",
        "content": (
            "Incident Summary: An ammonia leak from safety relief valve ignited, causing a persistent fire in the dyke wall on August 4, 2022.\n"
            "Contributing Factors:\n"
            "  - Ammonia safety valve released vapor during a sudden power surge and venting cycle.\n"
            "  - Static electricity generated by an ungrounded product pump discharge valve discharged a spark.\n"
            "  - The spark ignited the ammonia-air mixture inside the concrete dyke wall.\n"
            "Casualties: Two firefighters injured during containment. Facility shut down for 3 days.\n"
            "Violations: OISD-STD-113 violated (failure to ground electrical/mechanical structures in a hazardous zone). OISD-STD-117 breached (dyke wall gas detection delay)."
        )
    },
    {
        "id": "near_miss_2025_ammonia_drift",
        "title": "Near-Miss Record: Ammonia Storage H2S Spurious Drift (January 2026)",
        "source": "near_miss_logs",
        "content": (
            "Near-Miss Summary: Spurious telemetry drift of H2S (reaching 8.5 ppm) detected in Ammonia Storage Tank area.\n"
            "Actions Taken:\n"
            "  - System automatically flagged the H2S spike as warning-level.\n"
            "  - Safety officer cross-referenced past 2023 sensor drifts and dispatched a technician with a portable sniffer.\n"
            "  - Found a loose gasket on venting valve. Gasket was replaced under height work safety guidelines.\n"
            "  - Incident was resolved with zero exposure or injuries."
        )
    },
    {
        "id": "near_miss_2025_blast_furnace_coke",
        "title": "Near-Miss Record: Blast Furnace A Coke Dust Over-accumulation (September 2025)",
        "source": "near_miss_logs",
        "content": (
            "Near-Miss Summary: Coal dust accumulated heavily near Blast Furnace A conveyor discharge chute.\n"
            "Actions Taken:\n"
            "  - Continuous particulate monitors registered elevated levels. Maintenance had scheduled an adjacent welding task.\n"
            "  - RAG engine flagged Section 37 of Factories Act (ignition source exclusion near explosive dust).\n"
            "  - Safety Officer suspended the welding permit, ordered water spraying for dust suppression, and cleared the chute before allowing hot work.\n"
            "  - Potential dust explosion hazard successfully averted."
        )
    },
    {
        "id": "near_miss_2025_cctv_ppe",
        "title": "Near-Miss Record: CCTV CV PPE Detection at Coke Oven (October 2025)",
        "source": "near_miss_logs",
        "content": (
            "Near-Miss Summary: Real-time CCTV analysis triggered a high-severity alert for a 'no_ppe' violation in Coke Oven Battery 1.\n"
            "Contributing Factors:\n"
            "  - A technician climbed onto the Coke Oven top battery level to adjust a manual pressure gauge under a Height Work permit.\n"
            "  - The technician failed to secure their safety harness lanyard to the static lifeline (PPE violation).\n"
            "  - The CV analytics engine detected the unanchored harness and triggered a 'no_ppe' warning at 92% confidence.\n"
            "Actions Taken:\n"
            "  - The ZeroHarm platform immediately flagged the zone risk and suspended the overlapping permits.\n"
            "  - Shift supervisor ordered the technician to halt work and hook up their harness immediately.\n"
            "  - Potential fall from height incident prevented by automated visual audit."
        )
    }
]

# Combine all documents into a single indexed list
ALL_DOCUMENTS = REGULATORY_DOCS + HISTORICAL_INCIDENTS
