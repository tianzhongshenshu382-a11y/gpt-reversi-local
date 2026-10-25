"""Update an in-chat HTML file. No server, network, AI, or game engine."""
import argparse
import json
import re
import uuid
from pathlib import Path


def coordinate(value):
    return isinstance(value, str) and re.fullmatch(r"[A-H][1-8]", value) is not None


def bounded_integer(value, maximum=60):
    return type(value) is int and 0 <= value <= maximum


def validate_snapshot(state):
    """Check JSON shape only; the HTML remains authoritative for game rules."""
    if not isinstance(state, dict):
        raise ValueError("Expected a snapshot object")
    if (state.get("format") != "reversi-in-chat-1" or state.get("turn") != "W"
            or not isinstance(state.get("gameId"), str)
            or re.fullmatch(r"[a-zA-Z0-9-]{1,80}", state["gameId"]) is None
            or not bounded_integer(state.get("revision"))):
        raise ValueError("Expected white-turn snapshot metadata")
    rows = state.get("rows")
    if (not isinstance(rows, list) or len(rows) != 8
            or any(not isinstance(row, str) or re.fullmatch(r"[.BW]{8}", row) is None for row in rows)):
        raise ValueError("Expected eight board rows")
    history = state.get("history")
    if not isinstance(history, list) or len(history) != state["revision"]:
        raise ValueError("Expected one history entry per revision")
    for entry in history:
        if (not isinstance(entry, dict) or entry.get("side") not in ("B", "W")
                or not coordinate(entry.get("cell"))
                or entry.get("source") != ("chat-gpt" if entry["side"] == "W" else "human")
                or not isinstance(entry.get("flipped"), list) or not 1 <= len(entry["flipped"]) <= 63
                or any(not coordinate(cell) for cell in entry["flipped"])):
            raise ValueError("Invalid history entry")
    receipts = state.get("receipts")
    if not isinstance(receipts, list) or len(receipts) > 60:
        raise ValueError("Expected a receipts array")
    for entry in receipts:
        if (not isinstance(entry, dict) or not isinstance(entry.get("commandId"), str)
                or re.fullmatch(r"[a-zA-Z0-9-]{1,100}", entry["commandId"]) is None
                or not coordinate(entry.get("cell")) or not bounded_integer(entry.get("expectedRevision"))):
            raise ValueError("Invalid receipt entry")


def embed(source, identifier, value):
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    pattern = r'(<script type="application/json" id="' + re.escape(identifier) + r'">).*?(</script>)'
    result, count = re.subn(pattern, lambda m: m[1] + payload + m[2], source, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Required state block missing: " + identifier)
    return result


def update(html, state, cell):
    validate_snapshot(state)
    if not coordinate(cell):
        raise ValueError("Expected a board coordinate")
    command = {"gameId": state["gameId"], "expectedRevision": state["revision"], "cell": cell, "commandId": str(uuid.uuid4())}
    source = embed(html, "gpt-reversi-bootstrap", state)
    return embed(source, "gpt-reversi-command", command)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--white", required=True, help="White move chosen by the chat model")
    args = parser.parse_args()
    try:
        state = json.loads(args.snapshot.read_text(encoding="utf-8"))
        updated = update(args.html.read_text(encoding="utf-8"), state, args.white.upper())
    except (OSError, ValueError) as error:
        parser.error(str(error))
    args.html.write_text(updated, encoding="utf-8")
    print(json.dumps({"html": str(args.html), "chosenWhite": args.white.upper(), "expectedRevision": state["revision"], "rulesAppliedBy": "HTML JavaScript on render"}, ensure_ascii=False))
