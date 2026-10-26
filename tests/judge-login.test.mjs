import test from 'node:test'
import assert from 'node:assert/strict'
import { GET, POST } from '../api/login.js'
import { hasSession, sessionUser } from '../lib/judge-session.js'

test('Aarav and judges have separate signed accounts', async () => {
  const previous=process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY='local-test-secret'
  try {
    for(const [username,password,name] of [['skinsafeapp','skinsafe','Aarav'],['skinsafe2026','skinsafe2026','User']]){
      const response=await POST(new Request('https://skinsafe.test/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}))
      assert.equal(response.status,200)
      const body=await response.json()
      assert.equal(body.user.id,username)
      assert.equal(body.user.name,name)
      const cookie=response.headers.get('set-cookie').split(';')[0]
      const request=new Request('https://skinsafe.test/api/login',{headers:{cookie}})
      assert.equal(hasSession(request,process.env.GROQ_API_KEY),true)
      assert.equal(sessionUser(request,process.env.GROQ_API_KEY).id,username)
      const restored=await GET(request)
      assert.equal((await restored.json()).user.name,name)
      const tampered=new Request('https://skinsafe.test/api/login',{headers:{cookie:cookie.replace(username,username==='skinsafeapp'?'skinsafe2026':'skinsafeapp')}})
      assert.equal(sessionUser(tampered,process.env.GROQ_API_KEY),null)
    }
    const wrong=await POST(new Request('https://skinsafe.test/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'skinsafe2026',password:'skinsafe'})}))
    assert.equal(wrong.status,401)
  } finally {
    if(previous===undefined)delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY=previous
  }
})
