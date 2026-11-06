namespace Mais.Web.Models.Documents;

public static class DocumentTemplateKeys
{
    public const string StudyConfirmation = "confirm";
    public const string LabourOfficeConfirmation = "confirm_upsvar";
    public const string Matriculation = "immatriculation";
    public const string StudyOverview = "study_overview";
    public const string AccommodationContract = "accommodation_contract";
    public const string AccommodationAddendum = "accommodation_addendum";
    public const string ResidenceReport = "residence_report";
    public const string TeacherProfile = "teacher_profile";

    public static readonly string[] StudentAutoDeliveryTemplates =
    {
        StudyConfirmation,
        LabourOfficeConfirmation,
        Matriculation,
        StudyOverview,
        AccommodationContract,
        AccommodationAddendum,
        ResidenceReport
    };
}
