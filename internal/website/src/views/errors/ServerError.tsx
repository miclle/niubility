import { Link } from 'react-router-dom'
import { Button } from '@radix-ui/themes'

// ServerError displays the 500 error page.
function ServerError() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">500</h1>
        <p className="text-lg text-gray-500 mb-8">服务器内部错误</p>
        <Button asChild size="3">
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    </div>
  )
}

export default ServerError
