# Backend (FastAPI + SQLite)

## Install & run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints

- `POST /auth/register` — `{email, password}` → `{access_token, user}`
- `POST /auth/login` — `{email, password}` → `{access_token, user}`
- `GET  /auth/me` — requires `Authorization: Bearer <token>`
- `POST /chat/message` — `{message, mode?}` (auth required) → `{reply}`

SQLite DB file `app.db` is created automatically in `backend/`.
