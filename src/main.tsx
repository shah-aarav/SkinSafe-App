import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, useClerk, useUser } from '@clerk/react'
import App from './App'
import type { User } from './api'
import './styles.css'
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
function ConnectedApp(){
  const {user,isLoaded}=useUser()
  const clerk=useClerk()
  const account:User|null=user?{id:`clerk-${user.id}`,name:user.firstName||user.fullName||user.primaryEmailAddress?.emailAddress?.split('@')[0]||'there',email:user.primaryEmailAddress?.emailAddress||''}:null
  return <App clerkAccount={account} clerkReady={isLoaded} signOutClerk={()=>clerk.signOut()}/>
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{clerkKey?<ClerkProvider publishableKey={clerkKey} proxyUrl={`${window.location.origin}/__clerk`} appearance={{variables:{colorPrimary:'#d7bda9',colorPrimaryForeground:'#28201b',colorBackground:'#202020',colorForeground:'#f2efeb',colorMutedForeground:'#aaa6a2',colorInput:'#202020',colorInputForeground:'#f2efeb',colorBorder:'#514b46',borderRadius:'10px'}}}><ConnectedApp/></ClerkProvider>:<App clerkReady/>}</React.StrictMode>)
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister())).catch(()=>{}) })
