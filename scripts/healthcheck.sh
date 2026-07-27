#!/usr/bin/env bash
# healthcheck.sh — ตรวจสอบ docs-api (port 4040) และ auto-restart ถ้า down
# crontab: */5 * * * * /data/archives/scripts/healthcheck.sh >> /var/log/docs-healthcheck.log 2>&1

PORT=4040
SERVICE="docs-api"
LOG_TAG="[docs-healthcheck]"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# โหลด nvm / node ให้ pm2 ใช้งานได้ใน cron environment
export NVM_DIR="/home/manarider/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" --no-use
export PATH="/home/manarider/.nvm/versions/node/v20.20.2/bin:$PATH"

# ตรวจสอบด้วย HTTP request
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${PORT}/")

if [[ "$HTTP_CODE" == "000" || -z "$HTTP_CODE" ]]; then
  echo "$TIMESTAMP $LOG_TAG WARN: port $PORT ไม่ตอบสนอง (HTTP $HTTP_CODE) — กำลัง restart $SERVICE"
  pm2 restart "$SERVICE" --update-env
  RESTART_CODE=$?
  if [[ $RESTART_CODE -eq 0 ]]; then
    echo "$TIMESTAMP $LOG_TAG OK: restart $SERVICE สำเร็จ"
  else
    echo "$TIMESTAMP $LOG_TAG ERROR: restart $SERVICE ล้มเหลว (exit $RESTART_CODE)"
  fi
else
  echo "$TIMESTAMP $LOG_TAG OK: port $PORT ตอบสนอง HTTP $HTTP_CODE"
fi
