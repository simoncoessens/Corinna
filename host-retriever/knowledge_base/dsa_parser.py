"""Parser for the Digital Services Act HTML document."""
import re
import warnings
import httpx
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from .models import ArticleChunk

# Suppress XML warning for HTML content
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)


DSA_URL = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32022R2065"

# Mapping of article ranges to sections and categories
ARTICLE_METADATA = {
    # Section I: General Provisions
    (1, 2): ("General Provisions", "All Services"),
    # Section II: Liability of Providers
    (3, 9): ("Liability of Providers", "Intermediary Service"),
    # Section III: Due Diligence Obligations
    (11, 15): ("Due Diligence - All Intermediaries", "Intermediary Service"),
    (16, 18): ("Due Diligence - Hosting", "Hosting Service"),
    (19, 28): ("Due Diligence - Online Platforms", "Online Platform"),
    (29, 32): ("Due Diligence - Marketplaces", "Online Marketplace"),
    (33, 43): ("Due Diligence - VLOPs/VLOSEs", "VLOP/VLOSE"),
    # Section IV: Implementation & Enforcement
    (44, 72): ("Implementation and Enforcement", "All Services"),
    # Section V: Final Provisions
    (73, 93): ("Final Provisions", "All Services"),
}


def get_article_metadata(article_num: int) -> tuple[str, str]:
    """Get section and category for an article number."""
    for (start, end), (section, category) in ARTICLE_METADATA.items():
        if start <= article_num <= end:
            return section, category
    return "Other", "All Services"


def download_dsa_html() -> str:
    """Download DSA HTML from EUR-Lex."""
    response = httpx.get(DSA_URL, follow_redirects=True, timeout=60.0)
    response.raise_for_status()
    return response.text


def parse_dsa_document(html: str) -> list[ArticleChunk]:
    """Parse DSA HTML into article chunks."""
    soup = BeautifulSoup(html, "lxml")
    chunks: list[ArticleChunk] = []

    # Parse recitals
    chunks.extend(_parse_recitals(soup))

    # Parse articles
    chunks.extend(_parse_articles(soup))

    return chunks


def _parse_recitals(soup: BeautifulSoup) -> list[ArticleChunk]:
    """Parse recitals from DSA document."""
    chunks = []
    
    # Find all recital elements
    for element in soup.find_all("div", class_="eli-subdivision"):
        recital_id = element.get("id", "")
        if not recital_id.startswith("rct_"):
            continue
            
        recital_num = recital_id.replace("rct_", "")
        text = element.get_text(separator=" ", strip=True)
        
        if text:
            chunks.append(ArticleChunk(
                id=f"recital_{recital_num}",
                article_number=None,
                title=f"Recital {recital_num}",
                content=text,
                section="Recitals",
                category="All Services",
                chunk_type="recital",
            ))
    
    return chunks


def _parse_articles(soup: BeautifulSoup) -> list[ArticleChunk]:
    """Parse articles from DSA document."""
    chunks = []
    
    # Find article elements
    for element in soup.find_all("div", class_="eli-subdivision"):
        article_id = element.get("id", "")
        if not article_id.startswith("art_"):
            continue
            
        article_num_str = article_id.replace("art_", "")
        
        # Extract article title
        title_elem = element.find(class_="sti-art")
        title = title_elem.get_text(strip=True) if title_elem else f"Article {article_num_str}"
        
        # Extract article content
        content = element.get_text(separator="\n", strip=True)
        
        # Get metadata
        try:
            article_num = int(article_num_str)
            section, category = get_article_metadata(article_num)
        except ValueError:
            section, category = "Other", "All Services"
        
        if content:
            chunks.append(ArticleChunk(
                id=f"article_{article_num_str}",
                article_number=article_num_str,
                title=title,
                content=content,
                section=section,
                category=category,
                chunk_type="article",
            ))
    
    return chunks


def _parse_definitions(soup: BeautifulSoup) -> list[ArticleChunk]:
    """Parse definitions from Article 3."""
    chunks = []
    
    # Article 3 contains definitions - we parse it specially
    art3 = soup.find("div", id="art_3")
    if not art3:
        return chunks
    
    # Find definition points
    for point in art3.find_all("div", class_="eli-subdivision"):
        point_id = point.get("id", "")
        if "_pnt_" not in point_id:
            continue
            
        text = point.get_text(separator=" ", strip=True)
        
        # Extract definition term (usually in quotes)
        match = re.search(r"['']([^'']+)['']", text)
        term = match.group(1) if match else point_id
        
        if text:
            chunks.append(ArticleChunk(
                id=f"definition_{point_id}",
                article_number="3",
                title=f"Definition: {term}",
                content=text,
                section="Definitions",
                category="All Services",
                chunk_type="definition",
            ))
    
    return chunks

