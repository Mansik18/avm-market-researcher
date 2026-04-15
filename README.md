# AVM Market Researcher

Два приложения:

- `backend/` — FastAPI + SQLite (локально), JWT auth, заглушка чата
- `frontend/` — Vite + React + TS + Tailwind, адаптив (мобилка/десктоп)

## Запуск

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (в другом терминале)

```bash
cd frontend
npm install
npm run dev
```

Открыть http://localhost:5173 → зарегистрироваться → попасть на страницу чата.

Чат пока работает на заглушке `POST /chat/message` — при подключении реального бека достаточно поменять её реализацию.
