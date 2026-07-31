"""薬局検索用モックデータ（Overpass API 不通時のフォールバック）"""

MOCK_PHARMACIES = [
    {
        "name": "マツモトキヨシ 渋谷店",
        "address": "東京都渋谷区道玄坂1-2-3",
        "phone": "03-1234-5678",
        "lat": 35.6595,
        "lon": 139.7004,
        "opening_hours": "9:00-21:00",
        "distance_m": 320,
    },
    {
        "name": "ウエルシア 渋谷道玄坂店",
        "address": "東京都渋谷区道玄坂2-10-1",
        "phone": "03-2345-6789",
        "lat": 35.6580,
        "lon": 139.6980,
        "opening_hours": "24時間",
        "distance_m": 580,
    },
    {
        "name": "サンドラッグ 渋谷センター街店",
        "address": "東京都渋谷区宇田川町15-1",
        "phone": "03-3456-7890",
        "lat": 35.6610,
        "lon": 139.7020,
        "opening_hours": "10:00-22:00",
        "distance_m": 450,
    },
]
