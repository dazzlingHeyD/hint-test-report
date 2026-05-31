import { useState, useCallback, useEffect, useRef } from 'react'
import { DB, UNIT_NAMES } from './data/db'
import { getConnections } from './data/connections'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/* ── 브랜드 ── */
const N = '#0B1F3A'
const O = '#F37022'

/* ── 단원 축약 라벨 (레이더 차트용) ── */
const UNIT_SHORT = {
  /* 초4 1학기 */
  '큰 수':'큰 수', '각도':'각도', '곱셈과 나눗셈':'곱셈·나눗셈',
  '평면도형의 이동':'도형이동', '막대그래프':'막대그래프', '규칙 찾기':'규칙찾기',
  /* 초4 2학기 */
  '분수의 덧셈과 뺄셈':'분수덧뺄', '삼각형':'삼각형',
  '소수의 덧셈과 뺄셈':'소수덧뺄', '사각형':'사각형',
  '꺾은선그래프':'꺾은선', '다각형':'다각형',
  /* 초5 1학기 */
  '자연수의 혼합 계산':'혼합계산', '약수와 배수':'약수·배수',
  '규칙과 대응':'규칙·대응', '약분과 통분':'약분·통분',
  '다각형의 둘레와 넓이':'도형넓이',
  /* 초5 2학기 */
  '수의 범위와 어림하기':'수범위', '분수의 곱셈':'분수곱셈',
  '합동과 대칭':'합동·대칭', '소수의 곱셈':'소수곱셈', '직육면체':'직육면체',
  /* 초6 1학기 */
  '분수의 나눗셈':'분수나눗셈', '각기둥과 각뿔':'각기둥·각뿔',
  '소수의 나눗셈':'소수나눗셈', '비와 비율':'비와비율',
  '여러 가지 그래프':'그래프', '직육면체의 부피와 겉넓이':'부피·겉넓이',
  /* 초6 2학기 */
  '공간과 입체':'공간·입체', '비례식과 비례배분':'비례식',
  '원의 넓이':'원넓이', '원기둥·원뿔·구':'원기둥',
}

/* ── 오류 유형 19종 ── */
const ERROR_TYPES = [
  { id:'not_learned',      label:'미학습',           cat:'개념', color:'#dc2626',
    desc:'해당 단원을 아직 배우지 않았거나 수업을 놓침',
    report:'학습 자체가 이루어지지 않은 상태입니다. 해당 개념을 처음부터 체계적으로 가르치는 것이 우선입니다.' },
  { id:'forgotten',        label:'학습 후 망각',     cat:'개념', color:'#ef4444',
    desc:'배운 적은 있지만 기억하지 못함 (복습 부족)',
    report:'학습은 됐지만 정착이 안 된 상태입니다. 주기적인 복습과 간격 반복 학습으로 장기 기억화가 필요합니다.' },
  { id:'misconception',    label:'오개념 형성',      cat:'개념', color:'#f97316',
    desc:'잘못된 방향으로 개념을 이해하고 있음 (틀린 규칙을 정답으로 믿음)',
    report:'잘못된 개념이 굳어진 상태로, 단순 복습으로는 해결되지 않습니다. 오개념을 명시적으로 짚어주고 올바른 개념으로 교정하는 수업이 필요합니다.' },
  { id:'concept_confused', label:'유사 개념 혼동',   cat:'개념', color:'#f59e0b',
    desc:'비슷한 두 개념을 구분하지 못함 (예: 약수↔배수, 둘레↔넓이)',
    report:'유사 개념 간 혼동이 있습니다. 두 개념을 나란히 놓고 공통점·차이점을 비교하는 대조 학습이 효과적입니다.' },
  { id:'no_method',        label:'풀이 방법 모름',   cat:'절차', color:'#7c3aed',
    desc:'어떻게 접근해야 할지 출발점을 모름',
    report:'풀이 방향 자체를 모르는 상태입니다. 유형별 접근 전략을 명시적으로 가르쳐야 합니다.' },
  { id:'wrong_order',      label:'풀이 순서 오류',   cat:'절차', color:'#8b5cf6',
    desc:'방법은 알지만 단계 순서가 틀림',
    report:'방법은 알지만 순서가 흔들립니다. 풀이 단계를 번호로 정리하고 순서대로 체크하는 습관을 훈련시켜야 합니다.' },
  { id:'wrong_formula',    label:'공식 오선택',      cat:'절차', color:'#6366f1',
    desc:'상황에 맞지 않는 공식·규칙을 선택',
    report:'문제 상황과 공식을 연결하는 판단이 부족합니다. 각 공식이 언제 쓰이는지 조건 중심으로 정리하는 학습이 필요합니다.' },
  { id:'step_missing',     label:'중간 단계 누락',   cat:'절차', color:'#a855f7',
    desc:'풀이 중 필요한 단계를 빠뜨림',
    report:'체크리스트 방식으로 단계별 확인 습관을 길러야 합니다.' },
  { id:'arith_error',      label:'기본 연산 실수',   cat:'계산', color:'#2563eb',
    desc:'덧셈·뺄셈·곱셈·나눗셈 자체의 단순 실수',
    report:'기초 연산 자동화가 아직 완성되지 않았습니다. 매일 5분 기초 연산 드릴로 정확성과 속도를 높여야 합니다.' },
  { id:'carry_error',      label:'받아올림·내림',    cat:'계산', color:'#3b82f6',
    desc:'받아올림·받아내림 처리 실수 (자릿값 혼동 포함)',
    report:'세로셈 시 받아올림 수를 반드시 표기하는 습관 훈련이 필요합니다.' },
  { id:'decimal_unit',     label:'소수점·단위 오류', cat:'계산', color:'#0891b2',
    desc:'소수점 위치 또는 단위 변환 실수',
    report:'계산 후 어림셈으로 결과가 타당한지 스스로 검증하는 습관이 효과적입니다.' },
  { id:'misread_cond',     label:'조건 오독',        cat:'독해', color:'#059669',
    desc:'문제의 핵심 조건을 잘못 읽음',
    report:'핵심 조건에 밑줄 긋기 → 조건 목록 쓰기 → 풀기 순서를 습관화해야 합니다.' },
  { id:'wrong_target',     label:'구하는 것 혼동',   cat:'독해', color:'#10b981',
    desc:'무엇을 구해야 하는지 혼동',
    report:'풀기 전 "구하는 것: ___" 한 줄 쓰기를 의무화하면 효과적입니다.' },
  { id:'info_overload',    label:'불필요한 정보 사용', cat:'독해', color:'#34d399',
    desc:'관계없는 수치를 사용하거나 조건을 추가로 만들어냄',
    report:'주어진 정보와 필요한 정보를 분리해 표로 정리하는 연습이 효과적입니다.' },
  { id:'type_unknown',     label:'유형 미인식',      cat:'적용', color:'#65a30d',
    desc:'어떤 방식으로 풀어야 하는 문제인지 분류 자체를 못함',
    report:'문제 유형 파악 훈련이 필요합니다. 다양한 유형의 문제를 분류·매핑하는 학습이 효과적입니다.' },
  { id:'transfer_fail',    label:'변형 문제 대처',   cat:'적용', color:'#84cc16',
    desc:'기본 문제는 풀지만 조건이 조금 바뀌면 대처 못함',
    report:'기계적 암기에 의존하고 있습니다. 같은 개념을 다양한 맥락에서 반복 적용하는 훈련이 필요합니다.' },
  { id:'impulsive',        label:'충동적 답 작성',   cat:'태도', color:'#d97706',
    desc:'충분히 생각하지 않고 바로 답을 씀',
    report:'풀기 전 30초 문제 분석 시간을 의무화하고, 풀이 과정을 반드시 쓰도록 지도해야 합니다.' },
  { id:'no_check',         label:'검산 미실시',      cat:'태도', color:'#9ca3af',
    desc:'답을 구했지만 확인 없이 제출하는 습관',
    report:'역연산으로 검산하는 루틴을 만들어야 합니다.' },
  { id:'gave_up',          label:'풀이 포기',        cat:'태도', color:'#6b7280',
    desc:'어렵다고 판단해 시도조차 하지 않거나 중간에 포기',
    report:'쉬운 문제로 성공 경험을 쌓고 "아는 것부터 써보기" 전략으로 시도 의욕을 높여야 합니다.' },
]

const ET_MAP = Object.fromEntries(ERROR_TYPES.map(t => [t.id, t]))

const CAT_META = {
  '개념': { color:O, bg:'rgba(243,112,34,0.06)', icon:'🧠',
    summary:'단순 실수가 아닌 "이해 결손"입니다. 미학습이면 처음부터 개념을 가르쳐야 하고, 망각이면 간격 반복 복습이, 오개념이면 틀린 믿음을 먼저 명시적으로 짚어주는 교정 수업이 필요합니다. 개념 오류는 방치할수록 상위 단원 전체로 영향이 퍼지므로 가장 우선적으로 처방해야 합니다.',
    guide:'① 어떤 원인인지 파악 (미학습·망각·오개념·혼동) → ② 원인별 맞춤 처방 → ③ 이해 확인 후 다음 단계 진행' },
  '절차': { color:O, bg:'rgba(243,112,34,0.06)', icon:'📋',
    summary:'개념은 알지만 "하는 방법"이 흔들립니다. 문제를 풀다가 중간에 막히거나 단계 순서가 뒤바뀌는 패턴입니다. 공식·알고리즘을 알아도 적용 순서가 자동화되지 않은 상태로, 풀이 단계를 번호로 정리하고 체크리스트로 반복 확인하는 훈련으로 비교적 빠르게 개선됩니다.',
    guide:'① 풀이 단계를 번호로 명시 → ② 각 단계를 체크하며 풀기 → ③ 반복을 통한 자동화' },
  '계산': { color:O, bg:'rgba(243,112,34,0.06)', icon:'🔢',
    summary:'알고 있지만 틀리는 "실수 유형"입니다. 기초 연산 속도가 느리거나 받아올림·소수점 처리가 아직 자동화되지 않은 상태입니다. 단기간 내 가장 눈에 띄는 점수 향상이 가능한 영역으로, 매일 5분 집중 연산 드릴을 4~6주 지속하면 정확도와 속도가 동시에 개선됩니다.',
    guide:'① 매일 5분 기초 연산 드릴 → ② 계산 후 역연산 검산 습관 → ③ 틀린 유형만 골라 집중 반복' },
  '독해': { color:O, bg:'rgba(243,112,34,0.06)', icon:'📖',
    summary:'수학 실력이 아닌 "문제 읽기" 습관의 문제입니다. 조건을 잘못 읽거나 구하는 것을 혼동하여 풀이 방향 자체가 빗나갑니다. 문제를 이해하는 과정을 루틴화하면 개선이 빠릅니다. 특히 아는 개념에서도 자꾸 틀린다면 독해 오류를 의심해야 합니다.',
    guide:'① 핵심 조건에 밑줄 → ② "구하는 것: ___" 한 줄 쓰기 → ③ 조건 목록 정리 후 풀기' },
  '적용': { color:O, bg:'rgba(243,112,34,0.06)', icon:'🎯',
    summary:'배운 내용이지만 조건이 조금 바뀌거나 처음 보는 형태에서 막힙니다. 개념 자체보다 "다양한 변형 문제 경험" 부족이 원인입니다. 기계적 암기에 의존하는 학습 방식에서 벗어나, 같은 개념을 여러 맥락에 적용해 보는 훈련이 핵심 처방입니다.',
    guide:'① 유형 파악 훈련 (이 문제는 어떤 방식?) → ② 같은 개념을 변형 문제로 반복 → ③ 조건 변형 문제 직접 만들어보기' },
  '태도': { color:O, bg:'rgba(243,112,34,0.06)', icon:'💭',
    summary:'실력이 아닌 "습관"의 문제입니다. 충동적으로 답을 쓰거나, 검산 없이 제출하거나, 어렵다고 포기하는 패턴입니다. 지식을 습득하는 것보다 행동 패턴을 바꾸는 접근이 필요합니다. 작은 성공 경험을 쌓으면서 구체적인 루틴을 만들어주는 것이 가장 효과적입니다.',
    guide:'① 풀기 전 30초 문제 분석 → ② 풀이 과정 반드시 쓰기 → ③ 제출 전 역연산 검산 의무화' },
}

const ET_BY_CAT = ERROR_TYPES.reduce((acc, t) => {
  if (!acc[t.cat]) acc[t.cat] = []
  acc[t.cat].push(t)
  return acc
}, {})

/* ── AI 출력 후처리: 마크다운·금지 표현 제거 ── */
const cleanAiOutput = (text) => {
  return text
    // 헤딩 기호 제거 (## 제목, # 제목)
    .replace(/^#{1,6}\s+/gm, '')
    // 굵게·기울임 제거 (***text***, **text**, *text*, __text__, _text_)
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1')
    // 수평선 제거
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // 인용 기호 제거
    .replace(/^>\s+/gm, '')
    // 서명 줄 제거 ("드림", "교사 드림" 등으로 끝나는 마지막 줄)
    .replace(/\n[^\n]*(드림|선생님$|교사$)[^\n]*$/g, '')
    // 연속 빈 줄 최대 1줄로
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ── 공통 스타일 ── */
const card = { background:'#fff', borderRadius:16, boxShadow:'0 2px 12px rgba(11,31,58,0.09)', padding:'24px 28px', marginBottom:20 }
const inputSt = { width:'100%', border:'2px solid #e2e8f0', borderRadius:10, padding:'11px 14px', fontSize:14, color:N, background:'#fff', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

/* ── localStorage 헬퍼 ── */
const loadAcademy = () => {
  try { return JSON.parse(localStorage.getItem('hint_academy')) || {} } catch { return {} }
}
const saveAcademy = (info) => {
  try { localStorage.setItem('hint_academy', JSON.stringify(info)) } catch {}
}
const loadStudents = () => {
  try {
    // hint_students 우선, 없으면 구버전 hint_history 마이그레이션
    return JSON.parse(localStorage.getItem('hint_students'))
        || JSON.parse(localStorage.getItem('hint_history'))
        || []
  } catch { return [] }
}
const saveStudents = (list) => {
  try { localStorage.setItem('hint_students', JSON.stringify(list)) } catch {}
}

/* ══════════════════════════════════════════
   메인 앱
══════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen]       = useState('register')
  const [student, setStudent]     = useState({ name:'', school:'', grade:'초4', semester:1, class:'' })
  const [wrongs, setWrongs]       = useState([])
  const [errorTypes, setErrorTypes] = useState({})
  const [openIdxs, setOpenIdxs]   = useState([])
  const [aiText, setAiText]       = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [academy, setAcademy]     = useState({ name:'힌트 수학교습소', phone:'', address:'', teacher:'', ...loadAcademy() })
  const [showSettings, setShowSettings] = useState(false)
  const [students, setStudents]   = useState(loadStudents)
  const [searchQ, setSearchQ]     = useState('')
  const autoGenDone = useRef(false)
  const editingId   = useRef(null)   // 수정 중인 학생 id (null = 신규)

  /* 인쇄 직전 모든 아코디언 열기 */
  useEffect(() => {
    const before = () => setOpenIdxs(['all'])
    const after  = () => setOpenIdxs([])
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint',  after)
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after) }
  }, [])

  const questions    = DB[student.grade]?.[student.semester] || []
  const wrongItems   = questions.filter(q => wrongs.includes(q.q))
  const correctItems = questions.filter(q => !wrongs.includes(q.q))
  const correct      = questions.length - wrongs.length
  const pct          = questions.length ? Math.round(correct / questions.length * 100) : 0

  const toggleWrong = useCallback(qNum => {
    setWrongs(p => p.includes(qNum) ? p.filter(n=>n!==qNum) : [...p, qNum])
  }, [])

  const toggleET = useCallback((qNum, typeId) => {
    setErrorTypes(p => {
      const cur  = p[qNum] || []
      const next = cur.includes(typeId) ? cur.filter(id=>id!==typeId) : [...cur, typeId]
      return { ...p, [qNum]: next }
    })
  }, [])

  /* 단원별 집계 */
  const unitSummary = () => {
    const map   = {}
    const names = (UNIT_NAMES[student.grade]?.[student.semester]) || {}
    questions.forEach(q => {
      const topic = names[q.u] || q.u
      if (!map[q.u]) map[q.u] = { total:0, wrong:0, label:`${q.u} ${topic}`, topic }
      map[q.u].total++
      if (wrongs.includes(q.q)) map[q.u].wrong++
    })
    return Object.entries(map)
      .sort(([a],[b]) => parseInt(a) - parseInt(b))
      .map(([k,v]) => ({ key:k, ...v }))
  }

  /* 오류 패턴 */
  const errorPattern = () => {
    const catCount = {}
    let total = 0
    Object.values(errorTypes).forEach(types =>
      types.forEach(id => {
        const t = ET_MAP[id]
        if (t) { catCount[t.cat] = (catCount[t.cat]||0)+1; total++ }
      })
    )
    if (total === 0) return null
    const sorted   = Object.entries(catCount).sort((a,b)=>b[1]-a[1])
    const dominant = sorted[0][0]
    return { catCount, dominant, total, sorted }
  }

  const gradeBadge = p => {
    if (p>=90) return { label:'최우수', color:'#16a34a' }
    if (p>=80) return { label:'우수',   color:'#2563eb' }
    if (p>=70) return { label:'보통',   color:'#d97706' }
    return             { label:'노력 필요', color:O }
  }
  const badge = gradeBadge(pct)

  const [printing, setPrinting] = useState(false)

  const handlePrint = async () => {
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent)
    if (!isMobile) { window.print(); return }

    // 모바일: 오프스크린 클론 캡처 → PDF → Share Sheet → 블루투스/AirPrint
    setPrinting(true)
    let offScreen = null

    try {
      const el = document.getElementById('report-print')
      if (!el) return   // ⚠️ window.print() 금지 – iOS PWA에서 앱 리로드 발생

      // ── 오프스크린 클론 방식 ───────────────────────────────────────
      // 라이브 DOM 직접 수정 시 iOS가 800px overflow를 감지,
      // 메모리 압박으로 PWA를 kill → React 상태 초기화(register 화면) 문제 발생.
      // 해결: 화면 밖(-10000px)에 800px 클론을 생성해 캡처 후 즉시 제거.
      offScreen = document.createElement('div')
      offScreen.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#f0f2f5;z-index:-9999;pointer-events:none;'
      offScreen.appendChild(el.cloneNode(true))
      document.body.appendChild(offScreen)

      await new Promise(r => setTimeout(r, 200))   // 클론 렌더링 대기
      // ───────────────────────────────────────────────────────────────

      const canvas = await html2canvas(offScreen.firstChild, {
        scale: 1.5,           // 2→1.5: 메모리 사용량 44% 절감
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
      })

      // JPEG 압축으로 PDF 크기 추가 절감
      const imgData  = canvas.toDataURL('image/jpeg', 0.85)
      const pdf      = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const pageW    = 210
      const pageH    = 297
      const imgW     = pageW
      const imgH     = (canvas.height * imgW) / canvas.width
      let   y        = 0

      pdf.addImage(imgData, 'JPEG', 0, y, imgW, imgH)
      let remaining = imgH - pageH
      while (remaining > 0) {
        y -= pageH
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, y, imgW, imgH)
        remaining -= pageH
      }

      const blob     = pdf.output('blob')
      const fileName = `힌트_진단리포트_${student.name}.pdf`
      const file     = new File([blob], fileName, { type:'application/pdf' })

      if (navigator.canShare?.({ files:[file] })) {
        await navigator.share({ files:[file], title:fileName })
      } else {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href    = url; a.download = fileName
        a.click(); URL.revokeObjectURL(url)
      }
    } catch (e) {
      // AbortError = 사용자가 공유 시트를 취소한 것 → 정상, 무시
      if (e?.name !== 'AbortError') {
        console.error('print error:', e)
        alert('PDF 생성에 실패했습니다.\n' + (e?.message || String(e)))
      }
    } finally {
      if (offScreen?.parentNode) document.body.removeChild(offScreen)
      setPrinting(false)
    }
  }

  const goInput  = () => { if (!student.name.trim()||!student.school.trim()) { alert('이름과 학교를 입력해주세요.'); return }; setWrongs([]); setErrorTypes({}); setAiText(''); setScreen('input') }
  const goError  = () => { setAiText(''); autoGenDone.current = false; setScreen('errortype') }
  const goReport = () => {
    const now   = new Date()
    const date  = now.toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })
    const score = questions.length - wrongs.length
    let updated
    if (editingId.current) {
      // 기존 학생 업데이트
      updated = students.map(s => s.id === editingId.current
        ? { ...s, date, student:{...student}, wrongs:[...wrongs], errorTypes:{...errorTypes}, score, total:questions.length }
        : s)
    } else {
      // 신규 저장
      const entry = { id:Date.now(), date, student:{...student}, wrongs:[...wrongs], errorTypes:{...errorTypes}, score, total:questions.length }
      updated = [entry, ...students].slice(0, 100)
    }
    setStudents(updated)
    saveStudents(updated)
    setOpenIdxs(questions.filter(q=>wrongs.includes(q.q)).map((_,i)=>i))
    setScreen('report')
  }
  const goBack = () => {
    editingId.current = null
    setScreen('register'); setWrongs([]); setErrorTypes({}); setAiText(''); autoGenDone.current = false
  }

  // 학생 목록에서 리포트 보기
  const viewStudent = (entry) => {
    editingId.current = entry.id
    setStudent({ ...entry.student })
    setWrongs([...entry.wrongs])
    setErrorTypes({ ...entry.errorTypes })
    setAiText('')
    autoGenDone.current = false
    const qs = DB[entry.student.grade]?.[entry.student.semester] || []
    setOpenIdxs(qs.filter(q => entry.wrongs.includes(q.q)).map((_,i) => i))
    setScreen('report')
  }
  // 학생 목록에서 수정 (오류유형 재분류 화면으로)
  const editStudent = (entry) => {
    editingId.current = entry.id
    setStudent({ ...entry.student })
    setWrongs([...entry.wrongs])
    setErrorTypes({ ...entry.errorTypes })
    setAiText('')
    autoGenDone.current = false
    setScreen('input')
  }
  const deleteStudent = (id) => {
    if (!window.confirm('이 학생의 진단 기록을 삭제하시겠습니까?')) return
    const updated = students.filter(s => s.id !== id)
    setStudents(updated)
    saveStudents(updated)
  }

  /* 리포트 진입 시 종합 소견 자동 생성 */
  useEffect(() => {
    if (screen === 'report' && !autoGenDone.current) {
      autoGenDone.current = true
      generateAI()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  const handleSaveAcademy = (info) => { setAcademy(info); saveAcademy(info); setShowSettings(false) }

  /* 종합 진단 소견 생성 */
  const generateAI = async () => {
    const key = import.meta.env.VITE_ANTHROPIC_API_KEY || import.meta.env.ANTHROPIC_API_KEY
    if (!key || key.includes('xxx')) { setAiText('⚠️ .env 파일에 VITE_ANTHROPIC_API_KEY를 설정해 주세요.'); return }
    setAiLoading(true); setAiText('')
    const pat = errorPattern()
    const names = (UNIT_NAMES[student.grade]?.[student.semester]) || {}

    // 오답별 상세 (단원명, 오류유형, 오류원인, 보완필요이유)
    const wrongDetail = wrongItems.map(q => {
      const types = (errorTypes[q.q]||[]).map(id=>ET_MAP[id]).filter(Boolean)
      const typeStr = types.length ? types.map(t=>`${t.label}(${t.desc})`).join(' / ') : '오류유형 미분류'
      const unitName = names[q.u] || q.u
      return `• 문항${q.q} [${unitName}·${q.mj}] ${q.mn}\n  오류: ${typeStr}\n  틀린 이유: ${q.wr}\n  보완포인트: ${q.wm}`
    }).join('\n')

    // 오류 패턴 분석 요약
    const patDesc = pat
      ? pat.sorted.map(([cat,cnt])=>`${cat} ${cnt}건`).join(', ') + ` (주패턴: ${pat.dominant})`
      : '오답 없음'

    // 발견된 오류유형 목록
    const allTypes = [...new Set(Object.values(errorTypes).flat())]
    const typeList = allTypes.map(id=>ET_MAP[id]).filter(Boolean)
      .map(t=>`${t.label}: ${t.report}`).join('\n')

    const prompt = `아래 진단 데이터를 분석하여 학부모 상담용 종합 진단 소견을 작성하세요.

[학생 정보]
이름: ${student.name} / 학교: ${student.school} / 학년: ${student.grade} ${student.semester}학기 / 반: ${student.class}반

[진단 결과]
점수: ${correct}/${questions.length}문항 정답 (${pct}점)
오류 패턴 분포: ${patDesc}

[오답 상세 분석]
${wrongDetail || '전 문항 정답'}

[발견된 오류유형별 처방]
${typeList || '없음'}

[작성 지침]
다음 4개 항목을 각각 명확히 구분하여 작성하세요. 총 500자 내외.

① 현재 수준 진단
- 점수와 오답 패턴을 종합한 현재 수학 학습 수준을 구체적으로 서술
- 정답 문항에서 확인된 강점도 반드시 포함

② 핵심 오류 패턴 분석
- "왜 반복적으로 틀리는지" 근본 원인 분석
- 오답 문항명을 직접 언급하며 패턴을 설명

③ 우선 보완 방향 (구체적 처방 2~3가지)
- 지금 당장 시작해야 할 학습 방향을 우선순위 순서로 제시
- "무엇을, 어떻게, 얼마나" 구체적으로 작성

④ 가정 지원 방향
- 가정에서 문제집 풀 때 바로 적용 가능하고, 실제 시험장에서도 그대로 쓸 수 있는 습관 1가지만 제안
- 반드시 다음 기준을 충족할 것:
  · 행동이 명확하고 구체적일 것 (예: "구하는 것을 풀기 전에 한 줄로 쓴다", "조건에 밑줄을 긋고 번호를 매긴다", "풀고 나서 역연산으로 검산한다")
  · 시험장에서 소리 내어 말하기·손가락으로 짚기 등 실제 시험에서 실행 불가능한 방법은 절대 제안 금지
  · 부모가 지도하거나 확인하는 방식이 아닌, 학생이 혼자 실천하는 행동일 것
  · "매일 ○분" 식의 시간 기반 권고가 아닌, 문제를 풀 때마다 적용하는 루틴으로 제안

[형식 규칙 — 반드시 준수]
- 출력은 순수 텍스트만. **, ##, *, >, ---, _ 등 마크다운 기호 사용 절대 금지
- 각 항목 제목은 "① 현재 수준 진단" 형식으로만 표기
- 서명·맺음말·인사말 금지 (예: "드림", "교사 드림", "선생님 드림" 등 모두 금지)
- 이모지 금지
- "함께", "저희", "등록", "수업을 통해", "잘 해낼 것입니다" 등 홍보·격려 문구 금지
- 진단 보고서 수준의 전문적·중립적 어조 유지`

    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', { method:'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:2000, messages:[{ role:'user', content:prompt }] }) })
      const data = await res.json()
      const raw  = data.content?.[0]?.text || '생성 실패'
      setAiText(cleanAiOutput(raw))
    } catch { setAiText('API 오류. 키와 네트워크를 확인해 주세요.') }
    finally { setAiLoading(false) }
  }

  /* ══════════ SCREEN 1: 등록 ══════════ */
  if (screen === 'register') return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg,${N} 0%,#1a3a6b 100%)`, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:460 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:40, height:40, background:O, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:18 }}>H</div>
            <span style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{academy.name}</span>
          </div>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>수학 진단 리포트 시스템</p>
        </div>
        <div style={{ background:'#fff', borderRadius:20, padding:'36px 32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 style={{ fontSize:20, fontWeight:800, color:N, margin:0 }}>신규 학생 진단</h2>
              <p style={{ fontSize:13, color:'#999', marginTop:4 }}>정보를 입력하고 진단을 시작하세요</p>
            </div>
            <button onClick={()=>setShowSettings(true)} title="학원 정보 설정"
              style={{ background:'#f8f9fa', border:'none', borderRadius:10, width:38, height:38, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>⚙️</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="이름 *"><input style={inputSt} placeholder="홍길동" value={student.name} onChange={e=>setStudent(p=>({...p,name:e.target.value}))} /></Field>
            <Field label="학교 *"><input style={inputSt} placeholder="힌트초등학교" value={student.school} onChange={e=>setStudent(p=>({...p,school:e.target.value}))} /></Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 72px', gap:10 }}>
              <Field label="학년">
                <select style={inputSt} value={student.grade} onChange={e=>setStudent(p=>({...p,grade:e.target.value}))}>
                  <option value="초4">초등 4학년</option><option value="초5">초등 5학년</option><option value="초6">초등 6학년</option>
                </select>
              </Field>
              <Field label="학기">
                <select style={inputSt} value={student.semester} onChange={e=>setStudent(p=>({...p,semester:Number(e.target.value)}))}>
                  <option value={1}>1학기</option>
                  <option value={2}>2학기</option>
                </select>
              </Field>
              <Field label="반"><input style={inputSt} placeholder="1" value={student.class} onChange={e=>setStudent(p=>({...p,class:e.target.value}))} /></Field>
            </div>
          </div>
          <button onClick={()=>{ editingId.current=null; goInput() }}
            style={{ marginTop:24, width:'100%', background:O, color:'#fff', border:'none', borderRadius:12, padding:'15px 0', fontSize:16, fontWeight:700, cursor:'pointer' }}>
            진단 시작 →
          </button>
          {/* 학생 목록 이동 */}
          <button onClick={()=>setScreen('students')}
            style={{ marginTop:10, width:'100%', background:'transparent', color:N, border:`2px solid #e5e7eb`, borderRadius:12, padding:'13px 0', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            👥 학생 목록 {students.length > 0 && <span style={{ background:N, color:'#fff', borderRadius:10, fontSize:11, padding:'1px 7px', fontWeight:700 }}>{students.length}</span>}
          </button>
        </div>
      </div>
      {showSettings && <AcademyModal info={academy} onSave={handleSaveAcademy} onClose={()=>setShowSettings(false)} />}
    </div>
  )

  /* ══════════ SCREEN: 학생 목록 ══════════ */
  if (screen === 'students') {
    const filtered = students.filter(s =>
      s.student.name.includes(searchQ) ||
      s.student.school.includes(searchQ) ||
      s.student.grade.includes(searchQ)
    )
    return (
      <div style={{ minHeight:'100vh', background:'#f0f2f5' }}>
        {/* 헤더 */}
        <header style={{ background:N, height:60, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={()=>setScreen('register')} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', fontSize:13, cursor:'pointer' }}>← 홈</button>
            <span style={{ color:'#fff', fontWeight:700, fontSize:16 }}>학생 목록</span>
            <span style={{ background:'rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.8)', borderRadius:10, fontSize:12, padding:'2px 8px', fontWeight:700 }}>{students.length}명</span>
          </div>
          <button onClick={()=>{ editingId.current=null; setStudent({name:'',school:'',grade:'초4',semester:1,class:''}); setWrongs([]); setErrorTypes({}); setScreen('register') }}
            style={{ background:O, color:'#fff', border:'none', borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            + 새 학생 진단
          </button>
        </header>

        <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 20px 60px' }}>
          {/* 검색 */}
          <input
            value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            placeholder="이름, 학교, 학년 검색…"
            style={{ ...inputSt, marginBottom:16, background:'#fff', boxShadow:'0 1px 4px rgba(11,31,58,0.07)' }}
          />

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <p style={{ fontSize:32, marginBottom:12 }}>📋</p>
              <p style={{ color:'#aaa', fontSize:15 }}>{searchQ ? '검색 결과가 없습니다.' : '저장된 학생이 없습니다.'}</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtered.map(entry => {
                const pctH = entry.total ? Math.round(entry.score/entry.total*100) : 0
                const pctColor = pctH>=80?'#16a34a':pctH>=60?O:'#dc2626'
                const pctBg    = pctH>=80?'rgba(22,163,74,0.08)':pctH>=60?'rgba(243,112,34,0.08)':'rgba(220,38,38,0.08)'
                return (
                  <div key={entry.id} style={{ background:'#fff', borderRadius:14, boxShadow:'0 1px 6px rgba(11,31,58,0.08)', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                    {/* 점수 원형 */}
                    <div style={{ width:52, height:52, borderRadius:'50%', background:pctBg, border:`2px solid ${pctColor}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:14, fontWeight:900, color:pctColor, lineHeight:1 }}>{pctH}%</span>
                      <span style={{ fontSize:10, color:pctColor, opacity:.7 }}>{entry.score}/{entry.total}</span>
                    </div>
                    {/* 학생 정보 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:16, fontWeight:800, color:N }}>{entry.student.name}</span>
                        <span style={{ fontSize:12, background:'rgba(11,31,58,0.07)', color:N, borderRadius:6, padding:'2px 8px', fontWeight:600 }}>{entry.student.grade} {entry.student.semester}학기</span>
                        {entry.student.class && <span style={{ fontSize:12, color:'#888' }}>{entry.student.class}반</span>}
                      </div>
                      <p style={{ fontSize:12, color:'#888', margin:0 }}>
                        {entry.student.school} · 진단일 {entry.date}
                      </p>
                    </div>
                    {/* 버튼 */}
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={()=>viewStudent(entry)}
                        style={{ background:N, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        리포트
                      </button>
                      <button onClick={()=>editStudent(entry)}
                        style={{ background:'transparent', color:N, border:`1.5px solid #e5e7eb`, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        수정
                      </button>
                      <button onClick={()=>deleteStudent(entry.id)}
                        style={{ background:'transparent', color:'#dc2626', border:`1.5px solid #fecaca`, borderRadius:8, padding:'7px 10px', fontSize:12, cursor:'pointer' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ══════════ SCREEN 2: 오답 선택 ══════════ */
  if (screen === 'input') {
    const units = unitSummary()
    return (
      <div style={{ minHeight:'100vh', background:'#f0f2f5' }}>
        <AppHeader academy={academy} student={student} onSettings={()=>setShowSettings(true)} />
        <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 20px 100px' }}>
          <div style={{ background:`linear-gradient(135deg,${N},#1a3a6b)`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
            <h2 style={{ color:'#fff', fontSize:17, fontWeight:800, margin:'0 0 6px' }}>오답 문항 선택</h2>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:13, margin:0 }}>틀린 문항을 클릭하세요. 주황색으로 표시됩니다.</p>
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              {[{l:`오답 ${wrongs.length}`,c:O},{l:`정답 ${correct}`,c:'#4ade80'},{l:`전체 ${questions.length}`,c:'rgba(255,255,255,0.4)'}].map(({l,c})=>
                <span key={l} style={{ fontSize:13, fontWeight:700, color:c, background:'rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 12px' }}>{l}</span>
              )}
            </div>
          </div>
          <div style={{ ...card }}>
            <STitle>문항 선택</STitle>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
              {questions.map(q => {
                const w = wrongs.includes(q.q)
                return (
                  <button key={q.q} onClick={()=>toggleWrong(q.q)} title={`${q.u} ${q.mn}`}
                    style={{ border:`2px solid ${w?O:'#e5e7eb'}`, borderRadius:12, padding:'12px 4px 10px', cursor:'pointer',
                      background:w?'rgba(243,112,34,0.07)':'#fff', transition:'all .15s', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <span style={{ fontSize:20, fontWeight:900, color:w?O:N }}>{q.q}</span>
                    <span style={{ fontSize:10, color:w?O:'#bbb', fontWeight:600 }}>{q.u}</span>
                    {w && <span style={{ fontSize:9, background:O, color:'#fff', borderRadius:4, padding:'1px 5px', fontWeight:700 }}>오답</span>}
                  </button>
                )
              })}
            </div>
          </div>
          {wrongs.length > 0 && (
            <div style={{ ...card }}>
              <STitle>단원별 현황</STitle>
              {units.map(u => (
                <div key={u.key} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:600, color:N, marginBottom:4 }}>
                    <span>{u.label}</span>
                    <span style={{ color:u.wrong>0?O:'#22c55e' }}>{u.wrong}/{u.total}</span>
                  </div>
                  <div style={{ height:6, background:'#e8ecf0', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(u.wrong/u.total)*100}%`, background:u.wrong===0?'#22c55e':O, borderRadius:3 }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <BottomBar>
          <BGhost onClick={goBack}>← 처음으로</BGhost>
          <BPrimary onClick={wrongs.length>0?goError:goReport} style={{ flex:2 }}>{wrongs.length>0?'오류 유형 분석 →':'리포트 생성 →'}</BPrimary>
        </BottomBar>
        {showSettings && <AcademyModal info={academy} onSave={handleSaveAcademy} onClose={()=>setShowSettings(false)} />}
      </div>
    )
  }

  /* ══════════ SCREEN 2.5: 오류 유형 ══════════ */
  if (screen === 'errortype') return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5' }}>
      <AppHeader academy={academy} student={student} onSettings={()=>setShowSettings(true)} />
      <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 20px 100px' }}>
        <div style={{ background:`linear-gradient(135deg,${N},#1a3a6b)`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
          <h2 style={{ color:'#fff', fontSize:17, fontWeight:800, margin:'0 0 6px' }}>오류 유형 분석</h2>
          <p style={{ color:'rgba(255,255,255,0.72)', fontSize:13, margin:0 }}>학생과 대화 후 각 오답의 원인을 선택해 주세요. <span style={{ color:'rgba(255,255,255,0.45)', fontSize:12 }}>복수 선택 가능</span></p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
            {wrongItems.map(q => {
              const done = (errorTypes[q.q]||[]).length > 0
              return <div key={q.q} style={{ width:30, height:30, borderRadius:7, background:done?O:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff' }}>{q.q}</div>
            })}
            <span style={{ color:'rgba(255,255,255,0.5)', fontSize:12, alignSelf:'center', marginLeft:4 }}>
              {Object.keys(errorTypes).filter(k=>(errorTypes[k]||[]).length>0).length}/{wrongItems.length} 완료
            </span>
          </div>
        </div>

        {wrongItems.map(q => {
          const selected = errorTypes[q.q] || []
          return (
            <div key={q.q} style={{ ...card, border:`1.5px solid ${selected.length>0?O:'#e5e7eb'}`, padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
                <div style={{ width:36, height:36, background:selected.length>0?O:N, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', flexShrink:0 }}>{q.q}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:N }}>{q.u} · {q.mj}</div>
                  <div style={{ fontSize:13, color:'#666', marginTop:2 }}>{q.mn}</div>
                  <div style={{ fontSize:12, color:'#aaa', marginTop:2, fontStyle:'italic' }}>"{q.wr}"</div>
                </div>
                {selected.length > 0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:200 }}>
                    {selected.map(id => { const t=ET_MAP[id]; return t?<span key={id} style={{ fontSize:10, background:N, color:'#fff', borderRadius:5, padding:'2px 7px', fontWeight:700 }}>{t.label}</span>:null })}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {Object.entries(ET_BY_CAT).map(([cat, types]) => {
                  const meta = CAT_META[cat]
                  return (
                    <div key={cat} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:N, background:'rgba(11,31,58,0.07)', borderRadius:6, padding:'3px 8px', flexShrink:0, minWidth:52, textAlign:'center' }}>
                        {meta.icon} {cat}
                      </span>
                      {types.map(t => {
                        const on = selected.includes(t.id)
                        return (
                          <button key={t.id} onClick={()=>toggleET(q.q,t.id)} title={t.desc}
                            style={{ border:`1.5px solid ${on?N:'#e5e7eb'}`, borderRadius:8, padding:'5px 11px', fontSize:12, fontWeight:700,
                              background:on?N:'#fff', color:on?'#fff':N, cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}>
                            {t.label}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <BottomBar>
        <BGhost onClick={()=>setScreen('input')}>← 오답 수정</BGhost>
        <BPrimary onClick={goReport} style={{ flex:2 }}>리포트 생성 →</BPrimary>
      </BottomBar>
      {showSettings && <AcademyModal info={academy} onSave={handleSaveAcademy} onClose={()=>setShowSettings(false)} />}
    </div>
  )

  /* ══════════ SCREEN 3: 리포트 ══════════ */
  const units   = unitSummary()
  const pattern = errorPattern()

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5' }}>
      {/* 헤더 */}
      <header style={{ background:N, height:60, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.18)' }} className="no-print">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:O, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:15 }}>H</div>
          <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{academy.name}</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setShowSettings(true)} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:13, cursor:'pointer' }}>⚙️ 학원 정보</button>
          <button onClick={()=>setScreen('errortype')} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:13, fontWeight:600, cursor:'pointer' }}>← 수정</button>
          <button onClick={()=>setScreen('students')} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:13, fontWeight:600, cursor:'pointer' }}>👥 학생 목록</button>
          <button onClick={()=>{ editingId.current=null; goBack() }} style={{ background:O, color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ 새 학생</button>
          <button onClick={handlePrint} disabled={printing} style={{ background: printing ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)', color:'#fff', border:'none', borderRadius:8, padding:'7px 12px', fontSize:13, fontWeight:600, cursor: printing ? 'default' : 'pointer', opacity: printing ? 0.7 : 1 }}>
            {printing ? '⏳ 생성 중…' : (window.navigator.standalone ? '🖨 Safari로 인쇄' : '🖨 인쇄')}
          </button>
        </div>
      </header>

      <div id="report-print" style={{ maxWidth:800, margin:'0 auto', padding:'28px 20px 60px' }}>

        {/* ① 리포트 헤더 */}
        <div style={{ background:`linear-gradient(135deg,${N},#1a3a6b)`, borderRadius:20, padding:'28px 32px', marginBottom:20, boxShadow:'0 8px 32px rgba(11,31,58,0.18)' }}>
          {/* 학원 로고 라인 */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ width:32, height:32, background:O, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:14 }}>H</div>
            <span style={{ color:'rgba(255,255,255,0.55)', fontSize:12 }}>{academy.name} · 수학 진단 리포트</span>
            {academy.teacher && <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginLeft:'auto' }}>담당: {academy.teacher}</span>}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
            {/* 학생 정보 */}
            <div style={{ flex:1 }}>
              <h1 style={{ color:'#fff', fontSize:26, fontWeight:900, margin:'0 0 6px' }}>{student.name} 학생</h1>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, margin:'0 0 4px' }}>
                {student.school} · {student.grade} {student.class}반 · {student.semester}학기
              </p>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, margin:0 }}>
                진단일: {new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})}
              </p>
              {/* 점수 칩 */}
              <div style={{ display:'flex', gap:10, marginTop:16, flexWrap:'wrap' }}>
                {[['총 문항',questions.length,'문','rgba(255,255,255,0.8)'],['정답',correct,'문','#4ade80'],['오답',wrongs.length,'문',O],['정답률',`${pct}%`,'',badge.color]].map(([l,v,u,c])=>(
                  <div key={l} style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
                    <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', margin:'0 0 2px' }}>{l}</p>
                    <p style={{ fontSize:18, fontWeight:900, color:c, margin:0 }}>{v}<span style={{ fontSize:11 }}>{u}</span></p>
                  </div>
                ))}
                <div style={{ background:badge.color, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center' }}>
                  <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{badge.label}</span>
                </div>
              </div>
            </div>

            {/* 레이더 차트 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <RadarChart units={units} size={200} />
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, margin:0 }}>단원별 성취도</p>
            </div>
          </div>
        </div>

        {/* ② 단원별 현황 */}
        <div style={{ ...card }} className="avoid-break">
          <STitle icon="📊">단원별 학습 현황</STitle>
          {units.map(u => {
            const rate = Math.round((u.wrong/u.total)*100); const ok = u.wrong===0
            const pctUnit = 100 - rate
            return (
              <div key={u.key} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:N }}>{u.label}</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#888' }}>{u.total-u.wrong}/{u.total}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:ok?'#16a34a':rate>=67?'#dc2626':O, minWidth:38, textAlign:'right' }}>{pctUnit}%</span>
                    <span style={{ fontSize:11, fontWeight:700,
                      color:ok?'#16a34a':rate>=67?'#dc2626':O,
                      background:ok?'rgba(22,163,74,0.1)':rate>=67?'rgba(220,38,38,0.1)':'rgba(243,112,34,0.1)',
                      borderRadius:6, padding:'2px 8px' }}>
                      {ok?'✓ 완벽':rate>=67?'🚨 집중 필요':'⚠️ 보완 필요'}
                    </span>
                  </div>
                </div>
                <div style={{ height:8, background:'#e8ecf0', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pctUnit}%`, background:ok?'#22c55e':rate>=67?'#ef4444':O, borderRadius:4 }}/>
                </div>
              </div>
            )
          })}
        </div>

        {/* ③ 오류 유형 패턴 */}
        {pattern && (
          <div style={{ ...card }} className="avoid-break">
            <STitle icon="🔬">오류 유형 패턴 분석</STitle>

            {/* 상단: 분포 바 + 주요 패턴 설명 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              {/* 좌: 분포 */}
              <div>
                <p style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:10 }}>유형별 분포</p>
                {Object.entries(CAT_META).map(([cat,meta]) => {
                  const cnt = pattern.catCount[cat]||0; if(!cnt) return null
                  const w   = Math.round(cnt/pattern.total*100)
                  return (
                    <div key={cat} style={{ marginBottom:9 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, color:N, marginBottom:3 }}>
                        <span>{meta.icon} {cat}</span>
                        <span style={{ color:meta.color }}>{cnt}건 ({w}%)</span>
                      </div>
                      <div style={{ height:7, background:'#e8ecf0', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${w}%`, background:meta.color, borderRadius:4 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* 우: 주요 패턴 */}
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderLeft:`4px solid ${CAT_META[pattern.dominant].color}`, borderRadius:10, padding:'14px 16px' }}>
                <p style={{ fontSize:12, fontWeight:800, color:CAT_META[pattern.dominant].color, margin:'0 0 8px' }}>
                  {CAT_META[pattern.dominant].icon} 주요 패턴 — {pattern.dominant} 영역 집중
                </p>
                <p style={{ fontSize:12, color:'#444', lineHeight:1.75, margin:'0 0 10px' }}>
                  {CAT_META[pattern.dominant].summary}
                </p>
                <div style={{ background:'#f8f9fb', borderRadius:8, padding:'8px 10px' }}>
                  <p style={{ fontSize:11, fontWeight:800, color:'#555', margin:'0 0 4px' }}>✏️ 지도 방향</p>
                  <p style={{ fontSize:11, color:'#444', margin:0, lineHeight:1.7 }}>{CAT_META[pattern.dominant].guide}</p>
                </div>
              </div>
            </div>

            {/* 하단: 발견된 오류 유형 상세 — 카테고리별 그룹 */}
            <div style={{ borderTop:'1px solid #f0f0f0', paddingTop:14 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12 }}>발견된 오류 유형 상세</p>
              {(() => {
                const countMap = Object.values(errorTypes).flat()
                  .reduce((acc,id)=>{ acc[id]=(acc[id]||0)+1; return acc }, {})
                return Object.entries(CAT_META).map(([cat, meta]) => {
                  const items = Object.entries(countMap)
                    .filter(([id]) => ET_MAP[id]?.cat === cat)
                    .sort((a,b) => b[1]-a[1])
                  if (items.length === 0) return null
                  const catTotal = items.reduce((s,[,c]) => s+c, 0)
                  return (
                    <div key={cat} style={{ marginBottom:14 }}>
                      {/* 카테고리 헤더 */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <span style={{ width:3, height:18, background:meta.color, borderRadius:2, flexShrink:0 }}/>
                        <span style={{ fontSize:13, fontWeight:800, color:meta.color }}>{meta.icon} {cat} 오류</span>
                        <span style={{ fontSize:11, background:meta.color, color:'#fff', borderRadius:10, padding:'1px 8px', fontWeight:700 }}>{catTotal}건</span>
                      </div>
                      {/* 유형 카드 */}
                      <div style={{ display:'flex', flexDirection:'column', gap:6, paddingLeft:11 }}>
                        {items.map(([id,cnt]) => {
                          const t = ET_MAP[id]; if(!t) return null
                          return (
                            <div key={id} style={{ display:'flex', gap:10, padding:'10px 12px', background:'#fff', border:'1px solid #e8eaed', borderLeft:`3px solid ${O}`, borderRadius:8 }}>
                              <div style={{ flexShrink:0, paddingTop:2 }}>
                                <span style={{ fontSize:11, background:N, color:'#fff', borderRadius:5, padding:'2px 8px', fontWeight:800, whiteSpace:'nowrap' }}>
                                  {t.label}{cnt>1&&<span style={{ fontSize:10, opacity:.85 }}> ×{cnt}</span>}
                                </span>
                              </div>
                              <div style={{ flex:1 }}>
                                <p style={{ fontSize:12, color:'#555', margin:'0 0 4px', lineHeight:1.6 }}>
                                  <span style={{ fontWeight:700, color:'#333' }}>원인 </span>{t.desc}
                                </p>
                                <p style={{ fontSize:12, color:'#444', margin:0, lineHeight:1.6 }}>
                                  <span style={{ fontWeight:700, color:'#333' }}>처방 </span>{t.report}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}

        {/* ④ 강점 분석 */}
        {correctItems.length > 0 && (
          <div style={{ ...card }} className="avoid-break">
            <STitle icon="💪">강점 분석</STitle>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {correctItems.map(q=>(
                <div key={q.q} style={{ background:'#fff', border:'1px solid #e5e7eb', borderLeft:'3px solid #22c55e', borderRadius:10, padding:'10px 14px', flex:'1 1 calc(50% - 10px)', minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ width:22, height:22, background:'#22c55e', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:800 }}>{q.q}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:N }}>{q.u} · {q.mj}</span>
                  </div>
                  <p style={{ fontSize:12, color:'#555', lineHeight:1.5, margin:0 }}>{q.sm}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⑤ 취약점 정밀 분석 */}
        {wrongItems.length > 0 && (
          <div style={{ ...card }}>
            <STitle icon="🔍">취약점 정밀 분석</STitle>
            <p style={{ fontSize:13, color:'#888', marginBottom:16 }} className="no-print">항목을 클릭하면 상세 분석을 확인할 수 있습니다.</p>
            {wrongItems.map((q,i) => {
              const isOpen   = openIdxs.includes('all') || openIdxs.includes(i)
              const etIds    = errorTypes[q.q]||[]
              const etList   = etIds.map(id=>ET_MAP[id]).filter(Boolean)
              return (
                <div key={q.q} style={{ border:`1.5px solid ${isOpen?O:'#e5e7eb'}`, borderRadius:12, marginBottom:10, overflow:'hidden' }} className="avoid-break">
                  <button onClick={()=>setOpenIdxs(p => p.includes(i) ? p.filter(x=>x!==i) : [...p, i])}
                    style={{ width:'100%', background:isOpen?'rgba(243,112,34,0.06)':'#fff', border:'none', cursor:'pointer', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', textAlign:'left' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:28, height:28, background:isOpen?O:'#f1f5f9', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:isOpen?'#fff':N, fontSize:12, fontWeight:800 }}>{q.q}</span>
                      <div>
                        <span style={{ fontSize:14, fontWeight:700, color:N }}>{q.u} · {q.mj}</span>
                        <span style={{ fontSize:13, color:'#777', marginLeft:8 }}>{q.mn}</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      {etList.length>0
                        ? etList.map(t=><span key={t.id} style={{ fontSize:11, background:N, color:'#fff', borderRadius:5, padding:'2px 7px', fontWeight:700 }}>{t.label}</span>)
                        : <span style={{ fontSize:11, background:'#e5e7eb', color:'#666', borderRadius:5, padding:'2px 7px' }}>유형 미분류</span>
                      }
                      <span className="no-print" style={{ color:isOpen?O:'#ccc', fontSize:16, transition:'transform .2s', display:'inline-block', transform:isOpen?'rotate(180deg)':'none' }}>▾</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding:'16px 20px 20px', borderTop:'1px solid #f3f4f6', background:'#fff' }}>
                      {etList.length > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                          {etList.map(t=>(
                            <div key={t.id} style={{ background:'#fff', border:'1px solid #e8eaed', borderLeft:`3px solid ${O}`, borderRadius:8, padding:'8px 12px' }}>
                              <p style={{ fontSize:11, fontWeight:800, color:N, margin:'0 0 2px' }}>{CAT_META[t.cat].icon} {t.cat} — {t.label}</p>
                              <p style={{ fontSize:12, color:'#555', margin:'0 0 4px', lineHeight:1.5 }}>{t.desc}</p>
                              <p style={{ fontSize:12, color:'#444', margin:0, lineHeight:1.5 }}>{t.report}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                        <InfoBox label="취약점" text={q.wm} color={O} />
                        <InfoBox label="틀리는 이유" text={q.wr} color='#ef4444' />
                      </div>
                      <CurriculumLinks grade={student.grade} mj={q.mj} />
                      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderLeft:`3px solid ${O}`, borderRadius:8, padding:'14px 16px', marginBottom:10 }}>
                        <p style={{ fontSize:12, fontWeight:700, color:O, margin:'0 0 10px' }}>📚 보완 방법 3단계</p>
                        {q.mt.split('\n').map((s,si)=>(
                          <p key={si} style={{ fontSize:13, color:N, margin:'0 0 4px', lineHeight:1.8 }}>{s}</p>
                        ))}
                      </div>
                      <div style={{ background:'#f8f9fb', border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 14px' }}>
                        <p style={{ fontSize:11, fontWeight:700, color:'#555', margin:'0 0 4px' }}>📌 평가 요소</p>
                        <p style={{ fontSize:13, color:N, margin:0, lineHeight:1.6 }}>{q.ev}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ⑥ 학부모 상담 가이드 */}
        {wrongItems.length > 0 && (
          <div style={{ ...card }} className="avoid-break">
            <STitle icon="👨‍👩‍👧">학부모 상담 가이드</STitle>
            <p style={{ fontSize:13, color:'#888', marginBottom:14 }}>가정에서 함께 확인하고 지원해 주세요.</p>
            {wrongItems.map(q => {
              const etList = (errorTypes[q.q]||[]).map(id=>ET_MAP[id]).filter(Boolean)
              return (
                <div key={q.q} style={{ display:'flex', gap:12, marginBottom:10, padding:'12px 14px', background:'#fafafa', border:'1.5px solid #ebebeb', borderRadius:10 }}>
                  <div style={{ width:28, height:28, background:'rgba(243,112,34,0.1)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:O }}>{q.q}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, marginBottom:4 }}>
                      <p style={{ fontSize:13, fontWeight:700, color:N, margin:0 }}>{q.u} · {q.mn}</p>
                      {etList.map(t=><span key={t.id} style={{ fontSize:10, background:'rgba(11,31,58,0.08)', color:N, borderRadius:4, padding:'1px 6px', fontWeight:700 }}>{t.label}</span>)}
                    </div>
                    <p style={{ fontSize:13, color:'#444', margin:0, lineHeight:1.6 }}>{q.cs}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ⑦ 선생님 메모 */}
        <div style={{ ...card, border:'1.5px dashed #d1d5db' }} className="avoid-break">
          <STitle icon="✏️">선생님 메모</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {[...Array(5)].map((_,i)=>(
              <div key={i} style={{ height:32, borderBottom:'1px solid #ebebeb' }}/>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, paddingTop:14, borderTop:'1px solid #f0f0f0', fontSize:12, color:'#bbb' }}>
            <span>담당 교사: {academy.teacher||'_________________'}</span>
            <span>상담일: {new Date().toLocaleDateString('ko-KR')}</span>
          </div>
        </div>

        {/* ⑧ 종합 진단 소견 */}
        <div style={{ ...card }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <STitle icon="📋" style={{ margin:0 }}>종합 진단 소견</STitle>
            {(aiText || aiLoading) && (
              <button onClick={()=>{ autoGenDone.current=false; generateAI() }} className="no-print" disabled={aiLoading}
                style={{ background:'transparent', color:'#aaa', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'5px 12px', fontSize:12, cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                🔄 다시 생성
              </button>
            )}
          </div>

          {/* 로딩 */}
          {aiLoading && (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ width:36, height:36, border:`3px solid rgba(243,112,34,0.15)`, borderTopColor:O, borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 14px' }}/>
              <p style={{ color:'#aaa', fontSize:13, margin:0 }}>종합 진단 소견을 작성하고 있습니다…</p>
            </div>
          )}

          {/* 결과 */}
          {aiText && !aiLoading && (
            <div style={{ borderTop:'2px solid #e5e7eb', paddingTop:16 }}>
              <p style={{ fontSize:13.5, color:N, lineHeight:2, margin:0, whiteSpace:'pre-line' }}>{aiText}</p>
            </div>
          )}

          {/* 오류 표시 */}
          {!aiText && !aiLoading && (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <p style={{ color:'#ccc', fontSize:13 }}>소견을 불러오지 못했습니다.</p>
              <button onClick={()=>{ autoGenDone.current=false; generateAI() }} className="no-print"
                style={{ marginTop:10, background:O, color:'#fff', border:'none', borderRadius:8, padding:'8px 20px', fontSize:13, cursor:'pointer', fontWeight:700 }}>
                다시 시도
              </button>
            </div>
          )}
        </div>

        {/* 푸터 — 인쇄용 학원 정보 */}
        <div style={{ marginTop:24, padding:'18px 24px', borderTop:'2px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:800, color:N, margin:'0 0 2px' }}>{academy.name}</p>
            <p style={{ fontSize:12, color:'#888', margin:0 }}>
              {[academy.phone, academy.address].filter(Boolean).join(' · ')}
            </p>
          </div>
          <p style={{ fontSize:11, color:'#ccc', margin:0 }}>힌트 수학 진단 리포트 시스템</p>
        </div>
      </div>

      {showSettings && <AcademyModal info={academy} onSave={handleSaveAcademy} onClose={()=>setShowSettings(false)} />}

      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @media print {
          .no-print { display:none !important; }
          .avoid-break { page-break-inside:avoid; }
          body { background:white !important; font-size:12px; }
          * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          @page { margin:15mm 12mm; }
        }
      `}</style>
    </div>
  )
}

/* ══════════════════════════════════════════
   레이더 차트 (SVG)
══════════════════════════════════════════ */
function RadarChart({ units, size=200 }) {
  if (!units || units.length < 3) return null
  const cx     = size / 2
  const cy     = size / 2
  const R      = size * 0.34
  const labelR = size * 0.47
  const n      = units.length
  const step   = (2 * Math.PI) / n

  const pt = (i, r) => ({
    x: cx + r * Math.cos(i * step - Math.PI / 2),
    y: cy + r * Math.sin(i * step - Math.PI / 2),
  })

  const levels   = [0.25, 0.5, 0.75, 1]
  const dataPath = units.map((u, i) => {
    const score = (u.total - u.wrong) / u.total
    const p     = pt(i, R * score)
    return `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ') + ' Z'

  const anchor = (i) => {
    const angle = (i * step - Math.PI / 2) * 180 / Math.PI
    if (Math.abs(angle) < 25 || Math.abs(angle) > 155) return 'middle'
    return angle > 0 ? 'start' : 'end'
  }

  return (
    <svg width={size} height={size} style={{ overflow:'visible' }}>
      {/* 격자 */}
      {levels.map(lv => (
        <polygon key={lv}
          points={units.map((_,i)=>{ const p=pt(i,R*lv); return `${p.x},${p.y}` }).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      ))}
      {/* 축 */}
      {units.map((_,i) => {
        const p = pt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      })}
      {/* 데이터 폴리곤 */}
      <path d={dataPath} fill="rgba(243,112,34,0.25)" stroke={O} strokeWidth="2" strokeLinejoin="round" />
      {/* 데이터 포인트 */}
      {units.map((u,i) => {
        const score = (u.total-u.wrong)/u.total
        const p = pt(i, R*score)
        return <circle key={i} cx={p.x} cy={p.y} r="4" fill={O} stroke="#fff" strokeWidth="1.5" />
      })}
      {/* 라벨 */}
      {units.map((u,i) => {
        const p   = pt(i, labelR)
        const pct = Math.round(((u.total-u.wrong)/u.total)*100)
        const short = UNIT_SHORT[u.topic] || u.topic
        return (
          <g key={i}>
            <text x={p.x} y={p.y - 7} textAnchor={anchor(i)} dominantBaseline="middle"
              fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)" fontFamily="Noto Sans KR, sans-serif">
              {short}
            </text>
            <text x={p.x} y={p.y + 7} textAnchor={anchor(i)} dominantBaseline="middle"
              fontSize="10" fontWeight="800" fill={pct===100?'#4ade80':pct<50?O:'rgba(255,255,255,0.7)'} fontFamily="Noto Sans KR, sans-serif">
              {pct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ══════════════════════════════════════════
   학원 정보 설정 모달
══════════════════════════════════════════ */
function AcademyModal({ info, onSave, onClose }) {
  const [form, setForm] = useState({ ...info })
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'32px', width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:N, margin:'0 0 6px' }}>⚙️ 학원 정보 설정</h2>
        <p style={{ fontSize:13, color:'#888', marginBottom:24 }}>리포트 헤더·푸터에 표시됩니다. 저장 후 유지됩니다.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[['학원명','name','힌트 수학교습소'],['전화번호','phone','010-0000-0000'],['주소','address','서울시 강남구 ...'],['담당 선생님','teacher','홍길동 선생님']].map(([label,key,ph])=>(
            <Field key={key} label={label}>
              <input style={inputSt} placeholder={ph} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} />
            </Field>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:24 }}>
          <button onClick={onClose} style={{ flex:1, background:'transparent', color:N, border:`2px solid #e5e7eb`, borderRadius:10, padding:'12px 0', fontSize:14, fontWeight:700, cursor:'pointer' }}>취소</button>
          <button onClick={()=>onSave(form)} style={{ flex:2, background:O, color:'#fff', border:'none', borderRadius:10, padding:'12px 0', fontSize:14, fontWeight:700, cursor:'pointer' }}>저장</button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   단원 연계 컴포넌트
══════════════════════════════════════════ */
function CurriculumLinks({ grade, mj }) {
  const links = getConnections(grade, mj)
  if (!links.length) return null
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:3, height:16, background:O, borderRadius:2 }}/>
        <span style={{ fontSize:12, fontWeight:800, color:N }}>지금 보완하지 않으면 — 이후 학습에 미치는 영향</span>
      </div>
      <div style={{ position:'relative', paddingLeft:16 }}>
        <div style={{ position:'absolute', left:5, top:6, bottom:6, width:2, background:'#e5e7eb', borderRadius:1 }}/>
        {links.map((link,i) => (
          <div key={i} style={{ position:'relative', marginBottom:i<links.length-1?10:0, paddingLeft:18 }}>
            <div style={{ position:'absolute', left:-2, top:7, width:10, height:10, borderRadius:'50%', background:O, border:'2px solid #fff' }}/>
            <div style={{ background:'#f8f9fb', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:800, color:N, background:'rgba(11,31,58,0.08)', borderRadius:5, padding:'2px 7px' }}>{link.grade}</span>
                {link.unit && <span style={{ fontSize:11, color:'#999' }}>{link.unit}</span>}
                <span style={{ fontSize:12, fontWeight:700, color:'#333' }}>{link.topic}</span>
              </div>
              <p style={{ fontSize:12, color:'#555', margin:0, lineHeight:1.6 }}>{link.risk}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   공통 서브 컴포넌트
══════════════════════════════════════════ */
function AppHeader({ academy, student, onSettings }) {
  return (
    <header style={{ background:N, height:56, padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }} className="no-print">
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:30, height:30, background:O, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:14 }}>H</div>
        <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{academy.name}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>
          {student.school} {student.grade} {student.class}반 <strong style={{ color:'#fff' }}>{student.name}</strong>
        </span>
        <button onClick={onSettings} style={{ background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', borderRadius:7, width:30, height:30, cursor:'pointer', fontSize:14 }}>⚙️</button>
      </div>
    </header>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#555', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}

function STitle({ icon, children }) {
  return (
    <h2 style={{ fontSize:15, fontWeight:800, color:N, marginBottom:16, display:'flex', alignItems:'center', gap:7 }}>
      {icon && <span>{icon}</span>}{children}
    </h2>
  )
}

function InfoBox({ label, text, color }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderLeft:`3px solid ${color}`, borderRadius:8, padding:'10px 12px' }}>
      <p style={{ fontSize:11, fontWeight:700, color, margin:'0 0 4px' }}>{label}</p>
      <p style={{ fontSize:12, color:'#444', margin:0, lineHeight:1.55 }}>{text}</p>
    </div>
  )
}

function BPrimary({ children, onClick, style:s }) {
  return (
    <button onClick={onClick} style={{ background:O, color:'#fff', border:'none', borderRadius:12, padding:'14px 24px', fontSize:15, fontWeight:700, cursor:'pointer', ...s }}>{children}</button>
  )
}

function BGhost({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ background:'transparent', color:N, border:`2px solid ${N}`, borderRadius:12, padding:'13px 20px', fontSize:14, fontWeight:700, cursor:'pointer', flex:1 }}>{children}</button>
  )
}

function BottomBar({ children }) {
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #e5e7eb', padding:'12px 20px', display:'flex', gap:10, zIndex:50 }} className="no-print">
      {children}
    </div>
  )
}
