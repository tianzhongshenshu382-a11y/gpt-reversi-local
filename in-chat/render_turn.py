"""Update an in-chat HTML file. No server, network, AI, or game engine."""
import argparse
import json
import re
import uuid
from pathlib import Path


def embed(source, identifier, value):
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    pattern = r'(<script type="application/json" id="' + re.escape(identifier) + r'">).*?(</script>)'
    result, count = re.subn(pattern, lambda m: m[1] + payload + m[2], source, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Required state block missing: " + identifier)
    return result


def update(html, state, cell):
    if state.get("format") != "reversi-in-chat-1" or state.get("turn") != "W" or not re.fullmatch(r"[A-H][1-8]", cell):
        raise ValueError("Expected a white-turn snapshot and a board coordinate")
    command = {"gameId": state["gameId"], "expectedRevision": state["revision"], "cell": cell, "commandId": str(uuid.uuid4())}
    source = embed(html, "gpt-reversi-bootstrap", state)
    return embed(source, "gpt-reversi-command", command)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--white", required=True, help="White move chosen by the chat model")
    args = parser.parse_args()
    state = json.loads(args.snapshot.read_text(encoding="utf-8"))
    updated = update(args.html.read_text(encoding="utf-8"), state, args.white.upper())
    args.html.write_text(updated, encoding="utf-8")
    print(json.dumps({"html": str(args.html), "chosenWhite": args.white.upper(), "expectedRevision": state["revision"], "rulesAppliedBy": "HTML JavaScript on render"}, ensure_ascii=False))
