#!/bin/bash
#
# MAIS Management System - One-Click Start Script (Unix/Linux/Mac)
#
# Usage:
#   ./start.sh              # Full stack (default)
#   ./start.sh backend      # Backend only
#   ./start.sh frontend     # Frontend dev server only
#   ./start.sh stop         # Stop all services
#   ./start.sh logs         # View backend logs
#   ./start.sh clean        # Remove everything
#   ./start.sh restart      # Restart backend
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

API_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:5173"
SWAGGER_URL="$API_URL/swagger"

# Functions
print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=()
    
    # Check Docker
    print_step "Checking Docker..."
    if command -v docker &> /dev/null; then
        print_success "Docker: $(docker --version)"
    else
        missing+=("Docker")
    fi
    
    # Check Docker Compose
    print_step "Checking Docker Compose..."
    if docker compose version &> /dev/null; then
        print_success "Docker Compose: $(docker compose version)"
    else
        missing+=("Docker Compose")
    fi
    
    # Check Node.js (for frontend modes)
    if [[ "$MODE" == "full" || "$MODE" == "frontend" || "$MODE" == "dev" || "$MODE" == "build" ]]; then
        print_step "Checking Node.js..."
        if command -v node &> /dev/null; then
            print_success "Node.js: $(node --version)"
        else
            missing+=("Node.js")
        fi
        
        print_step "Checking npm..."
        if command -v npm &> /dev/null; then
            print_success "npm: $(npm --version)"
        else
            missing+=("npm")
        fi
    fi
    
    # Check Docker daemon
    print_step "Checking Docker daemon..."
    if docker info &> /dev/null; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        print_info "Please start Docker and try again"
        exit 1
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing prerequisites: ${missing[*]}"
        print_info "Please install the missing tools and try again"
        exit 1
    fi
    
    print_success "All prerequisites satisfied!"
}

start_backend() {
    print_header "Starting Backend Services"
    
    cd "$PROJECT_ROOT"
    
    # Check if containers are running
    if docker compose ps --format json 2>/dev/null | grep -q "running"; then
        print_info "Some containers are already running. Restarting..."
        docker compose down &> /dev/null
    fi
    
    print_step "Building and starting containers..."
    print_info "This may take a few minutes on first run..."
    
    docker compose up -d --build
    
    print_success "Containers started"
    
    # Wait for API to be healthy
    print_step "Waiting for API to be ready..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        if curl -s "$API_URL/healthz" &> /dev/null; then
            print_success "API is ready!"
            print_info "API URL: $API_URL"
            print_info "Swagger: $SWAGGER_URL"
            return 0
        fi
        sleep 1
        if [ $((attempt % 10)) -eq 0 ]; then
            echo "  Still waiting... ($attempt/$max_attempts)"
        fi
    done
    
    print_error "API failed to start within timeout"
    print_info "Check logs with: docker compose logs api"
    exit 1
}

stop_backend() {
    print_header "Stopping Backend Services"
    
    cd "$PROJECT_ROOT"
    
    print_step "Stopping containers..."
    docker compose down &> /dev/null
    print_success "Containers stopped"
}

show_logs() {
    print_header "Backend Logs"
    
    cd "$PROJECT_ROOT"
    docker compose logs -f --tail=100
}

clean_all() {
    print_header "Cleaning Up Everything"
    
    cd "$PROJECT_ROOT"
    
    print_step "Stopping containers..."
    docker compose down -v &> /dev/null || true
    
    print_step "Removing build artifacts..."
    rm -rf "$FRONTEND_DIR/node_modules" 2>/dev/null || true
    rm -rf "$FRONTEND_DIR/build" 2>/dev/null || true
    
    print_step "Pruning Docker resources..."
    docker system prune -f &> /dev/null || true
    
    print_success "Cleanup complete!"
}

install_frontend_deps() {
    print_step "Checking frontend dependencies..."
    
    cd "$FRONTEND_DIR"
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing npm packages (this may take a minute)..."
        npm install
        print_success "Dependencies installed"
    else
        print_success "Dependencies already installed"
    fi
}

start_frontend_dev() {
    print_header "Starting Frontend Development Server"
    
    install_frontend_deps
    
    cd "$FRONTEND_DIR"
    
    print_step "Starting Vite dev server..."
    print_info "Frontend URL: $FRONTEND_URL"
    print_info "Press Ctrl+C to stop"
    echo ""
    
    npm run dev
}

build_frontend() {
    print_header "Building Frontend for Production"
    
    install_frontend_deps
    
    cd "$FRONTEND_DIR"
    
    print_step "Building production bundle..."
    npm run build
    
    print_success "Frontend built successfully!"
    print_info "Output: $FRONTEND_DIR/build"
}

open_browser() {
    local url=$1
    
    if [ -z "$NO_BROWSER" ]; then
        print_step "Opening browser..."
        if command -v xdg-open &> /dev/null; then
            xdg-open "$url" &> /dev/null &
        elif command -v open &> /dev/null; then
            open "$url" &> /dev/null &
        fi
    fi
}

# Main
echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║      MAIS Management System - Startup Script                  ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

MODE=${1:-full}
NO_BROWSER=${NO_BROWSER:-}

case "$MODE" in
    full)
        check_prerequisites
        start_backend
        
        print_header "System Ready!"
        echo ""
        echo -e "${GREEN}  ┌─────────────────────────────────────────────────────────┐${NC}"
        echo -e "${GREEN}  │                                                         │${NC}"
        echo -e "${GREEN}  │  Frontend:  $FRONTEND_URL                        │${NC}"
        echo -e "${GREEN}  │  API:       $API_URL                             │${NC}"
        echo -e "${GREEN}  │  Swagger:   $SWAGGER_URL                     │${NC}"
        echo -e "${GREEN}  │                                                         │${NC}"
        echo -e "${GREEN}  │  Test Accounts:                                         │${NC}"
        echo -e "${GREEN}  │    Teacher: marek.horvath@university.edu                       │${NC}"
        echo -e "${GREEN}  │    Student: katarina.balazova@student.university.edu           │${NC}"
        echo -e "${GREEN}  │                                                         │${NC}"
        echo -e "${GREEN}  └─────────────────────────────────────────────────────────┘${NC}"
        echo ""
        
        open_browser "$FRONTEND_URL"
        
        # Start frontend
        start_frontend_dev
        ;;
        
    backend|docker)
        check_prerequisites
        start_backend
        open_browser "$SWAGGER_URL"
        
        print_header "Backend Running"
        print_info "API: $API_URL"
        print_info "Swagger: $SWAGGER_URL"
        print_info ""
        print_info "Press Ctrl+C to exit, or run: ./start.sh stop"
        ;;
        
    frontend|dev)
        check_prerequisites
        start_frontend_dev
        ;;
        
    build)
        check_prerequisites
        build_frontend
        start_backend
        open_browser "$SWAGGER_URL"
        ;;
        
    stop)
        stop_backend
        print_success "All services stopped"
        ;;
        
    restart)
        stop_backend
        check_prerequisites
        start_backend
        ;;
        
    logs)
        show_logs
        ;;
        
    clean)
        clean_all
        ;;
        
    *)
        echo "Usage: $0 {full|backend|frontend|dev|build|stop|restart|logs|clean}"
        echo ""
        echo "Modes:"
        echo "  full      Start both backend and frontend (default)"
        echo "  backend   Start only backend (Docker)"
        echo "  frontend  Start only frontend dev server"
        echo "  dev       Alias for frontend"
        echo "  build     Build production frontend, start backend"
        echo "  stop      Stop all services"
        echo "  restart   Restart backend services"
        echo "  logs      Show backend logs"
        echo "  clean     Remove all containers, volumes, and artifacts"
        exit 1
        ;;
esac
