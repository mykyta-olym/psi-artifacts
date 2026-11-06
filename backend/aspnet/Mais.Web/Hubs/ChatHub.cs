using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Mais.Web.Hubs;

[Authorize]
public class ChatHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var email = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            // Add user to their personal group for receiving thread creation notifications
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{normalizedEmail}");
        }
        await base.OnConnectedAsync();
    }

    public Task JoinThread(string threadId)
    {
        if (string.IsNullOrWhiteSpace(threadId)) return Task.CompletedTask;
        return Groups.AddToGroupAsync(Context.ConnectionId, threadId);
    }

    public Task LeaveThread(string threadId)
    {
        if (string.IsNullOrWhiteSpace(threadId)) return Task.CompletedTask;
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, threadId);
    }
}

