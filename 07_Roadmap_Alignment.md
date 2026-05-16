# Roadmap vs Detailed Spec — Alignment Analysis

> **วันที่**: 2026-05-12
> **เปรียบเทียบ**: `Bill of Material Application Development Roadmap.docx` (Day-1 BA Report, 10 พ.ค. 2026) กับ Spec/Decisions ปัจจุบัน
> **เป้าหมาย**: ตรวจสอบความสอดคล้องก่อน Handoff Dev

---

## 📊 สรุปภาพรวม

| มิติ | Roadmap | Spec ปัจจุบัน | สถานะ |
|---|---|---|---|
| **ขอบเขตเอกสาร** | Strategic (Business Context + Gap + Roadmap) | Tactical (Requirements + Schema + Mockup) | ✅ Complementary |
| **เป้าหมาย MVP** | Catalog + BOM + Standard Cost | Catalog + BOM + Variant + Resolve | 🔄 ต้อง Align |
| **Timeline MVP** | 6 สัปดาห์ (Sprint 2-4) | 10 สัปดาห์ (Sprint 1-8) | 🔄 ต่างกัน |
| **Phasing** | 5 Phases (Phase 0-4) ~21 สัปดาห์ | 8 Sprints (MVP) | 🔄 Naming ต่างกัน |
| **Tech Stack** | PostgreSQL + Python/Node | PostgreSQL + Python/Node | ✅ ตรงกัน |

**สรุป**: เอกสาร 2 ชุดนี้**เสริมกัน** ไม่ใช่ขัดกัน — Roadmap = Strategic Direction, Spec = Tactical Implementation

แต่มี **terminology + scope drift** ที่ต้อง align เพื่อไม่ให้ Dev สับสน

---

## ✅ จุดที่สอดคล้อง (Aligned)

| # | จุด | Roadmap | Spec |
|---|---|---|---|
| 1 | Multi-variant Product | ✅ ระบุเป็น "Multi-variant" | ✅ Schema รองรับ Variants 822 SKU |
| 2 | BOM Versioning | ✅ "BOM ครบและ Versioned" (Gap 2, P0) | ✅ Q4 = Locked, `bom_versions` table |
| 3 | Standard Material Cost | ✅ "Lock ราคา ณ ช่วงเวลา" (Gap 3, P0) | ✅ Q7 = Lock (snapshot), `material_prices` versioned |
| 4 | Master Data ก่อน | ✅ Phase 0 + Gap 1 P0 | ✅ Sprint 1-3 ใน plan |
| 5 | Database | ✅ แนะนำ PostgreSQL | ✅ Spec แนะนำ PostgreSQL 15+ |
| 6 | Backend Stack | ✅ Python หรือ Node.js | ✅ Spec แนะนำเหมือนกัน |
| 7 | Solo Developer | ✅ Outsource 1 คน | ✅ Spec ออกแบบให้ 1 คน build ได้ |
| 8 | BOM Coverage 100% | ✅ KPI "BOM Coverage %" | ✅ FR-6.3-4: Active Product ต้องมี BOM |
| 9 | Sprint 2 สัปดาห์ | ✅ แนะนำ 2 สัปดาห์ | ✅ ไม่ระบุชัด แต่ implicit ใน sprint count |
| 10 | Risk: User adoption | ✅ UX 30 นาที | ✅ Mockup ออกแบบให้ใช้ง่าย |

---

## 🔄 จุดที่ต่างกัน + แนะนำแก้ (Drift Items)

### Drift 1: **Phasing & Timeline ไม่ตรงกัน**

**Roadmap**:
```
Phase 0 — Foundation     (Sprint 0-1, ~3 สัปดาห์) — Schema + Master Data Migration + Environment
Phase 1 — MVP             (Sprint 2-4, ~6 สัปดาห์) — Catalog + BOM + Cost Rollup
Phase 2 — Inventory       (Sprint 5-6, ~4 สัปดาห์)
Phase 3 — Job Costing     (Sprint 7-8, ~4 สัปดาห์)
Phase 4 — Margin Analytics (Sprint 9-10, ~4 สัปดาห์)
Total: 21 สัปดาห์
```

**Spec ปัจจุบัน**:
```
Sprint 1-3 — Master Data CRUD (ครอบคลุม Foundation + ส่วนหนึ่งของ MVP)
Sprint 4   — BOM Builder
Sprint 5   — Copy BOM
Sprint 6   — Variants (Manual + Bulk)
Sprint 7   — Resolve BOM per SKU
Sprint 8   — Variant Override
Total MVP: ~10 สัปดาห์
```

**ปัญหา**: 
- Spec ไม่ได้แยก Phase 0 ออกชัด ๆ — รวมไว้ใน Sprint 1-3
- Spec MVP มี **Variant + Resolve + Override** (Sprint 6-8) ที่ Roadmap ไม่ระบุชัดว่าอยู่ใน Phase 1 หรือ Phase 2

**แนะนำ**:
1. **Re-number Sprints ของ Spec ให้ตรง Roadmap**: Sprint 0-1 = Foundation, Sprint 2-4 = MVP Build
2. **ลด scope MVP ของ Spec**:
   - Sprint 2 = Master Data CRUD + Product
   - Sprint 3 = BOM Builder + Copy BOM
   - Sprint 4 = Standard Cost Calculator + Cost Rollup
   - **Variant Generation + Resolve BOM** → ย้ายไป Phase 1.5 หรือต้น Phase 2
   - **Variant Override** → Phase 2 หรือ 3
3. หรือ **ขยาย MVP ของ Roadmap** จาก 6 → 10 สัปดาห์ — ตามจริง Spec ที่ละเอียดขึ้น

> **Trade-off**: Roadmap optimistic (6 สัปดาห์) vs Spec ละเอียด (10 สัปดาห์) — ต้องเลือกอันที่ realistic กว่าหลังคุยกับ Dev

---

### Drift 2: **Cost Rollup Engine ไม่อยู่ใน Spec ชัดเจน**

**Roadmap Phase 1 Modules**:
1. Product + Variant Catalog
2. Material Master
3. **BOM Editor** ← Spec ครอบคลุม (FR-7, FR-8)
4. **Standard Material Cost Calculator** ← Spec มีแค่ราคา versioned ไม่มี "Calculator" UI
5. **Cost Rollup Engine** ← Spec มี Resolve BOM (FR-11) แต่ไม่เรียกว่า "Engine"

**แนะนำเพิ่มใน Spec**:
- **FR-18: Standard Cost Calculator UI** — หน้าจอแสดง Cost ณ ช่วงเวลา + ราคาที่ Lock
- **FR-19: Cost Rollup Batch Job** — รัน batch คำนวณ Cost ของ SKU ทั้งหมดเป็นชุด + บันทึก snapshot

---

### Drift 3: **KPI Tracking ไม่อยู่ใน Spec**

Roadmap ระบุ 4 กลุ่ม KPI ที่ Phase 4 จะ Implement:

| กลุ่ม | KPI หลัก |
|---|---|
| **Cost & Margin** | Gross Margin %, Std vs Actual Variance, BOM Coverage %, Cost Calc Cycle Time |
| **Inventory** | Turnover, DOH, Stockout, Inventory Accuracy |
| **Operations** | Production Cost per Unit, Lead Time, Fulfillment Rate |
| **Sales & Branch** | Volume per SKU per Branch, Pareto 80/20, Sell-through |

**Spec ไม่มี Section นี้** — ทำให้ Dev ไม่เห็นภาพ Reporting/Dashboard ที่จะ Build ใน Phase 4

**แนะนำ**:
- เพิ่ม Section ใน Spec: "Phase 4 — KPI Dashboard Requirements" (placeholder ให้ Dev เห็นว่า Phase 4 ต้องเก็บ data อะไรไว้รองรับ)

---

### Drift 4: **Open Questions ไม่ตรงกัน**

**Roadmap Open Questions** (ที่ Spec ไม่มี):
| # | Question | สถานะ |
|---|---|---|
| O-1 | Hosting: Cloud (AWS/GCP) หรือ On-premise ที่โรงงาน? | ❓ Pending |
| O-2 | Sprint Length: 1 หรือ 2 สัปดาห์? (Roadmap แนะนำ 2) | ✅ Roadmap default = 2 weeks |
| O-3 | Deployment Strategy: Big Bang หรือ Phased Rollout (โรงงานก่อน → สาขา)? | ❓ Pending |

**Spec Open Questions** (ที่ Roadmap ไม่มี):
| # | Question | สถานะ |
|---|---|---|
| Q3.2 | สูตร Upholster ต่อ Type | ❓ Production |
| Q5.1 | % Overhead rate | ❓ Finance |
| Q10.2 | SKU rule ของเก่า | ❓ BA + Sales |

→ **แนะนำ**: รวม Open Questions ทั้ง 2 ฝั่งใน Decisions Log

---

### Drift 5: **Gap Analysis ใน Roadmap ละเอียดกว่ามาก**

Roadmap มี Gap Analysis 10 ข้อ จัด Priority P0-P3 ที่**ขาดไปจาก Spec**:

**P1 (Phase 2)**:
- Gap 4: Inventory Tracking
- Gap 5: PO History ที่ Search ได้

**P2 (Phase 3)**:
- Gap 6: Job Costing
- Gap 7: Direct Labor Cost

**P3 (Phase 4)**:
- Gap 8: Per-SKU P&L Report
- Gap 9: Branch Performance Comparison
- Gap 10: Factory Overhead Allocation

→ **แนะนำ**: ใส่ section "Out of MVP Scope (Phase 2-4)" ใน Spec ที่ link ไปยัง Gap Analysis ของ Roadmap

---

### Drift 6: **Spec มี Features ที่ Roadmap ไม่ระบุ** (R2/R3 Updates)

| Feature | Spec | Roadmap | กระทบ |
|---|---|---|---|
| 3-Tier BOM Hierarchy (NR-2) | ✅ Schema-ready ใน MVP, UI Phase 2 | ❌ ไม่ระบุ | ดีต่อ scalability — Dev ต้องเข้าใจ |
| Standard Size Spec (NR-1) | ✅ FR-13 | ❌ ไม่ระบุ | จำเป็นสำหรับ Upholster formula |
| Upholster Linear Step Model (Q3) | ✅ FR-14 | ❌ ไม่ระบุ | จำเป็น — Dev ต้อง implement |
| Variant Override (FR-10) | ✅ Sprint 8 | ⚠️ implicit ใน "BOM ต่าง Variant" | ต้อง flag ว่าจำเป็นจริงไหม |
| Industrial UI Direction (NR-5) | ✅ Mockup | ❌ ไม่ระบุ | Design-level ไม่กระทบ scope |

→ **เหตุผล**: เพราะ Roadmap ทำก่อน Reviews 2 รอบของเรา (R2/R3) — เป็นการเสริม ไม่ได้ขัด

---

## 🎯 Action Items ก่อน Handoff Dev

### Priority สำคัญ (ทำก่อน Sprint 0)

| # | Action | Owner | Deadline |
|---|---|---|---|
| A-1 | **Align Sprint numbering** — ตัดสินใจระหว่าง Roadmap (Phase 0-4) vs Spec (Sprint 1-8) | BA | ก่อน Sprint 0 |
| A-2 | **ตัดสิน MVP scope** — ใส่ Variant + Resolve ใน Phase 1 หรือไม่? | BA + Dev | ก่อน Sprint 0 |
| A-3 | **เพิ่ม Cost Calculator/Rollup ใน Spec** — FR-18, FR-19 | BA | ก่อน Sprint 2 |
| A-4 | **รวม Open Questions ทั้ง 2 ฝั่ง** ใน Decisions Log | BA | ก่อน Sprint 0 |
| A-5 | **Update Decisions Log** ให้รวม Hosting + Deployment Strategy decisions | BA + Owner | ก่อน Sprint 0 |

### Priority รอง (ทำระหว่างทาง)

| # | Action | Owner |
|---|---|---|
| A-6 | เพิ่ม Section "Phase 4 KPI Requirements" ใน Spec | BA |
| A-7 | เพิ่ม Reference ไปยัง Roadmap Gap Analysis ใน Spec | BA |
| A-8 | Validate ระบบใหม่ (R2/R3) กับ Roadmap — ทำเพิ่ม Decision Doc ในการขยายขอบเขต | BA + MD |

---

## 💡 Trade-off ที่ต้องตัดสิน

### Decision: **MVP Scope — ใหญ่หรือเล็ก?**

**Option A — Roadmap MVP (Lean, 6 สัปดาห์)**:
- Phase 1 = Catalog + BOM + Standard Cost เท่านั้น
- **Variant Generation + Resolve BOM** → Phase 1.5 หรือ Phase 2
- **Pro**: เห็น Value เร็ว, Dev ทำงานน้อย risk ต่ำ
- **Con**: ยังไม่เห็น "Cost ต่อ SKU" จริง ๆ จนกว่าจะมี Variant

**Option B — Spec MVP (Comprehensive, 10 สัปดาห์)**: ⭐ แนะนำ
- Sprint 2-4 (6 สัปดาห์) ตาม Roadmap + เพิ่ม Sprint 5-7 สำหรับ Variant + Resolve
- **Pro**: MVP end-state สมบูรณ์ — ใช้คำนวณ Cost ต่อ SKU ได้จริง
- **Con**: ใช้เวลาเพิ่ม 4 สัปดาห์, ต้องอธิบาย stakeholder ทำไมยาว

**Option C — Phased MVP Release**:
- MVP 1.0 (6 สัปดาห์) = ตาม Roadmap = ตั้งราคา Standard Cost ระดับ Product ได้
- MVP 1.1 (+3 สัปดาห์) = เพิ่ม Variants + Resolve = ระดับ SKU ครบ
- **Pro**: Stakeholder เห็น progress ใน 6 สัปดาห์ + ขยายต่อภายใน 9 สัปดาห์
- **Con**: ต้อง refactor ระหว่างเฟส

---

## 🤔 ผมแนะนำ

**Option C — Phased MVP Release**:
- Stakeholder ได้เห็น Value ใน 6 สัปดาห์ (เหมือนสัญญา Roadmap)
- BA ยังได้ "MVP สมบูรณ์" ที่ใช้ได้จริง (เหมือน Spec)
- ลดความเสี่ยงโดยปล่อยทีละชิ้น

แต่ทุกอย่างขึ้นกับการคุยกับ Dev ว่าทำได้ใน timeline ไหน

---

## 📝 Conclusion

**สรุป Alignment**:
- ✅ **ตรงกัน 80%** — เหตุผลทำ, Tech Stack, Foundation Approach, BOM Centrality
- 🔄 **ต่างกัน 20%** — Sprint numbering, MVP scope ละเอียด, KPI tracking (Roadmap > Spec)
- 🆕 **Spec มีของใหม่** — 3-tier, Standard Size, Linear Step formula, Industrial UI (จาก R2/R3 reviews)

**Recommended Next Step**:
1. ✅ คุณ Review เอกสารนี้
2. ตัดสินใจ Option A/B/C สำหรับ MVP Scope
3. Lock decisions เพิ่ม (Hosting, Deployment Strategy, Sprint Length)
4. Apply การ update ไปที่ Spec + Decisions Log
5. Wrap up — เริ่ม Sprint 0 กับ Dev ได้

---

## 🗺️ Phase 2 Scope (Post-MVP — หลัง Handoff Dev)

> **อัพเดต**: 2026-05-16 (R4 — หลัง Prototype สำเร็จ Sprint 0-6)
> **สถานะ**: MVP Prototype (Sprint 0-6) เสร็จแล้ว → เตรียม Handoff Dev สำหรับ Production Build
> **Phase 2 ทำอะไร**: ขยายระบบหลัง MVP Production ใช้งานแล้ว

### Phase 2 Feature List (4 หัวข้อ — Lock แล้ว)

| # | Feature | เหตุผล | Complexity |
|---|---|---|---|
| **P2-1** | **3-Tier BOM (Type-level BOM)** | ลด BOM ต้องดูแลจาก 176 → ~50 ชุด (72%) | สูง — ต้องเพิ่ม UI + Inheritance logic |
| **P2-2** | **Selling Price per Variant + Margin Calc** | กรอก selling price ต่อ SKU → คำนวณ Gross Margin % อัตโนมัติ | ปานกลาง |
| **P2-3** | **Cost Summary Dashboard** | ดู cost/margin ข้ามหลาย SKU, filter ตาม Category/Type, Export | ปานกลาง |
| **P2-4** | **Overhead Rate Management UI** | แก้ % overhead ได้จาก UI (ปัจจุบัน hardcode 3.5% ใน DB) | ต่ำ |

### P2-1 Detail: 3-Tier BOM

```
Phase 2 BOM Hierarchy:
Type: "CHANA" → BOM Template กลาง (โครงเหล็ก + ฟองน้ำ + ผ้า)
  ↳ Product: "2S CHANA" → Inherit จาก Type + qty override ตาม size
  ↳ Product: "3S CHANA" → Inherit จาก Type + qty override ตาม size
```

- Schema รองรับแล้ว (`bom_versions.type_id`, `products.bom_source = 'TYPE_INHERITED'`)
- Phase 2 เพิ่ม: UI สร้าง Type-level BOM + Resolve logic ที่ walk up hierarchy

### P2-2 Detail: Selling Price + Margin

```
Margin % = (Selling Price - Total BOM Cost) / Selling Price × 100
```

- `product_variants` เพิ่ม `selling_price` field
- Resolved BOM response เพิ่ม `margin_amount`, `margin_pct`

### P2-3 Detail: Cost Dashboard

- Filter: Category / Type / Source (Material type: ผ้า/หนัง/หนังเทียม)
- Columns: SKU, Material Cost, Upholster Cost, Overhead, Total Cost, Selling Price, Margin%
- Export CSV / Excel

### P2-4 Detail: Overhead Rate UI

- ปัจจุบัน `overhead_rates` table มีค่าอยู่แล้วใน DB (3.5% default)
- Phase 2 เพิ่ม UI: CRUD overhead rates ต่อ Category หรือ Global

---

### สิ่งที่ Phase 2 **ไม่ทำ** (Phase 3+)

| Feature | Phase |
|---|---|
| Inventory Tracking | Phase 3 |
| Job Costing / Direct Labor | Phase 3 |
| Per-SKU P&L Report | Phase 4 |
| User Authentication / Roles | Phase 3 |
| Data Import จาก Excel (Production) | Phase 3 |
| Sales Order Integration | Phase 3+ |
