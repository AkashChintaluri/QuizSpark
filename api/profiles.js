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

// Teacher-specific routes
app.route('/teachers')
    .get(async (req, res) => {
        // Get all teachers
        try {
            const { data, error } = await supabase
                .from('teacher_login')
                .select('id, username, email');

            if (error) throw error;

            res.json({
                success: true,
                teachers: data || []
            });
        } catch (error) {
            console.error('Error fetching teachers:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch teachers'
            });
        }
    });

app.route('/teachers/:id')
    .put(async (req, res) => {
        // Update teacher profile
        const { id } = req.params;
        const { email, name } = req.body;

        try {
            if (!email || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: email or name'
                });
            }

            const { data, error } = await supabase
                .from('teacher_login')
                .update({ email, username: name })
                .eq('id', id)
                .select('id, username, email')
                .single();

            if (error || !data) {
                return res.status(404).json({
                    success: false,
                    error: 'Teacher not found'
                });
            }

            res.json({
                success: true,
                teacher: data
            });
        } catch (error) {
            console.error('Error updating teacher profile:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update teacher profile',
                details: error.message
            });
        }
    });

// Student profile route
app.route('/students/:id')
    .put(async (req, res) => {
        // Update student profile
        const { id } = req.params;
        const { email, name } = req.body;

        try {
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
                error: 'Failed to update student profile',
                details: error.message
            });
        }
    });

module.exports.handler = serverless(app);
