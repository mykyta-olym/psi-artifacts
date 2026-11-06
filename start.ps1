#!/usr/bin/env pwsh
#Requires -Version 5.1
<#
.SYNOPSIS
    MAIS Management System - One-Click Start Script
    
.DESCRIPTION
    This script automates the complete setup and launch of the MAIS Management System.
    It handles Docker, database initialization, backend, frontend, and browser launch.
    
.PARAMETER Mode
    Specifies the run mode:
    - full     : Start both backend (Docker) and frontend dev server (default)
    - backend  : Start only backend via Docker
    - frontend : Start only frontend dev server
    - docker   : Alias for backend
    - dev      : Start frontend in dev mode with hot reload
    - build    : Build production frontend and start backend
    - stop     : Stop all running services
    - restart  : Restart all services
    - logs     : Show backend logs
    - clean    : Stop and remove all containers, volumes, and build artifacts
    - reseed   : Reseed database with fresh data
    
.PARAMETER NoBrowser
    Skip automatic browser launch
    
.PARAMETER NoSwagger
    Skip automatic Swagger UI launch
    
.PARAMETER AutoReseed
    Automatically reseed database on startup
    
.PARAMETER Verbose
    Show detailed output
    
.EXAMPLE
    ./start.ps1
    # Starts everything with default settings
    
.EXAMPLE
    ./start.ps1 -Mode backend
    # Starts only the backend (API + Database)
    
.EXAMPLE
    ./start.ps1 -Mode dev -NoBrowser
    # Starts frontend dev server without opening browser
    
.EXAMPLE
    ./start.ps1 -Mode clean
    # Stops and removes all containers and volumes
    
.EXAMPLE
    ./start.ps1 -AutoReseed
    # Starts with fresh database seed
#>

param(
    [ValidateSet("full", "backend", "frontend", "docker", "dev", "build", "stop", "restart", "logs", "clean", "reseed")]
    [string]$Mode = "full",
    
    [switch]$NoBrowser,
    [switch]$NoSwagger,
    [switch]$AutoReseed,
    [switch]$VerboseOutput
)

# ============================================================================
# ENCODING FIX - Ensure proper UTF-8 output
# ============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$env:PYTHONIOENCODING = "utf-8"
# Set console code page to UTF-8 (65001)
$null = chcp 65001 2>$null

# ============================================================================
# CONFIGURATION
# ============================================================================

$ErrorActionPreference = "Stop"
$script:ProjectRoot = $PSScriptRoot
$script:FrontendDir = Join-Path $ProjectRoot "frontend"
$script:BackendDir = Join-Path $ProjectRoot "backend"

# URLs
$script:ApiUrl = "http://localhost:5000"
$script:FrontendUrl = "http://localhost:4028"
$script:SwaggerUrl = "$ApiUrl/swagger"
$script:HealthUrl = "$ApiUrl/healthz"
$script:ReseedUrl = "$ApiUrl/api/db/reseed"

# Animation frames
$script:SpinnerFrames = @("|", "/", "-", "\")

# ============================================================================
# FANCY OUTPUT FUNCTIONS
# ============================================================================

function Show-Banner {
    Clear-Host
    
    Write-Host ""
    Write-Host "  ███╗   ███╗ █████╗ ██╗███████╗    ██████╗     ██████╗ " -ForegroundColor Cyan
    Write-Host "  ████╗ ████║██╔══██╗██║██╔════╝    ╚════██╗   ██╔═████╗" -ForegroundColor Cyan
    Write-Host "  ██╔████╔██║███████║██║███████╗     █████╔╝   ██║██╔██║" -ForegroundColor Blue
    Write-Host "  ██║╚██╔╝██║██╔══██║██║╚════██║    ██╔═══╝ ██╗████╔╝██║" -ForegroundColor Blue
    Write-Host "  ██║ ╚═╝ ██║██║  ██║██║███████║    ███████╗╚═╝╚██████╔╝" -ForegroundColor DarkCyan
    Write-Host "  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝    ╚══════╝    ╚═════╝ " -ForegroundColor DarkCyan
    
    Write-Host ""
    Write-Host "  +==============================================================+" -ForegroundColor Magenta
    Write-Host "  |         University Management System v2.0                   |" -ForegroundColor Magenta
    Write-Host "  |         Modern Academic Information System                  |" -ForegroundColor Magenta
    Write-Host "  +==============================================================+" -ForegroundColor Magenta
    Write-Host ""
}

function Write-Header { 
    param($msg) 
    Write-Host ""
    Write-Host "  +------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  | $($msg.PadRight(58)) |" -ForegroundColor Cyan
    Write-Host "  +------------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step { 
    param($msg) 
    Write-Host "  [>] " -ForegroundColor Yellow -NoNewline
    Write-Host "$msg" -ForegroundColor White
}

function Write-Success { 
    param($msg) 
    Write-Host "  [+] " -ForegroundColor Green -NoNewline
    Write-Host "$msg" -ForegroundColor Green
}

function Write-Fail { 
    param($msg) 
    Write-Host "  [X] " -ForegroundColor Red -NoNewline
    Write-Host "$msg" -ForegroundColor Red
}

function Write-Info { 
    param($msg) 
    Write-Host "  [i] " -ForegroundColor Blue -NoNewline
    Write-Host "$msg" -ForegroundColor Gray
}

function Write-Warn {
    param($msg)
    Write-Host "  [!] " -ForegroundColor DarkYellow -NoNewline
    Write-Host "$msg" -ForegroundColor Yellow
}

function Show-ProgressBar {
    param(
        [int]$Current,
        [int]$Total,
        [string]$Label = "",
        [int]$Width = 30
    )
    
    $percent = [Math]::Round(($Current / $Total) * 100)
    $filled = [Math]::Round(($Current / $Total) * $Width)
    $empty = $Width - $filled
    
    # Modern block-style progress bar
    $filledStr = "█" * $filled
    $emptyStr = "░" * $empty
    
    # Spinner animation
    $spinnerFrames = @("⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏")
    $spinner = $spinnerFrames[$Current % $spinnerFrames.Length]
    
    Write-Host "`r  $spinner " -NoNewline -ForegroundColor Cyan
    Write-Host "$filledStr" -NoNewline -ForegroundColor Green
    Write-Host "$emptyStr" -NoNewline -ForegroundColor DarkGray
    Write-Host " $percent%" -NoNewline -ForegroundColor White
    Write-Host " $Label    " -NoNewline -ForegroundColor Gray
}

function Show-Spinner {
    param(
        [int]$Frame,
        [string]$Label = ""
    )
    
    $spinnerFrames = @("⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷")
    $spinner = $spinnerFrames[$Frame % $spinnerFrames.Length]
    
    Write-Host "`r  $spinner $Label" -NoNewline -ForegroundColor Cyan
}

function Show-ServiceStatus {
    param(
        [string]$Service,
        [string]$Status,
        [string]$Url = ""
    )
    
    $statusColor = switch ($Status) {
        "Running" { "Green" }
        "Starting" { "Yellow" }
        "Stopped" { "Red" }
        "Ready" { "Green" }
        default { "Gray" }
    }
    
    $statusIcon = switch ($Status) {
        "Running" { "[OK]" }
        "Starting" { "[..]" }
        "Stopped" { "[--]" }
        "Ready" { "[OK]" }
        default { "[??]" }
    }
    
    Write-Host "      " -NoNewline
    Write-Host $statusIcon -ForegroundColor $statusColor -NoNewline
    Write-Host " $Service" -ForegroundColor White -NoNewline
    if ($Url) {
        Write-Host " -> " -ForegroundColor Gray -NoNewline
        Write-Host $Url -ForegroundColor Cyan
    } else {
        Write-Host ""
    }
}

# ============================================================================
# PREREQUISITES CHECK
# ============================================================================

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    $allGood = $true
    
    # Check Docker
    Write-Step "Checking Docker..."
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker: $dockerVersion"
        } else {
            Write-Fail "Docker not found"
            $allGood = $false
        }
    } catch {
        Write-Fail "Docker not found"
        $allGood = $false
    }
    
    # Check Docker Compose
    Write-Step "Checking Docker Compose..."
    try {
        $composeVersion = docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker Compose: $composeVersion"
        } else {
            Write-Fail "Docker Compose not found"
            $allGood = $false
        }
    } catch {
        Write-Fail "Docker Compose not found"
        $allGood = $false
    }
    
    # Check Node.js (only for frontend modes)
    if ($Mode -in @("full", "frontend", "dev", "build")) {
        Write-Step "Checking Node.js..."
        try {
            $nodeVersion = node --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Node.js: $nodeVersion"
            } else {
                Write-Fail "Node.js not found"
                $allGood = $false
            }
        } catch {
            Write-Fail "Node.js not found"
            $allGood = $false
        }
    }
    
    # Check Docker daemon is running
    Write-Step "Checking Docker daemon..."
    try {
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker daemon is running"
        } else {
            Write-Fail "Docker daemon is not running"
            Write-Info "Please start Docker Desktop and try again"
            $allGood = $false
        }
    } catch {
        Write-Fail "Docker daemon is not running"
        Write-Info "Please start Docker Desktop and try again"
        $allGood = $false
    }
    
    if (-not $allGood) {
        Write-Host ""
        Write-Fail "Missing prerequisites!"
        Write-Host ""
        Write-Info "Installation guides:"
        Write-Info "  Docker Desktop: https://docs.docker.com/desktop/"
        Write-Info "  Node.js: https://nodejs.org/"
        Write-Host ""
        exit 1
    }
    
    Write-Host ""
    Write-Success "All prerequisites satisfied!"
}

# ============================================================================
# DATABASE RESEED
# ============================================================================

# Teacher credentials for auto-authentication
$script:TeacherEmail = "marek.horvath@university.edu"
$script:TeacherPassword = "teacher123"
$script:AuthToken = $null

function Get-AuthToken {
    try {
        Write-Step "Authenticating as teacher..."
        
        $loginBody = @{
            email = $TeacherEmail
            password = $TeacherPassword
        } | ConvertTo-Json
        
        $loginResponse = Invoke-RestMethod -Uri "$ApiUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
        
        $script:AuthToken = $loginResponse.accessToken
        Write-Success "Authenticated successfully!"
        return $true
    } catch {
        Write-Fail "Authentication failed: $_"
        return $false
    }
}

function Invoke-Reseed {
    param([bool]$Silent = $false)
    
    if (-not $Silent) {
        Write-Header "Reseeding Database"
    }
    
    try {
        # Get auth token if not already authenticated
        if (-not $AuthToken) {
            $authResult = Get-AuthToken
            if (-not $authResult) {
                Write-Fail "Cannot reseed without authentication"
                return $false
            }
        }
        
        Write-Step "Sending reseed request to API..."
        
        $headers = @{
            "Authorization" = "Bearer $AuthToken"
        }
        
        $response = Invoke-RestMethod -Uri "$ReseedUrl`?reset=true" -Method Post -Headers $headers -TimeoutSec 60 -ErrorAction Stop
        
        Write-Success "Database reseeded successfully!"
        Write-Host ""
        Write-Info "Database summary:"
        Write-Host ""
        Write-Host "      Core Entities:" -ForegroundColor White
        Write-Host "        - Departments:    $($response.departments)" -ForegroundColor Gray
        Write-Host "        - Programs:       $($response.programs)" -ForegroundColor Gray
        Write-Host "        - Class Groups:   $($response.classGroups)" -ForegroundColor Gray
        Write-Host "        - Faculty:        $($response.faculty)" -ForegroundColor Gray
        Write-Host "        - Students:       $($response.students)" -ForegroundColor Gray
        Write-Host "        - Courses:        $($response.courses)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "      Schedule & Resources:" -ForegroundColor White
        Write-Host "        - Rooms:          $($response.rooms)" -ForegroundColor Gray
        Write-Host "        - Equipment:      $($response.equipment)" -ForegroundColor Gray
        Write-Host "        - Timetable:      $($response.timetable)" -ForegroundColor Gray
        Write-Host "        - Enrollments:    $($response.enrollments)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "      Academic Records:" -ForegroundColor White
        Write-Host "        - Assignments:    $($response.assignments)" -ForegroundColor Gray
        Write-Host "        - Assign. Grades: $($response.assignmentGrades)" -ForegroundColor Gray
        Write-Host "        - Grades:         $($response.grades)" -ForegroundColor Gray
        Write-Host "        - Attendance:     $($response.attendance)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "      Exams & Thesis:" -ForegroundColor White
        Write-Host "        - Exam Terms:     $($response.examTerms)" -ForegroundColor Gray
        Write-Host "        - Registrations:  $($response.examRegistrations)" -ForegroundColor Gray
        Write-Host "        - Thesis Topics:  $($response.thesisTopics)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "      Other:" -ForegroundColor White
        Write-Host "        - Payments:       $($response.payments)" -ForegroundColor Gray
        Write-Host "        - Activities:     $($response.activities)" -ForegroundColor Gray
        Write-Host "        - Surveys:        $($response.surveys)" -ForegroundColor Gray
        Write-Host "        - News:           $($response.news)" -ForegroundColor Gray
        Write-Host "        - Knowledge Base: $($response.knowledgeBase)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "      System:" -ForegroundColor White
        Write-Host "        - Changelog:      $($response.changelog)" -ForegroundColor Gray
        Write-Host "        - Faculty Opts:   $($response.facultyOptions)" -ForegroundColor Gray
        Write-Host ""
        
        return
    } catch {
        Write-Fail "Failed to reseed database: $_"
        return
    }
}

function Prompt-Reseed {
    Write-Host ""
    Write-Host "  +------------------------------------------------------------+" -ForegroundColor DarkYellow
    Write-Host "  | [?] Would you like to reseed the database with fresh data?|" -ForegroundColor DarkYellow
    Write-Host "  |     This will reset all data to initial seed state.       |" -ForegroundColor DarkYellow
    Write-Host "  +------------------------------------------------------------+" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "      [Y] Yes, reseed database" -ForegroundColor Green
    Write-Host "      [N] No, keep existing data (default)" -ForegroundColor Gray
    Write-Host "      [A] Always reseed (tip: use -AutoReseed flag)" -ForegroundColor Cyan
    Write-Host ""
    
    $choice = Read-Host "      Your choice"
    
    switch ($choice.ToUpper()) {
        "Y" { 
            Invoke-Reseed
        }
        "A" {
            Write-Info "Tip: Use './start.ps1 -AutoReseed' to skip this prompt"
            Invoke-Reseed
        }
        default {
            Write-Info "Keeping existing database data"
        }
    }
}

# ============================================================================
# DOCKER OPERATIONS
# ============================================================================

function Start-Backend {
    Write-Header "Starting Backend Services"
    
    Push-Location $ProjectRoot
    try {
        # Check if containers are already running
        $running = docker compose ps -q 2>&1
        if ($running) {
            Write-Info "Containers detected. Restarting..."
            docker compose down 2>&1 | Out-Null
        }
        
        Write-Step "Building and starting containers..."
        Write-Info "This may take a few minutes on first run..."
        Write-Host ""
        
        # Show animated progress - run docker compose
        $buildProcess = Start-Process -FilePath "docker" -ArgumentList "compose up -d --build" -NoNewWindow -PassThru -Wait:$false
        
        $frame = 0
        $messages = @("Building containers", "Pulling images", "Creating network", "Starting services")
        while (-not $buildProcess.HasExited) {
            $msg = $messages[$frame % $messages.Length]
            Show-Spinner -Frame $frame -Label "$msg..."
            $frame++
            Start-Sleep -Milliseconds 120
        }
        Write-Host "`r                                                    " -NoNewline
        
        # Check if containers are actually running instead of relying on exit code
        Start-Sleep -Seconds 2
        $runningContainers = docker compose ps --status running -q 2>&1
        if (-not $runningContainers) {
            Write-Host ""
            Write-Fail "Failed to start containers"
            Write-Info "Run 'docker compose logs' for details"
            exit 1
        }
        
        Write-Host "`r"
        Write-Success "Containers started"
        
        # Wait for API to be healthy with progress bar
        Write-Step "Waiting for API to be ready..."
        $maxAttempts = 60
        $attempt = 0
        $ready = $false
        
        $waitMessages = @(
            "Starting PostgreSQL...",
            "Running migrations...",
            "Loading seed data...",
            "Initializing API...",
            "Almost ready..."
        )
        
        while (-not $ready -and $attempt -lt $maxAttempts) {
            $attempt++
            $msgIndex = [Math]::Min([Math]::Floor($attempt / 12), $waitMessages.Length - 1)
            $currentMsg = $waitMessages[$msgIndex]
            Show-ProgressBar -Current $attempt -Total $maxAttempts -Label $currentMsg
            
            try {
                $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    $ready = $true
                    # Show 100% completion
                    Show-ProgressBar -Current $maxAttempts -Total $maxAttempts -Label "Ready!"
                }
            } catch {
                Start-Sleep -Milliseconds 500
            }
        }
        
        Write-Host ""
        
        if ($ready) {
            Write-Success "API is ready!"
            Write-Host ""
            Show-ServiceStatus -Service "PostgreSQL Database" -Status "Running" -Url "localhost:5432"
            Show-ServiceStatus -Service "ASP.NET Core API" -Status "Running" -Url $ApiUrl
            Show-ServiceStatus -Service "Swagger UI" -Status "Ready" -Url $SwaggerUrl
        } else {
            Write-Fail "API failed to start within timeout"
            Write-Info "Check logs with: docker compose logs api"
            exit 1
        }
        
    } finally {
        Pop-Location
    }
}

function Stop-Backend {
    Write-Header "Stopping Backend Services"
    
    Push-Location $ProjectRoot
    try {
        Write-Step "Stopping containers..."
        docker compose down 2>&1 | Out-Null
        Write-Success "Containers stopped"
    } finally {
        Pop-Location
    }
}

function Show-Logs {
    Write-Header "Backend Logs (Ctrl+C to exit)"
    
    Push-Location $ProjectRoot
    try {
        docker compose logs -f --tail=100
    } finally {
        Pop-Location
    }
}

function Clean-All {
    Write-Header "Cleaning Up Everything"
    
    Push-Location $ProjectRoot
    try {
        Write-Step "Stopping containers..."
        docker compose down -v 2>&1 | Out-Null
        Write-Success "Containers stopped and volumes removed"
        
        Write-Step "Removing build artifacts..."
        if (Test-Path "$FrontendDir/node_modules") {
            Remove-Item -Recurse -Force "$FrontendDir/node_modules" -ErrorAction SilentlyContinue
            Write-Success "Removed node_modules"
        }
        if (Test-Path "$FrontendDir/build") {
            Remove-Item -Recurse -Force "$FrontendDir/build" -ErrorAction SilentlyContinue
            Write-Success "Removed build folder"
        }
        
        Write-Step "Pruning Docker resources..."
        docker system prune -f 2>&1 | Out-Null
        Write-Success "Docker resources pruned"
        
        Write-Host ""
        Write-Success "Cleanup complete!"
    } finally {
        Pop-Location
    }
}

# ============================================================================
# FRONTEND OPERATIONS
# ============================================================================

function Install-FrontendDeps {
    Write-Step "Checking frontend dependencies..."
    
    Push-Location $FrontendDir
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Info "Installing npm packages..."
            
            $npmProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "install" -NoNewWindow -PassThru -Wait:$false -WorkingDirectory $FrontendDir
            
            $dots = 0
            while (-not $npmProcess.HasExited) {
                $dots = ($dots + 1) % 4
                $dotsStr = "." * ($dots + 1)
                Write-Host "`r      Installing packages$($dotsStr.PadRight(4))" -NoNewline -ForegroundColor Gray
                Start-Sleep -Milliseconds 500
            }
            Write-Host "`r                                        "
            
            if ($npmProcess.ExitCode -ne 0) {
                Write-Fail "Failed to install npm packages"
                exit 1
            }
            Write-Success "Dependencies installed"
        } else {
            Write-Success "Dependencies already installed"
        }
    } finally {
        Pop-Location
    }
}

function Start-FrontendDev {
    Write-Header "Starting Frontend Development Server"
    
    Install-FrontendDeps
    
    Push-Location $FrontendDir
    try {
        Write-Step "Starting Vite dev server..."
        Write-Info "Frontend URL: $FrontendUrl"
        Write-Info "Press Ctrl+C to stop"
        Write-Host ""
        
        npm run dev
    } finally {
        Pop-Location
    }
}

function Build-Frontend {
    Write-Header "Building Frontend for Production"
    
    Install-FrontendDeps
    
    Push-Location $FrontendDir
    try {
        Write-Step "Building production bundle..."
        npm run build 2>&1 | ForEach-Object { if ($VerboseOutput) { Write-Host $_ } }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Frontend build failed"
            exit 1
        }
        
        Write-Success "Frontend built successfully!"
        Write-Info "Output: $FrontendDir/build"
    } finally {
        Pop-Location
    }
}

# ============================================================================
# BROWSER
# ============================================================================

function Open-Browser {
    param([string]$Url)
    
    if (-not $NoBrowser) {
        Start-Process $Url
    }
}

function Open-SwaggerBrowser {
    if (-not $NoSwagger) {
        Start-Process $SwaggerUrl
    }
}

# ============================================================================
# SHOW FINAL STATUS
# ============================================================================

function Show-FinalStatus {
    Write-Host ""
    Write-Host "  +============================================================+" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                  " -NoNewline
    Write-Host "MAIS 2.0 IS READY!" -ForegroundColor White -NoNewline
    Write-Host "                      " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  +============================================================+" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                                                            " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   Frontend:  " -ForegroundColor Cyan -NoNewline
    Write-Host "http://localhost:4028                         " -ForegroundColor White -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   API:       " -ForegroundColor Cyan -NoNewline
    Write-Host "http://localhost:5000                         " -ForegroundColor White -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   Swagger:   " -ForegroundColor Cyan -NoNewline
    Write-Host "http://localhost:5000/swagger                 " -ForegroundColor White -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                                                            " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  +------------------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "  TEST ACCOUNTS                                             " -ForegroundColor Yellow -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                                                            " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   Teacher: " -ForegroundColor Gray -NoNewline
    Write-Host "marek.horvath@university.edu" -ForegroundColor Cyan -NoNewline
    Write-Host " / " -ForegroundColor Gray -NoNewline
    Write-Host "teacher123              " -ForegroundColor White -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   Student: " -ForegroundColor Gray -NoNewline
    Write-Host "kyrylo.bulyk@student.university.edu" -ForegroundColor Cyan -NoNewline
    Write-Host " / " -ForegroundColor Gray -NoNewline
    Write-Host "student123     " -ForegroundColor White -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                                                            " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  +------------------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "  COMMANDS                                                  " -ForegroundColor Yellow -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                                                            " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   ./start.ps1 -Mode stop   " -ForegroundColor White -NoNewline
    Write-Host "- Stop all services             " -ForegroundColor DarkGray -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   ./start.ps1 -Mode logs   " -ForegroundColor White -NoNewline
    Write-Host "- View backend logs             " -ForegroundColor DarkGray -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   ./start.ps1 -Mode reseed " -ForegroundColor White -NoNewline
    Write-Host "- Reset database                " -ForegroundColor DarkGray -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "   ./start.ps1 -Mode clean  " -ForegroundColor White -NoNewline
    Write-Host "- Full cleanup                  " -ForegroundColor DarkGray -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  |" -ForegroundColor Green -NoNewline
    Write-Host "                                                            " -NoNewline
    Write-Host "|" -ForegroundColor Green
    Write-Host "  +============================================================+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Press " -ForegroundColor Gray -NoNewline
    Write-Host "Ctrl+C" -ForegroundColor Yellow -NoNewline
    Write-Host " to stop all services" -ForegroundColor Gray
    Write-Host ""
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Show-Banner

switch ($Mode) {
    "full" {
        Test-Prerequisites
        Start-Backend
        
        # Handle reseed
        if ($AutoReseed) {
            Invoke-Reseed
        } else {
            Prompt-Reseed
        }
        
        Write-Header "Starting Frontend"
        Install-FrontendDeps
        
        # Start frontend in background
        Push-Location $FrontendDir
        try {
            Write-Step "Starting Vite dev server in background..."
            $frontendJob = Start-Job -ScriptBlock {
                param($dir)
                Set-Location $dir
                npm run dev 2>&1
            } -ArgumentList $FrontendDir
            
            Start-Sleep -Seconds 3
            Write-Success "Frontend starting..."
        } finally {
            Pop-Location
        }
        
        Show-FinalStatus
        
        # Open browsers
        Open-Browser $FrontendUrl
        Open-SwaggerBrowser
        
        # Keep script running and show frontend output
        try {
            while ($true) {
                if ($frontendJob.State -eq "Failed") {
                    Write-Fail "Frontend crashed!"
                    Receive-Job $frontendJob
                    break
                }
                Receive-Job $frontendJob -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            }
        } finally {
            Write-Host ""
            Write-Warn "Shutting down..."
            Stop-Job $frontendJob -ErrorAction SilentlyContinue
            Remove-Job $frontendJob -ErrorAction SilentlyContinue
            Stop-Backend
            Write-Success "Goodbye!"
        }
    }
    
    "backend" {
        Test-Prerequisites
        Start-Backend
        
        # Handle reseed
        if ($AutoReseed) {
            Invoke-Reseed
        } else {
            Prompt-Reseed
        }
        
        # Open Swagger
        Open-SwaggerBrowser
        
        Write-Host ""
        Write-Header "Backend Running"
        Write-Host ""
        Show-ServiceStatus -Service "API" -Status "Running" -Url $ApiUrl
        Show-ServiceStatus -Service "Swagger" -Status "Ready" -Url $SwaggerUrl
        Write-Host ""
        Write-Info "Press Ctrl+C to stop, or use: ./start.ps1 -Mode stop"
    }
    
    "docker" {
        Test-Prerequisites
        Start-Backend
        
        if ($AutoReseed) {
            Invoke-Reseed
        }
        
        Open-SwaggerBrowser
    }
    
    "frontend" {
        Test-Prerequisites
        Start-FrontendDev
    }
    
    "dev" {
        Test-Prerequisites
        Start-FrontendDev
    }
    
    "build" {
        Test-Prerequisites
        Build-Frontend
        Start-Backend
        Open-SwaggerBrowser
    }
    
    "stop" {
        Stop-Backend
        Write-Host ""
        Write-Success "All services stopped"
    }
    
    "restart" {
        Stop-Backend
        Test-Prerequisites
        Start-Backend
        
        if ($AutoReseed) {
            Invoke-Reseed
        }
    }
    
    "logs" {
        Show-Logs
    }
    
    "clean" {
        Clean-All
    }
    
    "reseed" {
        # Check if API is running
        try {
            $health = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5 -ErrorAction Stop
            Invoke-Reseed
        } catch {
            Write-Fail "API is not running!"
            Write-Info "Start the backend first: ./start.ps1 -Mode backend"
        }
    }
}
