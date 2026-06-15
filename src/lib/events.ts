import type { SwimEvent } from "@/types/swim";

export const supportedEvents = [
  "50 Freestyle",
  "100 Freestyle",
  "200 Freestyle",
  "400 Freestyle",
  "800 Freestyle",
  "1500 Freestyle",
  "50 Butterfly",
  "100 Butterfly",
  "200 Butterfly",
  "50 Backstroke",
  "100 Backstroke",
  "200 Backstroke",
  "50 Breaststroke",
  "100 Breaststroke",
  "200 Breaststroke",
  "100 IM",
  "200 IM",
  "400 IM"
] as const satisfies readonly SwimEvent[];

export const eventAliases: Record<string, SwimEvent> = {
  "50 free": "50 Freestyle",
  "50 freestyle": "50 Freestyle",
  "100 free": "100 Freestyle",
  "100 freestyle": "100 Freestyle",
  "200 free": "200 Freestyle",
  "200 freestyle": "200 Freestyle",
  "400 free": "400 Freestyle",
  "400 freestyle": "400 Freestyle",
  "800 free": "800 Freestyle",
  "800 freestyle": "800 Freestyle",
  "1500 free": "1500 Freestyle",
  "1500 freestyle": "1500 Freestyle",
  "50 fly": "50 Butterfly",
  "50 butterfly": "50 Butterfly",
  "100 fly": "100 Butterfly",
  "100 butterfly": "100 Butterfly",
  "200 fly": "200 Butterfly",
  "200 butterfly": "200 Butterfly",
  "50 back": "50 Backstroke",
  "50 backstroke": "50 Backstroke",
  "100 back": "100 Backstroke",
  "100 backstroke": "100 Backstroke",
  "200 back": "200 Backstroke",
  "200 backstroke": "200 Backstroke",
  "50 breast": "50 Breaststroke",
  "50 breaststroke": "50 Breaststroke",
  "100 breast": "100 Breaststroke",
  "100 breaststroke": "100 Breaststroke",
  "200 breast": "200 Breaststroke",
  "200 breaststroke": "200 Breaststroke",
  "100 im": "100 IM",
  "200 im": "200 IM",
  "400 im": "400 IM"
};

export function normalizeEvent(value: string): SwimEvent | undefined {
  return eventAliases[value.trim().toLowerCase()];
}
