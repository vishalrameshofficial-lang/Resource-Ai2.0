"""
Local STT Service using faster-whisper.
Supports both daemon HTTP server mode and one-shot CLI mode.
"""

import sys
import os
import io
import json
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import faster_whisper with error handling
try:
    from faster_whisper import WhisperModel
    from faster_whisper.tokenizer import _LANGUAGE_CODES
    WHISPER_AVAILABLE = True
except ImportError as err:
    WHISPER_AVAILABLE = False
    IMPORT_ERROR = str(err)
    _LANGUAGE_CODES = set()

# Default model configuration
DEFAULT_MODEL = os.getenv("LOCAL_WHISPER_MODEL", "base")
DEFAULT_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
DEFAULT_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# Language code mapping preserving Indian languages
LANGUAGE_MAP = {
    'english': 'en',
    'en': 'en',
    'hindi': 'hi',
    'hi': 'hi',
    'tamil': 'ta',
    'ta': 'ta',
    'telugu': 'te',
    'te': 'te',
    'kannada': 'kn',
    'kn': 'kn',
    'malayalam': 'ml',
    'ml': 'ml',
    'bengali': 'bn',
    'bn': 'bn',
    'odia': 'or',
    'or': 'or'
}

_model_instance = None

def get_model(model_size=DEFAULT_MODEL, device=DEFAULT_DEVICE, compute_type=DEFAULT_COMPUTE_TYPE):
    global _model_instance
    if _model_instance is None:
        if not WHISPER_AVAILABLE:
            raise RuntimeError(f"faster-whisper is not installed: {IMPORT_ERROR}")
        _model_instance = WhisperModel(model_size, device=device, compute_type=compute_type)
    return _model_instance

def normalize_language(lang_input):
    """
    Normalizes language parameter. If language is not supported directly by Whisper tokenizer
    (e.g., 'or' for Odia or unknown), returns None to enable automatic language detection.
    """
    if not lang_input:
        return None
    lang_clean = str(lang_input).strip().lower()
    code = LANGUAGE_MAP.get(lang_clean, lang_clean)
    if code in _LANGUAGE_CODES:
        return code
    # If code is 'or' or unsupported in Whisper tokenizer, fallback to automatic detection
    return None

def transcribe_audio(audio_data, language=None, model=None):
    """
    Transcribes audio bytes or file-like object using faster-whisper.
    """
    if model is None:
        model = get_model()

    target_lang = normalize_language(language)

    if isinstance(audio_data, (bytes, bytearray)):
        audio_stream = io.BytesIO(audio_data)
    else:
        audio_stream = audio_data

    segments, info = model.transcribe(
        audio_stream,
        language=target_lang,
        beam_size=5,
        vad_filter=True
    )

    text_parts = []
    for segment in segments:
        text_parts.append(segment.text)

    full_text = " ".join(text_parts).strip()
    return {
        "text": full_text,
        "language": info.language if info else target_lang,
        "duration": info.duration if info else 0.0
    }

class WhisperHTTPHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Keep logs clean and silent for high-frequency checks
        pass

    def do_GET(self):
        if self.path in ('/health', '/api/health'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            payload = {
                "status": "ready" if WHISPER_AVAILABLE else "error",
                "provider": "faster-whisper",
                "model": DEFAULT_MODEL,
                "device": DEFAULT_DEVICE
            }
            self.wfile.write(json.dumps(payload).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path.startswith('/transcribe'):
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                if content_len == 0:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Empty body"}).encode('utf-8'))
                    return

                raw_body = self.rfile.read(content_len)
                lang = self.headers.get('X-Language', None)

                # Check if JSON payload or raw binary WAV
                content_type = self.headers.get('Content-Type', '')
                if 'application/json' in content_type:
                    import base64
                    data = json.loads(raw_body.decode('utf-8'))
                    audio_bytes = base64.b64decode(data.get('audio', ''))
                    lang = data.get('language', lang)
                else:
                    audio_bytes = raw_body

                result = transcribe_audio(audio_bytes, language=lang)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as err:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(err), "text": ""}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=5056, host="127.0.0.1"):
    # Pre-warm model in memory for instant responses
    print(f"[WhisperService] Pre-loading faster-whisper model '{DEFAULT_MODEL}' on {DEFAULT_DEVICE} ({DEFAULT_COMPUTE_TYPE})...", flush=True)
    get_model()
    server = HTTPServer((host, port), WhisperHTTPHandler)
    print(f"[WhisperService] Faster-Whisper STT HTTP service listening on http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[WhisperService] Stopping server...", flush=True)
        server.server_close()

def run_cli():
    parser = argparse.ArgumentParser(description="faster-whisper CLI and service")
    parser.add_argument("--server", action="store_true", help="Run as HTTP daemon")
    parser.add_argument("--port", type=int, default=int(os.getenv("WHISPER_PORT", "5056")), help="Daemon HTTP port")
    parser.add_argument("--host", default="127.0.0.1", help="Daemon HTTP host")
    parser.add_argument("--file", type=str, help="Path to audio WAV file to transcribe")
    parser.add_argument("--language", type=str, default=None, help="Target language code or name")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Whisper model size")
    args = parser.parse_args()

    if args.server:
        run_server(port=args.port, host=args.host)
        return

    if args.file:
        if not os.path.exists(args.file):
            print(json.dumps({"error": f"File not found: {args.file}", "text": ""}))
            sys.exit(1)

        model = get_model(model_size=args.model)
        with open(args.file, "rb") as f:
            audio_bytes = f.read()

        res = transcribe_audio(audio_bytes, language=args.language, model=model)
        print(json.dumps(res))
        return

    parser.print_help()

if __name__ == "__main__":
    run_cli()
