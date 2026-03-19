#!/bin/bash
# Start both backend and frontend servers

echo "Starting NSE Timing Tool..."
echo ""

# Start backend
echo "🚀 Starting Backend (FastAPI on port 8000)..."
cd backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 2

# Start frontend
echo "🚀 Starting Frontend (Vite on port 5173)..."
cd ../frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 2

echo ""
echo "✓ Both servers started!"
echo ""
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "View logs:"
echo "  Backend:  tail -f ../backend.log"
echo "  Frontend: tail -f ../frontend.log"
echo ""
echo "To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Keep script running
wait
