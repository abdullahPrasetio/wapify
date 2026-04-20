import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MainArea } from './MainArea'
import { useAppStore } from '../../store/useAppStore'
import { UserManagement } from '../admin/UserManagement'
import { TeamManagement } from '../admin/TeamManagement'

export const AppLayout = (): React.JSX.Element => {
  const { activeView } = useAppStore()

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
            <Header />
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
