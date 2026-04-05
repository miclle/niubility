import ContentTable from './ContentTable'
import { useTranslation } from 'react-i18next'

function AdminVideoContents() {
  const { t } = useTranslation('admin')
  return <ContentTable type="video" title={t('admin:contentManagementVideos')} />
}

export default AdminVideoContents
