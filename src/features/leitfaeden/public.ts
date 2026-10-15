// src/features/leitfaeden/public.ts – Vertrag BAUPLAN § 3.1.10a (M6 implementiert; Typen eingefroren).
import { createElement, type JSX, type ReactNode } from 'react'
import type { Channel, Template, TemplatePhase } from '@/types/domain'
import { VorlageWaehlen as Implementierung } from './VorlageWaehlen'

export function VorlageWaehlen(props: {
  kanal: Channel
  phase?: TemplatePhase
  aktuellId?: string
  onSelect: (t: Template) => void
  trigger: ReactNode
}): JSX.Element {
  return createElement(Implementierung, props)
}
