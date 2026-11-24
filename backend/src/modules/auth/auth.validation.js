const { z } = require('zod');

const loginValidationSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

const changePasswordValidationSchema = z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string().min(12, 'New password must be at least 12 characters').max(128)
});

module.exports = {
    loginValidationSchema,
    changePasswordValidationSchema
};
