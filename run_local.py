#!/usr/bin/env python3
"""
RevenuePilot Monorepo Local Orchestrator
----------------------------------------
Launches all 4 microservices locally:
  1. Store Backend (FastAPI - Port 8000)
  2. AI Analytics Service (FastAPI - Port 8001)
  3. Store Customer Frontend (Vite/React - Port 3000)
  4. Merchant Operations Center (Vite/React - Port 3001)

Usage:
    python run_local.py
"""

import os
import sys
import time
import signal
import subprocess

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))

SERVICES = [
    {
        "name": "RevenuePilot Store Backend",
        "port": 8000,
        "type": "fastapi",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-store", "backend"),
        "venv": os.path.join(ROOT_DIR, "revenuepilot-store", "backend", "venv"),
        "args": ["-m", "uvicorn", "app.main:app", "--port", "8000", "--host", "0.0.0.0", "--reload"],
    },
    {
        "name": "RevenuePilot AI Service",
        "port": 8001,
        "type": "fastapi",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-ai"),
        "venv": os.path.join(ROOT_DIR, "revenuepilot-ai", "venv"),
        "args": ["-m", "uvicorn", "app.main:app", "--port", "8001", "--host", "0.0.0.0", "--reload"],
    },
    {
        "name": "RevenuePilot Store Frontend",
        "port": 3000,
        "type": "npm",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-store", "frontend"),
        "cmd": ["npm", "run", "dev", "--", "--port", "3000"],
    },
    {
        "name": "RevenuePilot Merchant Dashboard",
        "port": 3001,
        "type": "npm",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-merchant", "frontend"),
        "cmd": ["npm", "run", "dev", "--", "--port", "3001"],
    },
]

running_processes = []


def resolve_python(venv_dir):
    """Resolve virtualenv python executable if available, else system python."""
    if sys.platform == "win32":
        venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        venv_python = os.path.join(venv_dir, "bin", "python")

    if os.path.isfile(venv_python):
        return venv_python
    return sys.executable


def terminate_all(signum=None, frame=None):
    """Gracefully terminate all spawned background processes."""
    print("\n🛑 Stopping all RevenuePilot microservices...")
    for item in running_processes:
        proc = item["proc"]
        name = item["name"]
        try:
            if sys.platform == "win32":
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                proc.terminate()
            print(f"   ✓ Stopped {name} (PID {proc.pid})")
        except Exception as e:
            print(f"   ! Error stopping {name}: {e}")
    print("✨ All services stopped cleanly.\n")
    sys.exit(0)


def start_service(svc):
    """Start a single service process."""
    name = svc["name"]
    cwd = svc["cwd"]
    port = svc["port"]

    if svc["type"] == "fastapi":
        py_exe = resolve_python(svc["venv"])
        cmd = [py_exe] + svc["args"]
    else:
        # npm command setup
        cmd = svc["cmd"]
        if sys.platform == "win32":
            cmd[0] = "npm.cmd"

    print(f"🚀 Starting {name} on port {port}...")
    print(f"   Directory: {cwd}")
    print(f"   Command:   {' '.join(cmd)}")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=None,  # Inherit terminal output or let logs print live
            stderr=None,
        )
        running_processes.append({"name": name, "port": port, "proc": proc})
        print(f"   ✓ {name} initialized (PID {proc.pid})\n")
    except Exception as e:
        print(f"   ❌ Failed to start {name}: {e}\n")


def print_banner():
    """Print launching banner and endpoints summary."""
    banner = """
====================================================================
           🚀 RevenuePilot SaaS Platform Orchestrator 🚀
====================================================================
  1. Store Frontend (Customer):     http://localhost:3000
  2. Merchant Operations Center:    http://localhost:3001
  3. Store Backend API:             http://localhost:8000/docs
  4. AI Intelligence Engine API:    http://localhost:8001/docs
====================================================================
  Press Ctrl+C to gracefully stop all services.
====================================================================
    """
    print(banner)


def main():
    signal.signal(signal.SIGINT, terminate_all)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, terminate_all)

    print_banner()

    # Launch all 4 services
    for svc in SERVICES:
        start_service(svc)

    print("✅ All 4 services are running in background.")
    print("   Monitoring active processes... (Press Ctrl+C to exit)\n")

    # Monitor processes
    while True:
        try:
            time.sleep(2)
            for item in running_processes:
                proc = item["proc"]
                name = item["name"]
                if proc.poll() is not None:
                    print(f"⚠️ Warning: {name} (PID {proc.pid}) exited unexpectedly with code {proc.returncode}")
        except KeyboardInterrupt:
            terminate_all()


if __name__ == "__main__":
    main()
