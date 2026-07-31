import httpx


def test_nearby_pharmacies_returns_list(client, monkeypatch):
    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

        def post(self, *a, **k):
            raise httpx.TimeoutException("timeout")

    monkeypatch.setattr("routers.pharmacies.httpx.Client", FakeClient)
    res = client.get("/api/pharmacies/nearby?lat=35.6595&lon=139.7004")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert {"name", "address", "lat", "lon", "distance_m"} <= set(body[0].keys())


def test_nearby_pharmacies_invalid_lat_returns_422(client):
    res = client.get("/api/pharmacies/nearby?lat=999&lon=139.7")
    assert res.status_code == 422
