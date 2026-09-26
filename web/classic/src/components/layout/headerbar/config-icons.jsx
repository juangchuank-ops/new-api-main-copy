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

主题设置抽屉的示意图标，移植自新版前端 assets/custom。
*/

export function IconThemeSystem({ className, ...props }) {
  return (
    <svg
      data-name='icon-theme-system'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      className={'overflow-hidden rounded-md stroke-primary fill-primary group-data-unchecked:stroke-muted-foreground group-data-unchecked:fill-muted-foreground' + (className ? ' ' + className : '')}
      {...props}
    >
      <path opacity={0.2} d='M0 0.03H22.88V51.17H0z' />
      <circle
        cx={6.7}
        cy={7.04}
        r={3.54}
        fill='#fff'
        opacity={0.8}
        stroke='#fff'
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <path
        d='M18.12 6.39h-5.87c-.6 0-1.09-.45-1.09-1s.49-1 1.09-1h5.87c.6 0 1.09.45 1.09 1s-.49 1-1.09 1zM16.55 9.77h-4.24c-.55 0-1-.45-1-1s.45-1 1-1h4.24c.55 0 1 .45 1 1s-.45 1-1 1z'
        fill='#fff'
        stroke='none'
        opacity={0.75}
      />
      <path
        d='M18.32 17.37H4.59c-.69 0-1.25-.47-1.25-1.05s.56-1.05 1.25-1.05h13.73c.69 0 1.25.47 1.25 1.05s-.56 1.05-1.25 1.05z'
        fill='#fff'
        stroke='none'
        opacity={0.72}
      />
      <path
        d='M15.34 21.26h-11c-.55 0-1-.41-1-.91s.45-.91 1-.91h11c.55 0 1 .41 1 .91s-.45.91-1 .91z'
        fill='#fff'
        stroke='none'
        opacity={0.55}
      />
      <path
        d='M16.46 25.57H4.43c-.6 0-1.09-.44-1.09-.98s.49-.98 1.09-.98h12.03c.6 0 1.09.44 1.09.98s-.49.98-1.09.98z'
        fill='#fff'
        stroke='none'
        opacity={0.67}
      />
      <rect
        x={33.36}
        y={19.73}
        width={2.75}
        height={3.42}
        rx={0.33}
        ry={0.33}
        opacity={0.31}
        stroke='none'
      />
      <rect
        x={29.64}
        y={16.57}
        width={2.75}
        height={6.58}
        rx={0.33}
        ry={0.33}
        opacity={0.4}
        stroke='none'
      />
      <rect
        x={37.16}
        y={14.44}
        width={2.75}
        height={8.7}
        rx={0.33}
        ry={0.33}
        opacity={0.26}
        stroke='none'
      />
      <rect
        x={41.19}
        y={10.75}
        width={2.75}
        height={12.4}
        rx={0.33}
        ry={0.33}
        opacity={0.37}
        stroke='none'
      />
      <g>
        <circle cx={62.74} cy={16.32} r={8} opacity={0.25} />
        <path
          d='M62.74 16.32l4.1-6.87c1.19.71 2.18 1.72 2.86 2.92s1.04 2.57 1.04 3.95h-8z'
          opacity={0.45}
        />
      </g>
      <rect
        x={29.64}
        y={27.75}
        width={41.62}
        height={18.62}
        rx={1.69}
        ry={1.69}
        opacity={0.3}
        stroke='none'
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
    </svg>
  )
}


export function IconThemeLight({ className, ...props }) {
  return (
    <svg
      data-name='icon-theme-light'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <g fill='#d9d9d9'>
        <rect x={0.53} y={0.5} width={78.83} height={50.14} rx={3.5} ry={3.5} />
        <path d='M75.86 1c1.65 0 3 1.35 3 3v43.14c0 1.65-1.35 3-3 3H4.03c-1.65 0-3-1.35-3-3V4c0-1.65 1.35-3 3-3h71.83m0-1H4.03c-2.21 0-4 1.79-4 4v43.14c0 2.21 1.79 4 4 4h71.83c2.21 0 4-1.79 4-4V4c0-2.21-1.79-4-4-4z' />
      </g>
      <path
        d='M22.88 0h52.97c2.21 0 4 1.79 4 4v43.14c0 2.21-1.79 4-4 4H22.88V0z'
        fill='#ecedef'
      />
      <circle cx={6.7} cy={7.04} r={3.54} fill='#fff' />
      <path
        d='M18.12 6.39h-5.87c-.6 0-1.09-.45-1.09-1s.49-1 1.09-1h5.87c.6 0 1.09.45 1.09 1s-.49 1-1.09 1zM16.55 9.77h-4.24c-.55 0-1-.45-1-1s.45-1 1-1h4.24c.55 0 1 .45 1 1s-.45 1-1 1zM18.32 17.37H4.59c-.69 0-1.25-.47-1.25-1.05s.56-1.05 1.25-1.05h13.73c.69 0 1.25.47 1.25 1.05s-.56 1.05-1.25 1.05zM15.34 21.26h-11c-.55 0-1-.41-1-.91s.45-.91 1-.91h11c.55 0 1 .41 1 .91s-.45.91-1 .91zM16.46 25.57H4.43c-.6 0-1.09-.44-1.09-.98s.49-.98 1.09-.98h12.03c.6 0 1.09.44 1.09.98s-.49.98-1.09.98z'
        fill='#fff'
      />
      <g fill='#c0c4c4'>
        <rect
          x={33.36}
          y={19.73}
          width={2.75}
          height={3.42}
          rx={0.33}
          ry={0.33}
          opacity={0.32}
        />
        <rect
          x={29.64}
          y={16.57}
          width={2.75}
          height={6.58}
          rx={0.33}
          ry={0.33}
          opacity={0.44}
        />
        <rect
          x={37.16}
          y={14.44}
          width={2.75}
          height={8.7}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
        <rect
          x={41.19}
          y={10.75}
          width={2.75}
          height={12.4}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
      </g>
      <circle cx={62.74} cy={16.32} r={8} fill='#fff' />
      <g fill='#d9d9d9'>
        <path d='M63.62 15.82L67 10.15c.93.64 1.7 1.48 2.26 2.47.56.98.89 2.08.96 3.21h-6.6z' />
        <path d='M67.14 10.88a6.977 6.977 0 012.52 4.44h-5.17l2.65-4.44m-.31-1.43l-4.1 6.87h8c0-1.39-.36-2.75-1.04-3.95s-1.67-2.21-2.86-2.92z' />
      </g>
      <rect
        x={29.64}
        y={27.75}
        width={41.62}
        height={18.62}
        rx={1.69}
        ry={1.69}
        fill='#fff'
      />
    </svg>
  )
}


export function IconThemeDark({ className, ...props }) {
  return (
    <svg
      data-name='icon-theme-dark'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <g fill='#1d2b3f'>
        <rect x={0.53} y={0.5} width={78.83} height={50.14} rx={3.5} ry={3.5} />
        <path d='M75.86 1c1.65 0 3 1.35 3 3v43.14c0 1.65-1.35 3-3 3H4.03c-1.65 0-3-1.35-3-3V4c0-1.65 1.35-3 3-3h71.83m0-1H4.03c-2.21 0-4 1.79-4 4v43.14c0 2.21 1.79 4 4 4h71.83c2.21 0 4-1.79 4-4V4c0-2.21-1.79-4-4-4z' />
      </g>
      <path
        d='M22.88 0h52.97c2.21 0 4 1.79 4 4v43.14c0 2.21-1.79 4-4 4H22.88V0z'
        fill='#0d1628'
      />
      <circle cx={6.7} cy={7.04} r={3.54} fill='#426187' />
      <path
        d='M18.12 6.39h-5.87c-.6 0-1.09-.45-1.09-1s.49-1 1.09-1h5.87c.6 0 1.09.45 1.09 1s-.49 1-1.09 1zM16.55 9.77h-4.24c-.55 0-1-.45-1-1s.45-1 1-1h4.24c.55 0 1 .45 1 1s-.45 1-1 1zM18.32 17.37H4.59c-.69 0-1.25-.47-1.25-1.05s.56-1.05 1.25-1.05h13.73c.69 0 1.25.47 1.25 1.05s-.56 1.05-1.25 1.05zM15.34 21.26h-11c-.55 0-1-.41-1-.91s.45-.91 1-.91h11c.55 0 1 .41 1 .91s-.45.91-1 .91zM16.46 25.57H4.43c-.6 0-1.09-.44-1.09-.98s.49-.98 1.09-.98h12.03c.6 0 1.09.44 1.09.98s-.49.98-1.09.98z'
        fill='#426187'
      />
      <g fill='#2a62bc'>
        <rect
          x={33.36}
          y={19.73}
          width={2.75}
          height={3.42}
          rx={0.33}
          ry={0.33}
          opacity={0.32}
        />
        <rect
          x={29.64}
          y={16.57}
          width={2.75}
          height={6.58}
          rx={0.33}
          ry={0.33}
          opacity={0.44}
        />
        <rect
          x={37.16}
          y={14.44}
          width={2.75}
          height={8.7}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
        <rect
          x={41.19}
          y={10.75}
          width={2.75}
          height={12.4}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
      </g>
      <circle cx={62.74} cy={16.32} r={8} fill='#2f5491' opacity={0.5} />
      <path
        d='M62.74 16.32l4.1-6.87c1.19.71 2.18 1.72 2.86 2.92s1.04 2.57 1.04 3.95h-8z'
        fill='#2f5491'
        opacity={0.74}
      />
      <rect
        x={29.64}
        y={27.75}
        width={41.62}
        height={18.62}
        rx={1.69}
        ry={1.69}
        fill='#17273f'
      />
    </svg>
  )
}


export function IconSidebarInset({ className, ...props }) {
  return (
    <svg
      data-name='icon-sidebar-inset'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <rect
        x={23.39}
        y={5.57}
        width={50.22}
        height={40}
        rx={2}
        ry={2}
        opacity={0.2}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <path
        fill='none'
        opacity={0.72}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='2px'
        d='M5.08 17.05L17.31 17.05'
      />
      <path
        fill='none'
        opacity={0.48}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='2px'
        d='M5.08 24.25L15.6 24.25'
      />
      <path
        fill='none'
        opacity={0.55}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='2px'
        d='M5.08 20.54L14.46 20.54'
      />
      <g strokeLinecap='round' strokeMiterlimit={10}>
        <circle cx={7.04} cy={9.57} r={2.54} opacity={0.8} />
        <path
          fill='none'
          opacity={0.8}
          strokeWidth='2px'
          d='M11.59 8.3L17.31 8.3'
        />
        <path fill='none' opacity={0.6} d='M11.38 10.95L16.44 10.95' />
      </g>
    </svg>
  )
}


export function IconSidebarFloating({ className, ...props }) {
  return (
    <svg
      data-name='icon-sidebar-floating'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <rect
        x={5.89}
        y={5.15}
        width={19.74}
        height={40}
        rx={2}
        ry={2}
        opacity={0.8}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <g stroke='#fff' strokeLinecap='round' strokeMiterlimit={10}>
        <path
          fill='none'
          opacity={0.72}
          strokeWidth='2px'
          d='M9.81 18.36L22.04 18.36'
        />
        <path
          fill='none'
          opacity={0.48}
          strokeWidth='2px'
          d='M9.81 25.57L20.33 25.57'
        />
        <path
          fill='none'
          opacity={0.55}
          strokeWidth='2px'
          d='M9.81 21.85L19.18 21.85'
        />
        <circle cx={11.76} cy={10.88} r={2.54} fill='#fff' opacity={0.8} />
        <path
          fill='none'
          opacity={0.8}
          strokeWidth='2px'
          d='M16.31 9.62L22.04 9.62'
        />
        <path fill='none' opacity={0.6} d='M16.1 12.27L21.16 12.27' />
      </g>
      <path
        fill='none'
        opacity={0.62}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='3px'
        d='M30.59 9.62L35.85 9.62'
      />
      <rect
        x={29.94}
        y={13.42}
        width={26.03}
        height={2.73}
        rx={0.64}
        ry={0.64}
        opacity={0.44}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <rect
        x={29.94}
        y={19.28}
        width={43.11}
        height={25.87}
        rx={2}
        ry={2}
        opacity={0.3}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
    </svg>
  )
}


export function IconSidebarSidebar({ className, ...props }) {
  return (
    <svg
      data-name='icon-sidebar-sidebar'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <path
        d='M23.42.51h51.99c2.21 0 4 1.79 4 4v42.18c0 2.21-1.79 4-4 4H23.42s-.04-.02-.04-.04V.55s.02-.04.04-.04z'
        opacity={0.2}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <path
        fill='none'
        opacity={0.72}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='2px'
        d='M5.56 14.88L17.78 14.88'
      />
      <path
        fill='none'
        opacity={0.48}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='2px'
        d='M5.56 22.09L16.08 22.09'
      />
      <path
        fill='none'
        opacity={0.55}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='2px'
        d='M5.56 18.38L14.93 18.38'
      />
      <g strokeLinecap='round' strokeMiterlimit={10}>
        <circle cx={7.51} cy={7.4} r={2.54} opacity={0.8} />
        <path
          fill='none'
          opacity={0.8}
          strokeWidth='2px'
          d='M12.06 6.14L17.78 6.14'
        />
        <path fill='none' opacity={0.6} d='M11.85 8.79L16.91 8.79' />
      </g>
    </svg>
  )
}


export function IconLayoutDefault({ className, ...props }) {
  return (
    <svg
      data-name='con-layout-default'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <path
        d='M39.22 15.99h-8.16c-.79 0-1.43-.67-1.43-1.5s.64-1.5 1.43-1.5h8.16c.79 0 1.43.67 1.43 1.5s-.64 1.5-1.43 1.5z'
        opacity={0.75}
      />
      <rect
        x={29.63}
        y={18.39}
        width={16.72}
        height={2.73}
        rx={1.36}
        ry={1.36}
        opacity={0.5}
      />
      <path
        d='M75.1 6.68v1.45c0 .63-.49 1.14-1.09 1.14H30.72c-.6 0-1.09-.51-1.09-1.14V6.68c0-.62.49-1.14 1.09-1.14h43.29c.6 0 1.09.52 1.09 1.14z'
        opacity={0.9}
      />
      <rect
        x={29.63}
        y={24.22}
        width={21.8}
        height={19.95}
        rx={2.11}
        ry={2.11}
        opacity={0.4}
      />
      <g strokeLinecap='round' strokeMiterlimit={10}>
        <rect
          x={61.06}
          y={38.15}
          width={2.01}
          height={3.42}
          rx={0.33}
          ry={0.33}
          opacity={0.32}
        />
        <rect
          x={56.78}
          y={34.99}
          width={2.01}
          height={6.58}
          rx={0.33}
          ry={0.33}
          opacity={0.44}
        />
        <rect
          x={65.17}
          y={32.86}
          width={2.01}
          height={8.7}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
        <rect
          x={69.55}
          y={29.17}
          width={2.01}
          height={12.4}
          rx={0.33}
          ry={0.33}
          opacity={0.66}
        />
      </g>
      <g opacity={0.5}>
        <circle cx={63.17} cy={18.63} r={7.5} />
        <path d='M63.17 11.63c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.14-7-7 3.14-7 7-7m0-1c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z' />
      </g>
      <g opacity={0.74}>
        <path d='M64.05 18.13l3.38-5.67c.93.64 1.7 1.48 2.26 2.47.56.98.89 2.08.96 3.21h-6.6z' />
        <path d='M67.57 13.19a6.977 6.977 0 012.52 4.44h-5.17l2.65-4.44m-.31-1.43l-4.1 6.87h8c0-1.39-.36-2.75-1.04-3.95a8.007 8.007 0 00-2.86-2.92z' />
      </g>
      <g strokeLinecap='round' strokeMiterlimit={10}>
        <rect
          x={5.84}
          y={5.02}
          width={19.14}
          height={40}
          rx={2}
          ry={2}
          opacity={0.8}
        />
        <g stroke='#fff'>
          <path
            fill='none'
            opacity={0.72}
            strokeWidth='2px'
            d='M9.02 17.39L21.25 17.39'
          />
          <path
            fill='none'
            opacity={0.48}
            strokeWidth='2px'
            d='M9.02 24.6L19.54 24.6'
          />
          <path
            fill='none'
            opacity={0.55}
            strokeWidth='2px'
            d='M9.02 20.88L18.4 20.88'
          />
          <circle cx={10.98} cy={9.91} r={2.54} fill='#fff' opacity={0.8} />
          <path
            fill='none'
            opacity={0.8}
            strokeWidth='2px'
            d='M15.53 8.65L21.25 8.65'
          />
          <path fill='none' opacity={0.6} d='M15.32 11.3L20.38 11.3' />
        </g>
      </g>
    </svg>
  )
}


export function IconLayoutCompact({ className, ...props }) {
  return (
    <svg
      data-name='icon-layout-compact'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <rect
        x={5.84}
        y={5.2}
        width={4}
        height={40}
        rx={2}
        ry={2}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <g stroke='#fff' strokeLinecap='round' strokeMiterlimit={10}>
        <path
          fill='none'
          opacity={0.66}
          strokeWidth='2px'
          d='M7.26 11.56L8.37 11.56'
        />
        <path
          fill='none'
          opacity={0.51}
          strokeWidth='2px'
          d='M7.26 14.49L8.37 14.49'
        />
        <path
          fill='none'
          opacity={0.52}
          strokeWidth='2px'
          d='M7.26 17.39L8.37 17.39'
        />
        <circle cx={7.81} cy={7.25} r={1.16} fill='#fff' opacity={0.8} />
      </g>
      <path
        fill='none'
        opacity={0.75}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='3px'
        d='M15.81 14.49L22.89 14.49'
      />
      <rect
        x={14.93}
        y={18.39}
        width={22.19}
        height={2.73}
        rx={0.64}
        ry={0.64}
        opacity={0.5}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <rect
        x={14.93}
        y={5.89}
        width={59.16}
        height={2.73}
        rx={0.64}
        ry={0.64}
        opacity={0.9}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <rect
        x={14.93}
        y={24.22}
        width={32.68}
        height={19.95}
        rx={2.11}
        ry={2.11}
        opacity={0.4}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <g strokeLinecap='round' strokeMiterlimit={10}>
        <rect
          x={59.05}
          y={38.15}
          width={2.01}
          height={3.42}
          rx={0.33}
          ry={0.33}
          opacity={0.32}
        />
        <rect
          x={54.78}
          y={34.99}
          width={2.01}
          height={6.58}
          rx={0.33}
          ry={0.33}
          opacity={0.44}
        />
        <rect
          x={63.17}
          y={32.86}
          width={2.01}
          height={8.7}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
        <rect
          x={67.54}
          y={29.17}
          width={2.01}
          height={12.4}
          rx={0.33}
          ry={0.33}
          opacity={0.66}
        />
      </g>
      <g opacity={0.5}>
        <circle cx={62.16} cy={18.63} r={7.5} />
        <path d='M62.16 11.63c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.14-7-7 3.14-7 7-7m0-1c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z' />
      </g>
      <g opacity={0.74}>
        <path d='M63.04 18.13l3.38-5.67c.93.64 1.7 1.48 2.26 2.47.56.98.89 2.08.96 3.21h-6.6z' />
        <path d='M66.57 13.19a6.977 6.977 0 012.52 4.44h-5.17l2.65-4.44m-.31-1.43l-4.1 6.87h8c0-1.39-.36-2.75-1.04-3.95a8.007 8.007 0 00-2.86-2.92z' />
      </g>
    </svg>
  )
}


export function IconLayoutFull({ className, ...props }) {
  return (
    <svg
      data-name='icon-layout-full'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 79.86 51.14'
      {...props}
    >
      <path
        fill='none'
        opacity={0.75}
        strokeLinecap='round'
        strokeMiterlimit={10}
        strokeWidth='3px'
        d='M6.85 14.49L15.02 14.49'
      />
      <rect
        x={5.84}
        y={18.39}
        width={25.6}
        height={2.73}
        rx={0.64}
        ry={0.64}
        opacity={0.5}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <rect
        x={5.84}
        y={5.89}
        width={68.26}
        height={2.73}
        rx={0.64}
        ry={0.64}
        opacity={0.9}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <rect
        x={5.84}
        y={24.22}
        width={37.71}
        height={19.95}
        rx={2.11}
        ry={2.11}
        opacity={0.4}
        strokeLinecap='round'
        strokeMiterlimit={10}
      />
      <g strokeLinecap='round' strokeMiterlimit={10}>
        <rect
          x={59.05}
          y={38.15}
          width={2.01}
          height={3.42}
          rx={0.33}
          ry={0.33}
          opacity={0.32}
        />
        <rect
          x={54.78}
          y={34.99}
          width={2.01}
          height={6.58}
          rx={0.33}
          ry={0.33}
          opacity={0.44}
        />
        <rect
          x={63.17}
          y={32.86}
          width={2.01}
          height={8.7}
          rx={0.33}
          ry={0.33}
          opacity={0.53}
        />
        <rect
          x={67.54}
          y={29.17}
          width={2.01}
          height={12.4}
          rx={0.33}
          ry={0.33}
          opacity={0.66}
        />
      </g>
      <g opacity={0.5}>
        <circle cx={62.16} cy={18.63} r={7.5} />
        <path d='M62.16 11.63c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.14-7-7 3.14-7 7-7m0-1c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z' />
      </g>
      <g opacity={0.74}>
        <path d='M63.04 18.13l3.38-5.67c.93.64 1.7 1.48 2.26 2.47.56.98.89 2.08.96 3.21h-6.6z' />
        <path d='M66.57 13.19a6.977 6.977 0 012.52 4.44h-5.17l2.65-4.44m-.31-1.43l-4.1 6.87h8c0-1.39-.36-2.75-1.04-3.95a8.007 8.007 0 00-2.86-2.92z' />
      </g>
    </svg>
  )
}
