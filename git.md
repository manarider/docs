# Git Reference

## Remote Repository

```
https://github.com/manarider/docs.git
```

## Initial Setup

```bash
git init
git remote add origin https://github.com/manarider/docs.git
git branch -M main
```

## ตรวจสอบ remote

```bash
git remote -v
```

## Commit & Push

```bash
git add .
git commit -m "message"
git push origin main
```

## Push ครั้งแรก

```bash
git push -u origin main
```

## Pull

```bash
git pull origin main
```

## ดู status และ log

```bash
git status
git log --oneline --graph
```

## .gitignore แนะนำ

```
node_modules/
backend/logs/
backend/.env
frontend/dist/
lost+found/
*.tar.gz
```
