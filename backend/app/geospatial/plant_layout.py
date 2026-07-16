"""
Plant layout definitions.

Coordinates are in an arbitrary plant-coordinate system (meters from plant
origin, e.g. the main gate at (0,0)) so the future frontend map (deck.gl /
Leaflet) can project them onto a real or illustrative site plan.

Zone names MUST exactly match the keys Person A uses in `plant_state`
(app/main.py) so the heatmap can be joined to the live risk feed by zone name.
"""

from .models import ZoneLayout


def _centroid(polygon):
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    return (round(sum(xs) / len(xs), 2), round(sum(ys) / len(ys), 2))


_RAW_LAYOUT = {
    "Coke Oven Battery 1": {
        "polygon": [(0, 0), (80, 0), (80, 60), (0, 60)],
        "hazard_classification": "Hot Work / Flammable Gas Zone",
    },
    "Blast Furnace A": {
        "polygon": [(100, 0), (180, 0), (180, 70), (100, 70)],
        "hazard_classification": "High Temperature / Toxic Gas (CO) Zone",
    },
    "Sinter Plant": {
        "polygon": [(0, 80), (70, 80), (70, 140), (0, 140)],
        "hazard_classification": "Confined Space Entry Zone",
    },
    "Ammonia Storage Tank": {
        "polygon": [(100, 90), (150, 90), (150, 140), (100, 140)],
        "hazard_classification": "Toxic Gas Storage (H2S/NH3) Zone",
    },
}


def get_layout() -> dict:
    """Returns {zone_name: ZoneLayout} for every known plant zone."""
    layout = {}
    for zone, raw in _RAW_LAYOUT.items():
        layout[zone] = ZoneLayout(
            zone=zone,
            polygon=raw["polygon"],
            centroid=_centroid(raw["polygon"]),
            hazard_classification=raw["hazard_classification"],
        )
    return layout


def zone_bounds(zone: str):
    """Returns (min_x, min_y, max_x, max_y) bounding box for a zone's polygon."""
    poly = _RAW_LAYOUT[zone]["polygon"]
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return (min(xs), min(ys), max(xs), max(ys))
