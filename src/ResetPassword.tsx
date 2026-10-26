import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSignIn } from '@clerk/react'

export default function ResetPassword() {
  const { signIn, fetchStatus } = useSignIn()
  const [step,setStep] = useState<'email'|'code'|'password'>('email')
  const [email,setEmail] = useState('')
  const [code,setCode] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const busy=fetchStatus==='fetching'

  async function send(event:FormEvent) {
    event.preventDefault();setError('')
    const created=await signIn.create({identifier:email.trim()})
    if(created.error){setError(created.error.message);return}
    const sent=await signIn.resetPasswordEmailCode.sendCode()
    if(sent.error){setError(sent.error.message);return}
    setStep('code')
  }
  async function verify(event:FormEvent) {
    event.preventDefault();setError('')
    if(!/^\d{6}$/.test(code)){setError('Enter the six-digit code from your email.');return}
    const result=await signIn.resetPasswordEmailCode.verifyCode({code})
    if(result.error){setError(result.error.message);return}
    setStep('password')
  }
  async function finish(event:FormEvent) {
    event.preventDefault();setError('')
    const result=await signIn.resetPasswordEmailCode.submitPassword({password,signOutOfOtherSessions:true})
    if(result.error){setError(result.error.message);return}
    if(signIn.status==='complete'){
      const finalized=await signIn.finalize({navigate:({decorateUrl})=>{window.location.assign(decorateUrl('/'))}})
      if(finalized.error)setError(finalized.error.message)
    }
  }
  return <form className="account-form" onSubmit={step==='email'?send:step==='code'?verify:finish}>
    {step==='email'&&<label className="field">Email address<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" required autoFocus/></label>}
    {step==='code'&&<><p className="reset-instruction">We sent a six-digit code to {email}.</p><label className="field">Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" required autoFocus/></label></>}
    {step==='password'&&<label className="field">New password<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 12 characters" required autoFocus/></label>}
    <button className="primary" disabled={busy}>{busy?'Please wait…':step==='email'?'Send code':step==='code'?'Verify code':'Set new password'}</button>
    {step==='code'&&<button className="account-switch" type="button" disabled={busy} onClick={()=>{setError('');void signIn.resetPasswordEmailCode.sendCode()}}>Send a new code</button>}
    {error&&<p className="feedback error" role="alert">{error}</p>}
  </form>
}
