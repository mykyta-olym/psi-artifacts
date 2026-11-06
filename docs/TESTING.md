# MAIS 2.0 — Testing Guide

> **Comprehensive testing guide for QA testers and reviewers**

This document provides detailed test scenarios, step-by-step instructions, and evaluation criteria for testing the MAIS Management System.

---

## 📋 Table of Contents

1. [Getting Started](#-getting-started)
2. [Test Accounts](#-test-accounts)
3. [Test Scenarios](#-test-scenarios)
   - [Authentication](#1-authentication)
   - [Student Dashboard](#2-student-dashboard)
   - [Teacher Dashboard](#3-teacher-dashboard)
   - [Class Schedule](#4-class-schedule-management)
   - [Grade Management](#5-grade-management)
   - [Course Enrollment](#6-course-enrollment-zapis)
   - [Surveys](#7-surveys-anketa)
   - [Attendance](#8-attendance-tracking)
   - [Chat System](#9-chat-system)
   - [Resource Management](#10-resource-management)
4. [API Testing with Swagger](#-api-testing-with-swagger)
5. [Bug Report Template](#-bug-report-template)
6. [Evaluation Criteria](#-evaluation-criteria)
7. [Feedback Form](#-feedback-form)

---

## 🚀 Getting Started

### Prerequisites

1. **System is running** — Verify at http://localhost:5000/healthz
2. **Frontend is accessible** — Open http://localhost:5173
3. **Swagger is available** — Open http://localhost:5000/swagger

### Quick Health Check

Before testing, verify all services are operational:

| Check | URL | Expected Result |
|-------|-----|-----------------|
| API Health | http://localhost:5000/healthz | `Healthy` response |
| Swagger UI | http://localhost:5000/swagger | Interactive docs load |
| Frontend | http://localhost:5173 | Login page appears |

---

## 🔑 Test Accounts

### Teacher Account
| Field | Value |
|-------|-------|
| **Email** | `marek.horvath@university.edu` |
| **Name** | Ing. Marek Horváth, PhD. |
| **Department** | Katedra počítačov a informatiky (FEI-KPI) |
| **Office** | N9-015(ZP4) |
| **Course** | Forensic Analysis (26001198) |
| **Password** | `teacher123` (default) |

### Student Account
| Field | Value |
|-------|-------|
| **Email** | `kyrylo.bulyk@student.university.edu` |
| **Name** | Kyrylo Bulyk, Bc. |
| **Program** | Cybersecurity (Master, 4th year) |
| **Class Group** | 01. sk (Cybersecurity) |
| **Faculty** | FEI |
| **Password** | `student123` (default) |

---

## 📝 Test Scenarios

### 1. Authentication

#### TC-AUTH-001: Successful Login (Teacher)

**Objective:** Verify teacher can log in successfully

**Steps:**
1. Open http://localhost:5173
2. Enter email: `marek.horvath@university.edu`
3. Enter password: `teacher123`
4. Click "Sign In" button

**Expected Results:**
- ✅ Login successful
- ✅ Redirected to Teacher Dashboard
- ✅ User name displayed in header: "Ing. Marek Horváth, PhD."
- ✅ Teacher-specific menu items visible (Gradebook, Schedule Management, etc.)

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-AUTH-002: Successful Login (Student)

**Objective:** Verify student can log in successfully

**Steps:**
1. Open http://localhost:5173
2. Enter email: `kyrylo.bulyk@student.university.edu`
3. Enter password: `student123`
4. Click "Sign In" button

**Expected Results:**
- ✅ Login successful
- ✅ Redirected to Student Dashboard
- ✅ User name displayed in header: "Kyrylo Bulyk"
- ✅ Student-specific menu items visible (My Grades, My Schedule, etc.)

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-AUTH-003: Invalid Credentials

**Objective:** Verify system rejects invalid credentials

**Steps:**
1. Open http://localhost:5173
2. Enter email: `wrong@email.com`
3. Enter password: `wrongpassword`
4. Click "Sign In" button

**Expected Results:**
- ✅ Error message displayed: "Invalid email or password"
- ✅ User stays on login page
- ✅ No redirect occurs

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-AUTH-004: Logout

**Objective:** Verify user can log out

**Steps:**
1. Log in with any valid account
2. Click user avatar/name in header
3. Select "Logout" or "Sign Out"

**Expected Results:**
- ✅ Redirected to login page
- ✅ Session cleared (cannot access protected pages)
- ✅ Going to protected URL redirects to login

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 2. Student Dashboard

#### TC-DASH-S01: Dashboard Overview

**Objective:** Verify student dashboard displays correct information

**Prerequisites:** Logged in as student

**Steps:**
1. Navigate to Dashboard (click logo or "Dashboard" in menu)
2. Review all dashboard widgets

**Expected Results:**
- ✅ Welcome message with student name
- ✅ Today's classes widget (if any scheduled)
- ✅ Upcoming assignments widget
- ✅ Recent grades widget
- ✅ Quick actions panel

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 3. Teacher Dashboard

#### TC-DASH-T01: Teacher Dashboard Overview

**Objective:** Verify teacher dashboard displays correct information

**Prerequisites:** Logged in as teacher

**Steps:**
1. Navigate to Dashboard
2. Review all dashboard widgets

**Expected Results:**
- ✅ Welcome message with teacher name
- ✅ Today's teaching schedule
- ✅ Pending assignments to grade
- ✅ Student statistics
- ✅ Recent activity feed
- ✅ Quick action buttons

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 4. Class Schedule Management

#### TC-SCHED-001: View Weekly Schedule

**Objective:** Verify schedule displays correctly

**Prerequisites:** Logged in as teacher

**Steps:**
1. Navigate to "Class Schedule" from sidebar
2. Observe the weekly grid view

**Expected Results:**
- ✅ Week view shows Mon-Fri columns
- ✅ Time slots from 07:30 to 19:10
- ✅ Classes displayed as colored blocks
- ✅ Each block shows: Subject, Room, Class Group
- ✅ "P" (Lecture) and "CL" (Lab) types distinguished

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-SCHED-002: View Day Schedule

**Objective:** Verify day view works correctly

**Steps:**
1. Navigate to Class Schedule
2. Click "Day View" toggle
3. Select different days

**Expected Results:**
- ✅ Single day view displays
- ✅ All classes for selected day shown
- ✅ Day selector works properly
- ✅ "Today" button returns to current day

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-SCHED-003: Resource Panel (Rooms)

**Objective:** Verify resource panel shows room information

**Steps:**
1. Navigate to Class Schedule
2. Locate "Resources" panel on the right
3. Click "Rooms" tab

**Expected Results:**
- ✅ List of available rooms displayed
- ✅ Each room shows: Name, Type, Capacity
- ✅ Status badge: "scheduled" or "available"
- ✅ Next booking time shown for scheduled rooms
- ✅ Filter by "Scheduled" / "Free" works

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-SCHED-004: Room Display in Schedule

**Objective:** Verify room names display correctly in schedule

**Steps:**
1. Navigate to Class Schedule
2. Look at any scheduled class

**Expected Results:**
- ✅ Room name shows complete format (e.g., "N9-201(ZP1)")
- ✅ Room name NOT truncated (no missing parentheses)
- ✅ Room clickable to filter schedule by that room

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 5. Grade Management

#### TC-GRADE-001: View Gradebook (Teacher)

**Objective:** Verify teacher can view gradebook

**Prerequisites:** Logged in as teacher

**Steps:**
1. Navigate to "Gradebook" or "Grade Management" from sidebar
2. Select a course (e.g., "Forensic Analysis")
3. Review the grade table

**Expected Results:**
- ✅ Course list/selector visible
- ✅ Student list with enrolled students
- ✅ Assignment columns with grades
- ✅ Percentage and letter grade calculated
- ✅ Statistics panel (average, distribution)

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-GRADE-002: Grade Calculation

**Objective:** Verify grades calculate correctly

**Steps:**
1. Navigate to Gradebook
2. Find a student with grades
3. Verify percentage calculation

**Expected Results:**
- ✅ Percentage = (points earned / total possible) × 100
- ✅ Letter grade matches percentage:
  - A: 90-100%
  - B: 80-89%
  - C: 70-79%
  - D: 60-69%
  - E: 50-59%
  - FX: 0-49%
- ✅ "Needs Attention" section shows only students with avg < 70%

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-GRADE-003: View Grades (Student)

**Objective:** Verify student can view their grades

**Prerequisites:** Logged in as student

**Steps:**
1. Navigate to "My Grades" from sidebar
2. Review grade summary

**Expected Results:**
- ✅ List of enrolled courses displayed
- ✅ Each course shows current grade/percentage
- ✅ Can expand to see individual assignments
- ✅ GPA/average displayed

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 6. Course Enrollment (Zapis)

#### TC-ENROLL-001: View Available Courses

**Objective:** Verify course catalog works

**Prerequisites:** Logged in as student

**Steps:**
1. Navigate to "Course Enrollment" or "Zapis"
2. Browse available courses

**Expected Results:**
- ✅ Course list displays
- ✅ Each course shows: Name, Code, Credits, Type
- ✅ Schedule information visible (day, time, room)
- ✅ Capacity/availability shown
- ✅ Search/filter functionality works

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 7. Surveys (Anketa)

#### TC-SURVEY-001: View Open Surveys (Student)

**Objective:** Verify student can see open surveys

**Prerequisites:** Logged in as student

**Steps:**
1. Navigate to "Surveys" or "Anketa" from sidebar
2. Look for "Forensic Analysis Course Feedback" survey

**Expected Results:**
- ✅ Survey is listed
- ✅ Status shows "Open" (green badge)
- ✅ Date range shows: Nov 1 - Dec 31, 2025
- ✅ "Fill Survey" or similar button available
- ✅ Anonymous indicator visible

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-SURVEY-002: Submit Survey Response

**Objective:** Verify survey submission works

**Steps:**
1. Navigate to Surveys
2. Click on open survey
3. Answer all questions (ratings and text)
4. Submit survey

**Expected Results:**
- ✅ Survey form displays all questions
- ✅ Rating questions show star/scale selector
- ✅ Text questions allow input
- ✅ Submit button enabled when required fields filled
- ✅ Success confirmation after submission
- ✅ Survey shows as "Submitted" after completion

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 8. Attendance Tracking

#### TC-ATTEND-001: View Attendance (Student)

**Objective:** Verify attendance display

**Prerequisites:** Logged in as student

**Steps:**
1. Navigate to "Attendance" from sidebar
2. Review attendance records

**Expected Results:**
- ✅ List of classes with attendance status
- ✅ Present/Absent/Excused indicators
- ✅ Attendance percentage calculated
- ✅ Calendar or list view available

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 9. Chat System

#### TC-CHAT-001: View Chat Threads

**Objective:** Verify chat functionality

**Steps:**
1. Navigate to "Messages" or "Chat" from sidebar
2. Review thread list

**Expected Results:**
- ✅ Thread list displays
- ✅ Each thread shows participants and last message
- ✅ Unread indicator visible
- ✅ Timestamps displayed

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### 10. Resource Management

#### TC-RESOURCE-001: View Rooms

**Objective:** Verify room management

**Prerequisites:** Logged in as teacher

**Steps:**
1. Navigate to "Resource Management" from sidebar
2. Click on "Rooms" section

**Expected Results:**
- ✅ Room list displays
- ✅ Each room shows: Name, Type, Capacity, Building
- ✅ Status indicator (Available/Occupied/Maintenance)
- ✅ Equipment in room shown

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

#### TC-RESOURCE-002: View Equipment

**Objective:** Verify equipment list

**Steps:**
1. Navigate to Resource Management
2. Click on "Equipment" section

**Expected Results:**
- ✅ Equipment list displays
- ✅ Each item shows: Name, Type, Location
- ✅ Status indicator
- ✅ Assignment/reservation info

**Actual Result:** ________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## 🔧 API Testing with Swagger

### Accessing Swagger UI

1. Open http://localhost:5000/swagger
2. You will see the interactive API documentation

---

### Reseed Database (Reset Data)

If you need to reset database to initial state with seed data:

```powershell
# Stop and remove containers with volumes
docker compose down -v

# Rebuild and start (will reseed)
docker compose up -d --build
```

⚠️ **Warning:** This will delete ALL data and recreate from seed files!

---

### Authentication in Swagger

#### Step 1: Get Access Token

1. Find `POST /api/auth/login` in Swagger
2. Click "Try it out"
3. Enter body:
```json
{
  "email": "marek.horvath@university.edu",
  "password": "teacher123"
}
```
4. Click "Execute"
5. Copy `accessToken` from response

#### Step 2: Authorize All Requests

1. Click green "Authorize" button (🔓) at top right
2. Enter: `Bearer YOUR_ACCESS_TOKEN`
   - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...`
3. Click "Authorize" → "Close"

Now all requests will include your token automatically.

---

### Seed Data Reference

Current seed data includes:

| Entity | Data |
|--------|------|
| **Faculty** | 1 teacher: Ing. Marek Horváth, PhD. (`marek.horvath@university.edu`) |
| **Students** | 1 student: Kyrylo Bulyk (`kyrylo.bulyk@student.university.edu`) |
| **Departments** | Katedra počítačov a informatiky (FEI-KPI) |
| **Programs** | Cybersecurity (Master, 2 years) |
| **Courses** | Forénzna analýza (FA) - code: 26001198, 6 credits |
| **Rooms** | N9-201(ZP1) - Lecture Hall (120 seats), N9-015(ZP4) - Office |
| **Equipment** | Projector Epson EB-U50 |
| **Class Groups** | 01. sk (Cybersecurity) |
| **Schedule** | Monday 09:10-10:50 (Lecture), Wednesday 13:30-15:10 (Lab) |
| **Surveys** | Forensic Analysis Course Feedback (open Nov 1 - Dec 31, 2025) |
| **News** | 3 announcements from Dr. Horváth |

---

### All API Endpoints

#### 🔐 Auth (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, get JWT token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Get current session info |
| POST | `/api/auth/forgot-password/request` | Request password reset |
| POST | `/api/auth/forgot-password/resend` | Resend password reset code |
| POST | `/api/auth/forgot-password/verify-token` | Verify reset token |
| POST | `/api/auth/forgot-password/verify-code` | Verify 6-digit reset code |
| POST | `/api/auth/forgot-password/reset` | Reset password |

---

#### 👤 Users & Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me` | Get current user profile |
| GET | `/api/studies/me` | Get my profile (student/teacher) |
| GET | `/api/students` | List all students |
| GET | `/api/students/{id}` | Get student by ID |
| GET | `/api/students/by-email/{email}` | Get student by email |
| POST | `/api/students` | Create student |
| PUT | `/api/students/{id}` | Update student |
| DELETE | `/api/students/{id}` | Delete student |
| PUT | `/api/students/{id}/profile` | Update student profile |
| PUT | `/api/students/batch` | Batch update students |
| GET | `/api/faculty` | List all faculty |
| GET | `/api/faculty/{id}` | Get faculty by ID |
| GET | `/api/faculty/by-email/{email}` | Get faculty by email |
| POST | `/api/faculty` | Create faculty |
| PUT | `/api/faculty/{id}` | Update faculty |
| DELETE | `/api/faculty/{id}` | Delete faculty |
| PUT | `/api/faculty/{email}/profile` | Update faculty profile |
| POST | `/api/users/change-password` | Change password |
| GET | `/api/users/password-status` | Check password status |

---

#### 📚 Courses & Catalog

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
| GET | `/api/teachers/{email}/courses` | Get teacher's courses |
| GET | `/api/teachers/{email}/courses/{code}/roster` | Get course roster |

---

#### 📅 Schedule (Timetable)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule/events` | All timetable entries |
| POST | `/api/schedule/events` | Create schedule event |
| PUT | `/api/schedule/events/{id}` | Update event |
| DELETE | `/api/schedule/events/{id}` | Delete event |
| GET | `/api/teachers/{email}/timetable` | Teacher's timetable |

**Filters:** `?day=Monday`, `?teacherEmail=...`, `?room=...`, `?courseCode=...`

---

#### 📊 Gradebook & Grades

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teachers/{email}/gradebook` | Teacher's full gradebook |
| GET | `/api/students/{id}/gradebook` | Student's grades |
| GET | `/api/teachers/{email}/classes` | Teacher's classes |
| GET | `/api/teachers/{email}/courses/{code}/grades` | Course grades |
| PUT | `/api/grades` | Update grades (bulk) |
| GET | `/api/grades` | Get grades |
| GET | `/api/students/{id}/grades` | Student grades |
| GET | `/api/courses/{code}/grading-scheme` | Grading scheme |
| PUT | `/api/courses/{code}/grading-scheme` | Update grading scheme |

---

#### 📝 Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teachers/{email}/courses/{code}/assignments` | List assignments |
| PUT | `/api/teachers/{email}/courses/{code}/assignments` | Update assignments |
| DELETE | `/api/teachers/{email}/courses/{code}/assignments/{id}` | Delete assignment |
| GET | `/api/teachers/{email}/courses/{code}/assignment-grades` | Get assignment grades |
| PUT | `/api/teachers/{email}/courses/{code}/assignment-grades` | Update assignment grades |

---

#### ✅ Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/course/{courseCode}` | Course attendance |
| GET | `/api/attendance/student/{studentId}` | Student attendance |
| GET | `/api/attendance/stats/course/{courseCode}` | Course stats |
| GET | `/api/attendance/stats/student/{studentId}` | Student stats |
| GET | `/api/attendance/stats/teacher/{email}` | Teacher stats |
| POST | `/api/attendance/bulk` | Bulk record attendance |
| PUT | `/api/attendance/{id}` | Update attendance record |
| DELETE | `/api/attendance/{id}` | Delete attendance record |
| POST | `/api/attendance/sync` | Sync attendance data |

---

#### 📋 Surveys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveys` | List all surveys (teacher) |
| POST | `/api/surveys` | Create survey |
| GET | `/api/surveys/students` | List surveys for students |
| GET | `/api/surveys/{id}` | Get survey details |
| PUT | `/api/surveys/{id}` | Update survey |
| DELETE | `/api/surveys/{id}` | Delete survey |
| POST | `/api/surveys/{id}/respond` | Submit response |
| GET | `/api/surveys/{id}/responses` | Get responses |
| GET | `/api/surveys/{id}/analytics` | Survey analytics |

---

#### 💬 Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/threads` | List chat threads |
| POST | `/api/chat/threads` | Create thread |
| GET | `/api/chat/threads/{id}` | Get thread |
| PATCH | `/api/chat/threads/{id}` | Update thread |
| DELETE | `/api/chat/threads/{id}` | Delete thread |
| POST | `/api/chat/threads/{id}/messages` | Send message |
| PATCH | `/api/chat/threads/{id}/messages/{msgId}` | Edit message |
| DELETE | `/api/chat/threads/{id}/messages/{msgId}` | Delete message |
| POST | `/api/chat/threads/{id}/reads` | Mark as read |
| POST | `/api/chat/threads/{id}/messages/{msgId}/reactions` | Add reaction |
| DELETE | `/api/chat/threads/{id}/messages/{msgId}/reactions` | Remove reaction |
| POST | `/api/chat/threads/{id}/pin` | Pin/unpin thread |
| POST | `/api/chat/threads/{id}/clear` | Clear thread history |
| POST | `/api/chat/threads/{id}/attachments` | Upload attachment |
| GET | `/api/chat/threads/{id}/ai/settings` | Get thread AI settings |
| PUT | `/api/chat/threads/{id}/ai/settings` | Update thread AI settings |

---

#### 🏢 Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List all rooms |
| GET | `/api/rooms/{id}` | Get room |
| POST | `/api/rooms` | Create room |
| PUT | `/api/rooms/{id}` | Update room |
| DELETE | `/api/rooms/{id}` | Delete room |
| POST | `/api/rooms/bulk-delete` | Bulk delete rooms |

---

#### 🎒 Equipment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/equipment` | List all equipment |
| GET | `/api/equipment/{id}` | Get equipment |
| POST | `/api/equipment` | Create equipment |
| PUT | `/api/equipment/{id}` | Update equipment |
| DELETE | `/api/equipment/{id}` | Delete equipment |
| POST | `/api/equipment/bulk-delete` | Bulk delete equipment |

---

#### 📰 News

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/news` | List news |
| GET | `/api/news/{id}` | Get news item |
| POST | `/api/news` | Create news |
| PUT | `/api/news/{id}` | Update news |
| DELETE | `/api/news/{id}` | Delete news |
| POST | `/api/news/upload` | Upload news image |

---

#### 🎓 Exams

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

---

#### 📄 Thesis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/thesis/topics` | List thesis topics |
| GET | `/api/thesis/topics/{id}` | Get thesis topic |
| POST | `/api/thesis/topics` | Create thesis topic |
| PUT | `/api/thesis/topics/{id}` | Update thesis topic |
| DELETE | `/api/thesis/topics/{id}` | Delete thesis topic |
| GET | `/api/thesis/my` | My thesis |
| POST | `/api/thesis/requests` | Request thesis topic |
| GET | `/api/thesis/requests` | List thesis requests |
| PUT | `/api/thesis/requests/{id}` | Update thesis request |
| DELETE | `/api/thesis/requests/{id}` | Delete thesis request |
| GET | `/api/thesis/supervisions` | My supervisions (teacher) |
| PUT | `/api/thesis/supervisions/{id}` | Update supervision |
| POST | `/api/thesis/supervisions/{id}/accept` | Accept supervision |
| POST | `/api/thesis/supervisions/{id}/reject` | Reject supervision |

---

#### 💳 Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/student/{id}` | Student payments |
| POST | `/api/payments/student/{id}` | Create payment |
| PUT | `/api/payments/student/{id}/{paymentId}` | Update payment |
| DELETE | `/api/payments/student/{id}/{paymentId}` | Delete payment |
| GET | `/api/payments/student/{id}/summary` | Payment summary |
| GET | `/api/payments/student/{id}/finance` | Finance info |

---

#### 👥 Class Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/class-groups` | List class groups |
| GET | `/api/class-groups/{id}` | Get class group |
| POST | `/api/class-groups` | Create class group |
| PUT | `/api/class-groups/{id}` | Update class group |
| DELETE | `/api/class-groups/{id}` | Delete class group |
| GET | `/api/class-groups/faculties` | List faculties |
| GET | `/api/class-groups/programs` | List programs |

---

#### 📖 Knowledge Base

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge-base/articles` | List articles |
| GET | `/api/knowledge-base/articles/{id}` | Get article |
| POST | `/api/knowledge-base/articles` | Create article |
| PUT | `/api/knowledge-base/articles/{id}` | Update article |
| DELETE | `/api/knowledge-base/articles/{id}` | Delete article |
| GET | `/api/knowledge-base/categories` | List categories |
| GET | `/api/knowledge-base/tags` | List tags |
| GET | `/api/knowledge-base/stats` | Knowledge base stats |

---

#### ⭐ Teacher Rating

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/faculty/{id}/rating` | Get teacher rating |
| POST | `/api/faculty/{id}/rating` | Submit rating |
| GET | `/api/faculty/{id}/rating/can-rate` | Check if can rate |
| GET | `/api/faculty/{id}/ratings` | Get all ratings |
| DELETE | `/api/faculty/{id}/rating/{ratingId}` | Delete rating |

---

#### 📑 Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/render` | Render document |
| POST | `/api/documents/assign` | Assign student document |
| POST | `/api/documents/assign-faculty` | Assign faculty document |
| GET | `/api/documents/teacher/profile` | Get teacher profile doc |
| GET | `/api/documents/my` | Get my documents |
| GET | `/api/documents/{id}` | Get document by ID |

---

#### 📝 Changelog

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/changelog` | Get changelog entries |
| POST | `/api/changelog` | Create changelog entry |
| PUT | `/api/changelog/{id}` | Update changelog entry |
| DELETE | `/api/changelog/{id}` | Delete changelog entry |

---

#### 📚 Enrollments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/enrollments/confirm` | Confirm enrollment |
| POST | `/api/enrollments/create-for-student` | Create enrollment for student |
| GET | `/api/students/{id}/enrollments` | Get student enrollments |

---

#### 🎯 Activities

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
| POST | `/api/activities/bulk-delete` | Bulk delete activities |
| GET | `/api/activities/stats` | Activity statistics |

---

#### ⚙️ User Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-preferences` | Get user preferences |
| PUT | `/api/user-preferences` | Update user preferences |
| DELETE | `/api/user-preferences/{key}` | Delete preference by key |

---

#### 📊 Student Data (Advanced)

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

---

#### 📱 Programs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/programs` | List all programs |
| GET | `/api/programs/{name}/usage` | Get program usage stats |

---

#### 🔧 Database Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/db/summary` | Database summary |
| POST | `/api/db/reseed` | Reseed database (reset=true clears first) |
| POST | `/api/db/clear` | Clear specific tables |
| POST | `/api/db/upgrade/students` | Upgrade students schema |
| POST | `/api/db/sync-courses-faculty-program` | Sync course metadata |
| POST | `/api/db/fix-course-types` | Fix course types |

---

### Quick Tests

#### 1. Auth Flow
```
POST /api/auth/login → {"email": "marek.horvath@university.edu", "password": "teacher123"}
→ Copy accessToken
→ Authorize with "Bearer {token}"
```

#### 2. Get Student
```
GET /api/students/kb079if-ing
→ Returns Kyrylo Bulyk profile
```

#### 3. Get Teacher's Gradebook
```
GET /api/teachers/marek.horvath@university.edu/gradebook
→ Returns Forensic Analysis gradebook
```

#### 4. Check Schedule
```
GET /api/schedule/events
→ Returns 2 events (Mon lecture, Wed lab)
```

#### 5. Reseed Database
```
POST /api/db/reseed
→ Reseeds all data from JSON files
```

---

## 🐛 Bug Report Template

Use this template when reporting bugs:

```markdown
## Bug Report

### Title
[Brief description of the bug]

### Environment
- Browser: [Chrome/Firefox/Edge/Safari] version [X.X]
- OS: [Windows/Mac/Linux]
- Screen size: [Desktop/Tablet/Mobile]
- Date/Time: [When did it occur]

### Test Account Used
- Email: [which account]
- Role: [Student/Teacher]

### Steps to Reproduce
1. [First step]
2. [Second step]
3. [Third step]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Screenshots
[Attach screenshots if applicable]

### Console Errors
[Open DevTools (F12) > Console, copy any red errors]

### Severity
- [ ] Critical (blocks major functionality)
- [ ] High (significant issue, workaround exists)
- [ ] Medium (inconvenience, doesn't block work)
- [ ] Low (cosmetic/minor issue)

### Additional Notes
[Any other information]
```

---

## 📊 Evaluation Criteria

Rate each area on a scale of 1-5:

| Area | Description | Rating (1-5) | Notes |
|------|-------------|--------------|-------|
| **Usability** | Ease of navigation and use | | |
| **Design** | Visual appeal, consistency | | |
| **Functionality** | Features work as expected | | |
| **Performance** | Loading times, responsiveness | | |
| **Reliability** | Stability, no crashes | | |
| **Error Handling** | Clear error messages | | |
| **Mobile Support** | Works on smaller screens | | |
| **Documentation** | Help text, tooltips | | |

### Rating Scale
- 5 = Excellent
- 4 = Good
- 3 = Acceptable
- 2 = Needs Improvement
- 1 = Poor

---

## 📝 Feedback Form

Please complete this feedback form after testing:

### General Information
- Tester Name: _______________________
- Testing Date: _______________________
- Time Spent: ____________ hours
- Test Accounts Used: ⬜ Teacher ⬜ Student ⬜ Both

### Overall Experience

**How would you rate your overall experience?**
⬜ 1 ⬜ 2 ⬜ 3 ⬜ 4 ⬜ 5

**Was the application easy to understand and navigate?**
⬜ Very Easy ⬜ Easy ⬜ Neutral ⬜ Difficult ⬜ Very Difficult

### Feature Testing

| Feature | Tested | Working | Issues Found |
|---------|--------|---------|--------------|
| Login/Logout | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |
| Dashboard | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |
| Schedule | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |
| Gradebook | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |
| Surveys | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |
| Chat | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |
| Resources | ⬜ Yes ⬜ No | ⬜ Yes ⬜ Partial ⬜ No | |

### What did you like most about the application?
```
[Your answer here]
```

### What needs the most improvement?
```
[Your answer here]
```

### Did you encounter any bugs? (List them)
```
[Your answer here]
```

### Feature Suggestions
```
[Your answer here]
```

### Would you recommend this system for university use?
⬜ Definitely Yes ⬜ Probably Yes ⬜ Not Sure ⬜ Probably No ⬜ Definitely No

### Additional Comments
```
[Your answer here]
```

---

## ✅ Testing Checklist

Before submitting your evaluation, ensure you have:

- [ ] Logged in with both Teacher and Student accounts
- [ ] Tested at least 5 different features
- [ ] Tried Swagger API documentation
- [ ] Reported any bugs found
- [ ] Completed the feedback form
- [ ] Rated all evaluation criteria

---

## 📞 Support

If you encounter issues during testing:

1. **Check the console** (F12 > Console) for error messages
2. **Review the logs**: `./start.ps1 -Mode logs`
3. **Restart the system**: `./start.ps1 -Mode restart`
4. **Contact the development team** with bug report

---

<div align="center">

**Thank you for testing MAIS 2.0!**

Your feedback is invaluable for improving the system.

</div>
