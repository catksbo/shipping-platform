@echo off
cd /d "%~dp0.."
for /f "tokens=1,* delims==" %%A in (.env) do (
  if "%%A"=="STRIPE_SECRET_KEY" set "STRIPE_API_KEY=%%~B"
)
set STRIPE_API_KEY=%STRIPE_API_KEY:"=%
tools\stripe.exe listen --forward-to localhost:3001/payments/stripe/webhook > stripe-listen.log 2>&1
