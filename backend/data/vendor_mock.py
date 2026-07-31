"""購入支援機能(4.3)向けの店舗在庫・価格モックデータ生成。

在庫・価格のリアルタイム連携は実際のドラッグストアAPIとの提携が前提となるため、
本フェーズではモック/シミュレーションとして実装する(設計書「対象外(将来フェーズ)」参照)。
URLは実在しないモック用ドメインを使用し、実店舗サイトを騙るものではないことを明示する。
"""
from typing import TypedDict


class VendorListing(TypedDict):
    jan_code: str
    store_name: str
    price: int
    in_stock: bool
    url: str


_STORES = ["マツモトキヨシ 渋谷店", "ウエルシア 新宿東口店", "ツルハドラッグ 池袋店"]


def generate_vendor_listings(products: list[dict]) -> list[VendorListing]:
    listings: list[VendorListing] = []
    for i, p in enumerate(products):
        for j, offset in enumerate((0, 50, -30)):
            store = _STORES[(i + j) % len(_STORES)]
            price = max(100, p["price"] + offset)
            listings.append(
                VendorListing(
                    jan_code=p["jan_code"],
                    store_name=store,
                    price=price,
                    in_stock=(i + j) % 5 != 0,
                    url=f"https://mock-store.smart-med-tax.local/products/{p['jan_code']}?vendor={j}",
                )
            )
    return listings
