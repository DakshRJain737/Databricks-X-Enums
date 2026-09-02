"""
Opportunity Gap Analysis + Heatmap logic for Placement Readiness.

Purely additive: does not touch resume text extraction, the existing
SKILL_KEYWORDS substring detection, readiness_score, or the CGPA/branch
eligibility check in placement.py. It layers a separate, continuous
"skill signal score" (0-100 per skill) on top of the same resume text,
used only to power Opportunity Gap Analysis / Heatmap / What-If.
"""
import re

REQUIRED_LEVEL = 70

STRENGTH_WORDS = [
    "expert", "advanced", "proficient", "strong", "extensive",
    "years of experience", "production", "led", "built", "architected",
]
WEAKNESS_WORDS = [
    "basic", "beginner", "familiar", "exposure", "learning", "intro",
    "introductory", "some experience",
]

NEGATION_CUES = [
    "no ", "not ", "n't ", "without ", "lack of ", "lacking ",
    "zero ", "none of ", "limited exposure to ",
]
_NEG_WINDOW = 30


def _word_boundary_pattern(skill: str) -> "re.Pattern":
    escaped = re.escape(skill)
    return re.compile(rf"(?<!\w){escaped}(?!\w)", re.IGNORECASE)


def _split_clauses(text: str):
    spans = []
    start = 0
    for m in re.finditer(r"[.\n;]+", text):
        end = m.start()
        if end > start:
            spans.append((start, end))
        start = m.end()
    if start < len(text):
        spans.append((start, len(text)))
    return spans


def _find_clause(clauses, pos):
    for s, e in clauses:
        if s <= pos < e:
            return s, e
    return pos, pos


def score_skill(skill: str, resume_text_lower: str, clauses=None) -> int:
    if clauses is None:
        clauses = _split_clauses(resume_text_lower)

    pattern = _word_boundary_pattern(skill)
    all_matches = list(pattern.finditer(resume_text_lower))
    if not all_matches:
        return 0

    positive_matches = []
    clause_texts = []
    for m in all_matches:
        s, e = _find_clause(clauses, m.start())
        clause_text = resume_text_lower[s:e]
        preceding_in_clause = resume_text_lower[s:m.start()][-_NEG_WINDOW:]
        if any(cue in preceding_in_clause for cue in NEGATION_CUES):
            continue
        positive_matches.append(m)
        clause_texts.append(clause_text)

    if not positive_matches:
        return 0

    score = 60
    score += min(len(positive_matches) - 1, 2) * 10

    for clause_text in clause_texts:
        if any(w in clause_text for w in STRENGTH_WORDS):
            score += 10
        if any(w in clause_text for w in WEAKNESS_WORDS):
            score -= 15

    return max(1, min(100, score))


def build_skill_scores(required_skills, resume_text: str) -> dict:
    lower = resume_text.lower()
    clauses = _split_clauses(lower)
    return {skill: score_skill(skill, lower, clauses) for skill in required_skills}


def state_for(score) -> str:
    if score == 0:
        return "gap"
    if score < REQUIRED_LEVEL:
        return "close"
    return "match"


def _drive_key(company, role):
    return f"{company}::{role}"


def build_heatmap(drives, skill_scores):
    all_skills = sorted({s for d in drives for s in d["skills"]})
    rows = []
    for skill in all_skills:
        cells = {}
        for drive in drives:
            key = _drive_key(drive["company"], drive["role"])
            if skill not in drive["skills"]:
                cells[key] = {"state": "not_required", "score": None}
            else:
                score = skill_scores.get(skill, 0)
                cells[key] = {"state": state_for(score), "score": score}
        rows.append({"skill": skill, "cells": cells})

    columns = [
        {"key": _drive_key(d["company"], d["role"]), "company": d["company"], "role": d["role"]}
        for d in drives
    ]
    return {"columns": columns, "rows": rows, "required_level": REQUIRED_LEVEL}


def build_gap_analysis(drives, skill_scores, eligibility):
    eligible_lookup = {_drive_key(e["company"], e["role"]): e["eligible"] for e in eligibility}

    impact = {}
    for drive in drives:
        for skill in drive["skills"]:
            score = skill_scores.get(skill, 0)
            if state_for(score) != "match":
                impact[skill] = impact.get(skill, 0) + 1

    biggest_gaps = sorted(
        ({"skill": s, "opportunities_affected": n} for s, n in impact.items()),
        key=lambda x: (-x["opportunities_affected"], x["skill"]),
    )

    drive_summaries = []
    for drive in drives:
        key = _drive_key(drive["company"], drive["role"])
        scores = [skill_scores.get(s, 0) for s in drive["skills"]]
        skill_match_pct = round(sum(scores) / len(scores), 1) if scores else 100.0
        gap_skills = [s for s in drive["skills"] if state_for(skill_scores.get(s, 0)) == "gap"]
        close_skills = [s for s in drive["skills"] if state_for(skill_scores.get(s, 0)) == "close"]
        eligible = eligible_lookup.get(key, False)
        drive_summaries.append({
            "key": key, "company": drive["company"], "role": drive["role"],
            "eligible": eligible, "skill_match_pct": skill_match_pct,
            "gap_skills": gap_skills, "close_skills": close_skills,
        })

    strong_opportunities = sum(
        1 for d in drive_summaries if d["eligible"] and d["skill_match_pct"] >= REQUIRED_LEVEL
    )

    return {
        "biggest_gaps": biggest_gaps,
        "drives": drive_summaries,
        "strong_opportunities": strong_opportunities,
        "total_opportunities": len(drives),
    }


def run_opportunity_analysis(drives, eligibility, resume_text):
    required_skills = sorted({s for d in drives for s in d["skills"]})
    skill_scores = build_skill_scores(required_skills, resume_text)
    heatmap = build_heatmap(drives, skill_scores)
    gap_analysis = build_gap_analysis(drives, skill_scores, eligibility)
    return {"skill_scores": skill_scores, "heatmap": heatmap, "gap_analysis": gap_analysis}


def simulate(drives, eligibility, skill_scores, skill, new_score):
    new_score = max(0, min(100, int(new_score)))

    before_heatmap = build_heatmap(drives, skill_scores)
    before_gap = build_gap_analysis(drives, skill_scores, eligibility)

    after_scores = dict(skill_scores)
    after_scores[skill] = new_score
    after_heatmap = build_heatmap(drives, after_scores)
    after_gap = build_gap_analysis(drives, after_scores, eligibility)

    return {
        "skill": skill,
        "before": {"score": skill_scores.get(skill, 0), "heatmap": before_heatmap, "gap_analysis": before_gap},
        "after": {"score": new_score, "heatmap": after_heatmap, "gap_analysis": after_gap},
    }
