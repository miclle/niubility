import ContentTable from './ContentTable'
import { useTranslation } from 'react-i18next'

function AdminArticleContents() {
  const { t } = useTranslation('admin')
  return <ContentTable type="article" title={t('admin:contentManagementArticles')} />
}

export default AdminArticleContents
