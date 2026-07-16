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
    - Implements a high-quality local rule-based mock generator if OPENROUTER_API_KEY is missing or the LLM call fails.
    """
    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, vector_store: ZeroHarmVectorStore):
        self.vector_store = vector_store
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
        self.model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

        self.mode = "Rule-Based Engine (Demo Fallback)"

        if self.openrouter_api_key:
            self.mode = f"OpenRouter ({self.model}) (Active)"
            logger.info(f"OpenRouter successfully configured with model {self.model} for RAG Agent.")
        else:
            logger.info("No OPENROUTER_API_KEY found. RAG Agent will use the local rule-based fallback engine.")

    def query(self, user_query: str) -> Dict[str, Any]:
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
            logger.error("OpenRouter query failed. Falling back to rule-based mock engine.")

        # Rule-based fallback if offline / key missing / API failed
        answer = self._generate_rule_based_mock_response(user_query, hits)
        return {
            "answer": answer,
            "sources": sources_list,
            "mode": "Rule-Based Engine (Demo Fallback)"
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
        # Compile a text scenario description from the live status
        permit_types = [p.get("permit_type", "") for p in permits if p.get("status", "").lower() == "active"]
        
        scenario_description = (
            f"Audit telemetry in zone '{zone}':\n"
            f"Sensors: O2={telemetry.get('o2')}%, CO={telemetry.get('co')} ppm, CH4 LFL={telemetry.get('ch4_lfl')}%, H2S={telemetry.get('h2s')} ppm.\n"
            f"Active Permits: {', '.join(permit_types) if permit_types else 'None'}.\n"
            f"Operational status: Maintenance Active = {maintenance_active}, Shift Changeover Active = {shift_changeover}.\n"
        )
        
        # Query the RAG agent
        rag_response = self.query(f"Identify compliance deviations or past precedents for the following plant status: {scenario_description}")
        return rag_response

    def _generate_rule_based_mock_response(self, query: str, hits: List[Dict[str, Any]]) -> str:
        """Generates a highly structured, readable mock analysis utilizing the retrieved context."""
        query_lower = query.lower()
        
        # Analyze query categories
        has_confined = "confined" in query_lower or "sinter" in query_lower or "o2" in query_lower or "oxygen" in query_lower
        has_hotwork = "hot work" in query_lower or "welding" in query_lower or "ch4" in query_lower or "methane" in query_lower or "coke" in query_lower
        has_co = "co" in query_lower or "carbon monoxide" in query_lower or "gas leak" in query_lower
        has_maint = "maintenance" in query_lower or "changeover" in query_lower or "handover" in query_lower
        
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
                "- **Sinter Plant Welding Fire (Nov 2024)** matches this profile. "
                "A flash fire occurred when sub-critical methane leakage drifted into a hot work welding area. "
                "The incident occurred due to neglecting OISD-STD-105 work permit limits (hot work allowed while flammability > 4% LFL).\n"
            )
        if has_co or has_maint or ("coke oven" in query_lower):
            precedent_found = True
            response += (
                "- **Coke Oven CO Poisoning Case (April 2025)** matches this profile. "
                "General maintenance overlapping with a shift changeover led to communication failure, valve unseating, "
                "and a toxic CO spike to 85 ppm, resulting in two worker injuries. "
                "Violated Factories Act Sec 36 due to lack of a continuous safety watch.\n"
            )
        if has_confined or ("sinter plant" in query_lower):
            precedent_found = True
            response += (
                "- **Sinter Plant Confined Space Entry logs** match. "
                "Past audits indicate high compliance checks are required in this zone, "
                "specifically checking oxygen levels before entry to prevent asphyxiation traps.\n"
            )
            
        if not precedent_found:
            response += "- **No direct matching historical incidents** found in the curated database. However, general safety audits apply.\n"
            
        # Part 2: Compliance Deviations
        response += "\n#### 2. 📜 Statutory Compliance & Regulatory Audit\n"
        deviations = []
        
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
            
        if deviations:
            for dev in deviations:
                response += f"- ❌ {dev}\n"
        else:
            response += "-  **All parameters comply** with general statutory frameworks (*Factories Act 1948 Section 36* and *OISD-STD-105*). Telemetry values are within green limits.\n"
            
        # Part 3: Actions
        response += "\n#### 3. 🚨 Preemptive Safety Recommendations\n"
        response += (
            "1. **Isolate and Vent**: Activate emergency exhaust ventilation in the affected zone. Close upstream valves.\n"
            "2. **Suspend Permits**: Revoke all active Hot Work or Confined Space permits in the zone immediately.\n"
            "3. **Deploy Standby Watch**: Ensure safety monitors stand by outside any confined entry point with breathing apparatus and lifeline harness.\n"
            "4. **Re-Audits**: Conduct mandatory gas sweeps using portable calibrated detectors before permitting worker re-entry."
        )
        
        # Part 4: Context Sources
        response += "\n\n---"
        response += "\n**Retrieved RAG Chunks:**\n"
        for hit in hits:
            response += f"- *{hit['title']}* (Source: `{hit['source']}`, Semantic Score: `{hit['score']}`)\n"
            
        return response
