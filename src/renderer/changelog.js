// Update history: every version of Inkwell and what it brought, in the app's language.
// Release notes on GitHub are English and written for developers; these are the same
// changes told for readers, in Uzbek, English and Russian. A new release adds its entry on top.
// Opened from the ⋯ menu's Updates row and from the bottom of "What's new"; the list shows
// each update in short, and a click opens it in full with the versions on either side.
const Changelog = (() => {
  // [version, date, { uz: [title, [points]], en: [...], ru: [...] }]
  const LOG = [
    ['1.1.61', '2026-10-30', {
      uz: ['Notch’ga ulanish va Inky', [
        'Sozlamalar → Dynamic Notch → «Ulash»: to‘rt qadam birma-bir tekshiriladi — notch ishga tushdimi, Inkwell bilan bog‘landimi, salomlashdimi, boshqa ilovalar xabarlari',
        'Har bir qadam o‘tganda belgi chiziladi; nimadir bo‘lmasa — «Qayta urinish»',
        'Inky endi notch’da ham: fokus paytida kitob o‘qiydi, Inkwell bo‘limida seriya yonida turadi, salomlashganda qo‘l silkitadi, maqsad bajarilganda ko‘zlari yulduz bo‘ladi',
        '«Qayta tekshirish» — ulanishni istalgan payt yana tekshirish',
      ]],
      en: ['Connecting to the notch, and Inky', [
        'Settings → Dynamic Notch → “Connect”: four steps, each really checked — the notch starts, it links with Inkwell, it says hello, other apps’ notifications',
        'A tick is drawn as each step passes; if something fails — “Try again”',
        'Inky lives in the notch too: it reads during focus, stands by your streak in the Inkwell section, waves hello and gets starry eyes when the goal is done',
        '“Check again” runs the checks whenever you like',
      ]],
      ru: ['Подключение к вырезу и Inky', [
        'Настройки → Dynamic Notch → «Подключить»: четыре шага, каждый проверяется по-настоящему — вырез запустился, связался с Inkwell, поздоровался, уведомления других приложений',
        'Когда шаг пройден, рисуется галочка; если что-то не так — «Повторить»',
        'Inky теперь и в вырезе: читает во время фокуса, стоит рядом с серией в разделе Inkwell, машет при встрече и смотрит звёздами, когда цель выполнена',
        '«Проверить снова» — проверка связи в любой момент',
      ]],
    }],
    ['1.1.60', '2026-10-30', {
      uz: ['Notch tuzatishlari', [
        'Sozlamalardagi «Sinab ko‘rish» endi notch’da xabar chiqaradi',
        'Mac’da alohida Islet ham o‘rnatilgan bo‘lsa, holat to‘g‘ri ko‘rinadi — avval «Ishga tushmoqda…»da qotib qolardi',
        '«Notch sozlamalari» va boshqa tugmalar aynan ishlab turgan notch’ga boradi',
      ]],
      en: ['Notch fixes', [
        '“Try it” in Settings now shows a message in the notch',
        'With a standalone Islet on the Mac as well, the status is right — it used to stay on “Starting…”',
        '“Notch settings” and the other buttons reach the notch that is actually running',
      ]],
      ru: ['Исправления выреза', [
        '«Проверить» в настройках теперь показывает сообщение в вырезе',
        'Если на Mac есть и отдельный Islet, состояние показывается верно — раньше висело «Запускается…»',
        '«Настройки выреза» и другие кнопки попадают в тот вырез, что запущен',
      ]],
    }],
    ['1.1.59', '2026-10-30', {
      uz: ['Dynamic Notch', [
        'Mac’da ekran tepasida, kamera atrofida jonli «notch»: Sozlamalar → Dynamic Notch',
        'Yoqqaningizda Inkwell notch’ga uchib kirib ulanadi, ekrandagi notch esa salomlashadi',
        'Yopiq turganda — fokus taymeri yoki qo‘shiq; bossangiz ochiladi va bo‘limlarga ajraladi: Musiqa, Inkwell, Asosiy',
        'Inkwell bo‘limida seriya, bugungi maqsad, takrorlanadigan so‘zlar va o‘qilayotgan maqola; har biri Inkwell’ni o‘sha joyda ochadi',
        'Fokus boshlanganda, tugaganda, maqsad bajarilganda va seriya saqlanganda notch xabar beradi',
        'Ruxsat bersangiz, Telegram, qo‘ng‘iroqlar va boshqa ilovalar xabarlari ham notch’da; faylni notch’ga tashlasangiz — AirDrop',
      ]],
      en: ['Dynamic Notch', [
        'A live notch around the camera at the top of the Mac’s screen: Settings → Dynamic Notch',
        'Switch it on and Inkwell flies into the notch to connect, and the notch on your screen says hello',
        'Closed, it shows the focus timer or the song playing; a click opens it in sections: Music, Inkwell, Home',
        'The Inkwell section has your streak, today’s goal, words to review and the article in progress; each opens Inkwell right there',
        'The notch tells you when a focus session starts and ends, when the goal is reached and when the streak is safe',
        'With your permission, Telegram, calls and other apps’ notifications show there too; drop a file on the notch to AirDrop it',
      ]],
      ru: ['Dynamic Notch', [
        'Живой вырез вокруг камеры вверху экрана Mac: Настройки → Dynamic Notch',
        'При включении Inkwell влетает в вырез и подключается, а вырез на экране здоровается',
        'В закрытом виде — таймер фокуса или играющая песня; по клику открывается и делится на разделы: Музыка, Inkwell, Главное',
        'В разделе Inkwell — серия, цель на сегодня, слова на повторение и статья, которую читаешь; каждое открывает Inkwell прямо там',
        'Вырез сообщает о начале и конце фокуса, о выполненной цели и о спасённой серии',
        'С твоего разрешения там же появляются уведомления Telegram, звонки и другие приложения; брось файл на вырез — и AirDrop',
      ]],
    }],
    ['1.1.57', '2026-10-30', {
      uz: ['Ichki ishlar', ['Ilovaning o‘zida ko‘rinadigan o‘zgarish yo‘q: loyihaning sinov fayllari yangilandi']],
      en: ['Behind the scenes', ['Nothing changed in the app itself: the project’s test files were updated']],
      ru: ['Внутренние изменения', ['В самом приложении ничего не изменилось: обновились тестовые файлы проекта']],
    }],
    ['1.1.56', '2026-10-30', {
      uz: ['Ichki ishlar', ['Ilovaning o‘zida ko‘rinadigan o‘zgarish yo‘q: loyihaning sinov fayllari yangilandi']],
      en: ['Behind the scenes', ['Nothing changed in the app itself: the project’s test files were updated']],
      ru: ['Внутренние изменения', ['В самом приложении ничего не изменилось: обновились тестовые файлы проекта']],
    }],
    ['1.1.55', '2026-10-29', {
      uz: ['Ichki ishlar', ['Ilovaning o‘zida ko‘rinadigan o‘zgarish yo‘q: loyihaning sinov fayllari yangilandi']],
      en: ['Behind the scenes', ['Nothing changed in the app itself: the project’s test files were updated']],
      ru: ['Внутренние изменения', ['В самом приложении ничего не изменилось: обновились тестовые файлы проекта']],
    }],
    ['1.1.54', '2026-10-29', {
      uz: ['Ichki ishlar', ['Ilovaning o‘zida ko‘rinadigan o‘zgarish yo‘q: loyihaning sinov fayllari yangilandi']],
      en: ['Behind the scenes', ['Nothing changed in the app itself: the project’s test files were updated']],
      ru: ['Внутренние изменения', ['В самом приложении ничего не изменилось: обновились тестовые файлы проекта']],
    }],
    ['1.1.53', '2026-10-29', {
      uz: ['IELTS Reading', [
        'The Guardian javonida yangi «IELTS Reading» bo‘limi: IELTS matnlari olinadigan bo‘limlardan (fan, tabiat, ta’lim, jamiyat, texnologiya, Long Read) mos maqolalar o‘zi saralanadi',
        'Fikr maqolalari, taqrizlar, sport, siyosat yangiliklari va juda qisqa/uzun matnlar chiqmaydi',
        '«Bugungi to‘plam»: osondan qiyinga 3 ta matn (P1, P2, P3) — xuddi imtihondagidek; kun bo‘yi o‘zgarmaydi, nechtasi o‘qilgani ko‘rinadi',
        'Har bir matn ostida mavzu, so‘z soni va qiyinlik darajasi',
      ]],
      en: ['IELTS Reading', [
        'A new “IELTS Reading” section on The Guardian shelf: articles from the sections IELTS passages come from (science, nature, education, society, technology, the Long Read) are picked out on their own',
        'Opinion, reviews, sport, political news and texts far too short or long are left out',
        '“Today’s set”: 3 passages from easier to harder (P1, P2, P3), like the test; it stays the same all day and shows how many are read',
        'Each text shows its topic, word count and level',
      ]],
      ru: ['IELTS Reading', [
        'Новый раздел «IELTS Reading» на полке The Guardian: статьи из разделов, откуда берутся тексты IELTS (наука, природа, образование, общество, технологии, Long Read), отбираются сами',
        'Колонки мнений, рецензии, спорт, политические новости и слишком короткие или длинные тексты не попадают',
        '«Набор на сегодня»: 3 текста от простого к сложному (P1, P2, P3), как на экзамене; весь день не меняется и показывает, сколько прочитано',
        'У каждого текста — тема, число слов и уровень сложности',
      ]],
    }],
    ['1.1.52', '2026-10-28', {
      uz: ['Yangi sayt', [
        'Saytning bosh sahifasi endi Inkwell taqdimoti: Apple uslubida, uch tilda, haqiqiy ekranlar bilan; brauzerdagi o‘quvchi /read manzilida',
        'Telefonga o‘rnatilgan sayt to‘g‘ridan-to‘g‘ri o‘quvchini ochadi',
        'Birinchi ochilishda ilova sahifada tanlangan tilda boshlanadi',
      ]],
      en: ['A new website', [
        'The site’s front page is now Inkwell’s presentation: Apple-style, in three languages, with real screens; the reader in the browser lives at /read',
        'The site installed on a phone opens the reader directly',
        'On its first start the app opens in the language picked on the page',
      ]],
      ru: ['Новый сайт', [
        'Главная страница сайта теперь — презентация Inkwell: в стиле Apple, на трёх языках, с настоящими экранами; читалка в браузере — по адресу /read',
        'Сайт, установленный на телефон, сразу открывает читалку',
        'При первом запуске приложение открывается на языке, выбранном на странице',
      ]],
    }],
    ['1.1.51', '2026-10-28', {
      uz: ['Aqlli xotira', [
        'Inkwell endi xotirani o‘zi tartibda saqlaydi: ochilgandan bir daqiqa o‘tib va har 6 soatda',
        'PDF ning asl fayli joyida turgan va aynan o‘sha fayl bo‘lsa, kutubxonadagi takror nusxasi olib tashlanadi — «PDF ni ochish» aslini ochadi',
        'Sahifa keshi 150 MB dan oshmaydi, kod keshi 100 MB dan oshsa tozalanadi; eski yangilanish fayllari va 30 kun ishlatilmagan OCR fayllari ketadi',
        'Diskda 2 GB dan kam joy qolsa, butun kesh tozalanadi',
        'Sozlamalar → Xotira: «Aqlli xotira» yoqish/o‘chirish, «Hozir tozalash» va oxirgi marta qancha joy bo‘shagani',
        'Qaydlar, so‘zlar, statistika, maqola matnlari va zaxira nusxalarga hech qachon tegmaydi',
      ]],
      en: ['Smart storage', [
        'Inkwell now keeps its storage tidy on its own: a minute after it opens and every 6 hours',
        'A PDF’s copy in the library goes when the original is still where it was imported from and is the very same file — Open PDF opens the original',
        'The page cache stays under 150 MB, the code cache is cleared past 100 MB; old update files and OCR data unused for 30 days go',
        'With under 2 GB free on the disk, the whole cache is cleared',
        'Settings → Storage: Smart storage on/off, Tidy now, and what the last run freed',
        'Notes, words, statistics, article texts and backups are never touched',
      ]],
      ru: ['Умное хранилище', [
        'Inkwell теперь сам поддерживает порядок в хранилище: через минуту после запуска и каждые 6 часов',
        'Копия PDF в библиотеке убирается, если оригинал лежит там же, откуда его импортировали, и это тот же самый файл — «Открыть PDF» откроет оригинал',
        'Кэш страниц не больше 150 МБ, кэш кода очищается после 100 МБ; старые файлы обновлений и данные OCR, не нужные 30 дней, удаляются',
        'Если на диске меньше 2 ГБ, очищается весь кэш',
        'Настройки → Хранилище: «Умное хранилище» вкл/выкл, «Навести порядок» и сколько освободилось в последний раз',
        'Заметки, слова, статистика, тексты статей и резервные копии не трогаются никогда',
      ]],
    }],
    ['1.1.50', '2026-10-28', {
      uz: ['Har kuni qaraydigan statistika, qimirlamaydigan sarlavha', [
        'Statistika: tepada seriya, hafta va kunlik maqsad; ostida jami natijalar — umumiy vaqt, o‘qilgan so‘zlar, tugatilgan maqolalar, lug‘atdagi so‘zlar',
        'Yangi «Rekordlar»: eng ko‘p o‘qilgan kun, eng uzun seriya, eng zo‘r hafta',
        'Ortiqcha kataklar, faktlar, jadval va soat/hafta kuni grafiklari olib tashlandi — 30 kunlik grafik, yarim yillik xarita, tinglash va lug‘at qoldi',
        'Kutubxona aylantirilganda sarlavha endi kichraymaydi va siljimaydi — joyida turadi',
        'Ochilish oynasida faqat ilova nomi chiziladi; Inky u yopilgandan keyin burchakdan kirib keladi',
        '«Bugun / Bu hafta» kartochkalari bir daqiqadan kam vaqtga nisbatan foiz ko‘rsatmaydi (+20200% kabi)',
      ]],
      en: ['Statistics worth checking every day, a header that stays still', [
        'Statistics: the streak, the week and the daily goal on top; under them all-time totals — time, words read, articles finished, words saved',
        'New Records: the best day, the longest streak, the best week',
        'The extra tiles, facts, table and hour/weekday charts are gone — the 30-day chart, the half-year map, listening and vocabulary stay',
        'The library header no longer shrinks or slides while you scroll — it stays where it is',
        'The launch card draws the name alone; Inky walks in from the corner once it has gone',
        'The Today / This week cards no longer show a percentage against less than a minute (like +20200%)',
      ]],
      ru: ['Статистика, в которую хочется заглядывать, и неподвижная шапка', [
        'Статистика: наверху серия, неделя и дневная цель; под ними итоги за всё время — время, прочитанные слова, дочитанные статьи, слова в словаре',
        'Новые «Рекорды»: лучший день, самая длинная серия, лучшая неделя',
        'Лишние плитки, факты, таблица и графики по часам и дням недели убраны — остались график за 30 дней, карта за полгода, аудирование и словарь',
        'Шапка библиотеки больше не сжимается и не сдвигается при прокрутке — стоит на месте',
        'Заставка рисует только название; Инки входит из угла, когда она исчезла',
        'Карточки «Сегодня / Эта неделя» не показывают процент относительно меньше минуты (вроде +20200%)',
      ]],
    }],
    ['1.1.49', '2026-10-27', {
      uz: ['Sahifalar avvalgidek surilib kiradi', [
        'Sahifalarning surilish harakati 1.1.47 dan oldingi holatiga qaytarildi — yangi, bir tekis sekinlashadigan harakat yoqmadi',
        'Statistika, Sozlamalar va Yangilanishlar tarixini oldindan tayyorlash saqlanib qoldi',
      ]],
      en: ['Pages slide in as they used to', [
        'The page slide is back to how it was before 1.1.47 — the new, evenly slowing motion wasn’t liked',
        'Statistics, Settings and Update history are still prepared before they slide in',
      ]],
      ru: ['Страницы въезжают как раньше', [
        'Движение страниц вернулось к тому, что было до 1.1.47 — новое, равномерно замедляющееся, не понравилось',
        'Статистика, Настройки и История обновлений по-прежнему готовятся заранее, до въезда',
      ]],
    }],
    ['1.1.48', '2026-10-27', {
      uz: ['Menyu joyida, qisqaroq va tiniq', [
        'Kutubxona aylantirilganda ⋯ menyusi endi orqa fonga — xira chiziq ostiga — tushib qolmaydi',
        '⋯ menyusi qisqardi: «Yangilanishlar» bitta qator, u tarixni ochadi; «Yangilanishni tekshirish» tugmasi o‘sha sahifaning tepasida',
        'Sozlamalar → Eslatmalar: namuna haqiqiy macOS bildirishnomasidek — sarlavha va vaqt bir qatorda, ortiqcha olov belgisi yo‘q',
        'Ruscha seriya to‘g‘ri yoziladi: «1 день / 2 дня / 5 дней подряд»',
      ]],
      en: ['The menu stays put, shorter and sharp', [
        'Scrolling the library no longer sends the ⋯ menu under the blurred band',
        'A shorter ⋯ menu: Updates is one row that opens the history, with Check for updates at the top of that page',
        'Settings → Reminders: the sample looks like a real macOS banner — title and time on one line, no extra flame',
        'Russian streaks read properly: «1 день / 2 дня / 5 дней подряд»',
      ]],
      ru: ['Меню на месте — короче и чётче', [
        'При прокрутке библиотеки меню ⋯ больше не уходит под размытую полосу',
        'Меню ⋯ короче: «Обновления» — одна строка, она открывает историю, а «Проверить обновления» — вверху этой страницы',
        'Настройки → Напоминания: образец выглядит как настоящее уведомление macOS — заголовок и время в одной строке, без лишнего огонька',
        'Серия по-русски пишется правильно: «1 день / 2 дня / 5 дней подряд»',
      ]],
    }],
    ['1.1.47', '2026-10-27', {
      uz: ['Silliq surilish, toza ro‘yxatlar, boshqariladigan xotira', [
        'Sahifalar endi bir tekis sekinlashib kiradi: oldingi harakat yo‘lning uchdan birida keskin tormozlanib, keyin sudralardi va qotgandek ko‘rinardi',
        'Statistika, Sozlamalar va Yangilanishlar tarixi surilish boshlanishidan oldin tayyorlanadi, shuning uchun birinchi kadrdan siljiydi',
        'The Guardian ro‘yxatida o‘ng tomondagi muallif ismlari olib tashlandi — ular qatorni surib, rasmlarni qiyshaytirardi',
        'Sozlamalar → Xotira: har bir qismning o‘z amali bor — maqolalar va qaydlar papkasini ko‘rsatish, keshni tozalash, yuklab olingan yangilanishni o‘chirish',
        'Sozlamalardagi jonli namoyish (ilovaning ikkinchi nusxasi) va «Chuqur fokus» sessiyalari olib tashlandi; oddiy fokus rejimi (F) joyida',
        'O‘zbekcha sanalar to‘g‘ri yoziladi: «M10 13» o‘rniga «13-okt»',
      ]],
      en: ['Smooth slides, clean lists, storage you can manage', [
        'Pages now slow down evenly as they slide in: the old motion braked hard a third of the way and then crept, which looked like sticking',
        'Statistics, Settings and Update history are prepared before the slide starts, so they move from the first frame',
        'The author names on the right of The Guardian list are gone — they pushed the rows around and knocked the pictures out of line',
        'Settings → Storage: every part has its action — show the articles’ or notes’ folder, clear the cache, remove a downloaded update',
        'The live demo in Settings (a second copy of the app) and Deep focus sessions are gone; plain focus mode (F) stays',
        'Uzbek dates are written properly: “13-okt” instead of “M10 13”',
      ]],
      ru: ['Плавные переходы, чистые списки, управляемое хранилище', [
        'Страницы теперь равномерно замедляются при въезде: прежнее движение резко тормозило на трети пути и потом ползло, будто застревало',
        'Статистика, Настройки и История обновлений готовятся до начала перехода и двигаются с первого кадра',
        'Имена авторов справа в списке The Guardian убраны — они сдвигали строки и сбивали картинки',
        'Настройки → Хранилище: у каждой части своё действие — показать папку статей или заметок, очистить кэш, удалить скачанное обновление',
        'Живая демонстрация в Настройках (вторая копия приложения) и сессии «Глубокого фокуса» убраны; обычный режим фокуса (F) остался',
        'Узбекские даты пишутся правильно: «13-okt» вместо «M10 13»',
      ]],
    }],
    ['1.1.46', '2026-10-27', {
      uz: ['Tezroq — animatsiyalar o‘sha-o‘sha', [
        'Maqoladan kutubxonaga qaytish endi bitta ham kadr yo‘qotmaydi: Inky har qadamda o‘zini qaytadan chizmaydi',
        'Maqola tezroq ochiladi: bosgandan keyingi kutish uchdan birga qisqardi',
        'Lug‘at paneli o‘lchash ishisiz ochiladi: tarjima maydonlari balandligini endi brauzer o‘zi beradi',
        'Sozlamalar va Statistika ekrandan pastdagi qismlarni ko‘rinmaguncha hisoblamaydi',
        'Listening ro‘yxatida sana va sonlar tezroq yoziladi',
      ]],
      en: ['Faster, with every animation kept', [
        'Going back from an article to the library no longer drops a frame: Inky stopped redrawing itself from scratch at every step',
        'Articles open sooner: the wait after a click is a third shorter',
        'The vocabulary drawer opens without measuring: the browser now sizes the translation fields itself',
        'Settings and Statistics leave the parts below the first screen alone until you scroll near them',
        'Dates and numbers in the Listening list are written faster',
      ]],
      ru: ['Быстрее — анимации на месте', [
        'Возврат из статьи в библиотеку больше не теряет ни одного кадра: Inky не перерисовывает себя заново на каждом шаге',
        'Статьи открываются быстрее: ожидание после нажатия стало на треть короче',
        'Панель словаря открывается без замеров: высоту полей перевода теперь задаёт сам браузер',
        'Настройки и Статистика не просчитывают части ниже первого экрана, пока вы до них не прокрутите',
        'Даты и числа в списке Listening выводятся быстрее',
      ]],
    }],
    ['1.1.45', '2026-10-27', {
      uz: ['Ko‘proq video va maqola, Sozlamalarda xotira', [
        'Listening: har bir kanal uchun endi taxminan 150 ta epizod chiqadi (oldin 30 ta edi), pleylistlardan 100 tagacha',
        'The Guardian: har bir bo‘limda endi 100 tagacha maqola chiqadi (oldin 30 ta edi)',
        'Yangilanishlar tarixi: har bir yangilanishni bosib to‘liq o‘qish mumkin, oldingi va keyingi versiyaga o‘tish tugmalari bilan',
        'Uzun ro‘yxatlarda birinchi ekrandan keyingi qatorlar animatsiyasiz chiqadi, shuning uchun aylantirish silliq qoladi',
        'Sozlamalar → Xotira: Inkwell diskda qancha joy egallayotgani — ilovaning o‘zi, maqolalar, qaydlar va kesh alohida, butun disk ichidagi ulushi bilan',
        '«Keshni tozalash» tugmasi: vaqtinchalik fayllar o‘chadi, qaydlar, maqolalar va sozlamalar joyida qoladi',
        'Ma’lumotlar papkasi endi «Inkwell» deb ataladi (oldin «365 Articles Reader» edi): u ko‘chirilmaydi, faqat qayta nomlanadi, hech narsa yo‘qolmaydi',
      ]],
      en: ['More videos and articles, and Storage in Settings', [
        'Listening: each channel now shows about 150 episodes (it was 30), and up to 100 from a playlist',
        'The Guardian: every section now lists up to 100 articles (it was 30)',
        'Update history: click any update to read it in full, with buttons to the older and newer versions',
        'In long lists, rows past the first screen come in without animation, so scrolling stays smooth',
        'Settings → Storage: how much room Inkwell takes on the disk — the app, articles, notes and cache apart, and its share of the whole disk',
        'A Clear cache button: temporary files go, your notes, articles and settings stay',
        'The data folder is now called “Inkwell” (it was “365 Articles Reader”): it is renamed, not copied, and nothing is lost',
      ]],
      ru: ['Больше видео и статей, хранилище в настройках', [
        'Listening: у каждого канала теперь около 150 эпизодов (было 30), из плейлиста — до 100',
        'The Guardian: в каждом разделе теперь до 100 статей (было 30)',
        'История обновлений: любое обновление можно открыть и прочитать целиком, с переходом к предыдущей и следующей версии',
        'В длинных списках строки ниже первого экрана появляются без анимации, поэтому прокрутка остаётся плавной',
        'Настройки → Хранилище: сколько места Inkwell занимает на диске — приложение, статьи, заметки и кэш по отдельности, и доля от всего диска',
        'Кнопка «Очистить кэш»: временные файлы удаляются, заметки, статьи и настройки остаются',
        'Папка с данными теперь называется «Inkwell» (была «365 Articles Reader»): она переименовывается, а не копируется, ничего не теряется',
      ]],
    }],
    ['1.1.44', '2026-10-27', {
      uz: ['Barcha yangilanishlar bir joyda', [
        '⋯ menyusida yangi qator — «Yangilanishlar tarixi»: Inkwell’ning har bir versiyasi va u olib kelgan o‘zgarishlar, eng yangisi tepada',
        'Matn o‘zbek, ingliz va rus tillarida yozilgan va ilova tiliga qarab almashadi',
        'Sizdagi versiya belgilab qo‘yiladi, «Nima yangi» sahifasidan ham bu yerga o‘tish mumkin',
      ]],
      en: ['Every update in one place', [
        'The ⋯ menu has a new row, Update history: every version of Inkwell and what it brought, newest first',
        'It is written in Uzbek, English and Russian and follows the app’s language',
        'Your version is marked, and “What’s new” links here too',
      ]],
      ru: ['Все обновления в одном месте', [
        'В меню ⋯ новый пункт «История обновлений»: каждая версия Inkwell и что она принесла, новые сверху',
        'Текст на узбекском, английском и русском и меняется вместе с языком приложения',
        'Ваша версия отмечена, а со страницы «Что нового» сюда ведёт ссылка',
      ]],
    }],
    ['1.1.43', '2026-10-27', {
      uz: ['⋯ menyusi endi tiniq', ['Kutubxona pastga aylantirilganda ⋯ menyusining pastki qatorlari xira ko‘rinardi. Endi menyu sarlavha ostidagi xira chiziqdan yuqorida turadi']],
      en: ['A sharp ⋯ menu', ['When the library was scrolled, the lower rows of the ⋯ menu came out blurred. The menu now sits above the soft edge under the header']],
      ru: ['Меню ⋯ снова чёткое', ['Когда библиотека была прокручена, нижние пункты меню ⋯ выглядели размытыми. Теперь меню лежит поверх размытой полосы под шапкой']],
    }],
    ['1.1.42', '2026-10-26', {
      uz: ['Ochilish kartasi qisqardi', [
        'Ilova ochilganda chiqadigan karta endi taxminan 2,6 soniyada yo‘qoladi (sekin internetda ham ko‘pi bilan 3 soniya)',
        'Unda — nom, salomlashuv va nom yoniga tushib, bir marta ko‘z qisadigan Inky',
      ]],
      en: ['A shorter launch card', [
        'The card shown when the app opens now leaves after about 2.6 seconds (3 at most, even on a slow connection)',
        'On it: the name, a greeting, and Inky dropping in beside the name with one blink',
      ]],
      ru: ['Заставка стала короче', [
        'Карточка при запуске теперь исчезает примерно через 2,6 секунды (не дольше 3, даже при медленном интернете)',
        'На ней — название, приветствие и Inky, который приземляется рядом с названием и один раз моргает',
      ]],
    }],
    ['1.1.41', '2026-10-26', {
      uz: ['Ochilish kartasida nima yuklanayotgani ko‘rinadi', ['Nom ostida Articles, Listening va The Guardian birin-ketin paydo bo‘ladi; har biri yuklanib bo‘lgach, belgi qo‘yiladi']],
      en: ['The launch card shows what is loading', ['Under the name, Articles, Listening and The Guardian appear one by one; each gets a tick when its part has loaded']],
      ru: ['Заставка показывает, что загружается', ['Под названием по очереди появляются Articles, Listening и The Guardian; каждая строка получает галочку, когда её часть загружена']],
    }],
    ['1.1.40', '2026-10-26', {
      uz: ['Ochilish kartasi yuklanishni kutadi; Statistika tuzatildi', [
        'Karta orqa fonda birinchi kerakli narsalar yuklanib bo‘lguncha turadi, shuning uchun sahifalar tayyor holda ochiladi',
        'Statistika: sichqoncha ustiga borganda yozuvlar endi yo‘qolib qolmaydi',
      ]],
      en: ['The launch card waits for loading; a Statistics fix', [
        'The card stays until the first things are loaded in the background, so pages open ready',
        'Statistics: labels no longer vanish when you hover over them',
      ]],
      ru: ['Заставка ждёт загрузки; исправление в статистике', [
        'Карточка остаётся, пока в фоне не загрузится самое нужное, поэтому страницы открываются готовыми',
        'Статистика: подписи больше не пропадают при наведении',
      ]],
    }],
    ['1.1.38', '2026-10-26', {
      uz: ['Statistika: bosiladigan to‘rtta kartochka', [
        'Ketma-ketlik, bugungi maqsad, shu hafta va bugungi yangi so‘zlar endi to‘rtta kartochkada',
        'Har biri javob beradi: oxirgi 14 kun kvadratchalarda, maqsadgacha to‘ladigan chiziq, hafta uchun yettita ustun, bosilganda esa bugungi yangi so‘zlar chiqadi',
      ]],
      en: ['Statistics: four tiles you can touch', [
        'The streak, today’s goal, this week and today’s new words are now four tiles',
        'Each one responds: the last 14 days as squares, a line filling up to the goal, seven bars for the week, and a click shows today’s new words',
      ]],
      ru: ['Статистика: четыре живые плитки', [
        'Серия, цель на сегодня, эта неделя и новые слова за сегодня теперь в четырёх плитках',
        'Каждая отзывается: последние 14 дней квадратиками, полоска до цели, семь столбиков недели, а по клику — сегодняшние новые слова',
      ]],
    }],
    ['1.1.37', '2026-10-26', {
      uz: ['So‘zlaringiz har bir maqolada belgilanadi', [
        'Bir maqolada saqlagan so‘zingiz endi boshqa maqolalarda ham uchragan joyida belgilanadi, ustiga borsangiz tarjimasi chiqadi',
        'Bossangiz, uni tarjimasi bilan shu maqola uchun ham saqlab qo‘yish mumkin',
      ]],
      en: ['Your words, marked in every article', [
        'A word you saved in one article is now marked wherever it appears in other articles too, with its translation on hover',
        'Click it to save it for this article as well, translation included',
      ]],
      ru: ['Ваши слова отмечены во всех статьях', [
        'Слово, сохранённое в одной статье, теперь отмечено везде, где встречается в других, с переводом при наведении',
        'Кликните — и его можно сохранить и для этой статьи, вместе с переводом',
      ]],
    }],
    ['1.1.36', '2026-10-25', {
      uz: ['Ochilgandan keyin tezroq', [
        'Ochilish kartasi turganda Inkwell odatda birinchi ochadigan narsalaringizni jimgina yuklab oladi: Listening epizodlari, bugungi reja va The Guardian’ning so‘nggi bo‘limi',
        'Listening endi ilova ochilishi bilanoq kutishsiz ochiladi',
        'Ochilish kartasida Inky kichik ro‘yxatdagi bandlarni belgilab chiqadi',
      ]],
      en: ['Faster right after launch', [
        'While the launch card is up, Inkwell quietly loads what you usually open first: Listening episodes, today’s plan and the latest Guardian section',
        'Listening now opens right after launch with no waiting',
        'Inky ticks off a little board on the launch card',
      ]],
      ru: ['Быстрее сразу после запуска', [
        'Пока видна заставка, Inkwell тихо загружает то, что вы обычно открываете первым: эпизоды Listening, план на сегодня и свежий раздел The Guardian',
        'Listening теперь открывается сразу после запуска, без ожидания',
        'На заставке Inky отмечает пункты в маленьком списке',
      ]],
    }],
    ['1.1.35', '2026-10-25', {
      uz: ['Listening: toza pleyer va to‘liq ekran', [
        'Video ustiga borganda endi YouTube sarlavhasi, tugmalari va tavsiya videolari chiqmaydi; bosish — ijro yoki pauza',
        'To‘liq ekran — yangi tugma, ikki marta bosish yoki F tugmasi; sichqoncha to‘xtasa, boshqaruv yashirinadi',
        'Epizod tugaganda YouTube’ning yakuniy ekrani o‘rniga epizod rasmi qaytadi',
      ]],
      en: ['Listening: a cleaner player with full screen', [
        'Hovering the video no longer shows YouTube’s title, buttons or suggested videos; a click plays or pauses',
        'Full screen with the new button, a double click or F; the controls hide when the pointer rests',
        'At the end of an episode its picture comes back instead of YouTube’s end screen',
      ]],
      ru: ['Listening: чистый плеер и полный экран', [
        'При наведении на видео больше не появляются заголовок, кнопки и рекомендации YouTube; клик — пуск или пауза',
        'Полный экран — новой кнопкой, двойным кликом или клавишей F; управление прячется, когда курсор неподвижен',
        'В конце эпизода вместо финальной заставки YouTube снова показывается его картинка',
      ]],
    }],
    ['1.1.34', '2026-10-25', {
      uz: ['Inky ochilish kartasiga tushadi', ['Inky nom yoniga tushib keladi, biroz sakrab qo‘nadi va unga qaraydi']],
      en: ['Inky lands on the launch card', ['Inky drops in beside the name, lands with a little bounce and looks at it']],
      ru: ['Inky приземляется на заставку', ['Inky прилетает к названию, мягко подпрыгивает при посадке и смотрит на него']],
    }],
    ['1.1.33', '2026-10-25', {
      uz: ['Inky jonlandi', [
        'Inky har bir sahifada o‘z ishini qiladi: siz bilan o‘qiydi, quloqchinda tinglaydi, kartochkalarni aylantiradi, rejani belgilaydi',
        'Inky gapiradi: kichik pufakchada salom beradi, hozirgina saqlagan so‘zingizni aytadi, maqola oxirida quvonadi',
        'Yigirmadan ortiq kayfiyat — kulgi va yulduzcha ko‘zlardan esnash va uyqugacha',
      ]],
      en: ['Inky comes alive', [
        'Inky does each page’s job: reads with you, listens in headphones, flips flashcards, ticks off the plan',
        'Inky talks: a small bubble says hello, names the word you just saved and cheers at the end of an article',
        'More than twenty moods, from laughter and starry eyes to a yawn and sleep',
      ]],
      ru: ['Inky оживает', [
        'Inky занят делом на каждой странице: читает вместе с вами, слушает в наушниках, переворачивает карточки, отмечает план',
        'Inky говорит: в маленьком облачке здоровается, называет только что сохранённое слово и радуется концу статьи',
        'Больше двадцати настроений — от смеха и глаз-звёздочек до зевоты и сна',
      ]],
    }],
    ['1.1.32', '2026-10-24', {
      uz: ['Inky ochilish kartasida', ['Inkwell ochilganda Inky nom yoniga yurib keladi, quvonadi, keyin o‘z burchagiga ketadi']],
      en: ['Inky on the launch card', ['When Inkwell opens, Inky walks up beside the name and cheers, then walks into its corner']],
      ru: ['Inky на заставке', ['При запуске Inky подходит к названию, радуется и уходит в свой угол']],
    }],
    ['1.1.31', '2026-10-24', {
      uz: ['Inky siz bilan hamma joyda', [
        'Inky har bir sahifa burchagida turadi va boshqa sahifaga o‘tsangiz, birga yuradi',
        'Ko‘zlari sichqonchani kuzatadi; maqolada siz bilan o‘qiydi, so‘z saqlasangiz yoki rejani bajarsangiz quvonadi',
        'Ikki daqiqa hech narsa bosilmasa, uxlab qoladi; o‘qish esa silliqligicha qoladi',
      ]],
      en: ['Inky goes everywhere with you', [
        'Inky stands in the corner of every page and walks along when you switch pages',
        'Its eyes follow the pointer; it reads with you in an article and cheers when you save a word or finish the plan',
        'It falls asleep after two minutes without a touch, and reading stays smooth',
      ]],
      ru: ['Inky всегда рядом', [
        'Inky стоит в углу каждой страницы и идёт следом, когда вы переходите на другую',
        'Его глаза следят за курсором; в статье он читает вместе с вами и радуется, когда вы сохраняете слово или выполняете план',
        'Через две минуты без действий он засыпает, а чтение остаётся плавным',
      ]],
    }],
    ['1.1.30', '2026-10-24', {
      uz: ['Tanishing: Inky', [
        'Inky — patli kichkina piksel siyohdon — endi ilovada yashaydi',
        'Reja sahifasida Inky o‘qiydi, kun bajarilganda quvonadi, kechasi uxlaydi; har bir maqola oxirida ham Inky bor',
      ]],
      en: ['Meet Inky', [
        'Inky, a little pixel inkwell with a quill, now lives in the app',
        'On the Plan page Inky reads, cheers when the day is done and sleeps late at night; every article ends with Inky',
      ]],
      ru: ['Знакомьтесь: Inky', [
        'Inky — маленькая пиксельная чернильница с пером — теперь живёт в приложении',
        'На странице плана Inky читает, радуется выполненному дню и спит поздно ночью; каждая статья заканчивается Inky',
      ]],
    }],
    ['1.1.29', '2026-10-24', {
      uz: ['Lug‘at PDF ko‘rinishida va silliqroq o‘qish', [
        'Lug‘at panelidagi PDF tugmasi so‘zlaringizni tarjimalari va olingan gaplari bilan toza sahifaga chiqarib, Downloads papkasiga saqlaydi',
        'So‘z qo‘shish yoki o‘chirish endi butun maqolani qayta chizmaydi',
        'Saqlangan so‘zlar yopuvchi qo‘shtirnoq yonida ham belgilanadi',
      ]],
      en: ['Vocabulary as a PDF, and smoother reading', [
        'A PDF button in the vocabulary drawer makes a clean page of your words with their translations and the sentences they came from, saved to Downloads',
        'Adding or removing a word no longer redraws the whole article',
        'Saved words are marked next to a closing quote too',
      ]],
      ru: ['Словарь в PDF и более плавное чтение', [
        'Кнопка PDF в панели словаря делает аккуратную страницу ваших слов с переводами и предложениями, откуда они взяты, и сохраняет её в «Загрузки»',
        'Добавление или удаление слова больше не перерисовывает всю статью',
        'Сохранённые слова отмечаются и рядом с закрывающей кавычкой',
      ]],
    }],
    ['1.1.28', '2026-10-24', {
      uz: ['Listening yana ishlaydi; reja bajarilganini hisoblaydi', [
        'Listening: YouTube ko‘rsatuv lentalarini berishni to‘xtatdi, endi epizodlar ko‘rsatuvning o‘z sahifasidan olinadi',
        'Reja: bugun oxirigacha o‘qilgan har qanday maqola yoki ko‘rilgan epizod hisoblanadi, rejada bo‘lmasa ham',
        'Reja: maqola tanlashda ikki bo‘lim bor — Articles va The Guardian',
        'Telefonda: matnni belgilash va saqlangan so‘zlarni bosish to‘g‘ri ishlaydi',
      ]],
      en: ['Listening works again; the plan counts what you finished', [
        'Listening: YouTube stopped serving show feeds, so episodes now come from the show’s own page',
        'Plan: any article read to the end or episode watched today counts, planned or not',
        'Plan: choosing an article has two tabs, Articles and The Guardian',
        'Phones: selecting text and tapping saved words work properly',
      ]],
      ru: ['Listening снова работает; план засчитывает сделанное', [
        'Listening: YouTube перестал отдавать ленты передач, теперь эпизоды берутся со страницы самой передачи',
        'План: засчитывается любая статья, дочитанная сегодня, и любой досмотренный эпизод, даже не из плана',
        'План: при выборе статьи две вкладки — Articles и The Guardian',
        'Телефоны: выделение текста и нажатие на сохранённые слова работают как надо',
      ]],
    }],
    ['1.1.27', '2026-10-23', {
      uz: ['Tepada bitta qator, rasmlar silliqroq', [
        'Javon nomlari va tugmalar doim bitta qatorda; tor oynada tugmalar pastga tushmaydi, nomlar kichrayadi',
        'Kutubxona qatorlarida rasmlarning kichik nusxasi ko‘rsatiladi, shuning uchun aylantirish to‘xtab qolmaydi',
        'Statistika va maqolalar kirib kelishdan oldin chizib olinadi',
      ]],
      en: ['One row on top, smoother pictures', [
        'Shelf titles and buttons always share one row; in a narrow window the titles get smaller instead',
        'Library rows show small copies of pictures, so scrolling no longer stutters',
        'Statistics and articles are drawn before they slide in',
      ]],
      ru: ['Один ряд сверху и плавные картинки', [
        'Названия полок и кнопки всегда в одном ряду; в узком окне названия просто уменьшаются',
        'В строках библиотеки — уменьшенные копии картинок, поэтому прокрутка больше не дёргается',
        'Статистика и статьи отрисовываются до того, как выезжают',
      ]],
    }],
    ['1.1.26', '2026-10-23', {
      uz: ['Epizodga silliq kirish', [
        'Epizod ochilganda endi to‘xtalish yo‘q: sahifa kirib kelayotganda o‘rnida epizod rasmi turadi, keyin pleyer chiqadi',
        'Rejaga qaytganda rasmlar qayta yuklanmaydi, hech narsa miltillamaydi',
      ]],
      en: ['Smoother into an episode', [
        'Opening an episode no longer stutters: its picture stands in while the page slides in, then the player appears',
        'Coming back to the plan keeps its pictures, so nothing blinks',
      ]],
      ru: ['Плавный переход к эпизоду', [
        'Открытие эпизода больше не подтормаживает: пока страница выезжает, на месте плеера стоит картинка эпизода, затем появляется плеер',
        'При возврате к плану картинки не загружаются заново, ничего не мигает',
      ]],
    }],
    ['1.1.25', '2026-10-23', {
      uz: ['Reja sahifasi yengillashdi', [
        'Maqola tanlash oynasi uch barobar tez ochiladi va qotmaydi',
        'Tanlash oynasida qidiruv bir zumda ishlaydi',
        'Bugungi podkast kartasidagi rasm tiniqroq',
      ]],
      en: ['A lighter plan page', [
        'The article chooser opens three times faster and no longer drops frames',
        'Searching in the chooser is instant',
        'Sharper pictures on today’s podcast card',
      ]],
      ru: ['Страница плана стала легче', [
        'Окно выбора статьи открывается в три раза быстрее и не подтормаживает',
        'Поиск в окне выбора работает мгновенно',
        'Картинка на карточке сегодняшнего подкаста стала чётче',
      ]],
    }],
    ['1.1.24', '2026-10-23', {
      uz: ['Har kun uchun reja', [
        'Yangi Reja sahifasi: har kuni oxirigacha ko‘riladigan bitta podkast va oxirigacha o‘qiladigan bitta maqola',
        'Ikkalasi bajarilganda kun bajarilgan hisoblanadi va ilova buni aytadi',
        'Keyingi olti kunni o‘zingiz rejalashtiring yoki «Avtomatik to‘ldirish» tanlab bersin',
        'Oxirgi to‘rt hafta bir qarashda, to‘liq kunlar ketma-ketligi bilan',
      ]],
      en: ['A plan for every day', [
        'New Plan page: each day one podcast to watch to the end and one article to read to the end',
        'The day counts as done when both are finished, and the app tells you',
        'Plan the next six days yourself, or let “Fill automatically” pick',
        'The last four weeks at a glance, with your streak of full days',
      ]],
      ru: ['План на каждый день', [
        'Новая страница «План»: каждый день один подкаст досмотреть и одну статью дочитать до конца',
        'День засчитывается, когда сделано и то и другое, — приложение об этом скажет',
        'Спланируйте следующие шесть дней сами или нажмите «Заполнить автоматически»',
        'Последние четыре недели одним взглядом, с серией полных дней',
      ]],
    }],
    ['1.1.23', '2026-10-23', {
      uz: ['Qoldirgan joyingizda ochiladi, ilova tezroq', [
        'Ilova ochilganda endi o‘z-o‘zidan Kartochkalarga o‘tib ketmaydi; faqat eslatmani bossangiz o‘tadi',
        'Sahifalar almashishi, Statistika va Sozlamalar sezilarli tezlashdi',
        'Sozlamalardagi tugmalar namoyishi endi musiqa pleyerini qaytarib ochmaydi',
      ]],
      en: ['Opens where you left it, and a quicker app', [
        'Opening the app no longer jumps to Cards on its own; only a click on a reminder takes you there',
        'Switching pages, Statistics and Settings are noticeably faster',
        'The shortcuts demo in Settings no longer brings back the music player',
      ]],
      ru: ['Открывается там, где вы остановились, и работает быстрее', [
        'При запуске приложение больше не перескакивает в Карточки само; туда ведёт только нажатие на напоминание',
        'Переключение страниц, Статистика и Настройки заметно ускорились',
        'Демонстрация сочетаний клавиш в Настройках больше не открывает музыкальный плеер',
      ]],
    }],
    ['1.1.22', '2026-10-23', {
      uz: ['Yangilanishlar endi yetib keladi', [
        'Yangilanish endi faqat o‘zgargan qismni yuklaydi — butun 150 MB ilova o‘rniga taxminan 1 MB',
        'Jarayon birinchi baytdan yuradi, sekin internetda 0% da qotib qolmaydi',
        'Uzilib qolgan yuklash o‘zi davom etadi',
      ]],
      en: ['Updates that arrive', [
        'Updates now download only what changed, about a megabyte instead of the whole 150 MB app',
        'Progress moves from the first byte, so a slow connection no longer sits at 0%',
        'A download that breaks off resumes by itself',
      ]],
      ru: ['Обновления доходят', [
        'Обновление теперь скачивает только изменённое — около мегабайта вместо всего приложения на 150 МБ',
        'Прогресс идёт с первого байта, при медленном интернете больше нет зависания на 0%',
        'Оборвавшаяся загрузка сама продолжается с места остановки',
      ]],
    }],
    ['1.1.21', '2026-10-23', {
      uz: ['The Guardian hamma uchun', [
        'The Guardian javoni endi Mac, Windows va veb-versiyada Inkwell’ning bir qismi: Long Read, Science, Culture va boshqalar',
        'U sizning shaxsiy bepul kalitingiz bilan ishlaydi (Sozlamalar → The Guardian)',
        'Javonlar almashishi va Sozlamalar ochilishi silliqroq',
      ]],
      en: ['The Guardian for everyone', [
        'The Guardian shelf is now part of Inkwell on Mac, Windows and the web: Long Reads, Science, Culture and more',
        'It works with your own free key (Settings → The Guardian)',
        'Switching shelves and opening Settings is smoother',
      ]],
      ru: ['The Guardian для всех', [
        'Полка The Guardian теперь часть Inkwell на Mac, Windows и в веб-версии: Long Read, Science, Culture и другое',
        'Она работает с вашим собственным бесплатным ключом (Настройки → The Guardian)',
        'Переключение полок и открытие Настроек стали плавнее',
      ]],
    }],
    ['1.1.20', '2026-10-23', {
      uz: ['Inkwell vebda', ['Xuddi shu ilovadan yig‘ilgan veb-versiya, telefon uchun moslangan ko‘rinish bilan']],
      en: ['Inkwell on the web', ['A web version built from the same app, with a layout for phones']],
      ru: ['Inkwell в браузере', ['Веб-версия, собранная из того же приложения, с раскладкой для телефонов']],
    }],
    ['1.1.18', '2026-10-22', {
      uz: ['Tezroq ochilish va yangilanishni tekshirish tugmasi', [
        'Ilova ochilganda kutubxona tezroq tayyor bo‘ladi',
        'Asl shriftlar qaytdi: ilova uchun SF Pro, o‘qish uchun Iowan',
        '⋯ menyusida versiyangiz bilan «Yangilanish» qatori bor; u GitHub’ni darhol tekshiradi',
      ]],
      en: ['Faster start, and a button to check for updates', [
        'The library is ready sooner when the app opens',
        'The original fonts are back: SF Pro for the app, Iowan for reading',
        'The ⋯ menu has an Updates row with your version; it checks GitHub right away',
      ]],
      ru: ['Быстрый запуск и кнопка проверки обновлений', [
        'После запуска библиотека готова быстрее',
        'Вернулись исходные шрифты: SF Pro для интерфейса, Iowan для чтения',
        'В меню ⋯ есть пункт «Обновления» с вашей версией; он сразу проверяет GitHub',
      ]],
    }],
    ['1.1.16', '2026-10-22', {
      uz: ['Listening, bildirishnomalar markazi va ko‘rinadigan yangilanishlar', [
        'Listening: YouTube ko‘rsatuvlari uchun javon (BBC Learning English, TED yoki o‘zingiz qo‘shgan istalgan kanal), har bir epizodda yozish uchun joy bor',
        'Yangilanishlar: yangi versiya chiqqanini banner aytadi, «Nima yangi» u nimalar olib kelganini ko‘rsatadi',
        'Bildirishnomalar markazi: qo‘ng‘iroqcha barcha xabarlarni saqlaydi',
        'Qaydlar har kuni bir marta zaxiralanadi, oxirgi 7 kun uchun',
      ]],
      en: ['Listening, a notification centre and updates you can watch', [
        'Listening: a shelf for YouTube shows (BBC Learning English, TED or any channel you paste), each episode with a place to write',
        'Updates: a banner says when a new version is out, and “What’s new” shows what it brings',
        'Notification centre: the bell keeps every announcement',
        'Notes are backed up once a day, for the last 7 days',
      ]],
      ru: ['Listening, центр уведомлений и обновления на виду', [
        'Listening: полка для передач с YouTube (BBC Learning English, TED или любой ваш канал), у каждого эпизода — место для записей',
        'Обновления: баннер сообщает о новой версии, а «Что нового» показывает, что она принесла',
        'Центр уведомлений: колокольчик хранит все объявления',
        'Заметки раз в день сохраняются в резервную копию, за последние 7 дней',
      ]],
    }],
    ['1.1.15', '2026-10-22', {
      uz: ['Inkwell o‘zini o‘zi yangilaydi', [
        'Inkwell ochilganda va har 4 soatda yangi versiyani tekshiradi, ilovani yopganingizda o‘rnatadi',
        'Ilova o‘z shriftlari bilan keladi, shuning uchun har qanday kompyuterda bir xil ko‘rinadi',
      ]],
      en: ['Inkwell updates itself', [
        'Inkwell checks for a new version on start and every 4 hours, and installs it when you quit',
        'The app brings its own fonts, so it looks the same on every computer',
      ]],
      ru: ['Inkwell обновляется сам', [
        'Inkwell проверяет новую версию при запуске и каждые 4 часа и устанавливает её, когда вы закрываете приложение',
        'Приложение приносит свои шрифты, поэтому выглядит одинаково на любом компьютере',
      ]],
    }],
    ['1.1.14', '2026-10-22', {
      uz: ['Yengilroq ilova', [
        'Yopilgan sahifalar yashirin turganda resurs sarflamaydi, Statistika to‘xtalishsiz ochiladi',
        'Ko‘p so‘z bo‘lsa ham lug‘at paneli tezroq ochiladi',
      ]],
      en: ['A lighter app', [
        'Pages you have left cost nothing while hidden, so Statistics opens without a pause',
        'The vocabulary drawer opens faster, even with many words',
      ]],
      ru: ['Приложение стало легче', [
        'Скрытые страницы больше не расходуют ресурсы, поэтому Статистика открывается без паузы',
        'Панель словаря открывается быстрее, даже когда слов много',
      ]],
    }],
    ['1.1.13', '2026-10-22', {
      uz: ['Windows: PDF qo‘shish ishlaydi', [
        '«+ PDF qo‘shish» Windows’da endi fayl tanlashga imkon beradi',
        'Fayllarni oynaga sudrab tashlash Windows’da ishlaydi',
      ]],
      en: ['Windows: adding PDFs works', [
        '“+ Add PDF” now lets you pick files on Windows',
        'Dragging files onto the window works on Windows',
      ]],
      ru: ['Windows: добавление PDF работает', [
        '«+ Добавить PDF» теперь позволяет выбрать файлы в Windows',
        'Перетаскивание файлов в окно работает в Windows',
      ]],
    }],
    ['1.1.11', '2026-10-22', {
      uz: ['Vibratsiya, yakunlar va boyroq Statistika', [
        'Mac trekpadida yengil tebranishlarni sezasiz: fokus rejimidagi paragraflar, slayderlar, kartochkalarni surish (Sozlamalar → Vibratsiya orqali o‘chiriladi)',
        '«Bugun» va «Shu hafta» yakunlari butun oyna bo‘ylab hikoya sifatida ochiladi',
        'Statistikaga ketma-ketlik kartasi, bugungi halqalar, Faktlar va Rekordlar qo‘shildi',
      ]],
      en: ['Haptics, recaps and a richer Statistics page', [
        'On a Mac trackpad you feel light taps: paragraphs in focus mode, sliders, card swipes (Settings → Haptics turns them off)',
        '“Today” and “This week” recaps open as full-window stories',
        'Statistics got a streak card, rings for today, Facts and Records',
      ]],
      ru: ['Вибрация, итоги и богатая статистика', [
        'На трекпаде Mac чувствуются лёгкие касания: абзацы в режиме фокуса, ползунки, свайпы карточек (выключаются в Настройки → Вибрация)',
        'Итоги «Сегодня» и «Эта неделя» открываются как истории на всё окно',
        'В статистике появились карточка серии, кольца за сегодня, Факты и Рекорды',
      ]],
    }],
  ];

  const TX = {
    uz: { page: 'Yangilanishlar tarixi', title: 'Barcha yangilanishlar', meta: (n) => `${n} ta yangilanish · eng yangisi tepada · bosib to‘liq o‘qing`, yours: 'Sizdagi versiya', newer: 'Yangiroq — yangilang',
      changes: (n) => `${n} ta o‘zgarish`, read: 'To‘liq o‘qish', older: 'Oldingi versiya', next: 'Keyingi versiya', what: 'Nimalar o‘zgardi',
      months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'], date: (d, m, y) => `${y}-yil ${d}-${m}` },
    en: { page: 'Update history', title: 'Every update', meta: (n) => `${n} updates · newest first · click one to read it all`, yours: 'Your version', newer: 'Newer — update to get it',
      changes: (n) => `${n} ${n === 1 ? 'change' : 'changes'}`, read: 'Read in full', older: 'Older version', next: 'Newer version', what: 'What changed',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], date: (d, m, y) => `${d} ${m} ${y}` },
    ru: { page: 'История обновлений', title: 'Все обновления', meta: (n) => `${n} обновлений · новые сверху · нажмите, чтобы прочитать целиком`, yours: 'Ваша версия', newer: 'Новее — обновитесь',
      changes: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'изменение' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'изменения' : 'изменений'}`,
      read: 'Читать целиком', older: 'Предыдущая версия', next: 'Следующая версия', what: 'Что изменилось',
      months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'], date: (d, m, y) => `${d} ${m} ${y}` },
  };
  const tx = () => TX[document.documentElement.lang] || TX.uz;
  const lang = () => (TX[document.documentElement.lang] ? document.documentElement.lang : 'uz');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const num = (v) => v.split('.').map(Number);
  const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
  const when = (iso) => { const [y, m, d] = iso.split('-').map(Number); const t = tx(); return t.date(d, t.months[m - 1], y); };
  const notesOf = (entry) => entry[2][lang()] || entry[2].en;

  // sel: the version opened in full, or '' for the list; listTop keeps the list where it was
  let page, from = 'library', installed = '', sel = '', listTop = 0;
  if (typeof api !== 'undefined' && api.appVersion) api.appVersion().then((v) => (installed = v || '')).catch(() => {});

  function ensure() {
    if (page) return;
    page = document.createElement('section');
    page.id = 'history';
    page.className = 'view';
    page.innerHTML = `
      <header class="bar">
        <button class="btn ghost back" id="ch-back"></button>
        <div class="bar-title show" id="ch-title"></div>
        <div></div>
      </header>
      <main class="scroller"><div class="wn ch" id="ch-body"></div></main>`;
    document.querySelector('#stats').after(page);
    page.querySelector('#ch-back').onclick = () => (sel ? show('') : showView(from));
    page.querySelector('#ch-body').addEventListener('click', (e) => {
      if (e.target.closest('.ch-check')) return checkUpdates();
      const go = e.target.closest('[data-v]');
      if (go) show(go.dataset.v);
    });
  }

  const tags = (v) => {
    const t = tx(), mine = v === installed, ahead = installed && newer(v, installed);
    return mine ? `<span class="ch-tag">${esc(t.yours)}</span>` : ahead ? `<span class="ch-tag soft">${esc(t.newer)}</span>` : '';
  };

  function listHtml() {
    const t = tx();
    let k = 2;
    return `
      <h1 class="wn-ver" style="--k:0">${esc(t.title)}</h1>
      <div class="ch-intro" style="--k:1"><p class="wn-meta">${esc(t.meta(LOG.length))}</p>${typeof checkUpdates === 'function' && checkUpdates ? `<button type="button" class="wn-act ch-check">${esc(window.t('up.checkNow'))}</button>` : ''}</div>
      ${LOG.map((entry) => {
        const [v, date] = entry, [title, points] = notesOf(entry);
        const ahead = installed && newer(v, installed);
        return `<button type="button" class="ch-rel${v === installed ? ' mine' : ''}${ahead ? ' ahead' : ''}" data-v="${esc(v)}" style="--k:${Math.min(k++, 9)}">
          <span class="ch-head"><span class="ch-v">v${esc(v)}</span><time datetime="${date}">${esc(when(date))}</time>${tags(v)}</span>
          <span class="ch-title">${esc(title)}</span>
          <span class="ch-sum">${esc(points[0])}</span>
          <span class="ch-more">${esc(t.changes(points.length))} · ${esc(t.read)} <i aria-hidden="true">›</i></span>
        </button>`;
      }).join('')}`;
  }

  // one update in full: every change on its own, and the versions on either side
  function detailHtml(i) {
    const t = tx(), entry = LOG[i], [v, date] = entry, [title, points] = notesOf(entry);
    const side = (j, label, cls) => {
      if (!LOG[j]) return '<span></span>';
      return `<button type="button" class="ch-side ${cls}" data-v="${esc(LOG[j][0])}"><small>${esc(label)} · v${esc(LOG[j][0])}</small><b>${esc(notesOf(LOG[j])[0])}</b></button>`;
    };
    return `
      <p class="ch-head ch-top" style="--k:0"><span class="ch-v">v${esc(v)}</span><time datetime="${date}">${esc(when(date))}</time>${tags(v)}</p>
      <h1 class="wn-ver ch-h" style="--k:1">${esc(title)}</h1>
      <section class="wn-sec ch-full" style="--k:2"><h3>${esc(t.what)} · ${esc(t.changes(points.length))}</h3>
        <ol>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      </section>
      <nav class="ch-nav" style="--k:3">${side(i + 1, t.older, 'prev')}${side(i - 1, t.next, 'next')}</nav>`;
  }

  let drawn = ''; // what the page shows now (language, version, list or one update)
  function render() {
    if (!page) return;
    drawn = [document.documentElement.lang, installed, sel].join('|');
    const t = tx(), i = sel ? LOG.findIndex((e) => e[0] === sel) : -1;
    if (sel && i < 0) sel = '';
    page.querySelector('#ch-back').innerHTML = sel ? `← ${esc(t.page)}` : window.t('reader.back'); // i18n.js
    page.querySelector('#ch-title').textContent = sel ? 'v' + sel : t.page;
    page.querySelector('#ch-body').innerHTML = sel ? detailHtml(i) : listHtml();
  }

  // list → one update, one update → another, or back to the list where it was left
  function show(v) {
    const scroller = page.querySelector('.scroller');
    if (!sel) listTop = scroller.scrollTop;
    sel = v;
    render();
    page.querySelector('#ch-body').classList.remove('ch-swap');
    void page.offsetWidth;
    page.querySelector('#ch-body').classList.add('ch-swap');
    scroller.scrollTop = v ? 0 : listTop;
  }

  function open() {
    ensure();
    sel = '';
    listTop = 0;
    // built ahead while the app was idle: opening only slides it in
    if (drawn !== [document.documentElement.lang, installed, sel].join('|')) render();
    const cur = document.querySelector('.view.is-active');
    if (cur && cur.id !== 'history') from = cur.id;
    page.querySelector('.scroller').scrollTop = 0;
    // styled and laid out off screen first (.warm, as an article is), so the slide's first frame
    // only paints: the page then moves from its first frame instead of after a long one
    page.classList.add('warm');
    settled().then(() => (showView('history'), page.classList.remove('warm')));
  }

  // the page is made (and drawn, off screen and skipped by the browser) once the app is idle,
  // so the first open doesn't spend 80 ms building it before the slide can start
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 3000)))(() => (ensure(), render()), { timeout: 5000 });

  return { open, render, isOpen: () => !!page && page.classList.contains('is-active') };
})();

Object.assign(I18N.uz, { 'up.all': 'Barcha yangilanishlar ›', 'up.checkNow': 'Yangilanishni tekshirish' });
Object.assign(I18N.en, { 'up.all': 'Every update ›', 'up.checkNow': 'Check for updates' });
Object.assign(I18N.ru, { 'up.all': 'Все обновления ›', 'up.checkNow': 'Проверить обновления' });
