🖥️ Terminal 1: AI Analytics Service (Port 8001)
powershell
cd "e:\Cloud projects\Razorpay\revenuepilot-ai"
.\venv\Scripts\python.exe -m uvicorn app.main:app --port 8001 --host 127.0.0.1 --reload
🖥️ Terminal 2: Store Backend API (Port 8000)
powershell
cd "e:\Cloud projects\Razorpay\revenuepilot-store\backend"
.\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --host 127.0.0.1 --reload
🖥️ Terminal 3: Storefront UI (Port 3000)
powershell
cd "e:\Cloud projects\Razorpay\revenuepilot-store\frontend"
npm run dev -- --port 3000
🖥️ Terminal 4: Merchant Dashboard UI (Port 3001)
powershell
cd "e:\Cloud projects\Razorpay\revenuepilot-merchant\frontend"
npm run dev
🚀 Alternative: Single Orchestrator Command
If you ever want to launch all 4 servers together in a single terminal with automatic health checks:

powershell
cd "e:\Cloud projects\Razorpay"
python run_local.py