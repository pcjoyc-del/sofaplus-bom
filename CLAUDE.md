# CLAUDE.md — Project Memory for Claude Code

> **Purpose**: ไฟล์นี้คือ memory หลักที่ Claude Code โหลดเสมอเมื่อทำงานใน repo นี้
> **Audience**: Claude Code (AI Developer)
> **Last Updated**: 2026-05-12

---

## 🎯 Project Identity

**Project**: Sofa Plus+ Internal ERP — BOM Management System (MVP)
**Company**: Sofa House 1998 Co., Ltd. (ผู้ผลิตและจำหน่ายโซฟาแบรนด์ Sofa Plus+)
**Owner / BA**: Mr. Nattawat Chaichanasak (Co-Founder & Deputy MD)
**Phase**: Pre-Build → Sprint 0 (Foundation) starting

**MVP Goal**: ทำให้ระบบสามารถ:
1. เก็บ Product Catalog (Cat + Type + Model) + Standard Size
2. สร้าง BOM Template ต่อ Product (Material + Upholster Placeholders)
3. สร้าง Variants (SKU = Product × Upholster)
4. คำนวณ Material Cost ต่อ SKU ได้ (Resolved BOM)

---

## 📚 Source of Truth — อ่านไฟล์เหล่านี้ก่อนตัดสินใจอะไรก็ตาม

> **กฎทอง**: ก่อน implement feature ใด ให้ Read ไฟล์ที่เกี่ยวข้องก่อน

| ไฟล์ | เมื่อต้องการ |
|---|---|
| [`02_Requirements_Spec_BOM_App_MVP.md`](./02_Requirements_Spec_BOM_App_MVP.md) | Functional Requirements (FR), Business Rules (BR), Acceptance Criteria — **อ่านบ่อยสุด** |
| [`04_Database_Schema.sql`](./04_Database_Schema.sql) | Schema ทั้งหมด — **รัน script นี้เป็นอันดับแรก** |
| [`03_Decisions_Log.md`](./03_Decisions_Log.md) | ก่อนสร้าง feature ใหม่ — เช็คว่ามีการตัดสินใจไว้แล้วหรือไม่ |
| [`01_Process_Flow_BOM_App.md`](./01_Process_Flow_BOM_App.md) | User flow — เมื่อ implement UI |
| [`05_Mockup_BOM_Builder.html`](./05_Mockup_BOM_Builder.html) | Reference Design Direction (Industrial Furniture) — **ไม่ใช่ Final UI** |
| [`07_Roadmap_Alignment.md`](./07_Roadmap_Alignment.md) | สรุป Trade-offs ระหว่าง Roadmap (strategic) vs Spec (tactical) |
| [`00_README.md`](./00_README.md) | Master Index ของทุกเอกสาร |
| Excel files (`*.xlsx`) | Source data จริง — ใช้สำหรับ Migration script |

---

## 🏗️ Tech Stack (Decided)

| Layer | Choice | Note |
|---|---|---|
| **Database** | PostgreSQL 15+ | Mature, JSONB, Window Function |
| **Backend** | Python (FastAPI) **หรือ** Node.js (NestJS) | ขึ้นกับ choice ของ dev — **ถาม user ก่อนเริ่ม** |
| **Frontend** | React + Vite + TypeScript + Tailwind + shadcn/ui | |
| **Deployment** | Docker Compose | |
| **ORM** | SQLAlchemy (ถ้า Python) / Prisma (ถ้า Node) | |
| **Testing** | pytest (Python) / vitest (Node) + Playwright (E2E) | |

---

## 🔑 Core Domain Concepts (MUST UNDERSTAND)

### Hierarchy
```
Category (4) → Type (50+) → Model → Product (176) → Variant/SKU (822)
                                       │
                                       └─ BOM Template (Material + Upholster Placeholders)
```

### 3 ประเภทของวัตถุดิบ
1. **Main Material** — ฟองน้ำ, ไม้, ขา, โครงเหล็ก (countable per Product) → อยู่ใน `materials` table
2. **Upholster Material** — ผ้า/หนัง (Source × Collection × Color) → อยู่ใน `upholster_*` tables
3. **General Material** — ด้าย, น็อต, กาว (overhead — NOT in BOM) → อยู่ใน `overhead_rates`

### BOM Line 2 ประเภท
- `MATERIAL` — Fixed material + fixed qty (`bom_lines.material_id` + `quantity_fixed`)
- `UPHOLSTER_PLACEHOLDER` — Section name + qty (fixed/formula) — **fill ผ้าจริงตอน Resolve เป็น SKU**

### Upholster Quantity Formula (Model 1 Linear Step — Width-based)
```
qty = qty_base + ((variant_width − reference_width) / qty_width_step) × qty_step_increment
```
- `reference_width` = `products.standard_width` (สำหรับ Product-level BOM)
- ลูกค้าเปลี่ยน width ได้ แต่ depth/bed_depth คงที่ตาม Product

### 3-Tier BOM Hierarchy (Schema-ready, UI Phase 2)
- MVP: BOM อยู่ที่ Product level (`bom_versions.product_id`)
- Phase 2: BOM อยู่ที่ Type level (`bom_versions.type_id`) → Product `bom_source = 'TYPE_INHERITED'`

---

## ⚖️ Decision Precedence (เมื่อ docs ขัดกัน)

1. **`03_Decisions_Log.md`** = Authoritative — ถ้าตัดสินใจแล้วใน Log ใช้อันนี้
2. **`02_Requirements_Spec`** = Detailed Spec (FR/BR/AC)
3. **`04_Database_Schema.sql`** = Source of truth สำหรับ data model
4. **`01_Process_Flow`** = User flow direction
5. **Roadmap.docx** = Strategic context (อ่านเพื่อเข้าใจ "ทำไม")
6. **Mockup HTML** = Design Direction เท่านั้น — **ไม่ใช่** Final UI Spec

> ถ้าเจอ conflict: report ให้ user ก่อน อย่าตัดสินใจเอง

---

## 🚦 When to Ask vs When to Proceed

### ✅ ตัดสินใจเองได้
- Code style choices ที่อยู่ใน standard (PEP 8 สำหรับ Python, ESLint default สำหรับ JS)
- File/folder structure ทั่วไปของ Framework
- Test cases สำหรับ FR ที่มีอยู่
- Migration script เล็ก ๆ
- Refactoring เพื่อ improve readability (โดยไม่เปลี่ยน behavior)

### ❓ ต้องถาม User ก่อน
- เลือก Backend stack (Python vs Node) — **ก่อน Sprint 0**
- เลือก Deployment strategy (Big Bang vs Phased) — **ก่อน Sprint 0**
- Hosting (Cloud vs On-premise) — **ก่อน Sprint 0**
- เพิ่ม dependency ใหม่ที่ไม่อยู่ใน Tech Stack ข้างบน
- ใด ๆ ที่ Out-of-Scope ของ MVP (ดู `02_Requirements_Spec.md` Section 2)
- Open Questions ที่ยังเปิด (Q3.2-3.4, Q5.1, Q10.2) — **ก่อนเริ่ม Sprint 4**
- การเปลี่ยน Locked Decision

### 🚫 อย่าทำเองเด็ดขาด
- เปลี่ยน Schema โดยไม่ update `04_Database_Schema.sql` พร้อม
- Skip Acceptance Criteria
- Implement Out-of-Scope features (ถึงแม้จะ "small")
- Hard-code data ที่ควรอยู่ใน DB

---

## 🎨 Code Conventions

### File Structure (Suggested)
```
src/
├── api/              # Backend
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   ├── models/       # ORM models
│   └── tests/
├── web/              # Frontend
│   ├── components/
│   ├── pages/
│   └── lib/
├── migrations/       # Alembic / Prisma migrations
└── scripts/          # One-off scripts (data import, etc.)

docs/                 # Reference เอกสารต้นฉบับ (อ่านอย่างเดียว)
├── 00_README.md
├── 01_Process_Flow_BOM_App.md
├── ... (เอกสารทั้งหมด)
```

### Naming
- **Database**: snake_case (`product_variants`, `bom_lines`)
- **Python**: snake_case (functions, vars), PascalCase (classes)
- **TypeScript**: camelCase (functions, vars), PascalCase (components, types)
- **Comments อธิบาย "ทำไม"**: ภาษาไทยได้ — ตามที่ Schema ทำอยู่
- **Variable / Function name**: English เสมอ

### Database
- ใช้ `is_active BOOLEAN` สำหรับ Soft Delete ทุก master data (Q11)
- ใช้ `created_at`, `updated_at TIMESTAMP DEFAULT NOW()` ทุก table
- FK ระบุ `ON DELETE CASCADE` หรือ `RESTRICT` ชัดเจน
- Versioned data ใช้ `effective_date` (เช่น `material_prices.effective_date`)

### Testing
- ทุก FR ต้องมี test case อย่างน้อย 1 case
- Business Rules (BR-xx) → unit test แยก
- Acceptance Criteria (AC-x) → integration / E2E test
- Test data ใช้ Sample Data ใน Schema เป็น baseline

---

## 🏃 Sprint Plan (Roadmap-aligned)

> ดู `07_Roadmap_Alignment.md` สำหรับ trade-off Lean vs Comprehensive

### Phase 0 — Foundation (Sprint 0-1, ~3 สัปดาห์)
- Setup repo, CI/CD, Docker Compose
- Run `04_Database_Schema.sql` ใน dev env
- สร้าง Migration framework (Alembic หรือ Prisma)
- Master Data import script จาก Excel
- User Auth (basic — Admin only ใน MVP)

### Phase 1 — MVP Core (Sprint 2-4, ~6 สัปดาห์)
- **Sprint 2**: Master Data CRUD (Categories, Types, Models, Materials, Material Groups, Sources, Collections, Colors, Pricing)
- **Sprint 3**: Product Catalog + Standard Size + BOM Builder UI
- **Sprint 4**: Copy BOM, Standard Cost Calculator, Cost Rollup Engine

### Phase 1.5 — Variant Support (Sprint 5-6, ~4 สัปดาห์)
- **Sprint 5**: Variant Generator (Manual + Bulk)
- **Sprint 6**: Resolve BOM per SKU + Variant BOM Override

### Phase 2+ — Out of MVP Scope
ดู `02_Requirements_Spec.md` Section 2 "Out of Scope"

---

## ⚠️ Pending Decisions (Block ก่อน Code)

| # | Pending | Owner | Block จนกว่า |
|---|---|---|---|
| O-1 | Hosting (Cloud / On-premise) | Stakeholder | Sprint 0 start |
| O-2 | Deployment Strategy | Stakeholder | Sprint 0 start |
| O-3 | MVP Scope (Lean/Comprehensive/Phased) | BA + Dev | Sprint 0 start |
| Backend Choice | Python vs Node | Dev + BA | Sprint 0 start |
| Q3.2 | สูตร Upholster ต่อ Type | Production | Sprint 4 BOM Builder |
| Q3.3 | พนักพิง/ข้าง ขึ้นกับ width? | Production | Sprint 4 |
| Q3.4 | Bed/Chair ใช้สูตรเดียวกัน? | Production | Sprint 4 |
| Q5.1 | % Overhead จริง | Finance | Sprint 7 Cost |
| Q10.2 | SKU rule preserve? | BA + Sales | Sprint 5 |

> **ก่อน implement feature ที่ block** → check ใน Decisions Log ว่าได้คำตอบหรือยัง

---

## 🧪 Sample Data Available

Schema มี Sample Data ครบ — รัน `04_Database_Schema.sql` แล้วจะมี:
- 4 Categories, 4 Types, 3 Models
- 6 Material Groups (รวม `is_general=true` สำหรับ overhead)
- 6 Materials + Prices
- 8 Sources, 4 Collections, 5 Colors + Upholster Prices
- 2 Products + 1 BOM Version + 5 BOM Lines (mix Material + Upholster Placeholder)
- 3 Variants + 1 Overhead Rate

ใช้ Sample Data นี้สำหรับ:
- Smoke test
- Acceptance test
- Demo

---

## 🔄 How to Handle Changes

### ถ้า User ขอเปลี่ยน Spec/Decision
1. **Log it first** — Update `03_Decisions_Log.md` (เพิ่ม Revision History)
2. **Apply downstream** — Update Schema, Spec, Mockup ที่เกี่ยวข้อง
3. **Implement** — Code follow new decision
4. **Test** — Update test cases
5. **Notify** — Tell user ทุกไฟล์ที่กระทบ

### ถ้าเจอ Edge Case ระหว่าง Build
1. **Stop and check** — มี Business Rule ครอบคลุมไหม
2. **ถ้าไม่มี** → ถาม user (อย่า assume)
3. **เมื่อได้คำตอบ** → log ใน Decisions Log ก่อน code

---

## 📞 Communication Style

- **ตอบเป็นภาษาไทย** ผสม English technical terms (ตามที่ user preference)
- **ใช้ examples ที่เชื่อมกับ business** — เช่น "Sofa 2S CHANA" ไม่ใช่ "FooBar"
- **อธิบาย Why ไม่ใช่แค่ What**
- **Step-by-step** เสมอ
- **Concise > Verbose** — ถ้าตอบใน 3 ประโยคได้ อย่าเขียน 30 ประโยค

---

## ✅ Pre-Sprint-0 Checklist (สำหรับ User)

- [ ] User ตอบ O-1, O-2, O-3 → Update CLAUDE.md
- [ ] User เลือก Backend stack (Python vs Node)
- [ ] Setup Git repo (recommend: GitHub + main branch protection)
- [ ] Setup PostgreSQL ใน dev environment
- [ ] User Run Schema first: `psql sofaplus_dev < 04_Database_Schema.sql`
- [ ] Verify Sample Data: `SELECT COUNT(*) FROM products;` → 2

หลัง checklist ครบ → User ส่ง prompt "เริ่ม Sprint 0" ให้ Claude Code

---

## 🚨 Reminders for Claude Code

1. **Read first, code later** — อ่านเอกสารที่ relevant ก่อนเขียน code ทุกครั้ง
2. **Schema is sacred** — แก้ schema ต้อง coordinate กับ migration + ORM models
3. **Conventions over creativity** — follow patterns ที่มีอยู่
4. **Test along the way** — อย่า build feature ทั้งสัปดาห์แล้วค่อย test
5. **MVP > Perfect** — ดู Out of Scope ใน `02_Requirements_Spec.md` แล้วอย่าทำเกิน
6. **Tag commit with Sprint #** — `[S2-FR7] Implement BOM Builder backend`
