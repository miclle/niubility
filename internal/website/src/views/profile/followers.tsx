import { useState, useEffect, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'

import { listFollowers } from 'src/api/user'
import { UserListItem } from './index'
import type { User } from 'src/types/user'
import type { ProfileContext } from './index'

const limit = 20

// ProfileFollowers displays the list of users who follow the profile user.
export default function ProfileFollowers() {
  const { profile, currentUser } = useOutletContext<ProfileContext>()

  const [users, setUsers] = useState<User[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchUsers = useCallback(async (username: string, pageNum: number, append: boolean) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    try {
      const res = await listFollowers(username, { page: pageNum, limit })
      const newUsers = res.data.users || []
      if (append) {
        setUsers((prev) => [...prev, ...newUsers])
      } else {
        setUsers(newUsers)
      }
      const more = newUsers.length === limit
      setHasMore(more)
      hasMoreRef.current = more
    } catch {
      if (!append) setUsers([])
      setHasMore(false)
      hasMoreRef.current = false
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  // Fetch first page on mount or when profile changes
  useEffect(() => {
    pageRef.current = 1
    hasMoreRef.current = true
    setUsers([])
    setHasMore(true)
    fetchUsers(profile.user.username, 1, false)
  }, [profile.user.username, fetchUsers])

  // Infinite scroll observer — stable, reads latest page/hasMore from refs
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    const username = profile.user.username

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          const nextPage = pageRef.current + 1
          pageRef.current = nextPage
          fetchUsers(username, nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => { observerRef.current?.disconnect() }
  }, [profile.user.username, fetchUsers])

  return (
    <>
      {users.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          暂无粉丝
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {users.map((u) => (
            <UserListItem key={u.id} user={u} currentUserID={currentUser?.id} isFollowingTab={false} />
          ))}
        </div>
      )}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && '加载中...'}
        {!hasMore && users.length > 0 && '没有更多了'}
      </div>
    </>
  )
}
