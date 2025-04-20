const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/change-password', async (req, res) => {
    const { username, currentPassword, newPassword, userType } = req.body;
    const table = userType === 'student' ? 'student_login' : 'teacher_login';

    try {
        // Verify current credentials
        const { data: user, error: verifyError } = await supabase
            .from(table)
            .select('id')
            .eq('username', username)
            .eq('password', currentPassword)
            .single();

        if (verifyError || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid current password'
            });
        }

        // Update password
        const { error: updateError } = await supabase
            .from(table)
            .update({ password: newPassword })
            .eq('username', username);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            error: 'Password update failed. Please try again.'
        });
    }
});

module.exports.handler = serverless(app)