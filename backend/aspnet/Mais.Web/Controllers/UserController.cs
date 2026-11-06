using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Services;
using System.Security.Claims;

namespace Mais.Web.Controllers;

/// <summary>
/// Request payload for changing password.
/// </summary>
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>
/// Controller for user account management operations.
/// </summary>
[ApiController]
[Route("api/users")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISimplePasswordHasher _hasher;
    private readonly ILogger<UserController> _logger;

    public UserController(
        AppDbContext db,
        ISimplePasswordHasher hasher,
        ILogger<UserController> logger)
    {
        _db = db;
        _hasher = hasher;
        _logger = logger;
    }

    /// <summary>
    /// Change user password.
    /// </summary>
    /// <param name="request">Change password request with current and new password</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Success or error response</returns>
    /// <remarks>
    /// POST /api/users/change-password
    /// 
    /// Validates current password, checks new password strength, and updates the password hash.
    /// Updates LastPasswordChange timestamp for tracking.
    /// </remarks>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new { message = "User not authenticated" });
        }

        // Validate input
        if (string.IsNullOrWhiteSpace(request.CurrentPassword))
        {
            return BadRequest(new { message = "Current password is required" });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "New password is required" });
        }

        if (request.NewPassword.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters long" });
        }

        // Check password strength
        if (!IsPasswordStrong(request.NewPassword))
        {
            return BadRequest(new 
            { 
                message = "Password must contain uppercase, lowercase, and number" 
            });
        }

        if (request.CurrentPassword == request.NewPassword)
        {
            return BadRequest(new { message = "New password must be different from current password" });
        }

        // Find user credential
        var userCredential = await _db.UserCredentials
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (userCredential == null)
        {
            return NotFound(new { message = "User credentials not found" });
        }

        // Verify current password
        if (string.IsNullOrWhiteSpace(userCredential.PasswordHash) || 
            !_hasher.Verify(request.CurrentPassword, userCredential.PasswordHash))
        {
            _logger.LogWarning("Failed password change attempt for {Email}", email);
            return BadRequest(new { message = "Current password is incorrect" });
        }

        // Update password in UserCredentials
        userCredential.PasswordHash = _hasher.Hash(request.NewPassword);

        // Update LastPasswordChange in Student or Faculty table
        var student = await _db.Students
            .FirstOrDefaultAsync(s => s.Email == email, cancellationToken);

        if (student != null)
        {
            student.LastPasswordChange = DateTime.UtcNow;
            
            // Mark first login as completed if not already
            if (!student.FirstLoginCompleted)
            {
                student.FirstLoginCompleted = true;
            }

            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Password changed successfully for student {Email}", email);
            return Ok(new { message = "Password changed successfully" });
        }

        var faculty = await _db.Faculty
            .FirstOrDefaultAsync(f => f.Email == email, cancellationToken);

        if (faculty != null)
        {
            faculty.LastPasswordChange = DateTime.UtcNow;
            
            // Mark first login as completed if not already
            if (!faculty.FirstLoginCompleted)
            {
                faculty.FirstLoginCompleted = true;
            }

            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Password changed successfully for faculty {Email}", email);
            return Ok(new { message = "Password changed successfully" });
        }

        // If user is neither student nor faculty, just update credential
        await _db.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation("Password changed successfully for user {Email}", email);
        return Ok(new { message = "Password changed successfully" });
    }

    /// <summary>
    /// Check if user should be prompted to change password (first login after activation).
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Object with shouldChangePassword flag</returns>
    /// <remarks>
    /// GET /api/users/password-status
    /// 
    /// Returns true if user has not completed first login (should see toast notification).
    /// </remarks>
    [HttpGet("password-status")]
    public async Task<IActionResult> GetPasswordStatus(CancellationToken cancellationToken = default)
    {
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.IsNullOrWhiteSpace(email))
        {
            return Unauthorized(new { message = "User not authenticated" });
        }

        // Check student
        var student = await _db.Students
            .Where(s => s.Email == email)
            .Select(s => new { s.FirstLoginCompleted, s.LastPasswordChange, s.ActivationToken })
            .FirstOrDefaultAsync(cancellationToken);

        if (student != null)
        {
            return Ok(new 
            { 
                shouldChangePassword = !student.FirstLoginCompleted,
                lastPasswordChange = student.LastPasswordChange,
                isActivated = string.IsNullOrWhiteSpace(student.ActivationToken)
            });
        }

        // Check faculty
        var faculty = await _db.Faculty
            .Where(f => f.Email == email)
            .Select(f => new { f.FirstLoginCompleted, f.LastPasswordChange, f.ActivationToken })
            .FirstOrDefaultAsync(cancellationToken);

        if (faculty != null)
        {
            return Ok(new 
            { 
                shouldChangePassword = !faculty.FirstLoginCompleted,
                lastPasswordChange = faculty.LastPasswordChange,
                isActivated = string.IsNullOrWhiteSpace(faculty.ActivationToken)
            });
        }

        return NotFound(new { message = "User not found" });
    }

    /// <summary>
    /// Validates password strength.
    /// </summary>
    private bool IsPasswordStrong(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            return false;

        bool hasUpper = password.Any(char.IsUpper);
        bool hasLower = password.Any(char.IsLower);
        bool hasDigit = password.Any(char.IsDigit);

        return hasUpper && hasLower && hasDigit;
    }
}
