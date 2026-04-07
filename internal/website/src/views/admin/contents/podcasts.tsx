import ContentTable from './ContentTable'
import { useTranslation } from 'react-i18next'

function AdminPodcastContents() {
  const { t } = useTranslation('admin')
  return <ContentTable type="podcast" title={t('admin:contentManagementPodcasts') || 'Podcasts'} />
}

export default AdminPodcastContents
