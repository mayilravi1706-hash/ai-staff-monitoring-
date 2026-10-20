package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val EnterpriseLightColorScheme = lightColorScheme(
    primary = PrimaryBlue,
    onPrimary = PureWhite,
    primaryContainer = PrimaryBlueBg,
    onPrimaryContainer = PrimaryBlueDark,
    secondary = IndigoPrimary,
    onSecondary = PureWhite,
    secondaryContainer = IndigoBg,
    onSecondaryContainer = IndigoPrimary,
    background = Slate50,
    onBackground = Navy900,
    surface = PureWhite,
    onSurface = Navy900,
    surfaceVariant = Slate100,
    onSurfaceVariant = Slate600,
    outline = Slate200,
    outlineVariant = Slate300,
    error = DangerRed,
    onError = PureWhite,
    errorContainer = DangerBg,
    onErrorContainer = DangerRed
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = EnterpriseLightColorScheme,
        typography = Typography,
        content = content
    )
}
