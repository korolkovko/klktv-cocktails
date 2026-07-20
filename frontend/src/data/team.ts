// Fetches GET /api/team (backend/app/routers/team.py — visible to every
// authenticated user, not admin-only) and adapts it to the kit's TeamData
// shape (Staff[] + TeamStats + avgSections). All derivation (%, initials,
// activity labels, alarms, aggregate stats) happens here so team-view.tsx
// stays a pure renderer. Activity is a proxy: `lastActiveAt` is the most
// recent learned_at (no login tracking exists).

import * as React from "react"
import { api } from "@/lib/api"
import type { Staff, TeamData, TeamKind, TeamStats } from "@/pages/cocktail-guide/data"

interface TeamMemberOut {
  username: string
  name: string | null
  role: string
  learned: Record<string, number>
  lastActiveAt: string | null
}
interface TeamOut {
  totals: Record<string, number>
  members: TeamMemberOut[]
}

const KINDS: TeamKind[] = ["menu", "classics", "spirits", "kitchen"]
const SECTION_LABEL: Record<TeamKind, string> = {
  menu: "АВТОРСКИЕ",
  classics: "КЛАССИКА",
  spirits: "СПИРИТЫ",
  kitchen: "КУХНЯ",
}
const ROLE_RU: Record<string, string> = { admin: "АДМИН", editor: "РЕДАКТОР", reader: "БАР" }

const pct = (l: number, t: number) => (t > 0 ? Math.round((l / t) * 100) : 0)

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

/** relative activity from an ISO timestamp (or null = never learned anything).
 *  `now` is passed in so the whole adapter shares one clock. */
function activityOf(iso: string | null, now: number): { activity: string; lastSeen: string; alarm: boolean; days: number | null } {
  if (!iso) return { activity: "—", lastSeen: "НЕ НАЧАЛ", alarm: true, days: null }
  const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000))
  if (days === 0) return { activity: "СЕГОДНЯ", lastSeen: "СЕГОДНЯ", alarm: false, days }
  if (days === 1) return { activity: "ВЧЕРА", lastSeen: "ВЧЕРА", alarm: false, days }
  return { activity: `${days} ДН`, lastSeen: `${days} ДН НАЗАД`, alarm: days > 7, days }
}

export function adaptTeam(out: TeamOut, now: number): TeamData {
  const totals = { menu: 0, classics: 0, spirits: 0, kitchen: 0, ...out.totals } as Record<TeamKind, number>
  const positions = KINDS.reduce((sum, k) => sum + (totals[k] ?? 0), 0)

  const staff: Staff[] = out.members.map((m) => {
    const sections = Object.fromEntries(
      KINDS.map((k) => [k, pct(m.learned[k] ?? 0, totals[k] ?? 0)]),
    ) as Record<TeamKind, number>
    const learnedTotal = KINDS.reduce((sum, k) => sum + (m.learned[k] ?? 0), 0)
    const overall = pct(learnedTotal, positions)
    const act = activityOf(m.lastActiveAt, now)
    const name = m.name?.trim() || m.username
    // слабейший раздел (mobile-карточка); всё на 100% → strongNote вместо weak
    const minKind = KINDS.reduce((lo, k) => (sections[k] < sections[lo] ? k : lo), KINDS[0])
    const allDone = sections[minKind] === 100
    return {
      initials: initialsOf(name),
      name,
      role: ROLE_RU[m.role] ?? m.role.toUpperCase(),
      overall,
      sections,
      activity: act.activity,
      lastSeen: act.lastSeen,
      activityAlarm: act.alarm,
      weak: allDone ? undefined : `${SECTION_LABEL[minKind]} ${sections[minKind]}%`,
      strongNote: allDone ? "ВСЁ ВЫУЧЕНО ✓" : undefined,
      admin: m.role === "admin",
    }
  })

  const avg = staff.length ? Math.round(staff.reduce((s, m) => s + m.overall, 0) / staff.length) : 0
  const fullMenuStaff = staff.filter((m) => m.sections.menu === 100)
  const behindStaff = staff.filter((m) => m.overall < 30)
  const activeStaff = staff.filter((m) => !m.activityAlarm)
  const neverStarted = out.members.filter((m) => !m.lastActiveAt).length
  // note под «АКТИВНЫ · 7Д»: если кто-то не начинал — сколько; иначе самый
  // давно-неактивный по имени
  let activeNote = ""
  if (neverStarted > 0) {
    activeNote = `${neverStarted} НЕ НАЧАЛИ`
  } else {
    const worst = [...staff].filter((m) => m.activity !== "СЕГОДНЯ").sort((a, b) => b.overall - a.overall)[0]
    activeNote = worst ? `${worst.name.toUpperCase()} — ${worst.activity}` : ""
  }

  const stats: TeamStats = {
    avg,
    fullMenu: fullMenuStaff.length,
    fullMenuNames: fullMenuStaff.map((m) => m.name.toUpperCase()),
    behind: behindStaff.length,
    behindNames: behindStaff.map((m) => m.name.toUpperCase()),
    active: activeStaff.length,
    activeNote,
    staffCount: staff.length,
  }

  const avgSections = Object.fromEntries(
    KINDS.map((k) => [k, staff.length ? Math.round(staff.reduce((s, m) => s + m.sections[k], 0) / staff.length) : 0]),
  ) as Record<TeamKind, number>

  return { staff, stats, avgSections, positions }
}

type State = { data: TeamData | null; error: Error | null; loading: boolean }

export function useTeam(): State {
  const [state, setState] = React.useState<State>({ data: null, error: null, loading: true })
  React.useEffect(() => {
    let live = true
    api
      .get<TeamOut>("/api/team")
      .then((out) => live && setState({ data: adaptTeam(out, Date.now()), error: null, loading: false }))
      .catch((err) => live && setState({ data: null, error: err, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}
