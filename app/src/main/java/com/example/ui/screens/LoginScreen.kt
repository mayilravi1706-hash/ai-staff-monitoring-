package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLoginSuccess: (role: String, email: String, name: String) -> Unit
) {
    var selectedRole by remember { mutableStateOf("ADMIN") }
    var identifier by remember { mutableStateOf("admin@college.demo") }
    var password by remember { mutableStateOf("Admin@123") }
    var passwordVisible by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .testTag("login_screen"),
        containerColor = Slate50
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            item {
                Spacer(modifier = Modifier.height(32.dp))

                // Brand Emblem
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(PrimaryBlueBg)
                        .border(1.5.dp, PrimaryBlueLight, RoundedCornerShape(18.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = "Shield Logo",
                        tint = PrimaryBlue,
                        modifier = Modifier.size(36.dp)
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "AI STAFF OPERATIONS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp,
                    color = PrimaryBlue
                )
                Text(
                    text = "Intelligence Platform",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Navy900
                )
                Text(
                    text = "Enterprise Institutional Operations & Academic Management",
                    fontSize = 13.sp,
                    color = Slate500,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 4.dp, start = 8.dp, end = 8.dp)
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Card Container
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PureWhite),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Slate200, RoundedCornerShape(16.dp)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "SELECT PORTAL ROLE",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 0.5.sp
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        // Role Selector Pills
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Slate100)
                                .padding(4.dp)
                        ) {
                            val isAdmin = selectedRole == "ADMIN"
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        selectedRole = "ADMIN"
                                        identifier = "admin@college.demo"
                                        password = "Admin@123"
                                        errorMessage = null
                                    }
                                    .testTag("admin_role_tab"),
                                shape = RoundedCornerShape(8.dp),
                                color = if (isAdmin) PureWhite else Color.Transparent,
                                shadowElevation = if (isAdmin) 1.dp else 0.dp
                            ) {
                                Row(
                                    modifier = Modifier.padding(vertical = 10.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AdminPanelSettings,
                                        contentDescription = null,
                                        tint = if (isAdmin) PrimaryBlue else Slate500,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Administrator",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isAdmin) Navy900 else Slate500
                                    )
                                }
                            }

                            val isStaff = selectedRole == "STAFF"
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        selectedRole = "STAFF"
                                        identifier = "arun.kumar@college.demo"
                                        password = "Staff@123"
                                        errorMessage = null
                                    }
                                    .testTag("staff_role_tab"),
                                shape = RoundedCornerShape(8.dp),
                                color = if (isStaff) PureWhite else Color.Transparent,
                                shadowElevation = if (isStaff) 1.dp else 0.dp
                            ) {
                                Row(
                                    modifier = Modifier.padding(vertical = 10.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.School,
                                        contentDescription = null,
                                        tint = if (isStaff) PrimaryBlue else Slate500,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Faculty Staff",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isStaff) Navy900 else Slate500
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // Identifier Field
                        OutlinedTextField(
                            value = identifier,
                            onValueChange = {
                                identifier = it
                                errorMessage = null
                            },
                            label = { Text("Institutional Email / Staff ID") },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Email,
                                    contentDescription = null,
                                    tint = PrimaryBlue
                                )
                            },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("identifier_input"),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PrimaryBlue,
                                unfocusedBorderColor = Slate200,
                                focusedTextColor = Navy900,
                                unfocusedTextColor = Navy900,
                                focusedLabelColor = PrimaryBlue,
                                unfocusedLabelColor = Slate500
                            )
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Password Field
                        OutlinedTextField(
                            value = password,
                            onValueChange = {
                                password = it
                                errorMessage = null
                            },
                            label = { Text("Password") },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = null,
                                    tint = PrimaryBlue
                                )
                            },
                            trailingIcon = {
                                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                    Icon(
                                        imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = "Toggle Visibility",
                                        tint = Slate400
                                    )
                                }
                            },
                            singleLine = true,
                            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("password_input"),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PrimaryBlue,
                                unfocusedBorderColor = Slate200,
                                focusedTextColor = Navy900,
                                unfocusedTextColor = Navy900,
                                focusedLabelColor = PrimaryBlue,
                                unfocusedLabelColor = Slate500
                            )
                        )

                        if (errorMessage != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = DangerBg,
                                shape = RoundedCornerShape(8.dp),
                                border = BorderStroke(1.dp, DangerBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Error,
                                        contentDescription = null,
                                        tint = DangerRed,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = errorMessage ?: "",
                                        fontSize = 12.sp,
                                        color = DangerRed,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Sign In Action Button
                        Button(
                            onClick = {
                                isSubmitting = true
                                val cleanEmail = identifier.trim()
                                if (
                                    (selectedRole == "ADMIN" || cleanEmail.contains("admin", ignoreCase = true)) &&
                                    cleanEmail == "admin@college.demo" && password == "Admin@123"
                                ) {
                                    isSubmitting = false
                                    onLoginSuccess("ADMIN", "admin@college.demo", "System Administrator")
                                } else if (
                                    (cleanEmail == "arun.kumar@college.demo" || cleanEmail == "STF-CSE-001") &&
                                    password == "Staff@123"
                                ) {
                                    isSubmitting = false
                                    onLoginSuccess("STAFF", "arun.kumar@college.demo", "Dr. Arun Kumar")
                                } else {
                                    isSubmitting = false
                                    errorMessage = "Invalid credentials. Tap a demo account below."
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("login_button"),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(color = PureWhite, modifier = Modifier.size(20.dp))
                            } else {
                                Text(
                                    text = "Sign In to Platform",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PureWhite
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // One-Click Demo Accounts Card
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PureWhite),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Slate200, RoundedCornerShape(16.dp))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "ONE-CLICK DEMO ACCOUNTS",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 0.5.sp
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Admin One-Click Button
                        OutlinedButton(
                            onClick = {
                                selectedRole = "ADMIN"
                                identifier = "admin@college.demo"
                                password = "Admin@123"
                                errorMessage = null
                                onLoginSuccess("ADMIN", "admin@college.demo", "System Administrator")
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("demo_admin_button"),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Slate50),
                            border = BorderStroke(1.dp, Slate200)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clip(CircleShape)
                                            .background(PrimaryBlueBg),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.AdminPanelSettings,
                                            contentDescription = null,
                                            tint = PrimaryBlue,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(horizontalAlignment = Alignment.Start) {
                                        Text("Admin Portal", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Navy900)
                                        Text("admin@college.demo", fontSize = 11.sp, color = Slate500)
                                    }
                                }
                                Surface(
                                    color = PrimaryBlueBg,
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        "ADMIN",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PrimaryBlue,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        // Staff One-Click Button
                        OutlinedButton(
                            onClick = {
                                selectedRole = "STAFF"
                                identifier = "arun.kumar@college.demo"
                                password = "Staff@123"
                                errorMessage = null
                                onLoginSuccess("STAFF", "arun.kumar@college.demo", "Dr. Arun Kumar")
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("demo_staff_button"),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Slate50),
                            border = BorderStroke(1.dp, Slate200)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clip(CircleShape)
                                            .background(SuccessBg),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.School,
                                            contentDescription = null,
                                            tint = SuccessEmerald,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(horizontalAlignment = Alignment.Start) {
                                        Text("Dr. Arun Kumar", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Navy900)
                                        Text("Faculty • CSE Dept", fontSize = 11.sp, color = Slate500)
                                    }
                                }
                                Surface(
                                    color = SuccessBg,
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        "STAFF",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SuccessEmerald,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}
