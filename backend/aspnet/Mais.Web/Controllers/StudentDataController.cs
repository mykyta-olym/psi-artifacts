using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/students")]
[Authorize]
public class StudentDataController : ControllerBase
{
    private readonly AppDbContext _db;

    public StudentDataController(AppDbContext db)
    {
        _db = db;
    }

    // ==================== Bank Connections ====================

    /// <summary>
    /// Get all bank connections for a student
    /// </summary>
    [HttpGet("{studentId}/bank-connections")]
    public async Task<IActionResult> GetBankConnections(string studentId)
    {
        var connections = await _db.BankConnections
            .Where(b => b.StudentId == studentId)
            .OrderByDescending(b => b.IsPrimary)
            .ThenByDescending(b => b.CreatedAt)
            .ToListAsync();
        return Ok(connections);
    }

    /// <summary>
    /// Add a new bank connection for a student
    /// </summary>
    [HttpPost("{studentId}/bank-connections")]
    public async Task<IActionResult> AddBankConnection(string studentId, [FromBody] BankConnectionRequest req)
    {
        if (req == null) return BadRequest(new { error = "Request body required" });
        
        var student = await _db.Students.FindAsync(studentId);
        if (student == null) return NotFound(new { error = "Student not found" });

        var connection = new BankConnectionEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            StudentId = studentId,
            BankName = req.BankName ?? string.Empty,
            AccountNumber = req.AccountNumber ?? string.Empty,
            Iban = req.Iban ?? string.Empty,
            Swift = req.Swift,
            IsPrimary = req.IsPrimary ?? false,
            CreatedAt = DateTime.UtcNow.ToString("o"),
            UpdatedAt = DateTime.UtcNow.ToString("o")
        };

        // If this is set as primary, unset all others
        if (connection.IsPrimary)
        {
            var existing = await _db.BankConnections.Where(b => b.StudentId == studentId).ToListAsync();
            foreach (var b in existing)
            {
                b.IsPrimary = false;
            }
        }

        _db.BankConnections.Add(connection);
        await _db.SaveChangesAsync();

        return Ok(connection);
    }

    /// <summary>
    /// Update a bank connection
    /// </summary>
    [HttpPut("{studentId}/bank-connections/{connectionId}")]
    public async Task<IActionResult> UpdateBankConnection(string studentId, string connectionId, [FromBody] BankConnectionRequest req)
    {
        var connection = await _db.BankConnections.FirstOrDefaultAsync(b => b.Id == connectionId && b.StudentId == studentId);
        if (connection == null) return NotFound(new { error = "Bank connection not found" });

        if (!string.IsNullOrWhiteSpace(req.BankName)) connection.BankName = req.BankName;
        if (!string.IsNullOrWhiteSpace(req.AccountNumber)) connection.AccountNumber = req.AccountNumber;
        if (!string.IsNullOrWhiteSpace(req.Iban)) connection.Iban = req.Iban;
        if (req.Swift != null) connection.Swift = req.Swift;
        if (req.IsPrimary.HasValue)
        {
            connection.IsPrimary = req.IsPrimary.Value;
            if (connection.IsPrimary)
            {
                var others = await _db.BankConnections.Where(b => b.StudentId == studentId && b.Id != connectionId).ToListAsync();
                foreach (var b in others)
                {
                    b.IsPrimary = false;
                }
            }
        }
        connection.UpdatedAt = DateTime.UtcNow.ToString("o");

        await _db.SaveChangesAsync();
        return Ok(connection);
    }

    /// <summary>
    /// Delete a bank connection
    /// </summary>
    [HttpDelete("{studentId}/bank-connections/{connectionId}")]
    public async Task<IActionResult> DeleteBankConnection(string studentId, string connectionId)
    {
        var connection = await _db.BankConnections.FirstOrDefaultAsync(b => b.Id == connectionId && b.StudentId == studentId);
        if (connection == null) return NotFound(new { error = "Bank connection not found" });

        _db.BankConnections.Remove(connection);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ==================== Variable Symbols ====================

    /// <summary>
    /// Get all variable symbols for a student
    /// </summary>
    [HttpGet("{studentId}/variable-symbols")]
    public async Task<IActionResult> GetVariableSymbols(string studentId)
    {
        var symbols = await _db.VariableSymbols
            .Where(v => v.StudentId == studentId)
            .OrderByDescending(v => v.IsActive)
            .ThenByDescending(v => v.CreatedAt)
            .ToListAsync();
        return Ok(symbols);
    }

    /// <summary>
    /// Add a new variable symbol for a student
    /// </summary>
    [HttpPost("{studentId}/variable-symbols")]
    public async Task<IActionResult> AddVariableSymbol(string studentId, [FromBody] VariableSymbolRequest req)
    {
        if (req == null) return BadRequest(new { error = "Request body required" });
        
        var student = await _db.Students.FindAsync(studentId);
        if (student == null) return NotFound(new { error = "Student not found" });

        var symbol = new VariableSymbolEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            StudentId = studentId,
            Symbol = req.Symbol ?? string.Empty,
            Purpose = req.Purpose ?? string.Empty,
            Description = req.Description,
            IsActive = req.IsActive ?? true,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };

        _db.VariableSymbols.Add(symbol);
        await _db.SaveChangesAsync();

        return Ok(symbol);
    }

    /// <summary>
    /// Update a variable symbol
    /// </summary>
    [HttpPut("{studentId}/variable-symbols/{symbolId}")]
    public async Task<IActionResult> UpdateVariableSymbol(string studentId, string symbolId, [FromBody] VariableSymbolRequest req)
    {
        var symbol = await _db.VariableSymbols.FirstOrDefaultAsync(v => v.Id == symbolId && v.StudentId == studentId);
        if (symbol == null) return NotFound(new { error = "Variable symbol not found" });

        if (!string.IsNullOrWhiteSpace(req.Symbol)) symbol.Symbol = req.Symbol;
        if (!string.IsNullOrWhiteSpace(req.Purpose)) symbol.Purpose = req.Purpose;
        if (req.Description != null) symbol.Description = req.Description;
        if (req.IsActive.HasValue) symbol.IsActive = req.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(symbol);
    }

    /// <summary>
    /// Delete a variable symbol
    /// </summary>
    [HttpDelete("{studentId}/variable-symbols/{symbolId}")]
    public async Task<IActionResult> DeleteVariableSymbol(string studentId, string symbolId)
    {
        var symbol = await _db.VariableSymbols.FirstOrDefaultAsync(v => v.Id == symbolId && v.StudentId == studentId);
        if (symbol == null) return NotFound(new { error = "Variable symbol not found" });

        _db.VariableSymbols.Remove(symbol);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ==================== Device Sessions ====================

    /// <summary>
    /// Get all device sessions for a user
    /// </summary>
    [HttpGet("sessions/{userId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDeviceSessions(string userId)
    {
        var sessions = await _db.DeviceSessions
            .Where(d => d.UserId == userId)
            .OrderByDescending(d => d.IsCurrent)
            .ThenByDescending(d => d.LastActivity)
            .ToListAsync();
        return Ok(sessions);
    }

    /// <summary>
    /// Create or update a device session
    /// </summary>
    [HttpPost("sessions")]
    public async Task<IActionResult> UpsertDeviceSession([FromBody] DeviceSessionRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.UserId)) 
            return BadRequest(new { error = "UserId required" });

        // Mark all existing sessions as not current
        var existing = await _db.DeviceSessions.Where(d => d.UserId == req.UserId).ToListAsync();
        foreach (var s in existing)
        {
            s.IsCurrent = false;
        }

        var session = new DeviceSessionEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = req.UserId,
            DeviceName = req.DeviceName ?? "Unknown Device",
            DeviceType = req.DeviceType ?? "Desktop",
            Browser = req.Browser ?? "Unknown",
            Os = req.Os ?? "Unknown",
            IpAddress = req.IpAddress ?? string.Empty,
            Location = req.Location,
            LastActivity = DateTime.UtcNow.ToString("o"),
            CreatedAt = DateTime.UtcNow.ToString("o"),
            IsCurrent = true
        };

        _db.DeviceSessions.Add(session);
        await _db.SaveChangesAsync();

        return Ok(session);
    }

    /// <summary>
    /// Update session activity timestamp
    /// </summary>
    [HttpPut("sessions/{sessionId}/activity")]
    public async Task<IActionResult> UpdateSessionActivity(string sessionId)
    {
        var session = await _db.DeviceSessions.FindAsync(sessionId);
        if (session == null) return NotFound(new { error = "Session not found" });

        session.LastActivity = DateTime.UtcNow.ToString("o");
        session.IsCurrent = true;

        await _db.SaveChangesAsync();
        return Ok(session);
    }

    /// <summary>
    /// Delete a device session
    /// </summary>
    [HttpDelete("sessions/{sessionId}")]
    public async Task<IActionResult> DeleteDeviceSession(string sessionId)
    {
        var session = await _db.DeviceSessions.FindAsync(sessionId);
        if (session == null) return NotFound(new { error = "Session not found" });

        _db.DeviceSessions.Remove(session);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // ==================== Student Ranking ====================

    /// <summary>
    /// Get student ranking for scholarships based on GPA and ECTS
    /// </summary>
    [HttpGet("ranking")]
    public async Task<IActionResult> GetStudentRanking(
        [FromQuery] string? programCode = null,
        [FromQuery] int? studyYear = null,
        [FromQuery] int limit = 100)
    {
        Console.WriteLine($"[StudentRanking] GetStudentRanking called - programCode: {programCode}, studyYear: {studyYear}, limit: {limit}");
        
        // Get all course grades grouped by student
        var gradesQuery = _db.CourseGrades.AsNoTracking();
        
        // Get students with their program info
        var studentsQuery = _db.Students.AsNoTracking();
        
        if (!string.IsNullOrWhiteSpace(programCode))
        {
            studentsQuery = studentsQuery.Where(s => s.Program == programCode);
        }
        
        if (studyYear.HasValue)
        {
            studentsQuery = studentsQuery.Where(s => s.StudyYear == studyYear.Value);
        }
        
        var students = await studentsQuery.ToListAsync();
        Console.WriteLine($"[StudentRanking] Found {students.Count} students");
        
        var studentIds = students.Select(s => s.Id).ToHashSet();
        
        var allGrades = await gradesQuery
            .Where(g => studentIds.Contains(g.StudentId))
            .ToListAsync();
        Console.WriteLine($"[StudentRanking] Found {allGrades.Count} grades for these students");
        
        // Get all courses for ECTS info
        var courseCredits = await _db.Courses
            .AsNoTracking()
            .ToDictionaryAsync(c => c.Code, c => c.Credits);
        
        // Calculate ranking for each student
        var ranking = students.Select(student =>
        {
            var studentGrades = allGrades.Where(g => g.StudentId == student.Id).ToList();
            
            // Calculate GPA (A=4, B=3, C=2, D=1, E=1, F=0)
            var gradePoints = studentGrades.Select(g =>
            {
                var letter = g.LetterGrade?.ToUpper() ?? "";
                return letter switch
                {
                    "A" => 4,
                    "B" => 3,
                    "C" => 2,
                    "D" => 1,
                    "E" => 1,
                    _ => 0
                };
            }).ToList();
            
            var gpa = gradePoints.Count > 0 
                ? Math.Round(gradePoints.Average(), 2) 
                : 0;
            
            // Calculate total ECTS earned (passed courses)
            var ects = studentGrades
                .Where(g => 
                {
                    var letter = g.LetterGrade?.ToUpper() ?? "";
                    return letter is "A" or "B" or "C" or "D" or "E";
                })
                .Sum(g => 
                {
                    if (courseCredits.TryGetValue(g.CourseCode, out var credits))
                        return credits;
                    return 6; // Default credits
                });
            
            return new
            {
                StudentId = student.Id,
                Name = student.FullName.Trim(),
                Gpa = gpa,
                Ects = ects,
                ProgramCode = student.Program,
                StudyYear = student.StudyYear
            };
        })
        .OrderByDescending(s => s.Gpa)
        .ThenByDescending(s => s.Ects)
        .Take(limit)
        .Select((s, index) => new
        {
            Rank = index + 1,
            s.StudentId,
            s.Name,
            s.Gpa,
            s.Ects,
            s.ProgramCode,
            s.StudyYear
        })
        .ToList();
        
        return Ok(new
        {
            total = students.Count,
            ranking
        });
    }

    /// <summary>
    /// Get specific student's ranking position
    /// </summary>
    [HttpGet("{studentId}/ranking")]
    public async Task<IActionResult> GetStudentRankingPosition(string studentId)
    {
        var student = await _db.Students.FindAsync(studentId);
        if (student == null) return NotFound(new { error = "Student not found" });
        
        // Get all students in the same program
        var programStudents = await _db.Students
            .AsNoTracking()
            .Where(s => s.Program == student.Program)
            .ToListAsync();
        
        var studentIds = programStudents.Select(s => s.Id).ToHashSet();
        
        var allGrades = await _db.CourseGrades
            .AsNoTracking()
            .Where(g => studentIds.Contains(g.StudentId))
            .ToListAsync();
        
        var courseCredits = await _db.Courses
            .AsNoTracking()
            .ToDictionaryAsync(c => c.Code, c => c.Credits);
        
        // Calculate stats for each student
        var stats = programStudents.Select(s =>
        {
            var grades = allGrades.Where(g => g.StudentId == s.Id).ToList();
            var gradePoints = grades.Select(g =>
            {
                var letter = g.LetterGrade?.ToUpper() ?? "";
                return letter switch
                {
                    "A" => 4,
                    "B" => 3,
                    "C" => 2,
                    "D" => 1,
                    "E" => 1,
                    _ => 0
                };
            }).ToList();
            
            var gpa = gradePoints.Count > 0 ? gradePoints.Average() : 0;
            var ects = grades
                .Where(g => 
                {
                    var letter = g.LetterGrade?.ToUpper() ?? "";
                    return letter is "A" or "B" or "C" or "D" or "E";
                })
                .Sum(g => courseCredits.GetValueOrDefault(g.CourseCode, 6));
            
            return new { StudentId = s.Id, Gpa = gpa, Ects = ects };
        })
        .OrderByDescending(s => s.Gpa)
        .ThenByDescending(s => s.Ects)
        .ToList();
        
        var position = stats.FindIndex(s => s.StudentId == studentId) + 1;
        var myStats = stats.FirstOrDefault(s => s.StudentId == studentId);
        var percentile = stats.Count > 0 
            ? Math.Round((1 - ((double)(position - 1) / Math.Max(1, stats.Count - 1))) * 100, 1) 
            : 0;
        
        return Ok(new
        {
            studentId,
            position,
            total = stats.Count,
            percentile,
            gpa = Math.Round(myStats?.Gpa ?? 0, 2),
            ects = myStats?.Ects ?? 0,
            programCode = student.Program
        });
    }
}

// Request DTOs
public class BankConnectionRequest
{
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? Iban { get; set; }
    public string? Swift { get; set; }
    public bool? IsPrimary { get; set; }
}

public class VariableSymbolRequest
{
    public string? Symbol { get; set; }
    public string? Purpose { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

public class DeviceSessionRequest
{
    public string? UserId { get; set; }
    public string? DeviceName { get; set; }
    public string? DeviceType { get; set; }
    public string? Browser { get; set; }
    public string? Os { get; set; }
    public string? IpAddress { get; set; }
    public string? Location { get; set; }
}
