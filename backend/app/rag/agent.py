import os
import logging
from typing import Dict, Any, List
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

    def query(self, user_query: str, hard_violations: List[str] = None) -> Dict[str, Any]:
        """
        Query the RAG pipeline.
        Returns:
            - answer: LLM response
            - sources: list of matching document snippets
            - mode: active mode (OpenRouter or Rule-Based fallback)
        """
        # 1. Retrieve relevant context
        hits = self.vector_store.search(user_query, k=3)

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

        # Build prompt
        prompt = (
            "You are ZeroHarm AI, an expert industrial safety intelligence and compliance agent.\n"
            "Analyze the user's query/scenario using the provided context containing statutory compliance acts, "
            "OISD/DGMS safety standards, and historical plant incident records.\n\n"
        )
        if hard_violations:
            prompt += (
                "--- DETERMINISTIC SYSTEM AUDIT FINDINGS ---\n"
                "The system has detected the following hard threshold violations in code:\n"
                + "\n".join(f"- {v}" for v in hard_violations) + "\n"
                "You must cite these exact findings in your analysis under the 'Statutory Compliance Audit' section.\n\n"
            )
        prompt += (
            "--- RETRIEVED CONTEXT ---\n"
            f"{context_str}"
            "--- USER QUERY / SCENARIO ---\n"
            f"{user_query}\n\n"
            "Instructions:\n"
            "1. Historical Precedents: Answer if we have seen similar patterns or events in the past. Cite specific historical incidents from the context.\n"
            "2. Statutory Compliance Audit: Flag any compliance deviations, safety breaches, or statutory violations of the Factories Act 1948 or OISD guidelines. Highlight strict legal limits (e.g. oxygen levels, LFL percentages, CO/H2S levels).\n"
            "3. Preemptive Safety Recommendations: List the mandatory actions safety teams must execute immediately to mitigate hazard propagation and ensure compliance.\n\n"
            "Format your response cleanly in markdown. Be concise, authoritative, and cite specific rules/incidents."
        )

        # 2. Generate response via OpenRouter
        if self.openrouter_api_key:
            answer_text = self._call_openrouter(prompt)
            if answer_text:
                return {
                    "answer": answer_text,
                    "sources": sources_list,
                    "mode": self.mode
                }
            logger.error("OpenRouter query failed. Falling back to rule-based fallback engine.")

        # Rule-based fallback if offline / key missing / API failed
        answer = self._generate_rule_based_fallback_response(user_query, hits, hard_violations)
        return {
            "answer": answer,
            "sources": sources_list,
            "mode": "Rule-Based Engine (Local Fallback)"
        }

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
        """
        # Hard legal limit comparisons (Factories Act Sec 36, OISD standards)
        hard_violations = []
        o2 = telemetry.get("o2", 20.9)
        co = telemetry.get("co", 0)
        ch4 = telemetry.get("ch4_lfl", 0)
        h2s = telemetry.get("h2s", 0)
        
        if o2 is not None:
            if o2 < 19.5:
                hard_violations.append(f"CRITICAL OXYGEN DEFICIENCY: Level is {o2}% (Statutory minimum: 19.5% per Factories Act Sec 36). Asphyxiation hazard.")
            elif o2 > 23.5:
                hard_violations.append(f"OXYGEN ENRICHED ATMOSPHERE: Level is {o2}% (Statutory limit: 23.5%). High flammability risk.")
                
        if co is not None and co > 25:
            if co >= 50:
                hard_violations.append(f"CRITICAL TOXIC GAS ALARM (CO): Carbon Monoxide is {co} ppm (OSHA Evacuation limit: 50 ppm, OISD-137 exceedance).")
            else:
                hard_violations.append(f"TOXIC GAS WARNING (CO): Carbon Monoxide is {co} ppm (OSHA PEL: 25 ppm). Wear respirators.")
                
        if ch4 is not None and ch4 >= 4.0:
            hard_violations.append(f"CRITICAL FLAMMABILITY REACHED (CH4): Methane is {ch4}% LFL (Limit: 4.0% LFL per OISD-STD-105). Banned spark-producing hot work.")
            
        if h2s is not None and h2s >= 10.0:
            hard_violations.append(f"CRITICAL TOXIC HAZARD (H2S): Hydrogen Sulfide is {h2s} ppm (OISD limit: 10 ppm). Fatal exposure potential.")

        # Compile a text scenario description from the live status
        permit_types = [p.get("permit_type", "") for p in permits if p.get("status", "").lower() == "active"]
        
        scenario_description = (
            f"Audit telemetry in zone '{zone}':\n"
            f"Sensors: O2={telemetry.get('o2')}%, CO={telemetry.get('co')} ppm, CH4 LFL={telemetry.get('ch4_lfl')}%, H2S={telemetry.get('h2s')} ppm.\n"
            f"Active Permits: {', '.join(permit_types) if permit_types else 'None'}.\n"
            f"Operational status: Maintenance Active = {maintenance_active}, Shift Changeover Active = {shift_changeover}.\n"
        )
        
        # Query the RAG agent
        rag_response = self.query(
            f"Identify compliance deviations or past precedents for the following plant status: {scenario_description}",
            hard_violations=hard_violations
        )
        return rag_response

    def _generate_rule_based_fallback_response(self, query: str, hits: List[Dict[str, Any]], hard_violations: List[str] = None) -> str:
        """Generates a highly structured, readable fallback analysis utilizing the retrieved context."""
        query_lower = query.lower()
        
        # Check if the query is a simple greeting or general smalltalk
        greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "howdy", "status"]
        is_greeting = any(g in query_lower.split() for g in greetings) or query_lower.strip() in ("hello", "hi", "hey")
        
        if is_greeting:
            return (
                "### 👋 Hello! I am your ZeroHarm Safety Intelligence Assistant.\n\n"
                "I am connected to the refinery safety database containing regulations such as the **Factories Act 1948**, "
                "**OISD safety standards**, and historical plant incident records.\n\n"
                "I am currently running in offline fallback mode using rule-based compliance auditing. You can query me about:\n"
                "- 📜 **Confined space safety** (Section 36 guidelines, oxygen level limits)\n"
                "- 🔥 **Hot Work permits** (OISD-STD-105 standard, methane flammability limits)\n"
                "- 👷 **PPE guidelines** (Working at heights, safety harnesses, gas masks)\n"
                "- 📈 **Carbon Monoxide alarms** (safe exposure limits, ventilation rules)\n\n"
                "How can I assist you with safety protocols today?"
            )
            
        # Analyze query categories
        has_confined = "confined" in query_lower or "sinter" in query_lower or "o2" in query_lower or "oxygen" in query_lower
        has_hotwork = "hot work" in query_lower or "welding" in query_lower or "ch4" in query_lower or "methane" in query_lower or "coke" in query_lower
        has_co = "co" in query_lower or "carbon monoxide" in query_lower or "gas leak" in query_lower
        has_maint = "maintenance" in query_lower or "changeover" in query_lower or "handover" in query_lower
        has_height = "height" in query_lower or "ppe" in query_lower or "harness" in query_lower or "scaffold" in query_lower or "fall" in query_lower or "equipment" in query_lower
        has_ammonia = "ammonia" in query_lower or "h2s" in query_lower or "chemical" in query_lower
        has_loto = "loto" in query_lower or "electrical" in query_lower or "lockout" in query_lower or "tagout" in query_lower
        
        response = (
            "### 🛡️ ZeroHarm AI Safety & Compliance Audit\n\n"
            "> [!NOTE]\n"
            "> This analysis is generated using local rule-based intelligence (LLM fallback mode). "
            "To unlock fully custom generative reasoning, configure a valid `OPENROUTER_API_KEY` in your `.env` file.\n\n"
        )
        
        # Part 1: Precedent Analysis
        response += "#### 1. 🕒 Historical Precedents & Near-Miss Lookup\n"
        precedent_found = False
        
        if has_hotwork or ("coke oven" in query_lower):
            precedent_found = True
            response += (
                "- **Sinter Plant Welding Fire (Nov 2024)**: A flash fire occurred when sub-critical methane leakage drifted into a hot work welding area. "
                "The incident occurred due to neglecting OISD-STD-105 work permit limits (hot work allowed while flammability > 4% LFL).\n"
            )
        if has_co or has_maint or ("coke oven" in query_lower):
            precedent_found = True
            response += (
                "- **Coke Oven CO Poisoning Case (April 2025)**: General maintenance overlapping with a shift changeover led to communication failure, valve unseating, "
                "and a toxic CO spike to 85 ppm, resulting in two worker injuries. Violates Factories Act Sec 36 due to lack of a safety watch.\n"
            )
        if has_confined or ("sinter plant" in query_lower):
            precedent_found = True
            response += (
                "- **Sinter Plant Confined Space Entry logs**: Past audits indicate high compliance checks are required in this zone, "
                "specifically checking oxygen levels before entry to prevent asphyxiation traps.\n"
            )
        if has_height:
            precedent_found = True
            response += (
                "- **Ammonia Storage Tank Scaffold Incident (Oct 2025)**: A maintenance technician was observed working at heights on a scaffold without a double lanyard safety harness "
                "or appropriate fall protection gear. The work was halted for safety re-briefing.\n"
            )
        if has_ammonia:
            precedent_found = True
            response += (
                "- **Ammonia Tank Valve Leak (Dec 2024)**: A gasket failure on the primary discharge line led to high H2S concentrations (35 ppm). "
                "Emergency evacuation was completed successfully with no injuries due to early detector alarm triggering.\n"
            )
        if has_loto:
            precedent_found = True
            response += (
                "- **Substation B Maintenance Flashover (June 2025)**: A technician initiated breaker service without verifying lockout/tagout isolation, causing a partial short circuit. "
                "Violated safety procedures due to lack of a physical padlock isolation on the switchgear panel.\n"
            )
            
        if not precedent_found:
            response += (
                "- **No direct matching historical incidents found** in the active regulatory database for this query. "
                "Try rephrasing your search around a specific hazard (e.g. gas leak, height fall), permit type (e.g. Hot Work, Confined Space), or active zone (e.g. Coke Oven, Sinter Plant, Ammonia Tank).\n"
            )
            
        # Part 2: Compliance Deviations
        response += "\n#### 2. 📜 Statutory Compliance & Regulatory Audit\n"
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
            
        if deviations:
            for dev in deviations:
                response += f"- ❌ {dev}\n"
        else:
            response += (
                "- ℹ️ **No compliance deviations identified** for this general query. "
                "Please specify concrete telemetry parameters (e.g. O2 levels, CO concentration, H2S ppm) or operational states to perform a statutory compliance check.\n"
            )
            
        # Part 3: Actions
        response += "\n#### 3. 🚨 Preemptive Safety Recommendations\n"
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
            
        # Default fallback recommendations if no specific category matched
        if not recs:
            recs.append("**Specify operational parameters**: Provide specific telemetry readings or active work permits to generate safety recommendations.")
            recs.append("**Consult Safety Manuals**: Review raw standards under the Documents tab to search for relevant regulatory frameworks.")
            recs.append("**Verify PPE & Equipment**: Always verify baseline personal protective equipment (PPE) requirements for your work zone.")

        for i, rec in enumerate(recs):
            response += f"{i+1}. {rec}\n"
            
        # Part 4: Context Sources
        response += "\n\n---"
        response += "\n**Retrieved RAG Chunks:**\n"
        for hit in hits:
            response += f"- *{hit['title']}* (Source: `{hit['source']}`, Semantic Score: `{hit['score']}`)\n"
            
        return response
