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
        caption_label: 'text-sm font-medium text-[var(--color-text)]',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute left-1 size-7 p-0 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10',
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute right-1 size-7 p-0 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 rounded-md text-[0.7rem] font-normal text-[var(--color-text-secondary)]',
        week: 'mt-1 flex w-full',
        day: 'relative p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 font-normal text-[var(--color-text)] hover:bg-[var(--color-gold)]/15 hover:text-[var(--color-gold)]',
        ),
        selected:
          '[&>button]:bg-[var(--color-gold)] [&>button]:text-black [&>button]:hover:bg-[var(--color-gold)] [&>button]:hover:text-black',
        today: '[&>button]:border [&>button]:border-[var(--color-gold)]/50',
        outside: '[&>button]:text-[var(--color-text-muted)] [&>button]:opacity-50',
        disabled: '[&>button]:text-[var(--color-text-muted)] [&>button]:opacity-40',
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
