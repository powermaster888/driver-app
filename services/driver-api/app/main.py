from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_tables
from app.errors import APIError, api_error_handler
from app.routers import auth as auth_router, jobs as jobs_router, status as status_router, uploads as uploads_router, pod as pod_router, cash as cash_router, sync as sync_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Driver API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(APIError, api_error_handler)
app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(jobs_router.router, prefix="/api/v1")
app.include_router(status_router.router, prefix="/api/v1")
app.include_router(uploads_router.router, prefix="/api/v1")
app.include_router(pod_router.router, prefix="/api/v1")
app.include_router(cash_router.router, prefix="/api/v1")
app.include_router(sync_router.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
