import sys
import asyncio
from services.editor import transcribe_audio

async def main():
    path = r"C:\Users\алматы2\Desktop\summer 2026\Clipr\backend\assets\tracks\Malcolm_Todd_-_Earrings_Lyrics_._(SkySound.cc).mp3"
    print("Transcribing...")
    segs = transcribe_audio(path)
    for seg in segs:
        print(f"[{seg['start']:.2f} - {seg['end']:.2f}] {seg['text']}")
        words = seg.get("words", [])
        if words:
            for w in words:
                print(f"  - [{w['start']:.2f} - {w['end']:.2f}] {w['word']}")

if __name__ == "__main__":
    asyncio.run(main())
