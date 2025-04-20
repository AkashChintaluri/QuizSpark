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

app.get('/:userId/:userType', async (req, res) => {
    const { userId, userType } = req.params;
    const table = userType === 'student' ? 'student_login' : 'teacher_login';

    try {
        const { data, error } = await supabase
            .from(table)
            .select('id, username, email')
            .eq('id', userId)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: { ...data, userType }
        });
    } catch (error) {
        console.error('Current user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user details'
        });
    }
});

module.exports = serverless(app);
