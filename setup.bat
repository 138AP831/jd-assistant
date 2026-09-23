@echo off
echo ============================================================
echo  JD Assistant — Local Setup
echo ============================================================

echo.
echo [1/4] Creating Python virtual environment...
cd backend
python -m venv venv
call venv\Scripts\activate

echo.
echo [2/4] Installing Python dependencies...
pip install -r requirements.txt

echo.
echo [3/4] Installing Node dependencies...
cd ..\frontend
npm install

echo.
echo [4/4] Setup complete!
echo.
echo ============================================================
echo  Next steps:
echo  1. Copy backend\.env.example to backend\.env
echo  2. Add your GOOGLE_API_KEY to backend\.env
echo  3. Run start_dev.bat to start both servers
echo ============================================================
cd ..
