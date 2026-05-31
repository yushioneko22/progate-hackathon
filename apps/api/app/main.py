from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import albums, auth, filters, movies, photos, todos


def create_app() -> FastAPI:
    app = FastAPI(title="変ルンです API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(todos.router)
    app.include_router(auth.router)
    app.include_router(albums.router)
    app.include_router(photos.router)
    app.include_router(filters.router)
    app.include_router(movies.router)
    return app


app = create_app()
