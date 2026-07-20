import * as React from "react"

// Канон MOBILE.md: один брейкпоинт — < 768px = mobile, планшет получает
// desktop. Адаптивные компоненты сами выбирают рендер (isMobile ? sheet :
// dialog), «<ComponentMobile>» не плодим; проп mobile у компонентов —
// только принудительный override (витрина, телефон-фреймы демо).
export const MOBILE_QUERY = "(max-width: 767px)"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => window.matchMedia(query).matches)
  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener("change", onChange)
    setMatches(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return matches
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}
