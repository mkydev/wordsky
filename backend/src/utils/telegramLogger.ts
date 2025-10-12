import axios from 'axios';

export const sendToTelegram = async (message: string): Promise<void> => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_BOT_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram HATA: Token veya Chat ID .env dosyasında tanımlanmamış.');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (error: any) {
    if (error.isAxiosError) {
      console.error(`Telegram'a mesaj gönderilirken hata (Axios): ${error.response?.status} ${JSON.stringify(error.response?.data)}`);
    } else {
      console.error(`Telegram'a mesaj gönderilirken hata: ${error}`);
    }
  }
};
