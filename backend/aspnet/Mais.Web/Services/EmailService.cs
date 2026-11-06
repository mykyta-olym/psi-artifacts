using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Mais.Web.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;
    private readonly string? _smtpHost;
    private readonly int _smtpPort;
    private readonly string? _smtpUsername;
    private readonly string? _smtpPassword;
    private readonly bool _smtpUseSsl;
    private readonly string? _fromEmail;
    private readonly string? _fromName;
    private readonly string? _baseUrl;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
        var smtpSection = config.GetSection("Smtp");
        _smtpHost = smtpSection.GetValue<string>("Host");
        _smtpPort = smtpSection.GetValue<int>("Port", 587);
        _smtpUsername = smtpSection.GetValue<string>("Username");
        _smtpPassword = smtpSection.GetValue<string>("Password");
        _smtpUseSsl = smtpSection.GetValue<bool>("UseSsl", true);
        _fromEmail = smtpSection.GetValue<string>("FromEmail") ?? "noreply@mais.local";
        _fromName = smtpSection.GetValue<string>("FromName") ?? "MAIS System";
        _baseUrl = config.GetValue<string>("BaseUrl") ?? "http://localhost:4028";
    }

    public async Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetCode, string resetToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_smtpHost))
        {
            _logger.LogWarning("SMTP not configured. Email would be sent to {Email} with code {Code}", toEmail, resetCode);
            return false;
        }

        try
        {
            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                EnableSsl = _smtpUseSsl,
                Credentials = string.IsNullOrWhiteSpace(_smtpUsername)
                    ? null
                    : new NetworkCredential(_smtpUsername, _smtpPassword),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 10000
            };

            var resetLink = $"{_baseUrl}/forgot-password?token={Uri.EscapeDataString(resetToken)}&email={Uri.EscapeDataString(toEmail)}";

            var subject = "Password Reset Request - MAIS";
            var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .code-box {{ background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
        .code {{ font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }}
        .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Password Reset Request</h1>
        </div>
        <div class=""content"">
            <p>Hello,</p>
            <p>You have requested to reset your password for your MAIS account.</p>
            <p>Use the following code to verify your identity:</p>
            <div class=""code-box"">
                <div class=""code"">{resetCode}</div>
            </div>
            <p>This code will expire in <strong>15 minutes</strong>.</p>
            <p>Alternatively, you can click the button below to reset your password:</p>
            <p style=""text-align: center;"">
                <a href=""{resetLink}"" class=""button"">Reset Password</a>
            </p>
            <p>If you did not request this password reset, please ignore this email or contact support if you have concerns.</p>
            <div class=""footer"">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; {DateTime.UtcNow.Year} MAIS Management System</p>
            </div>
        </div>
    </div>
</body>
</html>";

            using var message = new MailMessage
            {
                From = new MailAddress(_fromEmail!, _fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Password reset email sent successfully to {Email}", toEmail);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset email to {Email}", toEmail);
            return false;
        }
    }

    public async Task<bool> SendAccountActivationEmailAsync(string toEmail, string fullName, string temporaryPassword, string activationToken, string userType, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_smtpHost))
        {
            _logger.LogWarning("SMTP not configured. Activation email would be sent to {Email}", toEmail);
            return false;
        }

        try
        {
            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                EnableSsl = _smtpUseSsl,
                Credentials = string.IsNullOrWhiteSpace(_smtpUsername)
                    ? null
                    : new NetworkCredential(_smtpUsername, _smtpPassword),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 10000
            };

            var activationLink = $"{_baseUrl}/activate?token={Uri.EscapeDataString(activationToken)}&email={Uri.EscapeDataString(toEmail)}";

            var subject = $"Welcome to MAIS - Activate Your {userType} Account";
            var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .credentials-box {{ background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }}
        .credential {{ margin: 10px 0; }}
        .credential-label {{ font-weight: bold; color: #666; }}
        .credential-value {{ font-family: 'Courier New', monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 3px; display: inline-block; margin-left: 10px; }}
        .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }}
        .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Welcome to MAIS!</h1>
            <p>Management and Information System</p>
        </div>
        <div class=""content"">
            <p>Hello <strong>{fullName}</strong>,</p>
            <p>Your {userType} account has been created in the MAIS system. Below are your login credentials:</p>
            
            <div class=""credentials-box"">
                <div class=""credential"">
                    <span class=""credential-label"">Email:</span>
                    <span class=""credential-value"">{toEmail}</span>
                </div>
                <div class=""credential"">
                    <span class=""credential-label"">Temporary Password:</span>
                    <span class=""credential-value"">{temporaryPassword}</span>
                </div>
            </div>

            <div class=""warning"">
                <strong>⚠️ Important:</strong> This is a temporary password. You will be required to change it upon your first login.
            </div>

            <p>To activate your account and log in for the first time, click the button below:</p>
            <p style=""text-align: center;"">
                <a href=""{activationLink}"" class=""button"">Activate Account & Login</a>
            </p>

            <p><strong>Note:</strong> This activation link will expire in <strong>7 days</strong>. After activation, you can log in at any time using your email and the password you set.</p>

            <div class=""footer"">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>If you did not expect this email, please contact the teaching staff.</p>
                <p>&copy; {DateTime.UtcNow.Year} MAIS Management System</p>
            </div>
        </div>
    </div>
</body>
</html>";

            using var message = new MailMessage
            {
                From = new MailAddress(_fromEmail!, _fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };
            message.To.Add(toEmail);

            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Account activation email sent successfully to {Email} ({UserType})", toEmail, userType);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send activation email to {Email} ({UserType})", toEmail, userType);
            return false;
        }
    }
}

