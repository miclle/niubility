import type { RouteObject } from 'react-router-dom'

import App from './App.tsx'

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [],
  },
]

export default routes
