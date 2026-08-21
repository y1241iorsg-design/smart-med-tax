"""内科の問診表を想定した持病・注意事項の選択リスト。

検索・注意表示は添付文書の precautions 文言との単純照合のみ行い、
診断・安全性判定は行わない。
"""

CONDITION_OPTIONS: list[str] = [
    "高血圧",
    "糖尿病",
    "心臓病",
    "腎臓病",
    "肝臓病",
    "胃潰瘍・十二指腸潰瘍",
    "ぜんそく",
    "緑内障",
    "甲状腺疾患",
    "てんかん",
    "前立腺肥大",
    "花粉症・アレルギー性鼻炎",
    "アトピー・皮膚アレルギー",
    "妊娠中",
    "授乳中",
]

# 持病ラベル → 添付文書 precautions に現れる照合語
CONDITION_PRECAUTION_TERMS: dict[str, list[str]] = {
    "高血圧": ["高血圧", "血圧"],
    "糖尿病": ["糖尿病"],
    "心臓病": ["心臓", "心臓病"],
    "腎臓病": ["腎臓", "腎"],
    "肝臓病": ["肝臓", "肝"],
    "胃潰瘍・十二指腸潰瘍": ["胃潰瘍", "十二指腸潰瘍", "胃潰瘍・心臓病"],
    "ぜんそく": ["ぜんそく", "喘息"],
    "緑内障": ["緑内障"],
    "甲状腺疾患": ["甲状腺"],
    "てんかん": ["てんかん"],
    "前立腺肥大": ["前立腺"],
    "花粉症・アレルギー性鼻炎": ["アレルギー"],
    "アトピー・皮膚アレルギー": ["アレルギー"],
    "妊娠中": ["妊婦", "妊娠"],
    "授乳中": ["授乳"],
}


def matching_condition_labels(precautions: str, conditions: list[str]) -> list[str]:
    """登録持病のうち、添付文書注意事項に関連語が含まれるものを返す。"""
    matched: list[str] = []
    for condition in conditions:
        terms = CONDITION_PRECAUTION_TERMS.get(condition, [condition])
        if any(term in precautions for term in terms):
            matched.append(condition)
    return matched
