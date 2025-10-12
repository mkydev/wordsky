<template>
  <div class="splash-screen">
    <img src="@/assets/favicon3.png" alt="App Logo" />
  </div>
</template>

<style scoped>
.splash-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #2c3e50;
  z-index: 9999;
}

img {
  max-width: 220px;
  max-height: 220px;
}
</style>
