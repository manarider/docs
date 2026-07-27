# Contributing Guidelines (CONTRIBUTING.md)

Thank you for contributing to the Project Tracking system! Follow these instructions to make code contributions.

## 1. Local Setup
1.  Clone the repository.
2.  Install dependencies:
    *   For Backend: `cd backend && npm install`
    *   For Frontend: `cd frontend && npm install`
3.  Configure local environment configurations by creating `backend/.env` copying from `backend/.env.example`.

---

## 2. Coding Standards

### Backend
*   **Database Queries:** Use `.lean()` for read-only queries to improve execution speed and memory footprints.
*   **Mongoose Objects:** Always convert Mongoose documents using `toObject()` before using destructuring or spread operations (`...`).
*   **Error Logs:** Log full errors including stack trace using:
    ```javascript
    logger.error(`[Context] Action failed: ${err.stack || err}`);
    ```
*   **Route Guards:** Enforce auth policies using `authenticateProject` and `requireProjectPermission`.

### Frontend
*   **Styles:** Maintain the orange/primary theme design. Ensure components are responsive on mobile screen resolutions.
*   **Interactions:** Support touch and pointer gestures using standard pointer listeners (`onPointerDown`).
*   **Compilations:** Ensure Vite builds execute successfully before staging files:
    ```bash
    cd frontend && npm run build
    ```

---

## 3. Pull Request & Commit Guidelines
*   Write clear commit messages using the standard conventional commit format:
    *   `feat: add print preview support`
    *   `fix: resolve mongoose context resolver bug`
*   Verify that backend unit tests pass:
    ```bash
    cd backend && npm test
    ```
