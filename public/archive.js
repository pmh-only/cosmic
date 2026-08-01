(() => {
  document.documentElement.classList.add('js')

  const date = document.querySelector('.system-clock')
  if (date) {
    date.textContent = new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  }

  const searchInput = document.querySelector('[data-search-input]')
  const records = [...document.querySelectorAll('[data-record]')]
  const resultCounts = document.querySelectorAll('[data-result-count]')
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
    resultCounts.forEach((resultCount) => {
      resultCount.textContent = String(visible)
    })
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
