### 1. 📷 Missing Telemetry: CCTV & Computer Vision Analytics (Highly Stressed  
  in Brief)
  • The Gap: The problem statement calls for fusing "data from IoT sensors, SCADA
  systems, permit-to-work logs, CCTV feeds, and shift records". Right now, your
  backend in main.py ingests gas, temperature, pressure, and permits, but
  completely lacks Computer Vision (CV) telemetry.
  • Impact: You cannot detect physical unsafe acts (e.g., workers entering a zone
  without a safety harness, lack of helmets, or smoking/sparks in a hot-work zone).
  • How to fix in the Backend:
      • Add a Pydantic model for CV events: CCTVAlert (fields: zone, event_type
      like "no_ppe", "smoke_detected", "unauthorized_entry", confidence).
      • Add a receiver endpoint POST /api/cctv/event to handle incoming CCTV
      stream metadata.
      • Wire these events into rules.py so a "no_ppe" event during active
      maintenance immediately escalates the zone's risk score.
  ──────
  ### 2. 🕸️ Missing Architecture: Knowledge Graphs for Plant Topology
  • The Gap: The Suggested Technologies section recommends using Knowledge Graphs
  to model equipment-permit-risk relationships. Currently, your adjacency checking
  in rules.py calculates a static geometric distance.
  • Impact: In industrial plants, zones are connected by physical systems (e.g.,
  pipes, vents, electrical grids). A gas leak in Sinter Plant A doesn't just drift
  spherically; it travels along connected pipelines.
  • How to fix in the Backend:
      • Implement an in-memory directed graph using Python's networkx library to
      represent the plant's topology (e.g., Blast Furnace A -> downstream -> Coke
      Oven Pipe B).
      • Use the graph to calculate cascading risk scores: if a toxic leak occurs,
      propagate warning scores to adjacent vertices in the process graph, even if
      they are physically far apart.

  ──────
  ### 3. 💾 Person A: Lack of ML Model Serialization & Temporal Analysis

  • The Gap (Persistence): The CompoundRiskMLModel in ml_anomaly.py generates
  synthetic data and trains the random forest classifier on startup. If the server
  crashes or restarts, it takes several seconds to rebuild and retrain, causing
  data loss.
      • How to fix: Use joblib or pickle to serialize the trained models to the
      filesystem and load them automatically on startup if the files exist.
  • The Gap (Temporal/Time-Series Features): Telemetry checking in rules.py is
  purely instantaneous. Industrial disasters (like the Visakhapatnam gas
  entrapment) are characterized by pressure and gas accumulation over time (rate
  of change).
      • How to fix: Maintain a moving buffer of the last 5 telemetry frames in
      main.py and calculate rate-of-change metrics (d[CO]/dt) to pass to the rules
      engine.

  ──────
  ### 4. 🗃️ Person B: Missing Evacuation Evidence Preservation ("Black Box        
  Logging")

  • The Gap: The problem statement specifies that the Emergency Response
  Orchestrator must preserve sensor evidence during a confirmed trigger. Currently,
  your evacuation.py generates a text narrative but does not archive the raw data.
  • Impact: Post-accident investigations require tamper-proof SCADA history.
  • How to fix in the Backend:
      • Add a helper function in incident_report.py that extracts the preceding
      10-minute sensor logs for the affected zone from /api/risk-history and dumps
      it into a sealed, read-only JSON file (representing a "Flight Data Recorder"
      block).

  ──────
  ### 5. 📑 Person C: Local Keyword RAG vs. True Semantic Vector Retrieval

  • The Gap (Semantic Search): The ZeroHarmVectorStore in vector_store.py uses a
  local TfidfVectorizer (TF-IDF). It requires exact keyword matches. If you search
  for "gas asphyxiation", it will miss safety documents mentioning "oxygen
  deprivation" or "suffocation in enclosed ducts" due to lack of keyword overlap.
      • How to fix: Upgrade the search to use local embeddings (e.g., using
      sentence-transformers via a script or a package like sqlite-vec/chromadb) or
      run embedding API requests if an external key is present.
  • The Gap (Dynamic Document Ingestion): All statutory manuals are hardcoded in
  documents.py.
      • How to fix: Write an upload endpoint (POST /api/rag/upload-document) that
      receives a .txt or .pdf file, chunks it, vectorizes it, and appends it to
      the store.

  ──────
  ### 🎟️ 6. Person C & D: Missing Auto-Generated Actionable Workflows

  • The Gap: The problem statement requires the compliance audit agent to
  "generate corrective action workflows automatically". Currently, your compliance
  agent agent.py returns a markdown report with recommendations, but no workflow
  tracking exists.
  • Impact: Safety officers need digital, status-tracked action items (e.g.,
  "Schedule ventilation check," "Inspect sensor calibration," "Re-run toolbox
  talk").
  • How to fix in the Backend:
      • Create a database table/in-memory list representing safety tickets:
      SafetyWorkflow (fields: id, incident_id, task_description, assigned_role
      like "Maintenance Engineer", status like "Pending"/"Completed",
      required_signoff_role like "Safety Officer").
      • Update generate_report in incident_report.py to automatically parse
      compliance recommendations and output structured workflow tasks that can be
      fetched, updated, and closed out by frontend users.