import React from 'react'
import { X, Heart } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { apiClient } from '../../api/client'
import { toast } from 'sonner'
import qrisImage from '../../assets/qris.jpeg'

export const DonationModal = (): React.JSX.Element | null => {
  const { isDonationModalOpen, setDonationModalOpen, donationMessage } = useAppStore()

  if (!isDonationModalOpen) return null

  const handleMarkSeen = async (showToast: boolean = false) => {
    try {
      const res = await apiClient.post('/api/v1/donations/mark-seen', {})
      if (res.status === 200 && showToast) {
        toast.success('Terima kasih atas dukungannya!')
      }
    } catch (e) {
      console.error('Failed to mark donation as seen:', e)
    }
    setDonationModalOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/5">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Heart size={18} className="text-red-500 fill-red-500" /> Dukung Wapbolt
          </h2>
          <button 
            onClick={() => handleMarkSeen(false)} 
            className="text-muted hover:text-text transition-colors p-1 hover:bg-white/10 rounded-md"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center text-center space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-text leading-relaxed font-medium">
              {donationMessage || "Dukung pengembangan Wapbolt agar tetap gratis dan terus berkembang!"}
            </p>
          </div>
          
          <div className="bg-white p-3 rounded-xl shadow-inner group transition-all duration-500 hover:scale-[1.02]">
            <img 
              src={qrisImage} 
              alt="QRIS Donation" 
              className="w-56 h-auto rounded-lg"
              onError={(e) => {
                e.currentTarget.src = 'https://placehold.co/400x600?text=QRIS+IMAGE+NOT+FOUND'
              }}
            />
          </div>

          <div className="flex flex-col w-full gap-2 pt-2">
            <button
              onClick={() => handleMarkSeen(true)}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              Sudah Donasi
            </button>
            <button
              onClick={() => handleMarkSeen(false)}
              className="w-full py-2 text-muted hover:text-text transition-colors text-xs font-medium"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
