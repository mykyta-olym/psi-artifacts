using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;

namespace Mais.Web.Controllers;

/// <summary>
/// Request payload for user login.
/// </summary>
public record LoginRequest(string Email, string Password, bool RememberMe = false);

/// <summary>
/// Request payload for refreshing an access token pair.
/// </summary>
public class RefreshRequest
{
    public string? RefreshToken { get; set; }
}

/// <summary>
/// Represents the response payload issued after authentication.
/// </summary>
public record LoginResponse(string AccessToken, string RefreshToken, object User);

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;
    private readonly ISimplePasswordHasher _hasher;
    private readonly TokenValidationParameters _tokenValidationParameters;
    private readonly ILogger<AuthController> _logger;
    private readonly IEmailService _emailService;
    private readonly IDataUpdateService _dataUpdates;
    private const string RefreshCookieName = "mais.refresh";

    public AuthController(
        IConfiguration config,
        AppDbContext db,
        ISimplePasswordHasher hasher,
        TokenValidationParameters tokenValidationParameters,
        ILogger<AuthController> logger,
        IEmailService emailService,
        IDataUpdateService dataUpdates)
    {
        _config = config;
        _db = db;
        _hasher = hasher;
        _tokenValidationParameters = tokenValidationParameters;
        _logger = logger;
        _emailService = emailService;
        _dataUpdates = dataUpdates;
    }

    private CookieOptions BuildRefreshCookieOptions(bool persistent)
    {
        var secure = HttpContext.Request.IsHttps;
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = secure ? SameSiteMode.None : SameSiteMode.Lax,
            Path = "/api/auth",
            Expires = persistent ? DateTimeOffset.UtcNow.AddDays(30) : null,
            MaxAge = persistent ? TimeSpan.FromDays(30) : null,
            IsEssential = true
        };
    }

    private void WriteRefreshCookie(string refreshToken, bool persistent)
    {
        Response.Cookies.Append(RefreshCookieName, refreshToken, BuildRefreshCookieOptions(persistent));
    }

    private void ClearRefreshCookie()
    {
        Response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            Path = "/api/auth",
            SameSite = SameSiteMode.Lax,
            Secure = HttpContext.Request.IsHttps
        });
    }

    /// <summary>
    /// Authenticates the supplied credentials and returns a JWT access token together with a refresh token.
    /// </summary>
    /// <param name="req">Login request containing email, password, and optional RememberMe flag</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Login response with access token, refresh token, and user information</returns>
    /// <remarks>
    /// This endpoint is publicly accessible (no authentication required).
    /// On successful login:
    /// - Returns JWT access token (short-lived, typically 15-60 minutes)
    /// - Returns refresh token (long-lived if RememberMe=true, otherwise session-based)
    /// - Sets refresh token as HTTP-only cookie for automatic session management
    /// - Updates LastLoginAt timestamp for the user
    /// 
    /// The refresh token cookie is set with appropriate security flags (HttpOnly, Secure in HTTPS, SameSite).
    /// </remarks>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
        {
            _logger.LogWarning("Login attempt with empty email or password");
            return Unauthorized(new ProblemDetails { Title = "Invalid credentials" });
        }

        var email = req.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();
        _logger.LogInformation("Login attempt for {Email} (normalized: {NormalizedEmail})", email, normalizedEmail);
        
        var cred = await _db.UserCredentials.FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail, cancellationToken);

        if (cred == null)
        {
            _logger.LogWarning("No credentials found for {Email}", normalizedEmail);
            return Unauthorized(new ProblemDetails { Title = "Invalid credentials" });
        }
        
        _logger.LogInformation("Found credentials for {Email}, stored email: {StoredEmail}, hash length: {HashLength}", 
            normalizedEmail, cred.Email, cred.PasswordHash?.Length ?? 0);
        
        var passwordValid = _hasher.Verify(req.Password, cred.PasswordHash ?? string.Empty);
        _logger.LogInformation("Password verification for {Email}: {Result}", normalizedEmail, passwordValid ? "SUCCESS" : "FAILED");
        
        if (!passwordValid)
        {
            return Unauthorized(new ProblemDetails { Title = "Invalid credentials" });
        }

        var role = string.IsNullOrWhiteSpace(cred.Role) ? "student" : cred.Role;
        try
        {
            cred.LastLoginAt = DateTime.UtcNow;
            // Clear temporary password after first successful login
            if (!string.IsNullOrWhiteSpace(cred.TemporaryPassword))
            {
                cred.TemporaryPassword = null;
                _logger.LogInformation("Cleared temporary password for {Email} after first login", email);
            }
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Failed to update LastLoginAt for {Email}", email);
            _db.Entry(cred).State = EntityState.Unchanged;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error updating LastLoginAt for {Email}", email);
            _db.Entry(cred).State = EntityState.Unchanged;
        }

        var persistent = req.RememberMe;
        var (access, refresh) = IssueTokens(email, role, persistent);
        var userPayload = await BuildUserPayloadAsync(email, role, cancellationToken);

        WriteRefreshCookie(refresh, persistent);

        // Create activity for login (only for teachers)
        if (role == "teacher")
        {
            _logger.LogInformation("Creating login activity for teacher {Email}", email);
            await CreateActivityForLoginAsync(email, role, cancellationToken);
        }
        else
        {
            _logger.LogDebug("Skipping login activity creation for non-teacher role: {Role}", role);
        }

        // Create device session for all users
        await CreateOrUpdateDeviceSessionAsync(email, cancellationToken);

        return Ok(new LoginResponse(access, refresh, userPayload));
    }

    /// <summary>
    /// Exchanges a valid refresh token for a fresh access token pair.
    /// </summary>
    /// <param name="req">Refresh request containing refresh token (optional, can also be read from cookie)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>New login response with fresh access token, new refresh token, and user information</returns>
    /// <remarks>
    /// This endpoint is publicly accessible (no authentication required).
    /// The refresh token can be provided either:
    /// - In the request body (RefreshToken field)
    /// - As an HTTP-only cookie (mais.refresh)
    /// 
    /// On successful refresh:
    /// - Validates the refresh token
    /// - Issues new access and refresh tokens
    /// - Updates the refresh token cookie
    /// - Returns user information
    /// 
    /// The refresh token must be valid and not expired. Token rotation is performed (new refresh token issued).
    /// </remarks>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshRequest req, CancellationToken cancellationToken)
    {
        var refreshToken = string.IsNullOrWhiteSpace(req.RefreshToken)
            ? Request.Cookies[RefreshCookieName]
            : req.RefreshToken;

        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Unauthorized(new ProblemDetails { Title = "Refresh token missing" });
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var parameters = _tokenValidationParameters.Clone();
            var principal = handler.ValidateToken(refreshToken, parameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwt ||
                !jwt.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.OrdinalIgnoreCase))
            {
                return Unauthorized(new ProblemDetails { Title = "Invalid refresh token" });
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            if (!string.Equals(tokenType, "refresh", StringComparison.OrdinalIgnoreCase))
            {
                return Unauthorized(new ProblemDetails { Title = "Invalid refresh token" });
            }

            var email = principal.FindFirst(ClaimTypes.Email)?.Value;
            var role = principal.FindFirst(ClaimTypes.Role)?.Value ?? "student";
            if (string.IsNullOrWhiteSpace(email))
            {
                return Unauthorized(new ProblemDetails { Title = "Invalid refresh token" });
            }

            var persistentClaim = string.Equals(principal.FindFirst("persistent")?.Value, "1", StringComparison.OrdinalIgnoreCase);
            var (access, newRefresh) = IssueTokens(email, role, persistentClaim);
            var userPayload = await BuildUserPayloadAsync(email, role, cancellationToken);
            WriteRefreshCookie(newRefresh, persistentClaim);
            
            // Update device session on refresh
            await CreateOrUpdateDeviceSessionAsync(email, cancellationToken);
            
            return Ok(new LoginResponse(access, newRefresh, userPayload));
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "Refresh token validation failed");
            return Unauthorized(new ProblemDetails { Title = "Invalid or expired refresh token" });
        }
    }

    /// <summary>
    /// Terminates the current session (clients should discard tokens client-side as well).
    /// </summary>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Clears the refresh token cookie on the server.
    /// Clients should also discard access and refresh tokens stored client-side.
    /// Note: Access tokens cannot be revoked server-side (stateless JWT), but they will expire naturally.
    /// </remarks>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Logout()
    {
        ClearRefreshCookie();
        return NoContent();
    }

    /// <summary>
    /// Attempts to rehydrate the current session using the refresh token cookie.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Login response with fresh tokens if session is valid, otherwise 401</returns>
    /// <remarks>
    /// This endpoint is publicly accessible (no authentication required).
    /// Used to check if a user has a valid session and restore it on page load.
    /// 
    /// Behavior:
    /// - Reads refresh token from HTTP-only cookie
    /// - If valid, issues new tokens and returns user information
    /// - If invalid or missing, returns 401 and clears the cookie
    /// 
    /// This is typically called on application startup to restore user session.
    /// </remarks>
    [HttpGet("session")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Session(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[RefreshCookieName];
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Unauthorized(new ProblemDetails { Title = "No active session" });
        }

        var refreshRequest = new RefreshRequest { RefreshToken = refreshToken };
        var result = await Refresh(refreshRequest, cancellationToken);
        if (result.Result is UnauthorizedObjectResult || result.Result is UnauthorizedResult)
        {
            ClearRefreshCookie();
        }

        return result;
    }

    private (string access, string refresh) IssueTokens(string email, string role, bool persistent)
    {
        var issuer = _config.GetValue<string>("Jwt:Issuer") ?? "mais.local";
        var audience = _config.GetValue<string>("Jwt:Audience") ?? "mais.local";
        var key = _config.GetValue<string>("Jwt:Key") ?? "dev-super-secret-key-change-me-please-32bytes";
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;

        var accessClaims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("token_type", "access")
        };

        var accessToken = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: accessClaims,
            notBefore: now.AddSeconds(-10),
            expires: now.AddMinutes(30),
            signingCredentials: creds
        );

        var refreshClaims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("token_type", "refresh"),
            new("persistent", persistent ? "1" : "0")
        };

        var refreshToken = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: refreshClaims,
            notBefore: now.AddSeconds(-10),
            expires: now.AddDays(persistent ? 30 : 1),
            signingCredentials: creds
        );

        var handler = new JwtSecurityTokenHandler();
        return (handler.WriteToken(accessToken), handler.WriteToken(refreshToken));
    }

    private async Task<object> BuildUserPayloadAsync(string email, string role, CancellationToken cancellationToken)
    {
        var normalized = email.ToLowerInvariant();
        string fullName = email;
        string? entityId = null;

        if (string.Equals(role, "teacher", StringComparison.OrdinalIgnoreCase))
        {
            var faculty = await _db.Faculty.AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == normalized, cancellationToken);
            fullName = faculty?.FullName ?? email;
            entityId = faculty?.Id;
        }
        else
        {
            var student = await _db.Students.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Email.ToLower() == normalized, cancellationToken);
            fullName = student?.FullName ?? email;
            entityId = student?.Id;
        }

        var creds = await _db.UserCredentials.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email.ToLower() == normalized, cancellationToken);

        return new
        {
            id = entityId ?? creds?.Email ?? Guid.NewGuid().ToString("N"),
            email,
            role,
            fullName,
            lastLoginAt = creds?.LastLoginAt?.ToString("o")
        };
    }

    private string GenerateResetToken(string email)
    {
        var issuer = _config.GetValue<string>("Jwt:Issuer") ?? "mais.local";
        var audience = _config.GetValue<string>("Jwt:Audience") ?? "mais.local";
        var key = _config.GetValue<string>("Jwt:Key") ?? "dev-super-secret-key-change-me-please-32bytes";
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(ClaimTypes.Email, email),
            new("token_type", "password_reset"),
            new("purpose", "password_reset")
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(15), // 15 minutes expiry
            signingCredentials: creds
        );

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(token);
    }

    private string GenerateResetCode()
    {
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[4];
        rng.GetBytes(bytes);
        var code = BitConverter.ToUInt32(bytes, 0) % 1000000;
        return code.ToString("D6");
    }

    private string MaskEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return email;
        var parts = email.Split('@');
        var name = parts[0];
        var domain = parts[1];
        if (name.Length <= 2) return email;
        var shown = name.Substring(0, 2);
        var hidden = new string('*', Math.Max(1, name.Length - 2));
        return $"{shown}{hidden}@{domain}";
    }

    /// <summary>
    /// Request a password reset. Generates a reset token and 6-digit code.
    /// </summary>
    [HttpPost("forgot-password/request")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RequestPasswordReset([FromBody] ForgotPasswordRequestRequest req, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
        {
            return BadRequest(new ProblemDetails { Title = "Email is required" });
        }

        var email = req.Email.Trim().ToLowerInvariant();
        var cred = await _db.UserCredentials.FirstOrDefaultAsync(x => x.Email.ToLower() == email, cancellationToken);

        // Always return success to prevent email enumeration
        // In production, you might want to rate limit this endpoint
        if (cred == null)
        {
            await Task.Delay(500, cancellationToken); // Simulate processing time
            return Ok(new
            {
                maskedEmail = MaskEmail(email),
                token = "",
                code = "",
                expiresAt = DateTime.UtcNow.AddMinutes(15).ToString("o")
            });
        }

        // Invalidate any existing reset requests for this email
        var existing = await _db.PasswordResets
            .Where(r => r.Email == email && !r.Used && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(cancellationToken);
        foreach (var ex in existing)
        {
            ex.Used = true;
        }

        var token = GenerateResetToken(email);
        var code = GenerateResetCode();
        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        var reset = new PasswordResetEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            Email = email,
            Token = token,
            Code = code,
            ExpiresAt = expiresAt,
            Used = false,
            Attempts = 0,
            CreatedAt = DateTime.UtcNow
        };

        _db.PasswordResets.Add(reset);
        await _db.SaveChangesAsync(cancellationToken);

        // Send email with token link and code
        var emailSent = await _emailService.SendPasswordResetEmailAsync(email, code, token, cancellationToken);
        if (emailSent)
        {
            _logger.LogInformation("Password reset email sent to {Email}", email);
        }
        else
        {
            _logger.LogWarning("Password reset requested for {Email}. Code: {Code} (email not sent - SMTP not configured)", email, code);
        }

        return Ok(new
        {
            maskedEmail = MaskEmail(email),
            token = token,
            code = emailSent ? "" : code, // Only return code if email wasn't sent (for development/testing)
            expiresAt = expiresAt.ToString("o")
        });
    }

    /// <summary>
    /// Resend password reset code.
    /// </summary>
    [HttpPost("forgot-password/resend")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendPasswordReset([FromBody] ForgotPasswordRequestRequest req, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
        {
            return BadRequest(new ProblemDetails { Title = "Email is required" });
        }

        var email = req.Email.Trim().ToLowerInvariant();
        var cred = await _db.UserCredentials.FirstOrDefaultAsync(x => x.Email.ToLower() == email, cancellationToken);

        if (cred == null)
        {
            await Task.Delay(500, cancellationToken);
            return Ok(new
            {
                maskedEmail = MaskEmail(email),
                token = "",
                code = "",
                expiresAt = DateTime.UtcNow.AddMinutes(15).ToString("o")
            });
        }

        // Invalidate existing resets
        var existing = await _db.PasswordResets
            .Where(r => r.Email == email && !r.Used && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(cancellationToken);
        foreach (var ex in existing)
        {
            ex.Used = true;
        }

        var token = GenerateResetToken(email);
        var code = GenerateResetCode();
        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        var reset = new PasswordResetEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            Email = email,
            Token = token,
            Code = code,
            ExpiresAt = expiresAt,
            Used = false,
            Attempts = 0,
            CreatedAt = DateTime.UtcNow
        };

        _db.PasswordResets.Add(reset);
        await _db.SaveChangesAsync(cancellationToken);

        // Send email with token link and code
        var emailSent = await _emailService.SendPasswordResetEmailAsync(email, code, token, cancellationToken);
        if (emailSent)
        {
            _logger.LogInformation("Password reset email resent to {Email}", email);
        }
        else
        {
            _logger.LogWarning("Password reset code resent for {Email}. Code: {Code} (email not sent - SMTP not configured)", email, code);
        }

        return Ok(new
        {
            maskedEmail = MaskEmail(email),
            token = token,
            code = emailSent ? "" : code, // Only return code if email wasn't sent (for development/testing)
            expiresAt = expiresAt.ToString("o")
        });
    }

    /// <summary>
    /// Verify a password reset token (from link).
    /// </summary>
    [HttpPost("forgot-password/verify-token")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyResetToken([FromBody] VerifyResetTokenRequest req, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(req.Token))
        {
            return BadRequest(new ProblemDetails { Title = "Token is required" });
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var parameters = _tokenValidationParameters.Clone();
            var principal = handler.ValidateToken(req.Token, parameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwt ||
                !jwt.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid token" });
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            var purpose = principal.FindFirst("purpose")?.Value;
            if (!string.Equals(tokenType, "password_reset", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(purpose, "password_reset", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid token type" });
            }

            var email = principal.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid token" });
            }

            // Check if reset exists and is valid
            var reset = await _db.PasswordResets
                .FirstOrDefaultAsync(r => r.Email == email.ToLowerInvariant() && r.Token == req.Token && !r.Used && r.ExpiresAt > DateTime.UtcNow, cancellationToken);

            if (reset == null)
            {
                return BadRequest(new ProblemDetails { Title = "Token is invalid or expired" });
            }

            return Ok(new { valid = true, email = email });
        }
        catch (SecurityTokenException)
        {
            return BadRequest(new ProblemDetails { Title = "Token is invalid or expired" });
        }
    }

    /// <summary>
    /// Verify a password reset code (6-digit OTP).
    /// </summary>
    [HttpPost("forgot-password/verify-code")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyResetCode([FromBody] VerifyResetCodeRequest req, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Code))
        {
            return BadRequest(new ProblemDetails { Title = "Email and code are required" });
        }

        var email = req.Email.Trim().ToLowerInvariant();
        var code = req.Code.Trim();

        if (code.Length != 6 || !code.All(char.IsDigit))
        {
            return BadRequest(new ProblemDetails { Title = "Invalid code format" });
        }

        var reset = await _db.PasswordResets
            .Where(r => r.Email == email && r.Code == code && !r.Used && r.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (reset == null)
        {
            // Increment attempts for any recent resets to prevent brute force
            var recentResets = await _db.PasswordResets
                .Where(r => r.Email == email && !r.Used && r.ExpiresAt > DateTime.UtcNow && r.CreatedAt > DateTime.UtcNow.AddMinutes(-30))
                .ToListAsync(cancellationToken);
            foreach (var r in recentResets)
            {
                r.Attempts++;
            }
            if (recentResets.Count > 0)
            {
                await _db.SaveChangesAsync(cancellationToken);
            }

            return BadRequest(new ProblemDetails { Title = "Invalid or expired code" });
        }

        // Code is valid - return the token for password reset
        return Ok(new
        {
            token = reset.Token,
            email = email
        });
    }

    /// <summary>
    /// Reset password using a valid token.
    /// </summary>
    [HttpPost("forgot-password/reset")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.NewPassword))
        {
            return BadRequest(new ProblemDetails { Title = "Token and new password are required" });
        }

        // Validate password strength
        if (req.NewPassword.Length < 8)
        {
            return BadRequest(new ProblemDetails { Title = "Password must be at least 8 characters long" });
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var parameters = _tokenValidationParameters.Clone();
            var principal = handler.ValidateToken(req.Token, parameters, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwt ||
                !jwt.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid token" });
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            var purpose = principal.FindFirst("purpose")?.Value;
            if (!string.Equals(tokenType, "password_reset", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(purpose, "password_reset", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid token type" });
            }

            var email = principal.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new ProblemDetails { Title = "Invalid token" });
            }

            var normalizedEmail = email.ToLowerInvariant();

            // Verify reset exists and is valid
            var reset = await _db.PasswordResets
                .FirstOrDefaultAsync(r => r.Email == normalizedEmail && r.Token == req.Token && !r.Used && r.ExpiresAt > DateTime.UtcNow, cancellationToken);

            if (reset == null)
            {
                return BadRequest(new ProblemDetails { Title = "Token is invalid or expired" });
            }

            // Update password
            var cred = await _db.UserCredentials.FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail, cancellationToken);
            if (cred == null)
            {
                return BadRequest(new ProblemDetails { Title = "User not found" });
            }

            cred.PasswordHash = _hasher.Hash(req.NewPassword);
            reset.Used = true;

            // If signOutAll is true, invalidate all refresh tokens (in a real system, you'd track these)
            // For now, we just mark the reset as used

            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Password reset completed for {Email}", email);

            return Ok(new { success = true, message = "Password has been reset successfully" });
        }
        catch (SecurityTokenException)
        {
            return BadRequest(new ProblemDetails { Title = "Token is invalid or expired" });
        }
    }

    private async Task CreateActivityForLoginAsync(string email, string role, CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var thirtySecondsAgo = now.AddSeconds(-30).ToString("o");

            // Check if login activity was already created in the last 30 seconds to prevent duplicates
            var recentLogin = await _db.Activities
                .AsNoTracking()
                .Where(a => a.TeacherEmail != null && a.TeacherEmail.ToLower() == email.ToLower()
                    && a.Type == "system"
                    && a.Subject == "Authentication"
                    && string.Compare(a.Timestamp, thirtySecondsAgo) > 0)
                .FirstOrDefaultAsync(ct);

            if (recentLogin != null)
            {
                _logger.LogDebug("Login activity already exists for {Email} within last 30 seconds (ID: {ActivityId}, created at {Timestamp}), skipping duplicate", email, recentLogin.Id, recentLogin.Timestamp);
                return;
            }

            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == email.ToLower(), ct);
            var teacherName = teacher?.FullName ?? email;

            var meta = new Dictionary<string, object>
            {
                ["email"] = email,
                ["role"] = role,
                ["loginTime"] = now.ToString("o")
            };
            var activity = new ActivityEntity
            {
                Id = $"{activityId}_login",
                Type = "system",
                Title = $"Teacher logged in: {teacherName}",
                Description = $"Login at {now:yyyy-MM-dd HH:mm:ss} UTC",
                Subject = "Authentication",
                TeacherEmail = email, // Store original email (not normalized) to match existing data
                TeacherDisplay = teacherName,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)),
                CreatedByEmail = email, // Store original email
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Created login activity for {Email} with ID {ActivityId}", email, activity.Id);

            // Notify via SignalR
            await _dataUpdates.NotifyActivityCreatedAsync(email, activity.Id, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create activity for login {Email}", email);
        }
    }

    private async Task CreateOrUpdateDeviceSessionAsync(string userId, CancellationToken ct)
    {
        try
        {
            var userAgent = Request.Headers.UserAgent.ToString();
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            
            // Parse User-Agent for browser and OS info
            var browser = ExtractBrowser(userAgent);
            var os = ExtractOS(userAgent);
            var deviceType = ExtractDeviceType(userAgent);
            var deviceName = $"{browser} • {os}";
            
            // Mark all existing sessions as not current
            var existingSessions = await _db.DeviceSessions
                .Where(d => d.UserId == userId)
                .ToListAsync(ct);
            
            foreach (var session in existingSessions)
            {
                session.IsCurrent = false;
            }
            
            // Create new session
            var newSession = new DeviceSessionEntity
            {
                Id = Guid.NewGuid().ToString("N"),
                UserId = userId,
                DeviceName = deviceName,
                DeviceType = deviceType,
                Browser = browser,
                Os = os,
                IpAddress = ipAddress,
                Location = "Unknown", // Can be enhanced with IP geolocation
                LastActivity = DateTime.UtcNow.ToString("o"),
                CreatedAt = DateTime.UtcNow.ToString("o"),
                IsCurrent = true
            };
            
            _db.DeviceSessions.Add(newSession);
            await _db.SaveChangesAsync(ct);
            
            _logger.LogDebug("Created device session {SessionId} for user {UserId}", newSession.Id, userId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create device session for {UserId}", userId);
        }
    }

    private static string ExtractBrowser(string userAgent)
    {
        if (userAgent.Contains("Edg/")) return "Edge";
        if (userAgent.Contains("Chrome/")) return "Chrome";
        if (userAgent.Contains("Safari/") && !userAgent.Contains("Chrome")) return "Safari";
        if (userAgent.Contains("Firefox/")) return "Firefox";
        if (userAgent.Contains("Opera/") || userAgent.Contains("OPR/")) return "Opera";
        return "Unknown";
    }

    private static string ExtractOS(string userAgent)
    {
        if (userAgent.Contains("Windows NT 10.0")) return "Windows 10/11";
        if (userAgent.Contains("Windows NT")) return "Windows";
        if (userAgent.Contains("Mac OS X")) return "macOS";
        if (userAgent.Contains("iPhone")) return "iOS";
        if (userAgent.Contains("iPad")) return "iPadOS";
        if (userAgent.Contains("Android")) return "Android";
        if (userAgent.Contains("Linux")) return "Linux";
        return "Unknown";
    }

    private static string ExtractDeviceType(string userAgent)
    {
        if (userAgent.Contains("Mobile") || userAgent.Contains("iPhone")) return "Mobile";
        if (userAgent.Contains("iPad") || userAgent.Contains("Tablet")) return "Tablet";
        return "Desktop";
    }
}

public record ForgotPasswordRequestRequest(string Email);
public record VerifyResetTokenRequest(string Token);
public record VerifyResetCodeRequest(string Email, string Code);
public record ResetPasswordRequest(string Token, string NewPassword, bool SignOutAll = true);
