"""Shape/encoding/file-safety checks; no game-rule or AI simulation."""
import copy
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from render_turn import update


HTML = ('<main>Test</main><script type="application/json" id="gpt-reversi-bootstrap">null</script>'
        '<script type="application/json" id="gpt-reversi-command">null</script>')


def snapshot():
    return {"format": "reversi-in-chat-1", "gameId": "test-game", "revision": 1,
            "rows": ["........", "........", "...B....", "...BB...", "...BW...", "........", "........", "........"],
            "turn": "W", "history": [{"side": "B", "cell": "D3", "flipped": ["D4"], "source": "human"}], "receipts": []}


def embedded(html, identifier):
    return json.loads(re.search(r'<script type="application/json" id="' + identifier + r'">(.*?)</script>', html, re.S)[1])


class RenderTurnTests(unittest.TestCase):
    def test_metadata_and_escaped_text_roundtrip(self):
        state = snapshot()
        state["note"] = '</script><script>alert("x")</script> 日本語 & >'
        rendered = update(HTML, state, "C5")
        self.assertEqual(embedded(rendered, "gpt-reversi-bootstrap"), state)
        command = embedded(rendered, "gpt-reversi-command")
        self.assertEqual({key: command[key] for key in ("gameId", "expectedRevision", "cell")},
                         {"gameId": "test-game", "expectedRevision": 1, "cell": "C5"})
        self.assertRegex(command["commandId"], r"^[a-f0-9-]{36}$")
        self.assertIn(r"\u003c/script>", rendered)
        self.assertNotIn('</script><script>alert', rendered)
        self.assertEqual(rendered.count("</script>"), 2)

    def test_rejects_malformed_snapshot_fields_and_entries(self):
        replacements = [("format", "other"), ("turn", "B"), ("gameId", ""), ("gameId", "a/b"),
                        ("gameId", 1), ("revision", True), ("revision", -1), ("revision", 61),
                        ("rows", "........"), ("rows", ["........"] * 7), ("rows", ["XXXXXXXX"] * 8),
                        ("history", {}), ("history", []), ("history", [None]),
                        ("receipts", {}), ("receipts", [None]),
                        ("receipts", [{"commandId": "bad/id", "cell": "C5", "expectedRevision": 1}]),
                        ("receipts", [{"commandId": "ok", "cell": "I5", "expectedRevision": 1}]),
                        ("receipts", [{"commandId": "ok", "cell": "C5", "expectedRevision": True}])]
        for key, value in replacements:
            with self.subTest(key=key, value=value):
                state = snapshot()
                state[key] = value
                with self.assertRaises(ValueError):
                    update(HTML, state, "C5")
        for key, value in [("side", "X"), ("cell", "A0"), ("flipped", "D4"), ("flipped", []),
                           ("flipped", [None]), ("source", "chat-gpt")]:
            with self.subTest(history_field=key, value=value):
                state = snapshot()
                state["history"][0][key] = value
                with self.assertRaises(ValueError):
                    update(HTML, state, "C5")
        for malformed in (None, [], "state"):
            with self.assertRaises(ValueError):
                update(HTML, malformed, "C5")

    def test_rejects_invalid_chosen_coordinate(self):
        for cell in (None, 42, "I1", "A0", "A9", "A1\n", "a1"):
            with self.subTest(cell=cell), self.assertRaises(ValueError):
                update(HTML, snapshot(), cell)

    def test_cli_invalid_input_never_overwrites_html(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            path = Path(directory)
            html_path, state_path = path / "game.html", path / "turn.json"
            original = HTML.encode("utf-8")
            invalid = copy.deepcopy(snapshot())
            invalid["receipts"] = [{"commandId": "x", "cell": "A9", "expectedRevision": 1}]
            html_path.write_bytes(original)
            state_path.write_text(json.dumps(invalid), encoding="utf-8")
            result = subprocess.run([sys.executable, str(Path(__file__).with_name("render_turn.py")),
                                     "--html", str(html_path), "--snapshot", str(state_path), "--white", "C5"],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn("Invalid receipt entry", result.stderr)
            self.assertEqual(html_path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
