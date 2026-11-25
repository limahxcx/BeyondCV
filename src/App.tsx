import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownToLine, ArrowRight, BarChart3, BookOpen, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, ChevronRight,
  FilePlus2, FileText, Github, Globe2, Home, LayoutDashboard, LockKeyhole, Menu, Plus, RotateCcw, ShieldCheck,
  Sparkles, Target, Trash2, Upload, X,
} from 'lucide-react'
import { categoryLabel, evaluateResume, type Recommendation, type ResumeEvaluation, type Severity } from './domain/scoring'
import { createEmptyResume, parseResumeText, ResumeSchema, resumeToText, type Experience, type Resume, type ResumeTemplate } from './domain/resume'
import { compareResumeToJob, type JobMatchResult } from './domain/jobMatch'
import { ruleBasedProvider } from './services/ai/providers'
import { translate, type Locale, type TranslationKey } from './i18n'
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
  const locale: Locale = 'pt'
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
  }).sort((a, b) => ['Critical', 'High', 'Medium', 'Low'].indexOf(a.severity) - ['Critical', 'High', 'Medium', 'Low'].indexOf(b.severity)), [recommendations, filter, resolved])

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
    let fileErrorClass: typeof import('./services/parsers').ResumeFileError | undefined
    try {
      const { extractResumeFile, ResumeFileError } = await import('./services/parsers')
      fileErrorClass = ResumeFileError
      const text = await extractResumeFile(file, setProgress)
      loadText(text)
      navigate('analyze')
    } catch (reason) {
      if (fileErrorClass && reason instanceof fileErrorClass) setError(reason.message)
      else {
        console.error('Falha ao importar currículo:', reason)
        setError(t('fileError'))
      }
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
      if (!parsed.success) {
        setError(t('invalidJson'))
        return
      }
      const imported: Resume = { ...parsed.data, rawText: '' }
      imported.rawText = resumeToText(imported)
      setResume(imported)
      setDraftText(imported.rawText)
      setEvaluation(null)
      setError('')
      navigate('builder')
    } catch (reason) {
      console.error('Falha ao restaurar cópia do currículo:', reason)
      setError(t('invalidJson'))
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
      console.error('Falha ao excluir dados locais:', reason)
      setError(t('storageUnavailable'))
    }
  }

  const navGroups: { items: Page[] }[] = [
    { items: ['home', 'analyze', 'builder', 'impact', 'match', 'library'] },
    { items: ['about', 'methodology', 'privacy', 'settings'] },
  ]

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-backdrop" aria-label="Fechar navegação" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => navigate('home')} aria-label="Página inicial do BeyondCV">
          <span className="brand-mark" aria-hidden="true">b<span>.</span></span>
          <span className="brand-name">BeyondCV</span>
        </button>
        <div className="sidebar-note">SUA CARREIRA COM MAIS CLAREZA</div>
        <nav aria-label="Navegação principal">
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
          <div className="privacy-chip"><LockKeyhole size={15} /><span>Privacidade por padrão</span><Check size={14} /></div>
          <div className="sidebar-version">BeyondCV <span>v0.1.0</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label={t('menu')} onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>BeyondCV</span><ChevronRight size={14} /><strong>{titleFor(locale, page)}</strong></div>
          <div className="topbar-actions">
            <span className={`save-indicator ${storageAvailable ? '' : 'save-warning'}`}><span className="status-dot" />{saving ? t('saving') : storageAvailable ? t('saveStatus') : t('storageUnavailable')}</span>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="error-banner" role="alert"><CircleAlert />{error}<button onClick={() => setError('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
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
          <div className="eyebrow"><span className="eyebrow-dot" /> UM CAMINHO MAIS HUMANO PARA SEGUIR EM FRENTE</div>
          <h1>{t('heroTitle')}</h1>
          <p className="hero-subtitle">{t('heroSubtitle')}</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => navigate('analyze')}>{t('analyzeAction')}<ArrowRight size={16} /></button>
            <button className="button button-secondary" onClick={onCreate}>{t('create')}<FilePlus2 size={16} /></button>
          </div>
          <div className="hero-trust"><LockKeyhole size={14} /> Seu currículo não sai deste dispositivo</div>
        </div>
        <div className="hero-art" aria-label="Exemplo ilustrativo de avaliação de currículo">
          <div className="score-preview">
            <div className="preview-top"><div><span className="preview-kicker">EXEMPLO DE CURRÍCULO</span><strong>Perfil profissional</strong></div><span className="preview-menu">···</span></div>
            <div className="preview-person"><span className="avatar">JD</span><div><strong>Pessoa Exemplo</strong><span>Profissional de projetos</span></div></div>
            <div className="preview-score-row"><div className="score-ring"><strong>78</strong><span>/100</span></div><div className="score-description"><strong>Espaço para crescer</strong><span>Pontos fortes identificados e oportunidades para destacar seu impacto.</span></div></div>
            <div className="preview-divider" />
            <div className="preview-metrics"><span><i className="metric-dot green" /> Pontos fortes</span><b>06</b><span><i className="metric-dot amber" /> Oportunidades</span><b>03</b></div>
            <div className="preview-progress"><span style={{ width: '78%' }} /></div>
            <div className="preview-note"><Sparkles size={14} /> Exemplo ilustrativo baseado em regras transparentes</div>
          </div>
          <div className="floating-note"><span className="floating-check"><Check size={15} /></span><span><strong>Sua história, suas palavras</strong><small>Nunca invente resultados</small></span></div>
        </div>
      </section>
      <section className="trust-row" aria-label="Princípios do produto">
        {features.map(({ label, icon: Icon }) => <span key={label}><Icon size={15} />{t(label)}</span>)}
      </section>
      <section className="home-lower">
        <div className="section-heading"><span className="eyebrow">UM BOM PONTO DE PARTIDA</span><h2>Um passo de cada vez.</h2><p>Comece com o que você tem e descubra seu próximo passo.</p></div>
        <div className="action-grid">
          <ActionCard icon={BarChart3} index="01" title={t('analyzeAction')} copy="Receba orientações sobre clareza, estrutura e resultados." action="Analisar currículo" onClick={() => navigate('analyze')} />
          <ActionCard icon={FilePlus2} index="02" title={t('create')} copy="Crie um currículo legível e mantenha seus dados neste dispositivo." action="Criar currículo" onClick={onCreate} />
          <ActionCard icon={BriefcaseBusiness} index="03" title={t('matchAction')} copy="Veja quais termos da vaga aparecem no seu currículo." action="Comparar com vaga" onClick={() => navigate('match')} />
        </div>
      </section>
      <section className="privacy-callout"><span className="privacy-icon"><LockKeyhole size={20} /></span><div><strong>{t('privacyTitle')}</strong><p>{t('privacyText')}</p></div><button className="text-button" onClick={() => navigate('privacy')}>Saiba como cuidamos da privacidade<ArrowRight size={15} /></button></section>
      <section className="quick-import"><div><span className="eyebrow">JÁ TEM UM CURRÍCULO?</span><h2>Comece com a experiência que você já tem.</h2></div><button className="button button-secondary" onClick={() => document.getElementById('home-file')?.click()}><Upload size={15} />{t('upload')}</button><input id="home-file" className="visually-hidden" type="file" accept=".pdf,.docx,.txt" onChange={(event) => onFile(event.target.files?.[0])} />{progress > 0 && <span>{progress}%</span>}</section>
      <div className="mission-line">BeyondCV — Muito além de um currículo. Um projeto gratuito e de código aberto para tornar ferramentas de carreira mais acessíveis.</div>
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
      <PageIntro eyebrow="SEU PRÓXIMO PASSO" title={t('analyzeTitle')} description={t('analyzeIntro')} />
      <section className={`upload-panel ${props.isDragging ? 'drag-active' : ''}`} onDragOver={(event) => { event.preventDefault(); props.setIsDragging(true) }} onDragLeave={() => props.setIsDragging(false)} onDrop={(event) => { event.preventDefault(); props.setIsDragging(false); props.onDrop(event.dataTransfer.files[0]) }}>
        <div className="upload-title"><div className="upload-icon"><FileText size={19} /></div><div><strong>Comece pelo seu currículo</strong><span>Seu arquivo é lido no navegador e não é enviado para um servidor.</span></div></div>
        <button className="button button-secondary" onClick={props.onFile}><Upload size={16} />{t('upload')}</button>
        <div className="drop-hint">{t('drop')} <span>· máximo de 10 MB</span></div>
        {props.progress > 0 && <div className="upload-progress" role="status"><span style={{ width: `${props.progress}%` }} />{props.progress}%</div>}
      </section>
      <label className="field-label" htmlFor="resume-text">{t('paste')} <span>Formatos aceitos: PDF, DOCX e TXT</span></label>
      <textarea id="resume-text" className="resume-textarea" value={props.text} onChange={(event) => props.setText(event.target.value)} placeholder="Cole o texto do currículo aqui. Revise e edite o texto extraído antes da análise." />
      <div className="analyze-controls"><span>{props.text.trim().length} caracteres · processados neste dispositivo</span><button className="button button-primary" onClick={props.onAnalyze}><Sparkles size={16} />{t('analyzeButton')}<ArrowRight size={15} /></button></div>
      {props.evaluation ? (
        <div className="analysis-results">
          <section className="dashboard-summary">
            <div className="score-overview">
              <div className={`big-score ${props.evaluation.overall === null ? 'score-na' : ''}`}><strong>{props.evaluation.overall ?? '—'}</strong><span>{props.evaluation.overall === null ? 'SEM NOTA' : '/ 100'}</span></div>
              <div><span className="eyebrow">AVALIAÇÃO BEYONDCV · REGRAS {props.evaluation.version}</span><h2>{t('score')}</h2><p>{t('scoreNotice')}</p></div>
            </div>
            <div className="score-counts"><div><span>{props.evaluation.recommendations.length.toString().padStart(2, '0')}</span><small>{t('recommendations')}</small></div><div><span>{props.evaluation.strengths.length.toString().padStart(2, '0')}</span><small>{t('strengths')}</small></div></div>
          </section>
          <section className="results-grid">
            <div className="panel category-panel"><PanelHeading title={t('categories')} caption="Critérios determinísticos com pesos definidos" /><div className="category-list">{props.evaluation.categories.map((category) => <div className="category-row" key={category.id}><div className="category-meta"><strong>{category.label}</strong><span>{category.weight}% de peso{category.note ? ` · ${category.note}` : ''}</span></div><div className="category-bar"><i style={{ width: `${category.score ?? 0}%` }} /></div><strong className="category-number">{category.score === null ? 'N/A' : category.score}</strong></div>)}</div></div>
            <div className="panel strengths-panel"><PanelHeading title={t('strengths')} caption="Informações identificadas no texto" />{props.evaluation.strengths.length ? <ul className="clean-list">{props.evaluation.strengths.map((strength) => <li key={strength}><CheckCircle2 size={16} />{strength}</li>)}</ul> : <p className="muted-copy">Ainda não foi possível confirmar pontos fortes no texto extraído.</p>}<PanelHeading title={t('limitations')} caption="O que esta pontuação não pode informar" /><ul className="limits-list">{props.evaluation.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>
          <section className="recommendations-section">
            <div className="recommendations-head"><div><span className="eyebrow">PLANO DE MELHORIA</span><h2>{t('recommendations')}</h2><p>Melhore o texto do currículo e execute uma nova análise. Marcar um item como resolvido não altera a pontuação.</p></div><button className="button button-quiet" onClick={props.onAnalyze}><RotateCcw size={15} />Recalcular</button></div>
            <div className="filter-tabs" role="group" aria-label="Filtrar recomendações">
              {(['all', 'open', 'resolved'] as const).map((filter) => <button key={filter} className={props.filter === filter ? 'filter-active' : ''} onClick={() => props.setFilter(filter)}>{filter === 'all' ? t('all') : filter === 'open' ? 'Pendentes' : t('resolved')} <span>{filter === 'all' ? props.evaluation?.recommendations.length : filter === 'open' ? (props.evaluation?.recommendations.length ?? 0) - props.resolved.length : props.resolved.length}</span></button>)}
            </div>
            {props.visibleRecommendations.length ? <div className="recommendation-list">{props.visibleRecommendations.map((item) => <RecommendationCard key={item.id} item={item} locale={props.locale} resolved={props.resolved.includes(item.id)} onResolve={() => props.onResolve(item)} t={t} />)}</div> : <div className="empty-state"><CheckCircle2 size={22} /><strong>Nenhuma recomendação neste filtro</strong><span>Escolha outro filtro ou revise novamente o texto do currículo.</span></div>}
          </section>
        </div>
      ) : <div className="analysis-empty"><div className="empty-score">—</div><div><strong>{t('analysisEmpty')}</strong><p>A extração de PDF pode omitir conteúdo de documentos digitalizados ou com colunas complexas. Confira o texto antes de continuar.</p></div></div>}
      <div className="method-note"><ShieldCheck size={16} /><span>Esta pontuação do projeto não é uma certificação, uma medida universal de sistemas ATS nem uma previsão de contratação.</span><button onClick={() => setOpenDetails(!openDetails)}>{openDetails ? 'Ocultar' : 'Ver'} detalhes</button></div>
      {openDetails && <div className="method-details">A versão {props.evaluation?.version ?? '1.0.0'} das regras utiliza sete categorias com pesos. Categorias que não podem ser avaliadas são excluídas da média. Datas e telefones não são considerados métricas de impacto. Nenhuma IA ou serviço externo é utilizado.</div>}
    </div>
  )
}

function RecommendationCard({ item, locale, resolved, onResolve, t }: { item: Recommendation; locale: Locale; resolved: boolean; onResolve: () => void; t: (key: TranslationKey) => string }) {
  return (
    <article className={`recommendation-card ${resolved ? 'recommendation-resolved' : ''}`}>
      <div className="recommendation-top"><span className={`priority priority-${item.severity.toLowerCase()}`}>{severityText(locale, item.severity)}</span><span className="recommendation-category">{categoryLabel(item.category)}</span><button className={`resolve-button ${resolved ? 'is-resolved' : ''}`} onClick={onResolve}>{resolved ? <CheckCircle2 size={15} /> : <Check size={15} />}{resolved ? t('resolved') : t('markResolved')}</button></div>
      <h3>{item.title}</h3><p className="recommendation-problem">{item.problem}</p>
      {item.original && <div className="original-quote"><span>{t('original')}</span><p>“{item.original}”</p></div>}
      <div className="recommendation-explanation"><p><strong>{t('problem')}:</strong> {item.explanation}</p><p><strong>Por que isso importa:</strong> {item.relevance}</p><p><strong>{t('action')}:</strong> {item.action}</p></div>
      {item.suggestion && <div className="suggestion-box"><Sparkles size={15} /><span>{item.suggestion} <em>Confirme cada informação antes de utilizá-la.</em></span></div>}
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
  const sectionLabels: Record<string, string> = { summary: t('summary'), experiences: t('experiences'), education: t('education'), certifications: 'Certificações', skills: t('skills'), languages: 'Idiomas', projects: 'Projetos' }
  return (
    <div className="work-page">
      <PageIntro eyebrow="SUA HISTÓRIA COM CLAREZA" title={t('builderTitle')} description={t('builderIntro')} />
      <div className="builder-toolbar"><span className="storage-label"><LockKeyhole size={14} />Salvo automaticamente neste dispositivo</span><div><button className="button button-quiet" onClick={onSaveVersion}><Plus size={15} />Salvar versão</button><button className="button button-quiet" onClick={onImport}><ArrowDownToLine size={15} />{t('importJson')}</button><button className="button button-primary" onClick={onPdf}><ArrowDownToLine size={15} />{t('exportPdf')}</button></div></div>
      <div className="builder-layout">
        <div className="builder-form">
          <section className="panel form-panel"><PanelHeading title="Estilo e ordem do currículo" caption="Todos os modelos usam texto selecionável em uma coluna." /><label className="field-label">Modelo<select className="field-input" value={resume.template} onChange={(event) => setField('template', event.target.value as ResumeTemplate)}><option value="classic">Clássico ATS</option><option value="modern">Profissional moderno</option><option value="executive">Executivo</option></select></label><div className="section-order-list"><span className="order-label">Ordem das seções</span>{resume.sectionOrder.map((key, index) => <div className="section-order-item" key={key}><span>{sectionLabels[key] ?? key}</span><div><button className="icon-button" disabled={index === 0} aria-label={`Mover ${sectionLabels[key] ?? key} para cima`} onClick={() => moveSection(key, -1)}><ChevronDown size={14} className="move-up" /></button><button className="icon-button" disabled={index === resume.sectionOrder.length - 1} aria-label={`Mover ${sectionLabels[key] ?? key} para baixo`} onClick={() => moveSection(key, 1)}><ChevronDown size={14} /></button></div></div>)}</div></section>
          <section className="panel form-panel"><PanelHeading title="Contato" caption="Adicione apenas informações que você deseja compartilhar." /><div className="form-grid">
            <TextField label={t('name')} value={resume.name} onChange={(value) => setField('name', value)} />
            <TextField label={t('email')} value={resume.email} onChange={(value) => setField('email', value)} type="email" />
            <TextField label={t('phone')} value={resume.phone} onChange={(value) => setField('phone', value)} />
            <TextField label={t('location')} value={resume.location} onChange={(value) => setField('location', value)} />
          </div></section>
          <section className="panel form-panel"><PanelHeading title={t('summary')} caption="Use informações específicas, relevantes e verdadeiras." /><textarea className="field-textarea" value={resume.summary} onChange={(event) => setField('summary', event.target.value)} placeholder={t('addSummary')} /></section>
          <section className="panel form-panel"><PanelHeading title={t('experiences')} caption="Destaque sua contribuição e resultados confirmados." />
            {resume.experiences.map((item, index) => <div className="experience-editor" key={item.id}><div className="experience-editor-heading"><strong>Experiência {index + 1}</strong><div><button className="icon-button" disabled={index === 0} aria-label={`Mover experiência ${index + 1} para cima`} onClick={() => moveExperience(item.id, -1)}><ChevronDown size={14} className="move-up" /></button><button className="icon-button" disabled={index === resume.experiences.length - 1} aria-label={`Mover experiência ${index + 1} para baixo`} onClick={() => moveExperience(item.id, 1)}><ChevronDown size={14} /></button><button className="icon-button danger-icon" aria-label="Remover experiência" onClick={() => removeExperience(item.id)}><Trash2 size={15} /></button></div></div><div className="form-grid"><TextField label={t('role')} value={item.role} onChange={(value) => updateExperience(item.id, 'role', value)} /><TextField label={t('company')} value={item.company} onChange={(value) => updateExperience(item.id, 'company', value)} /><TextField label={t('dates')} value={item.dates} onChange={(value) => updateExperience(item.id, 'dates', value)} /><div /></div><label className="field-label">{t('description')}<textarea className="field-textarea compact" value={item.description} onChange={(event) => updateExperience(item.id, 'description', event.target.value)} placeholder="Descreva o contexto, sua contribuição e o que mudou." /></label></div>)}
            <button className="button button-quiet add-experience" onClick={addExperience}><Plus size={15} />{t('addExperience')}</button>
          </section>
          <section className="panel form-panel"><PanelHeading title={t('education')} caption="Formação e cursos relevantes são opcionais." /><textarea className="field-textarea compact" value={resume.education.join('\n')} onChange={(event) => setField('education', event.target.value.split(/\r?\n/).filter(Boolean))} placeholder="Instituição · formação · ano" /></section>
          <section className="panel form-panel"><PanelHeading title={t('skills')} caption="Inclua apenas competências que você possa comprovar." /><textarea className="field-textarea compact" value={resume.skills.join(', ')} onChange={(event) => setField('skills', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Gestão de projetos, atendimento ao cliente, Excel" /></section>
          <section className="panel form-panel"><PanelHeading title="Idiomas, certificações e projetos" caption="Um item por linha." /><div className="form-grid"><label className="field-label">Idiomas<textarea className="field-textarea compact" value={resume.languages.join('\n')} onChange={(event) => setField('languages', event.target.value.split(/\r?\n/).filter(Boolean))} /></label><label className="field-label">Certificações<textarea className="field-textarea compact" value={resume.certifications.join('\n')} onChange={(event) => setField('certifications', event.target.value.split(/\r?\n/).filter(Boolean))} /></label></div><label className="field-label">Projetos<textarea className="field-textarea compact" value={resume.projects.join('\n')} onChange={(event) => setField('projects', event.target.value.split(/\r?\n/).filter(Boolean))} /></label>
            {resume.customSections.map((section, index) => <div className="experience-editor" key={`custom-${index}`}><div className="experience-editor-heading"><strong>Seção personalizada {index + 1}</strong><button className="icon-button danger-icon" aria-label="Remover seção personalizada" onClick={() => setField('customSections', resume.customSections.filter((_, sectionIndex) => sectionIndex !== index))}><Trash2 size={15} /></button></div><TextField label="Título da seção" value={section.title} onChange={(value) => setField('customSections', resume.customSections.map((item, sectionIndex) => sectionIndex === index ? { ...item, title: value } : item))} /><label className="field-label">Conteúdo<textarea className="field-textarea compact" value={section.content} onChange={(event) => setField('customSections', resume.customSections.map((item, sectionIndex) => sectionIndex === index ? { ...item, content: event.target.value } : item))} /></label></div>)}
            <button className="button button-quiet add-experience" onClick={() => setField('customSections', [...resume.customSections, { title: '', content: '' }])}><Plus size={15} />Adicionar seção personalizada</button>
          </section>
          <div className="export-row"><button className="button button-secondary" onClick={onDocx}><ArrowDownToLine size={15} />{t('exportDocx')}</button><button className="button button-secondary" onClick={onJson}><ArrowDownToLine size={15} />{t('exportJson')}</button><button className="button button-primary" onClick={onPdf}><ArrowDownToLine size={15} />{t('exportPdf')}</button></div>
        </div>
        <aside className="preview-sticky"><div className="preview-heading"><div><span className="eyebrow">DOCUMENTO EM TEMPO REAL</span><strong>{t('preview')}</strong></div><span className="preview-page">A4 · TEXTO</span></div><div className={`resume-paper template-${resume.template}`} aria-label={t('preview')}><div className="paper-name">{resume.name || 'Seu nome'}</div><div className="paper-contact">{[resume.email, resume.phone, resume.location, ...resume.links].filter(Boolean).join(' · ') || 'E-mail · Localização · Link profissional'}</div>{resume.sectionOrder.map((key) => <ResumePreviewSection key={key} section={key} resume={resume} t={t} />)}{!sections.length && <span className="paper-empty">A prévia do currículo aparecerá aqui enquanto você escreve.</span>}</div><p className="preview-footnote">Texto selecionável · uma coluna · foto não obrigatória</p></aside>
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
      <PageIntro eyebrow="UMA REFLEXÃO GUIADA" title={t('impactTitle')} description={t('impactIntro')} />
      {!resume.experiences.length ? <div className="empty-state"><BriefcaseBusiness size={22} /><strong>{t('noResume')}</strong><span>Adicione uma experiência no editor para iniciar a entrevista.</span></div> : <>
        <section className="panel interview-panel"><div className="step-label"><span>ETAPA 01</span><strong>Selecione uma experiência</strong></div><label className="field-label" htmlFor="experience-select">{t('selectExperience')}</label><select id="experience-select" className="field-input" value={selectedExperience} onChange={(event) => { setSelectedExperience(event.target.value); setImpactDraft('') }}><option value="">Selecione uma opção…</option>{resume.experiences.map((item) => <option value={item.id} key={item.id}>{item.role || item.company || 'Experiência sem título'}{item.company ? ` · ${item.company}` : ''}</option>)}</select>{experience && <div className="selected-experience"><span className="eyebrow">TEXTO ATUAL</span><p>{experience.description || 'Nenhuma descrição foi adicionada.'}</p></div>}</section>
        {experience && <section className="panel interview-panel"><div className="step-label"><span>ETAPA 02</span><strong>O que você lembra sobre esse trabalho?</strong></div>{questionKeys.filter((question) => ruleBasedProvider.questionsFor(experience.description).includes(question.id as 'contribution' | 'context' | 'outcome' | 'scale')).map((question) => <label className="interview-question" key={question.id}><span>{t(question.key)}</span><textarea className="field-textarea compact" value={answers[question.id] === null ? '' : answers[question.id] ?? ''} disabled={answers[question.id] === null} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Use suas palavras. Estimativas e detalhes qualitativos são bem-vindos se confirmados." /><span className="no-info-check"><input type="checkbox" checked={answers[question.id] === null} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.checked ? null : '' })} />{t('noInfo')}</span></label>)}<p className="privacy-inline"><LockKeyhole size={14} />Não compartilhe informações confidenciais de empresas anteriores. Inclua apenas fatos que você possa confirmar.</p><button className="button button-primary" onClick={onBuild}>Criar rascunho com minhas respostas<Sparkles size={15} /></button></section>}
        {impactDraft && <section className="panel draft-panel"><div className="step-label"><span>ETAPA 03</span><strong>Revise seu rascunho</strong></div><div className="before-after"><div><span className="eyebrow">ORIGINAL</span><p>{experience?.description || 'Sem descrição'}</p></div><div className="comparison-arrow"><ArrowRight size={16} /></div><label><span className="eyebrow">INFORMAÇÕES CONFIRMADAS</span><textarea className="field-textarea" value={impactDraft} onChange={(event) => setImpactDraft(event.target.value)} /></label></div><div className="impact-actions"><button className="button button-secondary" onClick={() => setImpactDraft('')}>{t('reject')}</button><button className="button button-primary" onClick={onAccept}>{t('accept')}<Check size={15} /></button></div><p className="small-disclaimer">O rascunho reúne sua descrição original e suas respostas. Ele não inventa fatos ou números.</p></section>}
      </>}
    </div>
  )
}

function MatchPage({ t, resume, jobText, setJobText, onCompare, onCreateCopy, result }: {
  t: (key: TranslationKey) => string; resume: Resume; jobText: string; setJobText: (text: string) => void; onCompare: () => void; onCreateCopy: () => void
  result: JobMatchResult | null
}) {
  return <div className="work-page"><PageIntro eyebrow="COMPARE TEXTOS, NÃO PESSOAS" title={t('matchTitle')} description={t('matchIntro')} /><div className="job-match-grid"><section className="panel job-input-panel"><PanelHeading title={t('jobDescription')} caption="Cole a descrição da vaga; ela permanece neste navegador." /><textarea className="resume-textarea job-textarea" value={jobText} onChange={(event) => setJobText(event.target.value)} placeholder="Cole a descrição da vaga aqui…" /><div className="job-controls"><span>{resume.name ? `Currículo: ${resume.name}` : t('noResume')}</span><button className="button button-primary" onClick={onCompare}>{t('compare')}<ArrowRight size={15} /></button></div></section>
    {result ? <section className="panel job-results"><div className="match-score"><span className="eyebrow">{t('matchIndex')}</span><div><strong>{result.score}</strong><span>%</span></div><p>Estimativa de correspondência textual, não uma probabilidade de entrevista ou contratação.</p></div><KeywordList title={t('found')} items={result.found} status="found" /><KeywordList title={t('related')} items={result.related} status="related" /><KeywordList title={t('notFound')} items={result.missing} status="missing" /><p className="small-disclaimer">Termos não encontrados no currículo não indicam ausência de competências. Adicione-os apenas se descreverem sua experiência verdadeira.</p><button className="button button-secondary tailored-copy" onClick={onCreateCopy}><FilePlus2 size={15} />Criar uma versão separada para a vaga</button></section> : <section className="panel match-empty"><Target size={23} /><strong>Sua comparação aparecerá aqui</strong><p>Comparamos palavras diretamente e algumas variações conhecidas. Nenhum serviço externo ou IA é utilizado.</p></section>}
  </div></div>
}

function KeywordList({ title, items, status }: { title: string; items: string[]; status: string }) {
  return <div className={`keyword-list keyword-${status}`}><div><strong>{title}</strong><span>{items.length}</span></div>{items.length ? <ul>{items.slice(0, 18).map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nenhum termo identificado neste grupo.</p>}</div>
}

function LibraryPage({ t, resume, versions, onOpen, onSave }: { t: (key: TranslationKey) => string; resume: Resume; versions: Resume[]; onOpen: (resume: Resume) => void; onSave: () => void }) {
  const allVersions = [{ ...resume }, ...versions]
  return <div className="work-page"><PageIntro eyebrow="VERSÕES LOCAIS DO CURRÍCULO" title={t('libraryTitle')} description={t('libraryEmpty')} /><div className="library-toolbar"><span><LockKeyhole size={14} />Armazenado apenas no IndexedDB deste dispositivo</span><button className="button button-primary" onClick={onSave}><Plus size={15} />Salvar versão atual</button></div><div className="library-list">{allVersions.map((item, index) => <div className="library-item" key={`${item.id}-${index}`}><div className="library-icon"><FileText size={18} /></div><div className="library-main"><strong>{item.name || 'Currículo sem título'}{index === 0 && <span className="current-tag">ATUAL</span>}</strong><span>{item.experiences.length} experiências · {item.skills.length} competências</span></div><time>{new Date(item.updatedAt).toLocaleDateString('pt-BR')}</time><button className="button button-quiet" onClick={() => onOpen(item)}>Abrir<ArrowRight size={14} /></button></div>)}</div></div>
}

function SettingsPage({ t, storageAvailable, onDelete, onBackup }: { t: (key: TranslationKey) => string; storageAvailable: boolean; onDelete: () => void; onBackup: () => void }) {
  return <div className="work-page"><PageIntro eyebrow="SEU DISPOSITIVO, SUA ESCOLHA" title={t('settings')} description="Controle como o BeyondCV armazena e processa suas informações." /><div className="settings-stack"><section className="panel settings-panel"><div className="settings-icon"><LockKeyhole size={18} /></div><div className="settings-content"><strong>{t('storage')}</strong><p>{storageAvailable ? t('storageOk') : t('storageUnavailable')} Nenhum currículo é enviado a um servidor.</p></div><span className={`setting-status ${storageAvailable ? 'status-good' : 'status-warning'}`}>{storageAvailable ? 'ATIVO' : 'INDISPONÍVEL'}</span></section><section className="panel settings-panel"><div className="settings-icon"><ArrowDownToLine size={18} /></div><div className="settings-content"><strong>Faça uma cópia do currículo</strong><p>Exporte uma cópia em JSON para guardar com segurança. O arquivo pode conter dados pessoais.</p></div><button className="button button-secondary" onClick={onBackup}>{t('exportJson')}</button></section><section className="panel settings-panel"><div className="settings-icon"><Sparkles size={18} /></div><div className="settings-content"><strong>Recursos de IA</strong><p>{t('aiUnavailable')}</p></div><span className="setting-status status-warning">INDISPONÍVEL</span></section><section className="panel settings-panel settings-danger"><div className="settings-icon"><Trash2 size={18} /></div><div className="settings-content"><strong>Excluir dados locais</strong><p>Remova currículos, versões, rascunhos e histórico de análise deste navegador.</p></div><button className="button button-danger" onClick={onDelete}>{t('clearData')}</button></section></div></div>
}

function InfoPage({ t, kind }: { t: (key: TranslationKey) => string; kind: 'about' | 'privacy' | 'methodology' }) {
  if (kind === 'privacy') return <div className="work-page info-page"><PageIntro eyebrow="PRIVACIDADE DESDE A CONCEPÇÃO" title="Sua história profissional continua sendo sua." description="O BeyondCV foi criado para ajudar sem coletar seus dados profissionais." /><div className="info-columns"><section className="panel info-panel"><LockKeyhole size={19} /><h3>Processamento no navegador</h3><p>Currículos e descrições de vagas são lidos e analisados localmente. Esta versão não envia o conteúdo a servidores ou APIs de terceiros.</p></section><section className="panel info-panel"><ShieldCheck size={19} /><h3>Armazenamento local</h3><p>Quando disponível, o IndexedDB armazena rascunhos e versões neste dispositivo. Você pode exportar uma cópia ou excluir os dados nas configurações.</p></section><section className="panel info-panel"><Globe2 size={19} /><h3>Downloads de modelos de IA</h3><p>A IA local está indisponível nesta versão. Caso seja adicionada no futuro, o download de modelos será informado separadamente; o currículo não deve ser enviado aos servidores dos modelos.</p></section></div><p className="legal-note">Esta descrição reflete a versão atual e não representa certificação ou declaração de conformidade legal. Seu navegador, extensões ou dispositivo podem tratar dados de outra forma.</p></div>
  if (kind === 'methodology') return <div className="work-page info-page"><PageIntro eyebrow="REGRAS TRANSPARENTES" title={t('methodology')} description="Uma avaliação determinística e versionada que identifica informações no texto, não seu valor ou sua chance de contratação." /><div className="panel methodology-panel"><p>A versão 1.0.0 das regras usa categorias com pesos. Cada categoria começa em 100 e aplica deduções documentadas para padrões identificáveis. A pontuação geral é a média ponderada apenas das categorias avaliadas.</p><div className="methodology-table">{[['Compatibilidade com ATS', '20%'], ['Impacto profissional e resultados', '25%'], ['Qualidade das experiências', '20%'], ['Estrutura e organização', '10%'], ['Competências e palavras-chave', '10%'], ['Completude das informações', '10%'], ['Clareza e comunicação', '5%']].map(([label, weight]) => <div key={label}><span>{label}</span><strong>{weight}</strong></div>)}</div><h3>Evidências e limitações</h3><p>O analisador identifica títulos comuns, responsabilidades genéricas, linguagem de ação, indicadores simples de impacto e seções ausentes. Datas e telefones não são considerados métricas de impacto. Entregas qualitativas podem servir como evidência; métricas quantitativas não são obrigatórias.</p><p>Categorias sem evidências aplicáveis podem ser excluídas. Se houver pouco texto legível, nenhuma pontuação geral será exibida. Documentos digitalizados, colunas, termos específicos e contexto podem limitar a precisão. As recomendações não são instruções para adicionar informações sem comprovação.</p><p>A pontuação BeyondCV é uma avaliação do projeto, não uma certificação ATS, padrão universal ou previsão de contratação. Diferentes sistemas ATS funcionam de maneiras distintas.</p></div></div>
  return <div className="work-page info-page"><PageIntro eyebrow="MUITO ALÉM DE UM CURRÍCULO" title={t('about')} description="Muito além de um currículo." /><div className="about-mission"><span className="brand-mark large-mark">b<span>.</span></span><div><h2>Ferramentas de carreira devem ser acessíveis a todas as pessoas.</h2><p>O BeyondCV é um projeto gratuito e de código aberto que ajuda pessoas a criar, entender e melhorar currículos sem cobrança ou cadastro obrigatório. Nosso compromisso: nunca inventar experiências, competências ou resultados.</p><div className="principle-tags"><span>Gratuito para sempre</span><span>Privacidade em primeiro lugar</span><span>Código aberto</span><span>Sem cadastro</span></div></div></div><div className="about-note"><Github size={17} /><div><strong>Desenvolvido de forma aberta</strong><p>O código-fonte está disponível no GitHub sob a licença MIT.</p></div></div></div>
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
    experiences: resume.experiences.length ? resume.experiences.map((item) => <div className="paper-experience" key={item.id}><strong>{item.role || 'Cargo'}{item.company && ` · ${item.company}`}</strong><small>{item.dates}</small><p>{item.description}</p></div>) : null,
    education: resume.education.length ? <p>{resume.education.join(' · ')}</p> : null,
    certifications: resume.certifications.length ? <p>{resume.certifications.join(' · ')}</p> : null,
    skills: resume.skills.length ? <p>{resume.skills.join(' · ')}</p> : null,
    languages: resume.languages.length ? <p>{resume.languages.join(' · ')}</p> : null,
    projects: resume.projects.length ? <p>{resume.projects.join(' · ')}</p> : null,
  }
  const titles: Record<string, string> = {
    summary: t('summary'), experiences: t('experiences'), education: t('education'),
    certifications: 'Certificações', skills: t('skills'), languages: 'Idiomas', projects: 'Projetos',
  }
  if (!content[section]) return null
  return <PaperSection title={(titles[section] ?? section).toUpperCase()}>{content[section]}</PaperSection>
}

export default App
