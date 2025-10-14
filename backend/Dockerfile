# Temel olarak Node.js 20'nin hafif bir sürümünü kullanıyoruz.
FROM node:20-alpine

# Uygulama dosyalarının bulunacağı dizini ayarlıyoruz.
WORKDIR /app

# İlk olarak sadece package.json ve package-lock.json dosyalarını kopyalıyoruz.
# Bu sayede, her kod değişikliğinde gereksiz yere bağımlılıklar tekrar yüklenmez.
COPY package*.json ./

# Proje bağımlılıklarını yüklüyoruz.
RUN npm install

# Projenin geri kalan tüm dosyalarını kopyalıyoruz.
COPY . .

# TypeScript kodunu JavaScript'e derliyoruz.
RUN npm run build

# Uygulamanın çalışacağı portu dışarıya açıyoruz.
# server.ts dosyanızda port 3000 olarak belirtilmiş.
EXPOSE 3000

# Container çalıştığında backend sunucusunu başlatan komut.
CMD ["node", "dist/server.js"]