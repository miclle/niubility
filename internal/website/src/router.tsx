import { Navigate, useParams, type RouteObject } from 'react-router-dom'

import MainLayout from 'src/layouts/MainLayout'
import AdminLayout from 'src/layouts/AdminLayout'
import SettingsLayout from 'src/layouts/SettingsLayout'
import Home from 'src/views/home'
import ProfileLayout from 'src/views/profile'
import ProfileContents from 'src/views/profile/contents'
import ProfileFollowing from 'src/views/profile/following'
import ProfileFollowers from 'src/views/profile/followers'
import ContentDetail from 'src/views/contents/detail'
import ContentEditor from 'src/views/contents/editor'
import FollowingFeed from 'src/views/following'
import AccountSettings from 'src/views/settings/account'
import MyContents from 'src/views/settings/contents'
import SecuritySettings from 'src/views/settings/security'
import NotificationSettings from 'src/views/settings/notifications'
import AdminContents from 'src/views/admin/contents'
import AdminContentEditor from 'src/views/admin/contents/editor'
import AdminUsers from 'src/views/admin/users'
import AdminImport from 'src/views/admin/import'
import AdminSync from 'src/views/admin/sync'
import SettingsAuth from 'src/views/admin/settings/auth'
import SettingsStorage from 'src/views/admin/settings/storage'
import SettingsWechat from 'src/views/admin/settings/wechat'
import AdminCategories from 'src/views/admin/categories'
import Init from 'src/views/init'
import Login from 'src/views/login'
import Register from 'src/views/register'
import NotFound from 'src/views/errors/NotFound'
import Forbidden from 'src/views/errors/Forbidden'
import ServerError from 'src/views/errors/ServerError'

// DynamicSlug renders ProfileLayout (with child routes) when the slug starts with '@', otherwise Home.
function DynamicSlug() {
  const { slug } = useParams<{ slug: string }>()
  if (slug?.startsWith('@')) {
    return <ProfileLayout />
  }
  return <Home />
}

const routes: RouteObject[] = [
  // Auth routes (no layout)
  { path: '/init', element: <Init /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  // Frontend routes
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/learning" replace /> },
      { path: 'following', element: <FollowingFeed /> },
      {
        path: ':slug',
        element: <DynamicSlug />,
        children: [
          { index: true, element: <ProfileContents /> },
          { path: 'videos', element: <ProfileContents /> },
          { path: 'articles', element: <ProfileContents /> },
          { path: 'speakers', element: <ProfileContents /> },
          { path: 'following', element: <ProfileFollowing /> },
          { path: 'followers', element: <ProfileFollowers /> },
        ],
      },
      { path: 'contents/new/:type', element: <ContentEditor /> },
      { path: 'contents/:id/edit', element: <ContentEditor /> },
      { path: 'contents/:id', element: <ContentDetail /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="/settings/account" replace /> },
          { path: 'account', element: <AccountSettings /> },
          { path: 'contents', element: <MyContents /> },
          { path: 'security', element: <SecuritySettings /> },
          { path: 'notifications', element: <NotificationSettings /> },
        ],
      },
    ],
  },
  // Admin routes
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/contents" replace /> },
      { path: 'contents', element: <AdminContents /> },
      { path: 'contents/new/:type', element: <AdminContentEditor /> },
      { path: 'contents/:id', element: <AdminContentEditor /> },
      { path: 'users', element: <AdminUsers /> },
      { path: 'categories', element: <AdminCategories /> },
      { path: 'import', element: <AdminImport /> },
      { path: 'sync', element: <AdminSync /> },
      { path: 'settings', element: <Navigate to="/admin/settings/auth" replace /> },
      { path: 'settings/auth', element: <SettingsAuth /> },
      { path: 'settings/storage', element: <SettingsStorage /> },
      { path: 'settings/wechat', element: <SettingsWechat /> },
    ],
  },
  // Error pages
  { path: '/forbidden', element: <Forbidden /> },
  { path: '/500', element: <ServerError /> },
  { path: '*', element: <NotFound /> },
]

export default routes
