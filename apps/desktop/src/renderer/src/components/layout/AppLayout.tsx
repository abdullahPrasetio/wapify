import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MainArea } from './MainArea'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { UserManagement } from '../admin/UserManagement'
import { TeamManagement } from '../admin/TeamManagement'

export const AppLayout = (): React.JSX.Element => {
  const { activeView } = useAppStore()
  const {
    activeTeamId,
    fetchTeams,
    fetchCollections,
    fetchEnvironments,
    fetchHistory,
    expandedItems,
    fetchCollectionContents
  } = useDataStore()

  // Re-fetch data for active team on mount (for Cmd+R persistence)
  useEffect(() => {
    const initData = async () => {
      await fetchTeams()
      if (activeTeamId) {
        console.log(`[AppLayout] Rehydrating data for team ${activeTeamId}`)
        const fetchedCollections = await fetchCollections(activeTeamId)
        fetchEnvironments(activeTeamId)
        fetchHistory()

        // Fetch contents for already expanded collections
        if (fetchedCollections) {
          fetchedCollections.forEach((col) => {
            if (expandedItems[`collection-${col.id}`]) {
              fetchCollectionContents(col.id)
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
    <div className="flex h-screen w-screen bg-background text-text overflow-hidden font-sans">
      <Sidebar />
      {renderContent()}
    </div>
  )
}
