import { COLOR_VARS } from './colors'

interface BadgeColorEntry {
  label: string
  cssVar: string
}

/** Map of badge color key to display label and CSS variable */
export const BADGE_COLORS: Record<string, BadgeColorEntry> = {
  grey: { label: 'Grey', cssVar: `var(${COLOR_VARS.badgeGrey})` },
  blue: { label: 'Blue', cssVar: `var(${COLOR_VARS.badgeBlue})` },
  green: { label: 'Green', cssVar: `var(${COLOR_VARS.badgeGreen})` },
  red: { label: 'Red', cssVar: `var(${COLOR_VARS.badgeRed})` },
  orange: { label: 'Orange', cssVar: `var(${COLOR_VARS.badgeOrange})` },
  purple: { label: 'Purple', cssVar: `var(${COLOR_VARS.badgePurple})` },
  teal: { label: 'Teal', cssVar: `var(${COLOR_VARS.badgeTeal})` },
  pink: { label: 'Pink', cssVar: `var(${COLOR_VARS.badgePink})` },
  yellow: { label: 'Yellow', cssVar: `var(${COLOR_VARS.badgeYellow})` },
  indigo: { label: 'Indigo', cssVar: `var(${COLOR_VARS.badgeIndigo})` },
}

/** All available badge color keys for iteration */
export const BADGE_COLOR_KEYS = Object.keys(BADGE_COLORS)
