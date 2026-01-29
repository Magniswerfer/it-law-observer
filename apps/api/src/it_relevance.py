"""
IT relevance heuristic for Danish parliamentary proposals.
Uses keyword matching to determine if a proposal is IT-relevant.
"""

IT_KEYWORDS = {
    # Danish IT terms
    "it", "digital", "internet", "software", "hardware", "computer", "computere",
    "databehandling", "data", "datasikkerhed", "cyber", "cybersikkerhed",
    "elektronisk", "elektroniske", "digitalisering", "digitaliserings",
    "algoritme", "algoritmer", "kunstig intelligens", "ai", "maskinlæring",
    "big data", "cloud", "skyen", "server", "servere", "netværk", "datanet",
    "programmering", "kodning", "open source", "fri software",

    # Privacy and GDPR related
    "persondata", "personoplysninger", "gdpr", "databeskyttelse",
    "privatlivets fred", "overvågning", "sporing",

    # Telecom and infrastructure
    "telekommunikation", "bredbånd", "fibernet", "mobilnet", "5g", "6g",
    "internetudbyder", "teleudbyder",

    # Public sector IT
    "offentlig digitalisering", "e-government", "digital forvaltning",
    "elektronisk sagsbehandling", "digital post", "nemid", "mitid",

    # Security terms
    "sikkerhed", "kryptering", "certifikat", "certifikater", "hacking",
    "dataintrusion", "malware", "virus", "trojan", "ransomware",

    # Emerging tech
    "blockchain", "kryptovaluta", "bitcoin", "nft", "metaverse",
    "quantum computing", "kvantecomputer",

    # Platform regulation
    "platform", "platforme", "sociale medier", "facebook", "google",
    "amazon", "microsoft", "apple", "tech-giganter", "tech giganter"
}

def is_it_relevant(text: str) -> bool:
    """
    Determine if a proposal text is IT-relevant based on keyword matching.

    Args:
        text: The text to analyze (title, resume, or full content)

    Returns:
        bool: True if the text contains IT-relevant keywords
    """
    if not text:
        return False

    text_lower = text.lower()

    # Check if any IT keywords appear in the text
    return any(keyword in text_lower for keyword in IT_KEYWORDS)

def extract_it_topics(text: str) -> list[str]:
    """
    Extract IT topics from text based on keyword matching.

    Args:
        text: The text to analyze

    Returns:
        list[str]: List of matched IT keywords/topics
    """
    if not text:
        return []

    text_lower = text.lower()
    matched_topics = []

    for keyword in IT_KEYWORDS:
        if keyword in text_lower:
            matched_topics.append(keyword)

    # Remove duplicates and return
    return list(set(matched_topics))
