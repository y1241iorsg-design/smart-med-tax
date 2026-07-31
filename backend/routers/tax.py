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
    return {
        "year": year,
        "total_qualified": total,
        "deductible_amount": deductible,
        "raw_deductible_amount": raw_deductible,
        "threshold": THRESHOLD,
        "deduction_cap": DEDUCTION_CAP,
        "is_qualified": total > THRESHOLD,
        "cap_applied": raw_deductible > DEDUCTION_CAP,
    }


@router.get("/tax/export")
def tax_export(
    year: int, fmt: str, db: sqlite3.Connection = Depends(get_db)
):
    if fmt not in ("csv", "xml"):
        raise HTTPException(status_code=400, detail="format must be csv or xml")

    rows = db.execute(
        "SELECT p.purchased_at, prod.name, prod.generic_name, "
        "p.price, p.quantity, (p.price * p.quantity) AS subtotal, prod.is_qualified "
        "FROM purchases p JOIN products prod ON p.jan_code = prod.jan_code "
        "WHERE strftime('%Y', p.purchased_at) = ? ORDER BY p.purchased_at",
        [str(year)],
    ).fetchall()

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["購入日", "商品名", "一般名", "金額", "数量", "小計", "税制対象"])
        for r in rows:
            writer.writerow([
                r["purchased_at"], r["name"], r["generic_name"],
                r["price"], r["quantity"], r["subtotal"],
                "○" if r["is_qualified"] else "×",
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=medtax_{year}.csv"},
        )

    # XML
    root = ET.Element("医療費控除の明細書")
    root.set("年度", str(year))
    for r in rows:
        item = ET.SubElement(root, "明細")
        ET.SubElement(item, "購入日").text = r["purchased_at"]
        ET.SubElement(item, "商品名").text = r["name"]
        ET.SubElement(item, "一般名").text = r["generic_name"]
        ET.SubElement(item, "金額").text = str(r["subtotal"])
        ET.SubElement(item, "税制対象").text = "1" if r["is_qualified"] else "0"
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=medtax_{year}.xml"},
    )
