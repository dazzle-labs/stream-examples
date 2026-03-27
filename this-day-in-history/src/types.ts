export type WikiThumbnail = {
  source: string,
  width: number,
  height: number,
}

export type WikiPage = {
  title: string,
  displaytitle: string,
  thumbnail?: WikiThumbnail,
  originalimage?: WikiThumbnail,
  extract?: string,
  description?: string,
  content_urls?: {
    desktop: {
      page: string,
    },
  },
}

export type WikiEvent = {
  text: string,
  year: number,
  pages: WikiPage[],
}

export type WikiResponse = {
  selected: WikiEvent[],
  events: WikiEvent[],
  births: WikiEvent[],
  deaths: WikiEvent[],
  holidays: WikiEvent[],
}

export type EventCategory = 'selected' | 'event' | 'birth' | 'death'

export type ScenePhase = 'entering' | 'holding' | 'exiting' | 'transition' | 'era_intro'

export type Era = {
  name: string,
  yearRange: [number, number],
  accent: string,
  sepia: number,
  saturation: number,
  backgroundTint: string,
  titleFont: string,
  bodyFont: string,
  backgroundImage: string,
}

export type HistoryEvent = {
  year: number,
  text: string,
  category: EventCategory,
  image?: string,
  extract?: string,
  wikiUrl?: string,
  era: Era,
}
