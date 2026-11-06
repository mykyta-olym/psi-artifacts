namespace Mais.Web.Models;

public class ClassSessionModel
{
    public string Day { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
}

public class ClassModel
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public int Students { get; set; }
    public string OwnerId { get; set; } = string.Empty;
    public int SessionsCount { get; set; }
    public List<ClassSessionModel> Sessions { get; set; } = new();
    public List<string> ClassGroupKeys { get; set; } = new();
    public string? Type { get; set; } // CL, P, S - class type from timetable entries
    public string? Kind { get; set; } // Alias for Type for compatibility
    public string? CompletionSk { get; set; } // Cr (credit only) or CrEx (credit + exam) - course assessment type
    public string? Profile { get; set; } // PV (compulsory), PVP (compulsory elective), PP (not compulsory)
    public int Credits { get; set; } // ECTS credits
}
