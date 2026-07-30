import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from symptom_categories import (
    match_categories_from_text,
    detect_severe_symptom,
    CATEGORY_PRODUCT_TERMS,
)


def test_match_categories_from_text_headache():
    assert match_categories_from_text("頭が痛いです") == ["頭痛・発熱"]


def test_match_categories_from_text_multiple():
    result = match_categories_from_text("鼻水が出て、のどが痛いです")
    assert "鼻水・鼻づまり" in result
    assert "のどの痛み" in result


def test_match_categories_from_text_no_match():
    assert match_categories_from_text("こんにちは") == []


def test_detect_severe_symptom_true():
    assert detect_severe_symptom("息が苦しいです") is True


def test_detect_severe_symptom_false():
    assert detect_severe_symptom("頭が痛いです") is False


def test_category_product_terms_cover_all_ten_categories():
    assert len(CATEGORY_PRODUCT_TERMS) == 10
    for terms in CATEGORY_PRODUCT_TERMS.values():
        assert len(terms) > 0
