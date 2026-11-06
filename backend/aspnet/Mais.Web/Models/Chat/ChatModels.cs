using System.ComponentModel.DataAnnotations;

namespace Mais.Web.Models.Chat;

public class ChatParticipantModel
{
    public string Id { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "student";
}

public class ChatReactionModel
{
    public string Emoji { get; set; } = string.Empty;
    public IReadOnlyCollection<string> By { get; set; } = Array.Empty<string>();
}

public class ChatAttachmentModel
{
    public string Name { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long Size { get; set; }
    public string? Url { get; set; }
}

public class ChatMessageModel
{
    public string Id { get; set; } = string.Empty;
    public string ThreadId { get; set; } = string.Empty;
    public string? ReplyToId { get; set; }
    public string? ClientId { get; set; }
    public string AuthorId { get; set; } = string.Empty;
    public string? AuthorEmail { get; set; }
    public string AuthorRole { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public bool Announcement { get; set; }
    public bool TargetAi { get; set; }
    public long Ts { get; set; }
    public long? UpdatedTs { get; set; }
    public bool Deleted { get; set; }
    public IReadOnlyCollection<ChatReactionModel> Reactions { get; set; } = Array.Empty<ChatReactionModel>();
    public IReadOnlyCollection<ChatAttachmentModel> Attachments { get; set; } = Array.Empty<ChatAttachmentModel>();
}

public class ChatThreadSummaryModel
{
    public string Id { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string OwnerId { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public bool AiEnabled { get; set; }
    public long CreatedTs { get; set; }
    public long UpdatedTs { get; set; }
    public long? LastMessageTs { get; set; }
    public string? LastMessagePreview { get; set; }
    public int UnreadCount { get; set; }
    public bool Pinned { get; set; }
    public IReadOnlyCollection<ChatParticipantModel> Participants { get; set; } = Array.Empty<ChatParticipantModel>();
}

public class ChatThreadDetailModel : ChatThreadSummaryModel
{
    public IReadOnlyCollection<ChatMessageModel> Messages { get; set; } = Array.Empty<ChatMessageModel>();
}

public class ChatParticipantInput
{
    [Required]
    public string Email { get; set; } = string.Empty;

    public string? Name { get; set; }

    public string? Role { get; set; }
}

public class CreateChatThreadRequest
{
    public string? Title { get; set; }

    public bool InviteAi { get; set; }

    public List<ChatParticipantInput> Participants { get; set; } = new();
}

public class UpdateChatThreadRequest
{
    public string? Title { get; set; }
    public string? OwnerEmail { get; set; }
    public List<ChatParticipantInput>? Participants { get; set; }
    public bool? AiEnabled { get; set; }
}

public class ChatAttachmentInput
{
    [Required]
    public string Name { get; set; } = string.Empty;

    public string? ContentType { get; set; }

    public long Size { get; set; }

    public string? Url { get; set; }
}

public class SendChatMessageRequest
{
    public string? Text { get; set; }
    public string? ReplyToId { get; set; }
    public string? ClientId { get; set; }
    public bool Announcement { get; set; }
    public bool TargetAi { get; set; }
    public List<ChatAttachmentInput> Attachments { get; set; } = new();
}

public class MarkChatReadRequest
{
    public long? Ts { get; set; }
}

public class PinChatThreadRequest
{
    public bool Pinned { get; set; }
}

public class ToggleReactionRequest
{
    [Required]
    [MaxLength(32)]
    public string Emoji { get; set; } = string.Empty;
}

public class UpdateChatMessageRequest
{
    [Required]
    [MaxLength(8000)]
    public string Text { get; set; } = string.Empty;
}

public class ChatAiSettingsResponse
{
    public bool AiEnabled { get; set; }
    public bool HasKey { get; set; }
    public string? Model { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UpdateChatAiSettingsRequest
{
    public bool AiEnabled { get; set; }

    [MaxLength(200)]
    public string? Model { get; set; }

    /// <summary>
    /// Optional API key. Provide null to keep existing, empty string to clear.
    /// </summary>
    public string? ApiKey { get; set; }
}

public class ChatAttachmentUploadResponse : ChatAttachmentModel
{
    public string? UploadId { get; set; }
}

