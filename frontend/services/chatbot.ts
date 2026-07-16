export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const MOCK_ANSWERS: Record<string, string> = {
  'valve': `### OISD Guidelines for Relief Valve Calibration (OISD-STD-150)

Based on section **5.3 of OISD-STD-150**, here are the mandatory calibration and testing cycles for safety relief valves in petroleum and chemical refineries:

1. **Mandatory Cycles**:
   - All safety valves in clean service must be calibrated and tested once every **12 months**.
   - Valves in fouling, corrosive, or high-temperature service must be serviced every **6 months**.
2. **Pre-Test Inspection**:
   - Visual inspection of the spindle, spring, and nozzle.
   - Accumulation tests must verify lift clearances.
3. **Documentation**:
   - Certificate of calibration must record: *Cold Differential Test Pressure (CDTP)*, set pressure, and reseating pressure.

> [!WARNING]
> Failing to maintain calibration logs compromises plant compliance ratings and triggers automatic DGMS audit failure alerts.`,

  'leak': `### DGMS Gas Leak Reporting & Containment Directives

Under the **DGMS (Directorate General of Mines Safety) circulars**, handling a hazardous gas leak (e.g., LPG, Methane, or H2S) requires the following response standard:

1. **Immediate Operations**:
   - Initiate manual/automatic **Emergency Shutdown (ESD)**.
   - Engage water spray deluge system to dilute gas plume.
   - Declare local plant emergency and sound the sirens.
2. **Regulatory Reporting**:
   - Report orally to the **Regional Inspector of Mines** within **2 hours** of detection.
   - Submit written notification (Form I-A) to the District Magistrate and DGMS head office within **24 hours**.
3. **Safety Boundaries**:
   - Isolate all electrical zones within **30 meters** of the leak area (Zone 1 and Zone 2 classification).`,

  'ppe': `### Standard PPE Guidelines for High-Risk Zones

As per the **Factory Act (Section 36) & OISD guidelines**, working in active zones requires distinct gear:

| Category | Standard Equipment | Regulation Code |
| :--- | :--- | :--- |
| **High Temp / Surge** | Flame Resistant Suit (FRC) | IS 15071 |
| **Vapor / Gas Leak** | SCBA (Self-Contained Breathing App) | EN 137 |
| **Fall / Height** | Double Lanyard Safety Harness | IS 3521 |
| **Chemical Zone** | Nitrile splash gloves & face shield | EN 374 |

> [!TIP]
> Ensure all PPE fits securely. Inspect harnesses for webbing wear before entering the hoisting cage.`
};

export const chatbotService = {
  sendMessage: async (message: string): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const query = message.toLowerCase();
        
        if (query.includes('valve') || query.includes('calibration') || query.includes('oisd')) {
          resolve(MOCK_ANSWERS.valve);
        } else if (query.includes('leak') || query.includes('gas') || query.includes('dgms')) {
          resolve(MOCK_ANSWERS.leak);
        } else if (query.includes('ppe') || query.includes('harness') || query.includes('height')) {
          resolve(MOCK_ANSWERS.ppe);
        } else {
          resolve(`### ZeroHarm Safety Intelligence Report

I've scanned the active safety database and regulatory indexes for: *"${message}"*.

1. **System Check**:
   - Database checked: OISD, DGMS, and Factory Act manuals.
   - Active site check: Plant A, B, and C telemetry logs.
2. **Summary**:
   - The query falls under *General Industrial Site Operations*.
   - Make sure to review active site permits before performing operations.
3. **Recommendation**:
   - Consult your site safety manager for specific field instructions.
   - For gas detection or relief valve protocols, try asking: *"What are the OISD guidelines for relief valve calibration?"*`);
        }
      }, 1000);
    });
  }
};
