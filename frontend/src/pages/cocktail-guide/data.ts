// Демо-данные справочника коктейлей (Pages 3n–3t) — заглушка под API продукта
// klktv-cocktails. Реальные позиции с айдентикой (лого-вордмарки в public/
// cocktails/) — реф как есть; счётчики разделов (23/56/48/…) — сводки полного
// каталога, в проде приезжают с бэка. learned — локальный стейт (в проде —
// эндпоинт «знаю/не знаю»).

export type TintName =
  | "sour" | "daisy" | "mary" | "negroni" | "martini"
  | "manhattan" | "highball" | "spritz" | "dessert"

/* ---------- разделы (навигация + прогресс) ---------- */

export type SectionId = "menu" | "classics" | "spirits" | "kitchen" | "zero" | "zc"

export interface Section {
  id: SectionId
  label: string
  /** primary — в bottom-nav; иначе только в sheet «Разделы» */
  total: number
  learned: number
}

export const SECTIONS: Section[] = [
  { id: "menu", label: "Авторские", total: 23, learned: 14 },
  { id: "classics", label: "Классика", total: 56, learned: 21 },
  { id: "spirits", label: "Спириты", total: 48, learned: 26 },
  { id: "kitchen", label: "Кухня", total: 31, learned: 18 },
  { id: "zero", label: "Безалко", total: 12, learned: 9 },
  { id: "zc", label: "Zero Culture", total: 16, learned: 12 },
]

export const TOTAL_LEARNED = 100
export const TOTAL_POSITIONS = 186

/* ---------- 3n Меню: авторские коктейли (media-card) ---------- */

export type MenuBadge = "HOT" | "BOTTLED" | "PREMIUM" | "ONESIP"

export interface Cocktail {
  id: string
  name: string
  logo: string
  subtitle: string
  price: number
  volume: number
  abv: number
  spirit: string
  /** крепкие компоненты для strong-чипов детали; дефолт [spirit] */
  spirits?: string[]
  glass: string
  descriptors: string[]
  badge?: MenuBadge
  learned: boolean
  /** деталь (3p) — все секции опциональны, рендерятся если заполнены */
  recipe?: string
  garnish?: string
  pitch?: string
  /** фото напитка 4:3 (url); нет — блок отсутствует, без плейсхолдера */
  photo?: string
  about?: string
  naming?: string
  faq?: string
}

export const MENU: Cocktail[] = [
  { id: "pussy-power", name: "Пусси Пауэр", logo: "/cocktails/pussy-power.webp", subtitle: "Джин-тоник, который передумал", price: 650, volume: 240, abv: 12, spirit: "Джин", glass: "Хайбол", descriptors: ["ДЖИН", "ЦИТРУС", "ИМБИРЬ", "ХВОЯ"], badge: "HOT", learned: false, recipe: "Джин, кордиал юдзу-имбирь, содовая на хвойном сиропе, цедра грейпфрута.", garnish: "Ветка розмарина, цедра", pitch: "Гостю, который «обычно берёт джин-тоник, но хочет что-то поинтереснее». Цитрус читается сразу, хвоя — на выдохе. Не предлагать тем, кто просит сладкое.", faq: "«Это горько?» — нет, горечи нет, есть смола и цитрус. «Можно без алкоголя?» — да, миксуем на Zero-джине, минус 150 ₽." },
  { id: "dieter-smash", name: "Дитер Смеш", logo: "/cocktails/dieter-smash.webp", subtitle: "Смеш на бурбоне с персиком и дымом", price: 590, volume: 220, abv: 14, spirit: "Бурбон", glass: "Рокс", descriptors: ["БУРБОН", "ПЕРСИК", "ДЫМ"], learned: true, recipe: "Бурбон, персиковое пюре, дымный сироп, лимон, битер.", garnish: "Долька персика, веточка мяты", pitch: "Тем, кто любит виски, но хочет летнюю подачу. Дым — фон, не бомба." },
  { id: "pornstar", name: "Порнстар", logo: "/cocktails/pornstar.webp", subtitle: "Маракуйя, ваниль и шот игристого", price: 620, volume: 200, abv: 13, spirit: "Водка", glass: "Купе", descriptors: ["ВОДКА", "МАРАКУЙЯ"], badge: "HOT", learned: false, recipe: "Ванильная водка, пюре маракуйи, ваниль, лайм; отдельно шот просекко.", garnish: "Половинка маракуйи, шот игристого сбоку", pitch: "Хит для компании и «на фото». Кисло-сладкий, шот — ритуал." },
  { id: "candy", name: "Кэнди", logo: "/cocktails/candy.webp", subtitle: "Клубника с ревенём, почти десерт", price: 530, volume: 180, abv: 11, spirit: "Джин", glass: "Купе", descriptors: ["ДЖИН", "КЛУБНИКА"], learned: true, recipe: "Джин, шраб клубника-ревень, лимон, белок.", garnish: "Сушёная клубника", pitch: "Тем, кто «не любит крепкое». Сладкий, ягодный, лёгкий вход." },
  { id: "rocket-boy", name: "Рокет Бой", logo: "/cocktails/rocket-boy.webp", subtitle: "Хайбол с грушей и щепоткой соли", price: 490, volume: 250, abv: 9, spirit: "Водка", glass: "Хайбол", descriptors: ["ВОДКА", "ГРУША"], learned: true, recipe: "Водка, грушевый кордиал, содовая, солевой раствор.", garnish: "Слайс груши", pitch: "Освежающий лоу-абв. Соль вытягивает грушу — просто и умно." },
  { id: "braindead", name: "БрэйнДэд", logo: "/cocktails/braindead.webp", subtitle: "Мескаль, кофе и тёмный шоколад", price: 480, volume: 160, abv: 17, spirit: "Мескаль", glass: "Рокс", descriptors: ["МЕСКАЛЬ", "КОФЕ"], learned: false, recipe: "Мескаль, холодный эспрессо, шоколадный битер, демерара.", garnish: "Кофейное зерно", pitch: "Диджестив для смелых. Дым мескаля + горечь кофе." },
  { id: "jungle-daiquiri", name: "Джангл Дайкири", logo: "/cocktails/jungle-daiquiri.webp", subtitle: "Дайкири из джунглей, ананас и лайм", price: 580, volume: 190, abv: 15, spirit: "Ром", glass: "Купе", descriptors: ["РОМ", "АНАНАС", "ЛАЙМ"], badge: "BOTTLED", learned: false, recipe: "Белый ром, ананасовый кордиал, лайм, капля абсента.", garnish: "Лист ананаса", pitch: "Тропический классик-твист. Батчится в бутылку — быстрая подача." },
  { id: "viking-mule", name: "Викинг Мул", logo: "/cocktails/viking-mule.webp", subtitle: "Аквавит, брусника и имбирное пиво", price: 560, volume: 300, abv: 10, spirit: "Аквавит", glass: "Хайбол", descriptors: ["АКВАВИТ", "БРУСНИКА"], badge: "PREMIUM", learned: false, recipe: "Аквавит, брусничный шраб, лайм, имбирный эль.", garnish: "Брусника, слайс лайма", pitch: "Северный Мул. Тмин аквавита + кислая брусника — необычно, но заходит." },
  // мульти-спиртовой (СОДЖУ+ДЖИН) + учебный контент about/naming, без recipe/
  // pitch/garnish (реф 3p «с фото»): секции детали рендерятся условно
  { id: "gentle-cloud", name: "Gentle Cloud", logo: "/cocktails/gentle-cloud.webp", subtitle: "Нежный монстр рефлексии корейского мейнстрима. Неряшливо вкусный при чистоплотной глянцевости.", price: 540, volume: 180, abv: 12, spirit: "Соджу", spirits: ["Соджу", "Джин"], glass: "Купе", descriptors: ["СОДЖУ", "ДЖИН", "КИСЛО-СЛАДКИЙ", "МАЛИНА", "КЛУБНИКА"], learned: false, about: "Прозрачный гимлет с плотной малиновой пеной. В составе клубничный соджу, джин на кардамоне и базиликовый кордиал. Во вкусе преобладает клубника и малина. Кардамона во вкусе мало, а базиликовый кордиал просто хорошо сочетается с клубникой и даёт достаточно нейтральный вкус. Понятный и одновременно незаурядный коктейль.", naming: "Буквально «нежное облако». Отсылка к корейскому бренду очков Gentle Monster — довольно попсовому корейскому бренду с классным визуалом кампейнов и интерьером магазинов. Ну и соджу — очень попсовый корейский напиток." },
]

export const SPIRIT_FILTERS = ["Все", "Джин", "Водка", "Ром", "Бурбон", "Бренди", "Мескаль"]
export const GLASS_FILTERS = ["Все", "Хайбол", "Купе", "Рокс", "Ник-и-Нора"]

/* ---------- 3o Классика: семейства (taxonomy tints) + позиции ---------- */

export interface Family {
  tint: TintName
  code: string
  title: string
  logic: string
  tip?: string
  evolution?: string
  learned: number
  total: number
}

export const FAMILIES: Family[] = [
  { tint: "negroni", code: "NEGRONI", title: "NEGRONI & FRIENDS", logic: "Равные части крепкого, битера и вермута. Меняешь базу — получаешь новый коктейль: джин → Негрони, виски → Булевардье, игристое → Спритц-ветка.", evolution: "Ветка выросла из Американо (1860-е, аперитив с содовой): граф добавил джин — вышел Негрони (1919), на виски — Булевардье, на игристом — Негрони Спарклинг. Каркас 1:1:1 держится, меняются база и разбавитель.", tip: "Гость просит «что-то горькое, но не пиво» — это сюда.", learned: 5, total: 6 },
  { tint: "sour", code: "SOUR", title: "SOUR & FRIENDS", logic: "Крепкое + кислое + сладкое в балансе. База меняется, каркас держится: виски → Виски Сауэр, писко → Писко Сауэр, ром → Дайкири.", evolution: "Пропорция ~2:1:1 — скелет половины классики. Яичный белок даёт шёлковую пену (Виски Сауэр), ликёр вместо сиропа уводит в ветку Дейзи (Маргарита), игристое сверху — Френч 75.", tip: "«Что-нибудь кисленькое и не крепкое на вид» — сюда.", learned: 6, total: 8 },
  { tint: "martini", code: "MARTINI", title: "MARTINI & FRIENDS", logic: "Крепкое + вермут, стир, подача up. Сухой/грязный/перевёрнутый — вариации пропорции и гарниша.", evolution: "Один стир-каркас, много лиц: сухой (меньше вермута), грязный (рассол оливок), перевёрнутый (вермута больше джина), Гибсон (маринованная луковка вместо оливки), Мартинез (+мараскино) — мост к Манхэттену.", learned: 3, total: 7 },
  { tint: "daisy", code: "DAISY", title: "DAISY & FRIENDS", logic: "Сауэр с ликёром вместо простого сиропа: Маргарита, Сайдкар, Космополитен — один каркас, разный ликёр.", evolution: "Сладость даёт ЛИКЁР, а не сироп: трипл-сек → Маргарита (текила) и Сайдкар (коньяк), +клюква → Космополитен, лимон+джин → Уайт-леди. Меняешь ликёр и базу — новый коктейль, каркас тот же.", learned: 2, total: 5 },
  { tint: "highball", code: "HIGHBALL", title: "HIGHBALL & FRIENDS", logic: "Крепкое + газировка в высоком бокале со льдом. Джин-тоник, Куба Либре, Мул — пропорция и микс газировки.", evolution: "Крепкое : газировка обычно 1:3–1:4. Джин-тоник, Куба Либре (кола+лайм), Мул (имбирный эль в меди), Пресвитериан (эль+сода). Разница — какая газировка и лёд; культ подачи — Япония.", learned: 2, total: 9 },
  { tint: "manhattan", code: "MANHATTAN", title: "MANHATTAN & FRIENDS", logic: "Крепкое + сладкий вермут + битер, стир, up. Виски → Манхэттен, коньяк → Видоу’с Кисс-ветка.", evolution: "Сладкий вермут + битер + стир — постоянные. Виски → Манхэттен, скотч → Роб Рой, +абсент/Пейшо → мост к Сазираку. Сухой вермут вместо сладкого уводит к Мартини.", learned: 1, total: 6 },
  { tint: "mary", code: "MARY", title: "MARY & FRIENDS", logic: "Крепкое + томат/умами + специи. Кровавая Мэри и её пикантная родня.", evolution: "Томат + умами + специи — общий язык, острота регулируется: Кровавая Мэри (водка), Красный Снэппер (джин), Мичелада (пиво+томат), Вирджин Мэри (без алкоголя).", learned: 1, total: 4 },
  { tint: "spritz", code: "SPRITZ", title: "SPRITZ & FRIENDS", logic: "Аперитив + игристое + газировка. Апероль Спритц, Хьюго, Негрони Спарклинг.", evolution: "Пропорция 3:2:1 (игристое:аперитив:сода) на просекко. Апероль (мягкий), Кампари (горше), Селект (венецианский), Хьюго (бузина+мята). Летний лоу-абв аперитив.", learned: 0, total: 5 },
  { tint: "dessert", code: "DESSERT", title: "DESSERT & FRIENDS", logic: "Сладкие финалы: Эспрессо Мартини, Грассхоппер, Уайт Рашн.", evolution: "Диджестив-ветка на сливках и ликёрах: Эспрессо Мартини (кофе), Грассхоппер (мята+какао), Уайт Рашн (кофейный ликёр+сливки), Брэнди Александр. Подаётся вместо десерта.", learned: 1, total: 6 },
]

export interface Classic {
  id: string
  name: string
  year: string
  city: string
  family: TintName
  spirit: string
  glass: string
  descriptors: string[]
  learned: boolean
  /** деталь (3p) */
  recipe: string
  garnish: string
  history: string
  fits: string
  /** «Наш ответ» — кросс-линки: label + опц. id позиции меню (в проде твисты
   *  живут в Меню; в демо-каталоге из 8 позиций их может не быть) */
  ourAnswers?: { label: string; menuId?: string }[]
}

export const CLASSICS: Classic[] = [
  { id: "negroni", name: "Негрони", year: "1919", city: "Флоренция", family: "negroni", spirit: "Джин", glass: "Рокс", descriptors: ["горький", "крепкий", "аперитив"], learned: true, recipe: "Джин 30 · кампари 30 · красный вермут 30. Стир со льдом, рокс, крупный куб.", garnish: "Слайс апельсина", history: "Граф Негрони попросил усилить Американо джином вместо содовой. Бар «Казони», Флоренция.", fits: "Любителям горечи и «взрослых» вкусов; тем, кто пьёт медленно.", ourAnswers: [{ label: "Мезкаль Негрони", menuId: "braindead" }, { label: "Андрессд Негрони" }] },
  { id: "boulevardier", name: "Булевардье", year: "1927", city: "Париж", family: "negroni", spirit: "Виски", glass: "Рокс", descriptors: ["согревающий", "горький"], learned: false, recipe: "Бурбон 30 · кампари 30 · красный вермут 30. Стир, рокс.", garnish: "Слайс апельсина", history: "Негрони на виски из парижского бар-круга американских эмигрантов 1920-х.", fits: "Тем, кто любит Негрони, но хочет теплее и мягче." },
  { id: "americano", name: "Американо", year: "1860-е", city: "Милан", family: "negroni", spirit: "Аперитив", glass: "Хайбол", descriptors: ["лёгкий", "горький"], learned: true, recipe: "Кампари 30 · красный вермут 30 · содовая. Хайбол, лёд.", garnish: "Слайс апельсина", history: "Прародитель Негрони: горький аперитив с содовой из миланских кафе.", fits: "Дневной аперитив, лоу-абв, «горько, но легко»." },
  { id: "daiquiri", name: "Дайкири", year: "1900", city: "Гавана", family: "sour", spirit: "Ром", glass: "Купе", descriptors: ["кислый", "чистый"], learned: true, recipe: "Белый ром 60 · лайм 25 · сахарный сироп 15. Шейк, дабл-стрейн, up.", garnish: "—", history: "Из кубинской деревни Дайкири; каркас сауэра на роме.", fits: "Проверка бармена. Чистый баланс кислого и сладкого." },
  { id: "whiskey-sour", name: "Виски Сауэр", year: "1870-е", city: "США", family: "sour", spirit: "Виски", glass: "Рокс", descriptors: ["кислый", "шелковистый"], learned: false, recipe: "Бурбон 50 · лимон 25 · сироп 20 · белок. Драй-шейк, рокс.", garnish: "Вишня, слайс апельсина", history: "Классический американский сауэр XIX века.", fits: "Любителям виски и кисло-сладкого; мягкий вход." },
  { id: "martinez", name: "Мартинез", year: "1880-е", city: "Сан-Франциско", family: "martini", spirit: "Джин", glass: "Ник-и-Нора", descriptors: ["стир", "ароматный"], learned: false, recipe: "Джин 45 · сладкий вермут 30 · мараскино 5 · битер. Стир, up.", garnish: "Цедра лимона", history: "Мост между Манхэттеном и Мартини; предок сухого Мартини.", fits: "Тем, кто хочет Мартини «поинтереснее» и слаще." },
  { id: "manhattan", name: "Манхэттен", year: "1870-е", city: "Нью-Йорк", family: "manhattan", spirit: "Виски", glass: "Ник-и-Нора", descriptors: ["стир", "крепкий"], learned: true, recipe: "Ржаной виски 50 · сладкий вермут 20 · битер. Стир, up.", garnish: "Вишня", history: "Легенда о клубе «Манхэттен»; эталон стир-коктейля на виски.", fits: "Классика для ценителей крепкого и вермута." },
  { id: "margarita", name: "Маргарита", year: "1938", city: "Мексика", family: "daisy", spirit: "Текила", glass: "Купе", descriptors: ["кислый", "солёный"], learned: false, recipe: "Текила 50 · кюрасао 20 · лайм 20. Шейк, соляная кромка.", garnish: "Соль, слайс лайма", history: "Дейзи на текиле; кто именно придумал — спорят до сих пор.", fits: "Летний хит, кисло-солёный баланс." },
  { id: "highball", name: "Хайбол", year: "1890-е", city: "Лондон", family: "highball", spirit: "Виски", glass: "Хайбол", descriptors: ["освежающий", "простой"], learned: false, recipe: "Виски 45 · содовая. Много льда, длинный бокал.", garnish: "Цедра лимона", history: "Каркас всех газированных лонгов; культ подачи в Японии.", fits: "Тем, кто хочет «просто и освежающе»." },
]

export const CLASSIC_SPIRITS = ["Все", "Джин", "Водка", "Ром", "Виски", "Бренди", "Текила", "Мескаль", "Аперитив"]

/* ---------- 3r Спириты: группы по категориям + «Выведенные» ---------- */

export interface Spirit {
  name: string
  /** строка-подпись в списке: «ЛОНДОН ДРАЙ · 43.1%» */
  meta: string
  learned: boolean
  /** ABV для шапки детали «КАТЕГОРИЯ · СТРАНА · NN% ABV» */
  abv: number
  /** деталь (канон флеш-карточек R25) — все секции опциональны */
  country?: string
  /** регион (desktop-шапка «СТРАНА, РЕГИОН»); mobile — только country */
  region?: string
  flavour?: string
  brand?: string
  /** ПОДРОБНО ПРО БРЕНД (длинный) */
  brandDetail?: string
  /** ОСОБЕННОСТИ (desktop) */
  features?: string
  /** В КОКТЕЙЛЯХ */
  pairings?: string
  /** ФАКТ — butter-плашка в языке TIP */
  fact?: string
  /** ИСТОЧНИК — mono-ссылка ↗ (без протокола) */
  sourceUrl?: string
  /** фото бутылки (fit contain); нет — блока нет (R25) */
  img?: string
}

export interface SpiritGroup {
  category: string
  total: number
  items: Spirit[]
}

export const SPIRIT_GROUPS: SpiritGroup[] = [
  { category: "ДЖИН", total: 6, items: [
    { name: "Танкерей", meta: "ЛОНДОН ДРАЙ · 43.1%", learned: true, abv: 43.1, country: "Англия", region: "Файф", brand: "Diageo", flavour: "Сухой лондонский стиль: смелый можжевельник, цитрус, перечный финиш. Эталон для тоника и мартини.", pairings: "База классического джин-тоника и сухого мартини; держит цитрус и тоник, не теряясь." },
    { name: "Хендрикс", meta: "ОГУРЕЦ · РОЗА · 41.4%", learned: true, abv: 41.4, country: "Шотландия", region: "Гирван", brand: "William Grant & Sons", sourceUrl: "hendricksgin.com", flavour: "Огурец и лепестки розы поверх классического джина; мягкий, парфюмный, почти без можжевеловой горечи.", brandDetail: "Запущен в 1999-м как «джин для людей, которые не любят джин». Гонят на двух исторических кубах — Bennett 1860-х и редком Carter-Head; дистилляты смешивают и уже после добавляют инфузию огурца и розы.", features: "Малые партии по 500 литров; инфузия после дистилляции, а не в кубе — поэтому вкус «свежий», не варёный.", pairings: "Джин-тоник с ломтиком огурца вместо цитруса — фирменная подача. У нас — база Пусси Пауэр.", fact: "На бутылку уходит меньше капли розовой эссенции — иначе джин превращается в парфюм." },
    { name: "Монки 47", meta: "ШВАРЦВАЛЬД · 47 БОТАНИКАЛОВ · 47%", learned: false, abv: 47, country: "Германия", region: "Шварцвальд", brand: "Black Forest Distillers", flavour: "47 ботаникалов, среди них брусника из Шварцвальда; сложный, землистый, с ягодной кислинкой.", features: "Мацерация три месяца, вода из скважины Шварцвальда — отсюда плотность и глубина." },
    { name: "Ботанист", meta: "АЙЛА · 22 БОТАНИКА · 46%", learned: false, abv: 46, country: "Шотландия", region: "Айла", brand: "Bruichladdich", flavour: "22 дикорастущих ботаникала с острова Айла поверх 9 классических; травяной, морской, зелёный." },
    { name: "Рокку", meta: "ЯПОНИЯ · САКУРА · 43%", learned: true, abv: 43, country: "Япония", brand: "Suntory", flavour: "Шесть японских ботаникалов — сакура, сенча, сансё-перец; цветочный, чайный, с лёгкой остринкой." },
    { name: "Плимут", meta: "АНГЛИЯ · МЯГКИЙ · 41.2%", learned: false, abv: 41.2, country: "Англия", region: "Плимут", brand: "Plymouth Gin", flavour: "Мягкий, чуть сладковатый, землистый; менее резкий, чем лондон драй. Классика для Мартинеза." },
  ] },
  { category: "ВИСКИ", total: 8, items: [
    { name: "Джемесон", meta: "ИРЛАНДИЯ · БЛЕНД · 40%", learned: true, abv: 40, country: "Ирландия", flavour: "Тройная дистилляция, мягкий и питкий; ваниль, зелёное яблоко. Рабочий конь хайболов." },
    { name: "Мейкерс Марк", meta: "КЕНТУККИ · БУРБОН · 45%", learned: false, abv: 45, country: "США", region: "Кентукки", flavour: "Пшеничный бурбон, мягкий; карамель, ваниль, без резкой ржаной остроты." },
    { name: "Лафройг 10", meta: "АЙЛА · ТОРФ · 40%", learned: false, abv: 40, country: "Шотландия", region: "Айла", flavour: "Мощный торф, йод, морская соль, дым костра. Не для новичков — гость должен знать, на что идёт." },
    { name: "Балвени 12", meta: "СПЕЙСАЙД · DOUBLEWOOD · 40%", learned: true, abv: 40, country: "Шотландия", region: "Спейсайд", flavour: "Дабл-вуд: мёд, ваниль и сушёные фрукты от хересной бочки; округлый, десертный." },
    { name: "Булайт Рай", meta: "КЕНТУККИ · РОЖЬ · 45%", learned: true, abv: 45, country: "США", region: "Кентукки", flavour: "Высокая рожь; перец, специи, сухой пряный финиш. Отлично в Манхэттене и Сазираке." },
    { name: "Ямазаки 12", meta: "ЯПОНИЯ · СИНГЛ МОЛТ · 43%", learned: false, abv: 43, country: "Япония", flavour: "Мёд, персик, лёгкий мидзунара-дуб; элегантный, тихий японский сингл-молт." },
    { name: "Монки Шолдер", meta: "ШОТЛАНДИЯ · БЛЕНД МОЛТ · 40%", learned: false, abv: 40, country: "Шотландия", flavour: "Купаж молтов Спейсайда; ваниль, специи, мягкий. Барменский виски для коктейлей." },
    { name: "Вудфорд Резерв", meta: "КЕНТУККИ · БУРБОН · 43.2%", learned: false, abv: 43.2, country: "США", region: "Кентукки", flavour: "Сбалансированный бурбон: сухофрукты, дуб, специи; чистый профиль для Old Fashioned." },
  ] },
  { category: "АГАВА", total: 5, items: [
    { name: "Оликана Бланко", meta: "ХАЛИСКО · 100% АГАВА · 40%", learned: true, abv: 40, country: "Мексика", region: "Халиско", flavour: "Чистая агава, цитрус, белый перец; свежий бланко — рабочая база маргарит." },
    { name: "Дель Магей Вида", meta: "ОАХАКА · МЕСКАЛЬ · 42%", learned: false, abv: 42, country: "Мексика", region: "Оахака", flavour: "Мескаль: дым, зелёная агава, минеральность. Костровой характер для твистов." },
    { name: "Патрон Репосадо", meta: "ХАЛИСКО · РЕПОСАДО · 40%", learned: true, abv: 40, country: "Мексика", region: "Халиско", flavour: "Отдых в дубе: ваниль, карамель поверх агавы; мягче бланко, тёплый." },
    { name: "Каса Драгонес", meta: "ХАЛИСКО · БЛАНКО · 40%", learned: false, abv: 40, country: "Мексика", region: "Халиско", flavour: "Джовен, гладкий; тонкая агава и ваниль — для сиппинга, а не шотов." },
    { name: "Монтелобос", meta: "ОАХАКА · МЕСКАЛЬ · 43.2%", learned: false, abv: 43.2, country: "Мексика", region: "Оахака", flavour: "Органический эспадин; яркий дым, травы, перец. Насыщенный для мескаль-Негрони." },
  ] },
  { category: "РОМ", total: 5, items: [
    { name: "Дипломатико", meta: "ВЕНЕСУЭЛА · ВЫДЕРЖ. · 40%", learned: true, abv: 40, country: "Венесуэла", flavour: "Выдержанный, сладковатый; изюм, шоколад, ваниль. Сиппинг-ром для диджестива." },
    { name: "Аппелтон 12", meta: "ЯМАЙКА · ВЫДЕРЖ. · 43%", learned: false, abv: 43, country: "Ямайка", flavour: "Ямайский фанк: банан, специи, дуб; яркий и сложный. Держит характер в майтае." },
    { name: "Бакарди Карта Бланка", meta: "КУБА-СТИЛЬ · БЕЛЫЙ · 40%", learned: true, abv: 40, country: "Куба-стиль", flavour: "Лёгкий белый ром; чистый, сухой. База дайкири и мохито." },
    { name: "Плантейшн ОФТД", meta: "БЛЕНД · ОВЕРПРУФ · 69%", learned: false, abv: 69, country: "Бленд", flavour: "Оверпруф: мощная патока, специи; для тики, флоатов и поджига. Осторожно с дозой." },
    { name: "Гослингс Блэк Сил", meta: "БЕРМУДЫ · ТЁМНЫЙ · 40%", learned: false, abv: 40, country: "Бермуды", flavour: "Тёмный, патока, жжёная карамель; сердце «Дарк-н-Стормми»." },
  ] },
]

export const RETIRED_COUNT = 9
// Ликёры из реф-чипов опущены — в демо-каталоге нет группы (вольность; в проде
// приезжают с бэка). Категории = группы, для которых есть данные.
export const SPIRIT_CATEGORIES = ["Все", "Джин", "Виски", "Агава", "Ром"]

/* ---------- 3t Кухня: блюда курсами (фото = айдентика §45) ---------- */

export interface DishNutrition {
  kcal: number
  protein: number
  fat: number
  carb: number
}

export interface Dish {
  id: string
  name: string
  /** курс (код категории «ОСНОВНЫЕ») */
  category: string
  subtitle: string
  price: number
  weight: number
  timing: number
  learned: boolean
  /** фото блюда 4:3; в детали нет — блока нет (R25); в списке — тамб-плейсхолдер */
  photo?: string
  description?: string
  serving?: string
  /** ФАКТ — butter-плашка */
  fact?: string
  /** АЛЛЕРГЕНЫ / СТОП — частый вопрос гостя; нет данных — не рендерится */
  allergens?: string
  /** КБЖУ мини-гридом §40 (структурой, не текстом) */
  nutrition?: DishNutrition
}

export interface KitchenCategory {
  code: string
  total: number
}

// курсы + счётчики полного каталога (сортировка = порядок массива = sort_order)
export const KITCHEN_CATEGORIES: KitchenCategory[] = [
  { code: "ОСНОВНЫЕ", total: 4 },
  { code: "ЗАКУСКИ", total: 5 },
]

export const DISHES: Dish[] = [
  { id: "tako", name: "Тако с треской", category: "ОСНОВНЫЕ", subtitle: "Хрустящая треска, кимчи-майо, маринованный лук", price: 595, weight: 210, timing: 12, learned: true,
    description: "Треска в темпуре, кукурузная тортилья, кимчи-майо, маринованный красный лук, кинза, лайм.",
    serving: "Две штуки на деревянной доске, лайм отдельно. Едят руками — салфетки сразу.",
    fact: "Кимчи-майо ферментируем сами трое суток — поэтому вкус глубже магазинного.",
    allergens: "Рыба, глютен, яйцо (майо). Без кинзы — можно, предупредить кухню.",
    nutrition: { kcal: 420, protein: 24, fat: 18, carb: 38 } },
  { id: "tomyam", name: "Том Ям", category: "ОСНОВНЫЕ", subtitle: "На кокосовом молоке, с креветками", price: 620, weight: 380, timing: 15, learned: false,
    description: "Кокосовое молоко, паста том-ям, лемонграсс, галангал, каффир-лайм, креветки, шампиньоны, томаты черри.",
    serving: "В горячей пиале, рис басмати отдельно. Предупредить: острый, но регулируем.",
    fact: "Пасту жарим до появления масла — так суп получается ароматным, а не «водянистым».",
    allergens: "Ракообразные, рыбный соус. Веган-версия — на тофу, без пасты (готовим отдельно).",
    nutrition: { kcal: 380, protein: 26, fat: 22, carb: 19 } },
  { id: "caesar", name: "Цезарь", category: "ОСНОВНЫЕ", subtitle: "С цыплёнком на гриле, домашний соус", price: 560, weight: 290, timing: 10, learned: true,
    description: "Романо, цыплёнок гриль, черри, пармезан, крутоны, соус на анчоусах и желтке.",
    serving: "В глубокой тарелке, пармезан слайсами сверху. Соус мешаем при подаче.",
    fact: "Соус бьём на анчоусах — без них это «просто салат с курицей», гостю можно так и сказать.",
    allergens: "Рыба (анчоус), яйцо, глютен, молочное. Без крутонов — глютен-фри.",
    nutrition: { kcal: 460, protein: 32, fat: 28, carb: 14 } },
  { id: "ramen", name: "Рамен Тонкоцу", category: "ОСНОВНЫЕ", subtitle: "Наваристый свиной бульон, чашу, яйцо аджитама", price: 640, weight: 450, timing: 14, learned: false,
    description: "Свиной бульон тонкоцу 12 часов, лапша, чашу, яйцо аджитама, нори, зелёный лук, кукуруза.",
    serving: "В большой пиале, ложка и палочки. Бульон пьют прямо из пиалы — это норма.",
    fact: "Бульон варим 12 часов на сильном огне — эмульсия жира даёт молочный цвет и плотность.",
    allergens: "Глютен, свинина, яйцо, соя. Без свинины версии нет — предупредить сразу.",
    nutrition: { kcal: 620, protein: 34, fat: 30, carb: 52 } },
  { id: "gyoza", name: "Гёдза [5 шт]", category: "ЗАКУСКИ", subtitle: "Свинина-креветка, понзу с чили-маслом", price: 430, weight: 180, timing: 8, learned: true,
    description: "Свинина, креветка, капуста, имбирь; жарим на пару и до корочки. Понзу с чили-маслом.",
    serving: "Пять штук корочкой вверх, соус отдельно. Едят палочками, обмакивая.",
    fact: "Дно доводим до кружевной корочки на крахмальной воде — «крылышки» гёдза.",
    allergens: "Свинина, ракообразные, глютен, соя.",
    nutrition: { kcal: 310, protein: 16, fat: 14, carb: 30 } },
  { id: "nachos", name: "Начос", category: "ЗАКУСКИ", subtitle: "Чеддер, гуакамоле, пико-де-гальо", price: 385, weight: 320, timing: 7, learned: false,
    description: "Кукурузные чипсы, расплавленный чеддер, гуакамоле, пико-де-гальо, халапеньо, сметана.",
    serving: "На большой тарелке в центр стола — закуска на компанию. Соусы по краям.",
    fact: "Сыр плавим под саламандрой прямо на чипсах — не поливаем сверху, иначе размокает.",
    allergens: "Молочное. Веган — без сыра и сметаны, гуакамоле остаётся.",
    nutrition: { kcal: 540, protein: 14, fat: 32, carb: 48 } },
  { id: "edamame", name: "Эдамаме", category: "ЗАКУСКИ", subtitle: "С копчёной солью и юдзу-кошо", price: 210, weight: 150, timing: 4, learned: false,
    description: "Соевые бобы на пару, копчёная соль, юдзу-кошо для обмакивания.",
    serving: "В пиале, пустая миска для стручков. Едят руками, выдавливая бобы.",
    fact: "Солим копчёной солью после пара — обычная соль не липнет к влажному стручку.",
    allergens: "Соя.",
    nutrition: { kcal: 180, protein: 14, fat: 6, carb: 16 } },
  { id: "springrolls", name: "Спринг-роллы", category: "ЗАКУСКИ", subtitle: "Овощные, с соусом хойсин-арахис", price: 340, weight: 160, timing: 6, learned: false,
    description: "Рисовая бумага, морковь, огурец, манго, мята, кинза; соус хойсин-арахис.",
    serving: "Четыре половинки срезом вверх, соус в центре. Холодная закуска.",
    fact: "Крутим прохладными — тёплая рисовая бумага рвётся и слипается.",
    allergens: "Арахис, соя, кунжут. Без арахиса — соус меняем на сладкий чили.",
    nutrition: { kcal: 240, protein: 6, fat: 8, carb: 38 } },
  { id: "kimchi", name: "Кимчи", category: "ЗАКУСКИ", subtitle: "Ферментированное, остро-кислое", price: 190, weight: 120, timing: 3, learned: false,
    description: "Пекинская капуста, кочхуджан, дайкон, зелёный лук, чеснок, имбирь; ферментация 5 дней.",
    serving: "В маленькой пиале как банчан или к рамену. Остро — предупредить.",
    fact: "Ферментируем пять дней при комнатной, потом в холод — так кислота живая, не уксусная.",
    allergens: "Рыбный соус (анчоус), креветочная паста. Веган-версия — отдельная партия.",
    nutrition: { kcal: 45, protein: 3, fat: 1, carb: 8 } },
]

// прогресс кухни — сводка каталога (18/31), как в SECTIONS
export const KITCHEN_LEARNED = 18

/* ---------- 3s Прогресс команды (ADMIN) ---------- */

export interface Staff {
  initials: string
  name: string
  role: string
  overall: number
  sections: { menu: number; classics: number; spirits: number; kitchen: number; zero: number; zc: number }
  /** короткая — desktop-колонка АКТИВНОСТЬ */
  activity: string
  /** полная строка с родом — mobile-карточка («БЫЛ СЕГОДНЯ» / «БЫЛА ВЧЕРА») */
  lastSeen: string
  activityAlarm?: boolean
  /** слабейший раздел (mobile-карточка) */
  weak?: string
  strongNote?: string
  admin?: boolean
}

export const TEAM: Staff[] = [
  { initials: "ДК", name: "Дэн", role: "СТАЖЁР · С 07-01", overall: 12, sections: { menu: 26, classics: 4, spirits: 10, kitchen: 16, zero: 17, zc: 6 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛ СЕГОДНЯ", weak: "КЛАССИКА 4%" },
  { initials: "СВ", name: "Стас", role: "БАР", overall: 28, sections: { menu: 43, classics: 30, spirits: 15, kitchen: 26, zero: 33, zc: 25 }, activity: "12 ДН", lastSeen: "БЫЛ 12 ДН НАЗАД", activityAlarm: true, weak: "СПИРИТЫ 15%" },
  { initials: "РГ", name: "Рита", role: "EDITOR · БАР", overall: 45, sections: { menu: 61, classics: 38, spirits: 52, kitchen: 22, zero: 58, zc: 44 }, activity: "ВЧЕРА", lastSeen: "БЫЛА ВЧЕРА", weak: "КУХНЯ 22%" },
  { initials: "МШ", name: "Марк", role: "БАР", overall: 58, sections: { menu: 78, classics: 45, spirits: 67, kitchen: 48, zero: 66, zc: 56 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛ СЕГОДНЯ", weak: "КЛАССИКА 45%" },
  { initials: "КР", name: "Кира", role: "БАР", overall: 64, sections: { menu: 100, classics: 51, spirits: 70, kitchen: 55, zero: 75, zc: 63 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛА СЕГОДНЯ", weak: "КЛАССИКА 51%" },
  { initials: "ОЛ", name: "Оля", role: "БАР · СТАРШАЯ", overall: 71, sections: { menu: 100, classics: 62, spirits: 74, kitchen: 68, zero: 83, zc: 50 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛА СЕГОДНЯ", weak: "ZC 50%" },
  { initials: "МК", name: "Майкл", role: "ADMIN", overall: 92, sections: { menu: 100, classics: 88, spirits: 95, kitchen: 72, zero: 100, zc: 100 }, activity: "СЕГОДНЯ", lastSeen: "БЫЛ СЕГОДНЯ", strongNote: "ВСЁ ≥80% КРОМЕ КУХНИ", admin: true },
]

// R27.1: имена — МАССИВЫ (подстроки стат капятся до 2+«+N» для масштаба на 12
// человек; форматирование — capNames() в team-view). activeNote — всегда один
// худший (двух имён не бывает).
export const TEAM_STATS = {
  avg: 53,
  avgDeltaPp: 6,
  fullMenu: 3,
  fullMenuNames: ["ОЛЯ", "КИРА", "МАЙКЛ"],
  behind: 2,
  behindNames: ["СТАС", "ДЭН"],
  active: 6,
  activeNote: "СТАС — 12 ДН НАЗАД",
  staffCount: 7,
}

/** TEAM AVG по разделам (butter-подвал таблицы) */
export const TEAM_AVG_SECTIONS = { menu: 73, classics: 45, spirits: 55, kitchen: 44, zero: 62, zc: 49 }

/* ---------- прогресс по семействам (панель 3q) ---------- */

export const CLASSICS_TOTAL = 56

/* ---------- LIVE-прогресс (R27): «static − staticLearned(scope) + live(scope)»
 *  — сводка каталога примиряется с тоглами демо-позиций. При initialLearned()
 *  live == static → числа = каталогу до рубля; тогл двигает всё разом. ---------- */

/** реконсиляция: catalog − статик-learned + live-learned по ключам scope */
function reconcile(catalog: number, items: { learned: boolean; key: string }[], learnedIds: Set<string>) {
  return catalog - items.filter((i) => i.learned).length + items.filter((i) => learnedIds.has(i.key)).length
}

/** live learned классики целиком (= стрипу раздела) */
export function classicsLearnedLive(learnedIds: Set<string>) {
  const sec = SECTIONS.find((s) => s.id === "classics")!
  return reconcile(sec.learned, CLASSICS.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
}

/** live learned внутри семейства (для баров панели и счёта «5/6 ✓» шапки группы) */
export function familyLearnedLive(tint: TintName, learnedIds: Set<string>) {
  const fam = FAMILIES.find((f) => f.tint === tint)!
  const inFam = CLASSICS.filter((c) => c.family === tint)
  return reconcile(fam.learned, inFam.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
}

/** live learned раздела (карточки страницы Прогресс); zero/zc — нет демо-позиций */
export function sectionLearnedLive(id: SectionId, learnedIds: Set<string>) {
  const sec = SECTIONS.find((s) => s.id === id)!
  switch (id) {
    case "menu":
      return reconcile(sec.learned, MENU.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
    case "classics":
      return reconcile(sec.learned, CLASSICS.map((c) => ({ learned: c.learned, key: c.id })), learnedIds)
    case "spirits":
      return reconcile(sec.learned, SPIRIT_GROUPS.flatMap((g) => g.items.map((s) => ({ learned: s.learned, key: `${g.category}:${s.name}` }))), learnedIds)
    case "kitchen":
      return reconcile(sec.learned, DISHES.map((d) => ({ learned: d.learned, key: d.id })), learnedIds)
    default:
      return sec.learned
  }
}

/** live итог по всем разделам (ProgressTotal) */
export function totalLearnedLive(learnedIds: Set<string>) {
  return SECTIONS.reduce((a, s) => a + sectionLearnedLive(s.id, learnedIds), 0)
}
