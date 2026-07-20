@echo off
cd /d "%~dp0.."
node dist\src\main.js > api.log 2>&1
