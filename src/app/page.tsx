import { redirect } from 'next/navigation'

/**
 * Root page - redirects to test page for backend verification
 */
export default function HomePage() {
  redirect('/test')
}
