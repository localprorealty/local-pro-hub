import { useCallback, useEffect, useState } from 'react'
import { Bell, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fetchUnreadComments, type UnreadComment } from '@/lib/public-share'

export function NotificationBell() {
  const navigate = useNavigate()
  const [unreadList, setUnreadList] = useState<UnreadComment[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadUnread = useCallback(async () => {
    try {
      const data = await fetchUnreadComments()
      setUnreadCount(data.count)
      setUnreadList(data.unread)
    } catch {
      // Fail silently to avoid breaking the header
    }
  }, [])

  useEffect(() => {
    void loadUnread()

    // Refresh on window focus or when comments are marked read
    const handleFocus = () => void loadUnread()
    const handleCommentsRead = () => void loadUnread()

    window.addEventListener('focus', handleFocus)
    window.addEventListener('comments-read', handleCommentsRead)

    // Poll every 45 seconds for new visitor comments
    const interval = setInterval(() => {
      void loadUnread()
    }, 45000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('comments-read', handleCommentsRead)
      clearInterval(interval)
    }
  }, [loadUnread])

  const handleSelectComment = (listingId: string) => {
    navigate(`/listing/${listingId}?tab=share`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex size-10 items-center justify-center rounded-full border border-[var(--color-gold-border)] bg-[var(--color-surface-2)] text-[var(--color-gold)] transition-colors hover:border-[var(--color-gold)] hover:bg-[var(--color-gold-dim)]"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-gold)] px-1 text-[10px] font-bold text-black ring-2 ring-[#0a0a0a]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 rounded-sm border border-[var(--color-gold-border)] bg-[var(--color-surface-2)] p-1 text-[var(--color-white)]"
      >
        <DropdownMenuLabel className="font-normal px-2 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-[var(--color-gold)]" />
              <span className="text-xs font-semibold tracking-wider text-white uppercase">
                Client Feedback
              </span>
            </div>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-gold)]">
                {unreadCount} unread
              </span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--color-border)]" />

        {unreadList.length === 0 ? (
          <div className="py-6 px-4 text-center">
            <p className="text-xs text-[var(--color-text-secondary)]">No unread client feedback.</p>
            <p className="mt-1 text-[10px] text-zinc-500">
              When visitors comment on your public share link, you&apos;ll be notified here.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]/50">
            {unreadList.map((c) => {
              let timeAgo = 'recently'
              try {
                timeAgo = formatDistanceToNow(new Date(c.created_at), { addSuffix: true })
              } catch {
                timeAgo = ''
              }

              return (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => handleSelectComment(c.listing_id)}
                  className="cursor-pointer flex flex-col items-start gap-1 p-2.5 text-left transition-colors focus:bg-[var(--color-gold-dim)]"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-white">
                      {c.address_full}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--color-text-secondary)]">
                      {timeAgo}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] text-[var(--color-text-secondary)]">
                    <strong className="text-[var(--color-gold)] font-medium">
                      {c.commenter_name}:{' '}
                    </strong>
                    &ldquo;{c.comment_text}&rdquo;
                  </p>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
