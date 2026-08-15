@echo off
setlocal
set DJANGO_SETTINGS_MODULE=config.settings.mongo_same_db_poc
set MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true&retryWrites=true&w=majority
set MONGODB_DATABASE=fg_same_db_poc
set MONGODB_PRODUCTION_TARGET_DATABASE=mgintginpro_prod
set REDIS_URL=redis://127.0.0.1:6380/0
set DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,testserver
set PYTHONUNBUFFERED=1
cd /d C:\Projects\nelna-fg-digital-recording-system
uv run pytest --ds=config.settings.mongo_same_db_poc --ignore=apps/mongo_poc -q --tb=line
echo EXIT=%ERRORLEVEL%
