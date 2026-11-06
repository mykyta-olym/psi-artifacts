using System.Globalization;
using System.Text;

namespace Mais.Web.Services;

public static class IdGenerator
{
    private const int MaxAttempts = 200;

    private static string RemoveDiacritics(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat != UnicodeCategory.NonSpacingMark) sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string FirstAlpha(string? source)
    {
        var cleaned = RemoveNonLetters(RemoveDiacritics(source).ToLowerInvariant());
        if (!string.IsNullOrEmpty(cleaned)) return cleaned[0].ToString();
        return string.Empty;
    }

    private static string RemoveNonLetters(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var sb = new StringBuilder(input.Length);
        foreach (var ch in input)
        {
            if (ch is >= 'a' and <= 'z') sb.Append(ch);
        }
        return sb.ToString();
    }

    private static uint Fnva(string value)
    {
        const uint offset = 2166136261;
        const uint prime = 16777619;
        uint hash = offset;
        var str = value ?? string.Empty;
        foreach (var ch in str)
        {
            hash ^= ch;
            hash *= prime;
        }
        return hash;
    }

    private static string TailFromSeed(string seed)
    {
        var hDigits = Fnva(seed + "::digits");
        var hLetters = Fnva(seed + "::letters");
        var digits = (hDigits % 1000).ToString("000");
        var l3 = (char)('a' + (int)(hLetters % 26));
        var l4 = (char)('a' + (int)((hLetters >> 7) % 26));
        return digits + l3 + l4;
    }

    public static string GenerateEmployeeId(string? given, string? family, string? email, ISet<string>? reserved = null)
    {
        var p1 = FirstAlpha(given);
        var p2 = FirstAlpha(family);

        if (string.IsNullOrEmpty(p1)) p1 = FirstAlpha(email);
        if (string.IsNullOrEmpty(p2))
        {
            var local = email?.Split('@')[0] ?? string.Empty;
            p2 = FirstAlpha(local);
        }
        if (string.IsNullOrEmpty(p1)) p1 = "x";
        if (string.IsNullOrEmpty(p2)) p2 = "x";

        var seedBase = $"{email}|{given}|{family}|{p1}{p2}";
        var used = reserved ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var attempt = 0; attempt < MaxAttempts; attempt++)
        {
            var tail = TailFromSeed(seedBase + "|" + attempt);
            var candidate = (p1 + p2 + tail).ToLowerInvariant();
            if (!used.Contains(candidate))
            {
                used.Add(candidate);
                return candidate;
            }
        }

        var fallback = (p1 + p2 + Guid.NewGuid().ToString("N").Substring(0, 5)).ToLowerInvariant();
        used.Add(fallback);
        return fallback;
    }
}


