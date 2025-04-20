// /api/signup.js

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (use environment variables for keys)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const app = express();

app.use(cors());
app.use(express.json());

app.post('/signup', async (req, res) => {
    const { username, email, password, userType } = req.body;
    const table = userType === 'student' ? 'student_login' : 'teacher_login';

    try {
        const { data, error } = await supabase
            .from(table)
            .insert({ username, email, password })
            .select('id')
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'User registered successfully',
            userId: data.id,
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

module.exports.handler = serverless(app)