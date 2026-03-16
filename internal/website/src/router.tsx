import { Navigate, type RouteObject } from 'react-router-dom'

import MainLayout from 'src/layouts/MainLayout'
import AdminLayout from 'src/layouts/AdminLayout'
import Home from 'src/views/home'
import ContentDetail from 'src/views/contents/detail'
import ContentEditor from 'src/views/contents/editor'
import AdminContents from 'src/views/admin/contents'
import AdminContentEditor from 'src/views/admin/contents/editor'
import AdminUsers from 'src/views/admin/users'
import AdminImport from 'src/views/admin/import'
import AdminSync from 'src/views/admin/sync'
import AdminSettings from 'src/views/admin/settings'
import Init from 'src/views/init'
import Login from 'src/views/login'
import Register from 'src/views/register'
import NotFound from 'src/views/errors/NotFound'
import Forbidden from 'src/views/errors/Forbidden'
import ServerError from 'src/views/errors/ServerError'

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
      { path: 'learning', element: <Home /> },
      { path: 'culture', element: <Home /> },
      { path: 'contents/new', element: <ContentEditor /> },
      { path: 'contents/:id/edit', element: <ContentEditor /> },
      { path: 'contents/:id', element: <ContentDetail /> },
    ],
  },
  // Admin routes
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/contents" replace /> },
      { path: 'contents', element: <AdminContents /> },
      { path: 'contents/new', element: <AdminContentEditor /> },
      { path: 'contents/:id', element: <AdminContentEditor /> },
      { path: 'users', element: <AdminUsers /> },
      { path: 'import', element: <AdminImport /> },
      { path: 'sync', element: <AdminSync /> },
      { path: 'settings', element: <AdminSettings /> },
    ],
  },
  // Error pages
  { path: '/forbidden', element: <Forbidden /> },
  { path: '/500', element: <ServerError /> },
  { path: '*', element: <NotFound /> },
]

export default routes
