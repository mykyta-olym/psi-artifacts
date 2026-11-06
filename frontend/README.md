# MAIS Frontend — React Application

> React frontend for MAIS University Management System

## Quick Start

```powershell
npm install
npm run dev
# http://localhost:4028
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Teacher | `marek.horvath@university.edu` | `teacher123` |
| Student | `kyrylo.bulyk@student.university.edu` | `student123` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run lint` | Lint code |

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
│   ├── student-dashboard/
│   ├── teacher-dashboard/
│   ├── class-schedule-management/
│   ├── grade-management/
│   ├── anketa/      # Surveys
│   └── zapis/       # Enrollment
├── contexts/        # React contexts
├── hooks/           # Custom hooks
├── data/            # API adapters
└── utils/           # Utilities
```

## Pages

| Route | Role | Description |
|-------|------|-------------|
| `/` | All | Welcome page |
| `/login` | All | Authentication |
| `/forgot-password` | All | Password recovery |
| `/activate` | All | Account activation |
| `/student-dashboard` | Student | Student Dashboard |
| `/teacher-dashboard` | Teacher | Teacher Dashboard |
| `/class-schedule-management` | Both | Timetable management |
| `/grade-management` | Teacher | Gradebook & grade management |
| `/anketa` | Both | Surveys & questionnaires |
| `/zapis` | Student | Course enrollment |
| `/chat` | Both | Real-time messaging |
| `/profile` | Both | User profile settings |
| `/resource-management` | Teacher | Room & equipment management |
| `/attendance-tracking` | Teacher | Attendance tracking |
| `/terminy` | Student | Exam registration (student) |
| `/terminy/teacher` | Teacher | Exam terms management |
| `/final-thesis` | Student | Thesis topics (student) |
| `/final-thesis/teacher` | Teacher | Thesis supervision |
| `/activities` | Both | Activity log |
| `/student-management` | Both | Student management |
| `/faculty-management` | Both | Faculty management |
| `/student-studies` | Student | Study overview |
| `/print-reports` | Both | Print reports & documents |
| `/help` | All | Knowledge base & help |
| `/study-select` | Student | Study program selection |

## Technology

- React 18 + Vite
- TailwindCSS
- Framer Motion
- SignalR
- Recharts
