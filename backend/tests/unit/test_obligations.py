"""Unit tests for obligation loader module."""

import pytest


class TestObligationLoader:
    """Tests for obligation loader functions."""

    def test_get_category_obligations_intermediary(self):
        """Test get_category_obligations for Intermediary Service."""
        from service_categorizer.obligations import get_category_obligations
        
        data = get_category_obligations("Intermediary Service")
        
        assert "obligations" in data
        assert len(data["obligations"]) > 0

    def test_get_category_obligations_hosting(self):
        """Test get_category_obligations for Hosting Service."""
        from service_categorizer.obligations import get_category_obligations
        
        data = get_category_obligations("Hosting Service")
        
        assert "obligations" in data
        obligations = data["obligations"]
        assert len(obligations) > 0
        
        # Check obligation structure
        first = obligations[0]
        assert "article" in first or "title" in first

    def test_get_category_obligations_platform(self):
        """Test get_category_obligations for Online Platform."""
        from service_categorizer.obligations import get_category_obligations
        
        data = get_category_obligations("Online Platform")
        
        assert "obligations" in data
        assert len(data["obligations"]) > 0

    def test_get_category_obligations_marketplace(self):
        """Test get_category_obligations for Online Marketplace."""
        from service_categorizer.obligations import get_category_obligations
        
        data = get_category_obligations("Online Marketplace")
        
        assert "obligations" in data

    def test_get_category_obligations_vlop(self):
        """Test get_category_obligations for VLOP/VLOSE."""
        from service_categorizer.obligations import get_category_obligations
        
        data = get_category_obligations("VLOP/VLOSE")
        
        assert "obligations" in data
        assert len(data["obligations"]) > 0

    def test_get_category_obligations_unknown(self):
        """Test get_category_obligations returns empty for unknown category."""
        from service_categorizer.obligations import get_category_obligations
        
        data = get_category_obligations("Unknown Category")
        
        assert data["category"] == "Unknown Category"
        assert data["obligations"] == []

    def test_get_obligations_for_classification_basic_intermediary(self):
        """Test get_obligations_for_classification for basic intermediary."""
        from service_categorizer.obligations import get_obligations_for_classification
        
        obligations = get_obligations_for_classification(
            service_category="Mere Conduit",
            is_online_platform=False,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        # Should only have intermediary obligations
        assert len(obligations) > 0

    def test_get_obligations_for_classification_hosting(self):
        """Test get_obligations_for_classification for hosting service."""
        from service_categorizer.obligations import get_obligations_for_classification
        
        basic = get_obligations_for_classification(
            service_category="Mere Conduit",
            is_online_platform=False,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        hosting = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=False,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        # Hosting should have more obligations than basic
        assert len(hosting) >= len(basic)

    def test_get_obligations_for_classification_platform(self):
        """Test get_obligations_for_classification for online platform."""
        from service_categorizer.obligations import get_obligations_for_classification
        
        hosting = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=False,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        platform = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        # Platform should have more obligations
        assert len(platform) >= len(hosting)

    def test_get_obligations_for_classification_marketplace(self):
        """Test get_obligations_for_classification for marketplace."""
        from service_categorizer.obligations import get_obligations_for_classification
        
        platform = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        marketplace = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=True,
            is_vlop_vlose=False,
        )
        
        # Marketplace should have additional obligations
        assert len(marketplace) >= len(platform)

    def test_get_obligations_for_classification_vlop(self):
        """Test get_obligations_for_classification for VLOP."""
        from service_categorizer.obligations import get_obligations_for_classification
        
        platform = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=False,
            is_vlop_vlose=False,
        )
        
        vlop = get_obligations_for_classification(
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=False,
            is_vlop_vlose=True,
        )
        
        # VLOP should have additional obligations
        assert len(vlop) > len(platform)

    def test_get_obligations_caching(self):
        """Test that obligation loading is cached."""
        from service_categorizer.obligations import get_category_obligations, _cache
        
        # Clear cache
        _cache.clear()
        
        # First call should populate cache
        get_category_obligations("Intermediary Service")
        assert "intermediary.yaml" in _cache
        
        # Second call should use cache
        result = get_category_obligations("Intermediary Service")
        assert result is not None

    def test_get_all_category_data(self):
        """Test get_all_category_data returns full data."""
        from service_categorizer.obligations import get_all_category_data
        
        categories = get_all_category_data(
            service_category="Hosting",
            is_online_platform=True,
            is_marketplace=True,
            is_vlop_vlose=True,
        )
        
        # Should include all applicable categories
        assert len(categories) >= 4  # Intermediary, Hosting, Platform, Marketplace, VLOP






