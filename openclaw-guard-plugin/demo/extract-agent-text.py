#!/usr/bin/env python3
import json
import sys


def main() -> int:
    data = json.load(sys.stdin)
    payloads = data.get("result", {}).get("payloads", [])
    texts = [payload.get("text", "") for payload in payloads if payload.get("text")]
    print("\n".join(texts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
