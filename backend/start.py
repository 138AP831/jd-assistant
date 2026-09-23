"""Helper script to launch uvicorn from any working directory."""
import subprocess
import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
uvicorn_exe = os.path.join(backend_dir, "venv", "Scripts", "uvicorn.exe")

subprocess.run(
    [uvicorn_exe, "main:app", "--reload", "--port", "8000"],
    cwd=backend_dir,
)
