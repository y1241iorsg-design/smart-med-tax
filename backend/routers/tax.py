import csv
import io
import sqlite3
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from db import get_db

router = APIRouter()

THRESHOLD = 12_000
DEDUCTION_CAP = 88_000


@router.get("/tax/summary")
def tax_summary(year: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT COALESCE(SUM(p.price * p.quantity), 0) AS total "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE prod.is_qualified = 1 AND strftime('%Y', p.purchased_at) = ?",
        [str(year)],
    ).fetchone()
    total: int = row["total"]
    raw_deductible = max(0, total - THRESHOLD)
    deductible = min(raw_deductible, DEDUCTION_CAP)

    member_rows = db.execute(
        "SELECT COALESCE(p.family_member_name, '自分') AS member_name, "
        "COALESCE(SUM(p.price * p.quantity), 0) AS total "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE prod.is_qualified = 1 AND strftime('%Y', p.purchased_at) = ? "
        "GROUP BY COALESCE(p.family_member_name, '自分') "
        "ORDER BY total DESC, member_name",
        [str(year)],
    ).fetchall()

    return {
        "year": year,
        "total_qualified": total,
        "deductible_amount": deductible,
        "raw_deductible_amount": raw_deductible,
        "threshold": THRESHOLD,
        "deduction_cap": DEDUCTION_CAP,
        "is_qualified": total > THRESHOLD,
        "cap_applied": raw_deductible > DEDUCTION_CAP,
        "by_member": [
            {"name": r["member_name"], "total_qualified": r["total"]}
            for r in member_rows
        ],
    }


@router.get("/tax/export")
def tax_export(
    year: int, fmt: str, db: sqlite3.Connection = Depends(get_db)
):
    if fmt not in ("csv", "xml"):
        raise HTTPException(status_code=400, detail="format must be csv or xml")

    rows = db.execute(
        "SELECT p.purchased_at, prod.name, prod.generic_name, "
        "p.price, p.quantity, (p.price * p.quantity) AS subtotal, prod.is_qualified, "
        "COALESCE(p.family_member_name, '自分') AS family_member_name, "
        "COALESCE(p.store_name, '') AS store_name "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE strftime('%Y', p.purchased_at) = ? ORDER BY p.purchased_at",
        [str(year)],
    ).fetchall()

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        # 確定申告の医療費集計フォーム入力を想定した列構成
        writer.writerow([
            "医療を受けた方",
            "病院・薬局などの名称",
            "医療費の区分",
            "支払った医療費の額",
            "補てんされる金額",
            "購入日",
            "商品名",
            "一般名",
            "数量",
            "税制対象",
        ])
        for r in rows:
            writer.writerow([
                r["family_member_name"],
                r["store_name"] or "ドラッグストア等",
                "医薬品購入",
                r["subtotal"],
                0,
                r["purchased_at"],
                r["name"],
                r["generic_name"],
                r["quantity"],
                "○" if r["is_qualified"] else "×",
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="kakutei_shinkoku_selfmed_{year}.csv"'
                )
            },
        )

    root = ET.Element("確定申告準備_セルフメディケーション税制")
    root.set("年度", str(year))
    root.set("備考", "所得税の確定申告準備用。e-Tax公式スキーマではありません。")
    for r in rows:
        item = ET.SubElement(root, "明細")
        ET.SubElement(item, "医療を受けた方").text = r["family_member_name"]
        ET.SubElement(item, "病院薬局などの名称").text = r["store_name"] or "ドラッグストア等"
        ET.SubElement(item, "医療費の区分").text = "医薬品購入"
        ET.SubElement(item, "支払った医療費の額").text = str(r["subtotal"])
        ET.SubElement(item, "補てんされる金額").text = "0"
        ET.SubElement(item, "購入日").text = r["purchased_at"]
        ET.SubElement(item, "商品名").text = r["name"]
        ET.SubElement(item, "一般名").text = r["generic_name"]
        ET.SubElement(item, "税制対象").text = "1" if r["is_qualified"] else "0"
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={
            "Content-Disposition": (
                f'attachment; filename="kakutei_shinkoku_selfmed_{year}.xml"'
            )
        },
    )
