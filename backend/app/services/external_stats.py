import requests

LEETCODE_URL = "https://leetcode.com/graphql"
LEETCODE_QUERY = """
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
    "github_following": 0,
    "github_profile_url": "",
}


def fetch_leetcode_stats(username: str) -> dict:
    """Sync call — run this via run_in_threadpool from async code."""
    if not username:
        return dict(DEFAULT_LEETCODE_STATS)

    stats = dict(DEFAULT_LEETCODE_STATS)
    try:
        resp = requests.post(
            LEETCODE_URL,
            json={"query": LEETCODE_QUERY, "variables": {"username": username}},
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
        pass  # leave defaults (0 / 0) if the user hasn't attended / lookup failed

    return stats


def fetch_github_stats(username: str) -> dict:
    """Sync call — run this via run_in_threadpool from async code."""
    if not username:
        return dict(DEFAULT_GITHUB_STATS)

    stats = dict(DEFAULT_GITHUB_STATS)
    try:
        resp = requests.get(
            f"https://api.github.com/users/{username}",
            headers={"User-Agent": "campus-ai"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        stats["github_public_repos"] = data.get("public_repos", 0)
        stats["github_followers"] = data.get("followers", 0)
        stats["github_following"] = data.get("following", 0)
        stats["github_profile_url"] = data.get("html_url", "")
    except requests.exceptions.RequestException:
        pass

    return stats