#!/usr/bin/env bash
# backup-mongo.sh — สำรองข้อมูล MongoDB ระบบคลังเอกสาร
# ใช้งาน: bash /data/archives/scripts/backup-mongo.sh
# แนะนำให้เพิ่มใน crontab: 0 2 * * * /data/archives/scripts/backup-mongo.sh >> /var/log/mongo-backup.log 2>&1

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
BACKUP_DIR="/data/backups/mongodb"
DB_HOST="192.168.100.15"
DB_PORT="27017"
DB_NAME="docs"
KEEP_DAYS=14  # เก็บ backup ไว้กี่วัน

# อ่าน credentials จาก environment หรือ .env ของ backend
ENV_FILE="/data/archives/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  # ดึง MONGO_URI จาก .env
  MONGO_URI=$(grep -E '^MONGO_URI=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'") || true
fi

# ─── Prepare ──────────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEST="${BACKUP_DIR}/${TIMESTAMP}"
mkdir -p "$DEST"

echo "[$(date '+%d/%m/%Y %H:%M:%S')] เริ่ม backup MongoDB → ${DEST}"

# ─── Dump ─────────────────────────────────────────────────────────────────────
if [[ -n "${MONGO_URI:-}" ]]; then
  mongodump --uri="$MONGO_URI" --out="$DEST" --quiet
else
  # fallback: ไม่มี MONGO_URI → ใช้ host/port โดยตรง (ไม่มี auth)
  mongodump --host="${DB_HOST}:${DB_PORT}" --db="$DB_NAME" --out="$DEST" --quiet
fi

# ─── Compress ─────────────────────────────────────────────────────────────────
ARCHIVE="${BACKUP_DIR}/${TIMESTAMP}.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$DEST"

echo "[$(date '+%d/%m/%Y %H:%M:%S')] บีบอัดเสร็จ → ${ARCHIVE}"

# ─── Rotate: ลบ backup เก่ากว่า KEEP_DAYS วัน ────────────────────────────────
find "$BACKUP_DIR" -name "*.tar.gz" -mtime "+${KEEP_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "*.tar.gz" | wc -l)
echo "[$(date '+%d/%m/%Y %H:%M:%S')] คงเหลือ backup ${REMAINING} ไฟล์ (เก็บ ${KEEP_DAYS} วัน)"
