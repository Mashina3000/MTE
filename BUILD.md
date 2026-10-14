# BUILD.md - Инструкция по сборке

## Быстрая сборка Windows установщика

### Способ 1: Локально на Windows (рекомендуется)

#### Требования
- Windows 10/11
- Node.js 18.x LTS или выше
- npm 9.x или выше

#### Шаги

1. **Установить зависимости**
```bash
npm install
```

2. **Собрать приложение**
```bash
npm run dist:exe
```

3. **Готовые файлы**
Установщик и портативная версия находятся в папке `dist/`:
- `Minecraft Texture Editor-0.1.0-setup.exe` - NSIS-установщик (при повторном запуске будет обновлять уже установленную версию, если выбрана та же папка установки)
- `Minecraft Texture Editor-0.1.0-portable.exe` - портативная версия

Примечание по обновлению при установке:
- Инсталлятор NSIS настроен так, чтобы при запуске поверх уже установленной версии он обновлял файлы приложения и не требовал предварительного удаления. 
- Чтобы это работало, используйте одну и ту же папку установки и тот же `shortcutName` (по умолчанию "Minecraft Texture Editor").
- Если вы устанавливали приложение для одного пользователя (не `perMachine`), запустите инсталлятор без прав администратора; если предыдущая установка была глобальной, потребуется запустить инсталлятор от администратора для перезаписи в Program Files.
- В установщике включён флаг запуска приложения после завершения установки (runAfterFinish).
### Способ 2: Без Node.js на своём компьютере (GitHub Actions)

#### Требования
- GitHub аккаунт
- Репозиторий проекта на GitHub

#### Шаги

1. **Загрузить проект на GitHub**

   Создайте репозиторий на GitHub, затем откройте терминал Git в папке проекта и выполните команды, подставив адрес своего репозитория:

```bash
git add .
git commit -m "Build app with GitHub Actions"
git push
```

   Если `git push` сообщит, что удалённый репозиторий не настроен, сначала добавьте его и отправьте ветку:

```bash
git remote add origin https://github.com/your-username/minecraft-texture-editor.git
git push -u origin main
```

2. **Запустить сборку**

   Откройте репозиторий на GitHub, выберите **Actions**, workflow **Build Windows Installer**, затем **Run workflow**. Сборка также запускается автоматически при отправке изменений в `main`, `master` или `develop`, при создании pull request в `main`/`develop` и при отправке тега `v*`.

3. **Скачать `.exe`**

   После успешной сборки откройте её страницу в Actions и скачайте артефакт **windows-exe**. Внутри будут установщик и портативная версия. Артефакт хранится 14 дней. Для тега версии `v*` workflow также создаёт GitHub Release с файлами `.exe`.

Node.js устанавливается на временный компьютер GitHub Actions, а не на ваш компьютер. Локально для этого способа нужны Git и доступ к GitHub. В проекте пока нет `package-lock.json`, поэтому workflow использует `npm install`, а не `npm ci`.

## Детальная инструкция: Сборка вручную

### Шаг 1: Подготовка окружения

```bash
# Проверить версию Node.js (должна быть 18.x или выше)
node --version

# Проверить версию npm
npm --version

# Установить глобально electron-builder (опционально)
npm install -g electron-builder
```

### Шаг 2: Установка зависимостей

```bash
# Очистить старый кэш (если была ошибка)
npm cache clean --force

# Установить все зависимости
npm install

# Проверить установку
npm list electron electron-builder
```

### Шаг 3: Сборка веб-приложения

```bash
# Собрать оптимизированный build
npm run build

# Проверить, что папка dist/ создана
dir dist
```

### Шаг 4: Компиляция Electron кода

```bash
# Скомпилировать TypeScript в dist-electron
npm run electron:build
```

### Шаг 5: Сборка Windows инсталлятора

```bash
# Собрать .exe
npm run electron:build:win
```

Или альтернативно:
```bash
npm run dist:exe
```

### Шаг 6: Поиск готового файла

Файлы находятся в папке `dist/`:

```bash
dir dist

# Вывод:
# Minecraft Texture Editor-0.1.0.exe              (NSIS installer)
# Minecraft Texture Editor-0.1.0-portable.exe     (portable version)
```

## Решение проблем при сборке

### Ошибка: "Module not found"

**Решение:**
```bash
rm -r node_modules package-lock.json
npm install
```

### Ошибка: "electron not found"

**Решение:**
```bash
npm install --save-dev electron
npm install --save-dev electron-builder
```

### Ошибка: "Port 5173 is already in use"

**Решение:**
```bash
# Windows: найти и убить процесс на порту 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Или просто изменить порт в vite.config.ts
```

### Ошибка: "Cannot find tsc command"

**Решение:**
```bash
npm install --save-dev typescript
npx tsc --version
```

### Ошибка: "Builder configuration is not valid"

Убедитесь, что `package.json` содержит секцию `build` с правильными параметрами.

## Дополнительные команды

```bash
# Только сборка (без Electron)
npm run build

# Запуск dev сервера
npm run dev

# Запуск Electron app
npm run electron:dev

# Компиляция Electron без сборки инсталлятора
npm run electron:build

# Только Windows installer
npm run electron:build:win

# Полная цепочка сборки .exe
npm run dist:exe
```

## Информация о версии

Версия приложения берётся из `package.json`:

```json
"version": "0.1.0"
```

При обновлении версии:
1. Обновить `version` в `package.json`
2. Создать новый tag: `git tag v0.1.0`
3. Пересобрать приложение

## Подписание приложения (опционально)

Для подписания .exe-файла (требуется сертификат):

В `package.json` раздел `build`:
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password",
  "certificateSha1": "..."
}
```

Это требуется для установки приложения без предупреждений о неизвестном издателе.

## Распространение

### Способ 1: Прямая ссылка на .exe
Поместите файл на сервер и поделитесь ссылкой.

### Способ 2: GitHub Releases
1. Создайте Release на GitHub
2. Прикрепите .exe файл
3. Пользователи смогут скачать со страницы releases

### Способ 3: Самоустанавливающееся приложение
NSIS установщик позволяет:
- Выбрать папку установки
- Создать ярлыки на рабочем столе
- Поддерживать обновления
- Работать без прав администратора

## Дополнительная информация

- [Electron Builder документация](https://www.electron.build/)
- [NSIS installer](https://nsis.sourceforge.io/)
- [Vite документация](https://vitejs.dev/)

## Для разработчиков

Если у вас возникли проблемы при сборке, проверьте:
1. Версию Node.js (`node --version`)
2. Все ли зависимости установлены (`npm install`)
3. Нет ли синтаксических ошибок (`npm run type-check`)
4. Логи сборки (обычно информативны)

Выполните полную очистку и пересборку:
```bash
npm cache clean --force
rm -r node_modules dist dist-electron
npm install
npm run dist:exe
```
