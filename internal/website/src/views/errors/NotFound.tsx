import { Link } from 'react-router-dom'
import { Button } from '@radix-ui/themes'

// NotFound displays the 404 error page.
function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <p className="text-lg text-gray-500 mb-8">页面不存在</p>
        <Button asChild size="3">
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    </div>
  )
}

export default NotFound
