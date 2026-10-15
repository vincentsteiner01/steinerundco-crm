// architektur § 3.7 – Re-Auth → updateUser({ password }) → optional signOut({ scope: 'others' })
import { useState } from 'react'
import * as z from 'zod/mini'
import { toast, toastFehler } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { ALLGEMEIN, TOAST } from '@/texte/de'
import { useAuth } from './authStore'

export const PasscodeSchema = z
  .object({
    aktuell: z.string().check(z.minLength(1, 'Aktuellen Passcode eingeben')),
    neu: z.string().check(z.minLength(10, 'Mindestens 10 Zeichen')),
    wiederholung: z.string(),
    andereAbmelden: z._default(z.boolean(), true),
  })
  .check(
    z.refine((v) => v.neu === v.wiederholung, {
      message: 'Die Wiederholung stimmt nicht überein',
      path: ['wiederholung'],
    }),
    z.refine((v) => v.neu !== v.aktuell, {
      message: 'Der neue Passcode muss sich vom alten unterscheiden',
      path: ['neu'],
    }),
  )

export type PasscodeEingabe = z.input<typeof PasscodeSchema>

export function usePasscodeAendern() {
  const member = useAuth((s) => s.member)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<Partial<Record<keyof PasscodeEingabe, string>> | null>(null)

  async function aendern(eingabe: PasscodeEingabe): Promise<boolean> {
    const geprueft = PasscodeSchema.safeParse(eingabe)
    if (!geprueft.success) {
      const f: Partial<Record<keyof PasscodeEingabe, string>> = {}
      for (const i of geprueft.error.issues) f[(i.path[0] as keyof PasscodeEingabe) ?? 'neu'] = i.message
      setFehler(f)
      return false
    }
    if (!member) return false
    setLaeuft(true)
    setFehler(null)
    try {
      const re = await supabase.auth.signInWithPassword({ email: member.email, password: geprueft.data.aktuell })
      if (re.error) {
        setFehler({ aktuell: ALLGEMEIN.passcodeFalsch })
        return false
      }
      const up = await supabase.auth.updateUser({ password: geprueft.data.neu })
      if (up.error) {
        toastFehler(TOAST.nichtGespeichert)
        return false
      }
      if (geprueft.data.andereAbmelden) await supabase.auth.signOut({ scope: 'others' })
      toast(TOAST.passcodeGeaendert)
      return true
    } finally {
      setLaeuft(false)
    }
  }

  return { aendern, laeuft, fehler }
}
