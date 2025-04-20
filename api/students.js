const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

/**
 * PUT /api/students/:id
 * Update student profile
 */
app.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { email, name } = req.body;

    try {
        // Validate required fields
        if (!email || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email or name'
            });
        }

        const { data, error } = await supabase
            .from('student_login')
            .update({ email, username: name })
            .eq('id', id)
            .select('id, username, email')
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        res.json({
            success: true,
            student: data
        });
    } catch (error) {
        console.error('Error updating student profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile',
            details: error.message
        });
    }
});

module.exports.handler = serverless(app)