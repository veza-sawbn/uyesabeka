"""Geofence evaluation for attendance check-ins."""

from __future__ import annotations

import math

from app.models.enums import GeofenceResult

EARTH_RADIUS_M = 6_371_000.0


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two WGS-84 points, in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def evaluate(
    lat: float, lon: float, site_lat: float, site_lon: float, radius_m: float
) -> tuple[str, float]:
    """Return (geofence_result, distance_in_metres).

    inside  -> within the configured radius
    outside -> beyond the radius (mentor may still override)
    """
    distance = haversine_meters(lat, lon, site_lat, site_lon)
    result = GeofenceResult.INSIDE if distance <= radius_m else GeofenceResult.OUTSIDE
    return result, round(distance, 1)
