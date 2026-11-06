using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using Mais.Web.Entities;
using Mais.Web.Models.Documents;

namespace Mais.Web.Services;

public static class DocumentModelFactory
{
    private static readonly string[] TokenKeys =
    {
        "fullName","program","faculty","studyForm","studyLevel","year","issuedAt","validUntil",
        "studentId","email","phone","address","accommodationAddress","accommodationFrom","accommodationTo",
        "upsvarPurpose","language","dateOfBirth","placeOfBirth","nationalId"
    };

    public static DocumentRenderModel CreateModel(DocumentFormDto? form)
    {
        var issuedAt = NormalizeDate(form?.IssuedAt) ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var accommodationFrom = NormalizeDate(form?.AccommodationFrom) ?? issuedAt;
        return new DocumentRenderModel
        {
            TemplateKey = string.Empty,
            FullName = Normalize(form?.FullName),
            DateOfBirth = NormalizeDate(form?.DateOfBirth) ?? string.Empty,
            PlaceOfBirth = Normalize(form?.PlaceOfBirth),
            NationalId = Normalize(form?.NationalId),
            Address = Normalize(form?.Address),
            Program = Normalize(form?.Program),
            Faculty = Normalize(form?.Faculty),
            StudyForm = Normalize(form?.StudyForm, "Full-time"),
            StudyLevel = Normalize(form?.StudyLevel),
            Year = Normalize(form?.Year),
            Phone = Normalize(form?.Phone),
            Email = Normalize(form?.Email),
            StudentId = Normalize(form?.StudentId),
            IssuedAt = issuedAt,
            ValidUntil = NormalizeDate(form?.ValidUntil) ?? string.Empty,
            AccommodationAddress = Normalize(form?.AccommodationAddress),
            AccommodationFrom = accommodationFrom,
            AccommodationTo = NormalizeDate(form?.AccommodationTo) ?? string.Empty,
            UpsvarPurpose = Normalize(form?.UpsvarPurpose),
            Language = Normalize(form?.Language, "en"),
            IncludeQr = form?.IncludeQr ?? true,
            IncludeWatermark = form?.IncludeWatermark ?? true
        };
    }

    public static void ApplyStudentContext(DocumentRenderModel model, StudentEntity student)
    {
        if (!string.IsNullOrWhiteSpace(student.FullName)) model.FullName = student.FullName;
        if (!string.IsNullOrWhiteSpace(student.Program)) model.Program = student.Program;
        if (!string.IsNullOrWhiteSpace(student.Faculty)) model.Faculty = student.Faculty;
        if (student.StudyYear > 0) model.Year = student.StudyYear.ToString();
        model.Email = string.IsNullOrWhiteSpace(student.Email) ? model.Email : student.Email!;
        model.Phone = string.IsNullOrWhiteSpace(student.Phone) ? model.Phone : student.Phone!;
        model.Address = string.IsNullOrWhiteSpace(student.Address) ? model.Address : student.Address!;
        model.DateOfBirth = string.IsNullOrWhiteSpace(student.BirthDate) ? model.DateOfBirth : student.BirthDate!;
        model.PlaceOfBirth = string.IsNullOrWhiteSpace(student.BirthPlace) ? model.PlaceOfBirth : student.BirthPlace!;
        model.NationalId = string.IsNullOrWhiteSpace(student.PassportId) ? model.NationalId : student.PassportId!;
        model.StudyLevel = string.IsNullOrWhiteSpace(model.StudyLevel) ? MapDegreeToLevel(student.Degree) : model.StudyLevel;
        model.StudentId = DetermineStudentId(model.StudentId, student);
        if (string.IsNullOrWhiteSpace(model.AccommodationAddress) && !string.IsNullOrWhiteSpace(student.Address))
        {
            model.AccommodationAddress = student.Address!;
        }
    }

    public static string ApplyPlaceholders(string html, DocumentRenderModel model)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in TokenKeys)
        {
            var value = key switch
            {
                "fullName" => model.FullName,
                "program" => model.Program,
                "faculty" => model.Faculty,
                "studyForm" => model.StudyForm,
                "studyLevel" => model.StudyLevel,
                "year" => model.Year,
                "issuedAt" => model.IssuedAt,
                "validUntil" => model.ValidUntil,
                "studentId" => model.StudentId,
                "email" => model.Email,
                "phone" => model.Phone,
                "address" => model.Address,
                "accommodationAddress" => model.AccommodationAddress,
                "accommodationFrom" => model.AccommodationFrom,
                "accommodationTo" => model.AccommodationTo,
                "upsvarPurpose" => model.UpsvarPurpose,
                "language" => model.Language,
                "dateOfBirth" => model.DateOfBirth,
                "placeOfBirth" => model.PlaceOfBirth,
                "nationalId" => model.NationalId,
                _ => string.Empty
            } ?? string.Empty;
            map[key] = WebUtility.HtmlEncode(value);
        }
        map["currentDate"] = WebUtility.HtmlEncode(DateTime.UtcNow.ToString("yyyy-MM-dd"));

        var result = new StringBuilder(html);
        foreach (var kvp in map)
        {
            result.Replace("{{" + kvp.Key + "}}", kvp.Value);
        }
        return result.ToString();
    }

    public static string GetTemplateTitle(string templateKey)
    {
        return templateKey switch
        {
            DocumentTemplateKeys.StudyConfirmation => "Confirmation of Study",
            DocumentTemplateKeys.LabourOfficeConfirmation => "Labour Office Confirmation",
            DocumentTemplateKeys.Matriculation => "Matriculation Letter",
            DocumentTemplateKeys.StudyOverview => "Study Overview",
            DocumentTemplateKeys.AccommodationContract => "Accommodation Contract",
            DocumentTemplateKeys.AccommodationAddendum => "Accommodation Addendum",
            DocumentTemplateKeys.ResidenceReport => "Residence Report",
            DocumentTemplateKeys.TeacherProfile => "Teacher Profile",
            _ => string.IsNullOrWhiteSpace(templateKey) ? "Document" : templateKey
        };
    }

    private static string DetermineStudentId(string current, StudentEntity student)
    {
        if (!string.IsNullOrWhiteSpace(current)) return current;
        if (!string.IsNullOrWhiteSpace(student.StudentNumber)) return student.StudentNumber!;
        if (!string.IsNullOrWhiteSpace(student.StudyNumber)) return student.StudyNumber!;
        if (!string.IsNullOrWhiteSpace(student.PersonId)) return student.PersonId!;
        return student.Id;
    }

    private static string MapDegreeToLevel(string? degree)
    {
        var value = (degree ?? string.Empty).Trim().ToLowerInvariant();
        if (value.Contains("ing") || value.Contains("mgr")) return "M.Sc.";
        if (value.Contains("bc")) return "B.Sc.";
        return string.IsNullOrEmpty(degree) ? "B.Sc." : degree!;
    }

    private static string Normalize(string? value, string fallback = "")
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string? NormalizeDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateTime.TryParse(value, out var parsed))
        {
            return parsed.ToString("yyyy-MM-dd");
        }
        return value.Trim();
    }
}
