package com.example.model

enum class Screen {
    LOGIN,
    ADMIN_MAIN,
    STAFF_MAIN
}

enum class AdminTab {
    DASHBOARD,
    STAFF_360,
    TIMETABLE,
    TASKS_LEAVE,
    AI_COPILOT
}

enum class StaffTab {
    MY_DAY,
    TIMETABLE,
    ATTENDANCE,
    TASKS_LEAVE,
    AI_ASSISTANT
}

enum class ActivityStatus {
    TEACHING,
    PREPARING_CLASS,
    MEETING,
    ADMIN_WORK,
    AVAILABLE,
    BREAK,
    ON_LEAVE
}

data class StaffMember(
    val id: String,
    val name: String,
    val staffCode: String,
    val department: String,
    val role: String,
    val email: String,
    val currentActivity: ActivityStatus,
    val todayClassesCount: Int,
    val attendanceRate: String,
    val activeTasksCount: Int,
    val avatarInitials: String
)

data class TimetableSlot(
    val id: String,
    val day: String,
    val timeSlot: String,
    val subject: String,
    val subjectCode: String,
    val facultyName: String,
    val section: String,
    val room: String,
    val isLab: Boolean = false
)

data class TaskItem(
    val id: String,
    val title: String,
    val assignedTo: String,
    val department: String,
    val dueDate: String,
    val priority: String, // URGENT, HIGH, MEDIUM, LOW
    val status: String // PENDING, IN_PROGRESS, COMPLETED
)

data class LeaveItem(
    val id: String,
    val staffName: String,
    val department: String,
    val leaveType: String, // Casual, Medical, On Duty
    val duration: String,
    val dates: String,
    val reason: String,
    val status: String // PENDING, APPROVED, REJECTED
)

data class OperationalAlert(
    val id: String,
    val title: String,
    val message: String,
    val subject: String,
    val room: String,
    val faculty: String,
    val timeAgo: String,
    val severity: String // WARNING, INFO
)

data class AppNotification(
    val id: String,
    val category: String,
    val title: String,
    val message: String,
    val time: String,
    val unread: Boolean = true
)
