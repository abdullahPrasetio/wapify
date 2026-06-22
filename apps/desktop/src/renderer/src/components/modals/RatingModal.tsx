import { useState } from 'react'
import { Star, X, Loader2 } from 'lucide-react'
import { apiClient, LICENSE_SERVER_URL } from '../../api/client'

interface Props {
  onClose: () => void
  appVersion: string
  required?: boolean
}

export const RatingModal = ({ onClose, appVersion, required = false }: Props): React.JSX.Element => {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (): Promise<void> => {
    if (rating === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.post<{ blob: string }>(
        '/api/v1/rating',
        { rating, comment, version: appVersion }
      )

      setDone(true)

      if (res.data?.blob) {
        fetch(`${LICENSE_SERVER_URL}/api/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blob: res.data.blob }),
        }).catch(() => { /* silent */ })
      }
    } catch {
      setError('Gagal mengirim rating. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const handleBackdropClick = (): void => {
    if (!required) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text">Beri Rating Wapbolt</h2>
          {!required && (
            <button onClick={onClose} className="text-muted hover:text-text transition-colors cursor-pointer">
              <X size={18} />
            </button>
          )}
        </div>

        {required && !done && (
          <p className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-4">
            Sudah lebih dari sebulan! Beri rating dulu untuk melanjutkan menggunakan Wapbolt.
          </p>
        )}

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-sm text-text font-medium">Terima kasih atas feedbacknya!</p>
            <p className="text-xs text-muted mt-1">Rating kamu membantu kami berkembang.</p>
            <button
              onClick={onClose}
              className="mt-5 w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2 rounded-lg text-sm transition-colors cursor-pointer"
            >
              Lanjutkan
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted mb-5">Seberapa puas kamu menggunakan Wapbolt?</p>

            <div className="flex items-center justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    className={
                      star <= (hovered || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-border'
                    }
                  />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Komentar (opsional)..."
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-primary transition-colors resize-none mb-4"
            />

            {error && (
              <p className="text-xs text-danger mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              {!required && (
                <button
                  onClick={onClose}
                  className="flex-1 border border-border text-muted hover:text-text py-2 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Nanti saja
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={loading || rating === 0}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" />Mengirim...</> : 'Kirim Rating'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
