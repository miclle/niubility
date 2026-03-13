import { Link } from 'react-router-dom'

// NotFound displays the 404 error page.
function NotFound() {
  return (
    <div className="mesh-gradient min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="relative z-10 text-center">
        <h1 className="text-[10rem] leading-none font-black gradient-text animate-float mb-4">404</h1>
        <p className="text-lg text-zinc-500 mb-8">页面不存在</p>
        <Link to="/" className="glow-button">返回首页</Link>
      </div>
    </div>
  )
}

export default NotFound
