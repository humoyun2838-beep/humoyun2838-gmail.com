# Onko gematologiya

Asosiy bot: @DMed_Onko_Gematologiya_bot. Administrator boti: @Onko_Gematologiya_Admin_bot.
Ikkalasi Google Apps Script’da webhook orqali ishlaydi; kompyuter ochiq turishi shart emas.

## Foydalanish

Yangi foydalanuvchi asosiy botga /start yuboradi. Administrator botiga kirish so‘rovi keladi.
Administrator tasdiqlash, rad etish, foydalanuvchilar ro‘yxatini ko‘rish, ruxsatni bekor qilish va tiklash imkoniyatiga ega.

Tasdiqlangan foydalanuvchi 15 bo‘limdan birini, keyin xodimni tanlab matn kiritadi.
340 xodim yozuvi va har bir bo‘limda «Boshqa» bor. Xodimlar ro‘yxati qayta chiqadi.
«✅ Xabarni tasdiqlash» barcha yozuvlarni shu bo‘limning Google Sheets varag‘iga bitta qator qilib saqlaydi.
Sana Asia/Tashkent vaqtida yoziladi. Yangi qatorlar oldingi kun yozuvlaridan keyin qo‘shiladi.
«⬅️ Bo‘limlar» bo‘lim tanlashga qaytaradi va tugallanmagan yozuvlarni saqlaydi.

## Google’dagi dastur

`hosted_bot.gs` — amaldagi bot kodi; `appsscript.json` — kerakli Google ruxsatlari.
Script Properties: BOT_TOKEN, ADMIN_BOT_TOKEN, ADMIN_IDS, SHEETS_SECRET, WEBHOOK_KEY.
Kalitlar jadvalda saqlanmaydi. _BotRoster, _BotUsers, _BotDrafts, _BotUpdates va _BotOutbox yashirin varaqlarida ro‘yxat, ruxsat, yozuv holati va yuborish navbati saqlanadi.

Kod yoki manifest yangilanganda amaldagi deployment uchun yangi versiya joylanadi.
`setupHosting` ruxsatlarni tekshiradi va yuborish navbatini qayta urinish uchun har daqiqalik trigger yaratadi.
`enableWebhooks` ikkala botni deployment URL’iga ulaydi.

Mahalliy Python kodlari zaxira sifatida saqlangan. `.env` dagi HOSTED_MODE=1 ularni ishga tushirishni to‘xtatadi, chunki webhook bilan bir paytda polling ishlamaydi.
Tokenlarni chatga yoki Git’ga joylamang.

Sinovlar: `python3 -m unittest discover -s tests -v` va `node tests/test_hosted.cjs`.

## Tezlik va dizayn yangilanishi

Bo‘lim tugmalariga mos emoji belgilar va rangli amallar qo‘shilgan. Bo‘lim ochilganda AI yaratgan rasm xodimlar tugmalari bilan bitta Telegram xabarida chiqadi. Rasm Telegram file_id orqali qayta ishlatiladi; fayl har safar qayta yuklanmaydi. Telegram chat devor fonini bot avtomatik o‘zgartira olmaydi.

Foydalanuvchining joriy ruxsati va faol bo‘limi USER:* Script Properties qiymatlarida saqlanadi; _BotUsers ro‘yxat va holat o‘zgarishlarining jadval nusxasi. Har menyu bosilishida jadvalga qayta yozilmaydi. Xodimlar ro‘yxati va yozuvlarning tezkor nusxasi CacheService’da, yozuvning asosiy nusxasi esa _BotDrafts varag‘ida saqlanadi.

Yangi xabar navbati OUTBOX:* Script Properties’da saqlanadi va o‘sha so‘rov ichida yuboriladi. Vaqtinchalik tarmoq xatosida navbat saqlanib, har daqiqalik trigger qayta urinadi. Katta xabarlar va oldingi navbatlar _BotOutbox orqali ishlaydi. OUTBOX_CURSOR eski yuborilgan yozuvlarni takror o‘qishni kamaytiradi. Takroriy webhook xabarlari RECENT_UPDATES:* Script Properties orqali aniqlanadi; eski IDlar _BotUpdates varag‘iga 64 tadan arxivlanadi.

Rasmlar va ularning promptlari: assets/prompts.md. assets/manifest.json bo‘limlar va fayllarni bog‘laydi, assets/telegram-art.json Telegram file_id qiymatlarini saqlaydi. AI vositasi: built-in image_gen.

Tezlik sinovi: python3 tools/benchmark_hosted.py (faqat egasining menyu buyruqlari). UI’da kirish ruxsati talab qilinadi; maxfiy kalitlar konsolga chiqarilmaydi.

## Hisobot va tekshiruv yangilanishi

Har bir kun uchun yyyy-MM-dd nomli bitta hisobot varag‘i mavjud. Barcha bo‘limlar shu varaqdagi Bo‘lim, Xodim FISH, Xabar, Foydalanuvchi FISH va Sana (Toshkent) ustunlariga ketma-ket yoziladi. Telegramdagi ism yoki nik hisobotga yozilmaydi. Xabar ID va Telegram ID hisobotga yozilmaydi. Ruxsatlarni boshqarish uchun Telegram ID botning ichki foydalanuvchilar ro‘yxatida kerak bo‘ladi. Takroriy hisobotni aniqlash uchun asl ID o‘rniga qisqartirilgan SHA-256 hashlar ixcham Sheets metadata guruhlarida saqlanadi. Yarim yozilgan xabar REPORT_PENDING:* orqali ayni qatorga qayta yoziladi.

«Xabarni ko‘rish» matnni saqlashdan oldin ko‘rsatadi. Uzun ko‘rinish qisqartiriladi, hisobot esa to‘liq saqlanadi. «Oxirgi yozuvni bekor qilish» faqat faol bo‘limdagi so‘nggi yozuvni olib tashlaydi. /help foydalanish tartibini ko‘rsatadi.

Admin amallari foydalanuvchi holatining revision raqamiga bog‘langan; eski tasdiqlash/bekor qilish tugmalari keyingi holatga ta’sir qilmaydi. Telegram retry_after javobi hisobga olinadi, bir foydalanuvchining navbati boshqasini to‘xtatmaydi. Rasmga 400 xatosi qaytsa, matn va xodimlar tugmalari chiqadi.

Maxfiy kalit bilan maintain operatsiyasi faqat mavjud hisobotlardan ikki ID ustunini olib tashlaydi. Qatorlar soni va qolgan to‘rtta maydonning hashini avval/keyin solishtiradi. audit operatsiyasi faqat ustun sarlavhalari, qator soni va formula sonini qaytaradi. Yangi foydalanuvchi ma’lumotlari audit javobiga chiqmaydi.

Yangi foydalanuvchi /start bosgach F.I.Sh. kiritadi. F.I.Sh. saqlangandan keyingina administratorga kirish so‘rovi yuboriladi. Avval tasdiqlanganlar F.I.Sh. kiritganda ruxsatini yo‘qotmaydi. Foydalanuvchilar ro‘yxati faqat admin botida boshqariladi; alohida ko‘rinadigan Foydalanuvchilar varag‘i yaratilmaydi; hisobotlarda FISH yuborilgan paytdagi qiymat bilan yoziladi. Eski hisobotlarda mavjud bo‘lmagan FISH bo‘sh qoladi.

8 500 baytdan kichik qoralamalar Script Properties’da doimiy saqlanadi; kattaroq qoralamalar ichki Sheets varag‘ida bo‘laklarga ajratilib saqlanadi. Bu odatiy xabarlar uchun Sheets’ga murojaatlarni kamaytiradi. HOSTED_MODE=1 holatida mahalliy Python botlari faqat eski zaxira nusxa hisoblanadi; jonli bot hosted_bot.gs orqali ishlaydi.

Tasdiqlangan hisobotdagi har bir xodim yozuvi alohida qatorga saqlanadi. Xodim FISH tanlangan xodimni, Foydalanuvchi FISH botga kirishda kiritilgan ismni bildiradi. Qisman saqlashdan keyingi takroriy tasdiq oldin saqlangan qatorlarni takrorlamaydi.

## DMED foydalanish dashboardi

Birinchi `Dashboard` varag‘i xabarlar sonini baho sifatida ishlatmaydi. Har 15 bo‘lim uchun DMED holati, manba katagi va sanasi, kuzatuv hamda keyingi qadam ko‘rsatiladi. Holatlar: Foydalanilmoqda, Qisman foydalanilmoqda, Foydalanilmayapti, Texnik to‘siq, Ziddiyatli dalillar, Dalil yetarli emas. Foiz yoki ball berilmaydi; ular uchun DMED amaliyot jurnallari va tasdiqlangan mezonlar kerak.

Manba: besh ustunli `yyyy-MM-dd` kundalik varaqlar; oxirgi 30 kalendar kun ichidagi eng so‘nggi 200 yozuv, har biri 1500 belgigacha. Asl hisobotlar o‘zgarmaydi. Bir xodim haqidagi kuzatuv butun bo‘limga umumlashtirilmaydi. Sinov matni dalil bo‘lmaydi. Har bir ma’lum holat uchun AI bergan parcha aynan shu bo‘lim manbasida mavjudligi tekshiriladi; yo‘q, takroriy yoki begona bo‘limli natija rad etiladi. Xabar kelmagani foydalanmaslikni anglatmaydi. Yangi manba kelganda eski baho joriy holat sifatida ko‘rsatilmaydi.

`dashboard.gs` kodi `hosted_bot.gs` oxirida bor; jonli loyihaga faqat to‘liq hosted_bot.gs saqlanadi. `Dashboard.html` eski, foydalanilmaydigan nusxa. `installDashboard` DMED ko‘rinishini o‘rnatadi va 5 daqiqalik trigger yaratadi. `enableDashboardAI` rozilikni saqlaydi. Gemini API kalitini foydalanuvchi Apps Script → Project settings → Script properties ichiga `GEMINI_API_KEY` nomi bilan o‘zi kiritadi. Ixtiyoriy `GEMINI_MODEL`: standart `gemini-2.5-flash`. AI yangi ma’lumotni kamida 15 daqiqalik oraliqda tahlil qiladi. Kalit yoki AI javobi bo‘lmasa holatlar “Dalil yetarli emas”, ko‘rsatkichlar esa baho sifatida mavjud emas deb ochiq ko‘rsatiladi.

FISH maydonlari tashqi xizmatga yuborilmaydi, ma’lum to‘liq FISH matnda uchrasa yashiriladi; erkin matnda boshqa shaxsiy ma’lumot qolishi mumkin. Botning javob yuborish yo‘li AI tahlilini kutmaydi. AI natijalari bo‘limlar kesimida alohida Script Properties qiymatlarida saqlanadi.

### Kundalik xodimlar ro‘yxatlari

Dashboard yuqorisida bugungi xabarlar bo‘yicha ikki ro‘yxat bor: ijobiy DMED natijalari va yordam ehtiyoji qayd etilgan xodimlar, har birida ko‘pi bilan 5 FISH. Ular xodimning umumiy kasbiy reytingi yoki bandlik bo‘yicha qaror emas. Tanlov xabar soniga emas, aniq natija yoki o‘qitish/foydalanish ehtiyoji daliliga asoslanadi. Texnik uzilish xodim aybi sifatida talqin qilinmaydi. Dalil yetmasa ro‘yxat beshtagacha sun’iy to‘ldirilmaydi.

Gemini faqat mahalliy yaratilgan xodim kodini oladi; FISH mosligi Google’dagi manba qatoridan tiklanadi. Ism maydoni va foydalanuvchi FISH tashqi xizmatga yuborilmaydi. Har dalil aynan shu xodimning bugungi xabariga tegishli ekanligi tekshiriladi; begona yoki kechagi dalil, takroriy kod, sinov matni va ixtiro qilingan parcha rad etiladi. Toshkentda sana o‘zgarsa oldingi kun ismlari yangi ro‘yxatga ko‘chirilmaydi. Bo‘limlar tahlili oldingidek 30 kunlik oynadan foydalanadi.

Dashboard sana filtri: C4 — boshlanish, G4 — tugash (yyyy-mm-dd, Toshkent, ikkala kun ham kiradi). Birinchi o‘rnatishda bugungi kun tanlanadi. Sana tahriri installable `dashboardDateEdited` trigger orqali qayta hisoblaydi; davriy 5 daqiqalik yangilanish ham saqlanadi. Xodimlar kuzatuvlari ham tanlangan davr bilan cheklanadi. Foizlar holatdagi bo‘limlar / jami 15 bo‘lim ulushidir; AI natijasi yo‘q bo‘lsa tasdiqlangan holatlar «—», dalil yetarli emas 100% ko‘rsatiladi. Foiz havolasi `Davr hisobotlari` ichidagi tegishli guruhga olib boradi; har yozuvning «Asl kunlik hisobot» havolasi asl kunlik varaqdagi qatorni ochadi. Asl ma’lumotlar o‘zgarmaydi.

Dashboard 55-qatordan «Hisobot kelgan bo‘limlar» ro‘yxatini ko‘rsatadi: tanlangan davrda ma’lumot mavjud bo‘limlar, xabarlar soni, takrorlanmagan xodim FISHlari soni va oxirgi xabar vaqti. Bu ro‘yxat Gemini kalitisiz ham manba ma’lumotlardan yangilanadi.

Dashboard v4: yuqorida C4/G4 sanalari, hisobot kelgan/kelmagan bo‘lim foizlari va Gemini tasdiqlagan DMED holatlari. 29–43-qatorlarda har doim barcha 15 bo‘lim, kelgan/kelmagan holati, xabar soni va bevosita kunlik varaqqa havola turadi. Pastdagi xabar matnlari va eski takroriy bo‘lim jadvali olib tashlangan. `Davr hisobotlari` hosila varag‘i installDashboard orqali o‘chiriladi, qayta yaratilmaydi. Foiz havolasi tanlangan davrdagi eng so‘nggi tegishli manba qatoriga o‘tadi; bir necha kun bo‘lsa boshqa kunlar o‘z nomidagi varaqlarda qoladi. Ma’lumot kelmagan bo‘lim uchun tugash kunining varaq sarlavhasiga havola beriladi (varaq mavjud bo‘lsa). AI ro‘yxatlari umumiy kasbiy baho emas, DMED natijalari / yordam ehtiyoji kuzatuvlaridir; kalit yoki dalil bo‘lmasa FISH ixtiro qilinmaydi.


## 100 ta yozuvni ko‘rish va tahrirlash (15-versiya)
Tasdiqlashdan oldin bir bo‘limdagi 100 tagacha yozuv 10 tadan sahifalanadi. «Xabarni tahrirlash» orqali yozuv raqami va xodim tanlanib, yangi matn yuboriladi. Bekor qilish avvalgi matnni saqlaydi. Uzun ko‘rinishlar Telegram chegarasiga mos bo‘linadi, qisqartirilmaydi. Umumiy 45 000 belgi chegarasi saqlanadi. Saqlash boshlangan yoki Sheets’ga yuborilgan paketlar bu funksiya orqali o‘zgartirilmaydi; bu qisman yozilgan paketlarni takrorlashdan himoya qiladi.
Mahalliy 100-yozuv, sahifalash, bekor qilish, noto‘g‘ri tanlov, Unicode va 101-yozuvni cheklash testlari o‘tdi. Amaldagi web deployment 15-versiyaga yangilandi.

### Dashboard monitoring (2026-10-09)
The date-filtered Dashboard now includes four coverage/obstacle cards, a 15-department DMED distribution donut, a department status chart, daily report flow, all 15 department actions and the AI summary. Coverage counts are explicitly separate from DMED usage assessment. Missing evidence is unclassified; technical obstacles are not employee fault. Existing percentage source links and date inputs remain. `tests/test_hosted.cjs` verifies inclusive dates, zero-report days, unique employees and all 15 statuses.

AI interpretation revision: DMED context explicitly applies to shorthand/typo-heavy module reports. Mixed module/employee usage is partial usage, not a contradiction. Structured source references are hydrated with the original source excerpt before validation, preventing paraphrased quotes from discarding otherwise valid department findings. Foreign department/employee references remain rejected. Cache revision verified-v3 forces reanalysis. Dashboard cards now display percentages plus department counts; lower status groups show department findings. Live reanalysis of 115 records completed 2026-10-09 20:43; 2 full, 6 partial and 1 unused departments. 30 test groups pass.

Dashboard pulse adds six date-filtered metrics: distinct entered sender names, days with reports, days without reports, average reports per calendar day, treatment-course mentions and patient-movement mentions. Module mentions are explicitly not usage scores. Cards use three accent palettes and explanatory subtitles. Dashboard cells and notes replace the standalone AI label after every refresh; formulas and hyperlinks are preserved. Added date/mention/label regression tests pass.

Dashboard KPI readability revision (insights-v5): coverage cards now show total reports, unique reported employees, departments with reports and departments classified into the three usage states. Larger centered values, distinct backgrounds and field notes explain each count. The former generic disclaimer is replaced by live category totals and analysed/total coverage. The three unwanted pulse cards remain removed. Live Apps Script execution completed at 21:16 on 2026-10-09: 124/124 records, 15 departments, three charts, no error. Native visual verification showed 124 reports, 104 employees, 12/15 reporting departments and 11/15 classified departments (3 full, 6 partial, 2 unused, 4 requiring clarification). All 32 local test groups passed.

Dashboard legend and PNG exports (2026-10-09): six status colors now have live department counts and plain-language explanations at A159:N167; A8 explains the 15-department percentage denominator. The bound Sheet's Dashboard menu opens a local canvas export dialog for A1:N167, including merged cells, formatting and all three embedded chart PNGs. No external export service or additional Drive files. Added script.container.ui scope for the dialog; onOpen runs from the spreadsheet (not the Apps Script editor context). Existing 32 test groups and generated browser-script syntax checks passed. Live refresh succeeded at 21:28; the native download test completed DMED-Dashboard.png (1,353 KB). Individual chart download links also rendered successfully.

## Admin darajalari (16-versiya)
`ADMIN_IDS` dagi birinchi ID — katta admin. `REGULAR_ADMIN_IDS` — bot orqali boshqariladigan oddiy adminlar.
Katta admin: Foydalanuvchilar → tasdiqlangan mijoz → Oddiy admin qilish → Tasdiqlash.
Adminlar menyusi orqali oddiy admin vakolatini bekor qiladi. Oddiy admin faqat oddiy mijoz ruxsatini bekor qiladi; tasdiqlash, tiklash, admin qo‘shish/chiqarish vakolatiga ega emas. Adminlarni mijoz sifatida chiqarish ham bloklangan.
Rol chegaralari soxta callback va to‘g‘ridan-to‘g‘ri qaror chaqiriqlari bilan test qilindi.

17-versiya: admin botida /start → FISH → katta admin tasdiqlashi/rad etishi. Oddiy admin bo‘lish so‘rovlari asosiy botning mijoz so‘rovlaridan alohida saqlanadi (`ADMIN_REQUEST:<id>`). Katta adminda «Admin so‘rovlari» menyusi mavjud.
Dashboard diagramma manbasi ro‘yxatdagi bo‘limlar soniga mos yoziladi; 14 bo‘lim uchun 15 qator (sarlavha bilan). Eski bo‘lim qatorlari tozalanadi, bo‘limlar soni ko‘rsatilgan sarlavhalar va diagramma oralig‘i yangilanadi.

DMED tahlili: har bir yuborilgan xabar uchun alohida `report_assessments` (ref + holat) majburiy. Bo‘lim xulosasi shu baholardan jamlanadi: bajarilgan va bajarilmagan ishlar birga bo‘lsa qisman; faqat bilim/o‘qitish foydalanish dalili hisoblanmaydi. Xabar yo‘q holati alohida sabab bilan ko‘rsatiladi. Tushib qolgan/takroriy ref javoblari qabul qilinmaydi. «Dashboard → Mazmunni qayta tahlil qilish» oldingi tahlil keshini bekor qiladi va yangisini so‘raydi.
