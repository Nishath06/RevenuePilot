#!/usr/bin/env python3
"""
RevenuePilot Monorepo Local Orchestrator
----------------------------------------
Launches all 4 microservices locally:
  1. Store Backend     (FastAPI  - Port 8000)
  2. AI Analytics      (FastAPI  - Port 8001)
  3. Store Frontend    (Vite     - Port 3000)
  4. Merchant Dashboard(Vite     - Port 3001)

Usage:
    python run_local.py
"""

import os
import sys
import time
import signal
import subprocess
import threading

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))

# ── Service Definitions ──────────────────────────────────────────────────────
# NOTE: npm services use `npm run dev` only — port is already baked into each
# package.json dev script.  Passing --port again causes duplicates.
SERVICES = [
    {
        "name": "Store Backend",
        "port": 8000,
        "type": "fastapi",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-store", "backend"),
        "venv": os.path.join(ROOT_DIR, "revenuepilot-store", "backend", "venv"),
        "args": ["-m", "uvicorn", "app.main:app",
                 "--port", "8000", "--host", "127.0.0.1", "--reload"],
    },
    {
        "name": "AI Service",
        "port": 8001,
        "type": "fastapi",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-ai"),
        "venv": os.path.join(ROOT_DIR, "revenuepilot-ai", "venv"),
        "args": ["-m", "uvicorn", "app.main:app",
                 "--port", "8001", "--host", "127.0.0.1", "--reload"],
    },
    {
        "name": "Store Frontend",
        "port": 3000,
        "type": "npm",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-store", "frontend"),
        # store package.json dev = "vite" (no port), so we pass --port here
        "npm_args": ["run", "dev", "--", "--port", "3000"],
    },
    {
        "name": "Merchant Dashboard",
        "port": 3001,
        "type": "npm",
        "cwd": os.path.join(ROOT_DIR, "revenuepilot-merchant", "frontend"),
        # merchant package.json dev = "vite --port 3001" — port already set!
        "npm_args": ["run", "dev"],
    },
]

running_processes = []   # list of {"name", "port", "proc", "stderr_lines"}


# ── Port Helpers ─────────────────────────────────────────────────────────────

def _kill_pid_tree(pid: str) -> None:
    """Kill a PID and all its children (Windows)."""
    subprocess.call(
        ["taskkill", "/F", "/T", "/PID", pid],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def free_port(port: int) -> None:
    """Kill every process listening on *port* (including child workers)."""
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(
                ["netstat", "-ano"], stderr=subprocess.DEVNULL, text=True
            )
            seen = set()
            for line in out.splitlines():
                if f":{port} " in line and ("LISTENING" in line or "ESTABLISHED" in line):
                    parts = line.strip().split()
                    pid = parts[-1]
                    if pid.isdigit() and pid not in seen:
                        seen.add(pid)
                        _kill_pid_tree(pid)
                        print(f"   ⚡ Freed port {port} — killed PID {pid} (tree)")
        except Exception as exc:
            print(f"   ! Could not free port {port}: {exc}")
    else:
        try:
            raw = subprocess.check_output(
                ["lsof", "-ti", f":{port}"], stderr=subprocess.DEVNULL, text=True
            ).strip()
            for pid in raw.splitlines():
                subprocess.call(
                    ["kill", "-9", pid],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                print(f"   ⚡ Freed port {port} — killed PID {pid}")
        except Exception:
            pass


# ── Process Helpers ───────────────────────────────────────────────────────────

def resolve_python(venv_dir: str) -> str:
    """Return the venv python if it exists, else fall back to sys.executable."""
    candidate = os.path.join(
        venv_dir,
        "Scripts" if sys.platform == "win32" else "bin",
        "python.exe" if sys.platform == "win32" else "python",
    )
    return candidate if os.path.isfile(candidate) else sys.executable


def _stream_stderr(proc, lines_buf: list) -> None:
    """Background thread: read stderr and buffer lines (up to 40)."""
    try:
        for raw in proc.stderr:
            line = raw.rstrip()
            if line:
                lines_buf.append(line)
                if len(lines_buf) > 40:
                    lines_buf.pop(0)
    except Exception:
        pass


def terminate_all(signum=None, frame=None) -> None:
    """Gracefully terminate all spawned background processes."""
    print("\n🛑 Stopping all RevenuePilot microservices...")
    for item in running_processes:
        proc = item["proc"]
        name = item["name"]
        try:
            if sys.platform == "win32":
                _kill_pid_tree(str(proc.pid))
            else:
                proc.terminate()
            print(f"   ✓ Stopped {name} (PID {proc.pid})")
        except Exception as exc:
            print(f"   ! Error stopping {name}: {exc}")
    print("✨ All services stopped.\n")
    sys.exit(0)


# ── Service Launcher ──────────────────────────────────────────────────────────

def start_service(svc: dict) -> None:
    name = svc["name"]
    cwd  = svc["cwd"]
    port = svc["port"]

    # 1. Clear the port first (kill full process tree)
    free_port(port)
    time.sleep(2)  # Give OS time to release the socket

    # 2. Build the command
    if svc["type"] == "fastapi":
        py = resolve_python(svc["venv"])
        cmd = [py] + svc["args"]
    else:
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        cmd = [npm] + svc["npm_args"]

    print(f"🚀 Starting {name} → http://localhost:{port}")
    print(f"   Dir : {cwd}")
    print(f"   Cmd : {' '.join(cmd)}")

    # 3. Build environment
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    if svc["type"] == "fastapi" and "venv" in svc:
        env["VIRTUAL_ENV"] = svc["venv"]
        scripts = os.path.join(svc["venv"], "Scripts" if sys.platform == "win32" else "bin")
        env["PATH"] = scripts + os.pathsep + env.get("PATH", "")

    # 4. Launch — capture stderr for crash diagnostics, inherit stdout
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            env=env,
            stdout=None,           # live output to terminal
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        stderr_lines: list = []
        t = threading.Thread(target=_stream_stderr, args=(proc, stderr_lines), daemon=True)
        t.start()

        running_processes.append({
            "name": name,
            "port": port,
            "proc": proc,
            "stderr_lines": stderr_lines,
        })
        print(f"   ✓ {name} started (PID {proc.pid})\n")
    except Exception as exc:
        print(f"   ❌ Failed to start {name}: {exc}\n")


# ── Banner ────────────────────────────────────────────────────────────────────

def print_banner() -> None:
    print("""
====================================================================
         🚀  RevenuePilot SaaS Platform Orchestrator  🚀
====================================================================
  Store Frontend (Customer):     http://localhost:3000
  Merchant Operations Center:    http://localhost:3001
  Store Backend API:             http://localhost:8000/api/v1/docs
  AI Intelligence Engine API:    http://localhost:8001/docs
====================================================================
  Press Ctrl+C to gracefully stop all services.
====================================================================
""")


# ── Main Loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    signal.signal(signal.SIGINT, terminate_all)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, terminate_all)

    print_banner()

    for svc in SERVICES:
        start_service(svc)

    print("✅ All services launched.  Monitoring... (Ctrl+C to stop)\n")

    dead_names: set = set()

    while True:
        try:
            time.sleep(3)
            for item in list(running_processes):
                proc  = item["proc"]
                name  = item["name"]
                lines = item.get("stderr_lines", [])

                if proc.poll() is not None:
                    if name not in dead_names:
                        dead_names.add(name)
                        print(f"\n❌ {name} (PID {proc.pid}) crashed "
                              f"(exit code {proc.returncode})")
                        if lines:
                            print(f"   Last stderr output:")
                            for ln in lines[-15:]:
                                print(f"     {ln}")
                        print()
        except KeyboardInterrupt:
            terminate_all()


if __name__ == "__main__":
    main()
