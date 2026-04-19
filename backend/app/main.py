from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .logging_config import setup_logging
from .middleware import RequestLoggingMiddleware
from .routers import analysis as analysis_router
from .routers import auth as auth_router
from .routers import chat as chat_router
from .routers import pending_edits as pending_edits_router
from .routers import projects as projects_router

setup_logging()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AVM Market Researcher API")

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://premium.codecrafters.kz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(projects_router.router)
app.include_router(chat_router.router)
app.include_router(analysis_router.router)
app.include_router(pending_edits_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
