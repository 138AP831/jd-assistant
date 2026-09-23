@echo off
echo ============================================================
echo  JD Assistant — Starting Dev Servers
echo ============================================================
echo  Backend : http://localhost:8000
echo  Frontend: http://localhost:5173
echo  API docs: http://localhost:8000/docs
echo ============================================================

echo.
echo Starting FastAPI backend in a new window...
start "JD Assistant — Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload --port 8000"

echo.
echo Starting React frontend in a new window...
start "JD Assistant — Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers starting. Check the new terminal windows.
