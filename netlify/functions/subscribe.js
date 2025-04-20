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

        const { data, error } = await supabase
            .from('subscriptions')
            .insert({ student_id, teacher_id })
            .select()
            .single();

        // Handle unique constraint violation
        if (error?.code === '23505') {
            return res.json({
                success: true,
                message: 'Already subscribed to this teacher'
            });
        }

        if (error) throw error;

        res.json({
            success: true,
            subscription: data
        });

    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Subscription failed'
        });
    }
});

module.exports = serverless(app);
