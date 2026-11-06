namespace Mais.Web.Services;

public interface IEmailService
{
    Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetCode, string resetToken, CancellationToken cancellationToken = default);
    Task<bool> SendAccountActivationEmailAsync(string toEmail, string fullName, string temporaryPassword, string activationToken, string userType, CancellationToken cancellationToken = default);
}

