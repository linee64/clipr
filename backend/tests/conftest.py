import sys
from pathlib import Path

# Make the backend package root importable so tests can `from services... import ...`
# regardless of pytest's invocation directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
