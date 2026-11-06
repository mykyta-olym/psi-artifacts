using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Models;
using Mais.Web.Entities;
using System.Security.Cryptography;
using System.Text;

using Microsoft.AspNetCore.Authorization;

namespace Mais.Web.Controllers;

[Authorize]
public class GradebookController : ControllerBase
{
    private readonly AppDbContext _db;
    public GradebookController(AppDbContext db) { _db = db; }

    private static uint Fnv1a(string s)
    {
        unchecked
        {
            uint h = 2166136261;
            foreach (var ch in s)
            {
                h ^= ch;
                h *= 16777619;
            }
            return h;
        }
    }

    private static int Pick(string seed, int min, int max)
    {
        var span = Math.Max(0, max - min);
        var hv = (int)(Fnv1a(seed) % (span + 1));
        return min + hv;
    }

    private static int Clamp(int n, int a, int b) => Math.Max(a, Math.Min(b, n));

    private static string ToBase36(int value)
    {
        const string alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (value == 0) return "0";
        var v = Math.Abs(value);
        var sb = new StringBuilder();
        while (v > 0)
        {
            var rem = v % 36;
            sb.Insert(0, alphabet[rem]);
            v /= 36;
        }
        return sb.ToString();
    }

    private static string MaisId(string ns, string raw)
    {
        var h = (int)Fnv1a($"{ns}::{raw}");
        var stamp = (int)(1609459200 / 3600); // 2021-01-01 UTC by hours
        var v = Math.Abs(h);
        // Convert.ToString(int, base) only supports 2,8,10,16; implement base-36 manually
        var base36 = ToBase36(v);
        var chk = Math.Abs((h ^ stamp) % 97).ToString().PadLeft(2, '0');
        return $"{ns.ToUpperInvariant()}-{base36}-{chk}";
    }

    /// <summary>
    /// Get all classes for a teacher with class group keys
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <returns>List of classes with class group keys</returns>
    /// <response code="200">Returns the list of classes</response>
    [HttpGet("/api/teachers/{email}/classes")]
    [ProducesResponseType(typeof(List<ClassModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTeacherClasses(string email)
    {
        email = (email ?? string.Empty).ToLowerInvariant();
        var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == email);
        if (teacher == null)
        {
            return Ok(new List<ClassModel>());
        }

        var entries = await _db.Timetable.AsNoTracking().Where(t => t.TeacherEmail.ToLower() == email).ToListAsync();
        var courseCodes = entries.Select(e => e.CourseCode).Distinct().ToList();
        var courses = await _db.Courses.AsNoTracking().Where(c => courseCodes.Contains(c.Code)).ToDictionaryAsync(c => c.Code, c => c);

        // Group by course
        var grouped = entries.GroupBy(e => e.CourseCode);
        var classes = new List<ClassModel>();

        foreach (var g in grouped)
        {
            courses.TryGetValue(g.Key, out var course);
            var classId = MaisId("class", $"{g.Key}|{email}");
            var sessions = g.Select(e => new ClassSessionModel { Day = e.Day, Time = e.Slot, Room = e.Room }).ToList();

            // Extract unique class group keys from timetable entries
            var classGroupKeys = new HashSet<string>();
            // Also extract types (CL, P, S) from timetable entries
            var typeCounts = new Dictionary<string, int>();
            bool hasCLType = false;
            foreach (var entry in g)
            {
                if (!string.IsNullOrWhiteSpace(entry.ClassGroupKeysJson))
                {
                    try
                    {
                        var keys = System.Text.Json.JsonSerializer.Deserialize<List<string>>(entry.ClassGroupKeysJson);
                        if (keys != null)
                        {
                            foreach (var key in keys)
                            {
                                if (!string.IsNullOrWhiteSpace(key))
                                {
                                    classGroupKeys.Add(key);
                                }
                            }
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
                // Count types and check if CL exists
                if (!string.IsNullOrWhiteSpace(entry.Type))
                {
                    var type = entry.Type.ToUpperInvariant();
                    typeCounts[type] = typeCounts.GetValueOrDefault(type, 0) + 1;
                    if (type == "CL")
                    {
                        hasCLType = true;
                    }
                }
            }

            // If course has at least one CL type, allow grading (even if it also has P or S)
            // Otherwise, use the most common type, or default to CL
            var mostCommonType = hasCLType
                ? "CL"
                : (typeCounts.OrderByDescending(kvp => kvp.Value)
                    .Select(kvp => kvp.Key)
                    .FirstOrDefault() ?? "CL");

            var cls = new ClassModel
            {
                Id = classId,
                Code = g.Key,
                Name = (course?.NameEn ?? g.Key) + $" ({g.Key})",
                Subject = course?.NameEn ?? g.Key,
                Grade = course?.PeriodSk,
                Students = 0,
                OwnerId = MaisId("fac", email),
                SessionsCount = sessions.Count,
                Sessions = sessions,
                ClassGroupKeys = classGroupKeys.ToList(),
                Type = mostCommonType,
                Kind = mostCommonType // Alias for compatibility
            };
            classes.Add(cls);
        }

        return Ok(classes);
    }

    /// <summary>
    /// Get complete gradebook data for a teacher (classes, students, assignments, grades)
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <returns>Complete gradebook data including classes, students, assignments, and grades</returns>
    /// <response code="200">Returns the gradebook data</response>
    [HttpGet("/api/teachers/{email}/gradebook")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TeacherGradebook(string email)
    {
        email = (email ?? string.Empty).ToLowerInvariant();
        var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == email);
        if (teacher == null)
        {
            return Ok(new { teacher = (object?)null, classes = new List<ClassModel>(), classStudents = new List<object>(), assignments = new List<AssignmentModel>(), grades = new List<GradeRecordModel>() });
        }

        var entries = await _db.Timetable.AsNoTracking().Where(t => t.TeacherEmail.ToLower() == email).ToListAsync();
        var courseCodes = entries.Select(e => e.CourseCode).Distinct().ToList();
        var courses = await _db.Courses.AsNoTracking().Where(c => courseCodes.Contains(c.Code)).ToDictionaryAsync(c => c.Code, c => c);

        // Group by course
        var grouped = entries.GroupBy(e => e.CourseCode);
        var classes = new List<ClassModel>();
        var classStudents = new List<(string classId, List<string> studentIds)>();

        foreach (var g in grouped)
        {
            courses.TryGetValue(g.Key, out var course);
            var classId = MaisId("class", $"{g.Key}|{email}");
            var sessions = g.Select(e => new ClassSessionModel { Day = e.Day, Time = e.Slot, Room = e.Room }).ToList();

            // Extract unique class group keys from timetable entries
            var classGroupKeys = new HashSet<string>();
            // Also extract types (CL, P, S) from timetable entries
            var typeCounts = new Dictionary<string, int>();
            bool hasCLType = false;
            foreach (var entry in g)
            {
                if (!string.IsNullOrWhiteSpace(entry.ClassGroupKeysJson))
                {
                    try
                    {
                        var keys = System.Text.Json.JsonSerializer.Deserialize<List<string>>(entry.ClassGroupKeysJson);
                        if (keys != null)
                        {
                            foreach (var key in keys)
                            {
                                if (!string.IsNullOrWhiteSpace(key))
                                {
                                    classGroupKeys.Add(key);
                                }
                            }
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
                // Count types and check if CL exists
                if (!string.IsNullOrWhiteSpace(entry.Type))
                {
                    var type = entry.Type.ToUpperInvariant();
                    typeCounts[type] = typeCounts.GetValueOrDefault(type, 0) + 1;
                    if (type == "CL")
                    {
                        hasCLType = true;
                    }
                }
            }

            // If course has at least one CL type, allow grading (even if it also has P or S)
            // Otherwise, use the most common type, or default to CL
            var mostCommonType = hasCLType
                ? "CL"
                : (typeCounts.OrderByDescending(kvp => kvp.Value)
                    .Select(kvp => kvp.Key)
                    .FirstOrDefault() ?? "CL");

            var cls = new ClassModel
            {
                Id = classId,
                Code = g.Key,
                Name = (course?.NameEn ?? g.Key) + $" ({g.Key})",
                Subject = "Informatics",
                Grade = course?.PeriodSk,
                Students = 0, // set after enrollment
                OwnerId = MaisId("fac", email),
                SessionsCount = sessions.Count,
                Sessions = sessions,
                ClassGroupKeys = classGroupKeys.ToList(),
                Type = mostCommonType,
                Kind = mostCommonType, // Alias for compatibility
                CompletionSk = course?.CompletionSk, // Cr (credit only) or CrEx (credit + exam)
                Profile = course?.Profile, // PV, PVP, PP
                Credits = course?.Credits ?? 0
            };
            classes.Add(cls);

            // Get real enrollments from database instead of deterministic enrollment
            var eventIds = g.Select(e => e.Id).ToList();
            var enrollments = await _db.Enrollments.AsNoTracking()
                .Where(en => en.CourseCode == g.Key && en.ScheduleEventId != null && eventIds.Contains(en.ScheduleEventId))
                .ToListAsync();

            // Deduplicate enrollments by StudentId (one student can have multiple enrollments for different events)
            var enrolledStudentIds = enrollments
                .Select(en => en.StudentId)
                .Distinct()
                .ToList();

            cls.Students = enrolledStudentIds.Count;
            classStudents.Add((classId, enrolledStudentIds));
        }

        // Load persisted assignments for teacher+course or fallback to none (teacher creates via UI)
        var assignments = new List<AssignmentModel>();
        var persisted = await _db.Assignments.AsNoTracking().Where(a => a.TeacherEmail.ToLower() == email && courseCodes.Contains(a.CourseCode)).ToListAsync();
        foreach (var a in persisted)
        {
            assignments.Add(new AssignmentModel
            {
                Id = a.Id,
                ClassId = a.ClassId,
                CourseCode = a.CourseCode,
                Name = a.Name,
                Category = a.Category,
                TotalPoints = a.TotalPoints,
                DueDate = a.DueDate,
                Description = a.Description ?? string.Empty,
                CreatedAt = a.CreatedAt.ToString("o"),
                UpdatedAt = a.UpdatedAt.ToString("o")
            });
        }

        // Grades from persistence
        var grades = new List<GradeRecordModel>();
        if (assignments.Count > 0)
        {
            var asgIds = assignments.Select(x => x.Id).ToList();
            var grows = await _db.AssignmentGrades.AsNoTracking().Where(g => asgIds.Contains(g.AssignmentId)).ToListAsync();
            // Build a lookup for assignment totalPoints
            var asgTotals = assignments.ToDictionary(a => a.Id, a => a.TotalPoints);
            foreach (var g in grows)
            {
                // Calculate percentage from points and assignment totalPoints
                var totalPts = asgTotals.TryGetValue(g.AssignmentId, out var tp) ? tp : 0;
                var pct = totalPts > 0 ? (int)Math.Round((double)g.Points / totalPts * 100) : 0;
                grades.Add(new GradeRecordModel
                {
                    StudentId = g.StudentId,
                    AssignmentId = g.AssignmentId,
                    Points = g.Points,
                    Percentage = pct,
                    LetterGrade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F",
                    LastUpdated = g.LastUpdated.ToString("o")
                });
            }
        }

        // Expand classStudents to array { classId, students: Student[] }
        var studentIds = classStudents.SelectMany(cs => cs.studentIds).Distinct().ToList();
        // Find students by both Id and PersonId (enrollments may use PersonId)
        var students = await _db.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && studentIds.Contains(s.PersonId)))
            .ToListAsync();

        // Create a map that can look up by both Id and PersonId
        var studentMap = new Dictionary<string, StudentEntity?>();
        foreach (var s in students)
        {
            if (!string.IsNullOrWhiteSpace(s.Id) && studentIds.Contains(s.Id))
            {
                studentMap[s.Id] = s;
            }
            if (!string.IsNullOrWhiteSpace(s.PersonId) && studentIds.Contains(s.PersonId))
            {
                studentMap[s.PersonId] = s;
            }
        }

        // Deduplicate students by PersonId (if available) or Id to avoid duplicates within each class
        var classStudentsArr = classStudents.Select(cs =>
        {
            var seenStudents = new HashSet<string>();
            return new
            {
                classId = cs.classId,
                students = cs.studentIds
                    .Where(id =>
                    {
                        // Skip if we've already seen this student (by PersonId or Id) in this class
                        if (studentMap.TryGetValue(id, out var s) && s != null)
                        {
                            var key = string.IsNullOrWhiteSpace(s.PersonId) ? (s.Id ?? string.Empty) : s.PersonId;
                            if (seenStudents.Contains(key)) return false;
                            seenStudents.Add(key);
                            return true;
                        }
                        // If student not found in map, use id as key
                        if (seenStudents.Contains(id)) return false;
                        seenStudents.Add(id);
                        return true;
                    })
                    .Select(id =>
                    {
                        // Try to find student by id (which may be PersonId or Id)
                        if (!studentMap.TryGetValue(id, out var s))
                        {
                            // If not found, try to find by PersonId or Id in the students list
                            s = students.FirstOrDefault(st =>
                                (!string.IsNullOrWhiteSpace(st.PersonId) && st.PersonId == id) ||
                                st.Id == id);
                        }

                        if (s == null)
                        {
                            return null;
                        }

                        return new StudentModel
                        {
                            Id = s.Id,
                            FullName = !string.IsNullOrWhiteSpace(s.FullName) ? s.FullName :
                                      (s.GivenName != null && s.FamilyName != null ? $"{s.GivenName} {s.FamilyName}" : s.Id),
                            Degree = s.Degree,
                            GivenName = s.GivenName,
                            FamilyName = s.FamilyName,
                            Email = s.Email,
                            Faculty = s.Faculty,
                            Program = s.Program,
                            StudyYear = s.StudyYear
                        };
                    })
                    .ToList()
            };
        });

        // Get dynamic rating
        var avgRating = await _db.TeacherRatings
            .Where(r => r.TeacherId == teacher.Id)
            .AverageAsync(r => (double?)r.Rating);
        
        var teacherModel = new
        {
            Id = teacher.Id,
            FullName = teacher.FullName,
            Email = teacher.Email,
            Faculty = teacher.Faculty,
            Phone = teacher.Phone,
            Office = teacher.Office,
            Rating = avgRating.HasValue ? Math.Round(avgRating.Value, 2) : 0.0
        };

        var payload = new
        {
            teacher = teacherModel,
            classes,
            classStudents = classStudentsArr,
            assignments,
            grades
        };

        return Ok(payload);
    }

    /// <summary>
    /// Get gradebook data for a student
    /// </summary>
    /// <param name="id">Student identifier</param>
    /// <returns>Student gradebook data including classes, assignments, and grades</returns>
    /// <remarks>
    /// Returns gradebook data for a student including:
    /// - Student information
    /// - Classes (courses) the student is enrolled in
    /// - Assignments for those classes
    /// - Grades for assignments
    /// </remarks>
    [HttpGet("/api/students/{id}/gradebook")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> StudentGradebook(string id)
    {
        var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (student == null)
        {
            return Ok(new { student = (object?)null, classes = new List<ClassModel>(), assignments = new List<AssignmentModel>(), grades = new List<GradeRecordModel>() });
        }

        // Get real enrollments for this student
        var enrollments = await _db.Enrollments.AsNoTracking()
            .Where(e => e.StudentId == id)
            .ToListAsync();

        var courseCodes = enrollments.Select(e => e.CourseCode).Distinct().ToList();
        var courses = await _db.Courses.AsNoTracking()
            .Where(c => courseCodes.Contains(c.Code))
            .ToDictionaryAsync(c => c.Code, c => c);

        var timetableEntries = await _db.Timetable.AsNoTracking()
            .Where(t => courseCodes.Contains(t.CourseCode))
            .ToListAsync();

        var classes = new List<ClassModel>();
        var assignments = new List<AssignmentModel>();
        var grades = new List<GradeRecordModel>();

        var byCourse = timetableEntries.GroupBy(e => e.CourseCode);
        foreach (var g in byCourse)
        {
            courses.TryGetValue(g.Key, out var course);
            var classId = MaisId("class", g.Key);
            var sessions = g.Select(e => new ClassSessionModel { Day = e.Day, Time = e.Slot, Room = e.Room }).ToList();

            classes.Add(new ClassModel
            {
                Id = classId,
                Code = g.Key,
                Name = (course?.NameEn ?? g.Key) + $" ({g.Key})",
                Subject = course?.NameEn ?? g.Key,
                Grade = course?.PeriodSk,
                Students = 0,
                OwnerId = "",
                SessionsCount = sessions.Count,
                Sessions = sessions,
                CompletionSk = course?.CompletionSk,
                Profile = course?.Profile,
                Credits = course?.Credits ?? 0
            });
        }

        // Get real assignments for student's courses
        var classIds = classes.Select(c => c.Id).ToList();
        var dbAssignments = await _db.Assignments.AsNoTracking()
            .Where(a => classIds.Contains(a.ClassId) || courseCodes.Contains(a.CourseCode))
            .ToListAsync();

        foreach (var a in dbAssignments)
        {
            assignments.Add(new AssignmentModel
            {
                Id = a.Id,
                ClassId = a.ClassId,
                CourseCode = a.CourseCode,
                Name = a.Name,
                Category = a.Category,
                TotalPoints = a.TotalPoints,
                DueDate = a.DueDate,
                Description = a.Description ?? string.Empty,
                CreatedAt = a.CreatedAt.ToString("o"),
                UpdatedAt = a.UpdatedAt.ToString("o")
            });
        }

        // Get real grades for this student
        var assignmentIds = assignments.Select(a => a.Id).ToList();
        var dbGrades = await _db.AssignmentGrades.AsNoTracking()
            .Where(g => g.StudentId == id && assignmentIds.Contains(g.AssignmentId))
            .ToListAsync();

        foreach (var g in dbGrades)
        {
            var assignment = assignments.FirstOrDefault(a => a.Id == g.AssignmentId);
            var pct = assignment != null && assignment.TotalPoints > 0
                ? (int)Math.Round(((double)g.Points / assignment.TotalPoints) * 100)
                : 0;
            var letter = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";

            grades.Add(new GradeRecordModel
            {
                StudentId = id,
                AssignmentId = g.AssignmentId,
                Points = g.Points,
                Percentage = pct,
                LetterGrade = letter,
                LastUpdated = g.LastUpdated.ToString("o")
            });
        }

        var studentModel = new StudentModel
        {
            Id = student.Id,
            FullName = student.FullName,
            Degree = student.Degree,
            GivenName = student.GivenName,
            FamilyName = student.FamilyName,
            Email = student.Email,
            Faculty = student.Faculty,
            Program = student.Program,
            StudyYear = student.StudyYear
        };

        var payload = new { student = studentModel, classes, assignments, grades };
        return Ok(payload);
    }
}
