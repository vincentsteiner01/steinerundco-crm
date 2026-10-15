import { clsx, type ClassValue } from 'clsx'

/** Klassen zusammenführen (clsx). Token-Utilities nur aus tokens.css. */
export const cn = (...args: ClassValue[]): string => clsx(args)
