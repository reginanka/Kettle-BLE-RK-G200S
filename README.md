# Kettle BLE (RK-G200S)

**Language:** [English](#english) · [Українська](#українська)

---

## English

An unofficial, autonomous Progressive Web App (PWA) for local control of compatible **RK-G200S** smart kettles directly over **Web Bluetooth** — no cloud servers, accounts, or internet connection required.

> **Disclaimer:** This is an independent, unofficial open-source project created solely for personal local control of compatible hardware. It is not affiliated with, endorsed by, or connected to any appliance manufacturer. Product and model codes are referenced strictly to indicate hardware compatibility. Use at your own risk.

### Features

- **Thermal Control (`Чайник` tab)**
  - Three heating modes: **Boil (100 °C)**, **Heat & Keep Warm (40–100 °C, 1 °C step)**, and **Boil + Keep Warm**.
  - Quick temperature presets (`40°`, `55°`, `70°`, `85°`, `100°`), sound toggle (`0x3C`), parental lock indicator, and Start/Stop (`0x05` + `0x03` / `0x04`).
  - Live kettle visual with dynamic water tint, steam animation, and sensor alerts (*No water*, *Removed from base*).
  - Full live telemetry panel (shows *«Немає даних» / No data* when disconnected): current & target temp, flask/base status, boiling point offset (`-5..+5 °C`), water freshness hours (`0x52`), launch counter (`0x50`), energy consumption (`Wh` / `kWh`), runtime, heater resource (`0x47`), internal kettle clock (`0x6F`), and firmware version (`0x01`).
- **Lighting & Entertainment (`Світло` tab)**
  - Real-time **microphone FFT light-music** (Bass → R, Mid → G, High → B at ~7–8 fps with drop-frame protection).
  - **3-color cycling nightlight** (`0x03`) & **single-color lamp** (`0x04`), brightness (`20–255`), transition interval (`30–180 s`), and auto-off timer (`1–12 h`).
  - One-shot flash (`0x38`), disco sequence, and interactive lighting mini-games (*Simon Says* & *Guess the Color*).
  - Customizable **heating color scale** (`40° / 70° / 100°` saved to EEPROM via `0x32` + `0x36`, plus `0x33` readback and `40°/55°/70°/85°/100°` gradient preview).
- **Drink Presets (`Напої` tab)**
  - 9 curated beverage presets (white/green/oolong/black/pu-erh tea, French press coffee, infant formula, etc.) with one-tap mode & temperature selection.
- **Scheduler (`Розклад` tab)**
  - Local minute-accurate schedule jobs (*Once* or *Daily*) while the app is open and connected.
- **Link, Diagnostics & Alerts (`Зв’язок` tab)**
  - 8-byte auth key (`0xFF`) management: custom HEX, one-tap factory key (`FFFFFFFFFFFFFFFF`), random key generation, or key derivation from kettle MAC address.
  - Kettle clock sync/read (`0x6E` / `0x6F`), boiling temperature offset (`-5..+5 °C`), water freshness tracker (`0x51` / `0x52`).
  - Browser **Web Notifications** and Web Audio chimes for boiling completion and stale-water threshold alerts.
  - Live **HEX TX/RX packet console** with protocol frame decoding.
- **PWA & Offline Support**
  - Installable standalone app with Dark/Light themes and offline asset caching via `vite-plugin-pwa`.

### Browser & OS Compatibility

- **Supported:** Google Chrome / Microsoft Edge on **Android**, **Windows**, **macOS**, and **Linux** (requires HTTPS or `localhost`).
- **iOS Limitation:** Apple Safari and standard iOS browsers do not support Web Bluetooth. On iOS, a third-party Web Bluetooth browser (e.g., *Bluefy*) is required.
- **Hardware Note:** The RK-G200S model does not include a weight or continuous water-level sensor; it only reports binary empty/on-base errors (`0x06` byte 9).

### First-Time Pairing & Multi-Phone Usage

1. Ensure no other BLE app is actively holding the kettle's Bluetooth connection in the background.
2. Click **Підключити (Connect)** in the header and select `RK-G200S`.
3. If authorization (`0xFF`) is requested, click **Прив’язати зараз (Pair now)** and hold the **`+`** button on the kettle handle for **3–5 seconds** until it beeps.
4. **Sharing with a second phone:** The kettle stores a single 8-byte auth key. Copy the 16-character HEX key from the **Зв’язок** tab on the first phone (or set the same key / `FFFFFFFFFFFFFFFF` on both phones) and enter it on the second phone. Only one phone can maintain an active BLE connection at a time; disconnecting releases the kettle immediately for the other device.

### Local Development & Build

```bash
npm install
npm run dev      # Start local dev server on port 3000
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production PWA build into ./dist
npm run preview  # Preview production build locally
```

### Deployment & Native Android (Capacitor)

- **GitHub Pages:** Configured with `base: './'` and an automated workflow in `.github/workflows/deploy.yml`. Enable GitHub Pages (*Source: GitHub Actions*) in repository settings.
- **Capacitor APK (optional future step):** The BLE layer is abstracted behind `KettleTransport`, allowing `WebBluetoothTransport` to be swapped with a native `@capacitor-community/bluetooth-le` adapter for background auto-scan and direct MAC discovery in native Android builds.

---

## Українська

Неофіційний автономний веб-додаток (**PWA**) для локального керування сумісними розумними чайниками **RK-G200S** напряму через **Web Bluetooth** — без хмарних серверів, акаунтів та залежності від інтернету.

> **Дисклеймер:** Це незалежний, неофіційний open-source проєкт, створений виключно для особистого локального керування сумісним обладнанням. Проєкт не пов’язаний і не афілійований із жодним виробником побутової техніки; назви моделей згадано лише для позначення технічної сумісності. Використовуйте на власний ризик.

### Можливості

- **Термоконтроль (вкладка «Чайник»)**
  - Три режими нагріву: **Кип’ятіння (100 °C)**, **Нагрів і тепло (40–100 °C, крок 1 °C)** та **Кип’ятіння + тепло**.
  - Швидкі пресети температури (`40°`, `55°`, `70°`, `85°`, `100°`), перемикач звуку (`0x3C`), індикатор батьківського замка та Пуск/Стоп (`0x05` + `0x03` / `0x04`).
  - Візуалізація колби з динамічним кольором, парою та статус-попередженнями (*Немає води*, *Знято з бази*).
  - Повна панель живої телеметрії (показує *«Немає даних»*, коли чайник не підключено): поточна й цільова температура, стан колби й бази, зсув кипіння (`-5..+5 °C`), свіжість води (`0x52`), кількість пусків (`0x50`), спожита енергія (`Вт·год` / `кВт·год`), час наробітку, ресурс ТЕНа (`0x47`), годинник чайника (`0x6F`) та версія прошивки (`0x01`).
- **Підсвітка та світломузика (вкладка «Світло»)**
  - **Мікрофонна світломузика (FFT)** у реальному часі (Бас → R, Середні → G, Високі → B на ~7–8 fps).
  - **3-колірний нічник** (`0x03`) та **одноколірний світильник** (`0x04`), яскравість (`20–255`), інтервал переливу (`30–180 с`), таймер автовимкнення (`1–12 год`).
  - Разові спалахи (`0x38`), диско-послідовність та дві світлові міні-ігри (*«Саймон каже»* та *«Вгадай колір»*).
  - Налаштування **шкали кольорів нагріву** (`40° / 70° / 100°` із записом в EEPROM через `0x32` + `0x36`, зчитуванням `0x33` та 5-точковим прев’ю градієнта `40°/55°/70°/85°/100°`).
- **Напої (вкладка «Напої»)**
  - 9 готових рецептів (білий, зелений, улун, чорний, пуер, френч-прес, дитяче харчування тощо) із запуском в один клік.
- **Розклад (вкладка «Розклад»)**
  - Локальне автоувімкнення за часом (*Один раз* або *Щодня*), поки додаток відкритий і підключений.
- **Зв’язок, діагностика та сповіщення (вкладка «Зв’язок»)**
  - Керування 8-байтним ключем авторизації (`0xFF`): власний HEX, швидка кнопка заводського ключа (`FFFFFFFFFFFFFFFF`), генерація випадкового ключа або обчислення з MAC-адреси.
  - Читання та синхронізація годинника чайника (`0x6F` / `0x6E`), корекція температури кипіння (`-5..+5 °C`), контроль свіжості води (`0x51` / `0x52`).
  - Звукові сигнали та **Web Notification** про закипання чи застояну воду.
  - Жива **HEX-консоль TX/RX** із розшифровкою пакетів протоколу.
- **PWA та автономність**
  - Встановлення як окремого додатка на телефон або ПК, світла/темна тема та офлайн-кешування інтерфейсу через `vite-plugin-pwa`.

### Сумісність браузерів і пристроїв

- **Працює:** Google Chrome та Microsoft Edge на **Android**, **Windows**, **macOS** і **Linux** (потрібен HTTPS або `localhost`).
- **Обмеження iOS:** Safari та стандартний Chrome на iPhone не підтримують Web Bluetooth; на iOS потрібен спеціальний браузер із підтримкою BLE (наприклад, *Bluefy*).
- **Апаратна особливість:** у моделі RK-G200S немає ваг чи датчика рівня води у відсотках — чайник передає лише факт відсутності води або зняття з бази (`0x06`, байт 9).

### Перше підключення та користування з кількох телефонів

1. Закрийте інші Bluetooth-додатки, які можуть тримати з’єднання з чайником у фоні.
2. Натисніть **«Підключити»** в шапці та виберіть `RK-G200S`.
3. Якщо з’явиться запит авторизації (`0xFF`), натисніть **«Прив’язати зараз»** і затисніть кнопку **`+`** на ручці чайника на **3–5 секунд** до звукового сигналу.
4. **Користування удвох із двох телефонів:** чайник зберігає один 8-байтний ключ. Скопіюйте 16 HEX-символів ключа з вкладки **«Зв’язок»** першого телефону (або встановіть однаковий ключ / `FFFFFFFFFFFFFFFF` на обох) і вставте на другому телефоні. Одночасно підключеним може бути один телефон — щойно ви закриєте додаток або відключитеся, другий телефон зможе під’єднатися без повторної прив’язки.

### Локальний запуск і збірка

```bash
npm install
npm run dev      # Локальний сервер розробки (порт 3000)
npm run lint     # Перевірка типів TypeScript (tsc --noEmit)
npm run build    # Продакшн-збірка PWA у папку ./dist
npm run preview  # Локальний перегляд зібраної версії
```

### Публікація та збірка APK (Capacitor)

- **GitHub Pages:** у проєкті вже налаштований `base: './'` і workflow `.github/workflows/deploy.yml` (увімкніть Pages → *GitHub Actions* у налаштуваннях репозиторію).
- **Capacitor APK (опційно):** транспортний рівень винесений у `KettleTransport`, що дозволяє підмінити Web Bluetooth на нативний `@capacitor-community/bluetooth-le` для автоматичного фонового сканування та отримання MAC-адреси в Android APK.

---

## License / Ліцензія

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.
Поширюється за ліцензією **MIT License**. Деталі — у файлі [`LICENSE`](./LICENSE).
