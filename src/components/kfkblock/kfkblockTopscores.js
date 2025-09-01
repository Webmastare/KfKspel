import { supabase } from '@/utils/supabase'
const kfkblockAPI = 'https://kxlglqpkkrsomrslbhgi.supabase.co/functions/v1/kfkblock'

export async function getTopScores() {
  // Fetch top scores from the Supabase edge function
  const { data, error } = await supabase.functions.invoke('kfkblock/kfkblock-scores', {
    method: 'GET',
  })

  if (error) {
    console.error('Error fetching top scores:', error)
    throw error
  }

  return data
}
export async function submitScore(dataToSend) {
  // Submit player score to the Supabase edge function
  const { data, error } = supabase.functions.invoke('kfkblock/kfkblock-scores', {
    method: 'POST',
    body: JSON.stringify(dataToSend),
  })
  if (error) {
    console.error('Error submitting score:', error)
    throw error
  }
  return data
}
