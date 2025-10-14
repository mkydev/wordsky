import { reactive } from "vue";
import { io } from "socket.io-client";

export const state = reactive({
  connected: false,
});

// Geliştirme ortamı için localhost, canlı ortam için sunucu adresinizi kullanın.
const URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const socket = io(URL, {
  autoConnect: false,
});

socket.on("connect", () => {
  state.connected = true;
});

socket.on("disconnect", () => {
  state.connected = false;
});
