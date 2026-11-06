using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Mais.Web.Hubs;

[Authorize]
public class ExamsHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var email = Context.User?.FindFirst(ClaimTypes.Email)?.Value;
        var role = Context.User?.FindFirst(ClaimTypes.Role)?.Value;

        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{normalizedEmail}");

            if (string.Equals(role, "student", StringComparison.OrdinalIgnoreCase))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "students");
            }
            else if (string.Equals(role, "teacher", StringComparison.OrdinalIgnoreCase))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "teachers");
            }
        }
        await base.OnConnectedAsync();
    }

    public Task JoinGroup(string groupName)
    {
        if (string.IsNullOrWhiteSpace(groupName)) return Task.CompletedTask;
        return Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public Task LeaveGroup(string groupName)
    {
        if (string.IsNullOrWhiteSpace(groupName)) return Task.CompletedTask;
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }
}
