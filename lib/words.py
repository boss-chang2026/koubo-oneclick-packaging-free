"""逐字时间戳：faster-whisper 对 A-roll 原声做词级识别，输出 words.json。

用法：python words.py <A-roll 或音频> <输出 words.json> [--model small] [--srt 原SRT]
传入 --srt 时把识别文本作为提示词，提高与原稿一致的概率；时间仍以真实音频为准，
不按字幕时长均分。
"""
import argparse, json, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("out")
    ap.add_argument("--model", default="small")
    ap.add_argument("--srt")
    a = ap.parse_args()
    from faster_whisper import WhisperModel
    prompt = None
    if a.srt:
        import re
        txt = open(a.srt, encoding="utf-8-sig").read()
        body = [l for l in txt.splitlines() if l.strip() and "-->" not in l and not re.fullmatch(r"\d+", l.strip())]
        prompt = "".join(body)[:200]
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    segs, info = model.transcribe(a.media, language="zh", word_timestamps=True, initial_prompt=prompt, vad_filter=False)
    words = []
    for s in segs:
        for w in s.words or []:
            t = w.word.strip()
            if t:
                words.append({"w": t, "s": round(w.start, 3), "e": round(w.end, 3)})
    json.dump({"source": a.media, "model": a.model, "duration": round(info.duration, 3), "words": words},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"words: {len(words)}  duration: {info.duration:.2f}s -> {a.out}")

if __name__ == "__main__":
    sys.exit(main())
