from typing import TypedDict


class ProductData(TypedDict):
    jan_code: str
    name: str
    generic_name: str
    efficacy: str
    category: str
    is_qualified: bool


MOCK_PRODUCTS: list[ProductData] = [
    {
        "jan_code": "4987117709559",
        "name": "ロキソニンS 12錠",
        "generic_name": "ロキソプロフェンナトリウム水和物",
        "efficacy": "頭痛・歯痛・生理痛・発熱の緩和",
        "category": "解熱鎮痛薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4987028112014",
        "name": "ガスター10 12錠",
        "generic_name": "ファモチジン",
        "efficacy": "胃痛・もたれ・胸やけ・むかつきの緩和",
        "category": "胃腸薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4901301254115",
        "name": "バファリンA 20錠",
        "generic_name": "アスピリン・ダイアルミネート",
        "efficacy": "頭痛・発熱・月経痛の緩和",
        "category": "解熱鎮痛薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4987123704748",
        "name": "ストッパ下痢止めEX 12錠",
        "generic_name": "ロペラミド塩酸塩",
        "efficacy": "急性下痢・軟便の緩和",
        "category": "止瀉薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4901427016041",
        "name": "新ルルAゴールドDX 30錠",
        "generic_name": "総合感冒薬",
        "efficacy": "鼻水・鼻づまり・のどの痛み・発熱の緩和",
        "category": "かぜ薬",
        "is_qualified": True,
    },
    {
        "jan_code": "4903301069171",
        "name": "ビタミンC 300錠",
        "generic_name": "アスコルビン酸",
        "efficacy": "ビタミンCの補給",
        "category": "ビタミン剤",
        "is_qualified": False,
    },
]
