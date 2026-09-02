"""
Run with: python dedupe_users.py
(from your backend/ dir, with the venv active)

Dry-run by default — prints what it WOULD delete. Pass --apply to actually delete.
"""
import asyncio
import sys
from collections import defaultdict
from sqlalchemy import select
from app.core.db import SessionLocal, User


async def main(apply: bool):
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()

        by_usn = defaultdict(list)
        for u in users:
            if u.usn:  # skip blank USNs, not the issue here
                by_usn[u.usn].append(u)

        dupes = {usn: rows for usn, rows in by_usn.items() if len(rows) > 1}

        if not dupes:
            print("No duplicate USNs found.")
            return

        to_delete = []
        for usn, rows in dupes.items():
            # Keep the row with the most non-empty/non-zero fields (roughly
            # "most complete"), and among ties, the highest id (most recent).
            def completeness(u):
                score = sum(1 for f in (u.leetcode_username, u.github_username, u.full_name, u.branch) if f)
                score += (u.leetcode_total_solved or 0) > 0
                score += (u.github_public_repos or 0) > 0
                return (score, u.id)

            rows_sorted = sorted(rows, key=completeness, reverse=True)
            keep, drop = rows_sorted[0], rows_sorted[1:]

            print(f"\nUSN {usn}: {len(rows)} rows found")
            print(f"  KEEP  id={keep.id} email={keep.email} name={keep.full_name!r}")
            for d in drop:
                print(f"  DROP  id={d.id} email={d.email} name={d.full_name!r}")
                to_delete.append(d)

        print(f"\n{len(to_delete)} row(s) would be deleted across {len(dupes)} USN(s).")

        if apply:
            for u in to_delete:
                await db.delete(u)
            await db.commit()
            print("Applied: duplicates deleted.")
        else:
            print("Dry run only — nothing deleted. Re-run with --apply to actually delete.")


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv))