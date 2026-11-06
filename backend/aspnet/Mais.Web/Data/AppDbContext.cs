using Microsoft.EntityFrameworkCore;
using Mais.Web.Entities;

namespace Mais.Web.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<StudentEntity> Students => Set<StudentEntity>();
    public DbSet<FacultyEntity> Faculty => Set<FacultyEntity>();
    public DbSet<CourseEntity> Courses => Set<CourseEntity>();
    public DbSet<RoomEntity> Rooms => Set<RoomEntity>();
    public DbSet<EquipmentEntity> Equipment => Set<EquipmentEntity>();
    public DbSet<TimetableEntryEntity> Timetable => Set<TimetableEntryEntity>();
    public DbSet<UserCredentialEntity> UserCredentials => Set<UserCredentialEntity>();
    public DbSet<StudentEnrollmentEntity> Enrollments => Set<StudentEnrollmentEntity>();
    public DbSet<ThesisTopicEntity> ThesisTopics => Set<ThesisTopicEntity>();
    public DbSet<ThesisRequestEntity> ThesisRequests => Set<ThesisRequestEntity>();
    public DbSet<ThesisSupervisionEntity> ThesisSupervisions => Set<ThesisSupervisionEntity>();
    public DbSet<ExamTermEntity> ExamTerms => Set<ExamTermEntity>();
    public DbSet<ExamRegistrationEntity> ExamRegistrations => Set<ExamRegistrationEntity>();
    public DbSet<StudentCourseGradeEntity> CourseGrades => Set<StudentCourseGradeEntity>();
    public DbSet<CourseGradingSchemeEntity> CourseGradingSchemes => Set<CourseGradingSchemeEntity>();
    public DbSet<AssignmentEntity> Assignments => Set<AssignmentEntity>();
    public DbSet<StudentAssignmentGradeEntity> AssignmentGrades => Set<StudentAssignmentGradeEntity>();
    public DbSet<ChatThreadEntity> ChatThreads => Set<ChatThreadEntity>();
    public DbSet<ChatParticipantEntity> ChatParticipants => Set<ChatParticipantEntity>();
    public DbSet<ChatMessageEntity> ChatMessages => Set<ChatMessageEntity>();
    public DbSet<ChatAttachmentEntity> ChatAttachments => Set<ChatAttachmentEntity>();
    public DbSet<ChatReactionEntity> ChatReactions => Set<ChatReactionEntity>();
    public DbSet<ChatUserStateEntity> ChatUserStates => Set<ChatUserStateEntity>();
    public DbSet<UserPreferenceEntity> UserPreferences => Set<UserPreferenceEntity>();
    public DbSet<PasswordResetEntity> PasswordResets => Set<PasswordResetEntity>();
    public DbSet<ActivityEntity> Activities => Set<ActivityEntity>();
    public DbSet<ClassGroupEntity> ClassGroups => Set<ClassGroupEntity>();
    public DbSet<DepartmentEntity> Departments => Set<DepartmentEntity>();
    public DbSet<FacultyOptionEntity> FacultyOptions => Set<FacultyOptionEntity>();
    public DbSet<ProgramEntity> Programs => Set<ProgramEntity>();
    public DbSet<DocumentRecordEntity> Documents => Set<DocumentRecordEntity>();
    public DbSet<BankConnectionEntity> BankConnections => Set<BankConnectionEntity>();
    public DbSet<VariableSymbolEntity> VariableSymbols => Set<VariableSymbolEntity>();
    public DbSet<DeviceSessionEntity> DeviceSessions => Set<DeviceSessionEntity>();
    public DbSet<TeacherRatingEntity> TeacherRatings => Set<TeacherRatingEntity>();
    public DbSet<SurveyEntity> Surveys => Set<SurveyEntity>();
    public DbSet<SurveyResponseEntity> SurveyResponses => Set<SurveyResponseEntity>();
    public DbSet<KnowledgeBaseArticleEntity> KnowledgeBaseArticles => Set<KnowledgeBaseArticleEntity>();
    public DbSet<ChangelogEntryEntity> ChangelogEntries => Set<ChangelogEntryEntity>();
    public DbSet<ResourceReservationEntity> ResourceReservations => Set<ResourceReservationEntity>();
    public DbSet<NewsEntity> News => Set<NewsEntity>();
    public DbSet<AttendanceEntity> Attendance => Set<AttendanceEntity>();
    public DbSet<PaymentEntity> Payments => Set<PaymentEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StudentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.PersonId).HasMaxLength(100);
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(60);
            e.Property(x => x.Phone).HasMaxLength(100);
            e.Property(x => x.AltEmail).HasMaxLength(200);
            e.Property(x => x.AvatarUrl).HasMaxLength(300);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.ClassName).HasMaxLength(60);
            e.Property(x => x.IsicCardNumber).HasMaxLength(40);
            e.Property(x => x.StudentNumber).HasMaxLength(60);
            e.Property(x => x.StudyNumber).HasMaxLength(60);
            e.Property(x => x.PassportId).HasMaxLength(60);
            e.Property(x => x.BirthDate).HasMaxLength(16);
            e.Property(x => x.BirthPlace).HasMaxLength(120);
            e.Property(x => x.Nationality).HasMaxLength(60);
            e.Property(x => x.FamilyStatus).HasMaxLength(60);
            e.Property(x => x.HealthStatus).HasMaxLength(200);
            e.Property(x => x.ParentName).HasMaxLength(120);
            e.Property(x => x.Status).HasMaxLength(40);
            e.Property(x => x.LastActivity).HasMaxLength(40);
        });
        modelBuilder.Entity<FacultyEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(40);
            e.Property(x => x.EmploymentType).HasMaxLength(40);
            e.Property(x => x.HireDate).HasMaxLength(40);
            e.Property(x => x.LastActivity).HasMaxLength(40);
            e.Property(x => x.AvatarUrl).HasMaxLength(300);
            e.Property(x => x.About).HasMaxLength(1000);
        });
        modelBuilder.Entity<CourseEntity>(e =>
        {
            e.HasKey(x => x.Code);
            e.Property(x => x.NameEn).HasMaxLength(300);
            e.Property(x => x.NameSk).HasMaxLength(300);
            e.Property(x => x.Faculty).HasMaxLength(60);
            e.Property(x => x.Program).HasMaxLength(100);
            e.Property(x => x.Department).HasMaxLength(60);
        });
        modelBuilder.Entity<RoomEntity>(e =>
        {
            e.HasKey(x => x.Id);
        });
        modelBuilder.Entity<EquipmentEntity>(e =>
        {
            e.HasKey(x => x.Id);
        });
        modelBuilder.Entity<TimetableEntryEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Day).HasMaxLength(20);
            e.Property(x => x.Slot).HasMaxLength(20);
            e.Property(x => x.CourseCode).HasMaxLength(32);
            e.Property(x => x.Room).HasMaxLength(100);
            e.Property(x => x.TeacherEmail).HasMaxLength(200);
            e.Property(x => x.ClassGroupKeysJson).HasMaxLength(500);
            e.Property(x => x.Faculty).HasMaxLength(60);
            e.Property(x => x.Program).HasMaxLength(100);
        });

        modelBuilder.Entity<ClassGroupEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Faculty).HasMaxLength(60);
            e.Property(x => x.Program).HasMaxLength(100);
            e.Property(x => x.TeacherEmail).HasMaxLength(200);
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.CreatedAt).HasMaxLength(40);
            e.Property(x => x.UpdatedAt).HasMaxLength(40);
            e.HasIndex(x => x.Faculty);
            e.HasIndex(x => x.Program);
            e.HasIndex(x => x.TeacherEmail);
        });

        modelBuilder.Entity<UserCredentialEntity>(e =>
        {
            e.HasKey(x => x.Email);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Role).HasMaxLength(32);
            e.Property(x => x.PasswordHash).HasMaxLength(500);
            e.Property(x => x.LastLoginAt);
        });

        modelBuilder.Entity<StudentEnrollmentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.CourseCode).HasMaxLength(32);
            e.Property(x => x.ScheduleEventId).HasMaxLength(100);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.AcademicYear).HasMaxLength(20);
            e.Property(x => x.Semester).HasMaxLength(10);
        });

        modelBuilder.Entity<ThesisTopicEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Type).HasMaxLength(32);
            e.Property(x => x.Title).HasMaxLength(400);
            e.Property(x => x.Program).HasMaxLength(40);
            e.Property(x => x.ProgramLabel).HasMaxLength(120);
            e.Property(x => x.Faculty).HasMaxLength(40);
            e.Property(x => x.Department).HasMaxLength(60);
            e.Property(x => x.SupervisorEmail).HasMaxLength(200);
            e.Property(x => x.SupervisorName).HasMaxLength(200);
            e.Property(x => x.State).HasMaxLength(20);
        });

        modelBuilder.Entity<ThesisRequestEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.AcademicYear).HasMaxLength(20);
            e.Property(x => x.Degree).HasMaxLength(8);
            e.Property(x => x.StudyForm).HasMaxLength(20);
            e.Property(x => x.Program).HasMaxLength(120);
            e.Property(x => x.ProgramCode).HasMaxLength(40);
            e.Property(x => x.Language).HasMaxLength(8);
            e.Property(x => x.SupervisorEmail).HasMaxLength(200);
            e.Property(x => x.Topic).HasMaxLength(400);
            e.Property(x => x.Keywords).HasMaxLength(400);
            e.Property(x => x.Status).HasMaxLength(16);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.StudentEmail).HasMaxLength(200);
            e.Property(x => x.StudentName).HasMaxLength(200);
        });

        modelBuilder.Entity<ThesisSupervisionEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.TopicId).HasMaxLength(100);
            e.Property(x => x.Type).HasMaxLength(32);
            e.Property(x => x.Title).HasMaxLength(400);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.StudentEmail).HasMaxLength(200);
            e.Property(x => x.StudentName).HasMaxLength(200);
            e.Property(x => x.SupervisorEmail).HasMaxLength(200);
            e.Property(x => x.SupervisorName).HasMaxLength(200);
            e.Property(x => x.Program).HasMaxLength(120);
            e.Property(x => x.Degree).HasMaxLength(8);
            e.Property(x => x.AcademicYear).HasMaxLength(20);
            e.Property(x => x.Status).HasMaxLength(16);
            e.Property(x => x.DefenseDate).HasMaxLength(64);
            e.Property(x => x.DefenseRoom).HasMaxLength(100);
        });

        modelBuilder.Entity<ExamTermEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.CourseCode).HasMaxLength(32);
            e.Property(x => x.CourseName).HasMaxLength(300);
            e.Property(x => x.Building).HasMaxLength(60);
            e.Property(x => x.Room).HasMaxLength(100);
            e.Property(x => x.Examiner).HasMaxLength(200);
            e.Property(x => x.CreatedBy).HasMaxLength(200);
        });

        modelBuilder.Entity<ExamRegistrationEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.TermId).HasMaxLength(100);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.StudentEmail).HasMaxLength(200);
        });

        modelBuilder.Entity<StudentCourseGradeEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.CourseCode).HasMaxLength(32);
            e.Property(x => x.TeacherEmail).HasMaxLength(200);
            e.Property(x => x.AssessmentType).HasMaxLength(8);
            e.Property(x => x.LetterGrade).HasMaxLength(2);
        });

        modelBuilder.Entity<CourseGradingSchemeEntity>(e =>
        {
            e.HasKey(x => x.CourseCode);
            e.Property(x => x.CourseCode).HasMaxLength(32);
        });

        modelBuilder.Entity<AssignmentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.ClassId).HasMaxLength(100);
            e.Property(x => x.CourseCode).HasMaxLength(32);
            e.Property(x => x.TeacherEmail).HasMaxLength(200);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Category).HasMaxLength(20);
            e.Property(x => x.DueDate).HasMaxLength(16);
        });

        modelBuilder.Entity<StudentAssignmentGradeEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.AssignmentId).HasMaxLength(100);
        });

        modelBuilder.Entity<ChatThreadEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(40);
            e.Property(x => x.OwnerEmail).HasMaxLength(200);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.LastMessagePreview).HasMaxLength(400);
            e.HasMany(x => x.Participants)
                .WithOne(p => p.Thread!)
                .HasForeignKey(p => p.ThreadId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Messages)
                .WithOne(m => m.Thread!)
                .HasForeignKey(m => m.ThreadId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.UserStates)
                .WithOne(s => s.Thread!)
                .HasForeignKey(s => s.ThreadId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatParticipantEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(50);
            e.Property(x => x.ThreadId).HasMaxLength(40);
            e.Property(x => x.Kind).HasMaxLength(16);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.DisplayName).HasMaxLength(200);
            e.HasIndex(x => new { x.ThreadId, x.Email }).HasDatabaseName("IX_ChatParticipants_ThreadEmail");
        });

        modelBuilder.Entity<ChatUserStateEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(60);
            e.Property(x => x.ThreadId).HasMaxLength(40);
            e.Property(x => x.UserEmail).HasMaxLength(200);
            e.HasIndex(x => new { x.ThreadId, x.UserEmail }).IsUnique();
        });

        modelBuilder.Entity<ChatMessageEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(60);
            e.Property(x => x.ThreadId).HasMaxLength(40);
            e.Property(x => x.AuthorEmail).HasMaxLength(200);
            e.Property(x => x.AuthorRole).HasMaxLength(16);
            e.Property(x => x.AuthorDisplayName).HasMaxLength(200);
            e.Property(x => x.ReplyToId).HasMaxLength(60);
            e.Property(x => x.ClientId).HasMaxLength(60);
            e.HasMany(x => x.Attachments)
                .WithOne(a => a.Message!)
                .HasForeignKey(a => a.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Reactions)
                .WithOne(r => r.Message!)
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.ThreadId, x.CreatedAt }).HasDatabaseName("IX_ChatMessages_ThreadCreatedAt");
        });

        modelBuilder.Entity<ChatAttachmentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(60);
            e.Property(x => x.MessageId).HasMaxLength(60);
            e.Property(x => x.FileName).HasMaxLength(200);
            e.Property(x => x.ContentType).HasMaxLength(120);
            e.Property(x => x.StoragePath).HasMaxLength(500);
            e.Property(x => x.DownloadUrl).HasMaxLength(500);
        });

        modelBuilder.Entity<ChatReactionEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(70);
            e.Property(x => x.MessageId).HasMaxLength(60);
            e.Property(x => x.Emoji).HasMaxLength(32);
            e.Property(x => x.UserEmail).HasMaxLength(200);
            e.HasIndex(x => new { x.MessageId, x.Emoji, x.UserEmail }).IsUnique();
        });

        modelBuilder.Entity<UserPreferenceEntity>(e =>
        {
            e.HasKey(x => new { x.UserEmail, x.PreferenceKey });
            e.Property(x => x.UserEmail).HasMaxLength(200);
            e.Property(x => x.PreferenceKey).HasMaxLength(100);
            e.Property(x => x.JsonValue).HasColumnType("text");
            e.Property(x => x.UpdatedAt);
        });

        modelBuilder.Entity<PasswordResetEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Token).HasMaxLength(500);
            e.Property(x => x.Code).HasMaxLength(10);
            e.HasIndex(x => x.Email);
            e.HasIndex(x => x.Token);
            e.HasIndex(x => new { x.Email, x.Code });
        });

        modelBuilder.Entity<ActivityEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Type).HasMaxLength(50);
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.Subject).HasMaxLength(200);
            e.Property(x => x.ClassId).HasMaxLength(100);
            e.Property(x => x.CourseCode).HasMaxLength(32);
            e.Property(x => x.TeacherEmail).HasMaxLength(200);
            e.Property(x => x.TeacherDisplay).HasMaxLength(200);
            e.Property(x => x.StudentEmail).HasMaxLength(200);
            e.Property(x => x.StudentName).HasMaxLength(200);
            e.Property(x => x.Room).HasMaxLength(100);
            e.Property(x => x.Location).HasMaxLength(200);
            e.Property(x => x.AssignmentId).HasMaxLength(100);
            e.Property(x => x.Timestamp).HasMaxLength(40);
            e.Property(x => x.Priority).HasMaxLength(20);
            e.Property(x => x.MetaJson).HasMaxLength(2000);
            e.Property(x => x.CreatedByEmail).HasMaxLength(200);
            e.Property(x => x.CreatedAt).HasMaxLength(40);
            e.Property(x => x.UpdatedAt).HasMaxLength(40);

            // Indexes for common queries
            e.HasIndex(x => x.Type);
            e.HasIndex(x => x.TeacherEmail);
            e.HasIndex(x => x.StudentEmail);
            e.HasIndex(x => x.Timestamp);
            e.HasIndex(x => x.RequiresAction);
            e.HasIndex(x => x.IsArchived);
        });

        modelBuilder.Entity<DepartmentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Name).HasMaxLength(300);
            e.Property(x => x.Code).HasMaxLength(32);
            e.Property(x => x.Faculty).HasMaxLength(60);
            e.HasIndex(x => x.Faculty);
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<FacultyOptionEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Code).HasMaxLength(32);
            e.Property(x => x.NameEn).HasMaxLength(300);
            e.Property(x => x.NameSk).HasMaxLength(300);
            e.Property(x => x.Description).HasMaxLength(1000);
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<ProgramEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.Name).HasMaxLength(300);
            e.Property(x => x.Code).HasMaxLength(32);
            e.Property(x => x.Faculty).HasMaxLength(60);
            e.Property(x => x.DepartmentId).HasMaxLength(100);
            e.Property(x => x.Level).HasMaxLength(32);
            e.Property(x => x.Description).HasMaxLength(1000);
            e.HasIndex(x => x.Faculty);
            e.HasIndex(x => x.DepartmentId);
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<DocumentRecordEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.TemplateKey).HasMaxLength(64);
            e.Property(x => x.OwnerEmail).HasMaxLength(200);
            e.Property(x => x.OwnerRole).HasMaxLength(16);
            e.Property(x => x.Title).HasMaxLength(400);
            e.Property(x => x.TeacherEmail).HasMaxLength(200);
            e.Property(x => x.TeacherName).HasMaxLength(200);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.StudentEmail).HasMaxLength(200);
            e.Property(x => x.StudentName).HasMaxLength(200);
            e.Property(x => x.CreatedAt).HasMaxLength(40);
            e.Property(x => x.CreatedByEmail).HasMaxLength(200);
            e.Property(x => x.HtmlContent).HasColumnType("text");
            e.Property(x => x.MetaJson).HasColumnType("text");
            e.HasIndex(x => x.OwnerEmail);
            e.HasIndex(x => x.TemplateKey);
            e.HasIndex(x => new { x.StudentId, x.TemplateKey });
        });

        modelBuilder.Entity<BankConnectionEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.BankName).HasMaxLength(200);
            e.Property(x => x.AccountNumber).HasMaxLength(100);
            e.Property(x => x.Iban).HasMaxLength(100);
            e.Property(x => x.Swift).HasMaxLength(50);
            e.Property(x => x.CreatedAt).HasMaxLength(40);
            e.Property(x => x.UpdatedAt).HasMaxLength(40);
            e.HasIndex(x => x.StudentId);
        });

        modelBuilder.Entity<VariableSymbolEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.Symbol).HasMaxLength(50);
            e.Property(x => x.Purpose).HasMaxLength(100);
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.CreatedAt).HasMaxLength(40);
            e.HasIndex(x => x.StudentId);
            e.HasIndex(x => x.Symbol);
        });

        modelBuilder.Entity<DeviceSessionEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(100);
            e.Property(x => x.UserId).HasMaxLength(200);
            e.Property(x => x.DeviceName).HasMaxLength(200);
            e.Property(x => x.DeviceType).HasMaxLength(50);
            e.Property(x => x.Browser).HasMaxLength(100);
            e.Property(x => x.Os).HasMaxLength(100);
            e.Property(x => x.IpAddress).HasMaxLength(50);
            e.Property(x => x.Location).HasMaxLength(200);
            e.Property(x => x.LastActivity).HasMaxLength(40);
            e.Property(x => x.CreatedAt).HasMaxLength(40);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.LastActivity);
        });

        modelBuilder.Entity<TeacherRatingEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.TeacherId).HasMaxLength(100).IsRequired();
            e.Property(x => x.StudentId).HasMaxLength(100).IsRequired();
            e.Property(x => x.Rating).IsRequired();
            e.Property(x => x.Comment).HasMaxLength(1000);
            e.Property(x => x.CourseCode).HasMaxLength(50);
            e.HasIndex(x => x.TeacherId);
            e.HasIndex(x => x.StudentId);
            e.HasIndex(x => new { x.TeacherId, x.StudentId, x.CourseCode });
        });

        modelBuilder.Entity<SurveyEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(500).IsRequired();
            e.Property(x => x.Category).HasMaxLength(50).IsRequired();
            e.Property(x => x.MetaJson).HasColumnType("jsonb");
            e.Property(x => x.QuestionsJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.OwnerId).HasMaxLength(100);
            e.Property(x => x.TargetAudience).HasMaxLength(50);
            e.Property(x => x.TargetFaculty).HasMaxLength(50);
            e.Property(x => x.TargetProgram).HasMaxLength(50);
            e.HasIndex(x => x.Category);
            e.HasIndex(x => x.OwnerId);
            e.HasIndex(x => x.Published);
            e.HasIndex(x => x.OpenAt);
            e.HasIndex(x => x.CloseAt);
        });

        modelBuilder.Entity<SurveyResponseEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentEmail).HasMaxLength(200);
            e.Property(x => x.StudentId).HasMaxLength(100);
            e.Property(x => x.AnswersJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.IpAddress).HasMaxLength(50);
            e.Property(x => x.UserAgent).HasMaxLength(500);
            e.HasIndex(x => x.SurveyId);
            e.HasIndex(x => x.StudentEmail);
            e.HasIndex(x => new { x.SurveyId, x.StudentEmail });
        });

        modelBuilder.Entity<KnowledgeBaseArticleEntity>(e =>
        {
            e.ToTable("KnowledgeBaseArticles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(500).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(600).IsRequired();
            e.Property(x => x.Content).HasColumnType("text").IsRequired();
            e.Property(x => x.Category).HasMaxLength(100).IsRequired();
            e.Property(x => x.Difficulty).HasMaxLength(50);
            e.Property(x => x.AuthorEmail).HasMaxLength(200);
            e.HasIndex(x => x.AuthorEmail);
            e.HasIndex(x => x.Category);
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.IsPublished);
        });

        modelBuilder.Entity<PaymentEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).HasMaxLength(100).IsRequired();
            e.Property(x => x.Type).HasMaxLength(50).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasMaxLength(10);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.VariableSymbol).HasMaxLength(50);
            e.Property(x => x.SpecificSymbol).HasMaxLength(50);
            e.Property(x => x.AcademicYear).HasMaxLength(20);
            e.Property(x => x.Semester).HasMaxLength(10);
            e.Property(x => x.ExternalRef).HasMaxLength(200);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasIndex(x => x.StudentId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.AcademicYear);
        });
    }
}
