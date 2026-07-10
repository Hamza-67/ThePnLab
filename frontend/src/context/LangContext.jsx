import { createContext, useContext } from 'react'

export const LangContext = createContext('fr')
export const useLang = () => useContext(LangContext)

// t(fr, en) — pattern i18n historique du projet
export function useT() {
  const lang = useLang()
  return (fr, en) => (lang === 'fr' ? fr : en)
}
