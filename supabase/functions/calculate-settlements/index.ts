import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory rate limiter (resets on cold start)
const callLog: Record<string, number[]> = {}
const RATE_LIMIT = 30
const WINDOW_MS = 60 * 1000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  if (!callLog[userId]) callLog[userId] = []
  callLog[userId] = callLog[userId].filter((t) => now - t < WINDOW_MS)
  if (callLog[userId].length >= RATE_LIMIT) return false
  callLog[userId].push(now)
  return true
}

interface Expense {
  payer: string
  amount: number
  involved: string[]
}

function computeSettlements(expenses: Expense[]): string[] {
  const pairwiseDebts: Record<string, number> = {}

  for (const exp of expenses) {
    const { payer, amount, involved } = exp
    if (!amount || !payer || !involved || involved.length === 0) continue
    const splitAmount = parseFloat(String(amount)) / involved.length

    for (const person of involved) {
      if (person === payer) continue
      const key = `${person}->${payer}`
      const reverseKey = `${payer}->${person}`

      if (reverseKey in pairwiseDebts) {
        pairwiseDebts[reverseKey] -= splitAmount
        if (pairwiseDebts[reverseKey] < -0.001) {
          const remaining = Math.abs(pairwiseDebts[reverseKey])
          delete pairwiseDebts[reverseKey]
          pairwiseDebts[key] = remaining
        } else if (Math.abs(pairwiseDebts[reverseKey]) < 0.001) {
          delete pairwiseDebts[reverseKey]
        }
      } else {
        pairwiseDebts[key] = (pairwiseDebts[key] || 0) + splitAmount
      }
    }
  }

  const results: string[] = []
  for (const [key, amt] of Object.entries(pairwiseDebts)) {
    if (amt > 0.01) {
      const [debtor, creditor] = key.split('->')
      results.push(`${debtor} owes ${creditor} $${amt.toFixed(2)}`)
    }
  }
  return results.length > 0 ? results : ['No debts found!']
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const expenses: Expense[] = await req.json()

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return new Response(JSON.stringify({ error: 'Expected a non-empty array of expenses.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (let i = 0; i < expenses.length; i++) {
      const { payer, amount, involved } = expenses[i]
      if (!payer || typeof payer !== 'string') {
        return new Response(JSON.stringify({ error: `Expense ${i}: payer must be a non-empty string.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (typeof amount !== 'number' || amount <= 0) {
        return new Response(JSON.stringify({ error: `Expense ${i}: amount must be a positive number.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!Array.isArray(involved) || involved.length === 0) {
        return new Response(JSON.stringify({ error: `Expense ${i}: involved must be a non-empty array.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const results = computeSettlements(expenses)
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
