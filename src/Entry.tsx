import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, register } from './api'
import type { User } from './api'

function Arrow() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
}

export function SpotGraphic({ compact = false }: { compact?: boolean }) {
  return <svg className={`spot-graphic ${compact ? 'compact' : ''}`} viewBox="0 0 400 350" fill="none" aria-hidden="true">
    <circle cx="200" cy="175" r="139" stroke="currentColor" strokeOpacity=".12"/>
    <circle cx="200" cy="175" r="105" stroke="currentColor" strokeOpacity=".2"/>
    <path d="M155 126c23-28 64-25 88-6 25 20 35 46 20 75-15 30-45 49-77 34-30-14-62-43-47-74 4-9 10-20 16-29Z" fill="#b99a88" fillOpacity=".16" stroke="#b99a88" strokeWidth="1.5"/>
    <path d="M176 147c13-13 33-11 46 1 16 15 22 33 10 47-12 14-35 17-49 4-15-14-22-36-7-52Z" fill="#b99a88" fillOpacity=".5"/>
    <path d="M91 110V75h35m148 0h35v35M91 240v35h35m148 0h35v-35" stroke="#d7bda9" strokeWidth="2"/>
    <path d="M185 175h30m-15-15v30" stroke="#eddbca" strokeWidth="1.4"/>
    <circle cx="309" cy="175" r="4" fill="#d7bda9"/>
  </svg>
}

export default function Entry({ onAuth }: { onAuth: (user: User) => void }) {
  const judgeMode=import.meta.env.VITE_JUDGE_PORTAL==='1'
  const [mode, setMode] = useState<'welcome' | 'signup' | 'login'>(judgeMode?'login':'welcome')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try { onAuth(mode === 'signup' ? await register(name.trim(),email.trim(),password) : await login(email.trim(),password)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  const changeMode = (next: typeof mode) => { setError(''); setPassword(''); setConfirm(''); setMode(next) }
  return <div className="entry-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="entry-header"><a className="brand" href="#" onClick={e=>{e.preventDefault();changeMode('welcome')}}><span className="brand-symbol"/>SkinSafe</a><span className="device-label">Your skin. Your record.</span></header>
    <main id="main-content" className="entry-layout">
      <section className="entry-art"><SpotGraphic/><div className="art-caption"><span className="caption-line"/><p>A closer look starts here.</p></div></section>
      <section className="entry-content" aria-labelledby="entry-title">
        {mode==='welcome'?<>
          <h1 id="entry-title">A little attention.<br/><span>A clearer record.</span></h1>
          <p className="entry-description">Keep a photo and a few details about your skin, all in one place.</p>
          <div className="entry-actions"><button className="primary" onClick={()=>changeMode('signup')}>Create account<Arrow/></button><button className="secondary" onClick={()=>changeMode('login')}>Log in</button></div>
        </>:<>
          {!judgeMode&&<button className="back" onClick={()=>changeMode('welcome')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Back</button>}
          <h1 id="entry-title">{mode==='signup'?'Create your account.':'Welcome back.'}</h1>
          <p className="entry-description">{mode==='signup'?'Keep your skin records under one account.':'Log in to your records.'}</p>
          <form className="account-form" onSubmit={submit}>
            {mode==='signup'&&<label className="field">Your name<input autoComplete="name" maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Name" required autoFocus/></label>}
            <label className="field">{mode==='login'?'Email or username':'Email'}<input type={mode==='login'?'text':'email'} autoComplete="username" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder={mode==='login'?'Email or username':'you@example.com'} required autoFocus={mode==='login'}/></label>
            <label className="field">Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?12:undefined} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup'?'At least 12 characters':'Password'} required/></label>
            {mode==='signup'&&<label className="field">Confirm password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" aria-invalid={error==='Passwords do not match.'} aria-describedby={error==='Passwords do not match.'?'account-error':undefined} required/></label>}
            <button className="primary" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':'Log in'}<Arrow/></button>
          </form>
          {error&&<p id="account-error" className="feedback error" role="alert">{error}</p>}
          {!judgeMode&&<button className="account-switch" onClick={()=>changeMode(mode==='signup'?'login':'signup')}>{mode==='signup'?'Already have an account? Log in':'New here? Create an account'}</button>}
        </>}
      </section>
    </main>
    <footer className="entry-footer"><span>Made for your everyday care.</span><span>A skin record, not a diagnosis.</span></footer>
  </div>
}
