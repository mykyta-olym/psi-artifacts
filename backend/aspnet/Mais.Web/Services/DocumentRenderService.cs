using System.Linq;
using System.Net;
using System.Text;
using System.Text.Json;
using Mais.Web.Models.Documents;

namespace Mais.Web.Services;

public interface IDocumentRenderService
{
    string RenderStandardDocument(string templateKey, DocumentRenderModel model);
    string RenderTeacherProfileDocument(TeacherProfileDocumentModel model);
}

public class DocumentRenderService : IDocumentRenderService
{
        private const string StyleSheet = @"
    <style>
        *{box-sizing:border-box}
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,""Helvetica Neue"",Arial,""Noto Sans"",""Apple Color Emoji"",""Segoe UI Emoji"";line-height:1.35;margin:0;background:#fff;color:#111827}
        .doc{width:100%;max-width:100%;margin:0 auto;padding:24px}
        .hdr{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
        .hdr .logo{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
        .hdr h1{font-size:22px;margin:0 0 4px 0}
        .hdr p{margin:0;color:#6b7280}
        .title{margin:24px 0 12px 0;text-transform:uppercase;font-size:18px;font-weight:800}
        .sub{color:#374151;margin-bottom:16px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}
        .row{display:grid;grid-template-columns:220px 1fr;gap:12px;padding:8px 0;border-bottom:1px dashed #e5e7eb}
        .row:last-child{border-bottom:0}
        .lbl{color:#6b7280}
        .val{font-weight:600}
        .foot{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb}
        .sign{height:48px;display:flex;align-items:flex-end}
        .muted{color:#6b7280}
        .badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;flex-shrink:0}
        .tiny{font-size:12px;color:#6b7280}
        @media (max-width:740px){.grid{grid-template-columns:1fr}.row{grid-template-columns:1fr}.hdr h1{font-size:18px}}
        @media print { body{padding:0} .doc{padding:24px} }
        .list{margin-top:12px;border:1px solid #e5e7eb;border-radius:12px;padding:12px}
        .list h3{margin:0 0 10px 0;font-size:14px;text-transform:uppercase;color:#6b7280}
        .list ul{margin:0;padding-left:18px;color:#111827}
        .table{margin-top:16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
        .table table{width:100%;border-collapse:collapse;font-size:14px}
        .table th{background:#f9fafb;text-align:left;padding:10px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb}
        .table td{padding:10px;border-bottom:1px solid #f3f4f6}
    </style>
";

        private const string Watermark = @"
    <div style=""position:fixed;inset:0;pointer-events:none;opacity:.06;display:flex;align-items:center;justify-content:center;transform:rotate(-22deg);font-size:92px;font-weight:800;color:#111;"">
        COPY
    </div>
";

    public string RenderStandardDocument(string templateKey, DocumentRenderModel model)
    {
        if (string.IsNullOrWhiteSpace(templateKey)) return string.Empty;
        var normalized = templateKey.Trim().ToLowerInvariant();
        model.TemplateKey = normalized;
        var head = BuildHead(model);
        var verification = ComputeVerification(model);
        var inner = normalized switch
        {
            DocumentTemplateKeys.StudyConfirmation => BuildStudyConfirmation(model, head, verification),
            DocumentTemplateKeys.LabourOfficeConfirmation => BuildLabourOfficeConfirmation(model, head, verification),
            DocumentTemplateKeys.Matriculation => BuildMatriculation(model, head, verification),
            DocumentTemplateKeys.StudyOverview => BuildStudyOverview(model, head, verification),
            DocumentTemplateKeys.AccommodationContract => BuildAccommodationContract(model, head, verification),
            DocumentTemplateKeys.AccommodationAddendum => BuildAccommodationAddendum(model, head, verification),
            DocumentTemplateKeys.ResidenceReport => BuildResidenceReport(model, head, verification),
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(inner)) return string.Empty;
        return WrapDocument(inner, model.IncludeWatermark);
    }

    public string RenderTeacherProfileDocument(TeacherProfileDocumentModel model)
    {
        var head = BuildTeacherHead(model);
        var rows = string.Concat(
            Row("Faculty", H(model.Faculty)),
            Row("Departments", model.Departments.Length > 0 ? H(string.Join(", ", model.Departments)) : "—"),
            Row("Subjects", model.Subjects.Length > 0 ? H(string.Join(", ", model.Subjects)) : "—"),
            Row("Office", string.IsNullOrWhiteSpace(model.Office) ? "—" : H(model.Office!)),
            Row("Phone", string.IsNullOrWhiteSpace(model.Phone) ? "—" : H(model.Phone!)),
            Row("Employment", string.IsNullOrWhiteSpace(model.EmploymentType) ? "—" : H(model.EmploymentType!)),
            Row("Status", string.IsNullOrWhiteSpace(model.Status) ? "—" : H(model.Status!)),
            Row("Hire date", string.IsNullOrWhiteSpace(model.HireDate) ? "—" : H(model.HireDate!)),
            Row("Experience", model.YearsExperience.HasValue ? H($"{model.YearsExperience} years") : "—"),
            Row("Classes", model.ClassesCount.HasValue ? H(model.ClassesCount.Value.ToString()) : "—")
        );

        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Faculty Profile Report</div>");
        sb.Append($"<div class=\"sub\">Generated {H(model.GeneratedAt)}</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(rows);
        sb.Append("</div>");

        if (!string.IsNullOrWhiteSpace(model.About))
        {
            sb.Append("<div class=\"list\"><h3>Summary</h3><p>");
            sb.Append(H(model.About));
            sb.Append("</p></div>");
        }

        if (model.Classes.Count > 0)
        {
            sb.Append("<div class=\"table\"><h3 style=\"padding:12px 12px 0 12px;margin:0;color:#6b7280;text-transform:uppercase;font-size:13px;\">Active classes</h3><table><thead><tr><th>Class</th><th>Program</th><th>Type</th><th>Year</th><th>Students</th></tr></thead><tbody>");
            foreach (var item in model.Classes)
            {
                sb.Append("<tr>");
                sb.Append($"<td>{H(item.Name)}</td>");
                sb.Append($"<td>{H(item.Program)}</td>");
                sb.Append($"<td>{H(item.Type)}</td>");
                sb.Append($"<td>{(item.Year.HasValue ? H(item.Year.Value.ToString()) : "—")}</td>");
                sb.Append($"<td>{H(item.StudentCount.ToString())}</td>");
                sb.Append("</tr>");
            }
            sb.Append("</tbody></table></div>");
        }

        if (model.Students.Count > 0)
        {
            sb.Append("<div class=\"table\"><h3 style=\"padding:12px 12px 0 12px;margin:0;color:#6b7280;text-transform:uppercase;font-size:13px;\">Assigned students</h3><table><thead><tr><th>Student</th><th>Program</th><th>Year</th><th>Email</th></tr></thead><tbody>");
            foreach (var student in model.Students)
            {
                sb.Append("<tr>");
                sb.Append($"<td>{H(student.FullName)}</td>");
                sb.Append($"<td>{H(student.Program)}</td>");
                sb.Append($"<td>{(student.Year.HasValue ? H(student.Year.Value.ToString()) : "—")}</td>");
                sb.Append($"<td>{H(student.Email)}</td>");
                sb.Append("</tr>");
            }
            sb.Append("</tbody></table></div>");
        }

        sb.Append("<div class=\"foot\"><div><div class=\"muted\">Issued by</div><div class=\"sign\">________________________</div></div>");
        sb.Append($"<div class=\"tiny\">Verification: {ComputeVerification(model)}</div></div>");

        return WrapDocument(sb.ToString(), includeWatermark: false);
    }

    private static string BuildHead(DocumentRenderModel model)
    {
        var qr = model.IncludeQr ? BuildMark($"{model.TemplateKey}|{model.FullName}|{model.StudentId}|{model.Year}") : null;
        var idLabel = string.IsNullOrWhiteSpace(model.StudentId) ? "—" : H(model.StudentId);
        var sb = new StringBuilder();
        sb.Append("<div class=\"hdr\">");
        sb.Append("<div class=\"logo\">TUKE</div>");
        sb.Append("<div><h1>Technical University of Košice</h1><p>Faculty of Electrical Engineering and Informatics • Letná 9, 042 00 Košice, Slovakia</p></div>");
        sb.Append("<div style=\"margin-left:auto\" class=\"badge\"><div><div class=\"tiny\">ID</div><div><strong>");
        sb.Append(idLabel);
        sb.Append("</strong></div></div>");
        if (!string.IsNullOrEmpty(qr))
        {
            sb.Append($"<img src=\"{qr}\" width=\"48\" height=\"48\" alt=\"QR\"/>");
        }
        sb.Append("</div></div>");
        return sb.ToString();
    }

    private static string BuildTeacherHead(TeacherProfileDocumentModel model)
    {
        var sb = new StringBuilder();
        sb.Append("<div class=\"hdr\">");
        sb.Append("<div class=\"logo\">TUKE</div>");
        sb.Append($"<div><h1>Faculty report</h1><p>{H(model.FullName)} • {H(model.Email)}</p></div>");
        sb.Append("<div style=\"margin-left:auto\" class=\"badge\"><div><div class=\"tiny\">TEACHER ID</div><div><strong>");
        sb.Append(string.IsNullOrWhiteSpace(model.TeacherId) ? "—" : H(model.TeacherId));
        sb.Append("</strong></div></div></div></div>");
        return sb.ToString();
    }

    private static string BuildStudyConfirmation(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Confirmation of Study</div>");
        sb.Append("<div class=\"sub\">Confirmation for student needs.</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Full name", H(model.FullName)));
        sb.Append(Row("Study program", H(model.Program)));
        sb.Append(Row("Faculty", H(model.Faculty)));
        sb.Append(Row("Form of study", H(model.StudyForm)));
        sb.Append(Row("Study level", H(model.StudyLevel)));
        sb.Append(Row("Year", H(model.Year)));
        sb.Append(Row("Issued at", H(model.IssuedAt)));
        if (!string.IsNullOrWhiteSpace(model.ValidUntil))
        {
            sb.Append(Row("Valid until", H(model.ValidUntil)));
        }
        sb.Append("</div>");
        sb.Append(BuildFoot("Issued by", verification));
        return sb.ToString();
    }

    private static string BuildLabourOfficeConfirmation(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Confirmation of Study for Labour Office</div>");
        var purpose = string.IsNullOrWhiteSpace(model.UpsvarPurpose)
            ? "For the purposes of the Labour, Social Affairs and Family Office"
            : model.UpsvarPurpose!;
        sb.Append($"<div class=\"sub\">{H(purpose)}</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Full name", H(model.FullName)));
        sb.Append(Row("National ID", string.IsNullOrWhiteSpace(model.NationalId) ? "—" : H(model.NationalId)));
        sb.Append(Row("Address", string.IsNullOrWhiteSpace(model.Address) ? "—" : H(model.Address)));
        sb.Append(Row("Study program", H(model.Program)));
        sb.Append(Row("Issued at", H(model.IssuedAt)));
        sb.Append("</div>");
        sb.Append(BuildFoot("Issued by", verification));
        return sb.ToString();
    }

    private static string BuildMatriculation(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Matriculation Letter</div>");
        sb.Append("<div class=\"sub\">Confirmation of matriculation.</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Full name", H(model.FullName)));
        sb.Append(Row("Date of birth", string.IsNullOrWhiteSpace(model.DateOfBirth) ? "—" : H(model.DateOfBirth)));
        sb.Append(Row("Place of birth", string.IsNullOrWhiteSpace(model.PlaceOfBirth) ? "—" : H(model.PlaceOfBirth)));
        sb.Append(Row("Program", H(model.Program)));
        sb.Append(Row("Year", H(model.Year)));
        sb.Append(Row("Enrollment date", H(model.IssuedAt)));
        sb.Append("</div>");
        sb.Append(BuildFoot("Study office", verification));
        return sb.ToString();
    }

    private static string BuildStudyOverview(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Study Overview</div>");
        sb.Append("<div class=\"sub\">Basic study progress details.</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Full name", H(model.FullName)));
        sb.Append(Row("Program", H(model.Program)));
        sb.Append(Row("Level", H(model.StudyLevel)));
        sb.Append(Row("Form", H(model.StudyForm)));
        sb.Append(Row("Year", H(model.Year)));
        sb.Append("</div>");
        sb.Append("<div style=\"margin-top:18px\" class=\"tiny\">Note: Detailed subject and grade listings are available in MAIS.</div>");
        sb.Append(BuildFoot("Issued by", verification));
        return sb.ToString();
    }

    private static string BuildAccommodationContract(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Accommodation Contract</div>");
        sb.Append("<div class=\"sub\">Student accommodation in a dormitory.</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Student", H($"{model.FullName} • {model.StudentId}")));
        sb.Append(Row("Accommodation period", H($"{model.AccommodationFrom} – {(string.IsNullOrWhiteSpace(model.AccommodationTo) ? "—" : model.AccommodationTo)}")));
        sb.Append(Row("Accommodation address", string.IsNullOrWhiteSpace(model.AccommodationAddress) ? "—" : H(model.AccommodationAddress)));
        var contacts = string.Join(" ", new[] {
            string.IsNullOrWhiteSpace(model.Email) ? null : model.Email,
            string.IsNullOrWhiteSpace(model.Phone) ? null : $"• {model.Phone}"
        }.Where(x => !string.IsNullOrWhiteSpace(x)));
        sb.Append(Row("Contacts", string.IsNullOrWhiteSpace(contacts) ? "—" : H(contacts)));
        sb.Append("</div>");
        sb.Append(BuildFoot("Dormitory", verification));
        return sb.ToString();
    }

    private static string BuildAccommodationAddendum(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Accommodation Contract Addendum</div>");
        sb.Append("<div class=\"sub\">Change of accommodation parameters.</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Student", H($"{model.FullName} • {model.StudentId}")));
        sb.Append(Row("Previous period", H($"{model.AccommodationFrom} – {(string.IsNullOrWhiteSpace(model.AccommodationTo) ? "—" : model.AccommodationTo)}")));
        sb.Append(Row("New period", H($"{model.AccommodationFrom} – {(string.IsNullOrWhiteSpace(model.ValidUntil) ? "—" : model.ValidUntil)}")));
        sb.Append("</div>");
        sb.Append(BuildFoot("Approved by", verification));
        return sb.ToString();
    }

    private static string BuildResidenceReport(DocumentRenderModel model, string head, string verification)
    {
        var sb = new StringBuilder();
        sb.Append(head);
        sb.Append("<div class=\"title\">Residence Report</div>");
        sb.Append("<div class=\"sub\">Notification of residence during studies.</div>");
        sb.Append("<div class=\"grid\">");
        sb.Append(Row("Full name", H(model.FullName)));
        sb.Append(Row("Permanent address", string.IsNullOrWhiteSpace(model.Address) ? "—" : H(model.Address)));
        sb.Append(Row("Temporary residence", string.IsNullOrWhiteSpace(model.AccommodationAddress) ? "—" : H(model.AccommodationAddress)));
        sb.Append(Row("Valid from", H(model.AccommodationFrom)));
        sb.Append("</div>");
        sb.Append(BuildFoot("Student signature", verification));
        return sb.ToString();
    }

    private static string WrapDocument(string inner, bool includeWatermark)
    {
        var sb = new StringBuilder();
        sb.Append(StyleSheet);
        sb.Append("<div class=\"doc\">");
        if (includeWatermark)
        {
            sb.Append(Watermark);
        }
        sb.Append(inner);
        sb.Append("</div>");
        return sb.ToString();
    }

    private static string Row(string label, string value)
    {
        return $"<div class=\"row\"><div class=\"lbl\">{H(label)}</div><div class=\"val\">{value}</div></div>";
    }

    private static string BuildFoot(string leftCaption, string verification)
    {
        return $"<div class=\"foot\"><div><div class=\"muted\">{H(leftCaption)}</div><div class=\"sign\">________________________</div></div><div class=\"tiny\">Verification: {verification}</div></div>";
    }

    private static string H(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    private static string BuildMark(string seed)
    {
        var size = 128;
        var cell = size / 16;
        var bits = new int[16 * 16];
        var s = Hash(seed);
        for (var i = 0; i < bits.Length; i++)
        {
            s ^= s << 13;
            s ^= (uint)(s >> 17);
            s ^= s << 5;
            bits[i] = (int)(s & 1);
        }

        var svg = new StringBuilder();
        svg.Append($"<svg xmlns='http://www.w3.org/2000/svg' width='{size}' height='{size}' viewBox='0 0 {size} {size}' shape-rendering='crispEdges'>");
        svg.Append("<rect width='100%' height='100%' fill='#ffffff'/>");
        for (var y = 0; y < 16; y++)
        {
            for (var x = 0; x < 16; x++)
            {
                if (bits[y * 16 + x] == 1)
                {
                    svg.Append($"<rect x='{x * cell + 2}' y='{y * cell + 2}' width='{cell - 4}' height='{cell - 4}' fill='#111827'/>");
                }
            }
        }
        svg.Append($"<rect x='1' y='1' width='{size - 2}' height='{size - 2}' fill='none' stroke='#111827' stroke-width='2'/>");
        svg.Append("</svg>");
        var bytes = Encoding.UTF8.GetBytes(svg.ToString());
        return $"data:image/svg+xml;base64,{Convert.ToBase64String(bytes)}";
    }

    private static uint Hash(string? input)
    {
        var h = 2166136261u;
        var text = input ?? string.Empty;
        for (var i = 0; i < text.Length; i++)
        {
            h ^= text[i];
            h *= 16777619;
        }
        return h;
    }

    private static string ComputeVerification(object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        return Hash(json).ToString("x");
    }
}
