import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
db.executescript((root / "src/Erb.Desktop/Database/001_initial.sql").read_text(encoding="utf-8"))
columns = {row[1] for row in db.execute("PRAGMA table_info(items)")}
assert "minimum_stock" in columns
assert "reorder_point" in columns
print("reorder_point=OK")
