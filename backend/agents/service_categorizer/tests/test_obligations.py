"""Tests for DSA obligation fetching, including sub-articles like 24.3."""

import pytest

from service_categorizer.obligations import (
    get_obligation_by_article,
    get_obligations_for_classification,
)


def test_fetch_regular_article():
    """Test fetching a regular article number."""
    article_24 = get_obligation_by_article(24)
    
    assert article_24 is not None
    assert article_24["article"] == 24
    assert "Transparency reporting" in article_24["title"]


def test_fetch_sub_article():
    """Test fetching a sub-article like 24.3."""
    article_24_3 = get_obligation_by_article("24.3")
    
    assert article_24_3 is not None
    assert article_24_3["article"] == "24.3"
    assert "24.3" in article_24_3["title"] or "average monthly active recipients" in article_24_3["context"].lower()


def test_fetch_sub_article_as_string():
    """Test that sub-articles can be fetched with string or int-like string."""
    # Should work with "24.3" string
    article_1 = get_obligation_by_article("24.3")
    assert article_1 is not None
    
    # Should also work if we pass it as-is
    article_2 = get_obligation_by_article(article_1["article"])
    assert article_2 == article_1


def test_online_platform_base_obligations():
    """Test that Online Platform includes base obligations."""
    obligations = get_obligations_for_classification(
        service_category="Online Platform",
        is_online_platform=True,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=False,
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Should include base intermediary obligations
    assert "11" in article_numbers
    assert "12" in article_numbers
    assert "15" in article_numbers
    
    # Should include hosting obligations
    assert "16" in article_numbers
    assert "17" in article_numbers
    assert "18" in article_numbers
    
    # Should include platform obligations
    assert "20" in article_numbers
    assert "24" in article_numbers
    assert "28" in article_numbers
    
    # Should include Article 24.3
    assert "24.3" in article_numbers


def test_online_platform_sme_exemption():
    """Test that SME exemption removes Art. 20-28 but keeps 24.3."""
    obligations = get_obligations_for_classification(
        service_category="Online Platform",
        is_online_platform=True,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=True,  # SME eligible
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Base obligations should still be there
    assert "11" in article_numbers
    assert "12" in article_numbers
    assert "15" in article_numbers
    assert "16" in article_numbers
    assert "17" in article_numbers
    assert "18" in article_numbers
    
    # Platform obligations 20-28 should be REMOVED (exempted)
    assert "20" not in article_numbers
    assert "21" not in article_numbers
    assert "22" not in article_numbers
    assert "23" not in article_numbers
    assert "24" not in article_numbers  # Article 24 is exempted
    assert "25" not in article_numbers
    assert "26" not in article_numbers
    assert "27" not in article_numbers
    assert "28" not in article_numbers
    
    # BUT Article 24.3 should still be there (NOT exempted)
    assert "24.3" in article_numbers, f"Article 24.3 should NOT be exempted for SMEs. Found articles: {article_numbers}"


def test_online_platform_sme_exemption_with_vlop():
    """Test that VLOP/VLOSE cannot claim SME exemption."""
    obligations = get_obligations_for_classification(
        service_category="Online Platform",
        is_online_platform=True,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=True,  # VLOP - cannot be SME
        is_sme_exemption_eligible=True,  # Even if eligible, VLOP blocks exemption
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Should have all platform obligations (no exemption)
    assert "20" in article_numbers
    assert "24" in article_numbers
    assert "24.3" in article_numbers
    assert "28" in article_numbers
    
    # Should also have VLOP obligations
    assert "33" in article_numbers
    assert "34" in article_numbers
    assert "43" in article_numbers


def test_online_marketplace_sme_exemption():
    """Test that marketplaces do NOT get SME exemption for Section 3."""
    obligations = get_obligations_for_classification(
        service_category="Online Marketplace",
        is_online_platform=True,
        is_marketplace=True,
        is_search_engine=False,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=True,  # SME eligible, but marketplace
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Marketplaces should have ALL obligations (no SME exemption)
    assert "20" in article_numbers
    assert "24" in article_numbers
    assert "24.3" in article_numbers
    assert "28" in article_numbers
    
    # Should have marketplace-specific obligations
    assert "30" in article_numbers
    assert "31" in article_numbers
    assert "32" in article_numbers


def test_vlop_adds_extra_obligations():
    """Test that VLOP/VLOSE adds extra obligations (33-43)."""
    obligations = get_obligations_for_classification(
        service_category="Online Platform",
        is_online_platform=True,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=True,  # VLOP
        is_sme_exemption_eligible=False,
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Should have base obligations
    assert "11" in article_numbers
    assert "24" in article_numbers
    assert "24.3" in article_numbers
    
    # Should have VLOP-specific obligations added
    assert "33" in article_numbers
    assert "34" in article_numbers
    assert "35" in article_numbers
    assert "42" in article_numbers
    assert "43" in article_numbers


def test_search_engine_obligations():
    """Test that Search Engine has minimal base obligations."""
    obligations = get_obligations_for_classification(
        service_category="Search Engine",
        is_online_platform=False,
        is_marketplace=False,
        is_search_engine=True,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=False,
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Should only have base intermediary obligations
    assert "11" in article_numbers
    assert "12" in article_numbers
    assert "15" in article_numbers
    
    # Should NOT have hosting or platform obligations
    assert "16" not in article_numbers
    assert "20" not in article_numbers
    assert "24" not in article_numbers
    assert "24.3" not in article_numbers


def test_vlose_obligations():
    """Test that VLOSE (Very Large Online Search Engine) gets VLOP obligations."""
    obligations = get_obligations_for_classification(
        service_category="Search Engine",
        is_online_platform=False,
        is_marketplace=False,
        is_search_engine=True,
        is_vlop_vlose=True,  # VLOSE
        is_sme_exemption_eligible=False,
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Should have base obligations
    assert "11" in article_numbers
    assert "15" in article_numbers
    
    # Should have VLOP/VLOSE obligations added
    assert "33" in article_numbers
    assert "34" in article_numbers
    assert "43" in article_numbers


def test_mere_conduit_minimal_obligations():
    """Test that Mere Conduit has only base intermediary obligations."""
    obligations = get_obligations_for_classification(
        service_category="Mere Conduit",
        is_online_platform=False,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=False,
    )
    
    article_numbers = [str(obl["article"]) for obl in obligations]
    
    # Should only have base obligations
    assert "11" in article_numbers
    assert "15" in article_numbers
    
    # Should NOT have anything else
    assert "16" not in article_numbers
    assert "20" not in article_numbers
    assert "24" not in article_numbers
    assert "24.3" not in article_numbers
    assert "33" not in article_numbers


def test_article_24_3_content():
    """Test that Article 24.3 has the correct content about SME non-exemption."""
    article_24_3 = get_obligation_by_article("24.3")
    
    assert article_24_3 is not None
    assert "average monthly active recipients" in article_24_3["context"].lower()
    # Check for "non-exempt" or "not exempt" in title or context
    title_lower = article_24_3["title"].lower()
    context_lower = article_24_3["context"].lower()
    assert ("non-exempt" in title_lower or "non-exempt" in context_lower or 
            "not exempt" in title_lower or "not exempt" in context_lower or
            "regardless of the enterprise's size" in context_lower)


def test_obligation_ordering():
    """Test that obligations are returned in a consistent order."""
    obligations_1 = get_obligations_for_classification(
        service_category="Online Platform",
        is_online_platform=True,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=False,
    )
    
    obligations_2 = get_obligations_for_classification(
        service_category="Online Platform",
        is_online_platform=True,
        is_marketplace=False,
        is_search_engine=False,
        is_vlop_vlose=False,
        is_sme_exemption_eligible=False,
    )
    
    # Should return same order
    articles_1 = [str(obl["article"]) for obl in obligations_1]
    articles_2 = [str(obl["article"]) for obl in obligations_2]
    
    assert articles_1 == articles_2


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])
