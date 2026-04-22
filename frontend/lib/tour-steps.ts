import { LayoutDashboard, Bike, ParkingCircle, Map, BarChart2, Bot, MessageSquare, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const TOUR_KEY = 'tour_seen_v1'

export interface TourStep {
  title: string
  description: string
  icon: LucideIcon
  targetId: string | null
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Vítejte v Keboola Demo App',
    description: 'Tento dashboard zobrazuje reálná data o mobilitě v Praze z platformy Golemio Open Data. Najdete zde statistiky cyklistů, chodců, parkovišť P+R a interaktivní mapu města. Projděte si krátký průvodce — trvá méně než minutu.',
    icon: Sparkles,
    targetId: null,
  },
  {
    title: 'Přehled',
    description: 'Hlavní stránka nabízí klíčové ukazatele: počty cyklistů za 24 hodin a 7 dní, aktuální obsazenost parkovišť a denní trend pohybu. Rozsah grafu lze přepínat mezi 7, 14, 30 a 90 dny.',
    icon: LayoutDashboard,
    targetId: 'tab-overview',
  },
  {
    title: 'Cyklistika & Chodci',
    description: 'Denní a hodinové trendy průjezdů na 40 měřicích stanicích napříč Prahou. Záložka Chodci zobrazuje data ze 6 sdílených tras — včetně srovnání pohybu cyklistů a pěších.',
    icon: Bike,
    targetId: 'tab-cycling',
  },
  {
    title: 'Parkování',
    description: 'Aktuální obsazenost 17 pražských parkovišť P+R provozovaných TSK. Přepínejte mezi pohledem na procento obsazenosti a absolutní kapacitu. Čas poslední aktualizace dat je vždy uveden v záhlaví stránky.',
    icon: ParkingCircle,
    targetId: 'tab-parking',
  },
  {
    title: 'Mapa města',
    description: 'Interaktivní mapa zobrazuje všechny měřicí stanice cyklistů a parkoviště P+R na jednom místě. Kliknutím na marker zobrazíte detailní statistiky dané lokace.',
    icon: Map,
    targetId: 'tab-map',
  },
  {
    title: 'Reporty',
    description: 'Vlastní reporty na míru — vyberte zdroj dat, měřítko, typ grafu a časové období. Výsledek lze exportovat jako PNG nebo CSV a sdílet pomocí URL odkazu.',
    icon: BarChart2,
    targetId: 'tab-custom',
  },
  {
    title: 'KAI asistent',
    description: 'Máte otázku k datům? Zeptejte se KAI — umělé inteligence Keboola zaměřené na data Prahy. Například: „Kolik cyklistů projelo tento týden?" nebo „Která parkoviště P+R mají nyní volná místa?"',
    icon: Bot,
    targetId: 'kai-button',
  },
  {
    title: 'Zpětná vazba',
    description: 'Máte nápad na vylepšení nebo připomínku k datům? Klikněte na ikonu zprávy v záhlaví aplikace a napište nám. Rádi se dozvíme, co by mohlo být lepší.',
    icon: MessageSquare,
    targetId: 'feedback-button',
  },
]
