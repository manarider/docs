# System Workflows (flow.md)

This document describes the key runtime flows of the Project Tracking System.

## 1. User Management System (UMS) OAuth Login Flow
1.  **Request Login:** The user navigates to `/docs/api/auth/login`.
2.  **Redirect to UMS:** Express API redirects to `https://nssv.nsm.go.th/ums/login?redirect=https://app.nsm.go.th/docs/auth-callback`.
3.  **Authentication:** User enters credentials on UMS and is redirected back with a token parameter: `/docs/auth-callback?token={jwt}`.
4.  **Token Verification:** React router captures the token and requests the backend: `/api/auth/callback?token={jwt}`.
5.  **Fetch Profile:** Backend performs a server-to-server request to UMS endpoint `/api/auth/me` with header `Authorization: Bearer {jwt}`.
6.  **Create Session:** UMS returns profile and project permissions. Backend stores profile in `req.session.user` and redirects to the frontend homepage.

---

## 2. Project Key Auth Flow (External Contractors)
1.  **Login Entry:** Contractor opens `/docs/projects/:projectId/login`.
2.  **Verify Public Info:** Client fetches public project title and metadata from `/api/project-auth/project/:projectId/info`.
3.  **Submit Key:** Contractor enters key and submits to `/api/project-auth/login`.
4.  **Hash Verification:** Backend performs a SHA-256 hash of the submitted key and queries the database `ProjectKey` collection.
5.  **Enforce Limits:** Checks `expires_at > Date.now()` and `is_active === true`.
6.  **Establish Project Session:** Stores key metadata in `req.session.project_user` with cookie maxAge matching the key expiration.

---

## 3. Template Design & Drag-Drop Flow
1.  **Select Template:** User navigates to Report Manager and selects a template to open the Template Designer canvas.
2.  **Page Layout & Scale:** React initializes `ResizeObserver` on the viewport wrapper to scale the Canvas maintaining aspect ratio (e.g. A4 `595 x 842`).
3.  **Add Fields:** Selecting fields from the Dropdown Palette appends fields with initial layouts to `template.pages[currentPageIndex].fields`.
4.  **Drag-and-Resize UI:** 
    *   `onPointerDown` captures start coordinate, boundary box, and current scale factor (`canvasScale.scale`).
    *   `onPointerMove` computes displacement, divides by scale factor to maintain scale independence, and immutably updates field coordinates (`x`, `y`, `width`, `height`).
    *   `onPointerUp` detaches event listeners.
5.  **Save Layout:** Clicking "Save" calls `PUT /api/projects/:projectId/report-templates/:templateId` updating the database.

---

## 4. Report Print & Preview Flow
1.  **Retrieve Templates:** Clicking "Print Report" in a detail page requests active templates via `/api/projects/:projectId/reports/:module/:recordId/templates`.
2.  **Fetch Sample Record:** Clicking "Preview" in the Template Designer requests the latest record via `/projects/:projectId/:module?limit=1`.
3.  **Generate PDF Endpoint:** Client opens or requests `GET /api/projects/:projectId/reports/:module/:recordId/generate/:templateId?preview=true` (preview flag skips active check).
4.  **Load Assets:** Backend loads the template fields list, resolves the background PDF from the documents folder, and reads `THSarabunNew.ttf` binary font.
5.  **Resolve Data Context:** Mongoose documents are converted to plain JS objects using `toObject()` or `.lean()`, then spread into a unified context object.
6.  **Render Output:** Resolves fields dynamically, computes font metrics for text alignment, and draws texts on the canvas pages before returning the PDF buffer.
