"""Record every comic speech bubble as an MP3 in each STEMbot's voice.

Uses Kokoro (open-source TTS that runs locally, no API key) with the same
voices as the lesson videos, so the STEMbots sound the same everywhere.

Setup (once):
    python3 -m pip install kokoro-onnx soundfile
    # model files from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
    #   kokoro-v1.0.onnx and voices-v1.0.bin -> pass their folder as --models

Run after editing src/data/comicStrips.ts:
    node scripts/comic-voices/export-lines.mjs | python3 scripts/comic-voices/generate.py --models ~/kokoro

Only new or changed lines are recorded; files land in public/comic-audio/.
Needs ffmpeg on PATH.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# speaker -> (Kokoro voice, speed, pitch shift in semitones). The four bots use
# exactly the lesson-video settings, so they sound the same everywhere.
VOICES = {
    "sophia": ("af_heart", 1.08, 1.0),     # Science, girl, warm and bubbly
    "emily": ("af_bella", 1.10, 2.0),      # Engineering, girl, bright and energetic
    "timothy": ("am_puck", 1.10, 1.5),     # Technology, boy, upbeat
    "matthew": ("am_michael", 1.06, 0.0),  # Math, boy, friendly and steady
    "host": ("am_fenrir", 1.12, 0.0),      # game-show host
    "mission": ("bf_emma", 1.05, 0.0),     # Mission Control
    "system": ("am_onyx", 0.95, 0.0),      # ship computer (robot filter added below)
}
CHORUS = ["sophia", "emily", "timothy", "matthew"]  # "all" = everyone at once

OUT = Path(__file__).resolve().parents[2] / "public" / "comic-audio"


def speakable(text: str) -> str:
    """Rewrite on-screen text so the voice reads it naturally."""
    t = text.replace("…", "... ")

    def money(m: re.Match) -> str:
        dollars = int(m.group(1).replace(",", ""))
        cents = m.group(2)
        if dollars >= 1_000_000:
            said = "one million dollars"
        elif dollars >= 1000:
            th, rest = divmod(dollars, 1000)
            said = f"{th} thousand" + (f" {rest}" if rest else "") + " dollars"
        else:
            said = f"{dollars} dollars"
        if cents:
            said += f" and {int(cents)} cents"
        return said

    t = re.sub(r"\$([\d,]+)(?:\.(\d\d))?", money, t)
    t = re.sub(r"(\d+)°C", r"\1 degrees Celsius", t)
    t = t.replace("STEMILLIONAIRE", "Stemillionaire").replace("STEMcity", "Stem City")
    t = t.replace("STEMbots", "Stem bots").replace("STEMbot", "Stem bot").replace("STEM", "Stem")
    t = t.replace("SKELD", "Skeld")
    # Shouted words in capitals would be spelled out letter by letter.
    t = re.sub(r"\b[A-Z][A-Z']+\b", lambda m: m.group(0) if m.group(0) in {"MRT", "OK"} else m.group(0)[0] + m.group(0)[1:].lower(), t)
    return t


def render(kokoro: Kokoro, speaker: str, text: str):
    voice, speed, _ = VOICES[speaker]
    samples, sr = kokoro.create(speakable(text), voice=voice, speed=speed, lang="en-us")
    return samples, sr


def pitch_filter(speaker: str) -> list[str]:
    """Raise the pitch while keeping formants, so it sounds younger, not chipmunky."""
    semitones = VOICES.get(speaker, (None, None, 0.0))[2]
    if not semitones:
        return []
    return [f"rubberband=pitch={2 ** (semitones / 12):.5f}:formant=preserved"]


def shift(samples, sr, speaker: str):
    """Apply a speaker's pitch shift in memory (used before mixing the chorus)."""
    filters = pitch_filter(speaker)
    if not filters:
        return samples
    with tempfile.NamedTemporaryFile(suffix=".wav") as src, tempfile.NamedTemporaryFile(suffix=".wav") as dst:
        sf.write(src.name, samples, sr)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src.name, "-af", filters[0], dst.name], check=True)
        out, _ = sf.read(dst.name, dtype="float32")
        return out


def to_mp3(samples, sr, dest: Path, robot: bool = False, pre: list[str] | None = None):
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, samples, sr)
        filters = (pre or []) + ["loudnorm=I=-16:TP=-1.5"]
        if robot:
            filters.insert(0, "flanger=delay=2:depth=2:speed=0.6,aecho=0.8:0.7:12:0.35")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-af", ",".join(filters),
             "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", str(dest)],
            check=True,
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, help="folder with kokoro-v1.0.onnx and voices-v1.0.bin")
    ap.add_argument("--force", action="store_true", help="re-record lines that already have a file")
    args = ap.parse_args()

    kokoro = Kokoro(str(Path(args.models) / "kokoro-v1.0.onnx"), str(Path(args.models) / "voices-v1.0.bin"))
    OUT.mkdir(parents=True, exist_ok=True)
    lines = [json.loads(l) for l in sys.stdin if l.strip()]
    keys = []
    for line in lines:
        key, speaker, text = line["key"], line["speaker"], line["text"]
        keys.append(key)
        dest = OUT / f"{key}.mp3"
        if dest.exists() and not args.force:
            continue
        if speaker == "all":
            parts = []
            for s in CHORUS:
                raw, sr = render(kokoro, s, text)
                parts.append((shift(raw, sr, s), sr))
            sr = parts[0][1]
            n = max(len(p[0]) for p in parts)
            # Tiny offsets so the chorus sounds like four friends, not one echo.
            mix = np.zeros(n + sr // 10, dtype=np.float32)
            for i, (s, _) in enumerate(parts):
                off = i * sr // 60
                mix[off:off + len(s)] += s
            samples = mix / len(parts) * 1.6
        else:
            samples, sr = render(kokoro, speaker, text)
        to_mp3(samples, sr, dest, robot=speaker == "system", pre=pitch_filter(speaker))
        print(f"recorded {key}: {text[:50]}")

    # Drop recordings of lines that no longer exist.
    for f in OUT.glob("*.mp3"):
        if f.stem not in keys:
            f.unlink()
    (OUT / "manifest.json").write_text(json.dumps(sorted(keys), indent=0) + "\n")
    print(f"{len(keys)} lines in public/comic-audio/manifest.json")


if __name__ == "__main__":
    main()
