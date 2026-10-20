package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.*
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun AdminDashboardScreen(
    onNavigateToStaff: () -> Unit,
    onNavigateToTimetable: () -> Unit,
    onNavigateToTasks: () -> Unit,
    onNavigateToAI: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .testTag("admin_dashboard_screen"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Platform Status Header
        item {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "INSTITUTIONAL OPERATIONS",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "Academic Year 2026-27",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Navy900
                        )
                    }
                    StatusBadge(
                        text = "SYSTEM LIVE",
                        textColor = SuccessEmerald,
                        bgColor = SuccessBg,
                        borderColor = SuccessBorder
                    )
                }
            }
        }

        // Summary Metric Cards 2x2 Grid
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Total Faculty",
                    value = "42",
                    subText = "38 Present Today",
                    icon = Icons.Default.People,
                    iconTint = PrimaryBlue,
                    iconBg = PrimaryBlueBg,
                    testTag = "stat_total_faculty"
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Class Coverage",
                    value = "94.2%",
                    subText = "24 of 26 Conducted",
                    icon = Icons.Default.CheckCircle,
                    iconTint = SuccessEmerald,
                    iconBg = SuccessBg,
                    testTag = "stat_class_coverage"
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Today's Classes",
                    value = "26",
                    subText = "4 Current Periods",
                    icon = Icons.Default.CalendarToday,
                    iconTint = IndigoPrimary,
                    iconBg = IndigoBg,
                    testTag = "stat_today_classes"
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Pending Tasks",
                    value = "5",
                    subText = "2 High Priority",
                    icon = Icons.Default.Assignment,
                    iconTint = WarningAmber,
                    iconBg = WarningBg,
                    testTag = "stat_pending_tasks"
                )
            }
        }

        // Operational Monitoring Signal
        item {
            OperationalAlertBanner(
                title = "Operational Monitoring Signal",
                message = "Scheduled class activity has not been recorded for CSE-A (Period 2: Algorithms Lab). Grace period: 15 mins.",
                onAction = onNavigateToTimetable,
                modifier = Modifier.testTag("operational_alert_banner")
            )
        }

        // Department Health
        item {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SectionHeader(
                        title = "Department Operations",
                        subtitle = "Real-time class coverage across faculties",
                        actionText = "View Staff",
                        onActionClick = onNavigateToStaff
                    )
                    Spacer(modifier = Modifier.height(14.dp))

                    DepartmentRow("Computer Science & Engineering", "96%", "14 / 14 classes", SuccessEmerald)
                    Spacer(modifier = Modifier.height(10.dp))
                    DepartmentRow("Electronics & Communication", "92%", "8 / 9 classes", PrimaryBlue)
                    Spacer(modifier = Modifier.height(10.dp))
                    DepartmentRow("Mechanical Engineering", "90%", "6 / 7 classes", WarningAmber)
                    Spacer(modifier = Modifier.height(10.dp))
                    DepartmentRow("Science & Humanities", "100%", "5 / 5 classes", SuccessEmerald)
                }
            }
        }

        // Quick Admin Action Shortcuts
        item {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "QUICK ADMINISTRATIVE ACTIONS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onNavigateToTimetable,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Slate50),
                            border = BorderStroke(1.dp, Slate200)
                        ) {
                            Icon(Icons.Default.Schedule, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Timetable", fontSize = 12.sp, color = Navy900)
                        }

                        OutlinedButton(
                            onClick = onNavigateToTasks,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Slate50),
                            border = BorderStroke(1.dp, Slate200)
                        ) {
                            Icon(Icons.Default.Task, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Tasks/Leave", fontSize = 12.sp, color = Navy900)
                        }

                        OutlinedButton(
                            onClick = onNavigateToAI,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = PrimaryBlueBg),
                            border = BorderStroke(1.dp, PrimaryBlueLight)
                        ) {
                            Icon(Icons.Default.Psychology, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("AI Copilot", fontSize = 12.sp, color = PrimaryBlue, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DepartmentRow(dept: String, percent: String, count: String, color: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = dept, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Navy900)
            Text(text = count, fontSize = 11.sp, color = Slate500)
        }
        StatusBadge(text = percent, textColor = color, bgColor = color.copy(alpha = 0.1f))
    }
}

@Composable
fun AdminStaff360Screen() {
    var searchQuery by remember { mutableStateOf("") }
    var selectedDept by remember { mutableStateOf("All") }
    var selectedStaffMember by remember { mutableStateOf<StaffMember?>(null) }

    val departments = listOf("All", "CSE", "ECE", "MECH", "S&H")

    val sampleStaff = remember {
        listOf(
            StaffMember("1", "Dr. Arun Kumar", "STF-CSE-001", "CSE", "Associate Professor", "arun.kumar@college.demo", ActivityStatus.TEACHING, 3, "96.4%", 2, "AK"),
            StaffMember("2", "Prof. Priya Raman", "STF-CSE-002", "CSE", "Assistant Professor", "priya.raman@college.demo", ActivityStatus.PREPARING_CLASS, 2, "98.1%", 1, "PR"),
            StaffMember("3", "Dr. Rajesh Murugan", "STF-ECE-001", "ECE", "Professor & HOD", "rajesh.m@college.demo", ActivityStatus.MEETING, 1, "94.0%", 4, "RM"),
            StaffMember("4", "Prof. Sneha Verma", "STF-ECE-002", "ECE", "Assistant Professor", "sneha.v@college.demo", ActivityStatus.AVAILABLE, 2, "97.5%", 1, "SV"),
            StaffMember("5", "Dr. Vikram Seth", "STF-MECH-001", "MECH", "Associate Professor", "vikram.s@college.demo", ActivityStatus.ADMIN_WORK, 2, "92.8%", 3, "VS"),
            StaffMember("6", "Prof. Ananya Iyer", "STF-SNH-001", "S&H", "Assistant Professor", "ananya.i@college.demo", ActivityStatus.TEACHING, 3, "99.0%", 0, "AI")
        )
    }

    val filteredStaff = sampleStaff.filter { staff ->
        (selectedDept == "All" || staff.department == selectedDept) &&
        (searchQuery.isEmpty() || staff.name.contains(searchQuery, ignoreCase = true) || staff.staffCode.contains(searchQuery, ignoreCase = true))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("admin_staff_360_screen")
            .padding(16.dp)
    ) {
        // Search Input
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search faculty by name or ID...", fontSize = 13.sp, color = Slate400) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate500) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("staff_search_input"),
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PrimaryBlue,
                unfocusedBorderColor = Slate200,
                focusedContainerColor = PureWhite,
                unfocusedContainerColor = PureWhite
            )
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Department Filter Tabs
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(departments) { dept ->
                val isSelected = selectedDept == dept
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isSelected) PrimaryBlue else PureWhite,
                    border = BorderStroke(1.dp, if (isSelected) PrimaryBlue else Slate200),
                    modifier = Modifier.clickable { selectedDept = dept }
                ) {
                    Text(
                        text = dept,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) PureWhite else Slate600,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Staff Cards List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(filteredStaff) { staff ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = PureWhite),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                        .clickable { selectedStaffMember = staff }
                        .testTag("staff_card_${staff.id}")
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Avatar Circle
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(PrimaryBlueBg),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = staff.avatarInitials,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryBlue
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = staff.name,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Navy900
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "(${staff.department})",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Slate500
                                )
                            }
                            Text(
                                text = "${staff.role} • ${staff.staffCode}",
                                fontSize = 11.sp,
                                color = Slate500
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                val (actLabel, actColor, actBg) = when (staff.currentActivity) {
                                    ActivityStatus.TEACHING -> Triple("Teaching", SuccessEmerald, SuccessBg)
                                    ActivityStatus.PREPARING_CLASS -> Triple("Preparing", IndigoPrimary, IndigoBg)
                                    ActivityStatus.MEETING -> Triple("Meeting", PrimaryBlue, PrimaryBlueBg)
                                    ActivityStatus.ADMIN_WORK -> Triple("Admin Work", WarningAmber, WarningBg)
                                    ActivityStatus.AVAILABLE -> Triple("Available", Color(0xFF0284C7), Color(0xFFF0F9FF))
                                    else -> Triple("Offline", Slate500, Slate100)
                                }
                                StatusBadge(text = actLabel, textColor = actColor, bgColor = actBg)
                                StatusBadge(text = "${staff.todayClassesCount} classes today", textColor = Slate600, bgColor = Slate100)
                            }
                        }

                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = "Details",
                            tint = Slate400,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }

    // Staff Details Modal
    if (selectedStaffMember != null) {
        val staff = selectedStaffMember!!
        AlertDialog(
            onDismissRequest = { selectedStaffMember = null },
            confirmButton = {
                TextButton(onClick = { selectedStaffMember = null }) {
                    Text("Close", color = PrimaryBlue, fontWeight = FontWeight.Bold)
                }
            },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PrimaryBlueBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(staff.avatarInitials, fontWeight = FontWeight.Bold, color = PrimaryBlue)
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(text = staff.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Navy900)
                        Text(text = "${staff.department} • ${staff.staffCode}", fontSize = 12.sp, color = Slate500)
                    }
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Divider(color = Slate200)
                    Text(text = "Email: ${staff.email}", fontSize = 13.sp, color = Navy900)
                    Text(text = "Attendance Rate: ${staff.attendanceRate}", fontSize = 13.sp, color = Navy900)
                    Text(text = "Active Tasks: ${staff.activeTasksCount} assigned", fontSize = 13.sp, color = Navy900)
                    Text(text = "Today's Schedule: ${staff.todayClassesCount} academic periods", fontSize = 13.sp, color = Navy900)
                    Text(text = "Current Status: ${staff.currentActivity.name.replace("_", " ")}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PrimaryBlue)
                }
            },
            containerColor = PureWhite,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
fun AdminTimetableScreen() {
    var selectedDay by remember { mutableStateOf("Monday") }
    var showAddDialog by remember { mutableStateOf(false) }

    val days = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")

    val sampleTimetable = remember {
        listOf(
            TimetableSlot("1", "Monday", "09:00 - 10:00 AM", "Data Structures", "CS301", "Dr. Arun Kumar", "CSE-A", "Room 204"),
            TimetableSlot("2", "Monday", "10:15 - 11:15 AM", "Computer Networks", "CS303", "Prof. Priya Raman", "CSE-A", "Room 204"),
            TimetableSlot("3", "Monday", "11:30 - 01:30 PM", "Algorithms Lab", "CS302", "Dr. Arun Kumar", "CSE-A", "Lab 2", isLab = true),
            TimetableSlot("4", "Monday", "02:15 - 03:15 PM", "Operating Systems", "CS304", "Dr. Rajesh Murugan", "CSE-B", "Room 205"),
            TimetableSlot("5", "Tuesday", "09:00 - 10:00 AM", "Microprocessors", "EC302", "Prof. Sneha Verma", "ECE-A", "Room 102"),
            TimetableSlot("6", "Tuesday", "10:15 - 11:15 AM", "Thermodynamics", "ME301", "Dr. Vikram Seth", "MECH-A", "Room 301")
        )
    }

    val daySlots = sampleTimetable.filter { it.day == selectedDay }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("admin_timetable_screen")
            .padding(16.dp)
    ) {
        // Timetable Day Selector
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(days) { day ->
                val isSelected = selectedDay == day
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isSelected) PrimaryBlue else PureWhite,
                    border = BorderStroke(1.dp, if (isSelected) PrimaryBlue else Slate200),
                    modifier = Modifier.clickable { selectedDay = day }
                ) {
                    Text(
                        text = day,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) PureWhite else Slate600,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Timetable Overview Stats
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Slate100),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$selectedDay Schedule (${daySlots.size} slots)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Navy900
                )
                TextButton(
                    onClick = { showAddDialog = true },
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Slot", fontSize = 12.sp, color = PrimaryBlue, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Slots List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(daySlots) { slot ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = PureWhite),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = slot.timeSlot,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryBlue
                            )
                            StatusBadge(
                                text = slot.section,
                                textColor = Slate600,
                                bgColor = Slate100
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${slot.subject} (${slot.subjectCode})",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Navy900
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = Slate400, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(slot.facultyName, fontSize = 12.sp, color = Slate600)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.MeetingRoom, contentDescription = null, tint = Slate400, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(slot.room, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Slate600)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Schedule Timetable Slot", fontWeight = FontWeight.Bold, color = Navy900) },
            text = { Text("Direct timetable scheduling is configured via active institutional master data and academic term.", fontSize = 13.sp, color = Slate600) },
            confirmButton = {
                Button(
                    onClick = { showAddDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Text("OK", color = PureWhite)
                }
            },
            containerColor = PureWhite,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
fun AdminTasksLeaveScreen() {
    var selectedTab by remember { mutableStateOf("TASKS") }

    val sampleTasks = remember {
        mutableStateListOf(
            TaskItem("1", "Submit Mid-Term Question Papers", "Dr. Arun Kumar", "CSE", "Oct 12, 2026", "HIGH", "IN_PROGRESS"),
            TaskItem("2", "Lab Equipment Inventory Verification", "Prof. Priya Raman", "CSE", "Oct 14, 2026", "MEDIUM", "PENDING"),
            TaskItem("3", "Accreditation Documentation Review", "Dr. Rajesh Murugan", "ECE", "Oct 10, 2026", "URGENT", "PENDING"),
            TaskItem("4", "Course File Audit for Semester 5", "Prof. Sneha Verma", "ECE", "Oct 15, 2026", "LOW", "COMPLETED")
        )
    }

    val sampleLeaves = remember {
        mutableStateListOf(
            LeaveItem("1", "Prof. Sneha Verma", "ECE", "Casual Leave", "1 Day", "Oct 15, 2026", "Attending national technical symposium", "PENDING"),
            LeaveItem("2", "Dr. Vikram Seth", "MECH", "On Duty", "2 Days", "Oct 18-19, 2026", "External PhD evaluation panel", "PENDING"),
            LeaveItem("3", "Prof. Priya Raman", "CSE", "Medical Leave", "1 Day", "Oct 04, 2026", "Health checkup", "APPROVED")
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("admin_tasks_leave_screen")
            .padding(16.dp)
    ) {
        // Tab Selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Slate100)
                .padding(4.dp)
        ) {
            val isTasks = selectedTab == "TASKS"
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .clickable { selectedTab = "TASKS" },
                shape = RoundedCornerShape(8.dp),
                color = if (isTasks) PureWhite else Color.Transparent
            ) {
                Text(
                    text = "Operational Tasks (${sampleTasks.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isTasks) Navy900 else Slate500,
                    modifier = Modifier.padding(vertical = 8.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }

            val isLeave = selectedTab == "LEAVE"
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .clickable { selectedTab = "LEAVE" },
                shape = RoundedCornerShape(8.dp),
                color = if (isLeave) PureWhite else Color.Transparent
            ) {
                Text(
                    text = "Leave Approvals (${sampleLeaves.count { it.status == "PENDING" }})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isLeave) Navy900 else Slate500,
                    modifier = Modifier.padding(vertical = 8.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (selectedTab == "TASKS") {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(sampleTasks) { task ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = PureWhite),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val (pColor, pBg) = when (task.priority) {
                                    "URGENT" -> DangerRed to DangerBg
                                    "HIGH" -> WarningAmber to WarningBg
                                    else -> PrimaryBlue to PrimaryBlueBg
                                }
                                StatusBadge(text = "${task.priority} PRIORITY", textColor = pColor, bgColor = pBg)
                                StatusBadge(text = task.status.replace("_", " "), textColor = Slate600, bgColor = Slate100)
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = task.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = "Assigned to: ${task.assignedTo} (${task.department}) • Due: ${task.dueDate}", fontSize = 12.sp, color = Slate500)
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(sampleLeaves) { leave ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = PureWhite),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = leave.staffName, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                                val (statusColor, statusBg) = when (leave.status) {
                                    "APPROVED" -> SuccessEmerald to SuccessBg
                                    "REJECTED" -> DangerRed to DangerBg
                                    else -> WarningAmber to WarningBg
                                }
                                StatusBadge(text = leave.status, textColor = statusColor, bgColor = statusBg)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = "${leave.leaveType} • ${leave.dates} (${leave.duration})", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PrimaryBlue)
                            Text(text = "Reason: ${leave.reason}", fontSize = 12.sp, color = Slate500)

                            if (leave.status == "PENDING") {
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = {
                                            val index = sampleLeaves.indexOf(leave)
                                            if (index >= 0) sampleLeaves[index] = leave.copy(status = "APPROVED")
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = SuccessEmerald),
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Text("Approve", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PureWhite)
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            val index = sampleLeaves.indexOf(leave)
                                            if (index >= 0) sampleLeaves[index] = leave.copy(status = "REJECTED")
                                        },
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, DangerBorder),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Text("Reject", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DangerRed)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AdminAICopilotScreen() {
    var queryText by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            Pair("USER", "What is the class coverage for today and are there any unresolved alerts?"),
            Pair("AI", "[DATABASE FACT] Today 26 academic periods are scheduled across 4 departments. 24 classes have been conducted or are actively in progress.\n\n[OPERATIONAL INSIGHT] 1 alert signal: CSE-A Period 2 has no recorded faculty activity within the 15-minute grace period.\n\n[RECOMMENDATION] Check with the CSE Department Coordinator or review the substitution register.")
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("admin_ai_copilot_screen")
            .padding(16.dp)
    ) {
        // Copilot Header
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = PrimaryBlueBg),
            modifier = Modifier
                .fillMaxWidth()
                .border(BorderStroke(1.dp, PrimaryBlueLight.copy(alpha = 0.5f)), RoundedCornerShape(12.dp))
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(PrimaryBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Psychology, contentDescription = null, tint = PureWhite, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text("AI Operations Copilot", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                    Text("Answers grounded strictly in verified institutional database records", fontSize = 11.sp, color = Slate600)
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Suggested Queries
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                SuggestionChip(
                    onClick = {
                        messages.add(Pair("USER", "Identify workload distribution across departments"))
                        messages.add(Pair("AI", "[DATABASE FACT] CSE faculty average 16.5 teaching hours/week. ECE averages 15.2 hours/week. MECH averages 14.8 hours/week.\n\n[OPERATIONAL INSIGHT] All faculty remain within the 18 hours/week statutory threshold."))
                    },
                    label = { Text("Workload Distribution", fontSize = 11.sp, color = Slate600) }
                )
            }
            item {
                SuggestionChip(
                    onClick = {
                        messages.add(Pair("USER", "Show pending leave requests affecting classes"))
                        messages.add(Pair("AI", "[DATABASE FACT] 2 leave requests pending approval: Prof. Sneha Verma (ECE) and Dr. Vikram Seth (MECH).\n\n[RECOMMENDATION] Ensure alternative faculty are designated prior to approval."))
                    },
                    label = { Text("Pending Leaves", fontSize = 11.sp, color = Slate600) }
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Message Feed
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages) { (sender, text) ->
                val isUser = sender == "USER"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                ) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = if (isUser) PrimaryBlue else PureWhite),
                        border = if (isUser) null else BorderStroke(1.dp, Slate200),
                        modifier = Modifier.widthIn(max = 300.dp)
                    ) {
                        Text(
                            text = text,
                            fontSize = 13.sp,
                            color = if (isUser) PureWhite else Navy900,
                            modifier = Modifier.padding(12.dp),
                            lineHeight = 18.sp
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Input Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = queryText,
                onValueChange = { queryText = it },
                placeholder = { Text("Ask Operations Copilot...", fontSize = 13.sp, color = Slate400) },
                singleLine = true,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryBlue,
                    unfocusedBorderColor = Slate200,
                    focusedContainerColor = PureWhite,
                    unfocusedContainerColor = PureWhite
                )
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (queryText.isNotBlank()) {
                        val q = queryText.trim()
                        messages.add(Pair("USER", q))
                        queryText = ""
                        messages.add(Pair("AI", "[DATABASE FACT] Verified query '$q' with institutional operational records.\n\n[OPERATIONAL INSIGHT] All active schedules and assignments comply with institutional guidelines."))
                    }
                },
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(PrimaryBlue)
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = PureWhite)
            }
        }
    }
}
