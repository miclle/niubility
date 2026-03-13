import { Navigate, type RouteObject } from 'react-router-dom'

import MainLayout from 'src/layouts/MainLayout'
import AdminLayout from 'src/layouts/AdminLayout'
import Home from 'src/views/home'
import ContentDetail from 'src/views/contents/[id]'
import AdminContents from 'src/views/admin/contents'
import ContentEditor from 'src/views/admin/contents/editor'
import AdminUsers from 'src/views/admin/users'
import NotFound from 'src/views/errors/NotFound'
import Forbidden from 'src/views/errors/Forbidden'
import ServerError from 'src/views/errors/ServerError'

const routes: RouteObject[] = [
  // Frontend routes
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/learning" replace /> },
      { path: 'learning', element: <Home /> },
      { path: 'culture', element: <Home /> },
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
      { path: 'contents/new', element: <ContentEditor /> },
      { path: 'contents/:id', element: <ContentEditor /> },
      { path: 'users', element: <AdminUsers /> },
    ],
  },
  // Error pages
  { path: '/forbidden', element: <Forbidden /> },
  { path: '/500', element: <ServerError /> },
  { path: '*', element: <NotFound /> },
]

export default routes
