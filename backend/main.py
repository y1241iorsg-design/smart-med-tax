from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from db import init_db
from routers import jan, purchases, tax, chat, inventory, receipt, products, pharmacies, interactions

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Smart Med-Tax API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jan.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(tax.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(receipt.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(pharmacies.router, prefix="/api")
app.include_router(interactions.router, prefix="/api")
