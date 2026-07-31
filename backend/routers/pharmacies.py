import math
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from data.pharmacy_mock import MOCK_PHARMACIES

router = APIRouter()

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class PharmacyOut(BaseModel):
    name: str
    address: str
    phone: str | None
    lat: float
    lon: float
    opening_hours: str | None
    distance_m: int


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _parse_overpass_elements(elements: list[dict], lat: float, lon: float) -> list[PharmacyOut]:
    results: list[PharmacyOut] = []
    for el in elements:
        if el.get("type") != "node":
            continue
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:ja") or "薬局・ドラッグストア"
        el_lat = el.get("lat")
        el_lon = el.get("lon")
        if el_lat is None or el_lon is None:
            continue
        addr_parts = [
            tags.get("addr:full"),
            tags.get("addr:street"),
            tags.get("addr:housenumber"),
            tags.get("addr:city"),
        ]
        address = next((p for p in addr_parts if p), "住所情報なし")
        results.append(
            PharmacyOut(
                name=name,
                address=address,
                phone=tags.get("phone") or tags.get("contact:phone"),
                lat=el_lat,
                lon=el_lon,
                opening_hours=tags.get("opening_hours"),
                distance_m=_haversine_m(lat, lon, el_lat, el_lon),
            )
        )
    results.sort(key=lambda p: p.distance_m)
    return results[:20]


def _mock_nearby(lat: float, lon: float) -> list[PharmacyOut]:
    return [
        PharmacyOut(
            name=p["name"],
            address=p["address"],
            phone=p["phone"],
            lat=p["lat"],
            lon=p["lon"],
            opening_hours=p["opening_hours"],
            distance_m=_haversine_m(lat, lon, p["lat"], p["lon"]),
        )
        for p in MOCK_PHARMACIES
    ]


@router.get("/pharmacies/nearby", response_model=list[PharmacyOut])
def nearby_pharmacies(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius: int = Query(default=3000, ge=500, le=10000),
) -> list[PharmacyOut]:
    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:{radius},{lat},{lon});
      node["shop"="chemist"](around:{radius},{lat},{lon});
    );
    out body;
    """
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
            parsed = _parse_overpass_elements(data.get("elements", []), lat, lon)
            if parsed:
                return parsed
    except (httpx.HTTPError, httpx.TimeoutException, KeyError):
        pass

    return sorted(_mock_nearby(lat, lon), key=lambda p: p.distance_m)
