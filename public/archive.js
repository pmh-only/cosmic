(() => {
  const root = document.documentElement
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const effectsButton = document.querySelector('[data-effects-toggle]')
  const canvas = document.querySelector('.matrix-rain')
  const context = canvas?.getContext('2d')
  let effectsEnabled = localStorage.getItem('cosmic-effects') !== 'off'
  let animationFrame = 0
  let columns = []
  let lastFrame = 0

  root.classList.add('js')

  function updateEffects() {
    root.classList.toggle('effects-off', !effectsEnabled)
    if (effectsButton) {
      effectsButton.textContent = `CRT: ${effectsEnabled ? 'ON' : 'OFF'}`
      effectsButton.setAttribute('aria-pressed', String(effectsEnabled))
    }
    localStorage.setItem('cosmic-effects', effectsEnabled ? 'on' : 'off')
    if (effectsEnabled && !reduceMotion.matches) startRain()
    else stopRain()
  }

  effectsButton?.addEventListener('click', () => {
    effectsEnabled = !effectsEnabled
    updateEffects()
  })

  function resizeRain() {
    if (!canvas || !context) return
    const scale = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.floor(window.innerWidth * scale)
    canvas.height = Math.floor(window.innerHeight * scale)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    context.setTransform(scale, 0, 0, scale, 0, 0)
    columns = Array.from({ length: Math.ceil(window.innerWidth / 22) }, () => Math.random() * -50)
  }

  function drawRain(timestamp) {
    if (!context || !canvas || !effectsEnabled || reduceMotion.matches) return
    animationFrame = requestAnimationFrame(drawRain)
    if (timestamp - lastFrame < 70) return
    lastFrame = timestamp
    context.fillStyle = 'rgba(0, 5, 2, 0.12)'
    context.fillRect(0, 0, window.innerWidth, window.innerHeight)
    context.font = '15px monospace'
    const glyphs = '01COS기록보존분류アクセスデータ'
    columns.forEach((position, index) => {
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)]
      context.fillStyle = Math.random() > 0.985 ? '#d8ff4f' : '#2faf52'
      context.fillText(glyph, index * 22, position * 22)
      columns[index] = position * 22 > window.innerHeight && Math.random() > 0.97 ? 0 : position + 1
    })
  }

  function startRain() {
    if (!canvas || !context || animationFrame) return
    resizeRain()
    animationFrame = requestAnimationFrame(drawRain)
  }

  function stopRain() {
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = 0
    context?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0)
  }

  window.addEventListener('resize', resizeRain, { passive: true })
  reduceMotion.addEventListener('change', updateEffects)
  updateEffects()

  const clock = document.querySelector('.system-clock')
  function updateClock() {
    if (!clock) return
    clock.textContent = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date())
  }
  updateClock()
  window.setInterval(updateClock, 1000)

  const searchInput = document.querySelector('[data-search-input]')
  const records = [...document.querySelectorAll('[data-record]')]
  const resultCount = document.querySelector('[data-result-count]')
  const noResults = document.querySelector('[data-no-results]')
  const initialQuery = new URLSearchParams(window.location.search).get('q')?.trim() || ''

  if (searchInput && initialQuery) searchInput.value = initialQuery

  function filterRecords() {
    const query = searchInput?.value.trim().toLocaleLowerCase('ko-KR') || ''
    let visible = 0
    records.forEach((record) => {
      const matches = !query || record.dataset.search.includes(query)
      record.hidden = !matches
      if (matches) visible += 1
    })
    if (resultCount) resultCount.textContent = String(visible)
    if (noResults) noResults.hidden = visible !== 0
  }

  searchInput?.addEventListener('input', filterRecords)
  document.querySelector('[data-search-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const query = searchInput?.value.trim() || ''
    const url = new URL(window.location.href)
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url)
    filterRecords()
  })
  if (initialQuery) filterRecords()
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && searchInput && document.activeElement !== searchInput) {
      event.preventDefault()
      searchInput.focus()
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = ''
      filterRecords()
      searchInput.blur()
    }
  })

  const article = document.querySelector('[data-dossier]')
  const sectionNav = document.querySelector('[data-section-nav]')
  if (article && sectionNav) {
    article.querySelectorAll('h2').forEach((heading, index) => {
      heading.id = `section-${String(index + 1).padStart(2, '0')}`
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = `#${heading.id}`
      link.textContent = `${String(index + 1).padStart(2, '0')} ${heading.textContent}`
      item.append(link)
      sectionNav.append(item)
    })
  }

  const progress = document.querySelector('[data-reading-progress]')
  function updateReadingProgress() {
    if (!progress) return
    const scrollable = document.documentElement.scrollHeight - window.innerHeight
    const percent = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0
    progress.style.width = `${percent}%`
  }
  window.addEventListener('scroll', updateReadingProgress, { passive: true })
  updateReadingProgress()
})()
