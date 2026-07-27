# CLAUDE.md Guidelines for Project Tracking System

This file serves as a reference guide for project setup, commands, architecture, and coding conventions in this repository.

## Commands Reference

### Backend Commands (from `/data/archives/backend`)
*   **Run Development Server:** `npm run dev`
*   **Run Production Server (via PM2):** `pm2 start src/app.js --name "docs-api"`
*   **Restart Server:** `pm2 reload docs-api`
*   **Run Tests:** `DOC_STORAGE_PATH=/data/documents npm test`
*   **Tail Logs:** `pm2 logs docs-api --lines 50`

### Frontend Commands (from `/data/archives/frontend`)
*   **Run Development Server:** `npm run dev`
*   **Build Production Bundle:** `npm run build`
*   **Preview Local Build:** `npm run preview`

---

## Repository Architecture

### Directory Layout
*   `/backend/src/` — Main Express API server.
    *   `app.js` — Bootstraps server, middleware, sessions (Redis), and routes.
    *   `config/` — Configurations (DB, Redis, storage).
    *   `middleware/` — Auth and project authentication policies.
    *   `models/` — MongoDB Mongoose schemas (`Document`, `Project`, `DailyReport`, etc.).
    *   `modules/` — Feature route controllers.
    *   `utils/` — Utility helper functions (e.g., `pdfGenerator.js` using `pdf-lib`).
*   `/frontend/src/` — React Single Page Application (Vite + TailwindCSS).
    *   `components/` — Reusable elements (`Sidebar.jsx`, `PrintReportButton.jsx`).
    *   `contexts/` — Global auth and session providers.
    *   `pages/` — View routes (`ProjectDailyReports.jsx`, `TemplateDesigner.jsx`).

---

## Coding Guidelines & Conventions

1.  **Backend Controller Patterns:**
    *   Avoid using the spread operator (`...`) directly on Mongoose Document instances. Convert them using `.toObject()` or use `.lean()` on queries first.
    *   Keep directory modifications inside paths verified by the `isSafePath` checker to prevent path traversal vulnerability.
    *   Logs must be formatted inside Winston using single strings or templates since Winston ignores extra parameters.

2.  **Frontend Design & State Patterns:**
    *   Use **immutable state updates** when modifying nested arrays or items in React components (e.g., in `TemplateDesigner.jsx`, clone pages/fields via `.map()` rather than mutating directly).
    *   Prefer **Pointer Events** (`onPointerDown`, `onPointerMove`, `onPointerUp`) over traditional Mouse/Touch events to support both desktop and mobile layouts seamlessly.
    *   Maintain paper design ratios on Canvas using standard CSS unitless `scale(x)` scale transformations computed dynamically.

3.  **UI Design Guidelines:**
    *   Use modern TailwindCSS styling matching the theme (curated orange/primary themes, rounded container cards, shadows).
    *   Buttons and click-targets must be desktop-friendly and touch-accessible (height $\ge$ 40px on mobile).
