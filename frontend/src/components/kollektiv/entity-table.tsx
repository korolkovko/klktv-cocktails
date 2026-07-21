import * as React from "react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/lib/use-media-query"
import { useLongPress } from "@/lib/use-long-press"
import { SearchInput } from "@/components/kollektiv/search-input"
import { ChipRow } from "@/components/kollektiv/filter-chip"
import { ArcadeButton } from "@/components/kollektiv/arcade-button"
import { ActionSheet, type ActionSheetAction } from "@/components/adapters/action-sheet"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// §54 ENTITY-TABLE (R37) — второй и последний вид таблиц кита: CRUD-список
// СУЩНОСТЕЙ (юзеры, роли, доступы). Граница с §53 fin-table: fin-table — report
// (строки × числовые метрики, ИТОГО, h-scroll, сорт); entity-table — идентичность
// + атрибуты + ДЕЙСТВИЯ. Ни итогов, ни h-скролла, ни сорта — колонок мало, лишнее
// живёт в форме редактирования (§50). Не расширять один под кейс другого.
//
// АРХИТЕКТУРА:
//  - Строка = идентичность (аватар/инициалы + имя + sub) + произвольные columns[]
//    + ⋯-меню действий. Идентичность всегда первая (flex), действия — 48px справа.
//  - Действия — НЕ ссылки в строке (реф-антипаттерн: красные «Изменить/Удалить» в
//    каждой строке). Канон: строка кликабельна → форма §50 (потребитель); ⋯ —
//    контекстное меню (desktop dropdown / mobile action-sheet по тапу/long-press).
//  - Увольнение/безвозвратное = §16 ArcadeButton (hold 3s), НЕ kit destructive:
//    action.fire=true → аркадный шар в меню (desktop) / второй confirm-шит (mobile).
//    Обратимые деструктивы («Отключить доступ») — обычный пункт (потребитель вешает
//    confirm §50 в onSelect).
//  - Toolbar = та же композиция §51 search + §49 чипы, что у fin-table; SORT-чипа
//    НЕТ (сорта нет). CTA («+ Юзер») — desktop справа; mobile потребитель кладёт сам
//    (FAB §37 / шапка), как fin-table.trailing.
//  - Стейты строк: invited (фон #FFFDF0 + dashed-аватар) / disabled (opacity + имя
//    line-through, данные читаемы) / self (без действий — «СЕБЯ НЕЛЬЗЯ»).

// ── идентичность ──
export interface EntityIdentity {
  name: React.ReactNode
  /** mono 10 — «@tg · ID» / «INVITE SENT · 2D AGO» */
  sub?: React.ReactNode
  /** инициалы для дефолт-аватара (когда нет avatar-ноды) */
  initials?: string
  /** кастомная аватар-нода (img); перебивает initials */
  avatar?: React.ReactNode
  /** INK-аватар (акцент — текущий юзер / владелец); дефолт — muted */
  accent?: boolean
}

export type EntityRowState = "invited" | "disabled" | "self"

// ── колонка ──
export interface EntityColumn<Row> {
  key: string
  label: React.ReactNode
  /** фикс-ширина px (дефолт 120); идентичность всегда flex, эти — фикс */
  width?: number
  align?: "left" | "right"
  render: (row: Row) => React.ReactNode
  /** место на мобилке: "sub" — в подпись строки (компактной формой subText);
   *  "hidden" — скрыть; undefined — компактно справа от карточки (бейдж роли) */
  mobile?: "sub" | "hidden"
  /** компактная форма для мобильной подписи (mobile:"sub"); дефолт — render */
  subText?: (row: Row) => React.ReactNode
  headerClassName?: string
}

// ── действие (⋯-меню) ──
export interface EntityAction<Row> {
  label: React.ReactNode
  icon?: React.ReactNode
  /** красный пункт (обратимый деструктив — «Отключить доступ»); за сепаратором */
  destructive?: boolean
  /** §16 ArcadeButton (hold 3s) вместо пункта — увольнение/безвозвратное */
  fire?: boolean
  /** подпись аркады (fire) — дефолт из label, если строка */
  fireLabel?: string
  /** сабтайтл аркады (fire) — дефолт «HOLD 3 SEC · NO UNDO» */
  fireSublabel?: string
  /** доступность для строки (напр. «Revoke invite» только у invited); дефолт — всем */
  show?: (row: Row) => boolean
  /** для fire — вызывается по завершении hold; для обычных — по клику */
  onSelect?: (row: Row) => void
}

export interface EntityTableProps<Row> {
  rows: Row[]
  rowKey: (row: Row) => string
  identity: (row: Row) => EntityIdentity
  /** заголовок первой колонки (mono-шапка); дефолт пусто */
  identityLabel?: React.ReactNode
  columns: EntityColumn<Row>[]
  actions?: EntityAction<Row>[]
  rowState?: (row: Row) => EntityRowState | undefined
  /** клик по строке → форма §50 (desktop); mobile тап/⋯/long-press → action-sheet */
  onRowClick?: (row: Row) => void
  /** метка у self-строк без действий; дефолт «СЕБЯ НЕЛЬЗЯ» */
  selfNote?: React.ReactNode
  // ── тулбар (композиция §51/§49; SORT-чипа нет) ──
  toolbar?: boolean
  search?: { value: string; onChange: (q: string) => void; placeholder?: string }
  /** §49-чипы потребителя (Все/Активные + Роль ▾) */
  filters?: React.ReactNode
  /** «+ Filter» dashed-чип */
  addFilter?: React.ReactNode
  /** правый CTA (напр. «+ Юзер»): desktop — ml-auto; mobile НЕ рендерится
   *  (потребитель кладёт FAB §37 / в шапку), как fin-table.trailing */
  cta?: React.ReactNode
  /** пусто — голос кита + reset */
  emptyState?: React.ReactNode
  /** оверрайд авто-mobile (витрина) */
  mobile?: boolean
  className?: string
  "data-testid"?: string
}

// ── пресеты канон-колонок (чтобы сервисы не рисовали по-своему) ──

/** РОЛЬ — бейдж палитрой кита. tone: signal (супер-админ, только рамка) /
 *  ink (админ) / butter (менеджмент) / muted (читатель). Произвольные цвета
 *  ролей НЕ переносим (реф-скрин справочника). */
export function RoleBadge({
  tone = "muted",
  children,
}: {
  tone?: "signal" | "ink" | "butter" | "muted"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-[7px] py-[2px] font-mono text-[9.5px] font-bold tracking-[0.04em]",
        tone === "signal" && "border-signal bg-card text-signal",
        tone === "ink" && "border-border bg-primary text-primary-foreground",
        tone === "butter" && "border-border bg-butter text-foreground",
        tone === "muted" && "border-muted bg-muted text-[#52525B]"
      )}
    >
      {children}
    </span>
  )
}

/** СТАТУС — mono 10 semibold. muted → приглушённый (ОТКЛЮЧЁН). butter-бейдж
 *  (ПРИГЛАШЁН) рисуй через RoleBadge tone="butter" или badge. */
export function EntityStatus({
  children,
  muted,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <span className={cn("font-mono text-[10px] font-semibold", muted ? "text-[#A1A1AA]" : "text-foreground")}>
      {children}
    </span>
  )
}

/** TELEGRAM ID / ПОСЛЕДНИЙ ВХОД — mono 11 #52525B. «—» для отсутствующих. */
export function EntityMeta({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] text-[#52525B]">{children}</span>
}

// ── аватар ──
function Avatar({ id, state }: { id: EntityIdentity; state?: EntityRowState }) {
  if (id.avatar)
    return (
      <span className="inline-flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full">
        {id.avatar}
      </span>
    )
  const invited = state === "invited"
  return (
    <span
      className={cn(
        "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] font-bold",
        invited
          ? "border-[1.5px] border-dashed border-[#A1A1AA] bg-card text-[#A1A1AA]"
          : id.accent
            ? "bg-primary text-primary-foreground"
            : "border border-[#D4D4CE] bg-muted text-[#52525B]"
      )}
    >
      {invited ? id.initials ?? "?" : id.initials}
    </span>
  )
}

// Radix/vaul-ЛОВУШКА: открыть dialog/sheet из DropdownMenuItem или пункта
// action-sheet В ТОТ ЖЕ ТИК, что меню/шит закрывается (Radix/vaul делают
// focus-return + снимают RemoveScroll/pointer-events), — гонка: диалог не
// открывается или body остаётся pointer-events:none («страница мёртвая»).
// Дефер на следующий тик: закрытие меню/шита проходит сейчас, открытие диалога —
// после. (Headless-Playwright синтетическим кликом гонку НЕ воспроизводит —
// нужна реальная мышь/тач; финальная правда — живой сайт.)
function deferAfterClose(fn: () => void) {
  setTimeout(fn, 0)
}

export function EntityTable<Row>({
  rows,
  rowKey,
  identity,
  identityLabel = "",
  columns,
  actions,
  rowState,
  onRowClick,
  selfNote = "СЕБЯ НЕЛЬЗЯ",
  toolbar = true,
  search,
  filters,
  addFilter,
  cta,
  emptyState,
  mobile: mobileProp,
  className,
  "data-testid": testid,
}: EntityTableProps<Row>) {
  const autoMobile = useIsMobile()
  const isMobile = mobileProp ?? autoMobile

  // desktop: какой строки dropdown открыт (radix держит сам, но нам нужен ряд для
  // рендера меню). mobile: action-sheet + второй fire-confirm шит.
  const [sheetRow, setSheetRow] = React.useState<Row | null>(null)
  const [fireRow, setFireRow] = React.useState<{ row: Row; action: EntityAction<Row> } | null>(null)

  const stateOf = (row: Row) => rowState?.(row)
  // видимые действия строки: self → нет меню (canon); иначе фильтр по show
  const visibleActions = React.useCallback(
    (row: Row): EntityAction<Row>[] => {
      if (!actions || stateOf(row) === "self") return []
      return actions.filter((a) => a.show?.(row) ?? true)
    },
    [actions, rowState]
  )
  const showActionsCol = !!actions?.length

  // группировка меню: обычные пункты → сепаратор → терминальные (destructive/fire)
  const split = (list: EntityAction<Row>[]) => {
    const normal = list.filter((a) => !a.destructive && !a.fire)
    const terminal = list.filter((a) => a.destructive || a.fire)
    return { normal, terminal }
  }

  // ── desktop grid template ──
  // идентичность — flex с ФЛОРОМ 160px (не minmax(0,1fr)): в контейнере уже суммы
  // фикс-колонок 1fr схлопывается в 0 и имя исчезает. entity-table рассчитана на
  // широкий контейнер (страница/канвас) — колонок мало, h-scroll не предусмотрен;
  // флор держит имя читаемым, если контейнер оказался тесным.
  const colTrack = columns.map((c) => `${c.width ?? 120}px`).join(" ")
  const gridCols = `minmax(160px,1fr) ${colTrack}${showActionsCol ? " 48px" : ""}`
  const gridStyle: React.CSSProperties = { gridTemplateColumns: gridCols }

  // ── desktop context-menu (⋯) ──
  function DesktopMenu({ row }: { row: Row }) {
    const list = visibleActions(row)
    const { normal, terminal } = split(list)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Действия"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-[15px] font-bold text-[#52525B] hover:bg-muted"
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60"
          onClick={(e) => e.stopPropagation()}
        >
          {normal.map((a, i) => (
            <DropdownMenuItem key={i} onSelect={() => deferAfterClose(() => a.onSelect?.(row))}>
              {a.icon && <span className="[&_svg]:size-4">{a.icon}</span>}
              {a.label}
            </DropdownMenuItem>
          ))}
          {terminal.length > 0 && normal.length > 0 && <DropdownMenuSeparator />}
          {terminal.map((a, i) =>
            a.fire ? (
              // §16 ArcadeButton — не пункт: аркадный шар (hold 3s) в подвале меню
              <div key={i} className="px-3 pt-3 pb-2.5">
                <ArcadeButton
                  size={64}
                  label={a.fireLabel ?? (typeof a.label === "string" ? a.label : "FIRE")}
                  sublabel={a.fireSublabel ?? "HOLD 3 SEC · NO UNDO"}
                  onConfirm={() => a.onSelect?.(row)}
                />
              </div>
            ) : (
              <DropdownMenuItem
                key={i}
                variant="destructive"
                onSelect={() => deferAfterClose(() => a.onSelect?.(row))}
              >
                {a.icon && <span className="[&_svg]:size-4">{a.icon}</span>}
                {a.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // ── mobile: action-sheet из действий строки; fire → второй confirm-шит ──
  const openSheet = (row: Row) => setSheetRow(row)
  const sheetActions: ActionSheetAction[] = React.useMemo(() => {
    if (!sheetRow) return []
    return visibleActions(sheetRow).map((a) => {
      // action-sheet принимает string-label; не-строку не стрингифаим (ReactNode →
      // «[object Object]» хуже пустоты) — dev-warn, чтобы сервис дал строку
      if (import.meta.env.DEV && !a.fire && typeof a.label !== "string") {
        console.warn(
          "EntityTable: label действия должен быть строкой (mobile action-sheet рендерит текст) — передай string, не ReactNode"
        )
      }
      return {
        // fire — вход в аркаду: подпись = fireLabel (реф «FIRE_EMPLOYEE.EXE», red),
        // тап → второй confirm-шит с шаром (hold 3s), НЕ обычная кнопка
        label: a.fire
          ? a.fireLabel ?? (typeof a.label === "string" ? a.label : "FIRE")
          : typeof a.label === "string"
            ? a.label
            : "",
        icon: a.icon,
        destructive: a.destructive || a.fire,
        // ActionSheet закрывает шит (vaul) и в тот же тик зовёт onSelect — открытие
        // формы/fire-шита гонится с exit-анимацией vaul (та же ловушка, что у
        // dropdown→dialog); дефер на след. тик
        onSelect: () =>
          deferAfterClose(() =>
            a.fire ? setFireRow({ row: sheetRow, action: a }) : a.onSelect?.(sheetRow)
          ),
      }
    })
  }, [sheetRow, visibleActions])

  // ── тулбар (композиция §51/§49) ──
  let toolbarEl: React.ReactNode = null
  if (toolbar) {
    const searchEl = search && (
      <SearchInput
        value={search.value}
        onChange={search.onChange}
        placeholder={search.placeholder}
        className={isMobile ? "w-full" : "w-[220px]"}
        data-testid={testid ? `${testid}-search` : undefined}
      />
    )
    toolbarEl = isMobile ? (
      <>
        {searchEl}
        {(filters || addFilter) && (
          <ChipRow mobile aria-label="Фильтры">
            {filters}
            {addFilter}
          </ChipRow>
        )}
      </>
    ) : (
      <div className="flex items-center gap-2">
        {searchEl}
        {filters}
        {addFilter}
        {cta && <div className="ml-auto">{cta}</div>}
      </div>
    )
  }

  // ── desktop таблица ──
  const desktopTable = (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* mono-шапка INK */}
      <div
        style={gridStyle}
        className="grid gap-x-3 bg-primary px-4 py-[9px] font-mono text-[10px] tracking-[0.06em] text-primary-foreground"
      >
        <span>{identityLabel}</span>
        {columns.map((c) => (
          <span key={c.key} className={cn((c.align ?? "left") === "right" && "text-right", c.headerClassName)}>
            {c.label}
          </span>
        ))}
        {showActionsCol && <span />}
      </div>
      {rows.length === 0
        ? emptyState
        : rows.map((row) => {
            const id = identity(row)
            const state = stateOf(row)
            const list = visibleActions(row)
            return (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={gridStyle}
                className={cn(
                  "grid items-center gap-x-3 border-b border-[#EDEDE8] px-4 py-[9px] last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-[#FFFDF0]",
                  state === "invited" && "bg-[#FFFDF0]",
                  state === "disabled" && "opacity-75"
                )}
              >
                {/* идентичность */}
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar id={id} state={state} />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-[13.5px] font-semibold",
                        state === "disabled" && "text-[#A1A1AA] line-through",
                        state === "invited" && "text-[#A1A1AA]"
                      )}
                    >
                      {id.name}
                    </span>
                    {id.sub !== undefined && (
                      <span className="block truncate font-mono text-[10px] text-[#A1A1AA]">
                        {id.sub}
                      </span>
                    )}
                  </span>
                </span>
                {/* атрибуты */}
                {columns.map((c) => (
                  <span
                    key={c.key}
                    className={cn("min-w-0", (c.align ?? "left") === "right" && "text-right")}
                  >
                    {c.render(row)}
                  </span>
                ))}
                {/* действия */}
                {showActionsCol && (
                  <span className="flex justify-end text-right" onClick={(e) => e.stopPropagation()}>
                    {state === "self" ? (
                      <span className="font-mono text-[9px] leading-tight text-[#D4D4CE]">
                        {selfNote}
                      </span>
                    ) : list.length > 0 ? (
                      <DesktopMenu row={row} />
                    ) : null}
                  </span>
                )}
              </div>
            )
          })}
    </div>
  )

  // ── mobile карточки ──
  const mobileCards = (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {rows.length === 0
        ? emptyState
        : rows.map((row) => (
            <MobileCard
              key={rowKey(row)}
              row={row}
              id={identity(row)}
              state={stateOf(row)}
              columns={columns}
              hasActions={visibleActions(row).length > 0}
              onOpen={() => {
                if (visibleActions(row).length > 0) openSheet(row)
                else onRowClick?.(row)
              }}
            />
          ))}
    </div>
  )

  return (
    <div className={cn("flex min-w-0 flex-col gap-3 max-md:gap-2.5", className)} data-testid={testid}>
      {toolbarEl}
      {isMobile ? mobileCards : desktopTable}

      {/* mobile: action-sheet действий строки */}
      <ActionSheet
        open={sheetRow !== null}
        onOpenChange={(o) => !o && setSheetRow(null)}
        title={sheetRow ? sheetTitle(identity(sheetRow)) : undefined}
        actions={sheetActions}
      />
      {/* mobile: fire — второй confirm-шит с аркадой (hold 3s), НЕ обычная кнопка */}
      <Drawer open={fireRow !== null} onOpenChange={(o) => !o && setFireRow(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-[15px]">
              {fireRow ? sheetTitle(identity(fireRow.row)) : ""} · LAST CHANCE
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex justify-center px-4 pt-1 pb-5">
            {fireRow && (
              <ArcadeButton
                size={64}
                label={
                  fireRow.action.fireLabel ??
                  (typeof fireRow.action.label === "string" ? fireRow.action.label : "FIRE")
                }
                sublabel={fireRow.action.fireSublabel ?? "HOLD 3 SEC · NO UNDO"}
                onConfirm={() => {
                  fireRow.action.onSelect?.(fireRow.row)
                  setFireRow(null)
                }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function sheetTitle(id: EntityIdentity): string {
  return typeof id.name === "string" ? id.name : "Действия"
}

// мобильная карточка-строка (min 56px): аватар + имя + подпись «@tg · статус ·
// дата» + бейдж роли (columns без mobile) + ⋯ (44px). Тап/long-press → action-sheet.
function MobileCard<Row>({
  row,
  id,
  state,
  columns,
  hasActions,
  onOpen,
}: {
  row: Row
  id: EntityIdentity
  state?: EntityRowState
  columns: EntityColumn<Row>[]
  hasActions: boolean
  onOpen: () => void
}) {
  const longPress = useLongPress(onOpen)
  // подпись: identity.sub + columns[mobile==="sub"] компактной формой, через « · »
  const subParts = columns
    .filter((c) => c.mobile === "sub")
    .map((c) => (c.subText ?? c.render)(row))
    .filter((v) => v !== null && v !== undefined && v !== "")
  // бейджи справа — колонки без mobile-режима (роль)
  const badgeCols = columns.filter((c) => c.mobile === undefined)
  return (
    <div
      {...longPress}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-2.5 border-b border-[#EDEDE8] px-3 py-2.5 select-none last:border-b-0",
        state === "invited" && "bg-[#FFFDF0]",
        state === "disabled" && "opacity-75"
      )}
    >
      <Avatar id={id} state={state} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[14px] font-semibold",
            state === "disabled" && "text-[#A1A1AA] line-through",
            state === "invited" && "text-[#A1A1AA]"
          )}
        >
          {id.name}
        </span>
        <span className="block truncate font-mono text-[10px] text-[#A1A1AA]">
          {[id.sub, ...subParts].filter(Boolean).map((p, i, arr) => (
            <React.Fragment key={i}>
              {p}
              {i < arr.length - 1 && " · "}
            </React.Fragment>
          ))}
        </span>
      </span>
      {badgeCols.map((c) => (
        <span key={c.key} className="shrink-0">
          {c.render(row)}
        </span>
      ))}
      {hasActions && (
        <span
          aria-label="Действия"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="-mr-1 -my-1.5 inline-flex size-11 shrink-0 items-center justify-center text-[16px] font-bold text-[#52525B]"
        >
          ⋯
        </span>
      )}
    </div>
  )
}
