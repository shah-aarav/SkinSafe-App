import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { askAboutResult } from './api'
import { answerQuestion } from './voice-answers'
import { voiceClipForAnswer } from './voice-clips'
import { voiceClips } from './voice-manifest'

function spokenText(value: string) {
  return value.replace(/\bBCC\b/g, 'B C C').replace(/\bSCC\b/g, 'S C C').replace(/\bOTC\b/g, 'over-the-counter').replace(/\b5-FU\b/g, 'five F U')
}

function preferredVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter(voice => /^en([_-]|$)/i.test(voice.lang))
  return english.sort((a, b) => {
    const score = (voice: SpeechSynthesisVoice) =>
      (/natural|premium|enhanced/i.test(voice.name) ? 20 : 0) +
      (/samantha|ava|jenny|aria|google us english/i.test(voice.name) ? 10 : 0) +
      (/^en[-_]US$/i.test(voice.lang) ? 3 : 0) +
      (voice.default ? 1 : 0)
    return score(b) - score(a)
  })[0]
}

export default function VoiceGuide({ flagged, warningSigns, referenceCode }: { flagged: boolean; warningSigns: boolean; referenceCode?: string }) {
  const prompts = referenceCode === 'BCC'
    ? ['What does this result mean?', 'What should I bring to my appointment?', 'What treatments should I ask about?']
    : referenceCode === 'SCC'
      ? ['What is squamous cell carcinoma?', 'What should I bring to my appointment?', 'What treatments should I ask about?']
      : referenceCode === 'NEV'
        ? ['What is a nevus?', 'What changes should I watch for?', 'Does this mole need medicine?']
        : referenceCode === 'ACK'
          ? ['What is actinic keratosis?', 'What treatments should I ask about?', 'What changes should I watch for?']
          : referenceCode === 'SEK'
            ? ['What is seborrheic keratosis?', 'Does it need medicine?', 'When should I see a dermatologist?']
            : referenceCode === 'MEL'
              ? ['What is melanoma?', 'What should I do next?', 'What treatments should I ask about?']
              : ['What does this result mean?', 'What changes should I watch for?', 'What should I bring to my appointment?']
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem('skinsafe-voice') || '')
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const supported = 'speechSynthesis' in window
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices().filter(voice => /^en([_-]|$)/i.test(voice.lang)))
    if (supported) {
      updateVoices()
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices)
    }
    return () => {
      requestId.current++
      if (supported) {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
        window.speechSynthesis.cancel()
      }
      audio.current?.pause()
    }
  }, [])

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    audio.current?.pause()
    audio.current = null
    utterance.current = null
    setSpeaking(false)
  }

  function deviceSpeak(value: string) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setVoiceError('Voice playback is unavailable in this browser.')
      return
    }
    stopSpeaking()
    setVoiceError('')
    const next = new SpeechSynthesisUtterance(spokenText(value))
    const selected = voices.find(voice => voice.name === voiceName) || preferredVoice(window.speechSynthesis.getVoices())
    if (selected) { next.voice = selected; next.lang = selected.lang }
    else next.lang = 'en-US'
    next.rate = 0.88
    next.pitch = 1
    next.onstart = () => { if (utterance.current === next) setSpeaking(true) }
    next.onend = () => { if (utterance.current === next) { utterance.current = null; setSpeaking(false) } }
    next.onerror = event => {
      if (utterance.current === next) {
        utterance.current = null
        setSpeaking(false)
        if (event.error !== 'interrupted' && event.error !== 'canceled') setVoiceError('Could not play this answer. Try another voice.')
      }
    }
    utterance.current = next
    window.speechSynthesis.speak(next)
  }

  function speak(value: string) {
    stopSpeaking()
    setVoiceError('')
    const filename = voiceClipForAnswer(value)
    if (!voiceName && voiceClips.has(filename)) {
      const player = new Audio(`/voice/${filename}`)
      audio.current = player
      player.playbackRate = 0.93
      player.onplay = () => { if (audio.current === player) setSpeaking(true) }
      player.onended = () => { if (audio.current === player) { audio.current = null; setSpeaking(false) } }
      player.onerror = () => { if (audio.current === player) { audio.current = null; deviceSpeak(value) } }
      void player.play().catch(() => { if (audio.current === player) { audio.current = null; deviceSpeak(value) } })
      return
    }
    deviceSpeak(value)
  }

  async function ask(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    const id = ++requestId.current
    stopSpeaking(); setLoading(true); setError(''); setAnswer(''); setAsked(trimmed); setQuestion(trimmed)
    try {
      const response = await askAboutResult(trimmed, { flagged, warningSigns }, referenceCode)
      if (id !== requestId.current) return
      setAnswer(response)
    } catch (cause) {
      if (id !== requestId.current) return
      if (cause instanceof Error && ['Answers are not connected yet.', 'Not found.'].includes(cause.message) && prompts.includes(trimmed)) {
        setAnswer(answerQuestion(trimmed, flagged, warningSigns, referenceCode === 'NEV' || referenceCode === 'BCC' ? referenceCode : undefined))
      } else setError(cause instanceof Error ? cause.message : 'Could not answer right now. Try again.')
    } finally { if (id === requestId.current) setLoading(false) }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(question) }
  function chooseVoice(name: string) {
    stopSpeaking()
    setVoiceName(name)
    localStorage.setItem('skinsafe-voice', name)
  }
  return <section className="voice-guide" aria-labelledby="voice-title"><h2 id="voice-title">Ask about your result</h2><div className="suggested-questions" aria-label="Suggested questions">{prompts.map(prompt => <button key={prompt} type="button" disabled={loading} onClick={() => void ask(prompt)}>{prompt}</button>)}</div><form onSubmit={submit}><label htmlFor="voice-question">Your question</label><div className="voice-input-row"><input id="voice-question" type="text" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about this result" maxLength={240}/></div><button className="secondary voice-ask" disabled={!question.trim() || loading}>{loading ? 'Thinking…' : 'Ask question'}</button></form>{error && <p className="error voice-note" role="alert">{error}</p>}{answer && <div className="voice-response" aria-live="polite"><p className="voice-asked">You asked: {asked}</p><p>{answer}</p><div className="voice-actions"><button type="button" className="text-button" onClick={() => speaking ? stopSpeaking() : speak(answer)}>{speaking ? 'Stop speaking' : 'Hear answer'}</button>{voices.length > 1 && <label className="voice-choice">Voice <select value={voices.some(voice => voice.name === voiceName) ? voiceName : ''} onChange={event => chooseVoice(event.target.value)}><option value="">Recommended</option>{voices.map(voice => <option key={voice.voiceURI} value={voice.name}>{voice.name}</option>)}</select></label>}</div>{voiceError && <p className="voice-note" role="status">{voiceError}</p>}</div>}</section>
}
