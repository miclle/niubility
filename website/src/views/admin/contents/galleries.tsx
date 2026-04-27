import ContentTable from './ContentTable'
import { useTranslation } from 'react-i18next'

function AdminGalleryContents() {
  const { t } = useTranslation('admin')
  return <ContentTable type="gallery" title={t('admin:contentManagementGalleries')} />
}

export default AdminGalleryContents
