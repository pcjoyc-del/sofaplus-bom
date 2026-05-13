# Sofa Plus+ BOM Management System

Internal ERP Module สำหรับจัดการ Bill of Materials ของ Sofa House 1998 Co., Ltd.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional)
- Supabase Project (PostgreSQL 15)

### 1. Clone & Setup Environment
```bash
git clone https://github.com/pcjoyc-del/sofaplus-bom.git
cd sofaplus-bom
cp .env.example .env
# แก้ไข .env ใส่ค่าจริงจาก Supabase
```

### 2. Setup Database (Supabase)
```bash
# Option A — รัน Schema บน Supabase แล้ว stamp Alembic
psql $DIRECT_URL < 04_Database_Schema.sql
alembic stamp head

# Option B — ให้ Alembic สร้างทุกอย่าง (fresh DB)
alembic upgrade head
```

### 3. Run Backend
```bash
pip install -r requirements.txt
uvicorn src.api.main:app --reload
# API:  http://localhost:8000
# Docs: http://localhost:8000/api/docs
```

### 4. Run Frontend
```bash
cd src/web
npm install
npm run dev
# Frontend: http://localhost:5173
```

### 5. หรือใช้ Docker Compose
```bash
docker compose up
```

---

## Project Structure
```
sofaplus-bom/
├── src/
│   ├── api/                # FastAPI backend
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── tests/
│   └── web/                # React + Vite frontend
├── migrations/             # Alembic migrations
├── scripts/                # One-off scripts (data import)
├── docs/                   # Requirements & Design documents
└── 04_Database_Schema.sql  # Source-of-truth schema
```

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI + SQLAlchemy 2.0 + Alembic |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL 15) |
| Hosting | DigitalOcean |
| Container | Docker Compose |
