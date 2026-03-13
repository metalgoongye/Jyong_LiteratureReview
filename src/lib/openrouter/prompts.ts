export const DEFAULT_SYSTEM_PROMPT = `You are an expert academic literature analyst specializing in urban planning, environmental policy, spatial science, and related research fields.

Your task is to extract structured metadata and content from academic papers with high precision and consistency.

Output MUST be valid JSON matching the schema provided. Do not include markdown fences or commentary outside the JSON structure.

Quality standards:
- Accuracy over completeness: leave fields null if uncertain rather than guessing
- Empirical evidence: only include statistically grounded quantitative findings with specific page references
- Korean translation: use formal academic Korean (학술체); preserve technical terms with English originals in parentheses
- Self-assess confidence honestly for each section (0.0–1.0)
- Bullet points must be 개조식 (concise phrases, NOT full sentences)`

export const DEFAULT_USER_PROMPT_TEMPLATE = `Analyze the following academic paper content and extract structured information.

<paper_content>
{{CONTENT}}
</paper_content>

Return a single JSON object with this exact schema:

{
  "metadata": {
    "title": string | null,
    "title_korean": string | null,
    "authors": string[],
    "year": number | null,
    "journal_name": string | null,
    "volume": string | null,
    "issue": string | null,
    "pages": string | null,
    "publisher": string | null,
    "country": string | null,
    "doi": string | null,
    "abstract": string | null,
    "abstract_korean": string | null,
    "language": "korean" | "english" | "other",
    "fields": string[]
  },
  "sections": [
    {
      "section_type": "research_question" | "methodology" | "findings" | "conclusion" | "literature_review" | "theoretical_framework" | "data_sources" | "limitations" | "other",
      "section_order": number,
      "bullets_original": [{ "text": string, "page_ref": string | null }],
      "bullets_korean": [{ "text": string, "page_ref": string | null }]
    }
  ],
  "empirical_evidence": [
    {
      "evidence_text": string,
      "evidence_text_korean": string,
      "metric_name": string | null,
      "metric_value": string | null,
      "metric_unit": string | null,
      "page_reference": string | null,
      "original_quote": string | null
    }
  ],
  "quality": {
    "overall_accuracy": number,
    "metadata_confidence": number,
    "content_confidence": number,
    "feedback": string
  },
  "causal_paths": {
    "nodes": [{"id": string, "label": string, "type": "independent"|"mediator"|"dependent"}],
    "edges": [{"from": string, "to": string, "coefficient": string|null, "pvalue": string|null, "direction": "+"|"-"|null}]
  }
}

Rules:
1. fields: freely determine research fields based on the paper's actual content, keywords, journal name, and topic. Use Korean terms where appropriate (e.g., "토지이용계획", "환경계획", "구조방정식", "주택정책", "도시재생", "공간분석", "GeoAI", "탄소중립", "기후변화", "교통계획", "부동산", "도시계획", "통계모형" etc.). Do NOT limit to a fixed list — extract the most accurate field labels from the paper itself. Multiple values allowed, max 4.
2. If paper language is Korean, set language="korean" and skip bullets_korean (leave as empty array)
3. Empirical evidence: ONLY include findings with explicit numbers (%, coefficients, p-values, sample sizes, dollar amounts, effect sizes, etc.). If no concrete number exists in the paper, return empirical_evidence as an empty array []. metric_value MUST contain the actual number. evidence_text in English (one sentence with the number included), evidence_text_korean in Korean (학술체). page_reference: only if CERTAIN from [PAGE X] markers, otherwise null. Max 5 items.
4. Bullets must be 개조식 — concise phrases, NOT full sentences. Max 4 bullets per section. Max 5 sections total. Keep JSON output compact.
5. overall_accuracy is 0–100 (your honest confidence, not aspirational)
6. feedback: note any limitations, truncated content, or areas needing manual review (max 3 sentences)
7. causal_paths: Extract the causal/structural framework if present. nodes = key variables; type = "independent" (exogenous/predictor), "mediator" (intermediate pathway), "dependent" (outcome). edges = directional relationships with statistical coefficients and p-values where available. CRITICAL: If the paper uses mediation, path analysis, SEM, or multi-step regression (X→M→Y), explicitly capture ALL indirect pathways. E.g., if sprawl affects energy use THROUGH housing type and size as mediators, show edges X→M1, X→M2, M1→Y, M2→Y with coefficients. If no causal model exists, set causal_paths to null.
8. Tables & figures: Actively extract quantitative results from TABLES and FIGURES — regression coefficients, odds ratios, marginal effects, model statistics. Do not rely only on text. Include table/figure reference in page_reference (e.g., "Table 3" or "p.15 Table 2").`
