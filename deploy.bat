@echo off
:: Enable local variable scope and delay expansion
setlocal enabledelayedexpansion

:: Retrieve system path from registry
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
:: Retrieve user path from registry
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"

:: Construct full PATH (expanding registry variables if any)
set "PATH=%SYS_PATH%;%USER_PATH%;%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SYSTEMROOT%\System32\WindowsPowerShell\v1.0\"

echo Refreshed PATH: %PATH%

echo.
echo ===================================================
echo [1/2] Submitting build to Google Cloud Build...
echo ===================================================
call gcloud builds submit --tag gcr.io/video-downloader-499911/streamvault-backend
if %ERRORLEVEL% neq 0 (
  echo Cloud Build failed with exit code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [2/2] Deploying container to Google Cloud Run...
echo ===================================================
call gcloud run deploy streamvault-backend --image gcr.io/video-downloader-499911/streamvault-backend --platform managed --allow-unauthenticated --region us-central1 --memory 1Gi --cpu 1 --update-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=video-downloader-fd8ef" --quiet
if %ERRORLEVEL% neq 0 (
  echo Cloud Run deployment failed with exit code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo Deployment completed successfully!
echo ===================================================
