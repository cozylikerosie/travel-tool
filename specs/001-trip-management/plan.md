# Implementation Plan: 建立與管理旅程（電腦端）

**Branch**: `001-trip-management` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: 建立電腦端個人旅程、瀏覽與分類列表、編輯、刪除及複製；本次不實作每日行程、地圖、交通、手機輸出、花費記錄或多人協作。

## Summary

以 Vite、React、TypeScript 建立無後端單頁應用，使用 IndexedDB 與 Dexie 保存旅程，支援基本資料 CRUD、首頁日期分類與排序、複製及刪除確認。使用 Tailwind CSS 建立以桌面規劃為主的介面，透過 vite-plugin-pwa 提供可安裝的靜態應用程式外殼。資料結構以旅程 ID 為未來每日行程、交通與花費等資料的關聯錨點；本次不建立未使用的後續資料表或資料交換流程。

## Technical Context

**Language/Version**: TypeScript with strict type checking; select a current Vite-compatible version during scaffold.

**Primary Dependencies**: Vite, React, Tailwind CSS, Dexie.js, vite-plugin-pwa, lucide-react, Vitest, React Testing Library, jsdom, fake-indexeddb.

**Storage**: Browser IndexedDB through Dexie.js; no backend or remote persistence.

**Testing**: Vitest and React Testing Library; fake-indexeddb for repository tests; production-preview browser checks for persistence and PWA behavior.

**Target Platform**: Desktop browsers first for trip management; static GitHub Pages deployment. The app shell is responsive/PWA-ready for later mobile trip viewing and expense entry.

**Project Type**: Single frontend web application / installable static PWA.

**Visual Design**: Follow `docs/design-guide.md`. Define Tailwind theme tokens for the full palette: `#F7F5F0`, `#FFFFFF`, `#1A1A1A`, `#6B6B6B`, `#D9D5CC`, `#8A7A5C`, budget status colors `#6F8A6B`, `#B8935A`, `#A65A4E`, and dark-mode colors `#141414`, `#EDEAE3`, `#3A3833`. Define font-family tokens for Noto Serif TC, Noto Sans TC, Cormorant Garamond, and Inter. Use `lucide-react` for interface icons.

**Performance Goals**: No numeric latency or scale target is specified. Local CRUD and list rendering must remain responsive for a personal travel collection; avoid adding infrastructure or performance complexity without measured need.

**Constraints**: No backend, account, or sync. Trip dates are date-only values and must not shift with timezone conversion. Amounts are safe integers in ISO 4217 minor units (JPY, TWD). Persisted data must be versionable for future database upgrades and JSON exchange.

**Scale/Scope**: One user's local device and browser; feature 001 only. Future child records associate through `tripId`; future mobile export, itinerary, transport, and expense workflows remain out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 三階段旅行流程 — PASS**: 本功能完成行前建立與管理階段；旅途中與旅後功能由後續 feature 負責，不提前混入本次交付。
- **II. 旅途離線使用 — PASS WITH SCOPE BOUNDARY**: App shell 以 PWA 快取支援安裝後離線開啟；本次不實作手機行程查看或花費記錄，這些依規格明確留給後續功能。
- **III. 裝置獨立與使用者掌控資料 — PASS**: 旅程僅存於使用者裝置的 IndexedDB，不要求登入、遠端服務或同步。
- **IV. 功能必須有測試 — PASS**: 每個使用者可見流程均規劃 Vitest/RTL 測試；儲存、日期分類、驗證、複製與刪除均有對應測試情境。
- **V. 簡單且聚焦 — PASS**: 本次只建旅程資料與必要 CRUD；未實作每日行程、地圖、交通、費用資料表、匯出匯入或協作。
- **Additional Constraints — PASS**: 介面及提示使用繁體中文；桌面是本 feature 的主要操作介面。
- **Development Workflow — PASS**: 每項功能以 spec 驗收情境與 automated tests 對應，設計後再次檢查範圍與資料保存原則。

Phase 0 research resolved the explicit technology choices and remaining design questions. No unresolved `NEEDS CLARIFICATION` items remain.

## Project Structure

### Documentation (this feature)

```text
specs/001-trip-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md             # Created by /speckit-tasks, not by /speckit-plan
```

### Source Code (repository root)

```text
src/
├── app/                    # App shell and top-level navigation
├── features/
│   └── trips/              # Trip list, form, details, and user actions
├── data/                   # Dexie database and trip repository
├── shared/
│   ├── dates/              # Date-only parsing and calendar arithmetic
│   └── money/              # Currency minor-unit parsing and formatting
└── styles/                 # Tailwind entry, theme tokens, and global styles

tests/
├── unit/                   # Date, money, and validation rules
└── integration/            # Dexie repository and user-visible flows
```

**Structure Decision**: 使用單一 Vite frontend；旅程功能依 feature 集中，Dexie schema/repository 與純日期、金額規則分開。Tailwind 主題集中定義設計指南指定的色彩與字體 tokens，介面圖示統一使用 Lucide React。工作區目前尚無應用程式或 package 設定，implementation 需先建立 Vite scaffold。無後端 API 或跨系統介面，因此本次不建立 `contracts/`；未來 JSON 匯出/匯入是另一期功能，格式版本在資料模型文件中先定義相容原則。

## Complexity Tracking

No constitution violations. The selected libraries are explicit project choices; no extra service or future-feature tables are introduced in this plan.
