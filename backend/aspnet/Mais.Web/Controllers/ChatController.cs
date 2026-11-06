using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Hubs;
using Mais.Web.Models.Chat;
using Mais.Web.Services;
using Microsoft.Extensions.Options;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private const string UploadFolderName = "chat-attachments";
    private const long MaxAttachmentBytes = 20 * 1024 * 1024;
    private static readonly string[] TeacherRoleAliases = { "teacher", "faculty", "professor" };
    private static readonly string[] StudentRoleAliases = { "student", "learner" };
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _db;
    private readonly ILogger<ChatController> _log;
    private readonly IGeminiService _gemini;
    private readonly IDataProtector _protector;
    private readonly IHubContext<ChatHub> _hub;
    private readonly IWebHostEnvironment _env;
    private readonly GeminiOptions _geminiOptions;
    private readonly IServiceScopeFactory _scopeFactory;

    private sealed record AiConfigRecord(string? EncryptedKey, string? Model, DateTime? UpdatedAt);

    public ChatController(
        AppDbContext db,
        ILogger<ChatController> log,
        IGeminiService gemini,
        IDataProtectionProvider protectionProvider,
        IHubContext<ChatHub> hub,
        IWebHostEnvironment env,
        IOptions<GeminiOptions> geminiOptions,
        IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _log = log;
        _gemini = gemini;
        _protector = protectionProvider.CreateProtector("mais.chat.ai.keys");
        _hub = hub;
        _env = env;
        _geminiOptions = geminiOptions.Value;
        _scopeFactory = scopeFactory;
    }

    private string CurrentEmail => NormalizeEmail(User.FindFirstValue(ClaimTypes.Email) ?? string.Empty);

    private string CurrentRole => CanonicalRole(User.FindFirstValue(ClaimTypes.Role));

    private static DateTime UtcNow() => DateTime.UtcNow;

    private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    private static string CanonicalRole(string? role)
    {
        var normalized = (role ?? string.Empty).Trim().ToLowerInvariant();
        if (TeacherRoleAliases.Contains(normalized)) return "teacher";
        if (StudentRoleAliases.Contains(normalized)) return "student";
        if (normalized == "ai") return "ai";
        return string.IsNullOrWhiteSpace(normalized) ? "student" : normalized;
    }

    private static Dictionary<string, string> BuildRoleMap(IEnumerable<ChatParticipantEntity>? participants)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (participants == null) return map;
        foreach (var participant in participants)
        {
            if (participant == null) continue;
            var email = NormalizeEmail(participant.Email);
            if (string.IsNullOrWhiteSpace(email)) continue;
            map[email] = CanonicalRole(participant.Kind);
        }
        return map;
    }

    private static string ParticipantKey(string role, string? email)
    {
        var canonicalRole = CanonicalRole(role);
        if (canonicalRole == "ai") return "ai:gemini";
        var normalizedEmail = NormalizeEmail(email);
        var prefix = canonicalRole switch
        {
            "teacher" => "fac",
            "student" => "stu",
            _ => "usr"
        };
        return string.IsNullOrWhiteSpace(normalizedEmail) ? $"{prefix}:unknown" : $"{prefix}:{normalizedEmail}";
    }

    private static long ToUnixTimeMilliseconds(DateTime value)
        => new DateTimeOffset(value.ToUniversalTime()).ToUnixTimeMilliseconds();

    private static long? ToUnixTimeMilliseconds(DateTime? value)
        => value.HasValue ? ToUnixTimeMilliseconds(value.Value) : null;

    private static string PreviewText(string? body)
    {
        var text = (body ?? string.Empty).Trim();
        if (text.Length <= 380) return text;
        return text[..380] + "…";
    }

    private static string FallbackNameFromEmail(string email)
    {
        var local = (email ?? string.Empty).Split('@')[0];
        var cleaned = local.Replace('.', ' ').Replace('_', ' ').Replace('-', ' ').Trim();
        if (string.IsNullOrWhiteSpace(cleaned)) cleaned = local;
        return System.Globalization.CultureInfo.InvariantCulture.TextInfo.ToTitleCase(cleaned.ToLowerInvariant());
    }

    private static string GenerateId(string prefix) => $"{prefix}_{Guid.NewGuid():N}";

    private string UploadsRoot
    {
        get
        {
            var root = _env.WebRootPath;
            if (string.IsNullOrWhiteSpace(root))
            {
                root = Path.Combine(_env.ContentRootPath, "wwwroot");
            }
            var full = Path.Combine(root, UploadFolderName);
            Directory.CreateDirectory(full);
            return full;
        }
    }

    private AiConfigRecord? ReadAiConfig(ChatThreadEntity thread)
    {
        if (string.IsNullOrWhiteSpace(thread.AiConfigJson)) return null;
        try
        {
            return JsonSerializer.Deserialize<AiConfigRecord>(thread.AiConfigJson, JsonOptions);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "[chat] Failed to parse AI config for thread {ThreadId}", thread.Id);
            return null;
        }
    }

    private string? ReadAiKey(ChatThreadEntity thread)
    {
        var config = ReadAiConfig(thread);
        if (!string.IsNullOrWhiteSpace(config?.EncryptedKey))
        {
            try
            {
                return _protector.Unprotect(config.EncryptedKey);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "[chat] Failed to decrypt AI key for thread {ThreadId}", thread.Id);
            }
        }
        // Fallback to global API key from configuration
        return _geminiOptions.ApiKey;
    }

    private void WriteAiConfig(ChatThreadEntity thread, string? apiKey, string? model)
    {
        var existing = ReadAiConfig(thread);
        var encrypted = existing?.EncryptedKey;
        var effectiveModel = string.IsNullOrWhiteSpace(model) ? existing?.Model ?? _geminiOptions.DefaultModel : model.Trim();

        if (apiKey != null)
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                encrypted = null;
            }
            else
            {
                encrypted = _protector.Protect(apiKey.Trim());
            }
        }

        if (encrypted == null && string.IsNullOrWhiteSpace(effectiveModel))
        {
            thread.AiConfigJson = null;
        }
        else
        {
            thread.AiConfigJson = JsonSerializer.Serialize(
                new AiConfigRecord(encrypted, effectiveModel ?? _geminiOptions.DefaultModel, UtcNow()),
                JsonOptions);
        }
    }

    private async Task<bool> IsThreadMemberAsync(string threadId, string email, CancellationToken ct)
    {
        return await _db.ChatParticipants.AsNoTracking()
            .AnyAsync(p => p.ThreadId == threadId && p.Email != null && p.Email.ToLower() == email.ToLower() && p.IsActive, ct);
    }

    private static ChatParticipantModel MapParticipant(ChatParticipantEntity entity)
    {
        var role = CanonicalRole(entity.Kind);
        var email = NormalizeEmail(entity.Email);
        return new ChatParticipantModel
        {
            Id = ParticipantKey(role, role == "ai" ? null : email),
            Email = role == "ai" ? null : email,
            Name = string.IsNullOrWhiteSpace(entity.DisplayName) ? FallbackNameFromEmail(email) : entity.DisplayName.Trim(),
            Role = role
        };
    }

    private static ChatMessageModel MapMessage(ChatMessageEntity entity, IDictionary<string, string> roleByEmail)
    {
        var authorEmail = NormalizeEmail(entity.AuthorEmail);
        roleByEmail.TryGetValue(authorEmail, out var role);
        role ??= CanonicalRole(entity.AuthorRole);
        if (string.IsNullOrWhiteSpace(role)) role = "student";

        var reactions = (entity.Reactions ?? Enumerable.Empty<ChatReactionEntity>())
            .GroupBy(r => r.Emoji)
            .Select(group => new ChatReactionModel
            {
                Emoji = group.Key,
                By = group.Select(r =>
                {
                    var addr = NormalizeEmail(r.UserEmail);
                    roleByEmail.TryGetValue(addr, out var rr);
                    rr ??= "student";
                    return ParticipantKey(rr, addr);
                }).Distinct().ToList()
            }).ToList();

        return new ChatMessageModel
        {
            Id = entity.Id,
            ThreadId = entity.ThreadId,
            ReplyToId = entity.ReplyToId,
            ClientId = entity.ClientId,
            AuthorId = ParticipantKey(role, role == "ai" ? null : authorEmail),
            AuthorEmail = role == "ai" ? null : authorEmail,
            AuthorRole = role,
            AuthorName = string.IsNullOrWhiteSpace(entity.AuthorDisplayName)
                ? FallbackNameFromEmail(authorEmail)
                : entity.AuthorDisplayName,
            Text = entity.Body,
            Announcement = entity.Announcement,
            TargetAi = entity.TargetAi,
            Ts = ToUnixTimeMilliseconds(entity.CreatedAt),
            UpdatedTs = ToUnixTimeMilliseconds(entity.UpdatedAt),
            Deleted = entity.DeletedAt.HasValue,
            Reactions = reactions,
            Attachments = (entity.Attachments ?? Enumerable.Empty<ChatAttachmentEntity>()).Select(a => new ChatAttachmentModel
            {
                Name = a.FileName,
                ContentType = a.ContentType,
                Size = a.Size,
                Url = a.DownloadUrl
            }).ToList()
        };
    }

    private static ChatThreadSummaryModel MapThreadSummary(ChatThreadEntity thread, IEnumerable<ChatParticipantEntity>? participants, ChatUserStateEntity? state, ChatMessageEntity? lastMessage = null, int unread = 0)
    {
        var list = (participants ?? Enumerable.Empty<ChatParticipantEntity>()).Where(p => p.IsActive).OrderBy(p => p.JoinedAt).ToList();
        var ownerEmail = NormalizeEmail(thread.OwnerEmail);
        var ownerRole = list.FirstOrDefault(p => NormalizeEmail(p.Email) == ownerEmail)?.Kind ?? "teacher";

        var summary = new ChatThreadSummaryModel
        {
            Id = thread.Id,
            Title = thread.Title,
            OwnerEmail = ownerEmail,
            OwnerId = ParticipantKey(ownerRole, ownerEmail),
            AiEnabled = thread.AiEnabled,
            CreatedTs = ToUnixTimeMilliseconds(thread.CreatedAt),
            UpdatedTs = ToUnixTimeMilliseconds(thread.UpdatedAt),
            LastMessageTs = ToUnixTimeMilliseconds(lastMessage?.CreatedAt),
            LastMessagePreview = lastMessage != null ? PreviewText(lastMessage.Body) : thread.LastMessagePreview,
            UnreadCount = unread,
            Pinned = state?.PinnedAt != null,
            Participants = list.Select(MapParticipant).ToList()
        };
        return summary;
    }

    private async Task BroadcastMessageAsync(string threadId, ChatMessageModel model, CancellationToken ct)
    {
        // Broadcast to thread group (for users who have the thread open)
        await _hub.Clients.Group(threadId).SendAsync("MessageCreated", model, ct);

        // Also broadcast to personal groups of all participants (so they receive messages even if thread is not open)
        var thread = await _db.ChatThreads
            .Include(t => t.Participants)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);

        if (thread != null)
        {
            foreach (var participant in thread.Participants.Where(p => p.IsActive && !string.IsNullOrWhiteSpace(p.Email)))
            {
                var participantEmail = NormalizeEmail(participant.Email);
                await _hub.Clients.Group($"user:{participantEmail}").SendAsync("MessageCreated", model, ct);
            }
        }
    }

    private async Task BroadcastThreadUpdateAsync(string threadId, ChatThreadSummaryModel summary, CancellationToken ct)
    {
        // Broadcast to thread group (for users who have the thread open)
        await _hub.Clients.Group(threadId).SendAsync("ThreadUpdated", summary, ct);

        // Also broadcast to personal groups of all participants (so they receive updates even if thread is not open)
        var thread = await _db.ChatThreads
            .Include(t => t.Participants)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);

        if (thread != null)
        {
            foreach (var participant in thread.Participants.Where(p => p.IsActive && !string.IsNullOrWhiteSpace(p.Email)))
            {
                var participantEmail = NormalizeEmail(participant.Email);
                await _hub.Clients.Group($"user:{participantEmail}").SendAsync("ThreadUpdated", summary, ct);
            }
        }
    }

    private async Task BroadcastReactionAsync(string threadId, ChatMessageModel model, CancellationToken ct)
    {
        await _hub.Clients.Group(threadId).SendAsync("MessageReactionsUpdated", model, ct);
    }

    private async Task<(string Role, string Name)> ResolveProfileAsync(string email, CancellationToken ct)
    {
        email = NormalizeEmail(email);
        if (string.IsNullOrWhiteSpace(email))
        {
            return ("student", "User");
        }

        var faculty = await _db.Faculty.AsNoTracking().Where(f => f.Email.ToLower() == email).Select(f => f.FullName).FirstOrDefaultAsync(ct);
        if (faculty != null) return ("teacher", faculty);

        var student = await _db.Students.AsNoTracking().Where(s => s.Email.ToLower() == email).Select(s => s.FullName).FirstOrDefaultAsync(ct);
        if (student != null) return ("student", student);

        var credentialRole = await _db.UserCredentials.AsNoTracking().Where(u => u.Email.ToLower() == email).Select(u => u.Role).FirstOrDefaultAsync(ct);
        var canonical = CanonicalRole(credentialRole);
        return (canonical, FallbackNameFromEmail(email));
    }

    private void EnsureOwnership(ChatThreadEntity thread, string callerEmail)
    {
        var normalizedOwner = NormalizeEmail(thread.OwnerEmail);
        var normalizedCaller = NormalizeEmail(callerEmail);
        if (string.Equals(normalizedOwner, normalizedCaller, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (CurrentRole == "teacher")
        {
            return;
        }

        throw new InvalidOperationException("Only the thread owner can perform this action.");
    }

    private void EnsureTeacherPrivileges(string callerRole)
    {
        if (callerRole != "teacher")
        {
            throw new InvalidOperationException("Only teachers can manage participants.");
        }
    }

    private void EnsureCanAddParticipant(string callerRole, string participantRole)
    {
        if (callerRole != "teacher" && participantRole == "teacher")
        {
            throw new InvalidOperationException("Students cannot add faculty members to a chat.");
        }
        if (callerRole != "teacher")
        {
            throw new InvalidOperationException("Only teachers can add or remove participants.");
        }
    }

    /// <summary>
    /// Get list of chat threads for the authenticated user
    /// </summary>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of chat thread summaries</returns>
    /// <remarks>
    /// Requires authentication. Returns all chat threads where the user is an active participant.
    /// 
    /// Each thread summary includes:
    /// - Thread metadata (title, owner, creation/update timestamps)
    /// - Last message preview and timestamp
    /// - Unread message count (excludes AI messages and own messages)
    /// - Pinned status
    /// - Participants list
    /// 
    /// Threads are ordered by: pinned first, then by last message timestamp (or update timestamp).
    /// </remarks>
    [HttpGet("threads")]
    [ProducesResponseType(typeof(IEnumerable<ChatThreadSummaryModel>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<ChatThreadSummaryModel>>> ListThreads(CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var threadIds = await _db.ChatParticipants.AsNoTracking()
            .Where(p => p.Email != null && p.Email.ToLower() == email && p.IsActive)
            .Select(p => p.ThreadId)
            .Distinct()
            .ToListAsync(ct);

        if (threadIds.Count == 0) return Ok(Array.Empty<ChatThreadSummaryModel>());

        var threads = await _db.ChatThreads.AsNoTracking()
            .Where(t => threadIds.Contains(t.Id))
            .Include(t => t.Participants)
            .ToListAsync(ct);

        var states = await _db.ChatUserStates.AsNoTracking()
            .Where(s => s.UserEmail == email && threadIds.Contains(s.ThreadId))
            .ToDictionaryAsync(s => s.ThreadId, ct);

        var lastMessages = await _db.ChatMessages.AsNoTracking()
            .Where(m => threadIds.Contains(m.ThreadId) && m.DeletedAt == null)
            .GroupBy(m => m.ThreadId)
            .Select(g => g.OrderByDescending(x => x.CreatedAt).FirstOrDefault())
            .ToDictionaryAsync(m => m!.ThreadId, ct);

        var summaries = new List<ChatThreadSummaryModel>();
        foreach (var thread in threads)
        {
            states.TryGetValue(thread.Id, out var state);
            lastMessages.TryGetValue(thread.Id, out var lastMessage);

            var lastReadAt = state?.LastReadAt ?? DateTime.MinValue;
            var unread = await _db.ChatMessages.AsNoTracking()
                .Where(m => m.ThreadId == thread.Id
                            && m.DeletedAt == null
                            && m.AuthorRole.ToLower() != "ai"
                            && (m.AuthorEmail == null || m.AuthorEmail.ToLower() != email)
                            && m.CreatedAt > lastReadAt)
                .CountAsync(ct);

            summaries.Add(MapThreadSummary(thread, thread.Participants, state, lastMessage, unread));
        }

        summaries = summaries
            .OrderByDescending(s => s.Pinned)
            .ThenByDescending(s => s.LastMessageTs ?? s.UpdatedTs)
            .ToList();

        return Ok(summaries);
    }

    /// <summary>
    /// Create a new chat thread
    /// </summary>
    /// <param name="request">Thread creation request with title, participants, and optional AI invitation</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Created chat thread details</returns>
    /// <remarks>
    /// Requires authentication. Creates a new chat thread with specified participants.
    /// 
    /// Features:
    /// - Automatically adds the creator as a participant
    /// - Can invite other users (students/teachers) as participants
    /// - Can optionally enable AI (Gemini) assistant
    /// - Validates participant roles (teachers can add anyone, students can add teachers and other students)
    /// - Broadcasts thread creation to all participants via SignalR
    /// 
    /// Returns the created thread with empty messages list.
    /// </remarks>
    [HttpPost("threads")]
    [ProducesResponseType(typeof(ChatThreadDetailModel), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ChatThreadDetailModel>> CreateThread([FromBody] CreateChatThreadRequest request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var now = UtcNow();
        var threadId = GenerateId("t");

        var thread = new ChatThreadEntity
        {
            Id = threadId,
            OwnerEmail = email,
            Title = string.IsNullOrWhiteSpace(request.Title) ? "New chat" : request.Title.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            AiEnabled = request.InviteAi
        };

        var participants = new List<ChatParticipantEntity>();
        var participantEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { email };
        var (ownerRole, ownerName) = await ResolveProfileAsync(email, ct);

        participants.Add(new ChatParticipantEntity
        {
            Id = GenerateId("p"),
            ThreadId = threadId,
            Kind = ownerRole,
            Email = email,
            DisplayName = ownerName,
            JoinedAt = now,
            IsActive = true
        });

        if (request.Participants != null)
        {
            foreach (var candidate in request.Participants)
            {
                var candidateEmail = NormalizeEmail(candidate.Email);
                if (string.IsNullOrWhiteSpace(candidateEmail) || !participantEmails.Add(candidateEmail))
                {
                    continue;
                }

                var (role, name) = await ResolveProfileAsync(candidateEmail, ct);
                EnsureCanAddParticipant(ownerRole, role);

                participants.Add(new ChatParticipantEntity
                {
                    Id = GenerateId("p"),
                    ThreadId = threadId,
                    Kind = role,
                    Email = candidateEmail,
                    DisplayName = name,
                    JoinedAt = now,
                    IsActive = true
                });
            }
        }

        if (request.InviteAi)
        {
            participants.Add(new ChatParticipantEntity
            {
                Id = GenerateId("p"),
                ThreadId = threadId,
                Kind = "ai",
                DisplayName = "Gemini",
                JoinedAt = now,
                IsActive = true
            });
        }

        var states = participantEmails.Select(addr => new ChatUserStateEntity
        {
            Id = GenerateId("s"),
            ThreadId = threadId,
            UserEmail = addr,
            LastReadAt = now
        }).ToList();

        thread.Participants = participants;
        thread.UserStates = states;

        _db.ChatThreads.Add(thread);
        await _db.SaveChangesAsync(ct);

        // Create activity for thread creation
        await CreateActivityForThreadCreationAsync(thread, email, ownerRole, ownerName, participants, ct);

        var roleMap = BuildRoleMap(participants);

        var detail = new ChatThreadDetailModel
        {
            Id = thread.Id,
            Title = thread.Title,
            OwnerEmail = email,
            OwnerId = ParticipantKey(ownerRole, email),
            AiEnabled = thread.AiEnabled,
            CreatedTs = ToUnixTimeMilliseconds(thread.CreatedAt),
            UpdatedTs = ToUnixTimeMilliseconds(thread.UpdatedAt),
            LastMessageTs = null,
            LastMessagePreview = null,
            UnreadCount = 0,
            Pinned = false,
            Participants = participants.Select(MapParticipant).ToList(),
            Messages = Array.Empty<ChatMessageModel>()
        };

        // Broadcast thread creation to all participants immediately
        var summary = MapThreadSummary(thread, participants, null, null, 0);
        foreach (var participantEmail in participantEmails)
        {
            await _hub.Clients.Group($"user:{participantEmail}").SendAsync("ThreadCreated", summary, ct);
        }
        // Also broadcast to the thread group for real-time updates
        await _hub.Clients.Group(threadId).SendAsync("ThreadCreated", summary, ct);

        return CreatedAtAction(nameof(GetThreadById), new { threadId }, detail);
    }

    /// <summary>
    /// Get chat thread details by ID
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Chat thread details with all messages</returns>
    /// <remarks>
    /// Requires authentication. Returns full thread details including all messages.
    /// 
    /// Only thread members can access the thread. Returns 403 Forbidden if user is not a participant.
    /// 
    /// Includes:
    /// - Thread metadata (title, owner, timestamps, AI enabled status)
    /// - All participants
    /// - All messages (ordered by creation time) with attachments and reactions
    /// - Unread count for the authenticated user
    /// </remarks>
    [HttpGet("threads/{threadId}")]
    [ProducesResponseType(typeof(ChatThreadDetailModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatThreadDetailModel>> GetThreadById(string threadId, CancellationToken ct)
    {
        threadId = threadId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(threadId)) return BadRequest();

        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        if (!await IsThreadMemberAsync(threadId, email, ct)) return Forbid();

        var thread = await _db.ChatThreads
            .Include(t => t.Participants)
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);

        if (thread == null) return NotFound();

        var normalizedEmail = NormalizeEmail(email);
        var state = await _db.ChatUserStates.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ThreadId == threadId && s.UserEmail == email, ct);

        var messages = await _db.ChatMessages.AsNoTracking()
            .Where(m => m.ThreadId == threadId)
            .OrderBy(m => m.CreatedAt)
            .Include(m => m.Attachments)
            .Include(m => m.Reactions)
            .ToListAsync(ct);

        var roleMap = BuildRoleMap(thread.Participants);

        var messageModels = messages.Select(m => MapMessage(m, roleMap)).ToList();
        var last = messages.LastOrDefault(m => m.DeletedAt == null);

        var unread = messages.Count(m =>
            m.DeletedAt == null
            && m.AuthorRole.ToLower() != "ai"
            && (m.AuthorEmail == null || NormalizeEmail(m.AuthorEmail) != normalizedEmail)
            && (m.CreatedAt > (state?.LastReadAt ?? DateTime.MinValue) || (m.CreatedAt > thread.UpdatedAt && NormalizeEmail(m.AuthorEmail) != normalizedEmail)));

        var summary = MapThreadSummary(thread, thread.Participants, state, last, unread);

        return Ok(new ChatThreadDetailModel
        {
            Id = summary.Id,
            Title = summary.Title,
            OwnerEmail = summary.OwnerEmail,
            OwnerId = summary.OwnerId,
            AiEnabled = summary.AiEnabled,
            CreatedTs = summary.CreatedTs,
            UpdatedTs = summary.UpdatedTs,
            LastMessageTs = summary.LastMessageTs,
            LastMessagePreview = summary.LastMessagePreview,
            UnreadCount = summary.UnreadCount,
            Pinned = summary.Pinned,
            Participants = summary.Participants,
            Messages = messageModels
        });
    }

    private IEnumerable<ChatAttachmentEntity> BuildAttachmentEntities(string threadId, string messageId, IEnumerable<ChatAttachmentInput> attachments)
    {
        foreach (var attachment in attachments)
        {
            if (string.IsNullOrWhiteSpace(attachment.Url))
            {
                continue;
            }
            var uri = attachment.Url.Trim();
            var relative = uri.TrimStart('/');
            if (!relative.StartsWith($"{UploadFolderName}/{threadId}/", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Attachment location is invalid.");
            }
            yield return new ChatAttachmentEntity
            {
                Id = GenerateId("f"),
                MessageId = messageId,
                FileName = attachment.Name ?? Path.GetFileName(uri),
                ContentType = attachment.ContentType,
                Size = attachment.Size,
                StoragePath = Path.Combine(UploadsRoot, threadId, Path.GetFileName(uri)),
                DownloadUrl = "/" + relative
            };
        }
    }

    private async Task<ChatMessageModel> PersistAndBroadcastMessageAsync(ChatThreadEntity thread, ChatMessageEntity entity, CancellationToken ct)
    {
        var threadId = thread.Id;
        var messageId = entity.Id;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[chat] SaveChangesAsync failed for thread {ThreadId}, message {MessageId}", threadId, messageId);
            throw;
        }

        // Reload entities to ensure we have the latest data and navigation properties
        try
        {
            var reloadedThread = await _db.ChatThreads
                .Include(t => t.Participants)
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == threadId, ct);

            if (reloadedThread == null)
            {
                throw new InvalidOperationException($"Thread {threadId} not found after save");
            }
            thread = reloadedThread;

            var reloadedEntity = await _db.ChatMessages
                .Include(m => m.Reactions)
                .Include(m => m.Attachments)
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == messageId, ct);

            if (reloadedEntity == null)
            {
                throw new InvalidOperationException($"Message {messageId} not found after save");
            }
            entity = reloadedEntity;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[chat] Failed to reload entities after save for thread {ThreadId}, message {MessageId}", threadId, messageId);
            throw;
        }

        try
        {
            var roleMap = BuildRoleMap(thread.Participants ?? Enumerable.Empty<ChatParticipantEntity>());
            var model = MapMessage(entity, roleMap);
            await BroadcastMessageAsync(thread.Id, model, ct);

            var states = await _db.ChatUserStates.AsNoTracking()
                .Where(s => s.ThreadId == thread.Id)
                .ToListAsync(ct);
            var stateByUser = new Dictionary<string, ChatUserStateEntity>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in states)
            {
                if (string.IsNullOrWhiteSpace(s.UserEmail)) continue;
                var key = NormalizeEmail(s.UserEmail);
                if (string.IsNullOrEmpty(key)) continue;
                stateByUser[key] = s;
            }

            // Get last message once (it's the same for all participants)
            var last = await _db.ChatMessages.AsNoTracking()
                .Where(m => m.ThreadId == thread.Id && m.DeletedAt == null)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync(ct);

            // Broadcast thread update to each participant with their specific unread count
            var participants = thread.Participants ?? Enumerable.Empty<ChatParticipantEntity>();
            var activeParticipants = participants
                .Where(p => p != null && p.IsActive && !string.IsNullOrWhiteSpace(p.Email))
                .ToList();

            // Load messages into memory to allow client-side filtering with NormalizeEmail
            var allMessages = await _db.ChatMessages.AsNoTracking()
                .Where(m => m.ThreadId == thread.Id
                            && m.DeletedAt == null
                            && m.AuthorRole.ToLower() != "ai")
                .ToListAsync(ct);

            foreach (var participant in activeParticipants)
            {
                var participantEmail = NormalizeEmail(participant.Email);
                stateByUser.TryGetValue(participantEmail, out var state);

                var lastReadAt = state?.LastReadAt ?? DateTime.MinValue;
                var unread = allMessages
                    .Count(m => (m.AuthorEmail == null || NormalizeEmail(m.AuthorEmail) != participantEmail)
                                && m.CreatedAt > lastReadAt);

                var summary = MapThreadSummary(thread, participants, state, last, unread);
                // Broadcast to this specific participant's personal group
                await _hub.Clients.Group($"user:{participantEmail}").SendAsync("ThreadUpdated", summary, ct);
            }

            // Also broadcast to thread group (for users who have the thread open)
            // Use the author's unread count for the thread group broadcast
            var authorEmail = NormalizeEmail(entity.AuthorEmail);
            stateByUser.TryGetValue(authorEmail, out var authorState);
            var authorLastReadAt = authorState?.LastReadAt ?? DateTime.MinValue;
            var authorUnread = allMessages
                .Count(m => (m.AuthorEmail == null || NormalizeEmail(m.AuthorEmail) != authorEmail)
                            && m.CreatedAt > authorLastReadAt);
            var threadSummary = MapThreadSummary(thread, participants, authorState, last, authorUnread);
            await _hub.Clients.Group(thread.Id).SendAsync("ThreadUpdated", threadSummary, ct);

            return model;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[chat] Failed to broadcast message for thread {ThreadId}, message {MessageId}", threadId, messageId);
            throw;
        }
    }

    /// <summary>
    /// Send a message to a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="request">Message request with text, optional attachments, reply-to, and AI targeting</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Created message model</returns>
    /// <remarks>
    /// Requires authentication. Sends a message to a chat thread.
    /// 
    /// Features:
    /// - Only thread members can send messages
    /// - Message must have text or attachments
    /// - Can reply to another message (ReplyToId)
    /// - Can mark as announcement
    /// - Can target AI assistant (if thread has AI enabled)
    /// - Automatically updates thread's last message timestamp and preview
    /// - Marks message as read for the sender
    /// - Broadcasts message to all thread participants via SignalR
    /// - If AI is targeted, generates AI reply asynchronously
    /// </remarks>
    [HttpPost("threads/{threadId}/messages")]
    [ProducesResponseType(typeof(ChatMessageModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ChatMessageModel>> SendMessage(string threadId, [FromBody] SendChatMessageRequest request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();
        if (!await IsThreadMemberAsync(threadId, email, ct)) return Forbid();

        var thread = await _db.ChatThreads.Include(t => t.Participants).FirstOrDefaultAsync(t => t.Id == threadId, ct);
        if (thread == null) return NotFound();

        var author = thread.Participants.FirstOrDefault(p => NormalizeEmail(p.Email) == email);
        if (author == null) return Forbid();

        // Ensure we always have up-to-date profile data for the author (role + display name)
        var (authorRole, authorName) = await ResolveProfileAsync(email, ct);
        author.DisplayName = authorName;
        author.Kind = authorRole;

        var text = (request.Text ?? string.Empty).Trim();
        var attachments = request.Attachments ?? new List<ChatAttachmentInput>();

        if (string.IsNullOrWhiteSpace(text) && attachments.Count == 0)
        {
            return BadRequest(new { error = "Message text or attachments required." });
        }

        var now = UtcNow();
        var messageId = GenerateId("m");
        var entity = new ChatMessageEntity
        {
            Id = messageId,
            ThreadId = threadId,
            AuthorEmail = email,
            AuthorRole = CanonicalRole(authorRole),
            AuthorDisplayName = authorName,
            Body = text,
            Announcement = request.Announcement,
            ReplyToId = request.ReplyToId,
            ClientId = string.IsNullOrWhiteSpace(request.ClientId) ? null : request.ClientId,
            TargetAi = request.TargetAi && thread.AiEnabled,
            CreatedAt = now
        };

        entity.Attachments = BuildAttachmentEntities(threadId, messageId, attachments).ToList();

        thread.LastMessageAt = now;
        thread.LastMessagePreview = PreviewText(entity.Body);
        thread.UpdatedAt = now;

        var state = await _db.ChatUserStates.FirstOrDefaultAsync(s => s.ThreadId == threadId && s.UserEmail == email, ct);
        if (state == null)
        {
            _db.ChatUserStates.Add(new ChatUserStateEntity
            {
                Id = GenerateId("s"),
                ThreadId = threadId,
                UserEmail = email,
                LastReadAt = now
            });
        }
        else
        {
            state.LastReadAt = now;
        }

        _db.ChatMessages.Add(entity);

        ChatMessageModel clientModel;
        try
        {
            clientModel = await PersistAndBroadcastMessageAsync(thread, entity, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[chat] Failed to persist message for thread {ThreadId}, message {MessageId}", threadId, entity.Id);
            return StatusCode(500, new { error = "Failed to save message", details = ex.Message });
        }

        // Generate AI reply if needed (fire and forget to avoid blocking response)
        if (entity.TargetAi)
        {
            var scopeFactory = _scopeFactory;
            var gemini = _gemini;
            var geminiOptions = _geminiOptions;
            var protector = _protector;
            var hub = _hub;
            var log = _log;
            var aiMessageId = entity.Id;
            
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    
                    // Reload thread and entity for AI reply generation
                    var threadForAi = await db.ChatThreads
                        .Include(t => t.Participants)
                        .FirstOrDefaultAsync(t => t.Id == threadId);
                    var entityForAi = await db.ChatMessages
                        .FirstOrDefaultAsync(m => m.Id == aiMessageId);

                    if (threadForAi != null && entityForAi != null)
                    {
                        await GenerateAiReplyInScopeAsync(db, hub, gemini, geminiOptions, protector, log, threadForAi, entityForAi);
                    }
                }
                catch (Exception ex)
                {
                    log.LogWarning(ex, "[chat] AI reply generation failed for thread {ThreadId}", threadId);
                }
            });
        }

        return Ok(clientModel);
    }

    private static async Task GenerateAiReplyInScopeAsync(
        AppDbContext db,
        IHubContext<ChatHub> hub,
        IGeminiService gemini,
        GeminiOptions geminiOptions,
        IDataProtector protector,
        ILogger log,
        ChatThreadEntity thread,
        ChatMessageEntity parent)
    {
        try
        {
            var apiKey = ReadAiKeyStatic(thread, protector, geminiOptions, log);
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                // Send error message to chat instead of silently failing
                await SendAiErrorMessageInScopeAsync(db, hub, log, thread, parent.Id, 
                    "⚠️ **API key not configured**\n\nTo use the AI assistant, please configure a Gemini API key:\n\n1. Open the chat settings (right panel)\n2. Enter your Gemini API key\n3. Click \"Save\"\n\nYou can get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey).");
                return;
            }

            var config = ReadAiConfigStatic(thread, log);
            var model = string.IsNullOrWhiteSpace(config?.Model) ? geminiOptions.DefaultModel : config!.Model!;
            
            string response;
            try
            {
                response = await gemini.GenerateAsync(apiKey, parent.Body, model, CancellationToken.None);
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("API key") || ex.Message.Contains("not found"))
            {
                log.LogWarning(ex, "[chat] AI API error for thread {ThreadId}", thread.Id);
                await SendAiErrorMessageInScopeAsync(db, hub, log, thread, parent.Id,
                    $"⚠️ **AI error**\n\n{ex.Message}\n\nPlease check your API key and model settings.");
                return;
            }

            var now = DateTime.UtcNow;
            var aiMessage = new ChatMessageEntity
            {
                Id = GenerateId("m"),
                ThreadId = thread.Id,
                AuthorRole = "ai",
                AuthorDisplayName = "Gemini",
                Body = response,
                Announcement = false,
                ReplyToId = parent.Id,
                CreatedAt = now
            };

            thread.LastMessageAt = now;
            thread.LastMessagePreview = PreviewText(aiMessage.Body);
            thread.UpdatedAt = now;

            db.ChatMessages.Add(aiMessage);
            await db.SaveChangesAsync();
            
            // Broadcast message
            var roleMap = BuildRoleMap(thread.Participants);
            var model_msg = MapMessage(aiMessage, roleMap);
            await hub.Clients.Group(thread.Id).SendAsync("MessageCreated", model_msg);
            
            // Broadcast thread update with participants
            var threadModel = MapThreadSummary(thread, thread.Participants, null);
            await hub.Clients.Group(thread.Id).SendAsync("ThreadUpdated", threadModel);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "[chat] AI reply failed for thread {ThreadId}", thread.Id);
            await SendAiErrorMessageInScopeAsync(db, hub, log, thread, parent.Id,
                $"⚠️ **AI error**\n\nFailed to generate response: {ex.Message}\n\nPlease try again later.");
        }
    }

    private static async Task SendAiErrorMessageInScopeAsync(
        AppDbContext db, 
        IHubContext<ChatHub> hub,
        ILogger log,
        ChatThreadEntity thread, 
        string replyToId, 
        string errorMessage)
    {
        try
        {
            var now = DateTime.UtcNow;
            var aiMessage = new ChatMessageEntity
            {
                Id = GenerateId("m"),
                ThreadId = thread.Id,
                AuthorRole = "ai",
                AuthorDisplayName = "Gemini",
                Body = errorMessage,
                Announcement = false,
                ReplyToId = replyToId,
                CreatedAt = now
            };

            thread.LastMessageAt = now;
            thread.LastMessagePreview = PreviewText(aiMessage.Body);
            thread.UpdatedAt = now;

            db.ChatMessages.Add(aiMessage);
            await db.SaveChangesAsync();
            
            // Broadcast message
            var roleMap = BuildRoleMap(thread.Participants);
            var model = MapMessage(aiMessage, roleMap);
            await hub.Clients.Group(thread.Id).SendAsync("MessageCreated", model);
            
            // Broadcast thread update with participants
            var threadModel = MapThreadSummary(thread, thread.Participants, null);
            await hub.Clients.Group(thread.Id).SendAsync("ThreadUpdated", threadModel);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "[chat] Failed to send AI error message for thread {ThreadId}", thread.Id);
        }
    }

    private static string? ReadAiKeyStatic(ChatThreadEntity thread, IDataProtector protector, GeminiOptions options, ILogger log)
    {
        var config = ReadAiConfigStatic(thread, log);
        if (!string.IsNullOrWhiteSpace(config?.EncryptedKey))
        {
            try
            {
                return protector.Unprotect(config.EncryptedKey);
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "[chat] Failed to decrypt AI key for thread {ThreadId}", thread.Id);
            }
        }
        return options.ApiKey;
    }

    private static AiConfigRecord? ReadAiConfigStatic(ChatThreadEntity thread, ILogger log)
    {
        if (string.IsNullOrWhiteSpace(thread.AiConfigJson)) return null;
        try
        {
            return JsonSerializer.Deserialize<AiConfigRecord>(thread.AiConfigJson, JsonOptions);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "[chat] Failed to parse AI config for thread {ThreadId}", thread.Id);
            return null;
        }
    }

    [HttpPatch("threads/{threadId}/messages/{messageId}")]
    public async Task<ActionResult<ChatMessageModel>> UpdateMessage(string threadId, string messageId, [FromBody] UpdateChatMessageRequest request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var message = await _db.ChatMessages
            .Include(m => m.Reactions)
            .Include(m => m.Attachments)
            .Include(m => m.Thread!).ThenInclude(t => t.Participants!)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ThreadId == threadId, ct);

        if (message == null) return NotFound();
        
        var messageThread = message.Thread;
        if (messageThread?.Participants == null)
        {
            return StatusCode(500, "Thread or participants not loaded");
        }
        
        if (!string.Equals(NormalizeEmail(message.AuthorEmail), email, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        message.Body = request.Text.Trim();
        message.UpdatedAt = UtcNow();

        await _db.SaveChangesAsync(ct);

        var roleMap = BuildRoleMap(messageThread.Participants!);

        var model = MapMessage(message, roleMap);
        await _hub.Clients.Group(threadId).SendAsync("MessageUpdated", model, ct);

        return Ok(model);
    }

    /// <summary>
    /// Delete a message from a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="messageId">Message identifier</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Soft-deletes a message (marks as deleted, clears body).
    /// 
    /// Only the message author or thread owner can delete messages.
    /// Broadcasts message deletion to all thread participants via SignalR.
    /// </remarks>
    [HttpDelete("threads/{threadId}/messages/{messageId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMessage(string threadId, string messageId, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var message = await _db.ChatMessages
            .Include(m => m.Thread)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ThreadId == threadId, ct);

        if (message == null) return NotFound();

        var thread = message.Thread;
        if (thread == null)
        {
            return StatusCode(500, "Thread not loaded");
        }

        var isAuthor = string.Equals(NormalizeEmail(message.AuthorEmail), email, StringComparison.OrdinalIgnoreCase);
        var isOwner = string.Equals(NormalizeEmail(thread.OwnerEmail), email, StringComparison.OrdinalIgnoreCase);
        if (!isAuthor && !isOwner) return Forbid();

        message.DeletedAt = UtcNow();
        message.Body = string.Empty;
        _db.ChatMessages.Update(message);
        await _db.SaveChangesAsync(ct);

        await _hub.Clients.Group(threadId).SendAsync("MessageDeleted", new { threadId, messageId }, ct);
        return NoContent();
    }

    /// <summary>
    /// Toggle a reaction on a message
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="messageId">Message identifier</param>
    /// <param name="request">Reaction request with emoji</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated message model with reactions</returns>
    /// <remarks>
    /// Requires authentication. Toggles a reaction (emoji) on a message.
    /// 
    /// Behavior:
    /// - If user already reacted with the same emoji, removes the reaction
    /// - If user reacted with a different emoji, replaces the old reaction with the new one
    /// - Only one reaction per user per message (replacing previous if exists)
    /// 
    /// Only thread members can react to messages.
    /// Broadcasts reaction update to all thread participants via SignalR.
    /// </remarks>
    [HttpPost("threads/{threadId}/messages/{messageId}/reactions")]
    [ProducesResponseType(typeof(ChatMessageModel), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatMessageModel>> ToggleReaction(string threadId, string messageId, [FromBody] ToggleReactionRequest? request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();
        var reactionRequest = request;
        if (reactionRequest == null || string.IsNullOrWhiteSpace(reactionRequest.Emoji))
            return BadRequest(new { error = "Emoji is required" });

        var message = await _db.ChatMessages
            .Include(m => m.Reactions)
            .Include(m => m.Thread!).ThenInclude(t => t.Participants!)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ThreadId == threadId, ct);

        if (message == null) return NotFound();
        
        var messageThread = message.Thread;
        if (messageThread?.Participants == null)
        {
            return StatusCode(500, "Thread or participants not loaded");
        }
        
        if (!await IsThreadMemberAsync(threadId, email, ct)) return Forbid();

        email = NormalizeEmail(email);
        var userReactions = message.Reactions
            .Where(r => NormalizeEmail(r.UserEmail) == email)
            .ToList();
        var reaction = userReactions.FirstOrDefault(r => r.Emoji == reactionRequest.Emoji);

        if (reaction != null)
        {
            // Toggle off the same emoji
            _db.ChatReactions.Remove(reaction);
            userReactions.Remove(reaction);
            message.Reactions.Remove(reaction);
        }
        else
        {
            // Remove any other emoji the user previously set before adding the new one
            foreach (var existing in userReactions)
            {
                _db.ChatReactions.Remove(existing);
                message.Reactions.Remove(existing);
            }

            reaction = new ChatReactionEntity
            {
                Id = GenerateId("r"),
                MessageId = messageId,
                Emoji = reactionRequest.Emoji,
                UserEmail = email,
                CreatedAt = UtcNow()
            };
            message.Reactions.Add(reaction);
        }

        await _db.SaveChangesAsync(ct);

        var roleMap = BuildRoleMap(messageThread.Participants!);

        var model = MapMessage(message, roleMap);
        await BroadcastReactionAsync(threadId, model, ct);
        return Ok(model);
    }

    /// <summary>
    /// Mark messages in a thread as read
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="request">Read request with optional timestamp</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Marks messages in a thread as read for the authenticated user.
    /// 
    /// If timestamp (Ts) is provided, marks all messages up to that timestamp as read.
    /// Otherwise, marks all current messages as read.
    /// 
    /// Only thread members can mark messages as read.
    /// Broadcasts read receipt update to all thread participants via SignalR.
    /// </remarks>
    [HttpPost("threads/{threadId}/reads")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> MarkRead(string threadId, [FromBody] MarkChatReadRequest? request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();
        if (!await IsThreadMemberAsync(threadId, email, ct)) return Forbid();
        var readRequest = request;
        if (readRequest == null)
            return BadRequest(new { error = "Request body is required" });

        var ts = readRequest.Ts.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(readRequest.Ts.Value).UtcDateTime
            : UtcNow();

        var state = await _db.ChatUserStates.FirstOrDefaultAsync(s => s.ThreadId == threadId && s.UserEmail == email, ct);
        if (state == null)
        {
            _db.ChatUserStates.Add(new ChatUserStateEntity
            {
                Id = GenerateId("s"),
                ThreadId = threadId,
                UserEmail = email,
                LastReadAt = ts
            });
        }
        else
        {
            state.LastReadAt = state.LastReadAt.HasValue && state.LastReadAt > ts ? state.LastReadAt : ts;
        }

        await _db.SaveChangesAsync(ct);
        await _hub.Clients.Group(threadId).SendAsync("ReadReceiptUpdated", new { threadId, email, ts = ToUnixTimeMilliseconds(ts) }, ct);
        return NoContent();
    }

    /// <summary>
    /// Pin or unpin a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="request">Pin request with pinned flag</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Pins or unpins a thread for the authenticated user.
    /// 
    /// Pinned threads appear at the top of the thread list.
    /// Each user can pin/unpin threads independently.
    /// 
    /// Only thread members can pin threads.
    /// </remarks>
    [HttpPost("threads/{threadId}/pin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PinThread(string threadId, [FromBody] PinChatThreadRequest request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();
        if (!await IsThreadMemberAsync(threadId, email, ct)) return Forbid();

        var state = await _db.ChatUserStates.FirstOrDefaultAsync(s => s.ThreadId == threadId && s.UserEmail == email, ct);
        if (state == null)
        {
            state = new ChatUserStateEntity
            {
                Id = GenerateId("s"),
                ThreadId = threadId,
                UserEmail = email,
            };
            _db.ChatUserStates.Add(state);
        }

        state.PinnedAt = request.Pinned ? UtcNow() : null;
        await _db.SaveChangesAsync(ct);

        // Create activity for thread pin/unpin
        var thread = await _db.ChatThreads
            .Include(t => t.Participants)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);
        if (thread != null)
        {
            await CreateActivityForThreadPinAsync(thread, email, request.Pinned, ct);
        }

        return NoContent();
    }

    /// <summary>
    /// Update a chat thread (title, participants, AI settings)
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="request">Update request with optional title, participants, owner, and AI settings</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated thread summary</returns>
    /// <remarks>
    /// Requires authentication. Updates thread properties.
    /// 
    /// Permissions:
    /// - Thread owner or teachers can update title and participants
    /// - Only teachers can manage AI settings
    /// - Only thread owner can change owner
    /// 
    /// Features:
    /// - Can add/remove participants (only teachers or thread owner)
    /// - Can enable/disable AI assistant (only teachers)
    /// - Can update thread title
    /// - Can transfer ownership to another participant
    /// 
    /// Broadcasts thread update to all participants via SignalR.
    /// </remarks>
    [HttpPatch("threads/{threadId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateThread(string threadId, [FromBody] UpdateChatThreadRequest request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var thread = await _db.ChatThreads
            .Include(t => t.Participants)
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);

        if (thread == null) return NotFound();
        EnsureOwnership(thread, email);

        var callerRole = CurrentRole;
        var normalizedCaller = NormalizeEmail(email);
        var now = UtcNow();
        var ownerEmail = NormalizeEmail(thread.OwnerEmail);
        var isOwner = string.Equals(ownerEmail, normalizedCaller, StringComparison.OrdinalIgnoreCase);
        var canManageParticipants = isOwner || callerRole == "teacher";
        var canManageAi = isOwner || callerRole == "teacher";
        bool? aiToggle = request.AiEnabled;
        var mutated = false;
        var newlyAddedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(request.Title) && !string.Equals(thread.Title, request.Title.Trim(), StringComparison.Ordinal))
        {
            thread.Title = request.Title.Trim();
            mutated = true;
        }

        if (!string.IsNullOrWhiteSpace(request.OwnerEmail))
        {
            var newOwner = NormalizeEmail(request.OwnerEmail);
            if (thread.Participants.Any(p => NormalizeEmail(p.Email) == newOwner))
            {
                thread.OwnerEmail = newOwner;
                mutated = true;
            }
        }

        if (request.Participants != null)
        {
            if (!canManageParticipants)
            {
                return Forbid();
            }

            var desiredEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var wantsAiParticipant = false;

            foreach (var incoming in request.Participants)
            {
                var requestedRole = CanonicalRole(incoming.Role);
                if (requestedRole == "ai")
                {
                    wantsAiParticipant = true;
                    continue;
                }

                var candidateEmail = NormalizeEmail(incoming.Email);
                if (string.IsNullOrWhiteSpace(candidateEmail)) continue;
                desiredEmails.Add(candidateEmail);

                var existingParticipant = thread.Participants.FirstOrDefault(p => NormalizeEmail(p.Email) == candidateEmail);
                if (existingParticipant != null)
                {
                    if (!existingParticipant.IsActive)
                    {
                        existingParticipant.IsActive = true;
                        existingParticipant.JoinedAt = now;
                        mutated = true;
                        newlyAddedEmails.Add(candidateEmail);
                    }
                    continue;
                }

                var (resolvedRole, name) = await ResolveProfileAsync(candidateEmail, ct);
                EnsureCanAddParticipant(CurrentRole, resolvedRole);

                thread.Participants.Add(new ChatParticipantEntity
                {
                    Id = GenerateId("p"),
                    ThreadId = threadId,
                    Kind = resolvedRole,
                    Email = candidateEmail,
                    DisplayName = name,
                    JoinedAt = UtcNow(),
                    IsActive = true
                });
                newlyAddedEmails.Add(candidateEmail);
                mutated = true;
            }

            var existingActive = thread.Participants
                .Where(p => p.IsActive && CanonicalRole(p.Kind) != "ai")
                .ToList();

            foreach (var participant in existingActive)
            {
                var participantEmail = NormalizeEmail(participant.Email);
                if (string.IsNullOrWhiteSpace(participantEmail)) continue;
                if (desiredEmails.Contains(participantEmail)) continue;
                if (string.Equals(participantEmail, ownerEmail, StringComparison.OrdinalIgnoreCase)) continue;

                participant.IsActive = false;
                mutated = true;
            }

            if (!aiToggle.HasValue)
            {
                if (wantsAiParticipant)
                {
                    aiToggle = true;
                }
                else
                {
                    var hasActiveAi = thread.Participants.Any(p => CanonicalRole(p.Kind) == "ai" && p.IsActive);
                    if (hasActiveAi)
                    {
                        aiToggle = false;
                    }
                }
            }
        }

        if (aiToggle.HasValue)
        {
            if (!canManageAi)
            {
                return Forbid();
            }

            var aiParticipant = thread.Participants.FirstOrDefault(p => CanonicalRole(p.Kind) == "ai");
            if (aiToggle.Value)
            {
                if (aiParticipant == null)
                {
                    thread.Participants.Add(new ChatParticipantEntity
                    {
                        Id = GenerateId("p"),
                        ThreadId = threadId,
                        Kind = "ai",
                        DisplayName = "Gemini",
                        JoinedAt = now,
                        IsActive = true
                    });
                    mutated = true;
                }
                else if (!aiParticipant.IsActive)
                {
                    aiParticipant.IsActive = true;
                    aiParticipant.JoinedAt = now;
                    mutated = true;
                }
            }
            else if (aiParticipant != null && aiParticipant.IsActive)
            {
                aiParticipant.IsActive = false;
                mutated = true;
            }

            if (thread.AiEnabled != aiToggle.Value)
            {
                thread.AiEnabled = aiToggle.Value;
                mutated = true;
            }
        }

        if (mutated)
        {
            // Create ChatUserState entries for newly added participants
            if (newlyAddedEmails.Count > 0)
            {
                var existingStates = await _db.ChatUserStates
                    .Where(s => s.ThreadId == threadId)
                    .ToListAsync(ct);

                var existingStateEmails = new HashSet<string>(
                    existingStates.Select(s => NormalizeEmail(s.UserEmail)),
                    StringComparer.OrdinalIgnoreCase);

                foreach (var newEmail in newlyAddedEmails)
                {
                    var normalizedNewEmail = NormalizeEmail(newEmail);
                    if (!existingStateEmails.Contains(normalizedNewEmail))
                    {
                        _db.ChatUserStates.Add(new ChatUserStateEntity
                        {
                            Id = GenerateId("s"),
                            ThreadId = threadId,
                            UserEmail = normalizedNewEmail,
                            LastReadAt = now
                        });
                    }
                }
            }

            thread.UpdatedAt = now;
            await _db.SaveChangesAsync(ct);

            // Create activity for thread update
            await CreateActivityForThreadUpdateAsync(thread, email, newlyAddedEmails, mutated, ct);

            var state = await _db.ChatUserStates.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ThreadId == threadId && s.UserEmail == normalizedCaller, ct);

            var last = await _db.ChatMessages.AsNoTracking()
                .Where(m => m.ThreadId == threadId && m.DeletedAt == null)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync(ct);

            var lastReadAt = state?.LastReadAt ?? DateTime.MinValue;
            var unread = await _db.ChatMessages.AsNoTracking()
                .Where(m => m.ThreadId == threadId
                            && m.DeletedAt == null
                            && m.AuthorRole != "ai"
                            && (m.AuthorEmail == null || m.AuthorEmail == string.Empty || m.AuthorEmail.ToLower() != normalizedCaller)
                            && m.CreatedAt > lastReadAt)
                .CountAsync(ct);

            var summary = MapThreadSummary(thread, thread.Participants, state, last, unread);

            // Broadcast to thread group for all participants
            await BroadcastThreadUpdateAsync(thread.Id, summary, ct);

            // Broadcast ThreadCreated to newly added participants' personal SignalR groups
            // (so they see the thread appear in their list even if they're not connected to the thread group yet)
            if (newlyAddedEmails.Count > 0)
            {
                foreach (var newEmail in newlyAddedEmails)
                {
                    await _hub.Clients.Group($"user:{newEmail}").SendAsync("ThreadCreated", summary, ct);
                }
            }

            return Ok(summary);
        }

        return NoContent();
    }

    /// <summary>
    /// Clear all messages from a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Clears all messages from a thread (deletes all messages and attachments).
    /// 
    /// Only the thread owner can clear messages.
    /// Deletes all message files from storage.
    /// Broadcasts thread cleared event to all participants via SignalR.
    /// </remarks>
    [HttpPost("threads/{threadId}/clear")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ClearThread(string threadId, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var thread = await _db.ChatThreads
            .Include(t => t.Messages).ThenInclude(m => m.Attachments)
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);

        if (thread == null) return NotFound();
        EnsureOwnership(thread, email);

        foreach (var attachment in thread.Messages.SelectMany(m => m.Attachments))
        {
            if (!string.IsNullOrWhiteSpace(attachment.StoragePath) && System.IO.File.Exists(attachment.StoragePath))
            {
                System.IO.File.Delete(attachment.StoragePath);
            }
        }

        _db.ChatMessages.RemoveRange(thread.Messages);
        thread.LastMessageAt = null;
        thread.LastMessagePreview = null;
        thread.UpdatedAt = UtcNow();
        await _db.SaveChangesAsync(ct);

        // Create activity for thread clear
        await CreateActivityForThreadClearAsync(thread, email, ct);

        await _hub.Clients.Group(threadId).SendAsync("ThreadCleared", new { threadId }, ct);
        return NoContent();
    }

    /// <summary>
    /// Delete a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Permanently deletes a chat thread and all its messages and attachments.
    /// 
    /// Only the thread owner can delete the thread.
    /// Deletes all message files from storage.
    /// Broadcasts thread deletion to all participants via SignalR.
    /// </remarks>
    [HttpDelete("threads/{threadId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteThread(string threadId, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var thread = await _db.ChatThreads
            .Include(t => t.Messages).ThenInclude(m => m.Attachments)
            .FirstOrDefaultAsync(t => t.Id == threadId, ct);

        if (thread == null) return NotFound();
        EnsureOwnership(thread, email);

        foreach (var attachment in thread.Messages.SelectMany(m => m.Attachments))
        {
            if (!string.IsNullOrWhiteSpace(attachment.StoragePath) && System.IO.File.Exists(attachment.StoragePath))
            {
                System.IO.File.Delete(attachment.StoragePath);
            }
        }

        // Create activity for thread deletion before removing
        await CreateActivityForThreadDeletionAsync(thread, email, ct);

        _db.ChatThreads.Remove(thread);
        await _db.SaveChangesAsync(ct);
        await _hub.Clients.Group(threadId).SendAsync("ThreadDeleted", new { threadId }, ct);
        return NoContent();
    }

    /// <summary>
    /// Get AI settings for a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>AI configuration (AI enabled status, has key flag, model name, updated timestamp)</returns>
    /// <remarks>
    /// Requires authentication. Returns AI configuration for a thread.
    /// 
    /// Only returns whether API key exists (hasKey), not the actual key.
    /// API key is encrypted and never exposed.
    /// Only thread owner can view AI settings.
    /// </remarks>
    [HttpGet("threads/{threadId}/ai/settings")]
    [ProducesResponseType(typeof(ChatAiSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatAiSettingsResponse>> GetAiSettings(string threadId, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var thread = await _db.ChatThreads.FirstOrDefaultAsync(t => t.Id == threadId, ct);
        if (thread == null) return NotFound();
        EnsureOwnership(thread, email);

        var config = ReadAiConfig(thread);
        var hasKey = !string.IsNullOrWhiteSpace(config?.EncryptedKey) || !string.IsNullOrWhiteSpace(_geminiOptions.ApiKey);
        return Ok(new ChatAiSettingsResponse
        {
            AiEnabled = thread.AiEnabled,
            HasKey = hasKey,
            Model = config?.Model,
            UpdatedAt = config?.UpdatedAt
        });
    }

    /// <summary>
    /// Update AI settings for a chat thread (teachers only)
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="request">AI configuration update with optional API key and model</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated AI configuration (model name only)</returns>
    /// <remarks>
    /// Requires teacher role. Updates AI configuration for a thread.
    /// 
    /// Features:
    /// - Can set/update Gemini API key (encrypted before storage)
    /// - Can set/update AI model name
    /// - API key is encrypted using data protection
    /// - Only returns model name in response (API key never exposed)
    /// 
    /// Only teachers can update AI settings.
    /// </remarks>
    [HttpPut("threads/{threadId}/ai/settings")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAiSettings(string threadId, [FromBody] UpdateChatAiSettingsRequest request, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();

        var thread = await _db.ChatThreads.FirstOrDefaultAsync(t => t.Id == threadId, ct);
        if (thread == null) return NotFound();
        EnsureOwnership(thread, email);

        thread.AiEnabled = request.AiEnabled;
        WriteAiConfig(thread, request.ApiKey, request.Model);
        thread.UpdatedAt = UtcNow();
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Upload an attachment file for a chat thread
    /// </summary>
    /// <param name="threadId">Thread identifier</param>
    /// <param name="file">File to upload (multipart/form-data)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Upload response with file URL and metadata</returns>
    /// <remarks>
    /// Requires authentication. Uploads a file attachment for use in chat messages.
    /// 
    /// Features:
    /// - Maximum file size: 20 MB
    /// - Files are stored in thread-specific folders
    /// - Returns download URL for use in message attachments
    /// - Only thread members can upload attachments
    /// 
    /// The uploaded file can then be referenced in message attachments when sending messages.
    /// </remarks>
    [HttpPost("threads/{threadId}/attachments")]
    [RequestSizeLimit(MaxAttachmentBytes)]
    [ProducesResponseType(typeof(ChatAttachmentUploadResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ChatAttachmentUploadResponse>> UploadAttachment(string threadId, IFormFile file, CancellationToken ct)
    {
        var email = CurrentEmail;
        if (string.IsNullOrWhiteSpace(email)) return Forbid();
        if (!await IsThreadMemberAsync(threadId, email, ct)) return Forbid();

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "File is required." });
        }

        if (file.Length > MaxAttachmentBytes)
        {
            return BadRequest(new { error = "File exceeds maximum size (20 MB)." });
        }

        var contentDisposition = ContentDispositionHeaderValue.Parse(file.ContentDisposition);
        var originalFileName = contentDisposition.FileNameStar.HasValue
            ? contentDisposition.FileNameStar.Value
            : contentDisposition.FileName.HasValue ? contentDisposition.FileName.Value : file.FileName;
        var safeFileName = Path.GetFileName(originalFileName ?? file.FileName);
        var extension = Path.GetExtension(safeFileName);
        var storageName = $"{Guid.NewGuid():N}{extension}";
        var folder = Path.Combine(UploadsRoot, threadId);
        Directory.CreateDirectory(folder);
        var physicalPath = Path.Combine(folder, storageName);

        await using (var stream = System.IO.File.Create(physicalPath))
        {
            await file.CopyToAsync(stream, ct);
        }

        var url = $"/{UploadFolderName}/{threadId}/{storageName}";
        var response = new ChatAttachmentUploadResponse
        {
            Name = safeFileName,
            ContentType = file.ContentType,
            Size = file.Length,
            Url = url,
            UploadId = storageName
        };
        return Ok(response);
    }

    private async Task CreateActivityForThreadCreationAsync(
        ChatThreadEntity thread,
        string creatorEmail,
        string creatorRole,
        string creatorName,
        List<ChatParticipantEntity> participants,
        CancellationToken ct)
    {
        try
        {
            var now = UtcNow();
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var participantEmails = participants
                .Where(p => p.Kind != "ai" && !string.IsNullOrWhiteSpace(p.Email))
                .Select(p => NormalizeEmail(p.Email))
                .Where(e => e != creatorEmail)
                .ToList();

            var meta = new Dictionary<string, object>
            {
                ["threadId"] = thread.Id,
                ["participants"] = participantEmails,
                ["participantCount"] = participantEmails.Count,
                ["aiEnabled"] = thread.AiEnabled
            };

            // Create activity for creator
            var creatorActivity = new ActivityEntity
            {
                Id = $"{activityId}_creator",
                Type = "communications",
                Title = $"Created chat thread: {thread.Title}",
                Description = participantEmails.Count > 0
                    ? $"Chat with {participantEmails.Count} participant(s)"
                    : "Personal chat thread",
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                TeacherEmail = creatorRole == "teacher" ? creatorEmail : null,
                TeacherDisplay = creatorRole == "teacher" ? creatorName : null,
                StudentEmail = creatorRole == "student" ? creatorEmail : null,
                StudentName = creatorRole == "student" ? creatorName : null,
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                CreatedByEmail = creatorEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(creatorActivity);

            // Create activities for other participants
            foreach (var participantEmail in participantEmails)
            {
                var (role, name) = await ResolveProfileAsync(participantEmail, ct);
                var participantActivity = new ActivityEntity
                {
                    Id = $"{activityId}_p_{participantEmail.GetHashCode()}",
                    Type = "communications",
                    Title = $"New chat thread: {thread.Title}",
                    Description = $"You were added to a chat by {creatorName}",
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "medium",
                    TeacherEmail = role == "teacher" ? participantEmail : null,
                    TeacherDisplay = role == "teacher" ? name : null,
                    StudentEmail = role == "student" ? participantEmail : null,
                    StudentName = role == "student" ? name : null,
                    MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                    CreatedByEmail = creatorEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(participantActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to create activity for thread creation {ThreadId}", thread.Id);
        }
    }

    private async Task CreateActivityForThreadDeletionAsync(
        ChatThreadEntity thread,
        string deleterEmail,
        CancellationToken ct)
    {
        try
        {
            var now = UtcNow();
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var participants = await _db.ChatParticipants
                .Where(p => p.ThreadId == thread.Id && p.Kind != "ai" && !string.IsNullOrWhiteSpace(p.Email))
                .ToListAsync(ct);

            var (deleterRole, deleterName) = await ResolveProfileAsync(deleterEmail, ct);

            var meta = new Dictionary<string, object>
            {
                ["threadId"] = thread.Id,
                ["threadTitle"] = thread.Title ?? "Untitled chat"
            };

            // Create activity for all participants
            foreach (var participant in participants)
            {
                var participantEmail = NormalizeEmail(participant.Email);
                if (string.IsNullOrWhiteSpace(participantEmail)) continue;

                var (role, name) = await ResolveProfileAsync(participantEmail, ct);
                var activity = new ActivityEntity
                {
                    Id = $"{activityId}_{participantEmail.GetHashCode()}",
                    Type = "communications",
                    Title = $"Chat thread deleted: {thread.Title}",
                    Description = participantEmail == deleterEmail
                        ? "You deleted this chat thread"
                        : $"Chat thread was deleted by {deleterName}",
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    TeacherEmail = role == "teacher" ? participantEmail : null,
                    TeacherDisplay = role == "teacher" ? name : null,
                    StudentEmail = role == "student" ? participantEmail : null,
                    StudentName = role == "student" ? name : null,
                    MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                    CreatedByEmail = deleterEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(activity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to create activity for thread deletion {ThreadId}", thread.Id);
        }
    }

    private async Task CreateActivityForThreadUpdateAsync(
        ChatThreadEntity thread,
        string updaterEmail,
        HashSet<string> newlyAddedEmails,
        bool mutated,
        CancellationToken ct)
    {
        try
        {
            if (!mutated) return;

            var now = UtcNow();
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var participants = thread.Participants?.Where(p => p.IsActive && !string.IsNullOrWhiteSpace(p.Email)).ToList() ?? new List<ChatParticipantEntity>();
            var (updaterRole, updaterName) = await ResolveProfileAsync(updaterEmail, ct);

            var meta = new Dictionary<string, object>
            {
                ["threadId"] = thread.Id,
                ["threadTitle"] = thread.Title ?? "Untitled chat",
                ["newParticipants"] = newlyAddedEmails.ToList()
            };

            // Create activity for updater
            var updaterActivity = new ActivityEntity
            {
                Id = $"{activityId}_updater",
                Type = "communications",
                Title = $"Updated chat thread: {thread.Title}",
                Description = newlyAddedEmails.Count > 0
                    ? $"Added {newlyAddedEmails.Count} participant(s)"
                    : "Thread settings updated",
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                TeacherEmail = updaterRole == "teacher" ? updaterEmail : null,
                TeacherDisplay = updaterRole == "teacher" ? updaterName : null,
                StudentEmail = updaterRole == "student" ? updaterEmail : null,
                StudentName = updaterRole == "student" ? updaterName : null,
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                CreatedByEmail = updaterEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(updaterActivity);

            // Create activities for newly added participants
            foreach (var newEmail in newlyAddedEmails)
            {
                var normalizedNewEmail = NormalizeEmail(newEmail);
                if (string.IsNullOrWhiteSpace(normalizedNewEmail)) continue;

                var (role, name) = await ResolveProfileAsync(normalizedNewEmail, ct);
                var activity = new ActivityEntity
                {
                    Id = $"{activityId}_added_{normalizedNewEmail.GetHashCode()}",
                    Type = "communications",
                    Title = $"Added to chat thread: {thread.Title}",
                    Description = $"You were added to this chat thread by {updaterName}",
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "medium",
                    TeacherEmail = role == "teacher" ? normalizedNewEmail : null,
                    TeacherDisplay = role == "teacher" ? name : null,
                    StudentEmail = role == "student" ? normalizedNewEmail : null,
                    StudentName = role == "student" ? name : null,
                    MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                    CreatedByEmail = updaterEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(activity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to create activity for thread update {ThreadId}", thread.Id);
        }
    }

    private async Task CreateActivityForThreadPinAsync(
        ChatThreadEntity thread,
        string userEmail,
        bool pinned,
        CancellationToken ct)
    {
        try
        {
            var now = UtcNow();
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var (role, name) = await ResolveProfileAsync(userEmail, ct);

            var meta = new Dictionary<string, object>
            {
                ["threadId"] = thread.Id,
                ["threadTitle"] = thread.Title ?? "Untitled chat",
                ["pinned"] = pinned
            };

            var activity = new ActivityEntity
            {
                Id = $"{activityId}_pin",
                Type = "communications",
                Title = pinned ? $"Pinned chat thread: {thread.Title}" : $"Unpinned chat thread: {thread.Title}",
                Description = pinned ? "You pinned this chat thread" : "You unpinned this chat thread",
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                TeacherEmail = role == "teacher" ? userEmail : null,
                TeacherDisplay = role == "teacher" ? name : null,
                StudentEmail = role == "student" ? userEmail : null,
                StudentName = role == "student" ? name : null,
                MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                CreatedByEmail = userEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(activity);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to create activity for thread pin {ThreadId}", thread.Id);
        }
    }

    private async Task CreateActivityForThreadClearAsync(
        ChatThreadEntity thread,
        string clearerEmail,
        CancellationToken ct)
    {
        try
        {
            var now = UtcNow();
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            var participants = await _db.ChatParticipants
                .Where(p => p.ThreadId == thread.Id && p.Kind != "ai" && !string.IsNullOrWhiteSpace(p.Email))
                .ToListAsync(ct);

            var (clearerRole, clearerName) = await ResolveProfileAsync(clearerEmail, ct);

            var meta = new Dictionary<string, object>
            {
                ["threadId"] = thread.Id,
                ["threadTitle"] = thread.Title ?? "Untitled chat"
            };

            // Create activity for all participants
            foreach (var participant in participants)
            {
                var participantEmail = NormalizeEmail(participant.Email);
                if (string.IsNullOrWhiteSpace(participantEmail)) continue;

                var (role, name) = await ResolveProfileAsync(participantEmail, ct);
                var activity = new ActivityEntity
                {
                    Id = $"{activityId}_{participantEmail.GetHashCode()}",
                    Type = "communications",
                    Title = $"Chat thread cleared: {thread.Title}",
                    Description = participantEmail == clearerEmail
                        ? "You cleared all messages in this chat thread"
                        : $"All messages were cleared by {clearerName}",
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    TeacherEmail = role == "teacher" ? participantEmail : null,
                    TeacherDisplay = role == "teacher" ? name : null,
                    StudentEmail = role == "student" ? participantEmail : null,
                    StudentName = role == "student" ? name : null,
                    MetaJson = System.Text.Json.JsonSerializer.Serialize(meta, JsonOptions),
                    CreatedByEmail = clearerEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(activity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to create activity for thread clear {ThreadId}", thread.Id);
        }
    }
}


