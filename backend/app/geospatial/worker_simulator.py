import random
from typing import Dict, List, Optional

from .models import WorkerLocation
from .plant_layout import zone_bounds, get_layout

_FIRST_NAMES = ["Ravi", "Suresh", "Anil", "Priya", "Kavita", "Manoj", "Deepak", "Sunita", "Arjun", "Neha"]

_WORKERS_PER_ZONE = {
    "Coke Oven Battery 1": 3,
    "Blast Furnace A": 2,
    "Sinter Plant": 2,
    "Ammonia Storage Tank": 4,
}


class WorkerSimulator:
    def __init__(self):
        self._workers: Dict[str, WorkerLocation] = {}
        self._layout = get_layout()
        self._seed_workers()

    def _seed_workers(self):
        counter = 1
        for zone, count in _WORKERS_PER_ZONE.items():
            min_x, min_y, max_x, max_y = zone_bounds(zone)
            for _ in range(count):
                wid = f"W-{counter:03d}"
                self._workers[wid] = WorkerLocation(
                    worker_id=wid,
                    name=random.choice(_FIRST_NAMES),
                    zone=zone,
                    x=round(random.uniform(min_x, max_x), 1),
                    y=round(random.uniform(min_y, max_y), 1),
                    status="on_site",
                )
                counter += 1

    def tick(self):
        """Small random walk for every worker still on site, clamped to their zone bounds."""
        for w in self._workers.values():
            if w.status != "on_site":
                continue
            min_x, min_y, max_x, max_y = zone_bounds(w.zone)
            w.x = round(min(max_x, max(min_x, w.x + random.uniform(-3, 3))), 1)
            w.y = round(min(max_y, max(min_y, w.y + random.uniform(-3, 3))), 1)

    def get_workers(self, zone: Optional[str] = None) -> List[WorkerLocation]:
        workers = list(self._workers.values())
        if zone:
            workers = [w for w in workers if w.zone == zone]
        return workers

    def count_on_site(self, zone: str) -> int:
        return len([w for w in self._workers.values() if w.zone == zone and w.status == "on_site"])

    def mark_zone_evacuating(self, zone: str):
        for w in self._workers.values():
            if w.zone == zone and w.status == "on_site":
                w.status = "evacuating"

    def mark_zone_evacuated(self, zone: str) -> int:
        count = 0
        for w in self._workers.values():
            if w.zone == zone and w.status == "evacuating":
                w.status = "evacuated"
                count += 1
        return count

    def mark_zone_resolved(self, zone: str):
        """Workers return on site once the zone is declared safe again."""
        for w in self._workers.values():
            if w.zone == zone and w.status in ("evacuating", "evacuated"):
                w.status = "on_site"
