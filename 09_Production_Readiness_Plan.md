# 🏭 Production Readiness Plan
## Sofa Plus+ BOM Management System
**Version**: 1.0 | **Date**: 2026-05-16 | **BA**: Nattawat Chaichanasak

---

## 1. Current Prototype Summary

**Sprint 0-6 สำเร็จแล้ว — Prototype พร้อม Demo**

| Module | สถานะ | หมายเหตุ |
|---|---|---|
| Master Data CRUD | ✅ Done | Category, Type, Model, Material Group, Material, Upholster |
| Product Catalog | ✅ Done | Cat × Type × Model × Standard Size, uniqueness by size |
| BOM Builder | ✅ Done | Material Lines + Upholster Placeholder, DRAFT→ACTIVE versioning |
| Copy BOM FROM / TO | ✅ Done | Copy 1→1 และ 1→หลาย Products พร้อมกัน |
| Variant Generator | ✅ Done | Bulk + Preview, reactivate soft-deleted variants |
| Resolve BOM per SKU | ✅ Done | Linear Step Formula + Overhead 3.5% |
| Export CSV | ✅ Done | Resolved BOM per SKU พร้อม Thai charset |

**Tech Stack ที่ใช้จริง**
- Backend: Python 3.14 + FastAPI + SQLAlchemy 2.0 async + Alembic
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Database: PostgreSQL 15 via Supabase (connection pooler port 6543)
- Migrations: Alembic 0001–0007 deployed

**GitHub**: https://github.com/pcjoyc-del/sofaplus-bom.git | Branch: `main`

**หมายเหตุ Server Start** (สำคัญ):
```bash
# ต้อง run จาก project root เท่านั้น เพราะ main.py ใช้ relative imports
cd <project-root>
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000

# Frontend
cd src/web && npm run dev
```

---

## 2. Confirmed Business Modules

จาก Decisions Log + Requirements Spec (Locked)

| Module | Phase | Description |
|---|---|---|
| **Master Data** | Phase 1 | Category, Type, Model, Material Group, Material + Price, Upholster Source/Collection/Color/Price |
| **Product Catalog** | Phase 1 | 176 Products, Cat×Type×Model×Size, status ACTIVE/DRAFT/DISCONTINUED |
| **BOM Management** | Phase 1 | BOM per Product, versioning, DRAFT→ACTIVE, Copy FROM/TO |
| **Variant / SKU** | Phase 1 | Generate SKU = Product × Upholster Color, Linear Step qty formula |
| **Cost Calculation** | Phase 1 | Resolved BOM cost per SKU, Overhead %, Export CSV |
| **Selling Price + Margin** | Phase 2 | กรอก selling price ต่อ SKU → Gross Margin % |
| **Cost Dashboard** | Phase 2 | ดู cost/margin ข้ามหลาย SKU, filter, export |
| **Overhead Rate UI** | Phase 2 | แก้ % overhead จาก UI |
| **3-Tier BOM** | Phase 2 | Type-level BOM inheritance → ลด BOM maintenance 72% |

**Out of Scope ทั้ง Phase 1 + 2**
- Inventory Tracking, Job Costing, Sales Order Integration, Per-SKU P&L, User Auth roles, Branch comparison

---

## 3. Schema Delta — Prototype → Production

Schema หลักถูก design ไว้ใน `04_Database_Schema.sql` และ implement ผ่าน migrations 0001-0007 ครบแล้ว
สิ่งที่ต้องเพิ่มใน Production:

**Migration 0008 — Production hardening**
```sql
-- ① เพิ่ม index สำหรับ query performance
CREATE INDEX idx_bom_lines_version      ON bom_lines(bom_version_id);
CREATE INDEX idx_variants_product       ON product_variants(product_id, is_active);
CREATE INDEX idx_upholster_prices_color ON upholster_prices(color_id, effective_date DESC);

-- ② Audit fields
ALTER TABLE bom_versions     ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS created_by TEXT;
```

**Migration 0009 — Production seed data**
```sql
-- ① Overhead rates จริงจาก Finance (แทน 3.5% placeholder)
-- ② ราคา Material จริงจาก Excel
-- ③ ราคา Upholster จริงจาก Excel (แทน seed ทดสอบ)
```

**ไม่ต้องเปลี่ยน** core schema tables:
`products`, `bom_versions`, `bom_lines`, `product_variants`, `upholster_*`, `materials`, `material_prices`

---

## 4. Migration Plan

**Strategy: Forward-only, Alembic-managed**

```
migrations/versions/
  0001_initial_schema.py       ✅ deployed
  0002_seed_master_data.py     ✅ deployed
  0003_products_seed.py        ✅ deployed
  0004_bom_seed.py             ✅ deployed
  0005_variants_seed.py        ✅ deployed
  0006_leather_seed.py         ✅ deployed
  0007_leather_prices_seed.py  ✅ deployed
  0008_production_hardening.py ← Dev สร้าง (index + audit fields)
  0009_production_seed.py      ← Dev สร้าง (ข้อมูลจริงจาก Excel)
```

**Run commands**
```bash
# ใช้ DIRECT_URL (port 5432) สำหรับ migration เท่านั้น
# ห้ามใช้ DATABASE_URL pooler (port 6543) กับ Alembic
alembic upgrade head

# ตรวจสอบ
alembic current
alembic history
```

**Rollback policy**
- ห้าม downgrade ข้อมูลจริง
- Snapshot DB ก่อน migrate ทุกครั้ง
- ทุก migration ต้องมี `downgrade()` implement ไว้

---

## 5. Data Integrity & Audit Trail

**Integrity Rules ที่ต้อง enforce**

| Rule | Enforce ที่ | สถานะ |
|---|---|---|
| Product uniqueness = Cat+Type+Model+Width+Depth | Application (service layer) | ✅ มีแล้ว |
| BOM ต้องมี standard_width ก่อน Activate (BR-13) | Application | ⚠️ ต้องเพิ่ม |
| Variant override ได้แค่ width (BR-14) | Application | ✅ มีแล้ว |
| BOM Line qty ต้องมีค่า | DB CHECK constraint | ✅ มีแล้ว |
| Soft delete only — ห้าม hard delete master data | Application | ✅ มีแล้ว |
| Price snapshot — lock ราคา ณ วันที่ resolve | Application | ✅ มีแล้ว |
| 1 Product มีได้ 1 ACTIVE BOM | Application | ✅ มีแล้ว |

**Audit Trail Requirements (Phase 1)**
- `created_at`, `updated_at` ทุก table ✅
- เพิ่ม `created_by`, `updated_by` (TEXT — username) ใน bom_versions, product_variants
- `activated_at`, `activated_by` ใน bom_versions (activated_at มีแล้ว ✅)

---

## 6. Authentication & User Roles

**Phase 1 — Single Admin (Locked Decision Q8)**

```
Implementation (minimal):
- Simple login: username + password → JWT token (7 วัน)
- Frontend: LoginPage → token ใน localStorage → protected routes
- Backend: JWT middleware ตรวจทุก /api/* (ยกเว้น /api/auth/login, /api/health)
- ไม่ต้องทำ: signup, forgot password, role management
```

**Phase 2 — Role-based (อย่าทำใน Phase 1)**
```
Roles ที่วางแผนไว้:
- Admin   → full access
- Planner → อ่าน/แก้ BOM, ไม่ลบ
- Viewer  → อ่านอย่างเดียว
```

---

## 7. Core Business Transaction Rules

**BOM Rules**
- **BR-13**: Product ต้องมี `standard_width` ก่อน Activate BOM ได้
- **BR-14**: Variant override ได้แค่ `width` — depth/bed_depth lock ที่ Product
- **BR-15**: Variant ไม่ระบุ width → ใช้ `standard_width` ของ Product
- แก้ BOM = สร้าง version ใหม่เสมอ (ห้ามแก้ ACTIVE version ตรงๆ)
- 1 Product → 1 ACTIVE BOM เท่านั้น — Activate ใหม่ → Archive ตัวเก่า
- ห้าม Activate BOM ที่ไม่มี lines (BOM ว่าง)

**Upholster Quantity Formula (Linear Step — Model 1)**
```
qty = qty_base + ((variant_width - standard_width) / qty_width_step) × qty_step_increment

ถ้า qty_base = NULL  → ใช้ quantity_fixed (fixed qty, ไม่ขึ้นกับ width)
ถ้า variant_width = NULL → ใช้ standard_width (step = 0)
```

**Cost Calculation**
```
material_cost = Σ (quantity × price ณ effective_date ≤ วันที่ resolve)
overhead_cost = material_cost × overhead_rate%  (ดึงจาก overhead_rates ตาม category)
total_cost    = material_cost + overhead_cost
```

**SKU Format (Locked Decision Q10)**
```
{CAT}-{TYPE}-{MODEL}-{SRC}-{COLL_SHORT}-{COLOR_SHORT}
ex: SF-2S-CHANA-PSY-TAS-BIRCH
```

---

## 8. UI Pages to Build or Refactor

**Refactor จาก Prototype**

| Page | สิ่งที่ต้องทำ |
|---|---|
| `ProductsPage` | Pagination รองรับ 176+ rows |
| `BomBuilderPage` | Validate BR-13 ก่อน Activate, ห้าม Activate BOM ว่าง |
| `VariantsPage` | Pagination + filter by source/status |
| `Sidebar` | Active state ถูกต้องสำหรับ sub-pages |
| ทุก Form | Loading state, Error boundary, Empty state |

**สร้างใหม่ใน Phase 1**

| Page | รายละเอียด |
|---|---|
| `LoginPage` | username + password → JWT → redirect /products |
| `DashboardPage` | Summary cards: Products / BOMs / SKUs / Missing BOM per category |
| `MaterialPricesPage` | CRUD ราคา Material ต่อ effective_date |
| `UpholsterPricePage` | CRUD ราคา Upholster ต่อ effective_date |

**Phase 2 เท่านั้น (อย่าทำตอนนี้)**
- `OverheadRatePage`, Cost Dashboard, Selling Price editor

---

## 9. API / Server Actions to Build or Refactor

**Refactor**

| Endpoint | สิ่งที่ต้องทำ |
|---|---|
| `POST /products/{id}/bom/versions/{id}/activate` | ห้าม activate BOM ที่ไม่มี lines |
| `GET /products` | เพิ่ม `skip`, `limit` pagination |
| `GET /products/{id}/variants` | เพิ่ม pagination + filter |
| ทุก endpoint | Standard error format `{code, message, detail}` |

**สร้างใหม่ใน Phase 1**

| Endpoint | รายละเอียด |
|---|---|
| `POST /auth/login` | username/password → JWT token |
| `GET /auth/me` | verify token + return user info |
| `GET /materials/{id}/prices` | ประวัติราคา Material |
| `POST /materials/{id}/prices` | เพิ่มราคาใหม่ |
| `GET /upholster/colors/{id}/prices` | ประวัติราคา Upholster |
| `POST /upholster/colors/{id}/prices` | เพิ่มราคา Upholster ใหม่ |
| `GET /dashboard/summary` | นับ Products, BOMs, SKUs, Missing BOM |
| `POST /import/products` | Import จาก CSV (script หรือ API) |

---

## 10. Risk Areas Before Going Production

| Risk | ระดับ | Mitigation |
|---|---|---|
| **ข้อมูลจริง 176 Products ยังไม่ได้ import** | 🔴 High | ทำ import script จาก Excel ก่อน go-live — test กับข้อมูลจริง |
| **ราคา Material/Upholster ยังเป็นตัวเลขสมมติ** | 🔴 High | Finance ต้องส่งราคาจริงก่อน generate Resolved BOM ใช้จริง |
| **Linear Step formula ค่าจริงยังไม่ได้จาก Production** | 🔴 High | ฝ่ายผลิตต้อง confirm qty_base, step, increment ต่อ Type (Q3.2-3.4) |
| **ไม่มี Auth ใน Prototype** | 🟡 Medium | ทำ Auth ก่อน deploy — อย่า expose API โดยไม่มี protection |
| **Server start command ซับซ้อน** | 🟡 Medium | สร้าง Makefile / Docker Compose / start.sh ใน Step 1 |
| **Overhead rate 3.5% เป็น placeholder** | 🟡 Medium | Finance confirm ค่าจริง (Q5.1) ก่อน go-live |
| **Performance** 176 Products × หลาย SKUs | 🟡 Medium | เพิ่ม pagination + DB index ก่อน go-live |
| **SKU ของเก่าใน Excel** อาจ conflict format ใหม่ | 🟡 Medium | ตรวจสอบกับ BA+Sales ก่อน migrate (Q10.2) |
| **Overhead rate 3.5% เป็น placeholder** | 🟡 Medium | Finance confirm ค่าจริง (Q5.1) ก่อน go-live |

---

## 11. Step-by-Step Implementation Order

> หลักการ: Foundation ก่อน Feature — อย่าเริ่ม UI ก่อน Data พร้อม

```
STEP 1 — Environment Setup (วันที่ 1)
  ├── Clone repo + setup .env Production (Supabase credentials)
  ├── Run: alembic upgrade head → verify 0007 passed
  ├── สร้าง Makefile หรือ start.sh เพื่อ simplify server start
  └── Verify: GET /api/products → ตอบได้

STEP 2 — Authentication (วันที่ 2-3)
  ├── Backend: POST /auth/login → JWT token
  ├── Backend: JWT middleware ทุก route (ยกเว้น /health, /auth/login)
  ├── Frontend: LoginPage + token ใน localStorage
  └── Frontend: redirect to /login ถ้าไม่มี token

STEP 3 — Migration 0008: Production hardening (วันที่ 3-4)
  ├── DB indexes (bom_lines, product_variants, upholster_prices)
  ├── Audit fields: created_by, updated_by
  ├── API: pagination GET /products, GET /variants
  ├── API: ห้าม activate BOM ว่าง
  └── API: standard error response format

STEP 4 — Import Script (วันที่ 4-7) ← รอ Excel จาก Nattawat
  ├── scripts/import_master_data.py (Category, Type, Model)
  ├── scripts/import_materials.py (Material + ราคาจริง)
  ├── scripts/import_upholster.py (Source/Collection/Color + ราคาจริง)
  └── scripts/import_products.py (176 Products)

STEP 5 — Price Management UI (วันที่ 7-9)
  ├── MaterialPricesPage: ดู/เพิ่มราคา Material ต่อ effective_date
  └── UpholsterPricePage: ดู/เพิ่มราคา Upholster ต่อ effective_date

STEP 6 — BOM Data Entry (วันที่ 9-16) ← รอ Production team
  ├── BA กรอก BOM ต่อ Type (~50 BOMs) ผ่าน UI
  ├── ใช้ Copy BOM TO propagate ไปยัง Products ใน Type เดียวกัน
  ├── Production team confirm Linear Step formula ค่าจริง (Q3.2-3.4)
  └── Finance confirm overhead rate จริง (Q5.1)

STEP 7 — Generate Variants (วันที่ 16-18)
  ├── Generate SKUs ทุก Product × Upholster
  ├── Resolve BOM cost ตรวจสอบทุก SKU
  └── Export CSV → Finance ตรวจสอบ

STEP 8 — UI Polish (วันที่ 18-21)
  ├── DashboardPage (summary cards)
  ├── Industrial Design ตาม 05_Mockup + 06_Mockup_Review_Feedback_R1.md
  ├── Loading states + Error boundaries ทุกหน้า
  └── Sidebar active states

STEP 9 — UAT + Go-live Checklist (วันที่ 21-23)
  ├── Nattawat ทดสอบ E2E กับข้อมูลจริง
  ├── Finance verify ราคาและ cost calculation
  ├── Production team verify Linear Step values
  ├── Security check: Auth ทำงานถูกต้อง, ไม่มี exposed endpoints
  └── Deploy to production environment
```

---

> **อ้างอิงเอกสาร**: `CLAUDE.md` · `02_Requirements_Spec_BOM_App_MVP.md` · `03_Decisions_Log.md` · `04_Database_Schema.sql` · `07_Roadmap_Alignment.md`
