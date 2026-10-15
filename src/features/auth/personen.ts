// architektur § 3.1 – vor dem Login ist public.members wegen RLS nicht lesbar; die Adressen stehen auf der Website.
export const PERSONEN = [
  {
    id: 'vincent',
    email: 'vincent@steinerundco.de',
    name: 'Vincent',
    initialen: 'VS',
    rolle: 'LinkedIn · DMs',
    taste: 'V',
  },
  { id: 'mike', email: 'mike@steinerundco.de', name: 'Mike', initialen: 'MM', rolle: 'Telefonie · DMs', taste: 'M' },
] as const

export type PersonId = (typeof PERSONEN)[number]['id']
export const PERSON_KEY = 'crm.person'
