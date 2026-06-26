// ================================================================
// 2. الجدول الأسبوعي — WEEKLY_SCHEDULE (5 أسابيع × 6 أيام × 3 كراسات)
// ================================================================

/**
 * توزيع الـ 11 كراسة على 5 أسابيع × 6 أيام = 30 يوم
 * كل يوم يحتوي على 3 كراسات مختلفة (لا تتكرر في نفس اليوم).
 * كل كراسة تظهر 3 مرات أو 4 مرات بشكل متوازن.
 * الترتيب مبني على نظام دوران Latin Square لضمان التوزيع المتوازن.
 */
function buildWeeklySchedule() {
    // الـ 11 معرّف للكراسات (ids: 1..11)
    const ids = [1,2,3,4,5,6,7,8,9,10,11];
    // كل يوم دراسي (0-29) نختار 3 كراسات بحيث:
    //   - لا تتكرر في نفس اليوم
    //   - تتوزع بالتساوي عبر الأسابيع
    // نستخدم نمط دوران منظم
    const schedule = []; // 30 يوم، كل يوم 3 ids

    // بناء مصفوفة التوزيع يدوياً لضمان عدم التكرار في اليوم الواحد
    // واحدة = [i1, i2, i3] حيث i1≠i2≠i3 وتدور عبر 30 يوم
    // الفكرة: نستخدم ثلاث قوائم متداولة A/B/C، كل مجموعة تمثل موقعاً
    // A: 1,2,3,4,5,6,7,8,9,10,11,1,2,...  (تدور بخطوة 1)
    // B: A[i]+4 mod 11
    // C: A[i]+7 mod 11
    // نتحقق من عدم التكرار في كل يوم

    for (let day = 0; day < 30; day++) {
        const a = ids[day % 11];
        const b = ids[(day + 4) % 11];
        const c = ids[(day + 7) % 11];
        schedule.push([a, b, c]);
    }
    return schedule;
}

const DAILY_SCHEDULE = buildWeeklySchedule(); // مصفوفة 30 عنصر، كل عنصر [id1,id2,id3]

/**
 * يُعيد قائمة الكراسات الثلاث المقررة ليوم دراسي معين (0-based).
 */
function getPlanForDay(dayIndex) {
    const i = Math.max(0, Math.min(dayIndex, 29));
    return DAILY_SCHEDULE[i].map(id => courses.find(c => c.id === id)).filter(Boolean);
}

// ================================================================
// 3. دوال حساب الوقت — زمن الأسابيع
// ================================================================

// تحويل تاريخ إلى string YYYY-MM-DD بالتوقيت المحلي
function toLocalDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * احسب عدد الأيام الدراسية المنقضية (0-based) مع تجاهل أيام الجمعة.
 * يوم السبت الأول = اليوم الدراسي 0.
 */
function calcStudyDay(startDateStr) {
    const start = new Date(startDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    if (today < start) return -1;

    let studyDays = 0;
    const cur = new Date(start);
    while (cur <= today) {
        const dow = cur.getDay(); // 0=Sun,5=Fri,6=Sat
        if (dow !== 5) studyDays++; // الجمعة = 5، تُستثنى
        if (toLocalDateStr(cur) === toLocalDateStr(today)) break;
        cur.setDate(cur.getDate() + 1);
    }
    return studyDays - 1; // 0-based
}

// هل اليوم جمعة؟
function isTodayFriday() {
    return new Date().getDay() === 5;
}

// عدد الأيام الدراسية المكتملة (لا تشمل اليوم الحالي إن كان دراسياً بعد)
function completedStudyDays(startDateStr) {
    return Math.max(0, calcStudyDay(startDateStr));
}

/**
 * الأسبوع الحالي (0-based, 0..4)
 */
function getCurrentWeek(startDateStr) {
    const sd = calcStudyDay(startDateStr);
    if (sd < 0) return 0;
    return Math.min(Math.floor(sd / 6), 4);
}

/**
 * اليوم داخل الأسبوع الحالي (0=السبت .. 5=الخميس)
 */
function getCurrentDayInWeek(startDateStr) {
    const sd = calcStudyDay(startDateStr);
    if (sd < 0) return 0;
    return sd % 6;
}

// ================================================================
// 4. منطق فتح الدروس — نظام الأسابيع
// ================================================================

/**
 * عدد الدروس المفتوحة في كراسة معينة بناءً على رقم الأسبوع الحالي.
 * الأسبوع 0 → درس واحد، الأسبوع 1 → درسان، ... الأسبوع 4 → 5 دروس.
 */
function getUnlockedLessonCount(courseId, currentStudyDay) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return 0;
    const totalLessons = course.lessons.length;

    const mode = localStorage.getItem(LS_MODE);
    if (mode !== 'course') return totalLessons; // وضع حر

    if (currentStudyDay < 0) return 0;

    const currentWeek = Math.min(Math.floor(currentStudyDay / 6), 4);
    const unlocked = currentWeek + 1; // أسبوع 0 → 1 درس، أسبوع 4 → 5 دروس
    return Math.min(unlocked, totalLessons);
}

/**
 * هل الكراسة مفتوحة (ظهرت في الجدول حتى اليوم الحالي)؟
 */
function getUnlockedCourseIds() {
    const mode = localStorage.getItem(LS_MODE);
    if (mode !== 'course') return courses.map(c => c.id);

    const startDate = localStorage.getItem(LS_START_DATE);
    if (!startDate) return [];

    if (isTodayFriday()) {
        // الجمعة: تُفتح كل كراسات ظهرت في الأسبوع الحالي وما قبله
        const sd = completedStudyDays(startDate);
        const unlocked = new Set();
        for (let d = 0; d <= Math.min(sd, 29); d++) {
            getPlanForDay(d).forEach(c => unlocked.add(c.id));
        }
        return [...unlocked];
    }

    const sd = calcStudyDay(startDate);
    if (sd < 0) return [];
    const unlocked = new Set();
    for (let d = 0; d <= Math.min(sd, 29); d++) {
        getPlanForDay(d).forEach(c => unlocked.add(c.id));
    }
    return [...unlocked];
}

function isCourseUnlocked(courseId) {
    return getUnlockedCourseIds().includes(courseId);
}

function getCurrentStudyDayForUnlocking() {
    const startDate = localStorage.getItem(LS_START_DATE);
    if (!startDate) return -1;
    return calcStudyDay(startDate);
}

// ================================================================
// نظام الترحيب والإعداد (Welcome Modal) — يبقى كما هو مع تعديل النصوص
// ================================================================
function showWelcomeModal() {
    document.getElementById('welcomeModal').style.display = 'flex';
}
function closeWelcomeModal() {
    document.getElementById('welcomeModal').style.display = 'none';
}

let currentStep = 1;
function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.welcome-step').forEach(el => {
        el.style.display = 'none';
    });
    const s = document.getElementById(`step${step}`);
    if (s) s.style.display = 'block';
}
function selectMode(mode) {
    localStorage.setItem(LS_MODE, mode);
    if (mode === 'free') {
        localStorage.setItem(LS_SETUP_DONE, '1');
        closeWelcomeModal();
        navigateTo('home');
        updateModeBadge();
    } else {
        goToStep(2);
    }
}

function confirmDate() {
    const picker = document.getElementById('startDatePicker');
    if (!picker || !picker.value) return;
    localStorage.setItem(LS_START_DATE, picker.value);
    goToStep(3);

    const startDate = picker.value;
    const todayStudyDay = calcStudyDay(startDate);
    const week = getCurrentWeek(startDate);
    const dayInWeek = getCurrentDayInWeek(startDate);

    const dayNames = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];
    const previewEl = document.getElementById('planPreview');
    if (previewEl) {
        if (isTodayFriday()) {
            previewEl.innerHTML = `<p style="text-align:center;color:var(--gold);">🌙 اليوم جمعة — يوم المراجعة والراحة</p>`;
        } else if (todayStudyDay >= 0) {
            const todayCourses = getPlanForDay(todayStudyDay);
            previewEl.innerHTML = `
                <p style="margin-bottom:8px;color:var(--gold);">📅 <strong>الأسبوع ${week+1} — ${dayNames[dayInWeek]}</strong></p>
                <p style="margin-bottom:10px;font-size:0.85rem;color:var(--text-light);">كراساتك اليوم:</p>
                <ul style="list-style:none;padding:0;margin:0;">
                    ${todayCourses.map(c => `<li style="padding:4px 0;"><i class="fas fa-book-open" style="color:var(--gold);margin-left:6px;"></i>${c.title}</li>`).join('')}
                </ul>
            `;
        } else {
            previewEl.innerHTML = `<p style="text-align:center;color:var(--text-light);">📅 ستبدأ الدراسة في تاريخك المحدد</p>`;
        }
    }
}

function finishSetup() {
    const picker = document.getElementById('startDatePicker');
    const startDate = picker ? picker.value : localStorage.getItem(LS_START_DATE);
    if (!startDate) return;
    localStorage.setItem(LS_START_DATE, startDate);
    localStorage.setItem(LS_SETUP_DONE, '1');
    closeWelcomeModal();
    navigateTo('home');
    updateModeBadge();
}

function resetApp() {
    ['LS_MODE','LS_START_DATE','LS_SETUP_DONE'].forEach(key => {
        localStorage.removeItem(localStorage[key] || key);
    });
    // حذف مفاتيح localStorage مباشرة بالأسماء الثابتة
    localStorage.removeItem(LS_MODE);
    localStorage.removeItem(LS_START_DATE);
    localStorage.removeItem(LS_SETUP_DONE);
    const el = document.getElementById('startDatePicker');
    if (el) el.style.display = 'none';
    goToStep(1);
    showWelcomeModal();
    updateModeBadge();
}

// ----------------------------------------------------------------
// شريط البادج العلوي — يعرض "الأسبوع X من 5"
// ----------------------------------------------------------------
function updateModeBadge() {
    const badge = document.getElementById('modeBadge');
    if (!badge) return;
    const mode = localStorage.getItem(LS_MODE);
    if (mode === 'course') {
        const startDate = localStorage.getItem(LS_START_DATE);
        const week = startDate ? Math.min(getCurrentWeek(startDate) + 1, 5) : 1;
        badge.innerHTML = `<span class="mode-badge"><i class="fas fa-graduation-cap"></i> الأسبوع ${Math.max(1,week)} من 5</span>`;
    } else if (mode === 'free') {
        badge.innerHTML = `<span class="mode-badge free-mode"><i class="fas fa-search"></i> تصفح حر</span>`;
    } else {
        badge.innerHTML = '';
    }
}

// ----------------------------------------------------------------
// نافذة الجمعة — إحصائيات الأسبوع
// ----------------------------------------------------------------
function showFridayModal() {
    const mode = localStorage.getItem(LS_MODE);
    if (mode !== 'course') return;

    const startDate = localStorage.getItem(LS_START_DATE);
    const week = startDate ? getCurrentWeek(startDate) + 1 : 1;
    const studyDay = startDate ? completedStudyDays(startDate) : 0;

    let totalLessons = 0, completedLessons = 0;
    courses.forEach(course => {
        course.lessons.forEach((_, idx) => {
            totalLessons++;
            if (isLessonDone(course.id, idx)) completedLessons++;
        });
    });

    document.getElementById('fridayStats').innerHTML = `
        <div class="friday-stat">
            <span class="fs-num">${week}</span>
            <span class="fs-lbl">الأسبوع الحالي</span>
        </div>
        <div class="friday-stat">
            <span class="fs-num">${completedLessons}</span>
            <span class="fs-lbl">درس أتممته</span>
        </div>
        <div class="friday-stat">
            <span class="fs-num">${Math.max(0, 5 - week)}</span>
            <span class="fs-lbl">أسبوع متبقي</span>
        </div>
    `;

    document.getElementById('fridayModal').classList.add('show');
}

function closeFridayModal() {
    document.getElementById('fridayModal').classList.remove('show');
}

// ================================================================
// 3. دوال التنقل
// ================================================================
function navigateTo(section, params) {
    if (section === 'course') {
        currentCourseId = params.courseId;
        currentLessonIndex = params.lessonIndex || 0;
        currentSection = 'course';
    } else {
        currentSection = section;
        currentCourseId = null;
        currentLessonIndex = 0;
    }
    renderSection();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('navLinks').classList.remove('active');
}

// ================================================================
// 4. دوال العرض
// ================================================================
function renderSection() {
    let html = '';
    switch (currentSection) {
        case 'home':    html = renderHome();                                break;
        case 'plan':    html = renderPlan();                                break;
        case 'courses': html = renderCoursesGrid();                         break;
        case 'contact': html = renderContact();                             break;
        case 'course':  html = renderCourseDetail(currentCourseId, currentLessonIndex); break;
        default:        html = renderHome();
    }
    appContainer.innerHTML = html;
    if (currentSection === 'course') attachCourseEvents(currentCourseId);
    updateProgressIndicators();
}

// ---------- الصفحة الرئيسية ----------
function renderHome() {
    const mode = localStorage.getItem(LS_MODE);
    const startDate = localStorage.getItem(LS_START_DATE);
    let todayBanner = '';

    if (mode === 'course' && startDate) {
        const studyDay = calcStudyDay(startDate);
        const week = getCurrentWeek(startDate);
        const dayInWeek = getCurrentDayInWeek(startDate);
        const dayNames = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس'];

        if (isTodayFriday()) {
            // ── يوم الجمعة: عرض المراجعة فقط ──
            // نجمع كراسات الأسبوع الحالي
            const weekStart = week * 6;
            const weekEnd = weekStart + 5;
            const weekCourseIds = new Set();
            for (let d = weekStart; d <= Math.min(weekEnd, 29); d++) {
                getPlanForDay(d).forEach(c => weekCourseIds.add(c.id));
            }
            const weekCourses = courses.filter(c => weekCourseIds.has(c.id));

            todayBanner = `
                <div style="background:linear-gradient(135deg,rgba(46,139,87,0.15),rgba(46,139,87,0.05));border:1px solid rgba(46,139,87,0.3);border-radius:16px;padding:20px 22px;margin-bottom:24px;">
                    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                        <span style="font-size:2rem;">🌙</span>
                        <div>
                            <strong style="color:#2E8B57;display:block;font-size:1rem;">يوم الجمعة — يوم المراجعة والراحة يا بطل</strong>
                            <span style="color:rgba(255,255,255,0.6);font-size:0.85rem;">راجع كراسات الأسبوع ${week+1} واستعد للأسبوع القادم</span>
                        </div>
                        <button onclick="showFridayModal()" style="margin-right:auto;background:rgba(46,139,87,0.2);border:1px solid rgba(46,139,87,0.4);color:#2E8B57;padding:8px 16px;border-radius:20px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:700;font-size:0.85rem;white-space:nowrap;">
                            إحصائياتي
                        </button>
                    </div>
                    <p style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin:0 0 12px;">كراسات الأسبوع ${week+1} للمراجعة:</p>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        ${weekCourses.map(c => `
                            <button onclick="navigateTo('course',{courseId:${c.id},lessonIndex:0})"
                                style="background:rgba(46,139,87,0.15);border:1px solid rgba(46,139,87,0.3);color:rgba(255,255,255,0.85);padding:8px 16px;border-radius:20px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:0.85rem;display:flex;align-items:center;gap:6px;">
                                <i class="fas fa-book-open" style="color:#2E8B57;font-size:0.75rem;"></i>${c.title}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
            // في يوم الجمعة: نُخفي الكراسات الجديدة تماماً، نعرض فقط البانر
            return `
                ${todayBanner}
                <div class="hero">
                    <h1>حصون الإيمان</h1>
                    <p>المنهج الصيفي المتكامل لبناء شخصية ابنك المسلمة</p>
                    <p class="sub-meta">📚 11 كراسة &nbsp;|&nbsp; 5 أسابيع &nbsp;|&nbsp; للفئة 9-15 سنة</p>
                </div>
                <div class="author-card">
                    <div class="author-emblem">🛡️</div>
                    <div class="author-label">إعداد وتأليف المادة العلمية</div>
                    <div class="author-name">محمد أبو عبد الرحمن</div>
                    <div class="author-dua">عفا الله عنه ووالديه والمسلمين</div>
                    <div class="author-divider"></div>
                    <span class="author-edition">
                        <i class="fas fa-medal" style="color:#D4AF37"></i>
                        الإصدار الثاني — 2026م
                    </span>
                </div>
            `;

        } else if (studyDay >= 0 && studyDay <= 29) {
            // ── يوم دراسي عادي: عرض كراسات اليوم مع تقدمها ──
            const todayCourses = getPlanForDay(studyDay);
            const unlockedCount = week + 1;

            todayBanner = `
                <div style="background:linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.04));border:1px solid rgba(212,175,55,0.25);border-radius:16px;padding:18px 22px;margin-bottom:24px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                        <span style="font-size:1.5rem;">📅</span>
                        <div>
                            <strong style="color:#D4AF37;display:block;font-size:1rem;">الأسبوع ${week+1} — ${dayNames[dayInWeek]}</strong>
                            <span style="color:rgba(255,255,255,0.5);font-size:0.8rem;">الدروس المفتوحة: ${unlockedCount} درس لكل كراسة</span>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
                        ${todayCourses.map(c => {
                            const progress = getCourseProgress(c.id);
                            const totalL = c.lessons.length;
                            const openL = Math.min(unlockedCount, totalL);
                            return `
                                <div onclick="navigateTo('course',{courseId:${c.id},lessonIndex:0})"
                                    style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:12px 14px;cursor:pointer;transition:background 0.2s;"
                                    onmouseenter="this.style.background='rgba(212,175,55,0.15)'" onmouseleave="this.style.background='rgba(212,175,55,0.08)'">
                                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                                        <i class="fas ${c.icon}" style="color:${c.color};font-size:1rem;"></i>
                                        <strong style="font-size:0.88rem;color:rgba(255,255,255,0.9);">${c.title}</strong>
                                    </div>
                                    <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:6px;">${openL} / ${totalL} درس مفتوح</div>
                                    <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:4px;overflow:hidden;">
                                        <div style="background:#D4AF37;height:100%;width:${progress}%;transition:width 0.4s;"></div>
                                    </div>
                                    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-top:4px;">${progress}% مكتمل</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (studyDay < 0) {
            // لم تبدأ الدورة بعد
            todayBanner = `
                <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:16px;padding:16px 20px;margin-bottom:24px;text-align:center;">
                    <span style="font-size:1.5rem;">⏳</span>
                    <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:0.9rem;">الدورة لم تبدأ بعد — ستبدأ دروسك في التاريخ المحدد</p>
                </div>
            `;
        } else {
            // انتهت الأسابيع الخمسة
            todayBanner = `
                <div style="background:linear-gradient(135deg,rgba(46,139,87,0.15),rgba(46,139,87,0.05));border:1px solid rgba(46,139,87,0.3);border-radius:16px;padding:18px 22px;margin-bottom:24px;text-align:center;">
                    <span style="font-size:2rem;">🏆</span>
                    <strong style="color:#2E8B57;display:block;margin:8px 0 4px;">أتممت الرحلة الإيمانية!</strong>
                    <p style="color:rgba(255,255,255,0.6);font-size:0.85rem;margin:0;">جزاك الله خيراً على إتمام 5 أسابيع من حصون الإيمان</p>
                </div>
            `;
        }
    }

    return `
        ${todayBanner}
        <div class="hero">
            <h1>حصون الإيمان</h1>
            <p>المنهج الصيفي المتكامل لبناء شخصية ابنك المسلمة</p>
            <p class="sub-meta">📚 11 كراسة &nbsp;|&nbsp; 5 أسابيع &nbsp;|&nbsp; للفئة 9-15 سنة</p>
            <div class="hero-actions">
                <a class="btn-hero btn-game" href="game.html">
                    <i class="fas fa-gamepad"></i> ابدأ السباق الآن
                </a>
                <button class="btn-hero" onclick="navigateTo('courses')">
                    <i class="fas fa-book-open"></i> تصفح الكراسات
                </button>
            </div>
        </div>

        <div class="author-card">
            <div class="author-emblem">🛡️</div>
            <div class="author-label">إعداد وتأليف المادة العلمية</div>
            <div class="author-name">محمد أبو عبد الرحمن</div>
            <div class="author-dua">عفا الله عنه ووالديه والمسلمين</div>
            <div class="author-divider"></div>
            <span class="author-edition">
                <i class="fas fa-medal" style="color:#D4AF37"></i>
                الإصدار الثاني — 2026م
            </span>
        </div>

        <h2 class="section-title">الكراسات العشر</h2>
        <div class="courses-grid">
            ${courses.map(c => {
                const progress = getCourseProgress(c.id);
                const unlocked = isCourseUnlocked(c.id);
                const mode = localStorage.getItem(LS_MODE);
                const lockHtml = (mode === 'course' && !unlocked) ? `
                    <div style="margin-top:10px;display:flex;align-items:center;gap:6px;justify-content:center;color:rgba(255,255,255,0.4);font-size:0.78rem;">
                        <i class="fas fa-lock" style="color:#D4AF37;"></i> يُفتح في موعده
                    </div>` : '';
                return `
                    <div class="course-card ${mode === 'course' && !unlocked ? 'lesson-locked' : ''}"
                         onclick="${mode !== 'course' || unlocked ? `navigateTo('course', {courseId: ${c.id}, lessonIndex: 0})` : 'void(0)'}">
                        <div class="icon"><i class="fas ${c.icon}" style="color:${c.color}"></i></div>
                        <h3>${c.title}</h3>
                        <div class="badge">${c.lessons.length} دروس</div>
                        <div class="progress-indicator">
                            <div class="fill" style="width:${progress}%;"></div>
                        </div>
                        <span style="font-size:0.8rem;color:var(--text-light);">${progress}% مكتمل</span>
                        ${lockHtml}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ---------- صفحة الكراسات ----------
function renderCoursesGrid() {
    const mode = localStorage.getItem(LS_MODE);

    if (mode === 'course') {
        // في وضع الدورة: توجيه المستخدم للصفحة الرئيسية
        return `
            <h2 class="section-title">الكراسات العشر</h2>
            <div style="text-align:center;padding:30px 20px;margin-bottom:24px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:16px;">
                <span style="font-size:2rem;display:block;margin-bottom:10px;">📅</span>
                <p style="color:rgba(255,255,255,0.7);max-width:360px;margin:0 auto 16px;font-size:0.9rem;">
                    في وضع الدورة المنظمة، تُعرض كراساتك اليومية من الصفحة الرئيسية حسب جدول الأسبوع.
                </p>
                <button onclick="navigateTo('home')" style="background:var(--gold);color:#1a1207;border:none;padding:10px 24px;border-radius:24px;font-family:'Cairo',sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;">
                    <i class="fas fa-home"></i> الذهاب للرئيسية
                </button>
            </div>
            <div class="courses-grid">
                ${courses.map(c => {
                    const progress = getCourseProgress(c.id);
                    const unlocked = isCourseUnlocked(c.id);
                    const lockHtml = !unlocked ? `
                        <div style="margin-top:10px;display:flex;align-items:center;gap:6px;justify-content:center;color:rgba(255,255,255,0.4);font-size:0.78rem;">
                            <i class="fas fa-lock" style="color:#D4AF37;"></i> يُفتح في موعده
                        </div>` : '';
                    return `
                        <div class="course-card ${!unlocked ? 'lesson-locked' : ''}"
                             onclick="${unlocked ? `navigateTo('course', {courseId: ${c.id}, lessonIndex: 0})` : 'void(0)'}">
                            <div class="icon"><i class="fas ${c.icon}" style="color:${c.color}"></i></div>
                            <h3>${c.title}</h3>
                            <div class="badge">${c.lessons.length} دروس</div>
                            <div class="progress-indicator">
                                <div class="fill" style="width:${progress}%;"></div>
                            </div>
                            <span style="font-size:0.8rem;color:var(--text-light);">${progress}% مكتمل</span>
                            ${lockHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // وضع حر: شبكة كاملة
    return `
        <h2 class="section-title">الكراسات العشر</h2>
        <div class="courses-grid">
            ${courses.map(c => {
                const progress = getCourseProgress(c.id);
                return `
                    <div class="course-card" onclick="navigateTo('course', {courseId: ${c.id}, lessonIndex: 0})">
                        <div class="icon"><i class="fas ${c.icon}" style="color:${c.color}"></i></div>
                        <h3>${c.title}</h3>
                        <div class="badge">${c.lessons.length} دروس</div>
                        <div class="progress-indicator">
                            <div class="fill" style="width:${progress}%;"></div>
                        </div>
                        <span style="font-size:0.8rem;color:var(--text-light);">${progress}% مكتمل</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ---------- خطة التدريس الأسبوعية ----------
function renderPlan() {
    const dayNames = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    const startDate = localStorage.getItem(LS_START_DATE);
    const mode = localStorage.getItem(LS_MODE);
    const todayStudy = startDate ? calcStudyDay(startDate) : -1;
    const currentWeek = startDate ? getCurrentWeek(startDate) : -1;

    let weeksHtml = '';
    for (let w = 0; w < 5; w++) {
        const isCurrentWeek = (mode === 'course' && w === currentWeek && !isTodayFriday());
        let daysHtml = '';
        for (let d = 0; d < 6; d++) {
            const dayIndex = w * 6 + d;
            const dayCourses = getPlanForDay(dayIndex);
            const isToday = (mode === 'course' && dayIndex === todayStudy && !isTodayFriday());
            daysHtml += `
                <tr style="${isToday ? 'background:rgba(212,175,55,0.14);font-weight:700;' : ''}">
                    <td style="${isToday ? 'color:#D4AF37;' : ''}">${isToday ? '📍 ' : ''}${dayNames[d]}</td>
                    ${dayCourses.map(c => `<td>${c.title}</td>`).join('')}
                </tr>
            `;
        }
        // يوم الجمعة للمراجعة
        daysHtml += `
            <tr style="background:rgba(46,139,87,0.08);font-style:italic;">
                <td style="color:#2E8B57;">🌙 الجمعة</td>
                <td colspan="3" style="text-align:center;color:rgba(255,255,255,0.5);font-size:0.85rem;">يوم المراجعة والراحة</td>
            </tr>
        `;
        weeksHtml += `
            <div style="margin-bottom:28px;">
                <h3 style="color:${isCurrentWeek ? '#D4AF37' : 'var(--text-light)'};margin-bottom:12px;font-size:0.95rem;">
                    ${isCurrentWeek ? '📍 ' : ''}الأسبوع ${w+1} ${isCurrentWeek ? '(الأسبوع الحالي)' : ''}
                </h3>
                <div class="plan-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>اليوم</th>
                                <th>الكراسة الأولى</th>
                                <th>الكراسة الثانية</th>
                                <th>الكراسة الثالثة</th>
                            </tr>
                        </thead>
                        <tbody>${daysHtml}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return `
        <h2 class="section-title">📅 خطة التدريس الأسبوعية</h2>
        <p style="text-align:center;color:var(--text-light);margin-bottom:24px;font-size:0.88rem;">5 أسابيع &nbsp;|&nbsp; 6 أيام دراسية / أسبوع &nbsp;|&nbsp; 3 كراسات / يوم</p>
        ${weeksHtml}
        <p style="text-align:center;margin-top:8px;color:var(--text-light);">
            <i class="fas fa-info-circle"></i> خطة مرنة — يمكن تعديلها حسب رغبة المعلم
        </p>
    `;
}

// ---------- جهات الاتصال ----------
function renderContact() {
    return `
        <div class="author-card" style="margin-bottom:28px;">
            <div class="author-emblem">🛡️</div>
            <div class="author-label">إعداد وتأليف المادة العلمية والمنهج</div>
            <div class="author-name">محمد أبو عبد الرحمن</div>
            <div class="author-dua">عفا الله عنه ووالديه وجميع المسلمين</div>
            <div class="author-divider"></div>
            <span class="author-edition">
                <i class="fas fa-book-open" style="color:#D4AF37"></i>
                حصون الإيمان — الإصدار الثاني 2026م
            </span>
        </div>
        <div class="contact-box">
            <h2><i class="fas fa-headset"></i> تواصل معنا</h2>
            <p style="font-size:1.1rem;color:var(--text-light);">للاستفسارات أو الدعم الفني</p>
            <div class="contact-buttons">
                <a href="https://chat.whatsapp.com/ImbpCTYkTwHJvD9akTAIPD" target="_blank" class="wa">
                    <i class="fab fa-whatsapp"></i> واتساب
                </a>
                <a href="https://t.me/+bHRjkt2DD_BmODhk" class="tg">
                    <i class="fab fa-telegram"></i> تليجرام
                </a>
                <a href="mailto:abukora8@gmail.com" class="em">
                    <i class="far fa-envelope"></i> البريد الإلكتروني
                </a>
            </div>
        </div>
    `;
}

// ---------- تفاصيل الكراسة ----------
function renderCourseDetail(courseId, lessonIndex) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return '<p style="text-align:center;padding:40px;">الكراسة غير موجودة.</p>';

    const totalLessons = course.lessons.length;
    const progress = getCourseProgress(course.id);

    const currentStudyDay = getCurrentStudyDayForUnlocking();
    const unlockedCount   = getUnlockedLessonCount(courseId, currentStudyDay);
    const mode            = localStorage.getItem(LS_MODE);
    const isFreeMode      = (mode !== 'course');

    if (!isFreeMode && lessonIndex >= unlockedCount && unlockedCount > 0) {
        lessonIndex = unlockedCount - 1;
    } else if (!isFreeMode && unlockedCount === 0) {
        return `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:3rem;margin-bottom:16px;">🔒</div>
                <h3 style="color:var(--gold);margin-bottom:12px;">هذه الكراسة لم تُفتح بعد</h3>
                <p style="color:var(--text-light);max-width:320px;margin:0 auto 24px;">
                    ستُفتح هذه الكراسة تلقائياً عندما تصل إليها في جدولك الأسبوعي.
                </p>
                <button onclick="navigateTo('home')" style="background:var(--gold);color:#1a1207;border:none;padding:12px 28px;border-radius:24px;font-family:'Cairo',sans-serif;font-weight:700;font-size:0.95rem;cursor:pointer;">
                    <i class="fas fa-arrow-right"></i> العودة للرئيسية
                </button>
            </div>
        `;
    }

    let sidebarLinks = course.lessons.map((l, idx) => {
        const done       = isLessonDone(course.id, idx);
        const isUnlocked = isFreeMode || (idx < unlockedCount);
        const active     = (idx === lessonIndex) ? 'active' : '';
        const dotClass   = done ? 'done' : '';

        if (isUnlocked) {
            return `
                <a class="lesson-link ${active}" onclick="navigateTo('course', {courseId: ${course.id}, lessonIndex: ${idx}})">
                    <span class="status-dot ${dotClass}"></span>
                    ${idx+1}. ${l.title}
                </a>
            `;
        } else {
            return `
                <a class="lesson-link lesson-locked" onclick="void(0)" style="opacity:0.45;pointer-events:none;cursor:default;">
                    <span class="lock-icon" style="font-size:0.8rem;margin-left:4px;">🔒</span>
                    <span style="color:var(--text-light);">${idx+1}. ${l.title}</span>
                </a>
            `;
        }
    }).join('');

    const unlockBadge = (!isFreeMode && unlockedCount < totalLessons)
        ? `<div style="margin:8px 0 12px;padding:7px 12px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.25);border-radius:10px;font-size:0.78rem;color:var(--gold);text-align:center;">
               🔓 ${unlockedCount} من ${totalLessons} درس مفتوح
           </div>`
        : '';

    const lesson = course.lessons[lessonIndex];
    const done   = isLessonDone(course.id, lessonIndex);
    const sectionsHtml = renderSections(lesson.sections);

    const prevDisabled = lessonIndex === 0;
    const nextLockedByPlan = !isFreeMode && (lessonIndex + 1 >= unlockedCount);
    const nextLockedByEnd  = lessonIndex === totalLessons - 1;
    const nextDisabled = nextLockedByEnd || nextLockedByPlan;
    const nextTitle = nextLockedByPlan && !nextLockedByEnd ? 'title="هذا الدرس لم يُفتح بعد 🔒"' : '';

    return `
        <div class="course-detail-layout">
            <aside class="sidebar">
                <h4>📖 دروس ${course.title}</h4>
                ${unlockBadge}
                ${sidebarLinks}
            </aside>
            <main class="main-content">
                <div class="course-header">
                    <button class="btn-back" onclick="navigateTo('home')">
                        <i class="fas fa-arrow-right"></i> العودة
                    </button>
                    <span class="course-title">${course.title}</span>
                    <span class="course-stats"><i class="fas fa-book"></i> ${totalLessons} درس · ${progress}% مكتمل</span>
                    <span style="font-size:0.78rem;color:var(--text-light);width:100%;text-align:center;padding-top:4px;">تأليف: محمد أبو عبد الرحمن — عفا الله عنه</span>
                </div>

                <div class="lesson-card">
                    <div class="lesson-header" onclick="toggleLesson(this)">
                        <h3>${lessonIndex+1}. ${lesson.title}</h3>
                        <div class="lesson-meta">
                            <span class="status-dot ${done ? 'done' : ''}"></span>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                    <div class="lesson-body active">
                        <div class="lesson-content">${sectionsHtml}</div>
                        <div class="lesson-actions">
                            <button class="btn-complete ${done ? 'done' : ''}" onclick="completeLesson(event, ${course.id}, ${lessonIndex}, '${course.title}', '${lesson.title}')">
                                ${done ? '<i class="fas fa-check-circle"></i> تم الإتمام' : '<i class="fas fa-check"></i> أتممت هذا الدرس'}
                            </button>
                            <a class="btn-youtube" href="https://youtube.com/@abukora?si=Nu3-ZETtW-QPsLW6" target="_blank">
                                <i class="fab fa-youtube"></i> شاهد الدرس على اليوتيوب
                            </a>
                            <a class="btn-book" href="https://www.google.com/?hl=ar" target="_blank">
                                <i class="fas fa-book"></i> رابط الكتاب
                            </a>
                        </div>
                        <div class="lesson-navigation">
                            <button onclick="navigateTo('course', {courseId: ${course.id}, lessonIndex: ${lessonIndex-1}})" ${prevDisabled ? 'disabled' : ''}>
                                <i class="fas fa-arrow-right"></i> السابق
                            </button>
                            <span>${lessonIndex+1} / ${isFreeMode ? totalLessons : unlockedCount}${!isFreeMode && unlockedCount < totalLessons ? ' 🔓' : ''}</span>
                            <button onclick="navigateTo('course', {courseId: ${course.id}, lessonIndex: ${lessonIndex+1}})" ${nextDisabled ? 'disabled' : ''} ${nextTitle} style="${nextLockedByPlan && !nextLockedByEnd ? 'opacity:0.4;' : ''}">
                                التالي <i class="fas fa-arrow-left"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
}

// ================================================================
// 5. دوال عرض الأقسام
// ================================================================
function renderSections(sections) {
    if (!sections || sections.length === 0) {
        return '<p>لا يوجد محتوى لهذا الدرس.</p>';
    }
    return sections.map(sec => {
        const iconMap = {
            'paragraph': 'fa-paragraph',
            'quote': 'fa-quote-right',
            'explanation': 'fa-lightbulb',
            'application': 'fa-check-circle',
            'benefit': 'fa-gem'
        };
        const labelMap = {
            'paragraph': '📌 الفقرة الأساسية',
            'quote': '📖 الدليل',
            'explanation': '💡 الشرح',
            'application': '✅ النموذج التطبيقي',
            'benefit': '🎯 الفائدة'
        };
        const icon  = iconMap[sec.type]  || 'fa-paragraph';
        const label = labelMap[sec.type] || 'محتوى';
        let extra = '';
        if (sec.type === 'quote' && sec.source) {
            extra = `<span class="source">— ${sec.source}</span>`;
        }
        let contentHtml = sec.content;
        if (!contentHtml.includes('<ul') && !contentHtml.includes('<ol')) {
            contentHtml = `<p>${contentHtml}</p>`;
        }
        return `
            <div class="section-block ${sec.type}">
                <div class="section-label">
                    <i class="fas ${icon}"></i> ${label}
                </div>
                ${contentHtml}
                ${extra}
            </div>
        `;
    }).join('');
}

// ================================================================
// 6. دوال مساعدة للتقدم
// ================================================================
function getProgressKey(courseId, lessonIndex) {
    return `hosoonaliman_progress_${courseId}_${lessonIndex}`;
}
function isLessonDone(courseId, lessonIndex) {
    return localStorage.getItem(getProgressKey(courseId, lessonIndex)) === 'true';
}
function getCourseProgress(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return 0;
    let done = 0;
    course.lessons.forEach((_, idx) => { if (isLessonDone(courseId, idx)) done++; });
    return Math.round((done / course.lessons.length) * 100);
}
function updateProgressIndicators() {}

// ================================================================
// 7. أحداث الدروس
// ================================================================
function toggleLesson(header) {
    const body = header.nextElementSibling;
    body.classList.toggle('active');
    const icon = header.querySelector('.lesson-meta i');
    if (body.classList.contains('active')) {
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
    } else {
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}

function completeLesson(event, courseId, lessonIndex, courseTitle, lessonTitle) {
    event.stopPropagation();
    if (isLessonDone(courseId, lessonIndex)) {
        showCheerMessage("🎯", "الدرس مكتمل بالفعل!", "أنت ممتاز! واصل التقدم.");
        return;
    }
    const currentStudyDay = getCurrentStudyDayForUnlocking();
    const unlockedCount   = getUnlockedLessonCount(courseId, currentStudyDay);
    const mode = localStorage.getItem(LS_MODE);
    if (mode === 'course' && lessonIndex >= unlockedCount) {
        showCheerMessage("🔒", "هذا الدرس مغلق!", "انتظر حتى يُفتح هذا الدرس في جدولك الأسبوعي.");
        return;
    }
    localStorage.setItem(getProgressKey(courseId, lessonIndex), 'true');
    navigateTo('course', { courseId, lessonIndex });
    const msgs = [
        "أحسنت يا بطل! 🌟", "ممتاز! استمر! 💪",
        "رائع! أنت تتقدم بثبات 🚀", "ما شاء الله عليك! 👏",
        "أنت بطل حصون الإيمان! 🏆"
    ];
    showCheerMessage("🌟🌟🌟🌟🌟", msgs[Math.floor(Math.random() * msgs.length)], "لقد أتممت الدرس بنجاح، واصل رحلتك الإيمانية!");
}

function showCheerMessage(stars, title, desc) {
    document.querySelector('#cheerModal .stars').textContent = stars;
    document.getElementById('cheerMessage').textContent = title;
    document.querySelector('#cheerModal p').textContent = desc;
    document.getElementById('cheerModal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('cheerModal').style.display = 'none';
}
document.getElementById('cheerModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ================================================================
// 8. ربط الأحداث
// ================================================================
function attachCourseEvents(courseId) {}

// ================================================================
// 9. الهامبرغر
// ================================================================
document.getElementById('hamburger').addEventListener('click', function() {
    document.getElementById('navLinks').classList.toggle('active');
});

// ================================================================
// 10. التحميل الأولي
// ================================================================
window.onload = function() {
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
    }, 1300);

    navigateTo('home');
    updateModeBadge();

    setTimeout(() => {
        if (!localStorage.getItem(LS_SETUP_DONE)) {
            showWelcomeModal();
        } else {
            if (isTodayFriday() && localStorage.getItem(LS_MODE) === 'course') {
                const fridayShown = localStorage.getItem('hosoon_friday_' + toLocalDateStr(new Date()));
                if (!fridayShown) {
                    localStorage.setItem('hosoon_friday_' + toLocalDateStr(new Date()), '1');
                    setTimeout(showFridayModal, 1600);
                }
            }
        }
    }, 1500);
};

// ================================================================
// 11. Service Worker
// ================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker مسجّل:', reg.scope))
            .catch(err => console.warn('[PWA] فشل:', err));
    });
}

// ================================================================
// 12. تثبيت التطبيق (PWA)
// ================================================================
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');
const btnInstall = document.getElementById('btnInstall');
const btnDismiss = document.getElementById('btnDismiss');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
        if (!localStorage.getItem('pwa_dismissed')) installBanner.classList.add('show');
    }, 3000);
});
btnInstall && btnInstall.addEventListener('click', async () => {
    installBanner.classList.remove('show');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
    }
});
btnDismiss && btnDismiss.addEventListener('click', () => {
    installBanner.classList.remove('show');
    localStorage.setItem('pwa_dismissed', '1');
});

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (isIOS && !isInStandaloneMode && !localStorage.getItem('ios_hint_shown')) {
    setTimeout(() => {
        const iosHint = document.createElement('div');
        iosHint.style.cssText = `
            position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
            background:#1B3A4B;color:white;padding:14px 20px;border-radius:16px;
            box-shadow:0 8px 30px rgba(0,0,0,0.4);z-index:9999;
            text-align:center;max-width:300px;width:calc(100% - 40px);
            border:1px solid rgba(212,175,55,0.4);font-family:'Cairo',sans-serif;
        `;
        iosHint.innerHTML = `
            <div style="font-size:1.5rem;margin-bottom:8px">📲</div>
            <strong style="color:#D4AF37;display:block;margin-bottom:4px">ثبّت التطبيق على iPhone</strong>
            <span style="font-size:0.85rem;color:rgba(255,255,255,0.8)">
                اضغط على <strong>مشاركة</strong> ⬆️ ثم <strong>"إضافة إلى الشاشة الرئيسية"</strong>
            </span>
            <button onclick="this.parentElement.remove();localStorage.setItem('ios_hint_shown','1')"
                style="margin-top:10px;background:#D4AF37;color:#000;border:none;padding:7px 20px;border-radius:20px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;">
                فهمت ✓
            </button>
        `;
        document.body.appendChild(iosHint);
        localStorage.setItem('ios_hint_shown', '1');
    }, 3000);
}

// ================================================================
// 13. شريط التقدم العلوي
// ================================================================
const topBar = document.getElementById('topProgressBar');
function showTopProgress() {
    if (!topBar) return;
    topBar.style.width = '0%';
    topBar.style.display = 'block';
    let w = 0;
    const iv = setInterval(() => {
        w += Math.random() * 15;
        if (w > 85) { clearInterval(iv); w = 85; }
        topBar.style.width = w + '%';
    }, 80);
    setTimeout(() => {
        clearInterval(iv);
        topBar.style.width = '100%';
        setTimeout(() => { topBar.style.width = '0%'; }, 300);
    }, 600);
}
document.addEventListener('click', (e) => {
    const target = e.target.closest('[onclick]');
    if (target && target.getAttribute('onclick') && target.getAttribute('onclick').includes('navigateTo')) {
        showTopProgress();
    }
});
