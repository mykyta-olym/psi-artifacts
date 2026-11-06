using System.Collections.Generic;
using System.Text.Json;
using Mais.Web.Data;
using Mais.Web.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mais.Web.Services;

public class DbSeeder
{
    private readonly AppDbContext _db;
    private readonly ILogger<DbSeeder> _log;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ISimplePasswordHasher _hasher;

    // Configuration keys for seed options
    private const string SEED_SECTION = "Seed";
    private const string DEFAULT_STUDENT_PASSWORD_KEY = "DefaultStudentPassword";
    private const string DEFAULT_TEACHER_PASSWORD_KEY = "DefaultTeacherPassword";
    private const string GENERATE_RANDOM_PASSWORDS_KEY = "GenerateRandomPasswords";

    public DbSeeder(AppDbContext db, ILogger<DbSeeder> log, IConfiguration config, IWebHostEnvironment env, ISimplePasswordHasher hasher)
    {
        _db = db; _log = log; _config = config; _env = env; _hasher = hasher;
    }

    /// <summary>
    /// Gets the default password from configuration or generates a random one
    /// </summary>
    private string GetDefaultPassword(string role)
    {
        var seedSection = _config.GetSection(SEED_SECTION);
        var generateRandom = seedSection.GetValue<bool>(GENERATE_RANDOM_PASSWORDS_KEY);
        
        if (generateRandom)
        {
            // Generate a random password: role prefix + 8 random chars
            var random = new Random();
            const string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
            var randomPart = new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
            return $"{role}_{randomPart}";
        }
        
        var configKey = role == "student" ? DEFAULT_STUDENT_PASSWORD_KEY : DEFAULT_TEACHER_PASSWORD_KEY;
        var configuredPassword = seedSection.GetValue<string>(configKey);
        
        // Fallback to environment variable
        if (string.IsNullOrWhiteSpace(configuredPassword))
        {
            configuredPassword = Environment.GetEnvironmentVariable($"MAIS__SEED__{role.ToUpperInvariant()}_PASSWORD");
        }
        
        // Final fallback - simple demo passwords (can be overridden via config)
        if (string.IsNullOrWhiteSpace(configuredPassword))
        {
            return role == "student" ? "student123" : "teacher123";
        }
        
        return configuredPassword;
    }

    private string SeedPath()
    {
        var configured = _config.GetSection("Seed").GetValue<string>("Path");
        
        // First try absolute path (for Docker: /data/seed)
        if (!string.IsNullOrWhiteSpace(configured) && Path.IsPathRooted(configured) && Directory.Exists(configured))
        {
            return configured;
        }
        
        // Try relative to content root
        var relativeToContent = Path.Combine(_env.ContentRootPath, configured ?? string.Empty);
        if (Directory.Exists(relativeToContent))
        {
            return Path.GetFullPath(relativeToContent);
        }
        
        // Fallback: try ../../data/seed from ContentRoot (local dev structure)
        var localDevPath = Path.Combine(_env.ContentRootPath, "..", "..", "data", "seed");
        if (Directory.Exists(localDevPath))
        {
            return Path.GetFullPath(localDevPath);
        }
        
        // Last resort: just use configured path and let it fail gracefully
        return Path.GetFullPath(Path.Combine(_env.ContentRootPath, configured ?? "data/seed"));
    }

    private async Task<T?> ReadJsonAsync<T>(string fileName)
    {
        var full = Path.Combine(SeedPath(), fileName);
        if (!File.Exists(full)) return default;
        await using var fs = File.OpenRead(full);
        return await JsonSerializer.DeserializeAsync<T>(fs, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip
        });
    }

    private (string? faculty, string? program) InferFacultyAndProgram(CourseEntity course)
    {
        var nameEn = (course.NameEn ?? string.Empty).ToLowerInvariant();
        var nameSk = (course.NameSk ?? string.Empty).ToLowerInvariant();
        var code = (course.Code ?? string.Empty).ToLowerInvariant();
        var combined = $"{nameEn} {nameSk} {code}";

        // Default to FEI for most IT-related courses (courses starting with 26 are typically FEI)
        string? faculty = null;
        string? program = null;

        // Faculty detection based on keywords - check specific cases first
        // Forensics (Forénzna analýza) - typically FEI, Cybersecurity program
        if (combined.Contains("forénzna") || combined.Contains("forenzna") || combined.Contains("forensic") ||
            (code.Contains("FA") && (combined.Contains("analýza") || combined.Contains("analyza") || combined.Contains("analysis"))))
        {
            faculty = "FEI";
            program = "Cybersecurity";
            return (faculty, program);
        }

        // IT-related courses
        if (combined.Contains("informatik") || combined.Contains("software") || combined.Contains("cyber") ||
            combined.Contains("computer") || combined.Contains("programming") || combined.Contains("database") ||
            combined.Contains("network") || combined.Contains("web") || combined.Contains("ai ") ||
            combined.Contains("artificial intelligence") || combined.Contains("data science") ||
            combined.Contains("machine learning") || combined.Contains("algorithm") || code.StartsWith("26"))
        {
            faculty = "FEI";
        }
        else if (combined.Contains("mechanical") || combined.Contains("mechatronik") || combined.Contains("robot"))
        {
            faculty = "FBERG";
        }
        else if (combined.Contains("mining") || combined.Contains("ecology") || combined.Contains("geotechnolog"))
        {
            faculty = "FBI";
        }
        else if (combined.Contains("material") || combined.Contains("technology"))
        {
            faculty = "FVT";
        }
        else if (combined.Contains("chemical") || combined.Contains("food"))
        {
            faculty = "FCHPT";
        }
        else if (combined.Contains("manufacturing"))
        {
            faculty = "FMT";
        }
        else if (combined.Contains("industrial"))
        {
            faculty = "FRI";
        }

        // Program detection based on keywords (for FEI faculty)
        if (faculty == "FEI")
        {
            if (combined.Contains("cyber") || combined.Contains("security") || combined.Contains("bezpečnosť"))
            {
                program = "Cybersecurity";
            }
            else if (combined.Contains("ai ") || combined.Contains("artificial intelligence") || combined.Contains("machine learning") || combined.Contains("neural"))
            {
                program = "Artificial Intelligence";
            }
            else if (combined.Contains("data science") || combined.Contains("data mining") || combined.Contains("big data") || combined.Contains("analytics"))
            {
                program = "Data Science";
            }
            else if (combined.Contains("network") || combined.Contains("telecommunication") || combined.Contains("communication"))
            {
                program = "Network Engineering";
            }
            else if (combined.Contains("software") || combined.Contains("softvérové") || combined.Contains("programming") || combined.Contains("development"))
            {
                program = "Software Engineering";
            }
            else if (combined.Contains("information system") || combined.Contains("informačný systém") || combined.Contains("is "))
            {
                program = "Information Systems";
            }
            else if (combined.Contains("applied informatics") || combined.Contains("aplikovaná informatika"))
            {
                program = "Applied Informatics";
            }
            else
            {
                // Default for FEI courses
                program = "Computer Science";
            }
        }

        return (faculty, program);
    }

    /// <summary>
    /// Extracts building code from room name (e.g., "PK6-101" -> "PK6", "N9-201(ZP1)" -> "N9")
    /// </summary>
    private static string? ExtractBuilding(string roomName)
    {
        if (string.IsNullOrWhiteSpace(roomName)) return null;
        
        // Match common patterns: PK6-101, N9-201, AF-305, etc.
        var match = System.Text.RegularExpressions.Regex.Match(roomName, @"^([A-Z]{1,3}\d{0,2})[-_]?");
        if (match.Success && match.Groups[1].Success)
        {
            return match.Groups[1].Value;
        }
        
        return null;
    }

    /// <summary>
    /// Extracts floor from room name based on room number (e.g., "PK6-101" -> "1st floor", "N9-201" -> "2nd floor")
    /// </summary>
    private static string? ExtractFloor(string roomName)
    {
        if (string.IsNullOrWhiteSpace(roomName)) return null;
        
        // Match room number after building code
        var match = System.Text.RegularExpressions.Regex.Match(roomName, @"[-_](\d)");
        if (match.Success && match.Groups[1].Success)
        {
            var firstDigit = int.Parse(match.Groups[1].Value);
            return firstDigit switch
            {
                0 => "Ground floor",
                1 => "1st floor",
                2 => "2nd floor",
                3 => "3rd floor",
                _ => $"{firstDigit}th floor"
            };
        }
        
        return null;
    }

    private async Task EnsureFacultyExtendedSchemaAsync(CancellationToken ct)
    {
        var statements = new[]
        {
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"Status\" character varying(40)",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"EmploymentType\" character varying(40)",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"ClassesCount\" integer",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"YearsExperience\" integer",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"HireDate\" character varying(40)",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"LastActivity\" character varying(40)",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"AvatarUrl\" character varying(300)",
            "ALTER TABLE \"Students\" ADD COLUMN IF NOT EXISTS \"AvatarUrl\" character varying(300)",
            "ALTER TABLE \"Students\" ADD COLUMN IF NOT EXISTS \"ClassGroupId\" character varying(100)",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"About\" text",
            "ALTER TABLE \"Faculty\" ADD COLUMN IF NOT EXISTS \"Program\" character varying(100)",
            // Add Department column to Courses table
            "ALTER TABLE \"Courses\" ADD COLUMN IF NOT EXISTS \"Department\" character varying(60)"
        };

        foreach (var sql in statements)
        {
            await _db.Database.ExecuteSqlRawAsync(sql, cancellationToken: ct);
        }
    }

    private async Task EnsureActivitiesTableAsync(CancellationToken ct = default)
    {
        var statements = new[]
        {
            @"CREATE TABLE IF NOT EXISTS ""Activities"" (
                ""Id"" character varying(100) NOT NULL PRIMARY KEY,
                ""Type"" character varying(50) NOT NULL,
                ""Title"" character varying(500) NOT NULL,
                ""Description"" text,
                ""Subject"" character varying(200),
                ""ClassId"" character varying(100),
                ""CourseCode"" character varying(32),
                ""TeacherEmail"" character varying(200),
                ""TeacherDisplay"" character varying(200),
                ""StudentEmail"" character varying(200),
                ""StudentName"" character varying(200),
                ""Room"" character varying(100),
                ""Location"" character varying(200),
                ""AssignmentId"" character varying(100),
                ""Timestamp"" character varying(40) NOT NULL,
                ""RequiresAction"" boolean NOT NULL DEFAULT false,
                ""Priority"" character varying(20),
                ""MetaJson"" character varying(2000),
                ""CreatedByEmail"" character varying(200),
                ""CreatedAt"" character varying(40) NOT NULL,
                ""UpdatedAt"" character varying(40) NOT NULL,
                ""IsResolved"" boolean NOT NULL DEFAULT false,
                ""IsArchived"" boolean NOT NULL DEFAULT false
            )",
            @"CREATE INDEX IF NOT EXISTS ""IX_Activities_Type"" ON ""Activities"" (""Type"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Activities_TeacherEmail"" ON ""Activities"" (""TeacherEmail"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Activities_StudentEmail"" ON ""Activities"" (""StudentEmail"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Activities_Timestamp"" ON ""Activities"" (""Timestamp"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Activities_RequiresAction"" ON ""Activities"" (""RequiresAction"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Activities_IsArchived"" ON ""Activities"" (""IsArchived"")"
        };

        foreach (var sql in statements)
        {
            try
            {
                await _db.Database.ExecuteSqlRawAsync(sql, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed to execute Activities migration SQL: {Sql}", sql);
            }
        }
    }

    private async Task EnsureDocumentsTableAsync(CancellationToken ct = default)
    {
        var statements = new[]
        {
            @"CREATE TABLE IF NOT EXISTS ""Documents"" (
                ""Id"" character varying(100) NOT NULL PRIMARY KEY,
                ""TemplateKey"" character varying(64) NOT NULL,
                ""OwnerEmail"" character varying(200) NOT NULL,
                ""OwnerRole"" character varying(16) NOT NULL,
                ""Title"" character varying(400) NOT NULL,
                ""HtmlContent"" text NOT NULL,
                ""TeacherEmail"" character varying(200),
                ""TeacherName"" character varying(200),
                ""StudentId"" character varying(100),
                ""StudentEmail"" character varying(200),
                ""StudentName"" character varying(200),
                ""MetaJson"" text,
                ""CreatedAt"" character varying(40) NOT NULL,
                ""CreatedByEmail"" character varying(200)
            )",
            @"ALTER TABLE IF EXISTS ""Documents"" ADD COLUMN IF NOT EXISTS ""TargetGroupId"" character varying(100) NULL",
            @"CREATE INDEX IF NOT EXISTS ""IX_Documents_OwnerEmail"" ON ""Documents"" (""OwnerEmail"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Documents_TemplateKey"" ON ""Documents"" (""TemplateKey"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Documents_StudentTemplate"" ON ""Documents"" (""StudentId"", ""TemplateKey"")",
            @"CREATE INDEX IF NOT EXISTS ""IX_Documents_TargetGroupId"" ON ""Documents"" (""TargetGroupId"")"
        };

        foreach (var sql in statements)
        {
            try
            {
                await _db.Database.ExecuteSqlRawAsync(sql, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Failed to execute Documents migration SQL: {Sql}", sql);
            }
        }
    }

    public async Task EnsureCreatedAndSeededAsync(CancellationToken ct = default)
    {
        _log.LogInformation("[db] EnsureCreated start");
        await _db.Database.EnsureCreatedAsync(ct);

        await EnsureFacultyExtendedSchemaAsync(ct);
        await EnsureActivitiesTableAsync(ct);
        await EnsureDocumentsTableAsync(ct);

        // Seed Faculty Options (top-level organizational units)
        if (!await _db.FacultyOptions.AsNoTracking().AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<FacultyOptionEntity>>("facultyOptions.json") ?? new();
            if (raw.Count > 0)
            {
                foreach (var item in raw)
                {
                    if (string.IsNullOrWhiteSpace(item.Id))
                        item.Id = Guid.NewGuid().ToString();
                }
                _db.FacultyOptions.AddRange(raw);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded faculty options: {Count}", raw.Count);
            }
        }

        // Seed Departments (belong to Faculty Options)
        if (!await _db.Departments.AsNoTracking().AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<DepartmentEntity>>("departments.json") ?? new();
            if (raw.Count > 0)
            {
                foreach (var item in raw)
                {
                    if (string.IsNullOrWhiteSpace(item.Id))
                        item.Id = Guid.NewGuid().ToString();
                }
                _db.Departments.AddRange(raw);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded departments: {Count}", raw.Count);
            }
        }

        // Seed Programs (belong to Faculty Options, optionally to Departments)
        if (!await _db.Programs.AsNoTracking().AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ProgramEntity>>("programs.json") ?? new();
            if (raw.Count > 0)
            {
                foreach (var item in raw)
                {
                    if (string.IsNullOrWhiteSpace(item.Id))
                        item.Id = Guid.NewGuid().ToString();
                }
                _db.Programs.AddRange(raw);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded programs: {Count}", raw.Count);
            }
        }

        // Always update existing courses to ensure Faculty and Program are set
        var existingCourses = await _db.Courses.ToListAsync(ct);
        var needsUpdate = existingCourses.Any(c => string.IsNullOrWhiteSpace(c.Faculty) || string.IsNullOrWhiteSpace(c.Program));

        if (needsUpdate)
        {
            _log.LogInformation("[db] Updating existing courses with Faculty and Program");
            foreach (var course in existingCourses)
            {
                if (string.IsNullOrWhiteSpace(course.Faculty) || string.IsNullOrWhiteSpace(course.Program))
                {
                    var (faculty, program) = InferFacultyAndProgram(course);
                    if (string.IsNullOrWhiteSpace(course.Faculty) && !string.IsNullOrWhiteSpace(faculty))
                    {
                        course.Faculty = faculty;
                    }
                    if (string.IsNullOrWhiteSpace(course.Program) && !string.IsNullOrWhiteSpace(program))
                    {
                        course.Program = program;
                    }
                }
            }
            await _db.SaveChangesAsync(ct);
            _log.LogInformation("[db] Updated courses with Faculty and Program");
        }

        if (!await _db.Courses.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<CourseEntity>>("courses.json") ?? new();
            // normalize + de-duplicate by Code (case-insensitive, trimmed)
            foreach (var c in raw)
            {
                c.Code = (c.Code ?? string.Empty).Trim();
                c.NameEn = c.NameEn ?? c.NameSk ?? string.Empty;

                // Auto-assign Faculty and Program based on course name/code
                if (string.IsNullOrWhiteSpace(c.Faculty) || string.IsNullOrWhiteSpace(c.Program))
                {
                    var (faculty, program) = InferFacultyAndProgram(c);
                    if (string.IsNullOrWhiteSpace(c.Faculty) && !string.IsNullOrWhiteSpace(faculty)) c.Faculty = faculty;
                    if (string.IsNullOrWhiteSpace(c.Program) && !string.IsNullOrWhiteSpace(program)) c.Program = program;
                }
            }
            var courses = raw
                .Where(c => !string.IsNullOrWhiteSpace(c.Code))
                .GroupBy(c => c.Code, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
            var dupCount = raw.Count - courses.Count;
            if (dupCount > 0) _log.LogWarning("[db] Courses seed contained {Dup} duplicates by Code; kept first occurrence", dupCount);
            _db.Courses.AddRange(courses);
            _log.LogInformation("[db] Seeded courses: {Count}", courses.Count);
        }
        if (!await _db.Faculty.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<Mais.Web.Models.FacultyModel>>("faculty.json") ?? new();
            var reserved = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var idPattern = new System.Text.RegularExpressions.Regex("^[a-z]{2}\\d{3}[a-z]{2}$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            var fac = raw
                .Select(f =>
                {
                    var email = (f.Email ?? string.Empty).Trim().ToLowerInvariant();
                    var given = (f.GivenName ?? string.Empty).Trim();
                    var family = (f.FamilyName ?? string.Empty).Trim();
                    var id = (f.Id ?? string.Empty).Trim().ToLowerInvariant();

                    if (string.IsNullOrWhiteSpace(id) || !idPattern.IsMatch(id) || reserved.Contains(id))
                    {
                        id = IdGenerator.GenerateEmployeeId(given, family, email, reserved);
                    }
                    else
                    {
                        reserved.Add(id);
                    }

                    var status = string.IsNullOrWhiteSpace(f.Status) ? "active" : f.Status.Trim().ToLowerInvariant();
                    var employment = string.IsNullOrWhiteSpace(f.EmploymentType) ? "full-time" : f.EmploymentType.Trim();
                    var hireDate = f.HireDate ?? DateTime.UtcNow.AddYears(-3).ToString("o");
                    var lastActivity = f.LastActivity ?? DateTime.UtcNow.ToString("o");

                    return new FacultyEntity
                    {
                        Id = id,
                        FullName = f.FullName ?? string.Empty,
                        GivenName = string.IsNullOrWhiteSpace(given) ? null : given,
                        FamilyName = string.IsNullOrWhiteSpace(family) ? null : family,
                        TitlesPrefixJson = (f.TitlesPrefix != null && f.TitlesPrefix.Count > 0) ? JsonSerializer.Serialize(f.TitlesPrefix) : null,
                        TitlesSuffixJson = (f.TitlesSuffix != null && f.TitlesSuffix.Count > 0) ? JsonSerializer.Serialize(f.TitlesSuffix) : null,
                        Email = email,
                        Faculty = f.Faculty ?? string.Empty,
                        Program = f.Program,
                        Phone = f.Phone,
                        Office = f.Office,
                        DepartmentsJson = JsonSerializer.Serialize(f.Departments ?? new List<string>()),
                        SubjectsJson = JsonSerializer.Serialize(f.Subjects ?? new List<string>()),
                        CertificationsJson = f.Certifications != null ? JsonSerializer.Serialize(f.Certifications) : null,
                        OfficeHoursJson = JsonSerializer.Serialize(f.OfficeHours ?? new Dictionary<string, object>()),
                        WorkingHoursJson = JsonSerializer.Serialize(f.WorkingHours ?? new Dictionary<string, object>()),
                        Status = status,
                        EmploymentType = employment,
                        ClassesCount = f.ClassesCount,
                        YearsExperience = f.YearsExperience,
                        HireDate = hireDate,
                        LastActivity = lastActivity,
                        About = string.IsNullOrWhiteSpace(f.About) ? null : f.About,
                        Bio = string.IsNullOrWhiteSpace(f.Bio) ? null : f.Bio,
                        ExpertiseJson = (f.Expertise != null && f.Expertise.Count > 0) ? JsonSerializer.Serialize(f.Expertise) : null,
                        PublicationsJson = f.Publications != null ? JsonSerializer.Serialize(f.Publications) : null,
                        ResearchInterestsJson = (f.ResearchInterests != null && f.ResearchInterests.Count > 0) ? JsonSerializer.Serialize(f.ResearchInterests) : null,
                        AcademicDegree = f.AcademicDegree,
                        LanguagesJson = f.Languages != null ? JsonSerializer.Serialize(f.Languages) : null,
                        SocialLinksJson = f.SocialLinks != null ? JsonSerializer.Serialize(f.SocialLinks) : null,
                        AvatarUrl = string.IsNullOrWhiteSpace(f.AvatarUrl) ? null : f.AvatarUrl,
                        Department = f.Department,
                        DepartmentCode = f.DepartmentCode,
                        IsActivated = true,
                        ActivationToken = null,
                        ActivationTokenExpiry = null
                    };
                })
                .ToList();

            _db.Faculty.AddRange(fac);
            _log.LogInformation("[db] Seeded faculty: {Count}", fac.Count);
        }
        if (!await _db.Students.AnyAsync(ct))
        {
            static bool LooksArchived(string? status)
            {
                if (string.IsNullOrWhiteSpace(status)) return false;
                var normalized = status.Trim().ToLowerInvariant();
                return normalized.Contains("archiv") ||
                       normalized.Contains("inactive") ||
                       normalized.Contains("graduated") ||
                       normalized.Contains("completed") ||
                       normalized.Contains("finished");
            }

            // Load available faculties and programs for validation
            var availableFaculties = await _db.FacultyOptions.AsNoTracking()
                .Select(f => f.Code)
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .ToListAsync(ct);
            var facultySet = new HashSet<string>(availableFaculties, StringComparer.OrdinalIgnoreCase);
            
            var availablePrograms = await _db.Programs.AsNoTracking()
                .Select(p => p.Name)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToListAsync(ct);
            var programSet = new HashSet<string>(availablePrograms, StringComparer.OrdinalIgnoreCase);
            
            var missingFaculties = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var missingPrograms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var raw = await ReadJsonAsync<List<StudentEntity>>("students.json") ?? new();
            var students = raw
                .Select(s =>
                {
                    s.Id = (s.Id ?? string.Empty).Trim();
                    s.Email = (s.Email ?? string.Empty).Trim();
                    s.PersonId = string.IsNullOrWhiteSpace(s.PersonId) ? s.Id : s.PersonId!.Trim();
                    s.IsArchived = s.IsArchived || LooksArchived(s.Status);
                    s.IsActivated = true;
                    s.ActivationToken = null;
                    s.ActivationTokenExpiry = null;
                    
                    // Validate Faculty reference - warn but don't reject
                    if (!string.IsNullOrWhiteSpace(s.Faculty) && facultySet.Count > 0 && !facultySet.Contains(s.Faculty))
                    {
                        missingFaculties.Add(s.Faculty);
                    }
                    
                    // Validate Program reference - warn but don't reject
                    if (!string.IsNullOrWhiteSpace(s.Program) && programSet.Count > 0 && !programSet.Contains(s.Program))
                    {
                        missingPrograms.Add(s.Program);
                    }
                    
                    return s;
                })
                .Where(s => !string.IsNullOrWhiteSpace(s.Id))
                .GroupBy(s => s.Id, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
                
            var dupStu = raw.Count - students.Count;
            if (dupStu > 0) _log.LogWarning("[db] Students seed contained {Dup} duplicates by Id; kept first occurrence", dupStu);
            
            // Log validation warnings
            if (missingFaculties.Any())
                _log.LogWarning("[db] Students reference non-existent faculties: {Faculties}. Consider adding them to facultyOptions.json", string.Join(", ", missingFaculties));
            if (missingPrograms.Any())
                _log.LogWarning("[db] Students reference non-existent programs: {Programs}. Consider adding them to programs.json", string.Join(", ", missingPrograms));
            
            _db.Students.AddRange(students);
            _log.LogInformation("[db] Seeded students: {Count}", students.Count);
        }
        if (!await _db.Rooms.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<RoomEntity>>("rooms.json") ?? new();
            var rooms = raw
                .Select(r => { r.Id = (r.Id ?? string.Empty).Trim(); return r; })
                .Where(r => !string.IsNullOrWhiteSpace(r.Id))
                .GroupBy(r => r.Id, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
            var dupRooms = raw.Count - rooms.Count;
            if (dupRooms > 0) _log.LogWarning("[db] Rooms seed contained {Dup} duplicates by Id; kept first occurrence", dupRooms);
            _db.Rooms.AddRange(rooms);
            _log.LogInformation("[db] Seeded rooms: {Count}", rooms.Count);
        }
        
        // Save rooms before equipment validation
        await _db.SaveChangesAsync(ct);
        
        if (!await _db.Equipment.AnyAsync(ct))
        {
            // Get available rooms for location validation
            var availableRooms = await _db.Rooms.AsNoTracking()
                .Select(r => r.Name)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToListAsync(ct);
            var roomSet = new HashSet<string>(availableRooms, StringComparer.OrdinalIgnoreCase);
            var missingLocations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            
            var raw = await ReadJsonAsync<List<EquipmentEntity>>("equipment.json") ?? new();
            var eq = raw
                .Select(e => { 
                    e.Id = (e.Id ?? string.Empty).Trim();
                    
                    // Validate location reference
                    if (!string.IsNullOrWhiteSpace(e.Location) && roomSet.Count > 0 && !roomSet.Contains(e.Location))
                    {
                        missingLocations.Add(e.Location);
                    }
                    
                    return e; 
                })
                .Where(e => !string.IsNullOrWhiteSpace(e.Id))
                .GroupBy(e => e.Id, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
            var dupEq = raw.Count - eq.Count;
            if (dupEq > 0) _log.LogWarning("[db] Equipment seed contained {Dup} duplicates by Id; kept first occurrence", dupEq);
            
            // Auto-create missing rooms if equipment references them
            if (missingLocations.Any())
            {
                _log.LogInformation("[db] Auto-creating {Count} missing rooms from equipment locations", missingLocations.Count);
                var newRooms = missingLocations.Select(roomName => new RoomEntity
                {
                    Id = $"room:{roomName.ToLowerInvariant().Replace(" ", "-").Replace("(", "").Replace(")", "")}",
                    Name = roomName,
                    Type = "Storage/Equipment Room",
                    Capacity = 10,
                    Active = true,
                    Building = ExtractBuilding(roomName),
                    Floor = ExtractFloor(roomName)
                }).ToList();
                
                _db.Rooms.AddRange(newRooms);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Auto-created rooms from equipment locations: {Rooms}", string.Join(", ", missingLocations));
            }
            
            _db.Equipment.AddRange(eq);
            _log.LogInformation("[db] Seeded equipment: {Count}", eq.Count);
        }
        
        // Save all changes before timetable validation so that courses and faculty are in the database
        await _db.SaveChangesAsync(ct);
        
        // Seed timetable entries from JSON file
        if (!await _db.Timetable.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<TimetableEntryEntity>>("timetable.json") ?? new();
            if (raw.Count > 0)
            {
                // Validate timetable entries against existing courses, teachers, and rooms
                var courseCodes = await _db.Courses.AsNoTracking()
                    .Select(c => c.Code.ToLower())
                    .ToListAsync(ct);
                var courseSet = new HashSet<string>(courseCodes, StringComparer.OrdinalIgnoreCase);

                var teacherEmails = await _db.Faculty.AsNoTracking()
                    .Select(f => f.Email.ToLower())
                    .ToListAsync(ct);
                var teacherSet = new HashSet<string>(teacherEmails, StringComparer.OrdinalIgnoreCase);
                
                // Also validate room references
                var roomNames = await _db.Rooms.AsNoTracking()
                    .Select(r => r.Name.ToLower())
                    .ToListAsync(ct);
                var roomSet = new HashSet<string>(roomNames, StringComparer.OrdinalIgnoreCase);

                // Track invalid entries for detailed logging
                var invalidCourses = new List<string>();
                var invalidTeachers = new List<string>();
                var invalidRooms = new List<string>();

                var validEntries = raw
                    .Where(t => !string.IsNullOrWhiteSpace(t.Id))
                    .Where(t =>
                    {
                        var courseValid = courseSet.Contains((t.CourseCode ?? "").ToLowerInvariant());
                        if (!courseValid && !string.IsNullOrWhiteSpace(t.CourseCode))
                            invalidCourses.Add(t.CourseCode);
                        return courseValid;
                    })
                    .Where(t =>
                    {
                        var teacherValid = teacherSet.Contains((t.TeacherEmail ?? "").ToLowerInvariant());
                        if (!teacherValid && !string.IsNullOrWhiteSpace(t.TeacherEmail))
                            invalidTeachers.Add(t.TeacherEmail);
                        return teacherValid;
                    })
                    .Select(t =>
                    {
                        t.Id = t.Id.Trim();
                        t.ClassGroupKeysJson ??= "[]";
                        // Warn if room doesn't exist but don't reject (room might be created dynamically)
                        if (!string.IsNullOrWhiteSpace(t.Room) && !roomSet.Contains(t.Room.ToLowerInvariant()))
                        {
                            invalidRooms.Add(t.Room);
                        }
                        return t;
                    })
                    .GroupBy(t => t.Id, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .ToList();

                var invalidCount = raw.Count - validEntries.Count;
                if (invalidCount > 0)
                {
                    _log.LogWarning("[db] Timetable seed: {Invalid} entries skipped (missing course/teacher reference or duplicate)", invalidCount);
                    if (invalidCourses.Any())
                        _log.LogWarning("[db] Missing courses: {Courses}", string.Join(", ", invalidCourses.Distinct()));
                    if (invalidTeachers.Any())
                        _log.LogWarning("[db] Missing teachers: {Teachers}", string.Join(", ", invalidTeachers.Distinct()));
                }
                
                // Auto-create missing rooms from timetable entries
                if (invalidRooms.Any())
                {
                    var distinctMissingRooms = invalidRooms.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                    _log.LogInformation("[db] Auto-creating {Count} missing rooms from timetable entries", distinctMissingRooms.Count);
                    
                    var newRooms = distinctMissingRooms.Select(roomName => new RoomEntity
                    {
                        Id = $"room:{roomName.ToLowerInvariant().Replace(" ", "-")}",
                        Name = roomName,
                        Type = roomName.Contains("Lab") || roomName.Contains("LAB") ? "Computer Lab" : "Classroom",
                        Capacity = 30,
                        Active = true,
                        Building = ExtractBuilding(roomName),
                        Floor = ExtractFloor(roomName)
                    }).ToList();
                    
                    _db.Rooms.AddRange(newRooms);
                    await _db.SaveChangesAsync(ct);
                    _log.LogInformation("[db] Auto-created rooms: {Rooms}", string.Join(", ", distinctMissingRooms));
                }

                if (validEntries.Count > 0)
                {
                    _db.Timetable.AddRange(validEntries);
                    _log.LogInformation("[db] Seeded timetable entries from file: {Count}", validEntries.Count);
                }
            }
            else
            {
                _log.LogInformation("[db] Timetable seed skipped: timetable.json is empty or missing");
            }
        }

        // Inherit Faculty/Program from teachers to courses that don't have them
        if (await _db.Timetable.AnyAsync(ct))
        {
            // Inherit Faculty/Program from teachers to courses that don't have them
            var coursesNeedingUpdate = await _db.Courses
                .Where(c => string.IsNullOrWhiteSpace(c.Faculty) || string.IsNullOrWhiteSpace(c.Program))
                .ToListAsync(ct);

            if (coursesNeedingUpdate.Any())
            {
                var timetableEntries = await _db.Timetable.AsNoTracking()
                    .Where(t => !string.IsNullOrWhiteSpace(t.CourseCode) && !string.IsNullOrWhiteSpace(t.TeacherEmail))
                    .GroupBy(t => t.CourseCode)
                    .Select(g => new { CourseCode = g.Key, TeacherEmail = g.First().TeacherEmail })
                    .ToListAsync(ct);

                var teachersByEmail = await _db.Faculty.AsNoTracking()
                    .Where(f => !string.IsNullOrWhiteSpace(f.Faculty))
                    .ToDictionaryAsync(f => f.Email.ToLowerInvariant(), f => f, ct);

                int updatedCount = 0;
                foreach (var course in coursesNeedingUpdate)
                {
                    var timetableEntry = timetableEntries.FirstOrDefault(t =>
                        string.Equals(t.CourseCode, course.Code, StringComparison.OrdinalIgnoreCase));

                    if (timetableEntry != null && teachersByEmail.TryGetValue(timetableEntry.TeacherEmail.ToLowerInvariant(), out var teacher))
                    {
                        bool updated = false;
                        if (string.IsNullOrWhiteSpace(course.Faculty) && !string.IsNullOrWhiteSpace(teacher.Faculty))
                        {
                            course.Faculty = teacher.Faculty;
                            updated = true;
                        }
                        if (string.IsNullOrWhiteSpace(course.Program) && !string.IsNullOrWhiteSpace(teacher.Program))
                        {
                            course.Program = teacher.Program;
                            updated = true;
                        }
                        if (updated) updatedCount++;
                    }
                }

                if (updatedCount > 0)
                {
                    await _db.SaveChangesAsync(ct);
                    _log.LogInformation("[db] Inherited Faculty/Program from teachers to {Count} courses", updatedCount);
                }
            }
        }

        // Seed Activities
        if (!await _db.Activities.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ActivityEntity>>("activities.json") ?? new();
            var activities = raw
                .Select(a =>
                {
                    a.Id = (a.Id ?? string.Empty).Trim();
                    a.CreatedAt ??= a.Timestamp;
                    a.UpdatedAt ??= a.Timestamp;
                    return a;
                })
                .Where(a => !string.IsNullOrWhiteSpace(a.Id))
                .ToList();
            
            // If no activities in JSON, auto-generate sample activities from real data
            if (activities.Count == 0)
            {
                var now = DateTime.UtcNow;
                var sampleActivities = new List<ActivityEntity>();
                
                // Get data for generating activities
                var students = await _db.Students.AsNoTracking()
                    .Where(s => !s.IsArchived && s.IsActivated)
                    .Take(5)
                    .ToListAsync(ct);
                var teachers = await _db.Faculty.AsNoTracking()
                    .Take(3)
                    .ToListAsync(ct);
                var courses = await _db.Courses.AsNoTracking()
                    .Take(5)
                    .ToListAsync(ct);
                var timetable = await _db.Timetable.AsNoTracking()
                    .Take(3)
                    .ToListAsync(ct);
                
                if (students.Any() && teachers.Any() && courses.Any())
                {
                    var teacher = teachers.First();
                    var course = courses.First();
                    
                    // Welcome activity
                    sampleActivities.Add(new ActivityEntity
                    {
                        Id = $"act-welcome-{Guid.NewGuid().ToString("N")[..8]}",
                        Type = "announcement",
                        Title = "Welcome to the new semester!",
                        Description = "The new semester has started. Check your schedule and course materials.",
                        TeacherEmail = teacher.Email,
                        TeacherDisplay = teacher.FullName,
                        CourseCode = course.Code,
                        Subject = course.NameEn ?? course.NameSk,
                        Timestamp = now.AddDays(-1).ToString("o"),
                        CreatedAt = now.AddDays(-1).ToString("o"),
                        UpdatedAt = now.AddDays(-1).ToString("o"),
                        RequiresAction = false,
                        IsArchived = false,
                        Priority = "medium"
                    });
                    
                    // Schedule update activity
                    if (timetable.Any())
                    {
                        var entry = timetable.First();
                        sampleActivities.Add(new ActivityEntity
                        {
                            Id = $"act-schedule-{Guid.NewGuid().ToString("N")[..8]}",
                            Type = "schedule_update",
                            Title = "Schedule updated",
                            Description = $"Class on {entry.Day} at {entry.Slot} has been updated.",
                            TeacherEmail = entry.TeacherEmail,
                            TeacherDisplay = teachers.FirstOrDefault(t => t.Email == entry.TeacherEmail)?.FullName ?? entry.TeacherEmail,
                            CourseCode = entry.CourseCode,
                            Room = entry.Room,
                            Timestamp = now.AddHours(-5).ToString("o"),
                            CreatedAt = now.AddHours(-5).ToString("o"),
                            UpdatedAt = now.AddHours(-5).ToString("o"),
                            RequiresAction = false,
                            IsArchived = false,
                            Priority = "low"
                        });
                    }
                    
                    // Grade posted activity
                    if (students.Any())
                    {
                        var student = students.First();
                        sampleActivities.Add(new ActivityEntity
                        {
                            Id = $"act-grade-{Guid.NewGuid().ToString("N")[..8]}",
                            Type = "grade_posted",
                            Title = "New grade available",
                            Description = $"A new grade has been posted for {course.NameEn ?? course.NameSk}.",
                            TeacherEmail = teacher.Email,
                            TeacherDisplay = teacher.FullName,
                            StudentEmail = student.Email,
                            StudentName = student.FullName,
                            CourseCode = course.Code,
                            Subject = course.NameEn ?? course.NameSk,
                            Timestamp = now.AddHours(-2).ToString("o"),
                            CreatedAt = now.AddHours(-2).ToString("o"),
                            UpdatedAt = now.AddHours(-2).ToString("o"),
                            RequiresAction = false,
                            IsArchived = false,
                            Priority = "high"
                        });
                    }
                }
                
                if (sampleActivities.Any())
                {
                    activities = sampleActivities;
                    _log.LogInformation("[db] Auto-generated sample activities based on existing data: {Count}", activities.Count);
                }
            }
            
            _db.Activities.AddRange(activities);
            _log.LogInformation("[db] Seeded activities: {Count}", activities.Count);
        }
        
        await _db.SaveChangesAsync(ct);
        // Ensure auth table exists (since we don't run migrations in dev, add lightweight DDL)
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""UserCredentials"" (
                ""Email"" character varying(200) NOT NULL,
                ""Role"" character varying(32) NOT NULL,
                ""PasswordHash"" character varying(500) NOT NULL,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""LastLoginAt"" timestamp without time zone NULL,
                CONSTRAINT ""PK_UserCredentials"" PRIMARY KEY (""Email"")
            );", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[auth] Failed to ensure UserCredentials table (continuing)");
        }

        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""UserCredentials"" ADD COLUMN IF NOT EXISTS ""LastLoginAt"" timestamp without time zone NULL;", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[auth] Failed to ensure LastLoginAt column (continuing)");
        }

        // Ensure Enrollments table exists (dev-friendly schema bootstrap)
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""Enrollments"" (
                ""Id"" character varying(100) NOT NULL,
                ""StudentId"" character varying(100) NOT NULL,
                ""CourseCode"" character varying(32) NOT NULL,
                ""ScheduleEventId"" character varying(100) NULL,
                ""Status"" character varying(32) NOT NULL,
                ""AcademicYear"" character varying(20) NULL,
                ""Semester"" character varying(10) NULL,
                ""ConfirmedAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_Enrollments"" PRIMARY KEY (""Id"")
            );", ct);
            // Helpful index for lookups by student
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Enrollments_StudentId"" ON ""Enrollments"" (""StudentId"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[enrollments] Failed to ensure Enrollments table (continuing)");
        }
        
        // Seed Enrollments
        if (!await _db.Enrollments.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<EnrollmentSeedModel>>("enrollments.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var enrollments = raw.Select(item =>
                {
                    DateTime enrolledAt = nowUnspecified;
                    if (!string.IsNullOrWhiteSpace(item.EnrolledAt) && DateTime.TryParse(item.EnrolledAt, out var parsed))
                        enrolledAt = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
                    
                    return new StudentEnrollmentEntity
                    {
                        Id = item.Id ?? $"enr-{Guid.NewGuid().ToString("N")[..12]}",
                        StudentId = item.StudentId ?? string.Empty,
                        CourseCode = item.CourseCode ?? string.Empty,
                        ScheduleEventId = item.ScheduleEventId,
                        Status = item.Status ?? "confirmed",
                        AcademicYear = item.AcademicYear,
                        Semester = item.Semester,
                        ConfirmedAt = enrolledAt
                    };
                }).ToList();
                
                _db.Enrollments.AddRange(enrollments);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded enrollments: {Count}", enrollments.Count);
            }
        }

        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""UserPreferences"" (
                    ""UserEmail"" character varying(200) NOT NULL,
                    ""PreferenceKey"" character varying(100) NOT NULL,
                    ""JsonValue"" text NOT NULL,
                    ""UpdatedAt"" timestamp without time zone NOT NULL,
                    CONSTRAINT ""PK_UserPreferences"" PRIMARY KEY (""UserEmail"", ""PreferenceKey"")
                );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_UserPreferences_User"" ON ""UserPreferences"" (""UserEmail"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[prefs] Failed to ensure UserPreferences table (continuing)");
        }

        // Ensure new columns exist on Timetable (dev-friendly schema evolution without full migrations)
        try
        {
            // EF created table name is "Timetable" (see queries in logs)
            await _db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE IF EXISTS ""Timetable""
                ADD COLUMN IF NOT EXISTS ""Capacity"" integer NULL;
            ", ct);
            await _db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE IF EXISTS ""Timetable""
                ADD COLUMN IF NOT EXISTS ""ClassGroupKeysJson"" character varying(500) NULL;
            ", ct);
            await _db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE IF EXISTS ""Timetable""
                ADD COLUMN IF NOT EXISTS ""Type"" character varying(16) NULL;
            ", ct);
            _log.LogInformation("[db] Ensured Timetable columns Capacity, ClassGroupKeysJson, Type");
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[db] Failed to ensure Timetable extra columns (continuing)");
        }

        // Ensure Final Thesis tables (topics, requests, supervisions)
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ThesisTopics"" (
                ""Id"" character varying(100) NOT NULL,
                ""Type"" character varying(32) NOT NULL,
                ""Title"" character varying(400) NOT NULL,
                ""Program"" character varying(40) NULL,
                ""ProgramLabel"" character varying(120) NULL,
                ""Faculty"" character varying(40) NULL,
                ""Department"" character varying(60) NULL,
                ""KeywordsJson"" text NULL,
                ""Description"" text NULL,
                ""SupervisorEmail"" character varying(200) NOT NULL,
                ""SupervisorName"" character varying(200) NULL,
                ""Capacity"" integer NULL,
                ""State"" character varying(20) NOT NULL,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_ThesisTopics"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ThesisTopics_SupervisorEmail"" ON ""ThesisTopics"" (""SupervisorEmail"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ThesisRequests"" (
                ""Id"" character varying(100) NOT NULL,
                ""AcademicYear"" character varying(20) NOT NULL,
                ""Degree"" character varying(8) NOT NULL,
                ""StudyForm"" character varying(20) NOT NULL,
                ""Program"" character varying(120) NOT NULL,
                ""ProgramCode"" character varying(40) NULL,
                ""Language"" character varying(8) NOT NULL,
                ""SupervisorEmail"" character varying(200) NULL,
                ""Topic"" character varying(400) NULL,
                ""Keywords"" character varying(400) NULL,
                ""Note"" text NULL,
                ""Status"" character varying(16) NOT NULL,
                ""SubmittedAt"" timestamp without time zone NULL,
                ""UpdatedAt"" timestamp without time zone NOT NULL,
                ""StudentId"" character varying(100) NULL,
                ""StudentEmail"" character varying(200) NOT NULL,
                ""StudentName"" character varying(200) NULL,
                CONSTRAINT ""PK_ThesisRequests"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ThesisRequests_StudentEmail"" ON ""ThesisRequests"" (""StudentEmail"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ThesisRequests_SupervisorEmail"" ON ""ThesisRequests"" (""SupervisorEmail"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ThesisSupervisions"" (
                ""Id"" character varying(100) NOT NULL,
                ""TopicId"" character varying(100) NULL,
                ""Type"" character varying(32) NOT NULL,
                ""Title"" character varying(400) NOT NULL,
                ""StudentId"" character varying(100) NULL,
                ""StudentEmail"" character varying(200) NOT NULL,
                ""StudentName"" character varying(200) NULL,
                ""SupervisorEmail"" character varying(200) NOT NULL,
                ""SupervisorName"" character varying(200) NULL,
                ""Program"" character varying(120) NULL,
                ""Degree"" character varying(8) NULL,
                ""AcademicYear"" character varying(20) NOT NULL,
                ""AssignedAt"" timestamp without time zone NOT NULL,
                ""DueAt"" timestamp without time zone NULL,
                ""Status"" character varying(16) NOT NULL,
                ""AttachmentsJson"" text NULL,
                ""KeywordsJson"" text NULL,
                ""Abstract"" text NULL,
                ""Annotation"" text NULL,
                ""OriginalityCheckedAt"" timestamp without time zone NULL,
                ""OriginalityPercentage"" double precision NULL,
                ""OriginalityProtocolUrl"" text NULL,
                ""DefenseDate"" character varying(64) NULL,
                ""DefenseRoom"" character varying(100) NULL,
                ""GradesJson"" text NULL,
                CONSTRAINT ""PK_ThesisSupervisions"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ThesisSupervisions_StudentEmail"" ON ""ThesisSupervisions"" (""StudentEmail"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ThesisSupervisions_SupervisorEmail"" ON ""ThesisSupervisions"" (""SupervisorEmail"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[thesis] Failed to ensure Final Thesis tables (continuing)");
        }

        // Ensure Exam Terms tables
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ExamTerms"" (
                ""Id"" character varying(100) NOT NULL,
                ""CourseCode"" character varying(32) NOT NULL,
                ""CourseName"" character varying(300) NOT NULL,
                ""Credits"" integer NULL,
                ""StartAt"" timestamp without time zone NOT NULL,
                ""EndAt"" timestamp without time zone NOT NULL,
                ""Building"" character varying(60) NULL,
                ""Room"" character varying(100) NULL,
                ""Examiner"" character varying(200) NULL,
                ""Capacity"" integer NOT NULL,
                ""CreatedBy"" character varying(200) NOT NULL,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_ExamTerms"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ExamTerms_CourseCode"" ON ""ExamTerms"" (""CourseCode"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ExamTerms_CreatedBy"" ON ""ExamTerms"" (""CreatedBy"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ExamRegistrations"" (
                ""Id"" character varying(100) NOT NULL,
                ""TermId"" character varying(100) NOT NULL,
                ""StudentId"" character varying(100) NULL,
                ""StudentEmail"" character varying(200) NOT NULL,
                ""RegisteredAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_ExamRegistrations"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ExamRegistrations_TermId"" ON ""ExamRegistrations"" (""TermId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ExamRegistrations_StudentEmail"" ON ""ExamRegistrations"" (""StudentEmail"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[exams] Failed to ensure Exam Terms tables (continuing)");
        }

        // Ensure Course Grades table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""CourseGrades"" (
                ""Id"" character varying(100) NOT NULL,
                ""StudentId"" character varying(100) NOT NULL,
                ""CourseCode"" character varying(32) NOT NULL,
                ""TeacherEmail"" character varying(200) NOT NULL,
                ""AssessmentType"" character varying(8) NOT NULL,
                ""ContinuousPercent"" integer NULL,
                ""FinalPercent"" integer NULL,
                ""TotalPercent"" integer NOT NULL,
                ""LetterGrade"" character varying(2) NOT NULL,
                ""AwardedAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_CourseGrades"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_CourseGrades_StudentId"" ON ""CourseGrades"" (""StudentId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_CourseGrades_CourseCode"" ON ""CourseGrades"" (""CourseCode"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_CourseGrades_TeacherEmail"" ON ""CourseGrades"" (""TeacherEmail"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[grades] Failed to ensure CourseGrades table (continuing)");
        }
        
        // Seed Course Grades
        if (!await _db.CourseGrades.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<GradeSeedModel>>("grades.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var grades = raw.Select(item =>
                {
                    DateTime awardedAt = nowUnspecified;
                    if (!string.IsNullOrWhiteSpace(item.AwardedAt) && DateTime.TryParse(item.AwardedAt, out var parsed))
                        awardedAt = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
                    
                    return new StudentCourseGradeEntity
                    {
                        Id = item.Id ?? $"grade-{Guid.NewGuid().ToString("N")[..12]}",
                        StudentId = item.StudentId ?? string.Empty,
                        CourseCode = item.CourseCode ?? string.Empty,
                        TeacherEmail = item.TeacherEmail ?? string.Empty,
                        AssessmentType = item.AssessmentType ?? "ZS",
                        ContinuousPercent = item.ContinuousPercent,
                        FinalPercent = item.FinalPercent,
                        TotalPercent = item.TotalPercent,
                        LetterGrade = item.LetterGrade ?? "F",
                        AwardedAt = awardedAt
                    };
                }).ToList();
                
                _db.CourseGrades.AddRange(grades);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded course grades: {Count}", grades.Count);
            }
        }

        // Seed Exam Terms
        if (!await _db.ExamTerms.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ExamTermSeedModel>>("examTerms.json") ?? new();
            if (raw.Count > 0)
            {
                var terms = raw.Select(item => {
                    DateTime startAt = DateTime.UtcNow.AddDays(30);
                    DateTime endAt = DateTime.UtcNow.AddDays(30).AddHours(3);
                    DateTime createdAt = DateTime.UtcNow;
                    if (!string.IsNullOrWhiteSpace(item.StartAt) && DateTime.TryParse(item.StartAt, out var ps))
                        startAt = DateTime.SpecifyKind(ps, DateTimeKind.Unspecified);
                    if (!string.IsNullOrWhiteSpace(item.EndAt) && DateTime.TryParse(item.EndAt, out var pe))
                        endAt = DateTime.SpecifyKind(pe, DateTimeKind.Unspecified);
                    if (!string.IsNullOrWhiteSpace(item.CreatedAt) && DateTime.TryParse(item.CreatedAt, out var pc))
                        createdAt = DateTime.SpecifyKind(pc, DateTimeKind.Unspecified);
                    
                    return new ExamTermEntity
                    {
                        Id = item.Id ?? Guid.NewGuid().ToString("N"),
                        CourseCode = item.CourseCode ?? string.Empty,
                        CourseName = item.CourseName ?? string.Empty,
                        Credits = item.Credits,
                        StartAt = startAt,
                        EndAt = endAt,
                        Building = item.Building,
                        Room = item.Room,
                        Examiner = item.Examiner,
                        Capacity = item.Capacity > 0 ? item.Capacity : 30,
                        CreatedBy = item.CreatedBy ?? string.Empty,
                        CreatedAt = createdAt,
                        UpdatedAt = createdAt
                    };
                }).ToList();
                
                _db.ExamTerms.AddRange(terms);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded exam terms: {Count}", terms.Count);
            }
        }

        // Seed Exam Registrations
        if (!await _db.ExamRegistrations.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ExamRegistrationSeedModel>>("examRegistrations.json") ?? new();
            if (raw.Count > 0)
            {
                var regs = raw.Select(item => {
                    DateTime registeredAt = DateTime.UtcNow;
                    if (!string.IsNullOrWhiteSpace(item.RegisteredAt) && DateTime.TryParse(item.RegisteredAt, out var pr))
                        registeredAt = DateTime.SpecifyKind(pr, DateTimeKind.Unspecified);
                    
                    return new ExamRegistrationEntity
                    {
                        Id = item.Id ?? Guid.NewGuid().ToString("N"),
                        TermId = item.TermId ?? string.Empty,
                        StudentId = item.StudentId,
                        StudentEmail = item.StudentEmail ?? string.Empty,
                        RegisteredAt = registeredAt
                    };
                }).ToList();
                
                _db.ExamRegistrations.AddRange(regs);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded exam registrations: {Count}", regs.Count);
            }
        }

        // Seed Thesis Topics
        if (!await _db.ThesisTopics.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ThesisTopicSeedModel>>("thesisTopics.json") ?? new();
            if (raw.Count > 0)
            {
                var topics = raw.Select(item => {
                    DateTime createdAt = DateTime.UtcNow;
                    if (!string.IsNullOrWhiteSpace(item.CreatedAt) && DateTime.TryParse(item.CreatedAt, out var pc))
                        createdAt = DateTime.SpecifyKind(pc, DateTimeKind.Unspecified);
                    
                    return new ThesisTopicEntity
                    {
                        Id = item.Id ?? Guid.NewGuid().ToString("N"),
                        Type = item.Type ?? "Master thesis",
                        Title = item.Title ?? string.Empty,
                        Program = item.Program,
                        ProgramLabel = item.ProgramLabel,
                        Faculty = item.Faculty,
                        Department = item.Department,
                        KeywordsJson = item.KeywordsJson,
                        Description = item.Description,
                        SupervisorEmail = item.SupervisorEmail ?? string.Empty,
                        SupervisorName = item.SupervisorName,
                        Capacity = item.Capacity ?? 1,
                        State = item.State ?? "open",
                        CreatedAt = createdAt,
                        UpdatedAt = createdAt
                    };
                }).ToList();
                
                _db.ThesisTopics.AddRange(topics);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded thesis topics: {Count}", topics.Count);
            }
        }

        // Ensure Course Grading Schemes table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""CourseGradingSchemes"" (
                ""CourseCode"" character varying(32) NOT NULL,
                ""MaxContinuousPoints"" integer NOT NULL,
                ""MaxFinalPoints"" integer NOT NULL,
                ""UpdatedAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_CourseGradingSchemes"" PRIMARY KEY (""CourseCode"")
            );", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[grades] Failed to ensure CourseGradingSchemes table (continuing)");
        }

        // Ensure Assignments and AssignmentGrades tables
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""Assignments"" (
                ""Id"" character varying(100) NOT NULL,
                ""ClassId"" character varying(100) NOT NULL,
                ""CourseCode"" character varying(32) NOT NULL,
                ""TeacherEmail"" character varying(200) NOT NULL,
                ""Name"" character varying(200) NOT NULL,
                ""Category"" character varying(20) NOT NULL,
                ""TotalPoints"" integer NOT NULL,
                ""DueDate"" character varying(16) NULL,
                ""Description"" text NULL,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_Assignments"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Assignments_TeacherCourse"" ON ""Assignments"" (""TeacherEmail"", ""CourseCode"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""AssignmentGrades"" (
                ""Id"" character varying(100) NOT NULL,
                ""StudentId"" character varying(100) NOT NULL,
                ""AssignmentId"" character varying(100) NOT NULL,
                ""Points"" integer NOT NULL,
                ""LastUpdated"" timestamp without time zone NOT NULL,
                CONSTRAINT ""PK_AssignmentGrades"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AssignmentGrades_AssignmentId"" ON ""AssignmentGrades"" (""AssignmentId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_AssignmentGrades_StudentId"" ON ""AssignmentGrades"" (""StudentId"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[gradebook] Failed to ensure Assignments/AssignmentGrades tables (continuing)");
        }

        // Seed Assignments
        if (!await _db.Assignments.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<AssignmentSeedModel>>("assignments.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var assignments = raw.Select(item => new AssignmentEntity
                {
                    Id = item.Id ?? $"asgn-{Guid.NewGuid().ToString("N")[..8]}",
                    ClassId = item.ClassId ?? string.Empty,
                    CourseCode = item.CourseCode ?? string.Empty,
                    TeacherEmail = item.TeacherEmail ?? string.Empty,
                    Name = item.Name ?? string.Empty,
                    Category = item.Category ?? "continuous",
                    TotalPoints = item.TotalPoints,
                    DueDate = item.DueDate ?? string.Empty,
                    Description = item.Description,
                    CreatedAt = now,
                    UpdatedAt = now
                }).ToList();
                
                _db.Assignments.AddRange(assignments);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded assignments: {Count}", assignments.Count);
            }
        }

        // Seed Assignment Grades
        if (!await _db.AssignmentGrades.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<AssignmentGradeSeedModel>>("assignmentGrades.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var grades = raw.Select(item => new StudentAssignmentGradeEntity
                {
                    Id = item.Id ?? $"ag-{Guid.NewGuid().ToString("N")[..8]}",
                    StudentId = item.StudentId ?? string.Empty,
                    AssignmentId = item.AssignmentId ?? string.Empty,
                    Points = item.Points,
                    LastUpdated = now
                }).ToList();
                
                _db.AssignmentGrades.AddRange(grades);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded assignment grades: {Count}", grades.Count);
            }
        }

        // Ensure ClassGroups table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ClassGroups"" (
                ""Id"" character varying(100) NOT NULL,
                ""Name"" character varying(200) NOT NULL,
                ""Faculty"" character varying(100) NOT NULL,
                ""Program"" character varying(200) NOT NULL,
                ""Type"" character varying(20) NULL,
                ""Capacity"" integer NOT NULL DEFAULT 30,
                ""StudentCount"" integer NOT NULL DEFAULT 0,
                ""TeacherEmail"" character varying(200) NULL,
                ""Description"" text NULL,
                ""CreatedAt"" character varying(64) NULL,
                ""UpdatedAt"" character varying(64) NULL,
                ""IsActive"" boolean NOT NULL DEFAULT true,
                CONSTRAINT ""PK_ClassGroups"" PRIMARY KEY (""Id"")
            );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ClassGroups_Faculty"" ON ""ClassGroups"" (""Faculty"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ClassGroups_Program"" ON ""ClassGroups"" (""Program"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ClassGroups_TeacherEmail"" ON ""ClassGroups"" (""TeacherEmail"");", ct);
        }
        catch (Exception cgEx)
        {
            _log.LogWarning(cgEx, "[class-groups] Failed to ensure ClassGroups table (continuing)");
        }
        
        // Seed Class Groups
        if (!await _db.ClassGroups.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ClassGroupSeedModel>>("classgroups.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowStr = now.ToString("o");
                
                var groups = raw.Select(item => new ClassGroupEntity
                {
                    Id = item.Id ?? $"grp-{Guid.NewGuid().ToString("N")[..8]}",
                    Name = item.Name ?? string.Empty,
                    Faculty = item.Faculty ?? string.Empty,
                    Program = item.Program ?? string.Empty,
                    Capacity = item.Capacity > 0 ? item.Capacity : 30,
                    StudentCount = item.StudentCount,
                    TeacherEmail = item.TeacherEmail,
                    Description = item.Description,
                    CreatedAt = nowStr,
                    UpdatedAt = nowStr,
                    IsActive = item.IsActive
                }).ToList();
                
                _db.ClassGroups.AddRange(groups);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded class groups: {Count}", groups.Count);
            }
        }

        // Ensure Chat tables
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ChatThreads"" (
                    ""Id"" character varying(40) NOT NULL,
                    ""OwnerEmail"" character varying(200) NOT NULL,
                    ""Title"" character varying(200) NULL,
                    ""CreatedAt"" timestamp without time zone NOT NULL,
                    ""UpdatedAt"" timestamp without time zone NOT NULL,
                    ""LastMessageAt"" timestamp without time zone NULL,
                    ""LastMessagePreview"" character varying(400) NULL,
                    ""AiEnabled"" boolean NOT NULL DEFAULT false,
                    ""AiConfigJson"" text NULL,
                    CONSTRAINT ""PK_ChatThreads"" PRIMARY KEY (""Id"")
                );", ct);

            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ChatParticipants"" (
                    ""Id"" character varying(50) NOT NULL,
                    ""ThreadId"" character varying(40) NOT NULL,
                    ""Kind"" character varying(16) NOT NULL,
                    ""Email"" character varying(200) NULL,
                    ""DisplayName"" character varying(200) NOT NULL,
                    ""JoinedAt"" timestamp without time zone NOT NULL,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    CONSTRAINT ""PK_ChatParticipants"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ChatParticipants_ChatThreads_ThreadId"" FOREIGN KEY (""ThreadId"") REFERENCES ""ChatThreads"" (""Id"") ON DELETE CASCADE
                );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ChatParticipants_ThreadEmail"" ON ""ChatParticipants"" (""ThreadId"", ""Email"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ChatUserStates"" (
                    ""Id"" character varying(60) NOT NULL,
                    ""ThreadId"" character varying(40) NOT NULL,
                    ""UserEmail"" character varying(200) NOT NULL,
                    ""LastReadAt"" timestamp without time zone NULL,
                    ""PinnedAt"" timestamp without time zone NULL,
                    CONSTRAINT ""PK_ChatUserStates"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ChatUserStates_ChatThreads_ThreadId"" FOREIGN KEY (""ThreadId"") REFERENCES ""ChatThreads"" (""Id"") ON DELETE CASCADE
                );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ChatUserStates_ThreadUser"" ON ""ChatUserStates"" (""ThreadId"", ""UserEmail"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ChatMessages"" (
                    ""Id"" character varying(60) NOT NULL,
                    ""ThreadId"" character varying(40) NOT NULL,
                    ""AuthorEmail"" character varying(200) NULL,
                    ""AuthorRole"" character varying(16) NOT NULL,
                    ""AuthorDisplayName"" character varying(200) NOT NULL,
                    ""Body"" text NOT NULL,
                    ""Announcement"" boolean NOT NULL DEFAULT false,
                    ""ReplyToId"" character varying(60) NULL,
                    ""ClientId"" character varying(60) NULL,
                    ""TargetAi"" boolean NOT NULL DEFAULT false,
                    ""CreatedAt"" timestamp without time zone NOT NULL,
                    ""UpdatedAt"" timestamp without time zone NULL,
                    ""DeletedAt"" timestamp without time zone NULL,
                    CONSTRAINT ""PK_ChatMessages"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ChatMessages_ChatThreads_ThreadId"" FOREIGN KEY (""ThreadId"") REFERENCES ""ChatThreads"" (""Id"") ON DELETE CASCADE
                );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ChatMessages_ThreadCreatedAt"" ON ""ChatMessages"" (""ThreadId"", ""CreatedAt"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ChatAttachments"" (
                    ""Id"" character varying(60) NOT NULL,
                    ""MessageId"" character varying(60) NOT NULL,
                    ""FileName"" character varying(200) NOT NULL,
                    ""ContentType"" character varying(120) NULL,
                    ""Size"" bigint NOT NULL DEFAULT 0,
                    ""StoragePath"" character varying(500) NULL,
                    ""DownloadUrl"" character varying(500) NULL,
                    CONSTRAINT ""PK_ChatAttachments"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ChatAttachments_ChatMessages_MessageId"" FOREIGN KEY (""MessageId"") REFERENCES ""ChatMessages"" (""Id"") ON DELETE CASCADE
                );", ct);

            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""ChatReactions"" (
                    ""Id"" character varying(70) NOT NULL,
                    ""MessageId"" character varying(60) NOT NULL,
                    ""Emoji"" character varying(32) NOT NULL,
                    ""UserEmail"" character varying(200) NOT NULL,
                    ""CreatedAt"" timestamp without time zone NOT NULL,
                    CONSTRAINT ""PK_ChatReactions"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ChatReactions_ChatMessages_MessageId"" FOREIGN KEY (""MessageId"") REFERENCES ""ChatMessages"" (""Id"") ON DELETE CASCADE
                );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ChatReactions_MessageEmojiUser"" ON ""ChatReactions"" (""MessageId"", ""Emoji"", ""UserEmail"");", ct);
        }
        catch (Exception ddlEx)
        {
            _log.LogWarning(ddlEx, "[chat] Failed to ensure chat tables (continuing)");
        }

        // Ensure Surveys tables
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""Surveys"" (
                    ""Id"" character varying(100) NOT NULL,
                    ""Title"" character varying(500) NOT NULL,
                    ""Category"" character varying(50) NOT NULL,
                    ""IsAnonymous"" boolean NOT NULL DEFAULT false,
                    ""OpenAt"" character varying(64) NULL,
                    ""CloseAt"" character varying(64) NULL,
                    ""MetaJson"" jsonb NULL,
                    ""QuestionsJson"" jsonb NOT NULL,
                    ""Published"" boolean NOT NULL DEFAULT false,
                    ""OwnerId"" character varying(100) NULL,
                    ""TargetAudience"" character varying(50) NULL,
                    ""TargetFaculty"" character varying(50) NULL,
                    ""TargetProgram"" character varying(50) NULL,
                    ""CreatedAt"" timestamp without time zone NOT NULL,
                    ""UpdatedAt"" timestamp without time zone NOT NULL,
                    CONSTRAINT ""PK_Surveys"" PRIMARY KEY (""Id"")
                );", ct);
            
            // Add new columns for targeted surveys
            await _db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Surveys"" ADD COLUMN IF NOT EXISTS ""TargetStudentsJson"" jsonb NULL;", ct);
            await _db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Surveys"" ADD COLUMN IF NOT EXISTS ""TargetGroupId"" character varying(100) NULL;", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Surveys_Category"" ON ""Surveys"" (""Category"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Surveys_OwnerId"" ON ""Surveys"" (""OwnerId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Surveys_Published"" ON ""Surveys"" (""Published"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Surveys_OpenAt"" ON ""Surveys"" (""OpenAt"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Surveys_CloseAt"" ON ""Surveys"" (""CloseAt"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_Surveys_TargetGroupId"" ON ""Surveys"" (""TargetGroupId"");", ct);

            await _db.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""SurveyResponses"" (
                    ""Id"" character varying(100) NOT NULL,
                    ""SurveyId"" character varying(100) NOT NULL,
                    ""StudentEmail"" character varying(200) NULL,
                    ""StudentId"" character varying(100) NULL,
                    ""AnswersJson"" jsonb NOT NULL,
                    ""SubmittedAt"" timestamp without time zone NOT NULL,
                    ""IpAddress"" character varying(50) NULL,
                    ""UserAgent"" character varying(500) NULL,
                    CONSTRAINT ""PK_SurveyResponses"" PRIMARY KEY (""Id"")
                );", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_SurveyResponses_SurveyId"" ON ""SurveyResponses"" (""SurveyId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_SurveyResponses_StudentEmail"" ON ""SurveyResponses"" (""StudentEmail"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_SurveyResponses_SurveyId_StudentEmail"" ON ""SurveyResponses"" (""SurveyId"", ""StudentEmail"");", ct);

            _log.LogInformation("[db] Ensured Surveys and SurveyResponses tables with indexes");
        }
        catch (Exception surveyEx)
        {
            _log.LogWarning(surveyEx, "[surveys] Failed to ensure Surveys tables (continuing)");
        }

        // Seed Surveys
        if (!await _db.Surveys.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<Entities.SurveyEntity>>("surveys.json") ?? new();
            if (raw.Count > 0)
            {
                foreach (var item in raw)
                {
                    if (string.IsNullOrWhiteSpace(item.Id))
                        item.Id = Guid.NewGuid().ToString();
                }
                _db.Surveys.AddRange(raw);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded surveys: {Count}", raw.Count);
            }
        }

        // Seed Changelog Entries
        if (!await _db.ChangelogEntries.AsNoTracking().AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<ChangelogEntrySeedModel>>("changelog.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var entries = raw.Select(item =>
                {
                    var dateStr = item.Date ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
                    var parsedDate = DateTime.TryParse(dateStr, out var dt) ? dt : DateTime.UtcNow;
                    
                    return new ChangelogEntryEntity
                    {
                        Id = string.IsNullOrWhiteSpace(item.Id) ? $"cl-{Guid.NewGuid().ToString("N")[..12]}" : item.Id,
                        Version = item.Version ?? "1.0.0",
                        Date = DateTime.SpecifyKind(parsedDate, DateTimeKind.Unspecified),
                        Title = item.Title ?? string.Empty,
                        PointsJson = item.Points != null ? JsonSerializer.Serialize(item.Points) : "[]",
                        CreatedAt = nowUnspecified,
                        UpdatedAt = nowUnspecified,
                        CreatedBy = "system@mais.sk"
                    };
                }).ToList();
                
                _db.ChangelogEntries.AddRange(entries);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded changelog entries: {Count}", entries.Count);
            }
        }

        // Ensure default credentials (from config or fallback)
        try
        {
            var studentPassword = GetDefaultPassword("student");
            var teacherPassword = GetDefaultPassword("teacher");
            
            var existingEmails = new HashSet<string>(
                (await _db.UserCredentials.AsNoTracking().Select(x => x.Email.ToLower()).ToListAsync(ct))
            );
            var toAdd = new List<Entities.UserCredentialEntity>();
            
            foreach (var s in await _db.Students.AsNoTracking().Select(x => new { x.Email }).ToListAsync(ct))
            {
                var em = (s.Email ?? string.Empty).Trim(); if (string.IsNullOrWhiteSpace(em)) continue;
                var normalized = em.ToLower();
                if (existingEmails.Contains(normalized)) continue;
                existingEmails.Add(normalized);
                toAdd.Add(new Entities.UserCredentialEntity
                {
                    Email = em,
                    Role = "student",
                    PasswordHash = _hasher.Hash(studentPassword),
                    CreatedAt = DateTime.UtcNow,
                    LastLoginAt = null
                });
            }
            foreach (var f in await _db.Faculty.AsNoTracking().Select(x => new { x.Email }).ToListAsync(ct))
            {
                var em = (f.Email ?? string.Empty).Trim(); if (string.IsNullOrWhiteSpace(em)) continue;
                var normalized = em.ToLower();
                if (existingEmails.Contains(normalized)) continue;
                existingEmails.Add(normalized);
                toAdd.Add(new Entities.UserCredentialEntity
                {
                    Email = em,
                    Role = "teacher",
                    PasswordHash = _hasher.Hash(teacherPassword),
                    CreatedAt = DateTime.UtcNow,
                    LastLoginAt = null
                });
            }
            if (toAdd.Count > 0)
            {
                _db.UserCredentials.AddRange(toAdd);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[auth] Seeded credentials: {StudentCount} students, {TeacherCount} teachers", 
                    toAdd.Count(c => c.Role == "student"),
                    toAdd.Count(c => c.Role == "teacher"));
            }
        }
        catch (Exception se)
        {
            _log.LogWarning(se, "[auth] Seeding credentials skipped due to error");
        }

        // Add reservation fields to Rooms and Equipment tables
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE IF EXISTS ""Rooms"" ADD COLUMN IF NOT EXISTS ""NextBookingStart"" timestamp without time zone NULL;
                ALTER TABLE IF EXISTS ""Rooms"" ADD COLUMN IF NOT EXISTS ""NextBookingEnd"" timestamp without time zone NULL;
                ALTER TABLE IF EXISTS ""Rooms"" ADD COLUMN IF NOT EXISTS ""ReservedBy"" character varying(200) NULL;
            ", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE IF EXISTS ""Equipment"" ADD COLUMN IF NOT EXISTS ""NextBookingStart"" timestamp without time zone NULL;
                ALTER TABLE IF EXISTS ""Equipment"" ADD COLUMN IF NOT EXISTS ""NextBookingEnd"" timestamp without time zone NULL;
            ", ct);
            
            // Fix: Equipment.ReservedBy should be varchar, not timestamp. Drop and re-add if wrong type.
            try
            {
                await _db.Database.ExecuteSqlRawAsync(@"
                    ALTER TABLE IF EXISTS ""Equipment"" DROP COLUMN IF EXISTS ""ReservedBy"";
                    ALTER TABLE IF EXISTS ""Equipment"" ADD COLUMN IF NOT EXISTS ""ReservedBy"" character varying(200) NULL;
                ", ct);
            }
            catch { /* Column might not exist or be correct type already */ }
            
            _log.LogInformation("[db] Added reservation fields to Rooms and Equipment");
        }
        catch (Exception rex)
        {
            _log.LogWarning(rex, "[reservations] Failed to add reservation fields (continuing)");
        }

        // Ensure ResourceReservations table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ResourceReservations"" (
                ""Id"" character varying(100) NOT NULL,
                ""ResourceType"" character varying(20) NOT NULL,
                ""ResourceId"" character varying(100) NOT NULL,
                ""ResourceName"" character varying(200) NOT NULL,
                ""StartTime"" timestamp without time zone NOT NULL,
                ""EndTime"" timestamp without time zone NOT NULL,
                ""ReservedBy"" character varying(200) NOT NULL,
                ""ReservedByName"" character varying(200) NOT NULL,
                ""TimetableEventId"" character varying(100) NULL,
                ""CourseCode"" character varying(32) NULL,
                ""CourseName"" character varying(300) NULL,
                ""Status"" character varying(20) NOT NULL DEFAULT 'active',
                ""Notes"" text NULL,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone NULL,
                CONSTRAINT ""PK_ResourceReservations"" PRIMARY KEY (""Id"")
            );", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ResourceReservations_ResourceId"" ON ""ResourceReservations"" (""ResourceId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ResourceReservations_ReservedBy"" ON ""ResourceReservations"" (""ReservedBy"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ResourceReservations_TimetableEventId"" ON ""ResourceReservations"" (""TimetableEventId"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ResourceReservations_StartTime_EndTime"" ON ""ResourceReservations"" (""StartTime"", ""EndTime"");", ct);
            
            _log.LogInformation("[db] Ensured ResourceReservations table with indexes");
        }
        catch (Exception resEx)
        {
            _log.LogWarning(resEx, "[reservations] Failed to ensure ResourceReservations table (continuing)");
        }

        // Ensure News table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""news"" (
                ""id"" SERIAL PRIMARY KEY,
                ""title"" VARCHAR(500) NOT NULL,
                ""content"" TEXT,
                ""content_html"" TEXT,
                ""published_at"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""created_at"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""updated_at"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""author_email"" VARCHAR(255),
                ""author_name"" VARCHAR(255),
                ""is_published"" BOOLEAN NOT NULL DEFAULT true,
                ""attachments"" TEXT,
                ""category"" VARCHAR(100),
                ""tags"" TEXT,
                ""cover_image_url"" VARCHAR(1000),
                ""priority"" INTEGER NOT NULL DEFAULT 0,
                ""expires_at"" TIMESTAMP
            );", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_news_published"" ON ""news""(""is_published"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_news_published_at"" ON ""news""(""published_at"" DESC);", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_news_category"" ON ""news""(""category"");", ct);
            
            _log.LogInformation("[db] Ensured News table with indexes");
        }
        catch (Exception newsEx)
        {
            _log.LogWarning(newsEx, "[news] Failed to ensure News table (continuing)");
        }
        
        // Seed News
        if (!await _db.News.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<NewsSeedModel>>("news.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var news = raw.Select(item =>
                {
                    DateTime publishedAt = nowUnspecified;
                    if (!string.IsNullOrWhiteSpace(item.PublishedAt) && DateTime.TryParse(item.PublishedAt, out var parsed))
                        publishedAt = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
                    
                    return new NewsEntity
                    {
                        Title = item.Title ?? string.Empty,
                        Content = item.Content,
                        ContentHtml = item.ContentHtml,
                        PublishedAt = publishedAt,
                        CreatedAt = nowUnspecified,
                        UpdatedAt = nowUnspecified,
                        AuthorEmail = item.AuthorEmail,
                        AuthorName = item.AuthorName,
                        IsPublished = item.IsPublished,
                        Category = item.Category,
                        Priority = item.Priority
                    };
                }).ToList();
                
                _db.News.AddRange(news);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded news: {Count}", news.Count);
            }
        }

        // Ensure Attendance table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""attendance"" (
                ""id"" SERIAL PRIMARY KEY,
                ""course_code"" VARCHAR(50) NOT NULL,
                ""student_id"" VARCHAR(50) NOT NULL,
                ""student_email"" VARCHAR(255),
                ""teacher_email"" VARCHAR(255) NOT NULL,
                ""session_date"" DATE NOT NULL,
                ""time_slot"" VARCHAR(50),
                ""room"" VARCHAR(50),
                ""status"" VARCHAR(20) NOT NULL DEFAULT 'present',
                ""notes"" TEXT,
                ""class_group_key"" VARCHAR(255),
                ""created_at"" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                ""updated_at"" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_attendance_course_code"" ON ""attendance""(""course_code"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_attendance_student_id"" ON ""attendance""(""student_id"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_attendance_teacher_email"" ON ""attendance""(""teacher_email"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""idx_attendance_session_date"" ON ""attendance""(""session_date"");", ct);
            
            _log.LogInformation("[db] Ensured Attendance table with indexes");
        }
        catch (Exception attEx)
        {
            _log.LogWarning(attEx, "[attendance] Failed to ensure Attendance table (continuing)");
        }

        // Ensure KnowledgeBaseArticles table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""KnowledgeBaseArticles"" (
                ""Id"" character varying(100) NOT NULL,
                ""Title"" character varying(500) NOT NULL,
                ""Slug"" character varying(600) NOT NULL,
                ""Content"" text NOT NULL,
                ""Category"" character varying(100) NOT NULL,
                ""Difficulty"" character varying(50),
                ""AuthorEmail"" character varying(200),
                ""IsPublished"" boolean NOT NULL DEFAULT true,
                ""ViewCount"" integer NOT NULL DEFAULT 0,
                ""LikeCount"" integer NOT NULL DEFAULT 0,
                ""TagsJson"" text,
                ""RelatedArticlesJson"" text,
                ""MetaDescription"" character varying(500),
                ""CreatedAt"" timestamp with time zone NOT NULL,
                ""UpdatedAt"" timestamp with time zone NOT NULL,
                CONSTRAINT ""PK_KnowledgeBaseArticles"" PRIMARY KEY (""Id"")
            );", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_KnowledgeBaseArticles_Category"" ON ""KnowledgeBaseArticles"" (""Category"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_KnowledgeBaseArticles_Slug"" ON ""KnowledgeBaseArticles"" (""Slug"");", ct);
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_KnowledgeBaseArticles_IsPublished"" ON ""KnowledgeBaseArticles"" (""IsPublished"");", ct);
            
            _log.LogInformation("[db] Ensured KnowledgeBaseArticles table with indexes");
        }
        catch (Exception kbEx)
        {
            _log.LogWarning(kbEx, "[kb] Failed to ensure KnowledgeBaseArticles table (continuing)");
        }

        // Ensure ChangelogEntries table
        try
        {
            await _db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ""ChangelogEntries"" (
                ""Id"" character varying(128) NOT NULL,
                ""Version"" character varying(32) NOT NULL,
                ""Date"" timestamp without time zone NOT NULL,
                ""Title"" character varying(512) NOT NULL,
                ""PointsJson"" jsonb NOT NULL DEFAULT '[]',
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone,
                ""CreatedBy"" character varying(256),
                CONSTRAINT ""PK_ChangelogEntries"" PRIMARY KEY (""Id"")
            );", ct);
            
            await _db.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_ChangelogEntries_Date"" ON ""ChangelogEntries"" (""Date"" DESC);", ct);
            
            _log.LogInformation("[db] Ensured ChangelogEntries table with indexes");
        }
        catch (Exception clEx)
        {
            _log.LogWarning(clEx, "[changelog] Failed to ensure ChangelogEntries table (continuing)");
        }

        // Seed Knowledge Base Articles
        if (!await _db.KnowledgeBaseArticles.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<KnowledgeBaseArticleSeedModel>>("knowledge-base.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var articles = raw.Select(item =>
                {
                    var createdAt = DateTime.TryParse(item.CreatedAt, out var parsedCreated)
                        ? DateTime.SpecifyKind(parsedCreated, DateTimeKind.Unspecified)
                        : nowUnspecified;
                    var updatedAt = DateTime.TryParse(item.UpdatedAt, out var parsedUpdated)
                        ? DateTime.SpecifyKind(parsedUpdated, DateTimeKind.Unspecified)
                        : nowUnspecified;
                    
                    return new KnowledgeBaseArticleEntity
                    {
                        Id = string.IsNullOrWhiteSpace(item.Id) ? $"kb-{Guid.NewGuid().ToString("N")[..12]}" : item.Id,
                        Title = item.Title ?? string.Empty,
                        Content = item.Content ?? string.Empty,
                        Category = item.Category ?? "General",
                        Slug = item.Slug ?? item.Title?.ToLowerInvariant().Replace(" ", "-") ?? Guid.NewGuid().ToString(),
                        TagsJson = item.Tags != null ? JsonSerializer.Serialize(item.Tags) : null,
                        AuthorEmail = item.AuthorEmail,
                        MetaDescription = null,
                        CreatedAt = createdAt,
                        UpdatedAt = updatedAt,
                        IsPublished = item.IsPublished,
                        ViewCount = item.ViewCount,
                        LikeCount = item.HelpfulCount,
                        Difficulty = item.Difficulty,
                        RelatedArticlesJson = null
                    };
                }).ToList();
                
                _db.KnowledgeBaseArticles.AddRange(articles);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded knowledge base articles: {Count}", articles.Count);
            }
        }
        
        // Seed Payments
        if (!await _db.Payments.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<PaymentSeedModel>>("payments.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var payments = raw.Select(item =>
                {
                    DateOnly? dueDate = null;
                    DateOnly? postedDate = null;
                    
                    if (!string.IsNullOrWhiteSpace(item.DueDate) && DateOnly.TryParse(item.DueDate, out var parsedDue))
                        dueDate = parsedDue;
                    if (!string.IsNullOrWhiteSpace(item.PostedDate) && DateOnly.TryParse(item.PostedDate, out var parsedPosted))
                        postedDate = parsedPosted;
                    
                    return new PaymentEntity
                    {
                        StudentId = item.StudentId ?? string.Empty,
                        Type = item.Type ?? "tuition",
                        Description = item.Description ?? string.Empty,
                        Amount = item.Amount,
                        Currency = item.Currency ?? "EUR",
                        Status = item.Status ?? "pending",
                        VariableSymbol = item.VariableSymbol,
                        SpecificSymbol = item.SpecificSymbol,
                        AcademicYear = item.AcademicYear,
                        Semester = item.Semester,
                        DueDate = dueDate,
                        PostedDate = postedDate,
                        ExternalRef = item.ExternalRef,
                        Notes = item.Notes,
                        CreatedAt = nowUnspecified,
                        UpdatedAt = nowUnspecified
                    };
                }).ToList();
                
                _db.Payments.AddRange(payments);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded payments: {Count}", payments.Count);
            }
        }
        
        // Seed Attendance records
        if (!await _db.Attendance.AnyAsync(ct))
        {
            var raw = await ReadJsonAsync<List<AttendanceSeedModel>>("attendance.json") ?? new();
            if (raw.Count > 0)
            {
                var now = DateTime.UtcNow;
                var nowUnspecified = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
                
                var records = raw.Select(item =>
                {
                    DateOnly sessionDate = DateOnly.MinValue;
                    if (!string.IsNullOrWhiteSpace(item.SessionDate) && DateOnly.TryParse(item.SessionDate, out var parsed))
                        sessionDate = parsed;
                    
                    return new AttendanceEntity
                    {
                        CourseCode = item.CourseCode ?? string.Empty,
                        StudentId = item.StudentId ?? string.Empty,
                        StudentEmail = item.StudentEmail,
                        TeacherEmail = item.TeacherEmail ?? string.Empty,
                        SessionDate = sessionDate,
                        TimeSlot = item.TimeSlot,
                        Room = item.Room,
                        Status = item.Status ?? "present",
                        Notes = item.Notes,
                        ClassGroupKey = item.ClassGroupKey,
                        CreatedAt = nowUnspecified,
                        UpdatedAt = nowUnspecified
                    };
                }).ToList();
                
                _db.Attendance.AddRange(records);
                await _db.SaveChangesAsync(ct);
                _log.LogInformation("[db] Seeded attendance records: {Count}", records.Count);
            }
        }
        
        _log.LogInformation("[db] EnsureCreated done");
    }

    // Seed model to match JSON structure
    private class KnowledgeBaseArticleSeedModel
    {
        public string? Id { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
        public string? Category { get; set; }
        public string? Slug { get; set; }
        public List<string>? Tags { get; set; }
        public string? AuthorEmail { get; set; }
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
        public bool IsPublished { get; set; } = true;
        public int ViewCount { get; set; } = 0;
        public int HelpfulCount { get; set; } = 0;
        public int NotHelpfulCount { get; set; } = 0;
        public string? Difficulty { get; set; }
        public int EstimatedReadTime { get; set; } = 5;
        public string? RelatedArticleIds { get; set; }
    }

    // Seed model for Changelog entries from JSON
    private class ChangelogEntrySeedModel
    {
        public string? Id { get; set; }
        public string? Version { get; set; }
        public string? Date { get; set; }
        public string? Title { get; set; }
        public List<string>? Points { get; set; }
    }
    
    // Seed model for Payments from JSON
    private class PaymentSeedModel
    {
        public string? StudentId { get; set; }
        public string? Type { get; set; }
        public string? Description { get; set; }
        public decimal Amount { get; set; }
        public string? Currency { get; set; }
        public string? Status { get; set; }
        public string? VariableSymbol { get; set; }
        public string? SpecificSymbol { get; set; }
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }
        public string? DueDate { get; set; }
        public string? PostedDate { get; set; }
        public string? ExternalRef { get; set; }
        public string? Notes { get; set; }
    }
    
    // Seed model for Attendance records from JSON
    private class AttendanceSeedModel
    {
        public string? CourseCode { get; set; }
        public string? StudentId { get; set; }
        public string? StudentEmail { get; set; }
        public string? TeacherEmail { get; set; }
        public string? SessionDate { get; set; }
        public string? TimeSlot { get; set; }
        public string? Room { get; set; }
        public string? Status { get; set; }
        public string? Notes { get; set; }
        public string? ClassGroupKey { get; set; }
    }
    
    // Seed model for Enrollments from JSON
    private class EnrollmentSeedModel
    {
        public string? Id { get; set; }
        public string? StudentId { get; set; }
        public string? CourseCode { get; set; }
        public string? ScheduleEventId { get; set; }
        public string? Status { get; set; }
        public string? AcademicYear { get; set; }
        public string? Semester { get; set; }
        public string? EnrolledAt { get; set; }
    }
    
    // Seed model for Course Grades from JSON
    private class GradeSeedModel
    {
        public string? Id { get; set; }
        public string? StudentId { get; set; }
        public string? CourseCode { get; set; }
        public string? TeacherEmail { get; set; }
        public string? AssessmentType { get; set; }
        public int ContinuousPercent { get; set; }
        public int FinalPercent { get; set; }
        public int TotalPercent { get; set; }
        public string? LetterGrade { get; set; }
        public string? AwardedAt { get; set; }
    }
    
    // Seed model for Class Groups from JSON
    private class ClassGroupSeedModel
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Faculty { get; set; }
        public string? Program { get; set; }
        public int Capacity { get; set; }
        public int StudentCount { get; set; }
        public string? TeacherEmail { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }
    
    // Seed model for News from JSON
    private class NewsSeedModel
    {
        public string? Title { get; set; }
        public string? Content { get; set; }
        public string? ContentHtml { get; set; }
        public string? PublishedAt { get; set; }
        public string? AuthorEmail { get; set; }
        public string? AuthorName { get; set; }
        public bool IsPublished { get; set; } = true;
        public string? Category { get; set; }
        public int Priority { get; set; }
    }

    // Seed model for Assignments from JSON
    private class AssignmentSeedModel
    {
        public string? Id { get; set; }
        public string? ClassId { get; set; }
        public string? CourseCode { get; set; }
        public string? TeacherEmail { get; set; }
        public string? Name { get; set; }
        public string? Category { get; set; }
        public int TotalPoints { get; set; }
        public string? DueDate { get; set; }
        public string? Description { get; set; }
    }

    // Seed model for Assignment Grades from JSON
    private class AssignmentGradeSeedModel
    {
        public string? Id { get; set; }
        public string? StudentId { get; set; }
        public string? AssignmentId { get; set; }
        public int Points { get; set; }
    }

    // Seed model for Exam Terms from JSON
    private class ExamTermSeedModel
    {
        public string? Id { get; set; }
        public string? CourseCode { get; set; }
        public string? CourseName { get; set; }
        public int? Credits { get; set; }
        public string? StartAt { get; set; }
        public string? EndAt { get; set; }
        public string? Building { get; set; }
        public string? Room { get; set; }
        public string? Examiner { get; set; }
        public int Capacity { get; set; }
        public string? CreatedBy { get; set; }
        public string? CreatedAt { get; set; }
    }

    // Seed model for Exam Registrations from JSON
    private class ExamRegistrationSeedModel
    {
        public string? Id { get; set; }
        public string? TermId { get; set; }
        public string? StudentId { get; set; }
        public string? StudentEmail { get; set; }
        public string? RegisteredAt { get; set; }
    }

    // Seed model for Thesis Topics from JSON
    private class ThesisTopicSeedModel
    {
        public string? Id { get; set; }
        public string? Type { get; set; }
        public string? Title { get; set; }
        public string? Program { get; set; }
        public string? ProgramLabel { get; set; }
        public string? Faculty { get; set; }
        public string? Department { get; set; }
        public string? KeywordsJson { get; set; }
        public string? Description { get; set; }
        public string? SupervisorEmail { get; set; }
        public string? SupervisorName { get; set; }
        public int? Capacity { get; set; }
        public string? State { get; set; }
        public string? CreatedAt { get; set; }
    }
}
