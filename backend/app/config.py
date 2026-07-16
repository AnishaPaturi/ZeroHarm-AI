# Settings used by the geospatial heatmap + emergency orchestrator (Person B's part).
# Kept separate from engine/ so both halves stay easy to reason about independently.

WORKER_TICK_INTERVAL_SECONDS = 2   # how often the worker-location simulator moves workers

KNOWN_ZONES = [
    "Coke Oven Battery 1",
    "Blast Furnace A",
    "Sinter Plant",
    "Ammonia Storage Tank",
]
