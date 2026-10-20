import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string({ required_error: 'Email or Staff ID is required.' })
    .trim()
    .min(1, 'Email or Staff ID cannot be empty.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password cannot be empty.'),
  role: z.enum(['ADMIN', 'STAFF'], {
    required_error: 'Role selection (ADMIN or STAFF) is required.',
    invalid_type_error: 'Role must be either ADMIN or STAFF.',
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .email('Please enter a valid institutional email address.')
    .toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: 'Reset token is required.' })
      .trim()
      .min(1, 'Reset token cannot be empty.'),
    newPassword: z
      .string({ required_error: 'New password is required.' })
      .min(8, 'Password must be at least 8 characters long.')
      .max(128, 'Password cannot exceed 128 characters.'),
    confirmPassword: z
      .string({ required_error: 'Please confirm your new password.' })
      .min(8, 'Confirm password must be at least 8 characters long.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
