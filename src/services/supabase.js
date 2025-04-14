import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth functions
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export const signUp = async (email, password, metadata) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  })
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Quiz functions
export const getQuizzes = async () => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
  if (error) throw error
  return data
}

export const getQuizById = async (id) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const createQuiz = async (quizData) => {
  const { data, error } = await supabase
    .from('quizzes')
    .insert([quizData])
    .select()
  if (error) throw error
  return data[0]
}

// Quiz attempts functions
export const submitQuizAttempt = async (attemptData) => {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert([attemptData])
    .select()
  if (error) throw error
  return data[0]
}

export const getQuizAttempts = async (userId) => {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

// User profile functions
export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
  if (error) throw error
  return data[0]
}

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// Teacher-student subscription functions
export const getTeachers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
  if (error) throw error
  return data
}

export const getSubscriptions = async (studentId) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('student_id', studentId)
  if (error) throw error
  return data
}

export const subscribe = async (studentId, teacherId) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([{ student_id: studentId, teacher_id: teacherId }])
    .select()
  if (error) throw error
  return data[0]
}

export const unsubscribe = async (studentId, teacherId) => {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .match({ student_id: studentId, teacher_id: teacherId })
  if (error) throw error
} 