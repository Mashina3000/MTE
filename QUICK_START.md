# QUICK_START.md

## ⚡ Быстрый старт за 5 минут

### 1️⃣ Установка (2 минуты)

```bash
# Перейти в папку проекта
cd F:\minecraft-texture-editor

# Установить зависимости
npm install
```

> ⚠️ Требуется: Node.js 18.x+, npm 9.x+

### 2️⃣ Запуск в разработке (1 минута)

#### Вариант A: Веб-версия
```bash
npm run dev
```
Откроется на http://localhost:5173 в браузере

#### Вариант B: Electron приложение
```bash
npm run electron:dev
```
Запустится десктопное окно Electron

### 3️⃣ Сборка .exe для Windows (1 минута)

```bash
# На компьютере с Windows
npm run dist:exe
```

Готовый файл: `dist/Minecraft Texture Editor-0.1.0.exe`

### 4️⃣ Горячие клавиши

```
Ctrl+1  → Вкладка 1: Редактор
Ctrl+2  → Вкладка 2: Анимация
Ctrl+3  → Вкладка 3: Ресурс-пак
Ctrl+4  → Вкладка 4: 3D Preview
...
Ctrl+9  → Вкладка 9 (или последняя)
```

---

## 📋 Основные команды

```bash
npm run dev              # Запуск веб dev сервера
npm run build            # Сборка для продакшена
npm run electron:dev     # Запуск Electron
npm run dist:exe         # Сборка Windows .exe
npm run lint             # Проверка кода
npm run test             # Запуск тестов
```

---

## 🎨 Что уже реализовано

✅ **Вкладка 1 - Редактор текстур**
- Рисование на холсте (Konva.js)
- Система слоёв
- Инструменты: карандаш, ластик, заливка
- Параметры кисти (размер, жёсткость, форма)
- Импорт/экспорт

✅ **Вкладка 2 - Редактор анимации**
- Таймлайн кадров
- FPS контроль
- Экспорт .mcmeta

✅ **Вкладка 3 - Конструктор ресурс-пака**
- Выбор версий Minecraft
- Автоопределение pack_format
- Валидация
- Экспорт pack.mcmeta

⏳ **Вкладки 4-14** - Заглушки "В разработке"

---

## 🐛 Если что-то не работает

### npm: command not found
```bash
# Установить Node.js с npm: https://nodejs.org/
node --version  # Проверить версию (18.x+)
npm --version   # Проверить npm
```

### Port 5173 already in use
```bash
# Windows: убить процесс на порту
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Или изменить порт в vite.config.ts
```

### Module not found
```bash
npm install
npm cache clean --force
rm -r node_modules
npm install
```

---

## 📖 Документация

- **README.md** - полное описание
- **BUILD.md** - сборка .exe
- **TODO.md** - план развития
- **STAGE1_SUMMARY.md** - что реализовано на Этапе 1

---

## 🚀 Следующий шаг

Когда будете готовы к Вкладке 4, напишите:

```
Реализуй Вкладку 4 полностью
```

И будет реализована 3D Preview с Three.js!

---

**Всё готово! Начните с `npm install` 🎉**
