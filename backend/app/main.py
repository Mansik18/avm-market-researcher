from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .routers import analysis as analysis_router
from .routers import auth as auth_router
from .routers import chat as chat_router
from .routers import projects as projects_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AVM Market Researcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(projects_router.router)
app.include_router(chat_router.router)
app.include_router(analysis_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
