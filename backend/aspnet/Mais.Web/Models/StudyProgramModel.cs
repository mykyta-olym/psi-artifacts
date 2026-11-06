using System;

namespace Mais.Web.Models;

public class StudyProgramModel
{
    public string Uid { get; set; } = string.Empty;
    public string StudentId { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public string ProgramName { get; set; } = string.Empty;
    public string ProgramCode { get; set; } = string.Empty;
    public string Faculty { get; set; } = string.Empty;
    public string OspYear { get; set; } = "1";
    public string Status { get; set; } = "ongoing";
    public bool Ongoing { get; set; }
    public string Degree { get; set; } = string.Empty;
    public bool Preferred { get; set; }
    public DateTime? LastActivity { get; set; }
}


