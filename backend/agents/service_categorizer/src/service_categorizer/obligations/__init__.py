"""DSA obligation loader - loads from consolidated obligations YAML file."""

from pathlib import Path
from typing import Any

import yaml

# Since __init__.py is inside the obligations directory, the YAML file is in the same directory
OBLIGATIONS_DIR = Path(__file__).resolve().parent
OBLIGATIONS_FILE = OBLIGATIONS_DIR / "obligations.yaml"

# Cache loaded obligations
_cache: dict[str, Any] | None = None


def _load_obligations() -> dict[str, Any]:
    """Load and cache the consolidated obligations YAML file."""
    global _cache
    if _cache is None:
        with open(OBLIGATIONS_FILE, "r", encoding="utf-8") as f:
            _cache = yaml.safe_load(f)
    return _cache


def get_obligations_for_classification(
    service_category: str,
    is_online_platform: bool,
    is_marketplace: bool,
    is_search_engine: bool,
    is_vlop_vlose: bool,
    is_sme_exemption_eligible: bool,
) -> list[dict[str, Any]]:
    """Get all applicable obligations based on classification.
    
    Args:
        service_category: One of "Mere Conduit", "Caching", "Hosting", 
                         "Online Platform", "Online Marketplace", "Search Engine"
        is_online_platform: Whether the service is an online platform
        is_marketplace: Whether the service is a marketplace
        is_search_engine: Whether the service is a search engine
        is_vlop_vlose: Whether the service is a VLOP/VLOSE (≥45M EU users)
        is_sme_exemption_eligible: Whether SME exemption applies (<50 employees, <€10M turnover)
    
    Returns:
        List of obligations with full context from YAML file.
    """
    data = _load_obligations()
    all_obligations = data.get("obligations", [])

    # Build lookup by article number (supports both int and str like "24.3")
    obligation_by_article: dict[str, dict[str, Any]] = {}
    for obl in all_obligations:
        if "article" in obl:
            obligation_by_article[str(obl["article"])] = obl

    category_articles: dict[str, list[int | str]] = data.get("category_articles", {}) or {}
    size_rules: dict[str, Any] = data.get("size_rules", {}) or {}

    base_articles = category_articles.get(service_category, [])
    if not base_articles:
        return []

    # Start from base list for the category (can contain int or str like "24.3")
    selected_articles: list[int | str] = list(base_articles)

    # VLOP/VLOSE adds extra obligations (does not replace base)
    vlop_rule: dict[str, Any] = size_rules.get("vlop_vlose", {}) or {}
    if is_vlop_vlose and service_category in (vlop_rule.get("applicable_categories", []) or []):
        selected_articles.extend(vlop_rule.get("extra_articles", []) or [])

    # SME exemption removes certain obligations (rule depends on category).
    # We support multiple SME rules so Online Platforms vs Online Marketplaces can differ.
    if is_sme_exemption_eligible:
        for rule_key in ("sme_exemption_online_platform", "sme_exemption_online_marketplace"):
            sme_rule: dict[str, Any] = size_rules.get(rule_key, {}) or {}
            if not sme_rule:
                continue

            if service_category not in (sme_rule.get("applicable_categories", []) or []):
                continue

            if sme_rule.get("not_if_marketplace", False) and is_marketplace:
                continue

            if sme_rule.get("not_if_vlop_vlose", False) and is_vlop_vlose:
                continue

            exempt_articles = set(sme_rule.get("exempt_articles", []) or [])
            # Articles that are NOT exempt even if in exempt_articles (e.g., "24.3")
            not_exempt_articles = set(sme_rule.get("not_exempt_articles", []) or [])
            
            if exempt_articles:
                # Remove exempt articles, but keep not_exempt_articles even if they're in exempt_articles
                selected_articles = [
                    a for a in selected_articles 
                    if a not in exempt_articles or str(a) in not_exempt_articles
                ]

    # De-duplicate while preserving order (handle both int and str article numbers)
    seen: set[int | str] = set()
    ordered_unique_articles: list[int | str] = []
    for a in selected_articles:
        if a not in seen:
            seen.add(a)
            ordered_unique_articles.append(a)

    # Materialize obligation objects (skip if missing from YAML list)
    result: list[dict[str, Any]] = []
    for a in ordered_unique_articles:
        obl = obligation_by_article.get(str(a))
        if obl is not None:
            result.append(obl)

    return result


def get_all_obligations() -> list[dict[str, Any]]:
    """Get all obligations from the YAML file (for reference/debugging)."""
    data = _load_obligations()
    return data.get("obligations", [])


def get_obligation_by_article(article: int | str) -> dict[str, Any] | None:
    """Get a specific obligation by article number."""
    obligations = get_all_obligations()
    for obl in obligations:
        if str(obl.get("article", "")) == str(article):
            return obl
    return None
