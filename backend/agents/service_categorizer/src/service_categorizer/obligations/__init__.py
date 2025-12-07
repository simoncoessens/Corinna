"""DSA obligation loader - loads from category-specific YAML files."""

from pathlib import Path
from typing import Any

import yaml

# Since __init__.py is inside the obligations directory, the YAML files are in the same directory
OBLIGATIONS_DIR = Path(__file__).resolve().parent

# Cache loaded obligations
_cache: dict[str, dict[str, Any]] = {}


def _load_yaml(filename: str) -> dict[str, Any]:
    """Load and cache a YAML obligation file."""
    if filename not in _cache:
        path = OBLIGATIONS_DIR / filename
        with open(path, "r", encoding="utf-8") as f:
            _cache[filename] = yaml.safe_load(f)
    return _cache[filename]


def get_category_obligations(category: str) -> dict[str, Any]:
    """Get full obligation data for a category including context."""
    files = {
        "Intermediary Service": "intermediary.yaml",
        "Hosting Service": "hosting.yaml",
        "Online Platform": "platform.yaml",
        "Online Marketplace": "marketplace.yaml",
        "VLOP/VLOSE": "vlop.yaml",
    }
    filename = files.get(category)
    if not filename:
        return {"category": category, "obligations": []}
    return _load_yaml(filename)


def get_obligations_for_classification(
    service_category: str,
    is_online_platform: bool,
    is_marketplace: bool,
    is_vlop_vlose: bool,
) -> list[dict[str, Any]]:
    """Get all applicable obligations based on classification.
    
    Returns list of obligations with full context from YAML files.
    """
    obligations = []
    
    # Base intermediary obligations always apply
    data = get_category_obligations("Intermediary Service")
    obligations.extend(data.get("obligations", []))
    
    # Add hosting obligations if hosting or higher
    if service_category == "Hosting" or is_online_platform:
        data = get_category_obligations("Hosting Service")
        obligations.extend(data.get("obligations", []))
    
    # Add platform obligations
    if is_online_platform:
        data = get_category_obligations("Online Platform")
        obligations.extend(data.get("obligations", []))
    
    # Add marketplace obligations
    if is_marketplace:
        data = get_category_obligations("Online Marketplace")
        obligations.extend(data.get("obligations", []))
    
    # Add VLOP/VLOSE obligations
    if is_vlop_vlose:
        data = get_category_obligations("VLOP/VLOSE")
        obligations.extend(data.get("obligations", []))
    
    return obligations


def get_all_category_data(
    service_category: str,
    is_online_platform: bool,
    is_marketplace: bool,
    is_vlop_vlose: bool,
) -> list[dict[str, Any]]:
    """Get full category data (including descriptions) for applicable categories."""
    categories = []
    
    categories.append(get_category_obligations("Intermediary Service"))
    
    if service_category == "Hosting" or is_online_platform:
        categories.append(get_category_obligations("Hosting Service"))
    
    if is_online_platform:
        categories.append(get_category_obligations("Online Platform"))
    
    if is_marketplace:
        categories.append(get_category_obligations("Online Marketplace"))
    
    if is_vlop_vlose:
        categories.append(get_category_obligations("VLOP/VLOSE"))
    
    return categories
