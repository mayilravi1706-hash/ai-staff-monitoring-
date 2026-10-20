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
fun StaffMyDayScreen(
    staffName: String,
    staffEmail: String,
    onNavigateToTimetable: () -> Unit
) {
    var activeActivity by remember { mutableStateOf("TEACHING") }
    var updateToastMessage by remember { mutableStateOf<String?>(null) }

    val activityList = listOf(
        "TEACHING" to Icons.Default.School,
        "PREPARING_CLASS" to Icons.Default.MenuBook,
        "MEETING" to Icons.Default.Groups,
        "ADMIN_WORK" to Icons.Default.Work,
        "AVAILABLE" to Icons.Default.CheckCircleOutline,
        "BREAK" to Icons.Default.Coffee
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .testTag("staff_my_day_screen"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Staff Profile Header Card
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
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .clip(CircleShape)
                            .background(SuccessBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("AK", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = SuccessEmerald)
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = staffName.ifEmpty { "Dr. Arun Kumar" }, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Navy900)
                        Text(text = "Associate Professor • CSE Dept", fontSize = 12.sp, color = Slate500)
                        Text(text = "Staff ID: STF-CSE-001", fontSize = 11.sp, color = PrimaryBlue)
                    }
                    StatusBadge(text = "ON CAMPUS", textColor = SuccessEmerald, bgColor = SuccessBg)
                }
            }
        }

        // Current Activity Logger
        item {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "UPDATE CURRENT ACTIVITY",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 0.5.sp
                        )
                        StatusBadge(
                            text = "ACTIVE: ${activeActivity.replace("_", " ")}",
                            textColor = PrimaryBlue,
                            bgColor = PrimaryBlueBg
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    activityList.chunked(2).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            row.forEach { (act, icon) ->
                                val isSelected = activeActivity == act
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            activeActivity = act
                                            updateToastMessage = "Activity updated: ${act.replace("_", " ")}"
                                        },
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isSelected) PrimaryBlueBg else Slate50,
                                    border = BorderStroke(1.dp, if (isSelected) PrimaryBlue else Slate200)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(
                                            imageVector = icon,
                                            contentDescription = null,
                                            tint = if (isSelected) PrimaryBlue else Slate500,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = act.replace("_", " "),
                                            fontSize = 11.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (isSelected) PrimaryBlueDark else Navy900
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    if (updateToastMessage != null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = updateToastMessage ?: "",
                            fontSize = 11.sp,
                            color = SuccessEmerald,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        // Today's Scheduled Classes
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
                        title = "Today's Class Schedule",
                        subtitle = "3 Periods assigned for today",
                        actionText = "Full Week",
                        onActionClick = onNavigateToTimetable
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    FacultyClassItem("09:00 - 10:00 AM", "Data Structures (CS301)", "Room 204 • CSE-A", "CONDUCTED", SuccessEmerald, SuccessBg)
                    Spacer(modifier = Modifier.height(10.dp))
                    FacultyClassItem("11:30 - 01:30 PM", "Algorithms Lab (CS302)", "Lab 2 • CSE-A", "IN PROGRESS", PrimaryBlue, PrimaryBlueBg)
                    Spacer(modifier = Modifier.height(10.dp))
                    FacultyClassItem("02:15 - 03:15 PM", "Operating Systems (CS304)", "Room 205 • CSE-B", "UPCOMING", Slate500, Slate100)
                }
            }
        }
    }
}

@Composable
private fun FacultyClassItem(time: String, title: String, location: String, status: String, statusColor: Color, statusBg: Color) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Slate50,
        border = BorderStroke(1.dp, Slate200),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = time, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue)
                Spacer(modifier = Modifier.height(2.dp))
                Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                Text(text = location, fontSize = 11.sp, color = Slate500)
            }
            StatusBadge(text = status, textColor = statusColor, bgColor = statusBg)
        }
    }
}

@Composable
fun StaffTimetableScreen() {
    var selectedDay by remember { mutableStateOf("Monday") }
    val days = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")

    val myTimetable = listOf(
        TimetableSlot("1", "Monday", "09:00 - 10:00 AM", "Data Structures", "CS301", "Dr. Arun Kumar", "CSE-A", "Room 204"),
        TimetableSlot("2", "Monday", "11:30 - 01:30 PM", "Algorithms Lab", "CS302", "Dr. Arun Kumar", "CSE-A", "Lab 2", isLab = true),
        TimetableSlot("3", "Monday", "02:15 - 03:15 PM", "Operating Systems", "CS304", "Dr. Arun Kumar", "CSE-B", "Room 205"),
        TimetableSlot("4", "Tuesday", "10:15 - 11:15 AM", "Data Structures", "CS301", "Dr. Arun Kumar", "CSE-A", "Room 204"),
        TimetableSlot("5", "Wednesday", "09:00 - 10:00 AM", "Advanced Algorithms", "CS501", "Dr. Arun Kumar", "CSE-Final", "Room 302"),
        TimetableSlot("6", "Thursday", "02:00 - 04:00 PM", "Project Review Lab", "CS701", "Dr. Arun Kumar", "CSE-Final", "Lab 1", isLab = true)
    )

    val currentSlots = myTimetable.filter { it.day == selectedDay }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("staff_timetable_screen")
            .padding(16.dp)
    ) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
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

        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Slate100), modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(text = "$selectedDay • ${currentSlots.size} classes", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Navy900)
                StatusBadge(text = "TEACHING HOURS: ${currentSlots.size * 2} hrs", textColor = PrimaryBlue, bgColor = PrimaryBlueBg)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
            items(currentSlots) { slot ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = PureWhite),
                    modifier = Modifier.fillMaxWidth().border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(text = slot.timeSlot, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue)
                            StatusBadge(text = if (slot.isLab) "PRACTICAL LAB" else "THEORY", textColor = Slate600, bgColor = Slate100)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(text = "${slot.subject} (${slot.subjectCode})", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Navy900)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = "Batch: ${slot.section} • Room: ${slot.room}", fontSize = 12.sp, color = Slate500)
                    }
                }
            }
        }
    }
}

@Composable
fun StaffAttendanceScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("staff_attendance_screen")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Attendance Overview Card
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = PureWhite),
            modifier = Modifier.fillMaxWidth().border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "MONTHLY ATTENDANCE SUMMARY", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate500, letterSpacing = 0.5.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "96.4%", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = SuccessEmerald)
                    StatusBadge(text = "EXEMPLARY RECORD", textColor = SuccessEmerald, bgColor = SuccessBg)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "22 Days Present • 1 Day Casual Leave • 0 Unrecorded", fontSize = 12.sp, color = Slate500)
            }
        }

        // Workload Card
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = PureWhite),
            modifier = Modifier.fillMaxWidth().border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "WEEKLY TEACHING LOAD", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate500, letterSpacing = 0.5.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "16 Hours / Week", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Navy900)
                    StatusBadge(text = "WITHIN LIMIT", textColor = PrimaryBlue, bgColor = PrimaryBlueBg)
                }
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { 16f / 18f },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                    color = PrimaryBlue,
                    trackColor = Slate200
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = "Max statutory guideline: 18 hours/week", fontSize = 11.sp, color = Slate500)
            }
        }
    }
}

@Composable
fun StaffTasksLeaveScreen() {
    var selectedTab by remember { mutableStateOf("TASKS") }
    var showApplyLeaveDialog by remember { mutableStateOf(false) }

    val myTasks = remember {
        mutableStateListOf(
            TaskItem("1", "Submit Mid-Term Question Papers", "Dr. Arun Kumar", "CSE", "Oct 12, 2026", "HIGH", "IN_PROGRESS"),
            TaskItem("2", "Lab Experiment Manual Revision", "Dr. Arun Kumar", "CSE", "Oct 18, 2026", "MEDIUM", "PENDING"),
            TaskItem("3", "Project Batch Allocation Review", "Dr. Arun Kumar", "CSE", "Oct 06, 2026", "LOW", "COMPLETED")
        )
    }

    val myLeaves = remember {
        mutableStateListOf(
            LeaveItem("1", "Dr. Arun Kumar", "CSE", "Casual Leave", "1 Day", "Sep 22, 2026", "Family function", "APPROVED"),
            LeaveItem("2", "Dr. Arun Kumar", "CSE", "On Duty", "1 Day", "Oct 24, 2026", "Conference Keynote Speaker", "PENDING")
        )
    }

    Column(modifier = Modifier.fillMaxSize().testTag("staff_tasks_leave_screen").padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Slate100).padding(4.dp)
        ) {
            val isTasks = selectedTab == "TASKS"
            Surface(
                modifier = Modifier.weight(1f).clickable { selectedTab = "TASKS" },
                shape = RoundedCornerShape(8.dp),
                color = if (isTasks) PureWhite else Color.Transparent
            ) {
                Text(text = "My Tasks (${myTasks.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (isTasks) Navy900 else Slate500, modifier = Modifier.padding(vertical = 8.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }

            val isLeave = selectedTab == "LEAVE"
            Surface(
                modifier = Modifier.weight(1f).clickable { selectedTab = "LEAVE" },
                shape = RoundedCornerShape(8.dp),
                color = if (isLeave) PureWhite else Color.Transparent
            ) {
                Text(text = "My Leaves (${myLeaves.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (isLeave) Navy900 else Slate500, modifier = Modifier.padding(vertical = 8.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (selectedTab == "TASKS") {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                items(myTasks) { task ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = PureWhite),
                        modifier = Modifier.fillMaxWidth().border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                StatusBadge(text = "${task.priority} PRIORITY", textColor = PrimaryBlue, bgColor = PrimaryBlueBg)
                                StatusBadge(text = task.status.replace("_", " "), textColor = Slate600, bgColor = Slate100)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(text = task.title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                            Text(text = "Due: ${task.dueDate}", fontSize = 12.sp, color = Slate500)
                        }
                    }
                }
            }
        } else {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Button(
                    onClick = { showApplyLeaveDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = PureWhite, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Apply Leave", fontSize = 12.sp, color = PureWhite)
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                items(myLeaves) { leave ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = PureWhite),
                        modifier = Modifier.fillMaxWidth().border(BorderStroke(1.dp, Slate200), RoundedCornerShape(12.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(text = "${leave.leaveType} (${leave.duration})", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                                val (sc, sbg) = if (leave.status == "APPROVED") SuccessEmerald to SuccessBg else WarningAmber to WarningBg
                                StatusBadge(text = leave.status, textColor = sc, bgColor = sbg)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(text = "Date: ${leave.dates}", fontSize = 12.sp, color = Slate500)
                            Text(text = "Reason: ${leave.reason}", fontSize = 12.sp, color = Slate500)
                        }
                    }
                }
            }
        }
    }

    if (showApplyLeaveDialog) {
        AlertDialog(
            onDismissRequest = { showApplyLeaveDialog = false },
            title = { Text("Apply for Leave", fontWeight = FontWeight.Bold, color = Navy900) },
            text = { Text("Select leave dates and specify reason for HOD/Principal review.", fontSize = 13.sp, color = Slate600) },
            confirmButton = {
                Button(
                    onClick = { showApplyLeaveDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Text("Submit Application", color = PureWhite)
                }
            },
            dismissButton = {
                TextButton(onClick = { showApplyLeaveDialog = false }) {
                    Text("Cancel", color = Slate500)
                }
            },
            containerColor = PureWhite,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
fun StaffAIAssistantScreen() {
    var queryText by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            Pair("USER", "What is my next class and what topic was covered last time?"),
            Pair("AI", "[DATABASE FACT] Your next class is Algorithms Lab (CS302) at 11:30 AM in Lab 2 with CSE-A batch.\n\n[SYLLABUS NOTE] Last week's recorded experiment was Graph BFS/DFS traversal.\n\n[RECOMMENDATION] Minimum Spanning Tree (Prim's / Kruskal's) is scheduled for today.")
        )
    }

    Column(modifier = Modifier.fillMaxSize().testTag("staff_ai_assistant_screen").padding(16.dp)) {
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = PrimaryBlueBg),
            modifier = Modifier.fillMaxWidth().border(BorderStroke(1.dp, PrimaryBlueLight.copy(alpha = 0.5f)), RoundedCornerShape(12.dp))
        ) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(PrimaryBlue), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.School, contentDescription = null, tint = PureWhite, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text("Faculty AI Assistant", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Navy900)
                    Text("Personalized academic assistant for lecture preparation and schedules", fontSize = 11.sp, color = Slate600)
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(messages) { (sender, text) ->
                val isUser = sender == "USER"
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = if (isUser) PrimaryBlue else PureWhite),
                        border = if (isUser) null else BorderStroke(1.dp, Slate200),
                        modifier = Modifier.widthIn(max = 300.dp)
                    ) {
                        Text(text = text, fontSize = 13.sp, color = if (isUser) PureWhite else Navy900, modifier = Modifier.padding(12.dp), lineHeight = 18.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = queryText,
                onValueChange = { queryText = it },
                placeholder = { Text("Ask your academic assistant...", fontSize = 13.sp, color = Slate400) },
                singleLine = true,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue, unfocusedBorderColor = Slate200, focusedContainerColor = PureWhite, unfocusedContainerColor = PureWhite)
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (queryText.isNotBlank()) {
                        val q = queryText.trim()
                        messages.add(Pair("USER", q))
                        queryText = ""
                        messages.add(Pair("AI", "[DATABASE FACT] Retrieved authorized faculty records for '$q'.\n\n[RECOMMENDATION] Review department curriculum portal for detailed syllabi."))
                    }
                },
                modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)).background(PrimaryBlue)
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = PureWhite)
            }
        }
    }
}
