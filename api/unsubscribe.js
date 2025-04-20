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

app.post('/', async (req, res) => {
    const { student_id, teacher_id } = req.body;

    try {
        // Validate required fields
        if (!student_id || !teacher_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing student_id or teacher_id'
            });
        }

        const { error } = await supabase
            .from('subscriptions')
            .delete()
            .eq('student_id', student_id)
            .eq('teacher_id', teacher_id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Unsubscribed successfully'
        });

    } catch (error) {
        console.error('Unsubscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to unsubscribe'
        });
    }
});

module.exports.handler = serverless(app)