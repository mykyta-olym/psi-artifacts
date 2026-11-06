using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Models;
using Mais.Web.Data;
using Mais.Web.Entities;
using System.Text.Json;
using Mais.Web.Services;
using Mais.Web.Models.Documents;
using Microsoft.Extensions.DependencyInjection;
using System.Linq;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Authorization;

namespace Mais.Web.Controllers;

public class CatalogController : BaseController
{
    private readonly AppDbContext _db;
    private readonly IEmailService _emailService;
    private readonly ILogger<CatalogController> _logger;
    private readonly IDocumentRenderService _documentRenderer;
    private readonly IDataUpdateService _dataUpdates;

    public CatalogController(IWebHostEnvironment env, IConfiguration config, AppDbContext db, IEmailService emailService, ILogger<CatalogController> logger, IDocumentRenderService documentRenderer, IDataUpdateService dataUpdates) : base(env, config)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
        _documentRenderer = documentRenderer;
        _dataUpdates = dataUpdates;
    }

    /// <summary>
    /// Normalize TypeSk value - fix Profile values that were incorrectly stored as Type
    /// </summary>
    private static string NormalizeTypeSk(string? typeSk)
    {
        if (string.IsNullOrWhiteSpace(typeSk))
            return "P+CL";

        var normalized = typeSk.Trim();

        // Profile values that should be in Profile field, not TypeSk
        var profileValues = new[] { "PV", "PP", "PVP", "PV/PVP" };
        if (profileValues.Contains(normalized, StringComparer.OrdinalIgnoreCase))
            return "P+CL";

        // Old format conversions
        if (normalized.Equals("P", StringComparison.OrdinalIgnoreCase) ||
            normalized.Equals("CL", StringComparison.OrdinalIgnoreCase) ||
            normalized.Equals("L", StringComparison.OrdinalIgnoreCase))
            return "P+CL";

        // Seminar is correct
        if (normalized.Equals("S", StringComparison.OrdinalIgnoreCase))
            return "S";

        // Already normalized
        if (normalized == "P+CL")
            return "P+CL";

        // Default
        return "P+CL";
    }

    /// <summary>
    /// Get study programs for the current authenticated user
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of study programs associated with the user's email</returns>
    /// <remarks>
    /// Returns all study programs (ongoing and archived) for the authenticated user.
    /// If no studies are found, returns an empty list.
    /// The first ongoing study is marked as preferred.
    /// </remarks>
    [HttpGet("/api/studies/me")]
    [ProducesResponseType(typeof(List<StudyProgramModel>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyStudies(CancellationToken ct)
    {
        var email = User?.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new { error = "User email missing" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        var studies = await _db.Students.AsNoTracking()
            .Where(s =>
                (!string.IsNullOrWhiteSpace(s.Email) && s.Email.ToLower() == normalized) ||
                (!string.IsNullOrWhiteSpace(s.AltEmail) && s.AltEmail!.ToLower() == normalized))
            .OrderByDescending(s => s.StudyYear)
            .ThenBy(s => s.Program)
            .ToListAsync(ct);

        // Return empty list if no student records found - no synthetic data
        if (studies.Count == 0)
        {
            return Ok(new List<StudyProgramModel>());
        }

        var response = new List<StudyProgramModel>();
        foreach (var (student, index) in studies.Select((s, i) => (s, i)))
        {
            var status = (student.Status ?? string.Empty).Trim();
            var ongoing = IsOngoingStatus(status);

            response.Add(new StudyProgramModel
            {
                StudentId = student.Id,
                PersonId = student.PersonId ?? string.Empty,
                Uid = $"std-{student.Id}-{index}",
                ProgramName = student.Program ?? string.Empty,
                ProgramCode = BuildProgramCode(student),
                Faculty = student.Faculty ?? string.Empty,
                OspYear = student.StudyYear.ToString(),
                Status = string.IsNullOrWhiteSpace(status) ? (ongoing ? "ongoing" : "archived") : status,
                Ongoing = ongoing,
                Degree = student.Degree ?? string.Empty,
                Preferred = false,
                LastActivity = ParseDate(student.LastActivity)
            });
        }

        foreach (var study in response)
        {
            study.Preferred = false;
        }
        var preferred = response.FirstOrDefault(r => r.Ongoing) ?? response.First();
        preferred.Preferred = true;

        return Ok(response);
    }

    /// <summary>
    /// Create a new student record (teachers manage all records)
    /// </summary>
    /// <param name="req">Student creation request with personal and academic information</param>
    /// <returns>Created student entity</returns>
    /// <remarks>
    /// Teachers can create students directly without a separate management role.
    /// Generates a unique system ID based on name initials and ensures uniqueness.
    /// Required fields: Email, FirstName/GivenName, LastName/FamilyName
    /// </remarks>
    [HttpPost("/api/students")]
    [ProducesResponseType(typeof(StudentEntity), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateStudent([FromBody] StudentCreateRequest req)
    {
        if (req == null) return BadRequest(new { error = "Body required" });
        var email = (req.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(email)) return BadRequest(new { error = "Email is required" });

        // Teachers own the management surface in this system; allow unauth for now if auth not configured on route
        // If auth is on, we could enforce role == teacher here.

        // Generate system Id: first letter of given + first letter of family + 3 digits + 2 letters, ensure uniqueness
        string given = (req.FirstName ?? req.GivenName ?? string.Empty).Trim();
        string family = (req.LastName ?? req.FamilyName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(given) || string.IsNullOrWhiteSpace(family))
        {
            var fullTry = (req.FullName ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(fullTry))
            {
                var parts = fullTry.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (string.IsNullOrWhiteSpace(given) && parts.Length > 0) given = parts[0];
                if (string.IsNullOrWhiteSpace(family) && parts.Length > 1) family = parts[^1];
            }
        }

        var existingIds = new HashSet<string>((await _db.Students.AsNoTracking().Select(s => s.Id.ToLower()).ToListAsync()), StringComparer.OrdinalIgnoreCase);
        var id = IdGenerator.GenerateEmployeeId(given, family, email, existingIds);
        var existsByEmail = await _db.Students.AnyAsync(s => s.Email.ToLower() == email.ToLower());
        if (existsByEmail) return Conflict(new { error = "Student with the same email already exists", email });

        // given/family already computed above for Id generation
        string full = (req.FullName ?? $"{given} {family}".Trim());
        if (string.IsNullOrWhiteSpace(full))
        {
            var local = email.Split('@')[0];
            full = local.Replace('.', ' ').Replace('_', ' ').Trim();
        }

        int studyYear = 0;
        if (req.StudyYear.HasValue) studyYear = req.StudyYear.Value;
        else if (!string.IsNullOrWhiteSpace(req.GradeKey))
        {
            // crude parse: keys like "1-rok-2025-2026-zs" => 1
            var m = System.Text.RegularExpressions.Regex.Match(req.GradeKey, "^(\\d+)");
            if (m.Success && int.TryParse(m.Groups[1].Value, out var yr)) studyYear = yr;
        }

        // Prefer StudentNumber provided
        var studentNumber = string.IsNullOrWhiteSpace(req.StudentNumber) ? null : req.StudentNumber;

        var statusValue = string.IsNullOrWhiteSpace(req.Status) ? "active" : req.Status!.Trim().ToLowerInvariant();
        var isArchived = req.IsArchived ?? !IsOngoingStatus(statusValue);
        var personId = string.IsNullOrWhiteSpace(req.PersonId)
            ? (string.IsNullOrWhiteSpace(req.StudentId) ? id : req.StudentId!.Trim())
            : req.PersonId!.Trim();

        var titlesPrefix = req.TitlesPrefix ?? new List<string>();
        var titlesSuffix = req.TitlesSuffix ?? new List<string>();

        var student = new StudentEntity
        {
            Id = id,
            PersonId = string.IsNullOrWhiteSpace(personId) ? id : personId,
            Email = email,
            GivenName = string.IsNullOrWhiteSpace(given) ? null : given,
            FamilyName = string.IsNullOrWhiteSpace(family) ? null : family,
            TitlesPrefixJson = titlesPrefix.Count > 0 ? JsonSerializer.Serialize(titlesPrefix) : null,
            TitlesSuffixJson = titlesSuffix.Count > 0 ? JsonSerializer.Serialize(titlesSuffix) : null,
            FullName = full,
            Faculty = req.Faculty ?? string.Empty,
            Program = req.Program ?? string.Empty,
            StudyYear = studyYear,
            Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone,
            Phone2 = string.IsNullOrWhiteSpace(req.Phone2) ? null : req.Phone2,
            AltEmail = string.IsNullOrWhiteSpace(req.AltEmail) ? null : req.AltEmail,
            Address = string.IsNullOrWhiteSpace(req.Address) ? null : req.Address,
            ClassName = string.IsNullOrWhiteSpace(req.ClassName) ? null : req.ClassName,
            IsicCardNumber = string.IsNullOrWhiteSpace(req.IsicCardNumber) ? null : req.IsicCardNumber,
            StudentNumber = string.IsNullOrWhiteSpace(studentNumber) ? null : studentNumber,
            StudyNumber = string.IsNullOrWhiteSpace(req.StudyNumber) ? null : req.StudyNumber,
            PassportId = string.IsNullOrWhiteSpace(req.PassportId) ? null : req.PassportId,
            BirthDate = string.IsNullOrWhiteSpace(req.BirthDate) ? null : req.BirthDate,
            BirthPlace = string.IsNullOrWhiteSpace(req.BirthPlace) ? null : req.BirthPlace,
            Nationality = string.IsNullOrWhiteSpace(req.Nationality) ? null : req.Nationality,
            FamilyStatus = string.IsNullOrWhiteSpace(req.FamilyStatus) ? null : req.FamilyStatus,
            HealthStatus = string.IsNullOrWhiteSpace(req.HealthStatus) ? null : req.HealthStatus,
            ParentName = string.IsNullOrWhiteSpace(req.ParentName) ? null : req.ParentName,
            About = string.IsNullOrWhiteSpace(req.About) ? null : req.About,
            ConsentPersonalData = req.ConsentPersonalData,
            ConsentCompanyOffers = req.ConsentCompanyOffers,
            Status = statusValue,
            LastActivity = string.IsNullOrWhiteSpace(req.LastActivity) ? DateTime.UtcNow.ToString("o") : req.LastActivity,
            IsArchived = isArchived,
            EnrollmentSemester = string.IsNullOrWhiteSpace(req.GradeKey) ? null : req.GradeKey.Trim(),
            IsActivated = false,
            ActivationToken = Guid.NewGuid().ToString("N"),
            ActivationTokenExpiry = DateTime.UtcNow.AddDays(7)
        };

        _db.Students.Add(student);
        await _db.SaveChangesAsync();

        var creatorEmail = User?.FindFirstValue(ClaimTypes.Email) ?? "system";
        await AutoDeliverDocumentsForStudentAsync(student, creatorEmail, default);

        // Create activity for student creation
        await CreateActivityForStudentCreationAsync(student, creatorEmail, default);

        // Notify connected clients about student creation
        await _dataUpdates.NotifyStudentUpdated(student.Id, student.Email);

        // Generate temporary password and create/update credentials
        var temporaryPassword = GenerateTemporaryPassword();
        _logger.LogInformation("Generated temporary password for student {Email}: {Password}", email, temporaryPassword);
        
        var hasher = HttpContext.RequestServices.GetRequiredService<ISimplePasswordHasher>();
        var passwordHash = hasher.Hash(temporaryPassword) ?? string.Empty;
        _logger.LogInformation("Password hash generated for {Email}, hash length: {Length}", email, passwordHash.Length);
        
        var existingCred = await _db.UserCredentials.FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());
        if (existingCred == null)
        {
            var newCred = new UserCredentialEntity
            {
                Email = email,
                Role = "student",
                PasswordHash = passwordHash,
                TemporaryPassword = temporaryPassword,
                CreatedAt = DateTime.UtcNow
            };
            _db.UserCredentials.Add(newCred);
            _logger.LogInformation("Created new credentials for student {Email}", email);
        }
        else
        {
            // Update existing credentials with new temporary password
            existingCred.PasswordHash = passwordHash ?? string.Empty;
            existingCred.TemporaryPassword = temporaryPassword;
            existingCred.Role = "student";
            _logger.LogInformation("Updated existing credentials for student {Email} with new temporary password", email);
        }
        
        try 
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Credentials saved successfully for student {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save credentials for student {Email}", email);
            throw;
        }

        // Send activation email asynchronously
        _ = Task.Run(async () =>
        {
            try
            {
                _logger.LogInformation("Sending activation email to student {Email}", email);
                var sent = await _emailService.SendAccountActivationEmailAsync(
                    email,
                    full,
                    temporaryPassword,
                    student.ActivationToken!,
                    "Student",
                    default
                );
                if (sent)
                {
                    _logger.LogInformation("Activation email confirmed delivered to student {Email}", email);
                }
                else
                {
                    _logger.LogWarning("Activation email service returned no success flag for student {Email}", email);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send activation email to student {Email}", email);
            }
        });

        var created = new
        {
            id = student.Id,
            personId = student.PersonId,
            fullName = student.FullName,
            givenName = student.GivenName,
            familyName = student.FamilyName,
            email = student.Email,
            faculty = student.Faculty,
            program = student.Program,
            studyYear = student.StudyYear,
            phone = student.Phone,
            phone2 = student.Phone2,
            altEmail = student.AltEmail,
            address = student.Address,
            className = student.ClassName,
            isicCardNumber = student.IsicCardNumber,
            studentNumber = student.StudentNumber,
            studyNumber = student.StudyNumber,
            passportId = student.PassportId,
            birthDate = student.BirthDate,
            birthPlace = student.BirthPlace,
            nationality = student.Nationality,
            familyStatus = student.FamilyStatus,
            healthStatus = student.HealthStatus,
            parentName = student.ParentName,
            consentPersonalData = student.ConsentPersonalData,
            consentCompanyOffers = student.ConsentCompanyOffers,
            status = student.Status,
            lastActivity = student.LastActivity,
            isArchived = student.IsArchived
        };
        return Created($"/api/students/{student.Id}", created);
    }

    /// <summary>
    /// Create a new faculty member record
    /// </summary>
    /// <param name="req">Faculty creation request with personal and professional information</param>
    /// <returns>Created faculty entity</returns>
    /// <remarks>
    /// Creates a new faculty member and automatically creates a user credential with default password "teacher123".
    /// Generates a unique system ID based on name initials and ensures uniqueness.
    /// Required fields: Email
    /// </remarks>
    [HttpPost("/api/faculty")]
    [ProducesResponseType(typeof(FacultyEntity), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateFaculty([FromBody] FacultyCreateRequest req)
    {
        if (req == null) return BadRequest(new { error = "Body required" });
        var emailRaw = (req.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(emailRaw)) return BadRequest(new { error = "Email is required" });
        var email = emailRaw.ToLowerInvariant();

        var exists = await _db.Faculty.AnyAsync(f => f.Email.ToLower() == email);
        if (exists) return Conflict(new { error = "Faculty member with the same email already exists", email });

        string given = (req.FirstName ?? req.GivenName ?? string.Empty).Trim();
        string family = (req.LastName ?? req.FamilyName ?? string.Empty).Trim();
        string full = (req.FullName ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(full))
        {
            full = $"{given} {family}".Trim();
        }
        if (string.IsNullOrWhiteSpace(full))
        {
            full = email.Split('@')[0].Replace('.', ' ').Replace('_', ' ').Trim();
        }
        if (string.IsNullOrWhiteSpace(full)) full = email;

        var existingIds = new HashSet<string>((await _db.Faculty.AsNoTracking().Select(f => f.Id.ToLower()).ToListAsync()), StringComparer.OrdinalIgnoreCase);
        var id = IdGenerator.GenerateEmployeeId(given, family, email, existingIds);

        var departments = new List<string>();
        if (req.Departments != null)
        {
            departments.AddRange(req.Departments.Where(d => !string.IsNullOrWhiteSpace(d)).Select(d => d.Trim()));
        }
        var primaryDept = (req.Department ?? req.PrimaryDepartment ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(primaryDept) && !departments.Any(d => string.Equals(d, primaryDept, StringComparison.OrdinalIgnoreCase)))
        {
            departments.Insert(0, primaryDept);
        }

        var subjects = (req.Subjects ?? new List<string>()).Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var facultyValue = (req.Faculty ?? string.Empty).Trim();
        var statusValue = string.IsNullOrWhiteSpace(req.Status) ? "active" : req.Status.Trim().ToLowerInvariant();
        var employmentValue = string.IsNullOrWhiteSpace(req.EmploymentType) ? "full-time" : req.EmploymentType.Trim();
        var hireDate = string.IsNullOrWhiteSpace(req.HireDate) ? DateTime.UtcNow.AddYears(-3).ToString("o") : req.HireDate;
        var lastActivity = string.IsNullOrWhiteSpace(req.LastActivity) ? DateTime.UtcNow.ToString("o") : req.LastActivity;

        var titlesPrefix = req.TitlesPrefix ?? new List<string>();
        var titlesSuffix = req.TitlesSuffix ?? new List<string>();

        var entity = new FacultyEntity
        {
            Id = id,
            FullName = full,
            GivenName = string.IsNullOrWhiteSpace(given) ? null : given,
            FamilyName = string.IsNullOrWhiteSpace(family) ? null : family,
            TitlesPrefixJson = titlesPrefix.Count > 0 ? JsonSerializer.Serialize(titlesPrefix) : null,
            TitlesSuffixJson = titlesSuffix.Count > 0 ? JsonSerializer.Serialize(titlesSuffix) : null,
            Email = email,
            Faculty = facultyValue,
            Program = string.IsNullOrWhiteSpace(req.Program) ? null : req.Program.Trim(),
            Department = primaryDept,
            Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone,
            Office = string.IsNullOrWhiteSpace(req.Office) ? null : req.Office,
            DepartmentsJson = JsonSerializer.Serialize(departments),
            SubjectsJson = JsonSerializer.Serialize(subjects),
            OfficeHoursJson = req.OfficeHours != null ? JsonSerializer.Serialize(req.OfficeHours) : null,
            WorkingHoursJson = req.WorkingHours != null ? JsonSerializer.Serialize(req.WorkingHours) : null,
            Status = statusValue,
            EmploymentType = employmentValue,
            ClassesCount = req.ClassesCount,
            YearsExperience = req.YearsExperience,
            HireDate = hireDate,
            LastActivity = lastActivity,
            About = string.IsNullOrWhiteSpace(req.About) ? null : req.About,
            AvatarUrl = string.IsNullOrWhiteSpace(req.AvatarUrl) ? null : req.AvatarUrl,
            IsActivated = false,
            ActivationToken = Guid.NewGuid().ToString("N"),
            ActivationTokenExpiry = DateTime.UtcNow.AddDays(7)
        };

        _db.Faculty.Add(entity);
        await _db.SaveChangesAsync();

        // Create activity for faculty creation
        var creatorEmail = User?.FindFirstValue(ClaimTypes.Email) ?? "system";
        await CreateActivityForFacultyCreationAsync(entity, creatorEmail, default);

        // Notify connected clients about faculty creation
        await _dataUpdates.NotifyFacultyUpdated(entity.Email);

        // Generate temporary password and create/update credentials
        var temporaryPassword = GenerateTemporaryPassword();
        var hasher = HttpContext.RequestServices.GetRequiredService<ISimplePasswordHasher>();
        var existingCredential = await _db.UserCredentials.FirstOrDefaultAsync(x => x.Email.ToLower() == email);
        if (existingCredential == null)
        {
            _db.UserCredentials.Add(new UserCredentialEntity
            {
                Email = email,
                Role = "teacher",
                PasswordHash = hasher.Hash(temporaryPassword),
                TemporaryPassword = temporaryPassword,
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            // Update existing credentials with new temporary password
            existingCredential.PasswordHash = hasher.Hash(temporaryPassword);
            existingCredential.TemporaryPassword = temporaryPassword;
            existingCredential.Role = "teacher";
            _logger.LogInformation("Updated existing credentials for faculty {Email} with new temporary password", email);
        }
        await _db.SaveChangesAsync();

        // Send activation email asynchronously
        _ = Task.Run(async () =>
        {
            try
            {
                _logger.LogInformation("Sending activation email to faculty member {Email}", email);
                var sent = await _emailService.SendAccountActivationEmailAsync(
                    email,
                    full,
                    temporaryPassword,
                    entity.ActivationToken!,
                    "Teacher",
                    default
                );
                if (sent)
                {
                    _logger.LogInformation("Activation email confirmed delivered to faculty member {Email}", email);
                }
                else
                {
                    _logger.LogWarning("Activation email service returned no success flag for faculty member {Email}", email);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send activation email to faculty {Email}", email);
            }
        });

        var payload = new
        {
            id = entity.Id,
            fullName = entity.FullName,
            email = entity.Email,
            faculty = entity.Faculty,
            department = entity.Department,
            phone = entity.Phone,
            office = entity.Office,
            departments,
            subjects,
            status = entity.Status,
            employmentType = entity.EmploymentType,
            classesCount = entity.ClassesCount,
            yearsExperience = entity.YearsExperience,
            hireDate = entity.HireDate,
            lastActivity = entity.LastActivity,
            about = entity.About,
            avatarUrl = entity.AvatarUrl
        };

        return Created($"/api/faculty/{entity.Id}", payload);
    }

    // Update student profile (contacts, identifiers, personal details)
    public class StudentProfileUpdateRequest
    {
        public string? FullName { get; set; }
        public string? GivenName { get; set; }
        public string? FamilyName { get; set; }
        public string? Faculty { get; set; }
        public string? Program { get; set; }
        public string? Phone { get; set; }
        public string? Phone2 { get; set; }
        public string? AltEmail { get; set; }
        public string? Address { get; set; }
        public string? ClassName { get; set; }
        public string? IsicCardNumber { get; set; }
        public string? StudentNumber { get; set; }
        public string? StudyNumber { get; set; }
        public string? PassportId { get; set; }
        public string? BirthDate { get; set; }
        public string? BirthPlace { get; set; }
        public string? Nationality { get; set; }
        public string? FamilyStatus { get; set; }
        public string? HealthStatus { get; set; }
        public string? ParentName { get; set; }
        public string? About { get; set; }
        public bool? ConsentPersonalData { get; set; }
        public bool? ConsentCompanyOffers { get; set; }
    }

    /// <summary>
    /// Update student profile information by student ID
    /// </summary>
    /// <param name="id">Student identifier</param>
    /// <param name="req">Profile update request with fields to modify</param>
    /// <returns>Updated student entity</returns>
    /// <remarks>
    /// Updates student profile fields. Only provided fields will be updated (partial update).
    /// Can update: personal information, contact details, identifiers, consent flags.
    /// </remarks>
    [HttpPut("/api/students/{id}/profile")]
    [ProducesResponseType(typeof(StudentEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStudentProfile(string id, [FromBody] StudentProfileUpdateRequest req)
    {
        var s = await _db.Students.FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return NotFound();
        // Apply only provided fields
        if (!string.IsNullOrWhiteSpace(req.FullName)) s.FullName = req.FullName!.Trim();
        if (!string.IsNullOrWhiteSpace(req.GivenName)) s.GivenName = req.GivenName!.Trim();
        if (!string.IsNullOrWhiteSpace(req.FamilyName)) s.FamilyName = req.FamilyName!.Trim();
        if (req.Faculty != null) s.Faculty = string.IsNullOrWhiteSpace(req.Faculty) ? string.Empty : req.Faculty.Trim();
        if (req.Program != null) s.Program = string.IsNullOrWhiteSpace(req.Program) ? string.Empty : req.Program.Trim();
        if (req.Phone != null) s.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone;
        if (req.Phone2 != null) s.Phone2 = string.IsNullOrWhiteSpace(req.Phone2) ? null : req.Phone2;
        if (req.AltEmail != null) s.AltEmail = string.IsNullOrWhiteSpace(req.AltEmail) ? null : req.AltEmail;
        if (req.Address != null) s.Address = string.IsNullOrWhiteSpace(req.Address) ? null : req.Address;
        if (req.ClassName != null) s.ClassName = string.IsNullOrWhiteSpace(req.ClassName) ? null : req.ClassName;
        if (req.IsicCardNumber != null) s.IsicCardNumber = string.IsNullOrWhiteSpace(req.IsicCardNumber) ? null : req.IsicCardNumber;
        if (req.StudentNumber != null) s.StudentNumber = string.IsNullOrWhiteSpace(req.StudentNumber) ? null : req.StudentNumber;
        if (req.StudyNumber != null) s.StudyNumber = string.IsNullOrWhiteSpace(req.StudyNumber) ? null : req.StudyNumber;
        if (req.PassportId != null) s.PassportId = string.IsNullOrWhiteSpace(req.PassportId) ? null : req.PassportId;
        if (req.BirthDate != null) s.BirthDate = string.IsNullOrWhiteSpace(req.BirthDate) ? null : req.BirthDate;
        if (req.BirthPlace != null) s.BirthPlace = string.IsNullOrWhiteSpace(req.BirthPlace) ? null : req.BirthPlace;
        if (req.Nationality != null) s.Nationality = string.IsNullOrWhiteSpace(req.Nationality) ? null : req.Nationality;
        if (req.FamilyStatus != null) s.FamilyStatus = string.IsNullOrWhiteSpace(req.FamilyStatus) ? null : req.FamilyStatus;
        if (req.HealthStatus != null) s.HealthStatus = string.IsNullOrWhiteSpace(req.HealthStatus) ? null : req.HealthStatus;
        if (req.ParentName != null) s.ParentName = string.IsNullOrWhiteSpace(req.ParentName) ? null : req.ParentName;
        if (req.About != null) s.About = string.IsNullOrWhiteSpace(req.About) ? null : req.About;
        if (req.ConsentPersonalData.HasValue) s.ConsentPersonalData = req.ConsentPersonalData;
        if (req.ConsentCompanyOffers.HasValue) s.ConsentCompanyOffers = req.ConsentCompanyOffers;
        await _db.SaveChangesAsync();

        // Create activity for student profile update
        var updaterEmail = User?.FindFirstValue(ClaimTypes.Email) ?? "system";
        await CreateActivityForStudentProfileUpdateAsync(s, updaterEmail, default);

        // Notify connected clients about student update
        await _dataUpdates.NotifyStudentUpdated(s.Id, s.Email);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Update student profile information by email
    /// </summary>
    /// <param name="email">Student email address</param>
    /// <param name="req">Profile update request with fields to modify</param>
    /// <returns>Updated student entity</returns>
    /// <remarks>
    /// Updates student profile fields by email. Only provided fields will be updated (partial update).
    /// Can update: personal information, contact details, identifiers, consent flags.
    /// </remarks>
    [HttpPut("/api/students/by-email/{email}/profile")]
    [ProducesResponseType(typeof(StudentEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStudentProfileByEmail(string email, [FromBody] StudentProfileUpdateRequest req)
    {
        var s = await _db.Students.FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());
        if (s == null) return NotFound();
        // reuse
        return await UpdateStudentProfile(s.Id, req);
    }

    // Graduation status update request
    public class GraduationStatusUpdateRequest
    {
        public bool? ThesisApproved { get; set; }
        public bool? AllCreditsEarned { get; set; }
        public bool? AllGradesSubmitted { get; set; }
    }

    /// <summary>
    /// Update student graduation status and automatically award degree if eligible
    /// </summary>
    /// <param name="id">Student ID</param>
    /// <param name="req">Graduation status update</param>
    /// <returns>Updated student with awarded degree if eligible</returns>
    [HttpPut("/api/students/{id}/graduation-status")]
    [Authorize(Roles = "Faculty")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateGraduationStatus(string id, [FromBody] GraduationStatusUpdateRequest req)
    {
        var student = await _db.Students.FirstOrDefaultAsync(x => x.Id == id);
        if (student == null) return NotFound();

        // Update graduation tracking fields
        if (req.ThesisApproved.HasValue)
        {
            student.ThesisApproved = req.ThesisApproved.Value;
            if (req.ThesisApproved.Value)
            {
                student.ThesisApprovedDate = DateTime.UtcNow.ToString("o");
            }
        }
        if (req.AllCreditsEarned.HasValue) student.AllCreditsEarned = req.AllCreditsEarned.Value;
        if (req.AllGradesSubmitted.HasValue) student.AllGradesSubmitted = req.AllGradesSubmitted.Value;

        // Get program details from database to determine degree and duration
        var program = await _db.Programs.FirstOrDefaultAsync(p => 
            p.Name == student.Program && p.Level == student.ProgramLevel);
        
        // Use program-specific values if available, otherwise fallback to helper methods
        var requiredYears = program?.DurationYears ?? AcademicDegreeHelper.GetRequiredYears(student.ProgramLevel ?? "Bachelor");
        var degreeToAward = program?.AwardedDegree ?? AcademicDegreeHelper.GetDegreeForLevel(student.ProgramLevel ?? "Bachelor");
        var programLevel = program?.Level ?? student.ProgramLevel ?? "Bachelor";

        // Cache program level for future lookups
        if (string.IsNullOrWhiteSpace(student.ProgramLevel) && !string.IsNullOrWhiteSpace(programLevel))
        {
            student.ProgramLevel = programLevel;
        }

        // Check if student is now eligible for graduation (includes time-based check with enrollment date)
        var (eligible, degree) = AcademicDegreeHelper.CheckGraduationEligibility(
            student.ThesisApproved,
            student.AllCreditsEarned,
            student.AllGradesSubmitted,
            student.Program,
            programLevel,
            student.StudyYear,
            requiredYears,
            student.EnrollmentDate
        );
        
        // Use degree from program if eligibility check didn't return one
        if (eligible && string.IsNullOrWhiteSpace(degree))
        {
            degree = degreeToAward;
        }

        student.GraduationEligible = eligible;

        // If eligible and not already graduated, award the degree
        if (eligible && string.IsNullOrWhiteSpace(student.GraduationDate) && !string.IsNullOrWhiteSpace(degree))
        {
            student.GraduationDate = DateTime.UtcNow.ToString("o");
            student.AwardedDegree = degree;
            student.Status = "graduated";

            // Update TitlesSuffixJson to include the new degree
            var currentSuffixes = string.IsNullOrWhiteSpace(student.TitlesSuffixJson) 
                ? new List<string>() 
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(student.TitlesSuffixJson) ?? new List<string>();
            
            if (!currentSuffixes.Contains(degree))
            {
                currentSuffixes.Add(degree);
                student.TitlesSuffixJson = System.Text.Json.JsonSerializer.Serialize(currentSuffixes);
            }
        }

        await _db.SaveChangesAsync();

        // Notify connected clients
        await _dataUpdates.NotifyStudentUpdated(student.Id, student.Email);

        return Ok(new 
        { 
            ok = true, 
            eligible = student.GraduationEligible,
            awardedDegree = student.AwardedDegree,
            graduationDate = student.GraduationDate,
            titlesSuffix = string.IsNullOrWhiteSpace(student.TitlesSuffixJson) 
                ? new List<string>() 
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(student.TitlesSuffixJson)
        });
    }

    // Teacher profile update (by email)
    public class FacultyProfileUpdateRequest
    {
        public string? Faculty { get; set; }
        public string? Program { get; set; }
        public string? Department { get; set; }
        public string? Phone { get; set; }
        public string? Office { get; set; }
        public List<string>? Departments { get; set; }
        public List<string>? Subjects { get; set; }
        public Dictionary<string, object>? OfficeHours { get; set; }
        public Dictionary<string, object>? WorkingHours { get; set; }
        public string? Status { get; set; }
        public string? EmploymentType { get; set; }
        public int? ClassesCount { get; set; }
        public int? YearsExperience { get; set; }
        public string? HireDate { get; set; }
        public string? LastActivity { get; set; }
        public string? About { get; set; }
        public string? AvatarUrl { get; set; }
    }

    /// <summary>
    /// Update faculty member profile information by email
    /// </summary>
    /// <param name="email">Faculty member email address</param>
    /// <param name="req">Profile update request with fields to modify</param>
    /// <returns>Updated faculty entity</returns>
    /// <remarks>
    /// Updates faculty profile fields. Only provided fields will be updated (partial update).
    /// Can update: contact information, office details, departments, subjects, employment details, status.
    /// </remarks>
    [HttpPut("/api/faculty/{email}/profile")]
    [ProducesResponseType(typeof(FacultyEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateFacultyProfile(string email, [FromBody] FacultyProfileUpdateRequest req)
    {
        var f = await _db.Faculty.FirstOrDefaultAsync(x => x.Email.ToLower() == email.ToLower());
        if (f == null) return NotFound();
        if (req.Faculty != null) f.Faculty = string.IsNullOrWhiteSpace(req.Faculty) ? string.Empty : req.Faculty.Trim();
        if (req.Program != null) f.Program = string.IsNullOrWhiteSpace(req.Program) ? null : req.Program.Trim();
        if (req.Department != null) f.Department = string.IsNullOrWhiteSpace(req.Department) ? null : req.Department.Trim();
        if (req.Phone != null) f.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone;
        if (req.Office != null) f.Office = string.IsNullOrWhiteSpace(req.Office) ? null : req.Office;
        if (req.Departments != null) f.DepartmentsJson = System.Text.Json.JsonSerializer.Serialize(req.Departments);
        if (req.Subjects != null) f.SubjectsJson = System.Text.Json.JsonSerializer.Serialize(req.Subjects);
        if (req.OfficeHours != null) f.OfficeHoursJson = System.Text.Json.JsonSerializer.Serialize(req.OfficeHours);
        if (req.WorkingHours != null) f.WorkingHoursJson = System.Text.Json.JsonSerializer.Serialize(req.WorkingHours);
        if (req.Status != null) f.Status = string.IsNullOrWhiteSpace(req.Status) ? null : req.Status.Trim().ToLowerInvariant();
        if (req.EmploymentType != null) f.EmploymentType = string.IsNullOrWhiteSpace(req.EmploymentType) ? null : req.EmploymentType.Trim();
        if (req.ClassesCount.HasValue) f.ClassesCount = req.ClassesCount;
        if (req.YearsExperience.HasValue) f.YearsExperience = req.YearsExperience;
        if (req.HireDate != null) f.HireDate = string.IsNullOrWhiteSpace(req.HireDate) ? null : req.HireDate;
        if (req.LastActivity != null) f.LastActivity = string.IsNullOrWhiteSpace(req.LastActivity) ? null : req.LastActivity;
        if (req.About != null) f.About = string.IsNullOrWhiteSpace(req.About) ? null : req.About;
        if (req.AvatarUrl != null) f.AvatarUrl = string.IsNullOrWhiteSpace(req.AvatarUrl) ? null : req.AvatarUrl;
        await _db.SaveChangesAsync();

        // Create activity for faculty profile update
        var updaterEmail = User?.FindFirstValue(ClaimTypes.Email) ?? f.Email;
        await CreateActivityForFacultyProfileUpdateAsync(f, updaterEmail, default);

        // Notify connected clients about faculty update
        await _dataUpdates.NotifyFacultyUpdated(f.Email);

        return Ok(new { ok = true });
    }

    /// <summary>
    /// Get list of students with filtering, sorting, and pagination
    /// </summary>
    /// <param name="q">Search query to filter by name or email</param>
    /// <param name="faculty">Filter by faculty name</param>
    /// <param name="program">Filter by program name</param>
    /// <param name="year">Filter by study year</param>
    /// <param name="page">Page number for pagination</param>
    /// <param name="pageSize">Number of items per page</param>
    /// <param name="sort">Sort field: 'fullName' (default), 'email', 'studyYear', or 'id'</param>
    /// <param name="order">Sort direction: 'asc' or 'desc' (default: 'asc')</param>
    /// <param name="status">Filter by student status</param>
    /// <param name="includeArchived">Include archived students in results (default: false)</param>
    /// <param name="archivedOnly">Return only archived students (default: false)</param>
    /// <returns>List of student entities with X-Total-Count header for pagination</returns>
    /// <remarks>
    /// Returns paginated list of students. Total count is provided in X-Total-Count response header.
    /// Supports filtering by faculty, program, year, status, and search query.
    /// </remarks>
    [HttpGet("/api/students")]
    [ProducesResponseType(typeof(List<StudentEntity>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Students([FromQuery] string? q, [FromQuery] string? faculty, [FromQuery] string? program, [FromQuery] int? year,
        [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? sort, [FromQuery] string? order,
        [FromQuery] string? status, [FromQuery] bool includeArchived = false, [FromQuery] bool archivedOnly = false)
    {
        var query = _db.Students.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var qq = q.Trim().ToLowerInvariant();
            query = query.Where(s => s.FullName.ToLower().Contains(qq) || s.Email.ToLower().Contains(qq));
        }
        if (!string.IsNullOrWhiteSpace(faculty)) query = query.Where(s => s.Faculty.ToLower() == faculty.ToLower());
        if (!string.IsNullOrWhiteSpace(program)) query = query.Where(s => s.Program.ToLower() == program.ToLower());
        if (year.HasValue) query = query.Where(s => s.StudyYear == year);
        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(s => (s.Status ?? string.Empty).ToLower() == normalizedStatus);
        }

        if (archivedOnly)
        {
            query = query.Where(s => s.IsArchived);
        }
        else if (!includeArchived)
        {
            query = query.Where(s => !s.IsArchived);
        }

        // Filter out non-activated students (they exist in DB but not shown in lists until activated)
        query = query.Where(s => s.IsActivated);

        // Sorting
        var sortKey = (sort ?? "fullName").ToLowerInvariant();
        var sortAsc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase) ? false : true;
        if (sortKey == "email")
            query = sortAsc ? query.OrderBy(s => s.Email) : query.OrderByDescending(s => s.Email);
        else if (sortKey == "studyyear")
            query = sortAsc ? query.OrderBy(s => s.StudyYear) : query.OrderByDescending(s => s.StudyYear);
        else if (sortKey == "id")
            query = sortAsc ? query.OrderBy(s => s.Id) : query.OrderByDescending(s => s.Id);
        else
            query = sortAsc ? query.OrderBy(s => s.FullName) : query.OrderByDescending(s => s.FullName);

        // Pagination
        var total = await query.CountAsync();
        if (page.HasValue && pageSize.HasValue && page.Value > 0 && pageSize.Value > 0)
        {
            var skip = (page.Value - 1) * pageSize.Value;
            query = query.Skip(skip).Take(pageSize.Value);
            Response.Headers["X-Total-Count"] = total.ToString();
        }

        var res = await query.ToListAsync();
        var mapped = res.Select(s => new StudentModel
        {
            Id = s.Id,
            PersonId = s.PersonId,
            FullName = s.FullName,
            Degree = s.Degree,
            GivenName = s.GivenName,
            FamilyName = s.FamilyName,
            TitlesPrefix = string.IsNullOrWhiteSpace(s.TitlesPrefixJson) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(s.TitlesPrefixJson!) ?? new List<string>(),
            TitlesSuffix = string.IsNullOrWhiteSpace(s.TitlesSuffixJson) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(s.TitlesSuffixJson!) ?? new List<string>(),
            Email = s.Email,
            Faculty = s.Faculty,
            Program = s.Program,
            StudyYear = s.StudyYear,
            IsArchived = s.IsArchived,
            // Contact information
            Phone = s.Phone,
            Phone2 = s.Phone2,
            AltEmail = s.AltEmail,
            Address = s.Address,
            // Student identifiers
            ClassName = s.ClassName,
            StudentNumber = s.StudentNumber,
            StudyNumber = s.StudyNumber,
            IsicCardNumber = s.IsicCardNumber,
            PassportId = s.PassportId,
            // Personal details
            BirthDate = s.BirthDate,
            BirthPlace = s.BirthPlace,
            Nationality = s.Nationality,
            FamilyStatus = s.FamilyStatus,
            HealthStatus = s.HealthStatus,
            ParentName = s.ParentName,
            About = s.About,
            // Academic information
            EnrollmentDate = s.EnrollmentDate,
            ProgramLevel = s.ProgramLevel,
            AwardedDegree = s.AwardedDegree,
            // Consents
            ConsentPersonalData = s.ConsentPersonalData ?? false,
            ConsentCompanyOffers = s.ConsentCompanyOffers ?? false
        });
        return Ok(mapped);
    }

    /// <summary>
    /// Get student by ID or PersonId
    /// </summary>
    /// <param name="id">Student identifier (Id or PersonId)</param>
    /// <returns>Student entity</returns>
    /// <remarks>
    /// Searches for student by:
    /// 1. Exact match on Id field
    /// 2. Exact match on PersonId field
    /// 3. Case-insensitive match on Id or PersonId
    /// Returns 404 if not found.
    /// </remarks>
    [HttpGet("/api/students/{id}")]
    [ProducesResponseType(typeof(StudentEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StudentById(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { error = "Student ID required" });

        // Try to find by Id first
        var item = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (item != null) return Ok(item);

        // If not found, try to find by PersonId
        item = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.PersonId == id);
        if (item != null) return Ok(item);

        // If still not found, try case-insensitive search
        var normalized = id.Trim().ToLowerInvariant();
        item = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s =>
            s.Id.ToLower() == normalized ||
            (!string.IsNullOrWhiteSpace(s.PersonId) && s.PersonId.ToLower() == normalized));

        return item != null ? Ok(item) : NotFound();
    }

    /// <summary>
    /// Get student by email address
    /// </summary>
    /// <param name="email">Student email address</param>
    /// <returns>Student entity</returns>
    /// <remarks>
    /// Searches for student by exact email match (case-insensitive).
    /// Returns 404 if not found.
    /// </remarks>
    [HttpGet("/api/students/by-email/{email}")]
    [ProducesResponseType(typeof(StudentEntity), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StudentByEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return BadRequest(new { error = "Email required" });
        var key = email.Trim().ToLowerInvariant();
        var item = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Email != null && s.Email.ToLower() == key);
        return item != null ? Ok(item) : NotFound();
    }

    /// <summary>
    /// Check if a course is ready for enrollment
    /// </summary>
    /// <param name="code">Course code</param>
    /// <returns>Enrollment readiness status with details</returns>
    /// <remarks>
    /// Checks if a course is ready for enrollment by verifying:
    /// - Has P (Practice) or CL (Class) schedule events for attendance tracking
    /// - Has quiz assignments created by teachers
    /// 
    /// Exception: Courses with only seminars (S) or other types (not CL/P) are considered ready without CL/P events and quiz.
    /// 
    /// Returns readiness status, flags for hasPOrClEvents, hasQuiz, and exception status, plus a descriptive message if not ready.
    /// </remarks>
    [HttpGet("/api/courses/{code}/enrollment-readiness")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetEnrollmentReadiness(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { error = "Course code required" });
        code = code.Trim().ToUpperInvariant();

        // Check for P (Practice) or CL (Class) schedule events - required for attendance tracking
        // P and CL are equivalent - either one satisfies the requirement
        var hasPOrClEvents = await _db.Timetable.AsNoTracking()
            .AnyAsync(t => t.CourseCode.ToUpper() == code &&
                          (t.Type != null && (t.Type.ToUpper() == "CL" || t.Type.ToUpper() == "P")));

        // Check for quiz assignments - need to check all teachers for this course
        // First, get all teachers who teach this course
        var teacherEmails = await _db.Timetable.AsNoTracking()
            .Where(t => t.CourseCode.ToUpper() == code)
            .Select(t => t.TeacherEmail.ToLower())
            .Distinct()
            .ToListAsync();

        var hasQuiz = false;
        if (teacherEmails.Any())
        {
            // Check if any teacher has created any assignment for this course
            // Any assignment counts as a quiz assignment (not just those with "quiz" in the name)
            hasQuiz = await _db.Assignments.AsNoTracking()
                .AnyAsync(a => teacherEmails.Contains(a.TeacherEmail.ToLower()) &&
                              a.CourseCode.ToUpper() == code);
        }

        // Check course type - exclude seminars (S) and other types except CL and P
        var scheduleEvents = await _db.Timetable.AsNoTracking()
            .Where(t => t.CourseCode.ToUpper() == code)
            .Select(t => t.Type ?? "")
            .Distinct()
            .ToListAsync();

        // Exception: if course has only seminars (S) or other types (not CL or P), it's ready without CL/P and quiz
        var hasOnlySeminarsOrOther = scheduleEvents.Any() &&
                                     !scheduleEvents.Any(t =>
                                     {
                                         var upper = t.ToUpper();
                                         return upper == "CL" || upper == "P";
                                     });

        // Course is ready if:
        // 1. It's a seminar/other type (exception - no CL/P required)
        // 2. OR it has both P or CL events (for attendance) and quiz assignment
        var isReady = hasOnlySeminarsOrOther || (hasPOrClEvents && hasQuiz);

        return Ok(new
        {
            courseCode = code,
            isReady,
            hasPOrClEvents,
            hasQuiz,
            isException = hasOnlySeminarsOrOther,
            message = !isReady
                ? (!hasPOrClEvents && !hasQuiz
                    ? "Teacher must create both P (Practice) or CL (Class) schedule events for attendance and a quiz assignment before enrollment"
                    : !hasPOrClEvents
                        ? "Teacher must create P (Practice) or CL (Class) schedule events for attendance before enrollment"
                        : "Teacher must create a quiz assignment before enrollment")
                : null
        });
    }

    /// <summary>
    /// Get list of faculty members with filtering, sorting, and pagination
    /// </summary>
    /// <param name="q">Search query to filter by name or email</param>
    /// <param name="page">Page number for pagination</param>
    /// <param name="pageSize">Number of items per page</param>
    /// <param name="sort">Sort field: 'fullName' (default), 'email', 'rating', or 'id'</param>
    /// <param name="order">Sort direction: 'asc' or 'desc' (default: 'asc')</param>
    /// <returns>List of faculty models with expanded JSON fields (departments, subjects, officeHours, workingHours) and X-Total-Count header</returns>
    /// <remarks>
    /// Returns paginated list of faculty members. Total count is provided in X-Total-Count response header.
    /// JSON fields (departments, subjects, officeHours, workingHours) are automatically expanded from JSON strings to objects/arrays.
    /// </remarks>
    [HttpGet("/api/faculty")]
    [ProducesResponseType(typeof(List<FacultyModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> FacultyList([FromQuery] string? q, [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? sort, [FromQuery] string? order)
    {
        var query = _db.Faculty.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var qq = q.Trim().ToLowerInvariant();
            query = query.Where(f => f.FullName.ToLower().Contains(qq) || f.Email.ToLower().Contains(qq));
        }

        // Filter out non-activated faculty (they exist in DB but not shown in lists until activated)
        query = query.Where(f => f.IsActivated);

        // Sorting
        var sortKey = (sort ?? "fullName").ToLowerInvariant();
        var sortAsc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase) ? false : true;
        if (sortKey == "email")
            query = sortAsc ? query.OrderBy(f => f.Email) : query.OrderByDescending(f => f.Email);
        else if (sortKey == "id")
            query = sortAsc ? query.OrderBy(f => f.Id) : query.OrderByDescending(f => f.Id);
        else
            query = sortAsc ? query.OrderBy(f => f.FullName) : query.OrderByDescending(f => f.FullName);

        var total = await query.CountAsync();
        if (page.HasValue && pageSize.HasValue && page.Value > 0 && pageSize.Value > 0)
        {
            var skip = (page.Value - 1) * pageSize.Value;
            query = query.Skip(skip).Take(pageSize.Value);
            Response.Headers["X-Total-Count"] = total.ToString();
        }

        var res = await query.ToListAsync();
        
        // Get all teacher IDs for rating calculation
        var teacherIds = res.Select(f => f.Id).ToList();
        var ratingsDict = await _db.TeacherRatings
            .Where(r => teacherIds.Contains(r.TeacherId))
            .GroupBy(r => r.TeacherId)
            .Select(g => new { TeacherId = g.Key, AverageRating = g.Average(r => r.Rating) })
            .ToDictionaryAsync(x => x.TeacherId, x => Math.Round(x.AverageRating, 2));
        
        // Map entity to model to expand JSON fields into arrays/objects
        var mapped = res.Select(f => new FacultyModel
        {
            Id = f.Id,
            Program = f.Program,
            FullName = f.FullName,
            GivenName = f.GivenName,
            FamilyName = f.FamilyName,
            TitlesPrefix = string.IsNullOrWhiteSpace(f.TitlesPrefixJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.TitlesPrefixJson!) ?? new List<string>(),
            TitlesSuffix = string.IsNullOrWhiteSpace(f.TitlesSuffixJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.TitlesSuffixJson!) ?? new List<string>(),
            Email = f.Email,
            Faculty = f.Faculty,
            Department = f.Department,
            DepartmentCode = f.DepartmentCode,
            Phone = f.Phone,
            Office = f.Office,
            Rating = ratingsDict.ContainsKey(f.Id) ? ratingsDict[f.Id] : 0.0,
            Status = f.Status,
            EmploymentType = f.EmploymentType,
            ClassesCount = f.ClassesCount,
            YearsExperience = f.YearsExperience,
            HireDate = f.HireDate,
            LastActivity = f.LastActivity,
            Departments = string.IsNullOrWhiteSpace(f.DepartmentsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.DepartmentsJson!) ?? new List<string>(),
            Subjects = string.IsNullOrWhiteSpace(f.SubjectsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.SubjectsJson!) ?? new List<string>(),
            Certifications = string.IsNullOrWhiteSpace(f.CertificationsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.CertificationsJson!),
            OfficeHours = string.IsNullOrWhiteSpace(f.OfficeHoursJson) ? new Dictionary<string, object>() : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.OfficeHoursJson!) ?? new Dictionary<string, object>(),
            WorkingHours = string.IsNullOrWhiteSpace(f.WorkingHoursJson) ? new Dictionary<string, object>() : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.WorkingHoursJson!) ?? new Dictionary<string, object>(),
            About = f.About,
            Bio = f.Bio,
            Expertise = string.IsNullOrWhiteSpace(f.ExpertiseJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.ExpertiseJson!) ?? new List<string>(),
            Publications = string.IsNullOrWhiteSpace(f.PublicationsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.PublicationsJson!),
            ResearchInterests = string.IsNullOrWhiteSpace(f.ResearchInterestsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.ResearchInterestsJson!) ?? new List<string>(),
            AcademicDegree = f.AcademicDegree,
            Languages = string.IsNullOrWhiteSpace(f.LanguagesJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.LanguagesJson!),
            SocialLinks = string.IsNullOrWhiteSpace(f.SocialLinksJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.SocialLinksJson!),
            AvatarUrl = f.AvatarUrl
        });
        return Ok(mapped);
    }

    /// <summary>
    /// Get faculty member by ID
    /// </summary>
    /// <param name="id">Faculty member identifier</param>
    /// <returns>Faculty model with expanded JSON fields</returns>
    /// <remarks>
    /// Returns faculty member details with JSON fields (departments, subjects, officeHours, workingHours) automatically expanded from JSON strings to objects/arrays.
    /// Returns 404 if not found.
    /// </remarks>
    [HttpGet("/api/faculty/{id}")]
    [ProducesResponseType(typeof(FacultyModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> FacultyById(string id)
    {
        var f = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (f == null) return NotFound();
        
        // Calculate dynamic rating from student ratings
        var avgRating = await _db.TeacherRatings
            .Where(r => r.TeacherId == id)
            .AverageAsync(r => (double?)r.Rating);
        
        var item = new FacultyModel
        {
            Id = f.Id,
            FullName = f.FullName,
            GivenName = f.GivenName,
            FamilyName = f.FamilyName,
            TitlesPrefix = string.IsNullOrWhiteSpace(f.TitlesPrefixJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.TitlesPrefixJson!) ?? new List<string>(),
            TitlesSuffix = string.IsNullOrWhiteSpace(f.TitlesSuffixJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.TitlesSuffixJson!) ?? new List<string>(),
            Email = f.Email,
            Faculty = f.Faculty,
            Program = f.Program,
            Department = f.Department,
            DepartmentCode = f.DepartmentCode,
            Phone = f.Phone,
            Office = f.Office,
            Rating = avgRating.HasValue ? Math.Round(avgRating.Value, 2) : 0.0,
            Status = f.Status,
            EmploymentType = f.EmploymentType,
            ClassesCount = f.ClassesCount,
            YearsExperience = f.YearsExperience,
            HireDate = f.HireDate,
            LastActivity = f.LastActivity,
            Departments = string.IsNullOrWhiteSpace(f.DepartmentsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.DepartmentsJson!) ?? new List<string>(),
            Subjects = string.IsNullOrWhiteSpace(f.SubjectsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.SubjectsJson!) ?? new List<string>(),
            Certifications = string.IsNullOrWhiteSpace(f.CertificationsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.CertificationsJson!),
            OfficeHours = string.IsNullOrWhiteSpace(f.OfficeHoursJson) ? new Dictionary<string, object>() : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.OfficeHoursJson!) ?? new Dictionary<string, object>(),
            WorkingHours = string.IsNullOrWhiteSpace(f.WorkingHoursJson) ? new Dictionary<string, object>() : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.WorkingHoursJson!) ?? new Dictionary<string, object>(),
            About = f.About,
            Bio = f.Bio,
            Expertise = string.IsNullOrWhiteSpace(f.ExpertiseJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.ExpertiseJson!) ?? new List<string>(),
            Publications = string.IsNullOrWhiteSpace(f.PublicationsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.PublicationsJson!),
            ResearchInterests = string.IsNullOrWhiteSpace(f.ResearchInterestsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.ResearchInterestsJson!) ?? new List<string>(),
            AcademicDegree = f.AcademicDegree,
            Languages = string.IsNullOrWhiteSpace(f.LanguagesJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.LanguagesJson!),
            SocialLinks = string.IsNullOrWhiteSpace(f.SocialLinksJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.SocialLinksJson!),
            AvatarUrl = f.AvatarUrl
        };
        return Ok(item);
    }

    /// <summary>
    /// Get faculty member by email
    /// </summary>
    /// <param name="email">Faculty member email address</param>
    /// <returns>Faculty model with expanded JSON fields</returns>
    /// <remarks>
    /// Returns faculty member details with JSON fields (departments, subjects, officeHours, workingHours) automatically expanded from JSON strings to objects/arrays.
    /// Returns 404 if not found.
    /// </remarks>
    [HttpGet("/api/faculty/by-email/{email}")]
    [ProducesResponseType(typeof(FacultyModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> FacultyByEmail(string email)
    {
        var f = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(s => s.Email.ToLower() == email.ToLower());
        if (f == null) return NotFound();
        
        // Calculate dynamic rating from student ratings
        var avgRating = await _db.TeacherRatings
            .Where(r => r.TeacherId == f.Id)
            .AverageAsync(r => (double?)r.Rating);
        
        var item = new FacultyModel
        {
            Id = f.Id,
            FullName = f.FullName,
            GivenName = f.GivenName,
            FamilyName = f.FamilyName,
            TitlesPrefix = string.IsNullOrWhiteSpace(f.TitlesPrefixJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.TitlesPrefixJson!) ?? new List<string>(),
            TitlesSuffix = string.IsNullOrWhiteSpace(f.TitlesSuffixJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.TitlesSuffixJson!) ?? new List<string>(),
            Email = f.Email,
            Faculty = f.Faculty,
            Program = f.Program,
            Department = f.Department,
            DepartmentCode = f.DepartmentCode,
            Phone = f.Phone,
            Office = f.Office,
            Rating = avgRating.HasValue ? Math.Round(avgRating.Value, 2) : 0.0,
            Status = f.Status,
            EmploymentType = f.EmploymentType,
            ClassesCount = f.ClassesCount,
            YearsExperience = f.YearsExperience,
            HireDate = f.HireDate,
            LastActivity = f.LastActivity,
            Departments = string.IsNullOrWhiteSpace(f.DepartmentsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.DepartmentsJson!) ?? new List<string>(),
            Subjects = string.IsNullOrWhiteSpace(f.SubjectsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.SubjectsJson!) ?? new List<string>(),
            Certifications = string.IsNullOrWhiteSpace(f.CertificationsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.CertificationsJson!),
            OfficeHours = string.IsNullOrWhiteSpace(f.OfficeHoursJson) ? new Dictionary<string, object>() : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.OfficeHoursJson!) ?? new Dictionary<string, object>(),
            WorkingHours = string.IsNullOrWhiteSpace(f.WorkingHoursJson) ? new Dictionary<string, object>() : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(f.WorkingHoursJson!) ?? new Dictionary<string, object>(),
            About = f.About,
            Bio = f.Bio,
            Expertise = string.IsNullOrWhiteSpace(f.ExpertiseJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.ExpertiseJson!) ?? new List<string>(),
            Publications = string.IsNullOrWhiteSpace(f.PublicationsJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.PublicationsJson!),
            ResearchInterests = string.IsNullOrWhiteSpace(f.ResearchInterestsJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(f.ResearchInterestsJson!) ?? new List<string>(),
            AcademicDegree = f.AcademicDegree,
            Languages = string.IsNullOrWhiteSpace(f.LanguagesJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.LanguagesJson!),
            SocialLinks = string.IsNullOrWhiteSpace(f.SocialLinksJson) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(f.SocialLinksJson!),
            AvatarUrl = f.AvatarUrl
        };
        return Ok(item);
    }

    /// <summary>
    /// Get list of courses with filtering, sorting, and pagination
    /// </summary>
    /// <param name="q">Search query to filter by course code or name (English or Slovak)</param>
    /// <param name="page">Page number for pagination</param>
    /// <param name="pageSize">Number of items per page</param>
    /// <param name="sort">Sort field: 'name' (default), 'code', or 'credits'</param>
    /// <param name="order">Sort direction: 'asc' or 'desc' (default: 'asc')</param>
    /// <param name="studentYear">Optional: filter courses by student's study year (shows courses for this year or lower)</param>
    /// <returns>List of course models with X-Total-Count header for pagination</returns>
    /// <remarks>
    /// Returns paginated list of courses. Total count is provided in X-Total-Count response header.
    /// Course model includes Id field set to Code for compatibility.
    /// </remarks>
    [HttpGet("/api/courses")]
    [ProducesResponseType(typeof(List<CourseModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Courses(
        [FromQuery] string? q, 
        [FromQuery] int? page, 
        [FromQuery] int? pageSize, 
        [FromQuery] string? sort, 
        [FromQuery] string? order,
        [FromQuery] int? studentYear) // Optional: filter courses by student's study year
    {
        var query = _db.Courses.AsNoTracking().AsQueryable();
        
        // Filter by student year if provided (student can only see courses for their year or lower)
        if (studentYear.HasValue && studentYear.Value > 0)
        {
            query = query.Where(c => c.RequiredYear == null || c.RequiredYear <= studentYear.Value);
        }
        
        if (!string.IsNullOrWhiteSpace(q))
        {
            var qq = q.Trim().ToLowerInvariant();
            query = query.Where(c => c.Code.ToLower().Contains(qq) || c.NameEn.ToLower().Contains(qq) || ((c.NameSk ?? "").ToLower().Contains(qq)));
        }

        var sortKey = (sort ?? "name").ToLowerInvariant();
        var sortAsc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase) ? false : true;
        if (sortKey == "code")
            query = sortAsc ? query.OrderBy(c => c.Code) : query.OrderByDescending(c => c.Code);
        else if (sortKey == "credits")
            query = sortAsc ? query.OrderBy(c => c.Credits) : query.OrderByDescending(c => c.Credits);
        else
            query = sortAsc ? query.OrderBy(c => c.NameEn) : query.OrderByDescending(c => c.NameEn);

        var total = await query.CountAsync();
        if (page.HasValue && pageSize.HasValue && page.Value > 0 && pageSize.Value > 0)
        {
            var skip = (page.Value - 1) * pageSize.Value;
            query = query.Skip(skip).Take(pageSize.Value);
            Response.Headers["X-Total-Count"] = total.ToString();
        }

        var list = await query.ToListAsync();
        // Map to model to keep Id = Code for compatibility
        var mapped = list.Select(c => new CourseModel
        {
            Id = c.Code,
            Code = c.Code,
            NameEn = c.NameEn,
            NameSk = c.NameSk,
            CompletionSk = c.CompletionSk,
            Credits = c.Credits,
            TypeSk = NormalizeTypeSk(c.TypeSk), // Auto-fix Profile values in TypeSk
            Profile = c.Profile,
            HoursSk = c.HoursSk,
            PeriodSk = c.PeriodSk,
            Faculty = c.Faculty,
            Program = c.Program,
            RequiredYear = c.RequiredYear
        });
        return Ok(mapped);
    }

    /// <summary>
    /// Get course by code
    /// </summary>
    /// <param name="code">Course code</param>
    /// <returns>Course model</returns>
    /// <remarks>
    /// Returns course details by exact code match.
    /// Course model includes Id field set to Code for compatibility.
    /// Returns 404 if not found.
    /// </remarks>
    [HttpGet("/api/courses/{code}")]
    [ProducesResponseType(typeof(CourseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CourseByCode(string code)
    {
        var c = await _db.Courses.AsNoTracking().FirstOrDefaultAsync(s => s.Code == code);
        if (c == null) return NotFound();
        var item = new CourseModel
        {
            Id = c.Code,
            Faculty = c.Faculty,
            Program = c.Program,
            Code = c.Code,
            NameEn = c.NameEn,
            NameSk = c.NameSk,
            CompletionSk = c.CompletionSk,
            Credits = c.Credits,
            TypeSk = NormalizeTypeSk(c.TypeSk), // Auto-fix Profile values in TypeSk
            Profile = c.Profile,
            HoursSk = c.HoursSk,
            PeriodSk = c.PeriodSk,
            RequiredYear = c.RequiredYear
        };
        return Ok(item);
    }

    private static bool IsOngoingStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return true;
        var normalized = status.Trim().ToLowerInvariant();
        return !(normalized.Contains("archiv") ||
                 normalized.Contains("inactive") ||
                 normalized.Contains("completed") ||
                 normalized.Contains("graduated") ||
                 normalized.Contains("finished"));
    }

    private static string BuildProgramCode(StudentEntity student)
    {
        var source = student.Program ?? student.Degree ?? student.Faculty ?? "program";
        return source.Trim().Replace(' ', '_');
    }

    private static DateTime? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateTime.TryParse(value, out var parsed)) return parsed;
        return null;
    }

    private async Task AutoDeliverDocumentsForStudentAsync(StudentEntity student, string creatorEmail, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(student.Email)) return;

        try
        {
            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == creatorEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? creatorEmail;

            foreach (var templateKey in DocumentTemplateKeys.StudentAutoDeliveryTemplates)
            {
                var model = DocumentModelFactory.CreateModel(null);
                DocumentModelFactory.ApplyStudentContext(model, student);
                var html = _documentRenderer.RenderStandardDocument(templateKey, model);
                if (string.IsNullOrWhiteSpace(html))
                {
                    continue;
                }

                var record = new DocumentRecordEntity
                {
                    Id = Guid.NewGuid().ToString("n"),
                    TemplateKey = model.TemplateKey,
                    OwnerEmail = student.Email!,
                    OwnerRole = "student",
                    Title = DocumentModelFactory.GetTemplateTitle(model.TemplateKey),
                    HtmlContent = html,
                    TeacherEmail = creatorEmail,
                    TeacherName = teacherName,
                    StudentId = student.Id,
                    StudentEmail = student.Email,
                    StudentName = student.FullName,
                    MetaJson = JsonSerializer.Serialize(model),
                    CreatedAt = DateTime.UtcNow.ToString("o"),
                    CreatedByEmail = creatorEmail
                };
                _db.Documents.Add(record);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to auto deliver documents for student {StudentId}", student.Id);
        }
    }

    private async Task CreateActivityForStudentCreationAsync(StudentEntity student, string creatorEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var creator = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == creatorEmail.ToLower(), ct);
            var creatorName = creator?.FullName ?? creatorEmail;

            var meta = new Dictionary<string, object>
            {
                ["studentId"] = student.Id,
                ["personId"] = student.PersonId ?? "",
                ["program"] = student.Program ?? "",
                ["faculty"] = student.Faculty ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Student created: {student.FullName}",
                Description = $"Program: {student.Program} • Faculty: {student.Faculty} • Year: {student.StudyYear}",
                Subject = student.Program ?? "",
                TeacherEmail = creatorEmail,
                TeacherDisplay = creatorName,
                StudentEmail = student.Email,
                StudentName = student.FullName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = creatorEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForFacultyCreationAsync(FacultyEntity faculty, string creatorEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var creator = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == creatorEmail.ToLower(), ct);
            var creatorName = creator?.FullName ?? creatorEmail;

            var meta = new Dictionary<string, object>
            {
                ["facultyId"] = faculty.Id,
                ["faculty"] = faculty.Faculty ?? "",
                ["status"] = faculty.Status ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "announcements",
                Title = $"Faculty member created: {faculty.FullName}",
                Description = $"Faculty: {faculty.Faculty} • Status: {faculty.Status}",
                Subject = faculty.Faculty ?? "",
                TeacherEmail = creatorEmail,
                TeacherDisplay = creatorName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = creatorEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForStudentProfileUpdateAsync(StudentEntity student, string updaterEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var updater = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == updaterEmail.ToLower(), ct);
            var updaterName = updater?.FullName ?? (await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Email.ToLower() == updaterEmail.ToLower(), ct))?.FullName ?? updaterEmail;

            var meta = new Dictionary<string, object>
            {
                ["studentId"] = student.Id,
                ["personId"] = student.PersonId ?? "",
                ["email"] = student.Email ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_student",
                Type = "announcements",
                Title = $"Student profile updated: {student.FullName}",
                Description = $"Profile information was updated for {student.FullName}",
                Subject = student.Program ?? "",
                TeacherEmail = updater?.Email ?? (updaterEmail.Contains("@") ? updaterEmail : null),
                TeacherDisplay = updater?.FullName ?? (updater == null ? updaterName : null),
                StudentEmail = student.Email,
                StudentName = student.FullName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = updaterEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    private async Task CreateActivityForFacultyProfileUpdateAsync(FacultyEntity faculty, string updaterEmail, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var updater = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == updaterEmail.ToLower(), ct);
            var updaterName = updater?.FullName ?? updaterEmail;

            var meta = new Dictionary<string, object>
            {
                ["facultyId"] = faculty.Id,
                ["email"] = faculty.Email ?? "",
                ["faculty"] = faculty.Faculty ?? "",
                ["status"] = faculty.Status ?? ""
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_faculty",
                Type = "announcements",
                Title = $"Faculty profile updated: {faculty.FullName}",
                Description = $"Profile information was updated for {faculty.FullName}",
                Subject = faculty.Faculty ?? "",
                TeacherEmail = faculty.Email,
                TeacherDisplay = faculty.FullName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = updaterEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception) { }
    }

    // ============ DEPARTMENTS API ============

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments(CancellationToken ct)
    {
        var departments = await _db.Departments.AsNoTracking().ToListAsync(ct);
        
        var result = departments.Select(d => new
        {
            id = d.Id,
            name = d.Name,
            code = d.Code,
            faculty = d.Faculty,
            active = d.Active,
            teachersCount = d.TeachersCount
        }).ToList();
        
        return Ok(result);
    }

    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] DepartmentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { error = "Name and Code are required" });

        if (string.IsNullOrWhiteSpace(request.Faculty))
            return BadRequest(new { error = "Faculty is required" });

        var exists = await _db.Departments.AnyAsync(d => d.Code == request.Code, ct);
        if (exists)
            return BadRequest(new { error = "Department with this code already exists" });

        var department = new DepartmentEntity
        {
            Id = $"dept_{Guid.NewGuid():N}",
            Name = request.Name,
            Code = request.Code,
            Faculty = request.Faculty,
            Active = request.Active ?? true,
            TeachersCount = 0
        };

        _db.Departments.Add(department);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = department.Id,
            name = department.Name,
            code = department.Code,
            faculty = department.Faculty,
            active = department.Active,
            teachersCount = department.TeachersCount
        });
    }

    [HttpPut("departments/{id}")]
    public async Task<IActionResult> UpdateDepartment(string id, [FromBody] DepartmentRequest request, CancellationToken ct)
    {
        var department = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (department == null)
            return NotFound(new { error = "Department not found" });

        if (!string.IsNullOrWhiteSpace(request.Name))
            department.Name = request.Name;
        if (!string.IsNullOrWhiteSpace(request.Code) && request.Code != department.Code)
        {
            var exists = await _db.Departments.AnyAsync(d => d.Code == request.Code && d.Id != id, ct);
            if (exists)
                return BadRequest(new { error = "Department with this code already exists" });
            department.Code = request.Code;
        }
        if (!string.IsNullOrWhiteSpace(request.Faculty))
            department.Faculty = request.Faculty;
        if (request.Active.HasValue)
            department.Active = request.Active.Value;

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = department.Id,
            name = department.Name,
            code = department.Code,
            faculty = department.Faculty,
            active = department.Active,
            teachersCount = department.TeachersCount
        });
    }

    [HttpDelete("departments/{id}")]
    public async Task<IActionResult> DeleteDepartment(string id, CancellationToken ct)
    {
        var department = await _db.Departments.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (department == null)
            return NotFound(new { error = "Department not found" });

        _db.Departments.Remove(department);
        await _db.SaveChangesAsync(ct);

        return Ok(new { success = true });
    }

    // ============ FACULTY OPTIONS API ============

    [HttpGet("faculty-options")]
    public async Task<IActionResult> GetFacultyOptions(CancellationToken ct)
    {
        var faculties = await _db.FacultyOptions.AsNoTracking().ToListAsync(ct);
        
        var result = faculties.Select(f => new
        {
            id = f.Id,
            code = f.Code,
            nameEn = f.NameEn,
            nameSk = f.NameSk,
            description = f.Description,
            active = f.Active
        }).ToList();
        
        return Ok(result);
    }

    [HttpPost("faculty-options")]
    public async Task<IActionResult> CreateFacultyOption([FromBody] FacultyOptionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.NameEn))
            return BadRequest(new { error = "Code and NameEn are required" });

        var exists = await _db.FacultyOptions.AnyAsync(f => f.Code == request.Code, ct);
        if (exists)
            return BadRequest(new { error = "Faculty with this code already exists" });

        var faculty = new FacultyOptionEntity
        {
            Id = $"fac_{Guid.NewGuid():N}",
            Code = request.Code,
            NameEn = request.NameEn,
            NameSk = request.NameSk ?? request.NameEn,
            Description = request.Description,
            Active = request.Active ?? true
        };

        _db.FacultyOptions.Add(faculty);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = faculty.Id,
            code = faculty.Code,
            nameEn = faculty.NameEn,
            nameSk = faculty.NameSk,
            description = faculty.Description,
            active = faculty.Active
        });
    }

    [HttpPut("faculty-options/{id}")]
    public async Task<IActionResult> UpdateFacultyOption(string id, [FromBody] FacultyOptionRequest request, CancellationToken ct)
    {
        var faculty = await _db.FacultyOptions.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (faculty == null)
            return NotFound(new { error = "Faculty not found" });

        if (!string.IsNullOrWhiteSpace(request.Code) && request.Code != faculty.Code)
        {
            var exists = await _db.FacultyOptions.AnyAsync(f => f.Code == request.Code && f.Id != id, ct);
            if (exists)
                return BadRequest(new { error = "Faculty with this code already exists" });
            faculty.Code = request.Code;
        }
        if (!string.IsNullOrWhiteSpace(request.NameEn))
            faculty.NameEn = request.NameEn;
        if (!string.IsNullOrWhiteSpace(request.NameSk))
            faculty.NameSk = request.NameSk;
        if (request.Description != null)
            faculty.Description = request.Description;
        if (request.Active.HasValue)
            faculty.Active = request.Active.Value;

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = faculty.Id,
            code = faculty.Code,
            nameEn = faculty.NameEn,
            nameSk = faculty.NameSk,
            description = faculty.Description,
            active = faculty.Active
        });
    }

    [HttpDelete("faculty-options/{id}")]
    public async Task<IActionResult> DeleteFacultyOption(string id, CancellationToken ct)
    {
        var faculty = await _db.FacultyOptions.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (faculty == null)
            return NotFound(new { error = "Faculty not found" });

        _db.FacultyOptions.Remove(faculty);
        await _db.SaveChangesAsync(ct);

        return Ok(new { success = true });
    }

    // ============ PROGRAMS API ============

    [HttpGet("programs")]
    public async Task<IActionResult> GetPrograms([FromQuery] string? faculty, [FromQuery] string? departmentId, CancellationToken ct)
    {
        var query = _db.Programs.AsNoTracking().AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(faculty))
            query = query.Where(p => p.Faculty == faculty);
        
        if (!string.IsNullOrWhiteSpace(departmentId))
            query = query.Where(p => p.DepartmentId == departmentId);
        
        var programs = await query.ToListAsync(ct);
        
        var result = programs.Select(p => new
        {
            id = p.Id,
            name = p.Name,
            code = p.Code,
            faculty = p.Faculty,
            departmentId = p.DepartmentId,
            level = p.Level,
            durationYears = p.DurationYears,
            awardedDegree = p.AwardedDegree,
            description = p.Description,
            active = p.Active
        }).ToList();
        
        return Ok(result);
    }

    [HttpPost("programs")]
    public async Task<IActionResult> CreateProgram([FromBody] ProgramRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { error = "Name and Code are required" });

        if (string.IsNullOrWhiteSpace(request.Faculty))
            return BadRequest(new { error = "Faculty is required" });

        if (string.IsNullOrWhiteSpace(request.Level))
            return BadRequest(new { error = "Level is required" });

        var exists = await _db.Programs.AnyAsync(p => p.Code == request.Code, ct);
        if (exists)
            return BadRequest(new { error = "Program with this code already exists" });

        var program = new ProgramEntity
        {
            Id = $"prog_{Guid.NewGuid():N}",
            Name = request.Name,
            Code = request.Code,
            Faculty = request.Faculty,
            DepartmentId = request.DepartmentId,
            Level = request.Level,
            Description = request.Description,
            Active = request.Active ?? true
        };

        _db.Programs.Add(program);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = program.Id,
            name = program.Name,
            code = program.Code,
            faculty = program.Faculty,
            departmentId = program.DepartmentId,
            level = program.Level,
            description = program.Description,
            active = program.Active
        });
    }

    [HttpPut("programs/{id}")]
    public async Task<IActionResult> UpdateProgram(string id, [FromBody] ProgramRequest request, CancellationToken ct)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (program == null)
            return NotFound(new { error = "Program not found" });

        if (!string.IsNullOrWhiteSpace(request.Name))
            program.Name = request.Name;
        if (!string.IsNullOrWhiteSpace(request.Code) && request.Code != program.Code)
        {
            var exists = await _db.Programs.AnyAsync(p => p.Code == request.Code && p.Id != id, ct);
            if (exists)
                return BadRequest(new { error = "Program with this code already exists" });
            program.Code = request.Code;
        }
        if (!string.IsNullOrWhiteSpace(request.Faculty))
            program.Faculty = request.Faculty;
        if (request.DepartmentId != null)
            program.DepartmentId = request.DepartmentId;
        if (!string.IsNullOrWhiteSpace(request.Level))
            program.Level = request.Level;
        if (request.Description != null)
            program.Description = request.Description;
        if (request.Active.HasValue)
            program.Active = request.Active.Value;

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = program.Id,
            name = program.Name,
            code = program.Code,
            faculty = program.Faculty,
            departmentId = program.DepartmentId,
            level = program.Level,
            description = program.Description,
            active = program.Active
        });
    }

    [HttpDelete("programs/{id}")]
    public async Task<IActionResult> DeleteProgram(string id, CancellationToken ct)
    {
        var program = await _db.Programs.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (program == null)
            return NotFound(new { error = "Program not found" });

        _db.Programs.Remove(program);
        await _db.SaveChangesAsync(ct);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Activate a user account (student or teacher) using activation token
    /// </summary>
    /// <param name="req">Activation request with email and token</param>
    /// <returns>Success response with user type and email</returns>
    /// <remarks>
    /// Activates a user account by validating the activation token.
    /// After activation, the user will appear in the system lists.
    /// Tokens expire after 7 days.
    /// </remarks>
    [AllowAnonymous]
    [HttpPost("/api/activate-account")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActivateAccount([FromBody] ActivateAccountRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Token))
            return BadRequest(new { error = "Email and activation token are required" });

        var email = req.Email.Trim().ToLowerInvariant();
        var token = req.Token.Trim();

        // Try to find student
        var student = await _db.Students.FirstOrDefaultAsync(s => 
            s.Email.ToLower() == email && 
            s.ActivationToken == token);

        if (student != null)
        {
            if (student.IsActivated)
                return BadRequest(new { error = "Account is already activated" });

            if (student.ActivationTokenExpiry.HasValue && student.ActivationTokenExpiry.Value < DateTime.UtcNow)
                return BadRequest(new { error = "Activation token has expired. Please contact the teaching staff." });

            student.IsActivated = true;
            student.ActivationToken = null;
            student.ActivationTokenExpiry = null;
            student.LastActivity = DateTime.UtcNow.ToString("o");
            await _db.SaveChangesAsync();

            return Ok(new { 
                success = true, 
                message = "Student account activated successfully",
                userType = "student",
                email = student.Email,
                fullName = student.FullName
            });
        }

        // Try to find faculty
        var faculty = await _db.Faculty.FirstOrDefaultAsync(f => 
            f.Email.ToLower() == email && 
            f.ActivationToken == token);

        if (faculty != null)
        {
            if (faculty.IsActivated)
                return BadRequest(new { error = "Account is already activated" });

            if (faculty.ActivationTokenExpiry.HasValue && faculty.ActivationTokenExpiry.Value < DateTime.UtcNow)
                return BadRequest(new { error = "Activation token has expired. Please contact the teaching staff." });

            faculty.IsActivated = true;
            faculty.ActivationToken = null;
            faculty.ActivationTokenExpiry = null;
            faculty.LastActivity = DateTime.UtcNow.ToString("o");
            await _db.SaveChangesAsync();

            return Ok(new { 
                success = true, 
                message = "Teacher account activated successfully",
                userType = "teacher",
                email = faculty.Email,
                fullName = faculty.FullName
            });
        }

        return NotFound(new { error = "Invalid activation token or email not found" });
    }

    /// <summary>
    /// Get temporary password for a newly created user (teachers only)
    /// </summary>
    /// <param name="email">User email address</param>
    /// <returns>Temporary password if available</returns>
    /// <remarks>
    /// Returns the temporary password for a user that was just created.
    /// The temporary password is cleared after the first successful login.
    /// Only accessible by teachers for administrative purposes.
    /// </remarks>
    [HttpGet("/api/users/{email}/temporary-password")]
    [Authorize(Roles = "teacher")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetTemporaryPassword(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { error = "Email is required" });
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var credential = await _db.UserCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Email.ToLower() == normalizedEmail);

        if (credential == null)
        {
            return NotFound(new { error = "User not found" });
        }

        if (string.IsNullOrWhiteSpace(credential.TemporaryPassword))
        {
            return NotFound(new { 
                error = "Temporary password not available",
                message = "The user may have already logged in or the password was manually reset"
            });
        }

        // Get user details for context
        string? fullName = null;
        string? role = credential.Role;

        if (role == "student")
        {
            var student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Email.ToLower() == normalizedEmail);
            fullName = student?.FullName;
        }
        else if (role == "teacher")
        {
            var faculty = await _db.Faculty.AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == normalizedEmail);
            fullName = faculty?.FullName;
        }

        return Ok(new
        {
            email = credential.Email,
            role = credential.Role,
            fullName = fullName,
            temporaryPassword = credential.TemporaryPassword,
            createdAt = credential.CreatedAt.ToString("o"),
            message = "This password will be cleared after the user's first login"
        });
    }

    // Helper method to generate temporary password
    private static string GenerateTemporaryPassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 8)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

}

public record DepartmentRequest(string? Name, string? Code, string? Faculty, bool? Active);
public record FacultyOptionRequest(string? Code, string? NameEn, string? NameSk, string? Description, bool? Active);
public record ProgramRequest(string? Name, string? Code, string? Faculty, string? DepartmentId, string? Level, string? Description, bool? Active);
public record ActivateAccountRequest(string? Email, string? Token);
