"""Full end-to-end workflow test for Clipr AI.
Tests: backend health → tracks → pexels search → import → ideas → visual script → broll render → poll → schedule
"""
import json
import sys
import time
import urllib.request
import urllib.error
import uuid

BACKEND = "http://localhost:8000"
FRONTEND = "http://localhost:3000"
PASSED = 0
FAILED = 0

def test(name, fn):
    global PASSED, FAILED
    try:
        print(f"\n{'='*60}")
        print(f"TEST: {name}")
        print(f"{'='*60}")
        fn()
        PASSED += 1
        print(f"✅ PASS: {name}")
        return True
    except Exception as e:
        FAILED += 1
        print(f"❌ FAIL: {name} — {e}")
        return False

def api(method, path, body=None):
    """Call backend API, return parsed JSON."""
    url = f"{BACKEND}{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"HTTP {e.code}: {body_text[:500]}")

def frontend_get(path):
    """Call frontend URL, return status code."""
    url = f"{FRONTEND}{path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode("utf-8")[:200]
    except urllib.error.HTTPError as e:
        return e.code, ""

# =============================================================================
# TEST SUITE
# =============================================================================

# --- Backend health ---
test("Backend health endpoint", lambda: (
    print(f"  Health response: {api('GET', '/health')}") or
    None
))

# --- Music tracks ---
tracks_data = {}
def fetch_tracks():
    global tracks_data
    tracks_data = api("GET", "/api/video/tracks")
    assert "tracks" in tracks_data, f"No 'tracks' key in {list(tracks_data.keys())}"
    assert len(tracks_data["tracks"]) > 0, "No tracks returned"
    t0 = tracks_data["tracks"][0]
    assert "id" in t0 and "name" in t0 and "url" in t0, f"Track missing fields: {list(t0.keys())}"
    print(f"  Got {len(tracks_data['tracks'])} tracks. First: {t0['name']} (id={t0['id']})")

test("Fetch music tracks", fetch_tracks)

# --- Pexels search ---
pexels_result = {}
def search_pexels():
    global pexels_result
    pexels_result = api("GET", "/api/pexels/search?query=cinematic+nature&page=1")
    assert "videos" in pexels_result, f"No 'videos' in keys: {list(pexels_result.keys())}"
    assert len(pexels_result["videos"]) > 0, "No videos in Pexels search"
    v = pexels_result["videos"][0]
    print(f"  Got {len(pexels_result['videos'])} videos. First ID: {v.get('id')}")

test("Pexels search", search_pexels)

# --- Pexels import ---
imported_clips = []
def pexels_import():
    global imported_clips
    vid = pexels_result["videos"][0]
    result = api("POST", "/api/video/pexels-import", {"video_id": vid["id"]})
    assert "clip_id" in result, f"No clip_id in import response: {list(result.keys())}"
    imported_clips.append(result["clip_id"])
    print(f"  Imported clip: {result['clip_id']}")

test("Pexels clip import", pexels_import)

# --- Ideas generation (via frontend API route) ---
def ideas_gen():
    # The frontend has a Next.js API route that proxies to DeepSeek
    status, body = frontend_get("/api/generate-ideas")
    # The ideas route expects POST, so GET may 405 — just check frontend responds
    print(f"  Frontend ideas route: HTTP {status}")
    # Actually test by POSTing to the frontend
    url = f"{FRONTEND}/api/generate-ideas"
    data = json.dumps({
        "prompt": "5 quick tips for productivity",
        "product": "productivity app",
        "audience": "busy professionals",
        "tone": "casual",
        "platform": "TikTok",
    }).encode("utf-8")
    req = urllib.request.Request(url, method="POST", data=data)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            ideas = json.loads(raw)
            # Could be array or obj
            if isinstance(ideas, dict):
                ideas = ideas.get("ideas", ideas.get("data", []))
            assert isinstance(ideas, list) and len(ideas) > 0, f"Unexpected ideas format: {type(ideas)}"
            i = ideas[0]
            print(f"  Got {len(ideas)} ideas. First: '{i.get('title', i.get('hook', 'N/A'))}'")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")[:300]
        raise RuntimeError(f"Ideas failed HTTP {e.code}: {err}")

test("Generate ideas (frontend API)", ideas_gen)

# --- Visual script generation ---
visual_script = {}
def visual_script_gen():
    global visual_script
    result = api("POST", "/api/scripts/visual", {
        "idea_title": "5 tips for deep work",
        "hook_phrase": "you're doing focus wrong",
        "platform": "TikTok",
        "tone": "casual",
        "niche": "productivity",
        "product": "deep work routines",
        "email": "test@clipr.ai",
    })
    assert "scenes" in result, f"No scenes in response: {list(result.keys())[:5]}"
    scenes = result["scenes"]
    assert len(scenes) >= 3, f"Only {len(scenes)} scenes, expected >= 3"
    s0 = scenes[0]
    assert "phrase" in s0 and "film_suggestion" in s0 and "duration_seconds" in s0
    assert s0["role"] == "hook", f"First scene role: {s0['role']}, expected 'hook'"
    visual_script = result
    print(f"  Got {len(scenes)} scenes. Color grade: {result.get('color_grade', 'N/A')}")
    print(f"  Caption: {result.get('caption', 'N/A')[:80]}...")

test("Generate visual script", visual_script_gen)

# --- B-roll render ---
render_job_id = None
def broll_render():
    global render_job_id
    job_id = f"test-{uuid.uuid4().hex[:8]}"
    # Import a few more clips for variety
    if len(pexels_result["videos"]) > 1:
        for v in pexels_result["videos"][1:4]:
            try:
                r = api("POST", "/api/video/pexels-import", {"video_id": v["id"]})
                imported_clips.append(r["clip_id"])
            except Exception:
                pass
    clip_ids = imported_clips
    if len(clip_ids) < 2:
        # Reuse the one we have
        clip_ids = imported_clips * 3

    track_id = tracks_data["tracks"][0]["id"]
    scenes = visual_script["scenes"]

    result = api("POST", "/api/video/broll-render", {
        "job_id": job_id,
        "email": "test@clipr.ai",
        "scenes": scenes,
        "clip_ids": clip_ids[: max(len(clip_ids), 1)],
        "audio_file_id": track_id,
        "audio_volume": 0.6,
        "color_grade": "dark_cinematic",
        "platform": "TikTok",
        "template_id": "",
    })
    assert result.get("job_id") == job_id, f"job_id mismatch: {result}"
    assert result.get("status") == "pending", f"Status not pending: {result}"
    render_job_id = job_id
    print(f"  Render started: job_id={job_id}, status={result['status']}")

test("Start b-roll render", broll_render)

# --- Poll render status ---
def poll_render():
    assert render_job_id, "No render job to poll"
    print(f"  Polling render job {render_job_id} (waiting up to 120s)...")
    deadline = time.time() + 120
    while time.time() < deadline:
        status = api("GET", f"/api/video/render/{render_job_id}")
        st = status.get("status", "unknown")
        prog = status.get("progress", 0)
        err = status.get("error", "")
        print(f"    status={st}, progress={prog}, error='{err[:80]}'")
        if st == "done":
            print(f"  ✅ Render complete! Output: {status.get('output_url', 'N/A')}")
            return
        if st == "error":
            raise RuntimeError(f"Render failed: {err}")
        time.sleep(5)
    raise RuntimeError("Render timed out after 120s")

test("Poll render until complete", poll_render)

# --- Schedule a post ---
def schedule_post():
    status = api("GET", f"/api/video/render/{render_job_id}")
    output_url = status.get("output_url", "")
    schedule_result = api("POST", "/api/schedule", {
        "platform": "twitter",
        "output_url": output_url,
        "caption": visual_script.get("caption", "Test caption"),
        "title": visual_script.get("title", "Test video"),
        "scheduled_at": int(time.time()) + 7200,  # 2 hours from now
        "cid": "test-cid-endtoend",
    })
    print(f"  Scheduled: {json.dumps(schedule_result, indent=2)[:300]}")

test("Create schedule", schedule_post)

# =============================================================================
# SUMMARY
# =============================================================================
print(f"\n{'='*60}")
print(f"RESULTS: {PASSED} passed, {FAILED} failed out of {PASSED + FAILED} tests")
print(f"{'='*60}")

if FAILED > 0:
    print("❌ SOME TESTS FAILED — review output above")
    sys.exit(1)
else:
    print("✅ ALL TESTS PASSED — Clipr workflow is healthy!")
    sys.exit(0)
