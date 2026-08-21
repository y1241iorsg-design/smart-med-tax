"""処方薬のダミー登録用カタログ（商標回避のため架空名称）。"""

from typing import TypedDict


class RxCatalogItem(TypedDict):
    code: str
    name: str
    generic_name: str
    category: str


RX_CATALOG: list[RxCatalogItem] = [
    {"code": "RX-A", "name": "Rx-A降圧薬", "generic_name": "ダミー降圧成分A", "category": "降圧薬"},
    {"code": "RX-B", "name": "Rx-B糖尿病薬", "generic_name": "ダミー血糖成分B", "category": "糖尿病薬"},
    {"code": "RX-C", "name": "Rx-C胃薬", "generic_name": "ダミー胃酸抑制成分C", "category": "消化器用薬"},
    {"code": "RX-D", "name": "Rx-D抗アレルギー薬", "generic_name": "ダミー抗ヒスタミン成分D", "category": "アレルギー用薬"},
    {"code": "RX-E", "name": "Rx-E睡眠薬", "generic_name": "ダミー睡眠成分E", "category": "睡眠薬"},
    {"code": "RX-F", "name": "Rx-F鎮痛薬", "generic_name": "ダミー鎮痛成分F", "category": "鎮痛薬"},
    {"code": "RX-G", "name": "Rx-G脂質異常症薬", "generic_name": "ダミー脂質成分G", "category": "脂質異常症薬"},
    {"code": "RX-H", "name": "Rx-H抗凝固薬", "generic_name": "ダミー抗凝固成分H", "category": "抗凝固薬"},
]
