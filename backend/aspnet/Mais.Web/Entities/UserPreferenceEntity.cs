using System;

namespace Mais.Web.Entities;

public class UserPreferenceEntity
{
    public string UserEmail { get; set; } = string.Empty;
    public string PreferenceKey { get; set; } = string.Empty;
    public string JsonValue { get; set; } = "null";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

