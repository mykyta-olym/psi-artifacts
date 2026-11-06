using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;

namespace Mais.Web.Controllers;

/// <summary>
/// Utility endpoints to help developers retrieve activation and reset tokens when email delivery is unavailable.
/// </summary>
[ApiController]
[Route("api")]
public class DevToolsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<DevToolsController> _logger;

    public DevToolsController(AppDbContext db, ILogger<DevToolsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Developer helper endpoint to retrieve activation tokens for faculty or student accounts.
    /// </summary>
    /// <param name="email">Account email (required).</param>
    /// <param name="scope">Account scope: faculty (default) or student.</param>
    [HttpGet("activation-token")]
    [Authorize(Policy = "RequireTeacher")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetActivationToken([FromQuery] string? email, [FromQuery] string scope = "faculty")
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new { error = "Email is required" });
        }

        var normalized = email.Trim().ToLowerInvariant();
        var normalizedScope = scope.Trim().ToLowerInvariant();

        if (normalizedScope == "student")
        {
            var student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Email.ToLower() == normalized || (s.AltEmail != null && s.AltEmail.ToLower() == normalized));
            if (student == null)
            {
                return NotFound(new { error = "Student not found" });
            }

            _logger.LogInformation("Activation token requested for student {Email} by {Requester}", student.Email, User?.FindFirstValue(ClaimTypes.Email) ?? "unknown");
            return Ok(new
            {
                email = student.Email,
                isActivated = student.IsActivated,
                activationToken = student.ActivationToken,
                activationTokenExpiry = student.ActivationTokenExpiry
            });
        }

        var faculty = await _db.Faculty.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Email.ToLower() == normalized);
        if (faculty == null)
        {
            return NotFound(new { error = "Faculty not found" });
        }

        _logger.LogInformation("Activation token requested for faculty {Email} by {Requester}", faculty.Email, User?.FindFirstValue(ClaimTypes.Email) ?? "unknown");
        return Ok(new
        {
            email = faculty.Email,
            isActivated = faculty.IsActivated,
            activationToken = faculty.ActivationToken,
            activationTokenExpiry = faculty.ActivationTokenExpiry
        });
    }

    /// <summary>
    /// Developer helper endpoint to list recent password reset tokens/codes for a user.
    /// </summary>
    /// <param name="email">Account email (required).</param>
    /// <param name="cancellationToken">Cancellation token passed from the HTTP pipeline.</param>
    [HttpGet("auth/forgot-password/tokens")]
    [Authorize(Policy = "RequireTeacher")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPasswordResetTokens([FromQuery] string email, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new ProblemDetails { Title = "Email is required" });
        }

        var normalized = email.Trim().ToLowerInvariant();

        var resets = await _db.PasswordResets
            .AsNoTracking()
            .Where(r => r.Email == normalized)
            .OrderByDescending(r => r.CreatedAt)
            .Take(10)
            .Select(r => new
            {
                email = r.Email,
                token = r.Token,
                code = r.Code,
                expiresAt = r.ExpiresAt.ToString("o"),
                used = r.Used,
                attempts = r.Attempts,
                createdAt = r.CreatedAt.ToString("o")
            })
            .ToListAsync(cancellationToken);

        if (resets.Count == 0)
        {
            return NotFound(new ProblemDetails { Title = "No password reset requests found for this email" });
        }

        _logger.LogInformation("Password reset tokens requested for {Email} by {Requester}", normalized, User?.FindFirstValue(ClaimTypes.Email) ?? "unknown");

        return Ok(new
        {
            email = normalized,
            tokens = resets
        });
    }
}
