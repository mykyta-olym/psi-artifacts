# MAIS Backend — ASP.NET Core API

> REST API server for the MAIS University Management System

## Quick Start

```powershell
# From project root
docker compose up -d --build

# API: http://localhost:5000
# Swagger: http://localhost:5000/swagger
```

## Seed Data

Current seed includes:

| Entity | Data |
|--------|------|
| **Teacher** | `marek.horvath@university.edu` (Ing. Marek Horváth, PhD.) |
| **Student** | `kyrylo.bulyk@student.university.edu` (Kyrylo Bulyk, Bc.) |
| **Department** | Katedra počítačov a informatiky (FEI-KPI) |
| **Program** | Cybersecurity (Master, 2 years) |
| **Course** | Forénzna analýza (26001198) - 6 credits |
| **Rooms** | N9-201(ZP1) Lecture Hall, N9-015(ZP4) Office |
| **Schedule** | Mon 09:10-10:50 (P), Wed 13:30-15:10 (CL) |
| **Survey** | Forensic Analysis Feedback (Nov-Dec 2025) |

### Reseed Database

```powershell
docker compose down -v
docker compose up -d --build
```

## API Endpoints

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password, returns JWT |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout and invalidate tokens |
| GET | `/api/auth/session` | Get current session info |
| POST | `/api/auth/forgot-password/request` | Request password reset |
| POST | `/api/auth/forgot-password/resend` | Resend password reset code |
| POST | `/api/auth/forgot-password/verify-token` | Verify reset token |
| POST | `/api/auth/forgot-password/verify-code` | Verify 6-digit reset code |
| POST | `/api/auth/forgot-password/reset` | Reset password with token |

### 👤 Users & Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get current user profile |
| GET | `/api/studies/me` | Get study info for current user |
| POST | `/api/users/change-password` | Change password |
| GET | `/api/users/password-status` | Check if password change required |
| GET | `/api/users/{email}/temporary-password` | Get temporary password (teachers) |
| GET | `/api/students` | List all students |
| GET | `/api/students/{id}` | Get student by ID |
| GET | `/api/students/by-email/{email}` | Get student by email |
| POST | `/api/students` | Create student |
| PUT | `/api/students/{id}` | Update student |
| DELETE | `/api/students/{id}` | Delete student |
| PUT | `/api/students/{id}/profile` | Update student profile |
| PUT | `/api/students/{id}/graduation-status` | Update graduation status |
| PUT | `/api/students/batch` | Batch update students |
| GET | `/api/students/{id}/enrollments` | Get student enrollments |
| GET | `/api/students/{id}/grades` | Get student grades |
| GET | `/api/faculty` | List all faculty |
| GET | `/api/faculty/{id}` | Get faculty by ID |
| GET | `/api/faculty/by-email/{email}` | Get faculty by email |
| POST | `/api/faculty` | Create faculty |
| PUT | `/api/faculty/{id}` | Update faculty |
| DELETE | `/api/faculty/{id}` | Delete faculty |
| PUT | `/api/faculty/{email}/profile` | Update faculty profile |
| POST | `/api/activate-account` | Activate account with token |

### 📚 Courses & Catalog

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | List all courses |
| GET | `/api/courses/{code}` | Get course by code |
| GET | `/api/courses/{code}/enrollment-readiness` | Check enrollment readiness |
| GET | `/api/courses/manage` | List courses with filtering |
| POST | `/api/courses/manage` | Create course |
| PUT | `/api/courses/manage/{code}` | Update course |
| DELETE | `/api/courses/manage/{code}` | Delete course |
| GET | `/api/courses/manage/faculties/distinct` | Get distinct faculties |
| GET | `/api/courses/manage/programs/distinct` | Get distinct programs |
| GET | `/api/catalog/departments` | List departments |
| POST | `/api/catalog/departments` | Create department |
| PUT | `/api/catalog/departments/{id}` | Update department |
| DELETE | `/api/catalog/departments/{id}` | Delete department |
| GET | `/api/catalog/programs` | List programs |
| POST | `/api/catalog/programs` | Create program |
| PUT | `/api/catalog/programs/{id}` | Update program |
| DELETE | `/api/catalog/programs/{id}` | Delete program |
| GET | `/api/catalog/faculty-options` | List faculty options |
| GET | `/api/teachers/{email}/courses` | Get courses taught by teacher |
| GET | `/api/teachers/{email}/courses/{code}/roster` | Get course roster (students) |

### 📅 Schedule (Timetable)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule/events` | Get all schedule events |
| POST | `/api/schedule/events` | Create schedule event |
| PUT | `/api/schedule/events/{id}` | Update schedule event |
| DELETE | `/api/schedule/events/{id}` | Delete schedule event |
| POST | `/api/schedule/events/assign-teacher` | Bulk assign teacher |
| GET | `/api/teachers/{email}/timetable` | Teacher's schedule |

### 📊 Gradebook & Grades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teachers/{email}/gradebook` | Teacher's full gradebook |
| GET | `/api/teachers/{email}/classes` | Teacher's classes |
| GET | `/api/students/{id}/gradebook` | Student's grades |
| PUT | `/api/grades` | Upsert course grade |
| GET | `/api/teachers/{email}/courses/{code}/grades` | Course grades |
| GET | `/api/students/{id}/grades` | All student grades |
| GET | `/api/courses/{code}/grading-scheme` | Get grading scheme |
| PUT | `/api/courses/{code}/grading-scheme` | Set grading scheme |

### 📝 Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teachers/{email}/courses/{code}/assignments` | List assignments |
| PUT | `/api/teachers/{email}/courses/{code}/assignments` | Update assignments |
| DELETE | `/api/teachers/{email}/courses/{code}/assignments/{id}` | Delete assignment |
| PUT | `/api/assignment-grades` | Bulk update assignment grades |

### ✅ Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/course/{code}` | Course attendance records |
| GET | `/api/attendance/student/{id}` | Student attendance |
| POST | `/api/attendance/bulk` | Bulk record attendance |
| GET | `/api/attendance/stats/course/{code}` | Course attendance stats |
| GET | `/api/attendance/stats/student/{id}` | Student attendance stats |

### 📋 Surveys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveys` | List surveys |
| GET | `/api/surveys/students` | Surveys for students |
| GET | `/api/surveys/students/filters` | Student targeting filters |
| GET | `/api/surveys/{id}` | Get survey details |
| POST | `/api/surveys` | Create survey |
| PUT | `/api/surveys/{id}` | Update survey |
| DELETE | `/api/surveys/{id}` | Delete survey |
| POST | `/api/surveys/{id}/respond` | Submit response |
| GET | `/api/surveys/{id}/responses` | Get responses |
| GET | `/api/surveys/{id}/analytics` | Survey analytics |

### 💬 Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/threads` | List chat threads |
| POST | `/api/chat/threads` | Create thread |
| GET | `/api/chat/threads/{id}` | Get thread |
| PATCH | `/api/chat/threads/{id}` | Update thread |
| DELETE | `/api/chat/threads/{id}` | Delete thread |
| GET | `/api/chat/threads/{id}/messages` | Get messages |
| POST | `/api/chat/threads/{id}/messages` | Send message |
| PATCH | `/api/chat/threads/{id}/messages/{msgId}` | Edit message |
| DELETE | `/api/chat/threads/{id}/messages/{msgId}` | Delete message |
| POST | `/api/chat/threads/{id}/messages/{msgId}/reactions` | Add reaction |
| POST | `/api/chat/threads/{id}/reads` | Mark as read |
| POST | `/api/chat/threads/{id}/pin` | Pin message |
| POST | `/api/chat/threads/{id}/clear` | Clear thread history |
| POST | `/api/chat/threads/{id}/attachments` | Upload attachment |
| GET | `/api/chat/threads/{id}/ai/settings` | Get AI settings |
| PUT | `/api/chat/threads/{id}/ai/settings` | Update AI settings |

### 🏢 Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List rooms with filtering/pagination |
| GET | `/api/rooms/{id}` | Get room |
| POST | `/api/rooms` | Create room |
| PUT | `/api/rooms/{id}` | Update room |
| DELETE | `/api/rooms/{id}` | Delete room |
| POST | `/api/rooms/bulk-delete` | Bulk delete rooms |

### 🎒 Equipment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/equipment` | List equipment |
| GET | `/api/equipment/{id}` | Get equipment |
| POST | `/api/equipment` | Create equipment |
| PUT | `/api/equipment/{id}` | Update equipment |
| DELETE | `/api/equipment/{id}` | Delete equipment |
| POST | `/api/equipment/bulk-delete` | Bulk delete |

### 📰 News

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/news` | List news |
| GET | `/api/news/{id}` | Get news item |
| POST | `/api/news` | Create news |
| PUT | `/api/news/{id}` | Update news |
| DELETE | `/api/news/{id}` | Delete news |
| POST | `/api/news/upload` | Upload attachment |
| DELETE | `/api/news/upload` | Delete attachment |

### 🎓 Exams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exams/terms/available` | Available exam terms |
| GET | `/api/exams/terms/my` | My registered exams |
| POST | `/api/exams/terms/{id}/register` | Register for exam |
| POST | `/api/exams/terms/{id}/unregister` | Unregister from exam |
| GET | `/api/exams/terms` | All exam terms (teacher) |
| POST | `/api/exams/terms` | Create exam term |
| PUT | `/api/exams/terms/{id}` | Update exam term |
| DELETE | `/api/exams/terms/{id}` | Delete exam term |
| GET | `/api/exams/terms/{id}/registrations` | Get exam registrations |

### 📄 Thesis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/thesis/topics` | List thesis topics (public) |
| GET | `/api/thesis/topics/my` | My topics (teacher) |
| POST | `/api/thesis/topics` | Create topic |
| PUT | `/api/thesis/topics/{id}` | Update topic |
| DELETE | `/api/thesis/topics/{id}` | Delete topic |
| GET | `/api/thesis/my` | My thesis (student) |
| POST | `/api/thesis/my/submit` | Submit thesis |
| GET | `/api/thesis/requests/my` | My requests (student) |
| POST | `/api/thesis/requests` | Create request |
| PUT | `/api/thesis/requests/{id}` | Update request |
| DELETE | `/api/thesis/requests/{id}` | Delete request |
| POST | `/api/thesis/requests/{id}/cancel` | Cancel request |
| GET | `/api/thesis/requests/incoming` | Incoming requests (teacher) |
| POST | `/api/thesis/requests/{id}/approve` | Approve request |
| POST | `/api/thesis/requests/{id}/return` | Return for revision |
| POST | `/api/thesis/requests/{id}/reject` | Reject request |
| GET | `/api/thesis/supervisions` | My supervisions (teacher) |
| POST | `/api/thesis/supervisions/{id}/status` | Update status |
| POST | `/api/thesis/supervisions/{id}/defense` | Schedule defense |
| POST | `/api/thesis/supervisions/{id}/originality` | Update originality |
| POST | `/api/thesis/supervisions/{id}/grades` | Add grades |

### 📝 Enrollments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/enrollments/confirm` | Confirm enrollment |
| POST | `/api/enrollments/create-for-student` | Create for student (teacher) |
| GET | `/api/students/{id}/enrollments` | Student enrollments |

### 💳 Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/student/{id}` | Student payments |
| GET | `/api/payments/student/{id}/summary` | Payment summary |
| GET | `/api/payments/student/{id}/finance` | Finance info |
| GET | `/api/payments/{id}` | Get payment |
| POST | `/api/payments` | Create payment |
| PUT | `/api/payments/{id}/status` | Update status |
| DELETE | `/api/payments/{id}` | Delete payment |

### 👥 Class Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/class-groups` | List class groups |
| GET | `/api/class-groups/{id}` | Get class group |
| POST | `/api/class-groups` | Create class group |
| PUT | `/api/class-groups/{id}` | Update class group |
| DELETE | `/api/class-groups/{id}` | Delete class group |
| GET | `/api/class-groups/faculties` | Distinct faculties |
| GET | `/api/class-groups/programs` | Distinct programs |

### 📖 Knowledge Base

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge-base/articles` | List articles |
| GET | `/api/knowledge-base/articles/{id}` | Get article |
| POST | `/api/knowledge-base/articles` | Create article |
| PUT | `/api/knowledge-base/articles/{id}` | Update article |
| DELETE | `/api/knowledge-base/articles/{id}` | Delete article |
| POST | `/api/knowledge-base/articles/{id}/feedback` | Submit feedback |
| GET | `/api/knowledge-base/categories` | List categories |
| GET | `/api/knowledge-base/tags` | List tags |
| GET | `/api/knowledge-base/stats` | Statistics |

### ⭐ Teacher Rating

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/faculty/{teacherId}/rating` | Get rating statistics |
| POST | `/api/faculty/{teacherId}/rating` | Submit/update rating |
| GET | `/api/faculty/{teacherId}/rating/student/{studentId}` | Get student's rating |
| GET | `/api/faculty/{teacherId}/ratings` | All ratings (paginated) |
| DELETE | `/api/faculty/{teacherId}/rating/{ratingId}` | Delete rating |

### 📄 Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/render` | Render document |
| POST | `/api/documents/assign` | Assign to students |
| POST | `/api/documents/assign-faculty` | Assign to faculty |
| POST | `/api/documents/teacher/profile` | Generate profile report |
| GET | `/api/documents/my` | My documents |
| GET | `/api/documents/{id}` | Get document |

### 📋 Activities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities` | List activities |
| GET | `/api/activities/{id}` | Get activity |
| GET | `/api/activities/user/{userEmail}` | Get user's activities |
| POST | `/api/activities` | Create activity |
| PUT | `/api/activities/{id}` | Update activity |
| DELETE | `/api/activities/{id}` | Delete activity |
| POST | `/api/activities/resolve` | Resolve activities |
| POST | `/api/activities/mark-needs-action` | Mark as needs action |
| POST | `/api/activities/bulk-delete` | Bulk delete |
| GET | `/api/activities/stats` | Activity statistics |

### 📝 Changelog

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/changelog` | List changelog entries |
| GET | `/api/changelog/{id}` | Get entry |
| POST | `/api/changelog` | Create entry |
| PUT | `/api/changelog/{id}` | Update entry |
| DELETE | `/api/changelog/{id}` | Delete entry |

### 🔧 Database Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/db/summary` | Database summary |
| POST | `/api/db/reseed` | Reseed database |
| POST | `/api/db/clear` | Clear specific tables |
| POST | `/api/db/upgrade/students` | Upgrade students schema |
| POST | `/api/db/sync-courses-faculty-program` | Sync course metadata |
| POST | `/api/db/fix-course-types` | Fix course types |

### ⚙️ User Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-preferences` | Get user preferences |
| PUT | `/api/user-preferences` | Update user preferences |
| DELETE | `/api/user-preferences/{key}` | Delete preference by key |

### 📊 Student Data (Advanced)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student-data/{studentId}/bank-connections` | Get bank connections |
| POST | `/api/student-data/{studentId}/bank-connections` | Add bank connection |
| PUT | `/api/student-data/{studentId}/bank-connections/{id}` | Update bank connection |
| DELETE | `/api/student-data/{studentId}/bank-connections/{id}` | Delete bank connection |
| GET | `/api/student-data/{studentId}/variable-symbols` | Get variable symbols |
| POST | `/api/student-data/{studentId}/variable-symbols` | Add variable symbol |
| PUT | `/api/student-data/{studentId}/variable-symbols/{id}` | Update variable symbol |
| DELETE | `/api/student-data/{studentId}/variable-symbols/{id}` | Delete variable symbol |
| GET | `/api/student-data/sessions/{userId}` | Get user sessions |
| POST | `/api/student-data/sessions` | Create session |
| PUT | `/api/student-data/sessions/{sessionId}/activity` | Update session activity |
| DELETE | `/api/student-data/sessions/{sessionId}` | Delete session |
| GET | `/api/student-data/ranking` | Get student ranking |
| GET | `/api/student-data/{studentId}/ranking` | Get specific student ranking |

### 📱 Programs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/programs` | List all programs |
| GET | `/api/programs/{name}/usage` | Get program usage stats |

## Authentication

```bash
# Login as teacher
POST /api/auth/login
{"email": "marek.horvath@university.edu", "password": "teacher123"}

# Login as student
POST /api/auth/login
{"email": "kyrylo.bulyk@student.university.edu", "password": "student123"}

# Use token
Authorization: Bearer eyJhbG...
```

Default passwords: `teacher123`, `student123` (can be customized via `.env`)

## Project Structure

```
backend/
├── aspnet/Mais.Web/     # ASP.NET Core API
│   ├── Controllers/     # API endpoints
│   ├── Entities/        # EF Core entities
│   ├── Services/        # Business logic
│   └── Hubs/            # SignalR hubs
└── data/seed/           # JSON seed files
```

## SignalR Hubs

Real-time updates via SignalR WebSocket connections:

| Hub | Path | Events |
|-----|------|--------|
| Schedule | `/hubs/schedule` | ClassAdded, ClassRemoved, ScheduleUpdated |
| Gradebook | `/hubs/gradebook` | GradeUpdated, AssignmentUpdated |
| Grades | `/hubs/grades` | GradeUpdated |
| Chat | `/hubs/chat` | MessageReceived, ThreadUpdated, UserTyping |
| Resources | `/hubs/resources` | RoomUpdated, EquipmentUpdated |
| Activities | `/hubs/activities` | ActivityCreated, ActivityUpdated, ActivityResolved, ActivityDeleted |
| Attendance | `/hubs/attendance` | AttendanceMarked, AttendanceUpdated, BulkAttendanceUpdated |
| Enrollment | `/hubs/enrollment` | EnrollmentConfirmed, EnrollmentCreated |
| Exams | `/hubs/exams` | ExamRegistered, ExamUnregistered, ExamTermCreated |
| Faculty | `/hubs/faculty` | FacultyUpdated, FacultyCreated |
| Students | `/hubs/students` | StudentUpdated, StudentCreated |
| Thesis | `/hubs/thesis` | ThesisUpdated, RequestCreated, RequestApproved |
| Surveys | `/hubs/surveys` | SurveyCreated, ResponseSubmitted |
| Data | `/hubs/data` | DataUpdated (general updates) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `Jwt__Key` | JWT secret (32+ chars) |
| `Seed__DefaultStudentPassword` | Student password |
| `Seed__DefaultTeacherPassword` | Teacher password |

## Technology

- .NET 9 / ASP.NET Core
- PostgreSQL 16
- Entity Framework Core
- SignalR
