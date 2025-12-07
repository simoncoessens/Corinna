"""Models for Service Categorizer."""
from pydantic import BaseModel


class Classification(BaseModel):
    """DSA classification result."""
    is_in_scope: bool
    service_category: str  # "Mere Conduit", "Caching", "Hosting", "Not Applicable"
    is_online_platform: bool
    is_marketplace: bool
    is_search_engine: bool
    is_vlop_vlose: bool
    reasoning: str


class Obligation(BaseModel):
    """A DSA obligation."""
    article: str
    title: str
    description: str
    category: str  # Which service category this applies to


class ObligationAnalysis(BaseModel):
    """Analysis of an obligation for a specific company."""
    article: str
    title: str
    applies: bool
    implications: str
    action_items: list[str]


class ComplianceReport(BaseModel):
    """Final compliance assessment report."""
    company_name: str
    classification: Classification
    obligation_analyses: list[ObligationAnalysis]
    summary: str
    
    def to_json(self) -> str:
        return self.model_dump_json(indent=2)

