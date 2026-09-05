/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * LobeHub Icon Loader
 * Dynamically load and render icons from @lobehub/icons
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 */
import * as LobeIcons from '@lobehub/icons'

/**
 * Custom brand icons not covered by @lobehub/icons.
 *
 * Each entry mirrors a LobeHub brand namespace with at least:
 *  - `Avatar`: platform-style icon used by model lists (rendered via
 *    `<Brand>.Avatar.type={'platform'}`)
 *  - `Color`: colored circular mark used by provider badges
 *
 * iconKey in the database can then reference it like `DotsStudio`,
 * `DotsStudio.Color` or `DotsStudio.Avatar...`.
 */
const DOTS_RED = '#FF2442'
const DOTS_RED_DARK = '#D61A3C'

function DotsStudioMark({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='DotsStudio'>
      <circle cx='12' cy='12' r='12' fill={DOTS_RED} />
      <circle cx='7' cy='12' r='2.1' fill='#FFFFFF' />
      <circle cx='12' cy='12' r='2.1' fill='#FFFFFF' />
      <circle cx='17' cy='12' r='2.1' fill='#FFFFFF' />
    </svg>
  )
}

function DotsStudioAvatar({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='DotsStudio'>
      <defs>
        <linearGradient id='dots-studio-bg' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor={DOTS_RED} />
          <stop offset='100%' stopColor={DOTS_RED_DARK} />
        </linearGradient>
      </defs>
      <rect width='24' height='24' rx='7' fill='url(#dots-studio-bg)' />
      <circle cx='6.8' cy='12' r='2' fill='#FFFFFF' />
      <circle cx='12' cy='12' r='2' fill='#FFFFFF' />
      <circle cx='17.2' cy='12' r='2' fill='#FFFFFF' />
    </svg>
  )
}

const CUSTOM_BRANDS: Record<string, Record<string, React.ComponentType<unknown>>> = {
  DotsStudio: {
    Avatar: DotsStudioAvatar,
    Color: DotsStudioMark,
  },
}

/* Aedilic — AI-generated image detection (nonescape). Deep navy eye mark. */
const AEDILIC_BG = '#2B2D5E'
function AedilicMark({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='Aedilic'>
      <circle cx='12' cy='12' r='12' fill={AEDILIC_BG} />
      <path
        d='M12 7.6c-2.9 0-5.4 1.7-6.6 4.4 1.2 2.7 3.7 4.4 6.6 4.4s5.4-1.7 6.6-4.4C17.4 9.3 14.9 7.6 12 7.6Z'
        fill='#FFFFFF'
      />
      <circle cx='12' cy='12' r='2' fill={AEDILIC_BG} />
    </svg>
  )
}
function AedilicAvatar({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='Aedilic'>
      <rect width='24' height='24' rx='6' fill={AEDILIC_BG} />
      <path
        d='M12 7.2c-3 0-5.6 1.8-6.9 4.8 1.3 3 3.9 4.8 6.9 4.8s5.6-1.8 6.9-4.8c-1.3-3-3.9-4.8-6.9-4.8Z'
        fill='#FFFFFF'
      />
      <circle cx='12' cy='12' r='2.1' fill={AEDILIC_BG} />
    </svg>
  )
}

/* ModelBest 面壁智能 (MiniCPM / MinerU). Indigo tile with white M. */
const MINICPM_BG = '#4F62F6'
function MiniCPMMark({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='MiniCPM'>
      <circle cx='12' cy='12' r='12' fill={MINICPM_BG} />
      <path
        d='M6.8 16V8.5h2.1l3.1 4.1 3.1-4.1h2.1V16h-2.3v-4.6l-2.9 3.8-2.9-3.8V16h-2.3Z'
        fill='#FFFFFF'
      />
    </svg>
  )
}
function MiniCPMAvatar({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='MiniCPM'>
      <rect width='24' height='24' rx='6' fill={MINICPM_BG} />
      <path
        d='M6.6 17V8.2h2.2l3.2 4.3 3.2-4.3h2.2V17h-2.5v-4.8L12 15.8 9.1 12.2V17H6.6Z'
        fill='#FFFFFF'
      />
    </svg>
  )
}

/* Poolside — agentic coding (Laguna). Navy tile with ripple waves. */
const POOLSIDE_BG = '#0B57D0'
function PoolsideMark({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='Poolside'>
      <circle cx='12' cy='12' r='12' fill={POOLSIDE_BG} />
      <g fill='none' stroke='#FFFFFF' strokeWidth='1.7' strokeLinecap='round'>
        <path d='M5 9.5c2-1.6 4-1.6 6 0s4 1.6 6 0' />
        <path d='M5 13.5c2-1.6 4-1.6 6 0s4 1.6 6 0' />
        <path d='M5 17.2c2-1.6 4-1.6 6 0s4 1.6 6 0' />
      </g>
    </svg>
  )
}
function PoolsideAvatar({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='Poolside'>
      <rect width='24' height='24' rx='6' fill={POOLSIDE_BG} />
      <g fill='none' stroke='#FFFFFF' strokeWidth='1.7' strokeLinecap='round'>
        <path d='M5 9c2-1.5 4-1.5 6 0s4 1.5 6 0' />
        <path d='M5 12.8c2-1.5 4-1.5 6 0s4 1.5 6 0' />
        <path d='M5 16.6c2-1.5 4-1.5 6 0s4 1.5 6 0' />
      </g>
    </svg>
  )
}

/* Generic model placeholder for the "其他 / Other" vendor. */
function ModelMark({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='Other'>
      <circle cx='12' cy='12' r='12' fill='#8A93A6' />
      <path d='M12 6.4 18 9.6v5.2l-6 3.2-6-3.2V9.6l6-3.2Z' fill='#FFFFFF' opacity='0.95' />
      <path d='M12 11.4 18 8.8M12 11.4 6 8.8M12 11.4v6.2' stroke='#8A93A6' strokeWidth='0.7' />
    </svg>
  )
}
function ModelAvatar({ size = 20 }: { size?: number | string }) {
  const s = Number(size) || 20
  return (
    <svg viewBox='0 0 24 24' width={s} height={s} role='img' aria-label='Other'>
      <rect width='24' height='24' rx='6' fill='#8A93A6' />
      <path d='M12 5.8 18.4 9.2v5.6L12 18.2 5.6 14.8V9.2L12 5.8Z' fill='#FFFFFF' opacity='0.95' />
      <path d='M12 11.6 18.4 8.8M12 11.6 5.6 8.8M12 11.6v6.4' stroke='#8A93A6' strokeWidth='0.8' />
    </svg>
  )
}

CUSTOM_BRANDS.Aedilic = { Avatar: AedilicAvatar, Color: AedilicMark }
CUSTOM_BRANDS.MiniCPM = { Avatar: MiniCPMAvatar, Color: MiniCPMMark }
CUSTOM_BRANDS.Poolside = { Avatar: PoolsideAvatar, Color: PoolsideMark }
CUSTOM_BRANDS.Model = { Avatar: ModelAvatar, Color: ModelMark }

/**
 * Parse a property value from string to appropriate type
 * @param raw - Raw string value
 * @returns Parsed value (boolean, number, or string)
 */
function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  // Remove curly braces
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  // Remove quotes
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  // Boolean
  if (v === 'true') return true
  if (v === 'false') return false

  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  // Return as string
  return v
}

/**
 * Get LobeHub icon component by name
 * @param iconName - Icon name/description (e.g., "OpenAI", "OpenAI.Color", "Claude.Avatar")
 * @param size - Icon size (default: 20)
 * @returns Icon component or fallback
 *
 * @example
 * getLobeIcon("OpenAI", 24)
 * getLobeIcon("OpenAI.Color", 20)
 * getLobeIcon("Claude.Avatar.type={'platform'}", 32)
 */
export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): React.ReactNode {
  if (!iconName || typeof iconName !== 'string') {
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  const trimmedName = iconName.trim()
  if (!trimmedName) {
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  // Parse component path and chained properties
  const segments = trimmedName.split('.')
  const baseKey = segments[0]
  const customBrand = CUSTOM_BRANDS[baseKey]
  const BaseIcon = (customBrand ??
    (LobeIcons as Record<string, unknown>)[baseKey]) as
    | Record<string, unknown>
    | undefined

  let IconComponent: React.ComponentType<Record<string, unknown>> | undefined
  let propStartIndex: number

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]] as React.ComponentType<
      Record<string, unknown>
    >
    propStartIndex = 2
  } else {
    IconComponent = (customBrand?.Color ??
      (LobeIcons as Record<string, unknown>)[baseKey]) as
      | React.ComponentType<Record<string, unknown>>
      | undefined
    propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  }

  // Fallback if icon not found
  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    const firstLetter = trimmedName.charAt(0).toUpperCase()
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        {firstLetter}
      </div>
    )
  }

  // Parse chained properties (e.g., "type={'platform'}", "shape='square'")
  const props: Record<string, string | number | boolean> = {}

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  // Set size if not explicitly specified in the string
  if (props.size == null && size != null) {
    props.size = size
  }

  return <IconComponent {...props} />
}
