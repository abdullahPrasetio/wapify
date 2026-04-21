import { useEffect, useState } from 'react'
import { useDataStore } from '../../store/useDataStore'
import { History, MessageSquare, CornerUpLeft, Clock, User } from 'lucide-react'
import moment from 'moment'

interface CollaborationPanelProps {
  requestId: number
}

export const CollaborationPanel = ({ requestId }: CollaborationPanelProps): React.JSX.Element => {
  const [activeTab, setActiveTab] = useState<'comments' | 'versions' | 'activity'>('comments')
  const [newComment, setNewComment] = useState('')

  const {
    requestVersions,
    requestComments,
    activities,
    activeTeamId,
    fetchRequestVersions,
    fetchRequestComments,
    fetchActivities,
    addComment,
    restoreVersion
  } = useDataStore()

  useEffect(() => {
    fetchRequestVersions(requestId)
    fetchRequestComments(requestId)
    if (activeTeamId) fetchActivities(activeTeamId)
  }, [requestId, activeTeamId, fetchRequestVersions, fetchRequestComments, fetchActivities])

  const versions = requestVersions[requestId] || []
  const comments = requestComments[requestId] || []

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    await addComment(requestId, newComment)
    setNewComment('')
  }

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'comments'
              ? 'text-primary border-b-2 border-primary bg-surface/50'
              : 'text-muted hover:bg-surface/30'
          }`}
        >
          <MessageSquare size={14} />
          Comments ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'versions'
              ? 'text-primary border-b-2 border-primary bg-surface/50'
              : 'text-muted hover:bg-surface/30'
          }`}
        >
          <History size={14} />
          History
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'activity'
              ? 'text-primary border-b-2 border-primary bg-surface/50'
              : 'text-muted hover:bg-surface/30'
          }`}
        >
          <Clock size={14} />
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-surface/20">
        {activeTab === 'comments' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted opacity-50">
                  <MessageSquare size={32} className="mb-2" />
                  <span className="text-xs">No comments yet</span>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-background rounded-lg border border-border p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                          {comment.user_name ? (
                            comment.user_name.charAt(0).toUpperCase()
                          ) : (
                            <User size={10} />
                          )}
                        </div>
                        <span className="text-xs font-semibold text-text">
                          {comment.user_name || 'User'}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted">
                        {moment(comment.created_at).fromNow()}
                      </span>
                    </div>
                    <p className="text-sm text-text whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-background border-t border-border">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full bg-surface border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-primary resize-none h-20 mb-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded py-2 text-xs font-bold transition-colors"
              >
                Send Comment
              </button>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="p-4 space-y-4">
            {versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted opacity-50">
                <History size={32} className="mb-2" />
                <span className="text-xs">No history yet</span>
              </div>
            ) : (
              versions.map((version, index) => (
                <div
                  key={version.id}
                  className="bg-background rounded-lg border border-border p-3 relative group"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center">
                        <Clock size={12} className="text-muted" />
                      </div>
                      {index !== versions.length - 1 && (
                        <div className="w-px h-full bg-border mx-auto absolute left-[27px] top-[42px] bottom-[-16px]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-text">
                          Version {version.version_number}
                        </span>
                        <span className="text-[10px] text-muted">
                          {moment(version.created_at).format('MMM D, HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">Saved by User #{version.created_by}</p>

                      {index !== 0 && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                'Are you sure you want to restore this version? Current unsaved changes will be lost.'
                              )
                            ) {
                              restoreVersion(requestId, version.id)
                            }
                          }}
                          className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors font-medium opacity-0 group-hover:opacity-100"
                        >
                          <CornerUpLeft size={12} /> Restore Version
                        </button>
                      )}
                      {index === 0 && (
                        <span className="mt-3 inline-block px-2 py-0.5 bg-success/20 text-success rounded text-[10px] font-bold uppercase tracking-wider">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4 space-y-3">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted opacity-50">
                <Clock size={32} className="mb-2" />
                <span className="text-xs">No recent activity</span>
              </div>
            ) : (
              activities
                .filter((a) => a.entity_id === requestId || a.entity_type === 'TEAM')
                .map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-xs">
                    <div className="w-6 h-6 shrink-0 rounded-full bg-surface border border-border flex items-center justify-center text-[10px]">
                      {activity.user_name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <p className="text-text font-medium">
                        <span className="font-bold">{activity.user_name || 'User'}</span>{' '}
                        {activity.action.toLowerCase().replace('_', ' ')}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">
                        {moment(activity.created_at).fromNow()}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
