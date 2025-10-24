# Installation and Quick Start Script
# Run this in PowerShell to get started quickly

Write-Host "🚀 Kiro-Style Copilot Extension - Setup" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js is not installed. Please install Node.js v18 or higher." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "✅ npm is installed: v$npmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ npm is not installed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Compiling TypeScript..." -ForegroundColor Yellow
npm run compile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Compilation successful" -ForegroundColor Green
} else {
    Write-Host "❌ Compilation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Press F5 in VS Code to launch the Extension Development Host" -ForegroundColor White
Write-Host "2. In the new window, open Command Palette (Ctrl+Shift+P)" -ForegroundColor White
Write-Host "3. Type 'Kiro: Select Coding Mode' to get started" -ForegroundColor White
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "- QUICKSTART.md  - 5-minute getting started guide" -ForegroundColor White
Write-Host "- USAGE_GUIDE.md - Complete user documentation" -ForegroundColor White
Write-Host "- SETUP.md       - Development setup details" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🎉" -ForegroundColor Cyan
