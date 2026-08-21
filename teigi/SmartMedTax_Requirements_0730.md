# 要件定義書再整合 実装計画 (Phase1: 4.1〜4.3優先実装)

For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\- \[ \]) syntax for tracking.  
Goal: 新要件定義書(2026-07-29版)に合わせて、4.1 AIチャット相談・4.2 OTC医薬品レコメンド・4.3 OTC医薬品購入支援を要件通りに再実装する。あわせて4.5お薬手帳の付随フィールド追加と、既存Geminiプロンプトの安全性文言を是正する。  
Architecture: 既存のFastAPI(Python) \+ Next.js(TypeScript) \+ SQLiteスタックを維持する。症状のキーワード照合ロジックをbackend/symptom\_categories.pyに集約し、AIによるスコアリング・商品選定を一切行わない決定論的な検索に置き換える。チャット(症状収集)と検索結果一覧(商品表示)を明確に分離した2画面構成にする。  
Tech Stack: Python 3.11+, FastAPI, SQLite, pytest, Next.js 16, React 19, TypeScript, Tailwind CSS 4, Playwright E2E  
参照: docs/superpowers/specs/2026-07-30-requirements-realignment-design.md  
---

## 前提: 実行方法

* Backend: cd backend && uv run pytest \-v でテスト実行、uv run uvicorn main:app \--reload で起動  
* Frontend: cd frontend && npm run lint で静的チェック、npm run dev で起動、npx playwright test でE2E実行  
* 各タスックはbackendから先に実装し、uv run pytestが全件パスすることを確認してからfrontendに進む

---

## Task 1: DBスキーマ拡張(products/purchasesへの列追加、vendor\_listingsテーブル新設)

Files:

* Modify: backend/db.py  
* Test: backend/tests/test\_db.py (新規)  
*  Step 1: 失敗するテストを書く

backend/tests/test\_db.py:  
import sys  
from pathlib import Path  
sys.path.insert(0, str(Path(\_\_file\_\_).parent.parent))

from db import get\_connection, init\_db

def test\_products\_table\_has\_new\_columns(tmp\_path):  
    path \= tmp\_path / "test.db"  
    init\_db(path)  
    conn \= get\_connection(path)  
    cols \= {row\["name"\] for row in conn.execute("PRAGMA table\_info(products)")}  
    assert {"dosage", "side\_effects", "precautions", "pdf\_url", "price"} \<= cols  
    conn.close()

def test\_purchases\_table\_has\_purpose\_and\_memo(tmp\_path):  
    path \= tmp\_path / "test.db"  
    init\_db(path)  
    conn \= get\_connection(path)  
    cols \= {row\["name"\] for row in conn.execute("PRAGMA table\_info(purchases)")}  
    assert {"purpose", "memo"} \<= cols  
    conn.close()

def test\_vendor\_listings\_table\_exists\_and\_is\_seeded(tmp\_path):  
    path \= tmp\_path / "test.db"  
    init\_db(path)  
    conn \= get\_connection(path)  
    rows \= conn.execute("SELECT \* FROM vendor\_listings LIMIT 1").fetchall()  
    assert len(rows) \> 0  
    conn.close()

def test\_reinit\_does\_not\_duplicate\_or\_break\_existing\_purchases(tmp\_path):  
    """スキーマ移行が既存の purchases 行を壊さないことを確認する(FK制約含む)。"""  
    path \= tmp\_path / "test.db"  
    init\_db(path)  
    conn \= get\_connection(path)  
    conn.execute(  
        "INSERT INTO purchases (jan\_code, price, quantity, purchased\_at) "  
        "VALUES ('4987117709559', 980, 1, '2026-01-01')"  
    )  
    conn.commit()  
    conn.close()

    \# 再度 init\_db を呼んでも既存の purchases 行が残っていること  
    init\_db(path)  
    conn \= get\_connection(path)  
    rows \= conn.execute("SELECT \* FROM purchases").fetchall()  
    assert len(rows) \== 1  
    conn.close()

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_db.py \-v Expected: FAIL (dosage列等が存在しない、vendor\_listingsテーブルが存在しない)

*  Step 3: db.pyを書き換える

backend/db.py の全文を以下に置き換える:  
import sqlite3  
from pathlib import Path

DB\_PATH \= Path(\_\_file\_\_).parent / "data" / "medtax.db"

def get\_connection(path: Path | None \= None) \-\> sqlite3.Connection:  
    conn \= sqlite3.connect(str(path or DB\_PATH))  
    conn.row\_factory \= sqlite3.Row  
    conn.execute("PRAGMA foreign\_keys \= ON")  
    return conn

def \_ensure\_column(conn: sqlite3.Connection, table: str, column: str, coldef: str) \-\> None:  
    cols \= {row\["name"\] for row in conn.execute(f"PRAGMA table\_info({table})")}  
    if column not in cols:  
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {coldef}")

def init\_db(path: Path | None \= None) \-\> None:  
    target \= path or DB\_PATH  
    target.parent.mkdir(parents=True, exist\_ok=True)  
    with get\_connection(target) as conn:  
        conn.execute("""  
            CREATE TABLE IF NOT EXISTS products (  
                jan\_code     TEXT PRIMARY KEY,  
                name         TEXT NOT NULL,  
                generic\_name TEXT NOT NULL,  
                efficacy     TEXT NOT NULL,  
                category     TEXT NOT NULL,  
                is\_qualified INTEGER NOT NULL DEFAULT 0  
            )  
        """)  
        conn.execute("""  
            CREATE TABLE IF NOT EXISTS purchases (  
                id              INTEGER PRIMARY KEY AUTOINCREMENT,  
                jan\_code        TEXT NOT NULL REFERENCES products(jan\_code),  
                price           INTEGER NOT NULL,  
                quantity        INTEGER NOT NULL DEFAULT 1,  
                purchased\_at    DATE NOT NULL,  
                store\_name      TEXT,  
                remaining\_doses INTEGER,  
                created\_at      DATETIME DEFAULT CURRENT\_TIMESTAMP  
            )  
        """)  
        conn.execute("""  
            CREATE TABLE IF NOT EXISTS vendor\_listings (  
                id         INTEGER PRIMARY KEY AUTOINCREMENT,  
                jan\_code   TEXT NOT NULL REFERENCES products(jan\_code),  
                store\_name TEXT NOT NULL,  
                price      INTEGER NOT NULL,  
                in\_stock   INTEGER NOT NULL DEFAULT 1,  
                url        TEXT NOT NULL  
            )  
        """)

        \# 4.2/4.3向けに追加した列(既存DBに対する後方互換マイグレーション)  
        \_ensure\_column(conn, "products", "dosage", "dosage TEXT NOT NULL DEFAULT ''")  
        \_ensure\_column(conn, "products", "side\_effects", "side\_effects TEXT NOT NULL DEFAULT ''")  
        \_ensure\_column(conn, "products", "precautions", "precautions TEXT NOT NULL DEFAULT ''")  
        \_ensure\_column(conn, "products", "pdf\_url", "pdf\_url TEXT NOT NULL DEFAULT ''")  
        \_ensure\_column(conn, "products", "price", "price INTEGER NOT NULL DEFAULT 0")  
        \_ensure\_column(conn, "purchases", "purpose", "purpose TEXT")  
        \_ensure\_column(conn, "purchases", "memo", "memo TEXT")

        \_seed\_products(conn)  
        \_seed\_vendors(conn)

def \_seed\_products(conn: sqlite3.Connection) \-\> None:  
    from data.jan\_mock import MOCK\_PRODUCTS

    \# products はマスタデータなので INSERT OR REPLACE で常に最新のシード内容に揃える。  
    \# purchases は REPLACE の対象にしないため、既存の購入履歴には影響しない。  
    conn.executemany(  
        "INSERT OR REPLACE INTO products "  
        "(jan\_code, name, generic\_name, efficacy, category, is\_qualified, "  
        " dosage, side\_effects, precautions, pdf\_url, price) "  
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",  
        \[  
            (  
                p\["jan\_code"\],  
                p\["name"\],  
                p\["generic\_name"\],  
                p\["efficacy"\],  
                p\["category"\],  
                int(p\["is\_qualified"\]),  
                p\["dosage"\],  
                p\["side\_effects"\],  
                p\["precautions"\],  
                p\["pdf\_url"\],  
                p\["price"\],  
            )  
            for p in MOCK\_PRODUCTS  
        \],  
    )

def \_seed\_vendors(conn: sqlite3.Connection) \-\> None:  
    from data.vendor\_mock import generate\_vendor\_listings  
    from data.jan\_mock import MOCK\_PRODUCTS

    \# vendor\_listings はユーザー入力を含まない完全なモックデータなので  
    \# 起動のたびに全削除→再生成してよい。  
    conn.execute("DELETE FROM vendor\_listings")  
    conn.executemany(  
        "INSERT INTO vendor\_listings (jan\_code, store\_name, price, in\_stock, url) "  
        "VALUES (?, ?, ?, ?, ?)",  
        \[  
            (v\["jan\_code"\], v\["store\_name"\], v\["price"\], int(v\["in\_stock"\]), v\["url"\])  
            for v in generate\_vendor\_listings(MOCK\_PRODUCTS)  
        \],  
    )

def get\_db():  
    conn \= get\_connection()  
    try:  
        yield conn  
    finally:  
        conn.close()

*  Step 4: テストを実行して通ることを確認する(この時点では data/vendor\_mock.py が無いので失敗する)

Run: cd backend && uv run pytest tests/test\_db.py \-v Expected: ModuleNotFoundError: No module named 'data.vendor\_mock' — Task 3で解消される想定。ここでは先に進めてよい(Task 3完了後に再実行して確認する)。

*  Step 5: コミット(Task 3完了後にまとめてコミットする。このタスク単体ではコミットしない)

---

## Task 2: 症状キーワード共有モジュール symptom\_categories.py

コンプライアンス上重要な「AIスコアリングをしない決定論的な照合」の中核。チャットでの症状正規化(4.1)と商品検索(4.2)の両方から使う。  
Files:

* Create: backend/symptom\_categories.py  
* Test: backend/tests/test\_symptom\_categories.py  
*  Step 1: 失敗するテストを書く

backend/tests/test\_symptom\_categories.py:  
import sys  
from pathlib import Path  
sys.path.insert(0, str(Path(\_\_file\_\_).parent.parent))

from symptom\_categories import (  
    match\_categories\_from\_text,  
    detect\_severe\_symptom,  
    CATEGORY\_PRODUCT\_TERMS,  
)

def test\_match\_categories\_from\_text\_headache():  
    assert match\_categories\_from\_text("頭が痛いです") \== \["頭痛・発熱"\]

def test\_match\_categories\_from\_text\_multiple():  
    result \= match\_categories\_from\_text("鼻水が出て、のどが痛いです")  
    assert "鼻水・鼻づまり" in result  
    assert "のどの痛み" in result

def test\_match\_categories\_from\_text\_no\_match():  
    assert match\_categories\_from\_text("こんにちは") \== \[\]

def test\_detect\_severe\_symptom\_true():  
    assert detect\_severe\_symptom("息が苦しいです") is True

def test\_detect\_severe\_symptom\_false():  
    assert detect\_severe\_symptom("頭が痛いです") is False

def test\_category\_product\_terms\_cover\_all\_ten\_categories():  
    assert len(CATEGORY\_PRODUCT\_TERMS) \== 10  
    for terms in CATEGORY\_PRODUCT\_TERMS.values():  
        assert len(terms) \> 0

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_symptom\_categories.py \-v Expected: FAIL (ModuleNotFoundError: No module named 'symptom\_categories')

*  Step 3: backend/symptom\_categories.py を作成する

"""症状カテゴリの決定論的なキーワード照合。

要件定義書 4.2 により「AIによる適合度スコアリングは行わない」ため、  
チャットでの症状正規化・商品検索のどちらも本モジュールの単純なキーワード  
一致のみで判定する(生成AIによる商品選定・順位付けは一切行わない)。  
"""

\# 会話文からカテゴリを推定するための口語表現トリガー(4.1 チャットで使用)  
CATEGORY\_CHAT\_TRIGGERS: dict\[str, list\[str\]\] \= {  
    "頭痛・発熱": \["頭が痛い", "頭痛", "熱がある", "熱っぽい", "発熱", "ずきずき", "頭が重い"\],  
    "鼻水・鼻づまり": \["鼻水", "鼻づまり", "鼻がつまる", "くしゃみ"\],  
    "のどの痛み": \["のどが痛い", "喉が痛い", "のどの痛み", "喉の痛み", "声がれ"\],  
    "胃・腸の不調": \["胃が痛い", "お腹が痛い", "腹痛", "下痢", "胃もたれ", "胸やけ", "気持ち悪い"\],  
    "目のかゆみ": \["目がかゆい", "目のかゆみ", "目が充血"\],  
    "肩こり・疲れ": \["肩こり", "疲れが取れない", "だるい", "疲労"\],  
    "せき・たん": \["せきが出る", "咳が出る", "たんが絡む", "咳き込む"\],  
    "肌トラブル": \["肌がかゆい", "湿疹", "かぶれ", "虫刺され", "あせも"\],  
    "睡眠・ストレス": \["眠れない", "不眠", "寝つきが悪い", "ストレス"\],  
    "更年期症状（ほてり・イライラ・動悸）": \["更年期", "ほてる", "のぼせる", "イライラする", "動悸がする"\],  
}

\# 商品の efficacy(効能・効果)フィールドに実際に現れる語(4.2 商品検索で使用)  
CATEGORY\_PRODUCT\_TERMS: dict\[str, list\[str\]\] \= {  
    "頭痛・発熱": \["頭痛", "発熱"\],  
    "鼻水・鼻づまり": \["鼻水", "鼻づまり"\],  
    "のどの痛み": \["のどの痛み"\],  
    "胃・腸の不調": \["胃", "下痢", "腹痛", "消化"\],  
    "目のかゆみ": \["目のかゆみ"\],  
    "肩こり・疲れ": \["肩こり", "疲労", "疲れ"\],  
    "せき・たん": \["せき", "たん"\],  
    "肌トラブル": \["かゆみ", "湿疹", "かぶれ", "皮膚炎", "あせも", "虫さされ", "肌あれ", "にきび"\],  
    "睡眠・ストレス": \["不眠", "睡眠", "不安"\],  
    "更年期症状（ほてり・イライラ・動悸）": \[  
        "更年期", "ほてり", "イライラ", "動悸", "のぼせ", "月経前症候群", "情緒不安定", "乳房の張り",  
    \],  
}

\# 絞り込みオプション(既存 symptom.py から移植。AIを介さない単純語句フィルタなので継続使用する)  
FILTER\_KEYWORDS: dict\[str, list\[str\]\] \= {  
    "漢方・ナチュラル系": \["漢方", "生薬", "命の母", "龍角散", "逍遥", "チェストツリー", "キキョウ", "当帰"\],  
    "更年期・ホルモンケア向け": \["命の母", "逍遥", "プレフェミン", "更年期", "チェストツリー", "当帰"\],  
    "眠くなりにくい": \["フェキソフェナジン", "ロラタジン", "エピナスチン", "ロキソプロフェン"\],  
    "胃に優しい処方": \["酸化マグネシウム", "キャベジン", "ガスター", "ビタミンU", "イブクイック"\],  
}

\# 即時に受診推奨へエスカレーションする重篤症状キーワード  
SEVERE\_KEYWORDS: list\[str\] \= \[  
    "息が苦しい", "息苦しい", "呼吸が苦しい", "意識がもうろう", "意識がない",  
    "激しい胸の痛み", "胸が締め付けられる", "唇が紫", "けいれん",  
    "高熱が3日以上", "40度以上の熱", "大量に出血", "立てないほどの痛み",  
\]

\# 要件定義書「表現上の注意」に沿った文言テンプレート  
ESCALATION\_MESSAGE \= (  
    "症状の内容から、医療機関の受診をおすすめします。\\n"  
    "本サービスは診断を行うものではありません。できるだけ早めに医療機関にご相談ください。"  
)

NON\_DIAGNOSIS\_DISCLAIMER \= (  
    "添付文書に基づき、入力された症状の効能を持つ商品を表示しています。"  
    "最終的な選択は薬剤師または登録販売者にご相談ください。"  
)

CLARIFYING\_QUESTION \= (  
    "どのような症状ですか?(例:頭痛、鼻水・鼻づまり、のどの痛み、胃の不調 など)"  
)

def detect\_severe\_symptom(text: str) \-\> bool:  
    return any(kw in text for kw in SEVERE\_KEYWORDS)

def match\_categories\_from\_text(text: str) \-\> list\[str\]:  
    matched: list\[str\] \= \[\]  
    for category, triggers in CATEGORY\_CHAT\_TRIGGERS.items():  
        if any(trigger in text for trigger in triggers):  
            matched.append(category)  
    return matched

*  Step 4: テストを実行して通ることを確認する

Run: cd backend && uv run pytest tests/test\_symptom\_categories.py \-v Expected: PASS (6 passed)

*  Step 5: コミット

cd backend  
git add symptom\_categories.py tests/test\_symptom\_categories.py  
git commit \-m "feat: add deterministic symptom category matching module"

---

## Task 3: 商品マスタへの実データ追加 \+ 購入先モックデータ

Files:

* Modify: backend/data/jan\_mock.py  
* Create: backend/data/vendor\_mock.py  
* Test: backend/tests/test\_vendor\_mock.py  
*  Step 1: 失敗するテストを書く

backend/tests/test\_vendor\_mock.py:  
import sys  
from pathlib import Path  
sys.path.insert(0, str(Path(\_\_file\_\_).parent.parent))

from data.jan\_mock import MOCK\_PRODUCTS  
from data.vendor\_mock import generate\_vendor\_listings

def test\_all\_products\_have\_new\_required\_fields():  
    for p in MOCK\_PRODUCTS:  
        assert p\["dosage"\], f"{p\['name'\]} に dosage がありません"  
        assert p\["side\_effects"\], f"{p\['name'\]} に side\_effects がありません"  
        assert p\["precautions"\], f"{p\['name'\]} に precautions がありません"  
        assert p\["pdf\_url"\].startswith("https://"), f"{p\['name'\]} の pdf\_url が不正です"  
        assert p\["price"\] \> 0, f"{p\['name'\]} の price が不正です"

def test\_generate\_vendor\_listings\_returns\_multiple\_per\_product():  
    listings \= generate\_vendor\_listings(MOCK\_PRODUCTS)  
    jan\_codes \= {p\["jan\_code"\] for p in MOCK\_PRODUCTS}  
    for code in jan\_codes:  
        count \= sum(1 for v in listings if v\["jan\_code"\] \== code)  
        assert count \>= 2, f"{code} の購入先が2件未満です"

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_vendor\_mock.py \-v Expected: FAIL (KeyError: 'dosage' および ModuleNotFoundError: No module named 'data.vendor\_mock')

*  Step 3: backend/data/jan\_mock.py を書き換える

ProductData の TypedDict に新フィールドを追加し、全23品目に実データを埋める。  
dosage / side\_effects / precautions / pdf\_url / price は、製薬会社公式サイトまたはPMDA公開情報を典拠とする要約(添付文書の丸写しではない)。全てのURLはWebFetchで実在・内容を確認済み。なお、旧データにあった「アレジオン20点眼薬」(jan\_code: 4901301312052)は、実在確認の結果アレジオン20が内服錠でありこの名称の点眼薬が存在しないと判明したため、実在する参天製薬「サンテAL」(アレルギー専用点眼薬、成分クロルフェニラミンマレイン酸塩)に差し替える。  
from typing import TypedDict

class ProductData(TypedDict):  
    jan\_code: str  
    name: str  
    generic\_name: str  
    efficacy: str  
    category: str  
    is\_qualified: bool  
    dosage: str  
    side\_effects: str  
    precautions: str  
    pdf\_url: str  
    price: int

MOCK\_PRODUCTS: list\[ProductData\] \= \[  
    \# ── 解熱鎮痛薬 ───────────────────────────────────────────  
    {  
        "jan\_code": "4987117709559",  
        "name": "ロキソニンS 12錠",  
        "generic\_name": "ロキソプロフェンナトリウム水和物",  
        "efficacy": "頭痛・歯痛・生理痛・発熱の緩和",  
        "category": "解熱鎮痛薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回1錠を1日2回まで、なるべく空腹時を避けて水又はお湯で服用し、再度症状が出た場合は3回目を服用できるが、服用間隔は4時間以上あける。",  
        "side\_effects": "胃部不快感、吐き気、発疹・かゆみなどがあらわれることがあり、まれにショック、皮膚粘膜眼症候群、肝機能障害等の重篤な症状が起こることがある。",  
        "precautions": "15歳未満や胃潰瘍・心臓病等の治療中の人は服用できず、服用中は他の解熱鎮痛薬・かぜ薬との併用や飲酒を避ける。",  
        "pdf\_url": "https://www.daiichisankyo-hc.co.jp/products/details/loxonin-s/",  
        "price": 780,  
    },  
    {  
        "jan\_code": "4901301254115",  
        "name": "バファリンA 20錠",  
        "generic\_name": "アスピリン・ダイアルミネート",  
        "efficacy": "頭痛・発熱・月経痛の緩和",  
        "category": "解熱鎮痛薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回2錠を水又はぬるま湯で服用し、1日2回を限度として服用間隔は6時間以上あける。",  
        "side\_effects": "発疹・発赤やかゆみ、吐き気・嘔吐、食欲不振、めまいなどがあらわれることがあり、まれにショックや皮膚粘膜眼症候群、肝機能障害等が起こることがある。",  
        "precautions": "15歳未満の小児や出産予定日12週以内の妊婦は服用できず、服用中は他の解熱鎮痛薬・かぜ薬・鎮静薬との併用を避ける。",  
        "pdf\_url": "https://www.bufferin.net/products/a",  
        "price": 650,  
    },  
    {  
        "jan\_code": "4904358020523",  
        "name": "イブクイック頭痛薬DX 40錠",  
        "generic\_name": "イブプロフェン・酸化マグネシウム・無水カフェイン",  
        "efficacy": "頭痛・月経痛・発熱の緩和。胃への負担を軽減した処方",  
        "category": "解熱鎮痛薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回2錠を1日2回を限度とし、なるべく空腹時を避けて服用し、服用間隔は6時間以上あける。",  
        "side\_effects": "発疹・発赤、かゆみ、吐き気、胃部不快感などがあらわれることがあり、まれに重篤な胃腸障害や肝機能障害等が起こることがある。",  
        "precautions": "15歳未満は服用できず、服用前後の飲酒や他の解熱鎮痛薬・かぜ薬との併用は避ける。",  
        "pdf\_url": "https://www.ssp.co.jp/eve/products/eveqdx/",  
        "price": 1280,  
    },  
    \# ── アレルギー・鼻炎薬 ───────────────────────────────────  
    {  
        "jan\_code": "4987107601063",  
        "name": "アレグラFX 28錠",  
        "generic\_name": "フェキソフェナジン塩酸塩",  
        "efficacy": "くしゃみ・鼻水・鼻づまり・目のかゆみの緩和。眠くなりにくい",  
        "category": "アレルギー専用鼻炎薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回1錠を1日2回、朝夕に服用する。",  
        "side\_effects": "口の渇き、便秘、下痢、眠気などがあらわれることがあり、まれにショックや肝機能障害、無顆粒球症等の重篤な症状が起こることがある。",  
        "precautions": "15歳未満は服用できず、他のアレルギー用薬や抗ヒスタミン剤を含む内服薬との併用は避け、妊婦は服用前に相談する。",  
        "pdf\_url": "https://www.hisamitsu.co.jp/healthcare/products/601.html",  
        "price": 1480,  
    },  
    {  
        "jan\_code": "4903301265031",  
        "name": "クラリチンEX 14錠",  
        "generic\_name": "ロラタジン",  
        "efficacy": "花粉・ハウスダストによる鼻水・くしゃみ・目のかゆみの緩和。1日1回",  
        "category": "アレルギー専用鼻炎薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回1錠を1日1回食後に、毎回同じ時間帯に服用する。",  
        "side\_effects": "口の渇き、便秘、下痢、眠気などがあらわれることがあり、まれにショックや肝機能障害等の重篤な症状が起こることがある。",  
        "precautions": "15歳未満は服用できず、他のアレルギー用薬や抗ヒスタミン剤との併用、服用前後の飲酒は避ける。",  
        "pdf\_url": "https://www.taisho-direct.jp/products/detail/CLEXX-00-L2F000X",  
        "price": 1280,  
    },  
    {  
        "jan\_code": "4901427016041",  
        "name": "新ルルAゴールドDX 30錠",  
        "generic\_name": "総合感冒薬（マレイン酸クロルフェニラミン他）",  
        "efficacy": "鼻水・鼻づまり・のどの痛み・発熱・せきの緩和",  
        "category": "かぜ薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回3錠を1日3回、食後なるべく30分以内に服用する（7歳未満は服用不可）。",  
        "side\_effects": "便秘、口の渇き、眠気、目のかすみなどがあらわれることがあり、まれにショックや皮膚粘膜眼症候群、肝機能障害、ぜんそく等の重篤な症状が起こることがある。",  
        "precautions": "本剤の成分でアレルギーを起こしたことがある人は服用できず、服用後は乗物・機械類の運転操作を避け、長期連用しない。",  
        "pdf\_url": "https://www.daiichisankyo-hc.co.jp/products/details/lulu\_a\_gold\_dx\_alpha/",  
        "price": 1680,  
    },  
    \# ── のど薬 ──────────────────────────────────────────────  
    {  
        "jan\_code": "4987317030034",  
        "name": "ペラックT 18錠",  
        "generic\_name": "トラネキサム酸・カルバゾクロム",  
        "efficacy": "のどの痛み・はれの緩和",  
        "category": "口腔・咽喉薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回2錠を1日3回、朝昼晩に水又はお湯で服用する（7歳以上15歳未満は1回1錠）。",  
        "side\_effects": "発疹・かゆみ、吐き気・嘔吐、めまい、頻尿などがあらわれることがあり、まれに脱力感や筋肉痛を伴う偽アルドステロン症等が起こることがある。",  
        "precautions": "甘草やグリチルリチン、トラネキサム酸を含む他の内服薬との併用は避け、長期連用しない。",  
        "pdf\_url": "https://www.daiichisankyo-hc.co.jp/products/details/pelack\_t\_tab/",  
        "price": 850,  
    },  
    {  
        "jan\_code": "4901508025121",  
        "name": "龍角散ダイレクトスティックミント 16本",  
        "generic\_name": "キキョウ末・キョウニン末・セネガ末・カンゾウ末（生薬）",  
        "efficacy": "せき・たん・のどの痛み・声がれの緩和。水なしで服用可",  
        "category": "口腔・咽喉薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1包を水なしでそのまま服用し、1日6回を限度として2時間以上の間隔をあける。",  
        "side\_effects": "発疹・発赤、かゆみ、吐き気・嘔吐、食欲不振、めまいなどがあらわれることがある。",  
        "precautions": "3歳未満の乳幼児は服用できず、5〜6日服用しても症状が改善しない場合は医師等に相談する。",  
        "pdf\_url": "https://www.ryukakusan.co.jp/product/detail/direct\_mint",  
        "price": 700,  
    },  
    \# ── 胃腸薬 ──────────────────────────────────────────────  
    {  
        "jan\_code": "4987028112014",  
        "name": "ガスター10 12錠",  
        "generic\_name": "ファモチジン",  
        "efficacy": "胃痛・もたれ・胸やけ・むかつきの緩和",  
        "category": "胃腸薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上80歳未満）は1回1錠を口中で溶かすか水又はお湯で服用し、1日2回まで、8時間以上の間隔をあける。",  
        "side\_effects": "発疹・発赤やかゆみ、脈の乱れ、気分不良などがあらわれることがあり、まれにショックや皮膚粘膜眼症候群、肝機能障害、血液障害等の重篤な症状が起こることがある。",  
        "precautions": "ファモチジンにアレルギー歴のある人、80歳以上の高齢者、小児、妊婦は服用できず、他の胃腸薬との併用や2週間を超える連用は避ける。",  
        "pdf\_url": "https://www.daiichisankyo-hc.co.jp/products/details/gaster\_s/",  
        "price": 980,  
    },  
    {  
        "jan\_code": "4987316034512",  
        "name": "キャベジンコーワα 60錠",  
        "generic\_name": "メチルメチオニンスルホニウムクロリド（ビタミンU）・ビオジアスターゼ2000",  
        "efficacy": "胃もたれ・胃痛・食欲不振・消化不良の緩和",  
        "category": "胃腸薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回2錠、8歳以上15歳未満は1回1錠を毎食後、1日3回水又は温湯で服用する。",  
        "side\_effects": "まれに発疹・発赤やかゆみなどの皮膚症状があらわれることがある。",  
        "precautions": "8歳未満の小児は服用できず、授乳中の人は服用を避けるか授乳を避ける必要がある。",  
        "pdf\_url": "https://hc.kowa.co.jp/otc/7469",  
        "price": 900,  
    },  
    {  
        "jan\_code": "4987123704748",  
        "name": "ストッパ下痢止めEX 12錠",  
        "generic\_name": "ロペラミド塩酸塩",  
        "efficacy": "急性下痢・軟便・腹痛の緩和",  
        "category": "止瀉薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回1錠を噛みくだくか口の中で溶かして服用し、1日3回を限度として4時間以上の間隔をあける。",  
        "side\_effects": "発疹・発赤やかゆみ、頭痛、排尿困難、顔のほてりなどがあらわれることがある。",  
        "precautions": "15歳未満は服用できず、服用後は乗物や機械類の運転操作を避け、授乳中の人は服用を避けるか授乳を避ける。",  
        "pdf\_url": "https://stoppa.lion.co.jp/product/stoppa/",  
        "price": 700,  
    },  
    \# ── 目薬 ────────────────────────────────────────────────  
    {  
        "jan\_code": "4901301312052",  
        "name": "サンテAL 12ml",  
        "generic\_name": "クロルフェニラミンマレイン酸塩",  
        "efficacy": "目のかゆみ・結膜充血・眼瞼炎・紫外線による眼炎の緩和",  
        "category": "アレルギー用点眼薬",  
        "is\_qualified": True,  
        "dosage": "1回1〜3滴を1日5〜6回点眼する。",  
        "side\_effects": "目のかすみ、充血の悪化、刺激感、かゆみなどがあらわれることがある。",  
        "precautions": "医師の治療を受けている人や緑内障の診断を受けたことのある人は使用前に相談し、5〜6日使用しても症状が改善しない場合は使用を中止して相談する。",  
        "pdf\_url": "https://www.santen.com/jp/healthcare/eye/products/otc/sante\_al",  
        "price": 980,  
    },  
    {  
        "jan\_code": "4987241137428",  
        "name": "ロートアルガードシリーズ 13ml",  
        "generic\_name": "クロモグリク酸ナトリウム・マレイン酸クロルフェニラミン",  
        "efficacy": "目のかゆみ・充血・花粉症目のかゆみの緩和",  
        "category": "アレルギー用点眼薬",  
        "is\_qualified": True,  
        "dosage": "1回1〜2滴を1日3〜6回点眼する。",  
        "side\_effects": "目の充血、かゆみ、はれ、しみて痛いなどの症状があらわれることがある。",  
        "precautions": "医師の治療を受けている人や緑内障の診断を受けた人は使用前に相談し、5〜6日使用しても症状が改善しない場合は使用を中止して相談する。",  
        "pdf\_url": "https://jp.rohto.com/rohto-alguard/eyedrop/",  
        "price": 850,  
    },  
    \# ── ビタミン・疲労回復 ──────────────────────────────────  
    {  
        "jan\_code": "4903301100027",  
        "name": "アリナミンEXプラス 60錠",  
        "generic\_name": "フルスルチアミン（ビタミンB1誘導体）・ビタミンB2・B6",  
        "efficacy": "肉体疲労・神経痛・肩こり・腰痛・眼精疲労の緩和",  
        "category": "ビタミン剤",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回2〜3錠を1日1回、食後すぐに水又はお湯でかまずに服用する。",  
        "side\_effects": "体質により胃部不快感や吐き気、軟便などの消化器症状があらわれることがある。",  
        "precautions": "用法・用量を厳守し、1ヵ月ほど服用しても症状が良くならない場合は医師等に相談する。",  
        "pdf\_url": "https://alinamin.jp/lineup/alinaminexplus.html",  
        "price": 2680,  
    },  
    {  
        "jan\_code": "4901330030087",  
        "name": "チョコラBBプラス 120錠",  
        "generic\_name": "リボフラビン（ビタミンB2）・ビタミンB6・C",  
        "efficacy": "肌あれ・口内炎・にきび・疲れ目の緩和",  
        "category": "ビタミン剤",  
        "is\_qualified": False,  
        "dosage": "成人（15歳以上）は1回1錠を1日2回、朝夕食後に水又はお湯で服用する。",  
        "side\_effects": "胃部不快感や下痢などがあらわれることがあり、服用によりビタミンB2の影響で尿が黄色くなることがあるが心配はない。",  
        "precautions": "15歳未満は服用できず、1ヵ月ほど服用しても改善しない場合は医師等に相談する。",  
        "pdf\_url": "https://www.eisai.jp/products/chocola/chocola\_bb\_plus",  
        "price": 1880,  
    },  
    {  
        "jan\_code": "4903301069171",  
        "name": "ビタミンC 300錠",  
        "generic\_name": "アスコルビン酸",  
        "efficacy": "ビタミンCの補給・疲れの緩和",  
        "category": "ビタミン剤",  
        "is\_qualified": False,  
        "dosage": "15歳以上は1回1〜3錠を1日2回、食後に水又はお湯でかまずに服用する。",  
        "side\_effects": "吐き気・嘔吐、胃部不快感、食欲不振、下痢などがあらわれることがある。",  
        "precautions": "定められた用法・用量を守り、症状が改善しない場合は医師、薬剤師又は登録販売者に相談する。",  
        "pdf\_url": "https://www.pmda.go.jp/PmdaSearch/otcSearch/",  
        "price": 850,  
    },  
    \# ── せき止め ────────────────────────────────────────────  
    {  
        "jan\_code": "4987103005217",  
        "name": "ブロン錠エース 30錠",  
        "generic\_name": "ジヒドロコデインリン酸塩・dl-メチルエフェドリン塩酸塩",  
        "efficacy": "せき・たん・鼻水・鼻づまりの緩和",  
        "category": "鎮咳去痰薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回4錠を1日3回、4時間以上の間隔をあけて水又はぬるま湯で服用する。",  
        "side\_effects": "眠気やめまい、便秘などがあらわれることがあり、依存性のある成分を含むため長期・多量使用に注意が必要である。",  
        "precautions": "12歳未満は服用できず、服用後は乗物や機械類の運転操作を避け、飲酒と併用しない。",  
        "pdf\_url": "https://www.ssp.co.jp/product/detail/brt/",  
        "price": 880,  
    },  
    \# ── 皮膚薬 ──────────────────────────────────────────────  
    {  
        "jan\_code": "4901301223487",  
        "name": "メンソレータムAD 145g",  
        "generic\_name": "クロタミトン・ジフェンヒドラミン塩酸塩・グリチルレチン酸",  
        "efficacy": "かゆみ・湿疹・かぶれ・皮膚炎・あせもの緩和",  
        "category": "皮膚薬",  
        "is\_qualified": True,  
        "dosage": "1日数回、患部に適量を塗布する。",  
        "side\_effects": "使用部位に発疹・発赤、かゆみ、はれなどがあらわれることがある。",  
        "precautions": "目や粘膜、傷口、ただれている部位には使用しない。",  
        "pdf\_url": "https://jp.rohto.com/ad/",  
        "price": 1180,  
    },  
    {  
        "jan\_code": "4903241004118",  
        "name": "ムヒアルファEX 15g",  
        "generic\_name": "プレドニゾロン吉草酸エステル酢酸エステル・リドカイン",  
        "efficacy": "かゆみ・皮膚炎・湿疹・虫さされの緩和",  
        "category": "皮膚薬",  
        "is\_qualified": True,  
        "dosage": "1日数回、適量を患部に塗布する。",  
        "side\_effects": "発疹・発赤、かゆみ、はれ、かぶれ、刺激感などがあらわれることがある。",  
        "precautions": "5〜6日使用しても症状が改善しない場合は使用を中止し、医師等に相談する。",  
        "pdf\_url": "https://www.ikedamohando.co.jp/products/muhi-a-ex.html",  
        "price": 780,  
    },  
    \# ── 睡眠改善薬 ──────────────────────────────────────────  
    {  
        "jan\_code": "4987045049025",  
        "name": "ドリエル 6錠",  
        "generic\_name": "ジフェンヒドラミン塩酸塩",  
        "efficacy": "一時的な睡眠リズムの乱れによる不眠の緩和",  
        "category": "睡眠改善薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回2錠を1日1回、就寝前に水又はぬるま湯で服用する。",  
        "side\_effects": "眠気、悪心、頭痛、起床時の頭重感などがあらわれることがある。",  
        "precautions": "15歳未満は服用できず、就寝前以外は服用しない。",  
        "pdf\_url": "https://www.ssp.co.jp/drewell/products/drewell/",  
        "price": 880,  
    },  
    \# ── 更年期・女性向け ────────────────────────────────────  
    {  
        "jan\_code": "4901207011345",  
        "name": "命の母A 420錠",  
        "generic\_name": "柴胡・当帰・川芎・地黄・芍薬など漢方13成分",  
        "efficacy": "更年期障害（ほてり・のぼせ・イライラ・動悸）・月経不順の緩和",  
        "category": "女性保健薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回4錠を1日3回、毎食後に水又はお湯で服用する。",  
        "side\_effects": "発疹・発赤、かゆみ、胃部不快感、食欲不振、吐き気・嘔吐などがあらわれることがある。",  
        "precautions": "15歳未満は服用できず、2〜3ヵ月服用しても症状が良くならない場合は医師等に相談する。",  
        "pdf\_url": "https://www.kobayashi.co.jp/brand/inochinohaha/product/hahaa.html",  
        "price": 4280,  
    },  
    {  
        "jan\_code": "4901520059345",  
        "name": "プレフェミン 30錠",  
        "generic\_name": "チェストツリー乾燥エキス",  
        "efficacy": "月経前症候群・更年期の情緒不安定・乳房の張りの緩和",  
        "category": "女性保健薬",  
        "is\_qualified": False,  
        "dosage": "成人女性（18歳以上）は1回1錠を1日1回、毎日決まった時間に服用する。",  
        "side\_effects": "発疹・発赤やかゆみ、吐き気、下痢、月経異常などがあらわれることがある。",  
        "precautions": "18歳未満は服用できず、1ヵ月ほど服用しても症状が改善しない場合は医師等に相談する。",  
        "pdf\_url": "https://www.zeria.co.jp/patient/product-use/others/",  
        "price": 2380,  
    },  
    {  
        "jan\_code": "4901207012345",  
        "name": "加味逍遥散エキス錠 180錠",  
        "generic\_name": "加味逍遥散（柴胡・芍薬・当帰・茯苓・白朮など）",  
        "efficacy": "更年期症状・肩こり・疲れ・冷え・のぼせ・不眠・不安の緩和",  
        "category": "漢方薬",  
        "is\_qualified": True,  
        "dosage": "成人（15歳以上）は1回4錠を1日3回、食前又は食間に水又は白湯で服用する（5歳未満は服用不可）。",  
        "side\_effects": "腹痛、下痢、発疹、食欲不振、悪心・嘔吐などがあらわれることがあり、まれに重篤な腸間膜静脈硬化症等が起こることがある。",  
        "precautions": "体質・症状に合わないと感じた場合は服用を中止し、医師、薬剤師又は登録販売者に相談する。",  
        "pdf\_url": "https://www.kracie.co.jp/products/ph/10165206\_2220.html",  
        "price": 2780,  
    },  
\]

*  Step 4: backend/data/vendor\_mock.py を作成する

"""購入支援機能(4.3)向けの店舗在庫・価格モックデータ生成。

在庫・価格のリアルタイム連携は実際のドラッグストアAPIとの提携が前提となるため、  
本フェーズではモック/シミュレーションとして実装する(設計書「対象外(将来フェーズ)」参照)。  
URLは実在しないモック用ドメインを使用し、実店舗サイトを騙るものではないことを明示する。  
"""  
from typing import TypedDict

class VendorListing(TypedDict):  
    jan\_code: str  
    store\_name: str  
    price: int  
    in\_stock: bool  
    url: str

\_STORES \= \["マツモトキヨシ 渋谷店", "ウエルシア 新宿東口店", "ツルハドラッグ 池袋店"\]

def generate\_vendor\_listings(products: list\[dict\]) \-\> list\[VendorListing\]:  
    listings: list\[VendorListing\] \= \[\]  
    for i, p in enumerate(products):  
        for j, offset in enumerate((0, 50, \-30)):  
            store \= \_STORES\[(i \+ j) % len(\_STORES)\]  
            price \= max(100, p\["price"\] \+ offset)  
            listings.append(  
                VendorListing(  
                    jan\_code=p\["jan\_code"\],  
                    store\_name=store,  
                    price=price,  
                    in\_stock=(i \+ j) % 5 \!= 0,  
                    url=f"https://mock-store.smart-med-tax.local/products/{p\['jan\_code'\]}?vendor={j}",  
                )  
            )  
    return listings

*  Step 5: テストを実行して通ることを確認する

Run: cd backend && uv run pytest tests/test\_vendor\_mock.py tests/test\_db.py \-v Expected: PASS (全件)

*  Step 6: コミット

cd backend  
git add data/jan\_mock.py data/vendor\_mock.py tests/test\_vendor\_mock.py tests/test\_db.py db.py  
git commit \-m "feat: add label data (dosage/side effects/precautions/pdf links) and mock vendor listings"

---

## Task 4: Geminiプロンプトの安全性是正

Files:

* Modify: backend/gemini\_client.py  
*  Step 1: 失敗するテストを書く

backend/tests/test\_gemini\_client.py(新規):  
import sys  
from pathlib import Path  
sys.path.insert(0, str(Path(\_\_file\_\_).parent.parent))

from gemini\_client import SYSTEM\_PROMPT

\_FORBIDDEN\_PHRASES \= \["最適な薬を選ぶ", "具体的な可否を答える", "必ず治ります", "治ります"\]

def test\_system\_prompt\_avoids\_forbidden\_diagnostic\_language():  
    for phrase in \_FORBIDDEN\_PHRASES:  
        assert phrase not in SYSTEM\_PROMPT

def test\_system\_prompt\_requires\_non\_diagnosis\_disclaimer():  
    assert "診断ではな" in SYSTEM\_PROMPT or "診断を行うものではありません" in SYSTEM\_PROMPT

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_gemini\_client.py \-v Expected: FAIL (現行のSYSTEM\_PROMPTには「最適な薬を選ぶ」等の断定的指示は無いが、免責文言も無いため2件目が失敗する)

*  Step 3: backend/gemini\_client.py の SYSTEM\_PROMPT を置き換える

backend/gemini\_client.py:9-16 を以下に置き換える:  
SYSTEM\_PROMPT \= """あなたは日本のドラッグストアのセルフメディケーション支援アプリの補助アシスタントです。  
以下のルールを厳守してください：  
\- OTC（市販）医薬品の一般的な情報提供のみを行う。診断や治療方針の決定は行わない  
\- 症状を聞かれても「診断」はせず、対応できる可能性のあるOTC医薬品のカテゴリを案内するに留める  
\- 飲み合わせについて具体的な可否を断定せず、一般的な注意点を伝えた上で薬剤師・登録販売者への相談を促す  
\- 「治ります」「必ず」等の断定的な表現は使わない  
\- 症状が重い、または続く場合は医療機関の受診を促す  
\- 回答は日本語で簡潔に3〜5文程度にまとめる  
\- 末尾に「本情報は診断ではなく、最終判断は薬剤師・登録販売者にご相談ください」と明示する"""

*  Step 4: テストを実行して通ることを確認する

Run: cd backend && uv run pytest tests/test\_gemini\_client.py tests/test\_chat.py \-v Expected: PASS(全件)

*  Step 5: コミット

cd backend  
git add gemini\_client.py tests/test\_gemini\_client.py  
git commit \-m "fix: remove diagnostic/definitive language from Gemini system prompt"

---

## Task 5: POST /api/chat を4.1要件通りに全面書き換え

既存のchat.py(人間へのエスカレーション判定)を、症状収集・重篤症状検知・カテゴリ正規化を行う会話エンドポイントに置き換える。  
Files:

* Modify: backend/routers/chat.py  
* Modify: backend/tests/test\_chat.py  
*  Step 1: 失敗するテストを書く

backend/tests/test\_chat.py の内容を全て以下に置き換える:  
import sys  
from pathlib import Path  
sys.path.insert(0, str(Path(\_\_file\_\_).parent.parent))

def test\_severe\_message\_triggers\_escalation(client):  
    res \= client.post("/api/chat", json={"history": \[{"role": "user", "text": "息が苦しいです"}\]})  
    assert res.status\_code \== 200  
    body \= res.json()  
    assert body\["escalate"\] is True  
    assert body\["ready\_for\_search"\] is False  
    assert "医療機関" in body\["reply"\]

def test\_recognized\_symptom\_returns\_ready\_for\_search(client):  
    res \= client.post("/api/chat", json={"history": \[{"role": "user", "text": "頭が痛いです"}\]})  
    assert res.status\_code \== 200  
    body \= res.json()  
    assert body\["escalate"\] is False  
    assert body\["ready\_for\_search"\] is True  
    assert "頭痛・発熱" in body\["extracted\_symptoms"\]

def test\_unrecognized\_message\_asks\_clarifying\_question(client):  
    res \= client.post("/api/chat", json={"history": \[{"role": "user", "text": "こんにちは"}\]})  
    assert res.status\_code \== 200  
    body \= res.json()  
    assert body\["escalate"\] is False  
    assert body\["ready\_for\_search"\] is False  
    assert body\["extracted\_symptoms"\] \== \[\]

def test\_empty\_history\_returns\_422(client):  
    res \= client.post("/api/chat", json={"history": \[\]})  
    assert res.status\_code \== 422

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_chat.py \-v Expected: FAIL (既存のchat.pyはこのレスポンス形式を返さない)

*  Step 3: backend/routers/chat.py を全面的に書き換える

from fastapi import APIRouter  
from pydantic import BaseModel, Field  
from symptom\_categories import (  
    detect\_severe\_symptom,  
    match\_categories\_from\_text,  
    ESCALATION\_MESSAGE,  
    NON\_DIAGNOSIS\_DISCLAIMER,  
    CLARIFYING\_QUESTION,  
)

router \= APIRouter()

class ChatTurn(BaseModel):  
    role: str  
    text: str

class ChatRequest(BaseModel):  
    history: list\[ChatTurn\] \= Field(min\_length=1)

class ChatTurnResponse(BaseModel):  
    reply: str  
    escalate: bool  
    ready\_for\_search: bool  
    extracted\_symptoms: list\[str\]

@router.post("/chat", response\_model=ChatTurnResponse)  
def chat(body: ChatRequest) \-\> ChatTurnResponse:  
    latest \= body.history\[-1\].text

    if detect\_severe\_symptom(latest):  
        return ChatTurnResponse(  
            reply=ESCALATION\_MESSAGE,  
            escalate=True,  
            ready\_for\_search=False,  
            extracted\_symptoms=\[\],  
        )

    matched \= match\_categories\_from\_text(latest)  
    if matched:  
        label \= "・".join(matched)  
        reply \= f"{label}に関連するOTC医薬品の情報を一覧で表示します。\\n{NON\_DIAGNOSIS\_DISCLAIMER}"  
        return ChatTurnResponse(  
            reply=reply,  
            escalate=False,  
            ready\_for\_search=True,  
            extracted\_symptoms=matched,  
        )

    return ChatTurnResponse(  
        reply=CLARIFYING\_QUESTION,  
        escalate=False,  
        ready\_for\_search=False,  
        extracted\_symptoms=\[\],  
    )

*  Step 4: テストを実行して通ることを確認する

Run: cd backend && uv run pytest tests/test\_chat.py \-v Expected: PASS (4 passed)

*  Step 5: コミット

cd backend  
git add routers/chat.py tests/test\_chat.py  
git commit \-m "feat: rewrite chat endpoint as symptom-intake conversation per req 4.1"

---

## Task 6: routers/symptom.py を routers/products.py に置き換え(4.2/4.3)

Files:

* Delete: backend/routers/symptom.py  
* Delete: backend/tests/test\_symptom.py  
* Create: backend/routers/products.py  
* Create: backend/tests/test\_products.py  
* Modify: backend/main.py  
*  Step 1: 失敗するテストを書く

backend/tests/test\_products.py:  
import sys  
from pathlib import Path  
sys.path.insert(0, str(Path(\_\_file\_\_).parent.parent))

def test\_search\_returns\_parallel\_list\_sorted\_by\_price(client):  
    res \= client.post("/api/products/search", json={"symptoms": \["頭痛・発熱"\]})  
    assert res.status\_code \== 200  
    body \= res.json()  
    assert len(body) \>= 2  
    prices \= \[item\["price"\] for item in body\]  
    assert prices \== sorted(prices)

def test\_search\_result\_contains\_required\_fields\_for\_screen\_requirements(client):  
    res \= client.post("/api/products/search", json={"symptoms": \["頭痛・発熱"\]})  
    item \= res.json()\[0\]  
    for field in ("name", "efficacy", "dosage", "side\_effects", "precautions", "pdf\_url", "price", "is\_qualified"):  
        assert field in item

def test\_search\_does\_not\_include\_ai\_reasoning\_field(client):  
    """要件書「AIによる適合度スコアリングは行わない」の担保:  
    レスポンスに推奨理由・スコア等のフィールドが存在しないことを確認する。"""  
    res \= client.post("/api/products/search", json={"symptoms": \["頭痛・発熱"\]})  
    item \= res.json()\[0\]  
    assert "score" not in item  
    assert "reason" not in item  
    assert "recommendation\_reason" not in item

def test\_search\_with\_empty\_symptoms\_returns\_422(client):  
    res \= client.post("/api/products/search", json={"symptoms": \[\]})  
    assert res.status\_code \== 422

def test\_search\_flags\_overlap\_with\_current\_meds(client):  
    res \= client.post(  
        "/api/products/search",  
        json={"symptoms": \["頭痛・発熱"\], "current\_meds": \["ロキソプロフェンナトリウム水和物"\]},  
    )  
    body \= res.json()  
    loxonin \= next(item for item in body if item\["name"\].startswith("ロキソニン"))  
    assert loxonin\["overlap\_warning"\] is True

def test\_search\_with\_filter\_narrows\_results(client):  
    res \= client.post(  
        "/api/products/search",  
        json={"symptoms": \["肩こり・疲れ"\], "filters": \["漢方・ナチュラル系"\]},  
    )  
    body \= res.json()  
    assert all("漢方" in item\["generic\_name"\] or "逍遥" in item\["name"\] for item in body)

def test\_get\_vendors\_for\_known\_product(client):  
    res \= client.get("/api/products/4987117709559/vendors")  
    assert res.status\_code \== 200  
    body \= res.json()  
    assert len(body) \>= 2  
    assert {"store\_name", "price", "in\_stock", "url"} \<= set(body\[0\].keys())

def test\_get\_vendors\_for\_unknown\_product\_returns\_404(client):  
    res \= client.get("/api/products/0000000000000/vendors")  
    assert res.status\_code \== 404

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_products.py \-v Expected: FAIL (404 Not Found — ルーターが存在しない)

*  Step 3: backend/routers/symptom.py と backend/tests/test\_symptom.py を削除する

cd backend  
rm routers/symptom.py tests/test\_symptom.py

*  Step 4: backend/routers/products.py を作成する

import sqlite3  
from datetime import date, timedelta  
from fastapi import APIRouter, Depends, HTTPException  
from pydantic import BaseModel, Field  
from db import get\_db  
from symptom\_categories import CATEGORY\_PRODUCT\_TERMS, FILTER\_KEYWORDS

router \= APIRouter()

class ProductSearchRequest(BaseModel):  
    symptoms: list\[str\] \= Field(min\_length=1)  
    filters: list\[str\] \= Field(default\_factory=list)  
    current\_meds: list\[str\] \= Field(default\_factory=list)

class ProductOut(BaseModel):  
    jan\_code: str  
    name: str  
    generic\_name: str  
    efficacy: str  
    dosage: str  
    side\_effects: str  
    precautions: str  
    pdf\_url: str  
    price: int  
    category: str  
    is\_qualified: bool  
    overlap\_warning: bool

class VendorOut(BaseModel):  
    store\_name: str  
    price: int  
    in\_stock: bool  
    url: str

def \_fetch\_past\_purchase\_names(db: sqlite3.Connection) \-\> list\[str\]:  
    one\_year\_ago \= (date.today() \- timedelta(days=365)).isoformat()  
    rows \= db.execute(  
        "SELECT DISTINCT prod.name FROM purchases p "  
        "JOIN products prod ON p.jan\_code \= prod.jan\_code "  
        "WHERE p.purchased\_at \>= ? ORDER BY p.purchased\_at DESC LIMIT 10",  
        \[one\_year\_ago\],  
    ).fetchall()  
    return \[r\["name"\] for r in rows\]

@router.post("/products/search", response\_model=list\[ProductOut\])  
def search\_products(body: ProductSearchRequest, db: sqlite3.Connection \= Depends(get\_db)) \-\> list\[ProductOut\]:  
    terms: set\[str\] \= set()  
    for symptom in body.symptoms:  
        terms.update(CATEGORY\_PRODUCT\_TERMS.get(symptom, \[\]))

    rows \= db.execute("SELECT \* FROM products").fetchall()  
    matched \= \[r for r in rows if any(t in r\["efficacy"\] for t in terms)\]

    active\_filters \= \[f for f in body.filters if f in FILTER\_KEYWORDS\]  
    if active\_filters:  
        filter\_words \= \[w for f in active\_filters for w in FILTER\_KEYWORDS\[f\]\]  
        \# ユーザーが明示的に選んだ絞り込みなので、結果が少数でもそのまま適用する  
        \# (件数が少ない場合に無視すると「絞り込みが効かない」ように見えるため)  
        matched \= \[  
            r for r in matched  
            if any(w in r\["name"\] or w in r\["generic\_name"\] or w in r\["efficacy"\] for w in filter\_words)  
        \]

    if "過去購入品を優先" in body.filters:  
        past\_names \= set(\_fetch\_past\_purchase\_names(db))  
        matched.sort(key=lambda r: (r\["name"\] not in past\_names, r\["price"\], r\["generic\_name"\]))  
    else:  
        matched.sort(key=lambda r: (r\["price"\], r\["generic\_name"\]))

    return \[  
        ProductOut(  
            jan\_code=r\["jan\_code"\],  
            name=r\["name"\],  
            generic\_name=r\["generic\_name"\],  
            efficacy=r\["efficacy"\],  
            dosage=r\["dosage"\],  
            side\_effects=r\["side\_effects"\],  
            precautions=r\["precautions"\],  
            pdf\_url=r\["pdf\_url"\],  
            price=r\["price"\],  
            category=r\["category"\],  
            is\_qualified=bool(r\["is\_qualified"\]),  
            overlap\_warning=any(med in r\["generic\_name"\] for med in body.current\_meds),  
        )  
        for r in matched  
    \]

@router.get("/products/{jan\_code}/vendors", response\_model=list\[VendorOut\])  
def get\_vendors(jan\_code: str, db: sqlite3.Connection \= Depends(get\_db)) \-\> list\[VendorOut\]:  
    product \= db.execute("SELECT jan\_code FROM products WHERE jan\_code \= ?", \[jan\_code\]).fetchone()  
    if product is None:  
        raise HTTPException(status\_code=404, detail="この商品は登録されていません")

    rows \= db.execute(  
        "SELECT store\_name, price, in\_stock, url FROM vendor\_listings "  
        "WHERE jan\_code \= ? ORDER BY price",  
        \[jan\_code\],  
    ).fetchall()  
    return \[  
        VendorOut(store\_name=r\["store\_name"\], price=r\["price"\], in\_stock=bool(r\["in\_stock"\]), url=r\["url"\])  
        for r in rows  
    \]

*  Step 5: backend/main.py を更新する

backend/main.py:7 を書き換える:  
from routers import jan, purchases, tax, chat, inventory, receipt, products

backend/main.py:33 を書き換える(削除して置き換え):  
app.include\_router(products.router, prefix="/api")

(app.include\_router(symptom.router, prefix="/api") の行を削除し、上記に置き換える)

*  Step 6: テストを実行して通ることを確認する

Run: cd backend && uv run pytest \-v Expected: PASS(全件。test\_symptom.pyは削除済みのため実行されない)

*  Step 7: コミット

cd backend  
git add routers/products.py tests/test\_products.py main.py  
git rm routers/symptom.py tests/test\_symptom.py  
git commit \-m "feat: replace AI-scored symptom recommendation with deterministic product search (req 4.2/4.3)"

---

## Task 7: お薬手帳(4.5)への使用目的・メモ追加

Files:

* Modify: backend/routers/purchases.py  
* Modify: backend/tests/test\_purchases.py  
*  Step 1: 失敗するテストを書く

backend/tests/test\_purchases.py に以下のテストを追記する(既存テストはそのまま残す):  
def test\_add\_purchase\_persists\_purpose\_and\_memo(client):  
    res \= client.post(  
        "/api/purchases",  
        json={  
            "jan\_code": "4987117709559",  
            "price": 980,  
            "quantity": 1,  
            "purchased\_at": "2026-07-30",  
            "purpose": "頭痛のため",  
            "memo": "効果があった",  
        },  
    )  
    assert res.status\_code \== 200  
    body \= res.json()  
    assert body\["purpose"\] \== "頭痛のため"  
    assert body\["memo"\] \== "効果があった"

def test\_list\_purchases\_includes\_purpose\_and\_memo(client):  
    client.post(  
        "/api/purchases",  
        json={  
            "jan\_code": "4987117709559",  
            "price": 980,  
            "quantity": 1,  
            "purchased\_at": "2026-07-30",  
            "purpose": "頭痛のため",  
        },  
    )  
    res \= client.get("/api/purchases?year=2026")  
    assert res.json()\[0\]\["purpose"\] \== "頭痛のため"

*  Step 2: テストを実行して失敗を確認する

Run: cd backend && uv run pytest tests/test\_purchases.py \-v Expected: FAIL (KeyError: 'purpose' — レスポンスに含まれない)

*  Step 3: backend/routers/purchases.py を書き換える

全文を以下に置き換える:  
import sqlite3  
from datetime import date  
from fastapi import APIRouter, Depends, HTTPException  
from pydantic import BaseModel, Field  
from db import get\_db

router \= APIRouter()

class PurchaseCreate(BaseModel):  
    jan\_code: str  
    price: int \= Field(ge=1)  
    quantity: int \= Field(ge=1, le=999)  
    purchased\_at: date  
    store\_name: str | None \= None  
    remaining\_doses: int | None \= Field(default=None, ge=0)  
    purpose: str | None \= None  
    memo: str | None \= None

@router.post("/purchases")  
def add\_purchase(  
    body: PurchaseCreate, db: sqlite3.Connection \= Depends(get\_db)  
):  
    product \= db.execute(  
        "SELECT \* FROM products WHERE jan\_code \= ?", \[body.jan\_code\]  
    ).fetchone()  
    if product is None:  
        raise HTTPException(status\_code=404, detail="商品が見つかりません")

    cursor \= db.execute(  
        "INSERT INTO purchases "  
        "(jan\_code, price, quantity, purchased\_at, store\_name, remaining\_doses, purpose, memo) "  
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",  
        \[body.jan\_code, body.price, body.quantity, body.purchased\_at.isoformat(),  
         body.store\_name, body.remaining\_doses, body.purpose, body.memo\],  
    )  
    db.commit()

    row \= db.execute(  
        "SELECT p.\*, prod.name AS product\_name, prod.is\_qualified "  
        "FROM purchases p JOIN products prod ON p.jan\_code \= prod.jan\_code "  
        "WHERE p.id \= ?",  
        \[cursor.lastrowid\],  
    ).fetchone()  
    return dict(row)

@router.get("/purchases")  
def list\_purchases(year: int, db: sqlite3.Connection \= Depends(get\_db)):  
    rows \= db.execute(  
        "SELECT p.\*, prod.name AS product\_name, prod.is\_qualified "  
        "FROM purchases p JOIN products prod ON p.jan\_code \= prod.jan\_code "  
        "WHERE strftime('%Y', p.purchased\_at) \= ? "  
        "ORDER BY p.purchased\_at DESC",  
        \[str(year)\],  
    ).fetchall()  
    return \[dict(r) for r in rows\]

*  Step 4: テストを実行して通ることを確認する

Run: cd backend && uv run pytest \-v Expected: PASS(全件)

*  Step 5: コミット

cd backend  
git add routers/purchases.py tests/test\_purchases.py  
git commit \-m "feat: add purpose/memo fields to purchase records (req 4.5)"

---

## Task 8: フロントエンド lib/api.ts の更新

Files:

* Modify: frontend/lib/api.ts  
*  Step 1: frontend/lib/api.ts の全文を以下に置き換える

const API\_BASE \=  
  process.env.NEXT\_PUBLIC\_API\_URL ?? "http://localhost:8000";

// SQLite returns is\_qualified as 0 or 1 (integer). Both are treated as  
// truthy/falsy in JS, so conditional rendering (product.is\_qualified ? ...) works.  
export type Product \= {  
  jan\_code: string;  
  name: string;  
  generic\_name: string;  
  efficacy: string;  
  category: string;  
  is\_qualified: number; // 1 \= qualified, 0 \= not qualified  
  dosage: string;  
  side\_effects: string;  
  precautions: string;  
  pdf\_url: string;  
  price: number;  
};

export type Purchase \= {  
  id: number;  
  jan\_code: string;  
  product\_name: string;  
  price: number;  
  quantity: number;  
  purchased\_at: string;  
  store\_name: string | null;  
  purpose: string | null;  
  memo: string | null;  
  is\_qualified: number;  
};

export type TaxSummary \= {  
  year: number;  
  total\_qualified: number;  
  deductible\_amount: number;  
  threshold: number;  
  is\_qualified: boolean;  
};

export async function lookupJan(code: string): Promise\<Product\> {  
  const res \= await fetch(\`${API\_BASE}/api/jan/${code}\`);  
  if (\!res.ok) {  
    const err \= await res.json().catch(() \=\> ({}));  
    throw new Error(err.detail ?? "検索に失敗しました");  
  }  
  return res.json();  
}

export async function addPurchase(data: {  
  jan\_code: string;  
  price: number;  
  quantity: number;  
  purchased\_at: string;  
  store\_name?: string;  
  purpose?: string;  
  memo?: string;  
}): Promise\<Purchase\> {  
  const res \= await fetch(\`${API\_BASE}/api/purchases\`, {  
    method: "POST",  
    headers: { "Content-Type": "application/json" },  
    body: JSON.stringify(data),  
  });  
  if (\!res.ok) {  
    const err \= await res.json().catch(() \=\> ({}));  
    throw new Error(err.detail ?? "追加に失敗しました");  
  }  
  return res.json();  
}

export async function getPurchases(year: number): Promise\<Purchase\[\]\> {  
  const res \= await fetch(\`${API\_BASE}/api/purchases?year=${year}\`);  
  if (\!res.ok) throw new Error("購入履歴の取得に失敗しました");  
  return res.json();  
}

export async function getTaxSummary(year: number): Promise\<TaxSummary\> {  
  const res \= await fetch(\`${API\_BASE}/api/tax/summary?year=${year}\`);  
  if (\!res.ok) throw new Error("税制サマリの取得に失敗しました");  
  return res.json();  
}

export function getTaxExportUrl(year: number, format: "csv" | "xml"): string {  
  return \`${API\_BASE}/api/tax/export?year=${year}\&fmt=${format}\`;  
}

export type InventoryItem \= {  
  jan\_code: string;  
  product\_name: string;  
  category: string;  
  remaining\_doses: number;  
  last\_purchased\_at: string;  
  is\_low\_stock: boolean;  
};

export async function getInventory(): Promise\<InventoryItem\[\]\> {  
  const res \= await fetch(\`${API\_BASE}/api/inventory\`);  
  if (\!res.ok) throw new Error("在庫情報の取得に失敗しました");  
  return res.json();  
}

export async function uploadReceipt(): Promise\<{ imported: number; date: string; store: string }\> {  
  const res \= await fetch(\`${API\_BASE}/api/receipt/upload\`, { method: "POST" });  
  if (\!res.ok) throw new Error("レシート取込に失敗しました");  
  return res.json();  
}

// \--- 4.1 AIチャット相談 \---

export type ChatTurn \= { role: "user" | "assistant"; text: string };

export type ChatApiResponse \= {  
  reply: string;  
  escalate: boolean;  
  ready\_for\_search: boolean;  
  extracted\_symptoms: string\[\];  
};

export async function sendChatTurn(history: ChatTurn\[\]): Promise\<ChatApiResponse\> {  
  const res \= await fetch(\`${API\_BASE}/api/chat\`, {  
    method: "POST",  
    headers: { "Content-Type": "application/json" },  
    body: JSON.stringify({ history }),  
  });  
  if (\!res.ok) throw new Error("チャットの送信に失敗しました");  
  return res.json();  
}

// \--- 4.2 OTC医薬品レコメンド / 4.3 購入支援 \---

export type ProductSearchResult \= Product & { overlap\_warning: boolean };

export async function searchProducts(  
  symptoms: string\[\],  
  filters: string\[\] \= \[\],  
  currentMeds: string\[\] \= \[\]  
): Promise\<ProductSearchResult\[\]\> {  
  const res \= await fetch(\`${API\_BASE}/api/products/search\`, {  
    method: "POST",  
    headers: { "Content-Type": "application/json" },  
    body: JSON.stringify({ symptoms, filters, current\_meds: currentMeds }),  
  });  
  if (\!res.ok) throw new Error("商品検索に失敗しました");  
  return res.json();  
}

export type VendorListing \= {  
  store\_name: string;  
  price: number;  
  in\_stock: boolean;  
  url: string;  
};

export async function getProductVendors(janCode: string): Promise\<VendorListing\[\]\> {  
  const res \= await fetch(\`${API\_BASE}/api/products/${janCode}/vendors\`);  
  if (\!res.ok) throw new Error("購入先情報の取得に失敗しました");  
  return res.json();  
}

*  Step 2: 型チェックを実行する

Run: cd frontend && npx tsc \--noEmit Expected: この時点では chat/page.tsx と symptom/page.tsx が古い型(sendChat, getRecommendation)を参照しているためエラーになる。Task 9・10で解消する。

*  Step 3: コミット(Task 9完了後にまとめてコミットする。このタスク単体ではコミットしない)

---

## Task 9: /chat ページを4.1要件通りに書き換え

Files:

* Modify: frontend/app/chat/page.tsx  
*  Step 1: 全文を以下に置き換える

"use client";  
import { useState, useRef, useEffect } from "react";  
import { useRouter } from "next/navigation";  
import { sendChatTurn, type ChatTurn } from "@/lib/api";

type Message \= ChatTurn & { id: number };

export default function ChatPage() {  
  const router \= useRouter();  
  const \[messages, setMessages\] \= useState\<Message\[\]\>(\[  
    {  
      id: 0,  
      role: "assistant",  
      text: "こんにちは。今日はどのような症状でお悩みですか?(例:頭痛、鼻水、のどの痛みなど)",  
    },  
  \]);  
  const \[input, setInput\] \= useState("");  
  const \[loading, setLoading\] \= useState(false);  
  const \[escalate, setEscalate\] \= useState(false);  
  const \[readyForSearch, setReadyForSearch\] \= useState(false);  
  const \[extractedSymptoms, setExtractedSymptoms\] \= useState\<string\[\]\>(\[\]);  
  const bottomRef \= useRef\<HTMLDivElement\>(null);

  useEffect(() \=\> {  
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });  
  }, \[messages\]);

  async function handleSend() {  
    const text \= input.trim();  
    if (\!text || loading) return;  
    setInput("");  
    const nextHistory: Message\[\] \= \[...messages, { id: Date.now(), role: "user", text }\];  
    setMessages(nextHistory);  
    setLoading(true);  
    try {  
      const res \= await sendChatTurn(nextHistory.map(({ role, text }) \=\> ({ role, text })));  
      setMessages((prev) \=\> \[...prev, { id: Date.now() \+ 1, role: "assistant", text: res.reply }\]);  
      setEscalate(res.escalate);  
      setReadyForSearch(res.ready\_for\_search);  
      setExtractedSymptoms(res.extracted\_symptoms);  
    } catch {  
      setMessages((prev) \=\> \[  
        ...prev,  
        { id: Date.now() \+ 1, role: "assistant", text: "エラーが発生しました。もう一度お試しください。" },  
      \]);  
    } finally {  
      setLoading(false);  
    }  
  }

  function goToSearch() {  
    const query \= encodeURIComponent(extractedSymptoms.join(","));  
    router.push(\`/search?symptoms=${query}\`);  
  }

  return (  
    \<main className="max-w-3xl mx-auto flex flex-col h-\[calc(100vh-3.5rem)\]"\>  
      \<div className="px-4 py-3 border-b bg-white"\>  
        \<h1 className="text-lg font-bold text-gray-900"\>AIチャット相談\</h1\>  
        \<p className="text-xs text-gray-500"\>  
          症状をチャットで入力すると、関連するOTC医薬品の情報をご案内します。診断は行いません。  
        \</p\>  
      \</div\>

      {escalate && (  
        \<div  
          className="bg-red-50 border-b-2 border-red-300 text-red-800 px-4 py-3 text-sm font-medium"  
          data-testid="escalation-banner"  
        \>  
          ⚠ 医療機関の受診をご検討ください。本サービスは診断を行うものではありません。  
        \</div\>  
      )}

      \<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"\>  
        {messages.map((m) \=\> (  
          \<div  
            key={m.id}  
            className={\`flex ${m.role \=== "user" ? "justify-end" : "justify-start"}\`}  
            data-testid={m.role \=== "user" ? "user-bubble" : "assistant-bubble"}  
          \>  
            \<div  
              className={\`max-w-\[80%\] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${  
                m.role \=== "user"  
                  ? "bg-indigo-600 text-white rounded-tr-sm"  
                  : "bg-white shadow text-gray-800 rounded-tl-sm"  
              }\`}  
            \>  
              {m.text}  
            \</div\>  
          \</div\>  
        ))}  
        {loading && (  
          \<div className="flex justify-start" data-testid="loading-indicator"\>  
            \<div className="bg-white shadow rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400"\>  
              入力中...  
            \</div\>  
          \</div\>  
        )}  
        \<div ref={bottomRef} /\>  
      \</div\>

      {readyForSearch && (  
        \<div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100"\>  
          \<button  
            onClick={goToSearch}  
            data-testid="go-to-search-button"  
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-indigo-700"  
          \>  
            検索結果を見る  
          \</button\>  
        \</div\>  
      )}

      \<div className="px-4 py-2 bg-white border-t"\>  
        \<div className="flex gap-2"\>  
          \<input  
            type="text"  
            value={input}  
            onChange={(e) \=\> setInput(e.target.value)}  
            onKeyDown={(e) \=\> e.key \=== "Enter" && handleSend()}  
            placeholder="症状を入力..."  
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"  
            data-testid="chat-input"  
          /\>  
          \<button  
            onClick={handleSend}  
            disabled={\!input.trim() || loading}  
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40 active:bg-indigo-700"  
            data-testid="send-button"  
          \>  
            送信  
          \</button\>  
        \</div\>  
      \</div\>  
    \</main\>  
  );  
}

*  Step 2: 型チェックを実行する

Run: cd frontend && npx tsc \--noEmit Expected: chat/page.tsx に関するエラーは解消(symptom/page.tsxのエラーはTask 10で解消)

*  Step 3: コミット(Task 10完了後にまとめてコミットする)

---

## Task 10: /symptom を /search に置き換え(4.2要件の並列一覧表示)

Files:

* Delete: frontend/app/symptom/page.tsx  
* Create: frontend/app/search/page.tsx  
*  Step 1: frontend/app/symptom/page.tsx を削除する

cd frontend && rm \-rf app/symptom

*  Step 2: frontend/app/search/page.tsx を作成する

"use client";  
import { useState, useEffect, Suspense } from "react";  
import Link from "next/link";  
import { useSearchParams } from "next/navigation";  
import { searchProducts, type ProductSearchResult } from "@/lib/api";

const SYMPTOMS \= \[  
  { label: "頭痛・発熱", icon: "🌡️" },  
  { label: "鼻水・鼻づまり", icon: "🤧" },  
  { label: "のどの痛み", icon: "😮‍💨" },  
  { label: "胃・腸の不調", icon: "🫁" },  
  { label: "目のかゆみ", icon: "👁️" },  
  { label: "肩こり・疲れ", icon: "💆" },  
  { label: "せき・たん", icon: "😷" },  
  { label: "肌トラブル", icon: "🧴" },  
  { label: "睡眠・ストレス", icon: "😴" },  
  { label: "更年期症状（ほてり・イライラ・動悸）", icon: "🌸" },  
\];

const FILTERS \= \[  
  "眠くなりにくい",  
  "漢方・ナチュラル系",  
  "過去購入品を優先",  
  "胃に優しい処方",  
  "更年期・ホルモンケア向け",  
\];

function SearchPageInner() {  
  const searchParams \= useSearchParams();  
  const \[selectedSymptoms, setSelectedSymptoms\] \= useState\<string\[\]\>(\[\]);  
  const \[selectedFilters, setSelectedFilters\] \= useState\<string\[\]\>(\[\]);  
  const \[results, setResults\] \= useState\<ProductSearchResult\[\] | null\>(null);  
  const \[loading, setLoading\] \= useState(false);  
  const \[error, setError\] \= useState\<string | null\>(null);

  useEffect(() \=\> {  
    const fromChat \= searchParams.get("symptoms");  
    if (fromChat) {  
      const symptoms \= decodeURIComponent(fromChat).split(",").filter(Boolean);  
      if (symptoms.length \> 0\) {  
        setSelectedSymptoms(symptoms);  
        void runSearch(symptoms, \[\]);  
      }  
    }  
    // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, \[\]);

  function toggleSymptom(label: string) {  
    setSelectedSymptoms((prev) \=\>  
      prev.includes(label) ? prev.filter((s) \=\> s \!== label) : \[...prev, label\]  
    );  
  }

  function toggleFilter(label: string) {  
    setSelectedFilters((prev) \=\>  
      prev.includes(label) ? prev.filter((f) \=\> f \!== label) : \[...prev, label\]  
    );  
  }

  async function runSearch(symptoms: string\[\], filters: string\[\]) {  
    if (symptoms.length \=== 0\) return;  
    setLoading(true);  
    setError(null);  
    try {  
      setResults(await searchProducts(symptoms, filters));  
    } catch (e: unknown) {  
      setError(e instanceof Error ? e.message : "エラーが発生しました");  
    } finally {  
      setLoading(false);  
    }  
  }

  return (  
    \<main className="max-w-6xl mx-auto px-6 py-8"\>  
      \<div className="mb-6"\>  
        \<h1 className="text-3xl font-bold text-gray-900"\>薬を探す\</h1\>  
        \<p className="text-sm text-gray-500 mt-1"\>  
          症状を選ぶとOTC医薬品を価格順に一覧表示します(推奨順ではありません)。  
        \</p\>  
      \</div\>

      \<div className="flex gap-8 items-start"\>  
        \<div className="flex-1 min-w-0"\>  
          \<div className="bg-white rounded-xl shadow p-6 mb-4"\>  
            \<p className="text-sm font-semibold text-gray-700 mb-4"\>  
              今の症状を選んでください \<span className="text-xs font-normal text-gray-400"\>（複数選択可）\</span\>  
            \</p\>  
            \<div className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-testid="symptom-grid"\>  
              {SYMPTOMS.map(({ label, icon }) \=\> {  
                const selected \= selectedSymptoms.includes(label);  
                return (  
                  \<button  
                    key={label}  
                    onClick={() \=\> toggleSymptom(label)}  
                    data-testid="symptom-chip"  
                    className={\`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${  
                      selected  
                        ? "bg-indigo-50 border-2 border-indigo-500 text-indigo-700 font-semibold shadow-sm"  
                        : "bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40"  
                    }\`}  
                  \>  
                    \<span className="text-xl leading-none shrink-0"\>{icon}\</span\>  
                    \<span className="text-sm leading-tight"\>{label}\</span\>  
                  \</button\>  
                );  
              })}  
            \</div\>  
          \</div\>

          \<div className="bg-white rounded-xl shadow p-5 mb-4"\>  
            \<p className="text-sm font-semibold text-gray-700 mb-3"\>  
              絞り込みオプション \<span className="text-xs font-normal text-gray-400"\>（任意）\</span\>  
            \</p\>  
            \<div className="flex flex-wrap gap-2" data-testid="filter-chips"\>  
              {FILTERS.map((label) \=\> {  
                const selected \= selectedFilters.includes(label);  
                return (  
                  \<button  
                    key={label}  
                    onClick={() \=\> toggleFilter(label)}  
                    data-testid="filter-chip"  
                    className={\`text-sm px-4 py-2 rounded-full border transition-all ${  
                      selected  
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"  
                        : "bg-white border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600"  
                    }\`}  
                  \>  
                    {label}  
                  \</button\>  
                );  
              })}  
            \</div\>  
          \</div\>

          \<button  
            onClick={() \=\> runSearch(selectedSymptoms, selectedFilters)}  
            disabled={selectedSymptoms.length \=== 0 || loading}  
            data-testid="search-button"  
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base disabled:opacity-40 hover:bg-indigo-700 transition-colors"  
          \>  
            {loading ? "検索中..." : "🔍 探す"}  
          \</button\>

          {error && (  
            \<div className="bg-red-100 text-red-700 rounded-xl p-4 mt-4 text-sm" data-testid="error-message"\>  
              {error}  
            \</div\>  
          )}

          {results && (  
            \<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6" data-testid="result-grid"\>  
              {results.length \=== 0 ? (  
                \<p className="text-gray-400 text-sm col-span-2"\>  
                  該当する商品が見つかりませんでした。薬剤師または登録販売者にご相談ください。  
                \</p\>  
              ) : (  
                results.map((p) \=\> (  
                  \<div key={p.jan\_code} className="bg-white rounded-xl shadow p-5" data-testid="product-card"\>  
                    \<div className="flex items-start justify-between mb-2"\>  
                      \<h3 className="font-bold text-sm text-gray-900"\>{p.name}\</h3\>  
                      {p.is\_qualified ? (  
                        \<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap"\>  
                          税制対象  
                        \</span\>  
                      ) : null}  
                    \</div\>  
                    \<p className="text-xs text-gray-500 mb-1"\>{p.category}\</p\>  
                    \<p className="text-xs text-gray-600 mb-2"\>{p.efficacy}\</p\>  
                    {p.overlap\_warning && (  
                      \<p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-2" data-testid="overlap-warning"\>  
                        ⚠ 服用中の薬と成分が重複する可能性があります。薬剤師にご相談ください。  
                      \</p\>  
                    )}  
                    \<p className="font-semibold text-amber-600 text-sm mb-3"\>¥{p.price.toLocaleString()}\</p\>  
                    \<Link  
                      href={\`/products/${p.jan\_code}\`}  
                      className="block text-center bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"  
                      data-testid="product-detail-link"  
                    \>  
                      詳細・購入  
                    \</Link\>  
                  \</div\>  
                ))  
              )}  
            \</div\>  
          )}  
        \</div\>

        \<div className="w-80 xl:w-96 shrink-0 sticky top-20 bg-indigo-50 rounded-xl p-4 text-xs text-indigo-600 leading-relaxed"\>  
          \<p className="font-semibold text-indigo-700 mb-1"\>ご利用上の注意\</p\>  
          本一覧は添付文書の効能・効果に基づく参考情報であり、特定の商品を推奨するものではありません。  
          用法・用量は必ず添付文書をご確認ください。  
        \</div\>  
      \</div\>  
    \</main\>  
  );  
}

export default function SearchPage() {  
  return (  
    \<Suspense fallback={null}\>  
      \<SearchPageInner /\>  
    \</Suspense\>  
  );  
}

*  Step 3: 型チェックを実行する

Run: cd frontend && npx tsc \--noEmit Expected: エラーなし(Task 11の/products/\[jan\_code\]が無いためLinkの遷移先自体はまだ動作しないが型チェックはHrefの型を検証しないため通る)

*  Step 4: コミット

cd frontend  
git add lib/api.ts app/chat/page.tsx app/search  
git rm \-r app/symptom  
git commit \-m "feat: rewrite chat and replace AI-reasoning symptom page with deterministic /search list (req 4.1/4.2)"

---

## Task 11: 商品詳細ページ /products/\[jan\_code\] の新規作成(4.2/4.3)

Files:

* Create: frontend/app/products/\[jan\_code\]/page.tsx  
*  Step 1: frontend/app/products/\[jan\_code\]/page.tsx を作成する

"use client";  
import { useState, useEffect, useCallback } from "react";  
import { useParams } from "next/navigation";  
import {  
  lookupJan,  
  getProductVendors,  
  addPurchase,  
  type Product,  
  type VendorListing,  
} from "@/lib/api";

const today \= () \=\> new Date().toISOString().split("T")\[0\];

export default function ProductDetailPage() {  
  const params \= useParams\<{ jan\_code: string }\>();  
  const janCode \= params.jan\_code;

  const \[product, setProduct\] \= useState\<Product | null\>(null);  
  const \[vendors, setVendors\] \= useState\<VendorListing\[\]\>(\[\]);  
  const \[error, setError\] \= useState\<string | null\>(null);

  const \[price, setPrice\] \= useState("");  
  const \[purchasedAt, setPurchasedAt\] \= useState(today());  
  const \[storeName, setStoreName\] \= useState("");  
  const \[purpose, setPurpose\] \= useState("");  
  const \[memo, setMemo\] \= useState("");  
  const \[submitting, setSubmitting\] \= useState(false);  
  const \[success, setSuccess\] \= useState(false);

  const load \= useCallback(async () \=\> {  
    setError(null);  
    try {  
      const \[p, v\] \= await Promise.all(\[lookupJan(janCode), getProductVendors(janCode)\]);  
      setProduct(p);  
      setVendors(v);  
      if (v.length \> 0\) {  
        setPrice(String(v\[0\].price));  
        setStoreName(v\[0\].store\_name);  
      }  
    } catch (e: unknown) {  
      setError(e instanceof Error ? e.message : "商品情報の取得に失敗しました");  
    }  
  }, \[janCode\]);

  useEffect(() \=\> {  
    void load();  
  }, \[load\]);

  async function handleRegister() {  
    if (\!product || \!price) return;  
    setSubmitting(true);  
    setError(null);  
    try {  
      await addPurchase({  
        jan\_code: product.jan\_code,  
        price: parseInt(price, 10),  
        quantity: 1,  
        purchased\_at: purchasedAt,  
        store\_name: storeName || undefined,  
        purpose: purpose || undefined,  
        memo: memo || undefined,  
      });  
      setSuccess(true);  
    } catch (e: unknown) {  
      setError(e instanceof Error ? e.message : "登録に失敗しました");  
    } finally {  
      setSubmitting(false);  
    }  
  }

  if (error && \!product) {  
    return (  
      \<main className="max-w-2xl mx-auto px-6 py-8"\>  
        \<div className="bg-red-100 text-red-700 rounded-xl p-4 text-sm" data-testid="error-message"\>  
          {error}  
        \</div\>  
      \</main\>  
    );  
  }

  if (\!product) {  
    return \<main className="max-w-2xl mx-auto px-6 py-8 text-gray-400 text-sm"\>読み込み中...\</main\>;  
  }

  return (  
    \<main className="max-w-2xl mx-auto px-6 py-8" data-testid="product-detail"\>  
      \<div className="bg-white rounded-xl shadow p-6 mb-4"\>  
        \<div className="flex items-start justify-between mb-3"\>  
          \<h1 className="text-xl font-bold text-gray-900"\>{product.name}\</h1\>  
          {product.is\_qualified ? (  
            \<span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"\>  
              ✓ 税制対象  
            \</span\>  
          ) : null}  
        \</div\>  
        \<p className="text-sm text-gray-500 mb-4"\>{product.generic\_name}\</p\>

        \<dl className="space-y-3 text-sm"\>  
          \<div\>  
            \<dt className="font-semibold text-gray-700"\>効能・効果\</dt\>  
            \<dd className="text-gray-600"\>{product.efficacy}\</dd\>  
          \</div\>  
          \<div\>  
            \<dt className="font-semibold text-gray-700"\>用法・用量\</dt\>  
            \<dd className="text-gray-600"\>{product.dosage}\</dd\>  
          \</div\>  
          \<div\>  
            \<dt className="font-semibold text-gray-700"\>副作用\</dt\>  
            \<dd className="text-gray-600"\>{product.side\_effects}\</dd\>  
          \</div\>  
          \<div\>  
            \<dt className="font-semibold text-gray-700"\>してはいけないこと・相談すること\</dt\>  
            \<dd className="text-gray-600"\>{product.precautions}\</dd\>  
          \</div\>  
        \</dl\>

        \<a  
          href={product.pdf\_url}  
          target="\_blank"  
          rel="noopener noreferrer"  
          data-testid="pdf-link"  
          className="inline-block mt-4 text-indigo-600 text-sm font-medium underline"  
        \>  
          添付文書(公式情報)を見る ↗  
        \</a\>  
      \</div\>

      \<div className="bg-white rounded-xl shadow p-6 mb-4"\>  
        \<h2 className="font-bold text-sm text-gray-900 mb-3"\>購入先(複数店舗)\</h2\>  
        \<div className="space-y-2" data-testid="vendor-list"\>  
          {vendors.map((v, i) \=\> (  
            \<div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2"\>  
              \<div\>  
                \<p className="text-sm font-medium"\>{v.store\_name}\</p\>  
                \<p className="text-xs text-gray-400"\>{v.in\_stock ? "在庫あり" : "在庫切れ"}\</p\>  
              \</div\>  
              \<div className="flex items-center gap-3"\>  
                \<p className="text-sm font-semibold text-amber-600"\>¥{v.price.toLocaleString()}\</p\>  
                \<a  
                  href={v.url}  
                  target="\_blank"  
                  rel="noopener noreferrer"  
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg"  
                  data-testid="vendor-purchase-link"  
                \>  
                  購入ページへ  
                \</a\>  
              \</div\>  
            \</div\>  
          ))}  
        \</div\>  
      \</div\>

      \<div className="bg-white rounded-xl shadow p-6"\>  
        \<h2 className="font-bold text-sm text-gray-900 mb-3"\>お薬手帳に登録\</h2\>

        {success && (  
          \<div className="bg-green-100 text-green-800 rounded-xl p-3 mb-4 text-sm font-medium" data-testid="success-message"\>  
            ✓ お薬手帳に登録しました  
          \</div\>  
        )}  
        {error && (  
          \<div className="bg-red-100 text-red-700 rounded-xl p-3 mb-4 text-sm" data-testid="error-message"\>  
            {error}  
          \</div\>  
        )}

        \<div className="grid grid-cols-2 gap-3 mb-3"\>  
          \<div\>  
            \<label className="block text-xs text-gray-500 mb-1"\>購入金額（円）\</label\>  
            \<input  
              type="number"  
              value={price}  
              onChange={(e) \=\> setPrice(e.target.value)}  
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"  
              data-testid="price-input"  
            /\>  
          \</div\>  
          \<div\>  
            \<label className="block text-xs text-gray-500 mb-1"\>購入日\</label\>  
            \<input  
              type="date"  
              value={purchasedAt}  
              onChange={(e) \=\> setPurchasedAt(e.target.value)}  
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"  
            /\>  
          \</div\>  
        \</div\>  
        \<div className="mb-3"\>  
          \<label className="block text-xs text-gray-500 mb-1"\>店舗名\</label\>  
          \<input  
            type="text"  
            value={storeName}  
            onChange={(e) \=\> setStoreName(e.target.value)}  
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"  
          /\>  
        \</div\>  
        \<div className="mb-3"\>  
          \<label className="block text-xs text-gray-500 mb-1"\>使用目的（任意）\</label\>  
          \<input  
            type="text"  
            value={purpose}  
            onChange={(e) \=\> setPurpose(e.target.value)}  
            placeholder="例: 頭痛のため"  
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"  
            data-testid="purpose-input"  
          /\>  
        \</div\>  
        \<div className="mb-4"\>  
          \<label className="block text-xs text-gray-500 mb-1"\>メモ（任意）\</label\>  
          \<textarea  
            value={memo}  
            onChange={(e) \=\> setMemo(e.target.value)}  
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"  
            data-testid="memo-input"  
          /\>  
        \</div\>  
        \<button  
          onClick={handleRegister}  
          disabled={\!price || submitting}  
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"  
          data-testid="register-button"  
        \>  
          {submitting ? "登録中..." : "お薬手帳に登録する"}  
        \</button\>  
      \</div\>  
    \</main\>  
  );  
}

*  Step 2: 型チェックを実行する

Run: cd frontend && npx tsc \--noEmit Expected: エラーなし

*  Step 3: コミット

cd frontend  
git add app/products  
git commit \-m "feat: add product detail page with PDF link, vendor list, and purchase-log registration (req 4.2/4.3)"

---

## Task 12: /history ページに使用目的・メモを表示

Files:

* Modify: frontend/app/history/page.tsx:68-93  
*  Step 1: 購入履歴カードの表示部分を書き換える

frontend/app/history/page.tsx:68-93 を以下に置き換える:  
         {displayed.map((p, i) \=\> (  
            \<div  
              key={p.id}  
              className={\`flex justify-between items-center px-4 py-3 ${  
                i \< displayed.length \- 1 ? "border-b border-gray-100" : ""  
              }\`}  
            \>  
              \<div\>  
                \<p className="font-medium text-sm"\>{p.product\_name}\</p\>  
                \<p className="text-xs text-gray-400"\>  
                  {p.purchased\_at}  
                  {p.store\_name ? \` · ${p.store\_name}\` : ""}  
                \</p\>  
                {p.purpose && (  
                  \<p className="text-xs text-indigo-500 mt-0.5" data-testid="purchase-purpose"\>  
                    目的: {p.purpose}  
                  \</p\>  
                )}  
                {p.memo && (  
                  \<p className="text-xs text-gray-400 mt-0.5" data-testid="purchase-memo"\>  
                    {p.memo}  
                  \</p\>  
                )}  
              \</div\>  
              \<div className="text-right"\>  
                \<p className="font-semibold text-amber-600 text-sm"\>  
                  ¥{p.price.toLocaleString()}  
                \</p\>  
                {p.is\_qualified ? (  
                  \<span className="text-xs text-green-600"\>税制対象\</span\>  
                ) : (  
                  \<span className="text-xs text-gray-400"\>対象外\</span\>  
                )}  
              \</div\>  
            \</div\>  
          ))}

*  Step 2: 型チェックを実行する

Run: cd frontend && npx tsc \--noEmit Expected: エラーなし

*  Step 3: コミット

cd frontend  
git add app/history/page.tsx  
git commit \-m "feat: display purpose/memo on purchase history cards (req 4.5)"

---

## Task 13: scan/page.tsx に使用目的・メモの入力欄を追加

Files:

* Modify: frontend/app/scan/page.tsx  
*  Step 1: state追加(ファイル冒頭のuseState群に追記)

frontend/app/scan/page.tsx:9-16 を以下に置き換える:  
 const \[janCode, setJanCode\] \= useState("");  
  const \[product, setProduct\] \= useState\<Product | null\>(null);  
  const \[price, setPrice\] \= useState("");  
  const \[purchasedAt, setPurchasedAt\] \= useState(today());  
  const \[storeName, setStoreName\] \= useState("");  
  const \[purpose, setPurpose\] \= useState("");  
  const \[memo, setMemo\] \= useState("");  
  const \[error, setError\] \= useState\<string | null\>(null);  
  const \[success, setSuccess\] \= useState(false);  
  const \[loading, setLoading\] \= useState(false);

*  Step 2: handleAddに purpose/memo を含める

frontend/app/scan/page.tsx内のhandleAdd関数を以下に置き換える:  
 async function handleAdd() {  
    if (\!product || \!price) return;  
    setLoading(true);  
    setError(null);  
    try {  
      await addPurchase({  
        jan\_code: product.jan\_code,  
        price: parseInt(price, 10),  
        quantity: 1,  
        purchased\_at: purchasedAt,  
        store\_name: storeName || undefined,  
        purpose: purpose || undefined,  
        memo: memo || undefined,  
      });  
      setSuccess(true);  
      setJanCode("");  
      setProduct(null);  
      setPrice("");  
      setStoreName("");  
      setPurpose("");  
      setMemo("");  
      setPurchasedAt(today());  
    } catch (e: unknown) {  
      setError(e instanceof Error ? e.message : "追加に失敗しました");  
    } finally {  
      setLoading(false);  
    }  
  }

*  Step 3: 店舗名入力欄の直後(送信ボタンの直前)に入力欄を追加する

frontend/app/scan/page.tsxの「店舗名（任意）」の\<div\>ブロックの直後に、handleAddボタンの直前に以下を挿入する:  
         \<div className="mb-3"\>  
            \<label className="block text-xs text-gray-500 mb-1"\>  
              使用目的（任意）  
            \</label\>  
            \<input  
              type="text"  
              value={purpose}  
              onChange={(e) \=\> setPurpose(e.target.value)}  
              placeholder="例: 頭痛のため"  
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"  
              data-testid="purpose-input"  
            /\>  
          \</div\>

          \<div className="mb-4"\>  
            \<label className="block text-xs text-gray-500 mb-1"\>  
              メモ（任意）  
            \</label\>  
            \<textarea  
              value={memo}  
              onChange={(e) \=\> setMemo(e.target.value)}  
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"  
              data-testid="memo-input"  
            /\>  
          \</div\>

*  Step 4: 型チェックを実行する

Run: cd frontend && npx tsc \--noEmit Expected: エラーなし

*  Step 5: コミット

cd frontend  
git add app/scan/page.tsx  
git commit \-m "feat: add purpose/memo inputs to JAN scan purchase form (req 4.5)"

---

## Task 14: NavBar の更新

Files:

* Modify: frontend/components/NavBar.tsx:5-11  
*  Step 1: NAV\_ITEMS を書き換える

const NAV\_ITEMS \= \[  
  { href: "/chat",    label: "AIに相談" },  
  { href: "/search",  label: "薬を探す" },  
  { href: "/scan",    label: "薬を登録" },  
  { href: "/history", label: "購入履歴" },  
  { href: "/tax",     label: "税制レポート" },  
\] as const;

*  Step 2: 型チェックとlintを実行する

Run: cd frontend && npx tsc \--noEmit && npm run lint Expected: エラーなし

*  Step 3: コミット

cd frontend  
git add components/NavBar.tsx  
git commit \-m "feat: update nav order to lead with chat consultation (req screen spec)"

---

## Task 15: E2Eテストの更新(チャット→検索→詳細→登録の一連フロー)

Files:

* Create: frontend/e2e/chat-search-flow.spec.ts  
*  Step 1: frontend/e2e/chat-search-flow.spec.ts を作成する

import { test, expect } from "@playwright/test";

test.describe("AIチャット相談 → 検索結果 → 商品詳細 → お薬手帳登録", () \=\> {  
  test("症状入力から購入登録までの一連の流れ", async ({ page }) \=\> {  
    await page.goto("/chat");

    await page.getByTestId("chat-input").fill("頭が痛いです");  
    await page.getByTestId("send-button").click();

    await expect(page.getByTestId("assistant-bubble").last()).toContainText("頭痛・発熱");  
    await expect(page.getByTestId("go-to-search-button")).toBeVisible();  
    await page.getByTestId("go-to-search-button").click();

    await expect(page).toHaveURL(/\\/search\\?symptoms=/);  
    await expect(page.getByTestId("result-grid")).toBeVisible();

    const firstCard \= page.getByTestId("product-card").first();  
    await expect(firstCard).toBeVisible();  
    await firstCard.getByTestId("product-detail-link").click();

    await expect(page.getByTestId("product-detail")).toBeVisible();  
    await expect(page.getByTestId("pdf-link")).toBeVisible();  
    await expect(page.getByTestId("vendor-list")).toBeVisible();

    await page.getByTestId("price-input").fill("980");  
    await page.getByTestId("purpose-input").fill("頭痛のため");  
    await page.getByTestId("register-button").click();

    await expect(page.getByTestId("success-message")).toBeVisible();  
  });

  test("重篤症状の入力で受診推奨バナーが表示される", async ({ page }) \=\> {  
    await page.goto("/chat");  
    await page.getByTestId("chat-input").fill("息が苦しいです");  
    await page.getByTestId("send-button").click();  
    await expect(page.getByTestId("escalation-banner")).toBeVisible();  
    await expect(page.getByTestId("go-to-search-button")).not.toBeVisible();  
  });  
});

*  Step 2: E2Eテストを実行する

Run: cd frontend && npx playwright test chat-search-flow.spec.ts Expected: PASS (2 passed)。バックエンド(uv run uvicorn main:app \--reload)とフロントエンド(npm run dev)を両方起動した状態で実行すること。

*  Step 3: コミット

cd frontend  
git add e2e/chat-search-flow.spec.ts  
git commit \-m "test: add E2E coverage for chat-to-purchase flow (req 4.1-4.3)"

---

## Task 16: 全体テストの最終確認

*  Step 1: バックエンド全テストを実行する

Run: cd backend && uv run pytest \-v Expected: PASS(全件)

*  Step 2: フロントエンド型チェック・lintを実行する

Run: cd frontend && npx tsc \--noEmit && npm run lint Expected: エラーなし

*  Step 3: フロントエンドE2E全体を実行する

Run: cd frontend && npx playwright test Expected: PASS(全件。既存のscan-flow.spec.tsを含む)

*  Step 4: 手動確認

uv run uvicorn main:app \--reload(backend)とnpm run dev(frontend)を起動し、ブラウザで/chat→/search→/products/\[jan\_code\]→/historyの一連の画面遷移を目視確認する。  
