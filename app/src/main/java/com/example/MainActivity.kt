package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
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
import com.example.ui.components.StatusBadge
import com.example.ui.screens.*
import com.example.ui.theme.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .testTag("app_root_surface"),
                    color = Slate50
                ) {
                    AppNavigationRoot()
                }
            }
        }
    }
}

@Composable
fun AppNavigationRoot() {
    var currentScreen by remember { mutableStateOf(Screen.LOGIN) }
    var currentUserEmail by remember { mutableStateOf("") }
    var currentUserName by remember { mutableStateOf("") }

    when (currentScreen) {
        Screen.LOGIN -> {
            LoginScreen(
                onLoginSuccess = { role, email, name ->
                    currentUserEmail = email
                    currentUserName = name
                    currentScreen = if (role == "ADMIN") Screen.ADMIN_MAIN else Screen.STAFF_MAIN
                }
            )
        }
        Screen.ADMIN_MAIN -> {
            BackHandler { currentScreen = Screen.LOGIN }
            AdminMainView(
                adminEmail = currentUserEmail,
                onSignOut = { currentScreen = Screen.LOGIN }
            )
        }
        Screen.STAFF_MAIN -> {
            BackHandler { currentScreen = Screen.LOGIN }
            StaffMainView(
                staffEmail = currentUserEmail,
                staffName = currentUserName,
                onSignOut = { currentScreen = Screen.LOGIN }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminMainView(
    adminEmail: String,
    onSignOut: () -> Unit
) {
    var currentTab by remember { mutableStateOf(AdminTab.DASHBOARD) }
    var showNotificationsDialog by remember { mutableStateOf(false) }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .testTag("admin_main_screen"),
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(PrimaryBlueBg),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                tint = PrimaryBlue,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "AI STAFF OPERATIONS",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = PrimaryBlue
                            )
                            Text(
                                text = "Admin Portal",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Navy900
                            )
                        }
                    }
                },
                actions = {
                    // Notification Bell with Badge
                    IconButton(
                        onClick = { showNotificationsDialog = true },
                        modifier = Modifier.testTag("admin_notification_button")
                    ) {
                        BadgedBox(
                            badge = {
                                Badge(
                                    containerColor = WarningAmber,
                                    contentColor = PureWhite
                                ) {
                                    Text("2", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications",
                                tint = Slate600
                            )
                        }
                    }

                    // Logout Icon
                    IconButton(
                        onClick = onSignOut,
                        modifier = Modifier.testTag("admin_sign_out_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Logout,
                            contentDescription = "Sign Out",
                            tint = DangerRed
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = PureWhite,
                    titleContentColor = Navy900
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = PureWhite,
                tonalElevation = 8.dp,
                modifier = Modifier.testTag("admin_bottom_nav")
            ) {
                NavigationBarItem(
                    selected = currentTab == AdminTab.DASHBOARD,
                    onClick = { currentTab = AdminTab.DASHBOARD },
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                    label = { Text("Overview", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == AdminTab.STAFF_360,
                    onClick = { currentTab = AdminTab.STAFF_360 },
                    icon = { Icon(Icons.Default.People, contentDescription = "Staff 360") },
                    label = { Text("Staff 360°", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == AdminTab.TIMETABLE,
                    onClick = { currentTab = AdminTab.TIMETABLE },
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = "Timetable") },
                    label = { Text("Timetable", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == AdminTab.TASKS_LEAVE,
                    onClick = { currentTab = AdminTab.TASKS_LEAVE },
                    icon = { Icon(Icons.Default.Assignment, contentDescription = "Tasks & Leave") },
                    label = { Text("Tasks/Leave", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == AdminTab.AI_COPILOT,
                    onClick = { currentTab = AdminTab.AI_COPILOT },
                    icon = { Icon(Icons.Default.Psychology, contentDescription = "AI Copilot") },
                    label = { Text("AI Copilot", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )
            }
        },
        containerColor = Slate50
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (currentTab) {
                AdminTab.DASHBOARD -> AdminDashboardScreen(
                    onNavigateToStaff = { currentTab = AdminTab.STAFF_360 },
                    onNavigateToTimetable = { currentTab = AdminTab.TIMETABLE },
                    onNavigateToTasks = { currentTab = AdminTab.TASKS_LEAVE },
                    onNavigateToAI = { currentTab = AdminTab.AI_COPILOT }
                )
                AdminTab.STAFF_360 -> AdminStaff360Screen()
                AdminTab.TIMETABLE -> AdminTimetableScreen()
                AdminTab.TASKS_LEAVE -> AdminTasksLeaveScreen()
                AdminTab.AI_COPILOT -> AdminAICopilotScreen()
            }
        }
    }

    if (showNotificationsDialog) {
        NotificationsModalDialog(onDismiss = { showNotificationsDialog = false })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffMainView(
    staffEmail: String,
    staffName: String,
    onSignOut: () -> Unit
) {
    var currentTab by remember { mutableStateOf(StaffTab.MY_DAY) }
    var showNotificationsDialog by remember { mutableStateOf(false) }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .testTag("staff_main_screen"),
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(SuccessBg),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.School,
                                contentDescription = null,
                                tint = SuccessEmerald,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "FACULTY PORTAL",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = SuccessEmerald
                            )
                            Text(
                                text = staffName.ifEmpty { "Dr. Arun Kumar" },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Navy900
                            )
                        }
                    }
                },
                actions = {
                    IconButton(
                        onClick = { showNotificationsDialog = true },
                        modifier = Modifier.testTag("staff_notification_button")
                    ) {
                        BadgedBox(
                            badge = {
                                Badge(containerColor = PrimaryBlue, contentColor = PureWhite) {
                                    Text("1", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = "Notifications",
                                tint = Slate600
                            )
                        }
                    }

                    IconButton(
                        onClick = onSignOut,
                        modifier = Modifier.testTag("staff_sign_out_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Logout,
                            contentDescription = "Sign Out",
                            tint = DangerRed
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = PureWhite,
                    titleContentColor = Navy900
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = PureWhite,
                tonalElevation = 8.dp,
                modifier = Modifier.testTag("staff_bottom_nav")
            ) {
                NavigationBarItem(
                    selected = currentTab == StaffTab.MY_DAY,
                    onClick = { currentTab = StaffTab.MY_DAY },
                    icon = { Icon(Icons.Default.Today, contentDescription = "My Day") },
                    label = { Text("My Day", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == StaffTab.TIMETABLE,
                    onClick = { currentTab = StaffTab.TIMETABLE },
                    icon = { Icon(Icons.Default.Schedule, contentDescription = "Timetable") },
                    label = { Text("Timetable", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == StaffTab.ATTENDANCE,
                    onClick = { currentTab = StaffTab.ATTENDANCE },
                    icon = { Icon(Icons.Default.CheckCircle, contentDescription = "Attendance") },
                    label = { Text("Attendance", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == StaffTab.TASKS_LEAVE,
                    onClick = { currentTab = StaffTab.TASKS_LEAVE },
                    icon = { Icon(Icons.Default.Task, contentDescription = "Tasks & Leave") },
                    label = { Text("Tasks/Leave", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )

                NavigationBarItem(
                    selected = currentTab == StaffTab.AI_ASSISTANT,
                    onClick = { currentTab = StaffTab.AI_ASSISTANT },
                    icon = { Icon(Icons.Default.Psychology, contentDescription = "AI Assistant") },
                    label = { Text("AI Assistant", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = PrimaryBlue,
                        selectedTextColor = PrimaryBlue,
                        unselectedIconColor = Slate400,
                        unselectedTextColor = Slate500,
                        indicatorColor = PrimaryBlueBg
                    )
                )
            }
        },
        containerColor = Slate50
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (currentTab) {
                StaffTab.MY_DAY -> StaffMyDayScreen(
                    staffName = staffName,
                    staffEmail = staffEmail,
                    onNavigateToTimetable = { currentTab = StaffTab.TIMETABLE }
                )
                StaffTab.TIMETABLE -> StaffTimetableScreen()
                StaffTab.ATTENDANCE -> StaffAttendanceScreen()
                StaffTab.TASKS_LEAVE -> StaffTasksLeaveScreen()
                StaffTab.AI_ASSISTANT -> StaffAIAssistantScreen()
            }
        }
    }

    if (showNotificationsDialog) {
        NotificationsModalDialog(onDismiss = { showNotificationsDialog = false })
    }
}

@Composable
fun NotificationsModalDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Operational Notifications", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Navy900)
                StatusBadge(text = "2 New", textColor = PrimaryBlue, bgColor = PrimaryBlueBg)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = WarningBg,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("Operational Monitoring Signal", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF92400E))
                        Text("CSE-A Period 2: Class activity unrecorded past grace period.", fontSize = 11.sp, color = Color(0xFFB45309))
                    }
                }
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Slate100,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("Mid-Term Syllabus Submission", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Navy900)
                        Text("Reminder: Question paper submissions close Oct 12, 2026.", fontSize = 11.sp, color = Slate600)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Dismiss All", color = PrimaryBlue, fontWeight = FontWeight.Bold)
            }
        },
        containerColor = PureWhite,
        shape = RoundedCornerShape(16.dp)
    )
}
