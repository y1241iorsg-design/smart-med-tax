import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data.jan_mock import MOCK_PRODUCTS
from data.vendor_mock import generate_vendor_listings


def test_all_products_have_new_required_fields():
    for p in MOCK_PRODUCTS:
        assert p["dosage"], f"{p['name']} に dosage がありません"
        assert p["side_effects"], f"{p['name']} に side_effects がありません"
        assert p["precautions"], f"{p['name']} に precautions がありません"
        assert p["pdf_url"].startswith("https://"), f"{p['name']} の pdf_url が不正です"
        assert p["price"] > 0, f"{p['name']} の price が不正です"


def test_generate_vendor_listings_returns_multiple_per_product():
    listings = generate_vendor_listings(MOCK_PRODUCTS)
    jan_codes = {p["jan_code"] for p in MOCK_PRODUCTS}
    for code in jan_codes:
        count = sum(1 for v in listings if v["jan_code"] == code)
        assert count >= 2, f"{code} の購入先が2件未満です"
