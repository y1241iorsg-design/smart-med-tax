"""購入支援(4.3)向けの店舗横断・価格比較データ。

在庫連動は対象外。価格はマスタ参考価格を基準にチャネル別の参考価格を算出し、
購入リンクは実在するECの検索URLへ飛ばして最新価格を確認できるようにする。
"""
from __future__ import annotations

from typing import TypedDict
from urllib.parse import quote


class VendorListing(TypedDict):
    jan_code: str
    store_name: str
    price: int
    in_stock: bool  # 互換のため残す。常に True（在庫連動なし）
    url: str
    channel: str


# (表示名, チャネルID, 価格係数)
_CHANNELS: list[tuple[str, str, float]] = [
    ("楽天市場", "rakuten", 1.00),
    ("Amazon.co.jp", "amazon", 0.97),
    ("Yahoo!ショッピング", "yahoo", 1.03),
]


def _search_url(channel: str, jan_code: str, product_name: str) -> str:
    """JAN / 商品名で実ECの検索結果へ誘導（最新価格は外部サイト側）。"""
    q = quote(f"{product_name} {jan_code}")
    if channel == "rakuten":
        return f"https://search.rakuten.co.jp/search/mall/{q}/"
    if channel == "amazon":
        return f"https://www.amazon.co.jp/s?k={quote(jan_code)}"
    if channel == "yahoo":
        return f"https://shopping.yahoo.co.jp/search?p={q}"
    return f"https://www.google.com/search?q={q}"


def generate_vendor_listings(products: list[dict]) -> list[VendorListing]:
    listings: list[VendorListing] = []
    for p in products:
        base = max(100, int(p["price"]))
        for store_name, channel, factor in _CHANNELS:
            price = max(100, int(round(base * factor / 10) * 10))  # 10円単位
            listings.append(
                VendorListing(
                    jan_code=p["jan_code"],
                    store_name=store_name,
                    price=price,
                    in_stock=True,
                    url=_search_url(channel, p["jan_code"], p["name"]),
                    channel=channel,
                )
            )
    return listings
