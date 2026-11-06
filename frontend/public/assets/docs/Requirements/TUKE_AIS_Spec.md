# TUKE AIS — Kompletná špecifikácia (MVP → Scale)
*Full-stack requirements & tech spec. Obsahuje presné názvoslovie, URL konvencie, CSV formáty, dátové modely (SQL aj Mongo), API kontrakty, scenáre, edge-cases, test‑plán, bezpečnosť a roadmapu.*

> Terminológia a identifikátory sú zosúladené s frontendom: `termKey`, `sectionKey (01–08-sk)`, `classId`, `courseCode`, lokálne úložisko `mais.attendance.v1`, „Activities feed“, atď.

---

## 0) Obsah
1. [Kontext a ciele](#1-kontekst-a-ciele)
2. [Stakeholderi a persony](#2-stakeholderi-a-persony)
3. [Moduly a prepojenia (mapa featur)](#3-moduly-a-prepojenia-mapa-featur)
4. [Funkčné špecifikácie podľa modulov](#4-funkčné-špecifikácie-podľa-modulov)
5. [Dáta a modely](#5-dáta-a-modely)
6. [API kontrakty (REST)](#6-api-kontrakty-rest)
7. [Front-end špecifiká a správanie UI](#7-front-end-špecifiká-a-správanie-ui)
8. [Ne‑funkčné požiadavky](#8-ne-funkčné-požiadavky)
9. [Bezpečnosť, audit, GDPR](#9-bezpečnosť-audit-gdpr)
10. [Výkon, škálovanie, observability](#10-výkon-škálovanie-observability)
11. [Test‑stratégia a QA checklisty](#11-test-stratégia-a-qa-checklisty)
12. [Roadmapa, tím, odhady, riziká](#12-roadmapa-tím-odhady-riziká)
13. [Prílohy (CSV, URL, LS, algoritmy)](#13-prílohy-csv-url-ls-algoritmy)

---

## 1) Kontext a ciele
- **TUKE Akademický informačný systém (AIS)** s webovým UI. MVP beží izolovane s vlastnou DB, integrácie s AIS/LDAP prídu neskôr.
- **MVP zameranie:** Login & roly, Student Management, Gradebook (základ), Attendance Tracking (plne funkčný), Schedule (read), základ Messaging/Contact.
- **Zdroj:** detailný FE modul „Attendance Tracking“ + podsystém „Activities“ (notifikácie/aktivity). Dokument reflektuje existujúcu implementáciu a definuje, čo musí backend poskytnúť.

**Cieľ:** Produkčný‑ready špecifikácia pre tím FE/BE/QA/DevOps s dôrazom na dochádzku, filtráciu, exporty a feed udalostí.

---

## 2) Stakeholderi a persony
- **Učiteľ** – primárny používateľ Attendance; značí prítomnosť, používa bulk, export, prehľady.
- **Študent** – číta rozvrh, dochádzku, známky; v ďalšej fáze prijíma oznámenia.
- **Rodič/Guardian** – read‑only pre výsledky a dochádzku + komunikácia.
- **Študijné oddelenie** – katalóg a oprávnenia, audit (spravované učiteľmi).
- **Plánovač rozvrhov** – udržuje rozvrhy, miestnosti, kapacity.
- **Prevádzka (IT)** – dostupnosť, monitorovanie, zálohy, bezpečnosť.

---

## 3) Moduly a prepojenia (mapa featur)
| Modul | Hlavné komponenty (FE) | Kľúčové entity | Poznámky |
|---|---|---|---|
| **Attendance Tracking** | `AttendanceTracking`, `AttendanceHeader`, `AttendanceStats`, `AttendanceChart`, `AttendanceFilters`, `StudentAttendanceCard`, `BulkActionsModal`, `SessionPicker` | AttendanceRecord, Class, User(Student), ScheduleEvent | Export CSV, bulk akcie, trendové grafy, LS per courseCode/date |
| **Activities (feed)** | `Activities*` (toolbar, filters, table, timeline) | Activity, Notification, Message | Pinning (`mais.activities.pins`), CSV export feedu |
| **Grade Management** | Gradebook, Assignments | Assignment, Grade, Class | Analytika, škály |
| **Student Management** | List + modal tabs | Student, Guardian, EmergencyContact | Profile/Family/Health editable; Academic/Activity read‑only v MVP |
| **Schedule** | Weekly/Daily | Class, ScheduleEvent, Room | Validácie kolízií (M3) |
| **Messaging/Contact** | Threads & Messages | Conversation/Thread, Message, User | Deep‑linky z Activities/Student Mgmt |

**Prepojenia:** Attendance ↔ Activities (zmena statusu → activity/notification); Schedule ↔ Attendance (sessions pre deň a kurz).

---

## 4) Funkčné špecifikácie podľa modulov

### 4.1 Attendance Tracking
**User flow:**
1. Učiteľ otvorí „Attendance Tracking“.
2. Vyberie **dátum**, **triedu/kurz** (`classId`/`courseCode`), **session** (podľa rozvrhu a skupín).
3. Značí status študentov: `present | absent | late | excused`.
4. Voliteľne použije **Bulk Actions**: Mark All Present, Copy Previous Day, alebo vyberie subset študentov.
5. Sleduje **štatistiky** (present/absent/late/excused/chronic) a **trendové grafy** (posledných 7 dní).
6. **Export CSV** (per deň + vyfiltrovaný set).

**Filtre a parametre:**
- `search` (meno/email/ID), `status`, `grade` (`KEY_ZS/KEY_LS`), `class` (sectionKey), `rate` (`excellent/good/fair/poor`).
- URL synchronizácia parametrov + paging (`page`, `perPage`=10 FE).

**Sessions (podľa rozvrhu):**
- Výber session podľa `dayOfWeek`, `slot (start–end)`, `classGroupKeys`, `room`, `capacity`.
- Odznaky: `Now | Next | Finished | Past | Upcoming | Today | Other day`.
- **Happening now** pás so skratkami pre skok na aktuálne hodiny (kurz+čas+miestnosť).

**Persistencia na FE (MVP offline):**
- `LS_ATT_KEY='mais.attendance.v1'` → `store[courseCode][date] = { studentId: status }`.
- Import z predgenerovaných `recentAttendance` (seed) + merge s LS.

**Notifikácie & Aktivity:**
- Po každej zmene statusu sa generuje **notification** a **activity** s `requiresAction` pre absencie (priority high).

**Export CSV:**
- Stĺpce: `Date,Student ID,Name,Term,Class,Status,Attendance Rate`.

**Edge cases:**
- **Weekend** → žiadne sessions (infobox).  
- **Capacity** → zoznam študentov pre session sa orezáva na `capacity`.  
- **Read‑only pre minulé dni** (UI messaging existuje v `BulkActionsModal`; pravidlo nastaví BE/konfigurácia).

---

### 4.2 Activities (feed)
- Typy: `submissions | communications | attendance | grades | announcements | schedule`.
- Pinovanie (`mais.activities.pins`), zoskupovanie podľa dátumu (`Today/Yesterday/localeDate`).
- Hromadné akcie (export CSV, mark resolved, set priority).

**Activities CSV stĺpce:**
```
id,type,title,description,student,subject,classId,priority,requiresAction,teacher,room,timestamp
```

---

### 4.3 Grade Management
- Kniha známok, CRUD zadaní, výpočet percent/letter grade, analytika.

### 4.4 Student Management
- Vyhľadávanie, filtre, **Profile/Family/Health** editable, **Academic/Activity** read‑only.
- Akcia **Contact Student** → deeplink do chat/zoznam s vyplneným `q` a `intent=contact`.

### 4.5 Schedule
- Weekly/Daily prehľad, miestnosti, kapacity.  
- M3: validácie kolízií (učiteľ, miestnosť, čas).

### 4.6 Messaging/Contact
- Vlákna, správy, oznámenia; deep‑linky z iných modulov.

---

## 5) Dáta a modely

### 5.1 Relačný model (SQL)
**Tabuľky (výber):**
- `users(id, email, password_hash, display_name, role_id, teacher_id?, student_id?)`
- `roles(id, code, permissions_json)`
- `students(id, student_code, name, email, phone, dob, gender, address, status, grade_level, section, enrollment_date, gpa, attendance_rate, class_rank, blood_type, allergies, medications)`
- `guardians(id, student_id*, name, phone, email, relation, occupation, address)`
- `emergency_contacts(id, student_id*, name, phone, email, relation)`
- `courses(code PK, name_sk, name_en, period_sk)`
- `classes(id, course_code*, name, grade_label, section, owner_teacher_id*, room, capacity)`
- `schedule_events(id, class_id*, teacher_id*, room, day_of_week, start_time, end_time, has_conflict, notes)`
- `assignments(id, class_id*, name, category, total_points, due_date, description)`
- `grades(id, student_id*, assignment_id*, points, percentage, letter, updated_at)`
- `attendance_records(id, student_id*, class_id*, date, status, note)`
- `conversations(id, type, created_at)`
- `messages(id, conversation_id*, sender_user_id*, text, attachments, created_at, is_announcement)`

**Indexy:**
- `students(student_code)`, `students(name)`  
- `assignments(class_id)`  
- `grades(student_id, assignment_id)`  
- `attendance_records(student_id, date)`  
- `schedule_events(day_of_week, room, start_time)`  
- `messages(conversation_id, created_at)`

### 5.2 Dokumentový model (Mongo/Mongoose)
- Kolekcie: `users, courses, classes, enrollments, assignments, grades, attendance, activities, threads, threadMembers, messages, notifications`.
- Schémy a indexy viď [Prílohy/Schémy (Mongoose)](#mongoose-schémy).

---

## 6) API kontrakty (REST)

### 6.1 Attendance
**GET** `/attendance/by-date`  
Parametre: `classId` (alebo `courseCode`), `date=YYYY-MM-DD`, `sectionKey?`  
Odpoveď:
```json
{
  "classId": "class_26001312",
  "courseCode": "26001312",
  "date": "2025-10-13",
  "students": [
    {
      "id": "stu_123",
      "studentId": "s25-...",
      "name": "John Doe",
      "email": "john@...",
      "gradeKey": "1-rok-2025-2026-zs",
      "gradeText": "1. rok 2025/2026 ZS",
      "sectionKey": "01-sk",
      "attendanceRate": 92,
      "status": "present"
    }
  ]
}
```

**POST** `/attendance/mark`  
Body:
```json
{
  "classId": "class_26001312",
  "date": "2025-10-13",
  "updates": [
    { "studentId": "stu_123", "status": "absent" },
    { "studentId": "stu_456", "status": "present" }
  ]
}
```
Odpoveď: `200 OK { "updated": 2 }` + emit event (WS/SSE) + Activity.

**POST** `/attendance/copy-prev-day`  
Body:
```json
{ "classId": "class_26001312", "date": "2025-10-13", "sectionKey": "01-sk" }
```
Odpoveď: `{ "copied": 24 }`

**GET** `/attendance/trend?classId=...&days=7`  
Odpoveď:
```json
[ { "date": "2025-10-07", "attendanceRate": 91 }]
```

**Pravidlá:**  
- `status` ∈ `present|absent|late|excused`.  
- Pre minulé dátumy môže BE vrátiť `editable=false` pre UI (read‑only).

### 6.2 Schedule/Sessions
**GET** `/schedule/sessions?courseCode=26001312&date=2025-10-13`  
Odpoveď:
```json
[
  {
    "key": "Monday|08:00-09:30|0",
    "day": "Monday",
    "start": "08:00",
    "end": "09:30",
    "classGroupKeys": ["01-sk","02-sk"],
    "room": "PK5",
    "capacity": 40
  }
]
```

### 6.3 Roster
**GET** `/classes/:courseCode/roster?termKey=1-rok-2025-2026-zs`  
Odpoveď:
```json
[
  {
    "id": "stu_1",
    "fullName": "Jane Doe",
    "email": "jane@...",
    "photo": null,
    "sectionKey": "01-sk",
    "attendanceRate": 88,
    "recentAttendance": [
      { "date": "2025-10-07", "status": "present" }
    ]
  }
]
```

### 6.4 Activities/Notifications
**POST** `/activities` (po mark/copy bulk)  
Body:
```json
{
  "type": "attendance",
  "title": "Attendance absent: Jane Doe",
  "description": "2025-10-13 • 01-sk • Advanced Software Engineering (PSI)",
  "requiresAction": true,
  "priority": "high",
  "meta": {
    "corrId": "att_2025-10-13_stu_1",
    "studentId": "s25-...",
    "courseCode": "26001312",
    "date": "2025-10-13",
    "status": "absent"
  }
}
```

**GET** `/activities?q=&type=&from=&to=&page=&per=` – triedenie podľa `timestamp desc`.

---

## 7) Front‑end špecifiká a správanie UI

### 7.1 Komponenty a props
- **AttendanceHeader**: dátum (+ step), výber triedy, export, bulk.  
  - Fix: `w/full` → `w-full` (typo).  
- **AttendanceFilters**: `searchTerm, statusFilter, termFilter, classGroupFilter, attendanceRateFilter`; **URL sync**.  
  - Pozn.: odovzdáva sa `userRole`, ale komponent ho nepoužíva → odstrániť alebo doplniť prop.  
- **AttendanceStats**: karty (present/absent/late/excused/[chronic len pre učiteľov]).  
  - Fix: záverečná stopa `...Stats;/` odstrániť `/`.  
- **AttendanceChart**: `chartType=line|bar|radial`, `VALUE_KEY='attendanceRate'`, štatistiky (avg,max,min,latest).  
- **StudentAttendanceCard**: tlačidlá statusov (alebo read‑only badge), progress bar `%`, voliteľná história 7 dní.  
- **BulkActionsModal**: výber študentov, `Mark All Present`, `Copy Previous Day`, `Select All`, hist označenia triedy, informácia o read‑only pre učiteľov v minulosti.  
- **SessionPicker**: horizontálny scroll, odznaky `Now/Next/...`, happening now pás.

### 7.2 Dátové zdroje a výpočty
- **Hash**: `hashStr(djb2-xor)` na deterministické priradenie skupiny.  
- **normalizeGroupKey**: akceptuje `01-sk | sk-01 | 1 | 1-sk` → výstup `NN-sk`.  
- **seedRecent**: vygeneruje 7 dní histórie a 80–100 % attendanceRate.  
- **attendanceTrendData**: posledných 7 dní podľa spojenia LS+seed.  
- **Persist**: `persistDay(courseCode, date, dayMap)` → merge do LS.

### 7.3 Pagination
- FE stránkovanie po 10, pager indices max 7 tlačidiel.  
- Zobrazenie „Showing X to Y of Z students“.  

### 7.4 A11y & i18n
- `aria-label`/`title` pre ikon‑tlačidlá.  
- Farby vychádzajú z tokenov (`--color-primary`...), kontrast pre warning/error karty.  
- Jazyk: SK/EN (UA voliteľne), názvy predmetov `nameSk`/`nameEn`.

---

## 8) Ne‑funkčné požiadavky
- **Výkon:** zoznamy ~200 študentov; odpovede list API < 300 ms na staging dátach.  
- **Dostupnosť:** 99.5 % (MVP, jedno prostredie), denné zálohy.  
- **Logovanie:** aplikačné logy + request ID + audit udalostí menenia dochádzky.  
- **A11y:** WCAG 2.1 AA.  
- **I18n:** SK/EN, v dátach udržiavať `nameSk`/`nameEn`.

---

## 9) Bezpečnosť, audit, GDPR
- **Auth:** JWT (access+refresh), heslá Argon2/bcrypt.  
- **RBAC:** `teacher | student | parent | scheduler`.  
- **Práva:** učiteľ môže značkovať len svoje triedy; minulosť môže byť read‑only podľa politiky.  
- **Audit trail:** kto/kedy zmenil status; pri bulk zaznamenať per‑student diffs.  
- **GDPR:** minimalizácia dát v notifikáciách; časť údajov (zdravotné) len pre autorizovaných.  
- **Rate‑limit:** pre mark/copy bulk; ochrana pred náhodným floodom.  
- **Input sanitácia:** pri vyhľadávaniach a URL parametroch.

---

## 10) Výkon, škálovanie, observability
- **Indexy** (viď modely).  
- **Caching**: timetable a roster (ETag/If-None-Match alebo Redis).  
- **SSE/WS**: push udalostí attendance → Activities/Notifications.  
- **Monitoring**: health `/health`, readiness `/ready`, metriky `/metrics` (Prometheus), tracing (OTel).

---

## 11) Test‑stratégia a QA checklisty

### 11.1 Jednotkové
- `normalizeGroupKey()` – vstupy `01-sk|sk-1|1` → `01-sk`.  
- `hashStr()` – stabilita a rozsah.  
- `seedRecent()` – 7 záznamov, % v 80..100.  
- `attendanceTrendData()` – správny výpočet rate.  
- `statusMeta()` – mapovanie `absent→{type:error,requiresAction:true,priority:high}`.

### 11.2 Komponentové (RTL)
- `StudentAttendanceCard` – klik status -> callback s id/status.  
- `AttendanceFilters` – zmena filtra sync do URL.  
- `BulkActionsModal` – Select All, Mark All Present, Copy Prev Day.  
- `AttendanceChart` – správny `avg/max/min/latest` a tooltippy.

### 11.3 Integračné (API + UI)
- Načítanie sessions pre dátum/kurz, výber session, načítanie rosteru, mark → BE uloží → feed.  
- Bulk mark/copy → BE diffs + Activity notifikácia.  
- Export CSV → obsahuje iba filtrovaný set.

### 11.4 E2E (Playwright/Cypress)
- „Take attendance today“: vyhľadanie študenta, zmena na `late`, kontrola Activity feedu.  
- „Copy previous day“: najprv vyplniť D-1, potom skopírovať na D.  
- Pagination a URL parametre pre filtre.  
- `Happening now` skok na aktuálnu session.

### 11.5 QA checklist
- [ ] URL sync funguje pri všetkých filtroch.  
- [ ] CSV stĺpce a poradie sedí.  
- [ ] LS sa nepreplňuje; clear storage nepadá.  
- [ ] Read‑only politika pre minulosť (ak zapnutá).  
- [ ] A11y: klávesová navigácia modalov, aria labely.

---

## 12) Roadmapa, tím, odhady, riziká

### Milníky
- **M1 (8–10 týždňov)**: Login/RBAC, Student Mgmt (edit+read-only časti), Gradebook základ, Attendance základ, Schedule read.  
- **M2 (3–4 týždne)**: Messaging + exporty + deeplinky.  
- **M3 (4–6 týždňov)**: Rozvrh s kolíziami, audit, monitoring.  
- **M4 (6–8 týždňov)**: Portály študent/rodič, notifikácie.

### Tím (min.)
- PO/Analytik 0.5–1 FTE, Tech Lead 1, FE React ×2, BE 1, QA 0.5–1, UX 0.5, DevOps 0.2–0.5.

### ROM náklady
- **MVP (F0+F1):** €70k – €120k; **F2–F4:** + €60k – €140k; spolu **€130k – €260k**.

### Riziká
- Externé dáta TUKE neskoro; rôzne hodnotiace škály; kapacity miestností limitujú reálne osadenie session.

---

## 13) Prílohy (CSV, URL, LS, algoritmy)

### CSV špecifikácie
**Attendance (per deň):**
```
Date,Student ID,Name,Term,Class,Status,Attendance Rate
```
**Activities feed:**
```
id,type,title,description,student,subject,classId,priority,requiresAction,teacher,room,timestamp
```

### URL parametre
- **Attendance page:** `?classId=&course=&action=take`  
- **Filtre:** `?search=&status=&grade=&class=&rate=`  
- **Activities:** `?q=&type=&from=&to=&action=1&sort=&dir=&page=&per=&mode=`  
- **Contact deeplink:** `/student-management?student=ID&q=NAME&intent=contact&focus=search`

### LocalStorage kľúče
- `mais.attendance.v1` – per `courseCode`+`date` map študent→status.  
- `mais.activities.pins` – ID aktivít.  
- (voliteľne) `activities.view.state` – kombinácia filtrov/pagingu/mode.

### Algoritmy (pseudokód)
**normalizeGroupKey(raw):**
```
if not raw -> null
s = lower(raw).removeSpaces().replace('_','')
if matches '^\d{1,2}-?sk$' or '^sk-?\d{1,2}$' or '^\d{1,2}$':
  n = captureNumber(s)
  return pad2(n) + '-sk'
return null
```

**assignToGroup(student, allowed, courseCode):**
```
arr = allowed if non-empty else DEFAULT_GROUPS[01..08-sk]
seed = student.email || student.fullName || student.id
idx  = hash(seed + '|' + courseCode + '|grp') % arr.length
return arr[idx]
```

**attendanceTrendData (7 dní):**
```
last7 = union(allDatesFromStore).sort().takeLast(7)
for each d in last7:
  statusesForD = store[d] || {}
  list = sessionStudents.map(s => statusesForD[s.id] || 'present')
  presentCount = count(list in ['present','late','excused'])
  rate = round(presentCount / max(1, list.length) * 100)
  push({ date: d.slice(5), attendanceRate: rate })
```

**statusMeta(status):**
```
absent -> { type:'error', requiresAction:true, priority:'high' }
late   -> { type:'warning', requiresAction:false, priority:'medium' }
excused-> { type:'info', requiresAction:false, priority:'low' }
else   -> { type:'success', requiresAction:false, priority:'low' }
```

---

### <a id="mongoose-schémy"></a>Mongoose schémy (výrez)
```jsx
import { Schema, model, models, Types } from 'mongoose';

const Role = Object.freeze(['TEACHER','STUDENT']);
const AttendanceStatus = Object.freeze(['PRESENT','ABSENT','LATE','EXCUSED']);
const Weekday = Object.freeze(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY']);

const UserSchema = new Schema({ email:{type:String,unique:true,index:true}, passwordHash:String, role:String, displayName:String }, { timestamps:true });
const CourseSchema = new Schema({ code:{type:String,unique:true,index:true}, nameSk:String, nameEn:String, periodSk:String }, { timestamps:true });
const ClassSchema = new Schema({
  courseId:{type:Types.ObjectId,ref:'Course',index:true,required:true},
  teacherId:{type:Types.ObjectId,ref:'User',index:true,required:true},
  termKey:{type:String,index:true,required:true},
  sectionKey:{type:String,index:true,required:true},
  room:String, day:{type:String,enum:Weekday,required:true},
  startTime:String, endTime:String
},{timestamps:true});
ClassSchema.index({ teacherId:1, termKey:1 });
ClassSchema.index({ courseId:1, sectionKey:1 });

const EnrollmentSchema = new Schema({ classId:{type:Types.ObjectId,ref:'Class',index:true}, studentId:{type:Types.ObjectId,ref:'User',index:true} }, {timestamps:true});
EnrollmentSchema.index({ classId:1, studentId:1 }, { unique:true });

const AttendanceSchema = new Schema({
  classId:{type:Types.ObjectId,ref:'Class',index:true,required:true},
  studentId:{type:Types.ObjectId,ref:'User',index:true,required:true},
  date:{type:Date,index:true,required:true},
  status:{type:String,enum:AttendanceStatus,required:true},
  recordedById:{type:Types.ObjectId,ref:'User'}
},{timestamps:true});
AttendanceSchema.index({ classId:1, studentId:1, date:1 }, { unique:true });
```

---

## 14) Implementačné poznámky z dodaného kódu (fixlist)
- `AttendanceStats` – odstrániť trailing `"/"` po exporte defaultu.
- `AttendanceHeader` – opraviť `w/full` → `w-full`.
- `AttendanceTracking` – zjednotiť dvojité použitie `useNotifications()` (použiť jeden destructuring).
- `AttendanceFilters` – buď neprenášať `userRole`, alebo doplniť prop.  
- Formát X osi grafu – pridať `tickFormatter` pre kratší dátum (`MM-DD`).  
- Efekt pre `manualSessionKey` – závislosť na obsahu listu (nielen na `length`) ak je potrebné auto‑prepínanie.  
- Toast/feedback pre „Copy to clipboard“ ak pridáme akcie kopírovania.  

---

## 15) Nasadenie (Docker)
```yaml
services:
  api:
    build: .
    env_file: .env
    depends_on: [mongo]
    ports: ["8080:8080"]
  mongo:
    image: mongo:6
    volumes:
      - ./mongodata:/data/db
```

---

**Koniec dokumentu – TUKE AIS MVP špecifikácia.**
