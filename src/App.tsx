import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownToLine, ArrowRight, BarChart3, BookOpen, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, ChevronRight,
  FilePlus2, FileText, Github, Globe2, Home, LayoutDashboard, LockKeyhole, Menu, Plus, RotateCcw, ShieldCheck,
  Sparkles, Target, Trash2, Upload, X,
} from 'lucide-react'
import { evaluateResume, type Recommendation, type ResumeEvaluation, type Severity } from './domain/scoring'
import { createEmptyResume, parseResumeText, ResumeSchema, resumeToText, type Experience, type Resume, type ResumeTemplate } from './domain/resume'
import { compareResumeToJob, type JobMatchResult } from './domain/jobMatch'
import { ruleBasedProvider } from './services/ai/providers'
import { detectLocale, translate, type Locale, type TranslationKey } from './i18n'
import { clearLocal, readLocal, writeLocal } from './services/storage'

type Page = 'home' | 'analyze' | 'builder' | 'impact' | 'match' | 'library' | 'settings' | 'about' | 'privacy' | 'methodology'
type PersistedData = {
  resume: Resume
  versions: Resume[]
  locale: Locale
  draftText: string
  resolved: string[]
  history: ResumeEvaluation[]
}

const pageIcons = {
  home: Home,
  analyze: BarChart3,
  builder: FilePlus2,
  impact: Sparkles,
  match: Target,
  library: LayoutDashboard,
  settings: Globe2,
  about: BookOpen,
  privacy: ShieldCheck,
  methodology: FileText,
}

const routePaths: Record<Page, string> = {
  home: '/', analyze: '/resume-analyzer', builder: '/resume-builder', impact: '/career-impact',
  match: '/job-match', library: '/my-resumes', settings: '/settings', about: '/about',
  privacy: '/privacy', methodology: '/scoring-methodology',
}

const EMPTY_RECOMMENDATIONS: Recommendation[] = []

function pageFromPath(path: string): Page {
  const match = (Object.entries(routePaths) as [Page, string][]).find(([, route]) => route === path.replace(/\/+$/, '') || route === path)
  return match?.[0] ?? 'home'
}

function severityText(locale: Locale, severity: Severity): string {
  const keys: Record<Severity, TranslationKey> = { Critical: 'priorityCritical', High: 'priorityHigh', Medium: 'priorityMedium', Low: 'priorityLow' }
  return translate(locale, keys[severity])
}

function titleFor(locale: Locale, page: Page): string {
  const keys: Record<Page, TranslationKey> = {
    home: 'navHome', analyze: 'navAnalyze', builder: 'navBuilder', impact: 'navImpact', match: 'navMatch',
    library: 'navLibrary', settings: 'settings', about: 'about', privacy: 'privacyPolicy', methodology: 'methodology',
  }
  return translate(locale, keys[page])
}

const questionKeys: { id: string; key: TranslationKey }[] = [
  { id: 'contribution', key: 'contribution' }, { id: 'context', key: 'context' },
  { id: 'outcome', key: 'outcome' }, { id: 'scale', key: 'scale' },
]

function App() {
  const [page, setPage] = useState<Page>(() => typeof window === 'undefined' ? 'home' : pageFromPath(window.location.pathname))
  const [mobileNav, setMobileNav] = useState(false)
  const [resume, setResume] = useState<Resume>(() => createEmptyResume())
  const [versions, setVersions] = useState<Resume[]>([])
  const [locale, setLocale] = useState<Locale>(() => detectLocale())
  const [draftText, setDraftText] = useState('')
  const [evaluation, setEvaluation] = useState<ResumeEvaluation | null>(null)
  const [history, setHistory] = useState<ResumeEvaluation[]>([])
  const [resolved, setResolved] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')
  const [isLoaded, setIsLoaded] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedExperience, setSelectedExperience] = useState('')
  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [impactDraft, setImpactDraft] = useState('')
  const [jobText, setJobText] = useState('')
  const [jobMatch, setJobMatch] = useState<JobMatchResult | null>(null)
  const skipNextSave = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const backupInput = useRef<HTMLInputElement>(null)
  const t = (key: TranslationKey) => translate(locale, key)

  useEffect(() => {
    let active = true
    readLocal<PersistedData>('app-data')
      .then((saved) => {
        if (!active) return
        if (saved) {
          setResume(saved.resume)
          setVersions(saved.versions ?? [])
          setLocale(saved.locale ?? detectLocale())
          setDraftText(saved.draftText ?? saved.resume.rawText)
          setResolved(saved.resolved ?? [])
          setHistory(saved.history ?? [])
        }
      })
      .catch(() => {
        if (active) setStorageAvailable(false)
      })
      .finally(() => {
        if (active) setIsLoaded(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!isLoaded || !storageAvailable) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    setSaving(true)
    const timer = window.setTimeout(() => {
      writeLocal<PersistedData>('app-data', { resume, versions, locale, draftText, resolved, history })
        .then(() => setSaving(false))
        .catch(() => {
          setStorageAvailable(false)
          setSaving(false)
          setError(translate(locale, 'storageUnavailable'))
        })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [resume, versions, locale, draftText, resolved, history, isLoaded, storageAvailable])

  const recommendations = evaluation?.recommendations ?? EMPTY_RECOMMENDATIONS
  const visibleRecommendations = useMemo(() => recommendations.filter((item) => {
    if (filter === 'open') return !resolved.includes(item.id)
    if (filter === 'resolved') return resolved.includes(item.id)
    return true
  }), [recommendations, filter, resolved])

  function navigate(next: Page) {
    if (window.location.pathname !== routePaths[next]) window.history.pushState({ page: next }, '', routePaths[next])
    setPage(next)
    setMobileNav(false)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateResume(updater: (current: Resume) => Resume) {
    const updated = updater(resume)
    updated.updatedAt = new Date().toISOString()
    updated.rawText = resumeToText(updated)
    setResume(updated)
    setDraftText(updated.rawText)
    setEvaluation(null)
  }

  function loadText(text: string) {
    setDraftText(text)
    setError('')
    const parsed = parseResumeText(text)
    setResume((current) => ({ ...parsed, id: current.id, updatedAt: new Date().toISOString() }))
  }

  function runAnalysis() {
    if (draftText.trim().length < 40) {
      setError(t('textTooShort'))
      setEvaluation(null)
      return
    }
    const parsed = parseResumeText(draftText)
    setResume((current) => ({ ...parsed, id: current.id, updatedAt: new Date().toISOString() }))
    const result = evaluateResume(draftText, parsed)
    setEvaluation(result)
    setHistory((items) => [result, ...items].slice(0, 20))
    setResolved([])
    setError('')
  }

  async function handleFile(file?: File) {
    if (!file) return
    setError('')
    setProgress(1)
    try {
      const { extractResumeFile } = await import('./services/parsers')
      const text = await extractResumeFile(file, setProgress)
      loadText(text)
      navigate('analyze')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('fileError'))
    } finally {
      setProgress(0)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function startBlankResume() {
    const next = createEmptyResume()
    setResume(next)
    setDraftText('')
    setEvaluation(null)
    setError('')
    navigate('builder')
  }

  function saveVersion() {
    setVersions((current) => [{ ...resume, updatedAt: new Date().toISOString() }, ...current].slice(0, 20))
    setError('')
  }

  function createTailoredCopy() {
    setVersions((current) => [{ ...resume, updatedAt: new Date().toISOString() }, ...current].slice(0, 20))
    const copy = { ...resume, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }
    setResume(copy)
    setDraftText('')
    setEvaluation(null)
    navigate('builder')
  }

  async function importBackup(file?: File) {
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      const parsed = ResumeSchema.safeParse(data)
      if (!parsed.success) throw new Error(t('invalidJson'))
      const imported: Resume = { ...parsed.data, rawText: '' }
      imported.rawText = resumeToText(imported)
      setResume(imported)
      setDraftText(imported.rawText)
      setEvaluation(null)
      setError('')
      navigate('builder')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('invalidJson'))
    } finally {
      if (backupInput.current) backupInput.current.value = ''
    }
  }

  function resolveRecommendation(item: Recommendation) {
    setResolved((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])
  }

  function buildImpactDraft() {
    const experience = resume.experiences.find((item) => item.id === selectedExperience)
    if (!experience) return
    const confirmedAnswers = questionKeys
      .map((question) => answers[question.id])
      .filter((answer): answer is string => Boolean(answer?.trim()))
    const detail = confirmedAnswers.map((answer) => `• ${answer.trim()}`).join('\n')
    setImpactDraft(detail ? `${experience.description.trim()}${experience.description.trim() ? '\n' : ''}${detail}` : experience.description)
  }

  function acceptImpactDraft() {
    if (!selectedExperience || !impactDraft.trim()) return
    updateResume((current) => ({
      ...current,
      experiences: current.experiences.map((item) => item.id === selectedExperience ? { ...item, description: impactDraft.trim() } : item),
    }))
    setImpactDraft('')
    setAnswers({})
    setEvaluation(null)
    navigate('builder')
  }

  function compareJob() {
    if (!resume.rawText && !resume.name && !resume.experiences.length) {
      setError(t('noResume'))
      return
    }
    const result = compareResumeToJob(resume.rawText || resumeToText(resume), jobText)
    setJobMatch(result)
    setError('')
  }

  async function deleteAllData() {
    if (!window.confirm(t('clearConfirm'))) return
    try {
      await clearLocal()
      skipNextSave.current = true
      setResume(createEmptyResume())
      setVersions([])
      setDraftText('')
      setEvaluation(null)
      setHistory([])
      setResolved([])
      setJobText('')
      setJobMatch(null)
      setStorageAvailable(true)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('storageUnavailable'))
    }
  }

  const navGroups: { items: Page[] }[] = [
    { items: ['home', 'analyze', 'builder', 'impact', 'match', 'library'] },
    { items: ['about', 'methodology', 'privacy', 'settings'] },
  ]

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => navigate('home')} aria-label="BeyondCV home">
          <span className="brand-mark" aria-hidden="true">b<span>.</span></span>
          <span className="brand-name">BeyondCV</span>
        </button>
        <div className="sidebar-note">YOUR CAREER, CLEARER</div>
        <nav aria-label="Main navigation">
          {navGroups.map((group, groupIndex) => (
            <div className={`nav-group ${groupIndex ? 'nav-group-secondary' : ''}`} key={groupIndex}>
              {group.items.map((item) => {
                const Icon = pageIcons[item]
                return (
                  <button key={item} className={`nav-item ${page === item ? 'nav-active' : ''}`} onClick={() => navigate(item)}>
                    <Icon size={17} strokeWidth={1.8} /><span>{titleFor(locale, item)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-chip"><LockKeyhole size={15} /><span>Private by default</span><Check size={14} /></div>
          <div className="sidebar-version">BeyondCV <span>v0.1.0</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={t('menu')} onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>BeyondCV</span><ChevronRight size={14} /><strong>{titleFor(locale, page)}</strong></div>
          <div className="topbar-actions">
            <span className={`save-indicator ${storageAvailable ? '' : 'save-warning'}`}><span className="status-dot" />{saving ? t('saving') : storageAvailable ? t('saveStatus') : t('storageUnavailable')}</span>
            <label className="language-select" aria-label={t('languageMenu')}>
              <Globe2 size={15} />
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t('language')}>
                <option value="en">EN</option><option value="pt">PT</option><option value="es">ES</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="error-banner" role="alert"><CircleAlert />{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
          {page === 'home' && <HomePage t={t} navigate={navigate} onCreate={startBlankResume} onFile={handleFile} progress={progress} />}
          {page === 'analyze' && (
            <AnalyzePage
              t={t} text={draftText} setText={setDraftText} onAnalyze={runAnalysis} onFile={() => fileInput.current?.click()}
              progress={progress} isDragging={isDragging} setIsDragging={setIsDragging} onDrop={handleFile}
              evaluation={evaluation} resolved={resolved} onResolve={resolveRecommendation} filter={filter} setFilter={setFilter}
              visibleRecommendations={visibleRecommendations} locale={locale}
            />
          )}
          {page === 'builder' && <BuilderPage t={t} resume={resume} updateResume={updateResume} onSaveVersion={saveVersion} onPdf={() => void import('./services/exports').then(({ exportResumePdf }) => exportResumePdf(resume))} onDocx={() => void import('./services/exports').then(({ exportResumeDocx }) => exportResumeDocx(resume))} onJson={() => void import('./services/exports').then(({ exportResumeJson }) => exportResumeJson(resume))} onImport={() => backupInput.current?.click()} />}
          {page === 'impact' && <ImpactPage t={t} resume={resume} selectedExperience={selectedExperience} setSelectedExperience={setSelectedExperience} answers={answers} setAnswers={setAnswers} impactDraft={impactDraft} setImpactDraft={setImpactDraft} onBuild={buildImpactDraft} onAccept={acceptImpactDraft} />}
          {page === 'match' && <MatchPage t={t} resume={resume} jobText={jobText} setJobText={setJobText} onCompare={compareJob} onCreateCopy={createTailoredCopy} result={jobMatch} />}
          {page === 'library' && <LibraryPage t={t} resume={resume} versions={versions} onOpen={(item) => { setResume(item); setDraftText(item.rawText || resumeToText(item)); navigate('builder') }} onSave={saveVersion} />}
          {page === 'settings' && <SettingsPage t={t} storageAvailable={storageAvailable} onDelete={deleteAllData} onBackup={() => void import('./services/exports').then(({ exportResumeJson }) => exportResumeJson(resume))} />}
          {page === 'about' && <InfoPage t={t} kind="about" />}
          {page === 'privacy' && <InfoPage t={t} kind="privacy" />}
          {page === 'methodology' && <InfoPage t={t} kind="methodology" />}
        </div>
        <footer className="page-footer"><span>BeyondCV · {t('copy')}</span><button onClick={() => navigate('privacy')}>{t('privacyPolicy')}</button><span>MIT</span></footer>
      </main>
      <input ref={fileInput} className="visually-hidden" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => void handleFile(event.target.files?.[0])} />
      <input ref={backupInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} />
    </div>
  )
}

function CircleAlert() {
  return <span aria-hidden="true" className="alert-icon">!</span>
}

function HomePage({ t, navigate, onCreate, onFile, progress }: { t: (key: TranslationKey) => string; navigate: (page: Page) => void; onCreate: () => void; onFile: (file?: File) => void; progress: number }) {
  const features: { label: TranslationKey; icon: typeof LockKeyhole }[] = [
    { label: 'free', icon: CheckCircle2 }, { label: 'open', icon: Github }, { label: 'privacy', icon: LockKeyhole }, { label: 'ats', icon: FileText }, { label: 'noAccount', icon: ShieldCheck },
  ]
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> A MORE HUMAN WAY TO MOVE FORWARD</div>
          <h1>{t('heroTitle')}</h1>
          <p className="hero-subtitle">{t('heroSubtitle')}</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => navigate('analyze')}>{t('analyzeAction')}<ArrowRight size={16} /></button>
            <button className="button button-secondary" onClick={onCreate}>{t('create')}<FilePlus2 size={16} /></button>
          </div>
          <div className="hero-trust"><LockKeyhole size={14} /> Your resume never leaves this device</div>
        </div>
        <div className="hero-art" aria-label="Example resume score preview">
          <div className="score-preview">
            <div className="preview-top"><div><span className="preview-kicker">RESUME SNAPSHOT</span><strong>Professional profile</strong></div><span className="preview-menu">···</span></div>
            <div className="preview-person"><span className="avatar">JD</span><div><strong>Jordan Davis</strong><span>Product designer · 6 years</span></div></div>
            <div className="preview-score-row"><div className="score-ring"><strong>78</strong><span>/100</span></div><div className="score-description"><strong>Room to grow</strong><span>Clear strengths, with a few ways to make your impact easier to see.</span></div></div>
            <div className="preview-divider" />
            <div className="preview-metrics"><span><i className="metric-dot green" /> Strong signals</span><b>06</b><span><i className="metric-dot amber" /> Opportunities</span><b>03</b></div>
            <div className="preview-progress"><span style={{ width: '78%' }} /></div>
            <div className="preview-note"><Sparkles size={14} /> Based on transparent, explainable rules</div>
          </div>
          <div className="floating-note"><span className="floating-check"><Check size={15} /></span><span><strong>Your story, your words</strong><small>Never invent a metric</small></span></div>
        </div>
      </section>
      <section className="trust-row" aria-label="Product principles">
        {features.map(({ label, icon: Icon }) => <span key={label}><Icon size={15} />{t(label)}</span>)}
      </section>
      <section className="home-lower">
        <div className="section-heading"><span className="eyebrow">A PRACTICAL PLACE TO START</span><h2>One thoughtful step at a time.</h2><p>Bring what you have. Leave with a clearer next step.</p></div>
        <div className="action-grid">
          <ActionCard icon={BarChart3} index="01" title={t('analyzeAction')} copy="Get specific feedback on clarity, structure and evidence of impact." action="Open analyzer" onClick={() => navigate('analyze')} />
          <ActionCard icon={FilePlus2} index="02" title={t('create')} copy="Build a clean, readable resume and keep it on your device." action="Open builder" onClick={onCreate} />
          <ActionCard icon={BriefcaseBusiness} index="03" title={t('matchAction')} copy="See which job requirements are present in your resume text." action="Compare a role" onClick={() => navigate('match')} />
        </div>
      </section>
      <section className="privacy-callout"><span className="privacy-icon"><LockKeyhole size={20} /></span><div><strong>{t('privacyTitle')}</strong><p>{t('privacyText')}</p></div><button className="text-button" onClick={() => navigate('privacy')}>Read our privacy approach<ArrowRight size={15} /></button></section>
      <section className="quick-import"><div><span className="eyebrow">ALREADY HAVE A RESUME?</span><h2>Start with the experience you already have.</h2></div><button className="button button-secondary" onClick={() => document.getElementById('home-file')?.click()}><Upload size={15} />{t('upload')}</button><input id="home-file" className="visually-hidden" type="file" accept=".pdf,.docx,.txt" onChange={(event) => onFile(event.target.files?.[0])} />{progress > 0 && <span>{progress}%</span>}</section>
      <div className="mission-line">A free, open-source project built to make career tools more accessible.</div>
    </div>
  )
}

function ActionCard({ icon: Icon, index, title, copy, action, onClick }: { icon: typeof BarChart3; index: string; title: string; copy: string; action: string; onClick: () => void }) {
  return <button className="action-card" onClick={onClick}><div className="action-card-top"><span className="action-card-icon"><Icon size={18} /></span><span>{index}</span></div><strong>{title}</strong><p>{copy}</p><span className="action-card-link">{action}<ArrowRight size={14} /></span></button>
}

function AnalyzePage(props: {
  t: (key: TranslationKey) => string; text: string; setText: (text: string) => void; onAnalyze: () => void; onFile: () => void; progress: number
  isDragging: boolean; setIsDragging: (value: boolean) => void; onDrop: (file?: File) => void
  evaluation: ResumeEvaluation | null; resolved: string[]; onResolve: (item: Recommendation) => void
  filter: 'all' | 'open' | 'resolved'; setFilter: (filter: 'all' | 'open' | 'resolved') => void
  visibleRecommendations: Recommendation[]; locale: Locale
}) {
  const { t } = props
  const [openDetails, setOpenDetails] = useState(true)
  return (
    <div className="work-page">
      <PageIntro eyebrow="YOUR NEXT STEP" title={t('analyzeTitle')} description={t('analyzeIntro')} />
      <section className={`upload-panel ${props.isDragging ? 'drag-active' : ''}`} onDragOver={(event) => { event.preventDefault(); props.setIsDragging(true) }} onDragLeave={() => props.setIsDragging(false)} onDrop={(event) => { event.preventDefault(); props.setIsDragging(false); props.onDrop(event.dataTransfer.files[0]) }}>
        <div className="upload-title"><div className="upload-icon"><FileText size={19} /></div><div><strong>Start with a resume</strong><span>Your file is read in your browser and never uploaded.</span></div></div>
        <button className="button button-secondary" onClick={props.onFile}><Upload size={16} />{t('upload')}</button>
        <div className="drop-hint">{t('drop')} <span>· 10 MB max</span></div>
        {props.progress > 0 && <div className="upload-progress" role="status"><span style={{ width: `${props.progress}%` }} />{props.progress}%</div>}
      </section>
      <label className="field-label" htmlFor="resume-text">{t('paste')} <span>PDF, DOCX and TXT are supported</span></label>
      <textarea id="resume-text" className="resume-textarea" value={props.text} onChange={(event) => props.setText(event.target.value)} placeholder="Paste your resume text here. You can edit the extracted text before running the analysis." />
      <div className="analyze-controls"><span>{props.text.trim().length} characters · processed on this device</span><button className="button button-primary" onClick={props.onAnalyze}><Sparkles size={16} />{t('analyzeButton')}<ArrowRight size={15} /></button></div>
      {props.evaluation ? (
        <div className="analysis-results">
          <section className="dashboard-summary">
            <div className="score-overview">
              <div className={`big-score ${props.evaluation.overall === null ? 'score-na' : ''}`}><strong>{props.evaluation.overall ?? '—'}</strong><span>{props.evaluation.overall === null ? 'NOT SCORED' : '/ 100'}</span></div>
              <div><span className="eyebrow">BEYONDCV REVIEW · RULES {props.evaluation.version}</span><h2>{t('score')}</h2><p>{t('scoreNotice')}</p></div>
            </div>
            <div className="score-counts"><div><span>{props.evaluation.recommendations.length.toString().padStart(2, '0')}</span><small>{t('recommendations')}</small></div><div><span>{props.evaluation.strengths.length.toString().padStart(2, '0')}</span><small>{t('strengths')}</small></div></div>
          </section>
          <section className="results-grid">
            <div className="panel category-panel"><PanelHeading title={t('categories')} caption="Weighted, deterministic checks" /><div className="category-list">{props.evaluation.categories.map((category) => <div className="category-row" key={category.id}><div className="category-meta"><strong>{category.label}</strong><span>{category.weight}% weight{category.note ? ` · ${category.note}` : ''}</span></div><div className="category-bar"><i style={{ width: `${category.score ?? 0}%` }} /></div><strong className="category-number">{category.score === null ? 'N/A' : category.score}</strong></div>)}</div></div>
            <div className="panel strengths-panel"><PanelHeading title={t('strengths')} caption="Evidence detected in your text" />{props.evaluation.strengths.length ? <ul className="clean-list">{props.evaluation.strengths.map((strength) => <li key={strength}><CheckCircle2 size={16} />{strength}</li>)}</ul> : <p className="muted-copy">No strengths could be confirmed from the extracted text yet.</p>}<PanelHeading title={t('limitations')} caption="What this score cannot tell you" /><ul className="limits-list">{props.evaluation.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>
          <section className="recommendations-section">
            <div className="recommendations-head"><div><span className="eyebrow">A PRIORITIZED PLAN</span><h2>{t('recommendations')}</h2><p>Resolve findings by improving the resume text, then run a fresh analysis. Marking an item resolved does not change your score.</p></div><button className="button button-quiet" onClick={props.onAnalyze}><RotateCcw size={15} />Recalculate</button></div>
            <div className="filter-tabs" role="group" aria-label="Filter recommendations">
              {(['all', 'open', 'resolved'] as const).map((filter) => <button key={filter} className={props.filter === filter ? 'filter-active' : ''} onClick={() => props.setFilter(filter)}>{filter === 'all' ? t('all') : filter === 'open' ? 'Open' : t('resolved')} <span>{filter === 'all' ? props.evaluation?.recommendations.length : filter === 'open' ? (props.evaluation?.recommendations.length ?? 0) - props.resolved.length : props.resolved.length}</span></button>)}
            </div>
            {props.visibleRecommendations.length ? <div className="recommendation-list">{props.visibleRecommendations.map((item) => <RecommendationCard key={item.id} item={item} locale={props.locale} resolved={props.resolved.includes(item.id)} onResolve={() => props.onResolve(item)} t={t} />)}</div> : <div className="empty-state"><CheckCircle2 size={22} /><strong>No recommendations in this filter</strong><span>Try another filter or review the resume text again.</span></div>}
          </section>
        </div>
      ) : <div className="analysis-empty"><div className="empty-score">—</div><div><strong>{t('analysisEmpty')}</strong><p>PDF extraction can miss content in scanned documents or complex columns. Check the text above before you continue.</p></div></div>}
      <div className="method-note"><ShieldCheck size={16} /><span>This proprietary project score is not a certification, a universal measure of ATS behavior, or a hiring prediction.</span><button onClick={() => setOpenDetails(!openDetails)}>{openDetails ? 'Hide' : 'Read'} details</button></div>
      {openDetails && <div className="method-details">Rules version {props.evaluation?.version ?? '1.0.0'} uses seven weighted categories. Categories that cannot be assessed are excluded from the weighted average. Dates and phone numbers are not counted as impact metrics. No AI or external service is used.</div>}
    </div>
  )
}

function RecommendationCard({ item, locale, resolved, onResolve, t }: { item: Recommendation; locale: Locale; resolved: boolean; onResolve: () => void; t: (key: TranslationKey) => string }) {
  return (
    <article className={`recommendation-card ${resolved ? 'recommendation-resolved' : ''}`}>
      <div className="recommendation-top"><span className={`priority priority-${item.severity.toLowerCase()}`}>{severityText(locale, item.severity)}</span><span className="recommendation-category">{item.category}</span><button className={`resolve-button ${resolved ? 'is-resolved' : ''}`} onClick={onResolve}>{resolved ? <CheckCircle2 size={15} /> : <Check size={15} />}{resolved ? t('resolved') : t('markResolved')}</button></div>
      <h3>{item.title}</h3><p className="recommendation-problem">{item.problem}</p>
      {item.original && <div className="original-quote"><span>{t('original')}</span><p>“{item.original}”</p></div>}
      <div className="recommendation-explanation"><p><strong>{t('problem')}:</strong> {item.explanation}</p><p><strong>Why it matters:</strong> {item.relevance}</p><p><strong>{t('action')}:</strong> {item.action}</p></div>
      {item.suggestion && <div className="suggestion-box"><Sparkles size={15} /><span>{item.suggestion} <em>Confirm every detail before using it.</em></span></div>}
      {item.questions.length > 0 && <details className="question-details"><summary>{t('questions')}<ChevronDown size={15} /></summary><ul>{item.questions.map((question) => <li key={question}>{question}</li>)}</ul></details>}
    </article>
  )
}

function BuilderPage({ t, resume, updateResume, onSaveVersion, onPdf, onDocx, onJson, onImport }: {
  t: (key: TranslationKey) => string; resume: Resume; updateResume: (updater: (current: Resume) => Resume) => void
  onSaveVersion: () => void; onPdf: () => void; onDocx: () => void; onJson: () => void; onImport: () => void
}) {
  function setField<K extends keyof Resume>(field: K, value: Resume[K]) {
    updateResume((current) => ({ ...current, [field]: value }))
  }
  function updateExperience(id: string, field: keyof Experience, value: string) {
    updateResume((current) => ({ ...current, experiences: current.experiences.map((item) => item.id === id ? { ...item, [field]: value } : item) }))
  }
  function addExperience() {
    const entry: Experience = { id: crypto.randomUUID(), role: '', company: '', dates: '', description: '' }
    updateResume((current) => ({ ...current, experiences: [...current.experiences, entry] }))
  }
  function removeExperience(id: string) {
    updateResume((current) => ({ ...current, experiences: current.experiences.filter((item) => item.id !== id) }))
  }
  function moveExperience(id: string, direction: -1 | 1) {
    updateResume((current) => {
      const index = current.experiences.findIndex((item) => item.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.experiences.length) return current
      const experiences = [...current.experiences]
      ;[experiences[index], experiences[nextIndex]] = [experiences[nextIndex]!, experiences[index]!]
      return { ...current, experiences }
    })
  }
  function moveSection(key: string, direction: -1 | 1) {
    updateResume((current) => {
      const index = current.sectionOrder.indexOf(key)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.sectionOrder.length) return current
      const sectionOrder = [...current.sectionOrder]
      ;[sectionOrder[index], sectionOrder[nextIndex]] = [sectionOrder[nextIndex]!, sectionOrder[index]!]
      return { ...current, sectionOrder }
    })
  }
  const sections = resumeToText(resume).split(/\n/).filter(Boolean)
  const sectionLabels: Record<string, string> = { summary: t('summary'), experiences: t('experiences'), education: t('education'), certifications: 'Certifications', skills: t('skills'), languages: 'Languages', projects: 'Projects' }
  return (
    <div className="work-page">
      <PageIntro eyebrow="YOUR STORY, WELL TOLD" title={t('builderTitle')} description={t('builderIntro')} />
      <div className="builder-toolbar"><span className="storage-label"><LockKeyhole size={14} />Autosaved locally</span><div><button className="button button-quiet" onClick={onSaveVersion}><Plus size={15} />Save version</button><button className="button button-quiet" onClick={onImport}><ArrowDownToLine size={15} />{t('importJson')}</button><button className="button button-primary" onClick={onPdf}><ArrowDownToLine size={15} />{t('exportPdf')}</button></div></div>
      <div className="builder-layout">
        <div className="builder-form">
          <section className="panel form-panel"><PanelHeading title="Resume style and order" caption="All styles use selectable, single-column text." /><label className="field-label">Template<select className="field-input" value={resume.template} onChange={(event) => setField('template', event.target.value as ResumeTemplate)}><option value="classic">Classic ATS</option><option value="modern">Modern Professional</option><option value="executive">Executive</option></select></label><div className="section-order-list"><span className="order-label">Section order</span>{resume.sectionOrder.map((key, index) => <div className="section-order-item" key={key}><span>{sectionLabels[key] ?? key}</span><div><button className="icon-button" disabled={index === 0} aria-label={`Move ${sectionLabels[key] ?? key} up`} onClick={() => moveSection(key, -1)}><ChevronDown size={14} className="move-up" /></button><button className="icon-button" disabled={index === resume.sectionOrder.length - 1} aria-label={`Move ${sectionLabels[key] ?? key} down`} onClick={() => moveSection(key, 1)}><ChevronDown size={14} /></button></div></div>)}</div></section>
          <section className="panel form-panel"><PanelHeading title="Contact" caption="Only add details you are comfortable sharing." /><div className="form-grid">
            <TextField label={t('name')} value={resume.name} onChange={(value) => setField('name', value)} />
            <TextField label={t('email')} value={resume.email} onChange={(value) => setField('email', value)} type="email" />
            <TextField label={t('phone')} value={resume.phone} onChange={(value) => setField('phone', value)} />
            <TextField label={t('location')} value={resume.location} onChange={(value) => setField('location', value)} />
          </div></section>
          <section className="panel form-panel"><PanelHeading title={t('summary')} caption="Keep it specific, relevant and true." /><textarea className="field-textarea" value={resume.summary} onChange={(event) => setField('summary', event.target.value)} placeholder={t('addSummary')} /></section>
          <section className="panel form-panel"><PanelHeading title={t('experiences')} caption="Focus on your contribution and confirmed outcomes." />
            {resume.experiences.map((item, index) => <div className="experience-editor" key={item.id}><div className="experience-editor-heading"><strong>Experience {index + 1}</strong><div><button className="icon-button" disabled={index === 0} aria-label={`Move experience ${index + 1} up`} onClick={() => moveExperience(item.id, -1)}><ChevronDown size={14} className="move-up" /></button><button className="icon-button" disabled={index === resume.experiences.length - 1} aria-label={`Move experience ${index + 1} down`} onClick={() => moveExperience(item.id, 1)}><ChevronDown size={14} /></button><button className="icon-button danger-icon" aria-label="Remove experience" onClick={() => removeExperience(item.id)}><Trash2 size={15} /></button></div></div><div className="form-grid"><TextField label={t('role')} value={item.role} onChange={(value) => updateExperience(item.id, 'role', value)} /><TextField label={t('company')} value={item.company} onChange={(value) => updateExperience(item.id, 'company', value)} /><TextField label={t('dates')} value={item.dates} onChange={(value) => updateExperience(item.id, 'dates', value)} /><div /></div><label className="field-label">{t('description')}<textarea className="field-textarea compact" value={item.description} onChange={(event) => updateExperience(item.id, 'description', event.target.value)} placeholder="Describe the context, your specific contribution, and what changed." /></label></div>)}
            <button className="button button-quiet add-experience" onClick={addExperience}><Plus size={15} />{t('addExperience')}</button>
          </section>
          <section className="panel form-panel"><PanelHeading title={t('education')} caption="Degrees and relevant training are optional." /><textarea className="field-textarea compact" value={resume.education.join('\n')} onChange={(event) => setField('education', event.target.value.split(/\r?\n/).filter(Boolean))} placeholder="Institution · qualification · year" /></section>
          <section className="panel form-panel"><PanelHeading title={t('skills')} caption="Only include skills you can support with real experience." /><textarea className="field-textarea compact" value={resume.skills.join(', ')} onChange={(event) => setField('skills', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Project management, customer support, Excel" /></section>
          <section className="panel form-panel"><PanelHeading title="Languages, certifications and projects" caption="One item per line." /><div className="form-grid"><label className="field-label">Languages<textarea className="field-textarea compact" value={resume.languages.join('\n')} onChange={(event) => setField('languages', event.target.value.split(/\r?\n/).filter(Boolean))} /></label><label className="field-label">Certifications<textarea className="field-textarea compact" value={resume.certifications.join('\n')} onChange={(event) => setField('certifications', event.target.value.split(/\r?\n/).filter(Boolean))} /></label></div><label className="field-label">Projects<textarea className="field-textarea compact" value={resume.projects.join('\n')} onChange={(event) => setField('projects', event.target.value.split(/\r?\n/).filter(Boolean))} /></label>
            {resume.customSections.map((section, index) => <div className="experience-editor" key={`custom-${index}`}><div className="experience-editor-heading"><strong>Custom section {index + 1}</strong><button className="icon-button danger-icon" aria-label="Remove custom section" onClick={() => setField('customSections', resume.customSections.filter((_, sectionIndex) => sectionIndex !== index))}><Trash2 size={15} /></button></div><TextField label="Section title" value={section.title} onChange={(value) => setField('customSections', resume.customSections.map((item, sectionIndex) => sectionIndex === index ? { ...item, title: value } : item))} /><label className="field-label">Content<textarea className="field-textarea compact" value={section.content} onChange={(event) => setField('customSections', resume.customSections.map((item, sectionIndex) => sectionIndex === index ? { ...item, content: event.target.value } : item))} /></label></div>)}
            <button className="button button-quiet add-experience" onClick={() => setField('customSections', [...resume.customSections, { title: '', content: '' }])}><Plus size={15} />Add custom section</button>
          </section>
          <div className="export-row"><button className="button button-secondary" onClick={onDocx}><ArrowDownToLine size={15} />{t('exportDocx')}</button><button className="button button-secondary" onClick={onJson}><ArrowDownToLine size={15} />{t('exportJson')}</button><button className="button button-primary" onClick={onPdf}><ArrowDownToLine size={15} />{t('exportPdf')}</button></div>
        </div>
        <aside className="preview-sticky"><div className="preview-heading"><div><span className="eyebrow">LIVE DOCUMENT</span><strong>{t('preview')}</strong></div><span className="preview-page">A4 · TEXT</span></div><div className={`resume-paper template-${resume.template}`} aria-label={t('preview')}><div className="paper-name">{resume.name || 'Your Name'}</div><div className="paper-contact">{[resume.email, resume.phone, resume.location, ...resume.links].filter(Boolean).join(' · ') || 'Email · Location · Professional link'}</div>{resume.sectionOrder.map((key) => <ResumePreviewSection key={key} section={key} resume={resume} t={t} />)}{!sections.length && <span className="paper-empty">Your resume preview will appear here as you write.</span>}</div><p className="preview-footnote">Selectable text · single column · no photo required</p></aside>
      </div>
    </div>
  )
}

function ImpactPage({ t, resume, selectedExperience, setSelectedExperience, answers, setAnswers, impactDraft, setImpactDraft, onBuild, onAccept }: {
  t: (key: TranslationKey) => string; resume: Resume; selectedExperience: string; setSelectedExperience: (id: string) => void
  answers: Record<string, string | null>; setAnswers: (answers: Record<string, string | null>) => void
  impactDraft: string; setImpactDraft: (draft: string) => void; onBuild: () => void; onAccept: () => void
}) {
  const experience = resume.experiences.find((item) => item.id === selectedExperience)
  return (
    <div className="work-page">
      <PageIntro eyebrow="A GUIDED REFLECTION" title={t('impactTitle')} description={t('impactIntro')} />
      {!resume.experiences.length ? <div className="empty-state"><BriefcaseBusiness size={22} /><strong>{t('noResume')}</strong><span>Add an experience in Resume Builder to start the interview.</span></div> : <>
        <section className="panel interview-panel"><div className="step-label"><span>STEP 01</span><strong>Select an experience</strong></div><label className="field-label" htmlFor="experience-select">{t('selectExperience')}</label><select id="experience-select" className="field-input" value={selectedExperience} onChange={(event) => { setSelectedExperience(event.target.value); setImpactDraft('') }}><option value="">Choose one…</option>{resume.experiences.map((item) => <option value={item.id} key={item.id}>{item.role || item.company || 'Untitled experience'}{item.company ? ` · ${item.company}` : ''}</option>)}</select>{experience && <div className="selected-experience"><span className="eyebrow">CURRENT TEXT</span><p>{experience.description || 'No description has been added yet.'}</p></div>}</section>
        {experience && <section className="panel interview-panel"><div className="step-label"><span>STEP 02</span><strong>What do you remember about this work?</strong></div>{questionKeys.filter((question) => ruleBasedProvider.questionsFor(experience.description).includes(question.id as 'contribution' | 'context' | 'outcome' | 'scale')).map((question) => <label className="interview-question" key={question.id}><span>{t(question.key)}</span><textarea className="field-textarea compact" value={answers[question.id] === null ? '' : answers[question.id] ?? ''} disabled={answers[question.id] === null} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Your own words — estimates or qualitative details are welcome if confirmed." /><span className="no-info-check"><input type="checkbox" checked={answers[question.id] === null} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.checked ? null : '' })} />{t('noInfo')}</span></label>)}<p className="privacy-inline"><LockKeyhole size={14} />Do not share confidential information from a former employer. Only include facts you can verify.</p><button className="button button-primary" onClick={onBuild}>Build a draft from my answers<Sparkles size={15} /></button></section>}
        {impactDraft && <section className="panel draft-panel"><div className="step-label"><span>STEP 03</span><strong>Review your draft</strong></div><div className="before-after"><div><span className="eyebrow">ORIGINAL</span><p>{experience?.description || 'No description'}</p></div><div className="comparison-arrow"><ArrowRight size={16} /></div><label><span className="eyebrow">YOUR CONFIRMED DETAILS</span><textarea className="field-textarea" value={impactDraft} onChange={(event) => setImpactDraft(event.target.value)} /></label></div><div className="impact-actions"><button className="button button-secondary" onClick={() => setImpactDraft('')}>{t('reject')}</button><button className="button button-primary" onClick={onAccept}>{t('accept')}<Check size={15} /></button></div><p className="small-disclaimer">Draft text combines your original description and answers. It does not create facts or metrics.</p></section>}
      </>}
    </div>
  )
}

function MatchPage({ t, resume, jobText, setJobText, onCompare, onCreateCopy, result }: {
  t: (key: TranslationKey) => string; resume: Resume; jobText: string; setJobText: (text: string) => void; onCompare: () => void; onCreateCopy: () => void
  result: JobMatchResult | null
}) {
  return <div className="work-page"><PageIntro eyebrow="COMPARE TEXT, NOT PEOPLE" title={t('matchTitle')} description={t('matchIntro')} /><div className="job-match-grid"><section className="panel job-input-panel"><PanelHeading title={t('jobDescription')} caption="Paste the role description; it stays in this browser." /><textarea className="resume-textarea job-textarea" value={jobText} onChange={(event) => setJobText(event.target.value)} placeholder="Paste the job description here…" /><div className="job-controls"><span>{resume.name ? `Resume: ${resume.name}` : t('noResume')}</span><button className="button button-primary" onClick={onCompare}>{t('compare')}<ArrowRight size={15} /></button></div></section>
    {result ? <section className="panel job-results"><div className="match-score"><span className="eyebrow">{t('matchIndex')}</span><div><strong>{result.score}</strong><span>%</span></div><p>Text overlap estimate only — not a probability of interview or hiring.</p></div><KeywordList title={t('found')} items={result.found} status="found" /><KeywordList title={t('related')} items={result.related} status="related" /><KeywordList title={t('notFound')} items={result.missing} status="missing" /><p className="small-disclaimer">Terms not found in your resume are not necessarily absent from your skills. Add them only if they truthfully describe your experience.</p><button className="button button-secondary tailored-copy" onClick={onCreateCopy}><FilePlus2 size={15} />Create a separate version to tailor</button></section> : <section className="panel match-empty"><Target size={23} /><strong>Your comparison appears here</strong><p>We look for direct word overlap and a small set of transparent wording variants. No external service or AI is used.</p></section>}
  </div></div>
}

function KeywordList({ title, items, status }: { title: string; items: string[]; status: string }) {
  return <div className={`keyword-list keyword-${status}`}><div><strong>{title}</strong><span>{items.length}</span></div>{items.length ? <ul>{items.slice(0, 18).map((item) => <li key={item}>{item}</li>)}</ul> : <p>None detected in this group.</p>}</div>
}

function LibraryPage({ t, resume, versions, onOpen, onSave }: { t: (key: TranslationKey) => string; resume: Resume; versions: Resume[]; onOpen: (resume: Resume) => void; onSave: () => void }) {
  const allVersions = [{ ...resume }, ...versions]
  return <div className="work-page"><PageIntro eyebrow="LOCAL RESUME VERSIONS" title={t('libraryTitle')} description={t('libraryEmpty')} /><div className="library-toolbar"><span><LockKeyhole size={14} />Stored only in IndexedDB on this device</span><button className="button button-primary" onClick={onSave}><Plus size={15} />Save current version</button></div><div className="library-list">{allVersions.map((item, index) => <div className="library-item" key={`${item.id}-${index}`}><div className="library-icon"><FileText size={18} /></div><div className="library-main"><strong>{item.name || 'Untitled resume'}{index === 0 && <span className="current-tag">CURRENT</span>}</strong><span>{item.experiences.length} experiences · {item.skills.length} skills</span></div><time>{new Date(item.updatedAt).toLocaleDateString()}</time><button className="button button-quiet" onClick={() => onOpen(item)}>Open<ArrowRight size={14} /></button></div>)}</div></div>
}

function SettingsPage({ t, storageAvailable, onDelete, onBackup }: { t: (key: TranslationKey) => string; storageAvailable: boolean; onDelete: () => void; onBackup: () => void }) {
  return <div className="work-page"><PageIntro eyebrow="YOUR DEVICE, YOUR CHOICE" title={t('settings')} description="Control how BeyondCV stores and processes your information." /><div className="settings-stack"><section className="panel settings-panel"><div className="settings-icon"><LockKeyhole size={18} /></div><div className="settings-content"><strong>{t('storage')}</strong><p>{storageAvailable ? t('storageOk') : t('storageUnavailable')} No resume is sent to a server.</p></div><span className={`setting-status ${storageAvailable ? 'status-good' : 'status-warning'}`}>{storageAvailable ? 'ACTIVE' : 'UNAVAILABLE'}</span></section><section className="panel settings-panel"><div className="settings-icon"><ArrowDownToLine size={18} /></div><div className="settings-content"><strong>Backup your resume</strong><p>Export a JSON copy for your own safekeeping. The file may contain personal information.</p></div><button className="button button-secondary" onClick={onBackup}>{t('exportJson')}</button></section><section className="panel settings-panel"><div className="settings-icon"><Sparkles size={18} /></div><div className="settings-content"><strong>AI features</strong><p>{t('aiUnavailable')}</p></div><span className="setting-status status-warning">UNAVAILABLE</span></section><section className="panel settings-panel settings-danger"><div className="settings-icon"><Trash2 size={18} /></div><div className="settings-content"><strong>Delete local data</strong><p>Remove resume, versions, drafts and analysis history from this browser.</p></div><button className="button button-danger" onClick={onDelete}>{t('clearData')}</button></section></div></div>
}

function InfoPage({ t, kind }: { t: (key: TranslationKey) => string; kind: 'about' | 'privacy' | 'methodology' }) {
  if (kind === 'privacy') return <div className="work-page info-page"><PageIntro eyebrow="PRIVACY BY DESIGN" title="Your career story stays yours." description="BeyondCV is built to help without collecting your professional data." /><div className="info-columns"><section className="panel info-panel"><LockKeyhole size={19} /><h3>Processed in your browser</h3><p>Resume files and job descriptions are parsed and analyzed locally. This MVP does not send their content to a server or third-party API.</p></section><section className="panel info-panel"><ShieldCheck size={19} /><h3>Local persistence is optional</h3><p>If supported, IndexedDB stores your resume drafts and versions on this device. You can export a backup or delete all stored records in Settings.</p></section><section className="panel info-panel"><Globe2 size={19} /><h3>AI model downloads</h3><p>Local AI is unavailable in this MVP. If introduced later, any model download will be disclosed separately; resume content must not be sent to model hosts.</p></section></div><p className="legal-note">This description reflects the current implementation and is not a claim of legal certification or compliance. Your browser, extensions, or device may have their own data handling.</p></div>
  if (kind === 'methodology') return <div className="work-page info-page"><PageIntro eyebrow="TRANSPARENT RULES" title={t('methodology')} description="A versioned, deterministic review that describes evidence in the text — not your worth or likelihood of getting hired." /><div className="panel methodology-panel"><p>Scoring rules version 1.0.0 uses weighted categories. Each category starts at 100 and applies documented deductions for detectable text patterns. The overall score is the weighted mean of assessed categories only.</p><div className="methodology-table">{[['ATS compatibility', '20%'], ['Professional impact', '25%'], ['Experience quality', '20%'], ['Structure and organization', '10%'], ['Skills and keywords', '10%'], ['Information completeness', '10%'], ['Clarity and communication', '5%']].map(([label, weight]) => <div key={label}><span>{label}</span><strong>{weight}</strong></div>)}</div><h3>Evidence and limitations</h3><p>The analyzer detects common headings, generic responsibility phrases, action-oriented language, simple impact indicators and missing sections. Date ranges and phone numbers are not treated as impact metrics. A qualitative delivery can count as evidence; quantitative metrics are not required.</p><p>Categories without applicable evidence may be excluded. If there is too little readable text, no overall score is shown. Scanned documents, columns, profession-specific terminology and context can limit accuracy. Recommendations are prompts, not instructions to add unsupported claims.</p><p>The BeyondCV score is a proprietary project assessment, not an ATS certification, universal standard, or prediction of hiring success. Different applicant tracking systems behave differently.</p></div></div>
  return <div className="work-page info-page"><PageIntro eyebrow="MORE THAN A RESUME" title={t('about')} description="Your potential, unlocked." /><div className="about-mission"><span className="brand-mark large-mark">b<span>.</span></span><div><h2>Career tools should be accessible to everyone.</h2><p>BeyondCV is a free, open-source project to help people create, understand and improve resumes without a paywall or a required account. Our commitment: never invent professional experience, skills or results.</p><div className="principle-tags"><span>Free forever</span><span>Privacy-first</span><span>Open source</span><span>No account</span></div></div></div><div className="about-note"><Github size={17} /><div><strong>Built in the open</strong><p>Source repository link has not been configured in this local project yet. The code is intended to be released under the MIT License.</p></div></div></div>
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
}

function PanelHeading({ title, caption }: { title: string; caption: string }) {
  return <div className="panel-heading"><div><h3>{title}</h3><p>{caption}</p></div><ChevronDown size={15} /></div>
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="field-label">{label}<input className="field-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function PaperSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="paper-section"><h3>{title}</h3>{children}</section>
}

function ResumePreviewSection({ section, resume, t }: { section: string; resume: Resume; t: (key: TranslationKey) => string }) {
  const content: Record<string, ReactNode> = {
    summary: resume.summary ? <p>{resume.summary}</p> : null,
    experiences: resume.experiences.length ? resume.experiences.map((item) => <div className="paper-experience" key={item.id}><strong>{item.role || 'Role'}{item.company && ` · ${item.company}`}</strong><small>{item.dates}</small><p>{item.description}</p></div>) : null,
    education: resume.education.length ? <p>{resume.education.join(' · ')}</p> : null,
    certifications: resume.certifications.length ? <p>{resume.certifications.join(' · ')}</p> : null,
    skills: resume.skills.length ? <p>{resume.skills.join(' · ')}</p> : null,
    languages: resume.languages.length ? <p>{resume.languages.join(' · ')}</p> : null,
    projects: resume.projects.length ? <p>{resume.projects.join(' · ')}</p> : null,
  }
  const titles: Record<string, string> = {
    summary: t('summary'), experiences: t('experiences'), education: t('education'),
    certifications: 'Certifications', skills: t('skills'), languages: 'Languages', projects: 'Projects',
  }
  if (!content[section]) return null
  return <PaperSection title={(titles[section] ?? section).toUpperCase()}>{content[section]}</PaperSection>
}

export default App
