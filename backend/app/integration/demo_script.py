"""
Person D — demo scenario ("storyteller" half of the role).

Returns a scripted, ordered walkthrough of the ZeroHarm AI platform tuned to
the Coke Oven Battery 1 escalation already baked into Person A/B's
`/api/simulate/tick` cycle (cycle indices 0->1->3->4->5). Presenters can call
`/api/simulate/tick` repeatedly and narrate each step using this script for
the demo video, or read it standalone as the storyline for the pitch deck.
"""
from .models import DemoStep, DemoScenarioResponse

_STEPS = [
    DemoStep(
        step=1, agent="Person A",
        title="Baseline: all zones green",
        endpoint="GET /api/state",
        description=(
            "Coke Oven Battery 1 is running a routine Hot Work permit. Gas readings are nominal. "
            "Composite risk score is low (~5-15) with 'ROUTINE MONITORING' as the action."
        ),
    ),
    DemoStep(
        step=2, agent="Person A",
        title="Early anomaly: CO creeping up",
        endpoint="POST /api/simulate/tick",
        description=(
            "CO climbs to 28 ppm. The rules engine + ML anomaly model raise the composite score into "
            "'Warning'. This is the moment DGFASLI-style incidents are usually still recoverable — "
            "the sensor data existed but nothing acted on it yet."
        ),
    ),
    DemoStep(
        step=3, agent="Person D",
        title="Permit Intelligence Agent starts watching",
        endpoint="POST /api/permits/audit  {\"zone\": \"Coke Oven Battery 1\"}",
        description=(
            "The active Hot Work permit (PTW-2026-001) is cross-checked against the rising CH4/CO "
            "readings. Below the critical threshold it's still 'clean', but the agent is already "
            "polling — this is the compound-risk layer the brief calls out as missing in real plants."
        ),
    ),
    DemoStep(
        step=4, agent="Person A + Person D",
        title="Methane spikes: Hot Work + Flammable Gas overlap",
        endpoint="POST /api/simulate/tick  (cycle 3-4)",
        description=(
            "CH4 crosses 4% LFL while PTW-2026-001 (Hot Work) is still active in the same zone. "
            "Person A's rules engine scores this a compound 'Hot Work Flammable Gas Overlap' critical "
            "factor. Person D's agent independently flags PTW-2026-001 for suspension citing "
            "OISD-STD-105 by permit ID — the two agents agree without sharing code."
        ),
    ),
    DemoStep(
        step=5, agent="Person B",
        title="Heatmap turns red, evacuation triggers",
        endpoint="GET /api/heatmap , GET /api/evacuations",
        description=(
            "Composite score crosses 75 -> 'Critical'. The geospatial heatmap zone for Coke Oven "
            "Battery 1 flips to red. The Evacuation Manager fires, dispatches simulated SMS/email/Slack "
            "alerts, and marks on-site workers as evacuated."
        ),
    ),
    DemoStep(
        step=6, agent="Person C",
        title="Compliance + historical precedent surfaces automatically",
        endpoint="(auto) inside incident report generation",
        description=(
            "The moment the incident report is generated, it queries the RAG agent, which cites the "
            "matching historical precedent and the exact Factories Act / OISD clause breached — turning "
            "a raw evacuation event into an audit-ready compliance record."
        ),
    ),
    DemoStep(
        step=7, agent="Person D",
        title="One call, one verdict",
        endpoint="POST /api/integration/full-assessment  {\"zone\": \"Coke Oven Battery 1\"}",
        description=(
            "This is the payoff: a single endpoint that returns Person A's score, Person D's permit "
            "conflicts, Person B's heatmap/evacuation status, and Person C's compliance narrative as one "
            "JSON object with one unified action recommendation — proof the four agents are one platform, "
            "not four demos stapled together."
        ),
    ),
    DemoStep(
        step=8, agent="Person A + Person D",
        title="Recovery: permits suspended, gas vented, scores fall",
        endpoint="POST /api/simulate/tick  (cycle 5)",
        description=(
            "Permit PTW-2026-001 is marked 'suspended' in the simulated plant state. Gas readings begin "
            "to normalise. Composite and permit risk scores fall back under the Warning threshold and "
            "the evacuation record resolves — closing the loop from detection to remediation."
        ),
    ),
]

_NARRATIVE = (
    "Eight workers died at Visakhapatnam Steel Plant even though the gas sensors and permit system were "
    "working — because nothing connected them fast enough. This walkthrough replays that failure mode "
    "on a simulated coke oven battery and shows ZeroHarm AI catching it: Person A scores the compound "
    "risk, Person D independently flags the exact permit that should be pulled, Person B moves people "
    "out of harm's way, and Person C writes the compliance-grade paper trail — all before the 75-point "
    "'Critical' threshold would have been crossed by a single sensor acting alone."
)


def get_demo_scenario() -> DemoScenarioResponse:
    return DemoScenarioResponse(
        title="ZeroHarm AI — Coke Oven Battery 1 Escalation Walkthrough",
        narrative=_NARRATIVE,
        steps=_STEPS,
    )
