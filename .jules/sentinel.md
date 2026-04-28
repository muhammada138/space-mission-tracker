## 2026-04-28 - [Prevent XXE in XML Parsing]
**Vulnerability:** Found standard `xml.etree.ElementTree` parsing untrusted external XML (RSS feeds) in `StarshipTestsView`.
**Learning:** Standard library XML parsers in Python are vulnerable to XML External Entity (XXE) and XML bomb (Billion Laughs) attacks.
**Prevention:** Strictly use `defusedxml.ElementTree` instead of `xml.etree.ElementTree` for parsing any untrusted or external XML data.
