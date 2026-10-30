import { supabase } from './supabase.js'

// Labels are presentation copy; only canonical vocabulary tags are persisted.
export const surveyQuestions = [
  { id: 'usual', title: 'What do you usually go for?', multiple: true, options: [
    { tag: 'Hawker', label: 'Hawker food' }, { tag: 'Cafe', label: 'Cafes' },
    { tag: 'Restaurant', label: 'Restaurants' }, { tag: 'Bar', label: 'Bars' },
    { tag: 'Dessert', label: 'Desserts' }, { tag: 'Bakery', label: 'Bakeries' },
  ] },
  { id: 'budget', title: 'What is your usual budget?', multiple: false, options: [
    { tag: 'Budget', label: 'Budget · up to S$15' },
    { tag: 'Mid-Range', label: 'Mid-range · S$15–40' },
    { tag: 'Splurge', label: 'Splurge · S$40+' },
  ] },
  { id: 'dietary', title: 'Any dietary needs?', multiple: true, options: [
    { tag: 'Halal', label: 'Halal' }, { tag: 'No pork', label: 'No pork' },
    { tag: 'Vegetarian Friendly', label: 'Vegetarian options' },
    { tag: 'Vegetarian Only', label: 'Vegetarian only' },
  ] },
  { id: 'company', title: 'Who do you usually eat with?', multiple: true, options: [
    { tag: 'Solo Friendly', label: 'On my own' }, { tag: 'Date Night', label: 'A date' },
    { tag: 'Group Friendly', label: 'Friends' }, { tag: 'Family Friendly', label: 'Family' },
  ] },
]
export const surveyTags = surveyQuestions.flatMap((question) => question.options.map(({ tag }) => tag))
export function validSelection(tags) {
  return surveyQuestions.every((question) => question.multiple
    || question.options.filter(({ tag }) => tags.includes(tag)).length <= 1)
}

export function createPreferencesService(db = supabase) {
  return {
    async get(userId) {
      const { data, error } = await db.from('preferences').select('tags, created_at, updated_at')
        .eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data
    },
    async put(userId, tags) {
      const { data, error } = await db.from('preferences').upsert({ user_id: userId, tags }, { onConflict: 'user_id' })
        .select('tags, created_at, updated_at').single()
      if (error) throw error
      return data
    },
  }
}
