using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Mais.Web.Data;
using Mais.Web.Entities;
using Mais.Web.Services;
using Mais.Web.Hubs;
using System.Security.Claims;
using System.Text.Json;
using System.Linq;
using System.Collections.Generic;

namespace Mais.Web.Controllers;

[ApiController]
[Route("api/schedule")]
public class ScheduleController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDataUpdateService _dataUpdates;
    private readonly IHubContext<ScheduleHub> _scheduleHub;

    public ScheduleController(AppDbContext db, IDataUpdateService dataUpdates, IHubContext<ScheduleHub> scheduleHub)
    {
        _db = db;
        _dataUpdates = dataUpdates;
        _scheduleHub = scheduleHub;
    }

    /// <summary>
    /// Get schedule events with optional filtering
    /// </summary>
    /// <param name="courseCode">Filter by course code (case-insensitive)</param>
    /// <param name="teacherEmail">Filter by teacher email (case-insensitive)</param>
    /// <param name="day">Filter by day of week (case-insensitive)</param>
    /// <param name="room">Filter by room name (case-insensitive)</param>
    /// <param name="studentYear">Optional: filter events by student's study year (shows events for this year or lower)</param>
    /// <returns>List of schedule events with enrollment counts</returns>
    /// <remarks>
    /// Returns schedule events (timetable entries) with optional filters.
    /// Each event includes enrollment count (number of students enrolled in that event).
    /// ClassGroupKeys are automatically expanded from JSON string to array.
    /// </remarks>
    [HttpGet("events")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEvents(
        [FromQuery] string? courseCode, 
        [FromQuery] string? teacherEmail, 
        [FromQuery] string? day, 
        [FromQuery] string? room,
        [FromQuery] int? studentYear) // Optional: filter events by student's study year
    {
        var q = _db.Timetable.AsNoTracking().AsQueryable();
        
        // Filter by student year if provided (student can only see events for their year or lower)
        if (studentYear.HasValue && studentYear.Value > 0)
        {
            q = q.Where(t => t.RequiredYear == null || t.RequiredYear <= studentYear.Value);
        }
        
        if (!string.IsNullOrWhiteSpace(courseCode)) q = q.Where(t => t.CourseCode.ToLower() == courseCode.ToLower());
        if (!string.IsNullOrWhiteSpace(teacherEmail)) q = q.Where(t => t.TeacherEmail.ToLower() == teacherEmail.ToLower());
        if (!string.IsNullOrWhiteSpace(day)) q = q.Where(t => t.Day.ToLower() == day.ToLower());
        if (!string.IsNullOrWhiteSpace(room)) q = q.Where(t => t.Room.ToLower() == room.ToLower());

        var items = await q.ToListAsync();
        // enrollment counts per event id
        var ids = items.Select(t => t.Id).ToList();
        var enrollCounts = await _db.Enrollments.AsNoTracking()
            .Where(e => e.ScheduleEventId != null && ids.Contains(e.ScheduleEventId))
            .GroupBy(e => e.ScheduleEventId!)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);

        var res = items.Select(t => new
        {
            id = t.Id,
            day = t.Day,
            slot = t.Slot,
            courseCode = t.CourseCode,
            room = t.Room,
            teacherEmail = t.TeacherEmail,
            type = t.Type,
            note = t.Note,
            capacity = t.Capacity,
            classGroupKeys = string.IsNullOrWhiteSpace(t.ClassGroupKeysJson) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(t.ClassGroupKeysJson!) ?? new List<string>(),
            enrollmentsCount = enrollCounts.TryGetValue(t.Id, out var c) ? c : 0,
            faculty = t.Faculty,
            program = t.Program,
            requiredYear = t.RequiredYear
        });
        return Ok(res);
    }

    public record CreateEventRequest(string CourseCode, string Day, string? Slot, string? Time, string? EndTime, string? Room, string? Note, int? Capacity, List<string>? ClassGroupKeys, string? Type, string? Program, string? Faculty);
    public class UpdateEventRequest
    {
        public string? Day { get; set; }
        public string? Slot { get; set; }
        public string? Time { get; set; }
        public string? EndTime { get; set; }
        public string? Room { get; set; }
        public string? Note { get; set; }
        public int? Capacity { get; set; }
        public string? Program { get; set; }
        public string? Faculty { get; set; }
    }

    public class AssignTeacherRequest
    {
        public string? TeacherEmail { get; set; }
        public List<string>? EventIds { get; set; }
    }

    /// <summary>
    /// Create a new schedule event (teachers only)
    /// </summary>
    /// <param name="req">Schedule event creation request</param>
    /// <returns>Created schedule event</returns>
    /// <remarks>
    /// Requires authentication. Creates a new schedule event (timetable entry).
    /// Required fields: CourseCode, Day
    /// Either Slot or Time+EndTime must be provided.
    /// 
    /// Event ID is generated deterministically based on: Day:Slot:CourseCode:Room
    /// Returns 409 Conflict if an event with the same ID already exists.
    /// 
    /// Automatically extracts teacher email from authenticated user or X-Teacher-Email header.
    /// </remarks>
    [Authorize]
    [HttpPost("events")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest req)
    {
        if (req == null) return BadRequest(new { error = "Body required" });
        if (string.IsNullOrWhiteSpace(req.CourseCode) || string.IsNullOrWhiteSpace(req.Day))
            return BadRequest(new { error = "CourseCode and Day are required" });
        var slot = (req.Slot ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(slot))
        {
            var s = (req.Time ?? "").Trim(); var e = (req.EndTime ?? "").Trim();
            if (string.IsNullOrWhiteSpace(s) || string.IsNullOrWhiteSpace(e)) return BadRequest(new { error = "Slot or Time+EndTime required" });
            slot = $"{s}-{e}";
        }
        var email = User?.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")?.Value
                    ?? User?.FindFirst("email")?.Value
                    ?? req?.Room ?? string.Empty; // fallback nonsense to avoid null
        var teacherEmail = (User?.Identity?.IsAuthenticated == true ? email : null) ?? HttpContext.Request.Headers["X-Teacher-Email"].ToString();
        if (string.IsNullOrWhiteSpace(teacherEmail)) teacherEmail = req?.Room ?? string.Empty; // last resort

        var reqCourseCode = req!.CourseCode ?? string.Empty;
        var reqRoom = (req.Room ?? string.Empty).Trim();
        var reqDay = req.Day ?? string.Empty;
        var id = $"evt:{reqDay}:{slot}:{reqCourseCode}:{reqRoom}";
        if (await _db.Timetable.FindAsync(id) is not null)
            return Conflict(new { error = "Schedule already exists for this slot/room/course", id });

        // Normalize type
        var normType = string.IsNullOrWhiteSpace(req.Type) ? null : req.Type.Trim().ToUpperInvariant();

        // Auto-assign class group key for practice classes when not provided
        List<string>? classKeys = null;
        if (req.ClassGroupKeys != null && req.ClassGroupKeys.Any(k => !string.IsNullOrWhiteSpace(k)))
        {
            classKeys = req.ClassGroupKeys.Where(k => !string.IsNullOrWhiteSpace(k)).ToList();
        }
        else if (normType == "CL")
        {
            // Determine next available group index for this teacher+course
            var tEmail = (teacherEmail ?? string.Empty).Trim();
            var existing = await _db.Timetable.AsNoTracking()
                .Where(t => t.CourseCode.ToLower() == reqCourseCode.Trim().ToLower() && t.TeacherEmail.ToLower() == tEmail.ToLower() && t.Type == "CL")
                .ToListAsync();
            var used = new HashSet<int>();
            foreach (var e in existing)
            {
                if (!string.IsNullOrWhiteSpace(e.ClassGroupKeysJson))
                {
                    try
                    {
                        var arr = System.Text.Json.JsonSerializer.Deserialize<List<string>>(e.ClassGroupKeysJson!) ?? new List<string>();
                        foreach (var k in arr)
                        {
                            var m = System.Text.RegularExpressions.Regex.Match((k ?? string.Empty).ToLowerInvariant(), @"^(\d{1,2})-?sk$");
                            if (m.Success && int.TryParse(m.Groups[1].Value, out var n)) used.Add(n);
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
            }
            int idx = 1;
            while (used.Contains(idx)) idx++;
            var key = $"{idx.ToString().PadLeft(2, '0')}-sk";
            classKeys = new List<string> { key };
        }

        var normalizedCourseCode = (req.CourseCode ?? string.Empty).Trim();

        var ev = new TimetableEntryEntity
        {
            Id = id,
            Day = (req.Day ?? "").Trim(),
            Slot = slot,
            CourseCode = normalizedCourseCode,
            Room = (req.Room ?? string.Empty).Trim(),
            TeacherEmail = (teacherEmail ?? string.Empty).Trim(),
            Type = normType,
            Note = req.Note,
            Capacity = req.Capacity,
            ClassGroupKeysJson = classKeys != null ? System.Text.Json.JsonSerializer.Serialize(classKeys) : null,
            Faculty = !string.IsNullOrWhiteSpace(req.Faculty) ? req.Faculty.Trim() : null,
            Program = !string.IsNullOrWhiteSpace(req.Program) ? req.Program.Trim() : null
        };
        _db.Timetable.Add(ev);
        await _db.SaveChangesAsync();

        // Notify via ScheduleHub
        await _scheduleHub.Clients.Group("students").SendAsync("ClassAdded", new { id = ev.Id, courseCode = ev.CourseCode, day = ev.Day, slot = ev.Slot });
        await _scheduleHub.Clients.Group("teachers").SendAsync("ClassAdded", new { id = ev.Id, courseCode = ev.CourseCode, day = ev.Day, slot = ev.Slot });

        // Inherit Faculty/Program from teacher to course if course doesn't have them
        // Faculty MUST come from teacher profile, cannot be changed
        // Priority: 1) Teacher profile, 2) Keep existing course values
        var courseCode = req.CourseCode ?? string.Empty;
        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Code == courseCode.Trim());
        if (course != null && !string.IsNullOrWhiteSpace(teacherEmail))
        {
            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower());
            bool updated = false;

            // Faculty MUST come from teacher profile, ignore req.Faculty
            string? facultyToSet = null;
            string? programToSet = null;

            if (teacher != null && !string.IsNullOrWhiteSpace(teacher.Faculty))
            {
                // Always use teacher's faculty from profile
                facultyToSet = teacher.Faculty;
            }

            if (!string.IsNullOrWhiteSpace(req.Program))
            {
                programToSet = req.Program.Trim();
            }
            else if (teacher != null && !string.IsNullOrWhiteSpace(teacher.Program))
            {
                programToSet = teacher.Program;
            }

            // Update course only if we have values and course doesn't have them
            if (!string.IsNullOrWhiteSpace(facultyToSet) && string.IsNullOrWhiteSpace(course.Faculty))
            {
                course.Faculty = facultyToSet;
                updated = true;
            }
            if (!string.IsNullOrWhiteSpace(programToSet) && string.IsNullOrWhiteSpace(course.Program))
            {
                course.Program = programToSet;
                updated = true;
            }

            if (updated)
            {
                await _db.SaveChangesAsync();
                // Notify about course update (Faculty/Program changed) - this helps enrollment page refresh
                await _dataUpdates.NotifyScheduleUpdated(teacherEmail, normalizedCourseCode);
            }
        }
        else
        {
            // Course doesn't exist yet, but we still notify about schedule update
            // The course will be synced later via DbSeeder or manual sync
        }

        // Notify about schedule update
        await _dataUpdates.NotifyScheduleUpdated(teacherEmail, normalizedCourseCode);

        // Create activity for schedule event creation
        if (!string.IsNullOrWhiteSpace(teacherEmail))
        {
            await CreateActivityForScheduleEventCreationAsync(ev, teacherEmail, default);
        }

        return Created($"/api/schedule/events/{ev.Id}", new { id = ev.Id });
    }

    /// <summary>
    /// Update an existing schedule event (teachers only)
    /// </summary>
    /// <param name="id">Schedule event identifier</param>
    /// <param name="req">Update request with fields to modify</param>
    /// <returns>Updated schedule event</returns>
    /// <remarks>
    /// Requires authentication. Updates an existing schedule event.
    /// Only provided fields will be updated (partial update).
    /// Can update: Day, Slot, Time, EndTime, Room, Note, Capacity, Program, Faculty.
    /// 
    /// Returns 404 if event not found.
    /// </remarks>
    [Authorize]
    [HttpPut("events/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateEvent(string id, [FromBody] UpdateEventRequest req)
    {
        if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { error = "Id required" });
        var existing = await _db.Timetable.FirstOrDefaultAsync(t => t.Id == id);
        if (existing == null) return NotFound(new { error = "Event not found" });

        // Only the owner teacher can update
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var isOwner = !string.IsNullOrWhiteSpace(existing.TeacherEmail) && existing.TeacherEmail.Equals(email, StringComparison.OrdinalIgnoreCase);
        if (!isOwner)
        {
            return Forbid();
        }

        // Determine new values
        var newDay = string.IsNullOrWhiteSpace(req?.Day) ? existing.Day : req!.Day!.Trim();
        var newSlot = (req?.Slot ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(newSlot))
        {
            var s = (req?.Time ?? string.Empty).Trim();
            var e = (req?.EndTime ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(s) || string.IsNullOrWhiteSpace(e))
            {
                // If neither provided, keep existing slot
                newSlot = existing.Slot;
            }
            else
            {
                newSlot = $"{s}-{e}";
            }
        }
        var newRoom = string.IsNullOrWhiteSpace(req?.Room) ? existing.Room : req!.Room!.Trim();

        var keyUnchanged = string.Equals(existing.Day, newDay, StringComparison.OrdinalIgnoreCase)
                            && string.Equals(existing.Slot, newSlot, StringComparison.OrdinalIgnoreCase)
                            && string.Equals(existing.Room, newRoom, StringComparison.OrdinalIgnoreCase);

        // If we're changing the key (day/slot/room), enforce no enrollments exist for this event
        if (!keyUnchanged)
        {
            var hasEnrollments = await _db.Enrollments.AsNoTracking().AnyAsync(enrollment => enrollment.ScheduleEventId == id);
            if (hasEnrollments)
            {
                return Conflict(new { error = "Cannot move event: students have already enrolled." });
            }
        }

        // If key unchanged, just update mutable fields
        if (keyUnchanged)
        {
            if (req != null)
            {
                if (req.Note != null) existing.Note = req.Note;
                if (req.Capacity.HasValue) existing.Capacity = req.Capacity;
                if (req.Faculty != null) existing.Faculty = string.IsNullOrWhiteSpace(req.Faculty) ? null : req.Faculty.Trim();
                if (req.Program != null) existing.Program = string.IsNullOrWhiteSpace(req.Program) ? null : req.Program.Trim();
            }
            await _db.SaveChangesAsync();

            // Notify via ScheduleHub
            await _scheduleHub.Clients.Group("students").SendAsync("ScheduleUpdated", new { id = existing.Id, courseCode = existing.CourseCode });
            await _scheduleHub.Clients.Group("teachers").SendAsync("ScheduleUpdated", new { id = existing.Id, courseCode = existing.CourseCode });

            // Inherit Faculty/Program from teacher to course if course doesn't have them
            // Faculty MUST come from teacher profile, cannot be changed
            // Priority: 1) Teacher profile, 2) Keep existing course values
            var course = await _db.Courses.FirstOrDefaultAsync(c => c.Code == existing.CourseCode);
            if (course != null)
            {
                var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == existing.TeacherEmail.ToLower());
                bool updated = false;

                // Faculty MUST come from teacher profile, ignore req.Faculty
                string? facultyToSet = null;
                string? programToSet = null;

                if (teacher != null && !string.IsNullOrWhiteSpace(teacher.Faculty))
                {
                    // Always use teacher's faculty from profile
                    facultyToSet = teacher.Faculty;
                }

                if (!string.IsNullOrWhiteSpace(req?.Program))
                {
                    programToSet = req.Program.Trim();
                }
                else if (teacher != null && !string.IsNullOrWhiteSpace(teacher.Program))
                {
                    programToSet = teacher.Program;
                }

                // Update course only if we have values and course doesn't have them
                if (!string.IsNullOrWhiteSpace(facultyToSet) && string.IsNullOrWhiteSpace(course.Faculty))
                {
                    course.Faculty = facultyToSet;
                    updated = true;
                }
                if (!string.IsNullOrWhiteSpace(programToSet) && string.IsNullOrWhiteSpace(course.Program))
                {
                    course.Program = programToSet;
                    updated = true;
                }

                if (updated)
                {
                    await _db.SaveChangesAsync();
                    // Notify about course update (Faculty/Program changed) - this helps enrollment page refresh
                    await _dataUpdates.NotifyScheduleUpdated(existing.TeacherEmail, existing.CourseCode);
                }
            }

            // Notify about schedule update
            await _dataUpdates.NotifyScheduleUpdated(existing.TeacherEmail, existing.CourseCode);

            return Ok(new { id = existing.Id, day = existing.Day, slot = existing.Slot, room = existing.Room });
        }

        // Compute target id and ensure no collision
        var newId = $"evt:{newDay}:{newSlot}:{existing.CourseCode}:{newRoom}";
        if (await _db.Timetable.AsNoTracking().AnyAsync(t => t.Id == newId))
        {
            return Conflict(new { error = "Target slot already occupied" });
        }

        // Create replacement event and remove old
        var replacement = new TimetableEntryEntity
        {
            Id = newId,
            Day = newDay,
            Slot = newSlot,
            CourseCode = existing.CourseCode,
            Room = newRoom,
            TeacherEmail = existing.TeacherEmail,
            Type = existing.Type,
            Note = req?.Note ?? existing.Note,
            Capacity = req?.Capacity ?? existing.Capacity,
            ClassGroupKeysJson = existing.ClassGroupKeysJson,
            Faculty = req?.Faculty != null ? (string.IsNullOrWhiteSpace(req.Faculty) ? null : req.Faculty.Trim()) : existing.Faculty,
            Program = req?.Program != null ? (string.IsNullOrWhiteSpace(req.Program) ? null : req.Program.Trim()) : existing.Program
        };

        _db.Timetable.Remove(existing);
        _db.Timetable.Add(replacement);
        await _db.SaveChangesAsync();

        // Inherit Faculty/Program from teacher to course if course doesn't have them
        // Faculty MUST come from teacher profile, cannot be changed
        // Priority: 1) Teacher profile, 2) Keep existing course values
        var courseToUpdate = await _db.Courses.FirstOrDefaultAsync(c => c.Code == replacement.CourseCode);
        if (courseToUpdate != null)
        {
            var teacher = await _db.Faculty.AsNoTracking().FirstOrDefaultAsync(f => f.Email.ToLower() == replacement.TeacherEmail.ToLower());
            bool updated = false;

            // Faculty MUST come from teacher profile, ignore req.Faculty
            string? facultyToSet = null;
            string? programToSet = null;

            if (teacher != null && !string.IsNullOrWhiteSpace(teacher.Faculty))
            {
                // Always use teacher's faculty from profile
                facultyToSet = teacher.Faculty;
            }

            if (!string.IsNullOrWhiteSpace(req?.Program))
            {
                programToSet = req.Program.Trim();
            }
            else if (teacher != null && !string.IsNullOrWhiteSpace(teacher.Program))
            {
                programToSet = teacher.Program;
            }

            // Update course only if we have values and course doesn't have them
            if (!string.IsNullOrWhiteSpace(facultyToSet) && string.IsNullOrWhiteSpace(courseToUpdate.Faculty))
            {
                courseToUpdate.Faculty = facultyToSet;
                updated = true;
            }
            if (!string.IsNullOrWhiteSpace(programToSet) && string.IsNullOrWhiteSpace(courseToUpdate.Program))
            {
                courseToUpdate.Program = programToSet;
                updated = true;
            }

            if (updated)
            {
                await _db.SaveChangesAsync();
                // Notify about course update (Faculty/Program changed) - this helps enrollment page refresh
                await _dataUpdates.NotifyScheduleUpdated(replacement.TeacherEmail, replacement.CourseCode);
            }
        }

        // Notify about schedule update
        await _dataUpdates.NotifyScheduleUpdated(replacement.TeacherEmail, replacement.CourseCode);

        // Create activity for schedule event update
        await CreateActivityForScheduleEventUpdateAsync(existing, replacement, email, default);

        return Ok(new { id = replacement.Id, day = replacement.Day, slot = replacement.Slot, room = replacement.Room });
    }

    /// <summary>
    /// Assigns one or more schedule events to a different teacher (teacher-managed)
    /// </summary>
    /// <param name="req">Bulk assignment payload</param>
    /// <returns>Summary of reassignment</returns>
    /// <remarks>
    /// Requires teacher role. Allows faculty managers to move existing timetable entries
    /// to another teacher without editing each event individually.
    /// </remarks>
    [Authorize(Policy = "RequireTeacher")]
    [HttpPost("events/assign-teacher")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignTeacher([FromBody] AssignTeacherRequest req)
    {
        if (req == null) return BadRequest(new { error = "Body required" });
        var normalizedEmail = req.TeacherEmail?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail)) return BadRequest(new { error = "TeacherEmail is required" });
        var ids = req.EventIds?.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().ToList();
        if (ids == null || ids.Count == 0) return BadRequest(new { error = "At least one event id is required" });

        var teacher = await _db.Faculty.FirstOrDefaultAsync(f => f.Email.ToLower() == normalizedEmail);
        if (teacher == null)
        {
            return NotFound(new { error = "Teacher not found" });
        }

        var entries = await _db.Timetable.Where(t => ids.Contains(t.Id)).ToListAsync();
        if (entries.Count == 0)
        {
            return NotFound(new { error = "No matching events found" });
        }

        var missing = ids.Except(entries.Select(e => e.Id)).ToList();
        var reassigned = new List<(string Id, string? PreviousEmail, string CourseCode)>();

        foreach (var entry in entries)
        {
            var previous = entry.TeacherEmail;
            entry.TeacherEmail = teacher.Email;
            if (!string.IsNullOrWhiteSpace(teacher.Faculty))
            {
                entry.Faculty = teacher.Faculty;
            }
            if (!string.IsNullOrWhiteSpace(teacher.Program) && string.IsNullOrWhiteSpace(entry.Program))
            {
                entry.Program = teacher.Program;
            }
            reassigned.Add((entry.Id, previous, entry.CourseCode));
        }

        await _db.SaveChangesAsync();

        var entryMap = entries.ToDictionary(e => e.Id);

        foreach (var item in reassigned)
        {
            if (!entryMap.TryGetValue(item.Id, out var entry)) continue;
            await _dataUpdates.NotifyScheduleUpdated(entry.TeacherEmail, entry.CourseCode);
            if (!string.IsNullOrWhiteSpace(item.PreviousEmail) && !string.Equals(item.PreviousEmail, entry.TeacherEmail, StringComparison.OrdinalIgnoreCase))
            {
                await _dataUpdates.NotifyScheduleUpdated(item.PreviousEmail, entry.CourseCode);
            }
        }

        return Ok(new
        {
            updated = entries.Count,
            missing,
            teacher = teacher.Email
        });
    }

    // DELETE /api/schedule/events/{id}
    // Removes a schedule event if the caller is the owner and no students are enrolled
    /// <summary>
    /// Delete a schedule event (teachers only)
    /// </summary>
    /// <param name="id">Schedule event identifier</param>
    /// <returns>No content on success</returns>
    /// <remarks>
    /// Requires authentication. Deletes a schedule event and all associated enrollments.
    /// Also deletes all student enrollments linked to this event.
    /// Returns 404 if event not found.
    /// </remarks>
    [HttpDelete("events/{id}")]
    [Authorize]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteEvent(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { error = "Id required" });
        var existing = await _db.Timetable.FirstOrDefaultAsync(t => t.Id == id);
        if (existing == null) return NotFound(new { error = "Event not found" });

        // Only owner can delete
        var email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var isOwner = !string.IsNullOrWhiteSpace(existing.TeacherEmail) && existing.TeacherEmail.Equals(email, StringComparison.OrdinalIgnoreCase);
        if (!isOwner)
        {
            return Forbid();
        }

        // Prevent deleting if enrollments exist
        var hasEnrollments = await _db.Enrollments.AsNoTracking().AnyAsync(e => e.ScheduleEventId == id);
        if (hasEnrollments)
        {
            return Conflict(new { error = "Cannot delete event: students have already enrolled." });
        }

        var courseCode = existing.CourseCode;
        var teacherEmail = existing.TeacherEmail;

        // Create activity for schedule event deletion before removing
        await CreateActivityForScheduleEventDeletionAsync(existing, email, default);

        _db.Timetable.Remove(existing);
        await _db.SaveChangesAsync();

        // Notify via ScheduleHub
        await _scheduleHub.Clients.Group("students").SendAsync("ClassRemoved", new { id = existing.Id, courseCode = existing.CourseCode });
        await _scheduleHub.Clients.Group("teachers").SendAsync("ClassRemoved", new { id = existing.Id, courseCode = existing.CourseCode });

        // Notify about schedule update
        await _dataUpdates.NotifyScheduleUpdated(teacherEmail, courseCode);

        return NoContent();
    }

    /// <summary>
    /// Get timetable for a teacher
    /// </summary>
    /// <param name="email">Teacher email address</param>
    /// <returns>List of schedule events for the teacher</returns>
    /// <remarks>
    /// Returns all schedule events (timetable entries) for a specific teacher.
    /// Each event includes enrollment count and expanded ClassGroupKeys.
    /// </remarks>
    [HttpGet("/api/teachers/{email}/timetable")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> TimetableForTeacher(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return Ok(Array.Empty<object>());
        var list = await _db.Timetable.AsNoTracking().Where(t => t.TeacherEmail.ToLower() == email.ToLower()).ToListAsync();
        var ids2 = list.Select(t => t.Id).ToList();
        var enrollCounts2 = await _db.Enrollments.AsNoTracking()
            .Where(e => e.ScheduleEventId != null && ids2.Contains(e.ScheduleEventId))
            .GroupBy(e => e.ScheduleEventId!)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);
        
        // Get course names for all course codes
        var courseCodes = list.Select(t => t.CourseCode).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
        var courseNames = await _db.Courses.AsNoTracking()
            .Where(c => courseCodes.Contains(c.Code))
            .ToDictionaryAsync(c => c.Code, c => c.NameEn ?? c.NameSk ?? c.Code);
        
        var res = list.Select(t => new
        {
            id = t.Id,
            day = t.Day,
            slot = t.Slot,
            courseCode = t.CourseCode,
            courseName = courseNames.TryGetValue(t.CourseCode ?? "", out var name) ? name : t.CourseCode,
            room = t.Room,
            teacherEmail = t.TeacherEmail,
            type = t.Type,
            note = t.Note,
            classGroupKeys = string.IsNullOrWhiteSpace(t.ClassGroupKeysJson)
                ? new List<string>()
                : System.Text.Json.JsonSerializer.Deserialize<List<string>>(t.ClassGroupKeysJson!) ?? new List<string>(),
            enrollmentsCount = enrollCounts2.TryGetValue(t.Id, out var c) ? c : 0
        });
        return Ok(res);
    }

    /// <summary>
    /// Creates activity records for schedule event creation
    /// </summary>
    /// <param name="ev">The schedule event entity</param>
    /// <param name="teacherEmail">Email of the teacher creating the event</param>
    /// <param name="ct">Cancellation token</param>
    private async Task CreateActivityForScheduleEventCreationAsync(
        TimetableEntryEntity ev,
        string teacherEmail,
        CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            // Get teacher name
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == teacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? teacherEmail;

            // Get course name
            var course = await _db.Courses
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == ev.CourseCode, ct);
            var courseName = course?.NameEn ?? course?.NameSk ?? ev.CourseCode;

            // Get enrolled students for this course
            var enrollmentStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == ev.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var enrolledStudents = await _db.Students
                .AsNoTracking()
                .Where(s => enrollmentStudentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrollmentStudentIds.Contains(s.PersonId)))
                .Select(s => new { StudentEmail = s.Email ?? "", StudentId = s.Id })
                .ToListAsync(ct);

            var meta = new Dictionary<string, object>
            {
                ["scheduleEventId"] = ev.Id,
                ["courseCode"] = ev.CourseCode,
                ["day"] = ev.Day ?? "",
                ["slot"] = ev.Slot ?? "",
                ["room"] = ev.Room ?? "",
                ["type"] = ev.Type ?? ""
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "schedule",
                Title = $"Created schedule event: {courseName}",
                Description = $"{ev.Day} {ev.Slot} • Room: {ev.Room ?? "TBA"}",
                Subject = courseName,
                CourseCode = ev.CourseCode,
                TeacherEmail = teacherEmail,
                TeacherDisplay = teacherName,
                Room = ev.Room,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "medium",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = teacherEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for enrolled students
            foreach (var student in enrolledStudents)
            {
                if (string.IsNullOrWhiteSpace(student.StudentEmail)) continue;

                var studentEntity = await _db.Students
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == student.StudentEmail.ToLower() || s.Id == student.StudentId, ct);
                var studentName = studentEntity?.FullName ?? student.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_s_{student.StudentEmail.GetHashCode()}",
                    Type = "schedule",
                    Title = $"New schedule event: {courseName}",
                    Description = $"{ev.Day} {ev.Slot} • Room: {ev.Room ?? "TBA"}",
                    Subject = courseName,
                    CourseCode = ev.CourseCode,
                    TeacherEmail = teacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = student.StudentEmail,
                    StudentName = studentName,
                    Room = ev.Room,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "medium",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = teacherEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(studentActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Log but don't fail the request
        }
    }

    private async Task CreateActivityForScheduleEventUpdateAsync(
        TimetableEntryEntity oldEvent,
        TimetableEntryEntity newEvent,
        string updaterEmail,
        CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            // Get teacher name
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == newEvent.TeacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? newEvent.TeacherEmail;

            // Get course name
            var course = await _db.Courses
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == newEvent.CourseCode, ct);
            var courseName = course?.NameEn ?? course?.NameSk ?? newEvent.CourseCode;

            // Get enrolled students
            var enrollmentStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == newEvent.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var enrolledStudents = await _db.Students
                .AsNoTracking()
                .Where(s => enrollmentStudentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrollmentStudentIds.Contains(s.PersonId)))
                .Select(s => new { StudentEmail = s.Email ?? "", StudentId = s.Id })
                .ToListAsync(ct);

            var changes = new List<string>();
            if (oldEvent.Day != newEvent.Day) changes.Add($"Day: {oldEvent.Day} → {newEvent.Day}");
            if (oldEvent.Slot != newEvent.Slot) changes.Add($"Time: {oldEvent.Slot} → {newEvent.Slot}");
            if (oldEvent.Room != newEvent.Room) changes.Add($"Room: {oldEvent.Room ?? "TBA"} → {newEvent.Room ?? "TBA"}");

            var meta = new Dictionary<string, object>
            {
                ["scheduleEventId"] = newEvent.Id,
                ["courseCode"] = newEvent.CourseCode,
                ["changes"] = changes
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "schedule",
                Title = $"Updated schedule event: {courseName}",
                Description = changes.Count > 0 ? string.Join(", ", changes) : "Schedule event updated",
                Subject = courseName,
                CourseCode = newEvent.CourseCode,
                TeacherEmail = newEvent.TeacherEmail,
                TeacherDisplay = teacherName,
                Room = newEvent.Room,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = updaterEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for enrolled students
            foreach (var student in enrolledStudents)
            {
                if (string.IsNullOrWhiteSpace(student.StudentEmail)) continue;

                var studentEntity = await _db.Students
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == student.StudentEmail.ToLower() || s.Id == student.StudentId, ct);
                var studentName = studentEntity?.FullName ?? student.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_s_{student.StudentEmail.GetHashCode()}",
                    Type = "schedule",
                    Title = $"Schedule event updated: {courseName}",
                    Description = changes.Count > 0 ? string.Join(", ", changes) : "Schedule event updated",
                    Subject = courseName,
                    CourseCode = newEvent.CourseCode,
                    TeacherEmail = newEvent.TeacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = student.StudentEmail,
                    StudentName = studentName,
                    Room = newEvent.Room,
                    Timestamp = now.ToString("o"),
                    RequiresAction = true,
                    Priority = "medium",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = updaterEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(studentActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Log but don't fail the request
        }
    }

    private async Task CreateActivityForScheduleEventDeletionAsync(
        TimetableEntryEntity ev,
        string deleterEmail,
        CancellationToken ct)
    {
        try
        {
            var now = DateTime.UtcNow;
            var activityId = $"act_{now:yyyyMMddHHmmss}_{Guid.NewGuid():N}";

            // Get teacher name
            var teacher = await _db.Faculty
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.Email.ToLower() == ev.TeacherEmail.ToLower(), ct);
            var teacherName = teacher?.FullName ?? ev.TeacherEmail;

            // Get course name
            var course = await _db.Courses
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == ev.CourseCode, ct);
            var courseName = course?.NameEn ?? course?.NameSk ?? ev.CourseCode;

            // Get enrolled students
            var enrollmentStudentIds = await _db.Enrollments
                .Where(e => e.CourseCode == ev.CourseCode && e.Status == "Confirmed")
                .Select(e => e.StudentId)
                .Distinct()
                .ToListAsync(ct);

            var enrolledStudents = await _db.Students
                .AsNoTracking()
                .Where(s => enrollmentStudentIds.Contains(s.Id) || (!string.IsNullOrWhiteSpace(s.PersonId) && enrollmentStudentIds.Contains(s.PersonId)))
                .Select(s => new { StudentEmail = s.Email ?? "", StudentId = s.Id })
                .ToListAsync(ct);

            var meta = new Dictionary<string, object>
            {
                ["scheduleEventId"] = ev.Id,
                ["courseCode"] = ev.CourseCode,
                ["day"] = ev.Day ?? "",
                ["slot"] = ev.Slot ?? "",
                ["room"] = ev.Room ?? ""
            };

            // Create activity for teacher
            var teacherActivity = new ActivityEntity
            {
                Id = $"{activityId}_teacher",
                Type = "schedule",
                Title = $"Deleted schedule event: {courseName}",
                Description = $"{ev.Day} {ev.Slot} • Room: {ev.Room ?? "TBA"}",
                Subject = courseName,
                CourseCode = ev.CourseCode,
                TeacherEmail = ev.TeacherEmail,
                TeacherDisplay = teacherName,
                Room = ev.Room,
                Timestamp = now.ToString("o"),
                RequiresAction = false,
                Priority = "low",
                MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                CreatedByEmail = deleterEmail,
                CreatedAt = now.ToString("o"),
                UpdatedAt = now.ToString("o"),
                IsResolved = false,
                IsArchived = false
            };
            _db.Activities.Add(teacherActivity);

            // Create activities for enrolled students
            foreach (var student in enrolledStudents)
            {
                if (string.IsNullOrWhiteSpace(student.StudentEmail)) continue;

                var studentEntity = await _db.Students
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => (s.Email ?? "").ToLower() == student.StudentEmail.ToLower() || s.Id == student.StudentId, ct);
                var studentName = studentEntity?.FullName ?? student.StudentEmail;

                var studentActivity = new ActivityEntity
                {
                    Id = $"{activityId}_s_{student.StudentEmail.GetHashCode()}",
                    Type = "schedule",
                    Title = $"Schedule event deleted: {courseName}",
                    Description = $"{ev.Day} {ev.Slot} • Room: {ev.Room ?? "TBA"}",
                    Subject = courseName,
                    CourseCode = ev.CourseCode,
                    TeacherEmail = ev.TeacherEmail,
                    TeacherDisplay = teacherName,
                    StudentEmail = student.StudentEmail,
                    StudentName = studentName,
                    Room = ev.Room,
                    Timestamp = now.ToString("o"),
                    RequiresAction = false,
                    Priority = "low",
                    MetaJson = JsonSerializer.Serialize(meta, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                    CreatedByEmail = deleterEmail,
                    CreatedAt = now.ToString("o"),
                    UpdatedAt = now.ToString("o"),
                    IsResolved = false,
                    IsArchived = false
                };
                _db.Activities.Add(studentActivity);
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Log but don't fail the request
        }
    }
}
