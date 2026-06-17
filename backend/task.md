Integrate ElevenLabs Text-to-Speech into the Clipr backend.

Users can add AI voiceover to their b-roll videos.
Each scene phrase gets spoken by an AI voice at the correct timestamp.

Use the ElevenLabs Python SDK and eleven_multilingual_v2 model.
Add ELEVENLABS_API_KEY to .env

Create services/tts.py with:
- get_available_voices()
- text_to_speech(text, output_path, voice_id, speed)
- generate_voiceover_for_scenes(scenes, output_dir, voice_id, speed)

Add to services/editor.py:
- mix_voiceover_per_scene(video_path, scenes_with_audio, output_path, vo_volume, bg_music_volume)
  Each scene voiceover plays at correct timestamp, background music ducks under voice

Add to models/schemas.py BrollRenderRequest:
- add_voiceover: bool = False
- voice_id: str
- vo_speed: float = 1.0
- vo_volume: float = 1.0
- bg_music_volume: float = 0.2

Add to workers/render.py between audio mixing and text overlay steps:
- If add_voiceover is True, generate voiceover per scene then mix into video

Add endpoints to routers/video.py:
- GET /api/video/voices — list available voices
- POST /api/video/voiceover/preview — preview a voice with sample text, return base64 mp3