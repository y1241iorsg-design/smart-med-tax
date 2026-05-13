import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from db import init_db
from routers import jan, purchases, tax

load_dotenv(dotenv_path="../.env")

app = FastAPI(title="Smart Med-Tax API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jan.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(tax.router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    init_db()
