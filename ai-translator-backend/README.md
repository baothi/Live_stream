# AI Meeting Translator

> Dich tieng Viet sang tieng Anh **realtime** trong cuoc hop online (Google Meet, Zoom, Microsoft Teams).

---

## Muc luc

- [Tong quan](#tong-quan)
- [Kien truc he thong](#kien-truc-he-thong)
- [Yeu cau he thong](#yeu-cau-he-thong)
- [Cau truc thu muc](#cau-truc-thu-muc)
- [Huong dan chay Backend](#huong-dan-chay-backend)
  - [Cach 1: Docker (khuyen nghi)](#cach-1-docker-khuyen-nghi)
  - [Cach 2: Chay local (khong Docker)](#cach-2-chay-local-khong-docker)
- [Huong dan cai Chrome Extension](#huong-dan-cai-chrome-extension)
- [Test thu API](#test-thu-api)
- [Cach su dung](#cach-su-dung)
- [Cau hinh API Keys](#cau-hinh-api-keys)
- [Cac lenh Makefile](#cac-lenh-makefile)
- [Xu ly loi thuong gap](#xu-ly-loi-thuong-gap)

---

## Tong quan

Ung dung gom 2 phan:

| Thanh phan | Cong nghe | Mo ta |
|------------|-----------|-------|
| **Backend** | NestJS + MongoDB | Nhan audio tieng Viet, dich, tra audio tieng Anh |
| **Chrome Extension** | Manifest V3 | Bat mic trong cuoc hop, gui/nhan audio qua WebSocket |

**Pipeline xu ly:**

```
Mic (tieng Viet)
  -> Chrome Extension bat audio
  -> WebSocket gui len Backend
  -> Whisper STT (audio -> text VI)
  -> GPT-4o-mini (text VI -> text EN)
  -> ElevenLabs/OpenAI TTS (text EN -> audio EN)
  -> WebSocket tra ve Extension
  -> Inject audio vao cuoc hop
```

---

## Kien truc he thong

```
┌─────────────────────────┐     WebSocket      ┌─────────────────────────┐
│   Chrome Extension      │ ◄────────────────► │   NestJS Backend        │
│                         │                     │                         │
│  - Bat mic (16kHz WAV)  │                     │  - Auth (JWT)           │
│  - Gui audio chunk      │                     │  - Whisper STT          │
│  - Nhan audio EN        │                     │  - GPT-4o-mini dich     │
│  - Inject vao WebRTC    │                     │  - ElevenLabs/OpenAI TTS│
│  - Popup UI             │                     │  - MongoDB luu user     │
└─────────────────────────┘                     └───────────┬─────────────┘
                                                            │
                                                   ┌────────▼────────┐
                                                   │    MongoDB      │
                                                   │  (Docker :27019)│
                                                   └─────────────────┘
```

---

## Yeu cau he thong

| Phan mem | Phien ban | Bat buoc |
|----------|-----------|----------|
| **Docker Desktop** | 4.x+ | Co (neu chay bang Docker) |
| **Node.js** | 18+ | Co (neu chay local) |
| **npm** | 9+ | Co (neu chay local) |
| **MongoDB** | 6+ | Co (Docker tu cai, hoac cai rieng) |
| **Google Chrome** | 100+ | Co (de cai Extension) |
| **OpenAI API Key** | - | Co (cho Whisper + GPT + TTS) |
| **ElevenLabs API Key** | - | Khong bat buoc (co thi dung voice clone) |

---

## Cau truc thu muc

```
Live_stream/
├── ai-translator-backend/          # NestJS Backend
│   ├── src/
│   │   ├── main.ts                 # Entry point, khoi dong server
│   │   ├── app.module.ts           # Root module
│   │   ├── auth/                   # Xac thuc (JWT + Passport)
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── jwt-auth.guard.ts
│   │   ├── users/                  # Quan ly user
│   │   │   ├── user.schema.ts
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.controller.ts
│   │   └── translation/            # Dich thuat (core)
│   │       ├── translation.module.ts
│   │       ├── translation.controller.ts
│   │       ├── translation.gateway.ts    # WebSocket handler
│   │       └── translation.service.ts    # Whisper + GPT + TTS
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── Makefile
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env                        # Cau hinh (KHONG commit len git)
│   ├── .env.example
│   ├── .dockerignore
│   ├── mongo-init.js
│   └── Procfile
│
└── ai-translator-extension/        # Chrome Extension
    ├── manifest.json
    ├── background.js               # Service worker
    ├── content.js                  # Bat mic + inject audio
    ├── popup.html                  # Giao dien popup
    ├── popup.js                    # Logic popup
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

---

## Huong dan chay Backend

### Cach 1: Docker (khuyen nghi)

Day la cach don gian nhat — chi can Docker la du, khong can cai MongoDB rieng.

#### Buoc 1: Mo terminal, vao thu muc backend

```bash
cd d:\laptrinh\Live_stream\ai-translator-backend
```

#### Buoc 2: Cau hinh API Keys

Mo file `.env` va thay cac key that cua ban:

```env
# BAT BUOC - Thay bang OpenAI key that
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# TUY CHON - Thay bang ElevenLabs key (neu muon voice clone)
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
```

> Lay OpenAI key tai: https://platform.openai.com/api-keys
> Lay ElevenLabs key tai: https://elevenlabs.io/app/settings/api-keys

#### Buoc 3: Khoi dong

```bash
# Build va start tat ca (MongoDB + Backend)
docker compose up -d
```

Hoac dung Makefile:

```bash
make up
```

#### Buoc 4: Kiem tra da chay chua

```bash
# Xem trang thai containers
docker compose ps
```

Ket qua mong doi:

```
NAME                      STATUS              PORTS
ai-translator-mongo       Up (healthy)        0.0.0.0:27019->27017/tcp
ai-translator-backend     Up                  0.0.0.0:3000->3000/tcp
```

#### Buoc 5: Xem logs (tuy chon)

```bash
# Xem logs backend
make logs

# Xem tat ca logs
make logs-all
```

#### Buoc 6: Thu tao tai khoan

```bash
make register
```

Ket qua thanh cong:

```json
{
    "access_token": "eyJhbGciOiJIUzI1...",
    "user": {
        "id": "...",
        "name": "Test User",
        "email": "test@gmail.com",
        "plan": "free"
    }
}
```

#### Dung server

```bash
# Dung containers (giu data)
make down

# Xoa hoan toan (mat data DB)
make clean
```

---

### Cach 2: Chay local (khong Docker)

#### Buoc 1: Cai dat MongoDB

Dam bao MongoDB dang chay tren may. Neu dung MongoDB co authentication, cap nhat `MONGODB_URI` trong file `.env` cho phu hop.

Neu MongoDB khong co auth:

```env
MONGODB_URI=mongodb://localhost:27017/ai-translator
```

#### Buoc 2: Cai dependencies

```bash
cd d:\laptrinh\Live_stream\ai-translator-backend
npm install
```

#### Buoc 3: Cau hinh .env

Sua file `.env` — them OpenAI key va MongoDB URI phu hop.

#### Buoc 4: Chay dev server

```bash
npm run start:dev
```

Server se chay tai `http://localhost:3000` voi hot-reload.

---

## Huong dan cai Chrome Extension

#### Buoc 1: Mo Chrome, vao trang Extensions

```
chrome://extensions/
```

#### Buoc 2: Bat Developer Mode

Goc tren ben phai → bat **Developer mode** (che do nha phat trien).

#### Buoc 3: Load extension

1. Nhan nut **"Load unpacked"** (Tai tien mo rong da giai nen)
2. Chon thu muc: `d:\laptrinh\Live_stream\ai-translator-extension`
3. Extension se xuat hien trong danh sach

> **Luu y:** Can co file icon trong thu muc `icons/`. Neu chua co, extension van hoat dong nhung se hien icon mac dinh.

#### Buoc 4: Ghim Extension

Nhan icon puzzle (hinh ghe ghim) tren thanh cong cu Chrome → ghim **AI Meeting Translator** de de truy cap.

---

## Test thu API

### Dung curl:

```bash
# 1. Dang ky tai khoan
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@gmail.com","password":"123456"}'

# 2. Dang nhap
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","password":"123456"}'

# 3. Xem profile (thay TOKEN bang access_token nhan duoc)
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer TOKEN"
```

### Dung Makefile:

```bash
make register     # Tao tai khoan test
make login        # Dang nhap
make test-api     # Kiem tra server song
```

---

## Cach su dung

1. **Dam bao Backend dang chay** (`make up` hoac `npm run start:dev`)
2. **Mo Google Meet** hoac **Zoom** trong Chrome
3. **Nhan icon Extension** tren thanh cong cu
4. **Dang nhap** voi tai khoan da tao
5. **Bat toggle "Bat dich tu dong"**
6. **Noi tieng Viet** — he thong se tu dong:
   - Bat mic cua ban
   - Gui audio len server
   - Dich sang tieng Anh
   - Phat audio tieng Anh cho nguoi trong cuoc hop nghe

---

## Cau hinh API Keys

### OpenAI (bat buoc)

1. Vao https://platform.openai.com/api-keys
2. Tao API key moi
3. Dan vao `.env`:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxx
```

> Can co credit trong tai khoan OpenAI. Chi phi uoc tinh ~$0.01-0.05 moi phut dich.

### ElevenLabs (tuy chon — cho voice clone)

1. Vao https://elevenlabs.io/app/settings/api-keys
2. Tao API key
3. Dan vao `.env`:

```env
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxx
```

> Neu khong co ElevenLabs key, he thong se tu dong dung OpenAI TTS (giong mac dinh).

---

## Cac lenh Makefile

```bash
make help          # Hien thi tat ca lenh

# --- Docker ---
make up            # Start MongoDB + Backend
make down          # Dung tat ca
make build         # Build lai Docker image
make restart       # Restart backend
make logs          # Xem logs backend
make logs-mongo    # Xem logs MongoDB
make logs-all      # Xem tat ca logs
make clean         # Xoa containers + DB (CANH BAO!)
make status        # Xem trang thai

# --- Local Dev ---
make install       # npm install
make build-local   # Build TypeScript
make dev           # Chay dev mode (hot-reload)

# --- Test ---
make test-api      # Kiem tra server
make register      # Tao tai khoan test
make login         # Dang nhap test

# --- Database ---
make mongo-shell   # Mo MongoDB shell
```

---

## Xu ly loi thuong gap

### 1. Port 27019 da bi chiem

```
Error: bind: address already in use
```

**Cach xu ly:** Mo `docker-compose.yml`, doi port MongoDB sang port khac:

```yaml
ports:
  - "27020:27017"   # Doi thanh port khac
```

Va cap nhat `.env`:

```env
MONGODB_URI=mongodb://admin:mongo_secret_123@localhost:27020/ai-translator?authSource=admin
```

### 2. Backend khong ket noi duoc MongoDB

```
MongoServerError: Authentication failed
```

**Cach xu ly:**
- Kiem tra MongoDB container dang chay: `docker compose ps`
- Kiem tra `MONGODB_URI` trong `.env` khop voi `docker-compose.yml`
- Thu xoa va tao lai: `make clean && make up`

### 3. Extension khong ket noi duoc Backend

```
Loi: Khong ket noi duoc server
```

**Cach xu ly:**
- Dam bao Backend dang chay tai `http://localhost:3000`
- Kiem tra `BACKEND_URL` trong `popup.js` dung dia chi
- Kiem tra Chrome cho phep Extension truy cap localhost

### 4. Loi OpenAI API

```
401 Unauthorized
```

**Cach xu ly:**
- Kiem tra `OPENAI_API_KEY` trong `.env` la key hop le
- Dam bao tai khoan OpenAI con credit
- Sau khi doi `.env`, restart backend: `make restart`

### 5. Docker build loi

```bash
# Xoa cache va build lai
docker compose build --no-cache
docker compose up -d
```

---

## Thong tin them

| Muc | Chi tiet |
|-----|----------|
| **Backend URL** | http://localhost:3000 |
| **MongoDB URL** | localhost:27019 |
| **MongoDB Credentials** | admin / mongo_secret_123 |
| **WebSocket endpoint** | ws://localhost:3000/translation?token=JWT |
| **API Endpoints** | POST /auth/register, POST /auth/login, GET /users/me, PUT /users/voice-id, POST /translation/clone-voice |
