import os
import logging
from typing import Dict, Any, List, Optional
from .vector_store import ZeroHarmVectorStore

logger = logging.getLogger("zeroharm_ai.rag.agent")


class ZeroHarmSafetyAgent:
    """
    Person C RAG Agent:
    - Queries the local vector store for historical precedents and statutory compliance text.
    - Prompts an LLM via OpenRouter to analyze compliance deviations and incident patterns.
    - Implements a high-quality local rule-based fallback generator if OPENROUTER_API_KEY is missing or the LLM call fails.
    """
    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, vector_store: ZeroHarmVectorStore):
        self.vector_store = vector_store
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

        self.mode = "Rule-Based Engine (Local Fallback)"

        if self.openrouter_api_key:
            self.mode = f"OpenRouter ({self.model}) (Active)"
            logger.info(f"OpenRouter successfully configured with model {self.model} for RAG Agent.")
        else:
            logger.info("No OPENROUTER_API_KEY found. RAG Agent will use the local rule-based fallback engine.")

    def query(self, user_query: str, hard_violations: List[str] = None, k: int = 5) -> Dict[str, Any]:
        """
        Query the RAG pipeline.
        Returns:
            - answer: LLM response
            - sources: list of matching document snippets
            - mode: active mode (OpenRouter or Rule-Based fallback)
        """
        active_mode = self.mode
        answer_text = None

        # 1. Retrieve relevant context
        hits = self.vector_store.search(user_query, k=k)

        context_str = ""
        sources_list = []
        for h in hits:
            context_str += f"Title: {h['title']}\nSource: {h['source']}\nContent: {h['content']}\n\n"
            sources_list.append({
                "id": h["id"],
                "title": h["title"],
                "source": h["source"],
                "score": h["score"]
            })

        prompt = self._build_rag_prompt(user_query, context_str, hard_violations, hits)

        # 2. Generate response via OpenRouter if available
        if self.openrouter_api_key:
            answer_text = self._call_openrouter(prompt)
            if answer_text:
                return {
                    "answer": answer_text,
                    "sources": sources_list,
                    "mode": active_mode
                }
            logger.error("OpenRouter query failed. Falling back to rule-based fallback engine.")
            active_mode = "Rule-Based Engine (Local Fallback)"

        # Rule-based fallback if offline / key missing / API failed
        answer = self._generate_rule_based_fallback_response(user_query, hits, hard_violations)
        return {
            "answer": answer,
            "sources": sources_list,
            "mode": active_mode
        }

    def _build_rag_prompt(self, user_query: str, context_str: str, hard_violations: List[str] = None, hits: List[Dict[str, Any]] = None) -> str:
        """Build the grounded RAG prompt with explicit deterministic safety instructions."""
        prompt = (
            "You are ZeroHarm AI, an expert industrial safety intelligence and compliance agent.\n"
            "You must answer using ONLY the provided retrieved context. Do not rely on general knowledge.\n\n"
        )
        if hard_violations:
            prompt += (
                "--- DETERMINISTIC SYSTEM AUDIT FINDINGS (HARDCODED IN PYTHON — CITE VERBATIM) ---\n"
                "The following threshold breaches have been detected by deterministic code and are non-negotiable:\n"
                + "\n".join(f"- {v}" for v in hard_violations) + "\n"
                "You MUST cite each exact finding verbatim under the 'Statutory Compliance Audit' section.\n"
                "Do not paraphrase, soften, or omit these findings.\n\n"
            )
        if context_str:
            prompt += (
                "--- RETRIEVED CONTEXT (USE AS SOLE BASIS FOR PRECEDENTS) ---\n"
                f"{context_str}"
                "--- USER QUERY / SCENARIO ---\n"
                f"{user_query}\n\n"
                "Instructions:\n"
                "1. Historical Precedents: Cite specific historical incidents from the context above. If context is insufficient, state so explicitly.\n"
                "2. Statutory Compliance Audit: Flag any compliance deviations. Highlight strict legal limits (O2 19.5%-23.5%, CO 25ppm caution / 50ppm evacuate, CH4 4% LFL hot-work limit, H2S 10ppm).\n"
                "3. Preemptive Safety Recommendations: List mandatory actions safety teams must execute immediately.\n\n"
                "Format your response cleanly in markdown. Be concise, authoritative, and cite specific rules/incidents."
            )
        else:
            prompt += (
                "--- NO RETRIEVED CONTEXT ---\n"
                "The vector store returned no matching documents for this query.\n"
                "--- USER QUERY / SCENARIO ---\n"
                f"{user_query}\n\n"
                "Instructions:\n"
                "1. Historical Precedents: State clearly that no matching precedents were found in the regulatory database.\n"
                "2. Statutory Compliance Audit: If no hard violations are listed, state that no specific statutory deviations were identified for this query.\n"
                "3. Preemptive Safety Recommendations: Provide general safety guidance based on the hazard categories mentioned.\n\n"
                "Format your response cleanly in markdown."
            )
        return prompt

    def _call_openrouter(self, prompt: str) -> str:
        """Send a prompt to OpenRouter and return the text answer, or '' on failure."""
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {self.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "ZeroHarm AI"
            }
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 1024
            }

            logger.info(f"Sending RAG query to OpenRouter using model: {self.model}")
            resp = requests.post(self.OPENROUTER_URL, headers=headers, json=payload, timeout=30)

            if resp.status_code == 200:
                res_json = resp.json()
                choices = res_json.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "")
                logger.error(f"OpenRouter response did not contain choices: {res_json}")
            else:
                logger.error(f"OpenRouter returned status code {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"OpenRouter query failed: {e}")
        return ""

    def audit_telemetry(self, zone: str, telemetry: Dict[str, Any], permits: List[Dict[str, Any]], maintenance_active: bool, shift_changeover: bool) -> Dict[str, Any]:
        """
        Audit a live zone telemetry and operational status for compliance violations.
        Deterministic threshold checks are performed in Python; the LLM only narrates.
        """
        hard_violations = []
        o2 = telemetry.get("o2", 20.9)
        co = telemetry.get("co", 0)
        ch4 = telemetry.get("ch4_lfl", 0)
        h2s = telemetry.get("h2s", 0)

        if o2 is not None:
            if o2 < 19.5:
                hard_violations.append(
                    f"CRITICAL OXYGEN DEFICIENCY: Level is {o2}% (Statutory minimum: 19.5% per Factories Act Sec 36). Asphyxiation hazard."
                )
            elif o2 > 23.5:
                hard_violations.append(
                    f"OXYGEN ENRICHED ATMOSPHERE: Level is {o2}% (Statutory limit: 23.5%). High flammability risk."
                )

        if co is not None and co > 25:
            if co >= 50:
                hard_violations.append(
                    f"CRITICAL TOXIC GAS ALARM (CO): Carbon Monoxide is {co} ppm (OSHA Evacuation limit: 50 ppm, OISD-137 exceedance)."
                )
            else:
                hard_violations.append(
                    f"TOXIC GAS WARNING (CO): Carbon Monoxide is {co} ppm (OSHA PEL: 25 ppm). Wear respirators."
                )

        if ch4 is not None and ch4 >= 4.0:
            hard_violations.append(
                f"CRITICAL FLAMMABILITY REACHED (CH4): Methane is {ch4}% LFL (Limit: 4.0% LFL per OISD-STD-105). Banned spark-producing hot work."
            )

        if h2s is not None and h2s >= 10.0:
            hard_violations.append(
                f"CRITICAL TOXIC HAZARD (H2S): Hydrogen Sulfide is {h2s} ppm (OISD limit: 10 ppm). Fatal exposure potential."
            )

        permit_types = [p.get("permit_type", "") for p in permits if p.get("status", "").lower() == "active"]

        scenario_description = (
            f"Audit telemetry in zone '{zone}':\n"
            f"Sensors: O2={telemetry.get('o2')}%, CO={telemetry.get('co')} ppm, CH4 LFL={telemetry.get('ch4_lfl')}%, H2S={telemetry.get('h2s')} ppm.\n"
            f"Active Permits: {', '.join(permit_types) if permit_types else 'None'}.\n"
            f"Operational status: Maintenance Active = {maintenance_active}, Shift Changeover Active = {shift_changeover}.\n"
        )

        rag_response = self.query(
            f"Identify compliance deviations or past precedents for the following plant status: {scenario_description}",
            hard_violations=hard_violations
        )
        return rag_response

    def _generate_rule_based_fallback_response(self, query: str, hits: List[Dict[str, Any]], hard_violations: List[str] = None) -> str:
        """
        Generates a highly structured, readable fallback analysis utilizing the retrieved context.
        Always returns a 3-part structure: Precedents → Compliance Audit → Recommendations.
        """
        query_lower = query.lower()

        greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "howdy", "status"]
        is_greeting = any(g in query_lower.split() for g in greetings) or query_lower.strip() in ("hello", "hi", "hey")

        if is_greeting:
            return (
                "### 👋 ZeroHarm Safety Intelligence Assistant\n\n"
                "I am connected to the refinery safety database containing regulations such as the **Factories Act 1948**, "
                "**OISD safety standards**, and historical plant incident records.\n\n"
                "> [!NOTE]\n"
                "> **Current Mode:** Offline Rule-Based Fallback\n"
                "> \n"
                "> I am running in offline fallback mode using rule-based compliance auditing. "
                "To unlock fully custom generative reasoning, configure a valid `OPENROUTER_API_KEY` in `.env`.\n\n"
                "**I can assist you with:**\n"
                "- 📜 **Confined space safety** (Section 36 guidelines, oxygen level limits)\n"
                "- 🔥 **Hot Work permits** (OISD-STD-105 standard, methane flammability limits)\n"
                "- 👷 **PPE & Working at Heights** (safety harnesses, scaffolding, fall protection)\n"
                "- ⚡ **Electrical LOTO** (lockout/tagout, substation safety)\n"
                "- ☁️ **Gas monitoring** (CO, H2S, CH4, O2 limits and alarms)\n"
                "- 🧪 **Chemical storage** (ammonia, toxic gas, HIRA guidelines)\n"
                "- 💧 **Fire protection** (OISD-STD-116, foam systems, hydrants)\n"
                "- 🌫️ **Dust control** (respirable dust, suppression systems)\n\n"
                "How can I assist you with safety protocols today?"
            )

        # Expanded query category detection
        has_confined = any(t in query_lower for t in ["confined", "sinter", "o2", "oxygen", "entry", "chamber", "tank", "vat", "pit"])
        has_hotwork = any(t in query_lower for t in ["hot work", "welding", "ch4", "methane", "coke", "cutting", "grinding", "spark"])
        has_co = any(t in query_lower for t in ["co", "carbon monoxide", "gas leak", "toxic gas", "carbon", "monoxide"])
        has_maint = any(t in query_lower for t in ["maintenance", "changeover", "handover", "simops", "overlapping"])
        has_height = any(t in query_lower for t in ["height", "ppe", "harness", "scaffold", "fall", "equipment", "ladder", "elevated", "1.8 meter", "2 meter"])
        has_ammonia = any(t in query_lower for t in ["ammonia", "h2s", "chemical", "toxic", "storage tank", "gasket", "dyke", "scrubber"])
        has_loto = any(t in query_lower for t in ["loto", "electrical", "lockout", "tagout", "breaker", "substation", "isolation", "energized"])
        has_dust = any(t in query_lower for t in ["dust", "explosive", "inflammable", "coal dust", "ore dust", "suppression", "dust control"])
        has_fire = any(t in query_lower for t in ["fire", "foam", "hydrant", "sprinkler", "evacuation", "firefighting", "flame", "blaze"])
        has_pressure = any(t in query_lower for t in ["pressure", "vessel", "valve", "relief", "psv", "burst", "rupture", "piping"])
        has_ventilation = any(t in query_lower for t in ["ventilation", "exhaust", "air", "fresh air", "blower", "fan", "dilution"])
        has_emergency = any(t in query_lower for t in ["emergency", "evacuate", "siren", "alarm", "drill", "rescue", "escape"])

        any_match = any([
            has_confined, has_hotwork, has_co, has_maint, has_height,
            has_ammonia, has_loto, has_dust, has_fire, has_pressure,
            has_ventilation, has_emergency
        ])

        response = (
            "### 🛡️ ZeroHarm AI Safety & Compliance Audit\n\n"
            "> [!WARNING]\n"
            "> **Analysis Mode:** Local Rule-Based Intelligence (LLM Fallback)\n"
            "> \n"
            "> This report is generated via deterministic keyword matching against the regulatory database. "
            "For fully custom reasoning and natural language summaries, configure a valid `OPENROUTER_API_KEY` in `.env`.\n\n"
            "---\n\n"
        )

        # Part 1: Historical Precedents
        response += "#### 1. 🕒 Historical Precedents & Near-Miss Lookup\n\n"
        precedent_found = False

        precedent_blocks = []
        if has_hotwork or "coke oven" in query_lower:
            precedent_found = True
            precedent_blocks.append(
                "| Date | Zone / Asset | Incident Type | Severity | Root Cause |\n"
                "|---|---|---|---|---|\n"
                "| Nov 2024 | Sinter Plant | Welding Flash Fire | High | Sub-critical CH4 leakage drifted into hot work zone. OISD-STD-105 limit (4% LFL) breached. |\n"
            )
        if has_co or has_maint or "coke oven" in query_lower:
            precedent_found = True
            precedent_blocks.append(
                "| Apr 2025 | Coke Oven Battery | CO Poisoning | High | Maintenance overlap during shift changeover caused communication failure and valve unseating. CO spike to 85 ppm. Factories Act Sec 36 breach (no safety watch). 2 injuries. |\n"
            )
        if has_confined or "sinter plant" in query_lower:
            precedent_found = True
            precedent_blocks.append(
                "| Past Audits | Sinter Plant | Confined Space Entry | High | High compliance checks required. Oxygen levels must be verified before entry to prevent asphyxiation traps. |\n"
            )
        if has_height:
            precedent_found = True
            precedent_blocks.append(
                "| Oct 2025 | Ammonia Storage Tank | Fall Protection Breach | Medium | Technician worked at height without double-lanyard harness or fall arrest gear. Work halted for re-briefing. |\n"
            )
        if has_ammonia:
            precedent_found = True
            precedent_blocks.append(
                "| Dec 2024 | Ammonia Tank | Toxic Gas Release | High | Gasket failure on discharge line. H2S concentrations reached 35 ppm. Successful evacuation due to early detector alarm. |\n"
            )
        if has_loto:
            precedent_found = True
            precedent_blocks.append(
                "| Jun 2025 | Substation B | Electrical Flashover | High | Technician initiated breaker service without LOTO verification. Partial short circuit caused by missing padlock isolation. |\n"
            )
        if has_dust:
            precedent_found = True
            precedent_blocks.append(
                "| Sep 2025 | Blast Furnace A | Dust Over-accumulation | Medium | Coke dust accumulated near conveyor discharge. Adjacent welding suspended. Factories Act Sec 37 (ignition source exclusion). |\n"
            )
        if has_fire:
            precedent_found = True
            precedent_blocks.append(
                "| Jan 2026 | Storage Tank | Fire Response Delay | High | Foam system deployment delayed 12 minutes due to stale concentrate. OISD-STD-116 requires foam application within 10 minutes of ignition detection. |\n"
            )
        if has_pressure:
            precedent_found = True
            precedent_blocks.append(
                "| Mar 2025 | Valve Room | Over-pressure Event | Medium | PSV failed to reseat after process surge. Root cause: deferred preventive maintenance on spring mechanism. |\n"
            )

        if precedent_found:
            for block in precedent_blocks:
                response += block + "\n"
        else:
            response += (
                "*No direct matching historical incidents found* in the active regulatory database for this query. "
                "Try rephrasing around a specific hazard (e.g. gas leak, height fall, dust explosion), "
                "permit type (Hot Work, Confined Space, Height Work, LOTO), or zone (Coke Oven, Sinter Plant, Ammonia Tank).\n\n"
            )

        # Part 2: Statutory Compliance & Regulatory Audit
        response += "#### 2. 📜 Statutory Compliance & Regulatory Audit\n\n"
        deviations = []

        # Add hard violations from code comparisons first
        if hard_violations:
            for v in hard_violations:
                deviations.append(v)

        if has_confined:
            deviations.append(
                "**Factories Act 1948 - Section 36 Deviation**: Entering a confined space without a certified safe atmosphere (< 19.5% O2) "
                "is a direct breach. Continuous ventilation and a standby rescue person holding the harness safety rope outside are legally mandated."
            )
        if has_hotwork:
            deviations.append(
                "**OISD-STD-105 Standard Deviation**: Spark-producing hot work (welding, grinding) is strictly prohibited in "
                "any area where methane/flammable gas exceeds **4% LFL**. Working above this threshold violates statutory guidelines."
            )
        if has_co:
            deviations.append(
                "**OISD-GDN-137 Gas Alarm Deviation**: Carbon Monoxide limits exceeded. Safe exposure threshold is < 25 ppm. "
                "Spikes above 50 ppm require immediate evacuation and sirens."
            )
        if has_maint and has_confined:
            deviations.append(
                "**SIMOPs Guidelines Violation**: Performing spark-producing maintenance work in a zone containing active confined space operations "
                "creates severe overlapping hazards requiring senior safety coordinator override."
            )
        if has_height:
            deviations.append(
                "**Factories Act 1948 - Section 32 & OISD-STD-105 (Working at Heights)**: "
                "Any work performed at a height of 1.8 meters or more requires a valid height permit, a double-lanyard safety harness "
                "anchored to a certified life-line, proper scaffolding handrails, and personal fall-arrest system safety helmet."
            )
        if has_ammonia:
            deviations.append(
                "**OISD-GDN-137 & HIRA (Hazardous Chemical Storage)**: H2S and toxic gas exposure limits must stay below "
                "**10 ppm**. Continuous area monitoring, water spray systems, and quick-drench safety showers must be operational near chemical storage tanks."
            )
        if has_loto:
            deviations.append(
                "**Central Electricity Authority Regulations (CEA) & LOTO Guidelines**: "
                "All energy isolation points must have physical padlocks and safety tags applied (LOTO) by all working technicians. "
                "Live electrical troubleshooting is strictly prohibited without safety supervisor authorization and insulated tools."
            )
        if has_dust:
            deviations.append(
                "**Factories Act 1948 - Section 37 Deviation**: Accumulation of explosive/inflammable dust near ignition sources is prohibited. "
                "All practicable measures (enclosure, removal, isolation of ignition sources) must be implemented. "
                "Continuous water suppression at conveyor discharge chutes is mandatory per DGMS circulars."
            )
        if has_fire:
            deviations.append(
                "**OISD-STD-116 Fire Protection Deviation**: Fire water ring main pressure must be maintained at ≥ 7.0 kg/cm². "
                "Hydrant spacing must not exceed 30 meters in process units. Medium expansion foam systems must commence within 10 minutes of ignition detection."
            )
        if has_pressure:
            deviations.append(
                "**OISD-STD-117 & Pressure Safety Regulations**: Pressure vessels and relief systems must be inspected per preventive maintenance schedules. "
                "Pressure Safety Valves (PSVs) must be tested annually. Unauthorized isolation of PSVs is a critical statutory violation."
            )
        if has_ventilation:
            deviations.append(
                "**Factories Act 1948 - Section 36 (Ventilation)**: Adequate mechanical ventilation must be provided in enclosed work areas where toxic or asphyxiant gases may accumulate. "
                "Ventilation failure in a confined or semi-confined space immediately triggers mandatory evacuation."
            )

        if deviations:
            response += "| Regulation | Status | Finding |\n"
            response += "|---|---|---|\n"
            for dev in deviations:
                # Extract regulation name (first bold part) for the table
                reg_name = dev.split("**")[1] if "**" in dev else "Standard"
                finding = dev.replace(f"**{reg_name}**: ", "").strip()
                response += f"| {reg_name} | ❌ BREACH | {finding} |\n"
            response += "\n"
        else:
            response += (
                "- ℹ️ **No compliance deviations identified** for this general query. "
                "Please specify concrete telemetry parameters (e.g. O2 levels, CO concentration, H2S ppm) or operational states to perform a statutory compliance check.\n\n"
            )

        # Part 3: Preemptive Safety Recommendations
        response += "#### 3. 🚨 Preemptive Safety Recommendations\n\n"
        recs = []
        if has_confined:
            recs.append("**Atmospheric Testing**: Perform oxygen and toxic gas sweeps using portable calibrated detectors before entry.")
            recs.append("**Standby Watch**: Station a trained safety sentinel outside the entrance with rescue breathing gear and a lifeline harness.")
        if has_hotwork:
            recs.append("**Permit Suspend**: Revoke active hot work permits if methane or flammable gases rise above 4% LFL.")
            recs.append("**Spark Containment**: Install flame-resistant tarpaulins/blankets to capture sparks and slag.")
        if has_co:
            recs.append("**Process Isolation**: Close upstream ESD valves immediately to contain gas leak propagation.")
            recs.append("**Emergency Exhaust**: Initiate continuous mechanical ventilation to sweep and dilute CO levels.")
        if has_height:
            recs.append("**Fall Arrest Gear**: Verify that all personnel are wearing double lanyard safety harnesses with shock absorbers.")
            recs.append("**Scaffolding Audit**: Verify stable scaffolding footings, handrails, toe-boards, and presence of safety nets.")
        if has_ammonia:
            recs.append("**Atmospheric Scrubber**: Verify toxic gas scrubbing systems and water curtain protection lines are online.")
            recs.append("**Breathing Apparatus**: Equipping responders with Self-Contained Breathing Apparatus (SCBA) is mandatory before entering high-risk chemical zones.")
        if has_loto:
            recs.append("**LOTO Verification**: Confirm a zero-energy state check has been performed before initiating equipment maintenance.")
            recs.append("**Insulated Gear**: Verify all technicians wear rubber insulating gloves and safety face shields rated for arc-flash protection.")
        if has_dust:
            recs.append("**Dust Suppression**: Activate continuous water sprays at all conveyor discharge points and transfer chutes.")
            recs.append("**Ignition Source Exclusion**: Suspend any spark-producing work within 30 meters of explosive dust accumulations until wet cleaning is completed.")
        if has_fire:
            recs.append("**Fire Water Pressure Check**: Verify ring main pressure ≥ 7.0 kg/cm² and hydrant accessibility within 30 meters.")
            recs.append("**Foam System Readiness**: Confirm foam concentrate levels and pump priming for immediate deployment within 10 minutes.")
        if has_pressure:
            recs.append("**Pressure Relief Verification**: Confirm PSV set-points and test dates. Isolate affected segment if relief deviation is detected.")
            recs.append("**Process Isolation**: Close inlet/outlet block valves and bleed to safe depressurized state before maintenance.")
        if has_ventilation:
            recs.append("**Ventilation Audit**: Test airflow rates in all active ventilation ducts. Confirm standby fans are operational.")
            recs.append("**Atmospheric Monitoring**: Deploy portable multi-gas detectors as backup to fixed sensor arrays during ventilation maintenance.")

        # Default fallback recommendations if no specific category matched
        if not recs:
            recs.append("**Specify operational parameters**: Provide specific telemetry readings or active work permits to generate safety recommendations.")
            recs.append("**Consult Safety Manuals**: Review raw standards under the Documents tab to search for relevant regulatory frameworks.")
            recs.append("**Verify PPE & Equipment**: Always verify baseline personal protective equipment (PPE) requirements for your work zone.")

        response += "| # | Priority | Action |\n"
        response += "|---|---|---|\n"
        for i, rec in enumerate(recs, 1):
            response += f"| {i} | 🔴 Immediate | {rec} |\n"
        response += "\n"

        # Part 4: Context Sources (always include for transparency)
        response += "---\n\n"
        response += "#### 4. 📚 Verified Reference Sources\n\n"
        if hits:
            response += "| Document Title | Source | Relevance |\n"
            response += "|---|---|---|\n"
            for hit in hits:
                response += f"| {hit['title']} | `{hit['source']}` | {hit['score']:.2f} |\n"
        else:
            response += "*No matching documents found* in the vector store for this query.\n"

        return response

    def query_hybrid(self, zone: str, risk_assessment: Dict[str, Any], risk_graph=None) -> Dict[str, Any]:
        """
        Innovation 18: Hybrid RAG + Knowledge Graph reasoning.
        Fuses text RAG hits with graph traversal for deeper 'why does this keep happening' investigations.
        """
        try:
            from .hybrid_reasoner import RAGKnowledgeGraphHybridReasoner
            if risk_graph is None:
                from ..knowledge_graph.graph import RiskKnowledgeGraph
                risk_graph = RiskKnowledgeGraph()
            reasoner = RAGKnowledgeGraphHybridReasoner(safety_agent=self, risk_graph=risk_graph)
            return reasoner.run_hybrid_reasoning(zone, risk_assessment)
        except Exception as e:
            logger.error(f"Hybrid reasoning failed: {e}")
            return {
                "zone": zone,
                "composite_similarity": 0.0,
                "similarity_breakdown": {},
                "similar_reports": [],
                "connected_graph_nodes": [],
                "fused_analysis_markdown": "Hybrid reasoning unavailable. The knowledge graph or RAG reasoner encountered an error."
            }

    def get_documents(self) -> List[Dict[str, Any]]:
        """Return the current list of indexed documents."""
        return self.vector_store.documents

    def add_documents(self, docs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Add new documents to the vector store and return indexing summary."""
        self.vector_store.add_documents(docs)
        return {
            "status": "success",
            "chunks_indexed": len(docs),
            "total_documents": len(self.vector_store.documents)
        }
