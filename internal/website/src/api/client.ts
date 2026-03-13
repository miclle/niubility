import axios from 'axios'

// client is the pre-configured axios instance for API calls.
const client = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

// Intercept 401 responses to redirect to SSO login.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/sso?redirect=' + encodeURIComponent(window.location.pathname)
    }
    return Promise.reject(error)
  },
)

export default client
