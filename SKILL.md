# Developer Skill Guide (SKILL.md)

This file contains guides on how to implement new features and perform common maintenance tasks in this codebase.

## 1. Adding a New Database Field to the Project
To add a new project field (e.g., contract manager name) and make it available in the template designer:

1.  **Update Schema:**
    *   Open `/backend/src/models/Project.js`.
    *   Add the new field to the schema object (e.g., `contract_manager: { type: String, default: '', trim: true }`).
2.  **Update Controller Mapping:**
    *   Open `/backend/src/modules/projects/project.controller.js`.
    *   Find `updateProject` method.
    *   Destructure the new field from `req.body` and add it to `updateData` validation block.
3.  **Extend PDF Context Resolver:**
    *   Open `/backend/src/utils/pdfGenerator.js`.
    *   Find `getFieldValue` function.
    *   Add your mapping resolver:
        ```javascript
        if (key === 'contractManager') return record.project?.contract_manager || '';
        ```
4.  **Register Field in Palette:**
    *   Open `/frontend/src/pages/TemplateDesigner.jsx`.
    *   Find the `PROJECT_FIELDS` catalog array.
    *   Append your new option:
        ```javascript
        { id: '_project.contractManager', label: 'ผู้จัดการสัญญา' },
        ```

---

## 2. Resolving Custom Module Fields in PDF
To add new values from custom modules (e.g. daily reports detail fields):

1.  **Retrieve values:** Make sure the field exists in the Mongoose Model.
2.  **Map in getFieldValue:** Open `pdfGenerator.js` and map the new field to a specific string key (e.g., `report.weather` maps to `record.weather`).
3.  **Catalog Registration:** Add the exact string key and clear label name to `FIELD_CATALOG` in `TemplateDesigner.jsx` so it appears in the dropdown list.

---

## 3. Maintenance: Overwriting/Reinstalling Fonts
If the Thai font file is corrupted or throws "Unknown font format":
1.  Verify the file size and metadata using `file backend/src/assets/fonts/THSarabunNew.ttf`.
2.  Download a binary `.ttf` file using:
    ```bash
    curl -L -o backend/src/assets/fonts/THSarabunNew.ttf https://github.com/Phonbopit/sarabun-webfont/raw/master/fonts/thsarabunnew-webfont.ttf
    ```
3.  Restart backend processes with `pm2 reload docs-api`.
