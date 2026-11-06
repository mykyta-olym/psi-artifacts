namespace Mais.Web.Services;

/// <summary>
/// Helper service for determining academic degrees based on program/specialty
/// </summary>
public static class AcademicDegreeHelper
{
    // Map program level to Slovak academic degrees
    private static readonly Dictionary<string, string> LevelToDegree = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Bachelor", "Bc." },
        { "Bakalársky", "Bc." },
        { "Master", "Ing." },
        { "Magisterský", "Ing." },
        { "Inžiniersky", "Ing." },
        { "Engineer", "Ing." },
        { "Doctoral", "PhD." },
        { "Doktorandský", "PhD." }
    };

    // Special program mappings (some master programs award Mgr. instead of Ing.)
    private static readonly Dictionary<string, string> ProgramToDegree = new(StringComparer.OrdinalIgnoreCase)
    {
        // Add specific programs that award different degrees
        // e.g., humanities/social sciences typically award Mgr.
        { "Psychology", "Mgr." },
        { "Economics", "Ing." },
        { "Management", "Ing." },
        { "Cybersecurity", "Ing." },
        { "Computer Science", "Ing." },
        { "Informatika", "Ing." },
        { "Software Engineering", "Ing." }
    };

    /// <summary>
    /// Determine the academic degree for a program
    /// </summary>
    public static string? GetDegreeForProgram(string programName, string programLevel)
    {
        // First check specific program mapping
        if (!string.IsNullOrWhiteSpace(programName) && ProgramToDegree.TryGetValue(programName, out var specificDegree))
        {
            return specificDegree;
        }

        // Fall back to level-based mapping
        if (!string.IsNullOrWhiteSpace(programLevel) && LevelToDegree.TryGetValue(programLevel, out var levelDegree))
        {
            return levelDegree;
        }

        return null;
    }

    /// <summary>
    /// Check if student is eligible for graduation and return the degree they would earn
    /// </summary>
    public static (bool eligible, string? degree) CheckGraduationEligibility(
        bool? thesisApproved,
        bool? allCreditsEarned,
        bool? allGradesSubmitted,
        string programName,
        string programLevel,
        int studyYear,
        int requiredYears,
        string? enrollmentDate = null)
    {
        // Check academic requirements
        bool requirementsMet = thesisApproved == true 
                             && allCreditsEarned == true 
                             && allGradesSubmitted == true;

        if (!requirementsMet)
        {
            return (false, null);
        }

        // Check time requirement: either studyYear >= requiredYears OR enrollment date + required years has passed
        bool timeRequirementMet = studyYear >= requiredYears;
        
        // If enrollment date is provided, also check if enough time has passed
        if (!string.IsNullOrWhiteSpace(enrollmentDate) && DateTime.TryParse(enrollmentDate, out var enrolled))
        {
            var minGraduationDate = enrolled.AddYears(requiredYears);
            var hasEnoughTimePassed = DateTime.UtcNow >= minGraduationDate;
            
            // Student is eligible if BOTH conditions are met:
            // 1. They've been enrolled long enough (time-based)
            // 2. They're in the correct year or beyond (year-based)
            timeRequirementMet = hasEnoughTimePassed && studyYear >= requiredYears;
        }

        if (!timeRequirementMet)
        {
            return (false, null);
        }

        var degree = GetDegreeForProgram(programName, programLevel);
        return (true, degree);
    }

    /// <summary>
    /// Get required years for program level (fallback if not in database)
    /// </summary>
    public static int GetRequiredYears(string programLevel)
    {
        return programLevel?.ToLowerInvariant() switch
        {
            "bachelor" or "bakalársky" => 3,
            "master" or "magisterský" or "inžiniersky" or "engineer" => 2,
            "doctoral" or "doktorandský" => 3,
            _ => 3
        };
    }

    /// <summary>
    /// Get degree for program level (fallback if not in database)
    /// </summary>
    public static string GetDegreeForLevel(string programLevel)
    {
        return programLevel?.ToLowerInvariant() switch
        {
            "bachelor" or "bakalársky" => "Bc.",
            "master" or "inžiniersky" or "engineer" => "Ing.",
            "magisterský" => "Mgr.",
            "doctoral" or "doktorandský" => "PhD.",
            _ => "Bc."
        };
    }
}
