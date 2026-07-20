  ### 1. 🤝 Multi-Agent Collaborative Reasoning

  • Backend: Implemented in collaborative_reasoning.py under the collaborative_reasoning.py class. It triggers a 3-round
  safety debate script between 6 distinct domain agents: Gas Agent, Maintenance Agent, Permit Agent, Weather Agent, CCTV
  Agent, and Safety Coordinator Agent.
  • Frontend: Visualized under the Committee Discussion Feed section in the main dashboard (page.tsx).

  ### 2. ⏳ Predictive Timeline Simulation

  • Backend: Implemented in predictive_timeline.py under the predictive_timeline.py class. It projects chronological
  threat events (e.g. at 5, 10, 15, 20 minutes) if current telemetry continues unchecked.
  • Frontend: Renders as an interactive chronological checklist/stepper inside the safety control dashboard (page.tsx).

  ### 3. 🌐 Industrial Digital Twin

  • Backend: Manages spatial classifications in heatmap.py.
  • Frontend: Visualized as a dynamic 2D canvas in page.tsx. It dynamically shifts zone colors (Green → Yellow → Orange →
  Red), maps moving gas clouds, handles real-time worker tracking trails, highlights overheating process equipment, and
  indicates blocked emergency exits.

  ### 4. 🧠 Explainable AI Risk Reasoning

  • Backend: Calculated inside the rules engine rules.py. It breaks down the composite risk score into specific factors
  and assigns individual weight and contribution percentage values.
  • Frontend: Visualized as horizontal factor breakdown bars in the near-miss dashboard (page.tsx).

  ### 5. ⚠️ Near Miss Prediction

  • Backend: Implemented in near_miss_predictor.py under the near_miss_predictor.py class. It tracks unauthorized entries,
  computes acceleration logs of worker violations, and outputs shift-ahead probabilities.
  • Frontend: Rendered inside a dedicated Near-Miss Prediction cockpit (page.tsx).

  ### 6. 👟 AI Safety Coach

  • Backend: Implemented in safety_coach.py under the safety_coach.py class. Deducts points from a 100-point profile
  baseline for PPE infractions and restricted zones, outputting customized corrective recommendations.
  • Frontend: Displayed as individual worker coach profiles in page.tsx.

  ### 7. 🕸️ Dynamic Risk Graph (Knowledge Graph)

  • Backend: Built using the networkx library in graph.py under the graph.py class. Walks and reasons across
  interconnected nodes (Worker → Machine → Zone → Sensor → Permits).
  • Frontend: Renders the active graph and traverse paths dynamically using SVG in page.tsx and KnowledgeGraph.tsx.

  ### 8. 🔍 AI Root Cause Generator

  • Backend: Automated in incident_report.py and agent.py (RAG Compliance auditor). It identifies regulatory deviations,
  human factors, and recommends corrective workflows.
  • Frontend: Displayed inside the Case File Dossier view of the Incident Desk (page.tsx), which triggers compliance audit
  RCA logs.

  ### 9. 📈 Risk Propagation Engine

  • Backend: Implemented in topology.py under the topology.py class. Traces valve structural pipelines to calculate how
  pressure changes propagate to adjacent plant modules. Tested under test_topology.py.

  ### 10. 💤 Fatigue Detection

  • Backend: Computed in safety_coach.py within the _recalculate_fatigue function, evaluating hours worked, shift limits,
  and night-shift multipliers.
  • Frontend: Displayed on the worker safety profile cards inside the Safety Coach dashboard (page.tsx).

  ### 11. 📝 AI Shift Handover Summary

  • Backend: Implemented in handover.py under the handover.py class. Auto-summarizes active permits, alerts, maintenance
  actions, and risk areas.
  • Frontend: Exposed on the Shift Handover page (page.tsx).

  ### 12. 👮 Regulatory Copilot

  • Backend: Handled by agent.py in agent.py. It queries a local vector store containing the Factories Act 1948, OISD
  standards, and accident files.
  • Frontend: Provided as an interactive chat panel in page.tsx.

  ### 13. 🚨 Autonomous Emergency Commander

  • Backend: Orchestrated inside evacuation.py and alert_channels.py. Suspends permits, seals valves, triggers sirens,
  alerts crews, sends SMS, and archives evidence under backend/data/evidence/ when critical triggers occur.

  ### 14. 🗺️ Spatial AI

  • Backend: Calculated in heatmap.py and the permit compliance checks in agent.py. Overlaps worker positions and welding
  operations dynamically with sub-threshold gas concentrations.

  ### 15. 💾 Learning Risk Memory

  • Backend: Implemented in learning_risk_memory.py under the learning_risk_memory.py class. Adjusts the risk calculations
  in rules.py based on learned parameters such as "Monday Morning Restart Anomalies", "Friday Handover Rush", "Night shift
  fatigue bias", and cooling capacity during seasonal spikes.

  ### 16. 🛸 Autonomous Drone Inspection

  • Backend: Managed in drone.py under the drone.py class.
  • Frontend: Integrated inside the Industrial Digital Twin dashboard (page.tsx). Dispatching a drone launches a visual
  sweep on the SVG canvas, returning thermal imaging, workers seen, and sniffing payloads.

  ### 17. 💬 Natural Language Query Engine

  • Backend: Parsed using NLP regex and token patterns in query_engine.py under the query_engine.py class. Filters
  database records and formats charts, heatmap highlights, and checklists without SQL.

  ### 18. 🧬 Risk Memory using RAG + Knowledge Graph

  • Backend: Fused in hybrid_reasoner.py under the hybrid_reasoner.py class. Evaluates Equipment, Weather, Maintenance,
  and Root Cause similarity by mapping graph node edges to text RAG document segments.

  ### 19. 🤖 Plant Safety GPT

  • Backend: Handles conversational permit rejections/approvals in agent.py and the RAG safety agent agent.py. Checks gas
  concentrations, maintenance status, isolations, and certification before outputting compliance-based decisions.

  ### 20. 🔄 Self-Improving AI Agents

  • Backend: Controlled in feedback_engine.py under the feedback_engine.py class. Modifies agent confidence coefficients
  inside collaborative_reasoning.py in response to safety supervisor overrides.