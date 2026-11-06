# MAIS 2.0 — University Management System

> **A modern, full-stack application for managing university operations including schedules, grades, courses, and more.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-9.0-purple)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://docker.com/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Test Accounts](#-test-accounts)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Testing Guide](#-testing-guide)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

MAIS 2.0 is a comprehensive university management system designed to streamline academic operations. It provides separate interfaces for students and teachers, featuring real-time updates via SignalR, responsive design, and a modern user experience.

### Key Capabilities

| Role | Features |
|------|----------|
| **Students** | View schedule, check grades, enroll in courses, submit surveys, track attendance |
| **Teachers** | Manage gradebook, create exams, schedule classes, view analytics, assign thesis topics |
| **Both** | Real-time chat, profile management, news feed, equipment booking |

---

## ✨ Features

### 📅 Schedule Management
- Weekly/daily timetable view with drag-and-drop
- Room and equipment resource panel
- Conflict detection
- Export to CSV/ICS

### 📊 Grade Management
- Full gradebook with assignments
- Grade analytics and charts
- Student performance tracking
- Letter grade conversion (A-F)

### 📝 Course Enrollment
- Browse available courses
- Self-enrollment with capacity limits
- Prerequisite checking
- Class group management

### 💬 Real-Time Features
- SignalR-powered live updates
- Instant messaging system
- Notification center
- Collaborative editing

### 📋 Surveys & Feedback
- Anonymous course evaluations
- Custom question builder
- Response analytics
- Export capabilities

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (required) — [Download](https://docs.docker.com/desktop/install/windows-install/)
- **Node.js 18+** (for frontend development) — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)

### One-Command Start

```powershell
# Clone the repository
git clone https://github.com/VetteIT/mais-management-system.git
cd mais-management-system

# Start everything (backend + frontend)
./start.ps1
```

The script will:
1. ✅ Check all prerequisites
2. ✅ Build and start Docker containers (PostgreSQL + API)
3. ✅ Install frontend dependencies
4. ✅ Start the development server
5. ✅ Open your browser automatically

### Manual Start

If you prefer manual control:

```powershell
# Terminal 1: Start backend
docker compose up -d --build

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev
```

### Available Start Modes

```powershell
./start.ps1                    # Full stack (default)
./start.ps1 -Mode backend      # Backend only (API + DB)
./start.ps1 -Mode frontend     # Frontend dev server only
./start.ps1 -Mode stop         # Stop all services
./start.ps1 -Mode logs         # View backend logs
./start.ps1 -Mode clean        # Remove everything
./start.ps1 -Mode restart      # Restart backend
```

### Access Points

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:4028 |
| **API** | http://localhost:5000 |
| **Swagger UI** | http://localhost:5000/swagger |
| **Health Check** | http://localhost:5000/healthz |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIS 2.0 Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │    │
│  │   (React)    │◀────│  (ASP.NET)   │◀────│   Database   │    │
│  │  Port: 5173  │     │  Port: 5000  │     │  Port: 5432  │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                                   │
│         │              ┌─────┴─────┐                            │
│         │              │  SignalR  │                            │
│         └──────────────│   Hubs    │                            │
│                        └───────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TailwindCSS, Framer Motion, Recharts |
| **Backend** | ASP.NET Core 9, Entity Framework Core, SignalR |
| **Database** | PostgreSQL 16 |
| **Containerization** | Docker, Docker Compose |
| **Authentication** | JWT Bearer Tokens |

---

## 🔑 Test Accounts

The system is pre-seeded with test data:

### Teacher Account
| Field | Value |
|-------|-------|
| **Email** | `marek.horvath@university.edu` |
| **Name** | Ing. Marek Horváth, PhD. |
| **Department** | Katedra počítačov a informatiky (FEI-KPI) |
| **Course** | Forensic Analysis (26001198) |

### Student Account
| Field | Value |
|-------|-------|
| **Email** | `kyrylo.bulyk@student.university.edu` |
| **Name** | Kyrylo Bulyk, Bc. |
| **Program** | Cybersecurity (Master, 4th year) |
| **Class Group** | 01. sk (Cybersecurity) |

### Default Passwords

| Role | Password |
|------|----------|
| Teacher | `teacher123` |
| Student | `student123` |

> **Note:** Passwords can be customized via `.env` file (`SEED_DEFAULT_TEACHER_PASSWORD`, `SEED_DEFAULT_STUDENT_PASSWORD`). If not set, defaults above are used.

### Reseed Database
To reset database with fresh seed data:
```powershell
docker compose down -v
docker compose up -d --build
```

---

## 📖 API Documentation

### Swagger UI

Interactive API documentation: **http://localhost:5000/swagger**

### Authentication

1. Call `POST /api/auth/login` with email + password
2. Copy `accessToken` from response
3. In Swagger: Click "Authorize" → Enter `Bearer <token>`

### Main Endpoints

| Category | Key Endpoints |
|----------|---------------|
| **Auth** | `POST /api/auth/login`, `/refresh`, `/logout`, `/session`, `/forgot-password/*` |
| **Profile** | `GET /api/me`, `/api/studies/me` |
| **Students** | `GET /api/students`, `POST /api/students`, `PUT /api/students/{id}` |
| **Faculty** | `GET /api/faculty`, `POST /api/faculty`, `PUT /api/faculty/{id}` |
| **User** | `POST /api/users/change-password`, `GET /api/users/password-status` |
| **User Preferences** | `GET /api/user-preferences`, `PUT /api/user-preferences` |
| **Courses** | `GET /api/courses`, `POST /api/courses/manage`, `PUT /api/courses/manage/{code}` |
| **Catalog** | `GET /api/catalog/departments`, `/programs`, `/faculty-options` |
| **Schedule** | `GET /api/schedule/events`, `GET /api/teachers/{email}/timetable` |
| **Grades** | `GET /api/teachers/{email}/gradebook`, `/api/students/{id}/gradebook` |
| **Assignments** | `GET /api/teachers/{email}/courses/{code}/assignments` |
| **Attendance** | `GET /api/attendance/course/{code}`, `/student/{id}`, `/stats/*` |
| **Surveys** | `GET /api/surveys`, `POST /api/surveys/{id}/respond` |
| **Chat** | `GET /api/chat/threads`, `POST /api/chat/threads/{id}/messages` |
| **Rooms** | `GET /api/rooms`, `POST /api/rooms`, `DELETE /api/rooms/{id}` |
| **Equipment** | `GET /api/equipment`, `POST /api/equipment` |
| **News** | `GET /api/news`, `POST /api/news`, `POST /api/news/upload` |
| **Exams** | `GET /api/exams/terms/available`, `/my`, `POST /api/exams/terms` |
| **Thesis** | `GET /api/thesis/topics`, `/my`, `/supervisions` |
| **Payments** | `GET /api/payments/student/{id}`, `/summary`, `/finance` |
| **Class Groups** | `GET /api/class-groups`, `POST /api/class-groups` |
| **Enrollments** | `POST /api/enrollments/confirm`, `/create-for-student` |
| **Activities** | `GET /api/activities`, `POST /api/activities`, `/stats`, `/resolve` |
| **Knowledge Base** | `GET /api/knowledge-base/articles`, `/categories`, `/tags` |
| **Teacher Rating** | `GET /api/faculty/{id}/rating`, `POST /api/faculty/{id}/rating` |
| **Documents** | `POST /api/documents/render`, `/assign`, `GET /api/documents/my` |
| **Changelog** | `GET /api/changelog`, `POST /api/changelog` |
| **Student Data** | `GET /api/student-data/ranking`, bank connections, sessions |
| **Programs** | `GET /api/programs`, `GET /api/programs/{name}/usage` |
| **DB Admin** | `POST /api/db/reseed`, `/clear`, `GET /api/db/summary` |

> 📌 **Повний список ендпоінтів:** Див. [Backend README](backend/README.md) та [TESTING.md](docs/TESTING.md)

### Reseed Database

Reset to initial seed data:
```powershell
docker compose down -v
docker compose up -d --build
```
Or via API: `POST /api/db/reseed`

---

## 📁 Project Structure

```
mais-management-system/
├── start.ps1                 # One-click start script
├── docker-compose.yml        # Docker services configuration
├── .env.example              # Environment variables template
├── openapi.yaml              # Complete API specification (200+ endpoints)
│
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── data/             # API adapters
│   │   └── utils/            # Utility functions
│   ├── public/               # Static assets
│   └── build/                # Production build output
│
├── backend/
│   ├── aspnet/
│   │   └── Mais.Web/         # ASP.NET Core API
│   │       ├── Controllers/  # API endpoints
│   │       ├── Entities/     # Database entities
│   │       ├── Services/     # Business logic
│   │       └── Hubs/         # SignalR hubs
│   └── data/
│       └── seed/             # JSON seed data files
│
└── docs/                     # Documentation
    └── TESTING.md            # Testing guide
```

---

## 🧪 Testing Guide

See the comprehensive **[Testing Guide](docs/TESTING.md)** for:

- Complete test scenarios for testers
- Step-by-step workflows
- Expected results
- Bug reporting templates
- API testing with Swagger

---

## 💻 Development

### Frontend Development

```powershell
cd frontend
npm install
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run test     # Run tests
npm run lint     # Lint code
```

### Backend Development

```powershell
cd backend/aspnet/Mais.Web
dotnet restore
dotnet run       # Start API server
dotnet test      # Run tests
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=mais

# JWT Security
JWT_KEY=your-super-secret-key-at-least-32-characters

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Seed Passwords
SEED_DEFAULT_STUDENT_PASSWORD=StudentPass123!
SEED_DEFAULT_TEACHER_PASSWORD=TeacherPass123!
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Docker not starting | Ensure Docker Desktop is running |
| Port already in use | Stop other services on ports 5000, 5173, 5432 |
| Database connection failed | Wait for PostgreSQL healthcheck to pass |
| Login not working | Check seed passwords in `.env` file |
| Frontend not loading | Clear browser cache, check console for errors |

### Useful Commands

```powershell
# View logs
docker compose logs -f api
docker compose logs -f db

# Restart specific service
docker compose restart api

# Reset database
docker compose down -v
docker compose up -d --build

# Check container status
docker compose ps
```

### Getting Help

1. Check the [API documentation](http://localhost:5000/swagger)
2. Review container logs: `./start.ps1 -Mode logs`
3. Open an issue on GitHub

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Technical University of Košice (TUKE)
- Faculty of Electrical Engineering and Informatics (FEI)

---

<div align="center">

**Made with ❤️ for better university management**

[Report Bug](https://github.com/VetteIT/mais-management-system/issues) · [Request Feature](https://github.com/VetteIT/mais-management-system/issues)

</div>
