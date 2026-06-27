// ================================================================
// استيراد البيانات من المصدر الموحد
// ================================================================
import { rawCourses } from './data.js';

// ================================================================
// 1. البيانات – هيكلة متقدمة مع أقسام منظمة
// ================================================================

/**
 * دالة محسّنة لتحليل محتوى HTML واستخراج أقسام منظمة
 * تعالج وجود وسوم <strong> وتستخرج النصوص الصحيحة
 */
function parseSectionsFromContent(htmlText) {
    const sections = [];
    const div = document.createElement('div');
    div.innerHTML = htmlText;

    // الحصول على جميع الفقرات
    const paragraphs = div.querySelectorAll('p');
    
    const typeMap = {
        'الفقرة الأساسية': 'paragraph',
        'الفقرة': 'paragraph',
        'الدليل': 'quote',
        'الشرح': 'explanation',
        'النموذج التطبيقي': 'application',
        'النموذج': 'application',
        'الفائدة': 'benefit'
    };

    paragraphs.forEach(p => {
        // الحصول على النص الكامل للفقرة بدون وسوم
        const fullText = p.textContent.trim();
        if (!fullText) return;

        // أولاً: محاولة استخراج النوع من خلال عنصر strong إن وجد
        const strongEl = p.querySelector('strong');
        let matchedType = null;
        let contentText = fullText;
        
        if (strongEl) {
            const strongText = strongEl.textContent.trim();
            // إزالة النقطتين إذا وجدت في النهاية
            const cleanStrong = strongText.replace(/:$/, '').trim();
            
            for (const [key, type] of Object.entries(typeMap)) {
                if (cleanStrong === key) {
                    matchedType = type;
                    // إزالة النص القوي والنقطتين اللاحقتين من النص الكامل
                    const regex = new RegExp(strongText + '\s*:?\s*');
                    contentText = fullText.replace(regex, '').trim();
                    break;
                }
            }
        }
        
        // إذا لم نجد تطابقاً مع strong، نحاول مع النص الكامل مباشرة
        if (!matchedType) {
            for (const [key, type] of Object.entries(typeMap)) {
                if (fullText.startsWith(key + ':')) {
                    matchedType = type;
                    contentText = fullText.substring(key.length + 1).trim();
                    break;
                }
            }
        }

        const section = { type: matchedType || 'paragraph', content: contentText || fullText };

        // التعامل مع المصدر للاقتباسات
        if (section.type === 'quote') {
            const sourceMatch = section.content.match(/\(([^)]+)\)/);
            if (sourceMatch) {
                section.source = sourceMatch[1];
                section.content = section.content.replace(/\([^)]+\)/, '').trim();
            }
        }

        sections.push(section);
    });

    // إذا لم نتمكن من تحليل أي أقسام، نعيد فقرة واحدة
    if (sections.length === 0 && div.textContent.trim()) {
        sections.push({ type: 'paragraph', content: div.textContent.trim() });
    }

    return sections;
}

// البيانات الخام — مستوردة من data.js

// معالجة كل درس: تحويل content إلى مصفوفة sections
const courses = rawCourses.map(course => {
    const newLessons = course.lessons.map(lesson => {
        const sections = parseSectionsFromContent(lesson.content);
        return {
            title: lesson.title,
            sections: sections,
            _raw: lesson.content
        };
    });
    return {
        ...course,
        lessons: newLessons
    };
});

// ================================================================
// 2. إدارة الحالة
// ================================================================
let currentSection = 'home';
let currentCourseId = null;
let currentLessonIndex = 0;
const appContainer = document.getElementById('appContainer');

// ================================================================
// A. نظام الإعداد والترحيب — Setup & Welcome System
// ================================================================

// مفاتيح localStorage
const LS_MODE       = 'hosoon_mode';        // 'course' | 'free'
const LS_START_DATE = 'hosoon_start_date';  // 'YYYY-MM-DD'
const LS_SETUP_DONE = 'hosoon_setup_done';  // '1'

// خطة التدريس: 30 يوم دراسي (كل يوم 3 كراسات كما في renderPlan)
// نفس المنطق الموجود في renderPlan
function getPlanForDay(dayIndex) {
    // dayIndex من 0 إلى 29 (اليوم الدراسي لا التقويمي)
    // خطة صريحة تضمن فتح جميع الكراسات الـ 11 بالتسلسل
    const n = courses.length; // 11
    const i = dayIndex;
    const a = i % n;
    const b = (i + Math.ceil(n / 3)) % n;
    const c = (i + Math.ceil((2 * n) / 3)) % n;
    return [courses[a], courses[b], courses[c]];
}

// تحويل تاريخ إلى string YYYY-MM-DD بالتوقيت المحلي
function toLocalDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// احسب اليوم الدراسي الحالي (0-based, مع تجاهل الجمعات)
function calcStudyDay(startDateStr) {
    const start = new Date(startDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    if (today < start) return -1; // لم تبدأ بعد

    let studyDays = 0;
    const cur = new Date(start);
    while (cur <= today) {
        const dow = cur.getDay(); // 0=Sun,5=Fri,6=Sat
        if (dow !== 5) studyDays++; // الجمعة = 5
        if (toLocalDateStr(cur) === toLocalDateStr(today)) break;
        cur.setDate(cur.getDate() + 1);
    }
    return studyDays - 1; // 0-based
}

// هل يوم الجمعة؟
function isTodayFriday() {
    return new Date().getDay() === 5;
}

// احسب أيام الدراسة المكتملة حتى الآن
function completedStudyDays(startDateStr) {
    return Math.max(0, calcStudyDay(startDateStr));
}

// ما هي الكراسات المتاحة اليوم في وضع الدورة؟
function getUnlockedCourseIds() {
    const mode = localStorage.getItem(LS_MODE);
    if (mode !== 'course') return courses.map(c => c.id); // كل شيء مفتوح

    const startDate = localStorage.getItem(LS_START_DATE);
    if (!startDate) return [];

    if (isTodayFriday()) {
        // الجمعة: تُفتح كل الدروس السابقة للمراجعة
        const todayStudyDay = completedStudyDays(startDate);
        const unlocked = new Set();
        for (let d = 0; d <= todayStudyDay; d++) {
            getPlanForDay(d).forEach(c => unlocked.add(c.id));
        }
        return [...unlocked];
    }

    const todayStudyDay = calcStudyDay(startDate);
    if (todayStudyDay < 0) return []; // لم تبدأ
    const unlocked = new Set();
    for (let d = 0; d <= Math.min(todayStudyDay, 29); d++) {
        getPlanForDay(d).forEach(c => unlocked.add(c.id));
    }
    return [...unlocked];
}

function isCourseUnlocked(courseId) {
    return getUnlockedCourseIds().includes(courseId);
}

// ----------------------------------------------------------------
// منطق نافذة الترحيب
// ----------------------------------------------------------------
let selectedMode = null;

function showWelcomeModal() {
    const ov = document.getElementById('welcomeOverlay');
    if (ov) ov.style.display = 'flex';
    // ضبط تاريخ اليوم كقيمة افتراضية
    const picker = document.getElementById('startDatePicker');
    if (picker) picker.value = toLocalDateStr(new Date());
}

function hideWelcomeModal() {
    const ov = document.getElementById('welcomeOverlay');
    if (ov) {
        ov.style.opacity = '0';
        ov.style.transition = 'opacity 0.4s';
        setTimeout(() => { ov.style.display = 'none'; ov.style.opacity = ''; ov.style.transition = ''; }, 400);
    }
}

function selectMode(mode) {
    selectedMode = mode;
    // إزالة selected من كل الخيارات
    document.querySelectorAll('.wc-option').forEach(o => o.classList.remove('selected'));
    document.querySelectorAll('.opt-check').forEach(c => { c.innerHTML = ''; });

    const optEl = document.getElementById('opt-' + mode);
    const checkEl = document.getElementById('check-' + mode);
    if (optEl) optEl.classList.add('selected');
    if (checkEl) checkEl.innerHTML = '<i class="fas fa-check" style="font-size:0.7rem;color:#000;"></i>';

    // إظهار الأزرار المناسبة
    const btnNext = document.getElementById('btn-step1-next');
    const btnFree = document.getElementById('btn-step1-free');
    if (mode === 'course') {
        if (btnNext) btnNext.style.display = 'block';
        if (btnFree) btnFree.style.display = 'none';
    } else {
        if (btnNext) btnNext.style.display = 'none';
        if (btnFree) btnFree.style.display = 'block';
    }
}

function goToStep(step) {
    // تحديث المحتوى
    [1, 2, 3].forEach(s => {
        const el = document.getElementById('wc-step-' + s);
        if (el) el.classList.toggle('visible', s === step);
    });

    // تحديث Stepper
    [1, 2, 3].forEach(s => {
        const item   = document.getElementById('step-item-' + s);
        const circle = document.getElementById('step-circle-' + s);
        const line   = document.getElementById('step-line-' + s);
        if (!item || !circle) return;

        item.classList.remove('active', 'done');
        circle.classList.remove('active', 'done');

        if (s < step) {
            item.classList.add('done');
            circle.classList.add('done');
            circle.innerHTML = '<i class="fas fa-check" style="font-size:0.7rem;"></i>';
            if (line) { line.classList.remove('active'); line.classList.add('done'); }
        } else if (s === step) {
            item.classList.add('active');
            circle.classList.add('active');
            circle.textContent = s;
            if (line) { line.classList.remove('done'); line.classList.add('active'); }
        } else {
            circle.textContent = s;
            if (line) { line.classList.remove('active', 'done'); }
        }
    });

    // إذا كانت الخطوة 3، نملأ التأكيد
    if (step === 3) buildConfirmStep();
}

function onDateChange() {
    const picker = document.getElementById('startDatePicker');
    const btn = document.getElementById('btn-step2-next');
    if (picker && picker.value && btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function buildConfirmStep() {
    const startDate = document.getElementById('startDatePicker').value;
    if (!startDate) return;

    const start = new Date(startDate + 'T00:00:00');
    // احسب تاريخ الانتهاء (45 يوماً دراسياً مع تجاهل الجمعات = ~53 يوماً تقويمياً)
    let studyCount = 0;
    const endDate = new Date(start);
    while (studyCount < 45) {
        if (endDate.getDay() !== 5) studyCount++;
        if (studyCount < 45) endDate.setDate(endDate.getDate() + 1);
    }

    const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const fmt = d => `${dayNames[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

    // ما هي دروس اليوم؟ (لو البداية اليوم = اليوم الدراسي 0)
    const todayStudyDay = calcStudyDay(startDate);
    let todayCoursesHtml = '';
    if (todayStudyDay >= 0 && todayStudyDay <= 29) {
        const todayCourses = getPlanForDay(todayStudyDay);
        todayCoursesHtml = todayCourses.map(c =>
            `<span class="wc-lesson-chip"><i class="fas fa-book-open"></i> ${c.title}</span>`
        ).join('');
    } else if (todayStudyDay < 0) {
        todayCoursesHtml = `<span style="color:rgba(255,255,255,0.5);font-size:0.85rem;">ستبدأ دروسك يوم ${fmt(start)}</span>`;
    }

    document.getElementById('confirmSummary').innerHTML = `
        <div class="wc-confirm-row">
            <span class="cr-label"><i class="fas fa-play-circle" style="color:#2E8B57;margin-left:6px;"></i> تاريخ البداية</span>
            <span class="cr-val">${fmt(start)}</span>
        </div>
        <div class="wc-confirm-row">
            <span class="cr-label"><i class="fas fa-flag-checkered" style="color:#D4AF37;margin-left:6px;"></i> تاريخ الانتهاء</span>
            <span class="cr-val">${fmt(endDate)}</span>
        </div>
        <div class="wc-confirm-row">
            <span class="cr-label"><i class="fas fa-calendar-week" style="color:#9932CC;margin-left:6px;"></i> أيام الدراسة</span>
            <span class="cr-val">6 أيام / أسبوع</span>
        </div>
        <div class="wc-confirm-row">
            <span class="cr-label"><i class="fas fa-book" style="color:#1a73e8;margin-left:6px;"></i> عدد الكراسات</span>
            <span class="cr-val">10 كراسات · 130 درساً</span>
        </div>
    `;

    document.getElementById('todayLessonsPreview').innerHTML = `
        <h4><i class="fas fa-sun"></i> ${todayStudyDay >= 0 ? 'دروسك اليوم:' : 'دروسك في اليوم الأول:'}</h4>
        ${todayCoursesHtml || '<span style="color:rgba(255,255,255,0.5);font-size:0.85rem;">لا توجد دروس مجدولة اليوم</span>'}
    `;
}

function launchFreeMode() {
    localStorage.setItem(LS_MODE, 'free');
    localStorage.setItem(LS_SETUP_DONE, '1');
    hideWelcomeModal();
    updateModeBadge();
    navigateTo('home');
}

function launchCourseMode() {
    const startDate = document.getElementById('startDatePicker').value;
    if (!startDate) return;
    localStorage.setItem(LS_MODE, 'course');
    localStorage.setItem(LS_START_DATE, startDate);
    localStorage.setItem(LS_SETUP_DONE, '1');
    hideWelcomeModal();
    updateModeBadge();
    // عرض رسالة الجمعة إن كان اليوم جمعة
    if (isTodayFriday()) showFridayModal();
    navigateTo('home');
}

function resetSetup() {
    if (!confirm('هل تريد إعادة ضبط الإعدادات؟ سيتم الاحتفاظ بتقدمك في الدروس.')) return;
    localStorage.removeItem(LS_MODE);
    localStorage.removeItem(LS_START_DATE);
    localStorage.removeItem(LS_SETUP_DONE);
    selectedMode = null;
    // إعادة ضبط الـ UI
    document.querySelectorAll('.wc-option').forEach(o => o.classList.remove('selected'));
    document.querySelectorAll('.opt-check').forEach(c => { c.innerHTML = ''; });
    ['btn-step1-next','btn-step1-free'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    goToStep(1);
    showWelcomeModal();
    updateModeBadge();
}

function updateModeBadge() {
    const badge = document.getElementById('modeBadge');
    if (!badge) return;
    const mode = localStorage.getItem(LS_MODE);
    if (mode === 'course') {
        const startDate = localStorage.getItem(LS_START_DATE);
        const day = startDate ? Math.min(calcStudyDay(startDate) + 1, 45) : 1;
        badge.innerHTML = `<span class="mode-badge"><i class="fas fa-graduation-cap"></i> يوم ${Math.max(1,day)} من 45</span>`;
    } else if (mode === 'free') {
        badge.innerHTML = `<span class="mode-badge free-mode"><i class="fas fa-search"></i> تصفح حر</span>`;
    } else {
        badge.innerHTML = '';
    }
}

// ----------------------------------------------------------------
// نافذة الجمعة
// ----------------------------------------------------------------
function showFridayModal() {
    const mode = localStorage.getItem(LS_MODE);
    if (mode !== 'course') return;

    const startDate = localStorage.getItem(LS_START_DATE);
    const studyDay = startDate ? completedStudyDays(startDate) : 0;

    // إحصائيات للعرض
    let totalLessons = 0;
    let completedLessons = 0;
    courses.forEach(course => {
        course.lessons.forEach((_, idx) => {
            totalLessons++;
            if (isLessonDone(course.id, idx)) completedLessons++;
        });
    });

    document.getElementById('fridayStats').innerHTML = `
        <div class="friday-stat">
            <span class="fs-num">${studyDay}</span>
            <span class="fs-lbl">يوم دراسي مضى</span>
        </div>
        <div class="friday-stat">
            <span class="fs-num">${completedLessons}</span>
            <span class="fs-lbl">درس أتممته</span>
        </div>
        <div class="friday-stat">
            <span class="fs-num">${Math.max(0, 45 - studyDay)}</span>
            <span class="fs-lbl">يوم متبقي</span>
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
        if (isTodayFriday()) {
            todayBanner = `
                <div style="background:linear-gradient(135deg,rgba(46,139,87,0.15),rgba(46,139,87,0.05));border:1px solid rgba(46,139,87,0.3);border-radius:16px;padding:18px 22px;margin-bottom:24px;display:flex;align-items:center;gap:14px;">
                    <span style="font-size:2rem;">🌙</span>
                    <div>
                        <strong style="color:#2E8B57;display:block;font-size:1rem;">يوم الجمعة — يوم المراجعة</strong>
                        <span style="color:rgba(255,255,255,0.6);font-size:0.85rem;">راجع دروس الأسبوع واستعد لأسبوع جديد من الإنجاز</span>
                    </div>
                    <button onclick="showFridayModal()" style="margin-right:auto;background:rgba(46,139,87,0.2);border:1px solid rgba(46,139,87,0.4);color:#2E8B57;padding:8px 16px;border-radius:20px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:700;font-size:0.85rem;white-space:nowrap;">
                        إحصائياتي
                    </button>
                </div>
            `;
        } else if (studyDay >= 0 && studyDay <= 29) {
            const todayCourses = getPlanForDay(studyDay);
            const dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
            todayBanner = `
                <div style="background:linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.04));border:1px solid rgba(212,175,55,0.25);border-radius:16px;padding:18px 22px;margin-bottom:24px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                        <span style="font-size:1.5rem;">📅</span>
                        <strong style="color:#D4AF37;font-size:1rem;">دروسك اليوم — ${dayNames[new Date().getDay()]} (اليوم ${studyDay+1})</strong>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        ${todayCourses.map(c => `
                            <button onclick="navigateTo('course',{courseId:${c.id},lessonIndex:0})"
                                style="background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);color:rgba(255,255,255,0.85);padding:8px 16px;border-radius:20px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:0.85rem;display:flex;align-items:center;gap:6px;">
                                <i class="fas fa-book-open" style="color:#D4AF37;font-size:0.75rem;"></i>${c.title}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    return `
        ${todayBanner}
        <div class="hero">
            <h1>حصون الإيمان</h1>
            <p>المنهج الصيفي المتكامل لبناء شخصية ابنك المسلمة</p>
            <p class="sub-meta">📚 10 كراسات &nbsp;|&nbsp; 130 درساً &nbsp;|&nbsp; 45 يوماً &nbsp;|&nbsp; للفئة 9-15 سنة</p>
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
                الإصدار الأول — 2026م
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
    return `
        <h2 class="section-title">الكراسات العشر</h2>
        <div class="courses-grid">
            ${courses.map(c => {
                const progress = getCourseProgress(c.id);
                const unlocked = isCourseUnlocked(c.id);
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

// ---------- خطة التدريس ----------
function renderPlan() {
    const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    const startDate = localStorage.getItem(LS_START_DATE);
    let rows = '';
    for (let i = 0; i < 30; i++) {
        const week = Math.floor(i / 6) + 1;
        const dayName = days[i % 6];
        const [_r1, _r2, _r3] = getPlanForDay(i);
        const c1 = _r1.title;
        const c2 = _r2.title;
        const c3 = _r3.title;

        // تمييز اليوم الحالي
        const mode = localStorage.getItem(LS_MODE);
        const todayStudy = startDate ? calcStudyDay(startDate) : -1;
        const isToday = (mode === 'course' && i === todayStudy && !isTodayFriday());
        rows += `
            <tr style="${isToday ? 'background:rgba(212,175,55,0.12);font-weight:700;' : ''}">
                <td>${isToday ? '📍 ' : ''}${dayName} (أسبوع ${week})</td>
                <td>${c1}</td>
                <td>${c2}</td>
                <td>${c3}</td>
            </tr>
        `;
    }
    return `
        <h2 class="section-title">📅 خطة التدريس اليومية</h2>
        <div class="plan-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الحصة الأولى</th>
                        <th>الحصة الثانية</th>
                        <th>الحصة الثالثة</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <p style="text-align:center;margin-top:16px;color:var(--text-light);">
            <i class="fas fa-info-circle"></i> خطة مرنة – يمكن تعديلها حسب رغبة المعلم
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
                حصون الإيمان — الإصدار الأول 2026م
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

    let sidebarLinks = course.lessons.map((l, idx) => {
        const done = isLessonDone(course.id, idx);
        const active = (idx === lessonIndex) ? 'active' : '';
        const dotClass = done ? 'done' : '';
        return `
            <a class="lesson-link ${active}" onclick="navigateTo('course', {courseId: ${course.id}, lessonIndex: ${idx}})">
                <span class="status-dot ${dotClass}"></span>
                ${idx+1}. ${l.title}
            </a>
        `;
    }).join('');

    const lesson = course.lessons[lessonIndex];
    const done = isLessonDone(course.id, lessonIndex);
    const sectionsHtml = renderSections(lesson.sections);

    const prevDisabled = lessonIndex === 0;
    const nextDisabled = lessonIndex === totalLessons - 1;

    return `
        <div class="course-detail-layout">
            <aside class="sidebar">
                <h4>📖 دروس ${course.title}</h4>
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
                            <span>${lessonIndex+1} / ${totalLessons}</span>
                            <button onclick="navigateTo('course', {courseId: ${course.id}, lessonIndex: ${lessonIndex+1}})" ${nextDisabled ? 'disabled' : ''}>
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

    // هل يحتاج الإعداد؟
    setTimeout(() => {
        if (!localStorage.getItem(LS_SETUP_DONE)) {
            showWelcomeModal();
        } else {
            // سبق الإعداد — هل اليوم جمعة؟
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
