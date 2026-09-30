"""
Local TTS Service.
Synthesizes text to a WAV audio file using pyttsx3 or Piper.
"""

import sys
import os
import argparse
import wave

def synthesize(text, output_file, voice=None, rate=155):
    # Check if Piper executable is configured
    piper_path = os.getenv("PIPER_PATH")
    piper_model = os.getenv("PIPER_MODEL")
    
    if piper_path and os.path.exists(piper_path) and piper_model and os.path.exists(piper_model):
        import subprocess
        cmd = [piper_path, "--model", piper_model, "--output_file", output_file]
        proc = subprocess.run(cmd, input=text.encode("utf-8"), capture_output=True)
        if proc.returncode == 0 and os.path.exists(output_file):
            return True

    # Use pyttsx3 (offline native SAPI5 on Windows / speech-dispatcher on Linux)
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', rate)
        engine.save_to_file(text, output_file)
        engine.runAndWait()
        return os.path.exists(output_file) and os.path.getsize(output_file) > 44
    except Exception as err:
        sys.stderr.write(f"TTS synthesis error: {err}\n")
        return False

def main():
    parser = argparse.ArgumentParser(description="Local TTS Service")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--output", required=True, help="Output WAV path")
    parser.add_argument("--rate", type=int, default=155, help="Speech rate")
    args = parser.parse_args()

    success = synthesize(args.text, args.output, rate=args.rate)
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
