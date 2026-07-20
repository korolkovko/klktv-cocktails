import * as React from "react"

import type { Route } from "@/pages/cocktail-guide/shell"

// Реальный клиентский роутинг на голом History API (Task 6, blueprint §D) —
// без react-router: единственный управляемый колбэк route/onRouteChange на
// одной странице не оправдывает лишнюю зависимость. SPA-fallback на сервере
// (nginx, Task 11) нужен, чтобы refresh на /classics не давал 404.

const ROUTES: Route[] = ["menu", "classics", "spirits", "kitchen", "progress"]

function pathFor(r: Route): string {
  return r === "menu" ? "/" : `/${r}`
}

function routeFromPath(path: string): Route {
  const seg = path.replace(/^\//, "") as Route
  return ROUTES.includes(seg) ? seg : "menu"
}

export function useUrlRoute() {
  const [route, setRoute] = React.useState<Route>(() => routeFromPath(location.pathname))

  React.useEffect(() => {
    const onPop = () => setRoute(routeFromPath(location.pathname))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const onRouteChange = (r: Route) => {
    history.pushState(null, "", pathFor(r))
    setRoute(r)
  }

  return { route, onRouteChange }
}
