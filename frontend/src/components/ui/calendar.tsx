import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'

import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2', className)}
      classNames={{
        months: 'flex flex-col gap-2',
        month: 'flex flex-col gap-3',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium text-white',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute left-1 size-7 p-0 text-[#CFB87C] hover:bg-[#CFB87C]/10',
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute right-1 size-7 p-0 text-[#CFB87C] hover:bg-[#CFB87C]/10',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 rounded-md text-[0.7rem] font-normal text-[#888888]',
        week: 'mt-1 flex w-full',
        day: 'relative p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 font-normal text-white hover:bg-[#CFB87C]/15 hover:text-[#CFB87C]',
        ),
        selected:
          '[&>button]:bg-[#CFB87C] [&>button]:text-black [&>button]:hover:bg-[#CFB87C] [&>button]:hover:text-black',
        today: '[&>button]:border [&>button]:border-[#CFB87C]/50',
        outside: '[&>button]:text-[#555555] [&>button]:opacity-50',
        disabled: '[&>button]:text-[#444444] [&>button]:opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
          return <Icon className="size-4" />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
