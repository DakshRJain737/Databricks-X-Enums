import requests
from app.core.config import settings, GITHUB_AUTH_CONFIGURED

LEETCODE_URL = "https://leetcode.com/graphql"

LEETCODE_STATS_QUERY = """
query getUserStats($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
  }
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
"""

LEETCODE_CALENDAR_QUERY = """
query userProfileCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      activeYears
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}
"""

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

GITHUB_CONTRIBUTIONS_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}
"""

DEFAULT_LEETCODE_STATS = {
    "leetcode_total_solved": 0,
    "leetcode_easy_solved": 0,
    "leetcode_medium_solved": 0,
    "leetcode_hard_solved": 0,
    "leetcode_contests_attended": 0,
    "leetcode_rating": 0.0,
    "leetcode_global_ranking": 0,
}

DEFAULT_GITHUB_STATS = {
    "github_public_repos": 0,
    "github_followers": 0,
    # NOTE: schema is frozen, so we repurpose the unused `github_following`
    # column to store total commit count instead of "users this person follows".
    # It is never read as "following" anywhere in the app.
    "github_following": 0,
    "github_profile_url": "",
}


def fetch_leetcode_stats(username: str) -> dict:
    """Sync call — run via run_in_threadpool from async code."""
    if not username:
        return dict(DEFAULT_LEETCODE_STATS)

    stats = dict(DEFAULT_LEETCODE_STATS)
    try:
        resp = requests.post(
            LEETCODE_URL,
            json={"query": LEETCODE_STATS_QUERY, "variables": {"username": username}},
            headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})

        contest = data.get("userContestRanking")
        if contest:
            stats["leetcode_contests_attended"] = contest.get("attendedContestsCount", 0)
            stats["leetcode_rating"] = round(contest.get("rating", 0.0), 2)
            stats["leetcode_global_ranking"] = contest.get("globalRanking", 0)

        matched = data.get("matchedUser")
        if matched:
            for item in matched["submitStatsGlobal"]["acSubmissionNum"]:
                diff = item["difficulty"]
                count = item["count"]
                if diff == "All":
                    stats["leetcode_total_solved"] = count
                elif diff == "Easy":
                    stats["leetcode_easy_solved"] = count
                elif diff == "Medium":
                    stats["leetcode_medium_solved"] = count
                elif diff == "Hard":
                    stats["leetcode_hard_solved"] = count
    except requests.exceptions.RequestException:
        pass  # leave defaults if the user hasn't attended / lookup failed

    return stats


def fetch_leetcode_calendar(username: str, year: int | None = None) -> dict:
    """Returns {"submissionCalendar": {unix_ts_str: count}, "totalActiveDays": int, "streak": int}"""
    empty = {"submissionCalendar": {}, "totalActiveDays": 0, "streak": 0}
    if not username:
        return empty
    try:
        resp = requests.post(
            LEETCODE_URL,
            json={"query": LEETCODE_CALENDAR_QUERY, "variables": {"username": username, "year": year}},
            headers={"Content-Type": "application/json", "Referer": "https://leetcode.com"},
            timeout=10,
        )
        resp.raise_for_status()
        matched = resp.json().get("data", {}).get("matchedUser")
        if not matched or not matched.get("userCalendar"):
            return empty
        cal = matched["userCalendar"]
        import json as _json
        return {
            "submissionCalendar": _json.loads(cal.get("submissionCalendar") or "{}"),
            "totalActiveDays": cal.get("totalActiveDays", 0),
            "streak": cal.get("streak", 0),
        }
    except requests.exceptions.RequestException:
        return empty


def fetch_github_stats(username: str) -> dict:
    """Sync call — run via run_in_threadpool from async code.
    public_repos/followers from REST; commit count (stored in github_following)
    from the commit-search API, which requires an authenticated token.
    """
    if not username:
        return dict(DEFAULT_GITHUB_STATS)

    stats = dict(DEFAULT_GITHUB_STATS)
    headers = {"User-Agent": "campus-ai"}
    if GITHUB_AUTH_CONFIGURED:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

    try:
        resp = requests.get(
            f"{settings.GITHUB_API_BASE}/users/{username}",
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        stats["github_public_repos"] = data.get("public_repos", 0)
        stats["github_followers"] = data.get("followers", 0)
        stats["github_profile_url"] = data.get("html_url", "")
    except requests.exceptions.RequestException:
        pass

    stats["github_following"] = fetch_github_commit_count(username, headers)
    return stats


def fetch_github_commit_count(username: str, headers: dict | None = None) -> int:
    """Total commit count via the commit-search API. Requires an authed
    token (search endpoints get a much lower unauthenticated rate limit,
    and cloak-preview commit search is effectively unusable without one)."""
    if not username or not GITHUB_AUTH_CONFIGURED:
        return 0
    headers = dict(headers or {})
    headers.setdefault("User-Agent", "campus-ai")
    headers.setdefault("Authorization", f"Bearer {settings.GITHUB_TOKEN}")
    headers["Accept"] = "application/vnd.github.cloak-preview+json"
    try:
        resp = requests.get(
            "https://api.github.com/search/commits",
            params={"q": f"author:{username}"},
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get("total_count", 0)
    except requests.exceptions.RequestException:
        pass
    return 0


def fetch_github_contribution_calendar(username: str) -> dict:
    """Returns {"totalContributions": int, "days": [{"date": "...", "count": int}, ...]}
    Requires GraphQL + token — REST has no contribution-graph endpoint."""
    empty = {"totalContributions": 0, "days": []}
    if not username or not GITHUB_AUTH_CONFIGURED:
        return empty
    try:
        resp = requests.post(
            GITHUB_GRAPHQL_URL,
            json={"query": GITHUB_CONTRIBUTIONS_QUERY, "variables": {"login": username}},
            headers={
                "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
                "User-Agent": "campus-ai",
            },
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()
        user = (body.get("data") or {}).get("user")
        if not user:
            return empty
        cal = user["contributionsCollection"]["contributionCalendar"]
        days = [
            {"date": d["date"], "count": d["contributionCount"]}
            for week in cal["weeks"]
            for d in week["contributionDays"]
        ]
        return {"totalContributions": cal["totalContributions"], "days": days}
    except requests.exceptions.RequestException:
        return empty