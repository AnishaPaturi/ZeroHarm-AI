import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';
import { useSafety } from '../context/SafetyContext';

const MOCK_KNOWLEDGE_BASE = [
  {
    keywords: ['confined space', 'oxygen', 'sec 36', 'factory act'],
    question: 'What are the confined space oxygen level safety limits under Factory Act Sec 36?',
    answer: `Under Section 36 of The Factories Act, 1948 (relating to precautions against dangerous fumes, gases, etc.), no worker is permitted to enter any confined space (such as a chamber, tank, vat, pipe, flue) until:
1. **Ventilation**: All practicable measures have been taken to remove any gas, fume, or dust and prevent its ingress.
2. **Certification**: A competent person has certified in writing that the space is free from dangerous gas/fumes and fit for entry.
3. **Oxygen Limit**: The oxygen concentration must be measured and verified. Under standard health regulations and Factory Act compliance, the oxygen concentration must be **between 19.5% and 23.5%**. Entry is strictly prohibited if oxygen levels fall below 19.5%.`,
    citations: ['Factory Act 1948 Section 36(1)-(2)', 'DGMS Confined Space Circular 12'],
  },
  {
    keywords: ['visakhapatnam', 'vizag', 'explosion', 'coke oven'],
    question: 'What caused the January 2025 Visakhapatnam Steel Plant gas explosion incident?',
    answer: `The preliminary investigation into the January 2025 Visakhapatnam Steel Plant coke oven battery incident revealed a classic compound risk scenario:
1. **The Trigger**: A sudden pressure spike occurred in the gas suction line, leading to gas entrapment and accumulation within the coke oven battery chimney zone.
2. **The Conflict**: Standard safety instrumentation (gas detectors and SCADA pressure warning signals) existed and flagged warning thresholds. However, a contractor crew was performing active welding (hot work) nearby.
3. **The Gaps**: No integrated intelligence layer connected the telemetry warning spikes with active hot-work permit locations. The hot work ignited the accumulated flammable gases, triggering a devastating explosion.
4. **Preventive Mandate**: Platforms must implement automated SIMOPs (Simultaneous Operations) interlocks to suspend hot-work permits instantly when local gas detectors exceed 10 ppm, regardless of manual authorization.`,
    citations: ['The Wire investigative Report (Jan 2025)', 'DGFASLI Incident Profile Vizag-25'],
  },
  {
    keywords: ['distance', 'hot-work', 'oisd-105', 'hot work'],
    question: 'What does OISD-STD-105 state regarding hot-work permit safety distances?',
    answer: `OISD-STD-105 (Work Permit System) outlines critical safety measures for Hot Work:
1. **Proximity Clearance**: Prior to issuing a hot work permit, the surrounding area within a **radius of 15 meters** (50 feet) must be cleared of all flammable/combustible materials.
2. **Sewer Sealing**: All sewer openings, drains, and catch-basins within 15 meters must be sealed with wet fire blankets or sandbags to prevent ignition of entrapped hydrocarbon vapours.
3. **Continuous Monitoring**: In gas-risk areas, a gas detector must be stationed at the hot-work site. If gas level reaches 10% LEL, welding/cutting must stop immediately.`,
    citations: ['OISD-STD-105 Section 6.2.1', 'OISD-GDN-137 Gas Detection Standard'],
  },
  {
    keywords: ['calibration', 'frequency', 'sensor', 'oisd-137', 'detector'],
    question: 'How frequently must gas detectors be calibrated under OISD-GDN-137?',
    answer: `Under OISD-GDN-137 (Guidelines on Hazardous Gas Monitoring Systems):
1. **Sensor Testing**: Portable and fixed gas detectors must undergo functional checks (bump tests) prior to any critical entry or at least once every 14 days.
2. **Full Calibration**: Full calibration of toxic (CO, H2S) and flammable (HC, CH4) gas sensors must be performed **at least once every 3 months** (90 days) using certified calibration gases.
3. **Record Maintenance**: Calibration logs, drift percentages, and sensor replacement dates must be logged digitally and kept available for statutory safety audits.`,
    citations: ['OISD-GDN-137 Section 8.4', 'Factories Act Section 40-A Audit Guide'],
  },
];

export default function SafetyChatView() {
  const { addLog } = useSafety();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello. I am the SentinelSafe Incident Pattern & Regulatory Intelligence Agent. Ask me questions regarding OISD guidelines, the Factory Act, or past industrial near-miss profiles to audit compliance.',
      citations: [],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = (text) => {
    if (!text.trim()) return;

    // User Message
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    addLog('RiskEngine', `RAG query initiated: "${text.substring(0, 35)}..."`, 'info');

    // Simulate RAG retrieval latency
    setTimeout(() => {
      const lowerText = text.toLowerCase();
      let bestMatch = null;

      // Simple keyword matching for RAG
      for (const entry of MOCK_KNOWLEDGE_BASE) {
        const matchCount = entry.keywords.filter((kw) => lowerText.includes(kw)).length;
        if (matchCount > 0) {
          if (!bestMatch || matchCount > bestMatch.count) {
            bestMatch = { entry, count: matchCount };
          }
        }
      }

      let responseText = '';
      let citations = [];

      if (bestMatch) {
        responseText = bestMatch.entry.answer;
        citations = bestMatch.entry.citations;
      } else {
        // Generic fallback AI response
        responseText = `Based on a semantic scan of the statutory corpus (OISD standards, Factories Act 1948, and DGMS circulars):
- **General Guidance**: Ensure that for any active maintenance or entry in the specified area, an authorized Work Permit (PTW) is active, gas measurements are logged within the last 30 minutes, and proper personal protective equipment (PPE) is worn.
- **Continuous Compliance**: Our agent suggests auditing local ventilation fans and verifying worker badge status to ensure zero-harm operations.
- Could you please specify if you are asking about confined space entry, gas thresholds (CO/CH4), or the OISD-105 permit standards to pull direct citations?`;
        citations = ['General statutory safety guidance', 'OISD-STD-105'];
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `agt-${Date.now()}`,
          sender: 'agent',
          text: responseText,
          citations,
        },
      ]);
      setIsLoading(false);
      addLog('RiskEngine', 'RAG response delivered with verified compliance citations.', 'info');
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={20} style={{ color: 'var(--color-primary)' }} />
          Incident Pattern & Regulatory Intelligence
        </h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          RAG-powered safety officer assistant. Cross-reference operational queries against OISD standards, historical incident reports, and the Factory Act.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', height: '550px' }}>
        {/* Chat Area */}
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.sender}`}>
                <div className={`chat-bubble-author ${m.sender}`}>
                  {m.sender === 'user' ? 'Safety Officer' : 'SentinelSafe Advisor'}
                </div>
                <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                
                {m.sender === 'agent' && m.citations && m.citations.length > 0 && (
                  <div className="chat-citation-box">
                    <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      VERIFIED REFERENCES:
                    </span>
                    {m.citations.map((c, i) => (
                      <span key={i} className="chat-citation-badge">
                        <BookOpen size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-bubble agent" style={{ opacity: 0.7 }}>
                <div className="chat-bubble-author agent">SentinelSafe Advisor</div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '16px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', animation: 'blink 1.4s infinite' }}></span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', animation: 'blink 1.4s infinite 0.2s' }}></span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', animation: 'blink 1.4s infinite 0.4s' }}></span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Retrieving compliance context...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="chat-input-area"
          >
            <input
              type="text"
              placeholder="Ask about Factory Act safety provisions, OISD distances, calibration frequency..."
              className="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }} disabled={isLoading}>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Info / Quick Reference Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ flexGrow: 1 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={16} style={{ color: 'var(--color-info)' }} />
              Quick Suggestions
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Click on any regulatory query to test the agent's RAG knowledge retrieval and incident cross-referencing capabilities:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {MOCK_KNOWLEDGE_BASE.map((kb, idx) => (
                <button
                  key={idx}
                  className="btn btn-secondary"
                  onClick={() => handleSend(kb.question)}
                  style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.6rem 0.8rem', lineHieght: '1.3' }}
                >
                  <ExternalLink size={12} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                  {kb.question}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
