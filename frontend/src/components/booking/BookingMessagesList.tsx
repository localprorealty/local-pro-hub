import type { BookingMessage } from '@/lib/bookings'

type BookingMessagesListProps = {
  messages: BookingMessage[]
}

export function BookingMessagesList({ messages }: BookingMessagesListProps) {
  if (messages.length === 0) return null

  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <div
          key={`${message.from}-${message.label}-${message.text.slice(0, 24)}`}
          className="rounded-sm border border-[var(--color-border)] bg-[#0a0a0a] p-3"
        >
          <p className="text-[10px] tracking-widest text-[#CFB87C] uppercase">
            {message.label}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{message.text}</p>
        </div>
      ))}
    </div>
  )
}
