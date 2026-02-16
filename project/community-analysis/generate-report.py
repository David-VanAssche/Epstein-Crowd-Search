#!/usr/bin/env python3
"""Generate the community platforms competitive analysis HTML report."""

import base64
import os
from pathlib import Path

SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
OUTPUT_FILE = Path(__file__).parent / "community-platforms-report.html"


def encode_screenshot(filename: str) -> str:
    """Encode a screenshot as a base64 data URI."""
    filepath = SCREENSHOTS_DIR / filename
    if not filepath.exists():
        return ""
    with open(filepath, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    return f"data:image/png;base64,{data}"


# Pre-encode all screenshots
screenshots = {}
for png in sorted(SCREENSHOTS_DIR.glob("*.png")):
    key = png.stem
    screenshots[key] = encode_screenshot(png.name)
    print(f"  Encoded {png.name} ({png.stat().st_size // 1024} KB)")

print(f"\nEncoded {len(screenshots)} screenshots")

# Platform data
platforms = [
    {
        "id": "epsteinexposed",
        "name": "Epstein Exposed",
        "url": "epsteinexposed.com",
        "screenshot": "epsteinexposed",
        "threat": "HIGH",
        "threat_color": "#ef4444",
        "tagline": "The Most Comprehensive Epstein Files Database",
        "stats": ["264,418 documents", "1,504 persons", "1,708 flights", "75 locations", "916 connections"],
        "features": [
            ("Full-text document search", True),
            ("Network graph (916 connections)", True),
            ("Flight log integration", True),
            ("Black Book vs Flights cross-ref", True),
            ("Contradictions tracker", True),
            ("Person dossiers with source badges", True),
            ("'Surprise Me' random discovery", True),
            ("AI chat / NLP search", False),
            ("Photo archive", False),
            ("Collaborative annotation", False),
        ],
        "their_advantage": "Largest document count (264K) and the most polished person-card system with multi-source badges. The 'Book vs Flights' cross-reference is unique — showing who appeared in the address book but NOT flight logs (and vice versa). Their contradictions tracker actively flags conflicting information across documents.",
        "our_advantage": "We have AI chat with citations, a 17-stage processing pipeline with cost transparency, gamification (XP/achievements), collaborative redaction solving, evidence pinboard, financial flow diagrams, and audio archive — none of which they offer.",
    },
    {
        "id": "epsteinsuite",
        "name": "Epstein Suite",
        "url": "epsteinsuite.com",
        "screenshot": "epsteinsuite",
        "threat": "HIGH",
        "threat_color": "#ef4444",
        "tagline": "AI-Powered Epstein Document Suite",
        "stats": ["207,253 documents", "4,598 emails", "16,407 photos", "3,004 flights", "31,665 entities"],
        "features": [
            ("AI Chat ('Ask Epstein AI')", True),
            ("Six Degrees connection finder", True),
            ("25+ language support", True),
            ("Live news integration", True),
            ("Photo archive (16,407)", True),
            ("Community document upload", True),
            ("Live chat room", True),
            ("Processing pipeline transparency", False),
            ("Collaborative redaction solving", False),
            ("Financial flow analysis", False),
        ],
        "their_advantage": "The 'Six Degrees of Epstein' connection finder is compelling UX. Multi-language support (25+ languages) opens the archive internationally. Live chat room creates real-time community engagement. News integration with relevance scoring connects archive documents to current events.",
        "our_advantage": "Our PathFinder graph does similar connection-finding. We add gamification, contradiction tracking, prosecutor dashboard, evidence pinboard, and a transparent 17-stage pipeline. Our entity system covers 14 types vs their flat entity list.",
    },
    {
        "id": "eftasearch",
        "name": "EFTA Search",
        "url": "eftasearch.com",
        "screenshot": "eftasearch",
        "threat": "LOW",
        "threat_color": "#22c55e",
        "tagline": "Epstein Files Transparency Archive",
        "stats": ["Document count not displayed", "Journalist-focused design"],
        "features": [
            ("Clean Google-like search", True),
            ("Curated 'DIVE IN' queries", True),
            ("Metrics dashboard", True),
            ("Feedback mechanism", True),
            ("Network visualization", False),
            ("Entity extraction", False),
            ("AI features", False),
            ("Flight/photo browsing", False),
        ],
        "their_advantage": "The minimalism IS the feature — designed for journalists who want to search and get results without distraction. Pre-built queries lower barrier to entry. Feels familiar to non-technical users.",
        "our_advantage": "We offer everything they do plus 30+ additional features. Their simplicity is elegant but limiting for deep research.",
    },
    {
        "id": "sifterlabs",
        "name": "Sifter Labs",
        "url": "epstein-files.org",
        "screenshot": "sifterlabs",
        "threat": "MEDIUM",
        "threat_color": "#f59e0b",
        "tagline": "AI-Powered Semantic Document Search",
        "stats": ["59,369 documents", "33,891 AI-processed", "188 GB document files"],
        "features": [
            ("Semantic/vector search", True),
            ("AI summaries for popular queries", True),
            ("Podcast integration", True),
            ("Analytics dashboard", True),
            ("Open-source transition planned", True),
            ("Network visualization", False),
            ("Flight/entity browsing", False),
            ("Collaborative features", False),
        ],
        "their_advantage": "Pioneered semantic search in this space — vector embeddings enable meaning-based queries rather than keyword matching. Open-source release includes 188GB of data + embeddings + processing scripts. AI summaries for popular questions save significant research time.",
        "our_advantage": "We have embeddings generated but not yet wired for search (critical gap). Once activated, we'll match their semantic search while adding 30+ features they lack. Our 17-stage pipeline is more sophisticated than their processing approach.",
    },
    {
        "id": "epsteinsecrets",
        "name": "Epstein Secrets",
        "url": "epsteinsecrets.com",
        "screenshot": "epsteinsecrets",
        "threat": "MEDIUM",
        "threat_color": "#f59e0b",
        "tagline": "Search 33K+ Docs & 70K+ Names",
        "stats": ["33,682 documents", "89,660 pages", "70,236 entities", "273,976 mentions"],
        "features": [
            ("Entity-first exploration", True),
            ("70K+ entity extraction", True),
            ("Entity type classification", True),
            ("Wikipedia integration", True),
            ("Timeline view", True),
            ("Network graph (5,500 nodes)", True),
            ("AI chat", False),
            ("Flight/photo browsing", False),
            ("Collaborative features", False),
        ],
        "their_advantage": "Entity-first approach is distinctive — rather than document-first search, this platform centers on WHO and WHAT appears most often. 70K entities with Wikipedia descriptions provide instant context. Mention counting as a ranking metric is simple but effective.",
        "our_advantage": "We support 14 entity types (vs their 3), have entity profiles with cross-referenced appearances, plus AI chat, flights, photos, financial flows, and collaborative features. Their ad placements may hurt researcher trust.",
    },
    {
        "id": "jmail",
        "name": "Jmail Ecosystem",
        "url": "jmail.world",
        "screenshot": "jmail-main",
        "threat": "MEDIUM",
        "threat_color": "#f59e0b",
        "tagline": "Epstein Email & Media Archive Suite",
        "stats": ["Email archive", "Photo archive", "Flight records", "Jikipedia wiki"],
        "features": [
            ("Email browsing (iMessage-style)", True),
            ("Photo gallery (JPhotos)", True),
            ("Flight records (JFlights)", True),
            ("AI wiki encyclopedia (Jikipedia)", True),
            ("Conversation threading", True),
            ("Network analysis", False),
            ("Document search", False),
            ("Collaborative features", False),
        ],
        "their_advantage": "Jikipedia is a genuinely novel concept — an AI-generated encyclopedia of people, places, and events from the Epstein files. Email conversation threading in an iMessage-style view makes email browsing intuitive. The ecosystem approach (separate specialized apps) provides focused UX.",
        "our_advantage": "We combine all their separated apps into one platform. We add full document search, network graph, processing pipeline, gamification, and collaborative features. Our email browser exists but lacks their threading/conversation view (gap).",
    },
    {
        "id": "epsteinunboxed",
        "name": "Epstein Unboxed",
        "url": "epsteinunboxed.com",
        "screenshot": "epsteinunboxed",
        "threat": "HIGH",
        "threat_color": "#ef4444",
        "tagline": "AI-Powered Document Analysis by FiscalNote",
        "stats": ["400K+ documents (estimated)", "Backed by FiscalNote (NYSE:NOTE)"],
        "features": [
            ("'Ask Anything' NLP search", True),
            ("Document timeline (1995-2025)", True),
            ("Key people ranked by mentions", True),
            ("Key organizations & locations", True),
            ("Roll Call news integration", True),
            ("Enterprise AI infrastructure", True),
            ("Network visualization", False),
            ("Collaborative features", False),
            ("Flight/photo browsing", False),
        ],
        "their_advantage": "The most polished, enterprise-grade platform. FiscalNote's NYSE-listed backing gives it real AI infrastructure and sustainability. 'Ask Anything' natural language interface is the most accessible for non-technical users. Document timeline with draggable year-range is excellent for temporal analysis.",
        "our_advantage": "We offer deeper investigative tools: network graph with PathFinder, prosecutor dashboard, evidence pinboard, gamification, and collaborative features. Their enterprise backing means slower community responsiveness vs our open approach.",
    },
    {
        "id": "dugganusa",
        "name": "DugganUSA Analytics",
        "url": "analytics.dugganusa.com/epstein",
        "screenshot": "dugganusa",
        "threat": "HIGH",
        "threat_color": "#ef4444",
        "tagline": "329K Documents + Free API + Multi-Visualization",
        "stats": ["329,442 DOJ documents", "ICIJ Offshore Leaks (2M+ records)", "70+ blog posts", "Free API"],
        "features": [
            ("Largest document index (329K)", True),
            ("3D network visualization", True),
            ("Sankey financial flow diagrams", True),
            ("Case timeline (1993-2026)", True),
            ("Free public API", True),
            ("ICIJ Offshore Leaks cross-ref", True),
            ("STIX threat intelligence feed", True),
            ("AI chat", False),
            ("Collaborative features", False),
            ("Photo/email browsing", False),
        ],
        "their_advantage": "The free API is a game-changer — it enables other developers to build on their data. ICIJ Offshore Leaks cross-referencing (2M+ records) is unique and powerful for financial investigation. The Sankey diagram for financial flows is genuinely innovative. Multiple visualization types (force-directed, Sankey, timeline, clusters) offer diverse analytical lenses.",
        "our_advantage": "We have AI chat, collaborative features, gamification, prosecutor dashboard, and a more comprehensive entity system. Their API-first approach is something we should emulate (critical gap).",
    },
    {
        "id": "epsteingate",
        "name": "EpsteinGate",
        "url": "epsteingate.org",
        "screenshot": "epsteingate",
        "threat": "MEDIUM",
        "threat_color": "#f59e0b",
        "tagline": "AI-Ranked Document Analysis Dashboard",
        "stats": ["25,781 documents", "Average importance score: 78.3", "ML-ranked triage"],
        "features": [
            ("AI importance scoring (0-100)", True),
            ("Lead type categorization", True),
            ("Agency tagging", True),
            ("Power mentions tracking", True),
            ("Sortable/filterable table", True),
            ("Full-text search", True),
            ("Network visualization", False),
            ("AI chat", False),
            ("Collaborative features", False),
        ],
        "their_advantage": "AI importance scoring is the standout feature — automatically ranking 25,781 documents by significance eliminates the needle-in-haystack problem. The lead-type taxonomy (sexual misconduct, financial flow, human trafficking, political influence, witness intimidation) creates structured investigative categories from unstructured documents.",
        "our_advantage": "We have a broader feature set. Their document scoring approach is something we should implement (critical gap — 'Document Importance Scoring' is in our top 10 recommendations).",
    },
    {
        "id": "epsteinwiki",
        "name": "Epstein Wiki",
        "url": "epsteinwiki.com",
        "screenshot": "epsteinwiki",
        "threat": "LOW",
        "threat_color": "#22c55e",
        "tagline": "The Wikipedia of Epstein Research",
        "stats": ["Comprehensive wiki format", "Multi-database aggregation", "Volunteer-driven"],
        "features": [
            ("Wiki-style encyclopedia", True),
            ("Multi-database aggregation", True),
            ("Whistleblower tip line", True),
            ("Survivor resources", True),
            ("Social media reconstructions", True),
            ("VR video collection", True),
            ("AI-powered search", False),
            ("Network visualization", False),
            ("Collaborative annotation", False),
        ],
        "their_advantage": "The most ambitious in scope — attempting to be the Wikipedia of Epstein research. Links to every other platform as a meta-directory. Whistleblower tip line and survivor resources show community responsibility. Creative social media clones ('Jacebook', 'Jeddit') reconstruct online profiles.",
        "our_advantage": "We offer actual investigative tools rather than curated links. Our AI chat, network graph, pipeline, and collaborative features provide primary research capabilities. Their breadth is wide but shallow.",
    },
]

# Gap analysis matrix data
gap_matrix_features = [
    "Full-text document search",
    "AI chat / NLP Q&A",
    "Semantic vector search",
    "Network graph visualization",
    "Flight log explorer",
    "Photo gallery",
    "Email browsing",
    "Black Book browser",
    "Entity extraction & profiles",
    "Entity type classification (14+)",
    "Timeline visualization",
    "Financial flow diagrams",
    "Audio archive",
    "Document importance scoring",
    "Contradiction tracker",
    "Redaction solving (crowdsourced)",
    "Evidence pinboard",
    "Gamification (XP/achievements)",
    "Processing pipeline transparency",
    "Prosecutor dashboard",
    "Corpus statistics",
    "Multi-language support",
    "Free public API",
    "Community document upload",
    "Live chat room",
    "News integration",
    "Cross-ref external data (ICIJ/FEC)",
    "Email conversation threading",
    "Bulk name lookup",
    "Co-occurrence search",
    "AI entity encyclopedia",
    "Document importance ranking",
    "Cloud file browser",
    "'Surprise Me' random discovery",
    "Whistleblower tip line",
    "Survivor resources",
]

# coverage: "yes", "partial", "no", "planned"
gap_matrix_data = {
    "Our App": [
        "yes","yes","partial","yes","yes","yes","yes","yes","yes","yes","yes","yes","yes","no","yes","yes","yes","yes","yes","yes","yes","no","no","no","no","no","no","partial","no","no","no","no","no","no","no","no"
    ],
    "Epstein Exposed": [
        "yes","no","no","yes","yes","no","no","yes","yes","no","no","no","no","no","yes","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","yes","no","no"
    ],
    "Epstein Suite": [
        "yes","yes","no","yes","yes","yes","yes","no","yes","no","no","no","no","no","no","no","no","no","no","no","no","yes","no","yes","yes","yes","no","no","no","no","no","no","no","no","no","no"
    ],
    "DugganUSA": [
        "yes","no","no","yes","no","no","no","no","no","no","yes","yes","no","no","no","no","no","no","no","no","no","no","yes","no","no","no","yes","no","no","no","no","no","no","no","no","no"
    ],
    "EpsteinGate": [
        "yes","no","no","no","no","no","no","no","no","no","no","no","no","yes","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","yes","no","no","no","no"
    ],
    "Sifter Labs": [
        "yes","no","yes","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","yes","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no"
    ],
    "Jmail": [
        "no","no","no","no","yes","yes","yes","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","no","yes","no","no","yes","no","no","no","no","no"
    ],
}

# Top 10 recommendations
recommendations = [
    {
        "rank": 1,
        "name": "Bulk Name Lookup",
        "priority": "HIGH",
        "effort": "2-3 days",
        "inspired_by": "Epstein Exposed",
        "description": "Paste 50+ names, get instant hits across all document types. Journalists and researchers frequently have lists of names they need to check against the archive. No other platform offers batch lookup.",
        "implementation": "New API route accepting a name array, querying entities table with ILIKE matching, returning grouped results per name with document/flight/email counts.",
    },
    {
        "rank": 2,
        "name": "Co-occurrence Search",
        "priority": "HIGH",
        "effort": "2-3 days",
        "inspired_by": "Epstein Exposed",
        "description": "Find documents where 2+ specific people co-appear. Critical for establishing connections between individuals. Currently requires manual cross-referencing.",
        "implementation": "Query entity_mentions table with GROUP BY document_id HAVING COUNT(DISTINCT entity_id) >= N where entities match the input names.",
    },
    {
        "rank": 3,
        "name": "Activate Semantic/Vector Search",
        "priority": "HIGH",
        "effort": "3-5 days",
        "inspired_by": "Sifter Labs",
        "description": "Embeddings already exist in the database but aren't wired to the search UI. This is our most impactful quick win — enabling meaning-based search rather than just keyword matching.",
        "implementation": "Wire existing pgvector embeddings to search API. Add embedding generation for queries via Bedrock Nova. Blend vector similarity with existing full-text search scores.",
    },
    {
        "rank": 4,
        "name": "Document Importance Scoring",
        "priority": "HIGH",
        "effort": "5-7 days",
        "inspired_by": "EpsteinGate",
        "description": "4-dimension scoring (0-100) covering: legal significance, entity density, public interest, and evidentiary value. EpsteinGate proved this eliminates the needle-in-haystack problem.",
        "implementation": "ML pipeline scoring each document on 4 dimensions. Store scores in documents table. Add sortable columns to document browser. Surface top-scored documents on dashboard.",
    },
    {
        "rank": 5,
        "name": "Cloud Storage File Browser",
        "priority": "HIGH",
        "effort": "3-5 days",
        "inspired_by": "Epstein Suite / Jmail",
        "description": "'Epstein Drive' — browse the raw archive like Google Drive. Multiple platforms offer this; our Supabase Storage bucket has the data but no browse UI.",
        "implementation": "List Supabase Storage objects via API, render in a file-tree component with preview pane, download buttons, and folder navigation.",
    },
    {
        "rank": 6,
        "name": "Free Public API Tier",
        "priority": "HIGH",
        "effort": "1-2 days",
        "inspired_by": "DugganUSA",
        "description": "10 req/min unauthenticated API access. DugganUSA's free API is a major competitive advantage — developers build tools on their data. We should enable the same ecosystem.",
        "implementation": "Rate-limited public endpoints for search, entities, flights, and documents. API key system for higher limits. OpenAPI/Swagger documentation page.",
    },
    {
        "rank": 7,
        "name": "Cross-Reference Tool",
        "priority": "HIGH",
        "effort": "3-5 days",
        "inspired_by": "Multiple platforms",
        "description": "A stub already exists at lib/chat/tools/cross-reference.ts. Complete the implementation to cross-reference entities across documents, flights, emails, and financial records.",
        "implementation": "Complete the existing stub. Query across entity_mentions, flights, emails, and financial tables for a given entity. Return a unified cross-reference report.",
    },
    {
        "rank": 8,
        "name": "AI Entity Encyclopedia",
        "priority": "MEDIUM",
        "effort": "5-7 days",
        "inspired_by": "Jmail Jikipedia",
        "description": "Auto-generated wiki-style pages for each entity, synthesizing all appearances across documents, flights, emails, and financial records into a narrative profile.",
        "implementation": "LLM-generated summaries per entity using all cross-referenced data. Cache generated profiles. Add edit/correction mechanism for community review.",
    },
    {
        "rank": 9,
        "name": "External Data Cross-Reference",
        "priority": "MEDIUM",
        "effort": "2-3 weeks",
        "inspired_by": "SomaliScan / DugganUSA",
        "description": "Cross-reference entities with FEC campaign finance, PPP loans, ICIJ Offshore Leaks, and other federal datasets. SomaliScan tracks 13M+ entities and $55T in government spending.",
        "implementation": "Ingest public datasets (FEC, ICIJ). Match entities by name/organization. Surface connections in entity profiles with source attribution.",
    },
    {
        "rank": 10,
        "name": "Email Conversation Threading",
        "priority": "MEDIUM",
        "effort": "3-5 days",
        "inspired_by": "Jmail",
        "description": "iMessage-style conversation threading for email browsing. Our email browser exists but shows flat results. Threading makes email chains readable and reveals conversation patterns.",
        "implementation": "Group emails by thread (In-Reply-To / References headers, or subject line matching). Render in a chat-bubble UI with sender avatars and timestamps.",
    },
]

# Build the HTML
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Community Platform Competitive Analysis — Epstein Crowd Research</title>
<style>
  :root {{
    --bg-primary: #18181b;
    --bg-secondary: #27272a;
    --bg-tertiary: #3f3f46;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
    --accent: #f59e0b;
    --accent-dim: #92400e;
    --green: #22c55e;
    --green-dim: #166534;
    --red: #ef4444;
    --red-dim: #991b1b;
    --yellow: #f59e0b;
    --blue: #3b82f6;
    --blue-dim: #1e3a5f;
    --border: #3f3f46;
    --sidebar-width: 260px;
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  html {{ scroll-behavior: smooth; scroll-padding-top: 80px; }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    font-size: 15px;
  }}

  /* Sidebar Navigation */
  .sidebar {{
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    z-index: 100;
    padding: 24px 0;
  }}

  .sidebar-header {{
    padding: 0 20px 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }}

  .sidebar-header h2 {{
    font-size: 14px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 4px;
  }}

  .sidebar-header p {{
    font-size: 11px;
    color: var(--text-muted);
  }}

  .nav-section {{
    padding: 0 12px;
    margin-bottom: 16px;
  }}

  .nav-section-title {{
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--text-muted);
    padding: 0 8px;
    margin-bottom: 6px;
  }}

  .nav-link {{
    display: block;
    padding: 6px 8px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    border-radius: 6px;
    transition: all 0.15s;
  }}

  .nav-link:hover, .nav-link.active {{
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }}

  .nav-link.active {{
    border-left: 2px solid var(--accent);
  }}

  /* Main Content */
  .main {{
    margin-left: var(--sidebar-width);
    padding: 40px 48px 80px;
    max-width: 1200px;
  }}

  /* Header */
  .report-header {{
    margin-bottom: 48px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
  }}

  .report-header h1 {{
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 8px;
    background: linear-gradient(135deg, var(--accent), #fbbf24);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }}

  .report-header .subtitle {{
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }}

  .report-meta {{
    display: flex;
    gap: 24px;
    font-size: 13px;
    color: var(--text-muted);
  }}

  .report-meta span {{ display: flex; align-items: center; gap: 6px; }}

  /* Stat Cards */
  .stat-cards {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }}

  .stat-card {{
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }}

  .stat-card .stat-value {{
    font-size: 36px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1.1;
  }}

  .stat-card .stat-label {{
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }}

  /* Section Headers */
  .section {{
    margin-bottom: 48px;
    scroll-margin-top: 20px;
  }}

  .section h2 {{
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--accent-dim);
  }}

  .section h2 .section-number {{
    color: var(--accent);
    margin-right: 8px;
  }}

  .section-intro {{
    color: var(--text-secondary);
    margin-bottom: 24px;
    font-size: 15px;
    max-width: 800px;
  }}

  /* Executive Summary */
  .verdict-box {{
    background: linear-gradient(135deg, var(--bg-secondary), #1c1917);
    border: 1px solid var(--accent-dim);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }}

  .verdict-box h3 {{
    color: var(--accent);
    font-size: 18px;
    margin-bottom: 12px;
  }}

  .verdict-box p {{
    color: var(--text-secondary);
    line-height: 1.7;
  }}

  .moat-gap-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 24px;
  }}

  .moat-box, .gap-box {{
    border-radius: 12px;
    padding: 20px;
    border: 1px solid;
  }}

  .moat-box {{
    background: rgba(34, 197, 94, 0.05);
    border-color: var(--green-dim);
  }}

  .moat-box h4 {{ color: var(--green); margin-bottom: 12px; font-size: 15px; }}

  .gap-box {{
    background: rgba(239, 68, 68, 0.05);
    border-color: var(--red-dim);
  }}

  .gap-box h4 {{ color: var(--red); margin-bottom: 12px; font-size: 15px; }}

  .moat-box ul, .gap-box ul {{
    list-style: none;
    padding: 0;
  }}

  .moat-box li, .gap-box li {{
    padding: 4px 0;
    font-size: 13px;
    color: var(--text-secondary);
  }}

  .moat-box li::before {{ content: "\\2713 "; color: var(--green); font-weight: bold; }}
  .gap-box li::before {{ content: "\\2717 "; color: var(--red); font-weight: bold; }}

  /* Platform Cards */
  .platform-card {{
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
    margin-bottom: 24px;
    transition: border-color 0.2s;
  }}

  .platform-card:hover {{
    border-color: var(--accent-dim);
  }}

  .platform-header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }}

  .platform-title {{
    font-size: 22px;
    font-weight: 700;
  }}

  .platform-url {{
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 2px;
  }}

  .threat-badge {{
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }}

  .platform-stats {{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }}

  .platform-stat {{
    background: var(--bg-tertiary);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary);
  }}

  .platform-screenshot {{
    width: 100%;
    border-radius: 8px;
    border: 1px solid var(--border);
    margin-bottom: 16px;
    cursor: pointer;
    transition: transform 0.2s;
  }}

  .platform-screenshot:hover {{
    transform: scale(1.01);
  }}

  .platform-features {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    margin-bottom: 16px;
  }}

  .feature-item {{
    font-size: 13px;
    padding: 3px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  .feature-yes {{ color: var(--green); }}
  .feature-no {{ color: var(--red); opacity: 0.7; }}
  .feature-dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }}
  .feature-dot.yes {{ background: var(--green); }}
  .feature-dot.no {{ background: var(--red); opacity: 0.5; }}

  .advantage-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 12px;
  }}

  .advantage-box {{
    padding: 14px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
  }}

  .advantage-box.theirs {{
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }}

  .advantage-box.ours {{
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.15);
  }}

  .advantage-box h5 {{
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }}

  .advantage-box.theirs h5 {{ color: var(--red); }}
  .advantage-box.ours h5 {{ color: var(--green); }}

  /* Gap Analysis Matrix */
  .matrix-wrapper {{
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid var(--border);
  }}

  .matrix-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 900px;
  }}

  .matrix-table th {{
    background: var(--bg-tertiary);
    padding: 10px 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    position: sticky;
    top: 0;
    z-index: 1;
    white-space: nowrap;
  }}

  .matrix-table th:first-child {{
    position: sticky;
    left: 0;
    z-index: 2;
    min-width: 240px;
  }}

  .matrix-table td {{
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    text-align: center;
  }}

  .matrix-table td:first-child {{
    text-align: left;
    position: sticky;
    left: 0;
    background: var(--bg-secondary);
    font-weight: 500;
    z-index: 1;
    border-right: 1px solid var(--border);
  }}

  .matrix-table tbody tr:hover td {{
    background: rgba(245, 158, 11, 0.03);
  }}

  .matrix-table tbody tr:hover td:first-child {{
    background: rgba(245, 158, 11, 0.08);
  }}

  .cell-yes {{ color: var(--green); font-weight: 700; }}
  .cell-no {{ color: var(--text-muted); }}
  .cell-partial {{ color: var(--yellow); font-weight: 600; }}
  .cell-planned {{ color: var(--blue); font-style: italic; }}

  /* Recommendation Cards */
  .rec-card {{
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 20px;
  }}

  .rec-rank {{
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }}

  .rec-rank.high {{ background: rgba(239, 68, 68, 0.15); color: var(--red); border: 2px solid var(--red-dim); }}
  .rec-rank.medium {{ background: rgba(245, 158, 11, 0.15); color: var(--accent); border: 2px solid var(--accent-dim); }}

  .rec-content h3 {{ font-size: 18px; margin-bottom: 4px; }}

  .rec-meta {{
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 12px;
  }}

  .rec-meta span {{
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }}

  .rec-meta .priority-high {{ background: rgba(239, 68, 68, 0.15); color: var(--red); }}
  .rec-meta .priority-medium {{ background: rgba(245, 158, 11, 0.15); color: var(--accent); }}

  .rec-description {{
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 10px;
  }}

  .rec-implementation {{
    background: var(--bg-primary);
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-muted);
    border-left: 3px solid var(--accent-dim);
  }}

  .rec-implementation strong {{ color: var(--text-secondary); }}

  /* Roadmap */
  .roadmap-sprint {{
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 16px;
  }}

  .roadmap-sprint h3 {{
    font-size: 16px;
    margin-bottom: 4px;
  }}

  .roadmap-sprint .sprint-meta {{
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }}

  .roadmap-items {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }}

  .roadmap-item {{
    background: var(--bg-primary);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    border-left: 3px solid var(--accent);
  }}

  .roadmap-item .item-effort {{
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }}

  /* Appendix */
  .appendix-section {{
    margin-bottom: 32px;
  }}

  .appendix-section h3 {{
    font-size: 16px;
    margin-bottom: 12px;
    color: var(--accent);
  }}

  .inventory-grid {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }}

  .inventory-item {{
    background: var(--bg-secondary);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }}

  .inventory-item .item-category {{
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 1px;
  }}

  /* Lightbox */
  .lightbox {{
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.9);
    z-index: 1000;
    cursor: pointer;
    align-items: center;
    justify-content: center;
  }}

  .lightbox.active {{ display: flex; }}

  .lightbox img {{
    max-width: 90%;
    max-height: 90%;
    border-radius: 8px;
  }}

  /* Screenshot group (Jmail sub-screenshots) */
  .screenshot-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }}

  .screenshot-grid img {{
    width: 100%;
    border-radius: 8px;
    border: 1px solid var(--border);
    cursor: pointer;
  }}

  /* Print Styles */
  @media print {{
    :root {{
      --bg-primary: #fff;
      --bg-secondary: #f9fafb;
      --bg-tertiary: #f3f4f6;
      --text-primary: #111;
      --text-secondary: #374151;
      --text-muted: #6b7280;
      --border: #e5e7eb;
    }}
    .sidebar {{ display: none; }}
    .main {{ margin-left: 0; padding: 20px; }}
    .platform-card, .rec-card, .roadmap-sprint {{ break-inside: avoid; }}
    .lightbox {{ display: none !important; }}
    body {{ font-size: 12px; }}
    .report-header h1 {{
      background: none;
      -webkit-text-fill-color: #92400e;
      color: #92400e;
    }}
  }}

  @media (max-width: 768px) {{
    .sidebar {{ display: none; }}
    .main {{ margin-left: 0; padding: 20px; }}
    .stat-cards {{ grid-template-columns: repeat(2, 1fr); }}
    .platform-features {{ grid-template-columns: 1fr; }}
    .advantage-grid {{ grid-template-columns: 1fr; }}
    .moat-gap-grid {{ grid-template-columns: 1fr; }}
    .inventory-grid {{ grid-template-columns: 1fr; }}
    .roadmap-items {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>

<!-- Sidebar Navigation -->
<nav class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <h2>Competitive Analysis</h2>
    <p>Epstein Crowd Research</p>
  </div>

  <div class="nav-section">
    <div class="nav-section-title">Overview</div>
    <a href="#executive-summary" class="nav-link">Executive Summary</a>
  </div>

  <div class="nav-section">
    <div class="nav-section-title">Platform Profiles</div>
"""

# Add nav links for each platform
for p in platforms:
    html += f'    <a href="#{p["id"]}" class="nav-link">{p["name"]}</a>\n'

html += """
  </div>

  <div class="nav-section">
    <div class="nav-section-title">Analysis</div>
    <a href="#gap-matrix" class="nav-link">Gap Analysis Matrix</a>
    <a href="#recommendations" class="nav-link">Top 10 Recommendations</a>
    <a href="#roadmap" class="nav-link">Implementation Roadmap</a>
    <a href="#appendix" class="nav-link">Appendix</a>
  </div>
</nav>

<!-- Lightbox -->
<div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
  <img id="lightbox-img" src="" alt="Screenshot enlarged">
</div>

<!-- Main Content -->
<div class="main">

  <!-- Report Header -->
  <header class="report-header">
    <h1>Community Platform Competitive Analysis</h1>
    <p class="subtitle">How 16 community platforms compare to Epstein Crowd Research — and what we should build next</p>
    <div class="report-meta">
      <span>Feb 15, 2026</span>
      <span>16 platforms analyzed</span>
      <span>36 features compared</span>
      <span>10 recommendations</span>
    </div>
  </header>

  <!-- Executive Summary -->
  <section class="section" id="executive-summary">
    <h2><span class="section-number">01</span> Executive Summary</h2>
    <p class="section-intro">A comprehensive analysis of the Epstein document research ecosystem, comparing 16 community-built platforms against our application across 36 feature dimensions.</p>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">16</div>
        <div class="stat-label">Platforms Analyzed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">36</div>
        <div class="stat-label">Features Compared</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">7</div>
        <div class="stat-label">Unique Moat Features</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">10</div>
        <div class="stat-label">Critical Gaps Identified</div>
      </div>
    </div>

    <div class="verdict-box">
      <h3>Verdict: Strong Position with Addressable Gaps</h3>
      <p>Our application is the <strong>most feature-complete platform in the ecosystem</strong>, with 32+ pages and 37+ API routes covering investigation, browsing, collaboration, and analysis. We hold 7 features that no competitor offers (crowdsourced redaction solving, contradiction tracking, gamification, evidence pinboard, pipeline transparency, prosecutor dashboard, and cost tracking). However, we have 10 critical gaps — most notably the lack of semantic search activation (embeddings exist but aren't wired), no public API, no bulk name lookup, and no document importance scoring. Closing these gaps would establish clear market leadership.</p>
    </div>

    <div class="moat-gap-grid">
      <div class="moat-box">
        <h4>Our Competitive Moat (No Other Platform Has These)</h4>
        <ul>
          <li>Crowdsourced redaction solving with consensus voting</li>
          <li>Contradiction tracker with community verification</li>
          <li>Gamification system (XP, achievements, cascade replay)</li>
          <li>Evidence Pinboard (visual investigation board)</li>
          <li>17-stage processing pipeline with transparency</li>
          <li>Prosecutor Dashboard with entity risk scoring</li>
          <li>Funding transparency with per-stage cost tracking</li>
        </ul>
      </div>
      <div class="gap-box">
        <h4>Critical Gaps (Features We're Missing)</h4>
        <ul>
          <li>Bulk name lookup (paste 50+ names, get hits)</li>
          <li>Co-occurrence search (docs where 2+ people appear)</li>
          <li>Semantic/vector search (embeddings exist, unwired)</li>
          <li>Document importance scoring (0-100 scale)</li>
          <li>Cloud storage file browser ("Epstein Drive")</li>
          <li>Free public API tier (10 req/min)</li>
          <li>AI entity encyclopedia (auto-generated wiki pages)</li>
          <li>External data cross-reference (FEC/PPP/ICIJ)</li>
          <li>Email conversation threading (iMessage view)</li>
          <li>Cross-reference tool (stub exists, unfinished)</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Platform Profiles -->
  <section class="section" id="platform-profiles">
    <h2><span class="section-number">02</span> Platform Profiles</h2>
    <p class="section-intro">Detailed analysis of each competitor platform, with embedded screenshots, feature inventories, and comparative advantages.</p>
"""

# Generate platform cards
for p in platforms:
    threat_bg = f"rgba({','.join(str(int(p['threat_color'][i:i+2], 16)) for i in (1, 3, 5))}, 0.15)"

    html += f"""
    <div class="platform-card" id="{p['id']}">
      <div class="platform-header">
        <div>
          <div class="platform-title">{p['name']}</div>
          <div class="platform-url">{p['url']} — {p['tagline']}</div>
        </div>
        <span class="threat-badge" style="background: {threat_bg}; color: {p['threat_color']}">{p['threat']} Threat</span>
      </div>

      <div class="platform-stats">
"""
    for stat in p["stats"]:
        html += f'        <span class="platform-stat">{stat}</span>\n'

    html += "      </div>\n"

    # Screenshot(s)
    if p["id"] == "jmail":
        # Show grid of 4 Jmail ecosystem screenshots
        jmail_shots = ["jmail-main", "jwiki", "jflights", "jphotos"]
        html += '      <div class="screenshot-grid">\n'
        for js in jmail_shots:
            if js in screenshots:
                html += f'        <img src="{screenshots[js]}" alt="{js}" class="platform-screenshot" onclick="showLightbox(this.src)" loading="lazy">\n'
        html += '      </div>\n'
    else:
        if p["screenshot"] in screenshots:
            html += f'      <img src="{screenshots[p["screenshot"]]}" alt="{p["name"]} screenshot" class="platform-screenshot" onclick="showLightbox(this.src)" loading="lazy">\n'

    # Features
    html += '      <div class="platform-features">\n'
    for feat_name, has_feat in p["features"]:
        cls = "feature-yes" if has_feat else "feature-no"
        dot = "yes" if has_feat else "no"
        html += f'        <div class="feature-item {cls}"><span class="feature-dot {dot}"></span> {feat_name}</div>\n'
    html += '      </div>\n'

    # Advantages
    html += f"""
      <div class="advantage-grid">
        <div class="advantage-box theirs">
          <h5>Their Advantage</h5>
          {p['their_advantage']}
        </div>
        <div class="advantage-box ours">
          <h5>Our Advantage</h5>
          {p['our_advantage']}
        </div>
      </div>
    </div>
"""

html += "  </section>\n\n"

# Gap Analysis Matrix
html += """
  <!-- Gap Analysis Matrix -->
  <section class="section" id="gap-matrix">
    <h2><span class="section-number">03</span> Gap Analysis Matrix</h2>
    <p class="section-intro">Feature coverage across all platforms. Green = has feature, red = missing, yellow = partial implementation, blue = planned.</p>

    <div class="matrix-wrapper">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>Feature</th>
"""

for platform_name in gap_matrix_data.keys():
    html += f"            <th>{platform_name}</th>\n"

html += """          </tr>
        </thead>
        <tbody>
"""

cell_display = {
    "yes": ('<span class="cell-yes">&#10003;</span>', "Has feature"),
    "no": ('<span class="cell-no">&#8212;</span>', "Missing"),
    "partial": ('<span class="cell-partial">&#9679;</span>', "Partial"),
    "planned": ('<span class="cell-planned">P</span>', "Planned"),
}

for i, feature in enumerate(gap_matrix_features):
    html += f"          <tr>\n            <td>{feature}</td>\n"
    for platform_name, coverage_list in gap_matrix_data.items():
        val = coverage_list[i] if i < len(coverage_list) else "no"
        display, title = cell_display.get(val, cell_display["no"])
        html += f'            <td title="{title}">{display}</td>\n'
    html += "          </tr>\n"

html += """        </tbody>
      </table>
    </div>
  </section>
"""

# Top 10 Recommendations
html += """
  <!-- Recommendations -->
  <section class="section" id="recommendations">
    <h2><span class="section-number">04</span> Top 10 Feature Recommendations</h2>
    <p class="section-intro">Ranked by impact and feasibility. These are the features that would most strengthen our competitive position.</p>
"""

for rec in recommendations:
    priority_class = "high" if rec["priority"] == "HIGH" else "medium"
    html += f"""
    <div class="rec-card">
      <div class="rec-rank {priority_class}">{rec['rank']}</div>
      <div class="rec-content">
        <h3>{rec['name']}</h3>
        <div class="rec-meta">
          <span class="priority-{priority_class}">{rec['priority']} Priority</span>
          <span>{rec['effort']}</span>
          <span>Inspired by: {rec['inspired_by']}</span>
        </div>
        <p class="rec-description">{rec['description']}</p>
        <div class="rec-implementation">
          <strong>Implementation:</strong> {rec['implementation']}
        </div>
      </div>
    </div>
"""

html += "  </section>\n\n"

# Implementation Roadmap
html += """
  <!-- Roadmap -->
  <section class="section" id="roadmap">
    <h2><span class="section-number">05</span> Implementation Roadmap</h2>
    <p class="section-intro">Sprint-based timeline for closing the top gaps, ordered by impact and dependency.</p>

    <div class="roadmap-sprint">
      <h3>Sprint 1: Quick Wins (Week 1-2)</h3>
      <div class="sprint-meta">Focus: High-impact features with minimal implementation effort</div>
      <div class="roadmap-items">
        <div class="roadmap-item">
          <strong>Free Public API Tier</strong>
          <div class="item-effort">1-2 days — Rate-limited public endpoints with API key system</div>
        </div>
        <div class="roadmap-item">
          <strong>Bulk Name Lookup</strong>
          <div class="item-effort">2-3 days — Batch name checking across all document types</div>
        </div>
        <div class="roadmap-item">
          <strong>Co-occurrence Search</strong>
          <div class="item-effort">2-3 days — Find documents where 2+ people co-appear</div>
        </div>
      </div>
    </div>

    <div class="roadmap-sprint">
      <h3>Sprint 2: Search & Discovery (Week 3-4)</h3>
      <div class="sprint-meta">Focus: Upgrading search capabilities to match and exceed competitors</div>
      <div class="roadmap-items">
        <div class="roadmap-item">
          <strong>Activate Semantic Search</strong>
          <div class="item-effort">3-5 days — Wire existing pgvector embeddings to search UI</div>
        </div>
        <div class="roadmap-item">
          <strong>Cross-Reference Tool</strong>
          <div class="item-effort">3-5 days — Complete existing stub at lib/chat/tools/cross-reference.ts</div>
        </div>
        <div class="roadmap-item">
          <strong>Cloud Storage File Browser</strong>
          <div class="item-effort">3-5 days — Browse Supabase Storage like Google Drive</div>
        </div>
      </div>
    </div>

    <div class="roadmap-sprint">
      <h3>Sprint 3: Intelligence Layer (Week 5-7)</h3>
      <div class="sprint-meta">Focus: AI-powered document analysis and entity intelligence</div>
      <div class="roadmap-items">
        <div class="roadmap-item">
          <strong>Document Importance Scoring</strong>
          <div class="item-effort">5-7 days — 4-dimension ML scoring pipeline (0-100)</div>
        </div>
        <div class="roadmap-item">
          <strong>AI Entity Encyclopedia</strong>
          <div class="item-effort">5-7 days — Auto-generated wiki pages per entity</div>
        </div>
        <div class="roadmap-item">
          <strong>Email Conversation Threading</strong>
          <div class="item-effort">3-5 days — iMessage-style grouped email view</div>
        </div>
      </div>
    </div>

    <div class="roadmap-sprint">
      <h3>Sprint 4: Data Fusion (Week 8-10)</h3>
      <div class="sprint-meta">Focus: External data integration for cross-referencing</div>
      <div class="roadmap-items">
        <div class="roadmap-item">
          <strong>External Data Cross-Reference</strong>
          <div class="item-effort">2-3 weeks — FEC, PPP, ICIJ Offshore Leaks integration</div>
        </div>
        <div class="roadmap-item">
          <strong>Ongoing: Refinement & Polish</strong>
          <div class="item-effort">Continuous — Based on user feedback and usage analytics</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Appendix -->
  <section class="section" id="appendix">
    <h2><span class="section-number">06</span> Appendix</h2>

    <div class="appendix-section">
      <h3>A. Our App Feature Inventory (32+ Pages)</h3>
      <div class="inventory-grid">
        <div class="inventory-item"><div class="item-category">Investigate</div>AI Chat with Citations</div>
        <div class="inventory-item"><div class="item-category">Investigate</div>Full-Text Search</div>
        <div class="inventory-item"><div class="item-category">Investigate</div>Entities (14 Types)</div>
        <div class="inventory-item"><div class="item-category">Investigate</div>Graph PathFinder</div>
        <div class="inventory-item"><div class="item-category">Investigate</div>Map (Flights & Properties)</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Sources Browser</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Flight Log Explorer</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Email Browser</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Financial Flows</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Photo Gallery</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Audio Archive</div>
        <div class="inventory-item"><div class="item-category">Browse</div>Black Book Browser</div>
        <div class="inventory-item"><div class="item-category">Collaborate</div>Redaction Solving</div>
        <div class="inventory-item"><div class="item-category">Collaborate</div>Contradiction Tracker</div>
        <div class="inventory-item"><div class="item-category">Collaborate</div>Discoveries Feed</div>
        <div class="inventory-item"><div class="item-category">Collaborate</div>Evidence Pinboard</div>
        <div class="inventory-item"><div class="item-category">Analyze</div>Timeline</div>
        <div class="inventory-item"><div class="item-category">Analyze</div>Network Analysis</div>
        <div class="inventory-item"><div class="item-category">Analyze</div>Processing Pipeline</div>
        <div class="inventory-item"><div class="item-category">Analyze</div>Corpus Statistics</div>
        <div class="inventory-item"><div class="item-category">Analyze</div>Prosecutor Dashboard</div>
        <div class="inventory-item"><div class="item-category">Detail</div>Document Viewer</div>
        <div class="inventory-item"><div class="item-category">Detail</div>Entity Profiles</div>
        <div class="inventory-item"><div class="item-category">Detail</div>Cascade Replay</div>
      </div>
    </div>

    <div class="appendix-section">
      <h3>B. Platform URLs</h3>
      <div class="inventory-grid">
        <div class="inventory-item"><div class="item-category">Search</div>epsteinexposed.com</div>
        <div class="inventory-item"><div class="item-category">Search</div>epsteinsuite.com</div>
        <div class="inventory-item"><div class="item-category">Search</div>eftasearch.com</div>
        <div class="inventory-item"><div class="item-category">Search</div>epstein-files.org (Sifter Labs)</div>
        <div class="inventory-item"><div class="item-category">Search</div>epsteinsecrets.com</div>
        <div class="inventory-item"><div class="item-category">Jmail</div>jmail.world</div>
        <div class="inventory-item"><div class="item-category">Jmail</div>jikipedia.org (Jikipedia)</div>
        <div class="inventory-item"><div class="item-category">Jmail</div>jflights.org</div>
        <div class="inventory-item"><div class="item-category">Jmail</div>jphotos.org</div>
        <div class="inventory-item"><div class="item-category">Visualization</div>epstein-doc-explorer-1.onrender.com</div>
        <div class="inventory-item"><div class="item-category">Visualization</div>epsteinweb.org</div>
        <div class="inventory-item"><div class="item-category">Visualization</div>epsteinunboxed.com</div>
        <div class="inventory-item"><div class="item-category">Visualization</div>analytics.dugganusa.com/epstein</div>
        <div class="inventory-item"><div class="item-category">Specialty</div>somaliscan.com</div>
        <div class="inventory-item"><div class="item-category">Specialty</div>epsteingate.org</div>
        <div class="inventory-item"><div class="item-category">Specialty</div>epsteinwiki.com</div>
      </div>
    </div>

    <div class="appendix-section">
      <h3>C. Data Sources</h3>
      <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.7;">
        This report was compiled from live screenshots and content analysis of each platform captured on February 15, 2026.
        Feature inventories were derived from visible UI elements, navigation menus, and publicly accessible documentation.
        Our app inventory was compiled from the Next.js App Router page structure, API route definitions, and component library.
        All screenshots are embedded as base64 data URIs for full portability.
      </p>
    </div>
  </section>

</div>

<script>
// Lightbox
function showLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  lb.classList.add('active');
}

// Scroll-spy for sidebar navigation
const sections = document.querySelectorAll('.section, .platform-card[id]');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveNav() {
  let current = '';
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= 120) {
      current = section.id;
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();

// Collapsible screenshots on click (toggle full-width)
document.querySelectorAll('.platform-screenshot').forEach(img => {
  img.style.cursor = 'pointer';
});
</script>

</body>
</html>
"""

# Write the file
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write(html)

file_size = OUTPUT_FILE.stat().st_size
print(f"\nReport written to: {OUTPUT_FILE}")
print(f"File size: {file_size / 1024 / 1024:.1f} MB")
print(f"Contains {len(screenshots)} embedded screenshots")
