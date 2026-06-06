import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { MainArea } from './MainArea'
import { TopNavbar } from './TopNavbar'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { UserManagement } from '../admin/UserManagement'
import { TeamManagement } from '../admin/TeamManagement'
import { DonationSettings } from '../admin/DonationSettings'
import { ActivityLogView } from './ActivityLogView'
import { GlobalSearchModal } from '../modals/GlobalSearchModal'

export const AppLayout = (): React.JSX.Element => {
  const { activeView, isSearchModalOpen, setSearchModalOpen } = useAppStore()


  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchModalOpen(!isSearchModalOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchModalOpen, setSearchModalOpen])

  // Re-fetch data for active team on mount (for Cmd+R persistence)
  useEffect(() => {
    const initData = async () => {
      // Use getState to ensure we work with the most recent rehydrated values
      const state = useDataStore.getState()
      await state.fetchTeams()

      const currentActiveTeamId = useDataStore.getState().activeTeamId
      if (currentActiveTeamId) {
        console.log(`[AppLayout] Rehydrating data for team ${currentActiveTeamId}`)

        // Explicitly re-fetch basic data
        const fetchedCollections = await state.fetchCollections(currentActiveTeamId)
        state.fetchEnvironments(currentActiveTeamId)
        state.fetchHistory()

        const expanded = useDataStore.getState().expandedItems

        // Fetch contents for already expanded collections
        if (fetchedCollections) {
          fetchedCollections.forEach((col) => {
            if (expanded[`collection-${col.id}`]) {
              state.fetchCollectionContents(col.id)
            }
          })
        }
      }
    }
    initData()
  }, [])

  const renderContent = (): React.JSX.Element => {
    switch (activeView) {
      case 'admin-users':
        return <UserManagement />
      case 'admin-teams':
        return <TeamManagement />
      case 'admin-donations':
        return <DonationSettings />
      case 'activity-log':
        return <ActivityLogView />
      case 'request-builder':
      default:
        return (
          <div className="flex-1 flex flex-col min-w-0">
            <MainArea />
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-text overflow-hidden font-sans">
      <TopNavbar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        {renderContent()}
      </div>
      <GlobalSearchModal />
    </div>
  )
}
