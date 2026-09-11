# ==============================================================================
# RevenuePilot v4.2 — RecoveryLambda Production Package Builder (PowerShell)
# Target: AWS Lambda (Python 3.10 / 3.11 / 3.12 / 3.13)
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
Set-Location -Path $ScriptDir

Write-Host ">>> [1/5] Cleaning old build artifacts..." -ForegroundColor Cyan
Remove-Item -Path package -Recurse -Force -ErrorAction Ignore
Remove-Item -Path recovery_lambda.zip -Force -ErrorAction Ignore

Write-Host ">>> [2/5] Creating clean package directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path package -Force | Out-Null

Write-Host ">>> [3/5] Installing production dependencies (pymongo, dnspython, certifi)..." -ForegroundColor Cyan
pip install pymongo dnspython certifi -t package --no-cache-dir

Write-Host ">>> [4/5] Copying Lambda source files..." -ForegroundColor Cyan
Copy-Item recovery_lambda.py -Destination package\
Copy-Item utils -Destination package\utils -Recurse -Force

# Create root-level import alias for AWS Lambda execution
New-Item -ItemType Directory -Path package\aws_lambda -Force | Out-Null
Copy-Item utils -Destination package\aws_lambda\utils -Recurse -Force

Write-Host ">>> [5/5] Compressing package into recovery_lambda.zip..." -ForegroundColor Cyan
Set-Location -Path package
Compress-Archive -Path * -DestinationPath ..\recovery_lambda.zip -Force
Set-Location -Path ..

$ZipFile = Get-Item recovery_lambda.zip
Write-Host "======================================================" -ForegroundColor Green
Write-Host "SUCCESS: recovery_lambda.zip created successfully!" -ForegroundColor Green
Write-Host "File Path: $($ZipFile.FullName)" -ForegroundColor Green
Write-Host "Size: $([math]::Round($ZipFile.Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
